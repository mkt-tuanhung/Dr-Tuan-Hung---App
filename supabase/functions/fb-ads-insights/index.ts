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
// Nhóm action: nhắn tin vs lead (form)
const MSG_ACTIONS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];
const LEAD_ACTIONS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
];

function sumActions(actions: { action_type: string; value: string }[] | undefined, keys: string[]): number {
  if (!Array.isArray(actions)) return 0;
  let n = 0;
  for (const a of actions) {
    if (keys.includes(a.action_type)) n += Number(a.value) || 0;
    else if (keys === MSG_ACTIONS && a.action_type.includes("messaging_conversation_started")) n += Number(a.value) || 0;
  }
  return n;
}

function pickVideoViews(arr: { value: string }[] | undefined): number {
  if (!Array.isArray(arr) || !arr.length) return 0;
  return Number(arr[0].value) || 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("FB_ADS_TOKEN");
    if (!token) return json({ ok: false, error: "Chưa cấu hình FB_ADS_TOKEN" });

    const body = await req.json().catch(() => ({}));
    const datePreset = body.date_preset || "maximum";

    // ---- Chế độ 1 chiến dịch: lấy chỉ số theo campaign_id (gán vào 1 clip) ----
    const campaignId = (body.campaign_id || "").toString().trim().replace(/[^0-9]/g, "");
    if (campaignId) {
      const p = new URLSearchParams({
        fields: "spend,impressions,reach,inline_link_clicks,ctr,actions,campaign_name",
        date_preset: datePreset,
        access_token: token,
      });
      if (body.since && body.until) { p.delete("date_preset"); p.set("time_range", JSON.stringify({ since: body.since, until: body.until })); }
      const r = await fetch(`https://graph.facebook.com/${API}/${campaignId}/insights?${p.toString()}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) return json({ ok: false, error: d?.error?.message || `Facebook lỗi HTTP ${r.status}`, code: d?.error?.code });
      const row = (d.data || [])[0] || {};
      const actions = row.actions as { action_type: string; value: string }[];
      const messages = sumActions(actions, MSG_ACTIONS);
      const leads = sumActions(actions, LEAD_ACTIONS);
      const spend = Number(row.spend) || 0;
      const results = messages + leads;
      return json({ ok: true, metrics: {
        campaign_name: row.campaign_name || null,
        spend, messages, leads, results,
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
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return json({ ok: false, error: data?.error?.message || `Facebook lỗi HTTP ${res.status}`, code: data?.error?.code });
    }

    const ads = (data.data || []).map((r: Record<string, unknown>) => {
      const spend = Number(r.spend) || 0;
      const actions = r.actions as { action_type: string; value: string }[];
      const messages = sumActions(actions, MSG_ACTIONS);
      const leads = sumActions(actions, LEAD_ACTIONS);
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
