// ============================================================
// Supabase Edge Function: inbox-sla-alert
// Cảnh báo nhóm Telegram trực page khi khách nhắn Messenger mà chưa ai trả lời.
// Trạng thái chờ do trigger trên fb_messages ghi (supabase/inbox_sla.sql); cron
// 'inbox-sla-1min' chỉ gọi hàm khi có khách đang chờ.
//
// Khung giờ (giờ VN):
//   09:00–12:00 · 13:30–18:00 · 19:00–23:00  -> cảnh báo ở phút 3, nhắc lại ở phút 10 và 30
//   12:00–13:30 nghỉ trưa · 18:00–19:00 di chuyển -> chỉ nhắc nhẹ 1 lần
//   23:00–09:00 -> im lặng; sáng ra tính lại từ 9:00
// Đã bị nhắc mà sau đó có trả lời -> báo "✅ đã phản hồi sau X phút".
// Mỗi khách: trích 1 tin gần nhất + nút "Trả lời" mở Meta Business Suite / Pancake đúng hội thoại
//   (mẫu link Pancake: clinic_settings.inbox_pancake_url, vd https://pancake.vn/{page_id}?c_id={page_id}_{psid}).
//
// Secrets: TELEGRAM_BOT_TOKEN. Nhóm: clinic_settings.inbox_alert_chat_id
//          (dự phòng: secret TELEGRAM_INBOX_CHAT_ID).
// Gọi:  {}            -> kiểm tra & gửi (cron)
//       {test:true}   -> gửi 1 tin thử vào nhóm
//       {demo:true}   -> gửi 1 cảnh báo MẪU (nhãn 🧪) giống hệt cảnh báo thật; nút Meta mở hội thoại
//                        mới nhất có thật (page Gọt Hàm nếu có) để thử link — không đổi trạng thái chờ
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Phút trong ngày (giờ VN)
const WORK = [[540, 720], [810, 1080], [1140, 1380]];
const SOFT = [
  { key: "lunch", from: 720, to: 810, title: "🍱 Giờ nghỉ trưa — có khách đang nhắn tin", tail: "Nghỉ trưa xong nhớ phản hồi khách ngay nhé!" },
  { key: "commute", from: 1080, to: 1140, title: "🛵 Giờ di chuyển — có khách đang nhắn tin", tail: "Về đến nơi nhớ phản hồi khách ngay nhé!" },
];
const LEVELS = [
  { lv: 1, min: 3, title: "⚠️ Khách chờ phản hồi quá 3 phút" },
  { lv: 2, min: 10, title: "⏰ Nhắc lần 2 — khách đã chờ quá 10 phút" },
  { lv: 3, min: 30, title: "🚨 KHẨN — khách đã chờ quá 30 phút" },
];
const PER_MESSAGE = 10;   // tối đa khách / 1 tin Telegram (phần còn lại gửi ở lượt sau)

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const metaInboxUrl = (c: any) => `https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(c.page_id)}&selected_item_id=${encodeURIComponent(c.psid)}&mailbox_id=${encodeURIComponent(c.page_id)}`;
// Mẫu link có {page_id} {psid} {thread_id} -> link mở đúng hội thoại (chỉ nhận https)
const fillUrl = (tpl: string, c: any) => {
  const u = String(tpl || "").replace(/\{page_id\}/g, encodeURIComponent(c.page_id)).replace(/\{psid\}/g, encodeURIComponent(c.psid)).replace(/\{thread_id\}/g, encodeURIComponent(c.thread_id || ""));
  return /^https:\/\/[^\s]+$/.test(u) ? u : null;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

async function sendTelegram(token: string, chatId: string, text: string, buttons?: { text: string; url: string }[][]) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
      ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d?.ok) throw new Error(d?.description || `Telegram HTTP ${r.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!token) return json({ ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN" });
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: st } = await sb.from("clinic_settings").select("*").maybeSingle();
    const chatId = String(st?.inbox_alert_chat_id || Deno.env.get("TELEGRAM_INBOX_CHAT_ID") || "").trim();
    if (!chatId) return json({ ok: false, error: "Chưa có nhóm Telegram (clinic_settings.inbox_alert_chat_id)" });

    if (body.test) {
      await sendTelegram(token, chatId, "✅ <b>Kết nối thành công</b>\nNhóm này sẽ nhận cảnh báo khi khách nhắn fanpage mà chưa được phản hồi.");
      return json({ ok: true, test: true });
    }
    if (body.demo) {
      const { data: convs } = await sb.from("fb_conversations").select("page_id, psid, thread_id, last_time")
        .not("last_time", "is", null).order("last_time", { ascending: false }).limit(20);
      const c = (convs || []).find((x: any) => x.page_id === "900471446473281") || convs?.[0];
      if (!c) return json({ ok: false, error: "Chưa có hội thoại nào để làm mẫu" });
      const { data: pg } = await sb.from("fb_pages").select("name").eq("page_id", c.page_id).maybeSingle();
      const tpl = String(st?.inbox_pancake_url || "").trim();
      const row = [{ text: "↩️ 1. Khách mẫu · Meta", url: metaInboxUrl(c) }];
      const pk = tpl ? fillUrl(tpl, c) : null;
      if (pk) row.push({ text: "🐼 Pancake", url: pk });
      const text = `🧪 <b>TIN THỬ — không phải khách thật</b>\n\n<b>${LEVELS[0].title}</b>\n👤 Đang trực: (tên nhân sự trực page theo Lịch làm việc)\n\n`
        + `1. <b>Khách mẫu</b> · chờ 4 phút (từ ${hhmm(Math.floor(((Date.now() - 4 * 60e3 + 7 * 3600e3) % 86400e3) / 60e3))})\n`
        + (pg?.name ? `   📄 ${esc(cut(pg.name, 40))}\n` : "")
        + `   💬 Cho em hỏi giá gọt hàm V-line trọn gói bao nhiêu ạ?\n\n`
        + `<i>Nút bên dưới mở hội thoại MỚI NHẤT có thật của page này để thử link.</i>`;
      await sendTelegram(token, chatId, text, [row]);
      return json({ ok: true, demo: true, page: pg?.name || c.page_id });
    }
    if (st && st.inbox_alert_enabled === false) return json({ ok: true, disabled: true });

    const now = Date.now();
    const vn = new Date(now + 7 * 3600e3);
    const mins = vn.getUTCHours() * 60 + vn.getUTCMinutes();
    const dayKey = vn.toISOString().slice(0, 10);
    const vnMidnight = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600e3;
    const at = (m: number) => vnMidnight + m * 60e3;
    const sent: Record<string, number> = {};

    // ---- 1. Đã trả lời sau khi bị nhắc -> báo ✅ ----
    const { data: replied } = await sb.from("fb_conversations")
      .select("conv_key, participant_name, sla_reply_minutes").not("sla_replied_at", "is", null).limit(30);
    if (replied?.length) {
      const lines = replied.map((c: any) => `• <b>${esc(c.participant_name || "Khách")}</b> — sau ${c.sla_reply_minutes ?? "?"} phút`);
      await sendTelegram(token, chatId, `✅ <b>Đã phản hồi khách</b>\n${lines.join("\n")}`);
      await sb.from("fb_conversations").update({ sla_replied_at: null, sla_reply_minutes: null }).in("conv_key", replied.map((c: any) => c.conv_key));
      sent.replied = replied.length;
    }

    // ---- 2. Khung giờ hiện tại ----
    const work = WORK.find(([a, b]) => mins >= a && mins < b);
    const soft = SOFT.find((s) => mins >= s.from && mins < s.to);
    if (!work && !soft) return json({ ok: true, window: "off", sent });

    const { data: waiting, error } = await sb.from("fb_conversations")
      .select("conv_key, page_id, psid, thread_id, participant_name, sla_waiting_since, sla_level, sla_soft_key")
      .gt("sla_waiting_since", new Date(now - 24 * 3600e3).toISOString())
      .order("sla_waiting_since", { ascending: true }).limit(200);
    if (error) return json({ ok: false, error: error.message });
    if (!waiting?.length) return json({ ok: true, window: work ? "work" : soft!.key, sent });

    const winStart = at(work ? work[0] : soft!.from);
    const waitedMin = (c: any) => Math.floor((now - Math.max(new Date(c.sla_waiting_since).getTime(), winStart)) / 60e3);
    const totalMin = (c: any) => Math.floor((now - new Date(c.sla_waiting_since).getTime()) / 60e3);

    // Gom theo nhóm tin cần gửi
    const groups: { title: string; tail?: string; convs: any[]; apply: (c: any) => Record<string, unknown> }[] = [];
    if (work) {
      for (const L of [...LEVELS].reverse()) {
        const convs = waiting.filter((c: any) => {
          const target = [...LEVELS].reverse().find((x) => waitedMin(c) >= x.min)?.lv ?? 0;
          return target === L.lv && target > (c.sla_level || 0);
        });
        if (convs.length) groups.push({ title: L.title, convs, apply: () => ({ sla_level: L.lv }) });
      }
    } else {
      const key = `${dayKey}:${soft!.key}`;
      const convs = waiting.filter((c: any) => c.sla_soft_key !== key && waitedMin(c) >= 3);
      if (convs.length) groups.push({ title: soft!.title, tail: soft!.tail, convs, apply: () => ({ sla_soft_key: key }) });
    }
    if (!groups.length) return json({ ok: true, window: work ? "work" : soft!.key, waiting: waiting.length, sent });

    // ---- 3. Tin khách gần nhất (chỉ các tin chưa được trả lời) ----
    const pick = groups.flatMap((g) => g.convs.slice(0, PER_MESSAGE));
    const minSince = pick.reduce((m, c) => (c.sla_waiting_since < m ? c.sla_waiting_since : m), pick[0].sla_waiting_since);
    const { data: msgs } = await sb.from("fb_messages")
      .select("conv_key, text, attachments, created_time")
      .in("conv_key", pick.map((c) => c.conv_key)).eq("is_page", false).gte("created_time", minSince)
      .order("created_time", { ascending: false }).limit(300);
    const lastOf = (c: any) => (msgs || [])
      .filter((m: any) => m.conv_key === c.conv_key && m.created_time >= c.sla_waiting_since)
      .slice(0, 1)
      .map((m: any) => (m.text ? cut(String(m.text).replace(/\s+/g, " ").trim(), 160) : "[ảnh / tệp đính kèm]"));

    // ---- 4. Ai đang trực page (Lịch làm việc đã công bố) ----
    let onDuty: string[] = [];
    try {
      const { data: sch } = await sb.from("staff_schedules")
        .select("shift:work_shifts(start_time, end_time, is_off), staff:profiles!staff_id(full_name, role, role_2, is_active)")
        .eq("date", dayKey).eq("status", "published");
      const toMin = (t: string) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
      onDuty = (sch || []).filter((r: any) => {
        const p = r.staff, s = r.shift;
        if (!p?.is_active || !s || s.is_off || ![p.role, p.role_2].includes("truc_page")) return false;
        const a = toMin(s.start_time), b = toMin(s.end_time);
        return a <= b ? mins >= a && mins < b : mins >= a || mins < b;
      }).map((r: any) => r.staff.full_name).filter(Boolean);
    } catch { /* chưa có lịch làm việc -> bỏ qua */ }

    // Tên fanpage (nhiều page -> ghi rõ khách nhắn page nào)
    const { data: pgs } = await sb.from("fb_pages").select("page_id, name");
    const pageName: Record<string, string> = Object.fromEntries((pgs || []).map((p: any) => [String(p.page_id), p.name]));
    const multiPage = new Set(pick.map((c) => c.page_id)).size > 1 || Object.keys(pageName).length > 1;

    // ---- 5. Gửi ----
    const pancakeTpl = String(st?.inbox_pancake_url || "").trim();
    for (const g of groups) {
      const list = g.convs.slice(0, PER_MESSAGE);
      // Mỗi khách 1 hàng nút: Trả lời trên Meta Business Suite · Pancake (nếu đã cài mẫu link)
      const buttons = list.map((c: any, i: number) => {
        const row = [{ text: `↩️ ${i + 1}. ${cut(c.participant_name || "Khách", 22)} · Meta`, url: metaInboxUrl(c) }];
        const pk = pancakeTpl ? fillUrl(pancakeTpl, c) : null;
        if (pk) row.push({ text: "🐼 Pancake", url: pk });
        return row;
      });
      const blocks = list.map((c: any, i: number) => {
        const lines = lastOf(c).map((t: string) => `   💬 ${esc(t)}`);
        const sinceMs = new Date(c.sla_waiting_since).getTime();
        const since = hhmm(Math.floor(((sinceMs + 7 * 3600e3) % 86400e3) / 60e3)) + (sinceMs < vnMidnight ? " hôm qua" : "");
        const pg = multiPage && pageName[c.page_id] ? `   📄 ${esc(cut(pageName[c.page_id], 40))}\n` : "";
        return `${i + 1}. <b>${esc(c.participant_name || "Khách")}</b> · chờ ${totalMin(c)} phút (từ ${since})\n` + pg
          + lines.join("\n");
      });
      const more = g.convs.length > PER_MESSAGE ? `\n… và ${g.convs.length - PER_MESSAGE} khách khác` : "";
      const duty = onDuty.length ? `👤 Đang trực: ${esc(onDuty.join(", "))}\n` : "";
      const text = `<b>${g.title}</b>\n${duty}\n${blocks.join("\n\n")}${more}${g.tail ? `\n\n${g.tail}` : ""}`;
      await sendTelegram(token, chatId, text, buttons);
      await sb.from("fb_conversations").update(g.apply(list[0])).in("conv_key", list.map((c: any) => c.conv_key));
      sent[g.title] = list.length;
    }
    return json({ ok: true, window: work ? "work" : soft!.key, waiting: waiting.length, on_duty: onDuty, sent });
  } catch (e) {
    console.error("inbox-sla-alert error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
