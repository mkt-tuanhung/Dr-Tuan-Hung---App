// ============================================================
// CẤU HÌNH MENU CHỨC NĂNG + QUYỀN MẶC ĐỊNH THEO VAI TRÒ
// Nguồn sự thật dùng chung cho: menu nhân sự (StaffDashboard) và trang
// Phân quyền của Admin (ma trận Vai trò × Chức năng, kiểu Ethics BOS).
// `roles` / `exclude` = quyền MẶC ĐỊNH. Admin có thể ghi đè từng ô trong
// bảng role_permissions — ô không ghi đè thì giữ nguyên mặc định ở đây.
// ============================================================
import {
  LayoutDashboard, CalendarCheck, Target, Banknote, Wallet, MessagesSquare, Gamepad2, Video,
  Database, Clapperboard, BarChart2, FolderOpen, PlayCircle, Image as ImageIcon, Sprout, PieChart,
  Activity, CalendarDays, Smile, UserCheck, ClipboardList, UserX, Handshake,
} from 'lucide-react';

export const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH',
  truc_page: 'Trực Page', media: 'Media', marketing: 'Marketing', editor: 'Editor',
  seeding: 'Seeding',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin',
  bac_si: 'Bác sĩ', designer: 'Designer',
};

// Chức vụ Outsource (field position) bị ẩn các module này
export const OUTSOURCE_HIDE = ['appointments', 'attendance', 'advances'];

export const FULL_MENU = [
  { id: 'overview',   label: 'Tổng quan',      icon: LayoutDashboard, roles: ['all'], exclude: ['designer'] },
  { id: 'attendance', label: 'Chấm công',       icon: CalendarCheck, roles: ['all'], exclude: ['accountant', 'designer'] },
  { id: 'kpi',        label: 'KPI của tôi',     icon: Target, roles: ['all'], exclude: ['accountant', 'designer'] },
  { id: 'advances',   label: 'Tạm ứng chi',     icon: Banknote, roles: ['all'], exclude: ['designer'] },
  { id: 'my_payroll', label: 'Lương của tôi',   icon: Wallet, roles: ['all'] },
  { id: 'community',  label: 'Cộng đồng',       icon: MessagesSquare, roles: ['all'] },
  { id: 'minigame',   label: 'Minigame',        icon: Gamepad2, roles: ['all'] },
  { id: 'meetings',   label: 'Phòng họp',        icon: Video, roles: ['all'] },

  // MKT / Finance / Sales
  { id: 'data_kh',    label: 'Khách hàng (CRM)',  icon: Database, roles: ['marketing', 'truc_page', 'media', 'telesale', 'admin', 'accountant', 'shareholder'] },
  { id: 'marketing',  label: 'Marketing', icon: Clapperboard, children: [
    { id: 'content_overview', label: 'Tổng quan', icon: LayoutDashboard, roles: ['marketing', 'admin', 'accountant', 'shareholder'] },
    { id: 'ads_report',     label: 'Chi phí Ads', icon: BarChart2,  roles: ['marketing', 'admin', 'accountant'] },
    { id: 'content_kho',    label: 'Kho Media',   icon: FolderOpen, roles: ['media', 'editor', 'designer', 'marketing', 'admin', 'accountant', 'shareholder'] },
    { id: 'content_video',  label: 'Video Ads',   icon: PlayCircle, roles: ['editor', 'marketing', 'admin', 'accountant', 'shareholder'] },
    { id: 'content_images', label: 'Hình Ảnh',    icon: ImageIcon,  roles: ['media', 'editor', 'designer', 'marketing', 'admin', 'accountant', 'shareholder', 'seeding'] },
  ] },
  { id: 'seeding_rev', label: 'Doanh thu Seeding', icon: Sprout, roles: ['seeding', 'admin', 'accountant', 'shareholder'] },
  { id: 'finance',    label: 'Doanh thu',       icon: Banknote, roles: ['marketing', 'accountant', 'admin', 'shareholder', 'telesale', 'sale_offline'] },
  { id: 'pl',         label: 'Lãi / Lỗ (P&L)',  icon: PieChart, roles: ['accountant', 'admin', 'shareholder'] },
  { id: 'cashflow',   label: 'Kế toán dòng tiền', icon: BarChart2, roles: ['accountant', 'admin', 'shareholder'] },
  { id: 'payroll',    label: 'Bảng lương',      icon: Wallet, roles: ['accountant', 'admin', 'shareholder'] },
  { id: 'vien_phi',   label: 'Viện phí / Vật tư', icon: Activity, roles: ['accountant', 'admin', 'dieu_duong', 'shareholder'] },

  // CRM
  { id: 'appointments', label: 'Lịch hẹn',       icon: CalendarDays, roles: ['all'], exclude: ['designer'] },
  { id: 'service_quality', label: 'Đánh giá dịch vụ', icon: Smile, roles: ['admin', 'accountant', 'shareholder', 'cskh', 'dieu_duong'] },
  { id: 'khach_tu_van', label: 'Khách tư vấn',    icon: UserCheck, roles: ['sale_offline', 'admin'] },
  { id: 'khach_coc',    label: 'Khách Cọc',      icon: ClipboardList, roles: ['telesale', 'sale_offline', 'accountant', 'shareholder', 'marketing'] },
  { id: 'khach_bong',   label: 'Khách Bong',     icon: UserX, roles: ['telesale', 'sale_offline', 'cskh'] },

  // Phẫu thuật
  { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity, roles: ['dieu_duong', 'cskh', 'bac_si', 'accountant'] },
  { id: 'mo_doi_tac',    label: 'Mổ Đối Tác',       icon: Handshake, roles: ['accountant', 'admin'] },
  { id: 'hau_phau',      label: 'Hậu phẫu / CSKH', icon: ClipboardList, roles: ['dieu_duong', 'cskh', 'bac_si'] },
];

