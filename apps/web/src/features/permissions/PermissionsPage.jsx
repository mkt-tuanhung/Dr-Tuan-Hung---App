// ============================================================
// PHÂN QUYỀN — kiểu Ethics BOS (Cài đặt › Quyền hạn người dùng)
//  1. Ma trận Vai trò × Chức năng: tick để cấp / thu hồi, BẮT BUỘC lý do,
//     ô khác mặc định tô vàng, chức năng nhạy cảm có khoá.
//  2. Người dùng & quyền: xem 1 nhân sự đang được mở những chức năng nào.
//  3. Nhật ký thay đổi: ai cấp / thu hồi gì, lúc nào, vì sao (chỉ ghi thêm).
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, ShieldCheck, Info, RotateCcw, X, History, Users, Grid3x3, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ROLE_LABELS, FULL_MENU, STAFF_GROUPS, groupIds, MATRIX_ROLES, SENSITIVE, flatModules, defaultGrant, effectiveGrant, overrideKey, userCanModule } from './menuConfig';
import { usePermissionOverrides } from './usePermissionOverrides';

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const ACTION_META = {
  grant: { label: 'Cấp quyền', cls: 'bg-emerald-50 text-emerald-700' },
  revoke: { label: 'Thu hồi', cls: 'bg-rose-50 text-rose-600' },
  reset: { label: 'Về mặc định', cls: 'bg-slate-100 text-slate-600' },
};

// Nhóm chức năng theo đúng nhóm trên sidebar nhân sự
const groupedModules = () => {
  const all = flatModules();
  const used = new Set();
  const groups = STAFF_GROUPS.map(g => {
    const items = groupIds(g).flatMap(id => {
      const m = FULL_MENU.find(x => x.id === id);
      if (!m) return [];
      return m.children ? m.children.map(c => ({ ...c, parent: m.label })) : [m];
    });
    items.forEach(i => used.add(i.id));
    return { title: g.title || 'CHUNG', items };
  });
  const rest = all.filter(m => !used.has(m.id));
  if (rest.length) groups.push({ title: 'KHÁC', items: rest });
  return groups;
};

