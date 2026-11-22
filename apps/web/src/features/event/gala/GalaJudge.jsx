// ============================================================
// GALA — màn GIÁM KHẢO: chọn tiết mục → chấm 4 tiêu chí (bước 0,5) → gửi phiếu
// Chỉ thấy phiếu của chính mình; sửa được tới khi Ban tổ chức khoá chấm.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Lock, Mic2, Send } from 'lucide-react';
import { EmptyState } from '@/components/ds';
import GalaStage from './GalaStage.jsx';
import { fmtScore, pad2, validPoint } from './galaUtil';

export default function GalaJudge({ g, userId }) {
  const { selectedEvent, performances, criteria, judges, scores, ranking, working, actions } = g;
  const isJudge = judges.some((j) => j.user_id === userId && j.active);
  const ownScores = useMemo(() => scores.filter((s) => s.judge_id === userId), [scores, userId]);
  const [perfId, setPerfId] = useState(null);
  const [draft, setDraft] = useState({});
  const [note, setNote] = useState('');

  const canScore = selectedEvent?.phase === 'scoring' && !selectedEvent?.published;
  const current = performances.find((p) => p.id === perfId) || null;
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
    const ok = await actions.submitScore(perfId, values, note);
    if (ok) {
      const next = performances.find((p) => p.id !== perfId && !ownScores.some((s) => s.performance_id === p.id));
      if (next) setPerfId(next.id);
    }
  };

  if (!isJudge) {
    return (
      <div className="e-card">
        <EmptyState icon={Lock} title="Chưa được cấp quyền chấm thi"
          description="Tài khoản của bạn chưa được Ban tổ chức chỉ định làm giám khảo của chương trình này." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tiến độ cá nhân */}
      <div className="e-card e-card-pad flex items-center justify-between gap-3">
        <div>
          <div className="e-caption">Phiếu chấm cá nhân</div>
          <div className="mt-1 text-[17px] font-semibold text-slate-900">Chọn tiết mục để chấm điểm</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-teal-700 tabular-nums">{ownScores.length}<span className="text-base text-slate-400">/{performances.length}</span></div>
          <div className="text-[11px] text-slate-500">phiếu đã nộp</div>
        </div>
      </div>

      {!canScore && (
        <div className="e-alert e-alert-info text-sm">
          {selectedEvent?.published ? 'Kết quả đã công bố — phiếu chấm đã khoá.' : 'Ban tổ chức chưa mở chấm hoặc đang tạm dừng / đã khoá chấm.'}
        </div>
      )}

      {/* Dải tiết mục (vuốt ngang trên điện thoại) */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {performances.map((p) => {
          const done = ownScores.some((s) => s.performance_id === p.id);
          const active = p.id === perfId;
          return (
            <button key={p.id} type="button" onClick={() => setPerfId(p.id)}
              ref={active ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) : undefined}
              className={`snap-start shrink-0 w-[168px] text-left rounded-2xl border p-3 transition ${
                active ? 'border-teal-400 bg-teal-50 shadow-soft' : 'border-slate-200 bg-white hover:border-teal-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-teal-700">{pad2(p.order_no)}</span>
                {done && <span className="w-5 h-5 rounded-full bg-teal-600 text-white grid place-items-center"><Check className="w-3.5 h-3.5" /></span>}
              </div>
              <div className="mt-1 font-semibold text-[13px] text-slate-800 leading-snug line-clamp-2">{p.title}</div>
              <div className="text-[11.5px] text-slate-500 truncate">{p.team_name}</div>
            </button>
          );
        })}
      </div>

      {!current ? (
        <div className="e-card"><EmptyState icon={Mic2} title="Chương trình chưa có tiết mục" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <section className="e-card e-card-pad">
            <div className="e-caption">{current.team_name}</div>
            <h3 className="mt-1 text-xl font-bold text-slate-900 leading-snug">{current.title}</h3>
            {current.description && <p className="mt-1 text-sm text-slate-500">{current.description}</p>}

            <div className="mt-4 divide-y divide-slate-100">
              {criteria.map((c, i) => {
                const max = Number(c.max_points);
                const raw = draft[c.id] ?? 0;
                const val = Number(raw) || 0;
                return (
                  <div key={c.id} className="py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-teal-600">{pad2(i + 1)}</span>
                        <span className="font-semibold text-slate-800 truncate">{c.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1 shrink-0">
                        <input type="number" inputMode="decimal" min="0" max={max} step="0.5"
                          aria-label={`Điểm ${c.label}`} disabled={!canScore}
                          value={raw}
                          onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                          className="w-16 h-9 rounded-lg border border-slate-200 text-right px-2 text-lg font-bold text-slate-900 tabular-nums outline-none focus:border-teal-400 disabled:bg-slate-50" />
                        <span className="text-[13px] text-slate-400">/{max}</span>
                      </div>
                    </div>
                    <input type="range" min="0" max={max} step="0.5" value={val} disabled={!canScore}
                      aria-label={`Thanh điểm ${c.label}`}
                      onChange={(e) => setDraft((d) => ({ ...d, [c.id]: Number(e.target.value) }))}
                      className="mt-3 w-full accent-teal-600 cursor-pointer disabled:cursor-not-allowed" />
                  </div>
                );
              })}
            </div>

            <label className="e-label mt-2" htmlFor="gala-note">Nhận xét (không bắt buộc)</label>
            <textarea id="gala-note" rows={3} maxLength={500} disabled={!canScore} className="e-textarea"
              placeholder="Ấn tượng về phần trình diễn…" value={note} onChange={(e) => setNote(e.target.value)} />
          </section>

          <aside className="e-card e-card-pad lg:sticky lg:top-4">
            <div className="e-caption">Tổng điểm</div>
            <div className="mx-auto my-4 w-40 h-40 rounded-full grid place-items-center bg-gradient-to-br from-teal-50 to-white border-4 border-teal-100">
              <div className="text-center">
                <div className="text-4xl font-extrabold text-teal-700 tabular-nums">{fmtScore(total)}</div>
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400">/ 100 ĐIỂM</div>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {criteria.map((c) => (
                <div key={c.id} className="flex justify-between text-[13px] border-b border-slate-100 pb-2">
                  <span className="text-slate-500">{c.label}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{fmtScore(Number(draft[c.id]) || 0)}</span>
                </div>
              ))}
            </div>
            <button type="button" className="e-btn e-btn-primary e-btn-block" disabled={working || !canScore} onClick={submit}>
              <Send /> {currentScore ? 'Cập nhật phiếu chấm' : 'Gửi điểm chính thức'}
            </button>
            <p className="mt-2 text-center text-[12px] text-slate-400">
              {canScore ? 'Có thể sửa phiếu tới khi Ban tổ chức khoá chấm.' : 'Phiếu đang khoá.'}
            </p>
          </aside>
        </div>
      )}

      {selectedEvent?.published && <GalaStage event={selectedEvent} ranking={ranking} />}
    </div>
  );
}