// Nhóm menu hiển thị trên sidebar (Ethics BOS). Mục nào chưa có nhóm -> nhóm "KHÁC".
export const STAFF_GROUPS = [
  { title: null, ids: ['overview'] },
  { title: 'CÁ NHÂN', ids: ['attendance', 'kpi', 'my_payroll', 'advances'] },
  { title: 'KHÁCH HÀNG', ids: ['appointments', 'data_kh', 'khach_tu_van', 'khach_coc', 'khach_bong', 'khach_phau_thuat', 'mo_doi_tac', 'hau_phau', 'service_quality'] },
  { title: 'TÀI CHÍNH', ids: ['finance', 'pl', 'cashflow', 'payroll', 'vien_phi', 'seeding_rev'] },
  { title: 'MARKETING', ids: ['marketing'] },
  { title: 'KẾT NỐI', ids: ['community', 'meetings', 'minigame'] },
];

// Vai trò hiển thị trong ma trận phân quyền (admin luôn toàn quyền qua giao diện Admin)
export const MATRIX_ROLES = ['telesale', 'sale_offline', 'cskh', 'truc_page', 'marketing', 'media', 'editor', 'designer', 'seeding', 'dieu_duong', 'bac_si', 'accountant', 'shareholder'];

// Chức năng nhạy cảm (tài chính / lương) — đánh dấu khoá như Ethics
export const SENSITIVE = new Set(['finance', 'pl', 'cashflow', 'payroll', 'vien_phi', 'mo_doi_tac', 'seeding_rev', 'ads_report']);

// Danh sách phẳng mọi chức năng (kèm nhóm cha nếu là mục con)
export const flatModules = () => FULL_MENU.flatMap(m => (m.children ? m.children.map(c => ({ ...c, parent: m.label })) : [m]));

// Quyền MẶC ĐỊNH của 1 vai trò với 1 chức năng
export const defaultGrant = (role, m) =>
  !!role && (m.roles?.includes('all') || m.roles?.includes(role)) && !(m.exclude && m.exclude.includes(role));

// overrides: Map 'role|module' -> boolean
export const overrideKey = (role, module) => `${role}|${module}`;
export const effectiveGrant = (role, m, overrides) => {
  const k = overrideKey(role, m.id);
  return overrides?.has(k) ? overrides.get(k) : defaultGrant(role, m);
};

// Quyền của 1 NHÂN SỰ (role + role_2) với 1 chức năng.
// Không có ô ghi đè nào cho các vai trò của người này -> giữ NGUYÊN logic cũ
// (để bảng trống = hành vi y hệt trước khi có phân quyền).
export const userCanModule = (profile, m, overrides) => {
  const roles = [profile?.role, profile?.role_2].filter(Boolean);
  if (profile?.position === 'Outsource' && OUTSOURCE_HIDE.includes(m.id)) return false;
  const hasOverride = roles.some(r => overrides?.has(overrideKey(r, m.id)));
  if (!hasOverride) {
    return (m.roles?.includes('all') || roles.some(r => m.roles?.includes(r)))
      && !(m.exclude && roles.some(r => m.exclude.includes(r)));
  }
  return roles.some(r => effectiveGrant(r, m, overrides));
};
