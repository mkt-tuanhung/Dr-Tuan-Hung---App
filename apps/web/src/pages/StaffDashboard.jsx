import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  LogOut, CalendarCheck, Target, Wallet, Clock, Banknote,
  Menu, X, User, LayoutDashboard, Bell, ChevronRight,
  CalendarDays, ClipboardList, Activity, UserX, BarChart2, MessagesSquare, Eye, EyeOff, Clapperboard, Video,
  Trophy, Scissors, CheckCircle2, Database, UserCheck, PieChart, Handshake, Sprout, Smile,
  FolderOpen, PlayCircle, Image as ImageIcon, ChevronDown, Gamepad2, Search, ScanFace, CalendarRange, PhoneCall
} from 'lucide-react';
import AttendancePage from '@/pages/AttendancePage.jsx';
import MySchedulePage from '@/features/hr/MySchedulePage.jsx';
import { HeroCard, CheckinStrip, QuickActions, StatCard, Panel, MobileTiles, MobileQuick } from '@/components/overview/OverviewKit.jsx';
import { APPT_TONE } from '@/features/appointments/calendarUtils';

import KPIPage from '@/pages/KPIPage.jsx';
import SaleOfflineStaffKPI from '@/components/kpi/SaleOfflineStaffKPI.jsx';
import TrucPageStaffKPI from '@/components/kpi/TrucPageStaffKPI.jsx';
import TelesaleStaffKPI from '@/components/kpi/TelesaleStaffKPI.jsx';
import CommunityPage from '@/pages/CommunityPage.jsx';
import MinigamePage from '@/pages/MinigamePage.jsx';
import MeetingPage from '@/pages/MeetingPage.jsx';
import DieuDuongStaffKPI from '@/components/kpi/DieuDuongStaffKPI.jsx';
import FinanceManagementPage from '@/pages/FinanceManagementPage.jsx';
import PLPage from '@/pages/PLPage.jsx';
import AppointmentManagementPage from '@/pages/AppointmentManagementPage.jsx';
import KhachCocPage from '@/pages/KhachCocPage.jsx';
import KhachBongPage from '@/pages/KhachBongPage.jsx';
import KhachPhauThuatPage from '@/pages/KhachPhauThuatPage.jsx';
import MoDoiTacPage from '@/pages/MoDoiTacPage.jsx';
import HauPhauPage from '@/pages/HauPhauPage.jsx';
import AdsReportPage from '@/pages/AdsReportPage.jsx';
import CashFlowPage from '@/pages/CashFlowPage.jsx';
import PayrollPage from '@/pages/PayrollPage.jsx';
import MyPayrollPage from '@/pages/MyPayrollPage.jsx';
import ContentProductionPage from '@/pages/ContentProductionPage.jsx';
import SeedingRevenuePage from '@/pages/SeedingRevenuePage.jsx';
import ServiceQualityPage from '@/pages/ServiceQualityPage.jsx';
import MarketingDataPage from '@/pages/MarketingDataPage.jsx';
import KhachTuVanPage from '@/pages/KhachTuVanPage.jsx';
import { loadPayrollDetail } from '@/lib/payrollData';
import HospitalFeeAndInventoryPage from '@/pages/HospitalFeeAndInventoryPage.jsx';
import AdvanceExpensePage from '@/pages/AdvanceExpensePage.jsx';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';
import AppShell from '@/components/shell/AppShell.jsx';
import { ROLE_LABELS, FULL_MENU, userCanModule, buildMenuGroups } from '@/features/permissions/menuConfig';
import { usePermissionOverrides } from '@/features/permissions/usePermissionOverrides';
import { parseNav, setPendingFocus } from '@/lib/notif';
import { vnToday } from '@/lib/vnTime';

