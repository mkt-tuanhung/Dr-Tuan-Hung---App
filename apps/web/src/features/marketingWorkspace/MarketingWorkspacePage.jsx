// ============================================================
// MARKETING WORKSPACE (v1) — trang module trong khung app hiện có (tab 'mkt_workspace').
// KHÔNG có router / shell riêng: dùng AppShell + phiên đăng nhập + bảng profiles + thông báo của app.
// Ai thấy menu: quyền 'mkt_workspace' trong trang Phân quyền (mặc định Marketing, Media, Editor, Designer, Bác sĩ, Admin).
// Deep link: thông báo link 'mkt_workspace#task:<id>' / 'mkt_workspace#approval:<run id>'.
// Dữ liệu & quyền: supabase/marketing_workspace_v1.sql (RLS + RPC). Xem docs/marketing/*.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Inbox, Columns3, Megaphone, Clapperboard, ShieldCheck, Send, Settings2, MessagesSquare, BookOpen,
  Database, FolderOpen, BarChart3, Workflow, Sparkles, Plus, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePageTitle, ErrorState, EmptyState } from '@/components/ds';
import { takePendingFocus } from '@/lib/notif';
import { mwApi } from './mwApi';
import { MW_TAB, isAdminProfile, hasRole, wsPerm, LABEL_COLORS, bySort } from './mwMeta';
import { Modal, Field, Skeleton, attempt, BusyButton, Sel } from './mwUi';
import BoardSection, { TemplatePicker, createBoardWith, customColsOk, DEFAULT_CUSTOM_COLS } from './BoardSection';
import TaskDrawer from './TaskDrawer';
import { Overview, MyTasks } from './HomeSections';
import SettingsSection from './SettingsSection';
import ContentStudio, { CampaignsSection } from './ContentStudio';
import ApprovalCenter from './ApprovalCenter';
import PublishingQueue from './PublishingQueue';

const SECTIONS = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, needWs: true },
  { id: 'my', label: 'Việc của tôi', icon: Inbox },
  { id: 'board', label: 'Bảng công việc', icon: Columns3, needWs: true },
  { id: 'campaigns', label: 'Chiến dịch', icon: Megaphone, needWs: true },
  { id: 'studio', label: 'Content Studio', icon: Clapperboard, needWs: true },
  { id: 'approvals', label: 'Duyệt', icon: ShieldCheck },
  { id: 'publishing', label: 'Xuất bản', icon: Send, needWs: true },
  { id: 'settings', label: 'Thành viên & cấu hình', icon: Settings2, needWs: true },
];
// Hiện để người dùng biết lộ trình, nhưng KHOÁ + ghi rõ lý do (không vẽ chức năng giả)
const LATER = [
  { id: 'chat', label: 'Chat', icon: MessagesSquare, why: 'Chưa triển khai — dùng bình luận + @nhắc trong thẻ, hoặc Cộng đồng / Phòng họp hiện có.' },
  { id: 'docs', label: 'Tài liệu & Wiki', icon: BookOpen, why: 'Chưa triển khai — dùng mô tả thẻ / brief, hoặc module Tài liệu hiện có.' },
  { id: 'base', label: 'Base', icon: Database, why: 'Chưa triển khai — Bảng dữ liệu của board đã sửa trực tiếp + xuất CSV.' },
  { id: 'media', label: 'Kho media', icon: FolderOpen, why: 'Dùng module Kho Media hiện có (menu Marketing). Tệp bản duyệt lưu ở tab Phiên bản.' },
  { id: 'reports', label: 'Báo cáo', icon: BarChart3, why: 'Số liệu nội bộ ở Tổng quan. Số liệu mạng xã hội: chưa kết nối nguồn.' },
  { id: 'automation', label: 'Automation', icon: Workflow, why: 'Chưa triển khai (cần hàng đợi + chống vòng lặp phía server).' },
  { id: 'ai', label: 'Trợ lý AI', icon: Sparkles, why: 'Chưa triển khai — không cho AI tự duyệt / tự đăng.' },
];

const store = { get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* bỏ qua */ } } };

