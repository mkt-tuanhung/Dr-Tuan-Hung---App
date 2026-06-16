import React, { useState, useEffect } from 'react';
import { supabase, supabaseNoSession } from '@/lib/supabaseClient';
import { uploadToR2, R2_PUBLIC_URL } from '@/lib/r2Client';
import { useAuth } from '@/contexts/AuthContext.jsx';
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
import { Plus, Search, UserCheck, Pencil, UserX } from 'lucide-react';

// Format số tiền VND có dấu chấm
const fmtInput = (val) => {
  const num = val.replace(/\D/g, '');
  return num ? new Intl.NumberFormat('vi-VN').format(num) : '';
};
const parseInput = (val) => Number(val.replace(/\D/g, '')) || 0;

const ROLES = [
  { value: 'telesale',     label: 'Telesale' },
  { value: 'sale_offline', label: 'Sale Offline' },
  { value: 'cskh',         label: 'CSKH' },
  { value: 'truc_page',    label: 'Trực Page' },
  { value: 'media',        label: 'Media' },
  { value: 'marketing',    label: 'Marketing' },
  { value: 'dieu_duong',   label: 'Điều dưỡng' },
  { value: 'accountant',   label: 'Kế toán' },
  { value: 'shareholder',  label: 'Cổ đông' },
  { value: 'admin',        label: 'Admin' },
];

const ROLE_LABELS = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

const ROLE_COLORS = {
  admin:        'bg-red-100 text-red-700',
  accountant:   'bg-blue-100 text-blue-700',
  shareholder:  'bg-purple-100 text-purple-700',
  telesale:     'bg-green-100 text-green-700',
  sale_offline: 'bg-orange-100 text-orange-700',
  cskh:         'bg-yellow-100 text-yellow-700',
  truc_page:    'bg-pink-100 text-pink-700',
  media:        'bg-cyan-100 text-cyan-700',
  marketing:    'bg-indigo-100 text-indigo-700',
  dieu_duong:   'bg-teal-100 text-teal-700',
};

const EMPTY_FORM = {
  employee_id: '', password: '', full_name: '', role: 'telesale',
  position: '', base_salary: '', allowance: '', phone: '',
  employment_status: 'official', probation_started_at: '',
};

