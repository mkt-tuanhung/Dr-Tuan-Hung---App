// Dữ liệu giả cho màn "Lương của tôi" (MyPayrollPage) — staff 'demo-staff'.
// Mock supabase bỏ qua bộ lọc → profiles.maybeSingle() lấy dòng đầu → đặt demo-staff lên đầu.
import { TABLES } from './mockdata.mjs';

const me = {
  id: 'demo-staff', full_name: 'Trần Mai Anh', employee_id: 'NV024', role: 'sale_offline', role_2: null,
  position: 'Tư vấn viên', base_salary: 8000000, allowance: 1000000, employment_status: 'official',
  fixed_salary: false, bank_name: 'Vietcombank', bank_account: '0123456789', is_active: true,
};

const row = (month, o) => ({
  id: `pay-${month}`, staff_id: 'demo-staff', month, year: 2026, status: 'locked',
  base_salary: 8000000, working_days: 26, salary_by_attendance: 8000000, allowance: 1000000,
  total_commission: 6450000, overtime_pay: 0, unpaid_advance: 0, other_bonus: 0,
  salary_advance: 0, other_deduction: 0, gross_income: 15450000, total_deductions: 0, net_salary: 15450000,
  ...o,
});

export default {
  profiles: [me, ...(TABLES.profiles || []).filter((p) => p.id !== 'demo-staff')],
  payroll: [
    row(7, { total_commission: 4200000, gross_income: 13200000, net_salary: 13200000 }),
    row(8, { total_commission: 5800000, gross_income: 14800000, salary_advance: 2000000, total_deductions: 2000000, net_salary: 12800000 }),
    row(9, { working_days: 25, salary_by_attendance: 7692308, total_commission: 7350000, overtime_pay: 450000, gross_income: 16492308, salary_advance: 3000000, other_deduction: 200000, total_deductions: 3200000, net_salary: 13292308 }),
    row(10, {
      working_days: 24, salary_by_attendance: 7384615, total_commission: 9125000, overtime_pay: 620000,
      unpaid_advance: 350000, other_bonus: 500000,
      gross_income: 18979615, salary_advance: 3000000, other_deduction: 150000, total_deductions: 3150000, net_salary: 15829615,
    }),
  ],
};
