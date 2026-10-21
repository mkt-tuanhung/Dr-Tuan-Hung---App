// ============================================================
// MARKETING WORKSPACE — lớp truy cập dữ liệu.
// Dùng CHUNG client Supabase đã đăng nhập của app (không tạo client / auth mới).
// Quyền kiểm tra ở DATABASE (RLS + RPC trong supabase/marketing_workspace_v1.sql);
// ẩn nút ở giao diện chỉ để dễ dùng, không phải lớp bảo mật.
// Mọi lỗi trả về Error tiếng Việt dễ hiểu (mwError).
// ============================================================
import { supabase } from '@/lib/supabaseClient';

export const isMissingSchema = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42703'
  || /could not find|does not exist|schema cache/i.test(e.message || ''));

export function mwError(e) {
  if (!e) return null;
  if (isMissingSchema(e)) return Object.assign(new Error('Chưa cài Marketing Workspace trên database — Admin chạy file supabase/marketing_workspace_v1.sql.'), { missing: true });
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message || '')) return Object.assign(new Error(/row-level|permission denied/i.test(e.message || '') ? 'Bạn không có quyền thực hiện thao tác này.' : e.message), { forbidden: true });
  if (e.code === '40001') return Object.assign(new Error(e.message || 'Xung đột chỉnh sửa — hãy tải lại.'), { conflict: true });
  return new Error(e.message || 'Có lỗi xảy ra, thử lại sau.');
}
const unwrap = async (q) => { const { data, error } = await q; if (error) throw mwError(error); return data; };
// UPDATE phải trả về đúng 1 dòng — RLS chặn thì Supabase không báo lỗi mà trả 0 dòng
const one = async (q) => { const rows = await unwrap(q); if (!rows?.length) throw Object.assign(new Error('Không lưu được: bạn không có quyền hoặc dữ liệu đã thay đổi.'), { forbidden: true }); return rows[0]; };

const TASK_COLS = 'id, board_id, list_id, title, description, priority, start_at, due_at, sort_index, version, cover_color, estimate_hours, completed_at, created_by, archived_at, created_at, updated_at';

