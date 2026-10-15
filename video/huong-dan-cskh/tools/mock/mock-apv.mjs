// Dữ liệu giả cho màn Duyệt đơn (leave_requests) + Tạm ứng/chi (expenses)
const now = new Date();
const d = (days, h = 9) => { const x = new Date(now); x.setDate(x.getDate() + days); x.setHours(h, 15, 0, 0); return x; };
const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const P = { s1: 'Trần Ngọc Mai', s2: 'Phạm Thu Hà', s3: 'Đỗ Quang Huy', 'demo-staff': 'Trần Mai Anh' };

const leave_requests = [
  { id: 'l1', staff_id: 's1', type: 'leave', date: ymd(d(2)), reason: 'Nghỉ phép việc gia đình, về quê dự đám cưới em gái', status: 'pending', created_at: d(0, 8).toISOString() },
  { id: 'l2', staff_id: 's2', type: 'late', date: ymd(d(1)), reason: 'Đưa con đi khám bệnh buổi sáng, dự kiến đến muộn 1 tiếng', status: 'pending', created_at: d(-1, 17).toISOString() },
  { id: 'l3', staff_id: 's3', type: 'half_day', half_day_period: 'afternoon', date: ymd(d(3)), reason: 'Làm thủ tục giấy tờ tại phường', status: 'pending', created_at: d(-1, 10).toISOString() },
  { id: 'l4', staff_id: 'demo-staff', type: 'early', date: ymd(d(-1)), reason: 'Về sớm đón con', status: 'approved', created_at: d(-2, 9).toISOString(), reviewed_at: d(-2, 11).toISOString() },
  { id: 'l5', staff_id: 's1', type: 'late', date: ymd(d(-2)), reason: 'Xe hỏng giữa đường', status: 'rejected', created_at: d(-3, 8).toISOString(), reviewed_at: d(-3, 9).toISOString() },
];

const exp = (o) => ({ is_advance: true, deleted_at: null, proof_image_urls: [], notes: '', profiles: { full_name: P[o.staff_id] }, created_at: d(0).toISOString(), ...o });
const expenses = [
  exp({ id: 'e1', staff_id: 's1', date: ymd(d(-1)), category: 'Vat_tu', amount: 2450000, description: 'Mua bông gạc, găng tay vô trùng cho phòng thủ thuật tầng 2', notes: 'Nhà thuốc Long Châu | transfer', status: 'pending', proof_image_urls: ['https://picsum.photos/seed/a/300', 'https://picsum.photos/seed/b/300'] }),
  exp({ id: 'e2', staff_id: 's3', date: ymd(d(-2)), category: 'Tiep_khach', amount: 780000, description: 'Mời nước khách VIP tư vấn nâng mũi', notes: 'Highlands | cash', status: 'pending' }),
  exp({ id: 'e3', staff_id: 'demo-staff', date: ymd(d(-3)), category: 'Van_phong', amount: 350000, description: 'Giấy in, bút, kẹp tài liệu', status: 'approved' }),
  exp({ id: 'e4', staff_id: 's2', date: ymd(d(-4)), category: 'MKT', amount: 5200000, description: 'Chạy quảng cáo Facebook tuần 1', status: 'paid', advance_repaid_amount: 5200000, advance_repaid_at: d(-1).toISOString(), advance_repaid_proof: 'https://picsum.photos/seed/c/300' }),
  exp({ id: 'e5', staff_id: 's1', date: ymd(d(-5)), category: 'Khac', amount: 150000, description: 'Gửi xe tháng', status: 'rejected', reject_reason: 'Đã có phụ cấp gửi xe' }),
];

export default { leave_requests, expenses };
