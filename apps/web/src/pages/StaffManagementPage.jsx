import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { uploadToR2 } from '@/lib/r2Client';
import { APP_URL } from '@/lib/appUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Search, UserCheck, Pencil, UserX, QrCode, LogIn, Trash2, Users, Clock, BadgeCheck, ChevronRight, UserPlus, Phone, X } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

const avInit = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

// Format số tiền VND có dấu chấm
const fmtInput = (val) => {
  const num = String(val || '').replace(/\D/g, '');
  return num ? new Intl.NumberFormat('vi-VN').format(num) : '';
};
const parseInput = (val) => Number(String(val || '').replace(/\D/g, '')) || 0;

const ROLES = [
  { value: 'telesale',     label: 'Telesale' },
  { value: 'sale_offline', label: 'Sale Offline' },
  { value: 'cskh',         label: 'CSKH' },
  { value: 'truc_page',    label: 'Trực Page' },
  { value: 'media',        label: 'Media' },
  { value: 'editor',       label: 'Editor' },
  { value: 'designer',     label: 'Designer' },
  { value: 'marketing',    label: 'Marketing' },
  { value: 'seeding',      label: 'Seeding' },
  { value: 'dieu_duong',   label: 'Điều dưỡng' },
  { value: 'bac_si',       label: 'Bác sĩ' },
  { value: 'accountant',   label: 'Kế toán' },
  { value: 'shareholder',  label: 'Cổ đông' },
  { value: 'admin',        label: 'Admin' },
];

const ROLE_LABELS = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

const ROLE_COLORS = {
  admin:        'e-tone-rose',
  accountant:   'e-tone-info',
  shareholder:  'e-tone-lavender',
  telesale:     'e-tone-success',
  sale_offline: 'e-tone-peach',
  cskh:         'e-tone-warning',
  truc_page:    'e-tone-rose',
  media:        'e-tone-sky',
  editor:       'e-tone-brand',
  designer:     'e-tone-lavender',
  marketing:    'e-tone-info',
  seeding:      'e-tone-success',
  dieu_duong:   'e-tone-brand',
  bac_si:       'e-tone-sky',
};

const EMPTY_FORM = {
  employee_id: '', password: '', full_name: '', role: 'telesale', role_2: '',
  position: 'Nhân viên', base_salary: '', allowance: '', phone: '',
  employment_status: 'official', probation_started_at: '', fixed_salary: false,
};

