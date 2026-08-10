// ============================================================
// Supabase Edge Function: fb-sync-clips
// TỰ ĐỘNG kéo chỉ số Facebook cho MỌI clip đã gán ID chiến dịch rồi lưu vào
// media_clips (giống nút "Cập nhật chỉ số FB" nhưng chạy phía server).
// Gọi định kỳ bằng pg_cron (mặc định mỗi 60 phút).
//
// Cần secret: FB_ADS_TOKEN (đã có sẵn từ fb-ads-insights / fb-daily-cost).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const API = "v21.0";
// CHÚ Ý: action_type của Facebook CHỒNG NHAU ("lead" đã gộp lead_grouped + pixel_lead...)
// -> phải CHỌN 1 nguồn chuẩn, cộng dồn sẽ cao gấp 2-3 lần Ads Manager.
type Action = { action_type: string; value: string };
const getAct = (actions: Action[] | undefined, t: string) => {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find((x) => x.action_type === t);
  return a ? Number(a.value) || 0 : 0;
};
function pickPurchases(actions: Action[] | undefined): number {
  const omni = getAct(actions, "omni_purchase");
  if (omni) return omni;
  const plain = getAct(actions, "purchase");
  if (plain) return plain;
  return getAct(actions, "offsite_conversion.fb_pixel_purchase") + getAct(actions, "onsite_conversion.purchase") + getAct(actions, "onsite_web_purchase");
}
function pickLeads(actions: Action[] | undefined): number {
  const lead = getAct(actions, "lead");
  if (lead) return lead;
  return getAct(actions, "onsite_conversion.lead_grouped") + getAct(actions, "offsite_conversion.fb_pixel_lead");
}
function pickMessages(actions: Action[] | undefined): number {
  const started = getAct(actions, "onsite_conversion.messaging_conversation_started_7d");
  if (started) return started;
  if (Array.isArray(actions)) {
    const anyStarted = actions.find((x) => x.action_type.includes("messaging_conversation_started"));
    if (anyStarted) return Number(anyStarted.value) || 0;
  }
  return getAct(actions, "onsite_conversion.total_messaging_connection");
}

// Tự chấm theo định nghĩa Win (giống scoreByRule ở web). phones = lead + purchase.
function scoreByRule(spend: number, phones: number, rule: { win_budget?: number; win_phones?: number } | null) {
  const target = rule && Number(rule.win_phones) > 0 && Number(rule.win_budget) > 0 ? Number(rule.win_budget) / Number(rule.win_phones) : null;
  if (!target) return null;
  if (!phones || phones <= 0) return { win: false, score: spend > 0 ? 2 : 0 };
  const ratio = (spend / phones) / target;
  const score = ratio <= 1 ? 10 : ratio <= 1.3 ? 8 : ratio <= 2 ? 6 : 3;
  return { win: score >= 10, score };
}

// Trạng thái FB -> nhóm (giống fbStatusInfo ở web)
const FB_REVIEW = ["IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED", "PENDING_BILLING_INFO", "WITH_ISSUES"];
function kindOf(status: string | null): "running" | "review" | "off" | null {
  if (!status) return null;
  if (status === "ACTIVE") return "running";
  if (FB_REVIEW.includes(status)) return "review";
  return "off";
}

