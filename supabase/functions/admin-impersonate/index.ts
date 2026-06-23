// ============================================================
// Supabase Edge Function: admin-impersonate
// ADMIN tạo link đăng nhập (magic link) cho tài khoản nhân sự để
// "Đăng nhập với tư cách" — KHÔNG cần biết mật khẩu, KHÔNG đổi mật khẩu.
//
// Deploy: supabase functions deploy admin-impersonate
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
    if (!authHeader) return json({ error: "Unauthorized" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Người gọi phải là admin
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" });

    const admin = createClient(url, serviceKey);
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") return json({ error: "Chỉ admin mới được dùng chức năng này" });

    // 2. Lấy email của nhân sự cần đăng nhập
    const { targetUserId, redirectTo } = await req.json();
    if (!targetUserId) return json({ error: "Thiếu targetUserId" });

    const { data: target, error: getErr } = await admin.auth.admin.getUserById(targetUserId);
    if (getErr || !target?.user?.email) return json({ error: "Không tìm thấy tài khoản nhân sự" });

    // 3. Tạo magic link đăng nhập
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (linkErr || !link?.properties?.action_link) {
      return json({ error: linkErr?.message || "Không tạo được link đăng nhập" });
    }

    return json({ actionLink: link.properties.action_link });
  } catch (e) {
    return json({ error: String(e) });
  }
});
