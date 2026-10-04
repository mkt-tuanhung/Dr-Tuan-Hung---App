import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient';
import StaffManagementPage from '@/pages/StaffManagementPage.jsx';
import AttendanceManagementPage from '@/pages/AttendanceManagementPage.jsx';
import KPIManagementPage from '@/pages/KPIManagementPage.jsx';
import PayrollPage from '@/pages/PayrollPage.jsx';
import CommunityPage from '@/pages/CommunityPage.jsx';
import MinigamePage from '@/pages/MinigamePage.jsx';
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
import SeedingRevenuePage from '@/pages/SeedingRevenuePage.jsx';
import ServiceQualityPage from '@/pages/ServiceQualityPage.jsx';
import HRManagementPage from '@/pages/HRManagementPage.jsx';
import HospitalFeeAndInventoryPage from '@/pages/HospitalFeeAndInventoryPage.jsx';
import DepositManagementPage from '@/pages/DepositManagementPage.jsx';
import MarketingHubPage from '@/pages/MarketingHubPage.jsx';
import MarketingDataPage from '@/pages/MarketingDataPage.jsx';
import ContentProductionPage from '@/pages/ContentProductionPage.jsx';
import AdsReportPage from '@/pages/AdsReportPage.jsx';
import KhachTuVanPage from '@/pages/KhachTuVanPage.jsx';
import MeetingPage from '@/pages/MeetingPage.jsx';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';
import AppShell from '@/components/shell/AppShell.jsx';
import { parseNav, setPendingFocus } from '@/lib/notif';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, ClipboardList,
  Banknote, Activity, Target, Wallet, Bell, ShieldCheck, LogOut,
  Menu, X, AlertCircle, ChevronRight, CheckCircle2, CircleDollarSign,
  Briefcase, Plus, Search, UserX, DollarSign, UserCheck, TrendingUp, BarChart2, MessagesSquare, Database, Video, PieChart, Sprout, Smile,
  Clapperboard, FolderOpen, PlayCircle, Image as ImageIcon, ChevronDown, Gamepad2
} from 'lucide-react';
import { HeroCard, QuickActions, StatCard, Panel } from '@/components/overview/OverviewKit.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart as RPieChart, Pie, Cell } from 'recharts';

const MENU_GROUPS = [
  { title: null, items: [
    { id: 'overview', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: LayoutDashboard },
  ]},
  { title: 'KHÁCH HÀNG', color: 'blue', items: [
    { id: 'data_kh', label: 'Khách hàng (CRM)', icon: Database },
    { id: 'deposit_management', label: 'Quản lý Đặt cọc', icon: ClipboardList },
    { id: 'appointments', label: 'Lịch hẹn', shortLabel: 'Lịch hẹn', icon: CalendarDays },
    { id: 'khach_tu_van', label: 'Khách tư vấn', icon: UserCheck },
    { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity },
    { id: 'hau_phau', label: 'Hậu phẫu / CSKH', icon: ClipboardList },
    { id: 'service_quality', label: 'Đánh giá dịch vụ', icon: Smile },
  ]},
  { title: 'NHÂN SỰ', color: 'violet', items: [
    { id: 'hr', label: 'Quản lý Nhân sự', shortLabel: 'Nhân sự', icon: Users },
    { id: 'kpi', label: 'KPI & Hoa hồng', shortLabel: 'KPI', icon: Target },
    { id: 'payroll', label: 'Bảng lương', icon: Wallet },
  ]},
  { title: 'TÀI CHÍNH', color: 'amber', items: [
    { id: 'finance', label: 'Doanh thu / Tài chính', icon: Banknote },
    { id: 'pl', label: 'Lãi / Lỗ (P&L)', icon: PieChart },
    { id: 'seeding_rev', label: 'Doanh thu Seeding', icon: Sprout },
    { id: 'cashflow', label: 'Kế toán dòng tiền', icon: BarChart2 },
    { id: 'advances', label: 'Tạm ứng chi', icon: Wallet },
    { id: 'hospital_fee_inventory', label: 'Viện phí / Vật tư', icon: Activity },
    { id: 'marketing', label: 'Marketing', icon: Clapperboard, children: [
      { id: 'content_overview', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'ads_report',     label: 'Chi phí Ads', icon: BarChart2 },
      { id: 'content_kho',    label: 'Kho Media',   icon: FolderOpen },
      { id: 'content_video',  label: 'Video Ads',   icon: PlayCircle },
      { id: 'content_images', label: 'Hình Ảnh',    icon: ImageIcon },
    ] },
  ]},
  { title: 'VẬN HÀNH', color: 'rose', items: [
    { id: 'meetings', label: 'Phòng họp', icon: Video },
    { id: 'community', label: 'Cộng đồng', icon: MessagesSquare },
    { id: 'minigame', label: 'Minigame', icon: Gamepad2 },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'permissions', label: 'Phân quyền', icon: ShieldCheck },
  ]},
];
const MENU = MENU_GROUPS.flatMap(g => g.items).flatMap(m => m.children ? [m, ...m.children] : [m]);

