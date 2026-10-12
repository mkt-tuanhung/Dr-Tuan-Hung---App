// ============================================================
// Supabase Edge Function: inbox-chat-image
// VẼ LẠI đoạn hội thoại Messenger (khách ↔ page) thành ẢNH và gửi vào nhóm Telegram,
// trả lời ngay dưới tin cảnh báo của inbox-sla-alert.
// KHÔNG chụp màn hình Messenger: ảnh dựng từ tin nhắn đọc bằng token page (Graph API),
// thiếu token / lỗi thì lấy từ bảng fb_messages.
//
// Gọi (inbox-sla-alert gọi bằng service role):
//   { conv_key, reply_to, index }   -> vẽ & gửi ảnh hội thoại đó, trả lời tin reply_to
//   { demo: true, reply_to }        -> ảnh MẪU (hội thoại giả) để xem thử
// Secrets: TELEGRAM_BOT_TOKEN, FB_PAGE_TOKENS. Nhóm: clinic_settings.inbox_alert_chat_id
// ============================================================
import React from "https://esm.sh/react@18.2.0";
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const API = "v21.0";
const MAX_MSGS = 20;

const FONT_BASE = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bevietnampro/";
let fontsP: Promise<any[]> | null = null;
const loadFonts = () => (fontsP ??= Promise.all([
  fetch(FONT_BASE + "BeVietnamPro-Regular.ttf").then((r) => r.arrayBuffer()),
  fetch(FONT_BASE + "BeVietnamPro-SemiBold.ttf").then((r) => r.arrayBuffer()),
]).then(([reg, semi]) => [
  { name: "BVP", data: reg, weight: 400, style: "normal" },
  { name: "BVP", data: semi, weight: 600, style: "normal" },
]));

