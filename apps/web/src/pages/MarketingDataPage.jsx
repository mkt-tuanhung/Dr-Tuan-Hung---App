import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { parseCSV, downloadCsv } from '@/lib/csv';
import { Database, Plus, Upload, Search, X, Trash2, Link2, Download } from 'lucide-react';

const STATUS = {
  tiep_can: { label: 'Tiếp cận', cls: 'bg-slate-100 text-slate-600' },
  nong: { label: 'Nóng', cls: 'bg-rose-100 text-rose-700' },
  tiem_nang: { label: 'Tiềm năng', cls: 'bg-amber-100 text-amber-700' },
  da_hen_lich: { label: 'Đã hẹn lịch', cls: 'bg-blue-100 text-blue-700' },
  coc: { label: 'Cọc', cls: 'bg-violet-100 text-violet-700' },
  da_lam_dv: { label: 'Đã làm dịch vụ', cls: 'bg-emerald-100 text-emerald-700' },
  sai_gon: { label: 'Sài Gòn', cls: 'bg-cyan-100 text-cyan-700' },
  chot_fail: { label: 'Chốt Fail', cls: 'bg-orange-100 text-orange-700' },
  mat: { label: 'Mất', cls: 'bg-slate-200 text-slate-500' },
};
const LABEL_TO_CODE = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [v.label.toLowerCase(), k]));
const phoneKey = (p) => { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('84')) d = '0' + d.slice(2); return d.slice(-9); };
const APPT_STAGE = (a) => {
  if (!a) return null;
  if (a.post_op_status) return { label: 'Hậu phẫu / CSKH', cls: 'bg-teal-100 text-teal-700' };
  return ({ scheduled: { label: 'Lịch hẹn', cls: 'bg-blue-100 text-blue-700' }, coc: { label: 'Cọc', cls: 'bg-violet-100 text-violet-700' }, bong: { label: 'Bong', cls: 'bg-rose-100 text-rose-700' }, phau_thuat: { label: 'Phẫu thuật', cls: 'bg-emerald-100 text-emerald-700' }, cancelled: { label: 'Đã huỷ', cls: 'bg-slate-100 text-slate-400' } })[a.status] || { label: a.status, cls: 'bg-slate-100 text-slate-500' };
};
const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none';

