// ============================================================
// media-telegram: gửi thông báo về NHÓM TELEGRAM MEDIA
// MỌI thay đổi, mỗi thay đổi 1 câu "<Vai trò> <Tên> đã …":
//   - Marketing Workspace: order mới, chuyển trạng thái (cột), giao việc, bình luận / @nhắc tên, chat, checklist,
//     tệp, trạng thái nội dung, duyệt, xuất bản…
//   - Clip: up mới, Ads duyệt / cần sửa / hoàn tất, duyệt chạy, Đang chạy / Tạm dừng, trạng thái Facebook, đăng bài, Win, điểm
//   - Kho Media: source mới, đổi trạng thái source, file mới
// Trigger trong DB chỉ ghi hàng đợi public.media_tg_outbox (supabase/media_telegram_notify.sql);
// cron 'media-tg-1min' gọi hàm này mỗi phút KHI có tin chờ. Tin cùng thẻ / cùng source trong 1 lượt gom thành 1 tin.
// Mỗi tin có nút "🔎 Xem chi tiết" mở app đúng mục (/?tab=…&focus=…).
//
// Deploy: Verify JWT = ON (cron gọi bằng anon key). Secrets: TELEGRAM_BOT_TOKEN (đã có);
//         APP_URL (không bắt buộc — mặc định link Vercel của app).
// Nhóm: clinic_settings.media_tg_chat_id (dự phòng: secret TELEGRAM_MEDIA_CHAT_ID).
// Gọi {test:true} -> gửi 1 tin thử vào nhóm.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const APP_URL = (Deno.env.get('APP_URL') || 'https://dr-tuan-hung-app-web-ujkb.vercel.app').replace(/\/$/, '');
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const MAX_MESSAGES = 15;   // tối đa tin / lượt (Telegram giới hạn ~20 tin/phút/nhóm) — phần dư gom thành 1 tin tổng hợp
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// @[Tên](staff:uuid) -> @Tên
const mentionIds = (s: unknown) => [...String(s ?? '').matchAll(/@\[[^\]]+\]\(staff:([0-9a-f-]{36})\)/gi)].map(m => m[1]);
// Văn bản 1 dòng, rút gọn, tên được @nhắc in đậm
const richText = (s: unknown, n: number) => esc(cut(String(s ?? '').replace(/@\[([^\]]+)\]\((?:staff|cust):[0-9a-f-]+\)/gi, '\u0001$1\u0002').replace(/\s+/g, ' ').trim(), n))
  .replace(/\u0001([^\u0002]*)\u0002?/g, '<b>@$1</b>');
