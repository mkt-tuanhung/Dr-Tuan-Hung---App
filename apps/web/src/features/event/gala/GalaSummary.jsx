// ============================================================
// GALA — BẢNG TỔNG KẾT ĐIỂM (chỉ Ban tổ chức)
// Điểm từng giám khảo → TỔNG điểm (xếp hạng theo tổng) + trung bình,
// bấm 1 tiết mục để xem chi tiết từng tiêu chí của từng giám khảo.
// Chỉ tính giám khảo ĐANG được cấp quyền (giống bảng xếp hạng ở DB).
// ============================================================
import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, FileSpreadsheet, Trophy, AlertTriangle } from 'lucide-react';
import { fmtScore, initials, norm, pad2 } from './galaUtil';
import { teamPalette } from './galaTheme';

// Tính bảng tổng kết: mỗi tiết mục -> điểm từng GK, tổng, TB, tổng theo tiêu chí; xếp hạng theo tổng
export function buildSummary({ performances, criteria, judges, scores }) {
  const byKey = new Map(scores.map((s) => [`${s.performance_id}|${s.judge_id}`, s]));
  const rows = performances.map((p) => {
    const perJudge = judges.map((j) => byKey.get(`${p.id}|${j.user_id}`) || null);
    const got = perJudge.filter(Boolean);
    const sum = got.reduce((a, s) => a + Number(s.total || 0), 0);
    const perCriterion = criteria.map((c) => ({
      c,
      values: perJudge.map((s) => (s ? Number(s.values_by_criterion?.[c.id] ?? 0) : null)),
      sum: got.reduce((a, s) => a + Number(s.values_by_criterion?.[c.id] ?? 0), 0),
    }));
    return { p, perJudge, sum, count: got.length, avg: got.length ? sum / got.length : null, perCriterion };
  });
  rows.sort((a, b) => (b.count ? b.sum : -1) - (a.count ? a.sum : -1) || (a.p.order_no - b.p.order_no));
  // Xếp hạng theo tổng (bằng điểm = đồng hạng); tiết mục chưa có phiếu không xếp hạng
  let rank = 0; let prev = null;
  rows.forEach((r, i) => {
    if (!r.count) { r.rank = null; return; }
    if (prev === null || r.sum !== prev) { rank = i + 1; prev = r.sum; }
    r.rank = rank;
  });
  return rows;
}

