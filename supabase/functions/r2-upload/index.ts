// ============================================================
// Supabase Edge Function: r2-upload
// Tạo "presigned URL" để trình duyệt upload thẳng lên Cloudflare R2
// mà KHÔNG cần secret key ở frontend.
//
// Secret R2 chỉ nằm ở biến môi trường của function (server-side).
// Deploy + cấu hình: xem README.md cùng thư mục.
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
    // 1. Bắt buộc đăng nhập (Supabase JWT) mới được xin link upload
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // 2. Tham số từ client
    const { fileName, contentType, folder = "avatars" } = await req.json();
    if (!fileName || !contentType) {
      return json({ error: "Thiếu fileName hoặc contentType" }, 400);
    }

    const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
    const bucket = Deno.env.get("R2_BUCKET_NAME")!;
    const publicUrl = Deno.env.get("R2_PUBLIC_URL")!;

    // 3. Sinh key an toàn (chống path traversal / ký tự lạ)
    const ext = String(fileName).split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, "") || "misc";
    const key = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    // 4. Ký presigned PUT URL
    const aws = new AwsClient({
      accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
      service: "s3",
      region: "auto",
    });

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
    const signed = await aws.sign(
      new Request(endpoint, { method: "PUT", headers: { "content-type": contentType } }),
      { aws: { signQuery: true } },
    );

    return json({ uploadUrl: signed.url, publicUrl: `${publicUrl}/${key}` });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
