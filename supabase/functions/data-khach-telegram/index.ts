// ============================================================
// Supabase Edge Function: data-khach-telegram
// Báo vào nhóm Telegram "DATA KHÁCH HÀNG":
//   • KHÁCH MỚI được tạo (trực page / marketing / telesale)  — bảng marketing_data
//   • NOTE MỚI: cuộc gọi, ghi chú, chăm sóc của trực page / telesale / sale — bảng marketing_activities
// Kèm ảnh / video đính kèm.
// Gọi từ trigger DB (pg_net): body {table, id}. Hàm TỰ ĐỌC LẠI bản ghi bằng service role
// (không tin dữ liệu trong body) -> gọi giả cũng chỉ gửi lại thông tin thật, không chèn được nội dung.
// Secrets: TELEGRAM_BOT_TOKEN (dùng chung), TELEGRAM_DATA_CHAT_ID (tuỳ chọn, mặc định bên dưới)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHAT = Deno.env.get('TELEGRAM_DATA_CHAT_ID') || '-5307182805';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const line = (label: string, value: unknown) => (value ? `\n- ${label}: ${value}` : '');
const ROLE: Record<string, string> = { truc_page: 'Trực page', telesale: 'Telesale', sale_offline: 'Sale', marketing: 'Marketing', admin: 'Admin', cskh: 'CSKH' };
const STATUS: Record<string, string> = { tiep_can: 'Tiếp cận', nong: 'Nóng', tiem_nang: 'Tiềm năng', da_hen_lich: 'Đã hẹn lịch', coc: 'Cọc', da_lam_dv: 'Đã làm dịch vụ', sai_gon: 'Sài Gòn', chot_fail: 'Chốt Fail', mat: 'Mất' };
const OUTCOME: Record<string, string> = { nghe_may: 'Nghe máy', khong_nghe: 'Không nghe máy', may_ban: 'Máy bận', hen_goi_lai: 'Hẹn gọi lại', can_nhac: 'Đang cân nhắc', tu_choi: 'Từ chối', sai_so: 'Sai số / không liên lạc' };
const vnTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
};
const isVideo = (u: string) => /\.(mp4|mov|m4v|webm|3gp|avi|mkv)(\?|$)/i.test(u);

async function send(text: string) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.error('sendMessage lỗi', j.description || r.status);
}
// Telegram hay từ chối tải URL ngoài -> tự tải về rồi đẩy FILE lên (giống schedule-telegram)
async function sendMedia(urls: string[], caption: string) {
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) { console.error('tải file lỗi', res.status, urls[i]); continue; }
      const blob = await res.blob();
      const ext = (urls[i].split('?')[0].split('.').pop() || 'jpg').toLowerCase();
      const name = `data-khach-${i + 1}.${ext.length <= 4 ? ext : 'jpg'}`;
      const post = async (method: string, field: string) => {
        const fd = new FormData();
        fd.append('chat_id', CHAT);
        if (i === 0) fd.append('caption', caption);
        fd.append(field, new File([blob], name, { type: blob.type || (isVideo(urls[i]) ? 'video/mp4' : 'image/jpeg') }));
        const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (!j.ok) console.error(method, 'lỗi', j.description || r.status);
        return !!j.ok;
      };
      const ok = isVideo(urls[i]) ? await post('sendVideo', 'video') : await post('sendPhoto', 'photo');
      if (!ok) await post('sendDocument', 'document');
    } catch (e) { console.error('gửi file lỗi', (e as Error).message); }
  }
}
const person = async (id?: string | null) => {
  if (!id) return null;
  const { data } = await db.from('profiles').select('full_name, role, role_2').eq('id', id).maybeSingle();
  return data;
};
const later = (task: Promise<unknown>) => {
  // deno-lint-ignore no-explicit-any
  const rt: any = globalThis as any;
  if (rt.EdgeRuntime?.waitUntil) rt.EdgeRuntime.waitUntil(task); else task.catch(() => {});
};

