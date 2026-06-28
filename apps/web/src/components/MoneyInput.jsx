import React from 'react';

// Ô nhập tiền: hiển thị dấu chấm hàng nghìn (1.000.000) nhưng giá trị lưu là chuỗi số thuần ('1000000').
// onChange trả về chuỗi số (không có dấu chấm) -> logic lưu DB giữ nguyên.
export const formatMoney = (v) => {
  const n = String(v ?? '').replace(/\D/g, '');
  return n ? new Intl.NumberFormat('vi-VN').format(Number(n)) : '';
};
export const parseMoney = (v) => String(v ?? '').replace(/\D/g, '');

export default function MoneyInput({ value, onChange, className = '', placeholder = '0', ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatMoney(value)}
      onChange={(e) => onChange(parseMoney(e.target.value))}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
}
