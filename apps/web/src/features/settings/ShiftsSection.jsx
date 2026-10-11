// ============================================================
// CÀI ĐẶT › CA LÀM VIỆC — danh mục ca (bảng work_shifts, supabase/work_schedule.sql)
// Màn Lịch làm việc / Phân ca chỉ XẾP ca, chưa có chỗ thêm / sửa ca -> làm ở đây.
// RLS hiện tại: ai đăng nhập cũng xem; chỉ Admin VAI TRÒ CHÍNH (profiles.role) được
// thêm / sửa / xoá (policy work_shifts_admin không xét role_2).
// Ca đã được xếp cho nhân sự thì không xoá được (khoá ngoại staff_schedules) -> "Ngừng dùng".
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Plus, Pencil, Trash2, CalendarRange, Power } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { runWithReason } from '@/lib/audit';
import { DataTable, Drawer, ConfirmDialog, AlertStrip } from '@/components/ds';
import { SectionHeader, Field, isMissingTable } from './settingsShared.jsx';

const TONES = [
  ['peach', 'Cam đào'], ['success', 'Xanh lá'], ['rose', 'Hồng'],
  ['lavender', 'Tím nhạt'], ['sky', 'Xanh trời'], ['neutral', 'Xám'],
];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMPTY = { id: '', code: '', name: '', short: '', start_time: '08:00', end_time: '17:00', tone: 'sky', is_off: false, sort: 0, active: true };