function exportSummaryCsv({ eventTitle, rows, judges, criteria, nameOf }) {
  const esc = (v) => `"${String(v ?? '').replace(/^([=+\-@\t\r])/, "'$1").replaceAll('"', '""')}"`;
  const num = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
  const out = [[
    'Hạng', 'Tiết mục', 'Đội', ...judges.map((j) => nameOf(j.user_id)),
    `Tổng điểm (/${judges.length * 100})`, 'Trung bình (/100)', 'Số phiếu',
  ]];
  rows.forEach((r) => out.push([
    r.rank ?? '', r.p.title, r.p.team_name, ...r.perJudge.map((s) => num(s?.total)),
    r.count ? num(r.sum) : '', num(r.avg), `${r.count}/${judges.length}`,
  ]));
  out.push([]);
  out.push(['CHI TIẾT THEO TIÊU CHÍ']);
  out.push(['Tiết mục', 'Tiêu chí', 'Điểm tối đa', ...judges.map((j) => nameOf(j.user_id)), 'Tổng tiêu chí']);
  rows.forEach((r) => r.perCriterion.forEach(({ c, values, sum }) => out.push([
    r.p.title, c.label, Number(c.max_points), ...values.map(num), num(sum),
  ])));
  const body = '﻿' + out.map((row) => row.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `tong-ket-diem-${norm(eventTitle).replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'gala'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const rankStyle = (rank) => (rank === 1 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md shadow-amber-500/30'
  : rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-white'
    : rank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white'
      : rank ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-400');

function JudgeHead({ person, name }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[76px]">
      {person?.avatar_url
        ? <img src={person.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
        : <span className="w-7 h-7 rounded-full bg-teal-50 text-teal-800 grid place-items-center text-[10.5px] font-bold">{initials(name)}</span>}
      <span className="text-[12px] font-semibold text-slate-600 leading-tight text-center">{name}</span>
    </div>
  );
}

function JudgeNotes({ row, judges, nameOf }) {
  if (!row.perJudge.some((s) => s?.note)) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {row.perJudge.map((s, i) => (s?.note ? (
        <div key={i} className="text-[12.5px] text-slate-600 leading-snug"><span className="font-semibold">{nameOf(judges[i].user_id)}:</span> {s.note}</div>
      ) : null))}
    </div>
  );
}

// Chi tiết tiêu chí cho điện thoại: mỗi tiêu chí 1 khối, điểm từng giám khảo xếp dạng chip
function CriteriaDetailCompact({ row, judges, nameOf }) {
  return (
    <div>
      <div className="divide-y divide-slate-100">
        {row.perCriterion.map(({ c, values, sum }) => (
          <div key={c.id} className="py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] font-semibold text-slate-800 leading-snug">{c.label} <span className="font-normal text-slate-400">/{Number(c.max_points)}</span></div>
              <div className="text-[14px] font-bold text-teal-700 tabular-nums shrink-0">{fmtScore(sum)}</div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {values.map((v, i) => (
                <span key={i} className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-slate-100 text-[11.5px] text-slate-600">
                  {nameOf(judges[i].user_id)} <b className="text-slate-800 tabular-nums">{v == null ? '—' : fmtScore(v)}</b>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <JudgeNotes row={row} judges={judges} nameOf={nameOf} />
    </div>
  );
}

// Chi tiết từng tiêu chí dạng bảng (màn rộng)
function CriteriaDetail({ row, judges, nameOf }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-semibold py-1.5 pr-3">Tiêu chí</th>
            {judges.map((j) => <th key={j.user_id} className="font-semibold py-1.5 px-2 text-center whitespace-nowrap">{nameOf(j.user_id)}</th>)}
            <th className="font-semibold py-1.5 pl-2 text-right">Tổng</th>
          </tr>
        </thead>
        <tbody>
          {row.perCriterion.map(({ c, values, sum }) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="py-1.5 pr-3 text-slate-700 leading-snug">{c.label} <span className="text-slate-400">/{Number(c.max_points)}</span></td>
              {values.map((v, i) => <td key={i} className="py-1.5 px-2 text-center tabular-nums text-slate-700">{v == null ? '—' : fmtScore(v)}</td>)}
              <td className="py-1.5 pl-2 text-right font-bold tabular-nums text-teal-700">{fmtScore(sum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <JudgeNotes row={row} judges={judges} nameOf={nameOf} />
    </div>
  );
}

export default function GalaSummary({ eventTitle, performances, criteria, judges, scores, byId, nameOf, onExportDetail }) {
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => buildSummary({ performances, criteria, judges, scores }), [performances, criteria, judges, scores]);
  const maxSum = judges.length * 100;
  const missing = rows.reduce((a, r) => a + (judges.length - r.count), 0);
  const hasScores = rows.some((r) => r.count);

  return (
    <section className="e-card e-card-pad">
      <div className="e-card-header flex-wrap">
        <div>
          <div className="e-card-title flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> Bảng tổng kết điểm</div>
          <div className="e-card-sub">Tổng điểm {judges.length} giám khảo (tối đa {maxSum}) · xếp hạng theo tổng · tự làm mới 12 giây</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="e-btn e-btn-secondary e-btn-sm" disabled={!hasScores}
            onClick={() => exportSummaryCsv({ eventTitle, rows, judges, criteria, nameOf })}>
            <FileSpreadsheet /> Xuất tổng kết
          </button>
          <button type="button" className="e-btn e-btn-ghost e-btn-sm" disabled={!hasScores} onClick={onExportDetail}>
            <Download /> Từng phiếu
          </button>
        </div>
      </div>

      {missing > 0 && hasScores && (
        <div className="e-alert e-alert-warning text-[13px] mb-3"><AlertTriangle /> Còn {missing} phiếu chưa chấm — tổng điểm đang là tạm tính.</div>
      )}
      {!judges.length && <p className="text-sm text-slate-400 py-6 text-center">Chưa có giám khảo.</p>}

      {judges.length > 0 && (
        <>
          {/* Màn rộng: bảng */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2 text-left font-semibold w-14">Hạng</th>
                  <th className="py-2 pr-3 text-left font-semibold">Tiết mục</th>
                  {judges.map((j) => <th key={j.user_id} className="py-2 px-2 align-bottom"><JudgeHead person={byId[j.user_id]} name={nameOf(j.user_id)} /></th>)}
                  <th className="py-2 px-3 text-right font-semibold">Tổng điểm</th>
                  <th className="py-2 pl-3 text-right font-semibold">TB</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pal = teamPalette(r.p.team_name);
                  const isOpen = open === r.p.id;
                  return (
                    <React.Fragment key={r.p.id}>
                      <motion.tr layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        onClick={() => setOpen(isOpen ? null : r.p.id)}
                        className={`border-b border-slate-100 cursor-pointer hover:bg-teal-50/40 ${isOpen ? 'bg-teal-50/40' : ''}`}>
                        <td className="py-3 pr-2"><span className={`w-9 h-9 rounded-full grid place-items-center text-[13px] font-black ${rankStyle(r.rank)}`}>{r.rank ? pad2(r.rank) : '—'}</span></td>
                        <td className="py-3 pr-3">
                          <div className="font-bold text-slate-900 leading-snug">{r.p.title}</div>
                          <span className={`mt-1 inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] font-semibold ${pal.soft}`}><span className={`w-1.5 h-1.5 rounded-full ${pal.dot}`} />{r.p.team_name}</span>
                        </td>
                        {r.perJudge.map((s, i) => (
                          <td key={i} className="py-3 px-2 text-center tabular-nums">
                            {s ? <span className="font-semibold text-slate-800">{fmtScore(s.total)}</span> : <span className="text-[12px] text-slate-400">chưa chấm</span>}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-right">
                          <span className="text-[20px] font-black text-teal-700 tabular-nums">{r.count ? fmtScore(r.sum) : '—'}</span>
                          <span className="text-[12px] text-slate-400">/{maxSum}</span>
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums text-slate-600">{fmtScore(r.avg)}</td>
                        <td className="py-3 text-slate-400"><ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} /></td>
                      </motion.tr>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <tr className="bg-teal-50/30">
                            <td colSpan={judges.length + 5} className="px-3 pb-4">
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="pt-2"><CriteriaDetail row={r} judges={judges} nameOf={nameOf} /></div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: thẻ */}
          <div className="md:hidden space-y-3">
            {rows.map((r) => {
              const pal = teamPalette(r.p.team_name);
              const isOpen = open === r.p.id;
              return (
                <motion.div key={r.p.id} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={`rounded-2xl border ${r.rank === 1 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/80 bg-white'} p-3.5`}>
                  <div className="flex items-start gap-3">
                    <span className={`w-10 h-10 rounded-full grid place-items-center text-[14px] font-black shrink-0 ${rankStyle(r.rank)}`}>{r.rank ? pad2(r.rank) : '—'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 leading-snug">{r.p.title}</div>
                      <span className={`mt-1 inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] font-semibold ${pal.soft}`}><span className={`w-1.5 h-1.5 rounded-full ${pal.dot}`} />{r.p.team_name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[24px] font-black text-teal-700 tabular-nums leading-none">{r.count ? fmtScore(r.sum) : '—'}</div>
                      <div className="text-[11px] text-slate-400 mt-1">/ {maxSum} · TB {fmtScore(r.avg)}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5">
                    {r.perJudge.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="text-slate-600 leading-snug">{nameOf(judges[i].user_id)}</span>
                        {s ? <span className="font-bold text-slate-800 tabular-nums">{fmtScore(s.total)}</span> : <span className="text-[12px] text-slate-400">chưa chấm</span>}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setOpen(isOpen ? null : r.p.id)}
                    className="mt-2 w-full h-9 rounded-xl text-[13px] font-semibold text-teal-700 bg-teal-50/60 inline-flex items-center justify-center gap-1.5">
                    {isOpen ? 'Ẩn chi tiết tiêu chí' : 'Xem chi tiết tiêu chí'} <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-2"><CriteriaDetailCompact row={r} judges={judges} nameOf={nameOf} /></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-slate-400">Chỉ tính giám khảo đang được cấp quyền. Bằng tổng điểm thì đồng hạng. Bấm vào tiết mục để xem điểm từng tiêu chí và nhận xét.</p>
        </>
      )}
    </section>
  );
}
