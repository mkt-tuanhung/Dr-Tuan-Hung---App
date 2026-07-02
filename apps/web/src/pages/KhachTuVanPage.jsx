import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadToR2 } from '@/lib/r2Client';
import { UserCheck, Search, X, Mic, FileText, ClipboardCheck, Phone, ImagePlus, Loader2, Play, Trash2, RotateCcw, Check } from 'lucide-react';
import AudioRecorder from '@/components/AudioRecorder.jsx';
import MoneyInput from '@/components/MoneyInput.jsx';

const ST = {
  scheduled: { label: 'Đã tiếp nhận', cls: 'bg-amber-100 text-amber-700' },
  coc: { label: 'Cọc', cls: 'bg-cyan-100 text-cyan-700' },
  bong: { label: 'Bong', cls: 'bg-rose-100 text-rose-700' },
  phau_thuat: { label: 'Phẫu thuật', cls: 'bg-teal-100 text-teal-700' },
};
// Vạch màu trạng thái bên trái mỗi thẻ
const stripCls = { scheduled: 'from-amber-400 to-amber-500', coc: 'from-cyan-400 to-cyan-500', bong: 'from-rose-400 to-rose-500', phau_thuat: 'from-teal-400 to-teal-500' };
const inp = 'w-full min-w-0 px-3.5 py-2.5 text-[15px] rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition';
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const maskPhone = (p) => { const s = (p || '').trim(); return s.length <= 4 ? s : s.slice(0, -4) + '••••'; };
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const scoreRing = (s) => s == null ? 'text-slate-400 border-slate-200 bg-white' : s >= 8 ? 'text-teal-600 border-teal-300 bg-teal-50' : s >= 5 ? 'text-amber-600 border-amber-300 bg-amber-50' : 'text-rose-600 border-rose-300 bg-rose-50';
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Bôi đỏ/đậm các câu AI thấy chưa phù hợp trong văn bản
const Highlight = ({ text, quotes }) => {
  const qs = (quotes || []).filter(q => q && q.trim().length >= 3).sort((a, b) => b.length - a.length);
  if (!qs.length) return text || '';
  let re; try { re = new RegExp('(' + qs.map(escRe).join('|') + ')', 'gi'); } catch { return text || ''; }
  return (text || '').split(re).map((p, i) => i % 2 === 1
    ? <mark key={i} className="bg-rose-100 text-rose-700 font-bold rounded px-0.5">{p}</mark>
    : <span key={i}>{p}</span>);
};

