// MÀU THEO BỘ PHẬN cho dòng thời gian / nhật ký (mỗi bộ phận 1 màu chữ + nền thẻ + viền riêng, có nhãn tên bộ phận)
// Bảng màu PASTEL: c = màu nhấn (viền trái, chấm), t = chữ nhãn (đậm hơn để dễ đọc), bg = nền thẻ, bd = viền
export const DEPTS = {
  truc_page:    { label: 'Trực page',   c: '#A78BDB', t: '#7357B0', bg: '#F8F5FE', bd: '#E9E1F8' },
  telesale:     { label: 'Telesale',    c: '#7FA6E0', t: '#3F6DB3', bg: '#F4F8FE', bd: '#DFE9F8' },
  sale_offline: { label: 'Sale tư vấn', c: '#7CC4A6', t: '#2F8A66', bg: '#F2FAF6', bd: '#D8F0E5' },
  dieu_duong:   { label: 'Điều dưỡng',  c: '#F0B38A', t: '#C06A33', bg: '#FFF8F2', bd: '#F9E5D6' },
  cskh:         { label: 'CSKH',        c: '#EBA3C4', t: '#C04D82', bg: '#FDF5F9', bd: '#F7E0EB' },
  bac_si:       { label: 'Bác sĩ',      c: '#9AA0E3', t: '#5158B8', bg: '#F5F6FE', bd: '#E1E3F8' },
  marketing:    { label: 'Marketing',   c: '#E5C47A', t: '#9C7420', bg: '#FDFAF1', bd: '#F4EACB' },
  admin:        { label: 'Quản lý',     c: '#A3ADBD', t: '#55617A', bg: '#F8F9FB', bd: '#E6E9EF' },
  getfly:       { label: 'GetFly (cũ)', c: '#CDB08F', t: '#8A6A45', bg: '#FBF8F3', bd: '#EFE5D7' },
  messenger:    { label: 'Messenger',   c: '#8CC7E6', t: '#2F84B0', bg: '#F3FAFD', bd: '#DBEEF7' },
  lich_hen:     { label: 'Lịch hẹn',    c: '#86CCD2', t: '#2E8C94', bg: '#F2FAFB', bd: '#D8EFF1' },
  system:       { label: 'Hệ thống',    c: '#B8C2CF', t: '#64748B', bg: '#F9FAFB', bd: '#EBEEF2' },
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
