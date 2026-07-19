import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient';
import StaffManagementPage from '@/pages/StaffManagementPage.jsx';
import AttendanceManagementPage from '@/pages/AttendanceManagementPage.jsx';
import KPIManagementPage from '@/pages/KPIManagementPage.jsx';
import PayrollPage from '@/pages/PayrollPage.jsx';
import CommunityPage from '@/pages/CommunityPage.jsx';
import NotificationsPage from '@/pages/NotificationsPage.jsx';
import AppointmentManagementPage from '@/pages/AppointmentManagementPage.jsx';
import KhachCocPage from '@/pages/KhachCocPage.jsx';
import KhachPhauThuatPage from '@/pages/KhachPhauThuatPage.jsx';
import KhachBongPage from '@/pages/KhachBongPage.jsx';
import HauPhauPage from '@/pages/HauPhauPage.jsx';
import FinanceManagementPage from '@/pages/FinanceManagementPage.jsx';
import PLPage from '@/pages/PLPage.jsx';
import AdvanceExpensePage from '@/pages/AdvanceExpensePage.jsx';
import VienPhiPage from '@/pages/VienPhiPage.jsx';
import CashFlowPage from '@/pages/CashFlowPage.jsx';
import HRManagementPage from '@/pages/HRManagementPage.jsx';
import HospitalFeeAndInventoryPage from '@/pages/HospitalFeeAndInventoryPage.jsx';
import DepositManagementPage from '@/pages/DepositManagementPage.jsx';
import MarketingHubPage from '@/pages/MarketingHubPage.jsx';
import MarketingDataPage from '@/pages/MarketingDataPage.jsx';
import KhachTuVanPage from '@/pages/KhachTuVanPage.jsx';
import MeetingPage from '@/pages/MeetingPage.jsx';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, ClipboardList,
  Banknote, Activity, Target, Wallet, Bell, ShieldCheck, LogOut,
  Menu, X, AlertCircle, ChevronRight, CheckCircle2, CircleDollarSign,
  Briefcase, Plus, Search, UserX, DollarSign, UserCheck, TrendingUp, BarChart2, MessagesSquare, Database, Video, PieChart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart as RPieChart, Pie, Cell } from 'recharts';

const MENU_GROUPS = [
  { title: null, items: [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  ]},
  { title: 'KHÁCH HÀNG', color: 'blue', items: [
    { id: 'data_kh', label: 'Data khách hàng', icon: Database },
    { id: 'deposit_management', label: 'Quản lý Đặt cọc', icon: ClipboardList },
    { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays },
    { id: 'khach_tu_van', label: 'Khách tư vấn', icon: UserCheck },
    { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity },
    { id: 'hau_phau', label: 'Hậu phẫu / CSKH', icon: ClipboardList },
  ]},
  { title: 'NHÂN SỰ', color: 'violet', items: [
    { id: 'hr', label: 'Quản lý Nhân sự', icon: Users },
    { id: 'kpi', label: 'KPI & Hoa hồng', icon: Target },
    { id: 'payroll', label: 'Bảng lương', icon: Wallet },
  ]},
  { title: 'TÀI CHÍNH', color: 'amber', items: [
    { id: 'finance', label: 'Doanh thu / Tài chính', icon: Banknote },
    { id: 'pl', label: 'Lãi / Lỗ (P&L)', icon: PieChart },
    { id: 'cashflow', label: 'Kế toán dòng tiền', icon: BarChart2 },
    { id: 'advances', label: 'Tạm ứng chi', icon: Wallet },
    { id: 'hospital_fee_inventory', label: 'Viện phí / Vật tư', icon: Activity },
    { id: 'marketing', label: 'Marketing / Ads', icon: Target },
  ]},
  { title: 'VẬN HÀNH', color: 'rose', items: [
    { id: 'meetings', label: 'Phòng họp', icon: Video },
    { id: 'community', label: 'Cộng đồng', icon: MessagesSquare },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'permissions', label: 'Phân quyền', icon: ShieldCheck },
  ]},
];
const MENU = MENU_GROUPS.flatMap(g => g.items);

