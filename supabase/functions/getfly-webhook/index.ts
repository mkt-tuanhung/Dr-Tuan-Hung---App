// ============================================================
// Supabase Edge Function: getfly-webhook — REALTIME GetFly
// GetFly (Automation/Webhook) bắn POST vào đây mỗi khi có khách mới /
// cập nhật -> function lập tức gọi getfly-sync kéo toàn bộ về app.
//
// Cấu hình bên GetFly (nếu gói có Automation/Webhook):
//   URL: https://<PROJECT_REF>.supabase.co/functions/v1/getfly-webhook?token=<GETFLY_WEBHOOK_TOKEN>
//   Method: POST — nội dung payload gì cũng được (function không phụ thuộc).
//
// Secrets:
//   GETFLY_WEBHOOK_TOKEN (tuỳ chọn) — chuỗi bí mật tự đặt để chặn người lạ gọi.
//   (Dùng chung GETFLY_DOMAIN/GETFLY_API_KEY qua getfly-sync.)
// Deploy: supabase functions deploy getfly-webhook --no-verify-jwt
//   (bắt buộc --no-verify-jwt vì GetFly không gửi kèm JWT của Supabase)
// ============================================================
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Chặn dội: nhiều webhook bắn dồn trong vài giây chỉ chạy 1 lần sync.
let lastRun = 0;
const MIN_GAP_MS = 15_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Kiểm tra token (nếu có đặt) — GetFly gọi kèm ?token=...
    const expected = (Deno.env.get("GETFLY_WEBHOOK_TOKEN") || "").trim();
    if (expected) {
      const got = new URL(req.url).searchParams.get("token") || "";
      if (got !== expected) return json({ ok: false, error: "Sai token" }, 401);
    }

    const now = Date.now();
    if (now - lastRun < MIN_GAP_MS) return json({ ok: true, skipped: true, note: "Vừa sync xong, bỏ qua đợt dội" });
    lastRun = now;

    // Gọi getfly-sync kéo toàn bộ (kho ~1.5k khách nên full chỉ vài giây)
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/getfly-sync`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: "{}",
    });
    const d = await r.json().catch(() => ({}));
    return json({ ok: true, synced: d });
  } catch (e) {
    console.error("getfly-webhook error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
