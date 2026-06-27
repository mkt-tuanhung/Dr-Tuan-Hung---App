import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  LogOut, CalendarCheck, Target, Wallet, Clock, Banknote,
  Menu, X, User, LayoutDashboard, Bell, ChevronRight,
  CalendarDays, ClipboardList, Activity, UserX, BarChart2, MessagesSquare, Eye, EyeOff, Clapperboard,
  Trophy, Scissors, CheckCircle2, Database
} from 'lucide-react';
import AttendancePage from '@/pages/AttendancePage.jsx';
import KPIPage from '@/pages/KPIPage.jsx';
import SaleOfflineStaffKPI from '@/components/kpi/SaleOfflineStaffKPI.jsx';
import TrucPageStaffKPI from '@/components/kpi/TrucPageStaffKPI.jsx';
import TelesaleStaffKPI from '@/components/kpi/TelesaleStaffKPI.jsx';
import CommunityPage from '@/pages/CommunityPage.jsx';
import DieuDuongStaffKPI from '@/components/kpi/DieuDuongStaffKPI.jsx';
import FinanceManagementPage from '@/pages/FinanceManagementPage.jsx';
import AppointmentManagementPage from '@/pages/AppointmentManagementPage.jsx';
import KhachCocPage from '@/pages/KhachCocPage.jsx';
import KhachBongPage from '@/pages/KhachBongPage.jsx';
import KhachPhauThuatPage from '@/pages/KhachPhauThuatPage.jsx';
import HauPhauPage from '@/pages/HauPhauPage.jsx';
import AdsReportPage from '@/pages/AdsReportPage.jsx';
import CashFlowPage from '@/pages/CashFlowPage.jsx';
import PayrollPage from '@/pages/PayrollPage.jsx';
import MyPayrollPage from '@/pages/MyPayrollPage.jsx';
import ContentProductionPage from '@/pages/ContentProductionPage.jsx';
import MarketingDataPage from '@/pages/MarketingDataPage.jsx';
import { loadPayrollDetail } from '@/lib/payrollData';
import HospitalFeeAndInventoryPage from '@/pages/HospitalFeeAndInventoryPage.jsx';
import AdvanceExpensePage from '@/pages/AdvanceExpensePage.jsx';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';

const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH',
  truc_page: 'Trực Page', media: 'Media', marketing: 'Marketing', editor: 'Editor',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin',
};

// Chức vụ Outsource (field position) bị ẩn các module này
const OUTSOURCE_HIDE = ['appointments', 'attendance', 'advances'];

const FULL_MENU = [
  { id: 'overview',   label: 'Tổng quan',      icon: LayoutDashboard, roles: ['all'] },
  { id: 'attendance', label: 'Chấm công',       icon: CalendarCheck, roles: ['all'], exclude: ['accountant'] },
  { id: 'kpi',        label: 'KPI của tôi',     icon: Target, roles: ['all'], exclude: ['accountant'] },
  { id: 'advances',   label: 'Tạm ứng chi',     icon: Banknote, roles: ['all'] },
  { id: 'my_payroll', label: 'Lương của tôi',   icon: Wallet, roles: ['all'] },
  { id: 'community',  label: 'Cộng đồng',       icon: MessagesSquare, roles: ['all'] },

  // MKT / Finance / Sales
  { id: 'data_kh',    label: 'Data khách hàng',  icon: Database, roles: ['marketing', 'truc_page', 'media', 'telesale', 'admin', 'accountant', 'shareholder'] },
  { id: 'content',    label: 'Sản xuất Ads',     icon: Clapperboard, roles: ['media', 'editor', 'marketing', 'admin', 'accountant', 'shareholder'] },
  { id: 'ads_report', label: 'Chi phí Ads',     icon: BarChart2, roles: ['marketing', 'admin', 'accountant'] },
  { id: 'finance',    label: 'Doanh thu',       icon: Banknote, roles: ['marketing', 'accountant', 'admin', 'shareholder', 'telesale', 'sale_offline'] },
  { id: 'cashflow',   label: 'Kế toán dòng tiền', icon: BarChart2, roles: ['accountant', 'admin'] },
  { id: 'payroll',    label: 'Bảng lương',      icon: Wallet, roles: ['accountant', 'admin'] },
  { id: 'vien_phi',   label: 'Viện phí / Vật tư', icon: Activity, roles: ['accountant', 'admin', 'dieu_duong'] },

  // CRM
  { id: 'appointments', label: 'Lịch hẹn',       icon: CalendarDays, roles: ['all'], exclude: ['accountant'] },
  { id: 'khach_coc',    label: 'Khách Cọc',      icon: ClipboardList, roles: ['telesale', 'sale_offline', 'accountant', 'shareholder', 'marketing'] },
  { id: 'khach_bong',   label: 'Khách Bong',     icon: UserX, roles: ['telesale', 'sale_offline', 'cskh'] },

  // Phẫu thuật
  { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity, roles: ['dieu_duong', 'cskh'] },
  { id: 'hau_phau',      label: 'Hậu phẫu / CSKH', icon: ClipboardList, roles: ['dieu_duong', 'cskh'] },
];

