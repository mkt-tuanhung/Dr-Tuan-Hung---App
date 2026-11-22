// ============================================================
// GALA — màn vinh danh (bục Quán quân / Á quân / Hạng ba + bảng xếp hạng)
// Dùng cho tab "Công bố" của Ban tổ chức và kết quả hiện cho giám khảo.
// Hiệu ứng: ánh đèn sân khấu, bục nhô lên lần lượt Hạng ba → Á quân → Quán quân.
// ============================================================
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, Medal, Award, Lock, Crown } from 'lucide-react';
import { fmtScore, pad2, placementLabel } from './galaUtil';
import { teamPalette } from './galaTheme';
import { StageLights } from './GalaFx.jsx';

const PODIUM = {
  1: { card: 'bg-gradient-to-b from-amber-50 to-white ring-2 ring-amber-300', chip: 'bg-gradient-to-br from-amber-300 to-amber-500 text-white', icon: Trophy, label: 'text-amber-700', order: 'sm:order-2', delay: 1.1, base: 'sm:h-24' },
  2: { card: 'bg-white ring-2 ring-slate-200', chip: 'bg-gradient-to-br from-slate-200 to-slate-400 text-white', icon: Medal, label: 'text-slate-600', order: 'sm:order-1', delay: 0.6, base: 'sm:h-14' },
  3: { card: 'bg-white ring-2 ring-orange-200', chip: 'bg-gradient-to-br from-orange-300 to-orange-500 text-white', icon: Award, label: 'text-orange-700', order: 'sm:order-3', delay: 0.2, base: 'sm:h-8' },
};

