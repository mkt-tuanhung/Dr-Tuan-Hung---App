// ============================================================
// Supabase Edge Function: r2-upload (PROXY UPLOAD)
// Trình duyệt gửi file (FormData) cho function → function tự đẩy lên R2.
// Không dùng presigned URL → không vướng CORS R2 & không lỗi chữ ký 403.
//
// Secret R2 chỉ nằm ở biến môi trường của function (server-side).
// ============================================================
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
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
    // 1. Bắt buộc đăng nhập
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // 2. Lấy file từ FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "avatars";
    if (!file) return json({ error: "Thiếu file" }, 400);

    const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
    const bucket = Deno.env.get("R2_BUCKET_NAME")!;
    const publicUrl = Deno.env.get("R2_PUBLIC_URL")!;

    // 3. Sinh key an toàn
    const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, "") || "misc";
    const key = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    // 4. Đẩy thẳng lên R2 (server-side, aws4fetch ký + gửi cùng request)
    const aws = new AwsClient({
      accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
      service: "s3",
      region: "auto",
    });

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
    const res = await aws.fetch(endpoint, {
      method: "PUT",
      body: await file.arrayBuffer(),
      headers: { "content-type": file.type || "application/octet-stream" },
    });
    if (!res.ok) {
      const txt = await res.text();
      return json({ error: `R2 lỗi ${res.status}: ${txt}` }, 502);
    }

    return json({ publicUrl: `${publicUrl}/${key}` });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