// Ưu tiên các mục trên thanh dưới (mobile) — nút giữa là Chấm công
const BOTTOM_PREF = ['overview', 'appointments', 'kpi', 'my_payroll'];

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

  const Card = ({ icon, color, label, value, unit, onClick }) => (
    <StatCard icon={icon} color={color} label={label} value={value === null ? '—' : `${value}${unit ? ' ' + unit : ''}`} onClick={onClick} />
  );
  const fmtM = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n || 0)));
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card icon={Trophy} color="#E5A13C" label="Clip Win (tháng)" value={s.win} unit="clip" onClick={() => setActiveTab('content_video')} />
      <Card icon={Scissors} color="#5B8DD6" label="Đang xử lý" value={s.pending} unit="clip" onClick={() => setActiveTab('content_video')} />
      <Card icon={CheckCircle2} color="#8B7BD8" label="Clip đã duyệt" value={s.approved} unit="clip" onClick={() => setActiveTab('content_video')} />
      <Card icon={Target} color="#D9635C" label="Điểm Ads TB (tháng)" value={s.avg === null ? null : s.avg.toFixed(1)} unit="/10" onClick={() => setActiveTab('content_video')} />
      <Card icon={Wallet} color="#067B7F" label="Tổng lương (tháng)" value={s.net === null ? null : fmtM(s.net)} unit="đ" onClick={() => setActiveTab('my_payroll')} />
    </div>
  );
};

