// Cấp token vào phòng LiveKit cho nhân sự đã đăng nhập.
// Secret cần set: LIVEKIT_URL (wss://...), LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
//                 SUPABASE_URL, SUPABASE_ANON_KEY.
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.7.0";
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
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized (chưa đăng nhập)" }, 401);

    const { room } = await req.json();
    if (!room) return json({ error: "Thiếu tên phòng" }, 400);

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) return json({ error: "Thiếu secret LIVEKIT_URL/API_KEY/API_SECRET" }, 500);

    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const at = new AccessToken(apiKey, apiSecret, { identity: user.id, name: prof?.full_name || "Nhân sự", ttl: "4h" });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    return json({ token, url });
  } catch (e) {
    return json({ error: "Lỗi token: " + String(e) }, 500);
  }
});
