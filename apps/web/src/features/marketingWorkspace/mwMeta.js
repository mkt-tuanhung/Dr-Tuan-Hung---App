// ============================================================
// MARKETING WORKSPACE — hằng số / nhãn / hàm tiện ích dùng chung.
// Giá trị khớp ràng buộc check trong supabase/marketing_workspace_v1.sql.
// ============================================================
import { vnToday } from '@/lib/vnTime';

export const MW_TAB = 'mkt_workspace';

export const isAdminProfile = (p) => p?.role === 'admin' || p?.role_2 === 'admin';
export const hasRole = (p, r) => p?.role === r || p?.role_2 === r;

// Vai trò trong workspace
export const WS_ROLES = {
  owner: { label: 'Chủ workspace', tone: 'e-tone-brand' },
  manager: { label: 'Quản lý', tone: 'e-tone-info' },
  editor: { label: 'Thực hiện', tone: 'e-tone-success' },
  viewer: { label: 'Chỉ xem', tone: 'e-tone-neutral' },
};
// Quyền hiệu lực ở giao diện (DB vẫn kiểm tra lại mọi thao tác)
export const wsPerm = (profile, ws, myRole) => {
  const admin = isAdminProfile(profile);
  const role = ws?.owner_id === profile?.id ? 'owner' : (admin ? 'admin' : myRole || null);
  return {
    role,
    view: !!role,
    edit: ['owner', 'admin', 'manager', 'editor'].includes(role),
    manage: ['owner', 'admin', 'manager'].includes(role),
  };
};

export const PRIORITY = {
  low: { label: 'Thấp', tone: 'e-tone-neutral', rank: 0 },
  normal: { label: 'Bình thường', tone: 'e-tone-sky', rank: 1 },
  high: { label: 'Cao', tone: 'e-tone-peach', rank: 2 },
  urgent: { label: 'Khẩn', tone: 'e-tone-danger', rank: 3 },
};

export const BOARD_TEMPLATES = [
  { id: 'video', label: 'Sản xuất video', desc: '12 cột: Ý tưởng → Kịch bản → Quay → Dựng → Duyệt → Đăng → Đo hiệu quả' },
  { id: 'design', label: 'Thiết kế', desc: 'Brief → Thiết kế → Review → Final' },
  { id: 'campaign', label: 'Chiến dịch', desc: 'Kế hoạch → Sản xuất → Chạy → Báo cáo' },
  { id: 'seo', label: 'SEO / Bài viết', desc: 'Dàn ý → Viết → Kiểm chứng y khoa → Đăng' },
  { id: 'ads', label: 'Quảng cáo', desc: 'Đề xuất → Pháp lý → Ngân sách → Creative → Chạy' },
  { id: 'event', label: 'Sự kiện', desc: 'Đề xuất → Kế hoạch → Hậu cần → Tổng kết' },
  { id: 'blank', label: 'Trống', desc: 'Cần làm / Đang làm / Chờ duyệt / Hoàn thành' },
];

export const LABEL_COLORS = ['#087F83', '#3CA7A9', '#5B8DD6', '#8B7BD8', '#E9A34B', '#E2725B', '#D9467A', '#64748B'];

export const CONTENT_TYPES = {
  short_video: 'Video ngắn', long_video: 'Video dài', image: 'Ảnh', carousel: 'Carousel',
  article: 'Bài viết', livestream: 'Livestream', other: 'Khác',
};
export const PLATFORMS = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  zalo: 'Zalo', website: 'Website', other: 'Khác',
};
// Trạng thái nội dung: người làm tự đổi các bước sản xuất; trạng thái duyệt/đăng chỉ do RPC đặt
export const CONTENT_STATUS = {
  idea: { label: 'Ý tưởng', tone: 'e-tone-neutral' },
  brief: { label: 'Brief', tone: 'e-tone-neutral' },
  scripting: { label: 'Viết kịch bản', tone: 'e-tone-sky' },
  production: { label: 'Sản xuất', tone: 'e-tone-sky' },
  editing: { label: 'Dựng / chỉnh sửa', tone: 'e-tone-sky' },
  in_review: { label: 'Đang duyệt', tone: 'e-tone-warning' },
  revision_required: { label: 'Cần sửa', tone: 'e-tone-peach' },
  rejected: { label: 'Bị từ chối', tone: 'e-tone-danger' },
  approved: { label: 'Đã duyệt', tone: 'e-tone-success' },
  published: { label: 'Đã đăng', tone: 'e-tone-brand' },
  archived: { label: 'Lưu trữ', tone: 'e-tone-neutral' },
};
export const EDITABLE_STATUSES = ['idea', 'brief', 'scripting', 'production', 'editing'];
export const VERSION_KIND = { script: 'Kịch bản', asset: 'Tệp media', caption: 'Caption' };

