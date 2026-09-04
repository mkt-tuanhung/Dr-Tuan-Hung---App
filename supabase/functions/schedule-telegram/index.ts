// ============================================================
// BÁO LỊCH HẸN VỀ NHÓM TELEGRAM "LỊCH HẸN - PHẪU THUẬT"
// Gọi bởi Database Webhook (trigger) khi INSERT / UPDATE customer_appointments.
// Deploy với "Verify JWT" = OFF; bảo vệ bằng header x-webhook-secret = WEBHOOK_SECRET.
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_SCHEDULE_CHAT_ID, WEBHOOK_SECRET
//
// Format tin nhắn theo mẫu của quản lý:
//   Thông báo lịch ngày 4/9
//   - Thời gian: 17h
//   - KH: Nguyễn Thị Hợi 0984688318
//   - Dịch vụ: hạ gò má
//   - Tổng bill dự kiến: 43tr
//   - Cọc: 0
//   - Xét nghiệm: chưa
//   - Tình trạng: ...
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHAT_MAIN = Deno.env.get('TELEGRAM_SCHEDULE_CHAT_ID');            // nhóm LỊCH TƯ VẤN
const CHAT_RECHECK = Deno.env.get('TELEGRAM_RECHECK_CHAT_ID') || CHAT_MAIN;   // nhóm TÁI KHÁM (chưa set -> về nhóm tư vấn)
const CHAT_SURGERY = Deno.env.get('TELEGRAM_SURGERY_CHAT_ID') || CHAT_MAIN;   // nhóm PHẪU THUẬT (chưa set -> về nhóm tư vấn)
const SECRET = Deno.env.get('WEBHOOK_SECRET');
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// '2026-09-04' -> '4/9'
const dShort = (d?: string | null) => {
  if (!d) return '';
  const [, m, day] = String(d).slice(0, 10).split('-');
  return `${Number(day)}/${Number(m)}`;
};
// '2026-09-04' -> '4/9/2026'
const dFull = (d?: string | null) => {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${Number(day)}/${Number(m)}/${y}`;
};
// '17:00:00' -> '17h' | '17:30:00' -> '17h30'
const tShort = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
// 43000000 -> '43tr' | 43500000 -> '43,5tr' | 500000 -> '500k' | 0 -> '0'
const money = (n?: number | null) => {
  const v = Number(n) || 0;
  if (!v) return '0';
  if (v >= 1_000_000) {
    const tr = Math.round((v / 1_000_000) * 10) / 10;
    return String(tr).replace('.', ',') + 'tr';
  }
  if (v >= 1_000) return Math.round(v / 1_000) + 'k';
  return String(v);
};

async function nameOf(id?: string | null) {
  if (!id) return '';
  const { data } = await supabase.from('profiles').select('full_name').eq('id', id).single();
  return data?.full_name || '';
}

async function send(chatId: string | undefined, text: string) {
  if (!chatId) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

// Dòng "- Nhãn: giá trị" — bỏ qua khi trống
const line = (label: string, value: string) => (value ? `\n- ${label}: ${value}` : '');

// Hôm nay theo giờ VN (yyyy-mm-dd) — chỉ báo lịch mổ từ hôm nay trở đi khi
// khách được TẠO MỚI kèm ngày mổ (tránh spam lúc import dữ liệu cũ)
const todayVN = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

// Ảnh đính kèm nằm trong ghi chú dạng "[Ảnh đính kèm: https://...]"
const IMG_RE = /\[Ảnh đính kèm:\s*(https?:\/\/[^\]\s]+)\]/g;
const imgsFromNotes = (notes?: string | null) =>
  [...String(notes || '').matchAll(IMG_RE)].map((m) => m[1]);
// Bỏ marker ảnh khỏi phần "Tình trạng" cho gọn tin nhắn
const cleanNotes = (notes?: string | null) =>
  String(notes || '').replace(IMG_RE, '').replace(/\n{2,}/g, '\n').trim();

// Telegram hay từ chối tải ảnh từ URL ngoài (R2) -> server TỰ TẢI ảnh về rồi
// đẩy thẳng FILE lên nhóm (multipart) — giống nhóm chấm công. Ảnh lỗi thì bỏ qua.
async function sendPhotos(chatId: string, urls: string[], caption: string) {
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) continue;
      const blob = await res.blob();
      const fd = new FormData();
      fd.append('chat_id', chatId);
      if (i === 0) fd.append('caption', caption);
      fd.append('photo', new File([blob], `anh-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: fd });
    } catch { /* bỏ qua ảnh lỗi */ }
  }
}

