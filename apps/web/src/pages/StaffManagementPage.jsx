import React, { useState, useEffect } from 'react';
import { supabase, supabaseNoSession } from '@/lib/supabaseClient';
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
          <h2 className="text-2xl font-bold text-foreground">Quản lý nhân sự</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{staff.length} nhân sự trong hệ thống</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Thêm nhân sự
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Tìm theo tên, ID, SĐT..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nhân sự</th>
                  <th className="text-left px-4 py-3 font-medium">Vị trí</th>
                  <th className="text-left px-4 py-3 font-medium">Lương cơ bản</th>
                  <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-medium">SĐT</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(s => (
                  <tr key={s.id} className={`bg-card hover:bg-muted/30 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.employee_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[s.role] || 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <div>{fmt(s.base_salary)}</div>
                      {s.allowance > 0 && <div className="text-xs text-muted-foreground">PC: {fmt(s.allowance)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {s.employment_status === 'probation' ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-orange-600 border-orange-300">Thử việc</Badge>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handleEndProbation(s)}>
                            <UserCheck className="w-3 h-3 mr-1" /> Kết thúc TV
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-300">Chính thức</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleToggleActive(s)}>
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Không tìm thấy nhân sự</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">Không tìm thấy nhân sự</div>
            )}
            {filtered.map(s => (
              <div key={s.id} className={`bg-card border border-border rounded-xl p-4 space-y-3 ${!s.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.employee_id} · {s.phone || 'Chưa có SĐT'}</div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[s.role] || 'bg-gray-100 text-gray-700'}`}>
                    {ROLE_LABELS[s.role] || s.role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Lương cơ bản</div>
                    <div className="font-medium text-foreground">{fmt(s.base_salary)}</div>
                  </div>
                  <div>
                    {s.employment_status === 'probation' ? (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">Thử việc (85%)</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-300">Chính thức</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  {s.employment_status === 'probation' && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => handleEndProbation(s)}>
                      <UserCheck className="w-3 h-3 mr-1" /> Kết thúc thử việc
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEdit(s)}>
                    <Pencil className="w-3 h-3 mr-1" /> Sửa
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => handleToggleActive(s)}>
                    <UserX className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">ID nhân sự *</label>
                <Input
                  placeholder="VD: NV001"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  disabled={!!editTarget}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{editTarget ? 'Mật khẩu mới' : 'Mật khẩu *'}</label>
                {editTarget && <p className="text-xs text-muted-foreground">Bỏ trống = giữ nguyên</p>}
                <Input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Họ và tên *</label>
              <Input
                placeholder="Nhập họ và tên"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Vị trí chuyên môn *</label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tên vị trí hiển thị</label>
                <Input
                  placeholder="VD: Trưởng nhóm Sale"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Lương cơ bản (đ)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="VD: 10.000.000"
                  value={fmtInput(form.base_salary)}
                  onChange={e => setForm(f => ({ ...f, base_salary: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phụ cấp (đ)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="VD: 500.000"
                  value={fmtInput(form.allowance)}
                  onChange={e => setForm(f => ({ ...f, allowance: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Số điện thoại</label>
              <Input
                placeholder="VD: 0901234567"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Trạng thái hợp đồng</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, employment_status: 'official' }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.employment_status === 'official'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  Chính thức (100% lương)
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, employment_status: 'probation' }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.employment_status === 'probation'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-border text-muted-foreground hover:border-orange-300'
                  }`}
                >
                  Thử việc (85% lương)
                </button>
              </div>
            </div>

            {form.employment_status === 'probation' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày bắt đầu thử việc</label>
                <Input
                  type="date"
                  value={form.probation_started_at}
                  onChange={e => setForm(f => ({ ...f, probation_started_at: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : (editTarget ? 'Cập nhật' : 'Tạo nhân sự')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManagementPage;