// Chỉ chấm khi đã tiêu ≥ ngân sách Win HOẶC campaign đã tắt. Đang chạy & chưa đủ -> null.
function autoScore(spend: number, phones: number, status: string | null, rule: { win_budget?: number; win_phones?: number } | null) {
  const wb = Number(rule?.win_budget) || 0;
  if (!wb || !(Number(rule?.win_phones) > 0)) return null;
  const kind = kindOf(status);
  const inProgress = kind === "running" || kind === "review";
  if (inProgress && spend < wb) return null;
  return scoreByRule(spend, phones, rule);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Mã lỗi giới hạn tần suất của Facebook -> nghỉ rồi thử lại.
const RATE_CODES = [4, 17, 32, 613, 80000, 80004];
async function fetchJson(url: string, tries = 3): Promise<{ ok: boolean; data: any }> {
  let delay = 1500;
  for (let i = 0; i < tries; i++) {
    let r: Response; let d: any;
    try { r = await fetch(url); d = await r.json().catch(() => ({})); }
    catch (e) { if (i === tries - 1) return { ok: false, data: { error: { message: String((e as Error)?.message || e) } } }; await sleep(delay); delay *= 2; continue; }
    const limited = RATE_CODES.includes(d?.error?.code);
    if ((r.ok && !d.error) || !limited || i === tries - 1) return { ok: r.ok && !d.error, data: d };
    await sleep(delay); delay *= 2;
  }
  return { ok: false, data: {} };
}
// Gộp trạng thái nhiều quảng cáo: còn ACTIVE -> ACTIVE; còn đang duyệt -> duyệt; hết -> đã tắt.
function mergeStatus(list: (string | null)[]): string | null {
  if (list.some((s) => s === "ACTIVE")) return "ACTIVE";
  const rev = list.find((s) => s && FB_REVIEW.includes(s));
  if (rev) return rev;
  return list.find((s) => s) ?? null;
}
function metricsOf(obj: any) {
  const row = obj?.insights?.data?.[0] || {};
  const actions = row.actions as Action[];
  const messages = pickMessages(actions);
  const leads = pickLeads(actions);
  const purchases = pickPurchases(actions);
  return {
    spend: Number(row.spend) || 0, messages, leads, purchases,
    reach: Number(row.reach) || 0, impressions: Number(row.impressions) || 0,
    status: (obj?.effective_status ?? null) as string | null,
  };
}
// Cộng tổng chỉ số của NHIỀU id gán vào 1 clip — dùng ?ids= (1 request/50 id) để
// hạn chế tối đa số lần gọi (tránh chạm giới hạn tần suất khi cron quét cả kho).
async function fetchMany(token: string, ids: string[]) {
  const inner = "spend,impressions,reach,inline_link_clicks,actions";
  const fields = `effective_status,insights.date_preset(maximum){${inner}}`;
  const parts: ReturnType<typeof metricsOf>[] = [];
  const errors: string[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const p = new URLSearchParams({ ids: chunk.join(","), fields, access_token: token });
    const { ok, data } = await fetchJson(`https://graph.facebook.com/${API}/?${p.toString()}`);
    if (ok && data && !data.error) {
      for (const id of chunk) parts.push(metricsOf(data[id] || {}));
    } else {
      // batch hỏng (thường do 1 id sai) -> tách lẻ, backoff, bỏ id lỗi.
      for (const id of chunk) {
        const one = await fetchJson(`https://graph.facebook.com/${API}/${id}?${new URLSearchParams({ fields, access_token: token }).toString()}`);
        if (one.ok && !one.data?.error) parts.push(metricsOf(one.data));
        else errors.push(one.data?.error?.message || "lỗi");
      }
    }
  }
  if (!parts.length) throw new Error(errors[0] || "Không kéo được id nào");
  const sum = parts.reduce((a, x) => ({
    spend: a.spend + x.spend, messages: a.messages + x.messages, leads: a.leads + x.leads,
    purchases: a.purchases + x.purchases, reach: a.reach + x.reach, impressions: a.impressions + x.impressions,
  }), { spend: 0, messages: 0, leads: 0, purchases: 0, reach: 0, impressions: 0 });
  return {
    ...sum, results: sum.messages + sum.leads,
    status: mergeStatus(parts.map((p) => p.status)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("FB_ADS_TOKEN");
    if (!token) return json({ ok: false, error: "Chưa cấu hình FB_ADS_TOKEN" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: clips } = await sb.from("media_clips").select("id, fb_campaign_id, fb_ad_ids");
    // Chỉ lấy clip đã gán ít nhất 1 id (mảng fb_ad_ids mới hoặc fb_campaign_id cũ).
    const targets = (clips || []).filter((c) => (Array.isArray(c.fb_ad_ids) && c.fb_ad_ids.length) || c.fb_campaign_id);
    if (!targets.length) return json({ ok: true, synced: 0, note: "Chưa có clip nào gán ID quảng cáo" });

    const { data: rule } = await sb.from("ads_win_rule").select("*").eq("id", 1).maybeSingle();

    let synced = 0, failed = 0;
    for (const c of targets) {
      const ids = ((Array.isArray(c.fb_ad_ids) && c.fb_ad_ids.length ? c.fb_ad_ids : [c.fb_campaign_id]) as string[])
        .map((x) => String(x || "").replace(/\D/g, "")).filter(Boolean);
      if (!ids.length) continue;
      try {
        const m = await fetchMany(token, ids);
        const upd: Record<string, unknown> = {
          fb_spend: m.spend, fb_messages: m.messages, fb_leads: m.leads, fb_purchases: m.purchases,
          fb_reach: m.reach, fb_impressions: m.impressions, fb_results: m.results,
          fb_status: m.status, fb_synced_at: new Date().toISOString(),
        };
        // SĐT = Lượt mua (purchase) — KHÔNG dùng lead thay thế
        const v = autoScore(m.spend, m.purchases, m.status, rule);
        if (v) { upd.win = v.win; upd.score = v.score; }
        const { error } = await sb.from("media_clips").update(upd).eq("id", c.id);
        if (error) throw error;
        synced++;
      } catch (e) {
        failed++;
        console.error("sync clip fail", c.id, (e as Error)?.message);
      }
      await sleep(250); // nghỉ giữa các clip cho đỡ dồn request -> tránh chạm giới hạn tần suất
    }
    return json({ ok: true, synced, failed, total: targets.length });
  } catch (e) {
    console.error("fb-sync-clips error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
