// ============================================================
// HẰNG SỐ + HÀM TIỆN ÍCH CHO MÀN CÔNG VIỆC (D10)
// Trạng thái / ưu tiên / lặp lại khớp với ràng buộc trong supabase/work_tasks.sql
// ============================================================
import { CircleDot, Clock, ClipboardCheck, CircleCheck, XCircle } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

export const TASK_STATUS = {
  todo: { label: 'Cần làm', tone: 'e-tone-neutral', icon: CircleDot, dot: 'bg-slate-400' },
  in_progress: { label: 'Đang làm', tone: 'e-tone-info', icon: Clock, dot: 'bg-info-500' },
  review: { label: 'Chờ duyệt', tone: 'e-tone-warning', icon: ClipboardCheck, dot: 'bg-warning-500' },
  done: { label: 'Hoàn thành', tone: 'e-tone-success', icon: CircleCheck, dot: 'bg-success-500' },
  cancelled: { label: 'Đã huỷ', tone: 'e-tone-rose', icon: XCircle, dot: 'bg-rose-400' },
};
export const STATUS_ORDER = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
export const BOARD_COLUMNS = ['todo', 'in_progress', 'review', 'done'];
export const OPEN_STATUSES = ['todo', 'in_progress', 'review'];

export const TASK_PRIORITY = {
  low: { label: 'Thấp', tone: 'e-tone-neutral', rank: 0 },
  normal: { label: 'Bình thường', tone: 'e-tone-sky', rank: 1 },
  high: { label: 'Cao', tone: 'e-tone-peach', rank: 2 },
  urgent: { label: 'Khẩn', tone: 'e-tone-danger', rank: 3 },
};

export const RECURRENCE = {
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
};

// Bảng tasks chưa tạo (chưa chạy work_tasks.sql)
export const isMissingTable = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205'
  || /could not find|does not exist|schema cache/i.test(e.message || ''));

export const isOpen = (t) => OPEN_STATUSES.includes(t.status);
export const isOverdue = (t, now = Date.now()) => isOpen(t) && !!t.due_at && new Date(t.due_at).getTime() < now;
export const isDueToday = (t) => isOpen(t) && !!t.due_at && vnToday(new Date(t.due_at)) === vnToday();

// "17:00 · 12/10" (thêm năm nếu khác năm nay) — theo giờ Việt Nam
export const fmtDue = (s) => {
  if (!s) return '';
  const d = new Date(s);
  const [y, m, day] = vnToday(d).split('-');
  const time = new Date(d.getTime() + 7 * 3600000).toISOString().slice(11, 16);
  return `${time} · ${day}/${m}${y === vnToday().slice(0, 4) ? '' : `/${y}`}`;
};
export const fmtDT = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export const timeAgo = (iso) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} ngày trước` : fmtDT(iso);
};

// Còn bao lâu tới hạn / quá hạn bao lâu (chuỗi ngắn cho thẻ)
export const dueHint = (t) => {
  if (!t.due_at || !isOpen(t)) return '';
  const diff = new Date(t.due_at).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.round(abs / 3600000);
  const txt = abs < 3600000 ? `${Math.max(1, Math.round(abs / 60000))} phút` : h < 48 ? `${h} giờ` : `${Math.round(h / 24)} ngày`;
  return diff < 0 ? `Quá hạn ${txt}` : `Còn ${txt}`;
};

export const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

export const hasRole = (profile, ...roles) => !!profile && roles.some(r => profile.role === r || profile.role_2 === r);

// Giá trị cho <input type="date"> / <input type="time"> theo giờ máy (VN)
export const splitLocal = (iso) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};
export const joinLocal = (date, time) => (date ? new Date(`${date}T${time || '17:00'}:00`).toISOString() : null);