Deno.serve(async (req) => {
  if (SECRET && req.headers.get('x-webhook-secret') !== SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  try {
    const payload = await req.json();
    const type: string = payload.type;                 // INSERT | UPDATE
    const rec = payload.record ?? {};
    const old = payload.old_record ?? {};
    if (!rec?.customer_name) return new Response('skip');

    const isRecheck = String(rec.service || '').startsWith('[Tái khám]');
    const serviceClean = String(rec.service || '').replace('[Tái khám] ', '');
    const kh = `<b>${esc(rec.customer_name)}</b>${rec.phone ? ' ' + esc(rec.phone) : ''}`;
    const [teleName, tele2Name, saleName] = await Promise.all([
      nameOf(rec.telesale_id), nameOf(rec.telesale_id_2), nameOf(rec.sale_id),
    ]);
    const teleFull = [teleName, tele2Name].filter(Boolean).join(' + ');
    const staffLines = line('Telesale phụ trách', esc(teleFull)) + line('Sale phụ trách', esc(saleName));
    const notesClean = cleanNotes(rec.notes);

    // Gom ảnh: ảnh đính kèm trong ghi chú + ảnh hồ sơ tư vấn (tối đa 5)
    const photos = [
      ...imgsFromNotes(rec.notes),
      ...(Array.isArray(rec.consult_image_urls) ? rec.consult_image_urls : []),
    ].filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 5);
    // Gửi ảnh chạy nền sau khi đã trả lời webhook (không bị cắt vì timeout)
    const queuePhotos = (chatId: string | undefined) => {
      if (!photos.length || !chatId) return;
      const task = sendPhotos(chatId, photos, `📎 Ảnh đính kèm — ${rec.customer_name}`);
      // deno-lint-ignore no-explicit-any
      const rt: any = globalThis as any;
      if (rt.EdgeRuntime?.waitUntil) rt.EdgeRuntime.waitUntil(task); else task.catch(() => {});
    };

    // 1) LỊCH PHẪU THUẬT -> NHÓM PHẪU THUẬT, khi:
    //    • Đánh giá sau tư vấn chốt "Phẫu thuật" / đổi ngày mổ (UPDATE surgery_date)
    //    • Sale tạo mới khách ĐÃ có ngày mổ luôn (INSERT có surgery_date, từ hôm nay trở đi)
    const surgeryInsert = type === 'INSERT' && !isRecheck && rec.surgery_date &&
      String(rec.surgery_date).slice(0, 10) >= todayVN();
    const surgeryUpdate = type === 'UPDATE' && !isRecheck && rec.surgery_date &&
      rec.surgery_date !== old.surgery_date;
    if (surgeryInsert || surgeryUpdate) {
      const bacSi = await nameOf(rec.bac_si_id);
      const text =
        `⚕️ <b>Thông báo lịch PHẪU THUẬT ngày ${dShort(rec.surgery_date)}</b>` +
        (surgeryUpdate && old.surgery_date ? line('Ngày cũ', dShort(old.surgery_date) + ' (đổi lịch)') : '') +
        line('KH', kh) +
        line('Loại phẫu thuật', esc(rec.surgery_type || serviceClean)) +
        line('Bác sĩ', esc(bacSi)) +
        line('Tổng bill', money(rec.revenue)) +
        staffLines +
        line('Tình trạng', esc(notesClean));
      await send(CHAT_SURGERY, text);
      queuePhotos(CHAT_SURGERY);
      return new Response('ok');
    }

    // 2) LỊCH MỚI (INSERT có ngày hẹn) — tư vấn hoặc tái khám
    if (type === 'INSERT' && rec.appointment_date) {
      const text = isRecheck
        ? `🩺 <b>Thông báo lịch TÁI KHÁM ngày ${dShort(rec.appointment_date)}</b>` +
          line('Thời gian', tShort(rec.appointment_time)) +
          line('KH', kh) +
          line('Dịch vụ đã dùng', esc(rec.used_service || serviceClean)) +
          line('Ngày phẫu thuật', dFull(rec.surgery_date)) +
          staffLines +
          line('Tình trạng', esc(notesClean))
        : `📅 <b>Thông báo lịch ngày ${dShort(rec.appointment_date)}</b>${rec.consult_do_now ? ' ⚡ <b>TƯ VẤN LÀM LUÔN</b>' : ''}` +
          line('Thời gian', tShort(rec.appointment_time)) +
          line('KH', kh) +
          line('Dịch vụ', esc(serviceClean)) +
          line('Tham khảo thêm', esc(rec.extra_consult)) +
          line('Tổng bill dự kiến', money(rec.expected_bill)) +
          line('Cọc', money(rec.deposit_amount)) +
          line('Xét nghiệm', esc(rec.test_status)) +
          staffLines +
          line('Tình trạng', esc(notesClean));
      const chat = isRecheck ? CHAT_RECHECK : CHAT_MAIN;
      await send(chat, text);
      queuePhotos(chat);
      // ⚡ TƯ VẤN LÀM LUÔN: khách tư vấn xong phẫu thuật ngay -> báo THÊM nhóm Phẫu thuật
      if (!isRecheck && rec.consult_do_now && CHAT_SURGERY && CHAT_SURGERY !== chat) {
        const surgeryCopy =
          `⚕️ <b>TƯ VẤN LÀM LUÔN — dự kiến PHẪU THUẬT ngày ${dShort(rec.appointment_date)}</b>` +
          line('Thời gian tư vấn', tShort(rec.appointment_time)) +
          line('KH', kh) +
          line('Dịch vụ', esc(serviceClean)) +
          line('Tham khảo thêm', esc(rec.extra_consult)) +
          line('Tổng bill dự kiến', money(rec.expected_bill)) +
          staffLines +
          line('Tình trạng', esc(notesClean));
        await send(CHAT_SURGERY, surgeryCopy);
        queuePhotos(CHAT_SURGERY);
      }
      return new Response('ok');
    }

    // 3) DỜI LỊCH (đổi ngày/giờ hẹn)
    if (
      type === 'UPDATE' && rec.appointment_date &&
      (rec.appointment_date !== old.appointment_date ||
        (rec.appointment_time || '') !== (old.appointment_time || ''))
    ) {
      const oldWhen = old.appointment_date
        ? `${tShort(old.appointment_time) ? tShort(old.appointment_time) + ' ' : ''}${dShort(old.appointment_date)}`
        : '';
      const text =
        `🔁 <b>DỜI LỊCH${isRecheck ? ' TÁI KHÁM' : ''} — sang ngày ${dShort(rec.appointment_date)}</b>` +
        (oldWhen ? line('Lịch cũ', oldWhen) : '') +
        line('Thời gian mới', `${tShort(rec.appointment_time) ? tShort(rec.appointment_time) + ' ' : ''}ngày ${dShort(rec.appointment_date)}`) +
        line('KH', kh) +
        line('Dịch vụ', esc(isRecheck ? rec.used_service || serviceClean : serviceClean)) +
        staffLines +
        line('Tình trạng', esc(notesClean));
      const chat = isRecheck ? CHAT_RECHECK : CHAT_MAIN;
      await send(chat, text);
      queuePhotos(chat);
      return new Response('ok');
    }

    return new Response('skip');
  } catch (e) {
    return new Response('error: ' + (e as Error).message, { status: 200 });
  }
});
