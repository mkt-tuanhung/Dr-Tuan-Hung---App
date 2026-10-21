// ============================================================
// MARKETING WORKSPACE — THÀNH VIÊN & CẤU HÌNH (S19 + một phần S20)
// - Thành viên workspace: thêm từ danh sách nhân sự CÓ SẴN (bảng profiles) — không tạo tài khoản mới.
// - Người duyệt (bác sĩ / marketing / pháp lý-consent / người đăng): CHỈ Admin cấp. Admin không tự động là người duyệt y khoa.
// - Nhãn, board (đổi tên / lưu trữ / khôi phục), thông tin workspace.
// Database kiểm tra lại mọi thao tác (RLS + trigger) — ẩn nút chỉ để dễ dùng.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, Plus, ShieldCheck, Users, Tag, Columns3, Settings2, Archive, RotateCcw } from 'lucide-react';
import { ErrorState } from '@/components/ds';
import { mwApi } from './mwApi';
import { WS_ROLES, REVIEWER_KIND, LABEL_COLORS, isAdminProfile, describeActivity, fmtDateTime } from './mwMeta';
import { Avatar, Field, Skeleton, Tone, attempt, BusyButton, Sel } from './mwUi';

const Card = ({ icon: Icon, title, desc, children, action }) => (
  <section className="e-card e-card-pad">
    <div className="flex items-start gap-3 mb-3">
      <span className="e-metric-icon !w-10 !h-10 e-tone-brand"><Icon /></span>
      <div className="min-w-0 flex-1"><div className="e-card-title">{title}</div>{desc && <div className="e-card-sub">{desc}</div>}</div>
      {action}
    </div>
    {children}
  </section>
);

