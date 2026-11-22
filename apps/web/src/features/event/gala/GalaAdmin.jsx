// ============================================================
// GALA — màn BAN TỔ CHỨC (Admin)
// Tabs: Tổng quan (điều khiển + bảng xếp hạng) · Tiết mục · Giám khảo · Công bố
// Giám khảo = tài khoản nhân sự có sẵn trong app (bảng profiles), cấp theo từng chương trình.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Mic2, Users, Award, Play, Pause, Lock, Trophy, EyeOff, Download, Plus,
  Pencil, Trash2, Search, UserPlus, UserMinus, RotateCcw, ListChecks, ClipboardCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Drawer, ConfirmDialog, EmptyState } from '@/components/ds';
import { ROLE_LABELS } from '@/features/permissions/menuConfig';
import GalaStage, { RankingList } from './GalaStage.jsx';
import { TEAM_SUGGESTIONS, exportScoresCsv, initials, norm, pad2 } from './galaUtil';

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: Activity },
  { id: 'performances', label: 'Tiết mục', icon: Mic2 },
  { id: 'judges', label: 'Giám khảo', icon: Users },
  { id: 'stage', label: 'Công bố', icon: Award },
];
const EMPTY_PERF = { title: '', team_name: '', description: '', duration_minutes: '' };

// Danh bạ nhân sự (đang làm) + tên của giám khảo đã nghỉ (nếu có)
function useStaffDirectory(judgeIds) {
  const [staff, setStaff] = useState([]);
  const [extra, setExtra] = useState({});
  useEffect(() => {
    let off = false;
    supabase.from('profiles').select('id, full_name, employee_id, position, role, role_2, avatar_url')
      .eq('is_active', true).order('full_name')
      .then(({ data }) => { if (!off) setStaff(data || []); });
    return () => { off = true; };
  }, []);
  const byId = useMemo(() => ({ ...extra, ...Object.fromEntries(staff.map((s) => [s.id, s])) }), [staff, extra]);
  const missingKey = judgeIds.filter((id) => !byId[id]).join(',');
  useEffect(() => {
    if (!missingKey || !staff.length) return;
    supabase.from('profiles').select('id, full_name, employee_id, position, role, role_2, avatar_url')
      .in('id', missingKey.split(','))
      .then(({ data }) => setExtra((o) => ({ ...o, ...Object.fromEntries((data || []).map((s) => [s.id, s])) })));
  }, [missingKey, staff.length]);
  return { staff, byId };
}

const roleText = (p) => [p?.role, p?.role_2].filter(Boolean).map((r) => ROLE_LABELS[r] || r).join(' · ');

