// ============================================================
// Supabase Edge Function: fb-daily-cost
// Lấy TỔNG CHI PHÍ quảng cáo của 1 ngày từ Facebook Ad Account rồi ghi vào
// bảng marketing_ads_performance (module "Chi phí Ads").
//
// Mặc định lấy NGÀY HÔM QUA theo múi giờ Việt Nam (UTC+7) — hợp với việc
// "kết thúc mỗi ngày sau 24h thì tự cộng chi phí đã tiêu".
// Có thể truyền { "date": "2026-07-28" } để lấy đúng 1 ngày cụ thể (backfill).
//
// Chạy tự động: dùng pg_cron gọi hàm này lúc 17:05 UTC (= 00:05 giờ VN) mỗi ngày.
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

// Ngày hôm qua theo giờ VN (UTC+7), dạng YYYY-MM-DD
function yesterdayVN(): string {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  vn.setUTCDate(vn.getUTCDate() - 1);
  return vn.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("FB_ADS_TOKEN");
    const acct = (Deno.env.get("FB_AD_ACCOUNT_ID") || "").toString().replace(/^act_/, "");
    if (!token) return json({ ok: false, error: "Chưa cấu hình FB_ADS_TOKEN" });
    if (!acct) return json({ ok: false, error: "Chưa cấu hình FB_AD_ACCOUNT_ID" });

    const body = await req.json().catch(() => ({}));
    const date = (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) ? body.date : yesterdayVN();

    // Tổng chi phí của đúng 1 ngày (level = account)
    const p = new URLSearchParams({
      level: "account",
      fields: "spend",
      time_range: JSON.stringify({ since: date, until: date }),
      access_token: token,
    });
    const r = await fetch(`https://graph.facebook.com/v21.0/act_${acct}/insights?${p.toString()}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) return json({ ok: false, error: d?.error?.message || `Facebook lỗi HTTP ${r.status}`, code: d?.error?.code });
    const spend = Math.round(Number(d.data?.[0]?.spend) || 0);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing } = await sb.from("marketing_ads_performance").select("id").eq("date", date).limit(1).maybeSingle();
    if (existing?.id) {
      const { error } = await sb.from("marketing_ads_performance").update({ amount_spent: spend }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("marketing_ads_performance").insert({ date, amount_spent: spend, leads: 0 });
      if (error) throw error;
    }

    return json({ ok: true, date, spend });
  } catch (e) {
    console.error("fb-daily-cost error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