const MarketingDataPage = () => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const canWrite = ['marketing', 'truc_page', 'admin'].some(r => roles.includes(r));

  const [rows, setRows] = useState([]);
  const [apptMap, setApptMap] = useState({});
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fTruc, setFTruc] = useState('');
  const [edit, setEdit] = useState(null);     // row đang sửa / {} khi thêm mới
  const [importOpen, setImportOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const { data } = await supabase.from('marketing_data')
      .select('*, truc_page:profiles!truc_page_id(full_name)').order('updated_at', { ascending: false }).limit(1000);
    const list = data || [];
    setRows(list);
    // Liên kết động theo SĐT với lịch hẹn/khách
    const phones = [...new Set(list.map(r => r.phone).filter(Boolean))];
    if (phones.length) {
      const { data: appts } = await supabase.from('customer_appointments')
        .select('id, phone, status, surgery_date, post_op_status').in('phone', phones);
      const map = {};
      (appts || []).forEach(a => { const k = phoneKey(a.phone); if (!map[k]) map[k] = a; });
      setApptMap(map);
    } else setApptMap({});
    didLoad.current = true; setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('marketing_data', loadData);
  useEffect(() => { supabase.from('profiles').select('id, full_name').eq('is_active', true).or('role.eq.truc_page,role_2.eq.truc_page').order('full_name').then(({ data }) => setStaff(data || [])); }, []);

  const del = async (r) => {
    if (!confirm('Xoá data khách này?')) return;
    setRows(p => p.filter(x => x.id !== r.id));
    await supabase.from('marketing_data').delete().eq('id', r.id);
  };

  const q = search.trim().toLowerCase();
  const visible = rows.filter(r =>
    (!q || (r.customer_name || '').toLowerCase().includes(q) || (r.phone || '').includes(q)) &&
    (!fStatus || r.status === fStatus) &&
    (!fTruc || r.truc_page_id === fTruc));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Database className="w-6 h-6 text-emerald-600" /> Data khách hàng</h2>
          <p className="text-slate-400 text-sm mt-0.5">Data Marketing → Lịch hẹn → Cọc/Bong → Phẫu → Hậu phẫu → CSKH (hợp nhất theo SĐT)</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-emerald-200 text-emerald-700 font-semibold text-sm hover:bg-emerald-50"><Upload className="w-4 h-4" /> Import CSV</button>
            <button onClick={() => setEdit({})} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"><Plus className="w-4 h-4" /> Thêm khách</button>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white" />
        </div>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={fTruc} onChange={e => setFTruc(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none">
          <option value="">Mọi trực page</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      <div className="text-xs text-slate-400">{visible.length} khách</div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Khách hàng</th>
                  <th className="px-4 py-3 font-semibold">SĐT</th>
                  <th className="px-4 py-3 font-semibold">Trực page</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Trao đổi gần nhất</th>
                  <th className="px-4 py-3 font-semibold">Liên kết hệ thống</th>
                  {canWrite && <th className="px-4 py-3 font-semibold text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.length === 0 ? <tr><td colSpan={canWrite ? 7 : 6} className="text-center py-10 text-slate-400">Chưa có data</td></tr> :
                  visible.map(r => { const appt = apptMap[phoneKey(r.phone)]; const st = APPT_STAGE(appt); return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3"><div className="font-semibold text-slate-800">{r.customer_name || '—'}</div>{r.description && <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{r.description}</div>}</td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">{r.phone}</td>
                      <td className="px-4 py-3 text-slate-500">{r.truc_page?.full_name || '—'}</td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{STATUS[r.status]?.label || r.status}</span></td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={r.last_exchange}>{r.last_exchange || '—'}</td>
                      <td className="px-4 py-3">{st ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${st.cls}`}><Link2 className="w-3 h-3" />{st.label}</span> : <span className="text-[11px] text-slate-300">Chưa có</span>}</td>
                      {canWrite && <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1.5"><button onClick={() => setEdit(r)} className="px-2 py-1 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50">Sửa</button><button onClick={() => del(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div></td>}
                    </tr>); })}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden divide-y divide-slate-50">
            {visible.map(r => { const st = APPT_STAGE(apptMap[phoneKey(r.phone)]); return (
              <div key={r.id} className="p-3" onClick={() => canWrite && setEdit(r)}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0"><div className="font-semibold text-slate-800 truncate">{r.customer_name || '—'}</div><div className="text-xs text-slate-400">{r.phone}</div></div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full h-fit ${STATUS[r.status]?.cls || 'bg-slate-100'}`}>{STATUS[r.status]?.label || r.status}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">{r.truc_page?.full_name && <span>{r.truc_page.full_name}</span>}{st && <span className={`font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}</div>
              </div>); })}
          </div>
        </div>
      )}

      {edit && <EditModal row={edit} me={me} staff={staff} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); loadData(); }} />}
      {importOpen && <ImportModal me={me} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); loadData(); }} />}
    </div>
  );
};