export default function MarketingWorkspacePage() {
  usePageTitle('Marketing Workspace');
  const { profile } = useAuth();
  const admin = isAdminProfile(profile);
  const canCreateWs = admin || hasRole(profile, 'marketing');

  const [boot, setBoot] = useState({ loading: true });
  const [section, setSection] = useState(() => store.get('mw_section') || 'overview');
  const [wsId, setWsId] = useState(() => store.get('mw_ws') || '');
  const [boards, setBoards] = useState([]);
  const [labels, setLabels] = useState([]);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [taskVersion, setTaskVersion] = useState(0);
  const [focus, setFocus] = useState({});        // { board, filter, run, content, campaign }
  const [newWs, setNewWs] = useState(false);

  useEffect(() => { store.set('mw_section', section); }, [section]);
  useEffect(() => { if (wsId) store.set('mw_ws', wsId); }, [wsId]);

  // Tải nền: cờ module, nhân sự, workspace được xem, vai trò của tôi, quyền duyệt của tôi
  const loadBoot = useCallback(async () => {
    try {
      const [staff, workspaces, mine, reviewers] = await Promise.all([
        mwApi.staff(), mwApi.workspaces(), mwApi.myMemberships(profile.id), mwApi.reviewers(),
      ]);
      setBoot({
        loading: false, error: null, staff, workspaces,
        myRoles: new Map(mine.map(m => [m.workspace_id, m.role])),
        myKinds: new Set(reviewers.filter(r => r.user_id === profile.id).map(r => r.kind)),
      });
    } catch (e) { setBoot({ loading: false, error: e }); }
  }, [profile.id]);
  useEffect(() => { loadBoot(); }, [loadBoot]);

  const staffById = useMemo(() => new Map((boot.staff || []).map(s => [s.id, s])), [boot.staff]);
  const activeWs = (boot.workspaces || []).filter(w => !w.archived_at);
  const ws = (boot.workspaces || []).find(w => w.id === wsId) || activeWs[0] || (boot.workspaces || [])[0] || null;
  const perm = useMemo(() => wsPerm(profile, ws, boot.myRoles?.get(ws?.id)), [profile, ws, boot.myRoles]);

  const [wsError, setWsError] = useState(null);
  const loadWs = useCallback(async () => {
    if (!ws) { setBoards([]); setLabels([]); return; }
    try {
      const [b, l] = await Promise.all([mwApi.boards([ws.id]), mwApi.labels([ws.id])]);
      setBoards(b.sort(bySort)); setLabels(l); setWsError(null);
    } catch (e) { setBoards([]); setLabels([]); setWsError(e); }
  }, [ws]);
  useEffect(() => { loadWs(); }, [loadWs]);

  // Deep link từ thông báo / NAVIGATE('mkt_workspace#task:<id>')
  useEffect(() => {
    const handle = (raw) => {
      const id = String(raw || '');
      if (id.startsWith('task:')) setOpenTaskId(id.slice(5));
      else if (id.startsWith('approval:')) { setSection('approvals'); setFocus({ run: id.slice(9) }); }
      else if (id.startsWith('content:')) { setSection('studio'); setFocus({ content: id.slice(8) }); }
    };
    const pending = takePendingFocus(MW_TAB);
    if (pending) handle(pending.id);
    const onFocus = (e) => { if (e.detail?.tab === MW_TAB) { takePendingFocus(MW_TAB); handle(e.detail.id); } };
    window.addEventListener('FOCUS_ITEM', onFocus);
    return () => window.removeEventListener('FOCUS_ITEM', onFocus);
  }, []);

  const go = (s, opts = {}) => { setSection(s); setFocus(opts); };
  const reloadAll = () => { loadBoot(); loadWs(); };

  if (boot.loading) return <div className="e-card e-card-pad"><Skeleton rows={6} /></div>;
  if (boot.error) {
    return <div className="e-card"><ErrorState title={boot.error.missing ? 'Chưa cài Marketing Workspace' : 'Không tải được Marketing Workspace'} description={boot.error.message} onRetry={loadBoot} /></div>;
  }

  const sec = SECTIONS.find(s => s.id === section) || SECTIONS[0];
  const needWsMissing = sec.needWs && !ws;

  return (
    <div className="space-y-4">

      {/* Thanh workspace */}
      <div className="flex flex-wrap items-center gap-2">
        {(boot.workspaces || []).length > 0 ? (
          <label className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: ws?.color || '#087F83' }} />
            <Sel wrapClass="max-w-[280px]" className="!font-semibold" value={ws?.id || ''} onChange={e => { setWsId(e.target.value); setFocus({}); }} aria-label="Chọn workspace">
              {(boot.workspaces || []).filter(w => !w.archived_at || w.id === ws?.id).map(w => <option key={w.id} value={w.id}>{w.name}{w.archived_at ? ' (lưu trữ)' : ''}</option>)}
            </Sel>
          </label>
        ) : <span className="text-[13px] text-slate-500">Chưa có workspace</span>}
        {ws && <span className="e-badge e-badge-sm e-tone-neutral">{perm.role === 'admin' ? 'Admin' : perm.role === 'owner' ? 'Chủ workspace' : perm.role === 'manager' ? 'Quản lý' : perm.role === 'editor' ? 'Thực hiện' : 'Chỉ xem'}</span>}
        {boot.myKinds.size > 0 && <span className="e-badge e-badge-sm e-tone-lavender">Người duyệt</span>}
        {canCreateWs && <button type="button" className="e-btn e-btn-secondary e-btn-sm ml-auto" onClick={() => setNewWs(true)}><Plus /> Workspace mới</button>}
      </div>

      {ws?.archived_at && (
        <div className="e-alert e-alert-warning text-[13px] flex flex-wrap items-center gap-2">
          <span><b>Workspace “{ws.name}” đang bị ẩn (lưu trữ)</b> — dữ liệu vẫn còn nguyên.</span>
          {perm.manage && <BusyButton className="e-btn e-btn-primary e-btn-sm ml-auto" onClick={async () => { if (await attempt(() => mwApi.updateWorkspace(ws.id, { archived_at: null }), 'Đã hiện lại workspace')) reloadAll(); }}>Hiện lại workspace</BusyButton>}
        </div>
      )}
      {wsError && <div className="e-alert e-alert-danger text-[13px]">Không tải được board của workspace: {wsError.message}</div>}

      {/* Điều hướng con */}
      <nav className="e-tabs" aria-label="Mục Marketing Workspace">
        {SECTIONS.map(s => (
          <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={section === s.id ? 'page' : undefined} className={`e-tab ${section === s.id ? 'e-tab-active' : ''}`}>
            <s.icon />{s.label}
          </button>
        ))}
        {LATER.map(s => (
          <button key={s.id} type="button" disabled aria-disabled="true" title={s.why} className="e-tab opacity-45 cursor-not-allowed"><s.icon />{s.label}<Lock className="!w-3 !h-3" /></button>
        ))}
      </nav>

      <div key={`${section}-${ws?.id || ''}`} className="motion-safe:animate-page">
        {needWsMissing ? (
          <div className="e-card">
            <EmptyState icon={Columns3} title={canCreateWs ? 'Tạo workspace đầu tiên' : 'Bạn chưa là thành viên workspace nào'}
              description={canCreateWs ? 'Workspace gom board công việc, chiến dịch, nội dung và thành viên.' : 'Nhờ quản lý Marketing thêm bạn vào workspace.'}
              action={canCreateWs && <button type="button" className="e-btn e-btn-primary" onClick={() => setNewWs(true)}><Plus /> Workspace mới</button>} />
          </div>
        ) : section === 'overview' ? <Overview ws={ws} boards={boards} staffById={staffById} onGo={(s, o = {}) => go(s, o)} openTask={setOpenTaskId} />
          : section === 'my' ? <MyTasks profile={profile} workspaces={boot.workspaces || []} openTask={setOpenTaskId} />
            : section === 'board' ? <BoardSection ws={ws} boards={boards} perm={perm} staffById={staffById} labels={labels} openTask={setOpenTaskId} reloadBoards={loadWs} focusBoardId={focus.board} initialFilter={focus.filter} taskVersion={taskVersion} />
              : section === 'campaigns' ? <CampaignsSection ws={ws} perm={perm} staffById={staffById} onOpenContents={(id) => go('studio', { campaign: id })} />
                : section === 'studio' ? <ContentStudio ws={ws} perm={perm} myKinds={boot.myKinds} profile={profile} staffById={staffById} focusContentId={focus.content} campaignFilter={focus.campaign} onClearCampaign={() => setFocus({})} />
                  : section === 'approvals' ? <ApprovalCenter profile={profile} myKinds={boot.myKinds} staffById={staffById} focusRunId={focus.run} />
                    : section === 'publishing' ? <PublishingQueue ws={ws} perm={perm} myKinds={boot.myKinds} profile={profile} staffById={staffById} />
                      : <SettingsSection ws={ws} perm={perm} profile={profile} staff={boot.staff} staffById={staffById} boards={boards} labels={labels} reloadAll={reloadAll} />}
      </div>

      {openTaskId && (
        <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} profile={profile} workspaces={boot.workspaces || []} myRoles={boot.myRoles}
          staffById={staffById} onChanged={() => setTaskVersion(v => v + 1)}
          onOpenContent={(id) => { setOpenTaskId(null); go('studio', { content: id }); }} />
      )}
      <NewWorkspaceModal open={newWs} onClose={() => setNewWs(false)} onCreated={(id) => { setWsId(id); setSection('board'); setFocus({}); reloadAll(); }} />
    </div>
  );
}

