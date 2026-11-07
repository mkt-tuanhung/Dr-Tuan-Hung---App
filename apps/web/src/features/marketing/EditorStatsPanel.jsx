// ============================================================
// KPI EDITOR — THỐNG KÊ VIDEO THEO THÁNG, THEO TỪNG EDITOR
//   Đã duyệt   : clip được duyệt chạy Ads (approved_to_run / stage done|approved)
//   Chờ duyệt  : editor đã gửi, Ads chưa xử lý (stage submitted)
//   Bị từ chối : Ads trả về "Cần sửa" (stage revision) — editor sửa & gửi lại thì về Chờ duyệt
//   KPI        : chỉ tiêu số video ĐƯỢC DUYỆT trong tháng (kpi_targets.target_clips)
// Tính tháng: Đã duyệt -> tháng Ads DUYỆT (evaluated_at, như bảng lương editor);
//             Bị từ chối -> tháng bị trả về (updated_at); Chờ duyệt -> clip ĐANG chờ (chỉ ở tháng hiện tại).
// Dùng ở: Video Ads → Thống kê editor · KPI & Hoa hồng → Editor · KPI của tôi (editor) .
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, RotateCcw, Film, Users, Target, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const statusOf = (c) => {
  if (c.approved_to_run || c.stage === 'done' || c.stage === 'approved') return 'approved';
  if (c.stage === 'revision') return 'rejected';
  if (c.stage === 'submitted') return 'pending';
  return null;   // đang dựng / nháp: chưa gửi duyệt
};
const keyOf = (iso) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3);   // giờ Việt Nam
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const thisMonth = () => keyOf(new Date().toISOString());
// Tháng mà clip được tính vào, theo trạng thái
export const monthOf = (c, st = statusOf(c)) => {
  if (st === 'approved') return keyOf(c.evaluated_at || c.submitted_at || c.created_at);
  if (st === 'rejected') return keyOf(c.updated_at || c.submitted_at || c.created_at);
  if (st === 'pending') return thisMonth();
  return '';
};
const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
export const monthLabel = (key) => { const [y, m] = key.split('-'); return `Tháng ${Number(m)}/${y}`; };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const ym = (key) => { const [y, m] = key.split('-').map(Number); return { year: y, month: m }; };

// Danh sách editor đang làm + chỉ tiêu tháng. selfId: chỉ lấy của 1 người (editor xem KPI của mình).
export function useEditorKpi(month, selfId) {
  const [editors, setEditors] = useState([]);
  const [targets, setTargets] = useState({});
  const load = useCallback(async () => {
    const { year, month: m } = ym(month);
    let q = supabase.from('profiles').select('id, full_name').or('role.eq.editor,role_2.eq.editor').eq('is_active', true).order('full_name');
    if (selfId) q = q.eq('id', selfId);
    const [{ data: eds }, { data: ks }] = await Promise.all([
      q,
      (selfId ? supabase.from('kpi_targets').select('staff_id, target_clips').eq('staff_id', selfId)
        : supabase.from('kpi_targets').select('staff_id, target_clips')).eq('month', m).eq('year', year),
    ]);
    setEditors(eds || []);
    setTargets(Object.fromEntries((ks || []).map(k => [k.staff_id, Number(k.target_clips) || 0])));
  }, [month, selfId]);
  useEffect(() => { load(); }, [load]);
  return { editors, targets, reload: load };
}

// Gom số liệu theo editor cho 1 tháng
export function editorRows(clips, month, editors, targets, selfId) {
  const by = {};
  const add = (id, name) => { if (!by[id]) by[id] = { id, name, approved: 0, pending: 0, rejected: 0 }; return by[id]; };
  editors.forEach(e => add(e.id, e.full_name));
  clips.forEach(c => {
    const st = statusOf(c);
    if (!st || monthOf(c, st) !== month) return;
    const id = c.editor_id || 'none';
    if (selfId && id !== selfId) return;
    add(id, c.editor?.full_name || (id === 'none' ? 'Chưa rõ editor' : 'Editor'))[st] += 1;
  });
  return Object.values(by).map(r => {
    const target = targets[r.id] || 0;
    return { ...r, total: r.approved + r.pending + r.rejected, target, kpiPct: target ? pct(r.approved, target) : null };
  }).sort((a, b) => b.approved - a.approved || b.total - a.total || a.name.localeCompare(b.name, 'vi'));
}

