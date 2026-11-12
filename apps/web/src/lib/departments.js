// MÀU THEO BỘ PHẬN cho dòng thời gian / nhật ký (mỗi bộ phận 1 màu chữ + nền thẻ + viền riêng, có nhãn tên bộ phận)
export const DEPTS = {
  truc_page:    { label: 'Trực page',   c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  telesale:     { label: 'Telesale',    c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  sale_offline: { label: 'Sale tư vấn', c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
  dieu_duong:   { label: 'Điều dưỡng',  c: '#EA580C', bg: '#FFF7ED', bd: '#FED7AA' },
  cskh:         { label: 'CSKH',        c: '#DB2777', bg: '#FDF2F8', bd: '#FBCFE8' },
  bac_si:       { label: 'Bác sĩ',      c: '#4F46E5', bg: '#EEF2FF', bd: '#C7D2FE' },
  marketing:    { label: 'Marketing',   c: '#B45309', bg: '#FFFBEB', bd: '#FDE68A' },
  admin:        { label: 'Quản lý',     c: '#334155', bg: '#F8FAFC', bd: '#CBD5E1' },
  getfly:       { label: 'GetFly (cũ)', c: '#92400E', bg: '#FEF3C7', bd: '#FCD34D' },
  messenger:    { label: 'Messenger',   c: '#0284C7', bg: '#F0F9FF', bd: '#BAE6FD' },
  lich_hen:     { label: 'Lịch hẹn',    c: '#0E7490', bg: '#ECFEFF', bd: '#A5F3FC' },
  system:       { label: 'Hệ thống',    c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' },
};
// Bộ phận của 1 nhân sự: ưu tiên vai trò chính, rồi vai trò phụ
export const deptOfProfile = (p) => {
  if (!p) return 'system';
  if (p.role && DEPTS[p.role]) return p.role;
  if (p.role_2 && DEPTS[p.role_2]) return p.role_2;
  return 'system';
};
const norm = (s) => String(s || '').normalize('NFC').toLowerCase().trim().split(/\s+/).filter(Boolean);
// Ghi chú GetFly chỉ có TÊN người note -> dò ra nhân sự (vd "Hoàng Xuân" ~ "Hoàng Thị Xuân")
export const profileByName = (staff = [], name) => {
  const t = norm(name); if (!t.length) return null;
  return staff.find(s => { const u = norm(s.full_name); return t.every(w => u.includes(w)); }) || null;
};
export const deptStyle = (k) => DEPTS[k] || DEPTS.system;
