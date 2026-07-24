// ============================================================
// Supabase Edge Function: review-upload
// Cho phép KHÁCH (chưa đăng nhập) đính kèm ẢNH / GHI ÂM vào phiếu đánh giá.
// Chống lạm dụng: chỉ nhận upload gắn với 1 token phiếu ĐANG MỞ hợp lệ
// (xác minh qua RPC get_review_invitation), chỉ nhận image/* & audio/*, giới hạn dung lượng.
// Deploy: supabase functions deploy review-upload
// (Dùng chung secret R2 với r2-upload; verify_jwt để mặc định — anon key là JWT hợp lệ.)
// ============================================================
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = (formData.get("token") as string) || "";
    if (!file) return json({ error: "Thiếu file" });
    if (!token) return json({ error: "Thiếu mã phiếu" });

    // Chỉ nhận ảnh (trừ SVG) hoặc âm thanh
    const ctype = (file.type || "").toLowerCase();
    const isImage = ctype.startsWith("image/") && ctype !== "image/svg+xml";
    const isAudio = ctype.startsWith("audio/");
    if (!isImage && !isAudio) return json({ error: "Chỉ nhận ảnh hoặc ghi âm." });
    if (file.size > MAX_BYTES) return json({ error: "File quá lớn (tối đa 12MB)." });

    // Xác minh token gắn với 1 phiếu đang mở hợp lệ (chống lạm dụng)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: inv, error: invErr } = await supabase.rpc("get_review_invitation", { p_token: token });
    if (invErr || !inv?.ok) return json({ error: "Phiếu không hợp lệ hoặc đã hết hạn." });

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

    const ext = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "") || (isAudio ? "webm" : "jpg");
    const key = `danh-gia/${isAudio ? "audio" : "anh"}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

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
      return json({ error: `R2 từ chối (HTTP ${res.status})` });
    }

    return json({ publicUrl: `${publicUrl}/${key}`, type: isAudio ? "audio" : "image" });
  } catch (e) {
    console.error("review-upload crashed", e);
    return json({ error: "Lỗi tải lên: " + String(e) });
  }
});