// Bảng màu cho donut cơ cấu dịch vụ (xanh → xanh dương → tím, giống mockup)
const PIE_COLORS = ['#468A86', '#6BB0AA', '#5B8DD6', '#8B7BD8', '#E5A13C', '#CAD3D3'];
const SUBTABS = [
  { id: 'tong_quan', label: 'Tổng quan' },
  { id: 'phan_tich', label: 'Phân tích' },
  { id: 'van_hanh', label: 'Vận hành' },
];
const RANGES = [
  { id: '7d', label: '7 ngày', unit: 'ngày', note: '7 ngày gần nhất' },
  { id: '30d', label: '30 ngày', unit: 'ngày', note: 'so với 30 ngày trước' },
  { id: '6m', label: '6 tháng', unit: 'tháng', note: 'so với 6 tháng trước' },
  { id: '12m', label: '12 tháng', unit: 'tháng', note: '12 tháng gần nhất' },
];
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
  const [sub, setSub] = useState('tong_quan');
  const [rangeKey, setRangeKey] = useState('30d');
  const [d, setD] = useState({
    totalStaff: 0, presentToday: 0, appointmentsToday: 0, pendingExpenses: 0, pendingLeaves: 0,
    monthRevenue: 0, todayRevenue: 0, closeRate: 0, newCustomers: 0, scTotal: 0,
    newStaffMonth: 0, apptTrend: null, revTrend: null, revMonthTrend: null, closeTrend: null, newCustTrend: null, rev6mTrend: null,
    revenue6m: [], services: [], todayList: [], weekly: [], newCust6w: [], topConsultants: [],
    ranges: { '7d': [], '30d': [], '6m': [], '12m': [] },
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
      const twelveStart = iso(new Date(y, mo - 11, 1));
      const dow = (now.getDay() + 6) % 7;                 // 0 = Thứ 2
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - dow);

      const [pf, at, ex, lv, ap] = await Promise.all([
        supabase.from('profiles').select('id, full_name, created_at').eq('is_active', true),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', todayStr).eq('status', 'present'),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('customer_appointments')
          .select('id, customer_name, service, status, appointment_date, surgery_date, revenue, telesale_id, created_at')
          .or(`appointment_date.gte.${twelveStart},surgery_date.gte.${twelveStart},created_at.gte.${twelveStart}`)
          .limit(8000),
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

      // Chuỗi doanh thu theo khoảng thời gian (cho tab Phân tích)
      const revByDay = (n) => Array.from({ length: n }, (_, i) => { const dt = new Date(now); dt.setDate(now.getDate() - (n - 1 - i)); const ds = iso(dt); return { label: `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`, value: appts.filter(a => a.status === 'phau_thuat' && a.surgery_date === ds).reduce((s, a) => s + Number(a.revenue || 0), 0) }; });
      const revByMon = (n) => Array.from({ length: n }, (_, i) => { const dt = new Date(y, mo - (n - 1) + i, 1); const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`; return { label: `T${dt.getMonth() + 1}`, value: appts.filter(a => a.status === 'phau_thuat' && a.surgery_date && a.surgery_date.slice(0, 7) === key).reduce((s, a) => s + Number(a.revenue || 0), 0) }; });
      const ranges = { '7d': revByDay(7), '30d': revByDay(30), '6m': revByMon(6), '12m': revByMon(12) };

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
        todayList: todayAppts.slice(0, 6), weekly, newCust6w, topConsultants, ranges,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
  );

  const trendPct = (v) => v == null ? null : { up: v >= 0, txt: `${v >= 0 ? '↑' : '↓'} ${Math.abs(v)}%` };
  const presentPct = d.totalStaff ? Math.round(d.presentToday / d.totalStaff * 100) : 0;
  const weekTotal = d.weekly.reduce((t, x) => t + x.v, 0);
  const statsDesktop = [
    { label: 'Tổng nhân sự', value: d.totalStaff, icon: Users, color: '#468A86', tab: 'hr', trend: d.newStaffMonth > 0 ? { up: true, txt: `+${d.newStaffMonth}` } : null, sub: d.newStaffMonth > 0 ? 'mới trong tháng' : 'đang hoạt động' },
    { label: 'Khách mới tháng', value: d.newCustomers, icon: UserCheck, color: '#8B7BD8', tab: 'khach_tu_van', trend: trendPct(d.newCustTrend), sub: 'so với tháng trước' },
    { label: 'Tỷ lệ chốt', value: d.closeRate + '%', icon: Target, color: '#5B8DD6', tab: 'khach_tu_van', trend: d.closeTrend != null ? { up: d.closeTrend >= 0, txt: `${d.closeTrend >= 0 ? '↑' : '↓'} ${Math.abs(d.closeTrend)}%` } : null, sub: 'cọc + phẫu thuật' },
    { label: 'Lịch hẹn tuần này', value: weekTotal, icon: CalendarDays, color: '#E5A13C', tab: 'appointments', sub: 'từ Thứ 2 tới CN' },
  ];
  const reminders = [
    { label: 'Phiếu chi chờ duyệt', sub: 'Cần xử lý sớm', count: d.pendingExpenses, tab: 'advances', cls: 'bg-rose-50 text-rose-600' },
    { label: 'Đơn nghỉ phép chờ', sub: 'Chờ phê duyệt', count: d.pendingLeaves, tab: 'hr', cls: 'bg-amber-50 text-amber-600' },
    { label: 'Lịch hẹn hôm nay', sub: 'Khách cần chăm sóc', count: d.appointmentsToday, tab: 'appointments', cls: 'bg-teal-50 text-teal-600' },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Sub-tabs trong Tổng quan */}
      <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-soft border border-slate-200/70 lg:w-fit">
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} className={`flex-1 lg:flex-none lg:px-7 px-3 h-9 rounded-xl text-[13.5px] font-semibold transition ${sub === t.id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{t.label}</button>
        ))}
      </div>

      {sub === 'tong_quan' && <>
      {/* Thẻ chào + điểm vận hành hôm nay */}
      <HeroCard
        profile={profile}
        roleLabel="Quản trị viên"
        ring={{ value: presentPct, label: 'Nhân sự có mặt hôm nay', sub: `${d.presentToday}/${d.totalStaff} người đã chấm công`, onClick: () => setActiveTab('hr') }}
        stats={[
          { label: 'Lịch hẹn hôm nay', value: d.appointmentsToday, sub: d.apptTrend != null ? `${d.apptTrend >= 0 ? '↑' : '↓'} ${Math.abs(d.apptTrend)}% so với hôm qua` : 'cuộc hẹn', subTone: d.apptTrend != null ? (d.apptTrend >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold') : undefined, onClick: () => setActiveTab('appointments') },
          { label: 'Doanh thu hôm nay', value: fmtVND(d.todayRevenue), sub: d.revTrend != null ? `${d.revTrend >= 0 ? '↑' : '↓'} ${Math.abs(d.revTrend)}% so với hôm qua` : 'từ ca phẫu thuật', subTone: d.revTrend != null ? (d.revTrend >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold') : undefined, onClick: () => setActiveTab('finance') },
          { label: 'Doanh thu tháng', value: fmtVND(d.monthRevenue), sub: d.revMonthTrend != null ? `${d.revMonthTrend >= 0 ? '↑' : '↓'} ${Math.abs(d.revMonthTrend)}% so với tháng trước` : 'tháng này', subTone: d.revMonthTrend != null ? (d.revMonthTrend >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold') : undefined, onClick: () => setActiveTab('finance') },
          { label: 'Cần phê duyệt', value: d.pendingExpenses + d.pendingLeaves, sub: `${d.pendingExpenses} phiếu chi · ${d.pendingLeaves} nghỉ phép`, subTone: (d.pendingExpenses + d.pendingLeaves) > 0 ? 'text-amber-600 font-semibold' : undefined, onClick: () => setActiveTab(d.pendingExpenses ? 'advances' : 'hr') },
        ]}
      />

      {/* Thao tác nhanh */}
      <QuickActions onSelect={setActiveTab} items={[
        { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays, color: '#468A86' },
        { id: 'data_kh', label: 'Khách hàng', icon: Database, color: '#5B8DD6' },
        { id: 'deposit_management', label: 'Đặt cọc', icon: ClipboardList, color: '#8B7BD8' },
        { id: 'khach_phau_thuat', label: 'Phẫu thuật', icon: Activity, color: '#3FA7A2' },
        { id: 'hr', label: 'Nhân sự', icon: Users, color: '#E5A13C' },
        { id: 'finance', label: 'Doanh thu', icon: Banknote, color: '#5BAE7B' },
        { id: 'pl', label: 'Lãi / Lỗ', icon: PieChart, color: '#C46FB0' },
        { id: 'notifications', label: 'Thông báo', icon: Bell, color: '#D9635C' },
      ]} />

      {/* Chỉ số chính */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statsDesktop.map(c => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} color={c.color} trend={c.trend} sub={c.sub} bar={c.bar} onClick={() => setActiveTab(c.tab)} />
        ))}
      </div>

      {/* Doanh thu + Lịch hẹn hôm nay */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel className="xl:col-span-8" title="Doanh thu 6 tháng gần đây" action={<span className="text-[12px] font-semibold text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">6 tháng</span>}>
          <div className="flex items-center gap-2">
            <div className="text-[24px] font-bold text-slate-900">{fmtVND(d.revenue6m.reduce((s, x) => s + x.revenue, 0) * 1000000)}</div>
            {d.rev6mTrend != null && <span className={`text-xs font-bold ${d.rev6mTrend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{d.rev6mTrend >= 0 ? '↑' : '↓'} {Math.abs(d.rev6mTrend)}%</span>}
          </div>
          <div className="text-[11.5px] text-slate-400">tháng này so với 6 tháng trước</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.revenue6m} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
              <defs><linearGradient id="revA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#529c96" stopOpacity={0.3} /><stop offset="100%" stopColor="#529c96" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#EEF2F2" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#97A4A5' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#97A4A5' }} width={40} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [`${v} Tr`, 'Doanh thu']} />
              <Area type="monotone" dataKey="revenue" stroke="#468a86" strokeWidth={2.5} fill="url(#revA)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel className="xl:col-span-4" title="Lịch hẹn hôm nay" action={<button onClick={() => setActiveTab('appointments')} className="text-[12.5px] text-teal-700 font-semibold inline-flex items-center gap-0.5 hover:underline">Mở lịch <ChevronRight className="w-3.5 h-3.5" /></button>}>
          {d.todayList.length === 0 ? <div className="text-sm text-slate-400 py-10 text-center">Hôm nay chưa có lịch hẹn</div> : (
          <div className="divide-y divide-slate-100">
            {d.todayList.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 grid place-items-center text-[11px] font-bold shrink-0">{initials(a.customer_name)}</span>
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-slate-800 truncate">{a.customer_name}</div><div className="text-[11.5px] text-slate-400 truncate">{a.service || '—'}</div></div>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${APPT_ST[a.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{APPT_ST[a.status]?.label || a.status}</span>
              </div>
            ))}
          </div>)}
        </Panel>
      </div>

      {/* Hàng phân tích */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Panel title="Cơ cấu dịch vụ">
          {d.services.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">Chưa có dữ liệu</div> : (
          <div className="flex items-center gap-3">
            <div className="relative w-[110px] h-[110px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart><Pie data={d.services} dataKey="value" nameKey="name" innerRadius={36} outerRadius={53} paddingAngle={2} stroke="none">{d.services.map((s, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie></RPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-lg font-bold text-slate-800">{d.scTotal}</div><div className="text-[10px] text-slate-400">Khách</div></div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {d.services.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="flex-1 min-w-0 truncate text-slate-600">{s.name}</span><span className="font-bold text-slate-700">{s.pct}%</span></div>
              ))}
            </div>
          </div>)}
        </Panel>
        <Panel title="Lịch hẹn tuần này" action={<span className="text-[18px] font-bold text-slate-900 tabular-nums">{d.weekly.reduce((s, x) => s + x.v, 0)}</span>}>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={d.weekly} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#97A4A5' }} />
              <YAxis hide /><Tooltip cursor={{ fill: '#EEF2F2' }} contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} formatter={(v) => [v, 'Lịch hẹn']} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} fill="#529c96" barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Top tư vấn tháng" action={<button onClick={() => setActiveTab('khach_tu_van')} className="text-[12.5px] text-teal-700 font-semibold hover:underline">Xem</button>}>
          {d.topConsultants.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">Chưa có dữ liệu</div> : (
          <div className="space-y-2.5">
            {d.topConsultants.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold shrink-0 text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-300'}`}>{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-700">{t.name}</span>
                <span className="text-xs font-bold text-teal-700 shrink-0">{t.count} khách</span>
              </div>
            ))}
          </div>)}
        </Panel>
        <Panel title="Nhắc việc / Phê duyệt">
          <div className="space-y-1">
            {reminders.map(r => (
              <button key={r.label} onClick={() => setActiveTab(r.tab)} className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition text-left">
                <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${r.cls}`}><AlertCircle className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700 truncate">{r.label}</div><div className="text-[11px] text-slate-400 truncate">{r.sub}</div></div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{r.count}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      </>}

      {sub === 'phan_tich' && (
        <div className="space-y-4">
          <div className="flex gap-1.5 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRangeKey(r.id)} className={`flex-1 px-2 py-2 rounded-xl text-[13px] font-semibold transition ${rangeKey === r.id ? 'bg-teal-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>{r.label}</button>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800">Doanh thu</h3><span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1">Theo {RANGES.find(r => r.id === rangeKey)?.unit}</span></div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{fmtVND((d.ranges[rangeKey] || []).reduce((s, x) => s + x.value, 0))}</div>
            <div className="text-[11px] text-slate-400">{RANGES.find(r => r.id === rangeKey)?.note}</div>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={d.ranges[rangeKey] || []} margin={{ top: 14, right: 8, left: -6, bottom: 0 }}>
                <defs><linearGradient id="paA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={44} tickFormatter={(v) => v >= 1e9 ? (v / 1e9).toFixed(0) + 'T' : v >= 1e6 ? Math.round(v / 1e6) + 'Tr' : v} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [fmtVND(v), 'Doanh thu']} />
                <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} fill="url(#paA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3">Cơ cấu dịch vụ</h3>
            {d.services.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">Chưa có dữ liệu</div> : (
            <div className="flex items-center gap-4">
              <div className="relative w-[130px] h-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart><Pie data={d.services} dataKey="value" nameKey="name" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none">{d.services.map((s, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie></RPieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-xl font-bold text-slate-800">{d.scTotal}</div><div className="text-[10px] text-slate-400">Khách hàng</div></div>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {d.services.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-[13px]"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="flex-1 min-w-0 truncate text-slate-600">{s.name}</span><span className="font-bold text-slate-700">{s.pct}%</span><span className="text-slate-400 w-9 text-right">{s.value}</span></div>
                ))}
              </div>
            </div>)}
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-1">Lịch hẹn theo tuần</h3>
            <div className="text-2xl font-bold text-slate-800">{d.weekly.reduce((s, x) => s + x.v, 0)}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.weekly} margin={{ top: 12, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis hide /><Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} formatter={(v) => [v, 'Lịch hẹn']} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]} fill="#529c96" barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sub === 'van_hanh' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-slate-800">Lịch hẹn hôm nay</h3><button onClick={() => setActiveTab('appointments')} className="text-xs text-teal-600 font-semibold inline-flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3" /></button></div>
            <div className="flex items-center gap-2 mb-3"><span className="text-xl font-bold text-slate-800">{d.appointmentsToday}</span><span className="text-sm text-slate-400">cuộc hẹn</span>{d.apptTrend != null && <span className={`text-[11px] font-bold ${d.apptTrend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{d.apptTrend >= 0 ? '↑' : '↓'} {Math.abs(d.apptTrend)}% <span className="text-slate-400 font-normal">so với hôm qua</span></span>}</div>
            {d.todayList.length === 0 ? <div className="text-sm text-slate-400 py-6 text-center">Chưa có lịch hẹn</div> : (
            <div className="divide-y divide-slate-50">
              {d.todayList.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-xs font-bold shrink-0">{initials(a.customer_name)}</span>
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-800 truncate">{a.customer_name}</div><div className="text-[11px] text-slate-400 truncate">{a.service || '—'}</div></div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${APPT_ST[a.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{APPT_ST[a.status]?.label || a.status}</span>
                </div>
              ))}
            </div>)}
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3">Nhắc việc / Phê duyệt</h3>
            <div className="space-y-1">
              {reminders.map(r => (
                <button key={r.label} onClick={() => setActiveTab(r.tab)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition text-left">
                  <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${r.cls}`}><AlertCircle className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700 truncate">{r.label}</div><div className="text-[11px] text-slate-400 truncate">{r.sub}</div></div>
                  <span className="text-sm font-bold text-slate-700 shrink-0">{r.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">Top tư vấn viên</h3><button onClick={() => setActiveTab('khach_tu_van')} className="text-xs text-teal-600 font-semibold">Xem tất cả</button></div>
            {d.topConsultants.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">Chưa có dữ liệu</div> : (
            <div className="space-y-3">
              {d.topConsultants.map((t, i) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-extrabold shrink-0 text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-300'}`}>{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-700">{t.name}</span>
                  <span className="text-sm font-bold text-teal-600 shrink-0">{t.count} khách</span>
                </div>
              ))}
            </div>)}
          </div>
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    const f = q.get('focus');
    if (f) setPendingFocus({ tab: t || 'overview', id: f });
    return t || (q.get('meeting') ? 'meetings' : (localStorage.getItem('admin_active_tab') || 'overview'));
  });
  const [hrInitialTab, setHrInitialTab] = useState('staff');

  useEffect(() => { localStorage.setItem('admin_active_tab', activeTab); }, [activeTab]);
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
      const { tab, focus } = parseNav(e.detail);
      setActiveTab(tab);
      if (tab === 'hr' && focus) {
        setHrInitialTab(focus);
      } else if (focus) {
        setPendingFocus({ tab, id: focus });
        setTimeout(() => window.dispatchEvent(new CustomEvent('FOCUS_ITEM', { detail: { tab, id: focus } })), 60);
      }
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
      case 'minigame': return <MinigamePage />;
      case 'notifications': return <NotificationsPage />;
      case 'content_overview': return <ContentProductionPage setActiveTab={setActiveTab} view="overview" />;
      case 'marketing': case 'content_kho': return <ContentProductionPage setActiveTab={setActiveTab} view="kho" />;
      case 'content_video': return <ContentProductionPage setActiveTab={setActiveTab} view="video" />;
      case 'content_images': return <ContentProductionPage setActiveTab={setActiveTab} view="images" />;
      case 'ads_report': return <AdsReportPage />;
      case 'data_kh': return <MarketingDataPage />;
      case 'khach_tu_van': return <KhachTuVanPage />;
      case 'hospital_fee_inventory': return <HospitalFeeAndInventoryPage />;
      case 'cashflow': return <CashFlowPage />;
      case 'seeding_rev': return <SeedingRevenuePage />;
      case 'service_quality': return <ServiceQualityPage />;
      default: return <ComingSoon label={MENU.find(m => m.id === activeTab)?.label || activeTab} />;
    }
  };

  // Khung app dùng chung (Ethics BOS): menu nhóm + badge đơn nghỉ chờ duyệt
  const groups = MENU_GROUPS.map(g => ({
    title: g.title,
    items: g.items.map(i => (i.id === 'hr' ? { ...i, badge: pendingLeaves } : i)),
  }));
  const bottomItems = MENU.filter(m => ['overview', 'hr', 'kpi'].includes(m.id));

  return (
    <AppShell
      groups={groups}
      activeTab={activeTab}
      onSelect={setActiveTab}
      profile={profile}
      roleLabel="Quản trị viên"
      bottomItems={bottomItems}
      centerAction={{ id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays }}
    >
      {renderContent()}
    </AppShell>
  );
};

export default AdminDashboard;