// ===== BÁO CÁO SALE NGÀY HÔM TRƯỚC (cron 7:00 VN) — cùng cấu trúc nút "Báo cáo ngày" trong app,
//       lưu vào daily_reports -> link công khai /bao-cao/<mã> gửi vào nhóm =====
const APP_URL = (Deno.env.get('APP_URL') || 'https://dr-tuan-hung-app-web-ujkb.vercel.app').replace(/\/$/, '');
const STATUS_COLORS: Record<string, string> = { tiep_can: '#64748b', nong: '#f43f5e', tiem_nang: '#f59e0b', da_hen_lich: '#3b82f6', coc: '#8b5cf6', da_lam_dv: '#12A4A5', sai_gon: '#06b6d4', chot_fail: '#fb923c', mat: '#94a3b8' };
const OUTCOME_COLORS: Record<string, string> = { nghe_may: '#10b981', khong_nghe: '#94a3b8', may_ban: '#f59e0b', hen_goi_lai: '#3b82f6', can_nhac: '#8b5cf6', tu_choi: '#f43f5e', sai_so: '#64748b' };
const maskPhone = (p: unknown) => { const s = String(p ?? '').trim(); return !s ? s : s.length <= 4 ? '••••' : s.slice(0, -4) + '••••'; };
async function dailyReport(dayArg?: string) {
  const DAY = 86400000;
  const vnNow = new Date(Date.now() + 7 * 3600_000);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(dayArg || '')) ? String(dayArg)
    : new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()) - DAY).toISOString().slice(0, 10);   // hôm qua (giờ VN)
  const from = new Date(Date.parse(day + 'T00:00:00Z') - 7 * 3600_000).toISOString();
  const to = new Date(Date.parse(day + 'T00:00:00Z') - 7 * 3600_000 + DAY).toISOString();
  const vnDay = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10) : '');

  const { data: acts } = await db.from('marketing_activities')
    .select('data_id, type, outcome, content, next_at, created_at, phone, author:profiles!created_by(full_name), khach:marketing_data!data_id(customer_name, phone, status, created_at, getfly_created_at)')
    .gte('created_at', from).lt('created_at', to).not('created_by', 'is', null).order('created_at', { ascending: true }).limit(5000);
  const [n1, n2] = await Promise.all([
    db.from('marketing_data').select('id, customer_name, phone, source, status').gte('getfly_created_at', from).lt('getfly_created_at', to).limit(3000),
    db.from('marketing_data').select('id, customer_name, phone, source, status').is('getfly_created_at', null).gte('created_at', from).lt('created_at', to).limit(3000),
  ]);
  const newRows: any[] = [...(n1.data || []), ...(n2.data || [])];
  const newIds = new Set(newRows.map(r => r.id));
  const { count: apptCount } = await db.from('customer_appointments').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to);

  const A: any[] = acts || [];
  const calls = A.filter(a => a.type === 'call');
  const callIds = new Set(calls.map(a => a.data_id));
  const cares = A.filter(a => a.type === 'care');
  const isNewK = (a: any) => newIds.has(a.data_id) || vnDay(a.khach?.getfly_created_at || a.khach?.created_at) === day;
  const callRows = calls.map(a => ({
    name: a.khach?.customer_name || '—', phone: maskPhone(a.khach?.phone || a.phone), time: a.created_at,
    content: String(`${OUTCOME[a.outcome] || 'Gọi'}${a.content ? ' — ' + a.content : ''}`).slice(0, 300),
    author: a.author?.full_name || null, is_new: isNewK(a), status_label: STATUS[a.khach?.status] || null, status_color: STATUS_COLORS[a.khach?.status] || null,
  }));
  const callsNew = callRows.filter(c => c.is_new), callsOld = callRows.filter(c => !c.is_new);
  const newCalled = newRows.filter(r => callIds.has(r.id));
  // trạng thái khách trong ngày (có cuộc gọi hoặc số mới)
  const st: Record<string, number> = {};
  const seen = new Set<string>();
  calls.forEach(a => { if (a.data_id && !seen.has(a.data_id)) { seen.add(a.data_id); const k = a.khach?.status || 'tiep_can'; st[k] = (st[k] || 0) + 1; } });
  newRows.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); const k = r.status || 'tiep_can'; st[k] = (st[k] || 0) + 1; } });
  const byOutcome: Record<string, number> = {}; calls.forEach(c => { byOutcome[c.outcome] = (byOutcome[c.outcome] || 0) + 1; });
  const src: Record<string, number> = {}; newRows.forEach(r => { const s = String(r.source || '').trim() || 'Khác'; src[s] = (src[s] || 0) + 1; });
  const palette = ['#12A4A5', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];
  const payload = {
    day, whoName: 'Tất cả telesale', generated_at: new Date().toISOString(),
    stats: { calls: calls.length, new_count: newRows.length, new_called: newCalled.length, new_not_called: newRows.length - newCalled.length,
      cares: cares.length, next_cnt: A.filter(a => a.next_at).length, old_calls: callsOld.length, new_calls: callsNew.length },
    by_outcome: Object.entries(byOutcome).map(([k, v]) => ({ label: OUTCOME[k] || k, value: v, color: OUTCOME_COLORS[k] || '#64748b' })),
    by_status: Object.entries(st).map(([k, v]) => ({ label: STATUS[k] || k, value: v, color: STATUS_COLORS[k] || '#cbd5e1' })),
    by_source: Object.entries(src).map(([k, v], i) => ({ label: k, value: v, color: palette[i % 6] })).sort((a, b) => b.value - a.value),
    calls_new: callsNew.slice(0, 200), calls_old: callsOld.slice(0, 200),
    news: newRows.slice(0, 300).map(r => ({ name: r.customer_name, phone: maskPhone(r.phone), source: r.source || null, called: callIds.has(r.id), status: STATUS[r.status] || r.status })),
  };
  const slug = Array.from(crypto.getRandomValues(new Uint8Array(14))).map(b => (b % 36).toString(36)).join('');
  const dd = `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
  const { error } = await db.from('daily_reports').insert({ slug, day, title: `Báo cáo telesale ${dd} (tự động)`, payload, created_by: null });
  if (error) { console.error('daily_reports insert lỗi', error.message); return { ok: false, error: error.message }; }
  const url = `${APP_URL}/bao-cao/${slug}`;
  const pct = (a: number, b: number) => (b ? ` (${Math.round(a * 100 / b)}%)` : '');
  await send(
    `📊 <b>BÁO CÁO SALE NGÀY ${dd}</b>` +
    line('📞 Cuộc gọi', `${calls.length} — khách mới ${callsNew.length} · khách cũ ${callsOld.length}`) +
    line('✅ Nghe máy', `${(byOutcome.nghe_may || 0) + (byOutcome.hen_goi_lai || 0) + (byOutcome.can_nhac || 0)}${pct((byOutcome.nghe_may || 0) + (byOutcome.hen_goi_lai || 0) + (byOutcome.can_nhac || 0), calls.length)}`) +
    line('🆕 Số mới về', `${newRows.length} — đã gọi ${newCalled.length} · chưa gọi ${newRows.length - newCalled.length}`) +
    line('📝 Ghi chú / chăm sóc', String(cares.length)) +
    line('⏰ Hẹn gọi lại', String(payload.stats.next_cnt)) +
    line('📅 Lịch hẹn mới tạo', String(apptCount || 0)) +
    `\n\n👉 Xem chi tiết (biểu đồ, từng cuộc gọi): ${url}`);
  return { ok: true, url, day };
}

// ===== NHẮC BUỔI SÁNG (cron 8:15 VN): việc chăm data hôm nay của từng telesale =====
const WAKE_PER_DAY = 20;
async function morning() {
  const rows: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await db.from('marketing_data')
      .select('id, status, telesale_id, last_contact_at, next_call_at, created_at, getfly_created_at')
      .not('telesale_id', 'is', null).not('status', 'in', '(mat,da_lam_dv)').range(from, from + 999);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const { data: teles } = await db.from('profiles').select('id, full_name').eq('is_active', true).or('role.eq.telesale,role_2.eq.telesale');
  const now = Date.now(), DAY = 86400000;
  const vn = new Date(now + 7 * 3600_000);
  const todayStartUtc = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600_000;
  const endToday = todayStartUtc + DAY;
  const arrived = (r: any) => new Date(r.getfly_created_at || r.created_at).getTime();
  const daysSince = (t?: string | null) => (t ? (now - new Date(t).getTime()) / DAY : null);
  let text = `☀️ <b>CHĂM DATA HÔM NAY ${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}</b>`;
  let any = false;
  for (const t of teles || []) {
    const mine = rows.filter(r => r.telesale_id === t.id);
    if (!mine.length) continue;
    any = true;
    const due = mine.filter(r => r.next_call_at && new Date(r.next_call_at).getTime() < endToday).length;
    const cold = mine.filter(r => ['nong', 'tiem_nang'].includes(r.status) && ((daysSince(r.last_contact_at) ?? (now - arrived(r)) / DAY) > 3)).length;
    const newY = mine.filter(r => !r.last_contact_at && arrived(r) >= todayStartUtc - DAY && arrived(r) < todayStartUtc).length;
    const old = mine.filter(r => (daysSince(r.last_contact_at) ?? (now - arrived(r)) / DAY) > 30).length;
    text += `\n\n👤 <b>${esc(t.full_name)}</b>` +
      line('📞 Tới hạn gọi lại', String(due)) +
      line('🔥 Nóng / Tiềm năng sắp nguội (&gt;3 ngày)', String(cold)) +
      line('🆕 Data mới hôm qua chưa gọi', String(newY)) +
      line('⏰ Đánh thức data cũ hôm nay', `${Math.min(WAKE_PER_DAY, old)} khách (còn ${old} khách &gt;30 ngày)`);
  }
  if (!any) return;
  text += `\n\n👉 App → Data khách → nút <b>Sắp nguội</b> / <b>Đánh thức data cũ</b> / <b>🔥 Ưu tiên gọi</b>.`;
  await send(text);
}

Deno.serve(async (req) => {
  try {
    if (!CHAT) return new Response('chưa cấu hình nhóm');
    const body = await req.json().catch(() => ({}));
    if (body.mode === 'morning') { await morning(); return new Response('ok morning'); }
    if (body.mode === 'daily_report') { const r = await dailyReport(body.day); return new Response(JSON.stringify(r)); }
    const table = String(body.table || '');
    const id = String(body.id || body.record?.id || '');
    if (!id) return new Response('skip');

    if (table === 'marketing_data') {
      const { data: k } = await db.from('marketing_data').select('*').eq('id', id).maybeSingle();
      if (!k) return new Response('skip');
      // Import CSV hàng loạt -> chỉ báo 5 khách đầu mỗi phút (tránh spam nhóm)
      if (k.created_by) {
        const { count } = await db.from('marketing_data').select('id', { count: 'exact', head: true })
          .eq('created_by', k.created_by).gte('created_at', new Date(Date.now() - 60_000).toISOString());
        if ((count || 0) > 5) return new Response('skip bulk');
      }
      const [creator, truc, tele] = await Promise.all([person(k.created_by), person(k.truc_page_id), person(k.telesale_id)]);
      const media: string[] = (Array.isArray(k.media_urls) ? k.media_urls : []).filter((u: unknown) => typeof u === 'string');
      await send(
        `🆕 <b>KHÁCH MỚI</b>${creator ? ` — ${esc(ROLE[creator.role] || '')} ${esc(creator.full_name)}`.replace(' —  ', ' — ') : ''}` +
        line('Tên khách', `<b>${esc(k.customer_name || '(chưa có tên)')}</b>`) +
        line('SĐT', esc(k.phone)) +
        line('Giới tính / năm sinh', esc([k.gender, k.birthday].filter(Boolean).join(' · '))) +
        line('Địa chỉ', esc(k.address)) +
        line('Nguồn', esc(k.source)) +
        line('Nhóm DV quan tâm', esc(k.customer_group)) +
        line('Nhu cầu', esc(k.description)) +
        line('Thông tin đã tiếp cận', esc(k.reached_info)) +
        line('Giai đoạn', esc(STATUS[k.status] || k.status)) +
        line('Trực page', esc(truc?.full_name)) +
        line('Telesale nhận data', esc(tele?.full_name || 'Chưa phân')) +
        (media.length ? line('Ảnh / video', `${media.length} file (bên dưới)`) : ''));
      if (media.length) later(sendMedia(media.slice(0, 10), `📎 ${k.customer_name || ''} ${k.phone || ''}`.trim()));
      return new Response('ok');
    }

    if (table === 'marketing_activities') {
      const { data: a } = await db.from('marketing_activities').select('*').eq('id', id).maybeSingle();
      if (!a) return new Response('skip');
      const { data: k } = a.data_id
        ? await db.from('marketing_data').select('customer_name, phone, status, telesale_id').eq('id', a.data_id).maybeSingle()
        : { data: null };
      const who = await person(a.created_by);
      const media: string[] = (Array.isArray(a.media_urls) ? a.media_urls : []).filter((u: unknown) => typeof u === 'string');
      const isCall = a.type === 'call';
      const content = String(a.content || '');
      // Nhật ký tự động khi đẩy lịch hẹn -> vẫn báo (là mốc hành trình quan trọng)
      await send(
        `${isCall ? '📞' : '📝'} <b>${isCall ? 'CUỘC GỌI' : 'NOTE MỚI'}</b>${who ? ` — ${esc(ROLE[who.role] || ROLE[who.role_2] || '')} ${esc(who.full_name)}` : ''}` +
        line('Khách', `<b>${esc(k?.customer_name || '(chưa có tên)')}</b> ${esc(k?.phone || a.phone || '')}`) +
        (isCall ? line('Kết quả', esc(OUTCOME[a.outcome] || a.outcome)) : '') +
        line(isCall ? 'Nội dung' : 'Ghi chú', esc(content.length > 1500 ? content.slice(0, 1500) + '…' : content)) +
        line('Hẹn liên hệ lại', vnTime(a.next_at)) +
        line('Giai đoạn', esc(STATUS[k?.status] || k?.status)) +
        (media.length ? line('Ảnh / video', `${media.length} file (bên dưới)`) : ''));
      if (media.length) later(sendMedia(media.slice(0, 10), `📎 ${k?.customer_name || ''} ${k?.phone || ''}`.trim()));
      return new Response('ok');
    }
    return new Response('skip');
  } catch (e) {
    console.error('data-khach-telegram lỗi', (e as Error).message);
    return new Response('error', { status: 200 });
  }
});
