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
const CHAT_SURGERY = Deno.env.get('TELEGRAM_SURGERY_CHAT_ID') || CHAT_MAIN;   // nhóm PHẪU THUẬT
const CHAT_JOURNEY = Deno.env.get('TELEGRAM_JOURNEY_CHAT_ID');                // nhóm HÀNH TRÌNH KHÁCH HÀNG (chưa set -> bỏ qua) (chưa set -> về nhóm tư vấn)
// nhóm CHĂM SÓC HẬU PHẪU (tháng đầu sau mổ): nhật ký + ảnh của điều dưỡng, cảnh báo rủi ro / tình trạng
const CHAT_POSTOP = Deno.env.get('TELEGRAM_POSTOP_CHAT_ID') || '-5448812418';
// nhóm CHĂM SÓC KHÁCH HÀNG: ghi chú / nhật ký CSKH (+ ảnh) và phân loại khách
const CHAT_CSKH = Deno.env.get('TELEGRAM_CSKH_CHAT_ID') || '-5461485486';
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

async function send(chatId: string | undefined, text: string, replyMarkup?: unknown) {
  if (!chatId) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

// Giờ hiện tại theo VN, dạng '14:05'
const nowVN = () => {
  const t = new Date(Date.now() + 7 * 3600 * 1000);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
};

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
// đẩy thẳng FILE lên nhóm (multipart) — giống nhóm chấm công.
// Telegram từ chối ảnh (quá nặng / quá dài / định dạng lạ) -> gửi lại dạng FILE (sendDocument).
// Mọi lỗi đều ghi log (Edge Functions → schedule-telegram → Logs) để tra lại.
async function sendPhotos(chatId: string, urls: string[], caption: string) {
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) { console.error('tải ảnh lỗi', res.status, urls[i]); continue; }
      const blob = await res.blob();
      const ext = (urls[i].split('?')[0].split('.').pop() || 'jpg').toLowerCase();
      const name = `ho-so-${i + 1}.${ext.length <= 4 ? ext : 'jpg'}`;
      const post = async (method: 'sendPhoto' | 'sendDocument') => {
        const fd = new FormData();
        fd.append('chat_id', chatId);
        if (i === 0) fd.append('caption', caption);
        fd.append(method === 'sendPhoto' ? 'photo' : 'document', new File([blob], name, { type: blob.type || 'image/jpeg' }));
        const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (!j.ok) console.error(method, 'lỗi', j.description || r.status, urls[i]);
        return !!j.ok;
      };
      if (!(await post('sendPhoto'))) await post('sendDocument');
    } catch (e) { console.error('gửi ảnh lỗi', (e as Error).message, urls[i]); }
  }
}