// Màu nền/nhãn nhẹ theo nhóm (class tĩnh để Tailwind không purge)
const GROUP_STYLE = {
  blue:   { box: 'bg-blue-50/50',   label: 'text-blue-500',   bar: 'bg-blue-400' },
  violet: { box: 'bg-violet-50/50', label: 'text-violet-500', bar: 'bg-violet-400' },
  amber:  { box: 'bg-amber-50/50',  label: 'text-amber-600',  bar: 'bg-amber-400' },
  rose:   { box: 'bg-rose-50/50',   label: 'text-rose-500',   bar: 'bg-rose-400' },
};

const BOTTOM_NAV = ['overview', 'hr', 'appointments', 'kpi'];

// Bảng màu cho donut cơ cấu dịch vụ
const PIE_COLORS = ['#10b981', '#14b8a6', '#8b5cf6', '#f59e0b', '#3b82f6', '#cbd5e1'];
const APPT_ST = {
  scheduled: { label: 'Chờ', cls: 'bg-amber-100 text-amber-700' },
  coc: { label: 'Đã cọc', cls: 'bg-sky-100 text-sky-700' },
  bong: { label: 'Bỏ lỡ', cls: 'bg-rose-100 text-rose-600' },
  phau_thuat: { label: 'Phẫu thuật', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Huỷ', cls: 'bg-slate-100 text-slate-500' },
};
const fmtVND = (n) => {
  if (n >= 1000000000) return (n / 1000000000).toFixed(2).replace(/\.?0+$/, '') + ' Tỷ';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + ' Tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
};
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

const Overview = ({ profile, setActiveTab }) => {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({
    totalStaff: 0, presentToday: 0, appointmentsToday: 0, pendingExpenses: 0, pendingLeaves: 0,
    monthRevenue: 0, todayRevenue: 0, closeRate: 0, newCustomers: 0, scTotal: 0,
    newStaffMonth: 0, apptTrend: null, revTrend: null, revMonthTrend: null, closeTrend: null, newCustTrend: null, rev6mTrend: null,
    revenue6m: [], services: [], todayList: [], weekly: [], newCust6w: [], topConsultants: [],
  });

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const y = now.getFullYear(), mo = now.getMonth();
      const pad = (n) => String(n).padStart(2, '0');
      const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      const todayStr = iso(now);
      const monthKey = `${y}-${pad(mo + 1)}`;
      const sixStart = iso(new Date(y, mo - 5, 1));
      const dow = (now.getDay() + 6) % 7;                 // 0 = Thứ 2
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - dow);

      const [pf, at, ex, lv, ap] = await Promise.all([
        supabase.from('profiles').select('id, full_name, created_at').eq('is_active', true),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', todayStr).eq('status', 'present'),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('customer_appointments')
          .select('id, customer_name, service, status, appointment_date, surgery_date, revenue, telesale_id, created_at')
          .or(`appointment_date.gte.${sixStart},surgery_date.gte.${sixStart},created_at.gte.${sixStart}`)
          .limit(5000),
      ]);

      const staff = pf.data || [];
      const nameOf = Object.fromEntries(staff.map(s => [s.id, s.full_name]));
      const appts = ap.data || [];
      const inMonth = (ds) => ds && ds.slice(0, 7) === monthKey;

      const monthRevenue = appts.filter(a => a.status === 'phau_thuat' && inMonth(a.surgery_date)).reduce((s, a) => s + Number(a.revenue || 0), 0);
      const todayRevenue = appts.filter(a => a.status === 'phau_thuat' && a.surgery_date === todayStr).reduce((s, a) => s + Number(a.revenue || 0), 0);
      const todayAppts = appts.filter(a => a.appointment_date === todayStr).sort((x, z) => (x.created_at || '').localeCompare(z.created_at || ''));

      const leadsM = appts.filter(a => inMonth(a.appointment_date));
      const closedM = leadsM.filter(a => a.status === 'coc' || a.status === 'phau_thuat');
      const closeRate = leadsM.length ? Math.round(closedM.length / leadsM.length * 100) : 0;

      // --- So sánh kỳ trước (xu hướng) ---
      const pctT = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 1000) / 10 : null;
      const prevDt = new Date(y, mo - 1, 1); const prevKey = `${prevDt.getFullYear()}-${pad(prevDt.getMonth() + 1)}`;
      const prevRevenue = appts.filter(a => a.status === 'phau_thuat' && a.surgery_date && a.surgery_date.slice(0, 7) === prevKey).reduce((s, a) => s + Number(a.revenue || 0), 0);
      const prevLeads = appts.filter(a => a.appointment_date && a.appointment_date.slice(0, 7) === prevKey);
      const prevClose = prevLeads.length ? Math.round(prevLeads.filter(a => a.status === 'coc' || a.status === 'phau_thuat').length / prevLeads.length * 100) : 0;
      const ydayStr = iso(new Date(y, mo, now.getDate() - 1));
      const apptYday = appts.filter(a => a.appointment_date === ydayStr).length;
      const revYday = appts.filter(a => a.status === 'phau_thuat' && a.surgery_date === ydayStr).reduce((s, a) => s + Number(a.revenue || 0), 0);
      const newStaffMonth = staff.filter(s => s.created_at && s.created_at.slice(0, 7) === monthKey).length;

      const revenue6m = Array.from({ length: 6 }, (_, i) => {
        const dt = new Date(y, mo - 5 + i, 1); const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
        const val = appts.filter(a => a.status === 'phau_thuat' && a.surgery_date && a.surgery_date.slice(0, 7) === key).reduce((s, a) => s + Number(a.revenue || 0), 0);
        return { month: `T${dt.getMonth() + 1}`, revenue: Math.round(val / 1000000) };
      });
      const newCust6w = Array.from({ length: 6 }, (_, i) => {
        const dt = new Date(y, mo - 5 + i, 1); const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
        return { month: `T${dt.getMonth() + 1}`, value: appts.filter(a => a.appointment_date && a.appointment_date.slice(0, 7) === key).length };
      });

      const scMap = {};
      appts.forEach(a => { const s = (a.service || '').trim() || 'Khác'; scMap[s] = (scMap[s] || 0) + 1; });
      const scSorted = Object.entries(scMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      const restVal = scSorted.slice(5).reduce((s, x) => s + x.value, 0);
      const services = restVal > 0 ? [...scSorted.slice(0, 5), { name: 'Khác', value: restVal }] : scSorted.slice(0, 5);
      const scTotal = services.reduce((s, x) => s + x.value, 0);

      const DOWL = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const weekly = DOWL.map((lbl, i) => {
        const dt = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
        return { d: lbl, v: appts.filter(a => a.appointment_date === iso(dt)).length };
      });

      const tcMap = {};
      leadsM.forEach(a => { if (a.telesale_id) tcMap[a.telesale_id] = (tcMap[a.telesale_id] || 0) + 1; });
      const topConsultants = Object.entries(tcMap).map(([id, count]) => ({ name: nameOf[id] || 'Nhân viên', count })).sort((a, b) => b.count - a.count).slice(0, 3);

      setD({
        totalStaff: staff.length, presentToday: at.count || 0, appointmentsToday: todayAppts.length,
        pendingExpenses: ex.count || 0, pendingLeaves: lv.count || 0,
        monthRevenue, todayRevenue, closeRate, newCustomers: leadsM.length, scTotal,
        newStaffMonth,
        apptTrend: pctT(todayAppts.length, apptYday),
        revTrend: pctT(todayRevenue, revYday),
        revMonthTrend: pctT(monthRevenue, prevRevenue),
        closeTrend: (leadsM.length && prevLeads.length) ? (closeRate - prevClose) : null,
        newCustTrend: pctT(leadsM.length, prevLeads.length),
        rev6mTrend: pctT(revenue6m[5]?.revenue || 0, revenue6m[0]?.revenue || 0),
        revenue6m, services: services.map(s => ({ ...s, pct: scTotal ? Math.round(s.value / scTotal * 100) : 0 })),
        todayList: todayAppts.slice(0, 6), weekly, newCust6w, topConsultants,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
  );

  const todayFull = new Intl.NumberFormat('vi-VN').format(Math.round(d.todayRevenue)) + ' đ';
  const trendPct = (v) => v == null ? null : { up: v >= 0, txt: `${v >= 0 ? '↑' : '↓'} ${Math.abs(v)}%` };
  const hd = new Date();
  const heroWeekday = hd.toLocaleDateString('vi-VN', { weekday: 'long' });
  const heroDay = hd.getDate();
  const heroMonthYear = `Tháng ${hd.getMonth() + 1}, ${hd.getFullYear()}`;
  const presentPct = d.totalStaff ? Math.round(d.presentToday / d.totalStaff * 100) : 0;
  const statsDesktop = [
    { label: 'Nhân sự', value: d.totalStaff, icon: Users, color: '#14b8a6', tab: 'hr', trend: d.newStaffMonth > 0 ? { up: true, txt: `↑ ${d.newStaffMonth}` } : null, sub: 'Tổng nhân sự' },
    { label: 'Có mặt hôm nay', value: d.presentToday, icon: UserCheck, color: '#3b82f6', tab: 'hr', bar: presentPct, sub: `${presentPct}% có mặt` },
    { label: 'Lịch hẹn hôm nay', value: d.appointmentsToday, icon: CalendarDays, color: '#8b5cf6', tab: 'appointments', trend: trendPct(d.apptTrend), sub: 'so với hôm qua' },
    { label: 'Chờ duyệt', value: d.pendingExpenses, icon: AlertCircle, color: '#f59e0b', tab: 'advances', sub: 'Hồ sơ / yêu cầu' },
    { label: 'Doanh thu tháng', value: fmtVND(d.monthRevenue), icon: DollarSign, color: '#10b981', tab: 'finance', trend: trendPct(d.revMonthTrend), sub: 'so với tháng trước' },
    { label: 'Tỷ lệ chốt khách', value: d.closeRate + '%', icon: Target, color: '#6366f1', tab: 'khach_tu_van', trend: d.closeTrend != null ? { up: d.closeTrend >= 0, txt: `${d.closeTrend >= 0 ? '↑' : '↓'} ${Math.abs(d.closeTrend)}%` } : null, sub: 'so với tháng trước' },
  ];
  const stats = [
    { label: 'Nhân sự', value: d.totalStaff, icon: Users, color: '#14b8a6', tab: 'hr', trend: d.newStaffMonth > 0 ? { up: true, txt: `↑ ${d.newStaffMonth}` } : null, sub: 'Tổng nhân sự' },
    { label: 'Lịch hẹn', value: d.appointmentsToday, icon: CalendarDays, color: '#3b82f6', tab: 'appointments', trend: trendPct(d.apptTrend), sub: 'Hôm nay' },
    { label: 'Chờ duyệt', value: d.pendingExpenses, icon: AlertCircle, color: '#f59e0b', tab: 'advances', sub: 'Hồ sơ' },
    { label: 'Doanh thu tháng', value: fmtVND(d.monthRevenue), icon: DollarSign, color: '#10b981', tab: 'finance', trend: trendPct(d.revMonthTrend), sub: 'Ca mổ' },
    { label: 'Tỷ lệ chốt Khách', value: d.closeRate + '%', icon: Target, color: '#6366f1', tab: 'khach_tu_van', trend: d.closeTrend != null ? { up: d.closeTrend >= 0, txt: `${d.closeTrend >= 0 ? '↑' : '↓'} ${Math.abs(d.closeTrend)}%` } : null, sub: 'Cọc + mổ' },
    { label: 'Khách hàng mới', value: d.newCustomers, icon: UserCheck, color: '#8b5cf6', tab: 'khach_tu_van', trend: trendPct(d.newCustTrend), sub: 'Tháng này' },
  ];
  const reminders = [
    { label: 'Phiếu chi chờ duyệt', sub: 'Cần xử lý sớm', count: d.pendingExpenses, tab: 'advances', cls: 'bg-rose-50 text-rose-600' },
    { label: 'Đơn nghỉ phép chờ', sub: 'Chờ phê duyệt', count: d.pendingLeaves, tab: 'hr', cls: 'bg-amber-50 text-amber-600' },
    { label: 'Lịch hẹn hôm nay', sub: 'Khách cần chăm sóc', count: d.appointmentsToday, tab: 'appointments', cls: 'bg-teal-50 text-teal-600' },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Hero — MOBILE: ảnh phòng khám làm nền */}
      <div className="lg:hidden relative overflow-hidden rounded-3xl shadow-lg">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/clinic-hero.png')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,32,30,0.55) 0%, rgba(7,28,27,0.3) 38%, rgba(6,22,22,0.9) 100%)' }} />
        <div className="relative p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/25 grid place-items-center text-[11px] font-bold tracking-wide">DT</span>
              <div className="leading-tight"><div className="text-xs font-bold tracking-wide">DR TUẤN HƯNG</div><div className="text-[8px] tracking-[0.22em] text-white/60">COSMETIC SURGERY</div></div>
            </div>
          </div>
          <div className="mt-6 lg:mt-4 lg:flex lg:items-end lg:justify-between lg:gap-6">
            <div className="min-w-0">
              <p className="text-white/80 text-sm">Xin chào 👋</p>
              <h2 className="text-3xl font-bold text-white mt-0.5">{profile?.full_name || 'Admin'}</h2>
              <p className="text-white/70 text-xs mt-1">Chúc bạn một ngày làm việc hiệu quả!</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1"><span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /><span className="text-[11px] font-medium text-white">Hệ thống đang hoạt động tốt</span></div>
            </div>
            {/* Thẻ kính: lịch hẹn hôm nay | doanh thu hôm nay */}
            <div className="mt-5 lg:mt-0 lg:shrink-0 lg:w-[460px] grid grid-cols-2 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/15">
              <button onClick={() => setActiveTab('appointments')} className="p-4 text-left border-r border-white/10 hover:bg-white/5 transition">
                <div className="text-white/70 text-[11px]">Lịch hẹn hôm nay</div>
                <div className="text-white text-2xl font-bold mt-0.5">{d.appointmentsToday}<span className="text-xs font-medium text-white/60"> cuộc hẹn</span></div>
                {d.apptTrend != null && <div className="text-[11px] mt-1 font-semibold text-emerald-300">{d.apptTrend >= 0 ? '↑' : '↓'} {Math.abs(d.apptTrend)}% <span className="text-white/50 font-normal">so với hôm qua</span></div>}
              </button>
              <button onClick={() => setActiveTab('finance')} className="p-4 text-left hover:bg-white/5 transition">
                <div className="text-white/70 text-[11px]">Doanh thu hôm nay</div>
                <div className="text-white text-lg font-bold mt-0.5">{todayFull}</div>
                {d.revTrend != null && <div className="text-[11px] mt-1 font-semibold text-emerald-300">{d.revTrend >= 0 ? '↑' : '↓'} {Math.abs(d.revTrend)}% <span className="text-white/50 font-normal">so với hôm qua</span></div>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero — DESKTOP: gradient xanh + ảnh phải */}
      <div className="hidden lg:block relative overflow-hidden rounded-3xl text-white shadow-lg" style={{ background: 'linear-gradient(120deg,#0f766e 0%,#0d9488 55%,#14b8a6 100%)' }}>
        <div className="absolute inset-y-0 right-0 w-[32%]">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/clinic-hero.png')" }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,#0f9488 0%, rgba(20,184,166,0.55) 35%, rgba(20,184,166,0) 100%)' }} />
        </div>
        <div className="relative p-6 pr-[34%] flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm">Xin chào 👋</p>
            <h2 className="text-3xl font-bold mt-0.5">{profile?.full_name || 'Admin'}</h2>
            <p className="text-white/70 text-xs mt-1">Chúc bạn một ngày làm việc hiệu quả!</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5"><span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /><span className="text-xs font-medium">Hệ thống đang hoạt động tốt</span></div>
          </div>
          <div className="shrink-0 bg-white/12 rounded-2xl px-4 py-3 text-center border border-white/15">
            <div className="flex items-center justify-center gap-1 text-white/70 text-[11px] capitalize">{heroWeekday} <CalendarDays className="w-3 h-3" /></div>
            <div className="text-3xl font-bold leading-none mt-1">{heroDay}</div>
            <div className="text-white/70 text-[11px] mt-1">{heroMonthYear}</div>
          </div>
          <div className="shrink-0">
            <div className="text-white/70 text-[11px]">Doanh thu hôm nay</div>
            <div className="flex items-center gap-2 mt-0.5"><div className="text-2xl font-bold">{todayFull}</div>{d.revTrend != null && <span className="text-[11px] font-bold text-emerald-200">{d.revTrend >= 0 ? '↑' : '↓'} {Math.abs(d.revTrend)}%</span>}</div>
            <div className="text-white/60 text-[11px] mt-0.5">So với hôm qua</div>
          </div>
          <div className="shrink-0 flex flex-col gap-2">
            <button onClick={() => setActiveTab('appointments')} className="inline-flex items-center gap-2 bg-white text-teal-700 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-teal-50 transition"><Plus className="w-4 h-4" /> Tạo lịch hẹn</button>
            <button onClick={() => setActiveTab('appointments')} className="inline-flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/25 transition"><Plus className="w-4 h-4" /> Thêm khách hàng</button>
            <button onClick={() => setActiveTab('pl')} className="inline-flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/25 transition"><BarChart2 className="w-4 h-4" /> Báo cáo nhanh</button>
          </div>
        </div>
      </div>

      {/* Stat cards — MOBILE (3 cột) */}
      <div className="lg:hidden grid grid-cols-3 gap-2.5">
        {stats.map(c => (
          <button key={c.label} onClick={() => setActiveTab(c.tab)} className="bg-white rounded-2xl p-3 text-left shadow-sm border border-slate-100 hover:shadow-md transition">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: c.color + '1a' }}><c.icon className="w-4 h-4" style={{ color: c.color }} /></span>
            <div className="text-[10.5px] text-slate-400 font-semibold leading-tight">{c.label}</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">{c.value}</div>
            {c.trend
              ? <div className={`text-[10.5px] font-bold mt-0.5 ${c.trend.up ? 'text-emerald-500' : 'text-rose-500'}`}>{c.trend.txt}</div>
              : <div className="text-[10.5px] text-slate-400 mt-0.5">{c.sub}</div>}
          </button>
        ))}
      </div>

      {/* Stat cards — DESKTOP (6 thẻ lớn) */}
      <div className="hidden lg:grid grid-cols-6 gap-3">
        {statsDesktop.map(c => (
          <button key={c.label} onClick={() => setActiveTab(c.tab)} className="bg-white rounded-2xl p-4 text-left shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: c.color + '1a' }}><c.icon className="w-5 h-5" style={{ color: c.color }} /></span>
            <div className="text-xs text-slate-400 font-semibold">{c.label}</div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">{c.value}</div>
            {c.bar != null
              ? <><div className="text-[11px] text-slate-400 mt-1">{c.sub}</div><div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.bar}%`, backgroundColor: c.color }} /></div></>
              : <><div className={`text-[11px] font-bold mt-1 ${c.trend ? (c.trend.up ? 'text-emerald-500' : 'text-rose-500') : 'text-transparent'}`}>{c.trend ? c.trend.txt : '·'}</div><div className="text-[11px] text-slate-400">{c.sub}</div></>}
          </button>
        ))}
      </div>

      {/* Doanh thu 6 tháng — full width */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-800">Doanh thu 6 tháng gần đây</h3>
          <span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1">6 tháng</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-slate-800">{fmtVND(d.revenue6m.reduce((s, x) => s + x.revenue, 0) * 1000000)}</div>
          {d.rev6mTrend != null && <span className={`text-xs font-bold ${d.rev6mTrend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{d.rev6mTrend >= 0 ? '↑' : '↓'} {Math.abs(d.rev6mTrend)}%</span>}
        </div>
        <div className="text-[11px] text-slate-400">so với 6 tháng trước</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={d.revenue6m} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
            <defs><linearGradient id="revA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [`${v} Tr`, 'Doanh thu']} />
            <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#revA)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Thao tác nhanh — mobile */}
      <div className="lg:hidden bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">Thao tác nhanh</h3><span className="text-xs text-teal-600 font-semibold">Tùy chỉnh</span></div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Thêm lịch hẹn', icon: CalendarDays, tab: 'appointments', color: '#14b8a6' },
            { label: 'Thêm khách hàng', icon: Users, tab: 'appointments', color: '#3b82f6' },
            { label: 'Báo cáo nhanh', icon: BarChart2, tab: 'pl', color: '#8b5cf6' },
            { label: 'Phiếu thu / CSKH', icon: ClipboardList, tab: 'hau_phau', color: '#f59e0b' },
          ].map(q => (
            <button key={q.label} onClick={() => setActiveTab(q.tab)} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition">
              <span className="w-11 h-11 rounded-2xl grid place-items-center" style={{ backgroundColor: q.color + '1a' }}><q.icon className="w-5 h-5" style={{ color: q.color }} /></span>
              <span className="text-[11px] text-slate-600 font-medium text-center leading-tight">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Phân tích thêm — desktop */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-2">Cơ cấu dịch vụ</h3>
          {d.services.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">Chưa có dữ liệu</div> : (
          <div className="flex items-center gap-3">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart><Pie data={d.services} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58} paddingAngle={2} stroke="none">{d.services.map((s, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie></RPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-lg font-bold text-slate-800">{d.scTotal}</div><div className="text-[10px] text-slate-400">Khách</div></div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {d.services.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="flex-1 min-w-0 truncate text-slate-600">{s.name}</span><span className="font-bold text-slate-700">{s.pct}%</span></div>
              ))}
            </div>
          </div>)}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-slate-800">Lịch hẹn hôm nay</h3><button onClick={() => setActiveTab('appointments')} className="text-xs text-teal-600 font-semibold">Tất cả</button></div>
          {d.todayList.length === 0 ? <div className="text-sm text-slate-400 py-6 text-center">Chưa có lịch hẹn</div> : (
          <div className="space-y-2.5">
            {d.todayList.map(a => (
              <div key={a.id} className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-[11px] font-bold shrink-0">{initials(a.customer_name)}</span>
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-800 truncate">{a.customer_name}</div><div className="text-[11px] text-slate-400 truncate">{a.service || '—'}</div></div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${APPT_ST[a.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{APPT_ST[a.status]?.label || a.status}</span>
              </div>
            ))}
          </div>)}
        </div>
      </div>

      {/* Hàng dưới — desktop */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-1">Lịch hẹn theo tuần</h3>
          <div className="text-2xl font-bold text-slate-800">{d.weekly.reduce((s, x) => s + x.v, 0)}</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={d.weekly} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis hide /><Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} formatter={(v) => [v, 'Lịch hẹn']} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} fill="#14b8a6" barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-1">Khách mới (6 tháng)</h3>
          <div className="text-2xl font-bold text-slate-800">{d.newCustomers}<span className="text-xs font-medium text-slate-400"> tháng này</span></div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={d.newCust6w} margin={{ top: 8, right: 6, left: -28, bottom: 0 }}>
              <defs><linearGradient id="ncA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis hide /><Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} formatter={(v) => [v, 'Khách mới']} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#ncA)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">Top tư vấn viên</h3><button onClick={() => setActiveTab('khach_tu_van')} className="text-xs text-teal-600 font-semibold">Xem</button></div>
          {d.topConsultants.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">Chưa có dữ liệu</div> : (
          <div className="space-y-2.5">
            {d.topConsultants.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold shrink-0 text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-300'}`}>{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-700">{t.name}</span>
                <span className="text-xs font-bold text-teal-600 shrink-0">{t.count} khách</span>
              </div>
            ))}
          </div>)}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">Nhắc việc / Phê duyệt</h3>
          <div className="space-y-2">
            {reminders.map(r => (
              <button key={r.label} onClick={() => setActiveTab(r.tab)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition text-left">
                <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${r.cls}`}><AlertCircle className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700 truncate">{r.label}</div><div className="text-[11px] text-slate-400 truncate">{r.sub}</div></div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{r.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ComingSoon = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-64 space-y-3">
    <div className="w-16 h-16 rounded-3xl bg-teal-50 flex items-center justify-center text-2xl">🚧</div>
    <div className="text-base font-semibold text-slate-700">{label}</div>
    <div className="text-sm text-slate-400">Module đang được xây dựng</div>
  </div>
);

const AdminDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => (new URLSearchParams(window.location.search).get('meeting') ? 'meetings' : (localStorage.getItem('admin_active_tab') || 'overview')));
  const [hrInitialTab, setHrInitialTab] = useState('staff');

  useEffect(() => { localStorage.setItem('admin_active_tab', activeTab); }, [activeTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState(0);

  useEffect(() => {
    // Fetch initial count
    const fetchPendingLeaves = async () => {
      const { count } = await supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending');
      setPendingLeaves(count || 0);
    };
    fetchPendingLeaves();

    // Subscribe to real-time changes
    const sub = supabase.channel('leave_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchPendingLeaves();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const handleNav = (e) => {
      const [tab, sub] = String(e.detail).split('#');
      setActiveTab(tab);
      if (sub) setHrInitialTab(sub);
    };
    window.addEventListener('NAVIGATE', handleNav);
    return () => window.removeEventListener('NAVIGATE', handleNav);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview profile={profile} setActiveTab={setActiveTab} />;
      case 'hr': return <HRManagementPage initialTab={hrInitialTab} />;
      case 'deposit_management': return <DepositManagementPage />;
      case 'appointments': return <AppointmentManagementPage />;
      case 'khach_phau_thuat': return <KhachPhauThuatPage setActiveTab={setActiveTab} />;
      case 'hau_phau': return <HauPhauPage />;
      case 'advances': return <AdvanceExpensePage />;
      case 'finance': return <FinanceManagementPage />;
      case 'pl': return <PLPage />;
      case 'kpi': return <KPIManagementPage />;
      case 'payroll': return <PayrollPage />;
      case 'meetings': return <MeetingPage />;
      case 'community': return <CommunityPage />;
      case 'notifications': return <NotificationsPage />;
      case 'marketing': return <MarketingHubPage />;
      case 'data_kh': return <MarketingDataPage />;
      case 'khach_tu_van': return <KhachTuVanPage />;
      case 'hospital_fee_inventory': return <HospitalFeeAndInventoryPage />;
      case 'cashflow': return <CashFlowPage />;
      default: return <ComingSoon label={MENU.find(m => m.id === activeTab)?.label || activeTab} />;
    }
  };

  const activeMenu = MENU.find(m => m.id === activeTab);

  return (
    <div className="min-h-screen flex" style={{ background: '#f3f6f5' }}>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar desktop */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        bg-slate-900 border-r border-slate-800 shadow-2xl
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-md overflow-hidden p-1">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Dr Tuấn Hùng</div>
                <div className="text-xs text-teal-400">Internal System</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {MENU_GROUPS.map((group, gi) => {
            const gs = GROUP_STYLE[group.color] || {};
            return (
            <div key={group.title || `g${gi}`} className={group.title ? 'pt-3' : ''}>
              {group.title && (
                <div className="flex items-center gap-2 px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${gs.bar}`} />
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-medium transition-all
                        ${active
                          ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/40'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </div>
                      {item.id === 'hr' && pendingLeaves > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {pendingLeaves}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar - chỉ desktop */}
        <header className="hidden lg:flex items-center justify-between bg-white/85 backdrop-blur border-b border-slate-100 px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            {activeMenu && <span className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center"><activeMenu.icon className="w-4 h-4 text-teal-600" /></span>}
            <span className="font-bold text-slate-800 text-[15px]">{activeMenu?.label}</span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu mobile={false}>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 pr-3 rounded-full transition-colors border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {profile?.full_name?.charAt(0) || 'A'}
                </div>
                <span className="text-sm font-semibold text-slate-700">{profile?.full_name}</span>
              </div>
            </ProfileMenu>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between bg-white border-b border-teal-100 px-4 py-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {activeMenu && <activeMenu.icon className="w-4 h-4 text-teal-600" />}
            <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu mobile={true}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold hover:shadow-md transition-shadow cursor-pointer">
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
            </ProfileMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-teal-100 shadow-lg">
        <div className="flex items-stretch safe-pb">
          {MENU.filter(m => BOTTOM_NAV.includes(m.id)).map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-all relative"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  active ? 'bg-teal-500 shadow-md shadow-teal-200' : ''
                }`}>
                  <Icon className={`w-4 h-4 transition-colors ${active ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <span className={`text-[10px] font-medium leading-none transition-colors ${active ? 'text-teal-600' : 'text-slate-400'}`}>
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center">
              <Menu className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-[10px] font-medium leading-none text-slate-400">Thêm</span>
          </button>
        </div>
      </nav>

    </div>
  );
};

export default AdminDashboard;
