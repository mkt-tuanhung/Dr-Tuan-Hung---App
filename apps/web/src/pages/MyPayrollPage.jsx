import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  ChevronLeft, ChevronRight, Wallet, TrendingUp, CalendarCheck, Award,
  Clock, Lock, ShieldCheck, Search, Banknote, MinusCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', truc_page: 'Trực Page',
  media: 'Media', marketing: 'Marketing', dieu_duong: 'Điều dưỡng', accountant: 'Kế toán',
  shareholder: 'Cổ đông', admin: 'Admin',
};
const MANAGER_ROLES = ['admin', 'accountant', 'shareholder'];

const StatCard = ({ icon: Icon, label, value, tone = 'slate', sign }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="text-xl font-bold mt-1.5 tabular-nums">{sign}{value}</div>
    </div>
  );
};

const MyPayrollPage = () => {
  const { profile } = useAuth();
  const isManager = MANAGER_ROLES.includes(profile?.role) || MANAGER_ROLES.includes(profile?.role_2);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [staffList, setStaffList] = useState([]);
  const [targetId, setTargetId] = useState(profile?.id);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Danh sách nhân sự cho bộ chọn (chỉ quản lý). RLS chặn nếu không đủ quyền.
  useEffect(() => {
    if (!isManager) return;
    supabase.from('profiles')
      .select('id, full_name, employee_id, role, role_2, base_salary, employment_status, bank_name, bank_account')
      .eq('is_active', true).order('full_name')
      .then(({ data }) => setStaffList(data || []));
  }, [isManager]);

  // Bảo mật: NV thường luôn khoá vào chính mình.
  useEffect(() => { if (!isManager && profile?.id) setTargetId(profile.id); }, [isManager, profile?.id]);

  const loadData = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    // RLS tự giới hạn: NV chỉ lấy được dòng của mình; quản lý lấy được mọi người.
    const { data } = await supabase.from('payroll').select('*').eq('staff_id', targetId);
    setRows(data || []);
    setLoading(false);
  }, [targetId]);

  useEffect(() => { loadData(); }, [loadData]);

  const targetProfile = isManager ? (staffList.find(s => s.id === targetId) || profile) : profile;
  const detail = rows.find(r => r.month === month && r.year === year);
  const yearRows = rows.filter(r => r.year === year).sort((a, b) => a.month - b.month);
  const chartData = yearRows.map(r => ({ name: 'T' + r.month, 'Thực nhận': Number(r.net_salary || 0) }));

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const filteredStaff = staffList.filter(s =>
    (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.employee_id || '').toLowerCase().includes(search.toLowerCase()));

  const incomeRows = detail ? [
    ['Lương theo công', `${detail.salary_by_attendance != null ? fmtM(detail.salary_by_attendance) : '0đ'}`, `${detail.working_days || 0} công`],
    ['Phụ cấp', fmtM(detail.allowance)],
    ['Hoa hồng / thưởng', fmtM(detail.total_commission)],
    ...(Number(detail.overtime_pay) ? [['Lương tăng ca', '+' + fmtM(detail.overtime_pay)]] : []),
    ...(Number(detail.unpaid_advance) ? [['Hoàn tạm ứng chi (đã chi hộ)', '+' + fmtM(detail.unpaid_advance)]] : []),
    ...(Number(detail.other_bonus) ? [['Thưởng khác', '+' + fmtM(detail.other_bonus)]] : []),
  ] : [];
  const deductRows = detail ? [
    ...(Number(detail.salary_advance) ? [['Ứng lương', '-' + fmtM(detail.salary_advance)]] : []),
    ...(Number(detail.other_deduction) ? [['Khấu trừ khác', '-' + fmtM(detail.other_deduction)]] : []),
  ] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-6 h-6 text-emerald-600" /> {isManager ? 'Bảng lương nhân sự' : 'Bảng lương của tôi'}</h2>
          <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {isManager ? 'Bạn có quyền xem lương toàn bộ nhân sự' : 'Chỉ riêng bạn xem được bảng lương này'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {/* Bộ chọn nhân sự (chỉ quản lý) */}
      {isManager && (
        <div className="relative">
          <button onClick={() => setPickerOpen(o => !o)}
            className="w-full sm:w-80 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-sm">
            <span className="font-semibold text-slate-700 truncate">{targetProfile?.full_name || 'Chọn nhân sự'}{targetProfile?.employee_id ? ` · ${targetProfile.employee_id}` : ''}</span>
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
          {pickerOpen && (
            <div className="absolute z-30 mt-1 w-full sm:w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b">
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / mã NV..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-emerald-400 outline-none" />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filteredStaff.map(s => (
                  <button key={s.id} onClick={() => { setTargetId(s.id); setPickerOpen(false); setSearch(''); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 flex items-center justify-between ${s.id === targetId ? 'bg-emerald-50' : ''}`}>
                    <span className="font-medium text-slate-700">{s.full_name}</span>
                    <span className="text-xs text-slate-400">{ROLE_LABELS[s.role] || s.role}</span>
                  </button>
                ))}
                {filteredStaff.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Không tìm thấy nhân sự</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hồ sơ + trạng thái */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-bold text-slate-800 text-lg">{targetProfile?.full_name}</div>
          <div className="text-sm text-slate-500">
            {ROLE_LABELS[targetProfile?.role] || targetProfile?.role}
            {targetProfile?.employment_status === 'probation' && <span className="ml-1 text-amber-600">· Thử việc (85%)</span>}
          </div>
        </div>
        {detail && (
          detail.status === 'locked'
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full"><Lock className="w-3 h-3" /> Đã chốt</span>
            : <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Tạm tính · chưa chốt</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : !detail ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Chưa có bảng lương {MONTHS[month - 1]} {year}.</p>
          <p className="text-slate-400 text-sm mt-1">Bảng lương sẽ hiển thị sau khi được tính & lưu.</p>
        </div>
      ) : (
        <>
          {/* Thực nhận nổi bật */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-sm">
            <div className="text-emerald-50 text-sm font-medium flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Thực nhận {MONTHS[month - 1]} {year}</div>
            <div className="text-4xl font-bold mt-1 tabular-nums">{fmtM(detail.net_salary)}</div>
            <div className="text-emerald-100 text-sm mt-1">Tổng thu nhập {fmtM(detail.gross_income)} · Khấu trừ {fmtM(detail.total_deductions)}</div>
          </div>

          {/* Chỉ số nổi bật */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard icon={Banknote} label="Tổng thu nhập" value={fmtM(detail.gross_income)} tone="blue" />
            <StatCard icon={CalendarCheck} label="Ngày công" value={`${detail.working_days || 0} công`} tone="violet" />
            <StatCard icon={Award} label="Hoa hồng / thưởng" value={fmtM(detail.total_commission)} tone="emerald" />
            {Number(detail.overtime_pay) > 0 && <StatCard icon={Clock} label="Lương tăng ca" value={fmtM(detail.overtime_pay)} tone="amber" sign="+" />}
            <StatCard icon={MinusCircle} label="Tổng khấu trừ" value={fmtM(detail.total_deductions)} tone="rose" />
            <StatCard icon={Wallet} label="Lương cơ bản" value={fmtM(detail.base_salary)} tone="slate" />
          </div>

          {/* Bảng chi tiết */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Thu nhập</h3>
              <table className="w-full text-sm">
                <tbody>
                  {incomeRows.map(([label, val, extra], i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-500">{label}{extra && <span className="text-xs text-slate-400 ml-1">({extra})</span>}</td>
                      <td className="py-2 text-right font-medium text-slate-700 tabular-nums">{val}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-100">
                    <td className="py-2 font-bold text-slate-700">Tổng thu nhập</td>
                    <td className="py-2 text-right font-bold text-emerald-700 tabular-nums">{fmtM(detail.gross_income)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-rose-600 mb-3 flex items-center gap-2"><MinusCircle className="w-4 h-4" /> Khấu trừ</h3>
              {deductRows.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Không có khoản khấu trừ.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {deductRows.map(([label, val], i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-500">{label}</td>
                        <td className="py-2 text-right font-medium text-rose-600 tabular-nums">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-3 pt-3 border-t-2 border-slate-100 flex justify-between">
                <span className="font-bold text-slate-700">Tổng khấu trừ</span>
                <span className="font-bold text-rose-600 tabular-nums">{fmtM(detail.total_deductions)}</span>
              </div>
              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center">
                <span className="font-bold text-slate-700">THỰC NHẬN</span>
                <span className="text-xl font-bold text-emerald-700 tabular-nums">{fmtM(detail.net_salary)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Biểu đồ theo tháng */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-emerald-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Thực nhận theo tháng ({year})</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6) + 'tr' : v} width={42} />
                <Tooltip formatter={(v) => fmtM(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Bar dataKey="Thực nhận" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPayrollPage;
