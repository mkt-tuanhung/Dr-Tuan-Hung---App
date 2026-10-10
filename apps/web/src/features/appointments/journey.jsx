// Hành trình sau chốt mổ — cập nhật từ nút bấm trong nhóm Telegram "Hành trình khách hàng".
// Dùng chung cho thẻ danh sách lịch hẹn và bảng chi tiết. Không dùng emoji: icon SVG + dấu tích vẽ bằng CSS.
import React from 'react';
import { ClipboardList, FlaskConical, Scissors, Home } from 'lucide-react';

export const JOURNEY = {
  ho_so: { label: 'Hoàn thiện hồ sơ - XN', cls: 'e-tone-warning', icon: ClipboardList },
  xn_xong: { label: 'Đã XN xong', cls: 'e-tone-info', icon: FlaskConical },
  dang_mo: { label: 'Đang phẫu thuật', cls: 'e-tone-brand', icon: Scissors },
  mo_xong: { label: 'Đã mổ xong', cls: 'e-tone-success', check: true },
  ra_vien: { label: 'Đã ra viện', cls: 'e-tone-lavender', icon: Home },
};

// Biểu tượng + nhãn của một bước hành trình
export function JourneyLabel({ status }) {
  const j = JOURNEY[status];
  if (!j) return null;
  const Icon = j.icon;
  return (
    <>
      {j.check ? <span className="e-check" aria-hidden="true" /> : <Icon className="w-[1.1em] h-[1.1em] shrink-0" aria-hidden="true" />}
      <span>{j.label}</span>
    </>
  );
}
