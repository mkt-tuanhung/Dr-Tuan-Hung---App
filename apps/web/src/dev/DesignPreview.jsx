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

export const DEMO_PROFILE = { id: 'demo', full_name: 'Nguyễn Văn Dũng', role: 'admin', avatar_url: null };

const ADMIN_GROUPS = [
  { title: null, items: [{ id: 'overview', label: 'Tổng quan', icon: LayoutDashboard }] },
  { title: 'KHÁCH HÀNG', items: [
    { id: 'data_kh', label: 'Data khách hàng', icon: Database },
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
  return <div className="p-8">Không có màn xem thử: {screen}</div>;
}
