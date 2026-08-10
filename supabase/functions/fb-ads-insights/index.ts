// ============================================================
// Supabase Edge Function: fb-ads-insights
// Đọc chỉ số quảng cáo theo TỪNG AD (video) từ Facebook Marketing API:
// chi phí, kết quả/lead, CPA, hiển thị, lượt xem video, CTR.
//
// Setup (một lần) — KHÔNG cần App Review vì đọc tài khoản của chính mình:
//   1) developer.facebook.com → tạo App (loại Business) → thêm sản phẩm "Marketing API"
//   2) business.facebook.com → Business Settings → Users → System Users
//      → tạo System User → Assign Assets: gán Ad Account với quyền "ads_read"
//      → Generate Token (chọn app vừa tạo, scope ads_read, chọn "no expiration")
//   3) supabase secrets set FB_ADS_TOKEN=<token_hệ_thống>
//      supabase secrets set FB_AD_ACCOUNT_ID=<id_tài_khoản_ads, chỉ phần số>
//      supabase functions deploy fb-ads-insights
//
// Gọi: supabase.functions.invoke('fb-ads-insights', { body: { date_preset: 'last_30d' } })
// ============================================================
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const API = "v21.0";
// CHÚ Ý: các action_type của Facebook CHỒNG NHAU ("lead" đã gộp lead_grouped +
// pixel_lead; total_messaging_connection đã gồm conversation_started...).
// Phải CHỌN 1 nguồn chuẩn thay vì cộng dồn — cộng dồn sẽ ra số cao gấp 2-3 lần
// Ads Manager (vd Ads Manager 28 lead mà app hiện 56).
type Action = { action_type: string; value: string };
const getAct = (actions: Action[] | undefined, t: string) => {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find((x) => x.action_type === t);
  return a ? Number(a.value) || 0 : 0;
};
// Lượt mua (purchase): ưu tiên omni_purchase -> purchase -> (pixel + onsite).
function pickPurchases(actions: Action[] | undefined): number {
  const omni = getAct(actions, "omni_purchase");
  if (omni) return omni;
  const plain = getAct(actions, "purchase");
  if (plain) return plain;
  return getAct(actions, "offsite_conversion.fb_pixel_purchase") + getAct(actions, "onsite_conversion.purchase") + getAct(actions, "onsite_web_purchase");
}
// Khách hàng tiềm năng (lead): "lead" là số GỘP chuẩn của Ads Manager.
function pickLeads(actions: Action[] | undefined): number {
  const lead = getAct(actions, "lead");
  if (lead) return lead;
  return getAct(actions, "onsite_conversion.lead_grouped") + getAct(actions, "offsite_conversion.fb_pixel_lead");
}
// Tin nhắn: ưu tiên hội thoại bắt đầu (7d) -> tổng kết nối messaging.
function pickMessages(actions: Action[] | undefined): number {
  const started = getAct(actions, "onsite_conversion.messaging_conversation_started_7d");
  if (started) return started;
  if (Array.isArray(actions)) {
    const anyStarted = actions.find((x) => x.action_type.includes("messaging_conversation_started"));
    if (anyStarted) return Number(anyStarted.value) || 0;
  }
  return getAct(actions, "onsite_conversion.total_messaging_connection");
}

function pickVideoViews(arr: { value: string }[] | undefined): number {
  if (!Array.isArray(arr) || !arr.length) return 0;
  return Number(arr[0].value) || 0;
}