const pctOf = (actual, target) => target > 0 ? Math.min(Math.round((Number(actual || 0) / target) * 100), 100) : 0;

// Tổng quan dành cho Editor: clip Win / đang xử lý / đã duyệt + tổng lương tháng
const EditorOverview = ({ profile, setActiveTab }) => {
  const [s, setS] = useState({ win: null, pending: null, approved: null, net: null, avg: null });
  useEffect(() => {
    if (!profile?.id) return;
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth() + 1;
    const ms = `${y}-${String(m).padStart(2, '0')}-01`;
    const meNext = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    (async () => {
      const [winRes, pendRes, apprRes, scoreRes, pay] = await Promise.all([
        supabase.from('media_clips').select('id', { count: 'exact', head: true }).eq('editor_id', profile.id).eq('win', true).gte('evaluated_at', ms).lt('evaluated_at', meNext),
        supabase.from('media_clips').select('id', { count: 'exact', head: true }).eq('editor_id', profile.id).in('stage', ['submitted', 'revision']),
        supabase.from('media_clips').select('id', { count: 'exact', head: true }).eq('editor_id', profile.id).in('stage', ['approved', 'done']),
        supabase.from('media_clips').select('score, win').eq('editor_id', profile.id).gte('evaluated_at', ms).lt('evaluated_at', meNext),
        loadPayrollDetail(profile.id, m, y),
      ]);
      const sc = (scoreRes.data || []);
      const avg = sc.length ? sc.reduce((t, c) => t + (c.win ? 10 : (Number(c.score) || 0)), 0) / sc.length : 0;
      setS({ win: winRes.count ?? 0, pending: pendRes.count ?? 0, approved: apprRes.count ?? 0, net: pay.detail?.net_salary ?? 0, avg });
    })();
  }, [profile?.id]);

  const Card = ({ icon: Icon, color, label, value, unit, onClick }) => (
    <div onClick={onClick} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all group">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${color}`}><Icon className="w-6 h-6" /></div>
      <p className="text-xs text-slate-400 font-medium text-center uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value === null ? '—' : value}{unit && <span className="text-xs text-slate-400 font-medium normal-case"> {unit}</span>}</p>
    </div>
  );
  const fmtM = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n || 0)));
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card icon={Trophy} color="bg-amber-50 text-amber-600" label="Clip Win (tháng)" value={s.win} unit="clip" onClick={() => setActiveTab('content')} />
      <Card icon={Scissors} color="bg-blue-50 text-blue-600" label="Đang xử lý" value={s.pending} unit="clip" onClick={() => setActiveTab('content')} />
      <Card icon={CheckCircle2} color="bg-violet-50 text-violet-600" label="Clip đã duyệt" value={s.approved} unit="clip" onClick={() => setActiveTab('content')} />
      <Card icon={Target} color="bg-rose-50 text-rose-600" label="Điểm Ads TB (tháng)" value={s.avg === null ? null : s.avg.toFixed(1)} unit="/10" onClick={() => setActiveTab('content')} />
      <Card icon={Wallet} color="bg-emerald-50 text-emerald-600" label="Tổng lương (tháng)" value={s.net === null ? null : fmtM(s.net)} unit="đ" onClick={() => setActiveTab('my_payroll')} />
    </div>
  );
};

