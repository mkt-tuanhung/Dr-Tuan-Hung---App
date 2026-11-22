// ============================================================
// GALA — màn vinh danh (bục Quán quân / Á quân / Hạng ba + bảng xếp hạng)
// Dùng cho tab "Công bố" của Ban tổ chức và kết quả hiện cho giám khảo.
// ============================================================
import React from 'react';
import { Trophy, Medal, Award, Sparkles, Lock } from 'lucide-react';
import { fmtScore, pad2, placementLabel } from './galaUtil';

const PODIUM = {
  1: { ring: 'ring-amber-300', chip: 'bg-amber-100 text-amber-800', icon: Trophy, lift: 'sm:-translate-y-4', order: 'sm:order-2' },
  2: { ring: 'ring-slate-200', chip: 'bg-slate-100 text-slate-700', icon: Medal, lift: '', order: 'sm:order-1' },
  3: { ring: 'ring-orange-200', chip: 'bg-orange-50 text-orange-700', icon: Award, lift: '', order: 'sm:order-3' },
};

export function RankingList({ ranking, showVotes = false }) {
  if (!ranking.length) return <p className="text-sm text-slate-400 py-6 text-center">Chưa có điểm để xếp hạng.</p>;
  return (
    <ol className="divide-y divide-slate-100">
      {ranking.map((r) => (
        <li key={r.performance_id} className="flex items-center gap-3 py-3">
          <span className={`w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold shrink-0 ${
            r.mean_total == null ? 'bg-slate-100 text-slate-400' : r.placement === 1 ? 'bg-amber-100 text-amber-800' : r.placement <= 3 ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
            {r.mean_total == null ? '—' : pad2(r.placement)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-800 truncate">{r.performance_title}</div>
            <div className="text-[12px] text-slate-500 truncate">
              {r.team_name}{showVotes && <> · {r.received}/{r.expected} phiếu</>}
            </div>
          </div>
          <div className="text-[20px] font-bold text-slate-900 tabular-nums">{fmtScore(r.mean_total)}</div>
        </li>
      ))}
    </ol>
  );
}

export default function GalaStage({ event, ranking }) {
  const published = !!event?.published;
  const top = ranking.filter((r) => r.mean_total != null && r.placement <= 3).slice(0, 3);

  return (
    <div className="space-y-4">
      <section className="e-card overflow-hidden">
        <div className="relative bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 text-white px-5 py-8 sm:py-10 text-center">
          <Sparkles className="absolute left-6 top-6 w-5 h-5 text-amber-200/70" />
          <Sparkles className="absolute right-8 bottom-8 w-4 h-4 text-amber-200/60" />
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-teal-100">Dr Tuấn Hùng · Sinh nhật 1 tuổi</div>
          <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight leading-none text-white">
            TOGETHER <span className="text-amber-200">WE SHINE</span>
          </h2>
          <p className="mt-3 text-[12px] font-semibold tracking-[0.14em] uppercase text-teal-50/90">
            {published ? 'Kết quả chính thức' : 'Kết quả sẽ hiện khi Ban tổ chức công bố'}
          </p>
        </div>

        <div className="px-4 py-6 sm:px-6 bg-gradient-to-b from-teal-50/60 to-white">
          {published && top.length ? (
            <div className="grid gap-3 sm:grid-cols-3 sm:items-end max-w-3xl mx-auto">
              {top.map((r) => {
                const st = PODIUM[r.placement] || PODIUM[3];
                const Icon = st.icon;
                return (
                  <div key={r.performance_id}
                    className={`e-card e-card-pad text-center ring-2 ${st.ring} ${st.lift} ${st.order} transition`}>
                    <div className={`mx-auto w-12 h-12 rounded-full grid place-items-center ${st.chip}`}><Icon className="w-6 h-6" /></div>
                    <div className="mt-2 text-[11px] font-bold tracking-[0.14em] uppercase text-amber-700">{placementLabel(r.placement)}</div>
                    <div className="mt-1 font-bold text-slate-900 leading-snug">{r.performance_title}</div>
                    <div className="text-[12px] text-slate-500">{r.team_name}</div>
                    <div className="mt-2 text-2xl font-extrabold text-teal-700 tabular-nums">{fmtScore(r.mean_total)}<span className="text-[12px] font-semibold text-slate-400"> điểm</span></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-white border border-teal-100 grid place-items-center shadow-soft">
                <Lock className="w-7 h-7 text-teal-600" />
              </div>
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