// ---------- Thêm / Sửa ----------
const EditModal = ({ row, me, staff, onClose, onSaved }) => {
  const [f, setF] = useState({
    customer_name: row.customer_name || '', phone: row.phone || '', truc_page_id: row.truc_page_id || '',
    description: row.description || '', status: row.status || 'tiep_can', last_exchange: row.last_exchange || '', reached_info: row.reached_info || '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.phone.trim()) { toast.error('Nhập số điện thoại'); return; }
    setSaving(true);
    const payload = { ...f, truc_page_id: f.truc_page_id || null, phone: f.phone.trim() };
    const { error } = row.id
      ? await supabase.from('marketing_data').update(payload).eq('id', row.id)
      : await supabase.from('marketing_data').upsert({ ...payload, created_by: me.id }, { onConflict: 'phone' });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã lưu'); onSaved();
  };
  return (
    <Modal title={row.id ? 'Sửa data khách' : 'Thêm data khách'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tên khách hàng"><input value={f.customer_name} onChange={e => setF({ ...f, customer_name: e.target.value })} className={inp} /></Field>
        <Field label="Số điện thoại *"><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={inp} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Trực page phụ trách"><select value={f.truc_page_id} onChange={e => setF({ ...f, truc_page_id: e.target.value })} className={inp}><option value="">— Chọn —</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Trạng thái"><select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className={inp}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Mô tả"><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} className={inp} /></Field>
      <Field label="Trao đổi gần nhất"><textarea value={f.last_exchange} onChange={e => setF({ ...f, last_exchange: e.target.value })} rows={2} className={inp} /></Field>
      <Field label="Thông tin đã tiếp cận"><textarea value={f.reached_info} onChange={e => setF({ ...f, reached_info: e.target.value })} rows={2} className={inp} /></Field>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Import CSV ----------
const ImportModal = ({ me, onClose, onDone }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const findIdx = (head, keys) => head.findIndex(h => keys.some(k => h.includes(k)));
  const parse = (raw) => {
    const rowsCsv = parseCSV(raw);
    if (rowsCsv.length < 2) { setPreview([]); return; }
    const head = rowsCsv[0].map(h => h.toLowerCase().trim());
    const iName = findIdx(head, ['tên', 'ten', 'name', 'khách']);
    const iPhone = findIdx(head, ['sđt', 'sdt', 'phone', 'điện thoại', 'dien thoai']);
    const iDesc = findIdx(head, ['mô tả', 'mo ta', 'desc']);
    const iStatus = findIdx(head, ['trạng thái', 'trang thai', 'status']);
    const iLast = findIdx(head, ['trao đổi', 'trao doi', 'last']);
    const iReach = findIdx(head, ['tiếp cận', 'tiep can', 'reach']);
    const out = [];
    for (let i = 1; i < rowsCsv.length; i++) {
      const r = rowsCsv[i];
      const phone = (iPhone >= 0 ? r[iPhone] : '').trim();
      if (!phone) continue;
      const stRaw = (iStatus >= 0 ? r[iStatus] : '').toLowerCase().trim();
      out.push({
        customer_name: iName >= 0 ? (r[iName] || '').trim() : '',
        phone,
        description: iDesc >= 0 ? (r[iDesc] || '').trim() : null,
        status: LABEL_TO_CODE[stRaw] || 'tiep_can',
        last_exchange: iLast >= 0 ? (r[iLast] || '').trim() : null,
        reached_info: iReach >= 0 ? (r[iReach] || '').trim() : null,
      });
    }
    // dedupe theo phone (giữ dòng cuối)
    const byPhone = {}; out.forEach(o => { byPhone[phoneKey(o.phone)] = o; });
    setPreview(Object.values(byPhone));
  };

  const onFile = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; const t = await file.text(); setText(t); parse(t); };

  const downloadSample = () => {
    const rows = [
      ['Tên khách hàng', 'SĐT', 'Mô tả', 'Trạng thái', 'Trao đổi gần nhất', 'Thông tin đã tiếp cận'],
      ['Nguyễn Văn A', '0901234567', 'Quan tâm nâng mũi', 'Tiếp cận', 'Đã nhắn tư vấn báo giá', 'Khách hỏi giá nâng mũi cấu trúc'],
      ['Trần Thị B', '0912345678', 'Hỏi cắt mí', 'Nóng', 'Hẹn gọi lại chiều nay', 'Đã gửi hình before/after'],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCsv('mau-data-khach-hang.csv', csv);
  };

  const doImport = async () => {
    if (preview.length === 0) { toast.error('Chưa có dữ liệu hợp lệ (cần cột SĐT)'); return; }
    setSaving(true);
    const tid = me?.role === 'truc_page' || me?.role_2 === 'truc_page' ? me.id : null;
    const payload = preview.map(p => ({ ...p, truc_page_id: tid, created_by: me.id }));
    const { error } = await supabase.from('marketing_data').upsert(payload, { onConflict: 'phone' });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success(`Đã import ${preview.length} khách (hợp nhất theo SĐT)`); onDone();
  };

  return (
    <Modal title="Import Data khách (CSV)" onClose={onClose}>
      <p className="text-[12px] text-slate-500 mb-2">Cột nhận dạng tự động theo tiêu đề: <b>Tên</b>, <b>SĐT</b>, Mô tả, Trạng thái, Trao đổi gần nhất, Thông tin đã tiếp cận. Bắt buộc có cột <b>SĐT</b>. Trùng SĐT sẽ hợp nhất.</p>
      <div className="flex gap-2 mb-2 flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50"><Upload className="w-4 h-4" /> Chọn file CSV</button>
        <button type="button" onClick={downloadSample} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"><Download className="w-4 h-4" /> Tải file mẫu</button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <textarea value={text} onChange={e => { setText(e.target.value); parse(e.target.value); }} rows={5} placeholder="Hoặc dán nội dung CSV vào đây (dòng đầu là tiêu đề)…" className={inp + ' font-mono text-xs'} />
      {preview.length > 0 && <div className="mt-2 text-sm text-emerald-700 font-semibold">Nhận diện {preview.length} khách hợp lệ.</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
        <button onClick={doImport} disabled={saving || preview.length === 0} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-sm">{saving ? 'Đang import…' : `Import ${preview.length || ''}`}</button>
      </div>
    </Modal>
  );
};

// ---------- chung ----------
const Field = ({ label, children }) => (<div className="mb-3"><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>);
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="px-5 py-3.5 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl"><h3 className="font-bold text-slate-800">{title}</h3><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
const ModalActions = ({ onClose, onSave, saving }) => (
  <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button><button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-sm">{saving ? 'Đang lưu…' : 'Lưu'}</button></div>
);

export default MarketingDataPage;
