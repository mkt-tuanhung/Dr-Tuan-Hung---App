import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadToR2 } from '@/lib/r2Client';
import { UserCheck, CalendarDays, Search, X, Mic, FileText, ClipboardCheck, Phone, ImagePlus, Loader2, Play, Trash2, RotateCcw, Check, ChevronDown, ZoomIn, ChevronLeft, ChevronRight, Users, CreditCard, Activity, Star, TrendingUp, TrendingDown, SlidersHorizontal, Trophy } from 'lucide-react';
import AudioRecorder from '@/components/AudioRecorder.jsx';
import MoneyInput from '@/components/MoneyInput.jsx';
import ImageLightbox from '@/components/ImageLightbox.jsx';
import { vnToday } from '@/lib/vnTime';

// Lưới ảnh bấm được -> mở popup xem/zoom
const Thumbs = ({ urls = [], size = 'h-20 w-20', wrapClass = 'flex flex-wrap gap-2' }) => {
  const [open, setOpen] = useState(null);
  if (!urls.length) return null;
  return (
    <>
      <div className={wrapClass}>
        {urls.map((u, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} className={`${size} rounded-xl overflow-hidden border border-slate-200 relative group hover:ring-2 hover:ring-teal-300 transition-shadow`}>
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
  scheduled: { label: 'Đã tiếp nhận', cls: 'bg-warning-50 text-warning-600' },
  coc: { label: 'Cọc', cls: 'bg-info-50 text-info-600' },
  bong: { label: 'Bong', cls: 'bg-danger-50 text-danger-600' },
  phau_thuat: { label: 'Phẫu thuật', cls: 'bg-success-50 text-success-600' },
};
// Vạch màu trạng thái bên trái mỗi thẻ
const stripCls = { scheduled: 'bg-warning-400', coc: 'bg-info-400', bong: 'bg-danger-400', phau_thuat: 'bg-success-400' };
const inp = 'w-full min-w-0 min-h-[40px] px-3 py-2 text-[14px] rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:ring-[3px] focus:ring-teal-500/20 outline-none transition';
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const maskPhone = (p) => { const s = (p || '').trim(); return s.length <= 4 ? s : s.slice(0, -4) + '••••'; };
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const AV_TONES = ['bg-teal-50 text-teal-700', 'bg-info-50 text-info-600', 'bg-lavender-50 text-lavender-600', 'bg-peach-50 text-peach-600', 'bg-sky-50 text-sky-600', 'bg-success-50 text-success-600'];
const avTone = (name) => AV_TONES[[...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_TONES.length];
const fmtHrMin = (sec) => { const m = Math.round((sec || 0) / 60); if (m < 1) return null; if (m < 60) return `${m} phút`; return `${Math.floor(m / 60)} giờ ${String(m % 60).padStart(2, '0')} phút`; };
const scoreRing = (s) => s == null ? 'text-slate-400 border-slate-200 bg-slate-50' : s >= 8 ? 'text-success-600 border-success-200 bg-success-50' : s >= 5 ? 'text-warning-600 border-warning-200 bg-warning-50' : 'text-danger-600 border-danger-200 bg-danger-50';
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Bôi đỏ/đậm các câu AI thấy chưa phù hợp trong văn bản
const Highlight = ({ text, quotes }) => {
  const qs = (quotes || []).filter(q => q && q.trim().length >= 3).sort((a, b) => b.length - a.length);
  if (!qs.length) return text || '';
  let re; try { re = new RegExp('(' + qs.map(escRe).join('|') + ')', 'gi'); } catch { return text || ''; }
  return (text || '').split(re).map((p, i) => i % 2 === 1
    ? <mark key={i} className="bg-danger-50 text-danger-600 font-semibold rounded px-0.5">{p}</mark>
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
  const scoreCls = (s) => s == null ? 'bg-slate-100 text-slate-600' : s >= 8 ? 'bg-success-50 text-success-600' : s >= 5 ? 'bg-warning-50 text-warning-600' : 'bg-danger-50 text-danger-600';

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
    <div className="space-y-4 text-slate-700">
      {/* Đầu màn: mô tả + chọn tháng thống kê + thùng rác */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="e-page-desc">Tiếp nhận • Hồ sơ • Ghi âm • Đánh giá AI</p>
        <div className="flex items-center gap-2">
          <div className="e-seg gap-0.5">
            <button onClick={prevStatMonth} aria-label="Tháng trước" className="e-seg-item w-8 px-0"><ChevronLeft className="w-4 h-4" /></button>
            <span className="inline-flex items-center justify-center gap-1.5 h-8 px-2 min-w-[104px] text-[13px] font-semibold text-slate-800 tabular-nums"><CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />Th{statMonth}/{statYear}</span>
            <button onClick={nextStatMonth} aria-label="Tháng sau" className="e-seg-item w-8 px-0"><ChevronRight className="w-4 h-4" /></button>
          </div>
        {!loading && isAdmin && trash.length > 0 && (
          <button onClick={() => setTrashOpen(true)} className="e-btn e-btn-secondary inline-flex items-center gap-2 h-10 px-3.5 shrink-0"><Trash2 className="w-4 h-4" /> Thùng rác <span className="bg-danger-50 text-danger-600 font-semibold text-[11px] rounded-full min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center tabular-nums">{trash.length}</span></button>
        )}
        </div>
      </div>

      {/* Thẻ chỉ số (MetricCard Ethics) */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[
            { key: 'total', label: 'Tổng khách', icon: Users, tone: 'teal', value: stat.total, sub: `tiếp nhận Th${statMonth}`, trend: pctTrend(stat.total, prevStat.total), num: 'text-slate-900' },
            { key: 'coc', label: 'Đã cọc', icon: CreditCard, tone: 'blue', value: stat.coc, sub: `cọc Th${statMonth}`, trend: pctTrend(stat.coc, prevStat.coc), num: 'text-slate-900' },
            { key: 'pt', label: 'Phẫu thuật', icon: Activity, tone: 'green', value: stat.pt, sub: `mổ Th${statMonth}`, trend: pctTrend(stat.pt, prevStat.pt), num: 'text-slate-900' },
            { key: 'ai', label: 'Điểm tư vấn TB', icon: Star, tone: 'amber', value: aiAvg != null ? aiAvg.toFixed(1) : '—', sub: `AI • Th${statMonth} /10`, delta: (aiAvg != null && prevAiAvg != null) ? (aiAvg - prevAiAvg) : null, num: 'text-slate-900' },
          ].map(t => {
            const TT = { teal: 'bg-teal-50 text-teal-700', blue: 'bg-info-50 text-info-600', green: 'bg-success-50 text-success-600', amber: 'bg-warning-50 text-warning-600' }[t.tone];
            const up = t.delta != null ? t.delta >= 0 : (t.trend != null ? t.trend >= 0 : null);
            const trendTxt = t.delta != null ? `${t.delta >= 0 ? '↑' : '↓'} ${Math.abs(t.delta).toFixed(1)}` : (t.trend != null ? `${t.trend >= 0 ? '↑' : '↓'} ${Math.abs(t.trend)}%` : null);
            return (
              <div key={t.key} className="e-metric gap-3 sm:gap-4 p-3.5 sm:p-4 lg:p-5">
                <div className={`e-metric-icon w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${TT}`}><t.icon strokeWidth={1.8} /></div>
                <div className="min-w-0 flex-1">
                  <div className="e-metric-label">{t.label}</div>
                  <div className={`e-metric-value ${t.num}`}>{t.value}</div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {trendTxt && <span className={`shrink-0 tabular-nums ${up ? 'e-delta-up' : 'e-delta-down'}`}>{trendTxt}</span>}
                    <span className="e-metric-hint">{t.sub}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs trạng thái — gạch chân teal */}
      {!loading && (
        <div className="e-tabs flex items-stretch gap-1 border-b border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {STATUS_TABS.map(t => {
            const on = statusTab === t.id;
            return (
              <button key={t.id} onClick={() => setStatusTab(t.id)} className={`e-tab relative inline-flex items-center h-11 px-4 whitespace-nowrap transition ${on ? 'e-tab-active text-teal-700 font-semibold whitespace-nowrap' : 'text-slate-500 font-medium hover:text-teal-800'}`}>
                {t.label} <span className="e-tab-count tabular-nums">{tabCount(t.id)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Thanh công cụ: tìm kiếm + bộ lọc */}
      <div className="e-toolbar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…" className="w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-teal-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-700"><X className="w-4 h-4" /></button>}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setFilterOpen(o => !o)} className="e-btn e-btn-secondary">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" /> Bộ lọc <ChevronDown className={`w-4 h-4 text-slate-400 transition ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-float p-1.5 z-30">
                {STATUS_TABS.map(t => (
                  <button key={t.id} onClick={() => { setStatusTab(t.id); setFilterOpen(false); }} className={`w-full text-left h-10 px-3 rounded-xl text-[13px] flex items-center justify-between transition ${statusTab === t.id ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50'}`}>
                    {t.label} <span className="text-[12px] text-slate-400 tabular-nums">{tabCount(t.id)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : listVisible.length === 0 ? (
        <div className="e-card p-10 text-center text-[14px] text-slate-400">Không có khách trong mục này.</div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:gap-4 lg:items-start">
          {/* MASTER — danh sách phẳng */}
          <div className="space-y-2.5 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1 lg:pb-1">
            {listVisible.map(r => {
                    const rs = recsOf(r.id);
                    const dur = fmtHrMin(rs.reduce((s, x) => s + (x.duration_sec || 0), 0));
                    const active = selected?.id === r.id;
                    return (
                      <button key={r.id} onClick={() => { setSelectedId(r.id); setSheetFor(r); }}
                        className={`e-card-flat w-full text-left p-4 flex items-start gap-3 transition ${active ? 'border-teal-400 ring-1 ring-teal-400 shadow-card' : 'hover:border-teal-100 hover:shadow-card'}`}>
                        <div className={`e-avatar w-11 h-11 text-[14px] ${avTone(r.customer_name)}`}>
                          {initials(r.customer_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Hàng 1: TÊN khách — riêng 1 hàng, nổi bật, đầy đủ */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-slate-900 text-[15px] leading-snug break-words flex-1 min-w-0">{r.customer_name}</div>
                            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                          </div>
                          {/* Hàng 2: SĐT · thời lượng */}
                          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1 tabular-nums"><Phone className="w-3.5 h-3.5" strokeWidth={1.9} /> {maskPhone(r.phone)}</span>
                            {dur && <><span className="text-slate-300">·</span><span className="text-slate-500 font-medium tabular-nums">{dur}</span></>}
                          </div>
                          {/* Hàng 3: trạng thái + số ghi âm */}
                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 flex-wrap">
                            <span className={`e-badge e-badge-sm inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap ${ST[r.status]?.cls || 'bg-slate-100 text-slate-600'}`}>{ST[r.status]?.label || r.status}</span>
                            {rs.length > 0 && <span className="ml-auto inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800"><Mic className="w-3.5 h-3.5" /> {rs.length} ghi âm</span>}
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
              : <div className="e-card e-empty p-12 text-center flex flex-col items-center gap-3"><UserCheck className="w-10 h-10 text-teal-300" strokeWidth={1.25} /><span className="text-[14px] font-semibold text-slate-700">Chọn một khách để xem chi tiết</span></div>}
          </div>
        </div>
      )}

      {/* Xếp hạng chất lượng tư vấn (AI) — như RecordingQaPanel của Ethics, nằm dưới danh sách */}
      {lb.length > 0 && (
        <div className="e-card p-4 lg:p-5 min-w-0">
          <div className="e-card-header flex items-center justify-between gap-3 mb-3">
            <h3 className="e-card-title flex items-center gap-2 min-w-0"><Trophy className="w-5 h-5 text-teal-600 shrink-0" /> <span className="truncate">Xếp hạng chất lượng tư vấn (AI) · Th{statMonth}/{statYear}</span></h3>
            <span className="text-[12px] font-medium text-slate-400 inline-flex items-center gap-1 shrink-0">Xem tất cả <ChevronRight className="w-3.5 h-3.5" /></span>
          </div>
          <div className="divide-y divide-slate-100">
            {lb.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-[13px] font-bold tabular-nums ${i === 0 ? 'bg-warning-50 text-warning-600' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-peach-50 text-peach-600' : 'bg-slate-50 text-slate-400'}`}>{i + 1}</span>
                <span className="flex-1 min-w-0 text-[14px] font-semibold text-slate-800 truncate">{e.name}</span>
                <span className={`inline-flex items-center h-[26px] px-2.5 rounded-full text-[12px] font-semibold tabular-nums ${scoreCls(e.avg)}`}>{e.avg.toFixed(1)} / 10</span>
              </div>
            ))}
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
          <div className="e-subtle p-4 mb-4 empty:hidden">
          {transcriptView.ai_score != null && (
            <div className="mb-2 flex items-center gap-2">
              <span className={`inline-flex items-center h-8 px-3 rounded-full text-[14px] font-semibold tabular-nums ${scoreCls(transcriptView.ai_score)}`}>{transcriptView.ai_score}/10 · {transcriptView.ai_analysis?.level || ''}</span>
            </div>
          )}
          {transcriptView.ai_analysis?.summary && <p className="text-[14px] text-slate-700 leading-relaxed">{transcriptView.ai_analysis.summary}</p>}
          </div>
          {transcriptView.ai_analysis?.criteria && (
            <div className="grid grid-cols-2 gap-2 mb-4 text-[13px]">
              {Object.entries({ thien_cam: 'Thiện cảm', khai_thac_nhu_cau: 'Khai thác nhu cầu', tu_van_chuyen_mon: 'Chuyên môn', xu_ly_tu_choi: 'Xử lý từ chối', chot: 'Chốt', thai_do: 'Thái độ' }).map(([k, l]) => (
                <div key={k} className="flex justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5"><span className="text-slate-500">{l}</span><b className="text-slate-900 font-semibold tabular-nums">{transcriptView.ai_analysis.criteria[k] ?? '—'}/10</b></div>
              ))}
            </div>
          )}
          {(transcriptView.ai_analysis?.strengths || []).length > 0 && <div className="mb-4"><div className="text-[13px] font-semibold text-success-600 mb-1.5">Điểm mạnh</div><ul className="text-[13.5px] text-slate-700 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.weaknesses || []).length > 0 && <div className="mb-4"><div className="text-[13px] font-semibold text-peach-600 mb-1.5">Điểm yếu</div><ul className="text-[13.5px] text-slate-700 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.suggestions || []).length > 0 && <div className="mb-4"><div className="text-[13px] font-semibold text-teal-700 mb-1.5">Gợi ý cải thiện</div><ul className="text-[13.5px] text-slate-700 list-disc pl-5 space-y-1 leading-relaxed">{transcriptView.ai_analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {(transcriptView.ai_analysis?.issues || []).length > 0 && (
            <div className="mb-4">
              <div className="text-[13px] font-semibold text-danger-600 mb-1.5">Câu/đoạn chưa phù hợp</div>
              <ul className="space-y-2">
                {transcriptView.ai_analysis.issues.map((it, i) => (
                  <li key={i} className="text-[13px] bg-danger-50 border border-danger-100 rounded-xl p-3">
                    <span className="text-danger-600 font-semibold">“{it.quote}”</span>{it.time ? <span className="text-slate-400 text-[12px]"> · {it.time}</span> : null}
                    {it.reason && <div className="text-slate-500 mt-0.5">{it.reason}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="e-caption mb-2">Văn bản theo mốc thời gian</div>
          {(() => { const quotes = (transcriptView.ai_analysis?.issues || []).map(x => x.quote); const tl = transcriptView.transcript_timeline || []; return (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 max-h-80 overflow-y-auto space-y-3">
              {tl.length > 0
                ? tl.map((b, i) => (
                  <div key={i}>
                    <div className="text-[12px] font-semibold text-teal-700 tabular-nums">{fmtTime(b.from)} – {fmtTime(b.to)}</div>
                    <div className="text-[13.5px] text-slate-700 mt-0.5 leading-relaxed"><Highlight text={b.text} quotes={quotes} /></div>
                  </div>
                ))
                : <div className="text-[13.5px] text-slate-700 whitespace-pre-wrap leading-relaxed"><Highlight text={transcriptView.transcript || '—'} quotes={quotes} /></div>}
            </div>
          ); })()}
        </Modal>
      )}
      {trashOpen && (
        <Modal title={`Thùng rác — ${trash.length} ghi âm`} onClose={() => setTrashOpen(false)}>
          {trash.length === 0 ? <p className="text-[13px] text-slate-400 text-center py-6">Thùng rác trống.</p> : (
            <div className="space-y-2">
              {trash.map(rec => (
                <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-slate-900 truncate">{apptName(rec.appointment_id)}</div>
                      <div className="text-[12px] text-slate-500">{rec.by?.full_name || '—'}{rec.deleted_at ? ` · xoá ${new Date(rec.deleted_at).toLocaleString('vi-VN')}` : ''}</div>
                    </div>
                    {rec.ai_score != null && <span className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold tabular-nums shrink-0 ${scoreCls(rec.ai_score)}`}>{rec.ai_score}/10</span>}
                  </div>
                  <audio src={rec.audio_url} controls className="h-9 w-full mt-2" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => restore(rec)} className="flex-1 h-[34px] rounded-[10px] border border-teal-300 bg-white text-teal-800 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-teal-50 transition"><RotateCcw className="w-3.5 h-3.5" /> Khôi phục</button>
                    <button onClick={() => permanentDelete(rec)} className="flex-1 h-[34px] rounded-[10px] bg-danger-50 text-danger-600 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-danger-100 transition"><Trash2 className="w-3.5 h-3.5" /> Xoá vĩnh viễn</button>
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
  const today = vnToday();
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
  const STBtn = ({ k, label, on }) => <button onClick={() => setF({ ...f, status: k })} className={`e-seg-item flex-1 h-9 ${f.status === k ? on : 'text-slate-500'}`}>{label}</button>;
  return (
    <Modal title="Đánh giá khách" onClose={onClose}>
      <div className="e-subtle px-3.5 py-3 mb-4">
        <p className="min-w-0 text-[13px] text-slate-500">Khách: <b className="text-[14px] font-semibold text-slate-900">{app.customer_name}</b> · {maskPhone(app.phone)}</p>
      </div>
      <label className="e-label">Kết quả tư vấn</label>
      <div className="e-seg w-full mb-4">
        <STBtn k="bong" label="Bong" on="bg-danger-50 text-danger-600 font-semibold" />
        <STBtn k="coc" label="Cọc" on="bg-info-50 text-info-600 font-semibold" />
        <STBtn k="phau_thuat" label="Phẫu thuật" on="bg-success-50 text-success-600 font-semibold" />
      </div>
      <label className="e-label">Loại phẫu thuật</label>
      <div className="flex gap-2 mb-4">
        {['Tiểu phẫu', 'Đại phẫu'].map(t => <button key={t} onClick={() => setF({ ...f, surgery_type: t })} className={`flex-1 h-10 rounded-xl border text-[14px] transition ${f.surgery_type === t ? 'bg-teal-50 text-teal-800 border-teal-500 font-semibold' : 'bg-white text-slate-600 border-slate-200 font-medium hover:border-teal-300 hover:text-teal-800'}`}>{t}</button>)}
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
      <div className="e-subtle px-3.5 py-3 mb-4">
        <p className="min-w-0 text-[13px] text-slate-500">Khách: <b className="text-[14px] font-semibold text-slate-900">{app.customer_name}</b></p>
      </div>
      <Field label="Ghi chú tư vấn"><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className={inp} placeholder="Nội dung tư vấn, nhu cầu khách…" /></Field>
      <label className="e-label">Ảnh hồ sơ <span className="text-slate-400 font-normal">(bấm để xem/zoom)</span></label>
      <div className="flex flex-wrap items-start gap-2 mb-1">
        <Thumbs urls={existing} size="h-16 w-16" wrapClass="flex flex-wrap gap-2" />
        {files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded-xl border-2 border-teal-300" />)}
        <button type="button" onClick={() => fileRef.current?.click()} className="h-16 w-16 rounded-xl border-[1.5px] border-dashed border-teal-300 flex items-center justify-center text-teal-600 hover:bg-teal-50 transition"><ImagePlus className="w-5 h-5" /></button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { setFiles(p => [...p, ...e.target.files]); e.target.value = ''; }} />
      </div>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

const Field = ({ label, children }) => (<div className="mb-4"><label className="e-label">{label}</label>{children}</div>);
const Modal = ({ title, onClose, children }) => (
  <div className="e-modal-backdrop z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="e-modal max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="e-modal-header items-center sticky top-0 z-10 bg-white rounded-t-2xl"><h3 className="e-modal-title">{title}</h3><button onClick={onClose} aria-label="Đóng" className="e-icon-btn w-9 h-9 shrink-0"><X className="w-4 h-4" /></button></div>
      <div className="e-modal-body">{children}</div>
    </div>
  </div>
);
const ModalActions = ({ onClose, onSave, saving }) => (
  <div className="e-modal-footer -mx-5 -mb-4 mt-4">
    <button onClick={onClose} className="e-btn e-btn-secondary flex-1 sm:flex-none">Hủy</button>
    <button onClick={onSave} disabled={saving} className="e-btn e-btn-primary flex-1 sm:flex-none min-w-[96px]">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}</button>
  </div>
);

const ConfirmDialog = ({ message, okLabel = 'Xác nhận', danger = false, onOk, onClose }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="e-modal-backdrop z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="e-modal max-w-sm" onClick={e => e.stopPropagation()}>
        <p className="e-modal-body pt-5 text-[14px] text-slate-700 leading-relaxed">{message}</p>
        <div className="e-modal-footer">
          <button onClick={onClose} className="e-btn e-btn-secondary e-btn-sm">Huỷ</button>
          <button disabled={busy} onClick={async () => { setBusy(true); await onOk(); onClose(); }} className={`e-btn e-btn-sm min-w-[88px] ${danger ? 'e-btn-danger' : 'e-btn-primary'}`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : okLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ---------- Khung chi tiết 1 khách (desktop panel + mobile sheet) ----------
const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const dOnly = (s) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const CRIT = { thien_cam: 'Thiện cảm', khai_thac_nhu_cau: 'Nhu cầu', tu_van_chuyen_mon: 'Chuyên môn', xu_ly_tu_choi: 'Xử lý từ chối', chot: 'Chốt', thai_do: 'Thái độ' };
const critBar = (v) => v == null ? 'bg-slate-300' : v >= 8 ? 'bg-success-500' : v >= 5 ? 'bg-warning-500' : 'bg-danger-500';

const fmtDur = (s) => { s = Number(s) || 0; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

// 1 bản ghi âm — accordion gập/mở để danh sách gọn khi có nhiều bản
const RecordingItem = ({ rec, index, isAdmin, me, onTranscript, onReanalyze, onReqDelete, onSoftDelete, onRejectDelete }) => {
  const [open, setOpen] = useState(index === 0); // mở sẵn bản mới nhất
  const segs = (rec.segment_urls && rec.segment_urls.length) ? rec.segment_urls : (rec.audio_url ? [rec.audio_url] : []);
  const dt = rec.created_at ? new Date(rec.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
      {/* Dòng tóm tắt (kiểu rec-item Ethics) — luôn hiện, bấm để gập/mở */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 transition">
        <div className={`w-11 h-11 shrink-0 rounded-full border-2 flex flex-col items-center justify-center ${scoreRing(rec.ai_score)}`}>
          {rec.ai_score != null ? <><span className="text-[15px] font-bold leading-none fx-num tabular-nums">{rec.ai_score}</span><span className="text-[9px] font-medium opacity-70 leading-none mt-0.5">/10</span></>
            : rec.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" />
              : rec.status === 'error' ? <span className="text-[10px] font-semibold">Lỗi</span>
                : <span className="text-[12px]">—</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold text-slate-900 truncate">{rec.ai_analysis?.level || (rec.status === 'processing' ? 'Đang phân tích…' : rec.status === 'error' ? 'Lỗi phân tích' : 'Bản ghi')}</span>
            {rec.delete_requested_by && <span className="e-badge e-badge-sm e-tone-warning shrink-0">Chờ xoá</span>}
          </div>
          <div className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-0.5 tabular-nums">
            <span>{segs.length} đoạn · {fmtDur(rec.duration_sec)}</span>
            {dt && <span>· {dt}</span>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100">
          {/* Xoá / duyệt xoá */}
          <div className="flex flex-wrap items-center justify-end gap-2 mb-3 empty:hidden">
            {isAdmin ? (rec.delete_requested_by
              ? <><button onClick={() => onSoftDelete(rec, 'Duyệt xoá: chuyển ghi âm này vào Thùng rác?')} className="e-btn e-btn-sm e-btn-danger-soft"><Trash2 className="w-3.5 h-3.5" />Duyệt xoá</button><button onClick={() => onRejectDelete(rec)} className="e-btn e-btn-sm e-btn-secondary">Từ chối</button></>
              : <button onClick={() => onSoftDelete(rec, 'Chuyển ghi âm này vào Thùng rác?')} className="e-btn e-btn-sm e-btn-ghost text-slate-500 hover:text-danger-600 hover:bg-danger-50"><Trash2 className="w-3.5 h-3.5" />Xoá</button>)
              : (rec.created_by === me?.id && !rec.delete_requested_by && <button onClick={() => onReqDelete(rec)} className="e-btn e-btn-sm e-btn-ghost text-slate-500 hover:text-danger-600 hover:bg-danger-50"><Trash2 className="w-3.5 h-3.5" />Yêu cầu xoá</button>)}
          </div>

          {/* Các đoạn ghi âm */}
          {segs.length > 0 && (
            <div className="space-y-2">
              {segs.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  {segs.length > 1 && <span className="text-[12px] font-medium text-slate-500 w-14 shrink-0">Đoạn {i + 1}</span>}
                  <audio src={u} controls preload="none" className="h-9 flex-1 min-w-0" />
                </div>
              ))}
            </div>
          )}

          {/* Điểm từng tiêu chí */}
          {rec.ai_analysis?.criteria && (
            <div className="mt-4 e-subtle p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
              {Object.entries(CRIT).map(([k, l]) => { const v = rec.ai_analysis.criteria[k]; return (
                <div key={k}>
                  <div className="flex items-center justify-between gap-2 text-[12px]"><span className="text-slate-500 truncate">{l}</span><span className="fx-num font-semibold text-slate-900 tabular-nums">{v ?? '—'}<span className="text-slate-400 text-[10px] font-normal">/10</span></span></div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200/70 overflow-hidden"><div className={`h-full rounded-full ${critBar(v)}`} style={{ width: `${Math.min((Number(v) || 0) * 10, 100)}%` }} /></div>
                </div>
              ); })}
            </div>
          )}

          {/* Điểm mạnh / cần cải thiện */}
          {(rec.ai_analysis?.strengths?.length > 0 || rec.ai_analysis?.weaknesses?.length > 0) && (
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {rec.ai_analysis?.strengths?.length > 0 && (
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-success-600 mb-1.5">Điểm mạnh</div>
                  <ul className="text-[13px] text-slate-700 list-disc pl-[18px] space-y-1 leading-relaxed marker:text-success-500">{rec.ai_analysis.strengths.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {rec.ai_analysis?.weaknesses?.length > 0 && (
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-peach-600 mb-1.5">Cần cải thiện</div>
                  <ul className="text-[13px] text-slate-700 list-disc pl-[18px] space-y-1 leading-relaxed marker:text-peach-500">{rec.ai_analysis.weaknesses.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {rec.ai_analysis?.summary && <div className="text-[14px] text-slate-700 mt-4 leading-relaxed">{rec.ai_analysis.summary}</div>}
          <div className="flex flex-wrap gap-2 mt-4 empty:hidden">
            {rec.transcript && <button onClick={() => onTranscript(rec)} className="e-btn e-btn-sm e-btn-outline">Xem timeline đầy đủ →</button>}
            {rec.status !== 'processing' && <button onClick={() => onReanalyze(rec.id)} className="e-btn e-btn-sm e-btn-secondary">Phân tích lại</button>}
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
    ? [{ label: 'Doanh thu', value: money(r.revenue), accent: 'text-teal-700' }, { label: 'Upsale', value: money(r.upsale_revenue), accent: 'text-info-600' }, { label: 'Loại mổ', value: r.surgery_type || '—' }, { label: 'Ngày mổ', value: dOnly(r.surgery_date) }]
    : r.status === 'coc'
      ? [{ label: 'Tiền cọc', value: money(r.deposit_amount), accent: 'text-info-600' }, { label: 'Ngày cọc', value: dOnly(r.deposit_date) }, { label: 'Mổ dự kiến', value: dOnly(r.expected_surgery_date) }, { label: 'Loại mổ', value: r.surgery_type || '—' }]
      : [];
  const TABS = [{ k: 'info', label: 'Thông tin', icon: 'info' }, { k: 'rec', label: 'Ghi âm', icon: 'mic' }, { k: 'file', label: 'Hồ sơ', icon: 'doc' }];
  const hasFile = !!r.consult_note || (r.consult_image_urls || []).length > 0;

  return (
    <div className="lg:hidden fixed inset-0 z-40 bg-[#F3F9F9] flex flex-col">
      {/* Header + tabs gạch chân (cố định trên) */}
      <div className="shrink-0 bg-white shadow-soft" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-2 px-2 h-16">
          <button onClick={close} aria-label="Quay lại" className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 active:bg-slate-100 transition">
            <span className="block w-[11px] h-[11px] border-l-2 border-b-2 border-current rotate-45 ml-[3px]" />
          </button>
          <div className="e-avatar w-11 h-11 text-[14px]">{initials(r.customer_name)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-slate-900 truncate leading-tight">{r.customer_name}</div>
            <div className="text-[12px] text-slate-500 flex items-center gap-2 mt-1 tabular-nums">
              <span>{maskPhone(r.phone)}</span>
              <span className={`e-badge e-badge-sm ${ST[r.status]?.cls || 'bg-slate-100 text-slate-600'}`}>{ST[r.status]?.label || r.status}</span>
            </div>
          </div>
        </div>
        {/* Tab — kiểu e-tabs gạch chân teal, icon CSS */}
        <div className="e-tabs px-2">
          {TABS.map(t => {
            const active = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`e-tab flex-1 justify-center gap-2 px-2 ${active ? 'e-tab-active' : ''}`}>
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
              <div className="grid grid-cols-2 gap-3">
                {stats.map(s => (
                  <div key={s.label} className="e-card-flat px-4 py-3 min-w-0">
                    <div className="e-kv-label text-[12px]">{s.label}</div>
                    <div className={`text-[17px] font-bold mt-0.5 leading-tight tabular-nums truncate ${s.accent || 'text-slate-900'}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
            {r.status === 'bong' && r.notes && (
              <div className="rounded-2xl bg-danger-50 border border-danger-100 px-4 py-3">
                <div className="text-[12px] font-semibold text-danger-600">Lý do bong</div>
                <div className="text-[14px] text-slate-700 mt-0.5 leading-relaxed">{r.notes}</div>
              </div>
            )}
            {r.service && (
              <div className="e-card-flat px-4 py-3">
                <div className="e-caption mb-1.5">Dịch vụ</div>
                <div className="text-[15px] font-semibold text-slate-900">{r.service}</div>
              </div>
            )}
            {r.status === 'scheduled' && canWrite && (
              <button onClick={() => onEval(r)} className="e-btn e-btn-primary e-btn-lg e-btn-block"><ClipboardCheck className="w-5 h-5" /> Đánh giá tư vấn</button>
            )}
            {stats.length === 0 && !r.service && <div className="e-card-flat e-empty text-[13px] text-slate-400">Chưa có thông tin chi tiết.</div>}
          </div>
        )}

        {tab === 'rec' && (
          <div className="space-y-3">
            {canWrite && (
              <button onClick={() => onRec(r)} className="e-btn e-btn-primary e-btn-lg e-btn-block">
                <span className="relative flex w-2.5 h-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" /><span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-white" /></span>
                <Mic className="w-5 h-5" /> Ghi âm mới
              </button>
            )}
            {rs.length === 0 ? (
              <div className="e-card-flat e-empty text-[13px] text-slate-400">Chưa có bản ghi âm nào.</div>
            ) : rs.map((rec, i) => (
              <RecordingItem key={rec.id} rec={rec} index={i} isAdmin={isAdmin} me={me}
                onTranscript={onTranscript} onReanalyze={onReanalyze} onReqDelete={onReqDelete} onSoftDelete={onSoftDelete} onRejectDelete={onRejectDelete} />
            ))}
          </div>
        )}

        {tab === 'file' && (
          <div className="space-y-3">
            {canWrite && (
              <button onClick={() => onConsult(r)} className="e-btn e-btn-secondary e-btn-lg e-btn-block"><FileText className="w-5 h-5" /> {hasFile ? 'Sửa hồ sơ tư vấn' : 'Thêm hồ sơ tư vấn'}</button>
            )}
            {r.consult_note && (
              <div className="e-card-flat px-4 py-3">
                <div className="e-caption mb-1.5">Ghi chú tư vấn</div>
                <div className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line">{r.consult_note}</div>
              </div>
            )}
            {(r.consult_image_urls || []).length > 0 && (
              <div className="e-card-flat px-4 py-3">
                <div className="e-caption mb-2.5">Ảnh hồ sơ ({(r.consult_image_urls || []).length}) · bấm để zoom</div>
                <Thumbs urls={r.consult_image_urls || []} wrapClass="flex flex-wrap gap-2" size="h-24 w-24" />
              </div>
            )}
            {!hasFile && <div className="e-card-flat e-empty text-[13px] text-slate-400">Chưa có hồ sơ tư vấn.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerDetail = ({ r, rs, canWrite, isAdmin, me, onConsult, onRec, onEval, onTranscript, onReanalyze, onReqDelete, onSoftDelete, onRejectDelete }) => {
  const stats = r.status === 'phau_thuat'
    ? [
      { label: 'Doanh thu', value: money(r.revenue), accent: 'text-teal-700' },
      { label: 'Upsale', value: money(r.upsale_revenue), accent: 'text-info-600' },
      { label: 'Loại mổ', value: r.surgery_type || '—' },
      { label: 'Ngày mổ', value: dOnly(r.surgery_date) },
    ]
    : r.status === 'coc'
      ? [
        { label: 'Tiền cọc', value: money(r.deposit_amount), accent: 'text-info-600' },
        { label: 'Ngày cọc', value: dOnly(r.deposit_date) },
        { label: 'Mổ dự kiến', value: dOnly(r.expected_surgery_date) },
        { label: 'Loại mổ', value: r.surgery_type || '—' },
      ]
      : [];
  return (
  <div className="space-y-4">
    {/* Đầu hồ sơ khách (kiểu Customer 360 của Ethics) */}
    <div className="e-card e-card-pad">
    <div className="flex items-start gap-4 flex-wrap">
      <div className="e-avatar w-14 h-14 text-[18px]">{initials(r.customer_name)}</div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[18px] font-[650] text-slate-900 leading-tight">{r.customer_name}</h3>
          <span className={`e-badge e-badge-sm shrink-0 ${ST[r.status]?.cls || 'bg-slate-100 text-slate-600'}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{ST[r.status]?.label || r.status}</span>
        </div>
        <div className="text-[13px] text-slate-500 flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 tabular-nums"><span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75} /> {maskPhone(r.phone)}</span>{r.appointment_date && <span className="text-slate-500 before:content-['·'] before:mr-3 before:text-slate-300">{dOnly(r.appointment_date)}</span>}</div>
      </div>
      {/* Hành động: Hồ sơ (phụ) · Ghi âm (chính) · Đánh giá (viền teal) */}
      {canWrite && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button title="Hồ sơ tư vấn" onClick={() => onConsult(r)} className="e-btn e-btn-secondary e-btn-sm"><FileText className="w-4 h-4" strokeWidth={2} />Hồ sơ</button>
          <button title="Ghi âm cuộc tư vấn" onClick={() => onRec(r)} className="e-btn e-btn-primary e-btn-sm"><span className="relative flex w-2 h-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" /><span className="relative inline-flex rounded-full w-2 h-2 bg-white" /></span><Mic className="w-4 h-4" strokeWidth={2} />Ghi âm</button>
          {r.status === 'scheduled' && <button title="Đánh giá" onClick={() => onEval(r)} className="e-btn e-btn-outline e-btn-sm"><ClipboardCheck className="w-4 h-4" strokeWidth={2} />Đánh giá</button>}
        </div>
      )}
    </div>

    {/* Chỉ số đánh giá — trực quan */}
    {stats.length > 0 && (
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="e-subtle px-3.5 py-3 min-w-0">
            <div className="e-kv-label">{s.label}</div>
            <div className={`fx-num text-[16px] font-bold mt-0.5 leading-tight tabular-nums truncate ${s.accent || 'text-slate-900'}`}>{s.value}</div>
          </div>
        ))}
      </div>
    )}
    {r.status === 'bong' && r.notes && (
      <div className="mt-4 rounded-xl bg-danger-50 border border-danger-100 px-4 py-3">
        <div className="text-[12px] font-semibold text-danger-600">Lý do bong</div>
        <div className="text-[14px] text-slate-700 mt-0.5 leading-relaxed">{r.notes}</div>
      </div>
    )}
    </div>

    {/* Hồ sơ tư vấn: dịch vụ + ghi chú + ảnh (ẩn cả thẻ khi chưa có gì) */}
    <div className="e-card e-card-pad space-y-3 [&:not(:has(>:nth-child(2)))]:hidden">
    <div className="e-card-title">Hồ sơ tư vấn</div>
    {r.service && <div className="text-[14px] font-semibold text-slate-800 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">{r.service}</div>}
    {r.consult_note && <div className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">{r.consult_note}</div>}

    <Thumbs urls={r.consult_image_urls || []} />
    </div>


    {rs.length > 0 && (
      <div className="e-card e-card-pad space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="e-card-title">Ghi âm &amp; phân tích AI</div>
          <span className="text-[12px] font-medium text-slate-400">· {rs.length} bản</span>
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
