// ============================================================
// GALA (chấm điểm văn nghệ) — hàm tiện ích dùng chung
// Bảng / RPC: supabase/event_gala_van_nghe.sql
// ============================================================

export const fmtScore = (n) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const pad2 = (n) => String(n ?? 0).padStart(2, '0');

export const readError = (err) => err?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.';

// Lỗi "chưa chạy SQL" (bảng / hàm chưa tồn tại)
export const isMissingSchema = (err) =>
  /relation .* does not exist|does not exist|schema cache|Could not find the function/i.test(err?.message || '');

// Trạng thái chương trình -> nhãn + tông màu (lớp e-tone-* của app)
export const phaseInfo = (ev) => {
  if (!ev) return { label: 'Đang tải', tone: 'e-tone-neutral' };
  if (ev.published) return { label: 'Đã công bố', tone: 'e-tone-warning' };
  return {
    draft:   { label: 'Chưa mở chấm', tone: 'e-tone-neutral' },
    scoring: { label: 'Đang chấm',    tone: 'e-tone-success' },
    paused:  { label: 'Tạm dừng',     tone: 'e-tone-peach' },
    closed:  { label: 'Đã khoá chấm', tone: 'e-tone-info' },
  }[ev.phase] || { label: ev.phase, tone: 'e-tone-neutral' };
};

export const placementLabel = (p) => (p === 1 ? 'Quán quân' : p === 2 ? 'Á quân' : p === 3 ? 'Hạng ba' : `Hạng ${p}`);

export const TEAM_SUGGESTIONS = ['Điều dưỡng', 'Bác sĩ', 'Sale', 'Telesale', 'CSKH', 'Marketing', 'Media', 'Kế toán'];

export const DEFAULT_EVENT_TITLE = 'Thi Văn Nghệ mừng sinh nhật 1 tuổi Dr Tuấn Hùng';

// Bỏ dấu tiếng Việt để tìm tên không cần gõ dấu
export const norm = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'GK';
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
};

// Bước 0,5 điểm, trong [0, max]
export const validPoint = (n, max) =>
  Number.isFinite(n) && n >= 0 && n <= Number(max) && Math.round(n * 2) === n * 2;

// Xuất CSV (BOM UTF-8, chặn công thức Excel ở đầu ô)
export function exportScoresCsv({ eventTitle, scores, performances, criteria, nameOf }) {
  const esc = (v) => `"${String(v ?? '').replace(/^([=+\-@\t\r])/, "'$1").replaceAll('"', '""')}"`;
  const rows = [['Tiết mục', 'Đội', 'Giám khảo', ...criteria.map((c) => `${c.label} (/${Number(c.max_points)})`), 'Tổng', 'Nhận xét', 'Thời gian gửi', 'Sửa lần cuối']];
  const perfOrder = new Map(performances.map((p, i) => [p.id, i]));
  [...scores]
    .sort((a, b) => (perfOrder.get(a.performance_id) ?? 0) - (perfOrder.get(b.performance_id) ?? 0))
    .forEach((s) => {
      const p = performances.find((x) => x.id === s.performance_id);
      rows.push([
        p?.title, p?.team_name, nameOf(s.judge_id),
        ...criteria.map((c) => s.values_by_criterion?.[c.id]),
        s.total, s.note,
        s.submitted_at ? new Date(s.submitted_at).toLocaleString('vi-VN') : '',
        s.revised_at ? new Date(s.revised_at).toLocaleString('vi-VN') : '',
      ]);
    });
  const body = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `diem-thi-van-nghe-${norm(eventTitle).replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'gala'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
