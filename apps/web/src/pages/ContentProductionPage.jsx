import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import {
  Clapperboard, Plus, Search, X, Link as LinkIcon, ExternalLink, Trophy,
  Scissors, CheckCircle2, RotateCcw, PlayCircle, PauseCircle, Circle, Film, Hand,
} from 'lucide-react';

const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const STAGES = [
  { key: 'source_ready', label: 'Chờ dựng', cls: 'bg-slate-100 text-slate-600' },
  { key: 'editing', label: 'Đang dựng', cls: 'bg-blue-100 text-blue-700' },
  { key: 'review', label: 'Chờ Ads duyệt', cls: 'bg-amber-100 text-amber-700' },
  { key: 'revision', label: 'Cần sửa', cls: 'bg-rose-100 text-rose-700' },
  { key: 'approved', label: 'Đã duyệt / Chạy', cls: 'bg-violet-100 text-violet-700' },
  { key: 'done', label: 'Hoàn tất', cls: 'bg-emerald-100 text-emerald-700' },
];
const AD_STATUS = { dang_chay: { label: 'Đang chạy', cls: 'text-emerald-600', icon: PlayCircle }, tam_dung: { label: 'Tạm dừng', cls: 'text-amber-600', icon: PauseCircle }, chua_chay: { label: 'Chưa chạy', cls: 'text-slate-400', icon: Circle } };
const parseLinks = (t) => (t || '').split('\n').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));

