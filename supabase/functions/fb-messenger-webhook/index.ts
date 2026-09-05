// ============================================================
// Supabase Edge Function: fb-messenger-webhook — MESSENGER REALTIME
// Facebook bắn sự kiện tin nhắn (khách nhắn + page trả lời) vào đây.
// Lưu vào fb_messages/fb_conversations, TỰ QUÉT SĐT trong nội dung và
// gán/tạo khách trong marketing_data theo SĐT.
//
// Secrets:
//   FB_VERIFY_TOKEN = chuỗi tự đặt, khai giống hệt trong phần Webhooks của app FB
//   FB_PAGE_TOKEN   = token có quyền pages_messaging (System User gán page)
// Deploy: supabase functions deploy fb-messenger-webhook --no-verify-jwt
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const API = "v21.0";

// Quét SĐT Việt Nam trong text: 09xx…, 03xx…, +84…, có thể chen cách/chấm
function scanPhone(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,9}/g);
  if (!m) return null;
  for (const raw of m) {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("84")) d = "0" + d.slice(2);
    if (d.length === 10 && /^0(3|5|7|8|9)/.test(d)) return d;
  }
  return null;
}

// Đổi token System User -> Page Access Token của page (lấy tên khách bắt buộc cái này).
const pageTokenCache: Record<string, string> = {};
async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  if (pageTokenCache[pageId]) return pageTokenCache[pageId];
  try {
    const r = await fetch(`https://graph.facebook.com/${API}/${pageId}?fields=access_token&access_token=${userToken}`);
    const d = await r.json().catch(() => ({}));
    if (d?.access_token) { pageTokenCache[pageId] = d.access_token; return d.access_token; }
    return null;
  } catch { return null; }
}

async function getName(psid: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`https://graph.facebook.com/${API}/${psid}?fields=name&access_token=${token}`);
    const d = await r.json().catch(() => ({}));
    return d?.name || null;
  } catch { return null; }
}

// Gán hội thoại vào khách theo SĐT quét được; chưa có khách -> TẠO mới trong Data.
async function linkPhone(sb: any, convKey: string, phone: string, name: string | null) {
  const { data: existing } = await sb.from("marketing_data").select("id").eq("phone", phone).maybeSingle();
  let dataId = existing?.id;
  if (!dataId) {
    const { data: ins } = await sb.from("marketing_data")
      .upsert({ phone, customer_name: name || null, source: "Messenger", description: "Tự tạo từ hội thoại Messenger" }, { onConflict: "phone" })
      .select("id").maybeSingle();
    dataId = ins?.id;
  }
  await sb.from("fb_conversations").update({ phone, data_id: dataId || null }).eq("conv_key", convKey);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  // CÔNG TẮC TẠM DỪNG: secret MESSENGER_PAUSED=1 -> nhận sự kiện nhưng bỏ qua,
  // trả 200 để Facebook không retry (đổi 0/xoá secret để chạy lại)
  if (req.method === "POST" && Deno.env.get("MESSENGER_PAUSED") === "1") {
    return new Response("paused", { status: 200, headers: cors });
  }

  // ---- Facebook xác minh webhook (GET hub.challenge) ----
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === (Deno.env.get("FB_VERIFY_TOKEN") || "")) {
      return new Response(challenge || "", { status: 200, headers: cors });
    }
    return new Response("Sai verify token", { status: 403, headers: cors });
  }

  // ---- Nhận sự kiện tin nhắn ----
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.object !== "page") return new Response("ignored", { status: 200, headers: cors });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userToken = Deno.env.get("FB_PAGE_TOKEN") || "";

    for (const entry of body.entry || []) {
      const pageId = String(entry.id);
      for (const ev of entry.messaging || []) {
        const msg = ev.message;
        if (!msg || !msg.mid) continue;                      // chỉ xử lý tin nhắn
        const isEcho = !!msg.is_echo;                        // echo = page (nhân viên) nhắn
        const psid = String(isEcho ? ev.recipient?.id : ev.sender?.id || "");
        if (!psid || psid === pageId) continue;
        const convKey = `${pageId}:${psid}`;
        const text = msg.text || "";
        const ts = new Date(Number(ev.timestamp) || Date.now()).toISOString();

        // Bảo đảm hội thoại tồn tại (lấy tên khách nếu chưa có)
        const { data: conv } = await sb.from("fb_conversations").select("conv_key, participant_name, phone").eq("conv_key", convKey).maybeSingle();
        let pname = conv?.participant_name || null;
        if (!conv) {
          const pageToken = userToken ? await getPageToken(pageId, userToken) : null;
          pname = pageToken ? await getName(psid, pageToken) : null;
          await sb.from("fb_conversations").upsert({ conv_key: convKey, page_id: pageId, psid, participant_name: pname }, { onConflict: "conv_key" });
        }

        // Lưu tin nhắn (mid làm khoá -> không trùng với sync)
        await sb.from("fb_messages").upsert({
          id: String(msg.mid), conv_key: convKey, page_id: pageId,
          is_page: isEcho, from_name: isEcho ? "Page" : (pname || "Khách"),
          text: text || null,
          attachments: Array.isArray(msg.attachments) && msg.attachments.length ? msg.attachments : null,
          created_time: ts,
        }, { onConflict: "id" });

        // Cập nhật hội thoại + quét SĐT trong nội dung
        await sb.from("fb_conversations").update({ last_message: (text || "[đính kèm]").slice(0, 300), last_time: ts }).eq("conv_key", convKey);
        const phone = scanPhone(text);
        if (phone && phone !== conv?.phone) await linkPhone(sb, convKey, phone, pname);
      }
    }
    return new Response("ok", { status: 200, headers: cors });
  } catch (e) {
    console.error("fb-messenger-webhook error", e);
    return new Response("ok", { status: 200, headers: cors }); // luôn 200 để FB không khoá webhook
  }
});
