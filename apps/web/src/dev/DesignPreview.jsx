// ============================================================
// TRANG XEM THỬ THIẾT KẾ (chỉ dùng khi dev, KHÔNG có trong bản production).
// Bật bằng biến VITE_DESIGN_PREVIEW=1 lúc build -> route /__preview.
// Dùng dữ liệu giả để chụp/kiểm tra giao diện mà không cần đăng nhập.
// ============================================================
import React, { useState } from 'react';
import {
  LayoutDashboard, Database, ClipboardList, CalendarDays, UserCheck, Activity, Smile,
  Users, Target, Wallet, Banknote, PieChart, Sprout, BarChart2, Clapperboard, FolderOpen,
  PlayCircle, Video, MessagesSquare, Gamepad2, Bell, ShieldCheck, ScanFace,
} from 'lucide-react';
import AppShell from '@/components/shell/AppShell.jsx';
import ResourceCalendar from '@/features/appointments/ResourceCalendar.jsx';
import AppointmentDrawer from '@/features/appointments/AppointmentDrawer.jsx';
import { toYMD, addDays } from '@/features/appointments/calendarUtils';
import { AuthContext } from '@/contexts/AuthContext.jsx';
import MarketingDataPage from '@/pages/MarketingDataPage.jsx';

export const DEMO_PROFILE = { id: 'demo', full_name: 'Nguyễn Văn Dũng', role: 'admin', avatar_url: null };

const ADMIN_GROUPS = [
  { title: null, items: [{ id: 'overview', label: 'Tổng quan', icon: LayoutDashboard }] },
  { title: 'KHÁCH HÀNG', items: [
    { id: 'data_kh', label: 'Khách hàng (CRM)', icon: Database },
    { id: 'deposit_management', label: 'Quản lý Đặt cọc', icon: ClipboardList },
    { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays },
    { id: 'khach_tu_van', label: 'Khách tư vấn', icon: UserCheck },
    { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity },
    { id: 'service_quality', label: 'Đánh giá dịch vụ', icon: Smile },
  ] },
  { title: 'NHÂN SỰ', items: [
    { id: 'hr', label: 'Quản lý Nhân sự', shortLabel: 'Nhân sự', icon: Users, badge: 3 },
    { id: 'kpi', label: 'KPI & Hoa hồng', shortLabel: 'KPI', icon: Target },
    { id: 'payroll', label: 'Bảng lương', icon: Wallet },
  ] },
  { title: 'TÀI CHÍNH', items: [
    { id: 'finance', label: 'Doanh thu / Tài chính', icon: Banknote },
    { id: 'pl', label: 'Lãi / Lỗ (P&L)', icon: PieChart },
    { id: 'seeding_rev', label: 'Doanh thu Seeding', icon: Sprout },
    { id: 'cashflow', label: 'Kế toán dòng tiền', icon: BarChart2 },
    { id: 'marketing', label: 'Marketing', icon: Clapperboard, children: [
      { id: 'content_kho', label: 'Kho Media', icon: FolderOpen },
      { id: 'content_video', label: 'Video Ads', icon: PlayCircle },
    ] },
  ] },
  { title: 'VẬN HÀNH', items: [
    { id: 'meetings', label: 'Phòng họp', icon: Video },
    { id: 'community', label: 'Cộng đồng', icon: MessagesSquare },
    { id: 'minigame', label: 'Minigame', icon: Gamepad2 },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'permissions', label: 'Phân quyền', icon: ShieldCheck },
  ] },
];


