// ============================================================
// MODULE EVENT — danh sách sự kiện nội bộ
// Mỗi event = 1 mục con trong menu "Event" (id trùng với id menu).
// Thêm event mới: thêm 1 dòng ở đây + 1 mục menu (AdminDashboard MENU_GROUPS,
// permissions/menuConfig FULL_MENU + STAFF_GROUPS) + 1 case render trong 2 dashboard.
// ============================================================
import { Music2 } from 'lucide-react';

export const EVENTS = [
  {
    id: 'event_van_nghe',
    title: 'Thi Văn Nghệ Mừng Sinh Nhật Dr Tuấn Hùng',
    shortTitle: 'Thi Văn Nghệ',
    description: 'Gala văn nghệ mừng sinh nhật 1 tuổi Dr Tuấn Hùng — giám khảo chấm điểm từng tiết mục ngay trên app.',
    icon: Music2,
    status: 'preparing', // preparing | open | ended
  },
];

export const EVENT_STATUS = {
  preparing: { label: 'Đang chuẩn bị', cls: 'bg-amber-50 text-amber-700' },
  open:      { label: 'Đang diễn ra',  cls: 'bg-teal-50 text-teal-700' },
  ended:     { label: 'Đã kết thúc',   cls: 'bg-slate-100 text-slate-500' },
};
