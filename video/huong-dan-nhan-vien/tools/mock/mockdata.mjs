const pad = n => String(n).padStart(2, '0');
const d = (off, h = 9) => { const x = new Date(); x.setDate(x.getDate() + off); x.setHours(h, 0, 0, 0); return x; };
const ymd = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const NAMES = ['Nguyễn Thị Lan', 'Trần Minh Thư', 'Lê Hoàng Yến', 'Phạm Thu Hà', 'Võ Ngọc Ánh', 'Đặng Thảo Vy', 'Bùi Khánh Linh', 'Hồ Mỹ Duyên', 'Ngô Bảo Trân', 'Dương Kim Chi', 'Lý Gia Hân', 'Mai Phương Thảo', 'Châu Ngọc Hân', 'Tạ Quỳnh Như', 'Đỗ Hải Yến', 'Vũ Thanh Tâm', 'Phan Diễm My', 'Trịnh Bích Ngọc', 'Lâm Tú Anh', 'Cao Minh Châu', 'Tôn Nữ Hạnh', 'Quách Lệ Quyên'];
const ST = ['nong', 'tiem_nang', 'da_hen_lich', 'coc', 'da_lam_dv', 'tiep_can', 'chot_fail', 'mat', 'tiep_can', 'nong', 'tiem_nang'];
const SRC = ['Facebook Ads', 'TikTok', 'Zalo', 'Giới thiệu', 'Website'];
const TELE = [{ id: 't1', full_name: 'Nguyễn Hồng Nhung' }, { id: 't2', full_name: 'Trần Mai Anh' }];
const TRUC = [{ id: 'p1', full_name: 'Lê Thảo My' }, { id: 'p2', full_name: 'Phạm Gia Bảo' }];
const rows = NAMES.map((n, i) => ({
  id: 1000 + i, customer_name: n, phone: `09${String(12345670 + i * 7919).slice(0, 8)}`, status: ST[i % ST.length],
  description: i % 3 === 0 ? 'Quan tâm nâng mũi cấu trúc, hỏi giá + thời gian hồi phục' : 'Hỏi cắt mí, muốn xem ảnh before/after',
  last_exchange: i % 2 ? 'Đã gửi bảng giá, khách hẹn cuối tuần qua tư vấn' : 'Khách bận, gọi lại sau',
  next_call_at: i % 4 === 0 ? d(0, 8).toISOString() : i % 4 === 1 ? d(2).toISOString() : null,
  last_contact_at: d(-(i % 9)).toISOString(), created_at: d(-(i * 2)).toISOString(),
  getfly_updated_at: d(-(i % 9)).toISOString(), getfly_code: `KH${String(5120 + i)}`,
  truc_page_id: TRUC[i % 2].id, telesale_id: TELE[i % 2].id, truc_page: TRUC[i % 2], telesale: TELE[i % 2],
  source: SRC[i % SRC.length], customer_group: i % 2 ? 'Khách mới' : 'Khách VIP', gender: 'Nữ',
  birthday: '1996-05-12', address: 'Quận 3, TP.HCM', email: i === 0 ? 'lan.nguyen@gmail.com' : null, total_revenue: i % 5 === 4 ? 85000000 : 0,
}));
const appts = [
  { id: 1, phone: rows[0].phone, customer_name: rows[0].customer_name, appointment_date: ymd(d(-20)), appointment_time: '10:00', service: 'Nâng mũi cấu trúc', status: 'coc', expected_bill: 65000000, deposit_amount: 5000000, deposit_date: ymd(d(-20)), expected_surgery_date: ymd(d(5)), telesale: TELE[0], sale: { full_name: 'Trần Thu Thuỷ' } },
  { id: 2, phone: rows[0].phone, customer_name: rows[0].customer_name, appointment_date: ymd(d(3)), appointment_time: '14:30', service: 'Tư vấn cắt mí', status: 'scheduled', expected_bill: 25000000, telesale: TELE[0], sale: { full_name: 'Lê Minh Anh' } },
  { id: 3, phone: rows[4].phone, customer_name: rows[4].customer_name, appointment_date: ymd(d(-40)), appointment_time: '09:00', service: 'Hút mỡ bụng', status: 'phau_thuat', revenue: 85000000, upsale_revenue: 5000000, surgery_date: ymd(d(-35)), telesale: TELE[0], sale: { full_name: 'Hoàng Thị Xuân' } },
];
const acts = [
  { id: 1, data_id: 1000, phone: rows[0].phone, type: 'call', outcome: 'nghe_may', content: 'Khách quan tâm nâng mũi, hẹn qua tư vấn thứ 7', created_at: d(-1, 10).toISOString(), created_by: 't1', creator: { full_name: 'Nguyễn Hồng Nhung' } },
  { id: 2, data_id: 1000, phone: rows[0].phone, type: 'care', outcome: null, content: 'Gửi ảnh before/after qua Zalo', created_at: d(-3, 15).toISOString(), created_by: 't1', creator: { full_name: 'Nguyễn Hồng Nhung' } },
  { id: 3, data_id: 1000, phone: rows[0].phone, type: 'call', outcome: 'khong_nghe', content: 'Không nghe máy', created_at: d(-6, 11).toISOString(), created_by: 't1', creator: { full_name: 'Nguyễn Hồng Nhung' } },
];
const SV = ['Nâng mũi cấu trúc', 'Cắt mí', 'Hút mỡ bụng', 'Độn cằm', 'Nâng ngực', 'Tái khám'];
for (let i = 0; i < 6; i++) appts.push({ id: 100 + i, phone: rows[i + 5].phone, customer_name: rows[i + 5].customer_name, appointment_date: ymd(d(0)), appointment_time: `${9 + i}:00`, service: SV[i], status: ['scheduled', 'coc', 'phau_thuat', 'scheduled', 'bong', 'scheduled'][i], telesale_id: i % 2 ? 't1' : 't2', created_at: d(-1).toISOString() });
for (let m = 0; m < 6; m++) for (let k = 0; k < 4 + m; k++) appts.push({ id: 300 + m * 20 + k, customer_name: 'KH', service: SV[k % 5], status: 'phau_thuat', appointment_date: ymd(d(-m * 30 - k)), surgery_date: ymd(d(-m * 30 - k)), revenue: 30000000 + k * 7000000, telesale_id: k % 2 ? 't1' : 't2', created_at: d(-m * 30).toISOString() });
const SHIFTS = [
  { id: 'sh-am', name: 'Ca sáng', short: 'Sáng', start_time: '08:00', end_time: '17:00', tone: 'peach', is_off: false, sort: 1, active: true },
  { id: 'sh-pm', name: 'Ca chiều', short: 'Chiều', start_time: '11:00', end_time: '20:00', tone: 'success', is_off: false, sort: 2, active: true },
  { id: 'sh-ev', name: 'Ca tối', short: 'Tối', start_time: '13:00', end_time: '22:00', tone: 'rose', is_off: false, sort: 3, active: true },
  { id: 'sh-nt', name: 'Trực đêm', short: 'Trực', start_time: '22:00', end_time: '08:00', tone: 'lavender', is_off: false, sort: 4, active: true },
  { id: 'sh-of', name: 'Hành chính', short: 'HC', start_time: '08:30', end_time: '17:30', tone: 'sky', is_off: false, sort: 5, active: true },
  { id: 'sh-off', name: 'Nghỉ', short: 'Nghỉ', start_time: '00:00', end_time: '00:00', tone: 'neutral', is_off: true, sort: 6, active: true },
];
const STAFFP = [['s1','Trần Ngọc Mai','bac_si','Bác sĩ'],['s2','Phạm Thu Hà','dieu_duong','Kỹ thuật viên'],['s3','Đỗ Quang Huy','sale_offline','Tư vấn viên'],['demo-staff','Trần Mai Anh','telesale','Telesale'],['s5','Lê Minh Anh','sale_offline','Tư vấn viên'],['s6','Võ Thanh Hương','accountant','Chuyên viên nhân sự']].map(([id, full_name, role, position]) => ({ id, full_name, role, position, is_active: true, created_at: d(-200).toISOString() }));
const PAT = [['sh-am','sh-pm','sh-ev','sh-off','sh-ev','sh-am','sh-am'],['sh-am','sh-ev','sh-ev','sh-ev','sh-pm','sh-off','sh-am'],['sh-am','sh-pm','sh-ev','sh-off','sh-ev','sh-am','sh-am'],['sh-am','sh-ev','sh-ev','sh-ev','sh-pm','sh-off','sh-am'],['sh-ev','sh-off','sh-pm','sh-pm','sh-ev','sh-am','sh-off'],['sh-of','sh-of','sh-of','sh-of','sh-of','sh-of','sh-off']];
const mon = (() => { const x = new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
const SCHED = STAFFP.flatMap((p, i) => PAT[i].map((sid, k) => { const dt = new Date(mon); dt.setDate(mon.getDate() + k); return { staff_id: p.id, date: ymd(dt), shift_id: sid, status: k >= 5 ? 'draft' : 'published' }; }));
const TABLES = {
  work_shifts: SHIFTS, staff_schedules: SCHED,
  role_permissions: [{ role: 'telesale', module: 'finance', granted: false }, { role: 'cskh', module: 'data_kh', granted: true }],
  permission_audit: [{ id: 1, action: 'grant', role: 'cskh', module: 'data_kh', reason: 'CSKH cần xem lịch sử khách để chăm sóc sau phẫu thuật', created_at: d(0, 10).toISOString(), actor: { full_name: 'Nguyễn Văn Dũng' } }, { id: 2, action: 'revoke', role: 'telesale', module: 'finance', reason: 'Telesale không cần xem doanh thu tổng', created_at: d(-1, 15).toISOString(), actor: { full_name: 'Nguyễn Văn Dũng' } }],
  attendance: [{ id: 1, staff_id: 'demo-staff', check_in: '08:02:11', check_out: null, status: 'present' }],
  kpi_targets: [{ staff_id: 'demo-staff', target_revenue: 500000000, actual_revenue: 360000000, target_customers: 40, actual_customers: 29, target_calls: 600, actual_calls: 470 }], marketing_data: rows, customer_appointments: appts, marketing_activities: acts, profiles: [...STAFFP, ...[...TELE, ...TRUC].map(x => ({ ...x, created_at: d(-200).toISOString(), is_active: true }))] };

export const handle = async (route) => {
  const u = new URL(route.request().url());
  const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
  if (!['GET', 'HEAD'].includes(route.request().method())) return route.fallback();
  let data = (m && TABLES[m[1]]) || [];
  if (Number(u.searchParams.get('offset')) > 0) data = [];
  const single = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, data.length - 1)}/${data.length}` }, body: JSON.stringify(single ? (data[0] || null) : data) });
};
export { TABLES };
