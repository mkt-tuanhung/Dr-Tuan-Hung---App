// ============================================================
// attendance-tg-send — ADMIN gửi (lại) ẢNH + lời nhắn vào NHÓM TELEGRAM CHẤM CÔNG
// bằng BOT hệ thống (không phải tài khoản cá nhân).
// Gọi từ app: Quản lý chấm công → bấm ô công → "Gửi vào nhóm Chấm Công".
//
// Body: multipart/form-data
//   caption   : nội dung (≤ 1024 ký tự — giới hạn caption ảnh của Telegram)
//   photo     : file ảnh (app đã chuyển sang JPEG)       ┐ một trong hai;
//   photo_url : link ảnh chấm công sẵn có (https)        ┘ không có ảnh -> gửi chữ
// Chỉ ADMIN (role hoặc role_2 = admin). Secrets dùng chung với face-attendance:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ATTENDANCE_CHAT_ID
// Deploy: Verify JWT = ON. Tự chứa (không import ../_shared) để deploy được từ Dashboard.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_PHOTO = 10 * 1024 * 1024; // Telegram sendPhoto: tối đa 10 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Chỉ nhận POST" }, 405);
  try {
    // ---- Xác thực: chỉ admin ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Chưa đăng nhập" }, 401);
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ ok: false, error: "Phiên đăng nhập hết hạn" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await db.from("profiles").select("role, role_2, is_active").eq("id", user.id).single();
    if (!prof || prof.is_active === false || ![prof.role, prof.role_2].includes("admin")) {
      return json({ ok: false, error: "Chỉ admin được gửi vào nhóm Chấm Công" }, 403);
    }

    const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const tgChat = Deno.env.get("TELEGRAM_ATTENDANCE_CHAT_ID");
    if (!tgToken || !tgChat) return json({ ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN / TELEGRAM_ATTENDANCE_CHAT_ID" }, 500);

    // ---- Đọc nội dung ----
    const form = await req.formData();
    const caption = String(form.get("caption") ?? "").trim();
    if (caption.length > 1024) return json({ ok: false, error: `Nội dung dài ${caption.length} ký tự, tối đa 1024` }, 400);

    let photo: Blob | null = null;
    const f = form.get("photo");
    if (f && typeof f !== "string" && f.size > 0) photo = f;
    const photoUrl = String(form.get("photo_url") ?? "").trim();
    if (!photo && photoUrl) {
      if (!/^https:\/\//i.test(photoUrl)) return json({ ok: false, error: "Link ảnh không hợp lệ" }, 400);
      // Telegram hay từ chối tự tải ảnh từ URL ngoài -> server tự tải rồi đẩy file lên
      const r = await fetch(photoUrl);
      if (!r.ok) return json({ ok: false, error: `Không tải được ảnh (${r.status})` }, 400);
      photo = await r.blob();
    }
    if (photo && photo.size > MAX_PHOTO) return json({ ok: false, error: "Ảnh quá 10 MB" }, 400);
    if (!photo && !caption) return json({ ok: false, error: "Chưa có ảnh hay nội dung" }, 400);

    // ---- Gửi ----
    let tg: Response;
    if (photo) {
      const fd = new FormData();
      fd.append("chat_id", String(tgChat));
      if (caption) fd.append("caption", caption);
      fd.append("photo", new File([photo], "cham-cong.jpg", { type: photo.type || "image/jpeg" }));
      tg = await fetch(`https://api.telegram.org/bot${tgToken}/sendPhoto`, { method: "POST", body: fd });
    } else {
      tg = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: caption }),
      });
    }
    const out = await tg.json().catch(() => ({}));
    if (!tg.ok || !out?.ok) return json({ ok: false, error: `Telegram từ chối: ${out?.description || tg.status}` }, 502);

    console.log("attendance-tg-send", user.id, photo ? "photo" : "text", out.result?.message_id);
    return json({ ok: true, message_id: out.result?.message_id ?? null });
  } catch (e) {
    console.error("attendance-tg-send error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
