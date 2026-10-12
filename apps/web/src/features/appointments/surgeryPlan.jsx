// Ngày phẫu thuật dự kiến khi khách CỌC (supabase/deposit_surgery_plan.sql)
//   expected_surgery_plan: 'date' (có ngày) | 'this_month' (PT trong tháng) | 'none' (chưa có ngày)
// Dùng ở form ĐÁNH GIÁ sau tư vấn trực tiếp (Khách tư vấn · Lịch hẹn); các màn khác chỉ hiển thị.
import React from 'react';

export const SURGERY_PLANS = [
  { value: 'date', label: 'Có ngày PT dự kiến', short: 'Có ngày' },
  { value: 'this_month', label: 'PT trong tháng', short: 'PT trong tháng' },
  { value: 'none', label: 'Chưa có ngày PT dự kiến', short: 'Chưa có ngày' },
];

// Lựa chọn ban đầu khi mở form: dữ liệu cũ có ngày -> 'date'; chưa có gì -> '' (bắt sale chọn)
export const planOf = (app) => app?.expected_surgery_plan || (app?.expected_surgery_date ? 'date' : '');

const monthOf = (d) => {
  const s = String(d || '').slice(0, 7);   // YYYY-MM
  return /^\d{4}-\d{2}$/.test(s) ? `${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
};

// Chữ hiển thị: "20/10/2026" · "PT trong tháng 10/2026" · "Chưa có ngày PT dự kiến"
export function surgeryPlanLabel(app, { empty = '—' } = {}) {
  const plan = planOf(app);
  if (plan === 'date' && app?.expected_surgery_date) return new Date(app.expected_surgery_date).toLocaleDateString('vi-VN');
  if (plan === 'this_month') {
    const m = monthOf(app?.deposit_date || app?.created_at);
    return m ? `PT trong tháng ${m}` : 'PT trong tháng';
  }
  if (plan === 'none') return 'Chưa có ngày PT dự kiến';
  return empty;
}

// Dữ liệu ghi vào customer_appointments từ lựa chọn trên form
export const surgeryPlanPatch = (plan, date) => ({
  expected_surgery_plan: plan || null,
  expected_surgery_date: plan === 'date' ? (date || null) : null,
});

// Lỗi kiểm tra trước khi lưu (null = hợp lệ)
export const surgeryPlanError = (plan, date) => {
  if (!plan) return 'Chọn ngày phẫu thuật dự kiến: có ngày, PT trong tháng, hoặc chưa có ngày';
  if (plan === 'date' && !date) return 'Chọn ngày phẫu thuật dự kiến';
  return null;
};

export function ExpectedSurgeryField({ plan, date, onChange, label = 'Ngày phẫu thuật dự kiến', inputClassName = 'e-input', labelClassName = 'e-label' }) {
  return (
    <div>
      <span className={labelClassName}>{label} <span className="text-danger-500">*</span></span>
      {/* 1 hàng 3 ô bằng nhau (giống Bong / Cọc / Phẫu thuật) — nhãn ngắn, nhãn đầy đủ ở aria-label */}
      <div className="e-seg w-full grid grid-cols-3 gap-1" role="radiogroup" aria-label={label}>
        {SURGERY_PLANS.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={plan === o.value} aria-label={o.label} title={o.label}
            onClick={() => onChange({ plan: o.value, date: o.value === 'date' ? date : '' })}
            className={`e-seg-item w-full min-w-0 h-auto min-h-[36px] px-1.5 py-1.5 whitespace-normal text-center leading-tight text-[12.5px] sm:text-[13px] ${plan === o.value ? 'e-seg-active' : ''}`}>
            {o.short}
          </button>
        ))}
      </div>
      {plan === 'date' && (
        <input type="date" required value={date || ''} onChange={e => onChange({ plan, date: e.target.value })}
          className={`${inputClassName} mt-2`} aria-label="Chọn ngày phẫu thuật dự kiến" />
      )}
    </div>
  );
}
