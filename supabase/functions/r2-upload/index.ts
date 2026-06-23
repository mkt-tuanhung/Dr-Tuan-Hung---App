// ============================================================
// Supabase Edge Function: r2-upload (PROXY UPLOAD) — bản có log lỗi chi tiết
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized (chưa đăng nhập)" });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "avatars";
    if (!file) return json({ error: "Thiếu file" });

    const accountId = Deno.env.get("R2_ACCOUNT_ID") || "";
    const bucket = Deno.env.get("R2_BUCKET_NAME") || "";
    const publicUrl = Deno.env.get("R2_PUBLIC_URL") || "";
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") || "";
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";

    // Báo rõ nếu thiếu secret
    const missing = [];
    if (!accountId) missing.push("R2_ACCOUNT_ID");
    if (!bucket) missing.push("R2_BUCKET_NAME");
    if (!publicUrl) missing.push("R2_PUBLIC_URL");
    if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
    if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
    if (missing.length) return json({ error: "Thiếu secret: " + missing.join(", ") });

    const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, "") || "misc";
    const key = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
    const res = await aws.fetch(endpoint, {
      method: "PUT",
      body: await file.arrayBuffer(),
      headers: { "content-type": file.type || "application/octet-stream" },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("R2 PUT failed", res.status, txt);
      // Trả 200 + lý do để hiện thẳng trên giao diện (debug)
      return json({ error: `R2 từ chối (HTTP ${res.status}): ${txt.slice(0, 300)}` });
    }

    return json({ publicUrl: `${publicUrl}/${key}` });
  } catch (e) {
    console.error("Function crashed", e);
    return json({ error: "Lỗi function: " + String(e) });
  }
});