const StaffManagementPage = () => {
  const { profile: me } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const loadStaff = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => { loadStaff(); }, []);

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

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
      position: s.position || '',
      base_salary: s.base_salary || '',
      allowance: s.allowance || '',
      phone: s.phone || '',
      employment_status: s.employment_status || 'official',
      probation_started_at: s.probation_started_at || '',
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
          position: form.position,
          base_salary: parseInput(form.base_salary),
          allowance: parseInput(form.allowance),
          phone: form.phone,
          employment_status: form.employment_status,
          probation_started_at: form.probation_started_at || null,
          avatar_url,
        }).eq('id', editTarget.id);
        if (error) throw error;
        toast.success('Đã cập nhật nhân sự');
      } else {
        const email = `${form.employee_id.trim().toLowerCase()}@drtuanhung.internal`;
        const { data: authData, error: authErr } = await supabaseNoSession.auth.signUp({
          email,
          password: form.password,
          options: { data: { employee_id: form.employee_id.trim().toUpperCase() } },
        });
        if (authErr) throw authErr;
        if (!authData.user) throw new Error('Không tạo được tài khoản');

        const { error: profileErr } = await supabase.from('profiles').insert({
          id: authData.user.id,
          employee_id: form.employee_id.trim().toUpperCase(),
          full_name: form.full_name,
          role: form.role,
          position: form.position,
          base_salary: parseInput(form.base_salary),
          allowance: parseInput(form.allowance),
          phone: form.phone,
          employment_status: form.employment_status,
          probation_started_at: form.employment_status === 'probation'
            ? (form.probation_started_at || new Date().toISOString().split('T')[0])
            : null,
          created_by: me?.id,
          avatar_url,
        });
        if (profileErr) throw profileErr;
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
      official_started_at: new Date().toISOString().split('T')[0],
    }).eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${s.full_name} đã trở thành nhân sự chính thức`);
    loadStaff();
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản lý nhân sự</h2>
          <p className="text-slate-400 text-sm mt-0.5">{staff.length} nhân sự trong hệ thống</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600 transition-all"
        >
          <Plus className="w-4 h-4" /> Thêm nhân sự
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-emerald-100 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Tìm theo tên, ID, SĐT..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50/50 text-slate-500 border-b border-emerald-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nhân sự</th>
                  <th className="text-left px-4 py-3 font-medium">Vị trí</th>
                  <th className="text-left px-4 py-3 font-medium">Lương cơ bản</th>
                  <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-medium">SĐT</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filtered.map(s => (
                  <tr key={s.id} className={`hover:bg-emerald-50/40 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-emerald-500">{s.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{s.full_name}</div>
                          <div className="text-xs text-slate-400">{s.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[s.role] || 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{fmt(s.base_salary)}</div>
                      {s.allowance > 0 && <div className="text-xs text-slate-400">PC: {fmt(s.allowance)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {s.employment_status === 'probation' ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">Thử việc</span>
                          <button onClick={() => handleEndProbation(s)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Kết thúc TV
                          </button>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Chính thức</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(s)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToggleActive(s)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">Không tìm thấy nhân sự</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-slate-400">Không tìm thấy nhân sự</div>
            )}
            {filtered.map(s => (
              <div key={s.id} className={`bg-white border border-emerald-100 rounded-2xl p-4 space-y-3 shadow-sm ${!s.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-emerald-500">{s.full_name?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{s.full_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{s.employee_id} · {s.phone || 'Chưa có SĐT'}</div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[s.role] || 'bg-gray-100 text-gray-700'}`}>
                    {ROLE_LABELS[s.role] || s.role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-slate-400 text-xs">Lương cơ bản</div>
                    <div className="font-medium text-slate-700">{fmt(s.base_salary)}</div>
                  </div>
                  {s.employment_status === 'probation' ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">Thử việc (85%)</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Chính thức</span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-emerald-50">
                  {s.employment_status === 'probation' && (
                    <button onClick={() => handleEndProbation(s)} className="flex-1 h-8 text-xs font-medium rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1">
                      <UserCheck className="w-3 h-3" /> Kết thúc thử việc
                    </button>
                  )}
                  <button onClick={() => openEdit(s)} className="flex-1 h-8 text-xs font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1">
                    <Pencil className="w-3 h-3" /> Sửa
                  </button>
                  <button onClick={() => handleToggleActive(s)} className="h-8 w-8 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 flex items-center justify-center">
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border-emerald-100">
          <DialogHeader>
            <DialogTitle className="text-slate-800">{editTarget ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-emerald-400">
                      {form.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center cursor-pointer hover:bg-emerald-600 transition-colors">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
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
              <p className="text-xs text-slate-400">Ảnh đại diện (JPG, PNG, tối đa 2MB)</p>
            </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ID nhân sự *</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="VD: NV001"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  disabled={!!editTarget}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{editTarget ? 'Mật khẩu mới' : 'Mật khẩu *'}</label>
                {editTarget && <p className="text-xs text-slate-400">Bỏ trống = giữ nguyên</p>}
                <input
                  type="password"
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Nhập mật khẩu"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Họ và tên *</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Nhập họ và tên"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Vị trí chuyên môn *</label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="rounded-xl border-emerald-100 bg-emerald-50/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Tên vị trí hiển thị</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="VD: Trưởng nhóm Sale"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Lương cơ bản (đ)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="VD: 10.000.000"
                  value={fmtInput(form.base_salary)}
                  onChange={e => setForm(f => ({ ...f, base_salary: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Phụ cấp (đ)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="VD: 500.000"
                  value={fmtInput(form.allowance)}
                  onChange={e => setForm(f => ({ ...f, allowance: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Số điện thoại</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="VD: 0901234567"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Trạng thái hợp đồng</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, employment_status: 'official' }))}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.employment_status === 'official'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-transparent shadow-md shadow-emerald-200'
                      : 'border-emerald-100 text-slate-500 hover:border-emerald-300'
                  }`}
                >
                  Chính thức (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, employment_status: 'probation' }))}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.employment_status === 'probation'
                      ? 'bg-orange-500 text-white border-transparent shadow-md shadow-orange-200'
                      : 'border-emerald-100 text-slate-500 hover:border-orange-300'
                  }`}
                >
                  Thử việc (85%)
                </button>
              </div>
            </div>

            {form.employment_status === 'probation' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Ngày bắt đầu thử việc</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  value={form.probation_started_at}
                  onChange={e => setForm(f => ({ ...f, probation_started_at: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50">
              {saving ? 'Đang lưu...' : (editTarget ? 'Cập nhật' : 'Tạo nhân sự')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManagementPage;
