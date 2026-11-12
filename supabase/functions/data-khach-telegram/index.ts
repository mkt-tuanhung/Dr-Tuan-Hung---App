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

const CHAT_POSTOP = Deno.env.get('TELEGRAM_POSTOP_CHAT_ID') || '-5448812418';   // nhóm CHĂM SÓC HẬU PHẪU
const CHAT_CSKH = Deno.env.get('TELEGRAM_CSKH_CHAT_ID') || '-5461485486';       // nhóm CHĂM SÓC KHÁCH HÀNG
async function send(text: string, chat: string = CHAT) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
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

// ===== (4) HẬU PHẪU: mốc đến hạn / quá hạn mỗi sáng 8:00 · (5) bàn giao Điều dưỡng -> CSKH =====
const DEFAULT_PLAN = [{ key: 'd0', off: 0, label: 'Ngày phẫu thuật' }, { key: 'd1', off: 1, label: 'Ngày 1' }, { key: 'd2', off: 2, label: 'Ngày 2' },
  { key: 'd7', off: 7, label: 'Ngày 7' }, { key: 'd14', off: 14, label: 'Ngày 14' }, { key: 'd30', off: 30, label: 'Ngày 30' }];
const LEGACY_CUTOFF = '2026-10-13';
async function postopDaily() {
  const vn = new Date(Date.now() + 7 * 3600_000);
  const today = vn.toISOString().slice(0, 10);
  const { data: tpls } = await db.from('care_templates').select('service_group, milestones, status').eq('status', 'approved');
  const tplFor = (g: string | null) => (tpls || []).find((t: any) => t.service_group && t.service_group === g)?.milestones || (tpls || []).find((t: any) => !t.service_group)?.milestones || DEFAULT_PLAN;
  const { data: apps } = await db.from('customer_appointments')
    .select('id, customer_name, phone, service, service_group, surgery_date, care_plan, care_milestones, handover_status, post_op_status, warning_signs, hau_phau:profiles!hau_phau_id(full_name)')
    .eq('status', 'phau_thuat').gte('surgery_date', LEGACY_CUTOFF).lte('surgery_date', today).limit(1000);
  const byNurse: Record<string, string[]> = {};
  let overdueN = 0, dueN = 0, waitHand = 0, waitCskh = 0;
  for (const a of (apps || []) as any[]) {
    if (a.handover_status === 'da_nhan') continue;
    if (a.handover_status === 'cho_nhan') { waitCskh++; continue; }
    const plan: any[] = Array.isArray(a.care_plan) && a.care_plan.length ? a.care_plan : tplFor(a.service_group);
    const done = new Set((Array.isArray(a.care_milestones) ? a.care_milestones : []).filter((m: any) => m?.done).map((m: any) => m.key));
    const surg = Date.parse(String(a.surgery_date).slice(0, 10) + 'T00:00:00Z');
    const items: string[] = [];
    for (const m of plan) {
      if (!m || Number(m.off) <= 0 || done.has(m.key)) continue;
      const d = new Date(surg + Number(m.off) * 86400000).toISOString().slice(0, 10);
      if (d === today) { items.push(`🟡 ${esc(m.label)} (hôm nay)`); dueN++; }
      else if (d < today) { items.push(`🔴 ${esc(m.label)} — quá hạn ${Math.round((Date.parse(today) - Date.parse(d)) / 86400000)} ngày`); overdueN++; }
    }
    const lastOff = Math.max(...plan.map((m: any) => Number(m.off) || 0));
    if (new Date(surg + lastOff * 86400000).toISOString().slice(0, 10) <= today) { items.push('📋 Tới mốc cuối — cần bàn giao CSKH'); waitHand++; }
    if (!items.length) continue;
    const nurse = a.hau_phau?.full_name || 'Chưa phân công';
    (byNurse[nurse] = byNurse[nurse] || []).push(`• <b>${esc(a.customer_name)}</b> ${esc(a.phone || '')}${(a.warning_signs || []).length || a.post_op_status === 'Có biến chứng' ? ' ⚠️' : ''}: ${items.join('; ')}`);
  }
  if (!Object.keys(byNurse).length && !waitCskh) return { ok: true, empty: true };
  let text = `🩺 <b>VIỆC HẬU PHẪU HÔM NAY ${today.slice(8, 10)}/${today.slice(5, 7)}</b>\n🔴 Quá hạn: ${overdueN} · 🟡 Đến hạn: ${dueN} · 📋 Chờ bàn giao: ${waitHand} · 🤝 Chờ CSKH nhận: ${waitCskh}`;
  for (const [n, list] of Object.entries(byNurse)) text += `\n\n👩‍⚕️ <b>${esc(n)}</b>\n${list.slice(0, 30).join('\n')}`;
  text += `\n\n👉 App → Hậu phẫu → mở khách → bấm mốc để đánh dấu hoàn thành.`;
  await send(text.slice(0, 4000), CHAT_POSTOP);
  return { ok: true, overdueN, dueN, waitHand, waitCskh };
}
async function handoverNotify(id: string) {
  const { data: a } = await db.from('customer_appointments')
    .select('customer_name, phone, service, surgery_date, handover_status, handover_summary, handover_override, handover_nurse_at, handover_cskh_at, nurse:profiles!handover_nurse_by(full_name), cskh:profiles!handover_cskh_by(full_name)')
    .eq('id', id).maybeSingle();
  if (!a) return { ok: false };
  const x: any = a;
  if (x.handover_status === 'cho_nhan') {
    await send(`📋 <b>BÀN GIAO KHÁCH SANG CSKH</b>` + line('Khách', `<b>${esc(x.customer_name)}</b> ${esc(x.phone || '')}`) + line('Dịch vụ', esc(x.service)) +
      line('Ngày mổ', String(x.surgery_date || '').slice(0, 10).split('-').reverse().join('/')) + line('Điều dưỡng giao', esc(x.nurse?.full_name)) +
      line('Tóm tắt', esc(String(x.handover_summary || '').slice(0, 1200))) + (x.handover_override ? line('⚠️ Bàn giao ngoại lệ', esc(x.handover_override)) : '') +
      `\n👉 CSKH vào app → Hậu phẫu → tab CSKH → ký nhận.`, CHAT_CSKH);
  } else if (x.handover_status === 'da_nhan') {
    await send(`✅ <b>CSKH ĐÃ NHẬN BÀN GIAO</b>` + line('Khách', `<b>${esc(x.customer_name)}</b>`) + line('CSKH nhận', esc(x.cskh?.full_name)) + line('Lúc', vnTime(x.handover_cskh_at)), CHAT_POSTOP);
  }
  return { ok: true };
}