const cleanName = (s: unknown) => String(s || '').replace(/^[\d.\-/\s]+/, '').trim() || String(s || '');
const link = (tab: string, focus?: string | null) => `${APP_URL}/?tab=${encodeURIComponent(tab)}${focus ? `&focus=${encodeURIComponent(focus)}` : ''}`;
// Tin quá dài (Telegram tối đa 4096 ký tự): cắt theo DÒNG để không vỡ thẻ HTML
const fitHtml = (t: string) => {
  if (t.length <= 4000) return t;
  const head = t.slice(0, 3900);
  return head.slice(0, Math.max(0, head.lastIndexOf('\n'))) + '\n… (còn nữa — mở app để xem)';
};
const isHttps = (u: unknown) => typeof u === 'string' && /^https:\/\/\S+$/.test(u);
const vnTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};
const vnDate = (ymd?: string | null) => { if (!ymd) return ''; const [y, m, d] = String(ymd).slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}/${y}`; };

const FIELD: Record<string, string> = { title: 'tên thẻ', description: 'mô tả', priority: 'ưu tiên', start_at: 'ngày bắt đầu', due_at: 'hạn', cover_color: 'màu bìa', estimate_hours: 'ước lượng giờ', location: 'địa điểm' };
const PRIORITY: Record<string, string> = { low: 'Thấp', normal: 'Thường', high: 'Cao', urgent: 'Gấp' };
const STEP: Record<string, string> = { medical: 'Y khoa', marketing: 'Marketing', compliance: 'Pháp lý', publisher: 'Người đăng' };
const VKIND: Record<string, string> = { script: 'kịch bản', asset: 'tệp dựng', caption: 'caption' };
const SOURCE_TYPE: Record<string, string> = { truoc_pt: 'Trước PT', sau_pt: 'Sau PT', beauty: 'Beauty', feedback: 'Feedback', tai_kham: 'Tái khám' };
// Nhãn trạng thái — khớp app (ContentProductionPage, mwMeta)
const ROLE: Record<string, string> = { telesale: 'Telesale', sale_offline: 'Sale', cskh: 'CSKH', truc_page: 'Trực page', media: 'Media', marketing: 'Marketing', editor: 'Editor', seeding: 'Seeding', dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin', bac_si: 'Bác sĩ', designer: 'Designer' };
const SRC_STATUS: Record<string, string> = { chua_dung: 'Chưa dựng', dang_dung: 'Đang dựng', da_dung: 'Đã dựng', loi: 'Source lỗi', can_bo_sung: 'Cần bổ sung' };
const STAGE: Record<string, string> = { submitted: 'Chờ Ads duyệt', revision: 'Cần sửa', approved: 'Đã duyệt', done: 'Hoàn tất' };
const AD_STATUS: Record<string, string> = { dang_chay: 'Đang chạy', tam_dung: 'Tạm dừng', chua_chay: 'Chưa chạy' };
const AUTO_STATUS: Record<string, string> = { queued: 'Chờ tạo chiến dịch', created: 'Đã tạo chiến dịch', failed: 'Tạo chiến dịch lỗi' };
const POST_STATUS: Record<string, string> = { queued: 'Chờ đăng', posted: 'Đã đăng', failed: 'Đăng lỗi' };
const RESULT: Record<string, string> = { tot: 'Tốt', trung_binh: 'Trung bình', kem: 'Kém' };
const FB_REVIEW = ['IN_PROCESS', 'PENDING_REVIEW', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'WITH_ISSUES'];
const fbLabel = (v: unknown) => (!v ? 'Chưa có' : v === 'ACTIVE' ? 'Đang chạy' : FB_REVIEW.includes(String(v)) ? 'Đang duyệt' : v === 'PAUSED' || v === 'CAMPAIGN_PAUSED' || v === 'ADSET_PAUSED' ? 'Tạm dừng' : `Đã tắt (${String(v)})`);
const CONTENT_STATUS: Record<string, string> = { idea: 'Ý tưởng', brief: 'Brief', scripting: 'Viết kịch bản', production: 'Sản xuất', editing: 'Dựng / chỉnh sửa', in_review: 'Đang duyệt', revision_required: 'Cần sửa', rejected: 'Bị từ chối', approved: 'Đã duyệt', published: 'Đã đăng', archived: 'Lưu trữ' };
const lbl = (m: Record<string, string>, v: unknown) => (v == null || v === '' ? 'Chưa có' : m[String(v)] || String(v));

type Row = { id: number; kind: string; group_key: string | null; actor_id: string | null; payload: any; created_at: string };
type Msg = { rows: Row[]; text: string; buttons: { text: string; url: string }[] };

async function tg(chatId: string, text: string, buttons: { text: string; url: string }[]) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text: fitHtml(text), parse_mode: 'HTML', disable_web_page_preview: true,
      ...(buttons.length ? { reply_markup: { inline_keyboard: [buttons.slice(0, 2)] } } : {}),
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d?.ok) throw Object.assign(new Error(d?.description || `Telegram HTTP ${r.status}`), { retryAfter: d?.parameters?.retry_after });
}

const byId = async (table: string, cols: string, ids: unknown[]) => {
  const list = [...new Set(ids.filter(Boolean).map(String))];
  if (!list.length) return new Map<string, any>();
  const out = new Map<string, any>();
  for (let i = 0; i < list.length; i += 200) {
    const { data, error } = await db.from(table).select(cols).in('id', list.slice(i, i + 200));
    if (error) console.error(table, error.message);
    for (const r of data || []) out.set(String((r as any).id), r);
  }
  return out;
};
const groupBy = (rows: Row[], key: (r: Row) => string) => {
  const m = new Map<string, Row[]>();
  for (const r of rows) { const k = key(r); m.set(k, [...(m.get(k) || []), r]); }
  return m;
};

// ================= Dựng tin =================
// Mỗi thay đổi = 1 câu: "<Vai trò> <Tên> đã …" (VD: Content Ngoan đã tạo yêu cầu order mới: …)
async function build(rows: Row[]): Promise<Msg[]> {
  const P = (...k: string[]) => rows.filter(r => k.includes(r.kind));
  const mw = P('mw'), chat = P('mw_chat');
  const clipRows = P('clip_new', 'clip_status', 'clip_approved', 'clip_running');
  const khoRows = P('kho_source', 'kho_status', 'kho_file');

  // ---- nạp dữ liệu 1 lần ----
  const commentIds = mw.filter(r => r.payload.entity === 'comment' && r.payload.action === 'created').map(r => r.payload.entity_id);
  const comments = await byId('mw_comments', 'id, body, deleted_at', commentIds);
  const tasks = await byId('mw_tasks', '*', mw.map(r => r.payload.task_id));
  const boards = await byId('mw_boards', 'id, name, workspace_id', [...tasks.values()].map(t => t.board_id));
  const lists = await byId('mw_lists', 'id, name', [...tasks.values()].map(t => t.list_id));
  const wss = await byId('mw_workspaces', 'id, name', [...mw, ...chat].map(r => r.payload.workspace_id));
  const labels = await byId('mw_labels', 'id, name', mw.filter(r => r.payload.entity === 'label').map(r => r.payload.entity_id));
  const contents = await byId('mw_contents', 'id, title', mw.map(r => r.payload.detail?.content_id));
  const assignees = new Map<string, string[]>();
  if (tasks.size) {
    const { data } = await db.from('mw_task_assignees').select('task_id, user_id').in('task_id', [...tasks.keys()]);
    for (const a of data || []) assignees.set(a.task_id, [...(assignees.get(a.task_id) || []), a.user_id]);
  }
  const clips = await byId('media_clips', '*', clipRows.map(r => r.payload.clip_id));
  const sources = await byId('media_customers', '*', [...khoRows.map(r => r.payload.source_id), ...[...clips.values()].map(c => c.media_customer_id)]);
  const people = await byId('profiles', 'id, full_name, role, position', [
    ...rows.map(r => r.actor_id),
    ...mw.filter(r => ['assignee', 'member'].includes(r.payload.entity)).map(r => r.payload.entity_id),
    ...[...assignees.values()].flat(),
    ...[...comments.values()].flatMap(c => mentionIds(c.body)),
    ...chat.flatMap(r => mentionIds(r.payload.body)),
    ...[...clips.values()].flatMap(c => [c.editor_id, c.ads_id]),
    ...[...sources.values()].map(s => s.media_id),
  ]);
  const name = (id?: string | null) => (id ? people.get(id)?.full_name || 'Nhân sự' : '');
  // "Editor Vũ Minh Sỹ" — chức danh (position) nếu có, không thì vai trò
  const who = (id?: string | null, fallback = 'Hệ thống') => {
    const p = id ? people.get(id) : null;
    if (!p) return `<b>${fallback}</b>`;
    const pos = String(p.position || '').trim();
    const role = pos && pos.length <= 20 && !/outsource/i.test(pos) ? pos : ROLE[String(p.role)] || '';
    return `<b>${esc([role, p.full_name].filter(Boolean).join(' '))}</b>`;
  };
  const B = (s: unknown) => `<b>${esc(s)}</b>`;
  const msgs: Msg[] = [];

  // ---- Marketing Workspace: gom theo thẻ (hoặc theo workspace + loại) ----
  for (const [, g] of groupBy(mw, r => r.group_key || String(r.id))) {
    const p0 = g[0].payload;
    const ws = wss.get(p0.workspace_id);
    const t = p0.task_id ? tasks.get(p0.task_id) : null;
    const T = B(t?.title || g.find(r => r.payload.detail?.title)?.payload.detail.title || 'thẻ');
    const mentioned = new Set<string>();
    let isNew = false;
    const lines = g.map(r => {
      const p = r.payload, d = p.detail || {};
      const A = p.auto ? '<b>Automation (tự động)</b>' : who(r.actor_id);
      switch (`${p.entity}.${p.action}`) {
        case 'task.created': isNew = true; return `🆕 ${A} đã tạo yêu cầu order mới: ${B(d.title)}`;
        case 'task.moved': return `🔄 ${A} đã chuyển trạng thái ${T} từ ${esc(d.from || '?')} thành ${B(d.to || '?')}`;
        case 'task.archived': return `🗄 ${A} đã lưu trữ ${T}`;
        case 'task.restored': return `♻️ ${A} đã khôi phục ${T}`;
        case 'task.updated': return `✏️ ${A} đã sửa ${(d.fields || []).map((f: string) => FIELD[f] || f).join(', ')} của ${T}${d.due_at ? ` → ${vnTime(d.due_at)}` : ''}`;
        case 'assignee.added': mentioned.add(p.entity_id); return `👤 ${A} đã giao ${T} cho ${B(name(p.entity_id))}`;
        case 'assignee.removed': return `👤 ${A} đã bỏ giao ${T} cho ${esc(name(p.entity_id))}`;
        case 'label.added': return `🏷 ${A} đã gắn nhãn “${esc(labels.get(p.entity_id)?.name || '')}” cho ${T}`;
        case 'label.removed': return `🏷 ${A} đã gỡ nhãn “${esc(labels.get(p.entity_id)?.name || '')}” khỏi ${T}`;
        case 'checklist.added': return `☑️ ${A} đã thêm việc “${esc(d.title)}” vào ${T}`;
        case 'checklist.checked': return `✅ ${A} đã hoàn thành “${esc(d.title)}” trong ${T}`;
        case 'checklist.unchecked': return `↩️ ${A} đã bỏ hoàn thành “${esc(d.title)}” trong ${T}`;
        case 'checklist.updated': return `☑️ ${A} đã sửa việc “${esc(d.title)}” trong ${T}`;
        case 'comment.created': {
          const c = comments.get(p.entity_id);
          mentionIds(c?.body).forEach(id => mentioned.add(id));
          return `💬 ${A} đã bình luận ở ${T}${c && !c.deleted_at ? `: “${richText(c.body, 300)}”` : ''}`;
        }
        case 'comment.edited': return `💬 ${A} đã sửa bình luận ở ${T}`;
        case 'comment.deleted': return `💬 ${A} đã xoá bình luận ở ${T}`;
        case 'attachment.added': return `📎 ${A} đã đính kèm “${esc(d.name)}” vào ${T}`;
        case 'attachment.removed': return `📎 ${A} đã gỡ tệp “${esc(d.name)}” khỏi ${T}`;
        case 'source.added': return `🎞 ${A} đã gắn source Kho ${B(d.code || '')} vào ${T}`;
        case 'source.removed': return `🎞 ${A} đã gỡ source Kho khỏi ${T}`;
        case 'kho.source_status': return null;   // đã báo ở tin trạng thái source Kho
        case 'content.status': return `🎬 ${A} đã chuyển trạng thái nội dung ${B(d.title)} từ ${esc(lbl(CONTENT_STATUS, d.from))} thành ${B(lbl(CONTENT_STATUS, d.to))}`;
        case 'workspace.created': return `🗂 ${A} đã tạo workspace ${B(d.name)}`;
        case 'board.created': return `🗂 ${A} đã tạo board ${B(d.name)}`;
        case 'member.insert': mentioned.add(p.entity_id); return `👥 ${A} đã thêm thành viên ${B(name(p.entity_id))}`;
        case 'member.update': return `👥 ${A} đã đổi vai trò của ${esc(name(p.entity_id))}`;
        case 'member.delete': return `👥 ${A} đã gỡ thành viên ${esc(name(p.entity_id))}`;
        case 'content_version.created': return `🆙 ${A} đã thêm ${VKIND[d.kind] || esc(d.kind)} v${esc(d.revision)} cho ${B(contents.get(d.content_id)?.title || '')}${d.invalidated_runs ? ' — duyệt cũ mất hiệu lực' : ''}`;
        case 'consent.created': return `📄 ${A} đã thêm hồ sơ consent`;
        case 'consent.revoked': return `⚠️ ${A} đã thu hồi consent`;
        case 'consent.verified': return `📄 ${A} đã xác minh consent`;
        case 'consent.updated': return `📄 ${A} đã cập nhật consent`;
        case 'approval.submitted': return `🛡️ ${A} đã gửi duyệt ${B(contents.get(d.content_id)?.title || '')}`;
        case 'approval_step.approve': return `✅ ${A} đã duyệt bước ${STEP[d.kind] || esc(d.kind)}`;
        case 'approval_step.revision': return `✏️ ${A} đã yêu cầu sửa (${STEP[d.kind] || esc(d.kind)}): ${esc(cut(d.note || '', 200))}`;
        case 'approval_step.reject': return `⛔ ${A} đã từ chối (${STEP[d.kind] || esc(d.kind)}): ${esc(cut(d.note || '', 200))}`;
        case 'publication.scheduled': return `📅 ${A} đã lên lịch đăng ${vnTime(d.at)}`;
        case 'publication.blocked': return `⛔ Bài đăng bị chặn: ${esc(d.reason)}`;
        case 'publication.proof_submitted': return `🔗 ${A} đã nộp link bằng chứng đã đăng`;
        case 'publication.verified': return `✅ ${A} đã xác minh bài đã đăng`;
        case 'publication.verification_failed': return `⚠️ ${A} đã đánh dấu xác minh không đạt: ${esc(d.note)}`;
        case 'publication.cancelled': return `🚫 ${A} đã huỷ bài đăng`;
        default: return `• ${A} ${esc(p.entity)} · ${esc(p.action)}`;
      }
    }).filter(Boolean) as string[];
    if (!lines.length) continue;
    const where = esc(ws?.name || '');
    const shown = [...lines.slice(0, 20), lines.length > 20 ? `… và ${lines.length - 20} thay đổi khác` : ''].filter(Boolean);
    if (t) {
      const b = boards.get(t.board_id);
      const ass = (assignees.get(t.id) || []).map(name);
      const info = [
        `🗂 ${where}${b ? ` › ${esc(b.name)}` : ''}${lists.get(t.list_id) ? ` › Trạng thái: <b>${esc(lists.get(t.list_id).name)}</b>` : ''}`,
        ass.length ? `👤 Thực hiện: ${ass.map(esc).join(', ')}` : '',
        t.due_at ? `⏰ Hạn: ${vnTime(t.due_at)}` : '',
        t.priority && t.priority !== 'normal' ? `⚡ Ưu tiên: ${PRIORITY[t.priority] || esc(t.priority)}` : '',
        isNew && t.description ? `📝 ${richText(t.description, 400)}` : '',
        mentioned.size ? `🔔 Nhắc / giao: ${[...mentioned].map(id => B(name(id))).join(', ')}` : '',
      ].filter(Boolean);
      msgs.push({ rows: g, text: [...shown, '', ...info].join('\n'), buttons: [{ text: '🔎 Xem chi tiết', url: link('mkt_workspace', `task:${t.id}`) }] });
    } else {
      const d = p0.detail || {};
      const focus = p0.entity === 'approval' ? `approval:${p0.entity_id}` : p0.entity === 'approval_step' && d.run_id ? `approval:${d.run_id}`
        : d.content_id ? `content:${d.content_id}` : p0.entity === 'publication' ? `ws:${p0.workspace_id}:publishing` : `ws:${p0.workspace_id}`;
      msgs.push({ rows: g, text: [...shown, '', `🗂 ${where}`].join('\n'), buttons: [{ text: '🔎 Xem chi tiết', url: link('mkt_workspace', focus) }] });
    }
  }

  // ---- Chat workspace ----
  for (const [wsId, g] of groupBy(chat, r => r.payload.workspace_id)) {
    const ment = new Set(g.flatMap(r => mentionIds(r.payload.body)));
    msgs.push({ rows: g, text: [
      ...g.slice(-15).map(r => `💬 ${who(r.actor_id)} đã nhắn trong chat ${B(wss.get(wsId)?.name || '')}: “${richText(r.payload.body, 300)}”`),
      ment.size ? `\n🔔 Nhắc: ${[...ment].map(id => B(name(id))).join(', ')}` : '',
    ].filter(Boolean).join('\n'), buttons: [{ text: '💬 Mở chat', url: link('mkt_workspace', `chat:${wsId}`) }] });
  }

  // ---- Clip: up mới + mọi thay đổi trạng thái, gom theo clip ----
  const srcName = (s: any) => (s ? esc(s.source_id || cleanName(s.customer_name)) : '');
  const srcLine = (s: any) => (s ? `🎞 Source: <b>${srcName(s)}</b>${s.source_id && s.customer_name ? ` — ${esc(cleanName(s.customer_name))}` : ''}${s.service ? ` · ${esc(s.service)}` : ''}` : '');
  for (const [, g] of groupBy(clipRows, r => String(r.payload.clip_id))) {
    const c = clips.get(String(g[0].payload.clip_id));
    if (!c) continue;
    const s = sources.get(c.media_customer_id);
    const meta = [c.video_version, c.video_format, c.platform, c.video_goal].filter(Boolean).map(esc).join(' · ');
    const C = `<b>${esc(c.title || 'clip')}</b>`;
    const lines = g.map(r => {
      const A = who(r.actor_id);
      if (r.kind === 'clip_new') return `🎬 ${who(r.actor_id || c.editor_id)} đã up clip mới: ${C}${meta ? ` (${meta})` : ''}`;
      if (r.kind === 'clip_approved') return `✅ ${A} đã duyệt clip ${C}`;
      if (r.kind === 'clip_running') return `🚀 Clip ${C} đã lên Ads`;
      const { field: f, from, to } = r.payload;
      switch (f) {
        case 'stage': return `🔄 ${A} đã chuyển trạng thái clip ${C} từ ${esc(lbl(STAGE, from))} thành ${B(lbl(STAGE, to))}`;
        case 'approved_to_run': return to ? `▶️ ${A} đã duyệt cho chạy Ads clip ${C}` : `⏸ ${A} đã bỏ duyệt chạy Ads clip ${C}`;
        case 'ad_status': return `🚀 ${A} đã chuyển trạng thái Ads của clip ${C} từ ${esc(lbl(AD_STATUS, from))} thành ${B(lbl(AD_STATUS, to))}`;
        case 'fb_status': return `📡 Facebook: chiến dịch của clip ${C} chuyển từ ${esc(fbLabel(from))} thành ${B(fbLabel(to))}`;
        case 'ads_auto_status': return `⚙️ Chiến dịch tự động của clip ${C}: ${B(lbl(AUTO_STATUS, to))}${to === 'failed' && c.ads_error ? ` — ${esc(cut(String(c.ads_error), 200))}` : ''}`;
        case 'post_status': return `📣 Đăng bài clip ${C}: ${B(lbl(POST_STATUS, to))}`;
        case 'result_status': return `📊 ${A} đã đánh giá kết quả clip ${C}: ${B(lbl(RESULT, to))}`;
        case 'win': return to === true ? `🏆 ${A} đã đánh dấu clip ${C} là ${B('WIN')}` : from === true ? `${A} đã bỏ WIN của clip ${C}` : null;
        case 'score': return to == null ? null : `⭐ ${A} đã chấm clip ${C}: ${B(`${to}/10`)}`;
        default: return `🔄 ${A} đã đổi ${esc(f)} của clip ${C}: ${esc(from)} → ${B(to)}`;
      }
    }).filter(Boolean) as string[];
    if (!lines.length) continue;
    const first = (c.clip_links || []).find(isHttps);
    const scored = g.some(r => ['score', 'win', 'stage', 'result_status'].includes(r.payload.field));
    msgs.push({ rows: g, text: [...lines, '', srcLine(s),
      `✂️ Editor: ${esc(name(c.editor_id) || '—')}${c.ads_id ? ` · Ads: ${esc(name(c.ads_id))}` : ''}`,
      `📌 Hiện tại: ${lbl(STAGE, c.stage)}${c.approved_to_run ? ' · đã duyệt chạy' : ''}${c.ad_status ? ` · Ads ${lbl(AD_STATUS, c.ad_status)}` : ''}${c.fb_status ? ` · FB ${fbLabel(c.fb_status)}` : ''}`,
      g.some(r => r.kind === 'clip_new') && c.editor_note ? `📝 ${richText(c.editor_note, 300)}` : '',
      scored && c.ads_feedback ? `💬 Ads góp ý: ${richText(c.ads_feedback, 300)}` : '',
    ].filter(Boolean).join('\n'), buttons: [{ text: '🔎 Xem chi tiết', url: link('content_video', c.id) }, ...(first ? [{ text: '▶️ Mở video', url: first }] : [])] });
  }

  // ---- Kho Media: source mới / đổi trạng thái source / file mới, gom theo source ----
  const fileSummary = (fs: Row[]) => {
    const v = fs.filter(f => f.payload.kind === 'video').length, i = fs.filter(f => f.payload.kind === 'image').length, o = fs.length - v - i;
    return [v && `${v} video`, i && `${i} ảnh`, o && `${o} tệp`].filter(Boolean).join(' · ');
  };
  const khoGroups = [...groupBy(khoRows, r => String(r.payload.source_id || 'none')).entries()];
  const fileOnly = khoGroups.filter(([, g]) => g.every(r => r.kind === 'kho_file'));
  const bulk = fileOnly.length > 6;   // quét Drive hàng loạt -> 1 tin tổng hợp
  for (const [sid, g] of khoGroups) {
    if (bulk && fileOnly.some(([k]) => k === sid)) continue;
    const s = sources.get(sid);
    const S = s ? `<b>${srcName(s)}</b>` : 'chưa gắn source';
    const fs = g.filter(r => r.kind === 'kho_file');
    const lines: string[] = [];
    let isNew = false;
    for (const r of g) {
      if (r.kind === 'kho_source') { isNew = true; lines.push(`📥 ${who(r.actor_id || s?.media_id)} đã thêm source mới vào Kho Media: ${S}`); }
      if (r.kind === 'kho_status') lines.push(`🔄 ${who(r.actor_id)} đã chuyển trạng thái source ${S} từ ${esc(lbl(SRC_STATUS, r.payload.from))} thành ${B(lbl(SRC_STATUS, r.payload.to))}`);
    }
    if (fs.length) {
      const actors = [...new Set(fs.map(f => f.actor_id))];
      lines.push(`📂 ${actors.length === 1 ? who(actors[0]) : '<b>Media</b>'} đã thêm ${fs.length} file mới vào source ${S} (${fileSummary(fs)})${isNew ? '' : ':'}`);
      if (!isNew) lines.push(...fs.slice(0, 5).map(f => `   • ${esc(cut(String(f.payload.name || ''), 80))}`), ...(fs.length > 5 ? [`   … và ${fs.length - 5} file khác`] : []));
    }
    if (!lines.length) continue;
    const drive = (s?.source_links || []).find(isHttps);
    const types = (s?.source_types || []).map((x: string) => SOURCE_TYPE[x] || x);
    const info = s ? [
      s.customer_name ? `👤 Khách: ${esc(cleanName(s.customer_name))}` : '',
      [s.service && `💉 ${esc(s.service)}`, s.shoot_date && `📅 Quay ${vnDate(s.shoot_date)}`].filter(Boolean).join(' · '),
      isNew ? `📸 Media: ${esc(name(s.media_id) || '—')}${s.media_in_charge ? ` (+ ${esc(s.media_in_charge)})` : ''}` : '',
      isNew && types.length ? `🏷 Loại: ${types.map(esc).join(', ')}` : '', isNew && (s.tags || []).length ? `#️⃣ ${(s.tags || []).map(esc).join(', ')}` : '',
      isNew && !fs.length && (s.source_video_count || s.source_image_count) ? `📂 ${s.source_video_count || 0} video · ${s.source_image_count || 0} ảnh` : '',
      `📌 Trạng thái: ${lbl(SRC_STATUS, s.source_status || 'chua_dung')}`,
      s.no_image ? '⛔ <b>KHÔNG ĐƯỢC SỬ DỤNG HÌNH ẢNH</b>' : '', s.hide_face ? '🙈 Phải che mặt' : '',
      isNew && s.note ? `📝 ${richText(s.note, 300)}` : '',
    ].filter(Boolean) : [];
    msgs.push({ rows: g, text: [...lines, ...(info.length ? ['', ...info] : [])].join('\n'),
      buttons: [{ text: '🔎 Xem trong Kho', url: link('content_kho', s ? s.id : null) }, ...(drive ? [{ text: '📂 Mở Drive', url: drive }] : [])] });
  }
  if (bulk) {
    const total = fileOnly.reduce((n, [, g]) => n + g.length, 0);
    msgs.push({ rows: fileOnly.flatMap(([, g]) => g), text: [`📂 <b>+${total} file mới vào Kho Media</b> (${fileOnly.length} source)`,
      ...fileOnly.slice(0, 15).map(([sid, g]) => `• ${sources.get(sid) ? srcName(sources.get(sid)) : 'chưa gắn source'}: ${fileSummary(g)}`),
      fileOnly.length > 15 ? `… và ${fileOnly.length - 15} source khác` : ''].filter(Boolean).join('\n'), buttons: [{ text: '🔎 Mở Kho Media', url: link('content_kho') }] });
  }
  return msgs;
}

