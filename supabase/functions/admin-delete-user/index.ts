// ============================================================
// Supabase Edge Function: admin-delete-user
// ADMIN xóa HẲN nhân sự (xóa tài khoản auth → cascade profile).
// Nếu nhân sự còn dữ liệu liên quan (FK chặn) sẽ trả lỗi rõ ràng để
// admin dùng "Khóa" thay vì xóa, tránh phá vỡ dữ liệu lịch sử.
//
// Deploy: supabase functions deploy admin-delete-user
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

    // Người gọi phải là admin
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" });

    const admin = createClient(url, serviceKey);
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") return json({ error: "Chỉ admin mới được xóa nhân sự" });

    const { targetUserId } = await req.json();
    if (!targetUserId) return json({ error: "Thiếu targetUserId" });
    if (targetUserId === user.id) return json({ error: "Không thể tự xóa chính mình" });

    // Xóa tài khoản auth → cascade xóa profile
    const { error } = await admin.auth.admin.deleteUser(targetUserId);
    if (error) {
      const msg = String(error.message || error);
      if (/foreign key|violates|referenced/i.test(msg)) {
        return json({ error: "Nhân sự đã có dữ liệu liên quan (lịch hẹn, lương, KPI...). Không thể xóa hẳn — hãy dùng Khóa tài khoản." });
      }
      return json({ error: msg });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) });
  }
});