// Tạo workspace = tạo luôn bảng công việc đầu tiên (theo mẫu cột) -> vào là dùng được ngay
function NewWorkspaceModal({ open, onClose, onCreated }) {
  const blank = { name: '', description: '', color: LABEL_COLORS[0], board: 'Sản xuất nội dung', tpl: 'video', cols: DEFAULT_CUSTOM_COLS };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const id = await attempt(() => mwApi.createWorkspace(f.name.trim(), f.description.trim(), f.color));
    if (!id || id === true) return;
    const b = await attempt(() => createBoardWith(id, f.board.trim() || 'Bảng công việc', f.tpl, f.cols));
    toast.success(b ? 'Đã tạo workspace + bảng công việc — thêm thẻ ngay, thêm người ở “Thành viên & cấu hình”' : 'Đã tạo workspace (chưa tạo được bảng — bấm Tạo board)');
    onClose(); onCreated(id);
  };
  return (
    <Modal open={open} onClose={onClose} title="Workspace mới" size="max-w-xl" desc="Workspace = 1 nhóm / dự án. Bên trong có các bảng công việc (cột → thẻ việc). Bạn là chủ workspace." footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton disabled={!f.name.trim() || !customColsOk(f.tpl, f.cols)} onClick={save}>Tạo</BusyButton>
    </>}>
      <Field label="Tên workspace" required><input autoFocus className="e-input" value={f.name} maxLength={120} onChange={e => setF(v => ({ ...v, name: e.target.value }))} placeholder="VD: Marketing Dr Tuấn Hùng" /></Field>
      <Field label="Mô tả"><textarea className="e-textarea" value={f.description} maxLength={2000} onChange={e => setF(v => ({ ...v, description: e.target.value }))} /></Field>
      <div className="flex gap-1">{LABEL_COLORS.map(c => <button key={c} type="button" onClick={() => setF(v => ({ ...v, color: c }))} aria-label={`Màu ${c}`} aria-pressed={f.color === c} className={`w-7 h-7 rounded-full border-2 ${f.color === c ? 'border-slate-800' : 'border-white'}`} style={{ background: c }} />)}</div>
      <Field label="Bảng công việc đầu tiên"><input className="e-input" value={f.board} maxLength={120} onChange={e => setF(v => ({ ...v, board: e.target.value }))} /></Field>
      <TemplatePicker tpl={f.tpl} setTpl={(t) => setF(v => ({ ...v, tpl: t }))} cols={f.cols} setCols={(c) => setF(v => ({ ...v, cols: c }))} />
    </Modal>
  );
}