// ================= Chạy =================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!TOKEN) return json({ error: 'Thiếu secret TELEGRAM_BOT_TOKEN' });
  const body = await req.json().catch(() => ({}));
  const { data: cfg } = await db.from('clinic_settings').select('media_tg_chat_id, media_tg_enabled').limit(1).maybeSingle();
  const chatId = cfg?.media_tg_chat_id || Deno.env.get('TELEGRAM_MEDIA_CHAT_ID') || '';
  if (!chatId) return json({ error: 'Chưa cấu hình clinic_settings.media_tg_chat_id' });

  if (body?.test) {   // tin thử: chỉ Admin
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user } } = await auth.auth.getUser();
    const { data: me } = user ? await db.from('profiles').select('role').eq('id', user.id).maybeSingle() : { data: null };
    if (String(me?.role || '') !== 'admin') return json({ error: 'Chỉ Admin gửi tin thử' }, 403);
    try { await tg(chatId, '✅ <b>Kết nối thành công</b>\nNhóm này sẽ nhận mọi thay đổi: Marketing Workspace, clip (up mới, duyệt, chạy Ads…) và Kho Media.', [{ text: '🔎 Mở app', url: link('mkt_workspace') }]); return json({ ok: true }); }
    catch (e) { return json({ error: (e as Error).message }); }
  }

  const { data: claimed, error } = await db.rpc('media_tg_claim', { p_limit: 300 });
  if (error) return json({ error: error.message });
  const rows = ((claimed || []) as Row[]).sort((a, b) => a.id - b.id);   // đúng thứ tự thời gian
  if (!rows.length) return json({ ok: true, sent: 0 });
  const ids = (rs: Row[]) => rs.map(r => r.id);
  const markSent = (rs: Row[], note: string | null = null) => db.from('media_tg_outbox').update({ sent_at: new Date().toISOString(), last_error: note }).in('id', ids(rs));
  const release = (rs: Row[], err: string) => db.from('media_tg_outbox').update({ claimed_at: null, last_error: cut(err, 500) }).in('id', ids(rs));

  if (cfg && cfg.media_tg_enabled === false) { await markSent(rows, 'tắt'); return json({ ok: true, skipped: rows.length }); }

  let msgs: Msg[];
  try { msgs = await build(rows); } catch (e) { await release(rows, (e as Error).message); return json({ error: (e as Error).message }); }
  // Tin không dựng được (bản ghi đã bị xoá…) -> bỏ qua
  const used = new Set(msgs.flatMap(m => ids(m.rows)));
  const orphan = rows.filter(r => !used.has(r.id));
  if (orphan.length) await markSent(orphan, 'bỏ qua: dữ liệu không còn');

  if (msgs.length > MAX_MESSAGES) {
    const rest = msgs.splice(MAX_MESSAGES - 1);
    msgs.push({ rows: rest.flatMap(m => m.rows), text: `📋 <b>Và ${rest.length} cập nhật khác</b>\n` + rest.slice(0, 25).map(m => '• ' + cut(m.text.split('\n')[0].replace(/<[^>]+>/g, ''), 200).replace(/&[a-z#0-9]*…$/i, '…')).join('\n'),
      buttons: [{ text: '🔎 Mở app', url: link('mkt_workspace') }] });
  }
  let sent = 0;
  for (const m of msgs) {
    try { await tg(chatId, m.text, m.buttons); await markSent(m.rows); sent++; }
    catch (e) {
      const err = e as Error & { retryAfter?: number };
      await release(m.rows, err.message);
      if (err.retryAfter) break;   // bị giới hạn tốc độ -> để lượt sau gửi tiếp
    }
    await new Promise(r => setTimeout(r, 350));
  }
  return json({ ok: true, sent, messages: msgs.length });
});