// ============================================================
// HẬU PHẪU THÁNG ĐẦU -> nhóm CHAT_POSTOP
//  a) Điều dưỡng lưu mốc chăm sóc (nhật ký post_op_notes có mốc mới): nội dung + ảnh + trạng thái,
//     dấu hiệu cảnh báo, mức rủi ro. App lưu 2 bước (nối nhật ký rồi mới đổi trạng thái) ->
//     chờ vài giây rồi ĐỌC LẠI dòng mới nhất để 1 tin có đủ trạng thái/cảnh báo vừa chọn.
//  b) Chỉ đổi trạng thái / dấu hiệu cảnh báo / lịch tái khám (không kèm ghi chú) -> tin cập nhật tình trạng.
//  c) Hoàn thành mốc hồi phục (care_milestones) -> tin báo mốc.
// Ca mổ quá 1 tháng (đã sang CSKH) không gửi.
// ============================================================
const MS_LABEL: Record<string, string> = { d0: 'Ngày phẫu thuật', d1: 'Ngày 1', d2: 'Ngày 2', d7: 'Ngày 7', d14: 'Ngày 14', d30: 'Ngày 30' };
const surgeryDay = (d?: string | null) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00+07:00`) : null);
const inFirstMonth = (d?: string | null) => {
  const s = surgeryDay(d);
  if (!s) return true;                       // chưa có ngày mổ -> vẫn coi là hậu phẫu (giống màn Hậu phẫu)
  const lim = new Date(); lim.setMonth(lim.getMonth() - 1);
  return s >= lim;
};
const dayAfter = (d?: string | null) => {
  const s = surgeryDay(d);
  return s ? Math.floor((Date.now() - s.getTime()) / 86400000) : null;
};
const signsOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const riskOf = (status: string, signs: string[]) =>
  status === 'Có biến chứng' || signs.length >= 3 ? 'cao' : signs.length >= 1 ? 'tb' : 'thap';
const RISK_HEAD: Record<string, string> = {
  cao: '🔴 <b>CẢNH BÁO RỦI RO CAO — HẬU PHẪU</b>',
  tb: '🟠 <b>HẬU PHẪU — CẦN THEO DÕI SÁT</b>',
  thap: '🟢 <b>HẬU PHẪU — CẬP NHẬT CHĂM SÓC</b>',
};
const dtVN = (iso?: string | null) => {
  if (!iso) return '';
  const t = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${t.getUTCHours()}h${String(t.getUTCMinutes()).padStart(2, '0')} ngày ${t.getUTCDate()}/${t.getUTCMonth() + 1}`;
};
// Phần nhật ký MỚI nối thêm (app nối vào cuối); không khớp -> lấy mốc cuối cùng
const addedNotes = (now?: string | null, before?: string | null) => {
  const n = String(now || ''), o = String(before || '');
  if (n === o) return '';
  if (o && n.startsWith(o)) return n.slice(o.length).trim();
  const lines = n.split('\n');
  const idx = lines.map((l, i) => (/^\[\d/.test(l.trim()) ? i : -1)).filter((i) => i >= 0).pop();
  return idx == null ? n.trim() : lines.slice(idx).join('\n').trim();
};
// Thời điểm mốc nhật ký cuối "[21/10/2026 10:05:03]" (giờ VN) -> ms
const lastEntryAt = (notes?: string | null) => {
  const all = [...String(notes || '').matchAll(/\[(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g)];
  const m = all.pop();
  if (!m) return 0;
  const [, d, mo, y, h, mi, se] = m;
  return Date.UTC(+y, +mo - 1, +d, +h - 7, +mi, +(se || 0));
};
const runLater = (task: Promise<unknown>) => {
  // deno-lint-ignore no-explicit-any
  const rt: any = globalThis as any;
  if (rt.EdgeRuntime?.waitUntil) rt.EdgeRuntime.waitUntil(task); else task.catch(() => {});
};

// deno-lint-ignore no-explicit-any
async function postOpHeader(rec: any, status: string, signs: string[], nextRecheck: string | null, nurseId: string | null) {
  const nurse = await nameOf(nurseId);
  const n = dayAfter(rec.surgery_date);
  return RISK_HEAD[riskOf(status, signs)] +
    line('KH', `<b>${esc(rec.customer_name)}</b>${rec.phone ? ' ' + esc(rec.phone) : ''}`) +
    line('Dịch vụ', esc(String(rec.service || '').replace('[Tái khám] ', ''))) +
    line('Ngày mổ', rec.surgery_date ? `${dShort(rec.surgery_date)}${n != null && n >= 0 ? ` (ngày thứ ${n} sau mổ)` : ''}` : '') +
    line('Tình trạng', esc(status || 'Đang theo dõi')) +
    (signs.length ? `\n- ⚠️ Dấu hiệu cảnh báo: <b>${esc(signs.join(', '))}</b>` : '') +
    line('Tái khám tiếp theo', dtVN(nextRecheck)) +
    line('Điều dưỡng phụ trách', esc(nurse));
}

// deno-lint-ignore no-explicit-any
function handlePostOp(type: string, rec: any, old: any) {
  if (!CHAT_POSTOP || type !== 'UPDATE' || rec.status !== 'phau_thuat') return;
  if (String(rec.service || '').startsWith('[Tái khám]') || !inFirstMonth(rec.surgery_date)) return;

  // a) Mốc nhật ký mới (nội dung + ảnh)
  const added = addedNotes(rec.post_op_notes, old.post_op_notes);
  if (added) {
    runLater((async () => {
      await new Promise((r) => setTimeout(r, 4000));   // chờ app lưu xong trạng thái / cảnh báo
      const { data: cur } = await supabase.from('customer_appointments')
        .select('post_op_status, warning_signs, next_recheck_at, hau_phau_id').eq('id', rec.id).maybeSingle();
      const st = cur?.post_op_status ?? rec.post_op_status ?? 'Đang theo dõi';
      const sg = signsOf(cur?.warning_signs ?? rec.warning_signs);
      const imgs = imgsFromNotes(added);
      const text = cleanNotes(added).replace(/^\[([^\]]+)\]\s*/, '');
      const at = (added.match(/^\[([^\]]+)\]/) || [])[1] || '';
      const msg = (await postOpHeader(rec, st, sg, cur?.next_recheck_at ?? rec.next_recheck_at, cur?.hau_phau_id ?? rec.hau_phau_id)) +
        `\n\n📝 <b>Ghi chú chăm sóc${at ? ` (${esc(at)})` : ''}:</b>\n${esc(text || '(chỉ có ảnh)')}` +
        (imgs.length ? `\n📷 ${imgs.length} ảnh đính kèm bên dưới` : '');
      await send(CHAT_POSTOP, msg);
      if (imgs.length) await sendPhotos(CHAT_POSTOP, imgs.slice(0, 10), `📷 Ảnh hậu phẫu — ${rec.customer_name}`);
    })().catch((e) => console.error('hậu phẫu: gửi nhật ký lỗi', (e as Error).message)));
    return;
  }

  // b) Đổi trạng thái / dấu hiệu cảnh báo / lịch tái khám (không kèm ghi chú mới)
  const stNow = rec.post_op_status || 'Đang theo dõi', stOld = old.post_op_status || 'Đang theo dõi';
  const sgNow = signsOf(rec.warning_signs), sgOld = signsOf(old.warning_signs);
  const signsChanged = JSON.stringify([...sgNow].sort()) !== JSON.stringify([...sgOld].sort());
  const recheckChanged = (rec.next_recheck_at || '') !== (old.next_recheck_at || '');
  if (stNow !== stOld || signsChanged || recheckChanged) {
    // Vừa lưu kèm ghi chú (bước 2 của cùng 1 lần lưu) -> tin nhật ký ở trên đã gồm trạng thái mới
    if (Date.now() - lastEntryAt(rec.post_op_notes) < 120000) return;
    const newSigns = sgNow.filter((x) => !sgOld.includes(x));
    runLater((async () => {
      const msg = (await postOpHeader(rec, stNow, sgNow, rec.next_recheck_at, rec.hau_phau_id)) +
        `\n\n🔄 <b>Cập nhật tình trạng:</b>` +
        (stNow !== stOld ? `\n- Trạng thái: ${esc(stOld)} → <b>${esc(stNow)}</b>` : '') +
        (newSigns.length ? `\n- Dấu hiệu mới: <b>${esc(newSigns.join(', '))}</b>` : '') +
        (signsChanged && !sgNow.length ? '\n- Đã hết dấu hiệu cảnh báo' : '') +
        (recheckChanged ? `\n- Lịch tái khám: ${rec.next_recheck_at ? dtVN(rec.next_recheck_at) : 'đã bỏ'}` : '');
      await send(CHAT_POSTOP, msg);
    })().catch((e) => console.error('hậu phẫu: gửi tình trạng lỗi', (e as Error).message)));
    return;
  }

  // c) Mốc hồi phục vừa hoàn thành / sửa ghi chú mốc
  // deno-lint-ignore no-explicit-any
  const msNow: any[] = Array.isArray(rec.care_milestones) ? rec.care_milestones : [];
  // deno-lint-ignore no-explicit-any
  const msOld: any[] = Array.isArray(old.care_milestones) ? old.care_milestones : [];
  const changed = msNow.filter((m) => {
    const o = msOld.find((x) => x?.key === m?.key) || {};
    return m?.key && ((m.done && !o.done) || (m.done && (m.note || '') !== (o.note || '')));
  });
  if (changed.length) {
    runLater((async () => {
      for (const m of changed) {
        const nurse = await nameOf(m.nurse_id);
        await send(CHAT_POSTOP,
          `✅ <b>HOÀN THÀNH MỐC ${esc((MS_LABEL[m.key] || m.key).toUpperCase())} — HẬU PHẪU</b>` +
          line('KH', `<b>${esc(rec.customer_name)}</b>${rec.phone ? ' ' + esc(rec.phone) : ''}`) +
          line('Ngày mổ', dShort(rec.surgery_date)) +
          line('Tình trạng', esc(stNow)) +
          (sgNow.length ? `\n- ⚠️ Dấu hiệu cảnh báo: <b>${esc(sgNow.join(', '))}</b>` : '') +
          line('Điều dưỡng', esc(nurse)) +
          line('Ghi chú mốc', esc(m.note)));
      }
    })().catch((e) => console.error('hậu phẫu: gửi mốc lỗi', (e as Error).message)));
  }
}

// ============================================================
// NHẬT KÝ CSKH -> nhóm CHAT_CSKH
//  a) CSKH lưu mốc (cskh_notes có mốc mới): nội dung + ảnh + phân loại khách. App nối nhật ký trước,
//     lưu phân loại sau -> chờ vài giây rồi đọc lại để 1 tin có đúng phân loại vừa chọn.
//  b) Chỉ đổi phân loại khách (không kèm ghi chú) -> tin đổi phân loại.
// ============================================================
const CSKH_HEAD: Record<string, string> = {
  'Không hài lòng': '🔴 <b>CSKH — KHÁCH KHÔNG HÀI LÒNG, CẦN XỬ LÝ</b>',
  'Gặp vấn đề': '🔴 <b>CSKH — KHÁCH GẶP VẤN ĐỀ, CẦN XỬ LÝ</b>',
  'Tiềm năng': '🟣 <b>CSKH — KHÁCH TIỀM NĂNG</b>',
  'Hài lòng': '🟢 <b>CSKH — KHÁCH HÀI LÒNG</b>',
};
// deno-lint-ignore no-explicit-any
const cskhHeader = (rec: any, cls: string | null) => {
  const n = dayAfter(rec.surgery_date);
  return (CSKH_HEAD[cls || ''] || '🔵 <b>CSKH — CẬP NHẬT CHĂM SÓC KHÁCH HÀNG</b>') +
    line('KH', `<b>${esc(rec.customer_name)}</b>${rec.phone ? ' ' + esc(rec.phone) : ''}`) +
    line('Dịch vụ', esc(String(rec.service || '').replace('[Tái khám] ', ''))) +
    line('Ngày mổ', rec.surgery_date ? `${dFull(rec.surgery_date)}${n != null && n >= 0 ? ` (${n} ngày sau mổ)` : ''}` : '') +
    line('Phân loại khách', esc(cls || 'Chưa phân loại')) +
    line('Hậu phẫu', esc(rec.post_op_status));
};

// deno-lint-ignore no-explicit-any
function handleCskh(type: string, rec: any, old: any) {
  if (!CHAT_CSKH || type !== 'UPDATE' || rec.status !== 'phau_thuat') return;
  if (String(rec.service || '').startsWith('[Tái khám]')) return;

  const added = addedNotes(rec.cskh_notes, old.cskh_notes);
  if (added) {
    runLater((async () => {
      await new Promise((r) => setTimeout(r, 4000));   // chờ app lưu xong phân loại khách
      const { data: cur } = await supabase.from('customer_appointments').select('cskh_status').eq('id', rec.id).maybeSingle();
      const cls = cur ? cur.cskh_status : rec.cskh_status;
      const imgs = imgsFromNotes(added);
      const text = cleanNotes(added).replace(/^\[([^\]]+)\]\s*/, '');
      const at = (added.match(/^\[([^\]]+)\]/) || [])[1] || '';
      await send(CHAT_CSKH, cskhHeader(rec, cls) +
        (cls !== (old.cskh_status ?? null) ? `\n- Đổi phân loại: ${esc(old.cskh_status || 'Chưa phân loại')} → <b>${esc(cls || 'Chưa phân loại')}</b>` : '') +
        `\n\n📝 <b>Nhật ký CSKH${at ? ` (${esc(at)})` : ''}:</b>\n${esc(text || '(chỉ có ảnh)')}` +
        (imgs.length ? `\n📷 ${imgs.length} ảnh đính kèm bên dưới` : ''));
      if (imgs.length) await sendPhotos(CHAT_CSKH, imgs.slice(0, 10), `📷 Ảnh CSKH — ${rec.customer_name}`);
    })().catch((e) => console.error('CSKH: gửi nhật ký lỗi', (e as Error).message)));
    return;
  }

  if ((rec.cskh_status || null) !== (old.cskh_status || null)) {
    // Bước 2 của cùng 1 lần lưu (vừa nối nhật ký) -> tin nhật ký ở trên đã gồm phân loại mới
    if (Date.now() - lastEntryAt(rec.cskh_notes) < 120000) return;
    runLater(send(CHAT_CSKH, cskhHeader(rec, rec.cskh_status) +
      `\n\n🔄 <b>Đổi phân loại:</b> ${esc(old.cskh_status || 'Chưa phân loại')} → <b>${esc(rec.cskh_status || 'Chưa phân loại')}</b>`)
      .catch((e) => console.error('CSKH: gửi phân loại lỗi', (e as Error).message)));
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

    // Hậu phẫu tháng đầu -> nhóm chăm sóc hậu phẫu (chạy nền, KHÔNG chặn các nhánh dưới)
    try { handlePostOp(type, rec, old); } catch (e) { console.error('hậu phẫu lỗi', (e as Error).message); }
    // Nhật ký CSKH -> nhóm chăm sóc khách hàng (chạy nền)
    try { handleCskh(type, rec, old); } catch (e) { console.error('CSKH lỗi', (e as Error).message); }

    const isRecheck = String(rec.service || '').startsWith('[Tái khám]');
    const serviceClean = String(rec.service || '').replace('[Tái khám] ', '');
    const kh = `<b>${esc(rec.customer_name)}</b>${rec.phone ? ' ' + esc(rec.phone) : ''}`;
    const [teleName, tele2Name, saleName] = await Promise.all([
      nameOf(rec.telesale_id), nameOf(rec.telesale_id_2), nameOf(rec.sale_id),
    ]);
    const teleFull = [teleName, tele2Name].filter(Boolean).join(' + ');
    const staffLines = line('Telesale phụ trách', esc(teleFull)) + line('Sale phụ trách', esc(saleName));
    const notesClean = cleanNotes(rec.notes);

    // Gom ảnh: ảnh đính kèm trong ghi chú + ảnh hồ sơ tư vấn (tối đa 10)
    const isUrl = (u: unknown) => typeof u === 'string' && u.startsWith('http');
    const consultNow: string[] = (Array.isArray(rec.consult_image_urls) ? rec.consult_image_urls : []).filter(isUrl);
    const consultOld: string[] = (Array.isArray(old.consult_image_urls) ? old.consult_image_urls : []).filter(isUrl);
    const photos = [...imgsFromNotes(rec.notes), ...consultNow].filter(isUrl).slice(0, 10);
    // Gửi ảnh chạy nền sau khi đã trả lời webhook (không bị cắt vì timeout)
    const queuePhotos = (chatId: string | undefined, list: string[] = photos, caption = `📎 Hồ sơ đính kèm — ${rec.customer_name}`) => {
      if (!list.length || !chatId) return;
      const task = sendPhotos(chatId, list, caption);
      // deno-lint-ignore no-explicit-any
      const rt: any = globalThis as any;
      if (rt.EdgeRuntime?.waitUntil) rt.EdgeRuntime.waitUntil(task); else task.catch(() => {});
    };

    // ---- NHÓM HÀNH TRÌNH KHÁCH HÀNG (gửi thêm, KHÔNG chặn các nhánh dưới) ----
    if (CHAT_JOURNEY && type === 'UPDATE' && !isRecheck) {
      // a) Sale bấm TIẾP NHẬN khách từ lịch hẹn -> khách đã đến, đang tư vấn
      if (rec.consult_received && !old.consult_received) {
        await send(CHAT_JOURNEY,
          `🙋 <b>KHÁCH ĐÃ ĐẾN — SALE ĐANG TƯ VẤN</b>` +
          line('KH', kh) +
          line('Dịch vụ', esc(serviceClean)) +
          line('Giờ tiếp nhận', nowVN()) +
          staffLines);
      }
      // b) Sale đánh giá sau tư vấn: CỌC / BONG / PHẪU THUẬT
      if (rec.status !== old.status) {
        if (rec.status === 'coc') {
          await send(CHAT_JOURNEY,
            `💰 <b>KHÁCH CỌC</b>` +
            line('KH', kh) +
            line('Dịch vụ', esc(serviceClean)) +
            line('Dự kiến mổ', rec.expected_surgery_plan === 'this_month' ? `PT trong tháng ${String(rec.deposit_date || '').slice(5, 7)}/${String(rec.deposit_date || '').slice(0, 4)}`.replace(/ \/$/, '')
              : rec.expected_surgery_plan === 'none' ? 'Chưa có ngày PT dự kiến' : dShort(rec.expected_surgery_date)) +
            staffLines);
        } else if (rec.status === 'bong') {
          await send(CHAT_JOURNEY,
            `❌ <b>KHÁCH BONG</b>` +
            line('KH', kh) +
            line('Dịch vụ', esc(serviceClean)) +
            line('Ghi chú', esc(notesClean)) +
            staffLines);
        } else if (rec.status === 'phau_thuat') {
          await send(CHAT_JOURNEY,
            `⚕️ <b>CHỐT PHẪU THUẬT</b>` +
            line('KH', kh) +
            line('Loại phẫu thuật', esc(rec.surgery_type || serviceClean)) +
            line('Ngày mổ', dShort(rec.surgery_date)) +
            line('Tổng bill', money(rec.revenue)) +
            staffLines +
            `\n\n👇 Cập nhật hành trình bằng nút bên dưới:`,
            { inline_keyboard: [
              [{ text: 'Hoàn thiện hồ sơ - XN', callback_data: `js:ho_so:${rec.id}` }],
              [{ text: 'Đã xét nghiệm xong', callback_data: `js:xn_xong:${rec.id}` }],
              [{ text: 'Khám mê', callback_data: `js:kham_me:${rec.id}` }],
              [{ text: 'Đang phẫu thuật', callback_data: `js:dang_mo:${rec.id}` }],
              [{ text: 'Đã phẫu thuật xong', callback_data: `js:mo_xong:${rec.id}` }],
              [{ text: 'Khách ra viện', callback_data: `js:ra_vien:${rec.id}` }],
            ] });
        }
      }
    }

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

    // 1b) HỒ SƠ TƯ VẤN BỔ SUNG cho khách PHẪU THUẬT / TƯ VẤN LÀM LUÔN: ảnh được tải lên SAU lúc báo lịch
    //     (vd. màn Khách tư vấn lưu ảnh bằng nút "Hồ sơ tư vấn" riêng) -> gửi phần ảnh MỚI lên nhóm Phẫu thuật
    const addedConsult = consultNow.filter((u) => !consultOld.includes(u));
    if (type === 'UPDATE' && !isRecheck && addedConsult.length &&
        (rec.status === 'phau_thuat' || rec.consult_do_now)) {
      await send(CHAT_SURGERY,
        `📎 <b>Hồ sơ tư vấn bổ sung</b>` +
        line('KH', kh) +
        line('Ngày mổ', dShort(rec.surgery_date || rec.appointment_date)) +
        line('Số ảnh mới', String(addedConsult.length)) +
        line('Ghi chú tư vấn', esc(rec.consult_note)));
      queuePhotos(CHAT_SURGERY, addedConsult.slice(0, 10), `📎 Hồ sơ tư vấn — ${rec.customer_name}`);
      return new Response('ok');
    }

    // 2) LỊCH MỚI (INSERT có ngày hẹn) — tư vấn hoặc tái khám
    if (type === 'INSERT' && rec.appointment_date) {
      // ⚡ TƯ VẤN LÀM LUÔN: khách tư vấn xong phẫu thuật ngay -> CHỈ báo nhóm Phẫu thuật
      if (!isRecheck && rec.consult_do_now) {
        const text =
          `⚕️ <b>TƯ VẤN LÀM LUÔN — dự kiến PHẪU THUẬT ngày ${dShort(rec.appointment_date)}</b>` +
          line('Thời gian tư vấn', tShort(rec.appointment_time)) +
          line('KH', kh) +
          line('Dịch vụ', esc(serviceClean)) +
          line('Tham khảo thêm', esc(rec.extra_consult)) +
          line('Tổng bill dự kiến', money(rec.expected_bill)) +
          line('Cọc', money(rec.deposit_amount)) +
          line('Xét nghiệm', esc(rec.test_status)) +
          staffLines +
          line('Tình trạng', esc(notesClean));
        await send(CHAT_SURGERY, text);
        queuePhotos(CHAT_SURGERY);
        return new Response('ok');
      }
      const text = isRecheck
        ? `🩺 <b>Thông báo lịch TÁI KHÁM ngày ${dShort(rec.appointment_date)}</b>` +
          line('Thời gian', tShort(rec.appointment_time)) +
          line('KH', kh) +
          line('Dịch vụ đã dùng', esc(rec.used_service || serviceClean)) +
          line('Ngày phẫu thuật', dFull(rec.surgery_date)) +
          staffLines +
          line('Tình trạng', esc(notesClean))
        : `📅 <b>Thông báo lịch ngày ${dShort(rec.appointment_date)}</b>` +
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