// ===== (1) THỜI HẠN GỌI LEAD MỚI 15' (cron mỗi 2 phút): nhắc còn 5 phút + báo QUÁ HẠN =====
async function slaCheck() {
  const now = Date.now();
  const { data } = await db.from('marketing_data')
    .select('id, customer_name, phone, source, description, sla_due_at, sla_warned_at, sla_breached_at, status, telesale:profiles!telesale_id(full_name)')
    .is('first_contact_at', null).not('sla_due_at', 'is', null)
    .gte('sla_due_at', new Date(now - 6 * 3600_000).toISOString()).lte('sla_due_at', new Date(now + 5 * 60_000).toISOString())
    .not('status', 'in', '(mat,da_lam_dv)').limit(200);
  let warned = 0, breached = 0;
  for (const k of data || []) {
    const due = new Date(k.sla_due_at).getTime();
    const who = (k as any).telesale?.full_name || 'Telesale';
    if (due <= now && !k.sla_breached_at) {
      await send(`🚨 <b>QUÁ 15 PHÚT CHƯA GỌI KHÁCH MỚI</b>` + line('Khách', `<b>${esc(k.customer_name || '(chưa có tên)')}</b> ${esc(k.phone)}`) +
        line('Nguồn', esc(k.source)) + line('Nhu cầu', esc(String(k.description || '').slice(0, 200))) +
        line('Phụ trách', esc(who)) + line('Hạn gọi', vnTime(k.sla_due_at)) + `\n👉 ${esc(who)} gọi / note ngay. Quản lý theo dõi.`);
      await db.from('marketing_data').update({ sla_breached_at: new Date().toISOString(), sla_warned_at: k.sla_warned_at || new Date().toISOString() }).eq('id', k.id);
      breached++;
    } else if (due > now && due - now <= 5 * 60_000 && !k.sla_warned_at) {
      await send(`⏱ <b>Còn ${Math.max(1, Math.round((due - now) / 60000))} phút phải gọi khách mới</b>` + line('Khách', `<b>${esc(k.customer_name || '(chưa có tên)')}</b> ${esc(k.phone)}`) +
        line('Phụ trách', esc(who)));
      await db.from('marketing_data').update({ sla_warned_at: new Date().toISOString() }).eq('id', k.id);
      warned++;
    }
  }
  return { ok: true, warned, breached };
}

