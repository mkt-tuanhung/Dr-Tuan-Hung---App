import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadToR2 } from '@/lib/r2Client';
import { UserCheck, Search, X, Mic, FileText, ClipboardCheck, Phone, ImagePlus, Loader2, Play } from 'lucide-react';
import AudioRecorder from '@/components/AudioRecorder.jsx';

const ST = {
  scheduled: { label: 'Đã tiếp nhận', cls: 'bg-amber-100 text-amber-700' },
  coc: { label: 'Cọc', cls: 'bg-teal-100 text-teal-700' },
  bong: { label: 'Bong', cls: 'bg-rose-100 text-rose-700' },
  phau_thuat: { label: 'Phẫu thuật', cls: 'bg-emerald-100 text-emerald-700' },
};
const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none';
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const KhachTuVanPage = () => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const canWrite = roles.includes('sale_offline') || roles.includes('admin');
  const [rows, setRows] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [search, setSearch] = useState('');
  const [evalFor, setEvalFor] = useState(null);
  const [consultFor, setConsultFor] = useState(null);
  const [recFor, setRecFor] = useState(null);
  const [transcriptView, setTranscriptView] = useState(null);

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const { data } = await supabase.from('customer_appointments')
      .select('id, customer_name, phone, service, status, surgery_type, surgery_date, expected_surgery_date, revenue, upsale_revenue, deposit_date, deposit_amount, notes, consult_note, consult_image_urls')
      .or('status.in.(coc,bong,phau_thuat),consult_received.eq.true')
      .order('updated_at', { ascending: false }).limit(500);
    setRows(data || []);
    const { data: recData } = await supabase.from('consult_recordings')
      .select('*, by:profiles!created_by(full_name)').order('created_at', { ascending: false }).limit(1000);
    setRecs(recData || []);
    didLoad.current = true; setLoading(false);
  }, []);

  const reanalyze = async (id) => {
    setRecs(p => p.map(r => r.id === id ? { ...r, status: 'processing' } : r));
    await supabase.functions.invoke('analyze-consult', { body: { recording_id: id } });
    loadData();
  };
  const delRec = async (id) => {
    setRecs(p => p.filter(r => r.id !== id));
    await supabase.from('consult_recordings').delete().eq('id', id);
  };
  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments,consult_recordings', loadData);

  const q = search.trim().toLowerCase();
  const visible = rows.filter(r => !q || (r.customer_name || '').toLowerCase().includes(q) || (r.phone || '').includes(q));
  const recsOf = (apptId) => recs.filter(r => r.appointment_id === apptId);

  // Bảng xếp hạng chất lượng tư vấn (điểm AI TB theo sale)
  const lb = Object.values(recs.filter(r => r.ai_score != null).reduce((a, r) => {
    const id = r.created_by || 'x';
    a[id] = a[id] || { id, name: r.by?.full_name || 'Sale', n: 0, sum: 0 };
    a[id].n++; a[id].sum += Number(r.ai_score || 0); return a;
  }, {})).map(e => ({ ...e, avg: e.n ? e.sum / e.n : 0 })).sort((x, y) => y.avg - x.avg).slice(0, 5);
  const scoreCls = (s) => s == null ? 'bg-slate-100 text-slate-500' : s >= 8 ? 'bg-emerald-100 text-emerald-700' : s >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UserCheck className="w-6 h-6 text-emerald-600" /> Khách tư vấn</h2>
        <p className="text-slate-400 text-sm mt-0.5">Khách đã tiếp nhận tư vấn trực tiếp · thêm hồ sơ, ghi âm, đánh giá</p>
      </div>

      {lb.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="font-bold text-amber-600 mb-2 flex items-center gap-2 text-sm">🏆 Xếp hạng chất lượng tư vấn (AI)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lb.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 min-w-0"><span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span><span className="truncate">{e.name}</span></span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreCls(e.avg)}`}>TB {e.avg.toFixed(1)}/10 · {e.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">Chưa có khách tư vấn. Vào Lịch hẹn bấm “Tiếp nhận tư vấn”.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{r.customer_name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}{r.service ? ` · ${r.service}` : ''}</div>
                </div>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${ST[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{ST[r.status]?.label || r.status}</span>
              </div>
              {r.consult_note && <div className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">📝 {r.consult_note}</div>}
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                {(r.consult_image_urls || []).length > 0 && <span className="bg-slate-50 px-2 py-0.5 rounded-full">🖼 {(r.consult_image_urls || []).length} ảnh</span>}
                {recsOf(r.id).length > 0 && <span className="bg-slate-50 px-2 py-0.5 rounded-full">🎙 {recsOf(r.id).length} ghi âm</span>}
              </div>
              {recsOf(r.id).length > 0 && (
                <div className="mt-2 space-y-2">
                  {recsOf(r.id).map(rec => (
                    <div key={rec.id} className="bg-slate-50 rounded-xl p-2">
                      <div className="flex items-center gap-2">
                        <audio src={rec.audio_url} controls className="h-7 flex-1 min-w-0" />
                        {(rec.segment_urls || []).length > 1 && <span className="text-[10px] text-slate-400 shrink-0">{rec.segment_urls.length} đoạn</span>}
                        {rec.ai_score != null
                          ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreCls(rec.ai_score)}`}>{rec.ai_score}/10</span>
                          : rec.status === 'processing' ? <span className="text-[10px] text-amber-600 shrink-0 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />AI…</span>
                            : rec.status === 'error' ? <span className="text-[10px] text-rose-500 shrink-0">Lỗi AI</span>
                              : <span className="text-[10px] text-slate-400 shrink-0">Chưa chấm</span>}
                        {(rec.created_by === me?.id || roles.includes('admin')) && <button onClick={() => delRec(rec.id)} className="text-rose-300 hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>}
                      </div>
                      {rec.ai_analysis?.summary && <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">🤖 {rec.ai_analysis.summary}</div>}
                      <div className="flex gap-2 mt-1">
                        {rec.transcript && <button onClick={() => setTranscriptView(rec)} className="text-[11px] font-semibold text-emerald-600 hover:underline">Xem chi tiết</button>}
                        {rec.status !== 'processing' && <button onClick={() => reanalyze(rec.id)} className="text-[11px] font-semibold text-slate-500 hover:underline">Phân tích lại</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {canWrite && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-50 pt-2.5">
                  <button onClick={() => setConsultFor(r)} className="text-xs font-semibold text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Hồ sơ tư vấn</button>
                  <button onClick={() => setRecFor(r)} className="text-xs font-semibold text-rose-600 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 inline-flex items-center gap-1"><Mic className="w-3.5 h-3.5" />Ghi âm</button>
                  <button onClick={() => setEvalFor(r)} className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1 ml-auto"><ClipboardCheck className="w-3.5 h-3.5" />Đánh giá</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {evalFor && <EvalModal app={evalFor} onClose={() => setEvalFor(null)} onSaved={() => { setEvalFor(null); loadData(); }} />}
      {consultFor && <ConsultModal app={consultFor} onClose={() => setConsultFor(null)} onSaved={() => { setConsultFor(null); loadData(); }} />}
      {recFor && <AudioRecorder onClose={() => setRecFor(null)} onSaved={async (urls, sec) => {
        const { data, error } = await supabase.from('consult_recordings')
          .insert({ appointment_id: recFor.id, audio_url: urls[0], segment_urls: urls, duration_sec: sec, created_by: me.id, status: 'pending' }).select('id').single();
        if (error) { toast.error(error.message); return; }
        setRecFor(null); toast.success('Đã lưu ghi âm — đang transcribe & chấm điểm AI…');
        loadData();
        supabase.functions.invoke('analyze-consult', { body: { recording_id: data.id } }).then(() => loadData());
      }} />}
      {transcriptView && (
        <Modal title="Văn bản & đánh giá tư vấn" onClose={() => setTranscriptView(null)}>
          {transcriptView.ai_score != null && (
            <div className="mb-3 flex items-center gap-2">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreCls(transcriptView.ai_score)}`}>{transcriptView.ai_score}/10 · {transcriptView.ai_analysis?.level || ''}</span>
            </div>
          )}
          {transcriptView.ai_analysis?.summary && <p className="text-sm text-slate-600 mb-3">🤖 {transcriptView.ai_analysis.summary}</p>}
          {transcriptView.ai_analysis?.criteria && (
            <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
              {Object.entries({ thien_cam: 'Thiện cảm', khai_thac_nhu_cau: 'Khai thác nhu cầu', tu_van_chuyen_mon: 'Chuyên môn', xu_ly_tu_choi: 'Xử lý từ chối', chot: 'Chốt', thai_do: 'Thái độ' }).map(([k, l]) => (
                <div key={k} className="flex justify-between bg-slate-50 rounded-lg px-2 py-1"><span className="text-slate-500">{l}</span><b className="text-slate-700">{transcriptView.ai_analysis.criteria[k] ?? '—'}/10</b></div>
              ))}
            </div>
          )}
          {(transcriptView.ai_analysis?.strengths || []).length > 0 && <div className="mb-2"><div className="text-xs font-bold text-emerald-600 mb-1">Điểm mạnh</div><ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">{transcriptView.ai_analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.weaknesses || []).length > 0 && <div className="mb-2"><div className="text-xs font-bold text-rose-600 mb-1">Điểm yếu</div><ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">{transcriptView.ai_analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.suggestions || []).length > 0 && <div className="mb-3"><div className="text-xs font-bold text-blue-600 mb-1">Gợi ý cải thiện</div><ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">{transcriptView.ai_analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          <div className="text-xs font-bold text-slate-500 mb-1">Văn bản (transcript)</div>
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap max-h-60 overflow-y-auto">{transcriptView.transcript || '—'}</div>
        </Modal>
      )}
    </div>
  );
};

// ---------- Đánh giá (ra Cọc/Bong/Phẫu thuật) ----------
const EvalModal = ({ app, onClose, onSaved }) => {
  const today = new Date().toISOString().split('T')[0];
  const [f, setF] = useState({
    status: app.status === 'scheduled' ? 'phau_thuat' : app.status,
    surgery_type: app.surgery_type || 'Tiểu phẫu',
    expected_surgery_date: app.expected_surgery_date || app.surgery_date || today,
    revenue: app.revenue || '', upsale_revenue: app.upsale_revenue || '', service: app.service || '',
    deposit_date: app.deposit_date || today, deposit_amount: app.deposit_amount || '', notes: app.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    let upd = { status: f.status, surgery_type: f.surgery_type };
    if (f.status === 'phau_thuat') upd = { ...upd, surgery_date: f.expected_surgery_date, expected_surgery_date: f.expected_surgery_date, revenue: f.revenue || 0, upsale_revenue: f.upsale_revenue || 0, service: f.service };
    else if (f.status === 'coc') upd = { ...upd, deposit_date: f.deposit_date, deposit_amount: f.deposit_amount || 0, service: f.service, expected_surgery_date: f.expected_surgery_date };
    else if (f.status === 'bong') upd = { ...upd, notes: f.notes, bong_date: today };
    const { error } = await supabase.from('customer_appointments').update(upd).eq('id', app.id);
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã lưu đánh giá'); onSaved();
  };
  const STBtn = ({ k, label, on }) => <button onClick={() => setF({ ...f, status: k })} className={`flex-1 py-2 text-sm font-semibold rounded-full ${f.status === k ? on : 'text-slate-500 hover:bg-slate-50'}`}>{label}</button>;
  return (
    <Modal title="Đánh giá khách" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{app.customer_name}</b> · {app.phone}</p>
      <div className="flex bg-slate-100 rounded-full p-1 mb-3">
        <STBtn k="bong" label="Bong" on="bg-orange-400 text-white shadow" />
        <STBtn k="coc" label="Cọc" on="bg-teal-500 text-white shadow" />
        <STBtn k="phau_thuat" label="Phẫu thuật" on="bg-emerald-500 text-white shadow" />
      </div>
      <label className="block text-sm font-bold text-slate-700 mb-1">Loại phẫu thuật</label>
      <div className="flex gap-2 mb-3">
        {['Tiểu phẫu', 'Đại phẫu'].map(t => <button key={t} onClick={() => setF({ ...f, surgery_type: t })} className={`flex-1 py-2 text-sm font-semibold rounded-xl border ${f.surgery_type === t ? 'bg-purple-500 text-white border-purple-500' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{t}</button>)}
      </div>
      {f.status === 'phau_thuat' && (<>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ngày mổ"><input type="date" value={f.expected_surgery_date} onChange={e => setF({ ...f, expected_surgery_date: e.target.value })} className={inp} /></Field>
          <Field label="Doanh thu (VNĐ)"><input type="number" value={f.revenue} onChange={e => setF({ ...f, revenue: e.target.value })} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Upsale (VNĐ)"><input type="number" value={f.upsale_revenue} onChange={e => setF({ ...f, upsale_revenue: e.target.value })} className={inp} /></Field>
          <Field label="Dịch vụ"><input value={f.service} onChange={e => setF({ ...f, service: e.target.value })} className={inp} /></Field>
        </div>
      </>)}
      {f.status === 'coc' && (<>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ngày cọc"><input type="date" value={f.deposit_date} onChange={e => setF({ ...f, deposit_date: e.target.value })} className={inp} /></Field>
          <Field label="Số tiền cọc"><input type="number" value={f.deposit_amount} onChange={e => setF({ ...f, deposit_amount: e.target.value })} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ngày mổ dự kiến"><input type="date" value={f.expected_surgery_date} onChange={e => setF({ ...f, expected_surgery_date: e.target.value })} className={inp} /></Field>
          <Field label="Dịch vụ"><input value={f.service} onChange={e => setF({ ...f, service: e.target.value })} className={inp} /></Field>
        </div>
      </>)}
      {f.status === 'bong' && <Field label="Lý do bong"><textarea rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inp} placeholder="Khách kẹt tiền, đổi ý…" /></Field>}
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Hồ sơ tư vấn (ghi chú + ảnh) ----------
const ConsultModal = ({ app, onClose, onSaved }) => {
  const [note, setNote] = useState(app.consult_note || '');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const existing = app.consult_image_urls || [];
  const save = async () => {
    setSaving(true);
    try {
      const urls = [...existing];
      for (const f of files) urls.push(await uploadToR2(f, 'consult-files'));
      const { error } = await supabase.from('customer_appointments').update({ consult_note: note || null, consult_image_urls: urls }).eq('id', app.id);
      if (error) throw error;
      toast.success('Đã lưu hồ sơ tư vấn'); onSaved();
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    setSaving(false);
  };
  return (
    <Modal title="Hồ sơ tư vấn" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{app.customer_name}</b></p>
      <Field label="Ghi chú tư vấn"><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className={inp} placeholder="Nội dung tư vấn, nhu cầu khách…" /></Field>
      <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh hồ sơ</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {existing.map((u, i) => <img key={i} src={u} alt="" className="h-16 w-16 object-cover rounded-lg border" />)}
        {files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded-lg border border-emerald-300" />)}
        <button type="button" onClick={() => fileRef.current?.click()} className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-emerald-400"><ImagePlus className="w-5 h-5" /></button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { setFiles(p => [...p, ...e.target.files]); e.target.value = ''; }} />
      </div>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

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
  <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button><button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}</button></div>
);

export default KhachTuVanPage;
