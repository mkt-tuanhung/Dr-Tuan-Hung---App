// Dữ liệu giả cho màn KPI nhân viên (agent "kpi")
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const day = (dd) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(dd)}`;
const ME = 'demo-staff';
const NAMES = ['Nguyễn Thị Lan', 'Trần Minh Thư', 'Lê Hoàng Yến', 'Phạm Thu Hà', 'Võ Ngọc Ánh', 'Đặng Thảo Vy', 'Bùi Khánh Linh', 'Hồ Mỹ Duyên'];
const SV = ['Nâng mũi cấu trúc', 'Cắt mí', 'Hút mỡ bụng', 'Độn cằm', 'Nâng ngực'];
const ST = ['phau_thuat', 'coc', 'scheduled', 'phau_thuat', 'bong', 'phau_thuat', 'scheduled', 'coc'];
const customer_appointments = NAMES.map((n, i) => ({
  id: 9000 + i, customer_name: n, phone: `09${12345600 + i * 37}`, appointment_date: day(Math.max(1, 3 - (i % 3))),
  surgery_date: ST[i] === 'phau_thuat' ? day(Math.max(1, 3 - (i % 3))) : null, status: ST[i],
  revenue: ST[i] === 'phau_thuat' ? 45000000 + i * 9000000 : 0, upsale_revenue: ST[i] === 'phau_thuat' ? (i % 2 ? 8000000 : 0) : 0,
  service: SV[i % SV.length], notes: i % 3 === 0 ? 'Khách quay lại tái tư vấn' : null, sale_id: ME, telesale_id: ME,
  surgery_type: i % 2 ? 'Đại phẫu' : 'Tiểu phẫu', customer_source: 'Facebook Ads',
  phu_mo_1_id: i % 4 === 0 ? ME : null, phu_mo_2_id: i % 4 === 1 ? ME : null, phu_mo_3_id: i % 4 === 2 ? ME : null,
  truc_dem_id: i % 3 === 0 ? ME : null, hau_phau_id: i % 4 === 3 ? ME : null, additional_hau_phau_ids: [],
}));
export default {
  kpi_targets: [{ id: 1, staff_id: ME, month: now.getMonth() + 1, year: now.getFullYear(), target_revenue: 500000000, actual_revenue: 360000000, target_customers: 40, actual_customers: 29, target_calls: 600, actual_calls: 470, target_close_rate: 35, target_appointments: 40, target_phones: 300, commission_rate: 2, commission_amount: 7200000, notes: 'Phụ mổ cẩn thận, chuẩn bị dụng cụ tốt', note: 'Cố gắng tăng tỉ lệ chốt nửa cuối tháng' }],
  customer_appointments,
  page_daily_reports: [1, 2, 3, 4].map(k => ({ id: 70 + k, staff_id: ME, date: day(k), total_phones: 10 + k * 3, total_interested_phones: 6 + k, total_messages: 40 + k * 5, total_spam_messages: k, telesale_id: 't1', telesale: { full_name: 'Nguyễn Hồng Nhung' } })),
  partner_surgeries: [{ customer_name: 'Lý Gia Hân', partner_name: 'BS. Minh', surgery_date: day(2), surgery_type: 'Đại phẫu', partner_fee: 20000000, phu_mo_1_id: ME }],
};