// Trạng thái đang duyệt của Facebook (giống web) — để gộp trạng thái nhiều quảng cáo.
const FB_REVIEW = ["IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED", "PENDING_BILLING_INFO", "WITH_ISSUES"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Mã lỗi giới hạn tần suất của Facebook -> nghỉ rồi thử lại (tránh "Application request limit reached").
const RATE_CODES = [4, 17, 32, 613, 80000, 80004];
// GET có tự thử lại khi bị giới hạn tần suất (backoff 1.5s -> 3s -> 6s).
async function fetchJson(url: string, tries = 3): Promise<{ ok: boolean; status: number; data: any }> {
  let delay = 1500;
  for (let i = 0; i < tries; i++) {
    let r: Response; let d: any;
    try { r = await fetch(url); d = await r.json().catch(() => ({})); }
    catch (e) { if (i === tries - 1) return { ok: false, status: 0, data: { error: { message: String((e as Error)?.message || e) } } }; await sleep(delay); delay *= 2; continue; }
    const limited = RATE_CODES.includes(d?.error?.code);
    if ((r.ok && !d.error) || !limited || i === tries - 1) return { ok: r.ok && !d.error, status: r.status, data: d };
    await sleep(delay); delay *= 2;
  }
  return { ok: false, status: 0, data: {} };
}
// Trường insights lồng (subfield) để lấy chỉ số kèm object trong 1 request.
function insightsField(datePreset: string, since?: string, until?: string) {
  const inner = "spend,impressions,reach,inline_link_clicks,actions";
  if (since && until) return `insights.time_range(${JSON.stringify({ since, until })}){${inner}}`;
  return `insights.date_preset(${datePreset}){${inner}}`;
}
function rowToMetrics(id: string, obj: any) {
  const row = obj?.insights?.data?.[0] || {};
  const actions = row.actions as Action[];
  const messages = pickMessages(actions);
  const leads = pickLeads(actions);
  const purchases = pickPurchases(actions);
  return {
    ad_id: id, name: obj?.name ?? null, status: obj?.effective_status ?? null,
    spend: Number(row.spend) || 0, messages, leads, purchases,
    reach: Number(row.reach) || 0, impressions: Number(row.impressions) || 0,
    results: messages + leads,
  };
}
// Kéo chỉ số + trạng thái của NHIỀU id trong ÍT request nhất:
// dùng ?ids=... (tối đa 50/req) kèm subfield insights -> 1 request cho cả nhóm,
// thay vì 2 request mỗi id (giảm mạnh nguy cơ chạm giới hạn tần suất).
async function fetchMany(token: string, ids: string[], datePreset: string, since?: string, until?: string) {
  const fields = `effective_status,name,${insightsField(datePreset, since, until)}`;
  const out: Array<Record<string, any>> = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const p = new URLSearchParams({ ids: chunk.join(","), fields, access_token: token });
    const { ok, data } = await fetchJson(`https://graph.facebook.com/${API}/?${p.toString()}`);
    if (ok && data && !data.error) {
      for (const id of chunk) out.push(rowToMetrics(id, data[id] || {}));
    } else {
      // 1 id sai làm hỏng cả batch -> tách lẻ để biết id nào lỗi (vẫn có backoff).
      for (const id of chunk) out.push(await fetchOne(token, id, datePreset, since, until));
    }
  }
  return out;
}
// Kéo lẻ 1 id (dự phòng khi batch lỗi) — cũng có backoff.
async function fetchOne(token: string, id: string, datePreset: string, since?: string, until?: string) {
  const p = new URLSearchParams({ fields: `effective_status,name,${insightsField(datePreset, since, until)}`, access_token: token });
  const { ok, data } = await fetchJson(`https://graph.facebook.com/${API}/${id}?${p.toString()}`);
  if (!ok || data?.error) return { ad_id: id, error: data?.error?.message || "Facebook lỗi", code: data?.error?.code };
  return rowToMetrics(id, data);
}
// Gộp trạng thái nhiều quảng cáo: còn 1 cái ACTIVE -> ACTIVE; còn cái đang duyệt
// -> đang duyệt; hết thì lấy trạng thái đầu tiên có (thường PAUSED = đã tắt).
function mergeStatus(list: { status?: string | null }[]): string | null {
  if (list.some((x) => x.status === "ACTIVE")) return "ACTIVE";
  const rev = list.find((x) => x.status && FB_REVIEW.includes(x.status));
  if (rev) return rev.status!;
  return list.find((x) => x.status)?.status ?? null;
}
// Gộp trạng thái nhiều quảng cáo: còn 1 cái ACTIVE -> ACTIVE; còn cái đang duyệt
// -> đang duyệt; hết thì lấy trạng thái đầu tiên có (thường PAUSED = đã tắt).
function mergeStatus(list: { status?: string | null }[]): string | null {
  if (list.some((x) => x.status === "ACTIVE")) return "ACTIVE";
  const rev = list.find((x) => x.status && FB_REVIEW.includes(x.status));
  if (rev) return rev.status!;
  return list.find((x) => x.status)?.status ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("FB_ADS_TOKEN");
    if (!token) return json({ ok: false, error: "Chưa cấu hình FB_ADS_TOKEN" });

    const body = await req.json().catch(() => ({}));
    const datePreset = body.date_preset || "maximum";

    // ---- Chế độ NHIỀU ID quảng cáo: cộng tổng chỉ số của tất cả id gán vào 1 clip ----
    // 1 video chạy trên nhiều campaign -> nhiều quảng cáo, nhập hàng loạt id để gộp.
    const adIds: string[] = Array.isArray(body.ad_ids)
      ? [...new Set(body.ad_ids.map((x: unknown) => String(x).replace(/[^0-9]/g, "")).filter(Boolean))]
      : [];
    if (adIds.length) {
      const per = await fetchMany(token, adIds, datePreset, body.since, body.until);
      const ok = per.filter((x) => !x.error);
      // Tất cả id đều lỗi -> báo lỗi (id đầu tiên) để người dùng biết mà sửa.
      if (!ok.length) return json({ ok: false, error: (per[0]?.error as string) || "Facebook lỗi", code: per[0]?.code, ads: per });
      const sum = ok.reduce((a, x) => ({
        spend: a.spend + (Number(x.spend) || 0),
        messages: a.messages + (Number(x.messages) || 0),
        leads: a.leads + (Number(x.leads) || 0),
        purchases: a.purchases + (Number(x.purchases) || 0),
        reach: a.reach + (Number(x.reach) || 0),
        impressions: a.impressions + (Number(x.impressions) || 0),
      }), { spend: 0, messages: 0, leads: 0, purchases: 0, reach: 0, impressions: 0 });
      const results = sum.messages + sum.leads;
      return json({ ok: true, metrics: {
        status: mergeStatus(ok as { status?: string | null }[]),
        spend: sum.spend, messages: sum.messages, leads: sum.leads, purchases: sum.purchases,
        reach: sum.reach, impressions: sum.impressions, results,
        cpa: results > 0 ? Math.round(sum.spend / results) : null,
      }, ads: per, ok_count: ok.length, count: per.length });
    }

    // ---- Chế độ 1 chiến dịch: lấy chỉ số theo campaign_id (gán vào 1 clip) ----
    const campaignId = (body.campaign_id || "").toString().trim().replace(/[^0-9]/g, "");
    if (campaignId) {
      const p = new URLSearchParams({
        fields: "spend,impressions,reach,inline_link_clicks,ctr,actions,campaign_name",
        date_preset: datePreset,
        access_token: token,
      });
      if (body.since && body.until) { p.delete("date_preset"); p.set("time_range", JSON.stringify({ since: body.since, until: body.until })); }
      const { ok: r_ok, status: r_status, data: d } = await fetchJson(`https://graph.facebook.com/${API}/${campaignId}/insights?${p.toString()}`);
      if (!r_ok || d.error) return json({ ok: false, error: d?.error?.message || `Facebook lỗi HTTP ${r_status}`, code: d?.error?.code });
      const row = (d.data || [])[0] || {};
      const actions = row.actions as { action_type: string; value: string }[];
      const messages = pickMessages(actions);
      const leads = pickLeads(actions);
      const purchases = pickPurchases(actions);
      const spend = Number(row.spend) || 0;
      const results = messages + leads;
      // Lấy trạng thái chiến dịch (ACTIVE / PAUSED...)
      let status: string | null = null;
      try {
        const { ok: s_ok, data: sd } = await fetchJson(`https://graph.facebook.com/${API}/${campaignId}?fields=effective_status&access_token=${token}`);
        if (s_ok && !sd.error) status = sd.effective_status || null;
      } catch { /* bỏ qua */ }
      return json({ ok: true, metrics: {
        campaign_name: row.campaign_name || null, status,
        spend, messages, leads, purchases, results,
        impressions: Number(row.impressions) || 0,
        reach: Number(row.reach) || 0,
        link_clicks: Number(row.inline_link_clicks) || 0,
        ctr: Number(row.ctr) || 0,
        cpa: results > 0 ? Math.round(spend / results) : null,
      } });
    }

    const acct = (body.ad_account_id || Deno.env.get("FB_AD_ACCOUNT_ID") || "").toString().replace(/^act_/, "");
    if (!acct) return json({ ok: false, error: "Chưa cấu hình FB_AD_ACCOUNT_ID" });

    const fields = [
      "ad_id", "ad_name", "campaign_name", "adset_name",
      "spend", "impressions", "reach", "inline_link_clicks", "ctr",
      "actions", "cost_per_action_type", "video_thruplay_watched_actions",
    ].join(",");
    const params = new URLSearchParams({
      level: "ad",
      fields,
      date_preset: datePreset,
      limit: "300",
      access_token: token,
    });
    if (body.since && body.until) {
      params.delete("date_preset");
      params.set("time_range", JSON.stringify({ since: body.since, until: body.until }));
    }

    const url = `https://graph.facebook.com/${API}/act_${acct}/insights?${params.toString()}`;
    const { ok: res_ok, status: res_status, data } = await fetchJson(url);
    if (!res_ok || data.error) {
      return json({ ok: false, error: data?.error?.message || `Facebook lỗi HTTP ${res_status}`, code: data?.error?.code });
    }

    const ads = (data.data || []).map((r: Record<string, unknown>) => {
      const spend = Number(r.spend) || 0;
      const actions = r.actions as { action_type: string; value: string }[];
      const messages = pickMessages(actions);
      const leads = pickLeads(actions);
      const purchases = pickPurchases(actions);
      const results = messages + leads; // tổng "kết quả xin được"
      return {
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        campaign_name: r.campaign_name,
        adset_name: r.adset_name,
        spend,
        impressions: Number(r.impressions) || 0,
        reach: Number(r.reach) || 0,
        link_clicks: Number(r.inline_link_clicks) || 0,
        ctr: Number(r.ctr) || 0,
        video_views: pickVideoViews(r.video_thruplay_watched_actions as { value: string }[]),
        messages,
        leads,
        purchases,
        results,
        cpa: results > 0 ? Math.round(spend / results) : null,
      };
    });

    return json({ ok: true, ads, count: ads.length, date_preset: datePreset });
  } catch (e) {
    console.error("fb-ads-insights error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
