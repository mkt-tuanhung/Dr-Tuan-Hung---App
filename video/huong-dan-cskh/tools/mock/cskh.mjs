// Dữ liệu giả cho video hướng dẫn CSKH (nhân viên demo 'demo-staff', vai trò cskh).
// Mốc thời gian lấy theo NOW (đồng hồ trình duyệt cũng được cố định đúng mốc này khi chụp).
import base from './vmock.mjs';

export const NOW = new Date('2026-10-15T08:05:00+07:00');
const pad = n => String(n).padStart(2, '0');
const day = (off, h = 9, m = 0) => { const x = new Date(NOW); x.setDate(x.getDate() + off); x.setHours(h, m, 0, 0); return x; };
const ymd = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const vn = (x, withTime = true) => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}${withTime ? ` ${pad(x.getHours())}:${pad(x.getMinutes())}:00` : ''}`;
const iso = x => x.toISOString();
const note = (entries) => entries.map(([off, h, m, t]) => `[${vn(day(off, h, m))}] ${t}`).join('\n');

const NURSES = [
  { id: 'n1', full_name: 'Nguyễn Huyền Trang', role: 'dieu_duong', is_active: true },
  { id: 'n2', full_name: 'Phạm Thu Hà', role: 'dieu_duong', is_active: true },
  { id: 'n3', full_name: 'Lê Bích Ngọc', role: 'dieu_duong', role_2: null, is_active: true, position: 'Trưởng nhóm điều dưỡng' },
];
const STAFF = [
  { id: 'demo-staff', full_name: 'Trần Mai Anh', role: 'cskh', is_active: true },
  { id: 'c2', full_name: 'Đỗ Thanh Tâm', role: 'cskh', is_active: true },
  { id: 'd1', full_name: 'BS Trần Tuấn Hùng', role: 'bac_si', is_active: true },
  { id: 't1', full_name: 'Nguyễn Hồng Nhung', role: 'telesale', is_active: true },
  { id: 's1', full_name: 'Lê Minh Anh', role: 'sale_offline', is_active: true },
  ...NURSES,
];
const nurse = (i) => ({ hau_phau_id: NURSES[i % 3].id, hau_phau: { full_name: NURSES[i % 3].full_name } });

// ---------- Ca phẫu thuật: Hậu phẫu (<1 tháng) + CSKH (≥1 tháng) ----------
const ms = (surgOff, doneUpTo) => ['d0', 'd1', 'd2', 'd7', 'd14', 'd30'].map((k, i) => ({
  key: k, done: i <= doneUpTo, nurse_id: 'n1', note: '', done_at: i <= doneUpTo ? iso(day(surgOff + [0, 1, 2, 7, 14, 30][i], 10)) : null,
}));
const PT = [
  // Hậu phẫu
  { id: 'hp1', customer_name: 'Nguyễn Thị Lan', phone: '0912345678', service: 'Nâng mũi cấu trúc', s: -1, post_op_status: 'Đang theo dõi', warn: [], ms: 0,
    post: note([[-1, 16, 30, 'Mổ xong, khách tỉnh táo, dặn chườm lạnh và uống thuốc đúng giờ.'], [0, 7, 45, 'Gọi hỏi thăm: sưng nhẹ, không sốt, ăn uống bình thường.']]) },
  { id: 'hp2', customer_name: 'Trần Minh Thư', phone: '0987123456', service: 'Cắt mí mắt', s: -3, post_op_status: 'Đang theo dõi', warn: [], ms: 2,
    post: note([[-3, 15, 0, 'Mổ xong, về trong ngày.'], [-2, 9, 10, 'Mắt sưng vừa, đã hướng dẫn chườm.']]) },
  { id: 'hp3', customer_name: 'Lê Hoàng Yến', phone: '0905556677', service: 'Hút mỡ bụng', s: -6, post_op_status: 'Có biến chứng', warn: ['Sưng đau tăng dần', 'Sốt ≥ 38°C'], ms: 2,
    post: note([[-1, 20, 15, 'Khách báo sốt 38.2°C, sưng đau vùng bụng. Đã báo BS, hẹn qua kiểm tra sáng mai.']]), next: day(0, 9, 30) },
  { id: 'hp4', customer_name: 'Phạm Thu Hà', phone: '0934222111', service: 'Độn cằm', s: -9, post_op_status: 'Tái khám', warn: [], ms: 3,
    post: note([[-2, 10, 0, 'Hẹn tái khám cắt chỉ.']]), next: day(1, 10) },
  { id: 'hp5', customer_name: 'Võ Ngọc Ánh', phone: '0938777888', service: 'Nâng ngực', s: -14, post_op_status: 'Đã ổn định', warn: [], ms: 4, post: note([[-1, 11, 0, 'Hồi phục tốt.']]) },
  { id: 'hp6', customer_name: 'Đặng Thảo Vy', phone: '0911000222', service: 'Gọt hàm, bóc cơ cắn', s: -20, post_op_status: 'Đang theo dõi', warn: ['Tê bì kéo dài'], ms: 4, post: '' },
  // CSKH
  { id: 'ck1', customer_name: 'Bùi Khánh Linh', phone: '0909123123', service: 'Nâng mũi cấu trúc', s: -38, post_op_status: 'Đã ổn định', cskh: 'Hài lòng', ms: 5,
    cskh_notes: note([[-8, 10, 20, 'Đã gọi hỏi thăm. Khách hài lòng kết quả, dáng mũi tự nhiên.'], [-2, 15, 5, 'Gửi ưu đãi chăm sóc da cho khách cũ, khách hẹn quay lại tháng sau.']]) },
  { id: 'ck2', customer_name: 'Hồ Mỹ Duyên', phone: '0977333444', service: 'Cắt mí mắt', s: -42, post_op_status: 'Đã ổn định', cskh: null, ms: 5, cskh_notes: '' },
  { id: 'ck3', customer_name: 'Ngô Bảo Trân', phone: '0966111999', service: 'Hút mỡ bụng', s: -47, post_op_status: 'Đã ổn định', cskh: 'Tiềm năng', ms: 5,
    cskh_notes: note([[-5, 9, 40, 'Khách hỏi thêm dịch vụ nâng ngực, đã chuyển Sale tư vấn.']]) },
  { id: 'ck4', customer_name: 'Dương Kim Chi', phone: '0918444555', service: 'Độn cằm', s: -55, post_op_status: 'Đã ổn định', cskh: 'Gặp vấn đề', ms: 5,
    cskh_notes: note([[-3, 14, 0, 'Khách thấy cằm hơi lệch khi cười, cần BS kiểm tra.']]) },
  { id: 'ck5', customer_name: 'Lý Gia Hân', phone: '0903777666', service: 'Nâng ngực', s: -61, post_op_status: 'Đã ổn định', cskh: 'Bình thường', ms: 5, cskh_notes: note([[-10, 10, 0, 'Đã gọi, khách bận, hẹn gọi lại.']]) },
  { id: 'ck6', customer_name: 'Mai Phương Thảo', phone: '0932888999', service: 'Cắt mí mắt', s: -70, post_op_status: 'Đã ổn định', cskh: 'Hài lòng', ms: 5, cskh_notes: note([[-20, 9, 0, 'Khách phản hồi tốt, giới thiệu thêm bạn.']]) },
];
const surgeries = PT.map((p, i) => ({
  id: p.id, customer_name: p.customer_name, phone: p.phone, service: p.service, status: 'phau_thuat',
  surgery_date: ymd(day(p.s)), appointment_date: ymd(day(p.s)), appointment_time: '08:30',
  post_op_status: p.post_op_status, warning_signs: p.warn || [], post_op_notes: p.post || '', cskh_status: p.cskh ?? null, cskh_notes: p.cskh_notes || '',
  care_milestones: ms(p.s, p.ms), next_recheck_at: p.next ? iso(p.next) : null, additional_hau_phau_ids: [],
  revenue: 45000000 + i * 5000000, upsale_revenue: i % 3 ? 0 : 3000000, telesale: { full_name: 'Nguyễn Hồng Nhung' }, sale: { full_name: 'Lê Minh Anh' },
  telesale_id: 't1', sale_id: 's1', created_at: iso(day(p.s - 10)), updated_at: iso(day(-1)),
  ...nurse(i),
}));

// ---------- Khách Bong ----------
const BONG = [
  ['b1', 'Trịnh Bích Ngọc', '0915666777', 'Nâng mũi', 'Chê giá cao, muốn tham khảo thêm nơi khác', 'Đang chăm sóc', -1],
  ['b2', 'Lâm Tú Anh', '0989555444', 'Cắt mí', 'Chưa sắp xếp được thời gian nghỉ dưỡng', 'Đang chăm sóc', -1],
  ['b3', 'Cao Minh Châu', '0902333111', 'Hút mỡ bụng', 'Gia đình chưa đồng ý', 'Đã quay lại tư vấn', -3],
  ['b4', 'Tôn Nữ Hạnh', '0976222000', 'Độn cằm', 'Sợ đau, cần thêm thông tin', 'Đang chăm sóc', -4],
  ['b5', 'Quách Lệ Quyên', '0938111000', 'Nâng ngực', 'Đã làm ở nơi khác', 'Làm nơi khác', -6],
];
const bong = BONG.map(([id, n, ph, sv, why, cs, off]) => ({
  id, customer_name: n, phone: ph, service: sv, status: 'bong', notes: why, care_status: cs,
  care_notes: `CẬP NHẬT ${vn(day(off - 2), false)} :\n[${vn(day(off - 2), false)}] Đã gọi, khách hẹn suy nghĩ thêm.\n[${vn(day(off), false)}] Gửi ảnh before/after + ưu đãi tháng 10 qua Zalo.`,
  appointment_date: ymd(day(off - 5)), appointment_time: '10:00', updated_at: iso(day(off, 16)), created_at: iso(day(off - 10)),
  telesale_id: 't1', sale_id: 's1', telesale: { full_name: 'Nguyễn Hồng Nhung' }, sale: { full_name: 'Lê Minh Anh' },
}));

// ---------- Lịch hẹn hôm nay (kèm lịch tái khám) ----------
const SV = ['Tư vấn nâng mũi', 'Tư vấn cắt mí', '[Tái khám] Cắt chỉ mũi', 'Tư vấn hút mỡ', '[Tái khám] Kiểm tra sau mổ', 'Tư vấn độn cằm'];
const appts = SV.map((sv, i) => ({
  id: `ap${i}`, customer_name: ['Phan Diễm My', 'Vũ Thanh Tâm', 'Phạm Thu Hà', 'Đỗ Hải Yến', 'Lê Hoàng Yến', 'Châu Ngọc Hân'][i], phone: `09${71234560 + i * 37}`,
  appointment_date: ymd(day(0)), appointment_time: ['09:00', '09:30', '10:00', '13:30', '14:00', '15:30'][i], service: sv,
  status: sv.startsWith('[Tái') ? 'scheduled' : ['scheduled', 'coc', 'scheduled', 'scheduled', 'scheduled', 'scheduled'][i],
  customer_source: sv.startsWith('[Tái') ? 'CSKH' : 'Facebook Ads', customer_type: sv.startsWith('[Tái') ? 'Cũ' : 'Mới',
  sale_id: i % 2 ? 's1' : 'n1', telesale_id: 't1', sale: { full_name: i % 2 ? 'Lê Minh Anh' : 'Nguyễn Huyền Trang' }, telesale: { full_name: 'Nguyễn Hồng Nhung' },
  created_at: iso(day(-2)), updated_at: iso(day(-1)),
}));

// ---------- Đánh giá dịch vụ ----------
const RV = [
  // [id, tên, dịch vụ, ngày mổ off, điểm, nps, sentiment, comment, topics, wants, submitted off]
  ['r1', 'Bùi Khánh Linh', 'Nâng mũi cấu trúc', -38, 5, 10, 'very_positive', 'Bác sĩ và điều dưỡng rất tận tâm, mũi đẹp tự nhiên. Cảm ơn cả ê kíp!', ['Bác sĩ', 'Kết quả'], 'none', -2],
  ['r2', 'Mai Phương Thảo', 'Cắt mí mắt', -70, 5, 9, 'positive', 'Điều dưỡng gọi hỏi thăm đều đặn, mình rất yên tâm.', ['Chăm sóc sau mổ'], 'none', -4],
  ['r3', 'Dương Kim Chi', 'Độn cằm', -55, 2, 4, 'negative', 'Cằm hơi lệch khi cười, mong bác sĩ kiểm tra lại giúp em.', ['Kết quả'], 'urgent', -1],
  ['r4', 'Lê Hoàng Yến', 'Hút mỡ bụng', -6, 3, 6, 'neutral', 'Phải chờ lâu ở quầy lễ tân lúc tái khám.', ['Thời gian chờ'], 'office_hours', -1],
  ['r5', 'Hồ Mỹ Duyên', 'Cắt mí mắt', -42, 4, 8, 'positive', 'Dịch vụ tốt, giá hợp lý.', ['Giá'], 'none', -6],
  ['r6', 'Lý Gia Hân', 'Nâng ngực', -61, 1, 2, 'very_negative', 'Gọi tổng đài mãi không ai nghe, rất bực mình.', ['Tổng đài', 'Thái độ'], 'urgent', 0],
  ['r7', 'Ngô Bảo Trân', 'Hút mỡ bụng', -47, 5, 10, 'very_positive', 'Rất hài lòng, sẽ giới thiệu bạn bè.', ['Kết quả', 'Bác sĩ'], 'none', -9],
  ['r8', 'Võ Ngọc Ánh', 'Nâng ngực', -14, 4, 9, 'positive', 'Phòng nghỉ sạch sẽ, nhân viên dễ thương.', ['Cơ sở vật chất'], 'none', -11],
];
const sr = (s) => [
  { staff_id: 'd1', name: 'BS Trần Tuấn Hùng', role: 'doctor', score: Math.min(5, s + 1) },
  { staff_id: 'n1', name: 'Nguyễn Huyền Trang', role: 'nurse', score: s },
  { staff_id: 'demo-staff', name: 'Trần Mai Anh', role: 'cskh', score: Math.max(3, s) },
];
const invitations = RV.map(([id, n, sv, so, , , , , , , sub], i) => ({
  id: `iv-${id}`, token: `tok${i}`, appointment_id: surgeries.find(x => x.customer_name === n)?.id || null, milestone: i % 2 ? 'd30' : 'd7',
  customer_name: n, phone: '09' + (11122233 + i), service: sv, surgery_date: ymd(day(so)), status: 'completed', is_resurvey: false,
  ticket_id: null, created_at: iso(day(sub - 1, 9)),
}));
const responses = RV.map(([id, n, sv, so, sc, nps, sent, cm, tp, wc, sub], i) => ({
  id, overall_score: sc, csat_score: sc, nps_score: nps, staff_ratings: sr(sc),
  answers: { q1: sc, q2: sc, q3: Math.min(5, sc + 1), q4: sc, q5: sc, q6: sc, q7: sc, q8: sc, q9: nps, q10: cm },
  selected_topics: tp, wants_contact: wc, comment: cm, risk_level: sc <= 2 ? 'high' : 'low', fraud_status: 'clean', fraud_score: 0,
  verification_level: 'phone', sentiment: sent, ai_summary: null, submitted_at: iso(day(sub, 10 + i)),
  invitation: { customer_name: n, service: sv, surgery_date: ymd(day(so)), milestone: invitations[i].milestone, ticket_id: null, is_resurvey: false, appointment_id: invitations[i].appointment_id },
}));
const TK = [
  ['tk1', 'r6', 'Lý Gia Hân', 'Tổng đài / liên hệ', 'urgent', 'new', null, 1, 'urgent', 0, 4],
  ['tk2', 'r3', 'Dương Kim Chi', 'Kết quả dịch vụ', 'urgent', 'contacting', 'demo-staff', 2, 'urgent', -1, -2],
  ['tk3', 'r4', 'Lê Hoàng Yến', 'Thời gian chờ', 'normal', 'in_progress', 'c2', 3, 'office_hours', -1, 48],
  ['tk4', 'r5', 'Hồ Mỹ Duyên', 'Giá', 'low', 'closed', 'demo-staff', 4, 'none', -6, 24],
];
const tickets = TK.map(([id, rid, n, cat, pr, stt, asg, sc, wc, off, slaH]) => {
  const r = responses.find(x => x.id === rid);
  const created = day(off, 11);
  return {
    id, response_id: rid, customer_name: n, category: cat, priority: pr, status: stt, assigned_to: asg, sla_due_at: iso(new Date(created.getTime() + slaH * 3600e3)),
    overall_score: sc, wants_contact: wc, root_cause: stt === 'closed' ? 'Khách cần thêm thông tin giá' : null, resolution: stt === 'closed' ? 'Đã gửi bảng giá chi tiết, khách đồng ý' : null,
    resolved_at: stt === 'closed' ? iso(day(off + 1)) : null, closed_at: stt === 'closed' ? iso(day(off + 1)) : null, created_at: iso(created), updated_at: iso(created),
    response: { comment: r.comment, selected_topics: r.selected_topics, staff_ratings: r.staff_ratings, answers: r.answers, invitation: { service: r.invitation.service, phone: '0918444555' } },
  };
});
const activities = [
  { id: 'ac1', ticket_id: 'tk2', activity_type: 'status', content: 'Chuyển trạng thái: Mới tiếp nhận → Đang liên hệ', created_by: 'demo-staff', created_at: iso(day(-1, 13)) },
  { id: 'ac2', ticket_id: 'tk2', activity_type: 'note', content: 'Đã gọi khách, hẹn BS kiểm tra lại vào thứ 7.', created_by: 'demo-staff', created_at: iso(day(-1, 13, 20)) },
];

// ---------- Hộp thư đa kênh ----------
const CONV = [
  ['c1', 'Phan Diễm My', '0971234560', 'b1', 'Dạ em cảm ơn chị, mai em qua tái khám ạ', 0, 7, 50],
  ['c2', 'Nguyễn Thị Lan', '0912345678', 'hp1', 'Mũi em hơi sưng có sao không ạ?', 0, 7, 20],
  ['c3', 'Khách Messenger', null, null, 'Cho em hỏi giá cắt mí ạ', -1, 21, 5],
  ['c4', 'Trần Minh Thư', '0987123456', 'hp2', 'Ok chị ạ', -1, 15, 0],
  ['c5', 'Hoàng Thu Trang', null, null, 'Bên mình có trả góp không ạ?', -3, 10, 0],
];
const fb_conversations = CONV.map(([k, n, ph, did, last, off, h, m]) => ({
  conv_key: k, page_id: 'pg1', psid: 'ps' + k, thread_id: 't_' + k, participant_name: n, phone: ph, data_id: did ? 1000 : null,
  last_message: last, last_time: iso(day(off, h, m)), khach: did ? { customer_name: n } : null,
}));
const MSG = {
  c2: [
    [false, 'Nguyễn Thị Lan', 'Chị ơi em mổ mũi hôm qua, sáng nay thấy hơi sưng ạ', -0, 7, 12],
    [true, 'Dr Tuấn Hùng', 'Dạ chào Lan, sưng nhẹ 2–3 ngày đầu là bình thường em nhé. Em nhớ chườm lạnh 15 phút mỗi lần.', 0, 7, 15],
    [false, 'Nguyễn Thị Lan', 'Mũi em hơi sưng có sao không ạ?', 0, 7, 20],
  ],
  c1: [
    [true, 'Dr Tuấn Hùng', 'Chào chị My, phòng khám nhắc lịch tái khám của chị sáng mai lúc 9h ạ.', 0, 7, 40],
    [false, 'Phan Diễm My', 'Dạ em cảm ơn chị, mai em qua tái khám ạ', 0, 7, 50],
  ],
};
const fb_messages = Object.entries(MSG).flatMap(([k, arr]) => arr.map(([pg, from, text, off, h, m], i) => ({
  id: `${k}-${i}`, conv_key: k, is_page: pg, from_name: from, text, attachments: [], created_time: iso(day(off, h, m)),
}))).sort((a, b) => b.created_time.localeCompare(a.created_time));

const T = { ...base };
T.profiles = [...STAFF, ...base.profiles.filter(p => !STAFF.some(s => s.id === p.id))];
T.customer_appointments = [...surgeries, ...bong, ...appts];
T.service_review_invitations = invitations;
T.service_review_responses = responses;
T.service_review_tickets = tickets;
T.service_review_ticket_activities = activities;
T.fb_conversations = fb_conversations;
T.fb_messages = fb_messages;
T.inventory_transactions = [];
T.inventory_items = [{ id: 'i1', name: 'Chỉ khâu 6-0', unit: 'sợi' }, { id: 'i2', name: 'Gạc vô trùng', unit: 'gói' }, { id: 'i3', name: 'Băng dán mũi', unit: 'miếng' }];
T.notifications = [];
export default T;