const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function ShiftsSection({ canWrite, onNavigate }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [edit, setEdit] = useState(null);       // bản ghi đang sửa (hoặc mới)
  const [confirm, setConfirm] = useState(null); // { row, used }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase.from('work_shifts').select('*').order('sort').order('name');
    if (err) { setMissing(isMissingTable(err)); if (!isMissingTable(err)) setError(err); setRows([]); return; }
    setMissing(false);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const askDelete = async (row) => {
    const { count } = await supabase.from('staff_schedules').select('shift_id', { count: 'exact', head: true }).eq('shift_id', row.id);
    setConfirm({ row, used: count || 0 });
  };

  const toggleActive = async (row) => {
    const res = await runWithReason(() => supabase.from('work_shifts').update({ active: !row.active }).eq('id', row.id).select('id'), row.active ? 'Ngừng dùng ca' : 'Dùng lại ca');
    if (res.error) { toast.error(res.error.message); return; }
    if (!res.data?.length) { toast.error('Không có quyền sửa ca (cần Admin vai trò chính)'); return; }
    toast.success(row.active ? `Đã ngừng dùng ${row.name}` : `Đã dùng lại ${row.name}`);
    load();
  };

  const doDelete = async (reason) => {
    const row = confirm.row;
    setBusy(true);
    const res = await runWithReason(() => supabase.from('work_shifts').delete().eq('id', row.id).select('id'), reason || 'Xoá ca làm việc');
    setBusy(false);
    if (res.error) {
      toast.error(res.error.code === '23503' ? 'Ca đã được xếp cho nhân sự — hãy chọn "Ngừng dùng" thay vì xoá' : res.error.message);
      return;
    }
    if (!res.data?.length) { toast.error('Không có quyền xoá ca (cần Admin vai trò chính)'); return; }
    toast.success(`Đã xoá ${row.name}`);
    setConfirm(null);
    load();
  };

  const columns = useMemo(() => [
    { key: 'name', header: 'Ca', sortValue: r => r.name, cell: r => (
      <div className="flex items-center gap-3">
        <span className={`inline-grid place-items-center min-w-[52px] h-8 px-2 rounded-lg text-[12.5px] font-semibold e-shift-${r.tone}`}>{r.short}</span>
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">{r.name}</div>
          <div className="text-[12px] text-slate-400 font-mono">{r.code}</div>
        </div>
      </div>
    ) },
    { key: 'time', header: 'Giờ', sortValue: r => r.start_time, cell: r => (r.is_off ? <span className="text-slate-400">—</span> : (
      <span className="tabular-nums">{r.start_time}–{r.end_time}{r.end_time < r.start_time && <span className="e-badge e-badge-sm e-tone-lavender ml-2">Qua đêm</span>}</span>
    )) },
    { key: 'kind', header: 'Loại', cell: r => (r.is_off ? <span className="e-badge e-badge-sm e-tone-neutral">Ngày nghỉ</span> : <span className="e-badge e-badge-sm e-tone-brand">Ca làm</span>) },
    { key: 'sort', header: 'Thứ tự', align: 'right', sortValue: r => r.sort, cell: r => <span className="tabular-nums">{r.sort}</span> },
    { key: 'active', header: 'Trạng thái', cell: r => (r.active
      ? <span className="e-badge e-badge-sm e-badge-dot e-tone-success">Đang dùng</span>
      : <span className="e-badge e-badge-sm e-badge-dot e-tone-neutral">Ngừng dùng</span>) },
    ...(canWrite ? [{ key: 'act', header: '', align: 'right', cell: r => (
      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
        <button type="button" className="e-icon-btn w-8 h-8" title="Sửa" aria-label={`Sửa ${r.name}`} onClick={() => setEdit(r)}><Pencil className="w-4 h-4" /></button>
        <button type="button" className="e-icon-btn w-8 h-8" title={r.active ? 'Ngừng dùng' : 'Dùng lại'} aria-label={r.active ? `Ngừng dùng ${r.name}` : `Dùng lại ${r.name}`} onClick={() => toggleActive(r)}><Power className="w-4 h-4" /></button>
        <button type="button" className="e-icon-btn w-8 h-8 hover:!text-danger-600 hover:!border-danger-200" title="Xoá" aria-label={`Xoá ${r.name}`} onClick={() => askDelete(r)}><Trash2 className="w-4 h-4" /></button>
      </div>
    ) }] : []),
  ], [canWrite]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <SectionHeader icon={Clock} title="Ca làm việc"
        desc="Danh mục ca dùng khi xếp lịch cho nhân sự. Ca ngừng dùng sẽ không hiện trong bảng phân ca nhưng lịch cũ vẫn giữ nguyên."
        action={<>
          {onNavigate && <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={() => onNavigate('schedule')}><CalendarRange />Mở Phân ca</button>}
          {canWrite && !missing && <button type="button" className="e-btn e-btn-primary e-btn-sm" onClick={() => setEdit({ ...EMPTY, sort: (rows?.length || 0) + 1 })}><Plus />Thêm ca</button>}
        </>} />

      {missing && (
        <div className="mb-4"><AlertStrip tone="warning">Chưa tạo bảng ca làm việc. Chạy file <b>supabase/work_schedule.sql</b> trong Supabase › SQL Editor.</AlertStrip></div>
      )}
      {!canWrite && !missing && (
        <div className="mb-4"><AlertStrip tone="info">Chỉ xem. Quyền thêm / sửa ca hiện chỉ dành cho tài khoản có <b>vai trò chính</b> là Admin (theo RLS của work_schedule.sql).</AlertStrip></div>
      )}

      <div className="e-card-flat overflow-hidden">
        <DataTable bare columns={columns} rows={rows} loading={rows === null} error={error} onRetry={load}
          onRowClick={canWrite ? (r) => setEdit(r) : undefined} pageSize={20}
          empty={{ title: 'Chưa có ca nào', description: canWrite ? 'Bấm "Thêm ca" để tạo ca đầu tiên.' : undefined }} />
      </div>

      {edit && <ShiftDrawer shift={edit} existing={rows || []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}

      <ConfirmDialog open={!!confirm} onClose={() => !busy && setConfirm(null)} busy={busy} danger
        title={confirm ? `Xoá ${confirm.row.name}?` : ''}
        description={confirm?.used
          ? `Ca này đang được xếp ${confirm.used} lượt trong lịch làm việc nên không xoá được. Hãy dùng "Ngừng dùng" để ẩn ca khỏi bảng phân ca.`
          : 'Ca chưa được xếp cho ai. Xoá vĩnh viễn khỏi danh mục.'}
        confirmLabel={confirm?.used ? 'Ngừng dùng ca' : 'Xoá ca'}
        requireReason={!confirm?.used} reasonPlaceholder="VD: Tạo nhầm ca"
        onConfirm={(reason) => {
          if (confirm.used) { const r = confirm.row; setConfirm(null); if (r.active) toggleActive(r); else toast.info('Ca này đã ngừng dùng'); return; }
          doDelete(reason);
        }} />
    </div>
  );
}

function ShiftDrawer({ shift, existing, onClose, onSaved }) {
  const isNew = !shift.id;
  const [f, setF] = useState({ ...shift, sort: String(shift.sort ?? 0) });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const code = f.code.trim().toUpperCase();
  const others = existing.filter(r => r.id !== shift.id);
  const errors = {
    code: !code ? 'Bắt buộc' : !/^[A-Z0-9_]{1,12}$/.test(code) ? 'Chỉ chữ in hoa, số, gạch dưới (tối đa 12)' : others.some(r => r.code.toUpperCase() === code) ? 'Mã ca đã tồn tại' : null,
    name: !f.name.trim() ? 'Bắt buộc' : null,
    short: !f.short.trim() ? 'Bắt buộc' : f.short.trim().length > 8 ? 'Tối đa 8 ký tự' : null,
    start_time: !f.is_off && !TIME_RE.test(f.start_time) ? 'Dạng HH:MM' : null,
    end_time: !f.is_off && !TIME_RE.test(f.end_time) ? 'Dạng HH:MM' : !f.is_off && f.end_time === f.start_time ? 'Giờ kết thúc phải khác giờ bắt đầu' : null,
    sort: !/^\d{1,4}$/.test(f.sort) ? 'Số từ 0' : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const overnight = !f.is_off && TIME_RE.test(f.start_time) && TIME_RE.test(f.end_time) && f.end_time < f.start_time;

  const save = async () => {
    setSaving(true);
    const payload = {
      code, name: f.name.trim(), short: f.short.trim(), tone: f.tone, is_off: !!f.is_off,
      start_time: f.is_off ? '00:00' : f.start_time, end_time: f.is_off ? '00:00' : f.end_time,
      sort: Number(f.sort), active: !!f.active,
    };
    let id = shift.id;
    if (isNew) {
      const ids = new Set(existing.map(r => r.id));
      id = `sh-${slug(code) || Date.now().toString(36)}`;
      while (ids.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    }
    const res = await runWithReason(() => (isNew
      ? supabase.from('work_shifts').insert({ id, ...payload }).select('id')
      : supabase.from('work_shifts').update(payload).eq('id', id).select('id')), isNew ? 'Thêm ca làm việc' : 'Sửa ca làm việc');
    setSaving(false);
    if (res.error) { toast.error(`Không lưu được: ${res.error.message}`); return; }
    if (!res.data?.length) { toast.error('Không có quyền lưu ca (cần Admin vai trò chính)'); return; }
    toast.success(isNew ? `Đã thêm ${payload.name}` : `Đã lưu ${payload.name}`);
    onSaved();
  };

  return (
    <Drawer open onClose={onClose} title={isNew ? 'Thêm ca làm việc' : `Sửa ${shift.name}`}
      description="Giờ kết thúc nhỏ hơn giờ bắt đầu = ca qua đêm (VD Trực đêm 22:00–08:00)."
      footer={<>
        <button type="button" className="e-btn e-btn-secondary" onClick={onClose} disabled={saving}>Huỷ</button>
        <button type="button" className="e-btn e-btn-primary" onClick={save} disabled={saving || invalid}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
      </>}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã ca" required error={errors.code} hint="VD: SANG, TOI">
            <input className="e-input font-mono uppercase" value={f.code} onChange={set('code')} maxLength={12} autoFocus />
          </Field>
          <Field label="Ký hiệu ngắn" required error={errors.short} hint="Hiện trong ô lịch">
            <input className="e-input" value={f.short} onChange={set('short')} maxLength={8} />
          </Field>
        </div>
        <Field label="Tên ca" required error={errors.name}>
          <input className="e-input" value={f.name} onChange={set('name')} maxLength={60} />
        </Field>
        <label className="inline-flex items-center gap-2 text-[14px] text-slate-700">
          <input type="checkbox" className="e-checkbox" checked={!!f.is_off} onChange={set('is_off')} />
          Đây là ngày nghỉ (không tính giờ làm)
        </label>
        {!f.is_off && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bắt đầu" required error={errors.start_time}>
              <input type="time" className="e-input" value={f.start_time} onChange={set('start_time')} />
            </Field>
            <Field label="Kết thúc" required error={errors.end_time} hint={overnight ? 'Ca qua đêm' : undefined}>
              <input type="time" className="e-input" value={f.end_time} onChange={set('end_time')} />
            </Field>
          </div>
        )}
        <div>
          <span className="e-label">Màu hiển thị</span>
          <div className="flex flex-wrap gap-2">
            {TONES.map(([t, label]) => (
              <button key={t} type="button" onClick={() => setF(x => ({ ...x, tone: t }))} aria-pressed={f.tone === t}
                className={`h-9 px-3 rounded-[10px] text-[13px] font-semibold e-shift-${t} ${f.tone === t ? 'ring-2 ring-teal-600 ring-offset-1' : ''}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Thứ tự hiển thị" error={errors.sort}>
            <input className="e-input" inputMode="numeric" value={f.sort} onChange={(e) => setF(x => ({ ...x, sort: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
          </Field>
          <label className="inline-flex items-center gap-2 text-[14px] text-slate-700 h-10">
            <input type="checkbox" className="e-checkbox" checked={!!f.active} onChange={set('active')} />
            Đang dùng
          </label>
        </div>
        <div className="e-subtle px-4 py-3">
          <div className="e-kv-label mb-1.5">Xem trước</div>
          <span className={`e-shift e-shift-${f.tone} !mx-0`}>{f.short || '—'}</span>
        </div>
      </div>
    </Drawer>
  );
}