const StaffManagementPage = ({ isNested = false }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [viewQR, setViewQR] = useState(null);
  // Điện thoại (Ethics "Nhân sự & tài khoản"): lọc nhanh + bảng thao tác theo từng người
  const [mFilter, setMFilter] = useState('all');
  const [sheet, setSheet] = useState(null);

  const loadStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Không tải được danh sách nhân sự: ' + error.message);
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => { loadStaff(); }, []);

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const M_FILTERS = [
    { id: 'all', label: 'Tất cả', test: () => true },
    { id: 'active', label: 'Đang làm', test: (s) => s.is_active },
    { id: 'probation', label: 'Thử việc', test: (s) => s.is_active && s.employment_status === 'probation' },
    { id: 'locked', label: 'Đã khoá', test: (s) => !s.is_active },
  ];
  const mTest = (M_FILTERS.find(f => f.id === mFilter) || M_FILTERS[0]).test;
  const mList = filtered.filter(mTest);
  const mCount = (id) => staff.filter(M_FILTERS.find(f => f.id === id).test).length;
  const sheetAct = (fn) => () => { const s = sheet; setSheet(null); fn(s); };

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setAvatarFile(null);
    setAvatarPreview(null);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({
      employee_id: s.employee_id,
      password: '',
      full_name: s.full_name,
      role: s.role,
      role_2: s.role_2 || '',
      position: s.position || 'Nhân viên',
      base_salary: s.base_salary || '',
      allowance: s.allowance || '',
      phone: s.phone || '',
      employment_status: s.employment_status || 'official',
      probation_started_at: s.probation_started_at || '',
      fixed_salary: s.fixed_salary || false,
    });
    setAvatarFile(null);
    setAvatarPreview(s.avatar_url || null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.full_name || !form.role) {
      toast.error('Vui lòng điền đầy đủ ID, họ tên và vị trí');
      return;
    }
    if (!editTarget && !form.password) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error('Mật khẩu phải từ 6 ký tự trở lên');
      return;
    }
    setSaving(true);
    try {
      let avatar_url = editTarget?.avatar_url || null;
      if (avatarFile) {
        avatar_url = await uploadToR2(avatarFile, 'avatars');
      }

      if (editTarget) {
        const { error } = await supabase.from('profiles').update({
          full_name: form.full_name,
          role: form.role,
          role_2: form.role_2 || null,
          position: form.position,
          base_salary: parseInput(form.base_salary),
          allowance: parseInput(form.allowance),
          phone: form.phone,
          employment_status: form.employment_status,
          probation_started_at: form.probation_started_at || null,
          fixed_salary: form.fixed_salary,
          avatar_url,
        }).eq('id', editTarget.id);
        if (error) throw error;

        // Đổi mật khẩu (nếu admin có nhập) — phải qua Edge Function vì cần service_role
        if (form.password) {
          const { data: pwData, error: pwErr } = await supabase.functions.invoke('admin-update-user', {
            body: { targetUserId: editTarget.id, newPassword: form.password },
          });
          if (pwErr || pwData?.error) {
            // Lấy lý do lỗi thực từ body Edge Function (invoke chỉ trả message chung chung)
            let detail = pwData?.error || pwErr?.message || 'Lỗi không xác định';
            try {
              const body = await pwErr?.context?.json?.();
              if (body?.error) detail = body.error;
            } catch { /* giữ detail mặc định */ }
            throw new Error('Cập nhật hồ sơ OK nhưng đổi mật khẩu thất bại: ' + detail);
          }
          toast.success('Đã cập nhật nhân sự & đổi mật khẩu');
        } else {
          toast.success('Đã cập nhật nhân sự');
        }
      } else {
        // Tạo nhân sự nguyên tử qua Edge Function (auth + profile, có rollback)
        const { data: res, error: fnErr } = await supabase.functions.invoke('admin-create-user', {
          body: {
            employeeId: form.employee_id,
            password: form.password,
            profile: {
              full_name: form.full_name,
              role: form.role,
              role_2: form.role_2 || null,
              position: form.position,
              base_salary: parseInput(form.base_salary),
              allowance: parseInput(form.allowance),
              phone: form.phone,
              employment_status: form.employment_status,
              probation_started_at: form.employment_status === 'probation'
                ? (form.probation_started_at || vnToday())
                : null,
              fixed_salary: form.fixed_salary,
              avatar_url,
            },
          },
        });
        if (fnErr || res?.error) {
          // Lấy lý do lỗi thật từ body Edge Function (invoke chỉ trả message chung chung)
          let detail = res?.error || fnErr?.message || 'Lỗi không xác định';
          try { const body = await fnErr?.context?.json?.(); if (body?.error) detail = body.error; } catch { /* giữ detail */ }
          throw new Error(detail);
        }
        toast.success('Đã tạo nhân sự mới');
      }
      setModalOpen(false);
      loadStaff();
    } catch (err) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  const handleEndProbation = async (s) => {
    const { error } = await supabase.from('profiles').update({
      employment_status: 'official',
      official_started_at: vnToday(),
    }).eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${s.full_name} đã trở thành nhân sự chính thức`);
    loadStaff();
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`XÓA HẲN nhân sự "${s.full_name}"?\n\n⚠️ KHÔNG thể hoàn tác — xóa cả tài khoản đăng nhập.\nNếu nhân sự đã có dữ liệu (lịch hẹn, lương, KPI...) sẽ không xóa được, hãy dùng Khóa.`)) return;
    const t = toast.loading('Đang xóa...');
    const { data, error } = await supabase.functions.invoke('admin-delete-user', { body: { targetUserId: s.id } });
    toast.dismiss(t);
    if (error || data?.error) { toast.error(data?.error || error.message); return; }
    toast.success('Đã xóa hẳn nhân sự');
    loadStaff();
  };

  const handleImpersonate = async (s) => {
    if (!window.confirm(`Đăng nhập với tư cách "${s.full_name}"?\n\nLưu ý: nên mở ở CỬA SỔ ẨN DANH để không ảnh hưởng phiên đăng nhập Admin hiện tại.`)) return;
    const t = toast.loading('Đang tạo phiên đăng nhập...');
    const { data, error } = await supabase.functions.invoke('admin-impersonate', {
      body: { targetUserId: s.id, redirectTo: APP_URL },
    });
    toast.dismiss(t);
    if (error || data?.error) { toast.error(data?.error || error.message); return; }
    window.open(data.actionLink, '_blank');
    toast.success('Đã mở tài khoản nhân sự ở tab mới');
  };

  const handleToggleActive = async (s) => {
    const { error } = await supabase.from('profiles').update({
      is_active: !s.is_active,
    }).eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(s.is_active ? 'Đã vô hiệu hóa tài khoản' : 'Đã kích hoạt tài khoản');
    loadStaff();
  };

  const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—';

  return (
    <div className="space-y-4">
      {!isNested && (
        <div>
          <p className="e-page-desc">Danh sách, chấm công và duyệt đơn từ</p>
        </div>
      )}

      {/* Stat cards */}
      {!loading && (
        <div className="hidden lg:grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[
            { label: 'Tổng nhân sự', icon: Users, tone: 'teal', value: staff.length, sub: 'trong hệ thống' },
            { label: 'Đang làm việc', icon: UserCheck, tone: 'violet', value: staff.filter(s => s.is_active).length, sub: 'đang hoạt động' },
            { label: 'Chính thức', icon: BadgeCheck, tone: 'blue', value: staff.filter(s => s.employment_status !== 'probation').length, sub: 'nhân sự' },
            { label: 'Thử việc', icon: Clock, tone: 'amber', value: staff.filter(s => s.employment_status === 'probation').length, sub: 'nhân sự' },
          ].map(t => {
            const TT = { teal: 'bg-teal-50 text-teal-700', violet: 'bg-success-50 text-success-600', blue: 'bg-info-50 text-info-600', amber: 'bg-warning-50 text-warning-600' }[t.tone];
            return (
              <div key={t.label} className="e-metric grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 lg:gap-x-4 gap-y-0 p-3.5">
                <div className={`e-metric-icon row-span-3 w-11 h-11 ${TT}`}><t.icon className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={1.9} /></div>
                <div className="e-metric-label">{t.label}</div>
                <div className="e-metric-value">{t.value}</div>
                <div className="e-metric-hint">{t.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Điện thoại: ô số đếm (bấm để lọc) */}
      {!loading && (
        <div className="lg:hidden grid grid-cols-4 gap-2">
          {[
            { id: 'all', label: 'Nhân sự', cls: 'text-teal-700' },
            { id: 'active', label: 'Đang làm', cls: 'text-success-600' },
            { id: 'probation', label: 'Thử việc', cls: 'text-warning-600' },
            { id: 'locked', label: 'Đã khoá', cls: 'text-danger-600' },
          ].map(t => (
            <button key={t.id} onClick={() => setMFilter(t.id)}
              className={`rounded-2xl border px-2.5 py-2.5 text-left min-w-0 transition ${mFilter === t.id ? 'border-teal-500 bg-teal-50/70' : 'border-slate-200/80 bg-white shadow-soft'}`}>
              <b className={`block text-[22px] font-bold leading-tight tabular-nums ${t.cls}`}>{mCount(t.id)}</b>
              <span className="block text-[11.5px] text-slate-500 leading-tight truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Thanh lọc / công cụ (mockup 05: ô tìm bên trái, nút thêm bên phải) */}
      <div className="e-toolbar">
        <div className="e-search flex-1 min-w-[160px] sm:max-w-[340px]">
          <Search />
          <input placeholder="Tìm theo tên, ID, SĐT…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openCreate} className="e-btn e-btn-primary ml-auto shrink-0 hidden lg:inline-flex">
          <Plus /> Thêm nhân sự
        </button>
      </div>

      {/* Điện thoại: chip lọc */}
      {!loading && (
        <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {M_FILTERS.map(f => (
            <button key={f.id} onClick={() => setMFilter(f.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold border transition ${mFilter === f.id ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
              {f.label}<span className={mFilter === f.id ? 'text-white/80' : 'text-slate-400'}>{mCount(f.id)}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="e-card e-table-wrap overflow-x-auto hidden lg:block">
            <table className="e-table min-w-[860px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">Nhân sự</th>
                  <th className="text-left">Mã NV</th>
                  <th className="text-left">Vị trí</th>
                  <th className="text-left">Lương cơ bản</th>
                  <th className="text-left">Trạng thái</th>
                  <th className="text-left">SĐT</th>
                  <th className="text-left">Nhận lương</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody className="align-middle">
                {filtered.map(s => (
                  <tr key={s.id} className={`transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                    <td className="align-middle">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-teal-50 grid place-items-center shrink-0">
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[15px] font-bold text-teal-700">{s.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-900 text-[14px] leading-tight">{s.full_name}</div>
                      </div>
                    </td>
                    <td className="text-slate-600 tabular-nums whitespace-nowrap">{s.employee_id}</td>
                    <td className="align-middle">
                      <span className={`e-badge e-badge-sm ${ROLE_COLORS[s.role] || 'e-tone-neutral'}`}>
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </td>
                    <td className="text-slate-800 font-medium tabular-nums whitespace-nowrap">
                      <div>{fmt(s.base_salary)}</div>
                      {s.allowance > 0 && <div className="text-[12px] text-slate-400 font-normal">PC: {fmt(s.allowance)}</div>}
                    </td>
                    <td className="align-middle">
                      {s.employment_status === 'probation' ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="e-badge e-tone-warning"><Clock />Thử việc</span>
                          <button onClick={() => handleEndProbation(s)} className="text-[12px] text-teal-700 hover:underline font-semibold inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Kết thúc TV
                          </button>
                        </div>
                      ) : (
                        <span className="e-badge e-tone-success"><BadgeCheck />Chính thức</span>
                      )}
                    </td>
                    <td className="text-slate-600 tabular-nums whitespace-nowrap">{s.phone || '—'}</td>
                    <td className="align-middle">
                      {s.bank_name && s.bank_account ? (
                        <button onClick={() => setViewQR(s)} className="e-btn e-btn-outline e-btn-sm h-8 px-2.5">
                          <QrCode className="w-3.5 h-3.5" /> VietQR
                        </button>
                      ) : (
                        <span className="text-[12px] text-slate-400">Chưa cập nhật</span>
                      )}
                    </td>
                    <td className="align-middle">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleImpersonate(s)} title="Đăng nhập với tư cách" className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-teal-50 hover:text-teal-700 transition-colors">
                          <LogIn className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(s)} className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-teal-50 hover:text-teal-700 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleActive(s)} title="Khóa / Mở khóa" className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-warning-50 hover:text-warning-600 transition-colors">
                          <UserX className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(s)} title="Xóa hẳn" className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-danger-50 hover:text-danger-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-[13px] border-r-0">Không tìm thấy nhân sự</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: thẻ nhân sự (Ethics) — bấm để mở bảng thao tác */}
          <div className="lg:hidden space-y-2.5 pb-16">
            {mList.length === 0 && (
              <div className="e-empty"><div className="e-empty-icon"><Users /></div><div className="e-empty-title">Không tìm thấy nhân sự</div></div>
            )}
            {mList.map(s => (
              <button key={s.id} onClick={() => setSheet(s)}
                className={`w-full rounded-2xl bg-white border border-slate-200/80 shadow-soft px-3.5 py-3 flex items-center gap-3 text-left active:bg-teal-50/40 transition ${!s.is_active ? 'opacity-60' : ''}`}>
                <span className={`w-12 h-12 rounded-full overflow-hidden shrink-0 grid place-items-center text-[15px] font-bold ${s.avatar_url ? '' : 'bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700'}`}>
                  {s.avatar_url ? <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" /> : avInit(s.full_name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-slate-900 truncate">{s.full_name}</span>
                  <span className="block text-[12.5px] text-slate-500 truncate">{[s.employee_id, s.position].filter(Boolean).join(' · ')}</span>
                  <span className="block text-[12.5px] text-teal-700 truncate">{[s.role, s.role_2].filter(Boolean).map(r => ROLE_LABELS[r] || r).join(' · ')}</span>
                </span>
                {!s.is_active
                  ? <span className="e-badge e-badge-sm e-tone-neutral shrink-0">Đã khoá</span>
                  : s.employment_status === 'probation'
                    ? <span className="e-badge e-badge-sm e-tone-warning shrink-0">Thử việc</span>
                    : <span className="e-badge e-badge-sm e-tone-success shrink-0">Hoạt động</span>}
                <ChevronRight className="w-[18px] h-[18px] text-slate-400 shrink-0" />
              </button>
            ))}
          </div>

          {/* Điện thoại: nút nổi Thêm nhân sự */}
          <button onClick={openCreate}
            className="lg:hidden fixed right-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-20 inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full text-white text-[14.5px] font-semibold shadow-nav bg-gradient-to-br from-[#067B7F] to-[#3CA7A9] active:scale-95 transition">
            <UserPlus className="w-5 h-5" /> Thêm nhân sự
          </button>
        </>
      )}

      {/* Điện thoại: bảng thao tác cho 1 nhân sự */}
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="e-modal-backdrop" onClick={() => setSheet(null)} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-float px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto animate-page">
            <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-3" />
            <div className="flex items-center gap-3">
              <span className={`w-14 h-14 rounded-full overflow-hidden shrink-0 grid place-items-center text-[17px] font-bold ${sheet.avatar_url ? '' : 'bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700'}`}>
                {sheet.avatar_url ? <img src={sheet.avatar_url} alt={sheet.full_name} className="w-full h-full object-cover" /> : avInit(sheet.full_name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-bold text-slate-900 truncate">{sheet.full_name}</div>
                <div className="text-[13px] text-slate-500 truncate">{[sheet.employee_id, sheet.position].filter(Boolean).join(' · ')}</div>
              </div>
              <button onClick={() => setSheet(null)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-subtle mt-3 px-3.5 py-2.5 grid grid-cols-2 gap-y-2 gap-x-3">
              <div><div className="e-kv-label">Vị trí</div><div className="e-kv-value truncate">{[sheet.role, sheet.role_2].filter(Boolean).map(r => ROLE_LABELS[r] || r).join(' · ')}</div></div>
              <div><div className="e-kv-label">Trạng thái</div><div className="e-kv-value">{!sheet.is_active ? 'Đã khoá' : sheet.employment_status === 'probation' ? 'Thử việc' : 'Chính thức'}</div></div>
              <div><div className="e-kv-label">Lương cơ bản</div><div className="e-kv-value tabular-nums">{fmt(sheet.base_salary)}</div></div>
              <div><div className="e-kv-label">Phụ cấp</div><div className="e-kv-value tabular-nums">{fmt(sheet.allowance)}</div></div>
              <div className="col-span-2"><div className="e-kv-label">Số điện thoại</div><div className="e-kv-value tabular-nums">{sheet.phone || '—'}</div></div>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {[
                { show: true, icon: Pencil, label: 'Sửa thông tin', fn: openEdit },
                { show: sheet.employment_status === 'probation', icon: UserCheck, label: 'Kết thúc thử việc', fn: handleEndProbation },
                { show: !!(sheet.bank_name && sheet.bank_account), icon: QrCode, label: 'QR nhận lương (VietQR)', fn: setViewQR },
                { show: !!sheet.phone, icon: Phone, label: 'Gọi điện', href: `tel:${sheet.phone}` },
                { show: true, icon: LogIn, label: 'Đăng nhập với tư cách', fn: handleImpersonate },
                { show: true, icon: UserX, label: sheet.is_active ? 'Khoá tài khoản' : 'Mở khoá tài khoản', fn: handleToggleActive, warn: true },
                { show: true, icon: Trash2, label: 'Xoá hẳn nhân sự', fn: handleDelete, danger: true },
              ].filter(a => a.show).map(a => {
                const cls = `w-full flex items-center gap-3 h-12 px-1 text-[15px] font-medium text-left ${a.danger ? 'text-danger-600' : a.warn ? 'text-warning-600' : 'text-slate-800'}`;
                const inner = <><span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${a.danger ? 'bg-danger-50' : a.warn ? 'bg-warning-50' : 'bg-teal-50 text-teal-700'}`}><a.icon className="w-[18px] h-[18px]" /></span><span className="flex-1">{a.label}</span><ChevronRight className="w-4 h-4 text-slate-300" /></>;
                return a.href
                  ? <a key={a.label} href={a.href} className={cls}>{inner}</a>
                  : <button key={a.label} onClick={sheetAct(a.fn)} className={cls}>{inner}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!viewQR} onOpenChange={(open) => !open && setViewQR(null)}>
        <DialogContent className="max-w-xs rounded-2xl border-slate-200 p-6 flex flex-col items-center text-center gap-0">
          <div className="e-empty-icon">
            <QrCode />
          </div>
          <DialogTitle className="e-modal-title">QR Nhận tiền</DialogTitle>
          <p className="text-[13px] text-slate-500 mt-1 mb-4">{viewQR?.full_name}</p>

          <div className="e-card-flat p-3 mb-4">
            <img
              src={viewQR ? `https://img.vietqr.io/image/${viewQR.bank_name.replace(/\s+/g, '').toLowerCase()}-${viewQR.bank_account.trim()}-compact.jpg?accountName=${encodeURIComponent(viewQR.full_name)}` : ''}
              alt="VietQR"
              className="w-48 h-48 object-contain"
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>

          <div className="e-subtle w-full p-3 text-left space-y-1.5">
            <div className="flex items-center justify-between gap-3 e-kv-label text-[12.5px]">Ngân hàng: <span className="e-kv-value">{viewQR?.bank_name}</span></div>
            <div className="flex items-center justify-between gap-3 e-kv-label text-[12.5px]">Số TK: <span className="e-kv-value tabular-nums">{viewQR?.bank_account}</span></div>
          </div>

          <Button onClick={() => setViewQR(null)} className="w-full mt-4 h-10 rounded-xl font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-teal-300">
            Đóng
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border-slate-200 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 text-left">
            <DialogTitle className="e-modal-title">{editTarget ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}</DialogTitle>
          </DialogHeader>

          <div className="e-modal-body space-y-4">
            {/* Avatar upload */}
            <div className="flex items-center gap-4 e-subtle p-3">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-teal-50 border-2 border-white shadow-soft flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-teal-700">
                      {form.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <label className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-teal-600 border-2 border-white flex items-center justify-center cursor-pointer hover:bg-teal-700 transition-colors">
                  <Plus className="w-3 h-3 text-white" strokeWidth={3} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              </div>
              <div>
                <div className="text-[13.5px] font-semibold text-slate-800">Ảnh đại diện</div>
                <p className="text-[12px] text-slate-500">JPG, PNG, tối đa 2MB</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="e-label">ID nhân sự *</label>
                <input
                  className="e-input disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="VD: NV001"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  disabled={!!editTarget}
                />
              </div>
              <div>
                <label className="e-label">{editTarget ? 'Mật khẩu mới' : 'Mật khẩu *'}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="e-input"
                  placeholder={editTarget ? 'Bỏ trống nếu không đổi' : 'Nhập mật khẩu'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                {editTarget && <p className="text-xs text-slate-400">Bỏ trống = giữ nguyên</p>}
              </div>
            </div>

            <div>
              <label className="e-label">Họ và tên *</label>
              <input
                className="e-input"
                placeholder="Nhập họ và tên"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="e-label">Vị trí chuyên môn *</label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="e-label">Chức vụ</label>
                <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v }))}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Trưởng bộ phận">Trưởng bộ phận</SelectItem>
                    <SelectItem value="Giám đốc">Giám đốc</SelectItem>
                    <SelectItem value="Nhân viên">Nhân viên</SelectItem>
                    <SelectItem value="Outsource">Outsource</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="e-label">Vị trí kiêm nhiệm 2 <span className="text-slate-400 font-normal">(nếu làm 2 vị trí — cộng dồn quyền & lương)</span></label>
              <Select value={form.role_2 || 'none'} onValueChange={v => setForm(f => ({ ...f, role_2: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Không có —</SelectItem>
                  {ROLES.filter(r => r.value !== form.role).map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="e-label">Lương cơ bản (đ)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="e-input tabular-nums"
                  placeholder="VD: 10.000.000"
                  value={fmtInput(form.base_salary)}
                  onChange={e => setForm(f => ({ ...f, base_salary: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div>
                <label className="e-label">Phụ cấp (đ)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="e-input tabular-nums"
                  placeholder="VD: 500.000"
                  value={fmtInput(form.allowance)}
                  onChange={e => setForm(f => ({ ...f, allowance: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
            </div>

            <div>
              <label className="e-label">Số điện thoại</label>
              <input
                className="e-input"
                placeholder="VD: 0901234567"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="e-label">Trạng thái hợp đồng</label>
              <div className="e-seg w-full">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, employment_status: 'official' }))}
                  className={`e-seg-item flex-1 ${form.employment_status === 'official' ? 'e-seg-active' : ''}`}
                >
                  Chính thức (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, employment_status: 'probation' }))}
                  className={`e-seg-item flex-1 ${form.employment_status === 'probation' ? 'bg-warning-50 text-warning-600 font-semibold' : ''}`}
                >
                  Thử việc (85%)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 e-subtle px-3 py-2.5">
              <div>
                <div className="text-[13.5px] font-semibold text-slate-800">Lương cố định</div>
                <div className="text-[12px] text-slate-500">Nhận đủ lương tháng, không cần chấm công</div>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, fixed_salary: !f.fixed_salary }))}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.fixed_salary ? 'bg-teal-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.fixed_salary ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {form.employment_status === 'probation' && (
              <div>
                <label className="e-label">Ngày bắt đầu thử việc</label>
                <input
                  type="date"
                  className="e-input"
                  value={form.probation_started_at}
                  onChange={e => setForm(f => ({ ...f, probation_started_at: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="e-modal-footer gap-2 sm:space-x-0">
            <button onClick={() => setModalOpen(false)} className="e-btn e-btn-secondary">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="e-btn e-btn-primary">
              {saving ? 'Đang lưu...' : (editTarget ? 'Cập nhật' : 'Tạo nhân sự')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManagementPage;
