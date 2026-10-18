// ============================================================
// TÀI LIỆU — thư viện tài liệu PDF cho TOÀN BỘ nhân viên
// - Thẻ tài liệu: ảnh bìa, loại, số trang, số chương, số nhân viên đã đọc, tiến độ của tôi
// - Tìm kiếm nội dung trên mọi trang của mọi tài liệu (không cần gõ dấu), lọc theo loại,
//   xem theo chương (mục lục) -> bấm là mở đúng trang
// - Trình đọc lật trang 3D (BookReader, nạp khi mở)
// - Admin: thêm / sửa / ẩn tài liệu, tải PDF thẳng lên R2, tự trích chữ để tìm kiếm
// - Admin / Kế toán / Cổ đông: thống kê từng nhân viên đã đọc bao nhiêu trang, bao nhiêu phút
// Bảng: library_documents, library_pages, library_reads (supabase/tai_lieu.sql)
// ============================================================
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Search, BookOpen, ChevronDown, Users, Clock, FileText, Settings2, Upload, Plus, Loader2,
  BarChart3, EyeOff, Eye, RefreshCw, CheckCircle2, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2, uploadViaPresignWithProgress } from '@/lib/r2Client';
import { Drawer } from '@/components/ds/Overlay.jsx';
import {
  CATEGORIES, catOf, chapterOf, chapterLabel, normQuery, snippetOf, cleanText, extractPdf, fmtMinutes,
} from './libraryUtil';

const BookReader = lazy(() => import('./BookReader.jsx'));

const hasRole = (p, roles) => [p?.role, p?.role_2].some(r => roles.includes(r));
const fmtDate = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');
const GOLD = '#D9B77A';