export const STEP_KIND = {
  medical: 'Chuyên môn y khoa',
  marketing: 'Marketing / thương hiệu',
  compliance: 'Pháp lý & consent',
};
export const REVIEWER_KIND = { ...STEP_KIND, publisher: 'Người đăng bài' };
export const STEP_STATE = {
  waiting: { label: 'Chờ bước trước', tone: 'e-tone-neutral' },
  pending: { label: 'Chờ duyệt', tone: 'e-tone-warning' },
  approved: { label: 'Đã duyệt', tone: 'e-tone-success' },
  rejected: { label: 'Từ chối', tone: 'e-tone-danger' },
  revision_requested: { label: 'Yêu cầu sửa', tone: 'e-tone-peach' },
  invalidated: { label: 'Mất hiệu lực', tone: 'e-tone-rose' },
  cancelled: { label: 'Đã huỷ', tone: 'e-tone-neutral' },
};
export const RUN_STATE = {
  pending: { label: 'Đang duyệt', tone: 'e-tone-warning' },
  approved: { label: 'Đã duyệt đủ', tone: 'e-tone-success' },
  rejected: { label: 'Từ chối', tone: 'e-tone-danger' },
  revision_requested: { label: 'Yêu cầu sửa', tone: 'e-tone-peach' },
  invalidated: { label: 'Mất hiệu lực (đổi phiên bản)', tone: 'e-tone-rose' },
  cancelled: { label: 'Đã huỷ', tone: 'e-tone-neutral' },
};
export const PUB_STATE = {
  draft: { label: 'Nháp', tone: 'e-tone-neutral' },
  scheduled: { label: 'Chờ đăng thủ công', tone: 'e-tone-info' },
  pending_verification: { label: 'Chờ xác minh link', tone: 'e-tone-warning' },
  published: { label: 'Đã đăng (đã xác minh)', tone: 'e-tone-success' },
  blocked: { label: 'Bị chặn', tone: 'e-tone-danger' },
  cancelled: { label: 'Đã huỷ', tone: 'e-tone-neutral' },
};
export const PUB_ORDER = ['draft', 'blocked', 'scheduled', 'pending_verification', 'published', 'cancelled'];

export const CAMPAIGN_STATUS = {
  planning: { label: 'Lên kế hoạch', tone: 'e-tone-neutral' },
  running: { label: 'Đang chạy', tone: 'e-tone-success' },
  paused: { label: 'Tạm dừng', tone: 'e-tone-warning' },
  done: { label: 'Hoàn tất', tone: 'e-tone-brand' },
  archived: { label: 'Lưu trữ', tone: 'e-tone-neutral' },
};

// Tệp đính kèm / media: giới hạn ở trình duyệt (DB lưu URL https + sha256)
export const MAX_UPLOAD_MB = 500;
export const ALLOWED_MIME = /^(image\/|video\/|audio\/|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument|vnd\.ms-excel|vnd\.ms-powerpoint))/;

