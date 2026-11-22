// ============================================================
// GALA — hiệu ứng: số chạy, vòng điểm, pháo giấy khi nộp phiếu, ánh đèn sân khấu
// Tôn trọng "Giảm chuyển động" của thiết bị (useReducedMotion).
// ============================================================
import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

// Số chạy mượt tới giá trị mới (định dạng vi-VN, 1 chữ số thập phân)
export function AnimatedNumber({ value, className = '' }) {
  const reduce = useReducedMotion();
  const spring = useSpring(Number(value) || 0, { stiffness: 140, damping: 22 });
  useEffect(() => { spring.set(Number(value) || 0); }, [value, spring]);
  const text = useTransform(spring, (v) => (Math.round(v * 2) / 2).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  if (reduce) return <span className={className}>{(Number(value) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

// Vòng tiến độ điểm (SVG) — chạy tới tỉ lệ value/max
export function ScoreRing({ value, max = 100, color = '#0d9488', size = 176, stroke = 12, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / max));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2f2f1" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={color} strokeDasharray={c}
          initial={false} animate={{ strokeDashoffset: c * (1 - ratio), stroke: color }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// Ánh đèn sân khấu quét chậm trên nền tối
export function StageLights() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div className="absolute -top-1/2 left-0 w-2/3 h-[200%] bg-gradient-to-b from-white/25 via-white/5 to-transparent blur-2xl"
        style={{ rotate: 18 }}
        animate={{ x: ['-40%', '140%'] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }} />
      {[...Array(10)].map((_, i) => (
        <motion.span key={i} className="absolute w-1 h-1 rounded-full bg-amber-100"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.4, 0.6] }}
          transition={{ duration: 2.4 + (i % 4) * 0.6, repeat: Infinity, delay: i * 0.35 }} />
      ))}
    </div>
  );
}

// Pháo giấy + dấu tích khi nộp phiếu thành công
const CONFETTI_COLORS = ['#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#fde68a'];
export function Celebration({ show, title, subtitle }) {
  const reduce = useReducedMotion();
  const bits = useMemo(() => [...Array(36)].map((_, i) => ({
    x: (Math.cos((i / 36) * Math.PI * 2) * (120 + (i % 5) * 28)),
    y: (Math.sin((i / 36) * Math.PI * 2) * (120 + (i % 7) * 22)) - 40,
    r: (i * 47) % 360,
    c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: i % 3 === 0 ? 10 : 7,
  })), []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-teal-950/20 backdrop-blur-[2px]" />
          {!reduce && bits.map((b, i) => (
            <motion.span key={i} className="absolute rounded-sm" style={{ width: b.w, height: b.w * 0.5, background: b.c }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
              animate={{ x: b.x, y: [0, b.y, b.y + 160], opacity: [1, 1, 0], rotate: b.r * 3, scale: 1 }}
              transition={{ duration: 1.5, ease: 'easeOut' }} />
          ))}
          <motion.div className="relative bg-white rounded-3xl shadow-float px-8 py-6 text-center"
            initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
            <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.1 }}
              className="mx-auto w-16 h-16 rounded-full bg-teal-500 text-white grid place-items-center shadow-lg shadow-teal-500/40">
              <CheckCircle2 className="w-9 h-9" />
            </motion.div>
            <div className="mt-3 text-lg font-bold text-slate-900">{title}</div>
            {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
