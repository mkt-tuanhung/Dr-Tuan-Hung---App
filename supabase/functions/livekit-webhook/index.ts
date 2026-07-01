// Nhận webhook từ LiveKit. Khi egress ghi xong -> gọi analyze-meeting tạo biên bản.
// DEPLOY VỚI VERIFY JWT = OFF (LiveKit ký bằng chữ ký riêng, không phải Supabase JWT).
// Secret: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { WebhookReceiver } from "https://esm.sh/livekit-server-sdk@2.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const receiver = new WebhookReceiver(Deno.env.get("LIVEKIT_API_KEY")!, Deno.env.get("LIVEKIT_API_SECRET")!);

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    const authHeader = req.headers.get("Authorization") || "";
    let event;
    try { event = await receiver.receive(body, authHeader); }
    catch (_) { return new Response("invalid signature", { status: 401 }); }

    if (event.event === "egress_ended") {
      const eid = event.egressInfo?.egressId;
      if (eid) {
        const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: m } = await db.from("meetings").select("id").eq("egress_id", eid).maybeSingle();
        if (m) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-meeting`, {
            method: "POST",
            headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ meeting_id: m.id }),
          });
        }
      }
    }
    return new Response("ok");
  } catch (e) {
    return new Response("err: " + String(e), { status: 200 });
  }
});
