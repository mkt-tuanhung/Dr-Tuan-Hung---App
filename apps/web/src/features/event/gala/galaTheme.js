// ============================================================
// GALA — màu theo đội + icon theo thể loại + xếp loại điểm
// (chuỗi class Tailwind để nguyên văn để JIT nhận diện)
// ============================================================
import { Drama, Footprints, Music2, Sparkles, Guitar } from 'lucide-react';
import { norm } from './galaUtil';

// Mỗi đội 1 bảng màu cố định (băm theo tên đội) — teal luôn là màu chủ đạo của app
export const TEAM_PALETTES = [
  { grad: 'from-teal-500 via-teal-600 to-emerald-700', soft: 'bg-teal-50 text-teal-800', ring: 'ring-teal-400', glow: 'shadow-teal-500/40', dot: 'bg-teal-500', hex: '#0d9488' },
  { grad: 'from-rose-400 via-rose-500 to-pink-600', soft: 'bg-rose-50 text-rose-700', ring: 'ring-rose-400', glow: 'shadow-rose-500/40', dot: 'bg-rose-500', hex: '#f43f5e' },
  { grad: 'from-amber-400 via-orange-400 to-orange-600', soft: 'bg-amber-50 text-amber-800', ring: 'ring-amber-400', glow: 'shadow-orange-500/40', dot: 'bg-amber-500', hex: '#f59e0b' },
  { grad: 'from-violet-500 via-purple-500 to-indigo-600', soft: 'bg-violet-50 text-violet-700', ring: 'ring-violet-400', glow: 'shadow-violet-500/40', dot: 'bg-violet-500', hex: '#8b5cf6' },
  { grad: 'from-sky-400 via-sky-500 to-blue-600', soft: 'bg-sky-50 text-sky-700', ring: 'ring-sky-400', glow: 'shadow-sky-500/40', dot: 'bg-sky-500', hex: '#0ea5e9' },
];

const hash = (s) => [...norm(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const teamPalette = (team) => TEAM_PALETTES[hash(team) % TEAM_PALETTES.length];

// Thể loại -> icon + nhãn (đoán từ tên / mô tả tiết mục)
export function genreOf(p) {
  const t = norm(`${p?.title || ''} ${p?.description || ''}`);
  if (/kich|tieu pham|dien/.test(t)) return { icon: Drama, label: /nhac kich/.test(t) ? 'Nhạc kịch' : 'Kịch' };
  if (/nhay|mua|dance|vu dao/.test(t)) return { icon: Footprints, label: 'Nhảy' };
  if (/hat|song ca|ca khuc|nhac/.test(t)) return { icon: Music2, label: 'Hát' };
  if (/guitar|dan|nhac cu/.test(t)) return { icon: Guitar, label: 'Nhạc cụ' };
  return { icon: Sparkles, label: 'Biểu diễn' };
}

// Xếp loại theo tổng điểm
export function gradeOf(total) {
  if (total >= 90) return { label: 'Xuất sắc', cls: 'text-amber-600', stroke: '#f59e0b' };
  if (total >= 80) return { label: 'Rất tốt', cls: 'text-teal-700', stroke: '#0d9488' };
  if (total >= 70) return { label: 'Tốt', cls: 'text-teal-600', stroke: '#14b8a6' };
  if (total >= 50) return { label: 'Khá', cls: 'text-sky-600', stroke: '#0ea5e9' };
  if (total > 0) return { label: 'Cần cố gắng', cls: 'text-slate-500', stroke: '#94a3b8' };
  return { label: 'Chưa chấm', cls: 'text-slate-400', stroke: '#cbd5e1' };
}

// Màu thanh trượt theo tỉ lệ điểm của 1 tiêu chí
export const ratioColor = (r) => (r >= 0.85 ? '#f59e0b' : r >= 0.6 ? '#0d9488' : r >= 0.35 ? '#14b8a6' : '#94a3b8');
