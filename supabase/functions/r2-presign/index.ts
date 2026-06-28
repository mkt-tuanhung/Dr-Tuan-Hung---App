// r2-presign: trả URL ký sẵn (presigned PUT) để trình duyệt upload THẲNG lên R2
// -> không qua Edge Function nên không vướng giới hạn dung lượng (audio dài, chất lượng cao OK).
// Dùng chung secret với r2-upload: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized (chưa đăng nhập)" });

    const { folder = "misc", filename = "file" } = await req.json();
    const accountId = Deno.env.get("R2_ACCOUNT_ID") || "";
    const bucket = Deno.env.get("R2_BUCKET_NAME") || "";
    const publicUrl = Deno.env.get("R2_PUBLIC_URL") || "";
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") || "";
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
    const missing = [];
    if (!accountId) missing.push("R2_ACCOUNT_ID");
    if (!bucket) missing.push("R2_BUCKET_NAME");
    if (!publicUrl) missing.push("R2_PUBLIC_URL");
    if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
    if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
    if (missing.length) return json({ error: "Thiếu secret: " + missing.join(", ") });

    const ext = String(filename).split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, "") || "misc";
    const key = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}?X-Amz-Expires=3600`;
    const signed = await aws.sign(new Request(endpoint, { method: "PUT" }), { aws: { signQuery: true } });
    return json({ uploadUrl: signed.url, publicUrl: `${publicUrl.replace(/\/$/, "")}/${key}`, key });
  } catch (e) {
    return json({ error: "Lỗi presign: " + String(e) });
  }
});
