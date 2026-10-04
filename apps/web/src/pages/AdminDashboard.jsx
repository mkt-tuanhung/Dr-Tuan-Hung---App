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
  Clapperboard, FolderOpen, PlayCircle, Image as ImageIcon, ChevronDown, Gamepad2, RefreshCw, Clock, CalendarRange,
  AlarmClock, Coins, ReceiptText, ClipboardCheck, LineChart
} from 'lucide-react';
import PermissionsPage from '@/features/permissions/PermissionsPage.jsx';
import SchedulePage from '@/features/hr/SchedulePage.jsx';
import { Panel } from '@/components/overview/OverviewKit.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart as RPieChart, Pie, Cell, ComposedChart, Line } from 'recharts';

// Bố cục menu theo Ethics BOS: mục cha (grp_*) chỉ để gom nhóm, bấm để mở/đóng;
// id các mục con GIỮ NGUYÊN như cũ nên không ảnh hưởng điều hướng / thông báo.
const MENU_GROUPS = [
  { title: null, items: [
    { id: 'overview', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: LayoutDashboard },
  ]},
  { title: 'KHÁCH HÀNG', color: 'blue', items: [
    { id: 'grp_crm', label: 'Khách hàng', icon: Database, children: [
      { id: 'data_kh', label: 'Data khách hàng', icon: Database },
      { id: 'khach_tu_van', label: 'Khách tư vấn', icon: UserCheck },
      { id: 'deposit_management', label: 'Quản lý đặt cọc', icon: ClipboardList },
      { id: 'service_quality', label: 'Đánh giá dịch vụ', icon: Smile },
    ] },
    { id: 'appointments', label: 'Lịch hẹn', shortLabel: 'Lịch hẹn', icon: CalendarDays },
    { id: 'grp_clinic', label: 'Phẫu thuật', icon: Activity, children: [
      { id: 'khach_phau_thuat', label: 'Khách phẫu thuật', icon: Activity },
      { id: 'hau_phau', label: 'Hậu phẫu / CSKH', icon: ClipboardList },
    ] },
    { id: 'marketing', label: 'Marketing', icon: Clapperboard, children: [
      { id: 'content_overview', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'ads_report',     label: 'Chi phí Ads', icon: BarChart2 },
      { id: 'content_kho',    label: 'Kho Media',   icon: FolderOpen },
      { id: 'content_video',  label: 'Video Ads',   icon: PlayCircle },
      { id: 'content_images', label: 'Hình Ảnh',    icon: ImageIcon },
    ] },
  ]},
  { title: 'NHÂN SỰ', color: 'violet', items: [
    { id: 'hr', label: 'Quản lý Nhân sự', shortLabel: 'Nhân sự', icon: Users },
    { id: 'schedule', label: 'Lịch làm việc / Phân ca', shortLabel: 'Phân ca', icon: CalendarRange },
    { id: 'kpi', label: 'KPI & Hoa hồng', shortLabel: 'KPI', icon: Target },
    { id: 'payroll', label: 'Bảng lương', icon: Wallet },
  ]},
  { title: 'TÀI CHÍNH', color: 'amber', items: [
    { id: 'finance', label: 'Doanh thu', icon: Banknote },
    { id: 'pl', label: 'Lãi / Lỗ (P&L)', icon: PieChart },
    { id: 'seeding_rev', label: 'Doanh thu Seeding', icon: Sprout },
    { id: 'cashflow', label: 'Kế toán dòng tiền', icon: BarChart2 },
    { id: 'advances', label: 'Tạm ứng chi', icon: Wallet },
    { id: 'hospital_fee_inventory', label: 'Viện phí / Vật tư', icon: Activity },
  ]},
  { title: 'VẬN HÀNH', color: 'rose', items: [
    { id: 'meetings', label: 'Phòng họp', icon: Video },
    { id: 'community', label: 'Cộng đồng', icon: MessagesSquare },
    { id: 'minigame', label: 'Minigame', icon: Gamepad2 },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
  ]},
  { title: 'HỆ THỐNG', color: 'slate', items: [
    { id: 'permissions', label: 'Phân quyền', icon: ShieldCheck },
  ]},
];
const MENU = MENU_GROUPS.flatMap(g => g.items).flatMap(m => m.children ? [m, ...m.children] : [m]);