// <layout> — bố cục ảnh (JS thuần, không phụ thuộc Deno; chạy thử được bằng satori trên Node)
const W = 720;
const FS = 23;            // cỡ chữ tin nhắn
const LINE = 32;          // chiều cao 1 dòng
const BUBBLE_MAX = 500;   // bề ngang tối đa bong bóng
const CHARS = 34;         // ước lượng ký tự / dòng trong bong bóng
const TZ = 7 * 3600e3;
const vnHM = (iso) => { const d = new Date(new Date(iso).getTime() + TZ); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const vnDay = (iso) => new Date(new Date(iso).getTime() + TZ).toISOString().slice(0, 10);
const dayLabel = (day, today) => (day === today ? "Hôm nay" : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`);
const linesOf = (t) => String(t || "").split("\n").reduce((n, s) => n + Math.max(1, Math.ceil([...s].length / CHARS)), 0);

function buildChat({ name, page, messages, nowIso }) {
  const h = (type, style, ...children) => ({ type, props: { style, children: children.length <= 1 ? children[0] : children } });
  const today = vnDay(nowIso);
  // Tin khách sau lần page trả lời cuối = "chưa trả lời"
  let lastPage = -1;
  messages.forEach((m, i) => { if (m.fromPage) lastPage = i; });
  const rows = [];
  let height = 150 + 70;   // tiêu đề + chân ảnh
  let prevDay = "";
  messages.forEach((m, i) => {
    const day = vnDay(m.time);
    if (day !== prevDay) {
      rows.push(h("div", { display: "flex", justifyContent: "center", margin: "10px 0 6px" },
        h("div", { fontSize: 17, color: "#64748B", background: "#E2E8F0", borderRadius: 999, padding: "4px 14px" }, dayLabel(day, today))));
      height += 52; prevDay = day;
    }
    const waiting = !m.fromPage && i > lastPage;
    const text = m.text || m.attach || "[tin nhắn]";
    rows.push(h("div", { display: "flex", flexDirection: "column", alignItems: m.fromPage ? "flex-end" : "flex-start", margin: "6px 0" },
      h("div", {
        display: "flex", maxWidth: BUBBLE_MAX, padding: "12px 18px", borderRadius: 22, fontSize: FS, lineHeight: `${LINE}px`,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        ...(m.fromPage
          ? { background: "#0F766E", color: "#FFFFFF", borderBottomRightRadius: 6 }
          : { background: "#F1F5F9", color: "#0F172A", borderBottomLeftRadius: 6, border: waiting ? "2px solid #F59E0B" : "2px solid #F1F5F9" }),
      }, text),
      h("div", { display: "flex", fontSize: 16, color: waiting ? "#B45309" : "#94A3B8", marginTop: 4, padding: "0 6px" },
        `${m.fromPage ? "Page" : "Khách"} · ${vnHM(m.time)}${waiting ? " · chưa trả lời" : ""}`)));
    height += linesOf(text) * LINE + 24 + 4 + 24 + 12;
  });
  if (!messages.length) { rows.push(h("div", { display: "flex", fontSize: 20, color: "#94A3B8", padding: "30px 0", justifyContent: "center" }, "Chưa đọc được tin nhắn nào")); height += 90; }

  const element = h("div", { display: "flex", flexDirection: "column", width: W, height: "100%", background: "#FFFFFF", fontFamily: "BVP" },
    h("div", { display: "flex", flexDirection: "column", padding: "26px 32px 20px", borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" },
      h("div", { display: "flex", fontSize: 30, fontWeight: 600, color: "#0F172A" }, name || "Khách"),
      h("div", { display: "flex", fontSize: 18, color: "#64748B", marginTop: 6 }, `${page ? page + " · " : ""}${messages.length} tin gần nhất`)),
    h("div", { display: "flex", flexDirection: "column", padding: "14px 28px", flexGrow: 1 }, ...rows),
    h("div", { display: "flex", fontSize: 15, color: "#94A3B8", padding: "14px 32px 22px", borderTop: "1px solid #F1F5F9" },
      "Ảnh do app dựng lại từ tin nhắn Messenger — không phải ảnh chụp màn hình"));
  return { element, width: W, height: Math.min(Math.max(height, 360), 4000) };
}

const DEMO = (nowIso) => {
  const t = (minAgo) => new Date(new Date(nowIso).getTime() - minAgo * 60e3).toISOString();
  return {
    name: "Khách mẫu (tin thử)", page: "Gọt Hàm, Hạ Gò Má, Trượt Cằm",
    messages: [
      { fromPage: false, text: "Chào bác sĩ, em muốn hỏi về gọt hàm V-line ạ 😊", time: t(95) },
      { fromPage: true, text: "Dạ chào chị, em là trợ lý của Bác sĩ Tuấn Hùng. Chị cho em xin ảnh mặt chính diện và nghiêng để bác sĩ xem giúp chị nha.", time: t(93) },
      { fromPage: false, text: "", attach: "[ảnh]", time: t(60) },
      { fromPage: false, text: "Đây ạ, em năm nay 28 tuổi", time: t(60) },
      { fromPage: true, text: "Dạ bác sĩ xem rồi, hàm chị phù hợp gọt V-line kết hợp trượt cằm ạ.", time: t(40) },
      { fromPage: false, text: "Chi phí trọn gói khoảng bao nhiêu vậy ạ?\nBên mình có trả góp không?", time: t(5) },
      { fromPage: false, text: "Cuối tuần này em lên khám được không ạ", time: t(4) },
    ],
  };
};
// </layout>

const pageTokens = (): Record<string, string> => {
  try {
    const list = JSON.parse(Deno.env.get("FB_PAGE_TOKENS") || "[]");
    return Object.fromEntries((Array.isArray(list) ? list : []).filter((x: any) => x?.id && x?.token).map((x: any) => [String(x.id), String(x.token)]));
  } catch { return {}; }
};
const shortPage = (n: string) => String(n || "").replace(/^\s*Dr\.?\s*Tuấn\s*Hùng\s*[-–—:]\s*/i, "").trim() || n;
const attachLabel = (a: any) => {
  const list = Array.isArray(a) ? a : a?.data || [];
  if (!list.length) return null;
  const t = String(list[0]?.mime_type || list[0]?.type || "");
  return t.startsWith("image") ? "[ảnh]" : t.startsWith("video") ? "[video]" : t.startsWith("audio") ? "[ghi âm]" : "[tệp đính kèm]";
};

async function loadConversation(sb: any, convKey: string) {
  const { data: c } = await sb.from("fb_conversations").select("conv_key, page_id, psid, thread_id, participant_name").eq("conv_key", convKey).maybeSingle();
  if (!c) return null;
  const { data: pg } = await sb.from("fb_pages").select("name").eq("page_id", c.page_id).maybeSingle();
  let messages: any[] = [];
  const token = pageTokens()[c.page_id];
  if (token && c.thread_id) {
    try {
      const p = new URLSearchParams({ fields: "id,message,from,created_time,attachments{mime_type}", limit: String(MAX_MSGS), access_token: token });
      const r = await fetch(`https://graph.facebook.com/${API}/${c.thread_id}/messages?${p}`);
      const d = await r.json();
      if (r.ok && Array.isArray(d.data)) {
        messages = d.data.map((m: any) => ({ fromPage: String(m.from?.id) === String(c.page_id), text: m.message || "", attach: attachLabel(m.attachments), time: m.created_time }));
      }
    } catch { /* lấy từ bảng bên dưới */ }
  }
  if (!messages.length) {
    const { data } = await sb.from("fb_messages").select("is_page, text, attachments, created_time").eq("conv_key", convKey)
      .order("created_time", { ascending: false }).limit(MAX_MSGS);
    messages = (data || []).map((m: any) => ({ fromPage: m.is_page, text: m.text || "", attach: attachLabel(m.attachments), time: m.created_time }));
  }
  messages.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return { name: c.participant_name, page: shortPage(pg?.name || ""), messages };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: st } = await sb.from("clinic_settings").select("inbox_alert_chat_id").maybeSingle();
    const chatId = String(st?.inbox_alert_chat_id || Deno.env.get("TELEGRAM_INBOX_CHAT_ID") || "").trim();
    if (!token || !chatId) return json({ ok: false, error: "Thiếu TELEGRAM_BOT_TOKEN hoặc nhóm Telegram" });

    const nowIso = new Date().toISOString();
    const conv = body.demo ? DEMO(nowIso) : await loadConversation(sb, String(body.conv_key || ""));
    if (!conv) return json({ ok: false, error: "Không tìm thấy hội thoại" });

    const { element, width, height } = buildChat({ ...conv, nowIso });
    const img = new ImageResponse(element as any, { width, height, fonts: await loadFonts(), emoji: "twemoji" });
    const png = await img.arrayBuffer();

    const fd = new FormData();
    fd.append("chat_id", chatId);
    fd.append("photo", new Blob([png], { type: "image/png" }), "hoi-thoai.png");
    fd.append("caption", `${body.index ? body.index + ". " : ""}${conv.name || "Khách"}${conv.page ? " — " + conv.page : ""}`.slice(0, 1000));
    if (body.reply_to) fd.append("reply_parameters", JSON.stringify({ message_id: Number(body.reply_to), allow_sending_without_reply: true }));
    const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    if (!d?.ok) return json({ ok: false, error: d?.description || `Telegram HTTP ${r.status}` });
    return json({ ok: true, messages: conv.messages.length, bytes: png.byteLength, height });
  } catch (e) {
    console.error("inbox-chat-image error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