const Tab = ({ active, onClick, icon: Icon, children }) => (
  <button onClick={onClick} className={`relative inline-flex items-center gap-1.5 px-3.5 h-11 text-[13.5px] font-semibold shrink-0 transition ${active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'}`}>
    <Icon className="w-4 h-4" />{children}
    {active && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-teal-600" />}
  </button>
);

export default function PermissionsPage() {
  const { profile: me } = useAuth();
  const [tab, setTab] = useState('matrix');
  const [overrides, reloadOverrides] = usePermissionOverrides({ withReload: true });
  const [staff, setStaff] = useState([]);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role, role_2, position, avatar_url, is_active').eq('is_active', true).order('full_name')
      .then(({ data }) => setStaff(data || []));
    // Kiểm tra đã chạy SQL tạo bảng chưa
    supabase.from('role_permissions').select('role', { head: true, count: 'exact' })
      .then(({ error }) => setTableMissing(!!error && /does not exist|PGRST205|42P01|schema cache/i.test(`${error.code} ${error.message}`)));
  }, []);

  const roleCount = useMemo(() => {
    const c = {};
    staff.forEach(s => [s.role, s.role_2].filter(Boolean).forEach(r => { c[r] = (c[r] || 0) + 1; }));
    return c;
  }, [staff]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft">
        <div className="px-5 pt-5 pb-1 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 grid place-items-center shrink-0"><ShieldCheck className="w-5 h-5" /></span>
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-slate-900">Quyền hạn người dùng</div>
            <div className="text-[13px] text-slate-500 mt-0.5">Admin cấp / thu hồi chức năng theo vai trò — bắt buộc ghi lý do và được lưu nhật ký. Chức năng nhạy cảm được đánh dấu khoá.</div>
          </div>
        </div>
        <div className="px-3 mt-2 flex gap-1 overflow-x-auto scrollbar-hide border-t border-slate-100">
          <Tab active={tab === 'matrix'} onClick={() => setTab('matrix')} icon={Grid3x3}>Ma trận vai trò × chức năng</Tab>
          <Tab active={tab === 'users'} onClick={() => setTab('users')} icon={Users}>Người dùng & quyền</Tab>
          <Tab active={tab === 'audit'} onClick={() => setTab('audit')} icon={History}>Nhật ký thay đổi</Tab>
        </div>
      </div>

      {tableMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-[13px] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>Chưa tạo bảng phân quyền trên máy chủ. Vui lòng chạy file <b>supabase/role_permissions.sql</b> trong Supabase › SQL Editor. Trong lúc chờ, hệ thống dùng quyền mặc định.</div>
        </div>
      )}

      {tab === 'matrix' && <Matrix me={me} overrides={overrides} reload={reloadOverrides} roleCount={roleCount} disabled={tableMissing} />}
      {tab === 'users' && <UsersTab staff={staff} overrides={overrides} />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

// ---------------- 1. MA TRẬN ----------------
function Matrix({ me, overrides, reload, roleCount, disabled }) {
  const [q, setQ] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [pending, setPending] = useState(null); // { role, m, next, reset? }
  const [mRole, setMRole] = useState(MATRIX_ROLES[0]); // vai trò đang xem trên mobile
  const groups = useMemo(groupedModules, []);
  const needle = fold(q.trim());

  const visibleGroups = groups.map(g => ({
    ...g,
    items: g.items.filter(m => (!needle || fold(`${m.label} ${m.parent || ''} ${m.id}`).includes(needle))
      && (!onlyChanged || MATRIX_ROLES.some(r => overrides.has(overrideKey(r, m.id))))),
  })).filter(g => g.items.length);
  const changedCount = overrides.size;

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 lg:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0 basis-full sm:basis-auto sm:min-w-[200px] max-w-sm max-sm:max-w-none">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm chức năng…" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[13.5px] outline-none focus:bg-white focus:border-teal-400" />
        </div>
        <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} className="accent-teal-600 w-4 h-4" />
          Chỉ hiện chức năng đã chỉnh {changedCount > 0 && <span className="text-amber-600 font-bold">({changedCount} ô)</span>}
        </label>
        <div className="sm:ml-auto flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />Khác mặc định</span>
          <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-amber-600" />Nhạy cảm</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-teal-50/50 px-3 py-2 text-[12px] text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
        <span>Ma trận quyết định <b>menu chức năng</b> mỗi vai trò nhìn thấy. Dữ liệu bên trong vẫn được máy chủ bảo vệ theo vai trò — nếu mở chức năng cho vai trò chưa có quyền dữ liệu, màn đó có thể hiển thị trống. Admin luôn toàn quyền.</span>
      </div>

      {/* MOBILE: chọn 1 vai trò -> danh sách chức năng có ô tích (không kéo ngang ma trận) */}
      <div className="lg:hidden space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5">
          {MATRIX_ROLES.map(r => (
            <button key={r} onClick={() => setMRole(r)} className={`e-chip shrink-0 ${mRole === r ? 'e-chip-active' : ''}`}>
              {ROLE_LABELS[r] || r}<span className="opacity-70 tabular-nums">{roleCount[r] || 0}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100">
          {visibleGroups.map(g => (
            <div key={g.title}>
              <div className="px-3 pt-3.5 pb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-slate-400 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-300" />{g.title}</div>
              {g.items.map(m => {
                const has = overrides.has(overrideKey(mRole, m.id));
                const granted = effectiveGrant(mRole, m, overrides);
                return (
                  <button key={m.id} disabled={disabled} onClick={() => setPending({ role: mRole, m, next: !granted, overridden: has })}
                    className={`w-full flex items-center gap-3 px-3 min-h-[52px] py-2 text-left border-t border-slate-50 disabled:cursor-not-allowed ${has ? 'bg-amber-50' : 'active:bg-teal-50'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[14px] font-medium text-slate-900">
                        {SENSITIVE.has(m.id) && <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-label="Nhạy cảm" />}
                        <span className="truncate">{m.parent ? `${m.parent} › ` : ''}{m.label}</span>
                      </div>
                      {has && <div className="text-[11.5px] text-amber-700">Khác mặc định</div>}
                    </div>
                    <span className={`w-[22px] h-[22px] rounded-[6px] grid place-items-center border-2 shrink-0 ${granted ? 'bg-teal-600 border-teal-600' : 'bg-white border-slate-300'}`}>
                      {granted && <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {visibleGroups.length === 0 && <div className="text-center py-10 text-slate-400 text-[13px]">Không có chức năng phù hợp</div>}
        </div>
      </div>

      <div className="overflow-auto max-h-[68dvh] rounded-xl border border-slate-200/80 hidden lg:block">
        <table className="border-separate border-spacing-0 text-[13px] w-full">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-slate-50 text-left px-3 py-2.5 border-b border-slate-200 min-w-[230px] font-semibold text-slate-700">Chức năng</th>
              {MATRIX_ROLES.map(r => (
                <th key={r} className="sticky top-0 z-20 bg-slate-50 px-2 py-2.5 border-b border-slate-200 min-w-[86px] text-center align-bottom">
                  <span className="block font-semibold text-slate-700 leading-tight">{ROLE_LABELS[r] || r}</span>
                  <small className="block text-[10.5px] font-normal text-slate-400 mt-0.5">{roleCount[r] || 0} người</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map(g => (
              <React.Fragment key={g.title}>
                <tr>
                  <td colSpan={MATRIX_ROLES.length + 1} className="sticky left-0 bg-white px-3 pt-4 pb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-slate-400 border-b border-slate-100">
                    <span className="inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-300" />{g.title}</span>
                  </td>
                </tr>
                {g.items.map(m => (
                  <tr key={m.id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        {SENSITIVE.has(m.id) && <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-label="Nhạy cảm" />}
                        <span className="truncate">{m.parent ? `${m.parent} › ` : ''}{m.label}</span>
                      </div>
                      <code className="text-[10.5px] text-slate-400 bg-slate-50 rounded px-1.5 py-0.5">{m.id}</code>
                    </td>
                    {MATRIX_ROLES.map(r => {
                      const has = overrides.has(overrideKey(r, m.id));
                      const granted = effectiveGrant(r, m, overrides);
                      return (
                        <td key={r} className="px-2 py-2 border-b border-slate-100 text-center group-hover:bg-slate-50">
                          <button disabled={disabled} onClick={() => setPending({ role: r, m, next: !granted, overridden: has })}
                            title={`${m.label} — ${ROLE_LABELS[r]}${has ? ' (đã chỉnh)' : ' (mặc định)'}`}
                            className={`inline-grid place-items-center w-8 h-8 rounded-lg transition disabled:cursor-not-allowed ${has ? 'bg-amber-100 ring-1 ring-amber-300' : 'hover:bg-teal-50'}`}>
                            <span className={`w-[18px] h-[18px] rounded-[5px] grid place-items-center border-2 transition ${granted ? 'bg-teal-600 border-teal-600' : 'bg-white border-slate-300'}`}>
                              {granted && <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {visibleGroups.length === 0 && <tr><td colSpan={MATRIX_ROLES.length + 1} className="text-center py-10 text-slate-400">Không có chức năng phù hợp</td></tr>}
          </tbody>
        </table>
      </div>

      {pending && <ConfirmChange me={me} pending={pending} people={roleCount[pending.role] || 0} overrides={overrides} onClose={() => setPending(null)} onDone={() => { setPending(null); reload(); }} />}
    </div>
  );
}

function ConfirmChange({ me, pending, people, onClose, onDone }) {
  const { role, m, next, overridden } = pending;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const def = defaultGrant(role, m);

  const apply = async (mode) => {
    if (reason.trim().length < 5) return toast.error('Nhập lý do (ít nhất 5 ký tự)');
    setSaving(true);
    const before = !next; // giá trị đang hiệu lực
    const after = mode === 'reset' ? def : next;
    // Trùng mặc định -> xoá ô ghi đè cho gọn; khác mặc định -> lưu ô ghi đè
    const { error } = after === def
      ? await supabase.from('role_permissions').delete().eq('role', role).eq('module', m.id)
      : await supabase.from('role_permissions').upsert({ role, module: m.id, granted: after, updated_by: me?.id, updated_at: new Date().toISOString() }, { onConflict: 'role,module' });
    if (error) { setSaving(false); return toast.error('Lỗi: ' + error.message); }
    const { error: auditErr } = await supabase.from('permission_audit').insert({
      actor_id: me?.id, action: mode === 'reset' ? 'reset' : (after ? 'grant' : 'revoke'),
      role, module: m.id, before_val: before, after_val: after, reason: reason.trim(),
    });
    setSaving(false);
    if (auditErr) toast.warning('Đã đổi quyền nhưng chưa ghi được nhật ký: ' + auditErr.message);
    else toast.success(mode === 'reset' ? 'Đã khôi phục quyền mặc định' : (after ? 'Đã cấp quyền' : 'Đã thu hồi quyền'));
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-float p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[17px] font-bold text-slate-900">{next ? 'Cấp quyền' : 'Thu hồi quyền'}</div>
            <div className="text-[13px] text-slate-500 mt-1">
              <b className="text-slate-800">{m.parent ? `${m.parent} › ` : ''}{m.label}</b> — {ROLE_LABELS[role]}. Áp dụng ngay cho <b>{people}</b> người có vai trò này.
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {SENSITIVE.has(m.id) && next && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px] px-3 py-2 flex gap-2"><Lock className="w-4 h-4 shrink-0 mt-0.5" />Chức năng nhạy cảm (tài chính / lương). Cân nhắc kỹ trước khi cấp.</div>
        )}
        <div className="mt-3 text-[12px] text-slate-500">Mặc định của vai trò: <b className="text-slate-700">{def ? 'Được dùng' : 'Không được dùng'}</b>{overridden && <span className="text-amber-600"> · đang chỉnh khác mặc định</span>}</div>
        <label className="block mt-3 text-[12.5px] font-semibold text-slate-600">Lý do <span className="text-rose-500">*</span></label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus placeholder="VD: Telesale cần xem doanh thu để đối soát hoa hồng"
          className="mt-1 w-full px-3 py-2 text-[13px] rounded-xl border border-slate-200 outline-none focus:border-teal-400" />
        <div className="mt-4 flex items-center gap-2">
          {overridden && (
            <button onClick={() => apply('reset')} disabled={saving} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5" />Về mặc định</button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="h-10 px-4 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
            <button onClick={() => apply('set')} disabled={saving || reason.trim().length < 5}
              className={`h-10 px-4 rounded-xl text-white text-[13.5px] font-semibold disabled:opacity-40 ${next ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-500 hover:bg-rose-600'}`}>
              {saving ? 'Đang lưu…' : next ? 'Cấp quyền' : 'Thu hồi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 2. NGƯỜI DÙNG & QUYỀN ----------------
function UsersTab({ staff, overrides }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const modules = useMemo(flatModules, []);
  const needle = fold(q.trim());
  const rows = staff.filter(s => s.role !== 'admin' && (!needle || fold(`${s.full_name} ${ROLE_LABELS[s.role] || ''} ${ROLE_LABELS[s.role_2] || ''} ${s.position || ''}`).includes(needle)));
  const countFor = (s) => modules.filter(m => userCanModule(s, m, overrides)).length;
  const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 lg:p-5">
      <div className="relative max-w-sm mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên, vai trò, chức vụ…" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[13.5px] outline-none focus:bg-white focus:border-teal-400" />
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(s => (
          <button key={s.id} onClick={() => setOpen(s)} className="w-full flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-slate-50 text-left">
            {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center text-[12px] font-bold">{initials(s.full_name)}</span>}
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-slate-900 truncate">{s.full_name}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {[s.role, s.role_2].filter(Boolean).map(r => <span key={r} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{ROLE_LABELS[r] || r}</span>)}
                {s.position && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{s.position}</span>}
              </div>
            </div>
            <span className="text-[12.5px] text-slate-500 shrink-0"><b className="text-slate-900">{countFor(s)}</b> chức năng</span>
          </button>
        ))}
        {rows.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Không có nhân sự phù hợp</div>}
      </div>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(null)} />
          <aside className="absolute bg-white shadow-float flex flex-col inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:max-h-none lg:rounded-none lg:rounded-l-3xl">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[18px] font-bold text-slate-900 truncate">{open.full_name}</div>
                <div className="text-[12.5px] text-slate-500 mt-0.5">{[open.role, open.role_2].filter(Boolean).map(r => ROLE_LABELS[r] || r).join(' + ')}{open.position ? ` · ${open.position}` : ''}</div>
              </div>
              <button onClick={() => setOpen(null)} className="w-9 h-9 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {groupedModules().map(g => (
                <div key={g.title} className="mb-3">
                  <div className="text-[10.5px] font-bold tracking-[0.08em] text-slate-400 mb-1">{g.title}</div>
                  {g.items.map(m => {
                    const ok = userCanModule(open, m, overrides);
                    const changed = [open.role, open.role_2].filter(Boolean).some(r => overrides.has(overrideKey(r, m.id)));
                    return (
                      <div key={m.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-teal-500' : 'bg-slate-200'}`} />
                        <span className={ok ? 'text-slate-800 font-medium' : 'text-slate-400'}>{m.parent ? `${m.parent} › ` : ''}{m.label}</span>
                        {changed && <span className="ml-auto text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">đã chỉnh</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="text-[11.5px] text-slate-400 mt-2">Muốn đổi vai trò của nhân sự: vào Quản lý Nhân sự › sửa hồ sơ. Muốn đổi chức năng theo vai trò: dùng tab Ma trận.</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// ---------------- 3. NHẬT KÝ ----------------
function AuditTab() {
  const [rows, setRows] = useState(null);
  const modules = useMemo(() => Object.fromEntries(flatModules().map(m => [m.id, m])), []);
  useEffect(() => {
    supabase.from('permission_audit').select('*, actor:profiles!actor_id(full_name)').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows(data || []));
  }, []);
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 lg:p-5">
      {rows === null ? <div className="py-10 grid place-items-center"><div className="w-6 h-6 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
        : rows.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">Chưa có thay đổi phân quyền nào</div> : (
          <div className="divide-y divide-slate-100">
            {rows.map(r => {
              const a = ACTION_META[r.action] || ACTION_META.reset; const m = modules[r.module];
              return (
                <div key={r.id} className="py-3 flex items-start gap-3">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${a.cls}`}>{a.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] text-slate-900"><b>{m ? `${m.parent ? m.parent + ' › ' : ''}${m.label}` : r.module}</b> — {ROLE_LABELS[r.role] || r.role}</div>
                    <div className="text-[12.5px] text-slate-600 mt-0.5 break-words">“{r.reason}”</div>
                    <div className="text-[11.5px] text-slate-400 mt-0.5">{r.actor?.full_name || 'Admin'} · {new Date(r.created_at).toLocaleString('vi-VN')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