export default function LibraryPage() {
  const { profile } = useAuth();
  const meId = profile?.id;
  const isAdmin = hasRole(profile, ['admin']);
  const canSeeTeam = hasRole(profile, ['admin', 'accountant', 'shareholder']);
  const [docs, setDocs] = useState([]);
  const [mine, setMine] = useState({});         // doc_id -> dòng đọc của tôi
  const [stats, setStats] = useState({});       // doc_id -> { readers, total_seconds }
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [reading, setReading] = useState(null); // { doc, page }
  const [manageOpen, setManageOpen] = useState(false);
  const [statsDoc, setStatsDoc] = useState(null);

  const load = useCallback(async () => {
    const [{ data: ds, error }, { data: rs }, { data: st }] = await Promise.all([
      supabase.from('library_documents').select('*').order('sort').order('created_at'),
      meId ? supabase.from('library_reads').select('*').eq('user_id', meId) : Promise.resolve({ data: [] }),
      supabase.rpc('library_doc_stats'),
    ]);
    if (error) { setMissing(/relation|does not exist|schema cache/i.test(error.message)); setLoading(false); return; }
    setDocs(ds || []);
    setMine(Object.fromEntries((rs || []).map(r => [r.doc_id, r])));
    setStats(Object.fromEntries((st || []).map(r => [r.doc_id, r])));
    setLoading(false);
  }, [meId]);
  useEffect(() => { load(); }, [load]);

  const visibleDocs = useMemo(() => docs.filter(d => (d.active || isAdmin) && (cat === 'all' || d.category === cat)), [docs, cat, isAdmin]);
  const cats = useMemo(() => [...new Set(docs.filter(d => d.active).map(d => d.category))], [docs]);
  const totalPagesRead = Object.values(mine).reduce((s, r) => s + (r.pages_seen?.length || 0), 0);
  const totalSec = Object.values(mine).reduce((s, r) => s + (r.seconds || 0), 0);

  const openDoc = (doc, page) => {
    if (!doc.file_url) { toast(isAdmin ? 'Tài liệu chưa có file — bấm "Quản lý tài liệu" để tải PDF lên.' : 'Tài liệu đang được cập nhật.'); return; }
    const resume = mine[doc.id]?.last_page;
    const p = page || (resume && resume > 1 ? resume : 1);
    if (!page && resume > 1) toast(`Đọc tiếp từ trang ${resume}`);
    setReading({ doc, page: p });
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>;
  if (missing) {
    return (
      <div className="e-card e-card-pad text-[14px] text-slate-600">
        <b>Chưa bật module Tài liệu.</b> {isAdmin ? <>Chạy file <code className="px-1 rounded bg-slate-100">supabase/tai_lieu.sql</code> trong Supabase SQL Editor.</> : 'Nhờ Admin bật tính năng này.'}
      </div>
    );
  }

  const searching = normQuery(q).length >= 2;

  return (
    <div className="space-y-4">
      {/* Banner + ô tìm kiếm */}
      <div className="relative overflow-hidden rounded-2xl text-white px-5 py-5 lg:px-7 lg:py-6" style={{ background: 'linear-gradient(135deg,#0B2522 0%,#123B36 55%,#0E2E2A 100%)' }}>
        <div className="absolute -right-12 -top-16 w-60 h-60 rounded-full opacity-[0.10]" style={{ background: GOLD }} />
        <div className="relative">
          <div className="text-[11.5px] tracking-[0.18em] font-semibold" style={{ color: GOLD }}>DR TUẤN HÙNG · THƯ VIỆN</div>
          <h2 className="mt-1 text-[22px] lg:text-[26px] font-bold leading-tight text-white">Tài liệu</h2>
          <p className="mt-1 text-[13.5px] text-white/75">
            {docs.filter(d => d.active).length} tài liệu · bạn đã đọc {totalPagesRead} trang · {fmtMinutes(totalSec)}
          </p>
          <div className="mt-4 relative max-w-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/55" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nội dung trong tài liệu (vd: thay băng, nâng mũi, tin nhắn mẫu…)"
              className="w-full h-12 pl-11 pr-10 rounded-xl bg-white/10 border border-white/15 text-[14.5px] text-white placeholder:text-white/45 outline-none focus:border-[#D9B77A]/70 focus:bg-white/15" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Xoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>}
          </div>
        </div>
      </div>

      {/* Bộ lọc loại + nút quản lý */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
          {[['all', 'Tất cả'], ...cats.map(c => [c, catOf(c).label])].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setCat(id)}
              className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-medium border transition ${cat === id ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && <button type="button" onClick={() => setManageOpen(true)} className="e-btn e-btn-outline e-btn-sm shrink-0"><Settings2 />Quản lý tài liệu</button>}
      </div>

      {searching ? (
        <SearchResults q={q} docs={visibleDocs.filter(d => d.active && d.file_url)} onOpen={openDoc} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-4">
          {visibleDocs.map(d => (
            <DocCard key={d.id} doc={d} mine={mine[d.id]} stat={stats[d.id]} canSeeTeam={canSeeTeam}
              onOpen={(p) => openDoc(d, p)} onStats={() => setStatsDoc(d)} />
          ))}
          {!visibleDocs.length && <div className="e-card e-card-pad text-[14px] text-slate-500">Chưa có tài liệu nào.</div>}
        </div>
      )}

      {reading && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-[#0D2522] text-white"><Loader2 className="w-7 h-7 animate-spin" /></div>}>
          <BookReader doc={reading.doc} startPage={reading.page} onClose={() => { setReading(null); setTimeout(load, 600); }} />
        </Suspense>
      )}
      {isAdmin && <ManageDrawer open={manageOpen} onClose={() => setManageOpen(false)} docs={docs} meId={meId} onChanged={load} />}
      {canSeeTeam && <StatsDrawer doc={statsDoc} onClose={() => setStatsDoc(null)} />}
    </div>
  );
}

// ---------------- Thẻ tài liệu ----------------
function DocCard({ doc, mine, stat, canSeeTeam, onOpen, onStats }) {
  const [showToc, setShowToc] = useState(false);
  const n = doc.page_count || 0;
  const read = mine?.pages_seen?.length || 0;
  const pct = n ? Math.min(100, Math.round(read / n * 100)) : 0;
  const c = catOf(doc.category);
  const toc = doc.toc || [];
  const resume = mine?.last_page > 1 ? mine.last_page : null;
  const { chap } = chapterOf(toc, resume || 1);

  return (
    <div className={`e-card overflow-hidden ${doc.active ? '' : 'opacity-60'}`}>
      <div className="flex gap-4 p-3.5 sm:p-4">
        <button type="button" onClick={() => onOpen()} className="relative self-start w-[104px] sm:w-[128px] shrink-0 aspect-[420/595] rounded-lg overflow-hidden bg-slate-200 shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)] group">
          {doc.cover_url ? <img src={doc.cover_url} alt={doc.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <FileText className="absolute inset-0 m-auto w-8 h-8 text-slate-400" />}
          <span className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 to-transparent" />
          {pct >= 100 && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-500 grid place-items-center"><CheckCircle2 className="w-4 h-4 text-white" /></span>}
        </button>
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>
            {!doc.active && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Đang ẩn</span>}
            {!doc.file_url && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Chờ tải file</span>}
          </div>
          <h3 className="mt-1.5 text-[15.5px] sm:text-[16.5px] font-bold text-slate-900 leading-snug line-clamp-2">{doc.title}</h3>
          {doc.subtitle && <p className="mt-1 text-[12.5px] sm:text-[13px] text-slate-500 leading-snug line-clamp-2">{doc.subtitle}</p>}
          <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{n} trang</span>
            {toc.length > 0 && <span className="inline-flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{toc.length} chương</span>}
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{stat?.readers || 0} nhân viên đã đọc</span>
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-600">{read ? <>Bạn đã đọc <b className="text-slate-800">{read}/{n}</b> trang · {fmtMinutes(mine?.seconds)}</> : 'Bạn chưa đọc tài liệu này'}</span>
              {read > 0 && <span className="font-semibold text-teal-700 tabular-nums">{pct}%</span>}
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : GOLD }} /></div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3.5 sm:px-4 pb-3.5 sm:pb-4 flex-wrap">
        <button type="button" onClick={() => onOpen()} className="e-btn e-btn-primary e-btn-sm">
          <BookOpen />{resume ? `Đọc tiếp · trang ${resume}` : 'Đọc ngay'}
        </button>
        {toc.length > 0 && (
          <button type="button" onClick={() => setShowToc(v => !v)} className="e-btn e-btn-secondary e-btn-sm">
            Mục lục<ChevronDown className={`transition ${showToc ? 'rotate-180' : ''}`} />
          </button>
        )}
        {canSeeTeam && <button type="button" onClick={onStats} className="e-btn e-btn-ghost e-btn-sm ml-auto"><BarChart3 />Thống kê</button>}
      </div>
      {resume && chap && !showToc && <div className="px-4 pb-3 -mt-1.5 text-[12px] text-slate-400 truncate">Đang đọc: {chapterLabel(chap)}</div>}
      {showToc && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-2 max-h-[340px] overflow-y-auto">
          {toc.map(ch => (
            <div key={`${ch.page}-${ch.title}`} className="py-1">
              <button type="button" onClick={() => onOpen(ch.page)} className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left hover:bg-white">
                <span className="w-7 shrink-0 text-[12.5px] font-bold text-teal-700 tabular-nums">{ch.no || '•'}</span>
                <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-slate-800">{ch.title}</span>
                <span className="text-[11.5px] text-slate-400 tabular-nums">tr. {ch.page}</span>
              </button>
              {ch.items?.length > 0 && (
                <div className="ml-10 flex flex-wrap gap-1.5 pb-1">
                  {ch.items.map(it => (
                    <button key={`${it.page}-${it.title}`} type="button" onClick={() => onOpen(it.page)}
                      className="text-[12px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-800">
                      {it.title} <span className="text-slate-400 tabular-nums">· {it.page}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Kết quả tìm kiếm (mọi tài liệu) ----------------
function SearchResults({ q, docs, onOpen }) {
  const [res, setRes] = useState(null);
  const qn = normQuery(q);
  const docKey = docs.map(d => d.id).join(',');
  useEffect(() => {
    let alive = true;
    setRes(null);
    const t = setTimeout(async () => {
      if (!docs.length) { setRes([]); return; }
      const esc = qn.replace(/[\\%_]/g, (m) => `\\${m}`);
      const { data, error } = await supabase.from('library_pages').select('doc_id, page, text, text_norm')
        .in('doc_id', docs.map(d => d.id)).ilike('text_norm', `%${esc}%`).order('page').limit(300);
      if (!alive) return;
      if (error) { toast.error('Không tìm được: ' + error.message); setRes([]); return; }
      setRes(data || []);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [qn, docKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!res) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>;
  const groups = docs.map(d => ({ doc: d, rows: res.filter(r => r.doc_id === d.id) })).filter(g => g.rows.length);
  if (!groups.length) {
    return (
      <div className="e-card e-card-pad text-center py-10">
        <Search className="w-8 h-8 mx-auto text-slate-300" />
        <div className="mt-2 text-[14px] font-medium text-slate-700">Không tìm thấy "{cleanText(q)}"</div>
        <div className="text-[12.5px] text-slate-500 mt-0.5">Thử từ khoá ngắn hơn hoặc từ đồng nghĩa.</div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="text-[13px] text-slate-500">Tìm thấy ở <b className="text-slate-700">{res.length}</b> trang trong {groups.length} tài liệu</div>
      {groups.map(({ doc, rows }) => {
        // Gom theo chương để dễ xem
        const byChap = [];
        rows.forEach(r => {
          const { chap, item } = chapterOf(doc.toc, r.page);
          const key = chap ? chap.page : 0;
          let g = byChap.find(x => x.key === key);
          if (!g) { g = { key, chap, rows: [] }; byChap.push(g); }
          g.rows.push({ ...r, item, snip: snippetOf(r.text, r.text_norm, qn) });
        });
        return (
          <div key={doc.id} className="e-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              {doc.cover_url && <img src={doc.cover_url} alt="" className="w-8 aspect-[420/595] rounded object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-slate-900 truncate">{doc.title}</div>
                <div className="text-[12px] text-slate-500">{rows.length} trang có kết quả</div>
              </div>
            </div>
            {byChap.map(g => (
              <div key={g.key} className="px-2 py-2">
                <div className="px-2 pb-1 text-[12px] font-semibold text-teal-700">{g.chap ? chapterLabel(g.chap) : 'Đầu tài liệu'} <span className="text-slate-400 font-normal">· {g.rows.length}</span></div>
                {g.rows.map(r => (
                  <button key={r.page} type="button" onClick={() => onOpen(doc, r.page)} className="w-full text-left rounded-xl px-2 py-2 hover:bg-slate-50 flex gap-3">
                    <span className="shrink-0 w-12 text-center">
                      <span className="block text-[10.5px] text-slate-400">Trang</span>
                      <span className="block text-[15px] font-bold text-slate-800 tabular-nums leading-tight">{r.page}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      {r.item && <span className="block text-[12px] font-medium text-slate-500 truncate">{r.item.title}</span>}
                      <span className="block text-[13px] text-slate-700 leading-relaxed line-clamp-3">
                        {r.snip.before}<mark className="bg-amber-100 text-slate-900 rounded px-0.5">{r.snip.match}</mark>{r.snip.after}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Thống kê đọc theo nhân viên ----------------
function StatsDrawer({ doc, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!doc) return undefined;
    let alive = true;
    setRows(null);
    (async () => {
      const [{ data: staff }, { data: reads }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_url').eq('is_active', true).order('full_name'),
        supabase.from('library_reads').select('user_id, pages_seen, seconds, opens, last_page, last_at').eq('doc_id', doc.id),
      ]);
      if (!alive) return;
      const by = Object.fromEntries((reads || []).map(r => [r.user_id, r]));
      setRows((staff || []).map(s => ({ ...s, r: by[s.id] || null }))
        .sort((a, b) => (b.r?.pages_seen?.length || 0) - (a.r?.pages_seen?.length || 0) || (b.r?.seconds || 0) - (a.r?.seconds || 0) || (a.full_name || '').localeCompare(b.full_name || '', 'vi')));
    })();
    return () => { alive = false; };
  }, [doc]);

  const n = doc?.page_count || 0;
  const readers = rows?.filter(x => x.r?.pages_seen?.length) || [];
  const done = readers.filter(x => n && x.r.pages_seen.length >= n).length;
  const sumSec = readers.reduce((s, x) => s + (x.r.seconds || 0), 0);

  return (
    <Drawer open={!!doc} onClose={onClose} size="lg" title={doc ? `Thống kê đọc · ${doc.title}` : ''}
      description={rows ? `${readers.length}/${rows.length} nhân viên đã đọc · ${done} người đọc hết · tổng ${fmtMinutes(sumSec)}` : 'Đang tải…'}>
      {!rows ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[['Đã đọc', `${readers.length}/${rows.length}`], ['Đọc hết', done], ['TB / người', readers.length ? fmtMinutes(sumSec / readers.length) : '—']].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-[11.5px] text-slate-500">{k}</div><div className="text-[17px] font-bold text-slate-900 tabular-nums">{v}</div></div>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map(x => {
              const pages = x.r?.pages_seen?.length || 0;
              const pct = n ? Math.min(100, Math.round(pages / n * 100)) : 0;
              return (
                <li key={x.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-teal-50 text-teal-700 grid place-items-center overflow-hidden text-[13px] font-semibold">
                    {x.avatar_url ? <img src={x.avatar_url} alt="" className="w-full h-full object-cover" /> : (x.full_name || '?').trim().split(/\s+/).pop()?.[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-medium text-slate-800 truncate">{x.full_name || '—'}</span>
                      <span className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${pages ? 'text-slate-800' : 'text-slate-400'}`}>{pages}/{n} trang</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : GOLD }} /></div>
                    <div className="mt-1 flex items-center gap-3 text-[11.5px] text-slate-500">
                      {x.r ? (
                        <>
                          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtMinutes(x.r.seconds)}</span>
                          <span>{x.r.opens} lượt mở</span>
                          <span className="truncate">gần nhất {fmtDate(x.r.last_at)} · trang {x.r.last_page}</span>
                        </>
                      ) : <span>Chưa mở</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Drawer>
  );
}

// ---------------- Admin: quản lý tài liệu ----------------
const BLANK = { title: '', subtitle: '', category: 'noi_bo' };

function ManageDrawer({ open, onClose, docs, meId, onChanged }) {
  const [drafts, setDrafts] = useState({});
  const [job, setJob] = useState({});        // doc_id -> { step, pct, error }
  const [adding, setAdding] = useState(null);
  const busy = Object.values(job).some(j => j && !j.error && j.step !== 'done');

  useEffect(() => {
    if (open) setDrafts(Object.fromEntries(docs.map(d => [d.id, { title: d.title || '', subtitle: d.subtitle || '', category: d.category || 'noi_bo' }])));
  }, [open, docs]);

  const setJ = (id, v) => setJob(s => ({ ...s, [id]: v && { ...(s[id] || {}), ...v } }));
  const patch = async (id, values) => {
    const { error } = await supabase.from('library_documents').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  };

  // Trích chữ từng trang -> library_pages (xoá chỉ mục cũ trước)
  const indexPages = async (doc, data, { withFile = null } = {}) => {
    setJ(doc.id, { step: 'index', pct: 0, error: null });
    const ex = await extractPdf(data, { cover: !doc.cover_url, onPage: (i, total) => setJ(doc.id, { step: 'index', pct: Math.round(i / total * 100) }) });
    const { error: delErr } = await supabase.from('library_pages').delete().eq('doc_id', doc.id);
    if (delErr) throw new Error(delErr.message);
    for (let i = 0; i < ex.pages.length; i += 40) {
      const chunk = ex.pages.slice(i, i + 40).map(p => ({ doc_id: doc.id, ...p }));
      const { error } = await supabase.from('library_pages').insert(chunk);
      if (error) throw new Error(error.message);
    }
    const values = { page_count: ex.numPages, indexed_at: new Date().toISOString() };
    if (!(doc.toc || []).length && ex.toc.length) values.toc = ex.toc;
    if (ex.coverBlob) {
      const file = new File([ex.coverBlob], `bia-${doc.slug || doc.id}.jpg`, { type: 'image/jpeg' });
      values.cover_url = await uploadToR2(file, 'tai-lieu');
    }
    if (withFile) Object.assign(values, withFile);
    await patch(doc.id, values);
  };

  const uploadPdf = async (doc, file) => {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast.error('Chỉ nhận file PDF'); return; }
    try {
      setJ(doc.id, { step: 'upload', pct: 0, error: null });
      const url = await uploadViaPresignWithProgress(file, 'tai-lieu', (pct) => setJ(doc.id, { step: 'upload', pct: Math.min(pct, 99) }));
      await indexPages(doc, file, { withFile: { file_url: url, file_size: file.size } });
      setJ(doc.id, { step: 'done', pct: 100 });
      toast.success(`Đã tải lên & lập chỉ mục: ${doc.title}`);
      onChanged();
    } catch (e) { setJ(doc.id, { error: e.message }); }
  };

  const reindex = async (doc) => {
    try {
      setJ(doc.id, { step: 'download', pct: 0, error: null });
      const res = await fetch(doc.file_url);
      if (!res.ok) throw new Error('Không tải được file (HTTP ' + res.status + ')');
      const buf = await res.arrayBuffer();
      await indexPages(doc, buf);
      setJ(doc.id, { step: 'done', pct: 100 });
      toast.success('Đã lập chỉ mục tìm kiếm');
      onChanged();
    } catch (e) { setJ(doc.id, { error: e.message }); }
  };

  const saveText = async (d) => {
    const v = drafts[d.id];
    if (!v?.title.trim()) { toast.error('Tên tài liệu không được trống'); return; }
    try { await patch(d.id, { title: v.title.trim(), subtitle: v.subtitle.trim() || null, category: v.category }); toast.success('Đã lưu'); onChanged(); }
    catch (e) { toast.error(e.message); }
  };
  const toggleActive = async (d) => { try { await patch(d.id, { active: !d.active }); onChanged(); } catch (e) { toast.error(e.message); } };
  const changeCover = async (d, file) => {
    if (!file) return;
    try { const url = await uploadToR2(file, 'tai-lieu'); await patch(d.id, { cover_url: url }); toast.success('Đã đổi ảnh bìa'); onChanged(); }
    catch (e) { toast.error(e.message); }
  };

  const addDoc = async () => {
    if (!adding?.title.trim()) { toast.error('Nhập tên tài liệu'); return; }
    if (!adding.file) { toast.error('Chọn file PDF'); return; }
    const maxSort = docs.reduce((m, d) => Math.max(m, d.sort || 0), 0);
    const { data, error } = await supabase.from('library_documents').insert({
      title: adding.title.trim(), subtitle: adding.subtitle.trim() || null, category: adding.category, sort: maxSort + 10, created_by: meId,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    const file = adding.file;
    setAdding(null);
    onChanged();
    uploadPdf(data, file);
  };

  const stepText = (j) => (j.error ? `Lỗi: ${j.error}`
    : j.step === 'upload' ? `Đang tải file lên… ${j.pct}%`
      : j.step === 'download' ? 'Đang đọc file…'
        : j.step === 'index' ? `Đang lập chỉ mục tìm kiếm… ${j.pct}%` : 'Xong');

  return (
    <Drawer open={open} onClose={() => !busy && onClose()} size="lg" title="Quản lý tài liệu"
      description="PDF tải thẳng lên kho R2, app tự đếm trang và trích chữ để tìm kiếm. Giữ màn hình mở tới khi xong.">
      <div className="space-y-3">
        {adding ? (
          <div className="e-card p-3.5 space-y-2.5 border-teal-200">
            <div className="text-[14px] font-semibold text-slate-800">Thêm tài liệu mới</div>
            <input className="e-input" placeholder="Tên tài liệu" value={adding.title} onChange={(e) => setAdding(a => ({ ...a, title: e.target.value }))} />
            <textarea className="e-input h-auto py-2 resize-none" rows={2} placeholder="Mô tả ngắn" value={adding.subtitle} onChange={(e) => setAdding(a => ({ ...a, subtitle: e.target.value }))} />
            <div className="flex gap-2 flex-wrap">
              <select className="e-input w-auto" value={adding.category} onChange={(e) => setAdding(a => ({ ...a, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <label className="e-btn e-btn-secondary cursor-pointer min-w-0">
                <Upload /><span className="truncate max-w-[180px]">{adding.file ? adding.file.name : 'Chọn file PDF'}</span>
                <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setAdding(a => ({ ...a, file: e.target.files?.[0] || null }))} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(null)} className="e-btn e-btn-ghost e-btn-sm">Huỷ</button>
              <button type="button" onClick={addDoc} className="e-btn e-btn-primary e-btn-sm"><Plus />Thêm & tải lên</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding({ ...BLANK, file: null })} className="w-full rounded-2xl border border-dashed border-teal-300 bg-teal-50/50 py-3 text-[14px] font-semibold text-teal-800 hover:bg-teal-50 inline-flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />Thêm tài liệu
          </button>
        )}

        {docs.map(d => {
          const v = drafts[d.id] || { title: '', subtitle: '', category: 'noi_bo' };
          const j = job[d.id];
          const changed = v.title !== (d.title || '') || v.subtitle !== (d.subtitle || '') || v.category !== d.category;
          const running = j && !j.error && j.step !== 'done';
          return (
            <div key={d.id} className={`e-card p-3 flex gap-3 ${d.active ? '' : 'bg-slate-50'}`}>
              <div className="w-[70px] shrink-0">
                <div className="relative aspect-[420/595] rounded-lg overflow-hidden bg-slate-200">
                  {d.cover_url ? <img src={d.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <FileText className="absolute inset-0 m-auto w-6 h-6 text-slate-400" />}
                </div>
                <label className="mt-1.5 block text-center text-[11.5px] font-medium text-teal-700 cursor-pointer hover:underline">
                  Đổi bìa<input type="file" accept="image/*" hidden onChange={(e) => { changeCover(d, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-slate-500">{d.page_count ? `${d.page_count} trang` : 'Chưa rõ số trang'}{d.file_size ? ` · ${(d.file_size / 1048576).toFixed(1)}MB` : ''}</span>
                  {d.file_url
                    ? <span className={`font-medium ${d.indexed_at ? 'text-emerald-600' : 'text-amber-600'}`}>{d.indexed_at ? 'Đã có file · đã lập chỉ mục' : 'Đã có file · chưa lập chỉ mục'}</span>
                    : <span className="font-medium text-amber-600">Chưa có file</span>}
                </div>
                <input className="e-input h-9 text-[13.5px]" value={v.title} placeholder="Tên tài liệu" onChange={(e) => setDrafts(s => ({ ...s, [d.id]: { ...v, title: e.target.value } }))} />
                <textarea className="e-input h-auto py-2 text-[13px] resize-none" rows={2} value={v.subtitle} placeholder="Mô tả ngắn" onChange={(e) => setDrafts(s => ({ ...s, [d.id]: { ...v, subtitle: e.target.value } }))} />
                <select className="e-input h-9 text-[13px]" value={v.category} onChange={(e) => setDrafts(s => ({ ...s, [d.id]: { ...v, category: e.target.value } }))}>
                  {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
                {j && (
                  <div className="text-[12px]">
                    <div className={j.error ? 'text-danger-600' : 'text-slate-500'}>{stepText(j)}</div>
                    {!j.error && <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full transition-all ${j.step === 'done' ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${j.step === 'done' ? 100 : j.pct || 3}%` }} /></div>}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className={`e-btn e-btn-secondary e-btn-sm cursor-pointer ${running ? 'opacity-55 pointer-events-none' : ''}`}>
                    <Upload />{d.file_url ? 'Thay PDF' : 'Tải PDF lên'}
                    <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { uploadPdf(d, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {d.file_url && <button type="button" disabled={running} onClick={() => reindex(d)} className="e-btn e-btn-ghost e-btn-sm"><RefreshCw />Lập chỉ mục</button>}
                  <button type="button" onClick={() => toggleActive(d)} className="e-btn e-btn-ghost e-btn-sm">{d.active ? <><EyeOff />Ẩn</> : <><Eye />Hiện</>}</button>
                  {changed && <button type="button" onClick={() => saveText(d)} className="e-btn e-btn-primary e-btn-sm ml-auto">Lưu</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