// ===== (3) NHẮC LỊCH HẸN NGÀY MAI (cron 18:00 VN) =====
async function apptRemind() {
  const vn = new Date(Date.now() + 7 * 3600_000);
  const tomorrow = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) + 86400000).toISOString().slice(0, 10);
  const { data } = await db.from('customer_appointments')
    .select('customer_name, phone, appointment_time, service, confirmed_at, telesale:profiles!telesale_id(full_name), sale:profiles!sale_id(full_name)')
    .eq('appointment_date', tomorrow).eq('status', 'scheduled').order('appointment_time', { ascending: true }).limit(100);
  const list = (data || []).filter((a: any) => !String(a.service || '').startsWith('[Tái khám]'));
  if (!list.length) return { ok: true, n: 0 };
  const notConf = list.filter((a: any) => !a.confirmed_at).length;
  const dd = `${tomorrow.slice(8, 10)}/${tomorrow.slice(5, 7)}`;
  const rows = list.map((a: any, i: number) => `\n${i + 1}. ${a.confirmed_at ? '✅' : '⚪️'} ${String(a.appointment_time || '').slice(0, 5)} · <b>${esc(a.customer_name)}</b> ${esc(a.phone)} · ${esc(String(a.service || '').slice(0, 40))}${a.telesale?.full_name ? ' · Tele: ' + esc(a.telesale.full_name) : ''}`).join('');
  await send(`📅 <b>LỊCH HẸN NGÀY MAI ${dd}: ${list.length} khách</b> — chưa xác nhận: <b>${notConf}</b>${rows}\n\n👉 Telesale gọi xác nhận, bấm <b>Xác nhận lịch</b> trong app (✅ đã xác nhận · ⚪️ chưa).`);
  return { ok: true, n: list.length, notConf };
}

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
    .gte('created_at', from).lt('created_at', to).not('created_by', 'is', null).neq('type', 'exchange').order('created_at', { ascending: true }).limit(5000);
  const [n1, n2] = await Promise.all([
    db.from('marketing_data').select('id, customer_name, phone, source, status').gte('getfly_created_at', from).lt('getfly_created_at', to).limit(3000),
    db.from('marketing_data').select('id, customer_name, phone, source, status').is('getfly_created_at', null).gte('created_at', from).lt('created_at', to).limit(3000),
  ]);
  const newRows: any[] = [...(n1.data || []), ...(n2.data || [])];
  const newIds = new Set(newRows.map(r => r.id));
  const { count: apptCount } = await db.from('customer_appointments').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to);
  // (1) SLA 15' của số mới trong ngày · (3) khách đến / không đến · (2) lý do mất
  const { data: slaRows } = await db.from('marketing_data').select('created_at, sla_due_at, first_contact_at').gte('created_at', from).lt('created_at', to).not('sla_due_at', 'is', null).limit(3000);
  const slaOn = (slaRows || []).filter((r: any) => r.first_contact_at && new Date(r.first_contact_at) <= new Date(r.sla_due_at)).length;
  const resp = (slaRows || []).filter((r: any) => r.first_contact_at).map((r: any) => (new Date(r.first_contact_at).getTime() - new Date(r.created_at).getTime()) / 60000);
  const { data: dayAppts } = await db.from('customer_appointments').select('service, status, consult_received, no_show_at').eq('appointment_date', day).limit(500);
  const mainAppts = (dayAppts || []).filter((a: any) => !String(a.service || '').startsWith('[Tái khám]'));
  const cameN = mainAppts.filter((a: any) => a.consult_received || ['coc', 'phau_thuat', 'bong'].includes(a.status)).length;
  const noShowN = mainAppts.filter((a: any) => a.no_show_at).length;
  const { data: lostH } = await db.from('marketing_stage_history').select('reason').in('to_status', ['mat', 'chot_fail']).gte('changed_at', from).lt('changed_at', to).limit(500);
  const lostMap: Record<string, number> = {}; (lostH || []).forEach((h: any) => { const k = String(h.reason || 'Chưa ghi lý do').split(' — ')[0]; lostMap[k] = (lostMap[k] || 0) + 1; });

  const A: any[] = acts || [];
  // GỌI / LIÊN HỆ = mọi lần nhân viên ghi cuộc gọi HOẶC note khách (anh Dũng: note thông tin cũng là đã gọi)
  const calls = A;
  const callIds = new Set(calls.map(a => a.data_id));
  const withOutcome = A.filter(a => a.type === 'call' && a.outcome);
  const cares = A.filter(a => a.type === 'care');
  const isNewK = (a: any) => newIds.has(a.data_id) || vnDay(a.khach?.getfly_created_at || a.khach?.created_at) === day;
  const callRows = calls.map(a => ({
    name: a.khach?.customer_name || '—', phone: maskPhone(a.khach?.phone || a.phone), time: a.created_at,
    content: String(a.type === 'call' ? `${OUTCOME[a.outcome] || 'Gọi'}${a.content ? ' — ' + a.content : ''}` : `Note${a.content ? ' — ' + a.content : ''}`).slice(0, 300),
    author: a.author?.full_name || null, is_new: isNewK(a), status_label: STATUS[a.khach?.status] || null, status_color: STATUS_COLORS[a.khach?.status] || null,
  }));
  const callsNew = callRows.filter(c => c.is_new), callsOld = callRows.filter(c => !c.is_new);
  const newCalled = newRows.filter(r => callIds.has(r.id));
  // trạng thái khách trong ngày (có cuộc gọi hoặc số mới)
  const st: Record<string, number> = {};
  const seen = new Set<string>();
  calls.forEach(a => { if (a.data_id && !seen.has(a.data_id)) { seen.add(a.data_id); const k = a.khach?.status || 'tiep_can'; st[k] = (st[k] || 0) + 1; } });
  newRows.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); const k = r.status || 'tiep_can'; st[k] = (st[k] || 0) + 1; } });
  const byOutcome: Record<string, number> = {}; withOutcome.forEach(c => { byOutcome[c.outcome] = (byOutcome[c.outcome] || 0) + 1; });
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
    line('📞 Gọi / note khách', `${calls.length} lượt — khách mới ${callsNew.length} · khách cũ ${callsOld.length}`) +
    line('👥 Số khách đã liên hệ', String(callIds.size)) +
    (withOutcome.length ? line('✅ Nghe máy', `${(byOutcome.nghe_may || 0) + (byOutcome.hen_goi_lai || 0) + (byOutcome.can_nhac || 0)}/${withOutcome.length} lượt có chọn kết quả${pct((byOutcome.nghe_may || 0) + (byOutcome.hen_goi_lai || 0) + (byOutcome.can_nhac || 0), withOutcome.length)}`) : '') +
    line('🆕 Số mới về', `${newRows.length} — đã gọi/note ${newCalled.length} · chưa ${newRows.length - newCalled.length}`) +
    line('⏰ Hẹn gọi lại', String(payload.stats.next_cnt)) +
    line('📅 Lịch hẹn mới tạo', String(apptCount || 0)) +
    ((slaRows || []).length ? line('⏱ Gọi số mới đúng hạn 15\'', `${slaOn}/${slaRows!.length}${pct(slaOn, slaRows!.length)}${resp.length ? ' · phản hồi TB ' + Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) + ' phút' : ''}`) : '') +
    (mainAppts.length ? line('🙋 Lịch hẹn trong ngày', `${mainAppts.length} — đến ${cameN}${pct(cameN, mainAppts.length)} · không đến ${noShowN}`) : '') +
    (Object.keys(lostMap).length ? line('📉 Mất / Chốt Fail', Object.entries(lostMap).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')) : '') +
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
    if (body.mode === 'postop_daily') { const r = await postopDaily(); return new Response(JSON.stringify(r)); }
    if (body.table === 'handover' && body.id) { const r = await handoverNotify(String(body.id)); return new Response(JSON.stringify(r)); }
    if (body.mode === 'sla') { const r = await slaCheck(); return new Response(JSON.stringify(r)); }
    if (body.mode === 'appt_remind') { const r = await apptRemind(); return new Response(JSON.stringify(r)); }
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
      if (!a || a.type === 'exchange') return new Response('skip');   // trao đổi nội bộ: chỉ báo người được tag trong app
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