export default function SettingsSection({ ws, perm, profile, staff, staffById, boards, labels, reloadAll }) {
  const [members, setMembers] = useState(null);
  const [reviewers, setReviewers] = useState(null);
  const [activity, setActivity] = useState([]);
  const [err, setErr] = useState(null);
  const admin = isAdminProfile(profile);
  const load = useCallback(async () => {
    try {
      const [m, r, a] = await Promise.all([mwApi.members(ws.id), mwApi.reviewers(), mwApi.wsActivity([ws.id], new Date(Date.now() - 30 * 86400000).toISOString())]);
      setMembers(m); setReviewers(r); setActivity(a.filter(x => ['member', 'workspace', 'board', 'publication', 'approval', 'approval_step', 'consent'].includes(x.entity)).slice(0, 60)); setErr(null);
    } catch (e) { setErr(e); }
  }, [ws.id]);
  useEffect(() => { load(); }, [load]);

  const [add, setAdd] = useState({ user: '', role: 'editor' });
  const [rv, setRv] = useState({ user: '', kind: 'medical' });
  const [lbl, setLbl] = useState({ name: '', color: LABEL_COLORS[0] });
  const [info, setInfo] = useState({ name: ws.name, description: ws.description || '', color: ws.color });
  useEffect(() => { setInfo({ name: ws.name, description: ws.description || '', color: ws.color }); }, [ws]);
  const [tgOn, setTgOn] = useState(!!ws.tg_media);
  useEffect(() => { setTgOn(!!ws.tg_media); }, [ws]);

  if (err) return <div className="e-card"><ErrorState description={err.message} onRetry={load} /></div>;
  if (!members) return <div className="e-card e-card-pad"><Skeleton rows={6} /></div>;
  const memberIds = new Set(members.map(m => m.user_id));
  const activeStaff = staff.filter(s => s.is_active !== false && s.employment_status !== 'inactive');
  const name = (id) => staffById.get(id)?.full_name || 'Không rõ';

  return (
    <div className="grid gap-4 xl:grid-cols-2 items-start">
      <Card icon={Users} title="Thành viên workspace" desc="Chỉ thành viên mới xem được board, thẻ, nội dung của workspace này. Gỡ thành viên -> mất quyền ngay.">
        <ul className="divide-y divide-slate-100">
          {members.map(m => (
            <li key={m.user_id} className="flex items-center gap-3 py-2.5">
              <Avatar person={staffById.get(m.user_id)} size={32} />
              <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-slate-800 truncate">{name(m.user_id)}</div><div className="text-[12px] text-slate-400">{staffById.get(m.user_id)?.role}</div></div>
              {perm.manage && m.role !== 'owner' ? (
                <Sel wrapClass="!min-w-[140px]" className="!h-9" value={m.role} aria-label={`Vai trò của ${name(m.user_id)}`}
                  onChange={async e => { if (await attempt(() => mwApi.setMemberRole(ws.id, m.user_id, e.target.value), 'Đã đổi vai trò')) load(); }}>
                  {['manager', 'editor', 'viewer'].map(r => <option key={r} value={r}>{WS_ROLES[r].label}</option>)}
                </Sel>
              ) : <Tone meta={WS_ROLES[m.role]} />}
              {perm.manage && m.role !== 'owner' && (
                <BusyButton className="e-icon-btn w-9 h-9" title="Gỡ khỏi workspace" onClick={async () => { if (await attempt(() => mwApi.removeMember(ws.id, m.user_id), 'Đã gỡ thành viên')) load(); }}><Trash2 className="w-4 h-4" /></BusyButton>
              )}
            </li>
          ))}
        </ul>
        {perm.manage && (
          <div className="grid sm:grid-cols-[1fr_150px_auto] gap-2 mt-3">
            <select className="e-input" value={add.user} onChange={e => setAdd(a => ({ ...a, user: e.target.value }))} aria-label="Chọn nhân sự">
              <option value="">Chọn nhân sự…</option>
              {activeStaff.filter(s => !memberIds.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
            </select>
            <select className="e-input" value={add.role} onChange={e => setAdd(a => ({ ...a, role: e.target.value }))} aria-label="Vai trò">
              {['manager', 'editor', 'viewer'].map(r => <option key={r} value={r}>{WS_ROLES[r].label}</option>)}
            </select>
            <BusyButton disabled={!add.user} onClick={async () => { if (await attempt(() => mwApi.addMember(ws.id, add.user, add.role), 'Đã thêm thành viên')) { setAdd({ user: '', role: 'editor' }); load(); reloadAll(); } }}><Plus /> Thêm</BusyButton>
          </div>
        )}
        <p className="text-[12px] text-slate-400 mt-2">Chủ workspace / Admin mới cấp được vai trò Quản lý. Thực hiện = tạo/sửa thẻ, nội dung. Chỉ xem = không sửa.</p>
      </Card>

      <Card icon={ShieldCheck} title="Người duyệt & người đăng" desc="Áp dụng cho mọi workspace. Chỉ Admin cấp. Admin KHÔNG mặc định là người duyệt chuyên môn — phải được cấp như mọi người.">
        <ul className="divide-y divide-slate-100">
          {reviewers.length === 0 && <li className="py-2 text-[13px] text-slate-400">Chưa cấp ai — nội dung gửi duyệt sẽ không có người xử lý.</li>}
          {reviewers.map(r => (
            <li key={r.user_id + r.kind} className="flex items-center gap-3 py-2.5">
              <Avatar person={staffById.get(r.user_id)} size={30} />
              <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-800 truncate">{name(r.user_id)}</span>
              <span className="e-badge e-badge-sm e-tone-lavender">{REVIEWER_KIND[r.kind]}</span>
              {admin && <BusyButton className="e-icon-btn w-9 h-9" title="Thu hồi" onClick={async () => { if (await attempt(() => mwApi.removeReviewer(r.user_id, r.kind), 'Đã thu hồi quyền duyệt')) load(); }}><Trash2 className="w-4 h-4" /></BusyButton>}
            </li>
          ))}
        </ul>
        {admin && (
          <div className="grid sm:grid-cols-[1fr_190px_auto] gap-2 mt-3">
            <select className="e-input" value={rv.user} onChange={e => setRv(v => ({ ...v, user: e.target.value }))} aria-label="Chọn người duyệt">
              <option value="">Chọn nhân sự…</option>
              {activeStaff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
            </select>
            <select className="e-input" value={rv.kind} onChange={e => setRv(v => ({ ...v, kind: e.target.value }))} aria-label="Loại duyệt">
              {Object.entries(REVIEWER_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <BusyButton disabled={!rv.user} onClick={async () => { if (await attempt(() => mwApi.addReviewer(rv.user, rv.kind), 'Đã cấp quyền')) { setRv(v => ({ ...v, user: '' })); load(); } }}><Plus /> Cấp</BusyButton>
          </div>
        )}
      </Card>

      <Card icon={Tag} title="Nhãn" desc="Dùng chung cho mọi board trong workspace.">
        <div className="flex flex-wrap gap-1.5">
          {labels.length === 0 && <span className="text-[13px] text-slate-400">Chưa có nhãn.</span>}
          {labels.map(l => (
            <span key={l.id} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full text-[12px] font-semibold text-white" style={{ background: l.color }}>
              {l.name}
              {perm.manage && <button type="button" className="w-5 h-5 grid place-items-center rounded-full hover:bg-black/15" aria-label={`Xoá nhãn ${l.name}`} onClick={async () => { if (await attempt(() => mwApi.deleteLabel(l.id), 'Đã xoá nhãn')) reloadAll(); }}><Trash2 className="w-3 h-3" /></button>}
            </span>
          ))}
        </div>
        {perm.edit && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input className="e-input flex-1 min-w-[160px]" placeholder="Tên nhãn" value={lbl.name} maxLength={40} onChange={e => setLbl(v => ({ ...v, name: e.target.value }))} aria-label="Tên nhãn" />
            <div className="flex gap-1">{LABEL_COLORS.map(c => <button key={c} type="button" onClick={() => setLbl(v => ({ ...v, color: c }))} aria-label={`Màu ${c}`} aria-pressed={lbl.color === c} className={`w-7 h-7 rounded-full border-2 ${lbl.color === c ? 'border-slate-800' : 'border-white'}`} style={{ background: c }} />)}</div>
            <BusyButton disabled={!lbl.name.trim()} onClick={async () => { if (await attempt(() => mwApi.createLabel(ws.id, lbl.name.trim(), lbl.color), 'Đã thêm nhãn')) { setLbl(v => ({ ...v, name: '' })); reloadAll(); } }}><Plus /> Thêm nhãn</BusyButton>
          </div>
        )}
      </Card>

      <Card icon={Columns3} title="Board" desc="Đổi tên, lưu trữ / khôi phục board.">
        <ul className="divide-y divide-slate-100">
          {boards.map(b => <BoardRow key={b.id} b={b} perm={perm} onDone={reloadAll} />)}
        </ul>
      </Card>

      <Card icon={Settings2} title="Thông tin workspace">
        <div className="space-y-3">
          <Field label="Tên" required><input className="e-input" value={info.name} disabled={!perm.manage} maxLength={120} onChange={e => setInfo(v => ({ ...v, name: e.target.value }))} /></Field>
          <Field label="Mô tả"><textarea className="e-textarea" value={info.description} disabled={!perm.manage} maxLength={2000} onChange={e => setInfo(v => ({ ...v, description: e.target.value }))} /></Field>
          <div className="flex gap-1">{LABEL_COLORS.map(c => <button key={c} type="button" disabled={!perm.manage} onClick={() => setInfo(v => ({ ...v, color: c }))} aria-label={`Màu ${c}`} aria-pressed={info.color === c} className={`w-7 h-7 rounded-full border-2 ${info.color === c ? 'border-slate-800' : 'border-white'}`} style={{ background: c }} />)}</div>
          {'tg_media' in ws && (
            <label className="flex items-start gap-2 text-[13px] text-slate-600">
              <input type="checkbox" className="e-checkbox mt-0.5" checked={tgOn} disabled={!perm.manage}
                onChange={async e => { const on = e.target.checked; setTgOn(on); if (await attempt(() => mwApi.updateWorkspace(ws.id, { tg_media: on }), on ? 'Đã bật báo về nhóm Telegram Media' : 'Đã tắt báo về nhóm Telegram Media')) reloadAll(); else setTgOn(!on); }} />
              <span>Báo mọi thay đổi của workspace về <b>nhóm Telegram Media</b> (order mới, chuyển cột, giao việc, @nhắc tên, chat, duyệt…)</span>
            </label>
          )}
          {perm.manage && (
            <div className="flex flex-wrap gap-2">
              <BusyButton disabled={!info.name.trim()} onClick={async () => { if (await attempt(() => mwApi.updateWorkspace(ws.id, { name: info.name.trim(), description: info.description.trim() || null, color: info.color }), 'Đã lưu')) reloadAll(); }}>Lưu thông tin</BusyButton>
              {ws.archived_at
                ? <BusyButton className="e-btn e-btn-secondary" onClick={async () => { if (await attempt(() => mwApi.updateWorkspace(ws.id, { archived_at: null }), 'Đã khôi phục workspace')) reloadAll(); }}><RotateCcw /> Hiện lại workspace</BusyButton>
                : <BusyButton className="e-btn e-btn-ghost text-danger-600" onClick={async () => { if (!window.confirm(`Ẩn workspace “${ws.name}”? Mọi người sẽ không thấy trong danh sách (dữ liệu giữ nguyên, hiện lại được).`)) return; if (await attempt(() => mwApi.updateWorkspace(ws.id, { archived_at: new Date().toISOString() }), 'Đã ẩn workspace')) reloadAll(); }}><Archive /> Ẩn workspace</BusyButton>}
            </div>
          )}
        </div>
      </Card>


      <Card icon={ShieldCheck} title="Nhật ký quản trị 30 ngày" desc="Thành viên, board, duyệt, consent, xuất bản — chỉ ghi thêm, không sửa / xoá được.">
        <ol className="space-y-2 max-h-[360px] overflow-y-auto">
          {activity.length === 0 && <li className="text-[13px] text-slate-400">Chưa có.</li>}
          {activity.map(a => (
            <li key={a.id} className="text-[12.5px]"><b className="text-slate-700">{name(a.actor_id)}</b> <span className="text-slate-600">{describeActivity(a, name)}</span> <span className="text-slate-400">· {fmtDateTime(a.created_at)}</span></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function BoardRow({ b, perm, onDone }) {
  const [n, setN] = useState(b.name);
  useEffect(() => { setN(b.name); }, [b.name]);
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.color }} />
      <input className="e-input h-9 flex-1" value={n} disabled={!perm.manage} maxLength={120} aria-label="Tên board" onChange={e => setN(e.target.value)}
        onBlur={async () => { const v = n.trim(); if (v && v !== b.name) { if (await attempt(() => mwApi.updateBoard(b.id, { name: v }), 'Đã đổi tên board')) onDone(); } else setN(b.name); }} />
      {b.archived_at && <span className="e-badge e-badge-sm e-tone-neutral">Lưu trữ</span>}
      {perm.manage && (b.archived_at
        ? <BusyButton className="e-btn e-btn-secondary e-btn-sm" onClick={async () => { if (await attempt(() => mwApi.updateBoard(b.id, { archived_at: null }), 'Đã khôi phục board')) onDone(); }}><RotateCcw /> Khôi phục</BusyButton>
        : <BusyButton className="e-btn e-btn-ghost e-btn-sm" onClick={async () => { if (await attempt(() => mwApi.updateBoard(b.id, { archived_at: new Date().toISOString() }), 'Đã lưu trữ board')) onDone(); }}><Archive /> Lưu trữ</BusyButton>)}
    </li>
  );
}
