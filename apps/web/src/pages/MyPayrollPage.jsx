import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  ChevronLeft, ChevronRight, Wallet, TrendingUp, CalendarCheck, Award,
  Clock, Lock, ShieldCheck, Search, Banknote, MinusCircle, UserRound,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { computePayrollRow, fetchTelesalePrior } from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', truc_page: 'Trực Page',
  media: 'Media', marketing: 'Marketing', editor: 'Editor', dieu_duong: 'Điều dưỡng', accountant: 'Kế toán',
  shareholder: 'Cổ đông', admin: 'Admin',
};
const MANAGER_ROLES = ['admin', 'accountant', 'shareholder'];

const StatCard = ({ icon: Icon, label, value, tone = 'slate', sign }) => {
  const tones = {
    emerald: 'bg-teal-50 text-teal-700',
    blue: 'bg-info-50 text-info-600',
    amber: 'bg-warning-50 text-warning-600',
    violet: 'bg-lavender-50 text-lavender-600',
    rose: 'bg-danger-50 text-danger-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="e-metric max-lg:flex-col max-lg:items-start max-lg:gap-2.5 max-lg:p-3.5 max-lg:shadow-soft">
      <div className={`e-metric-icon max-lg:w-9 max-lg:h-9 max-lg:[&>svg]:w-[18px] max-lg:[&>svg]:h-[18px] ${tones[tone]}`}><Icon /></div>
      <div className="min-w-0 max-lg:w-full">
        <div className="e-metric-label max-lg:text-[12px]">{label}</div>
        <div className="e-metric-value max-lg:text-[18px]">{sign}{value}</div>
      </div>
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
  const [targetProfile, setTargetProfile] = useState(profile);
  const [savedRows, setSavedRows] = useState([]);
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  // Danh sách nhân sự cho bộ chọn (chỉ quản lý). RLS chặn nếu không đủ quyền.
  useEffect(() => {
    if (!isManager) return;
    supabase.from('profiles')
      .select('id, full_name, employee_id, role')
      .eq('is_active', true).order('full_name')
      .then(({ data }) => setStaffList(data || []));
  }, [isManager]);

  // Bảo mật: NV thường luôn khoá vào chính mình.
  useEffect(() => { if (!isManager && profile?.id) setTargetId(profile.id); }, [isManager, profile?.id]);

  const loadData = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    const tid = targetId;
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const meDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const meNext = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const orTele = `telesale_id.eq.${tid},telesale_id_2.eq.${tid}`;
    const orSale = `telesale_id.eq.${tid},telesale_id_2.eq.${tid},sale_id.eq.${tid}`;
    // Ca PT có liên quan tới NV ở bất kỳ vị trí tính tiền nào (telesale/sale/phụ mổ/trực đêm)
    const orSurg = `${orSale},bac_si_id.eq.${tid},phu_mo_1_id.eq.${tid},phu_mo_2_id.eq.${tid},phu_mo_3_id.eq.${tid},truc_dem_id.eq.${tid},truc_dem_id_2.eq.${tid},hau_phau_id.eq.${tid}`;

    // Team seeding dùng chung 1 tài khoản → hoa hồng tính trên TẤT CẢ ca nguồn "Seeding" (không lọc theo nhân sự)
    const roleGuess = (isManager ? staffList.find(s => s.id === tid) : profile);
    const isSeedingTarget = roleGuess?.role === 'seeding' || roleGuess?.role_2 === 'seeding';

    const [profRes, payRes, attRes, apptRes, surgRes, bongRes, cocRes, pageRes, advRes, salRes, winRes, partnerRes, seedRes, priorData] = await Promise.all([
      supabase.from('profiles').select('id, full_name, employee_id, role, role_2, position, base_salary, allowance, employment_status, fixed_salary, bank_name, bank_account').eq('id', tid).maybeSingle(),
      supabase.from('payroll').select('*').eq('staff_id', tid),
      supabase.from('attendance').select('staff_id, status, date, overtime_hours, late_early_hours').eq('staff_id', tid).gte('date', ms).lte('date', meDay),
      supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, status, service').or(orSale).gte('appointment_date', ms).lte('appointment_date', meDay),
      supabase.from('customer_appointments').select('sale_id, phone, telesale_id, telesale_id_2, revenue, upsale_revenue, customer_source, bong_date, deposit_date, surgery_type, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids').eq('status', 'phau_thuat').or(orSurg).gte('surgery_date', ms).lte('surgery_date', meDay),
      supabase.from('customer_appointments').select('phone, consult_received, telesale_id, telesale_id_2, surgery_type, customer_source').or(orTele).gte('bong_date', ms).lte('bong_date', meDay),
      supabase.from('customer_appointments').select('phone, consult_received, telesale_id, telesale_id_2, surgery_type, customer_source').or(orTele).gte('deposit_date', ms).lte('deposit_date', meDay),
      supabase.from('page_daily_reports').select('staff_id, telesale_id, total_phones, total_interested_phones, total_messages, total_spam_messages').or(`staff_id.eq.${tid},telesale_id.eq.${tid}`).gte('date', ms).lte('date', meDay),
      supabase.from('expenses').select('staff_id, amount').eq('staff_id', tid).eq('is_advance', true).eq('status', 'approved'),
      supabase.from('salary_advances').select('staff_id, amount').eq('staff_id', tid).eq('status', 'approved').eq('month', month).eq('year', year),
      supabase.from('media_clips').select('editor_id, win, win_amount, approved_to_run').eq('editor_id', tid).gte('evaluated_at', ms).lt('evaluated_at', meNext),
      supabase.from('partner_surgeries').select('customer_name, partner_name, surgery_type, partner_fee, surgery_fee, partner_paid, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id').or(`bac_si_id.eq.${tid},phu_mo_1_id.eq.${tid},phu_mo_2_id.eq.${tid},phu_mo_3_id.eq.${tid}`).gte('surgery_date', ms).lte('surgery_date', meDay),
      isSeedingTarget
        ? supabase.from('customer_appointments').select('customer_name, revenue, hospital_fee, surgery_date').eq('customer_source', 'Seeding').eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', meDay).limit(2000)
        : Promise.resolve({ data: [] }),
      fetchTelesalePrior(ms), // lịch sử bong/cọc trước tháng — chống thưởng lịch hẹn lặp
    ]);

    if (profRes.data) setTargetProfile(profRes.data);
    setSavedRows(payRes.data || []);
    setSrc({
      att: attRes.data || [], appts: apptRes.data || [], surg: surgRes.data || [],
      bong: bongRes.data || [], coc: cocRes.data || [], pages: pageRes.data || [],
      adv: advRes.data || [], salAdv: salRes.data || [], contentWins: winRes.data || [],
      partner: partnerRes.data || [], seeding: seedRes.data || [], prior: priorData,
    });
    setLoading(false);
  }, [targetId, month, year, isManager, staffList, profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const tp = targetProfile || profile;
  const savedThisMonth = savedRows.find(r => r.month === month && r.year === year);
  // Tính LIVE từ dữ liệu nguồn; nếu tháng đã CHỐT thì lấy số đã lưu (chính thức).
  const live = (src && tp?.id) ? computePayrollRow({ staff: tp, ...src, saved: savedThisMonth }) : null;
  const detail = !src ? null
    : (savedThisMonth?.status === 'locked' ? { ...savedThisMonth, status: 'locked' }
      : (live ? { ...live, status: 'draft' } : null));

  // Biểu đồ: tháng đang xem = số hiện tại; các tháng khác = đã lưu (nếu có)
  const chartData = [];
  for (let mo = 1; mo <= 12; mo++) {
    const sv = savedRows.find(r => r.month === mo && r.year === year);
    if (mo === month && detail) chartData.push({ name: 'T' + mo, 'Thực nhận': detail.net_salary });
    else if (sv) chartData.push({ name: 'T' + mo, 'Thực nhận': Number(sv.net_salary || 0) });
  }

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const filteredStaff = staffList.filter(s =>
    (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.employee_id || '').toLowerCase().includes(search.toLowerCase()));

  const incomeRows = detail ? [
    ['Lương theo công', fmtM(detail.salary_by_attendance), `${detail.working_days || 0} công`],
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
    <div className="flex flex-col gap-4">
      {isManager && <h2 className="hidden"><Wallet className="w-5 h-5" /> Bảng lương nhân sự</h2>}

      {/* Thanh công cụ: chọn nhân sự (quản lý) + ghi chú bảo mật */}
      <div className="e-toolbar">
      {isManager && (
        <div className="relative w-full sm:w-auto">
          <button onClick={() => setPickerOpen(o => !o)}
            className="w-full sm:w-80 h-10 flex items-center justify-between gap-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-white text-[14px] transition">
            <span className="font-semibold text-slate-800 truncate">{tp?.full_name || 'Chọn nhân sự'}{tp?.employee_id ? ` · ${tp.employee_id}` : ''}</span>
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
          {pickerOpen && (
            <div className="absolute z-30 mt-1.5 w-full sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-float overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / mã NV..."
                  className="e-input h-9" />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filteredStaff.map(s => (
                  <button key={s.id} onClick={() => { setTargetId(s.id); setPickerOpen(false); setSearch(''); }}
                    className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-teal-50/60 flex items-center justify-between gap-2 ${s.id === targetId ? 'bg-teal-50' : ''}`}>
                    <span className="font-medium text-slate-800">{s.full_name}</span>
                    <span className="e-badge e-badge-sm e-tone-neutral">{ROLE_LABELS[s.role] || s.role}</span>
                  </button>
                ))}
                {filteredStaff.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-slate-400">Không tìm thấy nhân sự</div>}
              </div>
            </div>
          )}
        </div>
      )}
        <div className="flex-1 min-w-[220px] px-1.5">
          <p className="e-page-desc flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" /> {isManager ? 'Bạn có quyền xem lương toàn bộ nhân sự' : 'Chỉ riêng bạn xem được bảng lương này · cập nhật tự động'}
          </p>
        </div>
      </div>

      {/* Điện thoại: chọn kỳ lương dạng ô mint rộng (Ethics M12) */}
      <div className="lg:hidden flex items-center gap-2 rounded-2xl bg-teal-50 p-1.5">
        <button onClick={prevMonth} className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-teal-700 active:bg-white transition" aria-label="Tháng trước"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0 text-center leading-tight">
          <div className="text-[11.5px] font-medium text-teal-700/70">Kỳ lương</div>
          <div className="text-[15px] font-semibold text-teal-800 tabular-nums">{MONTHS[month - 1]}/{year}</div>
        </div>
        <button onClick={nextMonth} className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-teal-700 active:bg-white transition" aria-label="Tháng sau"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Đầu phiếu + thẻ nhân sự (mockup 09 Ethics) */}
      <div className="e-card p-4 lg:p-7 space-y-0 lg:space-y-5">
        <div className="hidden lg:flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900">Phiếu lương <span className="font-semibold text-slate-400">· {MONTHS[month - 1]}/{year}</span></h2>
          <div className="flex items-center gap-1.5">
            <button onClick={prevMonth} className="e-icon-btn w-9 h-9" aria-label="Tháng trước"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={nextMonth} className="e-icon-btn w-9 h-9" aria-label="Tháng sau"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-x-3.5 gap-y-3 lg:gap-6 flex-wrap">
          <div className="e-avatar w-14 h-14 lg:w-20 lg:h-20 ring-4 ring-teal-50"><UserRound className="w-7 h-7 lg:w-10 lg:h-10" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] lg:text-[24px] font-bold text-slate-900 leading-tight">{tp?.full_name}</div>
            <div className="text-[13px] lg:text-[16px] text-slate-500 mt-1 flex items-center flex-wrap gap-y-1">
              {ROLE_LABELS[tp?.role] || tp?.role}
              {tp?.employment_status === 'probation' && <span className="e-badge e-badge-sm e-tone-warning ml-2">Thử việc (85%)</span>}
            </div>
          </div>
        {detail && (
          detail.status === 'locked'
            ? <span className="e-badge e-tone-success"><Lock className="w-3.5 h-3.5" /> Đã chốt</span>
            : <span className="e-badge e-badge-dot e-tone-warning">Tạm tính · cập nhật theo thời gian thực</span>
        )}
        </div>
      </div>

      {loading && !detail ? (
        <div className="e-card flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : !detail ? (
        <div className="e-card e-empty py-12">
          <Wallet className="w-12 h-12 p-3 rounded-full bg-teal-50 text-teal-600 mb-3" />
          <p className="e-empty-title">Chưa có dữ liệu lương {MONTHS[month - 1]} {year}.</p>
        </div>
      ) : (
        <>
          {/* Điện thoại: thẻ hero "Thực nhận" (Ethics M13) */}
          <div className="order-1 lg:hidden rounded-2xl bg-teal-50 p-4">
            <div className="flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-full bg-white text-teal-700 flex items-center justify-center shrink-0 shadow-soft"><Wallet className="w-6 h-6" /></span>
              <div className="min-w-0">
                <div className="text-[13.5px] text-teal-900/70">Thực nhận {MONTHS[month - 1]} {year}</div>
                <div className="text-[28px] font-bold text-teal-800 leading-tight tabular-nums">{fmtM(detail.net_salary)}</div>
              </div>
            </div>
          </div>

          {/* Điện thoại: nhóm dòng thu nhập / khấu trừ (m-pay-line) */}
          <div className="order-3 lg:hidden">
            <h3 className="text-[18px] font-bold text-slate-900 mt-1 mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-teal-600" /> Thu nhập</h3>
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft px-4 py-1">
              {incomeRows.map(([label, val, extra], i) => (
                <div key={i} className="flex items-center justify-between gap-3 min-h-[50px] py-2.5 border-b border-slate-100">
                  <span className="min-w-0 text-[14.5px] text-slate-700">{label}{extra && <span className="block text-[12px] text-slate-400">{extra}</span>}</span>
                  <span className="shrink-0 text-[14.5px] font-semibold text-teal-700 tabular-nums whitespace-nowrap">{val}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 min-h-[54px]">
                <span className="text-[14.5px] font-semibold text-slate-900">Tổng thu nhập</span>
                <span className="text-[17px] font-bold text-teal-700 tabular-nums whitespace-nowrap">{fmtM(detail.gross_income)}</span>
              </div>
            </div>

            <h3 className="text-[18px] font-bold text-slate-900 mt-5 mb-3 flex items-center gap-2"><MinusCircle className="w-5 h-5 text-danger-600" /> Khấu trừ</h3>
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft px-4 py-1">
              {deductRows.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-3.5 border-b border-slate-100">Không có khoản khấu trừ.</p>
              ) : (
                <div>
                  {deductRows.map(([label, val], i) => (
                    <div key={i} className="flex items-center justify-between gap-3 min-h-[50px] py-2.5 border-b border-slate-100">
                      <span className="min-w-0 text-[14.5px] text-slate-700">{label}</span>
                      <span className="shrink-0 text-[14.5px] font-semibold text-danger-600 tabular-nums whitespace-nowrap">{val}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 min-h-[54px]">
                <span className="text-[14.5px] font-semibold text-slate-900">Tổng khấu trừ</span>
                <span className="text-[17px] font-bold text-danger-600 tabular-nums whitespace-nowrap">{fmtM(detail.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Thực nhận nổi bật */}
          <div className="hidden lg:grid order-3 grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-[#EAF7F7] px-5 py-5 lg:px-7 lg:py-6 shadow-soft">
            <div className="text-[18px] lg:text-[22px] font-bold text-teal-900 flex items-center gap-2"><Wallet className="w-6 h-6 text-teal-700" /> Thực nhận {MONTHS[month - 1]} {year}</div>
            <div className="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:row-span-2 text-[30px] lg:text-[40px] font-bold text-teal-800 leading-tight tabular-nums sm:text-right">{fmtM(detail.net_salary)}</div>
            <div className="col-span-2 sm:col-span-1 sm:col-start-1 text-[13px] text-teal-900/70">Tổng thu nhập {fmtM(detail.gross_income)} · Khấu trừ {fmtM(detail.total_deductions)}</div>
          </div>

          {/* Chỉ số nổi bật */}
          <div className="order-2 lg:order-1 grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <StatCard icon={Banknote} label="Tổng thu nhập" value={fmtM(detail.gross_income)} tone="blue" />
            <StatCard icon={CalendarCheck} label="Ngày công" value={`${detail.working_days || 0} công`} tone="violet" />
            <StatCard icon={Award} label="Hoa hồng / thưởng" value={fmtM(detail.total_commission)} tone="emerald" />
            {Number(detail.overtime_pay) > 0 && <StatCard icon={Clock} label="Lương tăng ca" value={fmtM(detail.overtime_pay)} tone="amber" sign="+" />}
            <StatCard icon={MinusCircle} label="Tổng khấu trừ" value={fmtM(detail.total_deductions)} tone="rose" />
            <StatCard icon={Wallet} label="Lương cơ bản" value={fmtM(detail.base_salary)} tone="slate" />
          </div>

          {/* Bảng chi tiết */}
          <div className="hidden lg:grid order-2 md:grid-cols-2 gap-4 items-stretch">
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-b from-teal-50/70 to-white shadow-soft px-5 pt-5 pb-4">
              <h3 className="text-[17px] font-bold text-teal-700 mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Thu nhập</h3>
              <table className="w-full text-[14px]">
                <tbody>
                  {incomeRows.map(([label, val, extra], i) => (
                    <tr key={i} className="border-b border-slate-100/80">
                      <td className="py-2.5 text-slate-600">{label}{extra && <span className="text-[12px] text-slate-400 ml-1">({extra})</span>}</td>
                      <td className="py-2.5 text-right font-medium text-slate-800 tabular-nums">{val}</td>
                    </tr>
                  ))}
                  <tr className="bg-teal-50 text-teal-800">
                    <td className="py-3.5 pl-3 rounded-l-xl font-bold text-[15px]">Tổng thu nhập</td>
                    <td className="py-3.5 pr-3 rounded-r-xl text-right font-bold text-[17px] tabular-nums">{fmtM(detail.gross_income)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-col rounded-2xl border border-danger-100 bg-gradient-to-b from-danger-50/70 to-white shadow-soft px-5 pt-5 pb-4">
              <h3 className="text-[17px] font-bold text-danger-600 mb-2 flex items-center gap-2"><MinusCircle className="w-5 h-5" /> Khấu trừ</h3>
              {deductRows.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-2.5">Không có khoản khấu trừ.</p>
              ) : (
                <table className="w-full text-[14px]">
                  <tbody>
                    {deductRows.map(([label, val], i) => (
                      <tr key={i} className="border-b border-slate-100/80">
                        <td className="py-2.5 text-slate-600">{label}</td>
                        <td className="py-2.5 text-right font-medium text-slate-800 tabular-nums">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-auto pt-2 flex justify-between items-center rounded-xl bg-danger-50 text-danger-600 px-3 py-3.5">
                <span className="font-bold text-[15px]">Tổng khấu trừ</span>
                <span className="font-bold text-[17px] tabular-nums">{fmtM(detail.total_deductions)}</span>
              </div>
              <div className="hidden">
                <span className="font-bold text-slate-700">THỰC NHẬN</span>
                <span className="text-xl font-bold text-teal-700 tabular-nums">{fmtM(detail.net_salary)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Biểu đồ theo tháng */}
      {chartData.length > 0 && (
        <div className="order-4 e-card e-card-pad">
          <h3 className="e-card-title mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-teal-600" /> Thực nhận theo tháng ({year})</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF4F4" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A3ABAA' }} />
                <YAxis tick={{ fontSize: 11, fill: '#A3ABAA' }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6) + 'tr' : v} width={42} />
                <Tooltip formatter={(v) => fmtM(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Bar dataKey="Thực nhận" fill="#067B7F" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPayrollPage;
