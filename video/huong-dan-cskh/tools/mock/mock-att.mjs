// Dữ liệu giả cho màn Chấm công (staff 'demo-staff'). Hàng đầu tiên = bản ghi "hôm nay".
const today = new Date();
const ds = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const S = 'demo-staff';
const att = [
  { id: 'a0', staff_id: S, date: ds(0), check_in: '08:02:11', check_out: process.env.ATT_OUT ? '17:35:00' : null, status: 'present', check_in_method: 'face_ai', location_status: 'in_office' },
  { id: 'a1', staff_id: S, date: ds(-1), check_in: '07:56:00', check_out: '17:31:00', status: 'present', check_in_method: 'face_ai', overtime_hours: 2, overtime_ranges: [{ from: '18:00', to: '20:00', hours: 2 }] },
  { id: 'a2', staff_id: S, date: ds(-2), check_in: '09:12:00', check_out: '18:05:00', status: 'late', check_in_method: 'face_ai' },
  { id: 'a3', staff_id: S, date: ds(-3), check_in: '08:01:00', check_out: '17:30:00', status: 'present' },
  { id: 'a4', staff_id: S, date: ds(-4), check_in: '07:58:00', check_out: '12:00:00', status: 'half_day' },
  { id: 'a5', staff_id: S, date: ds(-5), check_in: null, check_out: null, status: 'leave' },
  { id: 'a6', staff_id: S, date: ds(-6), check_in: '08:05:00', check_out: '17:40:00', status: 'present', overtime_hours: 3.5, overtime_ranges: [{ from: '06:30', to: '08:00', hours: 1.5 }, { from: '19:00', to: '21:00', hours: 2 }] },
  { id: 'a7', staff_id: S, date: ds(-7), check_in: null, check_out: null, status: 'absent' },
  { id: 'a8', staff_id: S, date: ds(-8), check_in: '09:20:00', check_out: '17:30:00', status: 'late', check_in_method: 'face_ai' },
];
const leaves = [
  { id: 'l1', staff_id: S, type: 'leave', date: ds(3), reason: 'Việc gia đình ở quê', status: 'pending', created_at: new Date().toISOString() },
  { id: 'l2', staff_id: S, type: 'late', date: ds(-2), reason: 'Kẹt xe đường Nguyễn Trãi', status: 'approved', created_at: new Date().toISOString() },
  { id: 'l3', staff_id: S, type: 'half_day', date: ds(-4), reason: 'Đi khám răng buổi chiều', status: 'approved', created_at: new Date().toISOString() },
  { id: 'l4', staff_id: S, type: 'early', date: ds(-9), reason: 'Đón con', status: 'rejected', created_at: new Date().toISOString() },
];
export default {
  face_profiles: process.env.NOFACE ? [] : [{ user_id: S, status: 'ACTIVE', quality_score: 0.95, sample_count: 5 }],
  attendance: process.env.ATT_NONE ? [] : att,
  leave_requests: leaves,
};
