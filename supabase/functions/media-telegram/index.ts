// ============================================================
// media-telegram: gửi thông báo về NHÓM TELEGRAM MEDIA
//   - Marketing Workspace: order mới, chuyển cột, giao việc, bình luận / @nhắc tên, chat, duyệt, xuất bản…
//   - Editor up clip mới · clip được duyệt · clip lên Ads
//   - Media thêm source / file mới vào Kho Media
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
const KHO: Record<string, string> = { dang_dung: 'Đang dựng', da_dung: 'Đã dùng', chua_dung: 'Chưa dùng' };
const SOURCE_TYPE: Record<string, string> = { truoc_pt: 'Trước PT', sau_pt: 'Sau PT', beauty: 'Beauty', feedback: 'Feedback', tai_kham: 'Tái khám' };

type Row = { id: number; kind: string; group_key: string | null; actor_id: string | null; payload: any; created_at: string };
type Msg = { rows: Row[]; text: string; buttons: { text: string; url: string }[] };

async function tg(chatId: string, text: string, buttons: { text: string; url: string }[]) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text: cut(text, 4000), parse_mode: 'HTML', disable_web_page_preview: true,
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

// ================= Dựng tin =================
async function build(rows: Row[]): Promise<Msg[]> {
  const P = (k: string) => rows.filter(r => r.kind === k);
  const mw = P('mw'), chat = P('mw_chat');
  const clipRows = [...P('clip_new'), ...P('clip_approved'), ...P('clip_running')];
  const srcRows = P('kho_source'), fileRows = P('kho_file');

  // ---- nạp dữ liệu 1 lần ----
  const commentIds = mw.filter(r => r.payload.entity === 'comment' && r.payload.action === 'created').map(r => r.payload.entity_id);
  const comments = await byId('mw_comments', 'id, body, deleted_at', commentIds);
  const taskIds = mw.map(r => r.payload.task_id);
  const tasks = await byId('mw_tasks', '*', taskIds);
  const boards = await byId('mw_boards', 'id, name, workspace_id', [...tasks.values()].map(t => t.board_id));
  const lists = await byId('mw_lists', 'id, name', [...tasks.values()].map(t => t.list_id));
  const wss = await byId('mw_workspaces', 'id, name', [...mw, ...chat].map(r => r.payload.workspace_id));
  const labels = await byId('mw_labels', 'id, name', mw.filter(r => r.payload.entity === 'label').map(r => r.payload.entity_id));
  const contentIds = mw.map(r => r.payload.detail?.content_id);
  const contents = await byId('mw_contents', 'id, title', contentIds);
  const assignees = new Map<string, string[]>();
  if (tasks.size) {
    const { data } = await db.from('mw_task_assignees').select('task_id, user_id').in('task_id', [...tasks.keys()]);
    for (const a of data || []) assignees.set(a.task_id, [...(assignees.get(a.task_id) || []), a.user_id]);
  }
  const clips = await byId('media_clips', '*', clipRows.map(r => r.payload.clip_id));
  const srcIds = [...srcRows.map(r => r.payload.source_id), ...fileRows.map(r => r.payload.source_id), ...[...clips.values()].map(c => c.media_customer_id)];
  const sources = await byId('media_customers', '*', srcIds);
  const peopleIds = [
    ...rows.map(r => r.actor_id),
    ...mw.filter(r => ['assignee', 'member'].includes(r.payload.entity)).map(r => r.payload.entity_id),
    ...[...assignees.values()].flat(),
    ...[...comments.values()].flatMap(c => mentionIds(c.body)),
    ...chat.flatMap(r => mentionIds(r.payload.body)),
    ...[...clips.values()].flatMap(c => [c.editor_id, c.ads_id]),
    ...[...sources.values()].map(s => s.media_id),
  ];
  const people = await byId('profiles', 'id, full_name', peopleIds);
  const who = (id?: string | null) => (id ? people.get(id)?.full_name || 'Nhân sự' : 'Hệ thống');
  const msgs: Msg[] = [];

  // ---- Marketing Workspace: gom theo thẻ (hoặc theo workspace + loại) ----
  const groups = new Map<string, Row[]>();
  for (const r of mw) groups.set(r.group_key || String(r.id), [...(groups.get(r.group_key || String(r.id)) || []), r]);
  for (const [, g] of groups) {
    const p0 = g[0].payload;
    const ws = wss.get(p0.workspace_id);
    const t = p0.task_id ? tasks.get(p0.task_id) : null;
    const mentioned = new Set<string>();
    let isNew = false;
    const lines = g.map(r => {
      const p = r.payload, d = p.detail || {};
      const k = `${p.entity}.${p.action}`;
      let s: string;
      switch (k) {
        case 'task.created': isNew = true; s = `tạo order mới “${esc(d.title)}”`; break;
        case 'task.moved': s = `chuyển cột <b>${esc(d.from || '?')}</b> → <b>${esc(d.to || '?')}</b>`; break;
        case 'task.archived': s = 'lưu trữ thẻ'; break;
        case 'task.restored': s = 'khôi phục thẻ'; break;
        case 'task.updated': s = `sửa ${(d.fields || []).map((f: string) => FIELD[f] || f).join(', ')}${d.due_at ? ` → ${vnTime(d.due_at)}` : ''}`; break;
        case 'assignee.added': mentioned.add(p.entity_id); s = `giao việc cho <b>${esc(who(p.entity_id))}</b>`; break;
        case 'assignee.removed': s = `bỏ giao ${esc(who(p.entity_id))}`; break;
        case 'label.added': s = `gắn nhãn “${esc(labels.get(p.entity_id)?.name || '')}”`; break;
        case 'label.removed': s = `gỡ nhãn “${esc(labels.get(p.entity_id)?.name || '')}”`; break;
        case 'checklist.added': s = `thêm checklist “${esc(d.title)}”`; break;
        case 'checklist.checked': s = `✔ xong “${esc(d.title)}”`; break;
        case 'checklist.unchecked': s = `bỏ xong “${esc(d.title)}”`; break;
        case 'checklist.updated': s = `sửa checklist “${esc(d.title)}”`; break;
        case 'comment.created': {
          const c = comments.get(p.entity_id);
          mentionIds(c?.body).forEach(id => mentioned.add(id));
          s = c && !c.deleted_at ? `bình luận: “${richText(c.body, 300)}”` : 'bình luận';
          break;
        }
        case 'comment.edited': s = 'sửa bình luận'; break;
        case 'comment.deleted': s = 'xoá bình luận'; break;
        case 'attachment.added': s = `đính kèm “${esc(d.name)}”`; break;
        case 'attachment.removed': s = `gỡ tệp “${esc(d.name)}”`; break;
        case 'source.added': s = `gắn source Kho <b>${esc(d.code || '')}</b>`; break;
        case 'source.removed': s = 'gỡ source Kho'; break;
        case 'kho.source_status': s = `cập nhật ${d.count || ''} source Kho → <b>${esc(KHO[d.status] || d.status)}</b>`; break;
        case 'workspace.created': s = `tạo workspace “${esc(d.name)}”`; break;
        case 'board.created': s = `tạo board “${esc(d.name)}”`; break;
        case 'member.insert': mentioned.add(p.entity_id); s = `thêm thành viên <b>${esc(who(p.entity_id))}</b>`; break;
        case 'member.update': s = `đổi vai trò ${esc(who(p.entity_id))}`; break;
        case 'member.delete': s = `gỡ thành viên ${esc(who(p.entity_id))}`; break;
        case 'content_version.created': s = `thêm ${VKIND[d.kind] || esc(d.kind)} v${esc(d.revision)} cho “${esc(contents.get(d.content_id)?.title || '')}”${d.invalidated_runs ? ' — duyệt cũ mất hiệu lực' : ''}`; break;
        case 'consent.created': s = 'thêm hồ sơ consent'; break;
        case 'consent.revoked': s = '⚠️ thu hồi consent'; break;
        case 'consent.verified': s = 'xác minh consent'; break;
        case 'consent.updated': s = 'cập nhật consent'; break;
        case 'approval.submitted': s = `gửi duyệt “${esc(contents.get(d.content_id)?.title || '')}”`; break;
        case 'approval_step.approve': s = `✅ duyệt bước ${STEP[d.kind] || esc(d.kind)}`; break;
        case 'approval_step.revision': s = `✏️ yêu cầu sửa (${STEP[d.kind] || esc(d.kind)}): ${esc(cut(d.note || '', 200))}`; break;
        case 'approval_step.reject': s = `⛔ từ chối (${STEP[d.kind] || esc(d.kind)}): ${esc(cut(d.note || '', 200))}`; break;
        case 'publication.scheduled': s = `lên lịch đăng ${vnTime(d.at)}`; break;
        case 'publication.blocked': s = `⛔ chặn đăng: ${esc(d.reason)}`; break;
        case 'publication.proof_submitted': s = 'nộp link bằng chứng đã đăng'; break;
        case 'publication.verified': s = '✅ xác minh bài đã đăng'; break;
        case 'publication.verification_failed': s = `xác minh không đạt: ${esc(d.note)}`; break;
        case 'publication.cancelled': s = 'huỷ bài đăng'; break;
        default: s = `${esc(p.entity)} · ${esc(p.action)}`;
      }
      return `• <b>${esc(who(r.actor_id))}</b> ${s}`;
    });
    let head: string, focus: string;
    const where = [ws?.name].filter(Boolean).map(esc).join('');
    if (t) {
      const b = boards.get(t.board_id);
      head = isNew ? '🆕 <b>ORDER NỘI DUNG MỚI</b>' : mentioned.size ? '🏷️ <b>CÓ NGƯỜI ĐƯỢC NHẮC TÊN / GIAO VIỆC</b>' : '📋 <b>CẬP NHẬT WORKSPACE</b>';
      const ass = (assignees.get(t.id) || []).map(who);
      const info = [
        `📌 <b>${esc(t.title)}</b>`,
        `🗂 ${where}${b ? ` › ${esc(b.name)}` : ''}${lists.get(t.list_id) ? ` › <b>${esc(lists.get(t.list_id).name)}</b>` : ''}`,
        ass.length ? `👤 Thực hiện: ${ass.map(esc).join(', ')}` : '',
        t.due_at ? `⏰ Hạn: ${vnTime(t.due_at)}` : '',
        t.priority && t.priority !== 'normal' ? `⚡ Ưu tiên: ${PRIORITY[t.priority] || esc(t.priority)}` : '',
        isNew && t.description ? `📝 ${richText(t.description, 400)}` : '',
      ].filter(Boolean);
      focus = `task:${t.id}`;
      msgs.push({ rows: g, text: [head, ...info, '', ...lines.slice(-20), lines.length > 20 ? `… và ${lines.length - 20} thay đổi khác` : '',
        mentioned.size ? `\n🔔 Nhắc / giao: ${[...mentioned].map(id => `<b>${esc(who(id))}</b>`).join(', ')}` : ''].filter(Boolean).join('\n'),
        buttons: [{ text: '🔎 Xem chi tiết', url: link('mkt_workspace', focus) }] });
    } else {
      const d = p0.detail || {};
      focus = p0.entity === 'approval' ? `approval:${p0.entity_id}` : p0.entity === 'approval_step' && d.run_id ? `approval:${d.run_id}`
        : d.content_id ? `content:${d.content_id}` : p0.entity === 'publication' ? `ws:${p0.workspace_id}:publishing` : `ws:${p0.workspace_id}`;
      head = p0.entity.startsWith('approval') ? '🛡️ <b>DUYỆT NỘI DUNG</b>' : p0.entity === 'publication' ? '📣 <b>XUẤT BẢN</b>' : '📋 <b>CẬP NHẬT WORKSPACE</b>';
      msgs.push({ rows: g, text: [head, `🗂 ${where}`, '', ...lines.slice(-20)].join('\n'), buttons: [{ text: '🔎 Xem chi tiết', url: link('mkt_workspace', focus) }] });
    }
  }

  // ---- Chat workspace ----
  const chatGroups = new Map<string, Row[]>();
  for (const r of chat) chatGroups.set(r.payload.workspace_id, [...(chatGroups.get(r.payload.workspace_id) || []), r]);
  for (const [wsId, g] of chatGroups) {
    const ment = new Set(g.flatMap(r => mentionIds(r.payload.body)));
    msgs.push({ rows: g, text: [
      ment.size ? '🏷️ <b>CHAT — CÓ NGƯỜI ĐƯỢC NHẮC TÊN</b>' : '💬 <b>CHAT WORKSPACE</b>',
      `🗂 ${esc(wss.get(wsId)?.name || '')}`, '',
      ...g.slice(-15).map(r => `• <b>${esc(who(r.actor_id))}</b>: ${richText(r.payload.body, 300)}`),
      ment.size ? `\n🔔 Nhắc: ${[...ment].map(id => `<b>${esc(who(id))}</b>`).join(', ')}` : '',
    ].filter(Boolean).join('\n'), buttons: [{ text: '💬 Mở chat', url: link('mkt_workspace', `chat:${wsId}`) }] });
  }

  // ---- Clip ----
  const srcLine = (s: any) => (s ? `🎞 Source: <b>${esc(s.source_id || cleanName(s.customer_name))}</b>${s.source_id && s.customer_name ? ` — ${esc(cleanName(s.customer_name))}` : ''}${s.service ? ` · ${esc(s.service)}` : ''}` : '');
  for (const r of clipRows) {
    const c = clips.get(r.payload.clip_id);
    if (!c) continue;
    const s = sources.get(c.media_customer_id);
    const meta = [c.video_version, c.video_format, c.platform, c.video_goal].filter(Boolean).map(esc).join(' · ');
    const first = (c.clip_links || []).find(isHttps);
    const name = esc(c.title || 'Clip');
    let text: string;
    if (r.kind === 'clip_new') {
      text = ['🎬 <b>EDITOR UP CLIP MỚI</b>', `📹 <b>${name}</b>${meta ? ` (${meta})` : ''}`, srcLine(s), `✂️ Editor: <b>${esc(who(c.editor_id || r.actor_id))}</b>`,
        (c.clip_links || []).length > 1 ? `🔗 ${(c.clip_links || []).length} link clip` : '',
        c.editor_note ? `📝 ${richText(c.editor_note, 300)}` : '', 'Ads vào chấm / duyệt nhé!'].filter(Boolean).join('\n');
    } else if (r.kind === 'clip_approved') {
      text = ['✅ <b>VIDEO ĐÃ ĐƯỢC DUYỆT</b>', `📹 <b>${name}</b>${meta ? ` (${meta})` : ''}`, srcLine(s),
        `✂️ Editor: ${esc(who(c.editor_id))} · Duyệt: <b>${esc(who(r.actor_id || c.ads_id))}</b>`,
        c.win ? '🏆 WIN' : c.score ? `⭐ Điểm: ${c.score}/10` : '',
        c.approved_to_run ? '▶️ Đã duyệt chạy Ads' : '', c.ads_feedback ? `💬 ${richText(c.ads_feedback, 300)}` : ''].filter(Boolean).join('\n');
    } else {
      text = ['🚀 <b>VIDEO ĐÃ LÊN ADS</b>', `📹 <b>${name}</b>${meta ? ` (${meta})` : ''}`, srcLine(s),
        `✂️ Editor: ${esc(who(c.editor_id))}${c.ads_id ? ` · Ads: <b>${esc(who(c.ads_id))}</b>` : ''}`,
        c.ads_page_name ? `📄 Page: ${esc(c.ads_page_name)}` : '', c.fb_status ? `📡 Facebook: ${esc(c.fb_status)}` : '',
        c.ads_run_at ? `🕒 Chạy từ: ${vnTime(c.ads_run_at)}` : ''].filter(Boolean).join('\n');
    }
    msgs.push({ rows: [r], text, buttons: [{ text: '🔎 Xem chi tiết', url: link('content_video', c.id) }, ...(first ? [{ text: '▶️ Mở video', url: first }] : [])] });
  }

  // ---- Kho Media: source mới (+ file của chính source đó) ----
  const filesBySrc = new Map<string, Row[]>();
  for (const r of fileRows) { const k = String(r.payload.source_id || 'none'); filesBySrc.set(k, [...(filesBySrc.get(k) || []), r]); }
  const fileSummary = (fs: Row[]) => {
    const v = fs.filter(f => f.payload.kind === 'video').length, i = fs.filter(f => f.payload.kind === 'image').length, o = fs.length - v - i;
    return [v && `${v} video`, i && `${i} ảnh`, o && `${o} tệp`].filter(Boolean).join(' · ');
  };
  for (const r of srcRows) {
    const s = sources.get(r.payload.source_id);
    if (!s) continue;
    const fs = filesBySrc.get(String(s.id)) || [];
    filesBySrc.delete(String(s.id));
    const drive = (s.source_links || []).find(isHttps);
    const types = (s.source_types || []).map((x: string) => SOURCE_TYPE[x] || x);
    msgs.push({ rows: [r, ...fs], text: [
      '📥 <b>MEDIA THÊM SOURCE MỚI VÀO KHO</b>',
      `🎞 <b>${esc(s.source_id || cleanName(s.customer_name))}</b>`,
      s.customer_name ? `👤 Khách: ${esc(cleanName(s.customer_name))}` : '',
      s.service ? `💉 Dịch vụ: ${esc(s.service)}` : '', s.shoot_date ? `📅 Ngày quay: ${vnDate(s.shoot_date)}` : '',
      `📸 Media: <b>${esc(who(s.media_id || r.actor_id))}</b>${s.media_in_charge ? ` (+ ${esc(s.media_in_charge)})` : ''}`,
      types.length ? `🏷 Loại: ${types.map(esc).join(', ')}` : '', (s.tags || []).length ? `#️⃣ ${(s.tags || []).map(esc).join(', ')}` : '',
      fs.length ? `📂 ${fileSummary(fs)}` : (s.source_video_count || s.source_image_count) ? `📂 ${s.source_video_count || 0} video · ${s.source_image_count || 0} ảnh` : '',
      s.no_image ? '⛔ <b>KHÔNG ĐƯỢC SỬ DỤNG HÌNH ẢNH</b>' : '', s.hide_face ? '🙈 Phải che mặt' : '',
      s.note ? `📝 ${richText(s.note, 300)}` : '',
    ].filter(Boolean).join('\n'), buttons: [{ text: '🔎 Xem trong Kho', url: link('content_kho', s.id) }, ...(drive ? [{ text: '📂 Mở Drive', url: drive }] : [])] });
  }
  // ---- Kho Media: file mới vào source có sẵn ----
  const fileGroups = [...filesBySrc.entries()];
  const fileMsg = (sid: string, fs: Row[]) => {
    const s = sources.get(sid);
    return [`📂 <b>+${fs.length} FILE MỚI VÀO KHO</b> — ${s ? `<b>${esc(s.source_id || cleanName(s.customer_name))}</b>` : 'chưa gắn source'} (${fileSummary(fs)})`,
      ...fs.slice(0, 5).map(f => `• ${esc(cut(String(f.payload.name || ''), 80))}`), fs.length > 5 ? `… và ${fs.length - 5} file khác` : ''].filter(Boolean).join('\n');
  };
  if (fileGroups.length > 6) {   // quét Drive hàng loạt -> 1 tin tổng hợp
    const total = fileGroups.reduce((n, [, fs]) => n + fs.length, 0);
    msgs.push({ rows: fileGroups.flatMap(([, fs]) => fs), text: [`📂 <b>+${total} FILE MỚI VÀO KHO MEDIA</b> (${fileGroups.length} source)`,
      ...fileGroups.slice(0, 15).map(([sid, fs]) => { const s = sources.get(sid); return `• ${s ? esc(s.source_id || cleanName(s.customer_name)) : 'chưa gắn source'}: ${fileSummary(fs)}`; }),
      fileGroups.length > 15 ? `… và ${fileGroups.length - 15} source khác` : ''].filter(Boolean).join('\n'), buttons: [{ text: '🔎 Mở Kho Media', url: link('content_kho') }] });
  } else {
    for (const [sid, fs] of fileGroups) msgs.push({ rows: fs, text: fileMsg(sid, fs), buttons: [{ text: '🔎 Xem trong Kho', url: link('content_kho', sid !== 'none' ? sid : null) }] });
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
    try { await tg(chatId, '✅ <b>Kết nối thành công</b>\nNhóm này sẽ nhận thông báo Marketing Workspace, clip mới / duyệt / lên Ads và Kho Media.', [{ text: '🔎 Mở app', url: link('mkt_workspace') }]); return json({ ok: true }); }
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
    msgs.push({ rows: rest.flatMap(m => m.rows), text: `📋 <b>Và ${rest.length} cập nhật khác</b>\n` + rest.slice(0, 25).map(m => '• ' + m.text.split('\n').slice(0, 2).join(' — ').replace(/<[^>]+>/g, '')).map(s => esc(cut(s, 160))).join('\n'),
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
