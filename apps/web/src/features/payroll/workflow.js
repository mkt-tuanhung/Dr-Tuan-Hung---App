// ============================================================
// QUY TRÌNH DUYỆT LƯƠNG 7 BƯỚC (Ethics BOS D08) — phía giao diện.
// Luật thật nằm ở database: supabase/payroll_workflow.sql (hàm payroll_transition).
// Bảng dưới đây PHẢI khớp với hàm đó; giao diện chỉ dùng để bật/tắt nút cho dễ hiểu.
// ============================================================

export const PAY_STEPS = ['draft', 'hr_review', 'manager_review', 'finance_review', 'approved', 'locked', 'paid'];

export const PAY_STATUS_LABEL = {
  draft: 'Nháp',
  hr_review: 'HR kiểm tra',
  manager_review: 'Trưởng phòng duyệt',
  finance_review: 'Tài chính kiểm tra',
  approved: 'Đã duyệt',
  locked: 'Đã khoá',
  paid: 'Đã chi trả',
};

// Bước kế tiếp: nhãn nút + vai trò được làm + có bắt ghi chú không
export const PAY_TRANSITIONS = {
  hr_review:      { label: 'Gửi HR kiểm tra', roles: ['accountant', 'admin'] },
  manager_review: { label: 'HR xác nhận, trình Trưởng phòng', roles: ['accountant', 'admin'] },
  finance_review: { label: 'Trưởng phòng duyệt, chuyển Tài chính', roles: ['admin'], twoPerson: true },
  approved:       { label: 'Tài chính xác nhận, trình CEO duyệt', roles: ['accountant', 'admin'], twoPerson: true },
  locked:         { label: 'CEO duyệt & khoá bảng lương', roles: ['shareholder', 'admin'], twoPerson: true, note: true },
  paid:           { label: 'Xác nhận đã chi trả', roles: ['accountant', 'admin'], note: true },
};

// "Trả về nháp" để sửa: chỉ Admin, bắt lý do, không áp dụng cho kỳ đã chi trả
export const PAY_REOPEN = { label: 'Trả về nháp', roles: ['admin'], note: true };

export const nextStatus = (status) => PAY_STEPS[PAY_STEPS.indexOf(status) + 1] || null;
// Số liệu chỉ sửa được ở Nháp và HR kiểm tra (database cũng chặn như vậy)
export const isEditableStatus = (status) => status === 'draft' || status === 'hr_review';
export const isLockedStatus = (status) => status === 'locked' || status === 'paid';

export const myRoles = (profile) => [profile?.role, profile?.role_2].filter(Boolean);
export const hasRole = (profile, roles) => myRoles(profile).some(r => roles.includes(r));

// Lý do nút bị khoá (null = bấm được). history: mới nhất ở cuối.
export function blockReason(to, profile, history) {
  const t = to === 'draft' ? PAY_REOPEN : PAY_TRANSITIONS[to];
  if (!t) return 'Không có bước tiếp theo';
  if (!hasRole(profile, t.roles)) return 'Vai trò của bạn không thực hiện được bước này';
  if (t.twoPerson) {
    const last = history[history.length - 1];
    if (last && last.actor_id === profile?.id) return 'Bạn vừa thực hiện bước trước — bước này cần một người khác duyệt';
  }
  return null;
}

// Bảng chưa chạy payroll_workflow.sql -> giao diện quay về cách Lưu nháp / Chốt lương cũ
export const isMissingTable = (error) => !!error && (
  error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' ||
  (/payroll_periods|payroll_period_history|payroll_transition/.test(error.message || '') &&
    /does not exist|could not find|schema cache/i.test(error.message || ''))
);
