// Danh sách nhân sự cho các ô PHÂN CÔNG (phụ mổ, trực đêm, hậu phẫu, bác sĩ mổ…).
// Chỉ nhân sự ĐANG LÀM (không bị khoá / đã xoá) và đúng vai trò.
// Ca đã phân công cho người nay đã nghỉ / đổi vai trò: vẫn hiện tên người đó (kèm ghi chú)
// để không bị mất trắng khi mở lại form — chọn người khác thì người cũ biến khỏi danh sách.
export const isActiveStaff = (p) => !!p && p.is_active !== false && p.employment_status !== 'inactive';
export const hasRole = (p, ...roles) => !!p && (roles.includes(p.role) || roles.includes(p.role_2));
export const isNurse = (p) => hasRole(p, 'dieu_duong');

export function pickList(all, test, currentId) {
  const list = (all || []).filter((p) => isActiveStaff(p) && test(p));
  if (currentId && !list.some((p) => p.id === currentId)) {
    const cur = (all || []).find((p) => p.id === currentId);
    if (cur) list.push({ ...cur, full_name: `${cur.full_name} (đã nghỉ / không thuộc nhóm)` });
  }
  return list;
}
export const nurseOptions = (all, currentId) => pickList(all, isNurse, currentId);