export const mwApi = {
  // ---------- Nhân sự (dùng bảng profiles có sẵn) ----------
  staff: () => unwrap(supabase.from('profiles').select('id, full_name, role, role_2, avatar_url, is_active, employment_status').order('full_name')),

  // ---------- Workspace / thành viên ----------
  workspaces: () => unwrap(supabase.from('mw_workspaces').select('id, name, description, color, owner_id, archived_at, created_at').order('created_at')),
  createWorkspace: (name, description, color) => unwrap(supabase.rpc('mw_create_workspace', { p_name: name, p_description: description || null, p_color: color || '#087F83' })),
  updateWorkspace: (id, patch) => one(supabase.from('mw_workspaces').update(patch).eq('id', id).select('id')),
  members: (wsId) => unwrap(supabase.from('mw_members').select('workspace_id, user_id, role, created_at').eq('workspace_id', wsId)),
  myMemberships: (userId) => unwrap(supabase.from('mw_members').select('workspace_id, role').eq('user_id', userId)),
  addMember: (wsId, userId, role) => unwrap(supabase.from('mw_members').insert({ workspace_id: wsId, user_id: userId, role }).select('user_id')),
  setMemberRole: (wsId, userId, role) => one(supabase.from('mw_members').update({ role }).eq('workspace_id', wsId).eq('user_id', userId).select('user_id')),
  removeMember: (wsId, userId) => one(supabase.from('mw_members').delete().eq('workspace_id', wsId).eq('user_id', userId).select('user_id')),

  // ---------- Board / cột / nhãn ----------
  boards: (wsIds) => unwrap(supabase.from('mw_boards').select('id, workspace_id, name, description, template, color, sort_index, archived_at, created_at').in('workspace_id', wsIds).order('sort_index')),
  createBoard: (wsId, name, template) => unwrap(supabase.rpc('mw_create_board', { p_ws: wsId, p_name: name, p_template: template })),
  updateBoard: (id, patch) => one(supabase.from('mw_boards').update(patch).eq('id', id).select('id')),
  board: (id) => unwrap(supabase.from('mw_boards').select('id, workspace_id, name, description, template, color, sort_index, archived_at, created_at').eq('id', id).maybeSingle()),
  workspace: (id) => unwrap(supabase.from('mw_workspaces').select('id, name, description, color, owner_id, archived_at, created_at').eq('id', id).maybeSingle()),
  lists: (boardIds) => unwrap(supabase.from('mw_lists').select('id, board_id, name, sort_index, wip_limit, is_done, archived_at').in('board_id', boardIds).order('sort_index')),
  createList: (boardId, name, sortIndex) => unwrap(supabase.from('mw_lists').insert({ board_id: boardId, name, sort_index: sortIndex }).select('id').single()),
  updateList: (id, patch) => one(supabase.from('mw_lists').update(patch).eq('id', id).select('id')),
  labels: (wsIds) => unwrap(supabase.from('mw_labels').select('id, workspace_id, name, color').in('workspace_id', wsIds).order('name')),
  createLabel: (wsId, name, color) => unwrap(supabase.from('mw_labels').insert({ workspace_id: wsId, name, color }).select('id').single()),
  deleteLabel: (id) => one(supabase.from('mw_labels').delete().eq('id', id).select('id')),

  // ---------- Thẻ ----------
  // Tải theo board (giới hạn để không kéo dữ liệu vô hạn)
  tasks: (boardIds, { archived = false } = {}) => {
    let q = supabase.from('mw_tasks').select(TASK_COLS).in('board_id', boardIds).order('sort_index').limit(2000);
    q = archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
    return unwrap(q);
  },
  task: (id) => unwrap(supabase.from('mw_tasks').select(TASK_COLS).eq('id', id).maybeSingle()),
  myTaskIds: (userId) => unwrap(supabase.from('mw_task_assignees').select('task_id').eq('user_id', userId).limit(2000)),
  tasksByIds: (ids) => (ids.length ? unwrap(supabase.from('mw_tasks').select(TASK_COLS).in('id', ids).is('archived_at', null).limit(2000)) : Promise.resolve([])),
  searchTasks: (term) => unwrap(supabase.from('mw_tasks').select(TASK_COLS).ilike('title', `%${term.replace(/[%,()]/g, ' ')}%`).is('archived_at', null).limit(50)),
  createTask: (boardId, listId, title, extra = {}) => unwrap(supabase.from('mw_tasks').insert({ board_id: boardId, list_id: listId, title, ...extra }).select(TASK_COLS).single()),
  // Sửa có kiểm tra phiên bản (khoá lạc quan): ai đó sửa trước -> báo xung đột thay vì ghi đè
  updateTask: async (id, patch, version) => {
    const rows = await unwrap(supabase.from('mw_tasks').update(patch).eq('id', id).eq('version', version).select(TASK_COLS));
    if (!rows?.length) throw Object.assign(new Error('Thẻ vừa được người khác thay đổi (hoặc bạn không có quyền). Đã tải lại bản mới nhất.'), { conflict: true });
    return rows[0];
  },
  moveTask: async (id, listId, afterTaskId, version) => {
    const rows = await unwrap(supabase.rpc('mw_move_task', { p_task: id, p_list: listId, p_after_task: afterTaskId || null, p_expected_version: version }));
    return rows?.[0];
  },
  copyTask: (id, listId) => unwrap(supabase.rpc('mw_copy_task', { p_task: id, p_list: listId || null })),

  assignees: (taskIds) => (taskIds.length ? unwrap(supabase.from('mw_task_assignees').select('task_id, user_id').in('task_id', taskIds)) : Promise.resolve([])),
  addAssignee: (taskId, userId) => unwrap(supabase.from('mw_task_assignees').insert({ task_id: taskId, user_id: userId }).select('task_id')),
  removeAssignee: (taskId, userId) => one(supabase.from('mw_task_assignees').delete().eq('task_id', taskId).eq('user_id', userId).select('task_id')),
  watchers: (taskId) => unwrap(supabase.from('mw_task_watchers').select('user_id').eq('task_id', taskId)),
  addWatcher: (taskId, userId) => unwrap(supabase.from('mw_task_watchers').insert({ task_id: taskId, user_id: userId }).select('task_id')),
  removeWatcher: (taskId, userId) => one(supabase.from('mw_task_watchers').delete().eq('task_id', taskId).eq('user_id', userId).select('task_id')),
  taskLabels: (taskIds) => (taskIds.length ? unwrap(supabase.from('mw_task_labels').select('task_id, label_id').in('task_id', taskIds)) : Promise.resolve([])),
  addTaskLabel: (taskId, labelId) => unwrap(supabase.from('mw_task_labels').insert({ task_id: taskId, label_id: labelId }).select('task_id')),
  removeTaskLabel: (taskId, labelId) => one(supabase.from('mw_task_labels').delete().eq('task_id', taskId).eq('label_id', labelId).select('task_id')),
  checklist: (taskIds) => (taskIds.length ? unwrap(supabase.from('mw_checklist_items').select('id, task_id, title, done, assignee_id, due_at, sort_index, done_by, done_at').in('task_id', taskIds).order('sort_index')) : Promise.resolve([])),
  addCheck: (taskId, title, extra = {}) => unwrap(supabase.from('mw_checklist_items').insert({ task_id: taskId, title, sort_index: Date.now() / 1000, ...extra }).select('id').single()),
  updateCheck: (id, patch) => one(supabase.from('mw_checklist_items').update(patch).eq('id', id).select('id')),
  deleteCheck: (id) => one(supabase.from('mw_checklist_items').delete().eq('id', id).select('id')),
  comments: (taskId) => unwrap(supabase.from('mw_comments').select('id, task_id, author_id, body, created_at, edited_at, deleted_at').eq('task_id', taskId).order('created_at').limit(500)),
  addComment: (taskId, body) => unwrap(supabase.from('mw_comments').insert({ task_id: taskId, body }).select('id').single()),
  editComment: (id, body) => one(supabase.from('mw_comments').update({ body }).eq('id', id).select('id')),
  deleteComment: (id) => one(supabase.from('mw_comments').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id')),
  // Ảnh / link của nhiều thẻ (hiện ảnh bìa + số đính kèm trên bảng)
  boardAttachments: (taskIds) => (taskIds.length ? unwrap(supabase.from('mw_attachments').select('task_id, url, mime, name, created_at').in('task_id', taskIds).order('created_at').limit(5000)) : Promise.resolve([])),
  attachments: (taskId) => unwrap(supabase.from('mw_attachments').select('id, url, name, mime, size_bytes, sha256, uploaded_by, created_at').eq('task_id', taskId).order('created_at')),
  addAttachment: (taskId, a) => unwrap(supabase.from('mw_attachments').insert({ task_id: taskId, ...a }).select('id').single()),
  deleteAttachment: (id) => one(supabase.from('mw_attachments').delete().eq('id', id).select('id')),
  activity: (taskId) => unwrap(supabase.from('mw_activity').select('id, action, entity, entity_id, detail, actor_id, created_at').eq('task_id', taskId).order('created_at', { ascending: false }).limit(200)),
  wsActivity: (wsIds, since) => unwrap(supabase.from('mw_activity').select('id, workspace_id, task_id, action, entity, entity_id, detail, actor_id, created_at').in('workspace_id', wsIds).gte('created_at', since).order('created_at', { ascending: false }).limit(1000)),

  // ---------- Marketing ----------
  reviewers: () => unwrap(supabase.from('mw_reviewers').select('user_id, kind, created_at')),
  addReviewer: (userId, kind) => unwrap(supabase.from('mw_reviewers').insert({ user_id: userId, kind }).select('user_id')),
  removeReviewer: (userId, kind) => one(supabase.from('mw_reviewers').delete().eq('user_id', userId).eq('kind', kind).select('user_id')),
  campaigns: (wsIds) => unwrap(supabase.from('mw_campaigns').select('*').in('workspace_id', wsIds).order('created_at', { ascending: false })),
  createCampaign: (c) => unwrap(supabase.from('mw_campaigns').insert(c).select('id').single()),
  updateCampaign: (id, patch) => one(supabase.from('mw_campaigns').update(patch).eq('id', id).select('id')),
  contents: () => unwrap(supabase.from('mw_contents').select('*').order('updated_at', { ascending: false }).limit(1000)),
  content: (id) => unwrap(supabase.from('mw_contents').select('*').eq('id', id).maybeSingle()),
  createContent: (c) => unwrap(supabase.from('mw_contents').insert(c).select('id').single()),
  updateContent: (id, patch) => one(supabase.from('mw_contents').update(patch).eq('id', id).select('id')),
  versions: (contentIds) => (contentIds.length ? unwrap(supabase.from('mw_content_versions').select('*').in('content_id', contentIds).order('revision', { ascending: false })) : Promise.resolve([])),
  addVersion: (v) => unwrap(supabase.from('mw_content_versions').insert(v).select('id, revision').single()),
  runs: (contentIds) => (contentIds.length ? unwrap(supabase.from('mw_approval_runs').select('*').in('content_id', contentIds).order('created_at', { ascending: false })) : Promise.resolve([])),
  allRuns: () => unwrap(supabase.from('mw_approval_runs').select('*').order('created_at', { ascending: false }).limit(500)),
  steps: (runIds) => (runIds.length ? unwrap(supabase.from('mw_approval_steps').select('*').in('run_id', runIds).order('seq')) : Promise.resolve([])),
  submitApproval: (contentId) => unwrap(supabase.rpc('mw_submit_approval', { p_content: contentId })),
  reviewStep: (stepId, decision, note) => unwrap(supabase.rpc('mw_review_step', { p_step: stepId, p_decision: decision, p_note: note || null })),
  consents: (contentIds) => (contentIds.length ? unwrap(supabase.from('mw_consents').select('*').in('content_id', contentIds).order('created_at', { ascending: false })) : Promise.resolve([])),
  addConsent: (c) => unwrap(supabase.from('mw_consents').insert(c).select('id').single()),
  revokeConsent: (id) => one(supabase.from('mw_consents').update({ revoked_at: new Date().toISOString() }).eq('id', id).select('id')),
  verifyConsent: (id) => unwrap(supabase.rpc('mw_verify_consent', { p_consent: id })),
  publications: () => unwrap(supabase.from('mw_publications').select('*').order('created_at', { ascending: false }).limit(1000)),
  createPublication: (p) => unwrap(supabase.from('mw_publications').insert(p).select('id').single()),
  updatePublication: (id, patch) => one(supabase.from('mw_publications').update(patch).eq('id', id).select('id')),
  publicationGate: (id) => unwrap(supabase.rpc('mw_publication_gate', { p_pub: id })),
  schedulePublication: (id, at) => unwrap(supabase.rpc('mw_schedule_publication', { p_pub: id, p_at: at })),
  submitProof: (id, url) => unwrap(supabase.rpc('mw_submit_publish_proof', { p_pub: id, p_url: url })),
  verifyPublication: (id, ok, note) => unwrap(supabase.rpc('mw_verify_publication', { p_pub: id, p_ok: ok, p_note: note || null })),
  cancelPublication: (id) => unwrap(supabase.rpc('mw_cancel_publication', { p_pub: id })),
};

// sha256 của tệp (tính trong trình duyệt bằng Web Crypto) — gắn vào phiên bản để duyệt đúng tệp
export async function sha256OfFile(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
