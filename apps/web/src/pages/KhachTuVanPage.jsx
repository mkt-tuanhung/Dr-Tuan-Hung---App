import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadToR2 } from '@/lib/r2Client';
import { UserCheck, UserPlus, CalendarDays, Search, X, Mic, FileText, ClipboardCheck, Phone, ImagePlus, Loader2, Play, Trash2, RotateCcw, Check, ChevronDown, ZoomIn, ChevronLeft, ChevronRight, Users, CreditCard, Activity, Star, TrendingUp, TrendingDown, SlidersHorizontal, Trophy } from 'lucide-react';
import AudioRecorder from '@/components/AudioRecorder.jsx';
import MoneyInput from '@/components/MoneyInput.jsx';
import ImageLightbox from '@/components/ImageLightbox.jsx';

// Lưới ảnh bấm được -> mở popup xem/zoom
const Thumbs = ({ urls = [], size = 'h-20 w-20', wrapClass = 'mt-3 flex flex-wrap gap-2' }) => {
  const [open, setOpen] = useState(null);
  if (!urls.length) return null;
  return (
    <>
      <div className={wrapClass}>
        {urls.map((u, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} className={`${size} rounded-xl overflow-hidden border border-slate-100 relative group hover:ring-2 hover:ring-emerald-300 transition-shadow`}>
            <img src={u} alt="" className="w-full h-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
        ))}
      </div>
      {open !== null && <ImageLightbox images={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
};

const ST = {
  scheduled: { label: 'Đã tiếp nhận', cls: 'bg-amber-100 text-amber-700' },
  coc: { label: 'Cọc', cls: 'bg-blue-50 text-blue-600' },
  bong: { label: 'Bong', cls: 'bg-rose-50 text-rose-600' },
  phau_thuat: { label: 'Phẫu thuật', cls: 'bg-emerald-50 text-emerald-600' },
};
// Vạch màu trạng thái bên trái mỗi thẻ
const stripCls = { scheduled: 'from-amber-400 to-amber-500', coc: 'from-cyan-400 to-cyan-500', bong: 'from-rose-400 to-rose-500', phau_thuat: 'from-emerald-400 to-emerald-500' };
const inp = 'w-full min-w-0 px-3.5 py-2.5 text-[15px] rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition';
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const maskPhone = (p) => { const s = (p || '').trim(); return s.length <= 4 ? s : s.slice(0, -4) + '••••'; };
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const AV_TONES = ['from-emerald-500 to-emerald-600', 'from-blue-500 to-blue-600', 'from-violet-500 to-violet-600', 'from-orange-400 to-orange-500', 'from-sky-400 to-sky-500', 'from-emerald-500 to-emerald-600'];
const avTone = (name) => AV_TONES[[...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_TONES.length];
const fmtHrMin = (sec) => { const m = Math.round((sec || 0) / 60); if (m < 1) return null; if (m < 60) return `${m} phút`; return `${Math.floor(m / 60)} giờ ${String(m % 60).padStart(2, '0')} phút`; };
const scoreRing = (s) => s == null ? 'text-slate-400 border-slate-200 bg-white' : s >= 8 ? 'text-emerald-600 border-emerald-300 bg-emerald-50' : s >= 5 ? 'text-amber-600 border-amber-300 bg-amber-50' : 'text-rose-600 border-rose-300 bg-rose-50';
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
  const [statusTab, setStatusTab] = useState('all');   // lọc theo trạng thái (tab)
  const [filterOpen, setFilterOpen] = useState(false); // dropdown "Bộ lọc"
  const [selectedId, setSelectedId] = useState(null);  // desktop: khách đang xem chi tiết
  const [sheetFor, setSheetFor] = useState(null);       // mobile: khách mở trong sheet
  const _now = new Date();
  const [statMonth, setStatMonth] = useState(_now.getMonth() + 1);
  const [statYear, setStatYear] = useState(_now.getFullYear());

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

  // ---- Thống kê THEO THÁNG (statMonth/statYear) ----
  const inStatMonth = (ds) => { if (!ds) return false; const d = new Date(ds); return d.getMonth() + 1 === statMonth && d.getFullYear() === statYear; };
  const prevStatMonth = () => { if (statMonth === 1) { setStatMonth(12); setStatYear(y => y - 1); } else setStatMonth(m => m - 1); };
  const nextStatMonth = () => { if (statMonth === 12) { setStatMonth(1); setStatYear(y => y + 1); } else setStatMonth(m => m + 1); };

  const monthRecs = recs.filter(r => r.ai_score != null && !r.deleted_at && inStatMonth(r.created_at));
  // Bảng xếp hạng chất lượng tư vấn (điểm AI TB theo sale) — trong tháng
  const lb = Object.values(monthRecs.reduce((a, r) => {
    const id = r.created_by || 'x';
    a[id] = a[id] || { id, name: r.by?.full_name || 'Sale', n: 0, sum: 0 };
    a[id].n++; a[id].sum += Number(r.ai_score || 0); return a;
  }, {})).map(e => ({ ...e, avg: e.n ? e.sum / e.n : 0 })).sort((x, y) => y.avg - x.avg).slice(0, 5);
  const scoreCls = (s) => s == null ? 'bg-slate-100 text-slate-500' : s >= 8 ? 'bg-emerald-100 text-emerald-700' : s >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  // Số liệu tổng quan cho hero — theo tháng
  const stat = {
    total: rows.filter(r => inStatMonth(r.appointment_date || r.created_at)).length,   // khách tiếp nhận trong tháng
    coc: rows.filter(r => r.status === 'coc' && inStatMonth(r.deposit_date || r.appointment_date || r.created_at)).length,
    pt: rows.filter(r => r.status === 'phau_thuat' && inStatMonth(r.surgery_date || r.appointment_date || r.created_at)).length,
  };
  const aiAvg = monthRecs.length ? monthRecs.reduce((s, r) => s + Number(r.ai_score || 0), 0) / monthRecs.length : null;

  // Xu hướng so tháng trước
  const pmonth = statMonth === 1 ? 12 : statMonth - 1;
  const pyear = statMonth === 1 ? statYear - 1 : statYear;
  const inPrev = (ds) => { if (!ds) return false; const d = new Date(ds); return d.getMonth() + 1 === pmonth && d.getFullYear() === pyear; };
  const prevStat = {
    total: rows.filter(r => inPrev(r.appointment_date || r.created_at)).length,
    coc: rows.filter(r => r.status === 'coc' && inPrev(r.deposit_date || r.appointment_date || r.created_at)).length,
    pt: rows.filter(r => r.status === 'phau_thuat' && inPrev(r.surgery_date || r.appointment_date || r.created_at)).length,
  };
  const prevRecs = recs.filter(r => r.ai_score != null && !r.deleted_at && inPrev(r.created_at));
  const prevAiAvg = prevRecs.length ? prevRecs.reduce((s, r) => s + Number(r.ai_score || 0), 0) / prevRecs.length : null;
  const pctTrend = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? 100 : null);

  // Tabs trạng thái + danh sách đã lọc (Bỏ lỡ = bong)
  const STATUS_TABS = [
    { id: 'all', label: 'Tất cả' }, { id: 'coc', label: 'Đã cọc' },
    { id: 'phau_thuat', label: 'Phẫu thuật' }, { id: 'bong', label: 'Bỏ lỡ' },
  ];
  const tabCount = (id) => id === 'all' ? visible.length : visible.filter(r => r.status === id).length;
  const listVisible = statusTab === 'all' ? visible : visible.filter(r => r.status === statusTab);

  return (
    <div className="fx-shell rounded-[28px] p-4 sm:p-5 space-y-4 text-slate-700">
      {/* Hero — xanh nhạt + minh hoạ hồ sơ/ghi âm */}
      <div className="relative overflow-hidden rounded-3xl p-5 border border-emerald-100/70 shadow-sm" style={{ background: 'linear-gradient(120deg, #eafaf1 0%, #e2f5ec 55%, #d6f0e3 100%)' }}>
        {/* minh hoạ hồ sơ + ghi âm */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" aria-hidden="true">
            <defs><linearGradient id="ktvFolder" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5ecfa8" /><stop offset="1" stopColor="#3bb98d" /></linearGradient></defs>
            {/* thân sau + tab */}
            <path d="M28 28h15l5 6h25a5 5 0 0 1 5 5v34a5 5 0 0 1-5 5H28a5 5 0 0 1-5-5V33a5 5 0 0 1 5-5z" fill="url(#ktvFolder)" />
            {/* tài liệu */}
            <g transform="rotate(-5 50 55)">
              <rect x="31" y="33" width="41" height="41" rx="4" fill="#ffffff" />
              <rect x="37" y="41" width="14" height="4.5" rx="2.25" fill="#bfe9d6" />
              <rect x="37" y="50" width="29" height="3" rx="1.5" fill="#dbe4ea" />
              <rect x="37" y="57" width="25" height="3" rx="1.5" fill="#dbe4ea" />
              <rect x="37" y="64" width="19" height="3" rx="1.5" fill="#dbe4ea" />
            </g>
            {/* túi trước */}
            <path d="M23 50h54v22a5 5 0 0 1-5 5H28a5 5 0 0 1-5-5z" fill="#6ad4ae" />
            {/* badge nhỏ trái */}
            <rect x="15" y="44" width="16" height="14" rx="4" fill="#e2f5ea" />
            <circle cx="20" cy="49" r="1.3" fill="#3bb98d" /><circle cx="26" cy="49" r="1.3" fill="#3bb98d" /><circle cx="23" cy="53" r="1.3" fill="#3bb98d" />
            {/* vòng ghi âm */}
            <circle cx="74" cy="71" r="15" fill="#ffffff" stroke="#e6f6ee" strokeWidth="2" />
            <g fill="#22b183">
              <rect x="65.5" y="67" width="2.6" height="8" rx="1.3" /><rect x="69.7" y="63" width="2.6" height="16" rx="1.3" />
              <rect x="73.9" y="59" width="2.6" height="24" rx="1.3" /><rect x="78.1" y="64" width="2.6" height="14" rx="1.3" /><rect x="82.3" y="68" width="2.6" height="6" rx="1.3" />
            </g>
            {/* sparkles */}
            <path d="M89 27l1.3 3.4 3.4 1.3-3.4 1.3-1.3 3.4-1.3-3.4-3.4-1.3 3.4-1.3z" fill="#e9f4a6" />
            <path d="M83 36l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#d6efb0" opacity="0.9" />
          </svg>
        </div>
        <div className="relative z-10 flex items-center gap-3.5 max-w-[62%]">
          <span className="w-14 h-14 rounded-2xl bg-white/80 text-emerald-600 grid place-items-center shrink-0 shadow-sm"><UserPlus className="w-7 h-7" strokeWidth={1.9} /></span>
          <div className="min-w-0">
            <h2 className="text-[24px] font-bold tracking-tight leading-tight text-slate-800">Khách tư vấn</h2>
            <p className="text-slate-500 text-sm mt-1">Tiếp nhận • Hồ sơ • Ghi âm • Đánh giá AI</p>
          </div>
        </div>
      </div>

      {/* Chọn tháng + thùng rác */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 pl-3 pr-1.5 py-1 shadow-sm">
          <CalendarDays className="w-4 h-4 text-emerald-500 shrink-0" />
          <button onClick={prevStatMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-bold text-slate-700 min-w-[72px] text-center">Th{statMonth}/{statYear}</span>
          <button onClick={nextStatMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {!loading && isAdmin && trash.length > 0 && (
          <button onClick={() => setTrashOpen(true)} className="bg-white rounded-xl border border-slate-200 shadow-sm text-sm font-semibold text-slate-600 px-3.5 py-2.5 inline-flex items-center gap-2"><Trash2 className="w-4 h-4" /> Thùng rác <span className="bg-rose-50 text-rose-600 font-bold text-xs rounded-full min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center">{trash.length}</span></button>
        )}
      </div>

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { key: 'total', label: 'Tổng khách', icon: Users, tone: 'teal', value: stat.total, sub: `tiếp nhận Th${statMonth}`, trend: pctTrend(stat.total, prevStat.total), num: 'text-slate-800' },
            { key: 'coc', label: 'Đã cọc', icon: CreditCard, tone: 'blue', value: stat.coc, sub: `cọc Th${statMonth}`, trend: pctTrend(stat.coc, prevStat.coc), num: 'text-slate-800' },
            { key: 'pt', label: 'Phẫu thuật', icon: Activity, tone: 'green', value: stat.pt, sub: `mổ Th${statMonth}`, trend: pctTrend(stat.pt, prevStat.pt), num: 'text-slate-800' },
            { key: 'ai', label: 'Điểm tư vấn TB', icon: Star, tone: 'amber', value: aiAvg != null ? aiAvg.toFixed(1) : '—', sub: `AI • Th${statMonth} /10`, delta: (aiAvg != null && prevAiAvg != null) ? (aiAvg - prevAiAvg) : null, num: 'text-orange-500' },
          ].map(t => {
            const TT = { teal: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-500' }[t.tone];
            const up = t.delta != null ? t.delta >= 0 : (t.trend != null ? t.trend >= 0 : null);
            const trendTxt = t.delta != null ? `${t.delta >= 0 ? '↑' : '↓'} ${Math.abs(t.delta).toFixed(1)}` : (t.trend != null ? `${t.trend >= 0 ? '↑' : '↓'} ${Math.abs(t.trend)}%` : null);
            return (
              <div key={t.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
                <div className={`w-10 h-10 rounded-xl grid place-items-center mb-2 ${TT}`}><t.icon className="w-5 h-5" strokeWidth={1.9} /></div>
                <div className="text-[11px] text-slate-500 font-semibold">{t.label}</div>
                <div className={`text-2xl font-extrabold leading-none mt-0.5 ${t.num}`}>{t.value}</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">{t.sub}</div>
                {trendTxt && <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 mt-2 ${up ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>{trendTxt}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Search + Bộ lọc */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…" className="w-full pl-11 pr-10 py-3.5 text-sm rounded-2xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setFilterOpen(o => !o)} className="h-[50px] px-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-sm font-semibold text-slate-600 inline-flex items-center gap-2 hover:border-emerald-300 transition">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" /> Bộ lọc <ChevronDown className={`w-4 h-4 text-slate-400 transition ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl p-1.5 z-30">
                {STATUS_TABS.map(t => (
                  <button key={t.id} onClick={() => { setStatusTab(t.id); setFilterOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition ${statusTab === t.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {t.label} <span className="text-xs text-slate-400">{tabCount(t.id)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {lb.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h3 className="font-bold text-slate-800 text-[15px] flex items-center gap-2 min-w-0"><Trophy className="w-5 h-5 text-amber-500 shrink-0" /> <span className="truncate">Xếp hạng chất lượng tư vấn (AI) · Th{statMonth}/{statYear}</span></h3>
            <span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1 inline-flex items-center gap-1 shrink-0">Xem tất cả <ChevronRight className="w-3.5 h-3.5" /></span>
          </div>
          <div className="divide-y divide-slate-50">
            {lb.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-sm font-extrabold ${i === 0 ? 'text-white bg-gradient-to-br from-amber-400 to-amber-500' : i === 1 ? 'text-white bg-gradient-to-br from-slate-300 to-slate-400' : i === 2 ? 'text-white bg-gradient-to-br from-orange-300 to-orange-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                <span className="flex-1 min-w-0 font-bold text-slate-700 truncate">{e.name}</span>
                <span className={`text-[13px] font-extrabold px-3 py-1 rounded-full ${scoreCls(e.avg)}`}>{e.avg.toFixed(1)} / 10</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs trạng thái */}
      {!loading && (
        <div className="flex gap-5 border-b border-slate-200 overflow-x-auto -mx-1 px-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {STATUS_TABS.map(t => {
            const on = statusTab === t.id;
            return (
              <button key={t.id} onClick={() => setStatusTab(t.id)} className={`pb-3 pt-1 text-[15px] font-bold whitespace-nowrap border-b-2 -mb-px transition ${on ? 'text-emerald-700 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                {t.label} ({tabCount(t.id)})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : listVisible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">Không có khách trong mục này.</div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(300px,380px)_1fr] lg:gap-5 lg:items-start">
          {/* MASTER — danh sách phẳng */}
          <div className="space-y-3 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
            {listVisible.map(r => {
                    const rs = recsOf(r.id);
                    const dur = fmtHrMin(rs.reduce((s, x) => s + (x.duration_sec || 0), 0));
                    const active = selected?.id === r.id;
                    return (
                      <button key={r.id} onClick={() => { setSelectedId(r.id); setSheetFor(r); }}
                        className={`w-full text-left rounded-2xl p-3.5 flex items-start gap-3 border shadow-sm transition ${active ? 'border-emerald-300 ring-1 ring-emerald-200 bg-white' : 'border-slate-100 bg-white hover:border-emerald-200'}`}>
                        <div className={`relative w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${avTone(r.customer_name)} text-white grid place-items-center font-extrabold text-base`}>
                          {initials(r.customer_name)}
                          <span className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Hàng 1: TÊN khách — riêng 1 hàng, nổi bật, đầy đủ */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-extrabold text-slate-800 text-[17px] leading-snug break-words flex-1">{r.customer_name}</div>
                            <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                          </div>
                          {/* Hàng 2: SĐT · thời lượng */}
                          <div className="flex items-center gap-2 mt-1.5 text-[13px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" strokeWidth={1.9} /> {maskPhone(r.phone)}</span>
                            {dur && <><span className="text-slate-300">·</span><span className="text-rose-500 font-semibold">{dur}</span></>}
                          </div>
                          {/* Hàng 3: trạng thái + số ghi âm */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-[12.5px] font-bold px-3 py-1 rounded-full ${ST[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{ST[r.status]?.label || r.status}</span>
                            {rs.length > 0 && <span className="inline-flex items-center gap-1 text-[12px] font-bold text-rose-500 bg-rose-50 rounded-full px-2.5 py-1"><Mic className="w-3.5 h-3.5" /> {rs.length} ghi âm</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
          </div>

          {/* DETAIL — desktop: khung chi tiết dính cạnh phải */}
          <div className="hidden lg:block lg:sticky lg:top-4">
            {selected
              ? <CustomerDetail r={selected} rs={recsOf(selected.id)} canWrite={canWrite} isAdmin={isAdmin} me={me}
                  onConsult={setConsultFor} onRec={setRecFor} onEval={setEvalFor} onTranscript={setTranscriptView}
                  onReanalyze={reanalyze} onReqDelete={requestDelete} onSoftDelete={softDelete} onRejectDelete={rejectDelete} />
              : <div className="fx-glass rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center gap-3"><UserCheck className="w-12 h-12 text-slate-300" strokeWidth={1.25} /><span className="font-semibold">Chọn một khách để xem chi tiết</span></div>}
          </div>
        </div>
      )}

      {/* DETAIL — mobile: sheet trượt lên khi chạm 1 khách */}
      {sheetFor && (() => { const live = visible.find(x => x.id === sheetFor.id) || sheetFor; return (
        <CustomerScreen r={live} rs={recsOf(live.id)} canWrite={canWrite} isAdmin={isAdmin} me={me}
          onClose={() => setSheetFor(null)}
          onConsult={setConsultFor} onRec={setRecFor} onEval={setEvalFor} onTranscript={setTranscriptView}
          onReanalyze={reanalyze} onReqDelete={requestDelete} onSoftDelete={softDelete} onRejectDelete={rejectDelete} />
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
          {(transcriptView.ai_analysis?.strengths || []).length > 0 && <div className="mb-3"><div className="text-sm font-bold text-emerald-600 mb-1">Điểm mạnh</div><ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
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
                    <div className="text-xs font-bold text-emerald-600">{fmtTime(b.from)} – {fmtTime(b.to)}</div>
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
                    <button onClick={() => restore(rec)} className="flex-1 h-9 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-50"><RotateCcw className="w-3.5 h-3.5" /> Khôi phục</button>
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
      <p className="text-sm text-slate-500 mb-3">Khách: <b className="text-slate-700">{app.customer_name}</b> · {maskPhone(app.phone)}</p>
      <div className="flex bg-slate-100 rounded-full p-1 mb-4">
        <STBtn k="bong" label="Bong" on="bg-orange-400 text-white shadow" />
        <STBtn k="coc" label="Cọc" on="bg-cyan-500 text-white shadow" />
        <STBtn k="phau_thuat" label="Phẫu thuật" on="bg-emerald-600 text-white shadow" />
      </div>
      <label className="block text-sm font-bold text-slate-700 mb-1.5">Loại phẫu thuật</label>
      <div className="flex gap-2 mb-4">
        {['Tiểu phẫu', 'Đại phẫu'].map(t => <button key={t} onClick={() => setF({ ...f, surgery_type: t })} className={`flex-1 py-2.5 text-[15px] font-semibold rounded-xl border transition ${f.surgery_type === t ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{t}</button>)}
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
      <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh hồ sơ <span className="text-slate-400 font-normal">(bấm để xem/zoom)</span></label>
      <div className="flex flex-wrap items-start gap-2 mb-4">
        <Thumbs urls={existing} size="h-16 w-16" wrapClass="flex flex-wrap gap-2" />
        {files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded-lg border border-emerald-300" />)}
        <button type="button" onClick={() => fileRef.current?.click()} className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-emerald-400"><ImagePlus className="w-5 h-5" /></button>
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
    <button onClick={onSave} disabled={saving} className="flex-1 sm:flex-none px-6 h-11 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-[15px] inline-flex items-center justify-center">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}</button>
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
          <button disabled={busy} onClick={async () => { setBusy(true); await onOk(); onClose(); }} className={`px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : okLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ---------- Khung chi tiết 1 khách (desktop panel + mobile sheet) ----------
const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const dOnly = (s) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const CRIT = { thien_cam: 'Thiện cảm', khai_thac_nhu_cau: 'Nhu cầu', tu_van_chuyen_mon: 'Chuyên môn', xu_ly_tu_choi: 'Xử lý từ chối', chot: 'Chốt', thai_do: 'Thái độ' };
const critBar = (v) => v == null ? 'bg-slate-500' : v >= 8 ? 'bg-emerald-400' : v >= 5 ? 'bg-amber-400' : 'bg-rose-400';

const fmtDur = (s) => { s = Number(s) || 0; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

// 1 bản ghi âm — accordion gập/mở để danh sách gọn khi có nhiều bản
const RecordingItem = ({ rec, index, isAdmin, me, onTranscript, onReanalyze, onReqDelete, onSoftDelete, onRejectDelete }) => {
  const [open, setOpen] = useState(index === 0); // mở sẵn bản mới nhất
  const segs = (rec.segment_urls && rec.segment_urls.length) ? rec.segment_urls : (rec.audio_url ? [rec.audio_url] : []);
  const dt = rec.created_at ? new Date(rec.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 overflow-hidden">
      {/* Dòng tóm tắt — luôn hiện, bấm để gập/mở */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-slate-100/70 transition">
        <div className={`w-10 h-10 shrink-0 rounded-full border-2 flex flex-col items-center justify-center ${scoreRing(rec.ai_score)}`}>
          {rec.ai_score != null ? <><span className="text-sm font-bold leading-none fx-num">{rec.ai_score}</span><span className="text-[7px] opacity-60 leading-none">/10</span></>
            : rec.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" />
              : rec.status === 'error' ? <span className="text-[9px] font-bold">Lỗi</span>
                : <span className="text-xs">—</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-700 truncate">{rec.ai_analysis?.level || (rec.status === 'processing' ? 'Đang phân tích…' : rec.status === 'error' ? 'Lỗi phân tích' : 'Bản ghi')}</span>
            {rec.delete_requested_by && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Chờ xoá</span>}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
            <span>{segs.length} đoạn · {fmtDur(rec.duration_sec)}</span>
            {dt && <span>· {dt}</span>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3">
          {/* Xoá / duyệt xoá */}
          <div className="flex items-center justify-end gap-3 mb-2">
            {isAdmin ? (rec.delete_requested_by
              ? <><button onClick={() => onSoftDelete(rec, 'Duyệt xoá: chuyển ghi âm này vào Thùng rác?')} className="text-xs font-semibold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Duyệt xoá</button><button onClick={() => onRejectDelete(rec)} className="text-xs font-semibold text-slate-400 hover:text-slate-600">Từ chối</button></>
              : <button onClick={() => onSoftDelete(rec, 'Chuyển ghi âm này vào Thùng rác?')} className="text-xs font-semibold text-slate-400 hover:text-rose-500 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Xoá</button>)
              : (rec.created_by === me?.id && !rec.delete_requested_by && <button onClick={() => onReqDelete(rec)} className="text-xs font-semibold text-slate-400 hover:text-rose-500 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Yêu cầu xoá</button>)}
          </div>

          {/* Các đoạn ghi âm */}
          {segs.length > 0 && (
            <div className="space-y-1.5">
              {segs.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  {segs.length > 1 && <span className="text-[11px] font-bold text-slate-400 w-14 shrink-0">Đoạn {i + 1}</span>}
                  <audio src={u} controls preload="none" className="h-8 flex-1 min-w-0" />
                </div>
              ))}
            </div>
          )}

          {/* Điểm từng tiêu chí */}
          {rec.ai_analysis?.criteria && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              {Object.entries(CRIT).map(([k, l]) => { const v = rec.ai_analysis.criteria[k]; return (
                <div key={k}>
                  <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">{l}</span><span className="fx-num font-bold text-slate-700">{v ?? '—'}<span className="text-slate-400 text-[9px]">/10</span></span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${critBar(v)}`} style={{ width: `${Math.min((Number(v) || 0) * 10, 100)}%` }} /></div>
                </div>
              ); })}
            </div>
          )}

          {/* Điểm mạnh / cần cải thiện */}
          {(rec.ai_analysis?.strengths?.length > 0 || rec.ai_analysis?.weaknesses?.length > 0) && (
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {rec.ai_analysis?.strengths?.length > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
                  <div className="text-[11px] font-bold text-emerald-700 mb-1">Điểm mạnh</div>
                  <ul className="text-[13px] text-slate-600 list-disc pl-4 space-y-0.5 leading-snug">{rec.ai_analysis.strengths.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {rec.ai_analysis?.weaknesses?.length > 0 && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-2.5">
                  <div className="text-[11px] font-bold text-rose-700 mb-1">Cần cải thiện</div>
                  <ul className="text-[13px] text-slate-600 list-disc pl-4 space-y-0.5 leading-snug">{rec.ai_analysis.weaknesses.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {rec.ai_analysis?.summary && <div className="text-sm text-slate-500 mt-2.5 leading-relaxed">{rec.ai_analysis.summary}</div>}
          <div className="flex gap-4 mt-2.5">
            {rec.transcript && <button onClick={() => onTranscript(rec)} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">Xem timeline đầy đủ →</button>}
            {rec.status !== 'processing' && <button onClick={() => onReanalyze(rec.id)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Phân tích lại</button>}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Icon thuần CSS cho tab (không dùng thư viện icon) ----------
const CssIcon = ({ type }) => {
  if (type === 'info') return (
    <span className="relative inline-block w-[19px] h-[19px] rounded-full border-2 border-current">
      <span className="absolute left-1/2 -translate-x-1/2 top-[2.5px] w-[2px] h-[2px] rounded-full bg-current" />
      <span className="absolute left-1/2 -translate-x-1/2 top-[6.5px] w-[2px] h-[7px] rounded-[1px] bg-current" />
    </span>
  );
  if (type === 'mic') return (
    <span className="relative inline-block w-[19px] h-[19px]">
      <span className="absolute top-[1px] left-1/2 -translate-x-1/2 w-[8px] h-[10px] rounded-full bg-current" />
      <span className="absolute top-[4px] left-1/2 -translate-x-1/2 w-[14px] h-[8px] border-2 border-current border-t-transparent rounded-b-[8px]" />
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[8px] h-[2px] bg-current rounded" />
    </span>
  );
  // doc / hồ sơ
  return (
    <span className="relative inline-flex flex-col items-center justify-center gap-[2.5px] w-[15px] h-[19px] border-2 border-current rounded-[3px]">
      <span className="w-[7px] h-[1.5px] bg-current rounded" />
      <span className="w-[7px] h-[1.5px] bg-current rounded" />
      <span className="w-[4px] h-[1.5px] bg-current rounded self-start ml-[2.5px]" />
    </span>
  );
};

// ---------- Trang FULL MÀN HÌNH 3 tab cho mobile ----------
const CustomerScreen = ({ r, rs, canWrite, isAdmin, me, onClose, onConsult, onRec, onEval, onTranscript, onReanalyze, onReqDelete, onSoftDelete, onRejectDelete }) => {
  const [tab, setTab] = useState('info');
  const touch = useRef(null);
  const order = ['info', 'rec', 'file'];

  // Nút Back / vuốt-back của iPhone -> đóng trang (không rời khỏi app)
  useEffect(() => {
    window.history.pushState({ ktvScreen: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onClose]);
  const close = () => window.history.back();

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;   // phải là vuốt ngang rõ rệt
    const i = order.indexOf(tab);
    if (dx < 0 && i < order.length - 1) setTab(order[i + 1]);
    else if (dx > 0 && i > 0) setTab(order[i - 1]);
  };

  const stats = r.status === 'phau_thuat'
    ? [{ label: 'Doanh thu', value: money(r.revenue), accent: 'text-emerald-600' }, { label: 'Upsale', value: money(r.upsale_revenue), accent: 'text-cyan-600' }, { label: 'Loại mổ', value: r.surgery_type || '—' }, { label: 'Ngày mổ', value: dOnly(r.surgery_date) }]
    : r.status === 'coc'
      ? [{ label: 'Tiền cọc', value: money(r.deposit_amount), accent: 'text-cyan-600' }, { label: 'Ngày cọc', value: dOnly(r.deposit_date) }, { label: 'Mổ dự kiến', value: dOnly(r.expected_surgery_date) }, { label: 'Loại mổ', value: r.surgery_type || '—' }]
      : [];
  const TABS = [{ k: 'info', label: 'Thông tin', icon: 'info' }, { k: 'rec', label: 'Ghi âm', icon: 'mic' }, { k: 'file', label: 'Hồ sơ', icon: 'doc' }];
  const hasFile = !!r.consult_note || (r.consult_image_urls || []).length > 0;

  return (
    <div className="lg:hidden fixed inset-0 z-40 bg-slate-50 flex flex-col">
      {/* Header + tabs (cố định trên) */}
      <div className="shrink-0 bg-white border-b border-slate-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-1 px-1.5 h-14">
          <button onClick={close} aria-label="Quay lại" className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100 transition">
            <span className="block w-[11px] h-[11px] border-l-2 border-b-2 border-current rotate-45 ml-[3px]" />
          </button>
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-bold text-sm">{initials(r.customer_name)}</div>
          <div className="min-w-0 flex-1 ml-1">
            <div className="font-bold text-slate-800 truncate leading-tight">{r.customer_name}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{maskPhone(r.phone)}</span>
              <span className={`px-1.5 py-px rounded-full font-bold ${ST[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{ST[r.status]?.label || r.status}</span>
            </div>
          </div>
        </div>
        {/* Tab switcher — nút to, dễ nhìn, icon CSS */}
        <div className="flex gap-1.5 px-2 pb-2">
          {TABS.map(t => {
            const active = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-bold transition-all ${active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-100 text-slate-400 active:bg-slate-200'}`}>
                <CssIcon type={t.icon} />
                <span>{t.label}{t.k === 'rec' && rs.length ? ` (${rs.length})` : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nội dung tab (cuộn + vuốt ngang đổi tab) */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {tab === 'info' && (
          <div className="space-y-3">
            {stats.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                {stats.map(s => (
                  <div key={s.label} className="rounded-2xl bg-white border border-slate-100 shadow-sm px-3.5 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{s.label}</div>
                    <div className={`text-lg font-bold mt-0.5 leading-tight ${s.accent || 'text-slate-800'}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
            {r.status === 'bong' && r.notes && (
              <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3">
                <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold">Lý do bong</div>
                <div className="text-sm text-slate-700 mt-0.5">{r.notes}</div>
              </div>
            )}
            {r.service && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Dịch vụ</div>
                <div className="text-[15px] text-slate-700">{r.service}</div>
              </div>
            )}
            {r.status === 'scheduled' && canWrite && (
              <button onClick={() => onEval(r)} className="w-full fx-btn-primary h-12 rounded-2xl text-white font-bold inline-flex items-center justify-center gap-2"><ClipboardCheck className="w-5 h-5" /> Đánh giá tư vấn</button>
            )}
            {stats.length === 0 && !r.service && <div className="text-center py-10 text-slate-400 text-sm">Chưa có thông tin chi tiết.</div>}
          </div>
        )}

        {tab === 'rec' && (
          <div className="space-y-3">
            {canWrite && (
              <button onClick={() => onRec(r)} className="w-full h-12 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30">
                <span className="relative flex w-2.5 h-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" /><span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-white" /></span>
                <Mic className="w-5 h-5" /> Ghi âm mới
              </button>
            )}
            {rs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">Chưa có bản ghi âm nào.</div>
            ) : rs.map((rec, i) => (
              <RecordingItem key={rec.id} rec={rec} index={i} isAdmin={isAdmin} me={me}
                onTranscript={onTranscript} onReanalyze={onReanalyze} onReqDelete={onReqDelete} onSoftDelete={onSoftDelete} onRejectDelete={onRejectDelete} />
            ))}
          </div>
        )}

        {tab === 'file' && (
          <div className="space-y-3">
            {canWrite && (
              <button onClick={() => onConsult(r)} className="w-full h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold inline-flex items-center justify-center gap-2 active:bg-slate-50"><FileText className="w-5 h-5" /> {hasFile ? 'Sửa hồ sơ tư vấn' : 'Thêm hồ sơ tư vấn'}</button>
            )}
            {r.consult_note && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Ghi chú tư vấn</div>
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{r.consult_note}</div>
              </div>
            )}
            {(r.consult_image_urls || []).length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Ảnh hồ sơ ({(r.consult_image_urls || []).length}) · bấm để zoom</div>
                <Thumbs urls={r.consult_image_urls || []} wrapClass="flex flex-wrap gap-2" size="h-24 w-24" />
              </div>
            )}
            {!hasFile && <div className="text-center py-10 text-slate-400 text-sm">Chưa có hồ sơ tư vấn.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerDetail = ({ r, rs, canWrite, isAdmin, me, onConsult, onRec, onEval, onTranscript, onReanalyze, onReqDelete, onSoftDelete, onRejectDelete }) => {
  const stats = r.status === 'phau_thuat'
    ? [
      { label: 'Doanh thu', value: money(r.revenue), accent: 'text-emerald-600' },
      { label: 'Upsale', value: money(r.upsale_revenue), accent: 'text-cyan-600' },
      { label: 'Loại mổ', value: r.surgery_type || '—' },
      { label: 'Ngày mổ', value: dOnly(r.surgery_date) },
    ]
    : r.status === 'coc'
      ? [
        { label: 'Tiền cọc', value: money(r.deposit_amount), accent: 'text-cyan-600' },
        { label: 'Ngày cọc', value: dOnly(r.deposit_date) },
        { label: 'Mổ dự kiến', value: dOnly(r.expected_surgery_date) },
        { label: 'Loại mổ', value: r.surgery_type || '—' },
      ]
      : [];
  return (
  <div className="fx-glass relative overflow-hidden rounded-3xl p-5">
    <span className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${stripCls[r.status] || 'from-slate-300 to-slate-400'}`} />
    <div className="flex items-start gap-3.5 flex-wrap">
      <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-bold text-lg">{initials(r.customer_name)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-slate-800 text-lg leading-tight">{r.customer_name}</h3>
          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${ST[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}><span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{ST[r.status]?.label || r.status}</span>
        </div>
        <div className="text-sm text-slate-400 flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5"><span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75} /> {maskPhone(r.phone)}</span>{r.appointment_date && <span className="text-slate-500">{dOnly(r.appointment_date)}</span>}</div>
      </div>
      {/* Nút gọn nhưng nổi bật — nhãn + màu rõ */}
      {canWrite && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button title="Hồ sơ tư vấn" onClick={() => onConsult(r)} className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-[13px] font-bold hover:bg-slate-50 hover:border-slate-300 transition"><FileText className="w-4 h-4" strokeWidth={2} />Hồ sơ</button>
          <button title="Ghi âm cuộc tư vấn" onClick={() => onRec(r)} className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-[13px] font-bold shadow-lg shadow-rose-500/40 hover:brightness-110 transition"><span className="relative flex w-2 h-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" /><span className="relative inline-flex rounded-full w-2 h-2 bg-white" /></span><Mic className="w-4 h-4" strokeWidth={2} />Ghi âm</button>
          {r.status === 'scheduled' && <button title="Đánh giá" onClick={() => onEval(r)} className="fx-btn-primary h-9 px-3.5 rounded-xl text-white text-[13px] font-bold inline-flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" strokeWidth={2} />Đánh giá</button>}
        </div>
      )}
    </div>

    {/* Chỉ số đánh giá — trực quan */}
    {stats.length > 0 && (
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-white/60 border border-white/70 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{s.label}</div>
            <div className={`fx-num text-lg font-bold mt-0.5 leading-tight ${s.accent || 'text-slate-800'}`}>{s.value}</div>
          </div>
        ))}
      </div>
    )}
    {r.status === 'bong' && r.notes && (
      <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-3.5 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold">Lý do bong</div>
        <div className="text-sm text-slate-700 mt-0.5">{r.notes}</div>
      </div>
    )}

    {r.service && <div className="mt-3 text-[15px] text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">{r.service}</div>}
    {r.consult_note && <div className="mt-2 text-sm text-slate-500 leading-relaxed">{r.consult_note}</div>}

    <Thumbs urls={r.consult_image_urls || []} />


    {rs.length > 0 && (
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ghi âm &amp; phân tích AI</div>
          <span className="text-[11px] font-bold text-slate-400">· {rs.length} bản</span>
        </div>
        {rs.map((rec, i) => (
          <RecordingItem key={rec.id} rec={rec} index={i} isAdmin={isAdmin} me={me}
            onTranscript={onTranscript} onReanalyze={onReanalyze} onReqDelete={onReqDelete} onSoftDelete={onSoftDelete} onRejectDelete={onRejectDelete} />
        ))}
      </div>
    )}
  </div>
  );
};

export default KhachTuVanPage;