const Overview = ({ profile, setActiveTab }) => {
  const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—';
  const [showSalary, setShowSalary] = useState(false); // mặc định ẩn lương, bấm mắt mới hiện

  const [stats, setStats] = useState({ workingDays: null, kpiPct: null, advance: null, todayAppts: null });

  useEffect(() => {
    if (!profile?.id) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    (async () => {
      const [attRes, kpiRes, advRes, apptRes] = await Promise.all([
        // Ngày công thực tế trong tháng (có mặt + đi trễ vẫn tính công)
        supabase.from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('staff_id', profile.id)
          .in('status', ['present', 'late', 'early_leave'])
          .gte('date', monthStart).lte('date', monthEnd),
        // KPI tháng này
        supabase.from('kpi_targets')
          .select('*')
          .eq('staff_id', profile.id).eq('month', month).eq('year', year)
          .maybeSingle(),
        // Tạm ứng chưa hoàn (đã duyệt, chưa trả)
        supabase.from('expenses')
          .select('amount')
          .eq('staff_id', profile.id).eq('is_advance', true).eq('status', 'approved'),
        // Lịch hẹn hôm nay liên quan tới mình
        supabase.from('customer_appointments')
          .select('id', { count: 'exact', head: true })
          .eq('appointment_date', todayStr)
          .or(`telesale_id.eq.${profile.id},sale_offline_id.eq.${profile.id},created_by.eq.${profile.id}`),
      ]);

      const kpi = kpiRes.data;
      const kpiPct = kpi
        ? Math.round((
            pctOf(kpi.actual_revenue, kpi.target_revenue) +
            pctOf(kpi.actual_customers, kpi.target_customers) +
            pctOf(kpi.actual_calls, kpi.target_calls)
          ) / 3)
        : 0;
      const advance = (advRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);

      setStats({
        workingDays: attRes.count ?? 0,
        kpiPct,
        advance,
        todayAppts: apptRes.count ?? 0,
      });
    })();
  }, [profile?.id]);

  const show = (v, dash = '—') => v === null ? dash : v;

  return (
    <div className="space-y-5">
      {/* Greeting banner */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/20 border-2 border-white/30 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-7 h-7 text-white" />
            )}
          </div>
          <div>
            <p className="text-emerald-100 text-sm">Xin chào 👋</p>
            <h2 className="text-xl font-bold">{profile?.full_name}</h2>
            <p className="text-emerald-200 text-xs mt-0.5">
              {ROLE_LABELS[profile?.role] || profile?.role}
              {profile?.position ? ` · ${profile.position}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-emerald-400/40 grid grid-cols-2 gap-4">
          <div>
            <p className="text-emerald-200 text-xs">Lương cơ bản</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-white font-semibold tabular-nums">{showSalary ? fmt(profile?.base_salary) : '••••••••'}</p>
              <button onClick={() => setShowSalary(v => !v)} title={showSalary ? 'Ẩn lương' : 'Hiện lương'}
                className="text-emerald-100 hover:text-white p-0.5">
                {showSalary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <p className="text-emerald-200 text-xs">Trạng thái</p>
            <p className="text-white font-semibold mt-0.5">
              {profile?.employment_status === 'probation' ? 'Thử việc (85%)' : 'Chính thức'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      {[profile?.role, profile?.role_2].includes('editor') ? (
        <EditorOverview profile={profile} setActiveTab={setActiveTab} />
      ) : profile?.role === 'accountant' ? (
        <div className="grid grid-cols-2 gap-4">
          <div onClick={() => setActiveTab('finance')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Banknote className="w-6 h-6" /></div>
            <p className="text-sm font-semibold text-slate-700 text-center">Doanh thu</p>
          </div>
          <div onClick={() => setActiveTab('cashflow')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><BarChart2 className="w-6 h-6" /></div>
            <p className="text-sm font-semibold text-slate-700 text-center">Kế toán dòng tiền</p>
          </div>
          <div onClick={() => setActiveTab('payroll')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Wallet className="w-6 h-6" /></div>
            <p className="text-sm font-semibold text-slate-700 text-center">Bảng lương</p>
          </div>
          <div onClick={() => setActiveTab('advances')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><ClipboardList className="w-6 h-6" /></div>
            <p className="text-sm font-semibold text-slate-700 text-center">Tạm ứng chi</p>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4">
        <div onClick={() => setActiveTab('attendance')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-400 font-medium text-center uppercase tracking-wider">Ngày công</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{show(stats.workingDays)} <span className="text-xs text-slate-400 font-medium normal-case">ngày</span></p>
        </div>

        <div onClick={() => setActiveTab('kpi')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Target className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-400 font-medium text-center uppercase tracking-wider">Tiến độ KPI</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{show(stats.kpiPct)}<span className="text-xs text-slate-400 font-medium normal-case">%</span></p>
        </div>

        <div onClick={() => setActiveTab('finance')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-400 font-medium text-center uppercase tracking-wider">Tạm ứng</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{stats.advance === null ? '—' : new Intl.NumberFormat('vi-VN').format(stats.advance)}<span className="text-xs text-slate-400 font-medium normal-case">đ</span></p>
        </div>

        <div onClick={() => setActiveTab('appointments')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <CalendarDays className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-400 font-medium text-center uppercase tracking-wider">Lịch hẹn nay</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{show(stats.todayAppts)} <span className="text-xs text-slate-400 font-medium normal-case">khách</span></p>
        </div>
      </div>
      )}

      <p className="text-center text-xs text-slate-300">
        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
};

const ComingSoon = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-64 space-y-3">
    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">🚧</div>
    <div className="text-base font-semibold text-slate-700">{label}</div>
    <div className="text-sm text-slate-400">Đang được xây dựng</div>
  </div>
);

const StaffDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('staff_active_tab') || 'overview');

  useEffect(() => { localStorage.setItem('staff_active_tab', activeTab); }, [activeTab]);
  const [kpiRoleSel, setKpiRoleSel] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const handleNav = (e) => setActiveTab(e.detail);
    window.addEventListener('NAVIGATE', handleNav);
    return () => window.removeEventListener('NAVIGATE', handleNav);
  }, []);

  const isOutsource = profile?.position === 'Outsource';
  const allowedMenu = FULL_MENU.filter(m =>
    (m.roles.includes('all') || m.roles.includes(profile?.role) || m.roles.includes(profile?.role_2))
    && !(m.exclude && (m.exclude.includes(profile?.role) || m.exclude.includes(profile?.role_2)))
    && !(isOutsource && OUTSOURCE_HIDE.includes(m.id))
  );

  // Nếu tab khôi phục không thuộc quyền của nhân sự → về Tổng quan
  useEffect(() => {
    if (profile && activeTab !== 'overview' && !allowedMenu.some(m => m.id === activeTab)) {
      setActiveTab('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const renderContent = () => {
    if (activeTab === 'overview') return <Overview profile={profile} setActiveTab={setActiveTab} />;
    if (activeTab === 'attendance') return <AttendancePage />;
    if (activeTab === 'kpi') {
      const KPI_VIEWS = {
        sale_offline: { label: 'Sale Offline', el: <SaleOfflineStaffKPI /> },
        truc_page: { label: 'Trực page', el: <TrucPageStaffKPI /> },
        telesale: { label: 'Telesale', el: <TelesaleStaffKPI /> },
        dieu_duong: { label: 'Điều dưỡng', el: <DieuDuongStaffKPI /> },
      };
      const kpiRoles = [profile?.role, profile?.role_2].filter(r => KPI_VIEWS[r]);
      if (kpiRoles.length === 0) return <KPIPage />;
      const active = kpiRoles.includes(kpiRoleSel) ? kpiRoleSel : kpiRoles[0];
      return (
        <div className="space-y-4">
          {kpiRoles.length > 1 && (
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              {kpiRoles.map(r => (
                <button key={r} onClick={() => setKpiRoleSel(r)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${active === r ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                  KPI {KPI_VIEWS[r].label}
                </button>
              ))}
            </div>
          )}
          {KPI_VIEWS[active].el}
        </div>
      );
    }
    if (activeTab === 'finance') return <FinanceManagementPage />;
    if (activeTab === 'appointments') return <AppointmentManagementPage setActiveTab={setActiveTab} />;
    if (activeTab === 'khach_coc') return <KhachCocPage setActiveTab={setActiveTab} />;
    if (activeTab === 'khach_bong') return <KhachBongPage setActiveTab={setActiveTab} />;
    if (activeTab === 'khach_phau_thuat') return <KhachPhauThuatPage setActiveTab={setActiveTab} />;
    if (activeTab === 'hau_phau') return <HauPhauPage setActiveTab={setActiveTab} />;
    if (activeTab === 'ads_report') return <AdsReportPage />;
    if (activeTab === 'cashflow') return <CashFlowPage />;
    if (activeTab === 'payroll') return <PayrollPage />;
    if (activeTab === 'my_payroll') return <MyPayrollPage />;
    if (activeTab === 'content') return <ContentProductionPage />;
    if (activeTab === 'data_kh') return <MarketingDataPage />;
    if (activeTab === 'vien_phi') return <HospitalFeeAndInventoryPage />;
    if (activeTab === 'advances') return <AdvanceExpensePage />;
    if (activeTab === 'community') return <CommunityPage />;
    return <ComingSoon label={allowedMenu.find(m => m.id === activeTab)?.label || activeTab} />;
  };

  const activeMenu = allowedMenu.find(m => m.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-60 z-30 flex flex-col bg-white border-r border-emerald-100
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-emerald-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md overflow-hidden p-1">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">Dr Tuấn Hùng</div>
              <div className="text-xs text-emerald-500">Internal System</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {allowedMenu.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                    : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar desktop */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-emerald-100 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {activeMenu && <activeMenu.icon className="w-4 h-4 text-emerald-600" />}
            <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu mobile={false}>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-100">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.charAt(0) || 'U'
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-700">{profile?.full_name}</span>
              </div>
            </ProfileMenu>
          </div>
        </header>

        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between bg-white border-b border-emerald-100 px-4 py-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {activeMenu && <activeMenu.icon className="w-4 h-4 text-emerald-600" />}
            <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu mobile={true}>
              <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold hover:shadow-md transition-shadow cursor-pointer">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0) || 'U'
                )}
              </div>
            </ProfileMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-emerald-100 shadow-lg">
        <div className="flex items-stretch">
          {allowedMenu.slice(0, 4).map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-all relative"
              >
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-emerald-500" />}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-emerald-500 shadow-md shadow-emerald-200' : ''}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <span className={`text-[10px] font-medium leading-none ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {item.label}
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

export default StaffDashboard;