const ContentProductionPage = () => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const isAdmin = roles.includes('admin');
  const canMedia = roles.includes('media') || isAdmin;
  const canEdit = roles.includes('editor') || isAdmin;
  const canAds = roles.includes('marketing') || isAdmin;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitFor, setSubmitFor] = useState(null);   // task đang nộp clip
  const [reviewFor, setReviewFor] = useState(null);    // task đang duyệt
  const [evalFor, setEvalFor] = useState(null);        // task đang chấm Win

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const { data } = await supabase.from('content_tasks')
      .select('*, media:profiles!media_id(full_name), editor:profiles!editor_id(full_name), ads:profiles!ads_id(full_name)')
      .order('updated_at', { ascending: false });
    setTasks(data || []);
    didLoad.current = true;
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('content_tasks', loadData);

  // ---- Hành động ----
  const patch = async (id, payload, okMsg) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...payload } : t)); // cập nhật lạc quan
    const { error } = await supabase.from('content_tasks').update(payload).eq('id', id);
    if (error) { toast.error('Lỗi: ' + error.message); loadData(); return false; }
    if (okMsg) toast.success(okMsg);
    return true;
  };
  const claim = (t) => patch(t.id, { editor_id: me.id, stage: 'editing' }, 'Đã nhận việc dựng video');
  const approve = (t) => patch(t.id, { stage: 'approved', approved_at: new Date().toISOString(), ads_id: me.id }, 'Đã duyệt video');
  const setAd = (t, ad_status) => patch(t.id, { ad_status, ads_id: me.id }, 'Đã cập nhật trạng thái chạy');
  const removeTask = async (t) => {
    if (!confirm('Xoá video này?')) return;
    setTasks(prev => prev.filter(x => x.id !== t.id));
    await supabase.from('content_tasks').delete().eq('id', t.id);
  };

  // Bảng xếp hạng editor theo Win tháng này
  const now = new Date();
  const winsThisMonth = tasks.filter(t => t.win && t.evaluated_at && new Date(t.evaluated_at).getMonth() === now.getMonth() && new Date(t.evaluated_at).getFullYear() === now.getFullYear());
  const lb = Object.values(winsThisMonth.reduce((acc, t) => {
    const id = t.editor_id; if (!id) return acc;
    acc[id] = acc[id] || { id, name: t.editor?.full_name || 'Editor', wins: 0, money: 0 };
    acc[id].wins += 1; acc[id].money += Number(t.win_amount || 0);
    return acc;
  }, {})).sort((a, b) => b.wins - a.wins).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Clapperboard className="w-6 h-6 text-emerald-600" /> Sản xuất content quảng cáo</h2>
          <p className="text-slate-400 text-sm mt-0.5">Media → Editor → Ads · theo dõi & chấm Win</p>
        </div>
        {canMedia && (
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Thêm video
          </button>
        )}
      </div>

      {/* Bảng xếp hạng Editor */}
      {lb.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-amber-600 mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" /> Bảng xếp hạng Editor — Win tháng {now.getMonth() + 1}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lb.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
                  {e.name}
                </span>
                <span className="text-sm font-bold text-emerald-600">{e.wins} Win · {fmtM(e.money)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {STAGES.map(st => {
            const list = tasks.filter(t => t.stage === st.key);
            return (
              <div key={st.key} className="bg-slate-50/70 rounded-2xl p-3">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                  <span className="text-xs text-slate-400 font-medium">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && <p className="text-xs text-slate-300 text-center py-4">—</p>}
                  {list.map(t => (
                    <TaskCard key={t.id} t={t} me={me} canEdit={canEdit} canAds={canAds} isAdmin={isAdmin}
                      onClaim={claim} onSubmit={() => setSubmitFor(t)} onReview={() => setReviewFor(t)}
                      onApprove={approve} onSetAd={setAd} onEval={() => setEvalFor(t)} onDelete={removeTask} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && <AddModal me={me} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); loadData(); }} />}
      {submitFor && <SubmitModal task={submitFor} onClose={() => setSubmitFor(null)} onSaved={async (links, note) => {
        await patch(submitFor.id, { edited_links: links, editor_note: note, stage: 'review', edited_at: new Date().toISOString() }, 'Đã nộp clip — chờ Ads duyệt');
        setSubmitFor(null);
      }} />}
      {reviewFor && <ReviewModal task={reviewFor} onClose={() => setReviewFor(null)}
        onApprove={async () => { await approve(reviewFor); setReviewFor(null); }}
        onRevise={async (note) => { await patch(reviewFor.id, { stage: 'revision', revision_note: note, revision_count: (reviewFor.revision_count || 0) + 1, ads_id: me.id }, 'Đã gửi yêu cầu sửa'); setReviewFor(null); }} />}
      {evalFor && <EvalModal task={evalFor} onClose={() => setEvalFor(null)} onSaved={async (payload) => {
        await patch(evalFor.id, { ...payload, evaluated_at: new Date().toISOString(), stage: 'done', ads_id: me.id }, payload.win ? '🏆 Đã chấm WIN!' : 'Đã lưu đánh giá');
        setEvalFor(null);
      }} />}
    </div>
  );
};

// ---------- Thẻ công việc ----------
const LinkList = ({ links }) => (
  (links || []).length === 0 ? <span className="text-xs text-slate-300">—</span> :
    <div className="flex flex-col gap-0.5">
      {(links || []).map((l, i) => (
        <a key={i} href={l} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate">
          <ExternalLink className="w-3 h-3 shrink-0" /> Link {i + 1}
        </a>
      ))}
    </div>
);

const TaskCard = ({ t, me, canEdit, canAds, isAdmin, onClaim, onSubmit, onReview, onApprove, onSetAd, onEval, onDelete }) => {
  const mineEditor = t.editor_id === me?.id;
  const Btn = ({ onClick, children, cls = 'bg-emerald-600 hover:bg-emerald-700' }) => (
    <button onClick={onClick} className={`text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg ${cls}`}>{children}</button>
  );
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 text-sm truncate">{t.customer_name || 'Khách'}</div>
          <div className="text-xs text-slate-400">{t.customer_phone}</div>
        </div>
        {t.win && <span className="shrink-0 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Trophy className="w-3 h-3" /> Win</span>}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><div className="text-slate-400 flex items-center gap-1"><Film className="w-3 h-3" /> Source</div><LinkList links={t.source_links} /></div>
        <div><div className="text-slate-400 flex items-center gap-1"><Scissors className="w-3 h-3" /> Clip</div><LinkList links={t.edited_links} /></div>
      </div>

      <div className="mt-2 text-xs text-slate-500 space-y-0.5">
        {t.media?.full_name && <div>Media: <b className="text-slate-600">{t.media.full_name}</b></div>}
        {t.editor?.full_name && <div>Editor: <b className="text-slate-600">{t.editor.full_name}</b></div>}
        {t.revision_count > 0 && <div className="text-rose-500">Đã sửa {t.revision_count} lần</div>}
        {t.ad_status && AD_STATUS[t.ad_status] && (
          <div className={`flex items-center gap-1 font-medium ${AD_STATUS[t.ad_status].cls}`}>
            {React.createElement(AD_STATUS[t.ad_status].icon, { className: 'w-3 h-3' })} {AD_STATUS[t.ad_status].label}
          </div>
        )}
        {t.win_amount > 0 && <div className="text-emerald-600 font-medium">Thưởng: {fmtM(t.win_amount)}</div>}
        {t.revision_note && t.stage === 'revision' && <div className="text-rose-500 italic">“{t.revision_note}”</div>}
      </div>

      {/* Hành động theo trạng thái + vai trò */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {t.stage === 'source_ready' && canEdit && <Btn onClick={() => onClaim(t)}><Hand className="w-3 h-3 inline mr-0.5" />Nhận dựng</Btn>}
        {(t.stage === 'editing' || t.stage === 'revision') && (mineEditor || isAdmin) && <Btn onClick={onSubmit}>Nộp clip</Btn>}
        {t.stage === 'review' && canAds && <Btn onClick={onReview} cls="bg-amber-500 hover:bg-amber-600">Duyệt video</Btn>}
        {(t.stage === 'approved' || t.stage === 'done') && canAds && (
          <>
            <select value={t.ad_status || ''} onChange={e => onSetAd(t, e.target.value)} className="text-xs border border-slate-200 rounded-lg px-1.5 py-1">
              <option value="">Trạng thái…</option>
              <option value="dang_chay">Đang chạy</option>
              <option value="tam_dung">Tạm dừng</option>
              <option value="chua_chay">Chưa chạy</option>
            </select>
            <Btn onClick={onEval} cls="bg-violet-600 hover:bg-violet-700">{t.win == null ? 'Chấm Win' : 'Sửa đánh giá'}</Btn>
          </>
        )}
        {(t.media_id === me?.id || isAdmin) && t.stage === 'source_ready' && (
          <button onClick={() => onDelete(t)} className="text-xs text-rose-500 px-2 py-1.5 hover:bg-rose-50 rounded-lg">Xoá</button>
        )}
      </div>
    </div>
  );
};

// ---------- Modal: Media thêm video ----------
const AddModal = ({ me, onClose, onSaved }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [links, setLinks] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  const onSearch = (val) => {
    setQ(val); setPicked(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc('search_content_customers', { q: val });
      setResults(data || []);
    }, 250);
  };
  useEffect(() => { supabase.rpc('search_content_customers', { q: '' }).then(({ data }) => setResults(data || [])); }, []);

  const save = async () => {
    if (!picked) { toast.error('Chọn khách hàng'); return; }
    const arr = parseLinks(links);
    if (arr.length === 0) { toast.error('Dán ít nhất 1 link Google Drive (http...)'); return; }
    setSaving(true);
    const { error } = await supabase.from('content_tasks').insert({
      appointment_id: picked.appointment_id, customer_name: picked.customer_name, customer_phone: picked.phone,
      media_id: me.id, source_links: arr, media_note: note || null, stage: 'source_ready',
    });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã thêm video — chờ editor nhận'); onSaved();
  };

  return (
    <Modal title="Thêm video báo cáo" onClose={onClose}>
      <label className="block text-sm font-semibold text-slate-700 mb-1">Khách hàng</label>
      {picked ? (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">
          <span className="text-sm font-medium text-slate-700">{picked.customer_name} · {picked.phone}</span>
          <button onClick={() => setPicked(null)}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      ) : (
        <div className="mb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input autoFocus value={q} onChange={e => onSearch(e.target.value)} placeholder="Tìm theo tên / SĐT khách…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none" />
          </div>
          <div className="max-h-44 overflow-y-auto mt-1 border border-slate-100 rounded-xl divide-y">
            {results.map(r => (
              <button key={r.appointment_id} onClick={() => setPicked(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50">
                <div className="font-medium text-slate-700">{r.customer_name} <span className="text-slate-400 font-normal">· {r.phone}</span></div>
                <div className="text-xs text-slate-400">{r.service || ''}{r.last_date ? ` · ${new Date(r.last_date).toLocaleDateString('vi-VN')}` : ''}</div>
              </button>
            ))}
            {results.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">Không tìm thấy khách (từ lịch hẹn/tái khám)</div>}
          </div>
        </div>
      )}
      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5" /> Link source (mỗi dòng 1 link)</label>
      <textarea value={links} onChange={e => setLinks(e.target.value)} rows={3} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />
      <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Modal: Editor nộp clip ----------
const SubmitModal = ({ task, onClose, onSaved }) => {
  const [links, setLinks] = useState((task.edited_links || []).join('\n'));
  const [note, setNote] = useState(task.editor_note || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const arr = parseLinks(links);
    if (arr.length === 0) { toast.error('Dán link clip đã dựng (http...)'); return; }
    setSaving(true); await onSaved(arr, note || null); setSaving(false);
  };
  return (
    <Modal title="Nộp clip đã dựng" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">Khách: <b>{task.customer_name}</b></p>
      <label className="block text-sm font-semibold text-slate-700 mb-1">Link clip (mỗi dòng 1 link)</label>
      <textarea autoFocus value={links} onChange={e => setLinks(e.target.value)} rows={3} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />
      <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel="Nộp clip" />
    </Modal>
  );
};

// ---------- Modal: Ads duyệt ----------
const ReviewModal = ({ task, onClose, onApprove, onRevise }) => {
  const [note, setNote] = useState('');
  return (
    <Modal title="Duyệt video" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{task.customer_name}</b></p>
      <div className="mb-3"><LinkList links={task.edited_links} /></div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">Yêu cầu chỉnh sửa (nếu có)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Mô tả cần sửa…" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
      <div className="flex justify-end gap-2">
        <button onClick={() => { if (!note.trim()) { toast.error('Nhập yêu cầu sửa'); return; } onRevise(note.trim()); }} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600 flex items-center gap-1"><RotateCcw className="w-4 h-4" /> Cần sửa</button>
        <button onClick={onApprove} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Đạt yêu cầu</button>
      </div>
    </Modal>
  );
};

// ---------- Modal: Ads chấm Win ----------
const EvalModal = ({ task, onClose, onSaved }) => {
  const [win, setWin] = useState(task.win ?? false);
  const [amount, setAmount] = useState(task.win_amount ? String(task.win_amount) : '');
  const [score, setScore] = useState(task.score ? String(task.score) : '');
  const [note, setNote] = useState(task.result_note || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await onSaved({
      win, win_amount: win ? (Number(String(amount).replace(/\D/g, '')) || 0) : 0,
      score: Number(score) || 0, result_note: note || null,
    });
    setSaving(false);
  };
  return (
    <Modal title="Đánh giá hiệu quả & chấm Win" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">Khách: <b>{task.customer_name}</b> · Editor: <b>{task.editor?.full_name || '—'}</b></p>
      <button onClick={() => setWin(w => !w)} className={`w-full mb-3 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${win ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' : 'bg-slate-100 text-slate-500 border-2 border-transparent'}`}>
        <Trophy className="w-5 h-5" /> {win ? 'WIN — clip hiệu quả' : 'Chưa Win (bấm để đánh dấu Win)'}
      </button>
      {win && (
        <>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Tiền thưởng cho editor</label>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="VD: 100000" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />
        </>
      )}
      <label className="block text-sm font-semibold text-slate-700 mb-1">Điểm chất lượng (tuỳ chọn)</label>
      <input value={score} onChange={e => setScore(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="0–10" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />
      <label className="block text-sm font-semibold text-slate-700 mb-1">Nhận xét kết quả</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel="Lưu đánh giá" />
    </Modal>
  );
};

// ---------- Khung modal chung ----------
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="px-5 py-3.5 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
const ModalActions = ({ onClose, onSave, saving, saveLabel = 'Lưu' }) => (
  <div className="flex justify-end gap-2">
    <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
    <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-sm">{saving ? 'Đang lưu…' : saveLabel}</button>
  </div>
);

export default ContentProductionPage;