// ---------- Dữ liệu giả cho Lịch hẹn ----------
const DEMO_STAFF = [
  { id: 's1', full_name: 'Trần Thu Thuỷ', role: 'sale_offline' },
  { id: 's2', full_name: 'Hoàng Thị Xuân', role: 'sale_offline' },
  { id: 's3', full_name: 'Lê Minh Anh', role: 'sale_offline' },
  { id: 's4', full_name: 'Phạm Quốc Bảo', role: 'sale_offline' },
  { id: 'n1', full_name: 'ĐD Nguyễn Huyền Trang', role: 'dieu_duong' },
  { id: 't1', full_name: 'Telesale Mai', role: 'telesale' },
];
const NAMES = ['Nguyễn Thị Lan', 'Trần Thu Hà', 'Lê Minh Anh', 'Vũ Thảo Vy', 'Trần Minh Anh', 'Phạm Quốc Bảo', 'Nguyễn Anh Dương', 'Đỗ Phương Linh', 'Trần Quang Huy', 'Lê Hoàng Yến', 'Bùi Thị Giang', 'Đinh Thị Hoa', 'Phạm Ngọc Anh', 'Đặng Hồng Khôi'];
const SERVICES = ['Gọt hàm, bóc cơ cắn', 'Nâng mũi cấu trúc', 'Hàm hô, hạ gò má', 'Cắt mí mắt', 'Độn cằm', 'Hút mỡ bụng'];
const STATUSES = ['scheduled', 'scheduled', 'coc', 'phau_thuat', 'bong', 'scheduled'];
const buildDemoAppointments = () => {
  const base = new Date();
  const out = [];
  let id = 0;
  const plan = [
    [0, '09:00', 's1'], [0, '09:30', 's3'], [0, '10:30', 's2'], [0, '11:00', 's1'], [0, '11:00', 's4'], [0, '11:30', 's1'],
    [0, '14:00', 's1'], [0, '14:00', 's3'], [0, '14:30', 's4'], [0, '15:00', 's2'], [0, '16:30', 's3'], [0, '09:00', 'n1', true], [0, '15:30', 'n1', true],
    [1, '09:00', 's2'], [1, '10:00', 's1'], [1, '13:30', 's4'], [2, '09:30', 's3'], [2, '15:00', 's1'], [-1, '10:00', 's2'], [-1, '14:00', 's4'],
    [3, '11:00', 's1'], [4, '16:00', 's2'], [5, '09:00', 's3'], [-2, '10:30', 's1'], [7, '09:00', 's4'], [9, '14:00', 's2'], [12, '10:00', 's1'],
  ];
  plan.forEach(([dd, time, sale, re]) => {
    const name = NAMES[id % NAMES.length];
    out.push({
      id: `a${id}`, customer_name: name, phone: '0912345678',
      appointment_date: toYMD(addDays(base, dd)), appointment_time: time,
      service: re ? `[Tái khám] Kiểm tra sau mổ` : SERVICES[id % SERVICES.length],
      status: re ? 'scheduled' : STATUSES[id % STATUSES.length],
      sale_id: sale, sale: DEMO_STAFF.find(s => s.id === sale)?.full_name, telesale: 'Telesale Mai',
      expected_bill: 25000000 + (id % 5) * 5000000, deposit_amount: id % 3 === 0 ? 5000000 : 0,
      customer_source: 'Ads', customer_type: 'Mới', service_group: 'Hàm mặt', surgery_type: 'Đại phẫu',
      journey_status: id % 6 === 3 ? 'xn_xong' : null,
    });
    id++;
  });
  return out;
};

const Placeholder = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {['Lịch hẹn hôm nay', 'Doanh thu tháng', 'Khách mới', 'Tỷ lệ chốt'].map((t, i) => (
        <div key={t} className="rounded-2xl bg-white shadow-card p-5">
          <div className="text-sm text-slate-500">{t}</div>
          <div className="text-[28px] font-bold text-slate-900 mt-1 tabular-nums">{['24', '1,28 Tỷ', '57', '38%'][i]}</div>
          <div className="text-xs text-teal-700 mt-1">↑ 12% so với tháng trước</div>
        </div>
      ))}
    </div>
    <div className="rounded-2xl bg-white shadow-card p-5 h-64">
      <div className="font-semibold text-slate-800">Nội dung trang</div>
      <div className="text-sm text-slate-500 mt-1">Khung xem thử — dữ liệu giả.</div>
      <button className="mt-4 px-4 h-10 rounded-xl bg-teal-600 text-white font-semibold">Nút chính</button>
      <button className="mt-4 ml-2 px-4 h-10 rounded-xl border border-slate-200 text-slate-700 font-semibold">Nút phụ</button>
    </div>
  </div>
);

