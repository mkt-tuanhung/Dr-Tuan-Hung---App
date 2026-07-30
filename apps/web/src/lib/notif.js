import { Bell, Wallet, MessageCircle, Heart, UserPlus, Clapperboard, Trophy, CheckCircle2 } from 'lucide-react';

// Một số tab đã ĐỔI id khi tách menu Marketing thành dropdown
// ('content' -> 'content_video' / 'content_kho'...). Các thông báo cũ vẫn
// mang link 'content' nên khi bấm sẽ trỏ vào tab không tồn tại và bị reset
// (không mở gì). Chuẩn hoá lại để click thông báo luôn mở đúng module.
const LINK_ALIAS = {
  content: 'content_video',   // clip ads được chấm/duyệt -> mở module Video Ads
};

// Suy ra link mở khi thông báo thiếu link, dựa vào loại.
function fallbackLink(type) {
  if (!type) return null;
  if (type.startsWith('clip_')) return 'content_video';
  return null;
}

// Trả về link hợp lệ để dispatch NAVIGATE. Giữ nguyên phần "#<id>" (nếu có)
// để trang đích focus đúng item; chỉ chuẩn hoá phần tab đứng trước dấu #.
export function resolveNotifLink(link, type) {
  if (!link) return fallbackLink(type);
  const [tab, ...rest] = String(link).split('#');
  const mapped = LINK_ALIAS[tab] || tab;
  return rest.length ? `${mapped}#${rest.join('#')}` : mapped;
}

// Tách "tab#id" -> { tab, focus }
export function parseNav(detail) {
  const [tab, ...rest] = String(detail || '').split('#');
  return { tab, focus: rest.length ? rest.join('#') : null };
}

// ----- Deep focus: nhớ item cần focus khi chuyển trang -----
// (trang đích có thể mount sau khi NAVIGATE bắn ra nên cần "hàng chờ")
let pendingFocus = null;
export function setPendingFocus(f) { pendingFocus = f; }          // { tab, id }
export function takePendingFocus(tab) {
  if (pendingFocus && (!tab || pendingFocus.tab === tab)) {
    const f = pendingFocus;
    pendingFocus = null;
    return f;
  }
  return null;
}

// Icon + màu theo loại thông báo (dùng chung cho chuông & trang Thông báo).
export const NOTIF_ICON = {
  expense_approved: { Icon: Wallet, cls: 'bg-teal-100 text-teal-600' },
  expense_paid: { Icon: Wallet, cls: 'bg-teal-100 text-teal-600' },
  community_post: { Icon: MessageCircle, cls: 'bg-blue-100 text-blue-600' },
  community_comment: { Icon: MessageCircle, cls: 'bg-indigo-100 text-indigo-600' },
  community_reply: { Icon: MessageCircle, cls: 'bg-indigo-100 text-indigo-600' },
  community_like: { Icon: Heart, cls: 'bg-pink-100 text-pink-600' },
  member_added: { Icon: UserPlus, cls: 'bg-violet-100 text-violet-600' },
  // Clip Ads
  clip_scored: { Icon: Trophy, cls: 'bg-amber-100 text-amber-600' },
  clip_approved: { Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-600' },
  clip_reviewed: { Icon: Clapperboard, cls: 'bg-sky-100 text-sky-600' },
  clip_submitted: { Icon: Clapperboard, cls: 'bg-blue-100 text-blue-600' },
};

export const NOTIF_FALLBACK = { Icon: Bell, cls: 'bg-slate-100 text-slate-500' };
