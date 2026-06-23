// ============================================================
// Supabase Edge Function: admin-create-user
// ADMIN tạo nhân sự mới NGUYÊN TỬ: tạo tài khoản auth + hồ sơ profiles.
// Nếu bước tạo profile lỗi → tự XOÁ tài khoản auth (rollback) để tránh
// "user mồ côi" (có auth nhưng không có profile, chiếm mất employee_id).
//
// Deploy: supabase functions deploy admin-create-user
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

    // 1. Người gọi phải là admin
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: me } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") {
      return json({ error: "Chỉ admin mới được tạo nhân sự" }, 403);
    }

    // 2. Dữ liệu đầu vào
    const { employeeId, password, profile } = await req.json();
    if (!employeeId || !password || !profile) {
      return json({ error: "Thiếu employeeId / password / profile" }, 400);
    }
    if (String(password).length < 6) {
      return json({ error: "Mật khẩu phải từ 6 ký tự" }, 400);
    }

    const email = `${String(employeeId).trim().toLowerCase()}@drtuanhung.internal`;

    // 3. Tạo tài khoản auth (xác nhận email luôn để đăng nhập được ngay)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_id: String(employeeId).trim().toUpperCase() },
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message || "Không tạo được tài khoản" }, 400);
    }

    // 4. Tạo profile — nếu lỗi thì ROLLBACK (xoá auth user vừa tạo)
    const { error: profileErr } = await admin.from("profiles").insert({
      id: created.user.id,
      employee_id: String(employeeId).trim().toUpperCase(),
      created_by: user.id,
      ...profile,
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "Tạo hồ sơ thất bại: " + profileErr.message }, 400);
    }

    return json({ ok: true, id: created.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
