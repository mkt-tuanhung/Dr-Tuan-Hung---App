// ============================================================
// Supabase Edge Function: fb-create-campaign
// Đến giờ hẹn (ads_run_at) và đã có ID bài đăng (fb_post_id do platform ghi),
// tự tạo chiến dịch Facebook từ bài đăng: Campaign -> AdSet (target nạp sẵn)
// -> Creative (object_story_id) -> Ad, rồi gán fb_campaign_id vào clip.
// Chạy định kỳ 5 phút bằng pg_cron.
//
// Cần secret: FB_ADS_TOKEN với quyền **ads_management** (token chỉ ads_read
// sẽ bị lỗi khi tạo). Page phải nằm trong Business & gán cho System User
// với quyền Quảng cáo (ADVERTISE).
// Cấu hình ngân sách/target/tên: bảng fb_ads_config (id=1), page: fb_pages.
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

async function fbPost(path: string, params: Record<string, string>, token: string) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${API}/${path}`, { method: "POST", body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d?.error?.error_user_msg || d?.error?.message || `FB HTTP ${r.status} (${path})`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("FB_ADS_TOKEN");
    if (!token) return json({ ok: false, error: "Chưa cấu hình FB_ADS_TOKEN" });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: cfg } = await sb.from("fb_ads_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) return json({ ok: false, error: "Chưa có fb_ads_config (chạy fb_auto_campaign.sql)" });
    const acct = String(cfg.ad_account_id || Deno.env.get("FB_AD_ACCOUNT_ID") || "").replace(/^act_/, "");
    if (!acct) return json({ ok: false, error: "Chưa cấu hình ad_account_id" });

    const nowIso = new Date().toISOString();
    const { data: clips } = await sb.from("media_clips")
      .select("id, title, ads_page_id, ads_page_name, ads_run_at, fb_post_id, post_status")
      .eq("ads_auto_status", "queued").lte("ads_run_at", nowIso).limit(20);
    if (!clips?.length) return json({ ok: true, created: 0, note: "Không có clip nào đến giờ" });

    let created = 0, waiting = 0, failed = 0;
    for (const c of clips) {
      try {
        // Chưa có ID bài đăng -> chờ platform (quá 24h thì báo lỗi để Ads xử lý tay)
        if (!c.fb_post_id) {
          const overdueMs = Date.now() - new Date(c.ads_run_at).getTime();
          if (overdueMs > 24 * 3600 * 1000) {
            await sb.from("media_clips").update({ ads_auto_status: "failed", ads_error: "Quá 24h chưa nhận được ID bài đăng từ platform" }).eq("id", c.id);
            failed++;
          } else waiting++;
          continue;
        }

        // Số thứ tự tên chiến dịch: Dungnt_[tên page]_N
        const { data: page } = await sb.from("fb_pages").select("page_id, name, campaign_seq").eq("page_id", c.ads_page_id).maybeSingle();
        const pageName = page?.name || c.ads_page_name || c.ads_page_id;
        const seq = (page?.campaign_seq || 0) + 1;
        if (page) await sb.from("fb_pages").update({ campaign_seq: seq }).eq("page_id", page.page_id);
        const name = `${cfg.campaign_prefix || "Dungnt"}_${pageName}_${seq}`;

        // object_story_id = <page_id>_<post_id> (platform có thể ghi full hoặc chỉ phần số)
        const storyId = String(c.fb_post_id).includes("_") ? String(c.fb_post_id) : `${c.ads_page_id}_${c.fb_post_id}`;

        // 1) Campaign
        const camp = await fbPost(`act_${acct}/campaigns`, {
          name, objective: cfg.objective || "OUTCOME_ENGAGEMENT",
          status: cfg.campaign_status || "ACTIVE", special_ad_categories: "[]",
        }, token);

        // Ghi fb_campaign_id NGAY khi campaign tạo xong — lỡ bước sau lỗi vẫn theo dõi được
        await sb.from("media_clips").update({ fb_campaign_id: camp.id }).eq("id", c.id);

        // 2) AdSet (target + ngân sách nạp sẵn)
        const adsetParams: Record<string, string> = {
          name: `${name} - AdSet`, campaign_id: camp.id,
          daily_budget: String(cfg.daily_budget || 500000),
          billing_event: cfg.billing_event || "IMPRESSIONS",
          optimization_goal: cfg.optimization_goal || "POST_ENGAGEMENT",
          targeting: JSON.stringify(cfg.targeting || { geo_locations: { countries: ["VN"] } }),
          status: cfg.campaign_status || "ACTIVE",
          start_time: new Date().toISOString(),
        };
        if (cfg.destination_type) adsetParams.destination_type = cfg.destination_type;
        if (cfg.destination_type === "MESSENGER" || cfg.optimization_goal === "CONVERSATIONS") {
          adsetParams.promoted_object = JSON.stringify({ page_id: c.ads_page_id });
        }
        const adset = await fbPost(`act_${acct}/adsets`, adsetParams, token);

        // 3) Creative từ bài đăng có sẵn
        const creative = await fbPost(`act_${acct}/adcreatives`, { name: `${name} - Creative`, object_story_id: storyId }, token);

        // 4) Ad
        await fbPost(`act_${acct}/ads`, {
          name: `${name} - Ad`, adset_id: adset.id,
          creative: JSON.stringify({ creative_id: creative.id }),
          status: cfg.campaign_status || "ACTIVE",
        }, token);

        await sb.from("media_clips").update({ ads_auto_status: "created", ads_error: null, fb_status: "ACTIVE" }).eq("id", c.id);
        created++;
      } catch (e) {
        failed++;
        await sb.from("media_clips").update({ ads_auto_status: "failed", ads_error: String((e as Error)?.message || e).slice(0, 500) }).eq("id", c.id);
        console.error("create campaign fail", c.id, (e as Error)?.message);
      }
    }
    return json({ ok: true, created, waiting, failed });
  } catch (e) {
    console.error("fb-create-campaign error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