export function RankingList({ ranking, showVotes = false }) {
  if (!ranking.length) return <p className="text-sm text-slate-400 py-6 text-center">Chưa có điểm để xếp hạng.</p>;
  return (
    <ol className="divide-y divide-slate-100">
      {ranking.map((r, i) => {
        const pal = teamPalette(r.team_name);
        const pct = r.mean_total == null ? 0 : Math.min(100, Number(r.mean_total));
        return (
          <motion.li key={r.performance_id} layout
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 py-3">
            <span className={`w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold shrink-0 ${
              r.mean_total == null ? 'bg-slate-100 text-slate-400' : r.placement === 1 ? 'bg-amber-100 text-amber-800' : r.placement <= 3 ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
              {r.mean_total == null ? '—' : pad2(r.placement)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800 leading-snug break-words">{r.performance_title}</div>
              <div className="text-[12px] text-slate-500 leading-snug">
                {r.team_name}{showVotes && <> · {r.received}/{r.expected} phiếu</>}
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div className={`h-full rounded-full bg-gradient-to-r ${pal.grad}`}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.06 }} />
              </div>
            </div>
            <div className="text-[20px] font-bold text-slate-900 tabular-nums">{fmtScore(r.mean_total)}</div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function PodiumCard({ r }) {
  const reduce = useReducedMotion();
  const st = PODIUM[r.placement] || PODIUM[3];
  const Icon = st.icon;
  const pal = teamPalette(r.team_name);
  const first = r.placement === 1;
  return (
    <motion.div className={`flex flex-col ${st.order}`}
      initial={reduce ? false : { opacity: 0, y: 60, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduce ? 0 : st.delay, type: 'spring', stiffness: 200, damping: 18 }}>
      <motion.div className={`relative rounded-3xl p-5 text-center shadow-card ${st.card}`}
        animate={first && !reduce ? { boxShadow: ['0 10px 30px -10px rgba(245,158,11,.35)', '0 16px 44px -8px rgba(245,158,11,.65)', '0 10px 30px -10px rgba(245,158,11,.35)'] } : undefined}
        transition={first ? { duration: 2.4, repeat: Infinity } : undefined}>
        {first && (
          <motion.div className="absolute -top-5 left-1/2 -translate-x-1/2 text-amber-500"
            initial={reduce ? false : { y: -20, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: reduce ? 0 : st.delay + 0.35, type: 'spring', stiffness: 400, damping: 10 }}>
            <Crown className="w-9 h-9 fill-amber-300" />
          </motion.div>
        )}
        <motion.div className={`mx-auto w-14 h-14 rounded-2xl grid place-items-center shadow-md ${st.chip}`}
          initial={reduce ? false : { scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: reduce ? 0 : st.delay + 0.15, type: 'spring', stiffness: 420, damping: 12 }}>
          <Icon className="w-7 h-7" />
        </motion.div>
        <div className={`mt-3 text-[12px] font-extrabold tracking-[0.16em] uppercase ${st.label}`}>{placementLabel(r.placement)}</div>
        <div className="mt-1 text-[17px] font-bold text-slate-900 leading-snug">{r.performance_title}</div>
        <span className={`mt-1.5 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold ${pal.soft}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pal.dot}`} />{r.team_name}
        </span>
        <div className={`mt-3 text-[30px] font-black tabular-nums leading-none ${first ? 'text-amber-600' : 'text-teal-700'}`}>
          {fmtScore(r.mean_total)}<span className="text-[13px] font-semibold text-slate-400"> điểm</span>
        </div>
      </motion.div>
      {/* Bục */}
      <div className={`hidden sm:block mt-2 rounded-2xl bg-gradient-to-b ${first ? 'from-amber-200 to-amber-100' : 'from-teal-100 to-teal-50'} ${st.base}`} />
    </motion.div>
  );
}

export default function GalaStage({ event, ranking }) {
  const published = !!event?.published;
  const top = ranking.filter((r) => r.mean_total != null && r.placement <= 3).slice(0, 3);

  return (
    <div className="space-y-4">
      <section className="e-card overflow-hidden">
        <div className="relative bg-gradient-to-br from-teal-800 via-teal-600 to-teal-900 text-white px-5 py-10 sm:py-12 text-center overflow-hidden">
          <StageLights />
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="relative text-[11px] font-semibold tracking-[0.24em] uppercase text-teal-100">Dr Tuấn Hùng · Sinh nhật 1 tuổi</motion.div>
          <motion.h2 initial={{ opacity: 0, scale: 0.92, letterSpacing: '0.2em' }} animate={{ opacity: 1, scale: 1, letterSpacing: '-0.02em' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="relative mt-3 text-[34px] sm:text-6xl font-black leading-none text-white">
            TOGETHER <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">WE SHINE</span>
          </motion.h2>
          <p className="relative mt-4 text-[12px] font-semibold tracking-[0.16em] uppercase text-teal-50/90">
            {published ? 'Kết quả chính thức' : 'Kết quả sẽ hiện khi Ban tổ chức công bố'}
          </p>
        </div>

        <div className="px-4 pt-10 pb-6 sm:px-6 bg-gradient-to-b from-teal-50/70 to-white">
          {published && top.length ? (
            <div className="grid gap-6 sm:gap-4 sm:grid-cols-3 sm:items-end max-w-3xl mx-auto">
              {top.map((r) => <PodiumCard key={r.performance_id} r={r} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-slate-400">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity }}
                className="w-16 h-16 rounded-full bg-white border border-teal-100 grid place-items-center shadow-soft">
                <Lock className="w-7 h-7 text-teal-600" />
              </motion.div>
              <div className="mt-3 text-sm">Bảng vinh danh đang được giữ kín</div>
            </div>
          )}
        </div>
      </section>

      {published && ranking.length > 0 && (
        <section className="e-card e-card-pad">
          <div className="e-card-header"><div className="e-card-title">Bảng xếp hạng đầy đủ</div></div>
          <RankingList ranking={ranking} />
          <p className="text-[12px] text-slate-400 mt-3">Điểm = trung bình phiếu của các giám khảo đang được cấp quyền. Bằng điểm thì đồng hạng.</p>
        </section>
      )}
    </div>
  );
}