const KhachTuVanPage = () => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const canWrite = roles.includes('sale_offline') || roles.includes('admin');
  const isAdmin = roles.includes('admin');
  const [rows, setRows] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [search, setSearch] = useState('');
  const [evalFor, setEvalFor] = useState(null);
  const [consultFor, setConsultFor] = useState(null);
  const [recFor, setRecFor] = useState(null);
  const [transcriptView, setTranscriptView] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);  // desktop: khách đang xem chi tiết
  const [sheetFor, setSheetFor] = useState(null);       // mobile: khách mở trong sheet

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const { data } = await supabase.from('customer_appointments')
      .select('id, customer_name, phone, service, status, surgery_type, surgery_date, expected_surgery_date, revenue, upsale_revenue, deposit_date, deposit_amount, notes, consult_note, consult_image_urls, appointment_date, created_at')
      .or('status.in.(coc,bong,phau_thuat),consult_received.eq.true')
      .order('created_at', { ascending: false }).limit(500);
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
  const upd = async (id, payload, msg) => {
    const { error } = await supabase.from('consult_recordings').update(payload).eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (msg) toast.success(msg); loadData();
  };
  // Sale: xin xoá (chờ admin duyệt)
  const requestDelete = (rec) => setConfirm({ message: 'Gửi yêu cầu xoá ghi âm này? Admin sẽ duyệt trước khi xoá.', okLabel: 'Gửi yêu cầu',
    onOk: () => upd(rec.id, { delete_requested_by: me.id, delete_requested_at: new Date().toISOString() }, 'Đã gửi yêu cầu xoá — chờ admin duyệt') });
  // Admin: duyệt xoá / xoá thẳng -> vào thùng rác (xoá mềm)
  const softDelete = (rec, label) => setConfirm({ message: label, okLabel: 'Chuyển vào thùng rác', danger: true,
    onOk: () => upd(rec.id, { deleted_at: new Date().toISOString(), deleted_by: me.id, delete_requested_by: null, delete_requested_at: null }, 'Đã chuyển vào thùng rác') });
  const rejectDelete = (rec) => upd(rec.id, { delete_requested_by: null, delete_requested_at: null }, 'Đã từ chối yêu cầu xoá');
  const restore = (rec) => upd(rec.id, { deleted_at: null, deleted_by: null }, 'Đã khôi phục ghi âm');
  const permanentDelete = (rec) => setConfirm({ message: 'Xoá VĨNH VIỄN ghi âm này? Không thể khôi phục lại.', okLabel: 'Xoá vĩnh viễn', danger: true,
    onOk: async () => { const { error } = await supabase.from('consult_recordings').delete().eq('id', rec.id); if (error) { toast.error(error.message); return; } toast.success('Đã xoá vĩnh viễn'); loadData(); } });
  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments,consult_recordings', loadData);

  const q = search.trim().toLowerCase();
  const visible = rows.filter(r => !q || (r.customer_name || '').toLowerCase().includes(q) || (r.phone || '').includes(q))
    .sort((a, b) => {
      const ka = a.appointment_date || (a.created_at || '').slice(0, 10);
      const kb = b.appointment_date || (b.created_at || '').slice(0, 10);
      if (ka !== kb) return kb.localeCompare(ka);                       // theo ngày, mới nhất trên
      return (b.created_at || '').localeCompare(a.created_at || '');     // cùng ngày: tạo sau lên trên
    });
  // Gom nhóm theo ngày hẹn (giữ thứ tự đã sắp xếp — mới nhất trên)
  const groupedVisible = (() => {
    const map = new Map();
    for (const r of visible) {
      const d = r.appointment_date ? new Date(r.appointment_date).toLocaleDateString('vi-VN') : 'Không rõ ngày';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(r);
    }
    return [...map.entries()];
  })();
  // Desktop: khách hiển thị bên khung chi tiết (mặc định khách đầu danh sách)
  const selected = visible.find(x => x.id === selectedId) || visible[0] || null;
  const recsOf = (apptId) => recs.filter(r => r.appointment_id === apptId && !r.deleted_at);
  const trash = recs.filter(r => r.deleted_at);
  const apptName = (id) => rows.find(x => x.id === id)?.customer_name || 'Khách';

  // Bảng xếp hạng chất lượng tư vấn (điểm AI TB theo sale)
  const lb = Object.values(recs.filter(r => r.ai_score != null && !r.deleted_at).reduce((a, r) => {
    const id = r.created_by || 'x';
    a[id] = a[id] || { id, name: r.by?.full_name || 'Sale', n: 0, sum: 0 };
    a[id].n++; a[id].sum += Number(r.ai_score || 0); return a;
  }, {})).map(e => ({ ...e, avg: e.n ? e.sum / e.n : 0 })).sort((x, y) => y.avg - x.avg).slice(0, 5);
  const scoreCls = (s) => s == null ? 'bg-slate-100 text-slate-500' : s >= 8 ? 'bg-teal-100 text-teal-700' : s >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  // Số liệu tổng quan cho hero
  const stat = {
    total: visible.length,
    coc: rows.filter(r => r.status === 'coc').length,
    pt: rows.filter(r => r.status === 'phau_thuat').length,
  };
  const aiAvg = (() => { const a = recs.filter(r => r.ai_score != null && !r.deleted_at); return a.length ? a.reduce((s, r) => s + Number(r.ai_score || 0), 0) / a.length : null; })();

  return (
    <div className="fx-shell rounded-[28px] p-4 sm:p-5 space-y-4 text-slate-200">
      <div className="relative">
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur"><UserCheck className="w-6 h-6 text-teal-300" strokeWidth={1.75} /></div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight tracking-tight">Khách tư vấn</h2>
              <p className="text-slate-300/70 text-sm">Tiếp nhận trực tiếp · hồ sơ · ghi âm · đánh giá AI</p>
            </div>
          </div>
          {!loading && isAdmin && trash.length > 0 && (
            <button onClick={() => setTrashOpen(true)} className="fx-tile text-sm font-semibold text-slate-200 px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Thùng rác {trash.length}</button>
          )}
        </div>

        {!loading && (
          <div className="relative mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Tổng khách', value: stat.total, sub: 'đang theo dõi', accent: 'text-white' },
              { label: 'Đã cọc', value: stat.coc, sub: 'chờ lên mổ', accent: 'text-cyan-300' },
              { label: 'Phẫu thuật', value: stat.pt, sub: 'đã chốt', accent: 'text-teal-300' },
              { label: 'Điểm tư vấn TB', value: aiAvg != null ? aiAvg.toFixed(1) : '—', sub: aiAvg != null ? 'AI chấm · /10' : 'chưa có', accent: 'text-amber-300' },
            ].map(t => (
              <div key={t.label} className="fx-tile rounded-2xl p-3.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{t.label}</div>
                <div className={`fx-num text-2xl font-bold mt-1 ${t.accent}`}>{t.value}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{t.sub}</div>
              </div>
            ))}
          </div>
        )}

        <div className="relative mt-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…" className="w-full pl-11 pr-10 py-3 text-sm rounded-2xl bg-white/10 border border-white/10 text-white placeholder-slate-400 focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20 outline-none backdrop-blur transition" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {lb.length > 0 && (
        <div className="fx-glass rounded-2xl p-4">
          <h3 className="font-bold text-amber-300 mb-3 flex items-center gap-2 text-sm"><span className="text-base">🏆</span> Xếp hạng chất lượng tư vấn (AI)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lb.map((e, i) => (
              <div key={e.id} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white/10 text-slate-300'}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <span className="text-sm font-semibold text-slate-200 truncate flex-1 min-w-0">{e.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreCls(e.avg)}`}>{e.avg.toFixed(1)}<span className="opacity-60">/10</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="fx-glass rounded-2xl p-10 text-center text-slate-400">Chưa có khách tư vấn. Vào Lịch hẹn bấm “Tiếp nhận tư vấn”.</div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(300px,360px)_1fr] lg:gap-5 lg:items-start">
          {/* MASTER — danh sách gọn, scan nhanh */}
          <div className="space-y-5 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
            {groupedVisible.map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <h3 className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">{date}</h3>
                  <span className="h-px flex-1 bg-slate-100" />
                  <span className="text-[11px] font-bold text-slate-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(r => {
                    const rs = recsOf(r.id);
                    const best = rs.find(x => x.ai_score != null);
                    const active = selected?.id === r.id;
                    return (
                      <button key={r.id} onClick={() => { setSelectedId(r.id); setSheetFor(r); }}
                        className={`w-full text-left relative overflow-hidden rounded-2xl p-3 pl-4 flex items-center gap-3 ${active
                          ? 'fx-glass-active'
                          : 'fx-glass fx-glass-hover'}`}>
                        <span className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${stripCls[r.status] || 'from-slate-300 to-slate-400'}`} />
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm">{initials(r.customer_name)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-[15px] truncate flex-1">{r.customer_name}</span>
                            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${ST[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{ST[r.status]?.label || r.status}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" strokeWidth={1.75} /> {maskPhone(r.phone)}</span>
                            {rs.length > 0 && <span className="text-rose-400 font-semibold">{rs.length} ghi âm</span>}
                          </div>
                        </div>
                        {best?.ai_score != null && <span className={`shrink-0 fx-num text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center ${scoreCls(best.ai_score)}`}>{best.ai_score}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* DETAIL — desktop: khung chi tiết dính cạnh phải */}
          <div className="hidden lg:block lg:sticky lg:top-4">
            {selected
              ? <CustomerDetail r={selected} rs={recsOf(selected.id)} canWrite={canWrite} isAdmin={isAdmin} me={me}
                  onConsult={setConsultFor} onRec={setRecFor} onEval={setEvalFor} onTranscript={setTranscriptView}
                  onReanalyze={reanalyze} onReqDelete={requestDelete} onSoftDelete={softDelete} onRejectDelete={rejectDelete} />
              : <div className="fx-glass rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center gap-3"><UserCheck className="w-12 h-12 text-white/20" strokeWidth={1.25} /><span className="font-semibold">Chọn một khách để xem chi tiết</span></div>}
          </div>
        </div>
      )}

      {/* DETAIL — mobile: sheet trượt lên khi chạm 1 khách */}
      {sheetFor && (() => { const live = visible.find(x => x.id === sheetFor.id) || sheetFor; return (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end" onClick={() => setSheetFor(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative w-full max-h-[92vh] overflow-y-auto fx-shell rounded-t-3xl p-4 pb-8 text-slate-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-3"><span className="w-10 h-1.5 rounded-full bg-white/30" /></div>
            <CustomerDetail r={live} rs={recsOf(live.id)} canWrite={canWrite} isAdmin={isAdmin} me={me}
              onConsult={setConsultFor} onRec={setRecFor} onEval={setEvalFor} onTranscript={setTranscriptView}
              onReanalyze={reanalyze} onReqDelete={requestDelete} onSoftDelete={softDelete} onRejectDelete={rejectDelete} />
          </div>
        </div>
      ); })()}

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
              <span className={`text-base font-bold px-3 py-1.5 rounded-full ${scoreCls(transcriptView.ai_score)}`}>{transcriptView.ai_score}/10 · {transcriptView.ai_analysis?.level || ''}</span>
            </div>
          )}
          {transcriptView.ai_analysis?.summary && <p className="text-[15px] text-slate-600 mb-3 leading-relaxed">{transcriptView.ai_analysis.summary}</p>}
          {transcriptView.ai_analysis?.criteria && (
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              {Object.entries({ thien_cam: 'Thiện cảm', khai_thac_nhu_cau: 'Khai thác nhu cầu', tu_van_chuyen_mon: 'Chuyên môn', xu_ly_tu_choi: 'Xử lý từ chối', chot: 'Chốt', thai_do: 'Thái độ' }).map(([k, l]) => (
                <div key={k} className="flex justify-between bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">{l}</span><b className="text-slate-700">{transcriptView.ai_analysis.criteria[k] ?? '—'}/10</b></div>
              ))}
            </div>
          )}
          {(transcriptView.ai_analysis?.strengths || []).length > 0 && <div className="mb-3"><div className="text-sm font-bold text-teal-600 mb-1">Điểm mạnh</div><ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.weaknesses || []).length > 0 && <div className="mb-3"><div className="text-sm font-bold text-rose-600 mb-1">Điểm yếu</div><ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.suggestions || []).length > 0 && <div className="mb-3"><div className="text-sm font-bold text-blue-600 mb-1">Gợi ý cải thiện</div><ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.issues || []).length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-bold text-rose-600 mb-1">Câu/đoạn chưa phù hợp</div>
              <ul className="space-y-1.5">
                {transcriptView.ai_analysis.issues.map((it, i) => (
                  <li key={i} className="text-sm bg-rose-50 border border-rose-100 rounded-lg p-2.5">
                    <span className="text-rose-700 font-bold">“{it.quote}”</span>{it.time ? <span className="text-rose-400 text-xs"> · {it.time}</span> : null}
                    {it.reason && <div className="text-slate-500 mt-0.5">{it.reason}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-sm font-bold text-slate-500 mb-1">Văn bản theo mốc thời gian</div>
          {(() => { const quotes = (transcriptView.ai_analysis?.issues || []).map(x => x.quote); const tl = transcriptView.transcript_timeline || []; return (
            <div className="bg-slate-50 rounded-xl p-3 max-h-80 overflow-y-auto space-y-3">
              {tl.length > 0
                ? tl.map((b, i) => (
                  <div key={i}>
                    <div className="text-xs font-bold text-teal-600">{fmtTime(b.from)} – {fmtTime(b.to)}</div>
                    <div className="text-sm text-slate-700 mt-0.5 leading-relaxed"><Highlight text={b.text} quotes={quotes} /></div>
                  </div>
                ))
                : <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"><Highlight text={transcriptView.transcript || '—'} quotes={quotes} /></div>}
            </div>
          ); })()}
        </Modal>
      )}
      {trashOpen && (
        <Modal title={`Thùng rác — ${trash.length} ghi âm`} onClose={() => setTrashOpen(false)}>
          {trash.length === 0 ? <p className="text-sm text-slate-400">Thùng rác trống.</p> : (
            <div className="space-y-2">
              {trash.map(rec => (
                <div key={rec.id} className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">{apptName(rec.appointment_id)}</div>
                      <div className="text-[11px] text-slate-400">{rec.by?.full_name || '—'}{rec.deleted_at ? ` · xoá ${new Date(rec.deleted_at).toLocaleString('vi-VN')}` : ''}</div>
                    </div>
                    {rec.ai_score != null && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreCls(rec.ai_score)}`}>{rec.ai_score}/10</span>}
                  </div>
                  <audio src={rec.audio_url} controls className="h-7 w-full mt-1.5" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => restore(rec)} className="flex-1 h-9 rounded-lg border border-teal-200 text-teal-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-teal-50"><RotateCcw className="w-3.5 h-3.5" /> Khôi phục</button>
                    <button onClick={() => permanentDelete(rec)} className="flex-1 h-9 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /> Xoá vĩnh viễn</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
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
    if (f.status === 'phau_thuat') upd = { ...upd, surgery_date: f.expected_surgery_date, expected_surgery_date: f.expected_surgery_date, revenue: f.revenue || 0, upsale_revenue: f.upsale_revenue || 0, service: f.service, bong_date: null };
    else if (f.status === 'coc') upd = { ...upd, deposit_date: f.deposit_date, deposit_amount: f.deposit_amount || 0, service: f.service, expected_surgery_date: f.expected_surgery_date, revenue: 0, upsale_revenue: 0, surgery_date: null, bong_date: null };
    else if (f.status === 'bong') upd = { ...upd, notes: f.notes, bong_date: today, revenue: 0, upsale_revenue: 0, surgery_date: null };
    const { data, error } = await supabase.from('customer_appointments').update(upd).eq('id', app.id).select('id, status, revenue, surgery_date');
    setSaving(false);
    if (error) { console.error('eval update error', error); toast.error(`LỖI [${error.code || '?'}]: ${error.message}`, { duration: 20000 }); return; }
    if (!data || data.length === 0) { toast.error('Cập nhật 0 dòng — RLS chặn quyền. Chạy SQL phân quyền.', { duration: 20000 }); return; }
    const r = data[0];
    toast.success(`Đã lưu: ${r.status} · DT ${Number(r.revenue || 0).toLocaleString('vi-VN')}đ · ngày mổ ${r.surgery_date || '(trống)'}`, { duration: 8000 });
    onSaved();
  };
  const STBtn = ({ k, label, on }) => <button onClick={() => setF({ ...f, status: k })} className={`flex-1 py-2.5 text-[15px] font-semibold rounded-full transition ${f.status === k ? on : 'text-slate-500 hover:bg-white/60'}`}>{label}</button>;
  return (
    <Modal title="Đánh giá khách" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">Khách: <b className="text-slate-700">{app.customer_name}</b> · {app.phone}</p>
      <div className="flex bg-slate-100 rounded-full p-1 mb-4">
        <STBtn k="bong" label="Bong" on="bg-orange-400 text-white shadow" />
        <STBtn k="coc" label="Cọc" on="bg-cyan-500 text-white shadow" />
        <STBtn k="phau_thuat" label="Phẫu thuật" on="bg-teal-600 text-white shadow" />
      </div>
      <label className="block text-sm font-bold text-slate-700 mb-1.5">Loại phẫu thuật</label>
      <div className="flex gap-2 mb-4">
        {['Tiểu phẫu', 'Đại phẫu'].map(t => <button key={t} onClick={() => setF({ ...f, surgery_type: t })} className={`flex-1 py-2.5 text-[15px] font-semibold rounded-xl border transition ${f.surgery_type === t ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{t}</button>)}
      </div>
      {f.status === 'phau_thuat' && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ngày mổ"><input type="date" value={f.expected_surgery_date} onChange={e => setF({ ...f, expected_surgery_date: e.target.value })} className={inp} /></Field>
          <Field label="Doanh thu (VNĐ)"><MoneyInput value={f.revenue} onChange={v => setF({ ...f, revenue: v })} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Upsale (VNĐ)"><MoneyInput value={f.upsale_revenue} onChange={v => setF({ ...f, upsale_revenue: v })} className={inp} /></Field>
          <Field label="Dịch vụ"><input value={f.service} onChange={e => setF({ ...f, service: e.target.value })} className={inp} /></Field>
        </div>
      </>)}
      {f.status === 'coc' && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ngày cọc"><input type="date" value={f.deposit_date} onChange={e => setF({ ...f, deposit_date: e.target.value })} className={inp} /></Field>
          <Field label="Số tiền cọc"><MoneyInput value={f.deposit_amount} onChange={v => setF({ ...f, deposit_amount: v })} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        {files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded-lg border border-teal-300" />)}
        <button type="button" onClick={() => fileRef.current?.click()} className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-teal-400"><ImagePlus className="w-5 h-5" /></button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { setFiles(p => [...p, ...e.target.files]); e.target.value = ''; }} />
      </div>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

const Field = ({ label, children }) => (<div className="mb-3.5"><label className="block text-sm font-semibold text-slate-600 mb-1.5">{label}</label>{children}</div>);
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="px-5 py-3.5 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl"><h3 className="font-bold text-slate-800">{title}</h3><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
const ModalActions = ({ onClose, onSave, saving }) => (
  <div className="flex gap-2 mt-1 pt-2 border-t border-slate-50 sm:justify-end">
    <button onClick={onClose} className="flex-1 sm:flex-none px-5 h-11 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-[15px]">Hủy</button>
    <button onClick={onSave} disabled={saving} className="flex-1 sm:flex-none px-6 h-11 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50 text-[15px] inline-flex items-center justify-center">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}</button>
  </div>
);

const ConfirmDialog = ({ message, okLabel = 'Xác nhận', danger = false, onOk, onClose }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-slate-700 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Huỷ</button>
          <button disabled={busy} onClick={async () => { setBusy(true); await onOk(); onClose(); }} className={`px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'}`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : okLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ---------- Khung chi tiết 1 khách (desktop panel + mobile sheet) ----------
const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const dOnly = (s) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const CRIT = { thien_cam: 'Thiện cảm', khai_thac_nhu_cau: 'Nhu cầu', tu_van_chuyen_mon: 'Chuyên môn', xu_ly_tu_choi: 'Xử lý từ chối', chot: 'Chốt', thai_do: 'Thái độ' };
const critBar = (v) => v == null ? 'bg-slate-500' : v >= 8 ? 'bg-teal-400' : v >= 5 ? 'bg-amber-400' : 'bg-rose-400';

const CustomerDetail = ({ r, rs, canWrite, isAdmin, me, onConsult, onRec, onEval, onTranscript, onReanalyze, onReqDelete, onSoftDelete, onRejectDelete }) => {
  const stats = r.status === 'phau_thuat'
    ? [
      { label: 'Doanh thu', value: money(r.revenue), accent: 'text-teal-300' },
      { label: 'Upsale', value: money(r.upsale_revenue), accent: 'text-cyan-300' },
      { label: 'Loại mổ', value: r.surgery_type || '—' },
      { label: 'Ngày mổ', value: dOnly(r.surgery_date) },
    ]
    : r.status === 'coc'
      ? [
        { label: 'Tiền cọc', value: money(r.deposit_amount), accent: 'text-cyan-300' },
        { label: 'Ngày cọc', value: dOnly(r.deposit_date) },
        { label: 'Mổ dự kiến', value: dOnly(r.expected_surgery_date) },
        { label: 'Loại mổ', value: r.surgery_type || '—' },
      ]
      : [];
  return (
  <div className="fx-glass relative overflow-hidden rounded-3xl p-5">
    <span className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${stripCls[r.status] || 'from-slate-300 to-slate-400'}`} />
    <div className="flex items-start gap-3.5 flex-wrap">
      <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center font-bold text-lg">{initials(r.customer_name)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-white text-lg leading-tight">{r.customer_name}</h3>
          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${ST[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}><span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{ST[r.status]?.label || r.status}</span>
        </div>
        <div className="text-sm text-slate-400 flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5"><span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75} /> {maskPhone(r.phone)}</span>{r.appointment_date && <span className="text-slate-500">{dOnly(r.appointment_date)}</span>}</div>
      </div>
      {/* Nút gọn nhưng nổi bật — nhãn + màu rõ */}
      {canWrite && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button title="Hồ sơ tư vấn" onClick={() => onConsult(r)} className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 bg-white/12 border border-white/25 text-white text-[13px] font-bold hover:bg-white/20 transition"><FileText className="w-4 h-4" strokeWidth={2} />Hồ sơ</button>
          <button title="Ghi âm cuộc tư vấn" onClick={() => onRec(r)} className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-[13px] font-bold shadow-lg shadow-rose-500/40 hover:brightness-110 transition"><span className="relative flex w-2 h-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" /><span className="relative inline-flex rounded-full w-2 h-2 bg-white" /></span><Mic className="w-4 h-4" strokeWidth={2} />Ghi âm</button>
          {r.status === 'scheduled' && <button title="Đánh giá" onClick={() => onEval(r)} className="fx-btn-primary h-9 px-3.5 rounded-xl text-white text-[13px] font-bold inline-flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" strokeWidth={2} />Đánh giá</button>}
        </div>
      )}
    </div>

    {/* Chỉ số đánh giá — trực quan */}
    {stats.length > 0 && (
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{s.label}</div>
            <div className={`fx-num text-lg font-bold mt-0.5 leading-tight ${s.accent || 'text-white'}`}>{s.value}</div>
          </div>
        ))}
      </div>
    )}
    {r.status === 'bong' && r.notes && (
      <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-400/20 px-3.5 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-rose-300 font-semibold">Lý do bong</div>
        <div className="text-sm text-slate-200 mt-0.5">{r.notes}</div>
      </div>
    )}

    {r.service && <div className="mt-3 text-[15px] text-slate-200 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5">{r.service}</div>}
    {r.consult_note && <div className="mt-2 text-sm text-slate-400 leading-relaxed">{r.consult_note}</div>}

    {(r.consult_image_urls || []).length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {(r.consult_image_urls || []).map((u, i) => <img key={i} src={u} alt="" className="h-20 w-20 object-cover rounded-xl border border-white/10" />)}
      </div>
    )}

    {rs.length > 0 && (
      <div className="mt-4 space-y-2.5">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ghi âm &amp; phân tích AI</div>
        {rs.map(rec => (
          <div key={rec.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-12 h-12 shrink-0 rounded-full border-2 flex flex-col items-center justify-center ${scoreRing(rec.ai_score)}`}>
                {rec.ai_score != null ? <><span className="text-base font-bold leading-none fx-num">{rec.ai_score}</span><span className="text-[8px] opacity-60 leading-none">/10</span></>
                  : rec.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" />
                    : rec.status === 'error' ? <span className="text-[9px] font-bold">Lỗi</span>
                      : <span className="text-xs">—</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {rec.ai_score != null && rec.ai_analysis?.level && <span className="text-sm font-bold text-slate-100">{rec.ai_analysis.level}</span>}
                  {(rec.segment_urls || []).length > 1 && <span className="text-xs text-slate-400">· {rec.segment_urls.length} đoạn</span>}
                  {rec.status === 'processing' && <span className="text-xs text-amber-400">Đang phân tích…</span>}
                  <div className="ml-auto flex items-center gap-1.5">
                    {rec.delete_requested_by && <span className="text-xs font-semibold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">Chờ duyệt xoá</span>}
                    {isAdmin ? (rec.delete_requested_by
                      ? <><button onClick={() => onSoftDelete(rec, 'Duyệt xoá: chuyển ghi âm này vào Thùng rác?')} title="Duyệt xoá" className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button><button onClick={() => onRejectDelete(rec)} title="Từ chối" className="text-slate-400 hover:text-slate-200"><X className="w-3.5 h-3.5" /></button></>
                      : <button onClick={() => onSoftDelete(rec, 'Chuyển ghi âm này vào Thùng rác?')} title="Xoá" className="text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>)
                      : (rec.created_by === me?.id && !rec.delete_requested_by && <button onClick={() => onReqDelete(rec)} title="Yêu cầu xoá" className="text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>)}
                  </div>
                </div>
                <audio src={rec.audio_url} controls className="h-8 w-full mt-1" />
              </div>
            </div>

            {/* Điểm từng tiêu chí — thanh trực quan */}
            {rec.ai_analysis?.criteria && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {Object.entries(CRIT).map(([k, l]) => { const v = rec.ai_analysis.criteria[k]; return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-[11px]"><span className="text-slate-400">{l}</span><span className="fx-num font-bold text-slate-100">{v ?? '—'}<span className="text-slate-500 text-[9px]">/10</span></span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${critBar(v)}`} style={{ width: `${Math.min((Number(v) || 0) * 10, 100)}%` }} /></div>
                  </div>
                ); })}
              </div>
            )}

            {/* Điểm mạnh / cần cải thiện — gọn */}
            {(rec.ai_analysis?.strengths?.length > 0 || rec.ai_analysis?.weaknesses?.length > 0) && (
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {rec.ai_analysis?.strengths?.length > 0 && (
                  <div className="rounded-lg bg-teal-500/10 border border-teal-400/20 p-2.5">
                    <div className="text-[11px] font-bold text-teal-300 mb-1">Điểm mạnh</div>
                    <ul className="text-[13px] text-slate-300 list-disc pl-4 space-y-0.5 leading-snug">{rec.ai_analysis.strengths.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {rec.ai_analysis?.weaknesses?.length > 0 && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-400/20 p-2.5">
                    <div className="text-[11px] font-bold text-rose-300 mb-1">Cần cải thiện</div>
                    <ul className="text-[13px] text-slate-300 list-disc pl-4 space-y-0.5 leading-snug">{rec.ai_analysis.weaknesses.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {rec.ai_analysis?.summary && <div className="text-sm text-slate-400 mt-2.5 leading-relaxed">{rec.ai_analysis.summary}</div>}
            <div className="flex gap-4 mt-2.5">
              {rec.transcript && <button onClick={() => onTranscript(rec)} className="text-sm font-bold text-teal-300 hover:text-teal-200">Xem timeline đầy đủ →</button>}
              {rec.status !== 'processing' && <button onClick={() => onReanalyze(rec.id)} className="text-sm font-semibold text-slate-400 hover:text-slate-200">Phân tích lại</button>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
  );
};

export default KhachTuVanPage;