// Bảng màu cho donut cơ cấu dịch vụ (xanh → xanh dương → tím, giống mockup)
const PIE_COLORS = ['#067B7F', '#3CA7A9', '#5B8DD6', '#8B7BD8', '#E5A13C', '#CAD3D3'];
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
  const [reloadKey, setReloadKey] = useState(0);      // bấm "Làm mới" -> tải lại số liệu
  const [refreshing, setRefreshing] = useState(false);
  const [gran, setGran] = useState('day');            // biểu đồ doanh thu: 15 ngày | 12 tháng
  const [apptQ, setApptQ] = useState('');             // tìm trong lịch hẹn hôm nay
  const [d, setD] = useState({
    totalStaff: 0, presentToday: 0, appointmentsToday: 0, pendingExpenses: 0, pendingLeaves: 0,
    monthRevenue: 0, todayRevenue: 0, closeRate: 0, newCustomers: 0, scTotal: 0,
    newStaffMonth: 0, apptTrend: null, revTrend: null, revMonthTrend: null, closeTrend: null, newCustTrend: null, rev6mTrend: null,
    revenue6m: [], services: [], todayList: [], todayAll: [], weekly: [], newCust6w: [], topConsultants: [],
    ranges: { '7d': [], '30d': [], '6m': [], '12m': [] },
    // Trang chủ điện thoại (Ethics M04)
    attIn: 0, attLate: 0, targetMonth: 0, weekRev: [],
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

      const [pf, at, ex, lv, ap, atAll, kt] = await Promise.all([
        supabase.from('profiles').select('id, full_name, created_at').eq('is_active', true),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', todayStr).eq('status', 'present'),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('customer_appointments')
          .select('id, customer_name, service, status, appointment_date, appointment_time, surgery_date, revenue, telesale_id, created_at')
          .or(`appointment_date.gte.${twelveStart},surgery_date.gte.${twelveStart},created_at.gte.${twelveStart}`)
          .limit(8000),
        // Trang chủ điện thoại: ai đã chấm công hôm nay + chỉ tiêu doanh thu tháng
        supabase.from('attendance').select('staff_id, status').eq('date', todayStr),
        supabase.from('kpi_targets').select('target_revenue').eq('month', mo + 1).eq('year', y),
      ]);

      const staff = pf.data || [];
      const nameOf = Object.fromEntries(staff.map(s => [s.id, s.full_name]));
      const appts = ap.data || [];
      const inMonth = (ds) => ds && ds.slice(0, 7) === monthKey;

      const monthRevenue = appts.filter(a => a.status === 'phau_thuat' && inMonth(a.surgery_date)).reduce((s, a) => s + Number(a.revenue || 0), 0);
      const todayRevenue = appts.filter(a => a.status === 'phau_thuat' && a.surgery_date === todayStr).reduce((s, a) => s + Number(a.revenue || 0), 0);
      // Giờ hẹn -> số phút (để '9:00' đứng trước '10:00:00'); chưa có giờ xếp cuối
      const tKey = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? String(Number(m[1]) * 60 + Number(m[2])).padStart(4, '0') : '9999'; };
      // Lịch hẹn hôm nay: xếp theo GIỜ hẹn (chưa có giờ xuống cuối), rồi thời điểm tạo
      const todayAppts = appts.filter(a => a.appointment_date === todayStr).sort((x, z) =>
        tKey(x.appointment_time).localeCompare(tKey(z.appointment_time)) || (x.created_at || '').localeCompare(z.created_at || ''));

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
      const tcClosed = {};
      leadsM.forEach(a => {
        if (!a.telesale_id) return;
        tcMap[a.telesale_id] = (tcMap[a.telesale_id] || 0) + 1;
        if (a.status === 'coc' || a.status === 'phau_thuat') tcClosed[a.telesale_id] = (tcClosed[a.telesale_id] || 0) + 1;
      });
      const topConsultants = Object.entries(tcMap).map(([id, count]) => ({ name: nameOf[id] || 'Nhân viên', count, closed: tcClosed[id] || 0, rate: count ? Math.round((tcClosed[id] || 0) / count * 100) : 0 })).sort((a, b) => b.count - a.count).slice(0, 3);

      const attRows = atAll.data || [];
      const weekRev = DOWL.map((lbl, i) => {
        const dt = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
        return { label: lbl, value: appts.filter(a => a.status === 'phau_thuat' && a.surgery_date === iso(dt)).reduce((t, a) => t + Number(a.revenue || 0), 0) };
      });

      setD({
        attIn: new Set(attRows.map(r => r.staff_id)).size,
        attLate: attRows.filter(r => r.status === 'late').length,
        targetMonth: (kt.data || []).reduce((t, r) => t + Number(r.target_revenue || 0), 0),
        weekRev,
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
        todayList: todayAppts.slice(0, 6), todayAll: todayAppts, weekly, newCust6w, topConsultants, ranges,
      });
      setLoading(false);
      setRefreshing(false);
    };
    load();
  }, [reloadKey]);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
  );

  const reminders = [
    { label: 'Phiếu chi chờ duyệt', sub: 'Cần xử lý sớm', count: d.pendingExpenses, tab: 'advances', cls: 'bg-rose-50 text-rose-600' },
    { label: 'Đơn nghỉ phép chờ', sub: 'Chờ phê duyệt', count: d.pendingLeaves, tab: 'hr', cls: 'bg-amber-50 text-amber-600' },
    { label: 'Lịch hẹn hôm nay', sub: 'Khách cần chăm sóc', count: d.appointmentsToday, tab: 'appointments', cls: 'bg-teal-50 text-teal-600' },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Sub-tabs trong Tổng quan */}
      <div className={`e-tabs ${sub === 'tong_quan' ? 'hidden lg:flex' : ''}`}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} className={`e-tab flex-1 lg:flex-none justify-center ${sub === t.id ? 'e-tab-active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {sub === 'tong_quan' && (() => {
        // ===== Trang chủ quản lý trên điện thoại (Ethics M04) =====
        const kpiPct = d.targetMonth > 0 ? Math.round(d.monthRevenue / d.targetMonth * 100) : null;
        const weekTotal = d.weekRev.reduce((t, x) => t + x.value, 0);
        const pending = d.pendingExpenses + d.pendingLeaves;
        return (
          <div className="lg:hidden space-y-3">
            <button onClick={() => setActiveTab('finance')} className="w-full rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 flex items-center gap-3.5 text-left">
              <span className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Coins className="w-6 h-6" /></span>
              <span className="min-w-0">
                <span className="block text-[13.5px] text-slate-500">Doanh thu hôm nay</span>
                <b className="block text-[26px] font-bold text-slate-900 tabular-nums leading-tight truncate">{new Intl.NumberFormat('vi-VN').format(Math.round(d.todayRevenue))}đ</b>
              </span>
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setActiveTab('hr')} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 flex flex-col gap-3.5 text-left min-w-0">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Users className="w-5 h-5" /></span>
                  <span className="min-w-0 leading-tight">
                    <small className="block text-[11.5px] text-slate-500">Đã chấm công</small>
                    <b className="text-[22px] text-slate-900 tabular-nums">{d.attIn}</b><small className="text-[11.5px] text-slate-500"> /{d.totalStaff} nhân sự</small>
                  </span>
                </span>
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-peach-50 text-peach-600 grid place-items-center shrink-0"><AlarmClock className="w-5 h-5" /></span>
                  <span className="min-w-0 leading-tight">
                    <small className="block text-[11.5px] text-slate-500">Đi muộn · chưa đến</small>
                    <b className="text-[22px] text-slate-900 tabular-nums">{d.attLate} · {Math.max(0, d.totalStaff - d.attIn)}</b>
                  </span>
                </span>
              </button>
              <button onClick={() => setActiveTab(kpiPct === null ? 'khach_tu_van' : 'kpi')} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 flex flex-col items-center justify-center text-center gap-1 min-w-0">
                <small className="text-[12.5px] text-slate-500">{kpiPct === null ? 'Tỷ lệ chốt tháng' : 'Hiệu suất KPI'}</small>
                <b className="text-[38px] font-bold text-slate-900 leading-tight tabular-nums">{kpiPct === null ? d.closeRate : kpiPct}%</b>
                <small className="text-[11.5px] text-slate-500 truncate max-w-full">{kpiPct === null ? `${d.newCustomers} khách trong tháng` : `${fmtVND(d.monthRevenue)} / ${fmtVND(d.targetMonth)}`}</small>
              </button>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <b className="text-[16px] font-bold text-slate-900">Doanh thu tuần này</b>
                <small className="text-[12.5px] text-slate-500 tabular-nums">{fmtVND(weekTotal)}</small>
              </div>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.weekRev} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="mWeek" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06686C" /><stop offset="100%" stopColor="#76C2C3" /></linearGradient></defs>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A3ABAA' }} />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip cursor={{ fill: 'rgba(18,164,165,0.06)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 12px 40px rgba(7,95,99,0.14)', fontSize: 12 }} formatter={(v) => [new Intl.NumberFormat('vi-VN').format(v) + 'đ', 'Doanh thu']} />
                    <Bar dataKey="value" fill="url(#mWeek)" radius={[6, 6, 2, 2]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <button onClick={() => setActiveTab(d.pendingExpenses ? 'advances' : 'hr')} className="w-full rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 flex items-center gap-3 text-left">
              <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><ClipboardCheck className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14.5px] text-slate-900">Yêu cầu chờ duyệt</b>
                <small className="block text-[12px] text-slate-500 truncate">{d.pendingExpenses} phiếu chi · {d.pendingLeaves} đơn nghỉ phép</small>
              </span>
              {pending > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-danger-500 text-white text-[11px] font-bold grid place-items-center">{pending}</span>}
              <ChevronRight className="w-[18px] h-[18px] text-slate-400 shrink-0" />
            </button>
            <button onClick={() => setActiveTab('appointments')} className="w-full rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 flex items-center gap-3 text-left">
              <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><ReceiptText className="w-5 h-5" /></span>
              <b className="flex-1 min-w-0 text-[14.5px] text-slate-900">{d.appointmentsToday} lịch hẹn hôm nay</b>
              <ChevronRight className="w-[18px] h-[18px] text-slate-400 shrink-0" />
            </button>
            <button onClick={() => setSub('phan_tich')} className="w-full rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 flex items-center gap-3 text-left">
              <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><LineChart className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14.5px] text-slate-900">Phân tích & vận hành</b>
                <small className="block text-[12px] text-slate-500 truncate">Doanh thu theo kỳ, cơ cấu dịch vụ, hiệu suất tư vấn</small>
              </span>
              <ChevronRight className="w-[18px] h-[18px] text-slate-400 shrink-0" />
            </button>
          </div>
        );
      })()}

      {sub === 'tong_quan' && <div className="hidden lg:contents">
      {/* Thanh lọc (Ethics D01) */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-2.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-700">
          <CalendarDays className="w-4 h-4 text-teal-600" />Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
        </span>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={apptQ} onChange={e => setApptQ(e.target.value)} placeholder="Tìm lịch hẹn hôm nay theo khách hàng, dịch vụ…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[13.5px] outline-none focus:bg-white focus:border-teal-400" />
        </div>
        <button onClick={() => { setRefreshing(true); setReloadKey(k => k + 1); }} disabled={refreshing} title="Làm mới số liệu"
          className="w-10 h-10 rounded-xl border border-slate-200 grid place-items-center text-slate-600 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {(d.pendingExpenses + d.pendingLeaves) > 0 && (
        <button onClick={() => setActiveTab(d.pendingExpenses ? 'advances' : 'hr')} className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-[13px] text-amber-800 hover:bg-amber-100/60">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">Đang chờ duyệt: <b>{d.pendingExpenses}</b> phiếu chi · <b>{d.pendingLeaves}</b> đơn nghỉ phép</span>
          <span className="font-semibold inline-flex items-center gap-0.5">Xử lý <ChevronRight className="w-4 h-4" /></span>
        </button>
      )}

      {/* 4 chỉ số chính */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {[
          { icon: CircleDollarSign, label: 'Doanh thu', value: d.monthRevenue >= 1e10 ? fmtVND(d.monthRevenue) : new Intl.NumberFormat('vi-VN').format(Math.round(d.monthRevenue)) + 'đ', full: new Intl.NumberFormat('vi-VN').format(Math.round(d.monthRevenue)) + 'đ', delta: d.revMonthTrend, note: 'so với tháng trước', tab: 'finance' },
          { icon: Users, label: 'Khách hàng mới', value: d.newCustomers.toLocaleString('vi-VN'), delta: d.newCustTrend, note: 'so với tháng trước', tab: 'khach_tu_van' },
          { icon: CalendarCheck, label: 'Lịch hẹn hôm nay', value: d.appointmentsToday, delta: d.apptTrend, note: 'so với hôm qua', tab: 'appointments' },
          { icon: Target, label: 'Tỷ lệ chốt', value: d.closeRate + '%', delta: d.closeTrend, unit: ' điểm', note: 'so với tháng trước', tab: 'khach_tu_van' },
        ].map(m => (
          <button key={m.label} onClick={() => setActiveTab(m.tab)} title={m.full || undefined} className="text-left rounded-2xl bg-white border border-slate-200/80 shadow-card p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 hover:border-teal-200 transition min-w-0">
            <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><m.icon className="w-5 h-5 sm:w-6 sm:h-6" /></span>
            <div className="min-w-0">
              <div className="text-[12.5px] sm:text-[13.5px] text-slate-500">{m.label}</div>
              <div className="text-[18px] sm:text-[22px] font-bold text-slate-900 tabular-nums leading-tight truncate">{m.value}</div>
              {m.delta != null
                ? <div className={`text-[12px] sm:text-[12.5px] font-semibold mt-0.5 ${m.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta)}{m.unit || '%'} <span className="hidden sm:inline font-normal text-slate-400">{m.note}</span></div>
                : <div className="text-[12px] text-slate-400 mt-0.5">Chưa có kỳ trước</div>}
            </div>
          </button>
        ))}
      </div>

      {/* Biểu đồ: doanh thu theo thời gian + cơ cấu dịch vụ */}
      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1fr] gap-4">
        <Panel title="Doanh thu theo thời gian" action={
          <div className="flex p-1 rounded-xl bg-slate-100">
            {[['day', '15 ngày'], ['month', '12 tháng']].map(([k, l]) => (
              <button key={k} onClick={() => setGran(k)} className={`h-7 px-3 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition ${gran === k ? 'bg-white text-teal-700 shadow-soft' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>}>
          {(() => {
            const base = gran === 'day' ? (d.ranges['30d'] || []).slice(-15) : (d.ranges['12m'] || []);
            const series = base.map((x, i) => {
              const win = base.slice(Math.max(0, i - 2), i + 1);
              return { ...x, trend: Math.round(win.reduce((t, w) => t + w.value, 0) / win.length) };
            });
            const total = base.reduce((t, x) => t + x.value, 0);
            return (
              <>
                <div className="text-[12.5px] text-slate-500 -mt-1">Tổng {gran === 'day' ? '15 ngày gần nhất' : '12 tháng gần nhất'}: <b className="text-slate-900">{fmtVND(total)}</b></div>
                <div className="h-[250px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="dashBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#068A8C" /><stop offset="100%" stopColor="#76C2C3" stopOpacity={0.55} /></linearGradient></defs>
                      <CartesianGrid vertical={false} stroke="#EAF4F4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A3ABAA' }} interval="preserveStartEnd" minTickGap={8} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A3ABAA' }} width={48} tickFormatter={(v) => (v >= 1e9 ? (v / 1e9).toFixed(1).replace(/\.0$/, '') + ' Tỷ' : v >= 1e6 ? Math.round(v / 1e6) + ' Tr' : v)} />
                      <Tooltip cursor={{ fill: 'rgba(18,164,165,0.06)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 12px 40px rgba(7,95,99,0.14)', fontSize: 12 }} formatter={(v, n) => [new Intl.NumberFormat('vi-VN').format(v) + 'đ', n === 'trend' ? 'Xu hướng' : 'Doanh thu']} />
                      <Bar dataKey="value" name="value" fill="url(#dashBar)" radius={[6, 6, 2, 2]} maxBarSize={26} />
                      <Line dataKey="trend" name="trend" type="monotone" stroke="#12A4A5" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            );
          })()}
        </Panel>

        <Panel title="Cơ cấu dịch vụ" action={<span className="text-[12px] text-slate-400">theo lượt khách · 12 tháng</span>}>
          {d.services.length === 0 ? <div className="text-sm text-slate-400 py-16 text-center">Chưa có dữ liệu</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(170px,0.9fr)_1fr] items-center gap-6 py-2">
              <div className="relative aspect-square w-full max-w-[230px] justify-self-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={d.services} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={1.2} stroke="none">
                      {d.services.map((x, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} formatter={(v) => [`${v} lượt`, 'Khách']} />
                  </RPieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <b className="text-[28px] font-bold text-slate-900 tracking-tight">{d.scTotal.toLocaleString('vi-VN')}</b>
                  <span className="text-[12px] text-slate-500">Lượt khách</span>
                </div>
              </div>
              <ul className="space-y-3.5">
                {d.services.map((x, i) => (
                  <li key={x.name} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 min-w-0 truncate text-slate-700">{x.name}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{x.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Hàng dưới: hiệu suất tư vấn + lịch hẹn hôm nay */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.19fr_1fr] gap-4">
        <Panel title="Hiệu suất tư vấn tháng này" action={<button onClick={() => setActiveTab('kpi')} className="text-[12.5px] text-teal-700 font-semibold hover:underline">Xem KPI</button>}>
          {d.topConsultants.length === 0 ? <div className="text-sm text-slate-400 py-10 text-center">Chưa có dữ liệu tháng này</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {d.topConsultants.map((t, i) => (
                <div key={t.name} className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-teal-50/40 p-4 flex flex-col gap-2 min-w-0">
                  <span className="flex items-center gap-2 text-[13px] text-slate-600 font-medium min-w-0">
                    <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold text-white shrink-0 ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-300'}`}>{i + 1}</span>
                    <span className="truncate">{t.name}</span>
                  </span>
                  <span className="text-[28px] font-bold text-slate-900 tabular-nums leading-tight">{t.count}<span className="text-[13px] font-medium text-slate-400"> khách</span></span>
                  <span className="text-[13px] font-semibold text-emerald-600">Chốt {t.closed} · {t.rate}%</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Lịch hẹn hôm nay" action={<button onClick={() => setActiveTab('appointments')} className="text-[12.5px] text-teal-700 font-semibold inline-flex items-center gap-0.5 hover:underline">Xem tất cả <ChevronRight className="w-3.5 h-3.5" /></button>}>
          {(() => {
            const nq = apptQ.trim().toLowerCase();
            const list = d.todayAll.filter(a => !nq || `${a.customer_name || ''} ${a.service || ''}`.toLowerCase().includes(nq));
            if (!list.length) return <div className="text-sm text-slate-400 py-10 text-center">{nq ? `Không có lịch hẹn nào khớp “${apptQ}”` : 'Hôm nay chưa có lịch hẹn'}</div>;
            return (
              <ul className="-mx-1.5">
                {list.slice(0, 6).map(a => (
                  <li key={a.id}>
                    <button onClick={() => setActiveTab('appointments')} title={a.service || ''} className="w-full grid grid-cols-[24px_52px_minmax(0,1fr)_auto] items-center gap-3 min-h-[50px] px-1.5 py-1 rounded-xl hover:bg-slate-50 text-left">
                      <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 grid place-items-center"><Clock className="w-3.5 h-3.5" /></span>
                      <span className="text-[14px] font-medium text-slate-700 tabular-nums">{a.appointment_time ? String(a.appointment_time).slice(0, 5) : '--:--'}</span>
                      <span className="min-w-0 flex flex-col">
                        <span className="text-[14px] font-medium text-slate-900 truncate">{a.customer_name}</span>
                        <small className="text-[12px] text-slate-500 truncate">{String(a.service || '—').replace('[Tái khám] ', 'Tái khám · ')}</small>
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${APPT_ST[a.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{APPT_ST[a.status]?.label || a.status}</span>
                    </button>
                  </li>
                ))}
                {list.length > 6 && <li className="px-1.5 pt-1 text-[12.5px] text-slate-500">+{list.length - 6} lịch hẹn khác</li>}
              </ul>
            );
          })()}
        </Panel>
      </div>
      </div>}

      {sub === 'phan_tich' && (
        <div className="space-y-4">
          <div className="e-seg w-full sm:w-auto">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRangeKey(r.id)} className={`e-seg-item flex-1 ${rangeKey === r.id ? 'e-seg-active' : ''}`}>{r.label}</button>
            ))}
          </div>
          <div className="e-card-flat e-card-pad">
            <div className="flex items-center justify-between"><h3 className="e-card-title">Doanh thu</h3><span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1">Theo {RANGES.find(r => r.id === rangeKey)?.unit}</span></div>
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
          <div className="e-card-flat e-card-pad">
            <h3 className="e-card-title mb-3">Cơ cấu dịch vụ</h3>
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
          <div className="e-card-flat e-card-pad">
            <h3 className="e-card-title mb-1">Lịch hẹn theo tuần</h3>
            <div className="text-2xl font-bold text-slate-800">{d.weekly.reduce((s, x) => s + x.v, 0)}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.weekly} margin={{ top: 12, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis hide /><Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} formatter={(v) => [v, 'Lịch hẹn']} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]} fill="#12A4A5" barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sub === 'van_hanh' && (
        <div className="space-y-4">
          <div className="e-card-flat e-card-pad">
            <div className="flex items-center justify-between mb-2"><h3 className="e-card-title">Lịch hẹn hôm nay</h3><button onClick={() => setActiveTab('appointments')} className="text-xs text-teal-600 font-semibold inline-flex items-center gap-1">Xem tất cả <ChevronRight className="w-3 h-3" /></button></div>
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
          <div className="e-card-flat e-card-pad">
            <h3 className="e-card-title mb-3">Nhắc việc / Phê duyệt</h3>
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
          <div className="e-card-flat e-card-pad">
            <div className="flex items-center justify-between mb-3"><h3 className="e-card-title">Top tư vấn viên</h3><button onClick={() => setActiveTab('khach_tu_van')} className="text-xs text-teal-600 font-semibold">Xem tất cả</button></div>
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
      case 'permissions': return <PermissionsPage />;
      case 'schedule': return <SchedulePage />;
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