export default function DesignPreview() {
  const q = new URLSearchParams(window.location.search);
  const screen = q.get('screen') || 'shell';
  const [tab, setTab] = useState(q.get('tab') || 'appointments');

  if (screen === 'shell') {
    const flat = ADMIN_GROUPS.flatMap(g => g.items);
    return (
      <AppShell
        groups={ADMIN_GROUPS}
        activeTab={tab}
        onSelect={setTab}
        profile={DEMO_PROFILE}
        roleLabel="Quản trị viên"
        bottomItems={flat.filter(m => ['overview', 'hr', 'kpi'].includes(m.id))}
        centerAction={q.get('center') === 'checkin'
          ? { id: 'attendance', label: 'Chấm công', icon: ScanFace }
          : { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays }}
      >
        <Placeholder />
      </AppShell>
    );
  }
  if (screen === 'calendar') {
    return <CalendarDemo tab={tab} setTab={setTab} />;
  }
  if (screen === 'customers') {
    // Supabase được giả lập ở tầng mạng (script chụp ảnh) — ở đây chỉ giả phiên đăng nhập
    const flat = ADMIN_GROUPS.flatMap(g => g.items);
    return (
      <AuthContext.Provider value={{ user: { id: 'demo' }, profile: DEMO_PROFILE, loading: false, isLoggedIn: true, isAdmin: true }}>
        <AppShell groups={ADMIN_GROUPS} activeTab="data_kh" onSelect={() => {}} profile={DEMO_PROFILE} roleLabel="Quản trị viên"
          bottomItems={flat.filter(m => ['overview', 'hr', 'kpi'].includes(m.id))}
          centerAction={{ id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays }}>
          <MarketingDataPage />
        </AppShell>
      </AuthContext.Provider>
    );
  }
  return <div className="p-8">Không có màn xem thử: {screen}</div>;
}

function CalendarDemo({ tab, setTab }) {
  const [apps] = useState(buildDemoAppointments);
  const q = new URLSearchParams(window.location.search);
  const [openId, setOpenId] = useState(q.get('open') ? `a${q.get('open')}` : null);
  const open = apps.find(a => a.id === openId) || null;
  const flat = ADMIN_GROUPS.flatMap(g => g.items);
  return (
    <AppShell groups={ADMIN_GROUPS} activeTab="appointments" onSelect={setTab} profile={DEMO_PROFILE} roleLabel="Quản trị viên"
      bottomItems={flat.filter(m => ['overview', 'hr', 'kpi'].includes(m.id))}
      centerAction={{ id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays }}>
      <ResourceCalendar
        appointments={apps} staffList={DEMO_STAFF} selectedId={openId} initialView={q.get('view') || 'day'}
        onOpen={(a) => setOpenId(a.id)} onCreateAt={() => {}}
        toolbarRight={<div className="hidden lg:flex gap-2"><button className="flex items-center gap-2 px-4 h-10 rounded-xl bg-teal-600 text-white text-sm font-semibold">+ Thêm lịch hẹn</button></div>}
      />
      <AppointmentDrawer app={open} profile={DEMO_PROFILE} onClose={() => setOpenId(null)}
        actions={open && (
          <div className="flex flex-col gap-2">
            <button className="w-full py-2 bg-teal-600 text-white font-bold text-sm rounded-xl">Tiếp nhận tư vấn</button>
            <div className="flex gap-2"><button className="flex-1 py-2 bg-teal-50 text-teal-700 border border-teal-200 font-bold text-sm rounded-xl">Đánh giá</button></div>
          </div>
        )} />
    </AppShell>
  );
}
