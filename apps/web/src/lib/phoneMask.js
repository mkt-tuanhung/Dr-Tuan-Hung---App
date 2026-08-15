// Ẩn số điện thoại khách với vị trí SALE OFFLINE (không cho xem/khai thác SĐT khách).
// Các vai trò khác (telesale, cskh, điều dưỡng, admin…) vẫn thấy đầy đủ để gọi khách.
export const maskPhone = (p) => {
  const s = String(p ?? '').trim();
  if (!s) return s;
  return s.length <= 4 ? '••••' : s.slice(0, -4) + '••••';
};

// Vị trí Sale Offline (role chính hoặc phụ) — trừ admin thì vẫn thấy đủ.
export const isSaleOffline = (profile) => {
  const roles = [profile?.role, profile?.role_2].filter(Boolean);
  return roles.includes('sale_offline') && !roles.includes('admin');
};

// Che 5 số cuối (dùng cho Telesale ở Data khách hàng).
export const maskPhone5 = (p) => {
  const s = String(p ?? '').trim();
  if (!s) return s;
  return s.length <= 5 ? '•••••' : s.slice(0, -5) + '•••••';
};

// Vị trí Telesale (role chính hoặc phụ) — trừ admin thì vẫn thấy đủ.
export const isTelesale = (profile) => {
  const roles = [profile?.role, profile?.role_2].filter(Boolean);
  return roles.includes('telesale') && !roles.includes('admin');
};

// Trả SĐT để HIỂN THỊ: sale offline -> che; còn lại -> nguyên bản.
export const phoneFor = (p, profile) => (isSaleOffline(profile) ? maskPhone(p) : (p ?? ''));

// Hiển thị SĐT trong Data khách hàng theo vai trò:
//   sale offline -> che 4 số cuối; các vai trò khác (kể cả telesale) -> đầy đủ.
export const phoneView = (p, profile) =>
  isSaleOffline(profile) ? maskPhone(p) : (p ?? '');
