import { TABLES } from './mockdata.mjs';
import att from './mock-att.mjs';
import apv from './mock-apv.mjs';
import kpi from './mock-kpi.mjs';
import pay from './mock-pay.mjs';
import sch from './mock-sch.mjs';
const T = { ...TABLES };
Object.assign(T, { face_profiles: att.face_profiles, attendance: att.attendance, leave_requests: att.leave_requests });
T.expenses = (apv.expenses || []).map(e => ({ ...e, staff_id: e.staff_id || 'demo-staff' }));
Object.assign(T, { kpi_targets: kpi.kpi_targets, page_daily_reports: kpi.page_daily_reports, partner_surgeries: kpi.partner_surgeries });
T.customer_appointments = [...TABLES.customer_appointments, ...(kpi.customer_appointments || []).filter(a => !TABLES.customer_appointments.some(b => b.id === a.id))];
T.payroll = pay.payroll;
const ids = new Set(TABLES.profiles.map(p => p.id));
T.profiles = [...(pay.profiles || []), ...TABLES.profiles.filter(p => !(pay.profiles || []).some(q => q.id === p.id))];
T.notifications = sch.notifications;
// Data KH: một nửa giao cho chính nhân viên demo (telesale)
T.marketing_data = TABLES.marketing_data.map((r, i) => i % 2 ? r : { ...r, telesale_id: 'demo-staff', telesale: { full_name: 'Trần Mai Anh' } });
// Cộng đồng
const iso = (h) => new Date(Date.now() - h * 3600e3).toISOString();
T.community_groups = [{ id: 'g1', name: 'Phòng khám Dr Tuấn Hùng', description: 'Bảng tin chung toàn phòng khám', created_by: 'demo', created_at: iso(900) }, { id: 'g2', name: 'Nhóm Điều dưỡng', created_by: 'demo', created_at: iso(800) }];
T.community_group_members = [{ group_id: 'g1', user_id: 'demo-staff' }, { group_id: 'g2', user_id: 'demo-staff' }];
T.community_posts = [
  { id: 'p1', group_id: 'g1', author_id: 's1', content: '📣 Lịch đào tạo tư vấn tuần này: thứ 4 lúc 14h tại phòng họp tầng 2. Cả nhà sắp xếp tham gia đầy đủ nhé!', created_at: iso(2), author: { full_name: 'Trần Ngọc Mai' }, images: [] },
  { id: 'p2', group_id: 'g1', author_id: 's5', content: 'Chúc mừng team Sale tháng 9 vượt KPI 120% 🎉🎉 Cảm ơn mọi người đã cố gắng!', created_at: iso(20), author: { full_name: 'Lê Minh Anh' }, images: [] },
];
T.community_comments = [{ id: 'c1', post_id: 'p2', author_id: 'demo-staff', content: 'Tuyệt vời quá ạ 👏', created_at: iso(18), author: { full_name: 'Trần Mai Anh' } }];
T.community_likes = [{ post_id: 'p2', user_id: 's2', reaction: 'love', user: { full_name: 'Phạm Thu Hà' } }, { post_id: 'p2', user_id: 's3', reaction: 'like', user: { full_name: 'Đỗ Quang Huy' } }];
T.community_comment_likes = [];
export default T;