// ---------- Thời gian (giờ Việt Nam) ----------
const VN = 7 * 3600000;
export const vnDateOf = (iso) => (iso ? vnToday(new Date(iso)) : null);   // 'YYYY-MM-DD'
export const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = vnDateOf(iso).split('-'); return `${d}/${m}${y === vnToday().slice(0, 4) ? '' : `/${y}`}`; };
export const fmtDateTime = (iso) => (iso ? `${new Date(new Date(iso).getTime() + VN).toISOString().slice(11, 16)} · ${fmtDate(iso)}` : '');
// <input type="datetime-local"> <-> ISO (giờ VN)
export const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + VN).toISOString().slice(0, 16) : '');
export const fromLocalInput = (v) => (v ? new Date(`${v}:00+07:00`).toISOString() : null);
// Đổi NGÀY nhưng giữ giờ cũ (mặc định 17:00 nếu chưa có giờ)
export const moveToDate = (iso, ymd) => {
  const time = iso ? new Date(new Date(iso).getTime() + VN).toISOString().slice(11, 16) : '17:00';
  return new Date(`${ymd}T${time}:00+07:00`).toISOString();
};
export const timeAgo = (iso) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} ngày trước` : fmtDate(iso);
};
export const isLate = (t, doneListIds) => !!t.due_at && !t.completed_at && !doneListIds?.has?.(t.list_id) && new Date(t.due_at).getTime() < Date.now();

// Bỏ phần trong ngoặc + ký tự không phải chữ: "Minh Dũng (MKT Lead)" -> "MD"
export const initials = (name) => {
  const w = (name || '').replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(x => /^\p{L}/u.test(x));
  return (w.length ? w.slice(-2).map(x => x[0]).join('') : '?').toUpperCase();
};
export const fmtBytes = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// Sắp xếp tăng dần theo sort_index (numeric từ DB về dạng string/number)
export const bySort = (a, b) => Number(a.sort_index) - Number(b.sort_index);

// Mô tả 1 dòng nhật ký (bảng mw_activity: entity + action + detail)
const FIELD_LABEL = { title: 'tiêu đề', description: 'mô tả', priority: 'ưu tiên', start_at: 'ngày bắt đầu', due_at: 'hạn', cover_color: 'màu bìa', estimate_hours: 'ước lượng giờ' };
export function describeActivity(a, nameOf = () => '') {
  const d = a.detail || {};
  const k = `${a.entity}.${a.action}`;
  switch (k) {
    case 'task.created': return `tạo thẻ “${d.title || ''}”`;
    case 'task.moved': return `chuyển thẻ từ “${d.from || '?'}” sang “${d.to || '?'}”`;
    case 'task.archived': return 'lưu trữ thẻ';
    case 'task.restored': return 'khôi phục thẻ';
    case 'task.updated': return `sửa ${(d.fields || []).map(f => FIELD_LABEL[f] || f).join(', ')}${d.due_at ? ` → ${fmtDateTime(d.due_at)}` : ''}`;
    case 'assignee.added': return `giao việc cho ${nameOf(a.entity_id)}`;
    case 'assignee.removed': return `bỏ giao ${nameOf(a.entity_id)}`;
    case 'label.added': return 'gắn nhãn';
    case 'label.removed': return 'gỡ nhãn';
    case 'checklist.added': return `thêm mục checklist “${d.title || ''}”`;
    case 'checklist.checked': return `hoàn thành “${d.title || ''}”`;
    case 'checklist.unchecked': return `bỏ hoàn thành “${d.title || ''}”`;
    case 'checklist.updated': return `sửa mục checklist “${d.title || ''}”`;
    case 'comment.created': return 'bình luận';
    case 'comment.edited': return 'sửa bình luận';
    case 'comment.deleted': return 'xoá bình luận';
    case 'attachment.added': return `đính kèm “${d.name || ''}”`;
    case 'attachment.removed': return `gỡ tệp “${d.name || ''}”`;
    case 'workspace.created': return `tạo workspace “${d.name || ''}”`;
    case 'board.created': return `tạo board “${d.name || ''}”`;
    case 'member.insert': return `thêm thành viên ${nameOf(a.entity_id)} (${WS_ROLES[d.role]?.label || d.role})`;
    case 'member.update': return `đổi vai trò ${nameOf(a.entity_id)}: ${WS_ROLES[d.old_role]?.label || d.old_role} → ${WS_ROLES[d.role]?.label || d.role}`;
    case 'member.delete': return `gỡ thành viên ${nameOf(a.entity_id)}`;
    case 'content_version.created': return `thêm ${VERSION_KIND[d.kind] || d.kind} v${d.revision}${d.invalidated_runs ? ' — duyệt cũ mất hiệu lực' : ''}`;
    case 'consent.created': return 'thêm hồ sơ consent';
    case 'consent.revoked': return 'thu hồi consent';
    case 'consent.verified': return 'xác minh consent';
    case 'consent.updated': return 'cập nhật consent';
    case 'approval.submitted': return 'gửi duyệt nội dung';
    case 'approval_step.approve': return `duyệt bước ${STEP_KIND[d.kind] || d.kind}`;
    case 'approval_step.revision': return `yêu cầu sửa (${STEP_KIND[d.kind] || d.kind}): ${d.note || ''}`;
    case 'approval_step.reject': return `từ chối (${STEP_KIND[d.kind] || d.kind}): ${d.note || ''}`;
    case 'publication.scheduled': return `lên lịch đăng thủ công ${fmtDateTime(d.at)}`;
    case 'publication.blocked': return `chặn đăng: ${d.reason || ''}`;
    case 'publication.proof_submitted': return 'nộp link bằng chứng đã đăng';
    case 'publication.verified': return 'xác minh bài đã đăng';
    case 'publication.verification_failed': return `xác minh không đạt: ${d.note || ''}`;
    case 'publication.cancelled': return 'huỷ bài đăng';
    default: return `${a.entity} · ${a.action}`;
  }
}