function Avatar({ person, size = 'w-10 h-10' }) {
  if (person?.avatar_url) return <img src={person.avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />;
  return <span className={`${size} rounded-full bg-teal-50 text-teal-800 grid place-items-center text-[12px] font-bold shrink-0`}>{initials(person?.full_name)}</span>;
}

function Metric({ icon: Icon, label, value, hint, tone = '' }) {
  return (
    <div className="e-metric">
      <div className={`e-metric-icon ${tone}`}><Icon /></div>
      <div className="min-w-0">
        <div className="e-metric-label">{label}</div>
        <div className="e-metric-value">{value}</div>
        {hint && <div className="e-metric-hint">{hint}</div>}
      </div>
    </div>
  );
}

export default function GalaAdmin({ g }) {
  const {
    selectedEvent, performances, criteria, judges, activeJudges, scores, ranking,
    expectedCount, receivedCount, working, actions,
  } = g;
  const [tab, setTab] = useState('overview');
  const [newPerf, setNewPerf] = useState(EMPTY_PERF);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [q, setQ] = useState('');
  const { staff, byId } = useStaffDirectory(judges.map((j) => j.user_id));

  const ev = selectedEvent;
  const progress = expectedCount ? Math.min(100, Math.round((receivedCount / expectedCount) * 100)) : 0;
  const hasScores = scores.length > 0;
  const locked = hasScores || !!ev?.published;
  const nameOf = (id) => byId[id]?.full_name || `Tài khoản ${String(id).slice(0, 8)}…`;
  const judgeIds = new Set(judges.map((j) => j.user_id));
  const matches = q.trim().length < 1 ? [] : staff
    .filter((s) => !judgeIds.has(s.id))
    .filter((s) => norm(`${s.full_name} ${s.employee_id || ''} ${s.position || ''}`).includes(norm(q)))
    .slice(0, 12);

  const publish = () => {
    if (expectedCount && receivedCount < expectedCount) setConfirmPublish(true);
    else actions.eventAction('publish');
  };
  const submitNew = async () => { if (await actions.addPerformance(newPerf)) setNewPerf(EMPTY_PERF); };
  const saveEdit = async () => { if (await actions.updatePerformance(editing)) setEditing(null); };

  return (
    <div className="space-y-4">
      <div className="e-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`e-tab ${tab === id ? 'e-tab-active' : ''}`}>
            <Icon /> {label}
            {id === 'performances' && <span className="e-tab-count">{performances.length}</span>}
            {id === 'judges' && <span className="e-tab-count">{activeJudges.length}</span>}
          </button>
        ))}
      </div>

      {/* ===== TỔNG QUAN ===== */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="e-metric flex-col items-stretch">
              <div className="flex items-center gap-3">
                <div className="e-metric-icon"><ClipboardCheck /></div>
                <div className="min-w-0">
                  <div className="e-metric-label">Tiến độ chấm</div>
                  <div className="e-metric-value">{progress}%</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <Metric icon={Mic2} label="Tiết mục" value={pad2(performances.length)} hint="Đã đăng ký" tone="e-tone-rose" />
            <Metric icon={Users} label="Giám khảo" value={pad2(activeJudges.length)} hint="Đang được cấp quyền" tone="e-tone-lavender" />
            <Metric icon={ListChecks} label="Phiếu chấm" value={`${receivedCount}/${expectedCount}`} hint="Đã nhận / cần có" tone="e-tone-peach" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <section className="e-card e-card-pad">
              <div className="e-card-header">
                <div>
                  <div className="e-card-title">Điều khiển cuộc thi</div>
                  <div className="e-card-sub">Mở / dừng / khoá chấm và công bố kết quả</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="e-btn e-btn-primary" disabled={working || ev?.phase === 'scoring' || ev?.published} onClick={() => actions.eventAction('open')}>
                  <Play /> {ev?.phase === 'scoring' ? 'Đang mở chấm' : ev?.phase === 'draft' ? 'Mở chấm điểm' : 'Mở chấm lại'}
                </button>
                <button type="button" className="e-btn e-btn-secondary" disabled={working || ev?.phase !== 'scoring'} onClick={() => actions.eventAction('pause')}>
                  <Pause /> Tạm dừng
                </button>
                <button type="button" className="e-btn e-btn-secondary" disabled={working || ev?.phase === 'closed'} onClick={() => actions.eventAction('close')}>
                  <Lock /> Khoá chấm
                </button>
                <button type="button" className="e-btn text-amber-900 bg-amber-100 hover:bg-amber-200" disabled={working || ev?.published || receivedCount === 0} onClick={publish}>
                  <Trophy /> Công bố
                </button>
              </div>
              {ev?.published && (
                <button type="button" className="e-btn e-btn-ghost e-btn-sm mt-3" disabled={working} onClick={() => actions.eventAction('unpublish')}>
                  <EyeOff /> Ẩn kết quả để rà soát
                </button>
              )}
              <p className="mt-3 text-[12.5px] text-slate-500 leading-relaxed">
                Trước khi công bố, điểm tổng hợp chỉ Ban tổ chức thấy. Công bố khi còn thiếu phiếu cần xác nhận "công bố tạm tính".
              </p>
            </section>

            <section className="e-card e-card-pad">
              <div className="e-card-header">
                <div>
                  <div className="e-card-title">Bảng xếp hạng trực tiếp</div>
                  <div className="e-card-sub">Tự làm mới mỗi 12 giây</div>
                </div>
                <button type="button" className="e-btn e-btn-secondary e-btn-sm" disabled={!hasScores}
                  onClick={() => exportScoresCsv({ eventTitle: ev?.title, scores, performances, criteria, nameOf })}>
                  <Download /> Xuất CSV
                </button>
              </div>
              <RankingList ranking={ranking} showVotes />
            </section>
          </div>

          <section className="e-card e-card-pad">
            <div className="e-card-title mb-3">Thang điểm (tổng 100)</div>
            <div className="flex flex-wrap gap-2">
              {criteria.map((c) => (
                <span key={c.id} className="e-badge e-tone-brand">{c.label} · {Number(c.max_points)}đ</span>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ===== TIẾT MỤC ===== */}
      {tab === 'performances' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <section className="e-card e-card-pad">
            <div className="e-card-header">
              <div className="e-card-title">Danh sách tiết mục</div>
              <span className="e-badge e-badge-sm e-tone-neutral">{performances.length} tiết mục</span>
            </div>
            {locked && (
              <div className="e-alert e-alert-warning text-sm mb-3">Đã có điểm hoặc đã công bố — không sửa / thêm / xoá tiết mục được nữa.</div>
            )}
            {performances.length ? (
              <ul className="divide-y divide-slate-100">
                {performances.map((p) => {
                  const scored = scores.some((s) => s.performance_id === p.id);
                  return (
                    <li key={p.id} className="flex items-start gap-3 py-3">
                      <span className="w-9 text-[20px] font-bold text-teal-600 tabular-nums shrink-0">{pad2(p.order_no)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800">{p.title}</div>
                        <div className="text-[12.5px] text-slate-500">{p.team_name}{p.duration_minutes ? ` · ${p.duration_minutes} phút` : ''}</div>
                        {p.description && <div className="text-[12.5px] text-slate-400 mt-0.5">{p.description}</div>}
                      </div>
                      <span className={`e-badge e-badge-sm hidden sm:inline-flex ${scored ? 'e-tone-success' : 'e-tone-neutral'}`}>{scored ? 'Đã có điểm' : 'Chưa chấm'}</span>
                      <button type="button" className="e-icon-btn w-9 h-9" title="Sửa" disabled={locked} onClick={() => setEditing({ ...p })}><Pencil className="w-4 h-4" /></button>
                      <button type="button" className="e-icon-btn w-9 h-9 hover:text-danger-600" title="Xoá" disabled={locked} onClick={() => setToDelete(p)}><Trash2 className="w-4 h-4" /></button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={Mic2} title="Chưa có tiết mục" description="Thêm tiết mục đầu tiên ở khung bên cạnh." />
            )}
          </section>

          <section className="e-card e-card-pad space-y-3">
            <div className="e-card-title">Thêm tiết mục</div>
            <div>
              <label className="e-label" htmlFor="gp-title">Tên tiết mục</label>
              <input id="gp-title" className="e-input" placeholder="VD: Một năm rực rỡ" value={newPerf.title}
                onChange={(e) => setNewPerf({ ...newPerf, title: e.target.value })} />
            </div>
            <div>
              <label className="e-label" htmlFor="gp-team">Đội / Phòng ban</label>
              <input id="gp-team" className="e-input" list="gala-team-suggestions" placeholder="Chọn hoặc tự nhập" value={newPerf.team_name}
                onChange={(e) => setNewPerf({ ...newPerf, team_name: e.target.value })} />
              <datalist id="gala-team-suggestions">{TEAM_SUGGESTIONS.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
            <div>
              <label className="e-label" htmlFor="gp-dur">Thời lượng (phút) — tuỳ chọn</label>
              <input id="gp-dur" type="number" min="1" max="180" className="e-input" value={newPerf.duration_minutes}
                onChange={(e) => setNewPerf({ ...newPerf, duration_minutes: e.target.value })} />
            </div>
            <div>
              <label className="e-label" htmlFor="gp-desc">Mô tả / thành viên</label>
              <textarea id="gp-desc" rows={3} className="e-textarea" placeholder="Thể loại, thành viên biểu diễn…" value={newPerf.description}
                onChange={(e) => setNewPerf({ ...newPerf, description: e.target.value })} />
            </div>
            <button type="button" className="e-btn e-btn-primary e-btn-block" disabled={working || locked} onClick={submitNew}>
              <Plus /> Thêm vào danh sách
            </button>
            <p className="text-[12px] text-slate-400">Mỗi tiết mục chấm độc lập. Một đội có thể có nhiều tiết mục.</p>
          </section>
        </div>
      )}

      {/* ===== GIÁM KHẢO ===== */}
      {tab === 'judges' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
          <section className="e-card e-card-pad">
            <div className="e-card-header">
              <div className="e-card-title">Danh sách giám khảo</div>
              <span className="e-badge e-badge-sm e-tone-success">{activeJudges.length} đang hoạt động</span>
            </div>
            {judges.length ? (
              <ul className="divide-y divide-slate-100">
                {judges.map((j) => {
                  const p = byId[j.user_id];
                  const done = scores.filter((s) => s.judge_id === j.user_id).length;
                  return (
                    <li key={j.user_id} className="flex items-center gap-3 py-3 flex-wrap sm:flex-nowrap">
                      <Avatar person={p} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{nameOf(j.user_id)}</div>
                        <div className="text-[12px] text-slate-500 truncate">{p?.position || roleText(p) || '—'} · đã chấm {done}/{performances.length}</div>
                      </div>
                      <span className={`e-badge e-badge-sm ${j.active ? 'e-tone-success' : 'e-tone-neutral'}`}>{j.active ? 'Được phép chấm' : 'Đã thu hồi'}</span>
                      <button type="button" className={`e-btn e-btn-sm ${j.active ? 'e-btn-danger-soft' : 'e-btn-outline'}`} disabled={working}
                        onClick={() => actions.setJudge(j.user_id, !j.active, nameOf(j.user_id))}>
                        {j.active ? <><UserMinus /> Thu hồi</> : <><RotateCcw /> Cấp lại</>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={Users} title="Chưa có giám khảo" description="Tìm nhân sự ở khung bên cạnh để cấp quyền chấm." />
            )}
            <p className="mt-3 text-[12px] text-slate-400">Thu hồi quyền: phiếu cũ vẫn lưu để đối soát nhưng không tính vào xếp hạng.</p>
          </section>

          <section className="e-card e-card-pad">
            <div className="e-card-title">Chỉ định giám khảo</div>
            <div className="e-card-sub mb-3">Tìm theo tên / mã nhân viên trong app. Quyền chỉ áp dụng cho chương trình này.</div>
            <div className="e-search">
              <Search />
              <input placeholder="Tìm nhân sự…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="mt-2 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {matches.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <Avatar person={s} size="w-9 h-9" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-slate-800 truncate">{s.full_name}</div>
                    <div className="text-[12px] text-slate-500 truncate">{s.position || roleText(s)}{s.employee_id ? ` · ${s.employee_id}` : ''}</div>
                  </div>
                  <button type="button" className="e-btn e-btn-outline e-btn-sm" disabled={working}
                    onClick={async () => { if (await actions.setJudge(s.id, true, s.full_name)) setQ(''); }}>
                    <UserPlus /> Cấp quyền
                  </button>
                </li>
              ))}
              {q.trim() && !matches.length && <li className="py-4 text-center text-sm text-slate-400">Không tìm thấy nhân sự phù hợp.</li>}
            </ul>
          </section>
        </div>
      )}

      {/* ===== CÔNG BỐ ===== */}
      {tab === 'stage' && <GalaStage event={ev} ranking={ranking} />}

      {/* Sửa tiết mục */}
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Sửa tiết mục"
        footer={<>
          <button type="button" className="e-btn e-btn-secondary" onClick={() => setEditing(null)}>Huỷ</button>
          <button type="button" className="e-btn e-btn-primary" disabled={working} onClick={saveEdit}>Lưu thay đổi</button>
        </>}>
        {editing && (
          <div className="space-y-3">
            <div><label className="e-label">Tên tiết mục</label><input className="e-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><label className="e-label">Đội / Phòng ban</label><input className="e-input" list="gala-team-suggestions" value={editing.team_name} onChange={(e) => setEditing({ ...editing, team_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="e-label">Thứ tự diễn</label><input type="number" min="1" max="999" className="e-input" value={editing.order_no} onChange={(e) => setEditing({ ...editing, order_no: e.target.value })} /></div>
              <div><label className="e-label">Thời lượng (phút)</label><input type="number" min="1" max="180" className="e-input" value={editing.duration_minutes || ''} onChange={(e) => setEditing({ ...editing, duration_minutes: e.target.value })} /></div>
            </div>
            <div><label className="e-label">Mô tả</label><textarea rows={3} className="e-textarea" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} danger busy={working}
        title="Xoá tiết mục?" description={toDelete ? `"${toDelete.title}" — ${toDelete.team_name}` : ''} confirmLabel="Xoá"
        onConfirm={async () => { if (await actions.deletePerformance(toDelete.id)) setToDelete(null); }} />

      <ConfirmDialog open={confirmPublish} onClose={() => setConfirmPublish(false)} busy={working}
        title="Công bố kết quả tạm tính?"
        description={`Còn ${expectedCount - receivedCount} phiếu chưa chấm. Kết quả sẽ tính trên các phiếu đã có.`}
        confirmLabel="Vẫn công bố"
        onConfirm={async () => { if (await actions.eventAction('publish', true)) { setConfirmPublish(false); setTab('stage'); } }} />
    </div>
  );
}
