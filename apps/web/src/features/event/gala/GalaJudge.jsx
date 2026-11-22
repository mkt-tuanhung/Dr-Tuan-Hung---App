// ============================================================
// GALA — màn GIÁM KHẢO
// Thẻ tiết mục nổi bật (màu theo đội) → "sân khấu" tiết mục đang chấm →
// chấm từng tiêu chí (bước 0,5) → vòng tổng điểm → gửi phiếu (pháo giấy) → tự sang tiết mục kế.
// Chỉ thấy phiếu của chính mình; sửa được tới khi Ban tổ chức khoá chấm.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Check, Clock, Lock, Mic2, Send, UserPlus, Minus, Plus, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ds';
import GalaStage from './GalaStage.jsx';
import { AnimatedNumber, Celebration, ScoreRing, StageLights } from './GalaFx.jsx';
import { fmtScore, pad2, validPoint } from './galaUtil';
import { genreOf, gradeOf, ratioColor, teamPalette } from './galaTheme';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, type: 'spring', stiffness: 260, damping: 24 } }),
};

// ---------- Thẻ tiết mục ----------
function PerformanceCard({ p, index, active, done, myTotal, onClick }) {
  const pal = teamPalette(p.team_name);
  const genre = genreOf(p);
  const GenreIcon = genre.icon;
  return (
    <motion.button type="button" onClick={onClick} layout
      variants={fadeUp} custom={index} initial="hidden" animate="show"
      whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
      ref={active ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }) : undefined}
      className={`relative snap-start shrink-0 w-[230px] sm:w-auto text-left rounded-3xl bg-white overflow-hidden border transition-shadow ${
        active ? `border-transparent shadow-xl ${pal.glow}` : 'border-slate-200/80 shadow-card'}`}>
      {/* Đầu thẻ: gradient màu đội + số thứ tự lớn */}
      <div className={`relative h-[92px] bg-gradient-to-br ${pal.grad} text-white px-4 pt-3`}>
        <div className="absolute -right-2 -bottom-6 text-[88px] font-black leading-none text-white/15 select-none">{pad2(p.order_no)}</div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/20 backdrop-blur text-[12px] font-semibold">
            <GenreIcon className="w-3.5 h-3.5" /> {genre.label}
          </span>
          {done ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="w-7 h-7 rounded-full bg-white text-teal-600 grid place-items-center shadow">
              <Check className="w-4 h-4" strokeWidth={3} />
            </motion.span>
          ) : active ? (
            <span className="relative flex w-3 h-3">
              <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex w-3 h-3 rounded-full bg-white" />
            </span>
          ) : null}
        </div>
        <div className="absolute left-4 bottom-2.5 text-[13px] font-bold tracking-[0.16em] text-white/90">TIẾT MỤC {pad2(p.order_no)}</div>
      </div>
      {/* Thân thẻ */}
      <div className="px-4 py-3">
        <div className="font-bold text-[15px] text-slate-900 leading-snug line-clamp-2 min-h-[40px]">{p.title}</div>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] font-semibold ${pal.soft}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pal.dot}`} />{p.team_name}
          </span>
          {p.duration_minutes ? <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500"><Clock className="w-3.5 h-3.5" />{p.duration_minutes}′</span> : null}
        </div>
        <div className="mt-2 h-6 flex items-center">
          {done
            ? <span className="text-[12px] font-semibold text-teal-700">Đã chấm · {fmtScore(myTotal)} điểm</span>
            : <span className="text-[12px] text-slate-400">{active ? 'Đang chấm…' : 'Chưa chấm'}</span>}
        </div>
      </div>
      {/* Viền sáng chạy theo thẻ đang chọn */}
      {active && <motion.div layoutId="gala-active-ring" className={`absolute inset-0 rounded-3xl ring-[3px] ${pal.ring} pointer-events-none`}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
    </motion.button>
  );
}

// ---------- 1 tiêu chí ----------
function CriterionRow({ c, index, raw, disabled, onChange }) {
  const max = Number(c.max_points);
  const val = Number(raw) || 0;
  const ratio = max ? val / max : 0;
  const color = ratioColor(ratio);
  const step = (d) => onChange(Math.max(0, Math.min(max, Math.round((val + d) * 2) / 2)));
  return (
    <motion.div variants={fadeUp} custom={index} initial="hidden" animate="show"
      className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 grid place-items-center text-[12px] font-bold shrink-0">{pad2(index + 1)}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 leading-snug">{c.label}</div>
          {c.description && <div className="text-[12px] text-slate-500 leading-snug mt-0.5">{c.description}</div>}
        </div>
        <div className="text-right shrink-0">
          <motion.div key={val} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: val ? color : '#94a3b8' }}>
            {fmtScore(val)}
          </motion.div>
          <div className="text-[11px] text-slate-400 mt-0.5">/ {max}</div>
        </div>
      </div>

      {/* Thanh điểm màu theo mức + nút ± cho thao tác chính xác trên điện thoại */}
      <div className="mt-3 flex items-center gap-2.5">
        <button type="button" aria-label={`Giảm ${c.label}`} disabled={disabled || val <= 0} onClick={() => step(-0.5)}
          className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-600 active:scale-95 transition disabled:opacity-40"><Minus className="w-4 h-4" /></button>
        <div className="relative flex-1 h-9 flex items-center">
          <div className="absolute inset-x-0 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div className="h-full rounded-full" initial={false}
              animate={{ width: `${ratio * 100}%`, backgroundColor: color }} transition={{ type: 'spring', stiffness: 200, damping: 26 }} />
          </div>
          <input type="range" min="0" max={max} step="0.5" value={val} disabled={disabled}
            aria-label={`Thanh điểm ${c.label}`}
            onChange={(e) => onChange(Number(e.target.value))}
            className="relative w-full appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-teal-600 [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-teal-600" />
        </div>
        <button type="button" aria-label={`Tăng ${c.label}`} disabled={disabled || val >= max} onClick={() => step(0.5)}
          className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-600 active:scale-95 transition disabled:opacity-40"><Plus className="w-4 h-4" /></button>
        <input type="number" inputMode="decimal" min="0" max={max} step="0.5" disabled={disabled}
          aria-label={`Điểm ${c.label}`} value={raw}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-16 h-9 rounded-xl border border-slate-200 text-center text-[15px] font-bold text-slate-900 tabular-nums outline-none focus:border-teal-400 disabled:bg-slate-50" />
      </div>
    </motion.div>
  );
}

export default function GalaJudge({ g, userId, onJoin }) {
  const { selectedEvent, performances, criteria, judges, scores, ranking, working, actions } = g;
  const reduce = useReducedMotion();
  const isJudge = judges.some((j) => j.user_id === userId && j.active);
  const ownScores = useMemo(() => scores.filter((s) => s.judge_id === userId), [scores, userId]);
  const [perfId, setPerfId] = useState(null);
  const [draft, setDraft] = useState({});
  const [note, setNote] = useState('');
  const [celebrate, setCelebrate] = useState(null);

  const canScore = selectedEvent?.phase === 'scoring' && !selectedEvent?.published;
  const current = performances.find((p) => p.id === perfId) || null;
  const currentIdx = performances.findIndex((p) => p.id === perfId);
  const currentScore = ownScores.find((s) => s.performance_id === perfId) || null;

  // Chọn tiết mục đầu tiên chưa chấm khi mới vào / đổi chương trình
  useEffect(() => {
    if (performances.some((p) => p.id === perfId)) return;
    const firstOpen = performances.find((p) => !ownScores.some((s) => s.performance_id === p.id));
    setPerfId((firstOpen || performances[0])?.id || null);
  }, [performances, ownScores, perfId]);

  // Nạp phiếu đã nộp (nếu có) khi đổi tiết mục hoặc khi phiếu vừa được lưu
  const scoreKey = `${perfId}|${currentScore?.id || ''}|${currentScore?.revised_at || ''}`;
  useEffect(() => {
    setDraft(currentScore?.values_by_criterion || {});
    setNote(currentScore?.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreKey]);

  const total = criteria.reduce((sum, c) => sum + (Number(draft[c.id]) || 0), 0);
  const grade = gradeOf(total);
  const doneCount = ownScores.length;
  const pal = teamPalette(current?.team_name);
  const genre = genreOf(current);
  const GenreIcon = genre.icon;

  const submit = async () => {
    const values = {};
    for (const c of criteria) {
      const n = Number(draft[c.id] ?? 0);
      if (!validPoint(n, c.max_points)) {
        toast.error(`"${c.label}": điểm từ 0 đến ${Number(c.max_points)}, bước 0,5.`);
        return;
      }
      values[c.id] = n;
    }
    const sent = total;
    const title = current?.title;
    const ok = await actions.submitScore(perfId, values, note, { silent: true });
    if (ok) {
      setCelebrate({ title: `Đã gửi ${fmtScore(sent)} điểm`, subtitle: title });
      setTimeout(() => setCelebrate(null), reduce ? 900 : 1700);
      const next = performances.find((p) => p.id !== perfId && !ownScores.some((s) => s.performance_id === p.id));
      if (next) setTimeout(() => setPerfId(next.id), reduce ? 300 : 900);
    }
  };

  if (!isJudge) {
    return (
      <div className="e-card">
        <EmptyState icon={Lock} title="Chưa được cấp quyền chấm thi"
          description={onJoin
            ? 'Bạn chưa có trong ban giám khảo của chương trình này. Thêm chính mình để chấm điểm như các giám khảo khác.'
            : 'Tài khoản của bạn chưa được Ban tổ chức chỉ định làm giám khảo của chương trình này.'}
          action={onJoin && (
            <button type="button" className="e-btn e-btn-primary" disabled={working} onClick={onJoin}>
              <UserPlus /> Thêm tôi vào ban giám khảo
            </button>
          )} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tiến độ cá nhân: chấm từng tiết mục */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="e-card e-card-pad">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="e-caption">Phiếu chấm cá nhân</div>
            <div className="mt-1 text-[17px] font-semibold text-slate-900 leading-snug">
              {doneCount >= performances.length && performances.length ? 'Đã chấm xong tất cả tiết mục 🎉' : 'Chọn tiết mục để chấm điểm'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold text-teal-700 tabular-nums">{doneCount}<span className="text-base text-slate-400">/{performances.length}</span></div>
            <div className="text-[11px] text-slate-500">phiếu đã nộp</div>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          {performances.map((p) => {
            const d = ownScores.some((s) => s.performance_id === p.id);
            return (
              <div key={p.id} className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <motion.div className={`h-full rounded-full ${p.id === perfId && !d ? 'bg-teal-300' : 'bg-teal-500'}`}
                  initial={false} animate={{ width: d || p.id === perfId ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
              </div>
            );
          })}
        </div>
      </motion.div>

      {!canScore && (
        <div className="e-alert e-alert-info text-sm">
          {selectedEvent?.published ? 'Kết quả đã công bố — phiếu chấm đã khoá.' : 'Ban tổ chức chưa mở chấm hoặc đang tạm dừng / đã khoá chấm.'}
        </div>
      )}

      {/* Thẻ tiết mục: vuốt ngang trên điện thoại, lưới trên màn lớn */}
      <LayoutGroup>
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 pt-1 snap-x sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
          {performances.map((p, i) => {
            const mine = ownScores.find((s) => s.performance_id === p.id);
            return (
              <PerformanceCard key={p.id} p={p} index={i} active={p.id === perfId} done={!!mine} myTotal={mine?.total}
                onClick={() => setPerfId(p.id)} />
            );
          })}
        </div>
      </LayoutGroup>

      {!current ? (
        <div className="e-card"><EmptyState icon={Mic2} title="Chương trình chưa có tiết mục" /></div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={current.id}
            initial={{ opacity: 0, x: reduce ? 0 : 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduce ? 0 : -40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="space-y-4">
            {/* Sân khấu: tiết mục đang chấm */}
            <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${pal.grad} text-white shadow-xl ${pal.glow}`}>
              <StageLights />
              <div className="absolute -right-4 -bottom-10 text-[150px] sm:text-[190px] font-black leading-none text-white/10 select-none">{pad2(current.order_no)}</div>
              <div className="relative px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.18em] text-white/85">
                  <span className="relative flex w-2.5 h-2.5">
                    {canScore && <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping" />}
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-white" />
                  </span>
                  TIẾT MỤC {currentIdx + 1} / {performances.length}
                </div>
                <motion.h3 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="mt-2 text-[26px] sm:text-[34px] font-extrabold leading-tight tracking-tight text-white">
                  {current.title}
                </motion.h3>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                  className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/20 backdrop-blur text-[13px] font-semibold">{current.team_name}</span>
                  <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/20 backdrop-blur text-[13px] font-semibold"><GenreIcon className="w-4 h-4" />{current.description || genre.label}</span>
                  {current.duration_minutes ? <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/20 backdrop-blur text-[13px] font-semibold"><Clock className="w-4 h-4" />{current.duration_minutes} phút</span> : null}
                </motion.div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] text-white/75">ĐIỂM CỦA BẠN</div>
                    <div className="text-[40px] sm:text-[48px] font-black leading-none tabular-nums"><AnimatedNumber value={total} /><span className="text-[16px] font-semibold text-white/70"> / 100</span></div>
                  </div>
                  {currentScore && <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white text-teal-700 text-[12.5px] font-bold"><Check className="w-4 h-4" /> Đã nộp</span>}
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
              <section className="space-y-2.5">
                {criteria.map((c, i) => (
                  <CriterionRow key={c.id} c={c} index={i} raw={draft[c.id] ?? 0} disabled={!canScore}
                    onChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))} />
                ))}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4">
                  <label className="e-label" htmlFor="gala-note">Nhận xét (không bắt buộc)</label>
                  <textarea id="gala-note" rows={3} maxLength={500} disabled={!canScore} className="e-textarea"
                    placeholder="Ấn tượng về phần trình diễn…" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </section>

              <aside className="e-card e-card-pad lg:sticky lg:top-4">
                <div className="e-caption">Tổng điểm</div>
                <div className="my-4">
                  <ScoreRing value={total} color={grade.stroke}>
                    <div className="text-center">
                      <div className="text-[40px] font-black text-slate-900 tabular-nums leading-none"><AnimatedNumber value={total} /></div>
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 mt-1">/ 100 ĐIỂM</div>
                      <motion.div key={grade.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className={`mt-1.5 text-[13px] font-bold ${grade.cls}`}>{grade.label}</motion.div>
                    </div>
                  </ScoreRing>
                </div>
                <div className="space-y-2 mb-4">
                  {criteria.map((c) => (
                    <div key={c.id} className="flex justify-between gap-3 text-[13px] border-b border-slate-100 pb-2">
                      <span className="text-slate-500 leading-snug">{c.label}</span>
                      <span className="font-semibold text-slate-800 tabular-nums shrink-0">{fmtScore(Number(draft[c.id]) || 0)}<span className="text-slate-400 font-normal">/{Number(c.max_points)}</span></span>
                    </div>
                  ))}
                </div>
                <motion.button type="button" whileTap={{ scale: 0.97 }}
                  className="e-btn e-btn-primary e-btn-block e-btn-lg" disabled={working || !canScore} onClick={submit}>
                  <Send /> {currentScore ? 'Cập nhật phiếu chấm' : 'Gửi điểm chính thức'}
                </motion.button>
                {currentIdx < performances.length - 1 && (
                  <button type="button" className="e-btn e-btn-ghost e-btn-block mt-2" onClick={() => setPerfId(performances[currentIdx + 1].id)}>
                    Tiết mục tiếp theo <ChevronRight />
                  </button>
                )}
                <p className="mt-2 text-center text-[12px] text-slate-400">
                  {canScore ? 'Có thể sửa phiếu tới khi Ban tổ chức khoá chấm.' : 'Phiếu đang khoá.'}
                </p>
              </aside>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {selectedEvent?.published && <GalaStage event={selectedEvent} ranking={ranking} />}

      <Celebration show={!!celebrate} title={celebrate?.title} subtitle={celebrate?.subtitle} />
    </div>
  );
}
