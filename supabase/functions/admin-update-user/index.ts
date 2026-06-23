// ============================================================
// Supabase Edge Function: admin-update-user
// Cho phép ADMIN đổi mật khẩu (và bật/khoá) tài khoản nhân viên.
//
// Client (anon key) KHÔNG thể đổi mật khẩu user khác — phải dùng
// service_role ở server. Function này tự kiểm tra người gọi có phải admin
// trước khi thực hiện.
//
// Deploy:
//   supabase functions deploy admin-update-user
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY đã có sẵn
//  trong môi trường Edge Function — không cần set thêm.)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Xác định người gọi
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // 2. Kiểm tra người gọi là admin (dùng service_role để bỏ qua RLS)
    const admin = createClient(url, serviceKey);
    const { data: me } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (me?.role !== "admin") {
      return json({ error: "Chỉ admin mới được thực hiện" }, 403);
    }

    // 3. Thực hiện
    const { targetUserId, newPassword } = await req.json();
    if (!targetUserId || !newPassword) {
      return json({ error: "Thiếu targetUserId hoặc newPassword" }, 400);
    }
    if (String(newPassword).length < 6) {
      return json({ error: "Mật khẩu phải từ 6 ký tự" }, 400);
    }

    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