const Overview = ({ profile, setActiveTab, available = [], onScan }) => {
  const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—';
  const [showSalary, setShowSalary] = useState(false); // mặc định ẩn lương, bấm mắt mới hiện

  const [stats, setStats] = useState({ workingDays: null, kpiPct: null, advance: null, todayAppts: null });
  const [todayList, setTodayList] = useState([]);   // lịch hẹn hôm nay của tôi
  const [dueCalls, setDueCalls] = useState({ n: 0, list: [] }); // khách tới hạn gọi lại

  useEffect(() => {
    if (!profile?.id) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const todayStr = vnToday();

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
          .select('id, customer_name, service, status, appointment_time')
          .eq('appointment_date', todayStr)
          .or(`telesale_id.eq.${profile.id},sale_id.eq.${profile.id},created_by.eq.${profile.id}`)
          .order('appointment_time', { ascending: true, nullsFirst: false }),
      ]);
      setTodayList(apptRes.data || []);

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
        todayAppts: (apptRes.data || []).length,
      });
    })();
  }, [profile?.id]);

  // Khách tới hạn gọi lại (telesale phụ trách) — chỉ khi có quyền Data khách hàng
  const canData = available.includes('data_kh');
  useEffect(() => {
    if (!profile?.id || !canData) return;
    const end = new Date(); end.setHours(23, 59, 59, 999);
    supabase.from('marketing_data')
      .select('id, customer_name, status, next_call_at', { count: 'exact' })
      .eq('telesale_id', profile.id).lte('next_call_at', end.toISOString())
      .order('next_call_at', { ascending: true }).limit(6)
      .then(({ data, count }) => setDueCalls({ n: count ?? (data || []).length, list: data || [] }));
  }, [profile?.id, canData]);

  const show = (v, dash = '—') => v === null ? dash : v;
  const can = (id) => available.includes(id);
  const roles = [profile?.role, profile?.role_2];
  const isEditor = roles.includes('editor');
  const isAccountant = profile?.role === 'accountant';
  const roleLabel = profile?.position || ROLE_LABELS[profile?.role] || profile?.role;

  // Thao tác nhanh — chỉ hiện chức năng nhân sự này được dùng
  const QUICK = [
    { id: 'attendance', label: 'Chấm công', icon: ScanFace, color: '#067B7F' },
    { id: 'my_schedule', label: 'Lịch làm việc', icon: CalendarRange, color: '#3CA7A9' },
    { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays, color: '#5B8DD6' },
    { id: 'data_kh', label: 'Khách hàng', icon: Database, color: '#3FA7A2' },
    { id: 'kpi', label: 'KPI của tôi', icon: Target, color: '#D9635C' },
    { id: 'my_payroll', label: 'Phiếu lương', icon: Wallet, color: '#E5A13C' },
    { id: 'advances', label: 'Tạm ứng', icon: ClipboardList, color: '#8B7BD8' },
    { id: 'finance', label: 'Doanh thu', icon: Banknote, color: '#5BAE7B' },
    { id: 'cashflow', label: 'Dòng tiền', icon: BarChart2, color: '#6C7FD8' },
    { id: 'payroll', label: 'Bảng lương', icon: Wallet, color: '#D98A4E' },
    { id: 'content_video', label: 'Video Ads', icon: PlayCircle, color: '#C46FB0' },
    { id: 'hau_phau', label: 'Hậu phẫu', icon: Activity, color: '#3FA7A2' },
    { id: 'meetings', label: 'Phòng họp', icon: Video, color: '#8A9A5B' },
    { id: 'community', label: 'Cộng đồng', icon: MessagesSquare, color: '#5B8DD6' },
    { id: 'minigame', label: 'Minigame', icon: Gamepad2, color: '#E5A13C' },
  ].filter(q => can(q.id)).slice(0, 8);

  const salaryLine = (
    <div className="inline-flex items-center gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">
      <span>Lương CB:</span>
      <span className="font-semibold text-slate-700 tabular-nums">{showSalary ? fmt(profile?.base_salary) : '••••••••'}</span>
      <button onClick={() => setShowSalary(v => !v)} title={showSalary ? 'Ẩn lương' : 'Hiện lương'} className="text-slate-400 hover:text-slate-700">
        {showSalary ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <span className="text-slate-300">·</span>
      <span>{profile?.employment_status === 'probation' ? 'Thử việc (85%)' : 'Chính thức'}</span>
    </div>
  );

  const kpi = stats.kpiPct ?? 0;
  const ring = isEditor || isAccountant ? null : {
    value: kpi, label: 'Tiến độ KPI tháng',
    sub: stats.kpiPct === null ? 'Đang tải…' : kpi >= 100 ? 'Đã đạt mục tiêu 🎉' : kpi >= 70 ? 'Sắp về đích, cố lên!' : kpi > 0 ? 'Còn nhiều dư địa bứt phá' : 'Chưa có số liệu KPI',
    onClick: can('kpi') ? () => setActiveTab('kpi') : undefined,
  };
  const heroStats = isEditor || isAccountant ? [] : [
    { label: 'Ngày công', value: `${show(stats.workingDays)}`, sub: 'ngày', onClick: can('attendance') ? () => setActiveTab('attendance') : undefined },
    { label: 'Lịch hẹn nay', value: `${show(stats.todayAppts)}`, sub: 'khách của tôi', onClick: can('appointments') ? () => setActiveTab('appointments') : undefined },
    { label: 'Tạm ứng', value: stats.advance === null ? '—' : new Intl.NumberFormat('vi-VN').format(stats.advance) + 'đ', sub: stats.advance ? 'trừ vào lương' : 'không có', onClick: can('advances') ? () => setActiveTab('advances') : undefined },
  ];

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="hidden lg:block"><HeroCard profile={profile} roleLabel={roleLabel} ring={ring} stats={heroStats} extra={salaryLine} /></div>
      {can('attendance') && <CheckinStrip profile={profile} onOpen={() => setActiveTab('attendance')} onScan={onScan} />}
      {/* Điện thoại (Ethics M03): ô chức năng lớn + số nhanh nền mint */}
      <div className="lg:hidden space-y-3.5">
        <MobileTiles items={QUICK.slice(0, 6)} onSelect={(id) => (id === 'attendance' && onScan ? onScan() : setActiveTab(id))} />
        {!isEditor && !isAccountant && (
          <MobileQuick items={[
            { icon: CalendarCheck, label: 'Ngày công tháng', value: show(stats.workingDays), onClick: can('attendance') ? () => setActiveTab('attendance') : undefined },
            { icon: CalendarDays, label: 'Lịch hẹn hôm nay', value: show(stats.todayAppts), onClick: can('appointments') ? () => setActiveTab('appointments') : undefined },
            canData
              ? { icon: PhoneCall, label: 'Khách cần gọi', value: dueCalls.n, onClick: () => setActiveTab('data_kh') }
              : { icon: Target, label: 'KPI tháng', value: `${kpi}%`, onClick: can('kpi') ? () => setActiveTab('kpi') : undefined },
          ]} />
        )}
      </div>
      {isEditor && <EditorOverview profile={profile} setActiveTab={setActiveTab} />}
      {(can('appointments') || canData) && !isEditor && !isAccountant && (
        <div className={`grid grid-cols-1 gap-4 ${can('appointments') && canData ? 'lg:grid-cols-2' : ''}`}>
          {can('appointments') && (
            <Panel title="Lịch hẹn hôm nay của tôi" action={<button onClick={() => setActiveTab('appointments')} className="text-[12.5px] text-teal-700 font-semibold inline-flex items-center gap-0.5 hover:underline">Mở lịch <ChevronRight className="w-3.5 h-3.5" /></button>}>
              {todayList.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">Hôm nay bạn chưa có lịch hẹn</div> : (
                <div className="divide-y divide-slate-100">
                  {todayList.slice(0, 6).map(a => {
                    const tone = APPT_TONE[a.status] || APPT_TONE.scheduled;
                    return (
                      <button key={a.id} onClick={() => setActiveTab('appointments')} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50/60 rounded-lg">
                        <span className="w-14 text-[13px] font-bold text-slate-700 tabular-nums shrink-0">{a.appointment_time ? String(a.appointment_time).slice(0, 5) : '--:--'}</span>
                        <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: tone.bar }} />
                        <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-slate-800 truncate">{a.customer_name}</div><div className="text-[11.5px] text-slate-400 truncate">{(a.service || '—').replace('[Tái khám] ', 'Tái khám · ')}</div></div>
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: tone.bg, color: tone.text }}>{tone.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
          {canData && (
            <Panel title={<span className="inline-flex items-center gap-2">Khách cần gọi hôm nay {dueCalls.n > 0 && <span className="text-[11px] font-bold text-white bg-rose-500 rounded-full px-2 py-0.5">{dueCalls.n}</span>}</span>}
              action={<button onClick={() => setActiveTab('data_kh')} className="text-[12.5px] text-teal-700 font-semibold inline-flex items-center gap-0.5 hover:underline">Bắt đầu gọi <ChevronRight className="w-3.5 h-3.5" /></button>}>
              {dueCalls.list.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">Không có khách tới hạn gọi lại 🎉</div> : (
                <div className="divide-y divide-slate-100">
                  {dueCalls.list.map(c => {
                    const late = new Date(c.next_call_at) < new Date(new Date().setHours(0, 0, 0, 0));
                    return (
                      <button key={c.id} onClick={() => setActiveTab('data_kh')} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50/60 rounded-lg">
                        <span className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 grid place-items-center text-[11px] font-bold shrink-0">{(c.customer_name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase()}</span>
                        <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-slate-800 truncate">{c.customer_name || '(Chưa có tên)'}</div><div className="text-[11.5px] text-slate-400 truncate">Hẹn gọi {new Date(c.next_call_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div></div>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${late ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{late ? 'Quá hạn' : 'Hôm nay'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
      <div className="hidden lg:block"><QuickActions items={QUICK} onSelect={setActiveTab} /></div>
      {/* Điện thoại: "Tháng này" (Ethics M03) */}
      {!isEditor && !isAccountant && (
        <div className="lg:hidden">
          <h2 className="text-[18px] font-bold text-slate-900 mt-1 mb-3">Tháng này</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={can('kpi') ? () => setActiveTab('kpi') : undefined} disabled={!can('kpi')} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 text-left flex flex-col gap-1 min-w-0 disabled:cursor-default">
              <span className="text-[12.5px] text-slate-500">KPI tháng</span>
              <b className="text-[22px] text-slate-900 leading-tight tabular-nums">{stats.kpiPct === null ? '—' : `${kpi}%`}</b>
              <span className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9]" style={{ width: `${Math.min(100, kpi)}%` }} /></span>
              <small className="text-[11.5px] text-slate-400 truncate">{ring?.sub}</small>
            </button>
            <button onClick={can('attendance') ? () => setActiveTab('attendance') : undefined} disabled={!can('attendance')} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 text-left flex flex-col gap-1 min-w-0 disabled:cursor-default">
              <span className="text-[12.5px] text-slate-500">Công tháng</span>
              <b className="text-[22px] text-slate-900 leading-tight tabular-nums">{show(stats.workingDays)} ngày</b>
              <small className="text-[11.5px] text-slate-400">{profile?.employment_status === 'probation' ? 'Thử việc (85%)' : 'Chính thức'}</small>
            </button>
            <button onClick={can('advances') ? () => setActiveTab('advances') : undefined} disabled={!can('advances')} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 text-left flex flex-col gap-1 min-w-0 disabled:cursor-default">
              <span className="text-[12.5px] text-slate-500">Tạm ứng</span>
              <b className="text-[18px] text-slate-900 leading-tight tabular-nums truncate">{stats.advance === null ? '—' : new Intl.NumberFormat('vi-VN').format(stats.advance) + 'đ'}</b>
              <small className="text-[11.5px] text-slate-400">{stats.advance ? 'trừ vào lương' : 'không có'}</small>
            </button>
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 flex flex-col gap-1 min-w-0">
              <span className="text-[12.5px] text-slate-500 flex items-center justify-between gap-1">Lương cơ bản
                <button onClick={() => setShowSalary(v => !v)} title={showSalary ? 'Ẩn lương' : 'Hiện lương'} className="text-slate-400 hover:text-slate-700 p-0.5">
                  {showSalary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </span>
              <b className="text-[18px] text-teal-700 leading-tight tabular-nums truncate">{showSalary ? fmt(profile?.base_salary) : '••••••••'}</b>
              <small className="text-[11.5px] text-slate-400">Bấm mắt để xem</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ComingSoon = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-64 space-y-3">
    <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-2xl">🚧</div>
    <div className="text-base font-semibold text-slate-700">{label}</div>
    <div className="text-sm text-slate-400">Đang được xây dựng</div>
  </div>
);

const StaffDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    const f = q.get('focus');
    if (f) setPendingFocus({ tab: t || 'overview', id: f });
    return t || (q.get('meeting') ? 'meetings' : (localStorage.getItem('staff_active_tab') || 'overview'));
  });

  useEffect(() => { localStorage.setItem('staff_active_tab', activeTab); }, [activeTab]);
  const [kpiRoleSel, setKpiRoleSel] = useState(null);
  // Nút Face ID giữa thanh dưới: mở Chấm công và bật camera ngay (chỉ khi bấm nút này)
  const [scanReq, setScanReq] = useState(0);
  useEffect(() => { if (activeTab !== 'attendance') setScanReq(0); }, [activeTab]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const handleNav = (e) => {
      const { tab, focus } = parseNav(e.detail);
      if (focus) setPendingFocus({ tab, id: focus });
      setActiveTab(tab);
      if (focus) setTimeout(() => window.dispatchEvent(new CustomEvent('FOCUS_ITEM', { detail: { tab, id: focus } })), 60);
    };
    window.addEventListener('NAVIGATE', handleNav);
    return () => window.removeEventListener('NAVIGATE', handleNav);
  }, []);

  // Quyền = mặc định theo vai trò + ô Admin ghi đè trong trang Phân quyền
  const overrides = usePermissionOverrides();
  const roleOk = (m) => userCanModule(profile, m, overrides);
  // Menu có nhóm con (dropdown): giữ nhóm nếu có ít nhất 1 mục con được phép
  const allowedMenu = FULL_MENU.map(m => {
    if (m.children) {
      const kids = m.children.filter(roleOk);
      return kids.length ? { ...m, children: kids } : null;
    }
    return roleOk(m) ? m : null;
  }).filter(Boolean);
  // Danh sách phẳng (gồm cả mục con) để kiểm tra quyền & tra cứu tab đang mở
  const flatMenu = allowedMenu.flatMap(m => (m.children ? m.children : [m]));

  // Nếu tab hiện tại không thuộc quyền của nhân sự → về mục đầu tiên được phép
  useEffect(() => {
    if (profile && !flatMenu.some(m => m.id === activeTab)) {
      setActiveTab(flatMenu[0]?.id || 'overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const renderContent = () => {
    if (activeTab === 'overview') return <Overview profile={profile} setActiveTab={setActiveTab} available={flatMenu.map(m => m.id)} onScan={canCheckIn ? () => { setActiveTab('attendance'); setScanReq(n => n + 1); } : undefined} />;
    if (activeTab === 'attendance') return <AttendancePage autoScan={scanReq} onAutoScanDone={() => setScanReq(0)} />;
    if (activeTab === 'my_schedule') return <MySchedulePage />;
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
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${active === r ? 'bg-white text-teal-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
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
    if (activeTab === 'pl') return <PLPage />;
    if (activeTab === 'appointments') return <AppointmentManagementPage setActiveTab={setActiveTab} />;
    if (activeTab === 'khach_coc') return <KhachCocPage setActiveTab={setActiveTab} />;
    if (activeTab === 'khach_bong') return <KhachBongPage setActiveTab={setActiveTab} />;
    if (activeTab === 'khach_phau_thuat') return <KhachPhauThuatPage setActiveTab={setActiveTab} />;
    if (activeTab === 'mo_doi_tac') return <MoDoiTacPage />;
    if (activeTab === 'hau_phau') return <HauPhauPage setActiveTab={setActiveTab} />;
    if (activeTab === 'ads_report') return <AdsReportPage />;
    if (activeTab === 'cashflow') return <CashFlowPage />;
    if (activeTab === 'payroll') return <PayrollPage />;
    if (activeTab === 'my_payroll') return <MyPayrollPage />;
    if (activeTab === 'content_overview') return <ContentProductionPage setActiveTab={setActiveTab} view="overview" />;
    if (activeTab === 'content' || activeTab === 'content_kho') return <ContentProductionPage setActiveTab={setActiveTab} view="kho" />;
    if (activeTab === 'content_video') return <ContentProductionPage setActiveTab={setActiveTab} view="video" />;
    if (activeTab === 'content_images') return <ContentProductionPage setActiveTab={setActiveTab} view="images" />;
    if (activeTab === 'seeding_rev') return <SeedingRevenuePage />;
    if (activeTab === 'service_quality') return <ServiceQualityPage />;
    if (activeTab === 'data_kh') return <MarketingDataPage />;
    if (activeTab === 'khach_tu_van') return <KhachTuVanPage />;
    if (activeTab === 'vien_phi') return <HospitalFeeAndInventoryPage />;
    if (activeTab === 'advances') return <AdvanceExpensePage />;
    if (activeTab === 'community') return <CommunityPage />;
    if (activeTab === 'minigame') return <MinigamePage />;
    if (activeTab === 'meetings') return <MeetingPage />;
    return <ComingSoon label={flatMenu.find(m => m.id === activeTab)?.label || activeTab} />;
  };

  // ===== Khung app dùng chung (Ethics BOS) =====
  const groups = buildMenuGroups(allowedMenu);

  const canCheckIn = flatMenu.some(m => m.id === 'attendance');
  const centerAction = canCheckIn ? { id: 'attendance', label: 'Chấm công', icon: ScanFace, onPress: () => setScanReq(n => n + 1) } : null;
  const sideIds = [
    ...BOTTOM_PREF.filter(id => flatMenu.some(m => m.id === id)),
    ...flatMenu.map(m => m.id).filter(id => !BOTTOM_PREF.includes(id)),
  ].filter(id => id !== centerAction?.id);
  const bottomItems = sideIds.slice(0, centerAction ? 3 : 4).map(id => flatMenu.find(m => m.id === id));

  const roleLabel = [profile?.role, profile?.role_2].filter(Boolean).map(r => ROLE_LABELS[r] || r).join(' · ');

  return (
    <AppShell
      groups={groups}
      activeTab={activeTab}
      onSelect={setActiveTab}
      profile={profile}
      roleLabel={profile?.position || roleLabel}
      bottomItems={bottomItems}
      centerAction={centerAction}
      homeId={flatMenu.some(m => m.id === 'overview') ? 'overview' : flatMenu[0]?.id}
    >
      {renderContent()}
    </AppShell>
  );
};

export default StaffDashboard;
