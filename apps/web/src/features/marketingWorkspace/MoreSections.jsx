// ============================================================
// MARKETING WORKSPACE — BASE (S15), AUTOMATION (S16), KHO MEDIA CỦA WORKSPACE (S11), BÁO CÁO (S17), TRỢ LÝ AI (S18)
// Mọi số liệu / dữ liệu lấy từ database thật; AI chỉ đề xuất bản nháp — người dùng duyệt rồi mới tạo thẻ.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Plus, Trash2, Download, Database, Workflow, Sparkles, FolderOpen, Image as ImageIcon, Film, Link2, Paperclip, Power, Bot, Check,
} from 'lucide-react';
import { EmptyState, ErrorState, SearchInput } from '@/components/ds';
import { vnToday } from '@/lib/vnTime';
import { mwApi } from './mwApi';
import { PRIORITY, PLATFORMS, STEP_KIND, bySort, fmtDate, fmtDateTime, vnDateOf, isLate } from './mwMeta';
import { Modal, Field, Skeleton, attempt, BusyButton, Avatar } from './mwUi';
import { errText } from './CollabSections';
import { driveThumb, useKhoAccess } from './KhoSources';

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function downloadCsv(name, head, rows) {
  const blob = new Blob(['﻿' + [head.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${name}-${vnToday()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const uid = () => Math.random().toString(36).slice(2, 9);

// ================= BASE =================
const FIELD_TYPES = { text: 'Chữ', number: 'Số', date: 'Ngày', select: 'Lựa chọn', checkbox: 'Có / không', url: 'Link', person: 'Người' };
const BASE_TEMPLATES = {
  blank: { label: 'Trống', fields: [{ name: 'Tên', type: 'text' }, { name: 'Ghi chú', type: 'text' }] },
  kol: { label: 'KOL / Influencer', fields: [{ name: 'Tên KOL', type: 'text' }, { name: 'Kênh', type: 'select', options: ['TikTok', 'Facebook', 'Instagram', 'YouTube'] }, { name: 'Follower', type: 'number' }, { name: 'Phí (đ)', type: 'number' }, { name: 'Link', type: 'url' }, { name: 'Trạng thái', type: 'select', options: ['Liên hệ', 'Báo giá', 'Đã chốt', 'Đã đăng'] }, { name: 'Phụ trách', type: 'person' }] },
  shoot: { label: 'Lịch quay', fields: [{ name: 'Nội dung quay', type: 'text' }, { name: 'Ngày quay', type: 'date' }, { name: 'Địa điểm', type: 'text' }, { name: 'Quay phim', type: 'person' }, { name: 'Trạng thái', type: 'select', options: ['Lên kế hoạch', 'Đã quay', 'Huỷ'] }, { name: 'Đã có source', type: 'checkbox' }] },
  budget: { label: 'Ngân sách', fields: [{ name: 'Hạng mục', type: 'text' }, { name: 'Kênh', type: 'select', options: ['Facebook Ads', 'TikTok Ads', 'Google', 'KOL', 'Sản xuất'] }, { name: 'Kế hoạch (đ)', type: 'number' }, { name: 'Thực chi (đ)', type: 'number' }, { name: 'Tháng', type: 'date' }] },
};
export function BaseSection({ ws, perm, staffById, memberStaff }) {
  const [st, setSt] = useState({ loading: true, bases: [] });
  const [baseId, setBaseId] = useState('');
  const [newBase, setNewBase] = useState(false);
  const load = useCallback(async () => {
    try { const bases = await mwApi.bases(ws.id); setSt({ loading: false, bases }); setBaseId(id => (bases.some(b => b.id === id) ? id : bases.find(b => !b.archived_at)?.id || '')); }
    catch (e) { setSt({ loading: false, error: e, bases: [] }); }
  }, [ws.id]);
  useEffect(() => { load(); }, [load]);
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={5} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={errText(st.error)} onRetry={load} /></div>;
  const bases = st.bases.filter(b => !b.archived_at);
  const base = bases.find(b => b.id === baseId);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {bases.map(b => <button key={b.id} type="button" className={`e-chip shrink-0 ${b.id === baseId ? 'e-chip-active' : ''}`} onClick={() => setBaseId(b.id)}><Database className="w-4 h-4" />{b.name}</button>)}
        {perm.edit && <button type="button" className="e-chip shrink-0 border-dashed" onClick={() => setNewBase(true)}><Plus className="w-4 h-4" /> Base mới</button>}
      </div>
      {base ? <BaseGrid key={base.id} base={base} perm={perm} staffById={staffById} memberStaff={memberStaff} onBaseChanged={load} />
        : <div className="e-card"><EmptyState icon={Database} title="Chưa có Base" description="Base = bảng dữ liệu tự đặt cột: danh sách KOL, lịch quay, ngân sách… Mỗi cột có kiểu dữ liệu riêng." action={perm.edit && <button type="button" className="e-btn e-btn-primary" onClick={() => setNewBase(true)}><Plus /> Base mới</button>} /></div>}
      <NewBaseModal open={newBase} ws={ws} onClose={() => setNewBase(false)} onCreated={async (id) => { await load(); setBaseId(id); }} />
    </div>
  );
}
function NewBaseModal({ open, ws, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('blank');
  useEffect(() => { if (open) { setName(''); setTpl('blank'); } }, [open]);
  if (!open) return null;
  const save = async () => {
    const fields = BASE_TEMPLATES[tpl].fields.map(f => ({ id: uid(), ...f }));
    const b = await attempt(() => mwApi.createBase({ workspace_id: ws.id, name: name.trim(), fields }), 'Đã tạo Base');
    if (b && b !== true) { onClose(); onCreated(b.id); }
  };
  return (
    <Modal open onClose={onClose} title="Base mới" footer={<><button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button><BusyButton disabled={!name.trim()} onClick={save}>Tạo</BusyButton></>}>
      <Field label="Tên Base" required><input autoFocus className="e-input" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="VD: Danh sách KOL tháng 11" /></Field>
      <div><span className="e-label">Mẫu cột</span><div className="flex flex-wrap gap-1.5">{Object.entries(BASE_TEMPLATES).map(([k, t]) => <button key={k} type="button" className={`e-chip ${tpl === k ? 'e-chip-active' : ''}`} onClick={() => setTpl(k)}>{t.label}</button>)}</div>
        <p className="text-[12px] text-slate-400 mt-1">{BASE_TEMPLATES[tpl].fields.map(f => f.name).join(' · ')}</p></div>
    </Modal>
  );
}
function BaseCell({ field, value, disabled, staffById, memberStaff, onSave }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const cls = 'e-input h-9 text-[13px] min-w-[120px]';
  switch (field.type) {
    case 'checkbox': return <input type="checkbox" className="e-checkbox" checked={!!value} disabled={disabled} aria-label={field.name} onChange={e => onSave(e.target.checked)} />;
    case 'select': return <select className={cls} value={value || ''} disabled={disabled} aria-label={field.name} onChange={e => onSave(e.target.value || null)}><option value="">—</option>{(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}</select>;
    case 'person': return <select className={cls} value={value || ''} disabled={disabled} aria-label={field.name} onChange={e => onSave(e.target.value || null)}><option value="">—</option>{memberStaff.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}{value && !memberStaff.some(p => p.id === value) && <option value={value}>{staffById.get(value)?.full_name || '?'}</option>}</select>;
    case 'date': return <input type="date" className={cls} value={value || ''} disabled={disabled} aria-label={field.name} onChange={e => onSave(e.target.value || null)} />;
    case 'number': return <input type="number" className={`${cls} text-right`} value={v} disabled={disabled} aria-label={field.name} onChange={e => setV(e.target.value)} onBlur={() => { const n = v === '' ? null : Number(v); if (n !== (value ?? null)) onSave(Number.isFinite(n) ? n : null); }} />;
    case 'url': return (
      <div className="flex items-center gap-1">
        <input className={cls} value={v} disabled={disabled} placeholder="https://" aria-label={field.name} onChange={e => setV(e.target.value)} onBlur={() => { const t = v.trim(); if (t !== (value || '')) { if (t && !/^https?:\/\/\S+/.test(t)) { toast.error('Link phải bắt đầu bằng http(s)://'); return; } onSave(t || null); } }} />
        {value && /^https?:\/\//.test(value) && <a href={value} target="_blank" rel="noreferrer noopener" className="e-icon-btn w-8 h-8 shrink-0" aria-label="Mở link"><Link2 className="w-4 h-4" /></a>}
      </div>
    );
    default: return <input className={cls} value={v} disabled={disabled} maxLength={2000} aria-label={field.name} onChange={e => setV(e.target.value)} onBlur={() => { if (v !== (value ?? '')) onSave(v || null); }} />;
  }
}
const cellText = (f, v, staffById) => (v == null || v === '' ? '' : f.type === 'person' ? staffById.get(v)?.full_name || '' : f.type === 'checkbox' ? (v ? 'Có' : '') : String(v));
function BaseGrid({ base, perm, staffById, memberStaff, onBaseChanged }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState('grid');
  const [fieldDlg, setFieldDlg] = useState(null);
  const fields = base.fields || [];
  const load = useCallback(async () => { try { setRows(await mwApi.baseRows(base.id)); setErr(null); } catch (e) { setErr(e); } }, [base.id]);
  useEffect(() => { load(); }, [load]);
  const selectField = fields.find(f => f.type === 'select');
  if (err) return <div className="e-card"><ErrorState description={errText(err)} onRetry={load} /></div>;
  if (!rows) return <div className="e-card e-card-pad"><Skeleton rows={4} /></div>;
  const shown = rows.filter(r => !q.trim() || fields.some(f => cellText(f, r.data[f.id], staffById).toLowerCase().includes(q.trim().toLowerCase())));
  const saveCell = async (r, fid, val) => {
    const data = { ...r.data, [fid]: val };
    if (val == null) delete data[fid];
    setRows(rs => rs.map(x => (x.id === r.id ? { ...x, data } : x)));
    if (!(await attempt(() => mwApi.updateBaseRow(r.id, { data })))) load();
  };
  const addRow = async (preset = {}) => { const r = await attempt(() => mwApi.addBaseRow({ base_id: base.id, data: preset, sort_index: (rows.length + 1) * 1024 })); if (r && r !== true) setRows(rs => [...rs, r]); };
  const saveFields = async (next) => { if (await attempt(() => mwApi.updateBase(base.id, { fields: next }), 'Đã lưu cột')) onBaseChanged(); };
  const exportCsv = () => downloadCsv(base.name, fields.map(f => f.name), shown.map(r => fields.map(f => cellText(f, r.data[f.id], staffById))));
  return (
    <div className="e-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <SearchInput value={q} onChange={setQ} placeholder="Tìm trong Base…" className="w-full sm:w-64" />
        <div className="e-seg">
          <button type="button" className={`e-seg-item ${view === 'grid' ? 'e-seg-active' : ''}`} onClick={() => setView('grid')}>Bảng</button>
          <button type="button" className={`e-seg-item ${view === 'kanban' ? 'e-seg-active' : ''}`} disabled={!selectField} title={selectField ? '' : 'Cần 1 cột kiểu Lựa chọn'} onClick={() => setView('kanban')}>Kanban</button>
        </div>
        <span className="text-[12px] text-slate-400">{shown.length} dòng</span>
        <div className="ml-auto flex gap-1.5">
          {perm.edit && <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={() => setFieldDlg({})}><Plus /> Cột</button>}
          <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={exportCsv}><Download /> CSV</button>
          {perm.edit && <BusyButton className="e-btn e-btn-primary e-btn-sm" onClick={() => addRow()}><Plus /> Dòng</BusyButton>}
        </div>
      </div>
      {view === 'kanban' && selectField ? (
        <div className="overflow-x-auto p-3"><div className="flex gap-3 min-w-max">
          {[...(selectField.options || []), ''].map(opt => {
            const items = shown.filter(r => (r.data[selectField.id] || '') === opt);
            return (
              <section key={opt || '_none'} className="w-[260px] rounded-2xl bg-slate-50 border border-slate-100 p-2.5 space-y-2">
                <h4 className="text-[13px] font-bold text-slate-700 px-1">{opt || 'Chưa chọn'} <span className="text-slate-400 font-normal">· {items.length}</span></h4>
                {items.map(r => (
                  <div key={r.id} className="rounded-xl bg-white border border-slate-200 p-2.5 text-[12.5px] space-y-0.5">
                    {fields.filter(f => f.id !== selectField.id).slice(0, 4).map(f => cellText(f, r.data[f.id], staffById) && <div key={f.id}><span className="text-slate-400">{f.name}: </span>{cellText(f, r.data[f.id], staffById)}</div>)}
                    {perm.edit && <select className="e-input h-8 text-[12px] mt-1" value={r.data[selectField.id] || ''} aria-label={`Chuyển ${selectField.name}`} onChange={e => saveCell(r, selectField.id, e.target.value || null)}><option value="">Chưa chọn</option>{selectField.options.map(o => <option key={o} value={o}>{o}</option>)}</select>}
                  </div>
                ))}
                {perm.edit && opt && <button type="button" className="text-[12.5px] text-slate-500 hover:text-teal-700" onClick={() => addRow({ [selectField.id]: opt })}>+ Thêm</button>}
              </section>
            );
          })}
        </div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="e-table min-w-[720px]">
            <thead><tr>
              {fields.map(f => <th key={f.id} scope="col"><button type="button" className="text-left" disabled={!perm.edit} onClick={() => setFieldDlg(f)} title={perm.edit ? 'Sửa cột' : undefined}>{f.name} <span className="text-slate-400 font-normal text-[11px]">· {FIELD_TYPES[f.type]}</span></button></th>)}
              <th scope="col" className="w-10" />
            </tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}>
                  {fields.map(f => <td key={f.id}><BaseCell field={f} value={r.data[f.id]} disabled={!perm.edit} staffById={staffById} memberStaff={memberStaff} onSave={(v) => saveCell(r, f.id, v)} /></td>)}
                  <td>{perm.edit && <BusyButton className="e-icon-btn w-8 h-8" title="Xoá dòng" onClick={async () => { if (await attempt(() => mwApi.deleteBaseRow(r.id))) setRows(rs => rs.filter(x => x.id !== r.id)); }}><Trash2 className="w-4 h-4" /></BusyButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <EmptyState title="Chưa có dòng" />}
        </div>
      )}
      <FieldModal field={fieldDlg} fields={fields} onClose={() => setFieldDlg(null)} onSave={async (next) => { await saveFields(next); setFieldDlg(null); }} />
    </div>
  );
}
function FieldModal({ field, fields, onClose, onSave }) {
  const [f, setF] = useState(null);
  useEffect(() => { if (field) setF({ id: field.id || uid(), name: field.name || '', type: field.type || 'text', options: (field.options || []).join('\n') }); }, [field]);
  if (!field || !f) return null;
  const isNew = !field.id;
  const out = () => ({ id: f.id, name: f.name.trim(), type: f.type, ...(f.type === 'select' ? { options: f.options.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 50) } : {}) });
  return (
    <Modal open onClose={onClose} title={isNew ? 'Thêm cột' : `Cột “${field.name}”`} footer={<>
      {!isNew && <BusyButton className="e-btn e-btn-danger-soft mr-auto" onClick={() => { if (window.confirm('Xoá cột? Dữ liệu cột này trong các dòng sẽ bị bỏ qua.')) return onSave(fields.filter(x => x.id !== field.id)); return null; }}><Trash2 /> Xoá cột</BusyButton>}
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton disabled={!f.name.trim()} onClick={() => onSave(isNew ? [...fields, out()] : fields.map(x => (x.id === field.id ? out() : x)))}>Lưu</BusyButton>
    </>}>
      <Field label="Tên cột" required><input autoFocus className="e-input" value={f.name} maxLength={60} onChange={e => setF(v => ({ ...v, name: e.target.value }))} /></Field>
      <Field label="Kiểu dữ liệu"><select className="e-input" value={f.type} aria-label="Kiểu dữ liệu" onChange={e => setF(v => ({ ...v, type: e.target.value }))}>{Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      {f.type === 'select' && <Field label="Các lựa chọn (mỗi dòng 1 lựa chọn)"><textarea className="e-textarea" value={f.options} onChange={e => setF(v => ({ ...v, options: e.target.value }))} /></Field>}
    </Modal>
  );
}

// ================= AUTOMATION =================
const ACTION_TYPES = { assign: 'Giao cho', add_label: 'Gắn nhãn', set_due_days: 'Đặt hạn sau N ngày (17:00)', set_priority: 'Đổi ưu tiên', add_checklist: 'Thêm checklist', notify: 'Gửi thông báo cho' };
const TRIGGERS = { moved_to_list: 'Khi thẻ được kéo VÀO cột', created_in_list: 'Khi thẻ được TẠO trong cột' };
export function AutomationSection({ ws, perm, boards, labels, staffById, memberStaff }) {
  const [st, setSt] = useState({ loading: true });
  const [lists, setLists] = useState([]);
  const [dlg, setDlg] = useState(false);
  const load = useCallback(async () => {
    try {
      const autos = await mwApi.automations(ws.id);
      const bIds = boards.map(b => b.id);
      const [ls, runs] = await Promise.all([bIds.length ? mwApi.lists(bIds) : [], mwApi.automationRuns(autos.map(a => a.id))]);
      setLists(ls); setSt({ loading: false, autos, runs });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id, boards]);
  useEffect(() => { load(); }, [load]);
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={4} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={errText(st.error)} onRetry={load} /></div>;
  const listName = new Map(lists.map(l => [l.id, l.name]));
  const boardName = new Map(boards.map(b => [b.id, b.name]));
  const labelName = new Map(labels.map(l => [l.id, l.name]));
  const describe = (a) => (a.actions || []).map(x => {
    switch (x.type) {
      case 'assign': return `giao cho ${staffById.get(x.user_id)?.full_name || '?'}`;
      case 'add_label': return `gắn nhãn “${labelName.get(x.label_id) || '?'}”`;
      case 'set_due_days': return `hạn sau ${x.days} ngày`;
      case 'set_priority': return `ưu tiên ${PRIORITY[x.value]?.label || x.value}`;
      case 'add_checklist': return `thêm checklist (${(x.items || []).length} mục)`;
      case 'notify': return `báo ${staffById.get(x.user_id)?.full_name || '?'}`;
      default: return x.type;
    }
  }).join(', ');
  return (
    <div className="space-y-3">
      <div className="e-alert e-alert-info text-[13px]">Automation chạy trong database ngay khi thẻ được tạo / kéo vào cột — kể cả khi bạn không mở app. Luật không tự di chuyển thẻ nên không tạo vòng lặp; mỗi lần chạy có nhật ký.</div>
      {perm.manage && <div className="flex justify-end"><button type="button" className="e-btn e-btn-primary" onClick={() => setDlg(true)}><Plus /> Luật mới</button></div>}
      {!st.autos.length ? <div className="e-card"><EmptyState icon={Workflow} title="Chưa có luật automation" description="VD: Khi thẻ vào cột “Đang dựng” → giao cho editor, hạn sau 2 ngày, thêm checklist “Cắt hook / Chèn logo / Phụ đề”." /></div> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {st.autos.map(a => {
            const runs = st.runs.filter(r => r.automation_id === a.id).slice(0, 5);
            return (
              <article key={a.id} className={`e-card e-card-pad space-y-2 ${a.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1"><div className="text-[14.5px] font-bold text-slate-900">{a.name}</div>
                    <div className="text-[12.5px] text-slate-500">{TRIGGERS[a.trigger_type]} “{listName.get(a.list_id) || '?'}” · {boardName.get(a.board_id) || ''}</div></div>
                  {perm.manage && <BusyButton className={`e-btn e-btn-sm ${a.enabled ? 'e-btn-secondary' : 'e-btn-primary'}`} onClick={async () => { if (await attempt(() => mwApi.updateAutomation(a.id, { enabled: !a.enabled }), a.enabled ? 'Đã tắt luật' : 'Đã bật luật')) load(); }}><Power /> {a.enabled ? 'Tắt' : 'Bật'}</BusyButton>}
                  {perm.manage && <BusyButton className="e-icon-btn w-8 h-8" title="Xoá luật" onClick={async () => { if (window.confirm(`Xoá luật “${a.name}”?`) && await attempt(() => mwApi.deleteAutomation(a.id), 'Đã xoá luật')) load(); }}><Trash2 className="w-4 h-4" /></BusyButton>}
                </div>
                <div className="text-[13px] text-slate-700">→ {describe(a)}</div>
                <div className="text-[11.5px] text-slate-400 space-y-0.5">
                  {runs.length === 0 ? 'Chưa chạy lần nào' : runs.map(r => <div key={r.id} className={r.ok ? '' : 'text-danger-600'}>{fmtDateTime(r.created_at)} · {r.ok ? `✓ ${r.detail || ''}` : `✗ ${r.detail}`}</div>)}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <AutomationModal open={dlg} onClose={() => setDlg(false)} ws={ws} boards={boards.filter(b => !b.archived_at)} labels={labels} memberStaff={memberStaff} onDone={load} />
    </div>
  );
}
function AutomationModal({ open, onClose, ws, boards, labels, memberStaff, onDone }) {
  const [f, setF] = useState(null);
  const [lists, setLists] = useState([]);
  useEffect(() => { if (open) setF({ name: '', board_id: boards[0]?.id || '', trigger_type: 'moved_to_list', list_id: '', actions: [{ type: 'assign', user_id: '' }] }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!f?.board_id) return;
    mwApi.lists([f.board_id]).then(ls => { const a = ls.filter(l => !l.archived_at).sort(bySort); setLists(a); setF(v => ({ ...v, list_id: a.some(l => l.id === v.list_id) ? v.list_id : a[0]?.id || '' })); }).catch(() => {});
  }, [f?.board_id]);
  if (!open || !f) return null;
  const setAct = (i, patch) => setF(v => ({ ...v, actions: v.actions.map((a, k) => (k === i ? { ...a, ...patch } : a)) }));
  const valid = f.name.trim() && f.list_id && f.actions.length && f.actions.every(a =>
    (a.type === 'assign' || a.type === 'notify') ? a.user_id : a.type === 'add_label' ? a.label_id : a.type === 'set_due_days' ? Number.isInteger(Number(a.days)) && Number(a.days) >= 0 : a.type === 'set_priority' ? a.value : a.type === 'add_checklist' ? (a.text || '').trim() : false);
  const save = async () => {
    const actions = f.actions.map(a => (a.type === 'add_checklist' ? { type: a.type, items: a.text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20) }
      : a.type === 'set_due_days' ? { type: a.type, days: Number(a.days) } : a));
    if (await attempt(() => mwApi.createAutomation({ workspace_id: ws.id, board_id: f.board_id, name: f.name.trim(), trigger_type: f.trigger_type, list_id: f.list_id, actions }), 'Đã tạo luật')) { onClose(); onDone(); }
  };
  const listName = lists.find(l => l.id === f.list_id)?.name;
  return (
    <Modal open onClose={onClose} title="Luật automation mới" size="max-w-2xl" footer={<><button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button><BusyButton disabled={!valid} onClick={save}>Tạo luật</BusyButton></>}>
      <Field label="Tên luật" required><input autoFocus className="e-input" value={f.name} maxLength={120} onChange={e => setF(v => ({ ...v, name: e.target.value }))} placeholder="VD: Vào Đang dựng → giao editor" /></Field>
      <div className="grid sm:grid-cols-3 gap-2">
        <Field label="Board"><select className="e-input" aria-label="Board" value={f.board_id} onChange={e => setF(v => ({ ...v, board_id: e.target.value }))}>{boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Khi nào"><select className="e-input" aria-label="Khi nào" value={f.trigger_type} onChange={e => setF(v => ({ ...v, trigger_type: e.target.value }))}>{Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Cột"><select className="e-input" aria-label="Cột" value={f.list_id} onChange={e => setF(v => ({ ...v, list_id: e.target.value }))}>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      </div>
      <div className="space-y-2">
        <span className="e-label">Thì làm</span>
        {f.actions.map((a, i) => (
          <div key={i} className="grid grid-cols-[180px_1fr_auto] gap-2 items-start">
            <select className="e-input" aria-label="Hành động" value={a.type} onChange={e => setAct(i, { type: e.target.value })}>{Object.entries(ACTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            {(a.type === 'assign' || a.type === 'notify') && <select className="e-input" aria-label="Người" value={a.user_id || ''} onChange={e => setAct(i, { user_id: e.target.value })}><option value="">Chọn người…</option>{memberStaff.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>}
            {a.type === 'add_label' && <select className="e-input" aria-label="Nhãn" value={a.label_id || ''} onChange={e => setAct(i, { label_id: e.target.value })}><option value="">Chọn nhãn…</option>{labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            {a.type === 'set_due_days' && <input type="number" min={0} max={365} className="e-input" aria-label="Số ngày" value={a.days ?? ''} onChange={e => setAct(i, { days: e.target.value })} placeholder="Số ngày" />}
            {a.type === 'set_priority' && <select className="e-input" aria-label="Ưu tiên" value={a.value || ''} onChange={e => setAct(i, { value: e.target.value })}><option value="">Chọn…</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>}
            {a.type === 'add_checklist' && <textarea className="e-textarea min-h-[64px]" aria-label="Các mục checklist" value={a.text || ''} onChange={e => setAct(i, { text: e.target.value })} placeholder={'Mỗi dòng 1 mục\nCắt hook\nChèn logo'} />}
            <button type="button" className="e-icon-btn w-9 h-9" aria-label="Bỏ hành động" disabled={f.actions.length <= 1} onClick={() => setF(v => ({ ...v, actions: v.actions.filter((_, k) => k !== i) }))}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {f.actions.length < 10 && <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => setF(v => ({ ...v, actions: [...v.actions, { type: 'set_due_days', days: 2 }] }))}><Plus /> Thêm hành động</button>}
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-[12.5px] text-slate-600"><b>Xem trước:</b> {TRIGGERS[f.trigger_type]} “{listName || '…'}” → {f.actions.map(a => ACTION_TYPES[a.type]).join(', ')}.</div>
    </Modal>
  );
}

// ================= KHO MEDIA CỦA WORKSPACE =================
const KIND = { image: { label: 'Ảnh', icon: ImageIcon }, video: { label: 'Video', icon: Film }, link: { label: 'Link', icon: Link2 }, file: { label: 'Tệp', icon: Paperclip }, kho: { label: 'Source Kho', icon: FolderOpen } };
const kindOf = (mime, hasSha) => (/^image\//.test(mime || '') ? 'image' : /^video\//.test(mime || '') ? 'video' : (mime || hasSha) ? 'file' : 'link');
export function WsMediaSection({ ws, boards, openTask }) {
  const kho = useKhoAccess();
  const [st, setSt] = useState({ loading: true });
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const load = useCallback(async () => {
    try {
      const bIds = boards.map(b => b.id);
      const tasks = bIds.length ? await mwApi.tasks(bIds) : [];
      const tIds = tasks.map(t => t.id);
      const [atts, contents] = await Promise.all([mwApi.boardAttachments(tIds), mwApi.contents()]);
      const mine = contents.filter(c => c.workspace_id === ws.id);
      const versions = await mwApi.versions(mine.map(c => c.id));
      let srcs = [];
      if (kho) {
        const links = await mwApi.taskSources(tIds).catch(() => []);
        const [ss, as] = await Promise.all([mwApi.khoSourcesByIds([...new Set(links.map(l => l.media_customer_id))]).catch(() => []), mwApi.khoAssets([...new Set(links.map(l => l.media_customer_id))]).catch(() => [])]);
        const sMap = new Map(ss.map(s => [s.id, s]));
        srcs = links.map(l => ({ key: `k${l.id}`, kind: 'kho', name: `${sMap.get(l.media_customer_id)?.source_id || 'Source'}${l.media_asset_id ? ` · ${as.find(a => a.id === l.media_asset_id)?.name || ''}` : ''}`,
          thumb: driveThumb(as.find(a => a.id === l.media_asset_id) || as.find(a => a.media_customer_id === l.media_customer_id)), url: (as.find(a => a.id === l.media_asset_id) || {}).web_link, taskId: l.task_id, at: l.created_at }));
      }
      const tName = new Map(tasks.map(t => [t.id, t.title]));
      const cName = new Map(mine.map(c => [c.id, c.title]));
      const items = [
        ...atts.map((a, i) => ({ key: `a${i}`, kind: kindOf(a.mime, false), name: a.name, url: a.url, thumb: /^image\//.test(a.mime || '') ? a.url : null, taskId: a.task_id, from: tName.get(a.task_id), at: a.created_at })),
        ...versions.filter(v => v.kind === 'asset').map(v => ({ key: `v${v.id}`, kind: kindOf(v.mime, true), name: `${v.file_name || 'Tệp'} (v${v.revision})`, url: v.file_url, thumb: /^image\//.test(v.mime || '') ? v.file_url : null, from: `Nội dung: ${cName.get(v.content_id) || ''}`, at: v.created_at })),
        ...srcs.map(x => ({ ...x, from: tName.get(x.taskId) })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at));
      setSt({ loading: false, items });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id, boards, kho]);
  useEffect(() => { if (kho !== null) load(); }, [load, kho]);
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={4} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const shown = st.items.filter(x => (!kind || x.kind === kind) && (!q.trim() || `${x.name} ${x.from || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Tìm tệp, thẻ…" className="w-full sm:w-64" />
        <button type="button" className={`e-chip ${!kind ? 'e-chip-active' : ''}`} onClick={() => setKind('')}>Tất cả · {st.items.length}</button>
        {Object.entries(KIND).filter(([k]) => k !== 'kho' || kho).map(([k, v]) => <button key={k} type="button" className={`e-chip ${kind === k ? 'e-chip-active' : ''}`} onClick={() => setKind(k)}><v.icon className="w-4 h-4" />{v.label} · {st.items.filter(x => x.kind === k).length}</button>)}
      </div>
      <p className="text-[12px] text-slate-400">Tổng hợp mọi ảnh / video / link / tệp đính kèm thẻ, tệp phiên bản nội dung{kho ? ' và source Kho Media đã gắn' : ''} của workspace. Kho Media gốc: menu Marketing › Kho Media.</p>
      {!shown.length ? <div className="e-card"><EmptyState icon={FolderOpen} title="Chưa có tệp" /></div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {shown.map(x => {
            const K = KIND[x.kind];
            return (
              <article key={x.key} className="e-card overflow-hidden">
                <a href={x.url || undefined} target="_blank" rel="noreferrer noopener" className="block aspect-video bg-slate-100 grid place-items-center">
                  {x.thumb ? <img src={x.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <K.icon className="w-6 h-6 text-slate-300" />}
                </a>
                <div className="p-2.5 space-y-0.5">
                  <div className="text-[12.5px] font-semibold text-slate-800 truncate" title={x.name}>{x.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{K.label} · {fmtDate(x.at)}</div>
                  {x.taskId ? <button type="button" className="text-[11.5px] text-teal-700 truncate block max-w-full" onClick={() => openTask(x.taskId)}>{x.from || 'Mở thẻ'}</button> : <div className="text-[11.5px] text-slate-500 truncate">{x.from}</div>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= BÁO CÁO =================
export function ReportsSection({ ws, boards, staffById }) {
  const [days, setDays] = useState(30);
  const [st, setSt] = useState({ loading: true });
  const load = useCallback(async () => {
    try {
      const bIds = boards.map(b => b.id);
      const [tasks, archived, lists] = bIds.length ? await Promise.all([mwApi.tasks(bIds), mwApi.tasks(bIds, { archived: true }), mwApi.lists(bIds)]) : [[], [], []];
      const all = [...tasks, ...archived];
      const [asg, contents, pubs, runs] = await Promise.all([mwApi.assignees(all.map(t => t.id)), mwApi.contents(), mwApi.publications(), mwApi.allRuns()]);
      const cIds = new Set(contents.filter(c => c.workspace_id === ws.id).map(c => c.id));
      const myRuns = runs.filter(r => cIds.has(r.content_id));
      const steps = await mwApi.steps(myRuns.map(r => r.id));
      setSt({ loading: false, tasks: all, open: tasks, lists, asg, pubs: pubs.filter(p => cIds.has(p.content_id)), runs: myRuns, steps, at: new Date().toISOString() });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id, boards]);
  useEffect(() => { load(); }, [load]);
  const r = useMemo(() => {
    if (st.loading || st.error) return null;
    const since = Date.now() - days * 86400000;
    const doneIds = new Set(st.lists.filter(l => l.is_done).map(l => l.id));
    const done = st.tasks.filter(t => t.completed_at && new Date(t.completed_at).getTime() >= since);
    const onTime = done.filter(t => !t.due_at || new Date(t.completed_at) <= new Date(t.due_at));
    const cycle = done.map(t => (new Date(t.completed_at) - new Date(t.created_at)) / 86400000);
    const lateOpen = st.open.filter(t => isLate(t, doneIds));
    // theo tuần (thứ 2 đầu tuần, giờ VN)
    const weekKey = (iso) => { const d = new Date(`${vnDateOf(iso)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
    const weeks = new Map();
    done.forEach(t => { const k = weekKey(t.completed_at); weeks.set(k, (weeks.get(k) || 0) + 1); });
    const chart = [...weeks.entries()].sort().map(([k, n]) => ({ w: `${k.slice(8)}/${k.slice(5, 7)}`, n }));
    // theo người
    const per = new Map();
    const bump = (uid, k) => { const o = per.get(uid) || { assigned: 0, done: 0, onTime: 0, late: 0 }; o[k] += 1; per.set(uid, o); };
    const doneSet = new Set(done.map(t => t.id)); const onSet = new Set(onTime.map(t => t.id)); const lateSet = new Set(lateOpen.map(t => t.id));
    const recent = new Set(st.tasks.filter(t => new Date(t.created_at).getTime() >= since || doneSet.has(t.id) || lateSet.has(t.id)).map(t => t.id));
    st.asg.forEach(a => { if (!recent.has(a.task_id)) return; bump(a.user_id, 'assigned'); if (doneSet.has(a.task_id)) bump(a.user_id, 'done'); if (onSet.has(a.task_id)) bump(a.user_id, 'onTime'); if (lateSet.has(a.task_id)) bump(a.user_id, 'late'); });
    const people = [...per.entries()].map(([id, o]) => ({ id, ...o, rate: o.done ? Math.round((o.onTime / o.done) * 100) : null })).sort((a, b) => b.done - a.done);
    // duyệt: thời gian xử lý mỗi bước (từ lúc gửi / bước trước tới lúc quyết định)
    const stepDur = {};
    st.runs.filter(x => new Date(x.created_at).getTime() >= since).forEach(run => {
      let prev = new Date(run.created_at);
      st.steps.filter(s => s.run_id === run.id && s.acted_at).sort((a, b) => a.seq - b.seq).forEach(s => {
        const h = (new Date(s.acted_at) - prev) / 3600000; prev = new Date(s.acted_at);
        (stepDur[s.kind] = stepDur[s.kind] || []).push(h);
      });
    });
    const runsIn = st.runs.filter(x => new Date(x.created_at).getTime() >= since);
    const pubs = st.pubs.filter(p => p.state === 'published' && p.verified_at && new Date(p.verified_at).getTime() >= since);
    const byPlatform = Object.keys(PLATFORMS).map(k => ({ k, n: pubs.filter(p => p.platform === k).length })).filter(x => x.n);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return { done, onTime, cycle: avg(cycle), lateOpen, chart, people, stepDur, runsIn, pubs, byPlatform, avg };
  }, [st, days]);
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={6} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const name = (id) => staffById.get(id)?.full_name || 'Không rõ';
  const Kpi = ({ label, value, hint }) => <div className="e-metric"><span className="min-w-0"><span className="e-metric-label block">{label}</span><span className="e-metric-value block">{value}</span>{hint && <span className="e-metric-hint block">{hint}</span>}</span></div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="e-seg">{[7, 30, 90].map(d => <button key={d} type="button" className={`e-seg-item ${days === d ? 'e-seg-active' : ''}`} onClick={() => setDays(d)}>{d} ngày</button>)}</div>
        <span className="text-[12px] text-slate-400">Nguồn: thẻ, người phụ trách, lượt duyệt, bài đăng của workspace · tải lúc {fmtDateTime(st.at)}</span>
        <button type="button" className="e-btn e-btn-secondary e-btn-sm ml-auto" onClick={() => downloadCsv('bao-cao-nhan-su', ['Người', 'Được giao', 'Hoàn thành', 'Đúng hạn', '% đúng hạn', 'Đang trễ'], r.people.map(p => [name(p.id), p.assigned, p.done, p.onTime, p.rate ?? '', p.late]))}><Download /> CSV theo người</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Thẻ hoàn thành" value={r.done.length} hint={`${days} ngày qua`} />
        <Kpi label="Đúng hạn" value={r.done.length ? `${Math.round((r.onTime.length / r.done.length) * 100)}%` : '—'} hint={`${r.onTime.length}/${r.done.length} thẻ`} />
        <Kpi label="Thời gian làm TB" value={r.cycle != null ? `${r.cycle.toFixed(1)} ngày` : '—'} hint="Từ lúc tạo đến khi xong" />
        <Kpi label="Đang trễ hạn" value={r.lateOpen.length} hint="Thẻ chưa xong" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Hoàn thành theo tuần</div>
          {r.chart.length ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.chart} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} /><XAxis dataKey="w" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} /><Tooltip formatter={(v) => [v, 'Thẻ hoàn thành']} /><Bar dataKey="n" fill="#087F83" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div> : <p className="text-[13px] text-slate-400">Chưa có thẻ hoàn thành trong khoảng này.</p>}
        </div>
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Theo người</div>
          {!r.people.length ? <p className="text-[13px] text-slate-400">Chưa có dữ liệu.</p> : (
            <table className="e-table"><thead><tr><th>Người</th><th className="text-right">Giao</th><th className="text-right">Xong</th><th className="text-right">Đúng hạn</th><th className="text-right">Trễ</th></tr></thead>
              <tbody>{r.people.map(p => <tr key={p.id}><td><span className="inline-flex items-center gap-2"><Avatar person={staffById.get(p.id)} size={24} />{name(p.id)}</span></td><td className="text-right tabular-nums">{p.assigned}</td><td className="text-right tabular-nums">{p.done}</td><td className="text-right tabular-nums">{p.rate != null ? `${p.rate}%` : '—'}</td><td className={`text-right tabular-nums ${p.late ? 'text-danger-600 font-semibold' : ''}`}>{p.late}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Duyệt nội dung</div>
          <p className="text-[13px] text-slate-600 mb-2">{r.runsIn.length} lượt gửi duyệt · {r.runsIn.filter(x => x.state === 'approved').length} duyệt đủ · {r.runsIn.filter(x => ['revision_requested', 'rejected'].includes(x.state)).length} trả lại / từ chối · {r.runsIn.filter(x => x.state === 'invalidated').length} mất hiệu lực</p>
          {Object.keys(r.stepDur).length ? <ul className="text-[13px] space-y-1">{Object.entries(r.stepDur).map(([k, a]) => <li key={k} className="flex justify-between"><span>{STEP_KIND[k]}</span><b className="tabular-nums">{r.avg(a).toFixed(1)} giờ TB · {a.length} lượt</b></li>)}</ul> : <p className="text-[13px] text-slate-400">Chưa có bước duyệt nào được xử lý.</p>}
        </div>
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Bài đã đăng (đã xác minh)</div>
          {!r.byPlatform.length ? <p className="text-[13px] text-slate-400">Chưa có bài đăng được xác minh trong khoảng này.</p> : <ul className="text-[13px] space-y-1">{r.byPlatform.map(x => <li key={x.k} className="flex justify-between"><span>{PLATFORMS[x.k]}</span><b className="tabular-nums">{x.n}</b></li>)}</ul>}
          <p className="text-[11.5px] text-slate-400 mt-2">Lượt xem / tương tác / chi phí: chưa kết nối nguồn số liệu mạng xã hội — không hiển thị số ước đoán.</p>
        </div>
      </div>
    </div>
  );
}

// ================= TRỢ LÝ AI =================
export function AiSection({ ws, perm, boards }) {
  const active = boards.filter(b => !b.archived_at);
  const [prompt, setPrompt] = useState('');
  const [boardId, setBoardId] = useState(active[0]?.id || '');
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState('');
  const [res, setRes] = useState(null);
  const [pick, setPick] = useState(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!boardId) return;
    mwApi.lists([boardId]).then(ls => { const a = ls.filter(l => !l.archived_at).sort(bySort); setLists(a); setListId(a[0]?.id || ''); }).catch(() => {});
  }, [boardId]);
  const run = async () => {
    setBusy(true); setRes(null);
    try {
      const board = active.find(b => b.id === boardId);
      const data = await mwApi.aiSuggest({ prompt: prompt.trim().slice(0, 2000), context: { workspace: ws.name, board: board?.name, columns: lists.map(l => l.name) } });
      const cards = (data.cards || []).slice(0, 30);
      setRes(cards); setPick(new Set(cards.map((_, i) => i)));
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const commit = async () => {
    let n = 0;
    for (const [i, c] of res.entries()) {
      if (!pick.has(i)) continue;
      const t = await attempt(() => mwApi.createTask(boardId, listId, c.title.slice(0, 300), { description: `${c.description || ''}\n\n— Bản nháp do Trợ lý AI đề xuất, đã được người dùng chọn tạo. Cần kiểm tra chuyên môn trước khi sản xuất.`.slice(0, 20000), priority: PRIORITY[c.priority] ? c.priority : 'normal' }));
      if (!t || t === true) continue;
      n += 1;
      for (const item of (c.checklist || []).slice(0, 15)) await attempt(() => mwApi.addCheck(t.id, String(item).slice(0, 300)));
    }
    toast.success(`Đã tạo ${n} thẻ từ đề xuất AI`);
    setRes(null); setPrompt('');
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="e-card e-card-pad space-y-3">
        <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-teal-700" /><div className="e-card-title">Trợ lý AI lên kế hoạch / ý tưởng</div></div>
        <textarea className="e-textarea min-h-[110px]" value={prompt} maxLength={2000} onChange={e => setPrompt(e.target.value)} placeholder="VD: Lập 20 chủ đề video ngắn về phẫu thuật xương hàm cho tháng 11, mỗi chủ đề có hook và checklist sản xuất" />
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Tạo vào board"><select className="e-input" aria-label="Board" value={boardId} onChange={e => setBoardId(e.target.value)}>{active.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Cột"><select className="e-input" aria-label="Cột" value={listId} onChange={e => setListId(e.target.value)}>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        </div>
        <button type="button" className="e-btn e-btn-primary" disabled={!prompt.trim() || busy || !perm.edit || !active.length} onClick={run}><Sparkles /> {busy ? 'AI đang soạn…' : 'Đề xuất'}</button>
        {res && (
          <div className="space-y-2">
            <div className="e-alert e-alert-warning text-[12.5px]"><b>Bản nháp AI</b> — chưa có gì được tạo. Chọn thẻ muốn giữ, sửa sau trong thẻ. Nội dung y khoa vẫn phải qua bác sĩ duyệt.</div>
            {res.length === 0 && <p className="text-[13px] text-slate-400">AI không đưa ra đề xuất nào.</p>}
            {res.map((c, i) => (
              <label key={i} className={`flex gap-2.5 p-2.5 rounded-xl border cursor-pointer ${pick.has(i) ? 'border-teal-400 bg-teal-50/40' : 'border-slate-200'}`}>
                <input type="checkbox" className="e-checkbox mt-0.5" checked={pick.has(i)} onChange={() => setPick(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                <span className="min-w-0"><span className="block text-[13.5px] font-semibold text-slate-800">{c.title}</span>
                  {c.description && <span className="block text-[12.5px] text-slate-500">{c.description}</span>}
                  {(c.checklist || []).length > 0 && <span className="block text-[12px] text-slate-400 mt-0.5">☑ {c.checklist.join(' · ')}</span>}</span>
              </label>
            ))}
            {res.length > 0 && <div className="flex gap-2"><BusyButton disabled={!pick.size || !listId} onClick={commit}><Check /> Tạo {pick.size} thẻ đã chọn</BusyButton><button type="button" className="e-btn e-btn-ghost" onClick={() => setRes(null)}>Bỏ hết</button></div>}
          </div>
        )}
      </div>
      <aside className="e-card e-card-pad text-[12.5px] text-slate-600 space-y-2">
        <div className="e-card-title text-[14px]">AI thấy gì / làm được gì</div>
        <p>AI chỉ nhận: <b>câu yêu cầu bạn gõ</b>, tên workspace, tên board và tên các cột. Không gửi dữ liệu khách hàng, source Kho Media, bình luận hay tài liệu.</p>
        <p>AI <b>không tự tạo, tự duyệt hay tự đăng</b> gì: chỉ trả về danh sách đề xuất; bạn chọn rồi mới tạo thẻ.</p>
        <p className="text-slate-400">Chạy qua Edge Function <span className="font-mono">mw-ai</span> (khoá OpenAI để ở Supabase Secrets, không nằm trong trình duyệt).</p>
      </aside>
    </div>
  );
}
