// Bắt đầu/dừng ghi cuộc họp server-side bằng LiveKit Egress -> upload thẳng R2.
// Secret: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
//         R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL,
//         SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from "https://esm.sh/livekit-server-sdk@2.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ error: "Unauthorized (chưa đăng nhập)" }, 401);

    const { action, room, meetingId, egressId } = await req.json();
    const url = Deno.env.get("LIVEKIT_URL"); const apiKey = Deno.env.get("LIVEKIT_API_KEY"); const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    if (!url || !apiKey || !apiSecret) return json({ error: "Thiếu secret LIVEKIT_*" }, 500);
    const httpUrl = url.replace("wss://", "https://").replace("ws://", "http://");
    const eg = new EgressClient(httpUrl, apiKey, apiSecret);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "start") {
      const accountId = Deno.env.get("R2_ACCOUNT_ID"); const bucket = Deno.env.get("R2_BUCKET_NAME");
      const pub = Deno.env.get("R2_PUBLIC_URL"); const ak = Deno.env.get("R2_ACCESS_KEY_ID"); const sk = Deno.env.get("R2_SECRET_ACCESS_KEY");
      if (!accountId || !bucket || !pub || !ak || !sk) return json({ error: "Thiếu secret R2_*" }, 500);
      const key = `meeting-egress/${room}-${Date.now()}.ogg`;
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.OGG,
        filepath: key,
        output: { case: "s3", value: new S3Upload({ accessKey: ak, secret: sk, bucket, region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, forcePathStyle: true }) },
      });
      const info = await eg.startRoomCompositeEgress(room, output, { audioOnly: true });
      const publicUrl = `${pub.replace(/\/$/, "")}/${key}`;
      if (meetingId) await db.from("meetings").update({ egress_id: info.egressId, recording_url: publicUrl, segment_urls: [publicUrl] }).eq("id", meetingId);
      return json({ egressId: info.egressId, publicUrl });
    }

    if (action === "stop") {
      let eid = egressId;
      if (!eid && meetingId) { const { data } = await db.from("meetings").select("egress_id").eq("id", meetingId).single(); eid = data?.egress_id; }
      if (eid) { try { await eg.stopEgress(eid); } catch (_) { /* có thể đã dừng */ } }
      if (meetingId) await db.from("meetings").update({ ai_status: "processing" }).eq("id", meetingId);
      return json({ ok: true });
    }

    return json({ error: "action không hợp lệ" }, 400);
  } catch (e) {
    return json({ error: "Lỗi egress: " + String(e) }, 500);
  }
});
