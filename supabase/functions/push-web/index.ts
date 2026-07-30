// ============================================================
// Supabase Edge Function: push-web
// Gửi Web Push (thông báo đẩy về điện thoại/trình duyệt) khi có bản ghi mới
// trong bảng notifications. Gọi bởi trigger DB (pg_net) hoặc Database Webhook
// trên sự kiện INSERT của notifications.
//
// Cần các secret:
//   VAPID_PUBLIC_KEY   (khoá công khai VAPID)
//   VAPID_PRIVATE_KEY  (khoá bí mật VAPID)
//   VAPID_SUBJECT      (tuỳ chọn, vd "mailto:admin@drhung.app")
//   WEBHOOK_SECRET     (tuỳ chọn, để chặn gọi trái phép)
// ============================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const SECRET = Deno.env.get("WEBHOOK_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (SECRET && req.headers.get("x-webhook-secret") !== SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const pub = Deno.env.get("VAPID_PUBLIC_KEY");
    const priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) return json({ ok: false, error: "Chưa cấu hình VAPID keys" });
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", pub, priv);

    const payload = await req.json().catch(() => ({}));
    const rec = payload.record ?? payload; // DB webhook gửi { record }, trigger gửi thẳng row
    if (!rec?.user_id) return json({ ok: true, skipped: "no user_id" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", rec.user_id);
    if (!subs?.length) return json({ ok: true, sent: 0 });

    const msg = JSON.stringify({
      title: rec.title || "Thông báo",
      body: rec.body || "",
      link: rec.link || "",
      tag: "noti-" + (rec.id || ""),
    });

    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          msg,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        // 404/410 = subscription hết hạn -> xoá cho sạch
        if (code === 404 || code === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          console.error("push error", code, (e as Error)?.message);
        }
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("push-web error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
