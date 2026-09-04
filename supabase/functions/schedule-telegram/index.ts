// ============================================================
// BÁO LỊCH HẸN VỀ NHÓM TELEGRAM "LỊCH HẸN - PHẪU THUẬT"
// Gọi bởi Supabase Database Webhook khi INSERT / UPDATE bảng customer_appointments.
// Deploy với "Verify JWT" = OFF; bảo vệ bằng header x-webhook-secret = WEBHOOK_SECRET.
//
// Gửi thông báo khi:
//   • Tạo LỊCH HẸN TƯ VẤN mới        (INSERT có appointment_date, service thường)
//   • Tạo LỊCH TÁI KHÁM mới          (INSERT có appointment_date, service bắt đầu "[Tái khám]")
//   • DỜI LỊCH HẸN                    (UPDATE đổi appointment_date/appointment_time)
//   • CHỐT LỊCH PHẪU THUẬT            (UPDATE surgery_date mới / đổi ngày mổ)
// Secrets cần có: TELEGRAM_BOT_TOKEN, TELEGRAM_SCHEDULE_CHAT_ID, WEBHOOK_SECRET
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHAT_ID = Deno.env.get('TELEGRAM_SCHEDULE_CHAT_ID');
const SECRET = Deno.env.get('WEBHOOK_SECRET');
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = (d?: string | null) => {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};
const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : '');
const fmtMoney = (n?: number | null) =>
  Number(n) ? new Intl.NumberFormat('vi-VN').format(Number(n)) + 'đ' : '';

async function nameOf(id?: string | null) {
  if (!id) return '';
  const { data } = await supabase.from('profiles').select('full_name').eq('id', id).single();
  return data?.full_name || '';
}

async function send(text: string) {
  if (!CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

// Dòng chỉ thêm khi có dữ liệu
const line = (label: string, value: string) => (value ? `\n${label} ${value}` : '');

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

    // Thông tin chung của khách
    const [teleName, tele2Name, saleName, bacSiName, creatorName] = await Promise.all([
      nameOf(rec.telesale_id), nameOf(rec.telesale_id_2), nameOf(rec.sale_id), nameOf(rec.bac_si_id), nameOf(rec.created_by),
    ]);
    const teleFull = [teleName, tele2Name].filter(Boolean).join(' + ');
    const common =
      line('👤 Khách:', `<b>${esc(rec.customer_name)}</b>`) +
      line('📞 SĐT:', esc(rec.phone)) +
      line('🌐 Nguồn:', esc(rec.customer_source));

    // 1) CHỐT / ĐỔI LỊCH PHẪU THUẬT (surgery_date mới hoặc thay đổi)
    if (type === 'UPDATE' && rec.surgery_date && rec.surgery_date !== old.surgery_date) {
      const text =
        `⚕️ <b>LỊCH PHẪU THUẬT${old.surgery_date ? ' — ĐỔI NGÀY' : ''}</b>` +
        common +
        line('🔪 Loại phẫu thuật:', esc(rec.surgery_type || serviceClean)) +
        (old.surgery_date ? line('🗓 Ngày cũ:', `<s>${fmtDate(old.surgery_date)}</s>`) : '') +
        line('🗓 Ngày mổ:', `<b>${fmtDate(rec.surgery_date)}</b>`) +
        line('👨‍⚕️ Bác sĩ:', esc(bacSiName)) +
        line('💰 Doanh thu:', fmtMoney(rec.revenue)) +
        line('🧑‍💼 Sale:', esc(saleName)) +
        line('☎️ Telesale:', esc(teleFull)) +
        line('📝 Ghi chú:', esc(rec.notes));
      await send(text);
      return new Response('ok');
    }

    // 2) LỊCH HẸN MỚI (tư vấn / tái khám) khi INSERT có ngày hẹn
    if (type === 'INSERT' && rec.appointment_date) {
      const when = `${fmtTime(rec.appointment_time) ? fmtTime(rec.appointment_time) + ' — ' : ''}${fmtDate(rec.appointment_date)}`;
      const text = isRecheck
        ? `🩺 <b>LỊCH TÁI KHÁM MỚI</b>` +
          common +
          line('💉 Dịch vụ đã dùng:', esc(rec.used_service || serviceClean)) +
          line('🔪 Ngày phẫu thuật:', fmtDate(rec.surgery_date)) +
          line('🕒 Hẹn tái khám:', `<b>${when}</b>`) +
          line('🧑‍💼 Người báo lịch:', esc(creatorName)) +
          line('📝 Ghi chú:', esc(rec.notes))
        : `🗓 <b>LỊCH HẸN TƯ VẤN MỚI</b>` +
          common +
          line('💉 Dịch vụ:', esc(serviceClean)) +
          line('🕒 Hẹn:', `<b>${when}</b>`) +
          line('🧪 Xét nghiệm:', esc(rec.test_status)) +
          line('💰 Bill dự kiến:', fmtMoney(rec.expected_bill)) +
          line('💵 Cọc:', fmtMoney(rec.deposit_amount)) +
          line('☎️ Telesale:', esc(teleFull)) +
          line('🧑‍💼 Sale:', esc(saleName)) +
          line('🧑‍💻 Người báo lịch:', esc(creatorName)) +
          line('📝 Ghi chú:', esc(rec.notes));
      await send(text);
      return new Response('ok');
    }

    // 3) DỜI LỊCH HẸN (đổi ngày/giờ hẹn)
    if (
      type === 'UPDATE' && rec.appointment_date &&
      (rec.appointment_date !== old.appointment_date ||
        (rec.appointment_time || '') !== (old.appointment_time || ''))
    ) {
      const oldWhen = old.appointment_date
        ? `${fmtTime(old.appointment_time) ? fmtTime(old.appointment_time) + ' — ' : ''}${fmtDate(old.appointment_date)}`
        : '';
      const when = `${fmtTime(rec.appointment_time) ? fmtTime(rec.appointment_time) + ' — ' : ''}${fmtDate(rec.appointment_date)}`;
      const text =
        `🔁 <b>DỜI LỊCH ${isRecheck ? 'TÁI KHÁM' : 'HẸN TƯ VẤN'}</b>` +
        common +
        line('💉 Dịch vụ:', esc(isRecheck ? rec.used_service || serviceClean : serviceClean)) +
        (oldWhen ? line('🕒 Lịch cũ:', `<s>${oldWhen}</s>`) : '') +
        line('🕒 Lịch mới:', `<b>${when}</b>`) +
        line('☎️ Telesale:', esc(teleFull)) +
        line('📝 Ghi chú:', esc(rec.notes));
      await send(text);
      return new Response('ok');
    }

    return new Response('skip');
  } catch (e) {
    // Trả 200 để webhook không retry dồn dập
    return new Response('error: ' + (e as Error).message, { status: 200 });
  }
});
