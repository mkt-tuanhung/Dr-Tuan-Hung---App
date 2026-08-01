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
const MSG_ACTIONS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

type Action = { action_type: string; value: string };
function sumActions(actions: Action[] | undefined, keys: string[]): number {
  if (!Array.isArray(actions)) return 0;
  let n = 0;
  for (const a of actions) {
    if (keys.includes(a.action_type)) n += Number(a.value) || 0;
    else if (keys === MSG_ACTIONS && a.action_type.includes("messaging_conversation_started")) n += Number(a.value) || 0;
  }
  return n;
}
function pickPurchases(actions: Action[] | undefined): number {
  if (!Array.isArray(actions)) return 0;
  const get = (t: string) => { const a = actions.find((x) => x.action_type === t); return a ? Number(a.value) || 0 : 0; };
  const omni = get("omni_purchase");
  if (omni) return omni;
  const plain = get("purchase");
  if (plain) return plain;
  return get("offsite_conversion.fb_pixel_purchase") + get("onsite_conversion.purchase") + get("onsite_web_purchase");
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

async function fetchCampaign(token: string, campaignId: string) {
  const p = new URLSearchParams({
    fields: "spend,impressions,reach,inline_link_clicks,ctr,actions,campaign_name",
    date_preset: "maximum",
    access_token: token,
  });
  const r = await fetch(`https://graph.facebook.com/${API}/${campaignId}/insights?${p.toString()}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  const row = (d.data || [])[0] || {};
  const actions = row.actions as Action[];
  const messages = sumActions(actions, MSG_ACTIONS);
  const leads = sumActions(actions, LEAD_ACTIONS);
  const purchases = pickPurchases(actions);
  let status: string | null = null;
  try {
    const sr = await fetch(`https://graph.facebook.com/${API}/${campaignId}?fields=effective_status&access_token=${token}`);
    const sd = await sr.json().catch(() => ({}));
    if (sr.ok && !sd.error) status = sd.effective_status || null;
  } catch { /* bỏ qua */ }
  return {
    spend: Number(row.spend) || 0,
    messages, leads, purchases,
    reach: Number(row.reach) || 0,
    impressions: Number(row.impressions) || 0,
    results: messages + leads,
    status,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("FB_ADS_TOKEN");
    if (!token) return json({ ok: false, error: "Chưa cấu hình FB_ADS_TOKEN" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: clips } = await sb.from("media_clips").select("id, fb_campaign_id").not("fb_campaign_id", "is", null);
    if (!clips?.length) return json({ ok: true, synced: 0, note: "Chưa có clip nào gán ID chiến dịch" });

    const { data: rule } = await sb.from("ads_win_rule").select("*").eq("id", 1).maybeSingle();

    let synced = 0, failed = 0;
    for (const c of clips) {
      const cid = String(c.fb_campaign_id || "").replace(/\D/g, "");
      if (!cid) continue;
      try {
        const m = await fetchCampaign(token, cid);
        const upd: Record<string, unknown> = {
          fb_spend: m.spend, fb_messages: m.messages, fb_leads: m.leads, fb_purchases: m.purchases,
          fb_reach: m.reach, fb_impressions: m.impressions, fb_results: m.results,
          fb_status: m.status, fb_synced_at: new Date().toISOString(),
        };
        const v = autoScore(m.spend, m.leads + m.purchases, m.status, rule);
        if (v) { upd.win = v.win; upd.score = v.score; }
        const { error } = await sb.from("media_clips").update(upd).eq("id", c.id);
        if (error) throw error;
        synced++;
      } catch (e) {
        failed++;
        console.error("sync clip fail", c.id, (e as Error)?.message);
      }
    }
    return json({ ok: true, synced, failed, total: clips.length });
  } catch (e) {
    console.error("fb-sync-clips error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