const TILES = [
  { k: 'total', label: 'Tổng clip', Icon: Film, cls: 'bg-teal-50 text-teal-700' },
  { k: 'approved', label: 'Đã duyệt', Icon: CheckCircle2, cls: 'bg-success-50 text-success-600' },
  { k: 'pending', label: 'Chờ duyệt', Icon: Clock, cls: 'bg-lavender-50 text-lavender-600' },
  { k: 'rejected', label: 'Bị từ chối', Icon: RotateCcw, cls: 'bg-danger-50 text-danger-600' },
  { k: 'target', label: 'KPI video duyệt', Icon: Target, cls: 'bg-warning-50 text-warning-600' },
];

/**
 * @param clips      danh sách media_clips (kèm editor:profiles(full_name))
 * @param canAssign  Admin / Giám đốc Marketing: được giao chỉ tiêu
 * @param selfId     chỉ hiện của 1 editor (màn KPI của tôi)
 * @param monthKey   tháng do trang cha điều khiển ('YYYY-MM'); bỏ trống = tự có thanh chọn tháng
 */
export default function EditorStatsPanel({ clips, canAssign = false, selfId = null, monthKey = null, onOpenEditor }) {
  const { profile: me } = useAuth();
  const [ownMonth, setOwnMonth] = useState(thisMonth);
  const month = monthKey || ownMonth;
  const { editors, targets, reload } = useEditorKpi(month, selfId);
  const [edit, setEdit] = useState(null);   // { id, value }
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => editorRows(clips, month, editors, targets, selfId), [clips, month, editors, targets, selfId]);
  const sum = rows.reduce((t, r) => ({ total: t.total + r.total, approved: t.approved + r.approved, pending: t.pending + r.pending, rejected: t.rejected + r.rejected, target: t.target + r.target }),
    { total: 0, approved: 0, pending: 0, rejected: 0, target: 0 });
  const isCurrent = month === thisMonth();

  const saveTarget = async () => {
    if (!edit) return;
    const n = Math.max(0, Math.round(Number(edit.value) || 0));
    setSaving(true);
    const { year, month: m } = ym(month);
    const { error } = await supabase.from('kpi_targets').upsert(
      { staff_id: edit.id, month: m, year, target_clips: n, created_by: me?.id, updated_at: new Date().toISOString() },
      { onConflict: 'staff_id,month,year' });
    setSaving(false);
    if (error) { toast.error('Không lưu được KPI: ' + error.message); return; }
    toast.success('Đã giao KPI ' + n + ' video');
    setEdit(null);
    reload();
  };

  const kpiCell = (r) => {
    if (edit?.id === r.id) {
      return (
        <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <input type="number" min="0" inputMode="numeric" autoFocus value={edit.value}
            onChange={e => setEdit({ ...edit, value: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEdit(null); }}
            className="e-input w-20 h-8 text-right tabular-nums" />
          <button type="button" disabled={saving} onClick={saveTarget} className="e-icon-btn w-8 h-8 text-success-600" aria-label="Lưu"><Check className="w-4 h-4" /></button>
          <button type="button" onClick={() => setEdit(null)} className="e-icon-btn w-8 h-8" aria-label="Huỷ"><X className="w-4 h-4" /></button>
        </span>
      );
    }
    const canEditRow = canAssign && r.id !== 'none';
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`tabular-nums ${r.target ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{r.target || 'Chưa giao'}</span>
        {canEditRow && <button type="button" onClick={e => { e.stopPropagation(); setEdit({ id: r.id, value: String(r.target || '') }); }} className="e-icon-btn w-7 h-7" aria-label="Giao KPI"><Pencil className="w-3.5 h-3.5" /></button>}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {!monthKey && (
        <div className="e-card-flat px-3 py-2.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOwnMonth(m => shiftMonth(m, -1))} className="e-icon-btn w-9 h-9" aria-label="Tháng trước"><ChevronLeft className="w-4 h-4" /></button>
            <span className="min-w-[124px] text-center text-[14.5px] font-semibold text-slate-900 tabular-nums">{monthLabel(month)}</span>
            <button type="button" onClick={() => setOwnMonth(m => shiftMonth(m, 1))} disabled={isCurrent} className="e-icon-btn w-9 h-9 disabled:opacity-40" aria-label="Tháng sau"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {!isCurrent && <button type="button" onClick={() => setOwnMonth(thisMonth())} className="e-btn e-btn-ghost e-btn-sm">Tháng này</button>}
          <span className="ml-auto text-[12px] text-slate-500">Đã duyệt tính theo tháng Ads duyệt · Chờ duyệt = đang chờ hiện tại · KPI = số video được duyệt</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {TILES.map(({ k, label, Icon, cls }) => (
          <div key={k} className={`e-card p-4 flex items-center gap-3 min-w-0 ${k === 'target' ? 'col-span-2 lg:col-span-1' : ''}`}>
            <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${cls}`}><Icon className="w-5 h-5" /></span>
            <div className="min-w-0">
              <div className="text-[12.5px] text-slate-500 truncate">{label}</div>
              <div className="text-[22px] font-bold text-slate-900 tabular-nums leading-tight">{k === 'target' ? (sum.target ? `${sum.approved}/${sum.target}` : '—') : sum[k]}</div>
              {k === 'approved' && sum.total > 0 && <div className="text-[11.5px] text-success-600 font-semibold">{pct(sum.approved, sum.total)}% tổng clip</div>}
              {k === 'target' && <div className={`text-[11.5px] font-semibold ${sum.target ? (sum.approved >= sum.target ? 'text-success-600' : 'text-warning-600') : 'text-slate-400'}`}>{sum.target ? `Đạt ${pct(sum.approved, sum.target)}% KPI` : (canAssign ? 'Bấm ✎ ở bảng để giao' : 'Chưa giao KPI')}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="e-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Users className="w-4 h-4 text-teal-600" />
          <div className="text-[15px] font-semibold text-slate-900">{selfId ? 'KPI của tôi' : 'KPI theo từng editor'} · {monthLabel(month)}</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 pb-8 pt-4 text-center text-[13.5px] text-slate-400">Chưa có editor hoặc clip nào trong {monthLabel(month).toLowerCase()}.</div>
        ) : (
          <>
            {/* Máy tính: bảng */}
            <div className="hidden sm:block e-table-wrap">
              <table className="e-table">
                <thead>
                  <tr>
                    <th>Editor</th><th className="num">KPI tháng</th><th className="num">Tổng clip</th><th className="num">Đã duyệt</th><th className="num">Chờ duyệt</th><th className="num">Bị từ chối</th><th className="w-[190px]">% đạt KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className={onOpenEditor ? 'cursor-pointer' : ''} onClick={() => onOpenEditor?.(r.id)}>
                      <td className="font-medium text-slate-800">{r.name}</td>
                      <td className="num">{kpiCell(r)}</td>
                      <td className="num tabular-nums">{r.total}</td>
                      <td className="num tabular-nums font-semibold text-success-600">{r.approved}</td>
                      <td className="num tabular-nums text-lavender-600">{r.pending}</td>
                      <td className="num tabular-nums text-danger-600">{r.rejected}</td>
                      <td><KpiBar r={r} /></td>
                    </tr>
                  ))}
                  {rows.length > 1 && (
                    <tr className="bg-slate-50/70 font-semibold">
                      <td>Tổng {rows.length} editor</td>
                      <td className="num tabular-nums">{sum.target || '—'}</td>
                      <td className="num tabular-nums">{sum.total}</td>
                      <td className="num tabular-nums text-success-600">{sum.approved}</td>
                      <td className="num tabular-nums text-lavender-600">{sum.pending}</td>
                      <td className="num tabular-nums text-danger-600">{sum.rejected}</td>
                      <td><KpiBar r={{ ...sum, kpiPct: sum.target ? pct(sum.approved, sum.target) : null }} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Điện thoại: thẻ */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {rows.map(r => (
                <li key={r.id} className="px-4 py-3" onClick={() => onOpenEditor?.(r.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[14px] text-slate-800 truncate">{r.name}</span>
                    <span className="text-[12.5px] text-slate-500 shrink-0 inline-flex items-center gap-1">KPI {kpiCell(r)}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                    <span className="rounded-lg bg-success-50 py-1.5"><b className="block text-[16px] text-success-600 tabular-nums">{r.approved}</b><span className="text-[11px] text-slate-500">Đã duyệt</span></span>
                    <span className="rounded-lg bg-lavender-50 py-1.5"><b className="block text-[16px] text-lavender-600 tabular-nums">{r.pending}</b><span className="text-[11px] text-slate-500">Chờ duyệt</span></span>
                    <span className="rounded-lg bg-danger-50 py-1.5"><b className="block text-[16px] text-danger-600 tabular-nums">{r.rejected}</b><span className="text-[11px] text-slate-500">Bị từ chối</span></span>
                  </div>
                  <div className="mt-2"><KpiBar r={r} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// Thanh % KPI: đã duyệt / chỉ tiêu. Chưa giao KPI thì hiện cơ cấu duyệt / chờ / từ chối.
export function KpiBar({ r }) {
  if (r.target) {
    const p = pct(r.approved, r.target);
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <span className={`block h-full ${p >= 100 ? 'bg-success-500' : p >= 60 ? 'bg-teal-500' : 'bg-warning-500'}`} style={{ width: `${Math.min(100, p)}%` }} />
        </div>
        <span className={`w-11 text-right text-[12.5px] font-semibold tabular-nums ${p >= 100 ? 'text-success-600' : 'text-slate-700'}`}>{p}%</span>
      </div>
    );
  }
  const t = r.total || 0;
  return (
    <div className="flex items-center gap-2 min-w-0" title="Chưa giao KPI — thanh thể hiện cơ cấu đã duyệt / chờ / bị từ chối">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden flex">
        {t > 0 && <>
          <span className="h-full bg-success-500" style={{ width: `${(r.approved / t) * 100}%` }} />
          <span className="h-full bg-lavender-400" style={{ width: `${(r.pending / t) * 100}%` }} />
          <span className="h-full bg-danger-400" style={{ width: `${(r.rejected / t) * 100}%` }} />
        </>}
      </div>
      <span className="w-11 text-right text-[12px] text-slate-400">—</span>
    </div>
  );
}

// Tự tải clip (cho trang KPI): admin/GĐ Marketing tải hết; editor chỉ tải clip của mình (RLS cũng giới hạn).
export function EditorKpiLoader({ selfId = null, canAssign = false, monthKey = null }) {
  const [clips, setClips] = useState(null);
  useEffect(() => {
    let q = supabase.from('media_clips').select('id, editor_id, stage, approved_to_run, evaluated_at, submitted_at, created_at, updated_at, editor:profiles!editor_id(full_name)');
    if (selfId) q = q.eq('editor_id', selfId);
    q.then(({ data, error }) => { if (error) toast.error(error.message); setClips(data || []); });
  }, [selfId]);
  if (!clips) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;
  return <EditorStatsPanel clips={clips} selfId={selfId} canAssign={canAssign} monthKey={monthKey} />;
}
