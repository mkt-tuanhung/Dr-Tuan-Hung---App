import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import {
  Clapperboard, Plus, Search, X, Link as LinkIcon, ExternalLink, Trophy,
  Film, Scissors, CheckCircle2, RotateCcw, PlayCircle, PauseCircle, Circle, Image, Link2, FolderOpen, Upload, Loader2, Download, Trash2, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';

const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const parseLinks = (t) => (t || '').split('\n').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
const noDiacritics = (s) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
// Quy định ID source: Tên khách (tên gọi) + ngày quay chụp (ddmmyyyy) + _STT. VD: Dung27062026_01
const suggestSourceId = (name, date) => {
  const given = noDiacritics(name).trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, '');
  const cap = given ? given.charAt(0).toUpperCase() + given.slice(1).toLowerCase() : '';
  let d = '';
  if (date) { const dt = new Date(date); if (!isNaN(dt.getTime())) d = `${String(dt.getDate()).padStart(2, '0')}${String(dt.getMonth() + 1).padStart(2, '0')}${dt.getFullYear()}`; }
  return cap && d ? `${cap}${d}_01` : '';
};
const SOURCE_TYPES = ['Before/After', 'Feedback', 'Hậu phẫu', 'Quá trình làm', 'Tư vấn bác sĩ', 'Khác'];
const SOURCE_STATUS = {
  chua_dung: { label: 'Chưa dựng', cls: 'bg-slate-100 text-slate-600' },
  dang_dung: { label: 'Đang dựng', cls: 'bg-blue-100 text-blue-700' },
  da_dung: { label: 'Đã dựng', cls: 'bg-emerald-100 text-emerald-700' },
  loi: { label: 'Source lỗi', cls: 'bg-rose-100 text-rose-700' },
  can_bo_sung: { label: 'Cần bổ sung', cls: 'bg-amber-100 text-amber-700' },
};
// Phân loại điểm video thành phẩm do Ads chấm (1-10)
const scoreCat = (score, win) => {
  const n = Number(score) || 0;
  if (win || n >= 10) return { label: 'WIN', cls: 'bg-amber-100 text-amber-700', warn: false };
  if (n >= 8) return { label: 'Tốt', cls: 'bg-emerald-100 text-emerald-700', warn: false };
  if (n >= 5) return { label: 'Trung bình', cls: 'bg-yellow-100 text-yellow-700', warn: false };
  if (n > 0) return { label: 'Tệ', cls: 'bg-rose-100 text-rose-700', warn: true };
  return { label: 'Chưa chấm', cls: 'bg-slate-100 text-slate-500', warn: false };
};
const SCORE_FILTERS = { win: 'WIN (10đ)', tot: 'Tốt (≥8)', tb: 'Trung bình (5-7)', te: 'Tệ (<5)', chua: 'Chưa chấm' };
const matchScoreFilter = (c, f) => {
  if (!f) return true;
  const n = c.win ? 10 : (Number(c.score) || 0);
  if (f === 'win') return c.win || n >= 10;
  if (f === 'tot') return !c.win && n >= 8 && n < 10;
  if (f === 'tb') return n >= 5 && n <= 7;
  if (f === 'te') return n > 0 && n < 5;
  if (f === 'chua') return !c.win && n === 0;
  return true;
};
const STAGE = {
  submitted: { label: 'Chờ Ads duyệt', cls: 'bg-amber-100 text-amber-700' },
  revision: { label: 'Cần sửa', cls: 'bg-rose-100 text-rose-700' },
  approved: { label: 'Đã duyệt', cls: 'bg-violet-100 text-violet-700' },
  done: { label: 'Hoàn tất', cls: 'bg-emerald-100 text-emerald-700' },
};
const AD_STATUS = { dang_chay: { label: 'Đang chạy', cls: 'text-emerald-600', icon: PlayCircle }, tam_dung: { label: 'Tạm dừng', cls: 'text-amber-600', icon: PauseCircle }, chua_chay: { label: 'Chưa chạy', cls: 'text-slate-400', icon: Circle } };

// ----- Xem trước video / ảnh từ link (Google Drive, YouTube, file trực tiếp) -----
const driveId = (url) => {
  const m = (url || '').match(/\/d\/([a-zA-Z0-9_-]+)/) || (url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
};
const embedUrl = (url) => {
  const id = driveId(url);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  const yt = (url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
};
const isVideoFile = (url) => /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url || '');
const VideoPreview = ({ url }) => {
  const emb = embedUrl(url);
  if (emb) return <iframe src={emb} loading="lazy" allow="autoplay; fullscreen" allowFullScreen title="clip" className="w-full aspect-video rounded-lg border border-slate-200 bg-black" />;
  if (isVideoFile(url)) return <video src={url} controls className="w-full rounded-lg border border-slate-200 bg-black" />;
  return <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Mở clip</a>;
};
const thumbSrc = (url) => { const id = driveId(url); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w600` : url; };
const downloadFile = async (url, name) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj; a.download = name || 'thumbnail.jpg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch { window.open(url, '_blank'); }
};

const ContentProductionPage = () => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const isAdmin = roles.includes('admin');
  const isManager = isAdmin || roles.includes('accountant') || roles.includes('shareholder');
  const canAddMedia = roles.includes('media') || isAdmin;
  const canEdit = roles.includes('editor') || isAdmin;
  const canAds = roles.includes('marketing') || isAdmin;

  const tabs = [];
  if (canAddMedia || canEdit || isManager) tabs.push('kho');
  if (canEdit || canAds || isManager) tabs.push('video');
  const [tab, setTab] = useState(tabs[0] || 'kho');

  const [stores, setStores] = useState([]);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [search, setSearch] = useState('');
  const [khoStatus, setKhoStatus] = useState('');   // lọc trạng thái source
  const [videoScore, setVideoScore] = useState(''); // lọc theo điểm Ads
  const [addOpen, setAddOpen] = useState(false);
  const [editSource, setEditSource] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [buildFor, setBuildFor] = useState(null);   // store đang dựng clip mới
  const [editClip, setEditClip] = useState(null);   // clip editor đang sửa
  const [reviewFor, setReviewFor] = useState(null);
  const [videoFor, setVideoFor] = useState(null);   // clip đang xem video
  const [scoreFor, setScoreFor] = useState(null);   // store đang chấm điểm/góp ý source

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const [scRes, clRes] = await Promise.all([
      supabase.from('media_customers').select('*, media:profiles!media_id(full_name)').order('updated_at', { ascending: false }),
      supabase.from('media_clips').select('*, editor:profiles!editor_id(full_name), ads:profiles!ads_id(full_name)').order('updated_at', { ascending: false }),
    ]);
    setStores(scRes.data || []);
    setClips(clRes.data || []);
    didLoad.current = true;
    setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('media_customers,media_clips', loadData);

  const clipsOf = (storeId) => clips.filter(c => c.media_customer_id === storeId);
  const storeOf = (id) => stores.find(s => s.id === id);

  const patchClip = async (id, payload, msg) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
    const { error } = await supabase.from('media_clips').update(payload).eq('id', id);
    if (error) { toast.error('Lỗi: ' + error.message); loadData(); return; }
    if (msg) toast.success(msg);
  };
  const delStore = async (s) => {
    if (!confirm('Xoá media khách hàng này (kèm các clip)?')) return;
    setStores(prev => prev.filter(x => x.id !== s.id));
    await supabase.from('media_customers').delete().eq('id', s.id);
  };
  const delClip = async (id) => {
    if (!confirm('Xoá clip này?')) return;
    setClips(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('media_clips').delete().eq('id', id);
    if (error) { toast.error(error.message); loadData(); }
  };

  // Bảng điểm Editor tháng này (theo điểm Ads chấm)
  const now = new Date();
  const evalC = clips.filter(c => c.editor_id && c.evaluated_at && new Date(c.evaluated_at).getMonth() === now.getMonth() && new Date(c.evaluated_at).getFullYear() === now.getFullYear());
  const lb = Object.values(evalC.reduce((a, c) => {
    const pts = c.win ? 10 : (Number(c.score) || 0);
    a[c.editor_id] = a[c.editor_id] || { id: c.editor_id, name: c.editor?.full_name || 'Editor', n: 0, sum: 0, w: 0, m: 0 };
    a[c.editor_id].n++; a[c.editor_id].sum += pts; if (c.win) a[c.editor_id].w++; a[c.editor_id].m += Number(c.win_amount || 0);
    return a;
  }, {})).map(e => ({ ...e, avg: e.n ? e.sum / e.n : 0 })).sort((x, y) => y.avg - x.avg).slice(0, 5);

  const q = search.trim().toLowerCase();
  const visStores = stores.filter(s =>
    (!q || (s.customer_name || '').toLowerCase().includes(q) || (s.customer_phone || '').includes(q)) &&
    (!khoStatus || (s.source_status || 'chua_dung') === khoStatus));
  // Clip cho Ads duyệt: tháng này (theo submitted_at) hoặc chưa xong
  const reviewClips = clips.filter(c => {
    const st = storeOf(c.media_customer_id);
    if (q && !((st?.customer_name || '').toLowerCase().includes(q) || (st?.customer_phone || '').includes(q) || (c.title || '').toLowerCase().includes(q))) return false;
    if (!matchScoreFilter(c, videoScore)) return false;
    const d = new Date(c.submitted_at || c.created_at);
    return c.stage !== 'done' || (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Clapperboard className="w-6 h-6 text-emerald-600" /> Sản xuất Ads</h2>
          <p className="text-slate-400 text-sm mt-0.5">Kho media (Media) → Editor dựng clip → Ads duyệt &amp; chấm Win</p>
        </div>
        {tab === 'kho' && canAddMedia && (
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Thêm media
          </button>
        )}
      </div>

      {/* Tabs nội bộ */}
      {tabs.length > 1 && (
        <div className="flex gap-2">
          {tabs.includes('kho') && <TabBtn active={tab === 'kho'} onClick={() => setTab('kho')} icon={FolderOpen} label="Kho media" />}
          {tabs.includes('video') && <TabBtn active={tab === 'video'} onClick={() => setTab('video')} icon={PlayCircle} label="Video Ads" />}
        </div>
      )}

      {/* Leaderboard */}
      {lb.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="font-bold text-amber-600 mb-2 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4" /> Bảng điểm Editor tháng {now.getMonth() + 1}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lb.map((e, i) => { const cat = scoreCat(e.avg, false); return (
              <div key={e.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 min-w-0"><span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span><span className="truncate">{e.name}</span></span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cat.cls}`}>TB {e.avg.toFixed(1)}/10</span>
                  <span className="text-[11px] text-slate-500">{e.n} clip · {e.w} Win</span>
                </span>
              </div>
            ); })}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên / SĐT khách…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white" />
        </div>
        {tab === 'kho' && (
          <select value={khoStatus} onChange={e => setKhoStatus(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white">
            <option value="">Mọi trạng thái source</option>
            {Object.entries(SOURCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        {tab === 'video' && (
          <select value={videoScore} onChange={e => setVideoScore(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white">
            <option value="">Mọi mức điểm</option>
            {Object.entries(SCORE_FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : tab === 'kho' ? (
        visStores.length === 0 ? (
          <Empty icon={FolderOpen} title="Kho media trống"
            desc={canAddMedia ? 'Bấm “Thêm media” để up link nguồn và gắn với khách hàng.' : canEdit ? 'Khi Media up nguồn, bạn vào đây bấm “Dựng video” cho từng khách.' : 'Chưa có dữ liệu media.'}
            cta={canAddMedia ? { label: 'Thêm media', onClick: () => setAddOpen(true) } : null} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
            {visStores.map(s => (
              <StoreRow key={s.id} s={s} clipCount={clipsOf(s.id).length} me={me} canAddMedia={canAddMedia} canEdit={canEdit}
                onEditSource={() => setEditSource(s)} onLink={() => setLinkFor(s)} onBuild={() => setBuildFor(s)} onScore={() => setScoreFor(s)} onDelete={() => delStore(s)} />
            ))}
          </div>
        )
      ) : (
        reviewClips.length === 0 ? (
          <Empty icon={PlayCircle} title="Chưa có clip nào" desc="Editor dựng clip từ Kho media; clip sẽ hiện ở đây để Ads duyệt & chấm Win." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {reviewClips.map(c => (
              <ClipReviewCard key={c.id} c={c} store={storeOf(c.media_customer_id)} me={me} isAdmin={isAdmin} canAds={canAds}
                onReview={() => setReviewFor(c)} onEdit={() => setEditClip(c)} onDelete={() => delClip(c.id)} onView={() => setVideoFor(c)}
                onSetAd={(ad_status) => patchClip(c.id, { ad_status, ads_id: me.id }, 'Đã cập nhật trạng thái chạy')} />
            ))}
          </div>
        )
      )}

      {addOpen && <AddMediaModal me={me} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); loadData(); }} />}
      {editSource && <SourceModal store={editSource} onClose={() => setEditSource(null)} onSaved={() => { setEditSource(null); loadData(); }} />}
      {linkFor && <LinkCustomerModal store={linkFor} onClose={() => setLinkFor(null)} onSaved={() => { setLinkFor(null); loadData(); }} />}
      {buildFor && <BuildClipModal store={buildFor} me={me} onClose={() => setBuildFor(null)} onSaved={() => { setBuildFor(null); loadData(); }} />}
      {editClip && <BuildClipModal clip={editClip} store={storeOf(editClip.media_customer_id)} me={me} onClose={() => setEditClip(null)} onSaved={() => { setEditClip(null); loadData(); }} />}
      {scoreFor && <SourceScoreModal store={scoreFor} onClose={() => setScoreFor(null)} onSaved={() => { setScoreFor(null); loadData(); }} />}
      {reviewFor && <ReviewClipModal clip={reviewFor} store={storeOf(reviewFor.media_customer_id)} me={me} onClose={() => setReviewFor(null)}
        onSaved={async (payload) => { await patchClip(reviewFor.id, payload, 'Đã lưu đánh giá'); setReviewFor(null); }} />}
      {videoFor && <VideoModal clip={videoFor} onClose={() => setVideoFor(null)} />}
    </div>
  );
};

const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${active ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const Empty = ({ icon: Icon, title, desc, cta }) => (
  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
    <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
    <p className="text-slate-600 font-semibold">{title}</p>
    <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto leading-relaxed">{desc}</p>
    {cta && <button onClick={cta.onClick} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"><Plus className="w-4 h-4" /> {cta.label}</button>}
  </div>
);

const LINK_TONE = {
  Nguồn: 'border-sky-200 text-sky-700 hover:bg-sky-50 [&_svg]:text-sky-500',
  Clip: 'border-violet-200 text-violet-700 hover:bg-violet-50 [&_svg]:text-violet-500',
  Thumb: 'border-amber-200 text-amber-700 hover:bg-amber-50 [&_svg]:text-amber-500',
};
const LinkList = ({ links, label = 'Link', icon: Icon = ExternalLink }) => (
  (links || []).length === 0 ? <span className="text-xs text-slate-300">—</span> :
    <div className="flex flex-wrap gap-1.5">
      {(links || []).map((l, i) => (
        <a key={i} href={l} target="_blank" rel="noreferrer"
          className={`group inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg bg-white border text-xs font-semibold shadow-sm hover:shadow transition-all ${LINK_TONE[label] || 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          <Icon className="w-3.5 h-3.5" /> {label} {links.length > 1 ? i + 1 : ''}
          <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-70" />
        </a>
      ))}
    </div>
);

// Thumbnail có fallback khi ảnh lỗi + nút tải (tuỳ chọn)
const Thumb = ({ url, size = 'h-10 w-10', download = false, idx = 0 }) => {
  const [err, setErr] = useState(false);
  if (err) return <div className={`${size} rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300`}><Image className="w-4 h-4" /></div>;
  return (
    <div className="relative group">
      <a href={url} target="_blank" rel="noreferrer"><img src={thumbSrc(url)} onError={() => setErr(true)} loading="lazy" alt="thumbnail" className={`${size} object-cover rounded-md border border-slate-200`} /></a>
      {download && (
        <button type="button" onClick={() => downloadFile(url, `thumb-${idx + 1}.jpg`)} title="Tải ảnh về"
          className="absolute bottom-1 right-1 bg-white/90 hover:bg-white text-slate-700 rounded-lg p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );
};

// ---------- Hàng Kho media (danh sách) ----------
const StoreRow = ({ s, clipCount, me, canAddMedia, canEdit, onEditSource, onLink, onBuild, onScore, onDelete }) => {
  const owner = canAddMedia || s.media_id === me?.id;
  return (
    <div className="p-3 hover:bg-slate-50/60 flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="min-w-0 lg:w-60 shrink-0">
        <div className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
          <span className="truncate">{s.customer_name || 'Khách chưa đặt tên'}</span>
          {s.appointment_id
            ? <span className="shrink-0 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">LK</span>
            : <span className="shrink-0 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Chưa LK</span>}
        </div>
        <div className="text-[11px] text-slate-400 truncate">{s.customer_phone}{s.media?.full_name ? ` · ${s.media.full_name}` : ''}</div>
        {(s.source_id || s.service || s.shoot_date) && (
          <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
            {s.source_id && <span className="font-mono text-violet-600">#{s.source_id}</span>}
            {s.service && <span>{s.service}</span>}
            {s.shoot_date && <span>📅 {new Date(s.shoot_date).toLocaleDateString('vi-VN')}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
        <LinkList links={s.source_links} label="Nguồn" icon={Film} />
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${SOURCE_STATUS[s.source_status || 'chua_dung']?.cls || 'bg-slate-100 text-slate-600'}`}>{SOURCE_STATUS[s.source_status || 'chua_dung']?.label || s.source_status}</span>
        {s.source_type && <span className="text-[11px] font-semibold bg-sky-50 text-sky-700 px-2 py-1 rounded-lg">{s.source_type}</span>}
        <span className="text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-1 rounded-lg">{clipCount} clip</span>
        {s.source_score != null && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">★ {s.source_score}/10</span>}
        {s.source_feedback && <span className="text-[11px] text-slate-500 italic truncate max-w-[200px]" title={s.source_feedback}>“{s.source_feedback}”</span>}
        {s.updated_at && <span className="text-[11px] text-slate-300 ml-auto">{new Date(s.updated_at).toLocaleDateString('vi-VN')}</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 lg:justify-end shrink-0">
        {canEdit && <button onClick={onBuild} className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700"><Scissors className="w-3 h-3 inline mr-0.5" />Dựng video</button>}
        {canEdit && <button onClick={onScore} className="text-xs font-semibold text-amber-600 px-2 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50">Chấm/Góp ý</button>}
        {owner && <button onClick={onEditSource} className="text-xs font-semibold text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Sửa nguồn</button>}
        {!s.appointment_id && owner && <button onClick={onLink} className="text-xs font-semibold text-blue-600 px-2 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50"><Link2 className="w-3 h-3 inline mr-0.5" />Kết nối</button>}
        {owner && <button onClick={onDelete} title="Xoá" className="text-rose-400 hover:text-rose-600 p-1.5"><Trash2 className="w-4 h-4" /></button>}
      </div>
    </div>
  );
};

// ---------- Modal: Editor chấm điểm / góp ý source ----------
const SourceScoreModal = ({ store, onClose, onSaved }) => {
  const [score, setScore] = useState(store.source_score != null ? String(store.source_score) : '');
  const [fb, setFb] = useState(store.source_feedback || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('media_customers').update({ source_score: score === '' ? null : Number(score), source_feedback: fb || null }).eq('id', store.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã lưu đánh giá source'); onSaved();
  };
  return (
    <Modal title="Chấm điểm / góp ý source" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">Khách: <b>{store.customer_name}</b></p>
      <Field label="Điểm source (1–10)"><input value={score} onChange={e => setScore(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="VD: 8" className={inpCls} /></Field>
      <Field label="Góp ý cho Media về source"><textarea value={fb} onChange={e => setFb(e.target.value)} rows={3} placeholder="Nhận xét chất lượng nguồn quay/chụp…" className={inpCls} /></Field>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Thẻ clip (Video Ads: editor + ads) ----------
const ClipReviewCard = ({ c, store, me, isAdmin, canAds, onReview, onSetAd, onEdit, onDelete, onView }) => {
  const mine = c.editor_id === me?.id;
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-800 text-sm truncate">{c.title || '(Chưa đặt tiêu đề)'}</div>
          <div className="text-[11px] text-slate-400 truncate">{store?.customer_name}{store?.customer_phone ? ` · ${store.customer_phone}` : ''} · {c.editor?.full_name || '—'}</div>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${STAGE[c.stage]?.cls || ''}`}>{STAGE[c.stage]?.label || c.stage}</span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {(c.clip_links || []).length > 0 ? (c.clip_links || []).map((l, i) => <VideoPreview key={i} url={l} />) : <span className="text-xs text-slate-300">Chưa có clip</span>}
        {(c.thumb_links || []).length > 0 && (
          <div className="flex flex-wrap gap-2">{(c.thumb_links || []).map((l, i) => <Thumb key={i} url={l} idx={i} size="h-24 w-24" download />)}</div>
        )}
        {(c.win || c.score > 0) && (() => { const cat = scoreCat(c.score, c.win); return (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit ${cat.cls}`}>
            {cat.warn && '⚠️'}{c.win ? '🏆' : ''} Điểm {c.win ? 10 : c.score}/10 · {cat.label}{c.win && c.win_amount ? ` · ${fmtM(c.win_amount)}` : ''}
          </span>); })()}
        {c.ad_status && AD_STATUS[c.ad_status] && <span className={`text-xs font-medium flex items-center gap-1 ${AD_STATUS[c.ad_status].cls}`}>{React.createElement(AD_STATUS[c.ad_status].icon, { className: 'w-3 h-3' })} {AD_STATUS[c.ad_status].label}</span>}
        {c.ads_feedback && <div className="text-[11px] text-rose-500 italic">Ads: “{c.ads_feedback}”</div>}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
        {(c.clip_links || []).length > 0 && <button onClick={onView} className="text-xs font-semibold text-violet-600 px-2 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50 inline-flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> Xem lớn</button>}
        {canAds && <button onClick={onReview} className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700">Đánh giá</button>}
        {canAds && (
          <select value={c.ad_status || ''} onChange={e => onSetAd(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-1.5 py-1">
            <option value="">Trạng thái…</option>
            <option value="dang_chay">Đang chạy</option>
            <option value="tam_dung">Tạm dừng</option>
            <option value="chua_chay">Chưa chạy</option>
          </select>
        )}
        {(mine || isAdmin) && <button onClick={onEdit} className="text-xs font-semibold text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Sửa</button>}
        {(mine || isAdmin) && <button onClick={onDelete} title="Xoá clip" className="text-rose-400 hover:text-rose-600 p-1.5 ml-auto"><Trash2 className="w-4 h-4" /></button>}
      </div>
    </div>
  );
};

// ---------- Modal: Thêm media (Media up nguồn) ----------
const inpCls = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none';
const Field = ({ label, children }) => (
  <div className="mb-3"><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>
);
const AddMediaModal = ({ me, onClose, onSaved }) => {
  const [mode, setMode] = useState('existing'); // existing (tag khách) | new
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [mediaChargeId, setMediaChargeId] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [sourceStatus, setSourceStatus] = useState('chua_dung');
  const [mediaStaff, setMediaStaff] = useState([]);
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
  useEffect(() => { supabase.from('profiles').select('id, full_name').eq('is_active', true).or('role.eq.media,role_2.eq.media,role.eq.admin').order('full_name').then(({ data }) => setMediaStaff(data || [])); }, []);

  const cname = mode === 'existing' ? (picked?.customer_name || '') : name;
  const fillId = () => {
    const s = suggestSourceId(cname, shootDate);
    if (!s) { toast.error('Cần Tên khách + Ngày quay/chụp để gợi ý ID'); return; }
    setSourceId(s);
  };

  const save = async () => {
    const arr = parseLinks(links);
    if (arr.length === 0) { toast.error('Dán ít nhất 1 link Google Drive (http...)'); return; }
    const chargeName = mediaStaff.find(s => s.id === mediaChargeId)?.full_name || null;
    let payload = {
      media_id: me.id, source_links: arr, note: note || null,
      source_id: sourceId.trim() || null, shoot_date: shootDate || null,
      media_in_charge_id: mediaChargeId || null, media_in_charge: chargeName,
      source_type: sourceType || null, source_status: sourceStatus || 'chua_dung',
    };
    if (mode === 'existing') {
      if (!picked) { toast.error('Hãy TAG (chọn) khách hàng'); return; }
      payload = { ...payload, appointment_id: picked.appointment_id, customer_name: picked.customer_name, customer_phone: picked.phone, service: picked.service || null };
    } else {
      if (!name.trim()) { toast.error('Nhập tên khách hàng'); return; }
      payload = { ...payload, appointment_id: null, customer_name: name.trim(), customer_phone: phone.trim() || null, service: service.trim() || null };
    }
    setSaving(true);
    const { error } = await supabase.from('media_customers').insert(payload);
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã thêm vào kho media'); onSaved();
  };

  return (
    <Modal title="Thêm media khách hàng" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setMode('existing')} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'existing' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>Tag khách đã có</button>
        <button onClick={() => setMode('new')} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'new' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>Khách chưa có (tạo mới)</button>
      </div>

      {mode === 'existing' ? (
        picked ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">
            <span className="text-sm font-medium text-slate-700">{picked.customer_name} · {picked.phone}{picked.service ? ` · ${picked.service}` : ''}</span>
            <button onClick={() => setPicked(null)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        ) : (
          <div className="mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input autoFocus value={q} onChange={e => onSearch(e.target.value)} placeholder="Tag khách: tìm theo tên / SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none" />
            </div>
            <div className="max-h-40 overflow-y-auto mt-1 border border-slate-100 rounded-xl divide-y">
              {results.map(r => (
                <button key={r.appointment_id} onClick={() => setPicked(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50">
                  <div className="font-medium text-slate-700">{r.customer_name} <span className="text-slate-400 font-normal">· {r.phone}</span></div>
                </button>
              ))}
              {results.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">Không thấy. Hãy chọn “Khách chưa có (tạo mới)”.</div>}
            </div>
          </div>
        )
      ) : (
        <>
          <Field label="Tên khách hàng"><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="VD: Nguyễn Thị Dung" className={inpCls} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Số điện thoại"><input value={phone} onChange={e => setPhone(e.target.value)} className={inpCls} /></Field>
            <Field label="Dịch vụ"><input value={service} onChange={e => setService(e.target.value)} className={inpCls} /></Field>
          </div>
        </>
      )}

      {(mode === 'new' || picked) && (
        <>
          <Field label="ID source">
            <div className="flex gap-2">
              <input value={sourceId} onChange={e => setSourceId(e.target.value)} placeholder="VD: Dung27062026_01" className={inpCls} />
              <button type="button" onClick={fillId} className="shrink-0 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100">Gợi ý</button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Quy định: <b>Tên khách</b> + <b>ngày quay/chụp</b> (ddmmyyyy) + <b>_STT</b>. VD: <span className="font-mono text-slate-500">Dung27062026_01</span></p>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ngày quay/chụp"><input type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} className={inpCls} /></Field>
            <Field label="Media phụ trách">
              <select value={mediaChargeId} onChange={e => setMediaChargeId(e.target.value)} className={inpCls}>
                <option value="">— Chọn nhân viên —</option>
                {mediaStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Loại source">
              <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inpCls}>
                <option value="">— Chọn loại —</option>
                {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Trạng thái source">
              <select value={sourceStatus} onChange={e => setSourceStatus(e.target.value)} className={inpCls}>
                {Object.entries(SOURCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Link Google Drive (mỗi dòng 1 link)"><textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} placeholder="https://drive.google.com/..." className={inpCls} /></Field>
          <Field label="Ghi chú"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inpCls} /></Field>
        </>
      )}

      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Modal: Sửa nguồn ----------
const SourceModal = ({ store, onClose, onSaved }) => {
  const [links, setLinks] = useState((store.source_links || []).join('\n'));
  const [note, setNote] = useState(store.note || '');
  const [sourceType, setSourceType] = useState(store.source_type || '');
  const [sourceStatus, setSourceStatus] = useState(store.source_status || 'chua_dung');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('media_customers').update({ source_links: parseLinks(links), note: note || null, source_type: sourceType || null, source_status: sourceStatus || 'chua_dung' }).eq('id', store.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã cập nhật nguồn'); onSaved();
  };
  return (
    <Modal title="Sửa nguồn media" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{store.customer_name}</b></p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Loại source">
          <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inpCls}>
            <option value="">— Chọn loại —</option>
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Trạng thái source">
          <select value={sourceStatus} onChange={e => setSourceStatus(e.target.value)} className={inpCls}>
            {Object.entries(SOURCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Link nguồn (mỗi dòng 1 link)"><textarea autoFocus value={links} onChange={e => setLinks(e.target.value)} rows={3} className={inpCls} /></Field>
      <Field label="Ghi chú"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inpCls} /></Field>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Modal: Kết nối Thông tin khách hàng ----------
const LinkCustomerModal = ({ store, onClose, onSaved }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const timer = useRef(null);
  const onSearch = (val) => {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { const { data } = await supabase.rpc('search_content_customers', { q: val }); setResults(data || []); }, 250);
  };
  useEffect(() => { supabase.rpc('search_content_customers', { q: store.customer_phone || store.customer_name || '' }).then(({ data }) => setResults(data || [])); }, [store]);
  const link = async (r) => {
    const { error } = await supabase.from('media_customers').update({ appointment_id: r.appointment_id, customer_name: r.customer_name, customer_phone: r.phone }).eq('id', store.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã kết nối với khách hàng'); onSaved();
  };
  return (
    <Modal title="Kết nối với Thông tin khách hàng" onClose={onClose}>
      <div className="relative mb-2">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input autoFocus value={q} onChange={e => onSearch(e.target.value)} placeholder="Tìm tên/SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none" />
      </div>
      <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y">
        {results.map(r => (
          <button key={r.appointment_id} onClick={() => link(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50">
            <div className="font-medium text-slate-700">{r.customer_name} <span className="text-slate-400 font-normal">· {r.phone}</span></div>
          </button>
        ))}
        {results.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">Không tìm thấy khách hàng phù hợp</div>}
      </div>
    </Modal>
  );
};

// ---------- Modal: Editor dựng / sửa video ----------
const BuildClipModal = ({ store, clip: editing, me, onClose, onSaved }) => {
  const [title, setTitle] = useState(editing?.title || '');
  const [clip, setClip] = useState((editing?.clip_links || []).join('\n'));
  const [thumbs, setThumbs] = useState(editing?.thumb_links || []);
  const [note, setNote] = useState(editing?.editor_note || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const onPickFiles = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) { toast.error('Chỉ nhận file ảnh'); continue; }
        const url = await uploadToR2(f, 'ads-thumb');
        setThumbs(p => [...p, url]);
      }
    } catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    setUploading(false);
  };

  const save = async () => {
    if (!title.trim()) { toast.error('Nhập tiêu đề video'); return; }
    const clipArr = parseLinks(clip);
    if (clipArr.length === 0) { toast.error('Dán link clip đã dựng (http...)'); return; }
    setSaving(true);
    const payload = { title: title.trim(), clip_links: clipArr, thumb_links: thumbs, editor_note: note || null, stage: 'submitted', submitted_at: new Date().toISOString() };
    const { error } = editing
      ? await supabase.from('media_clips').update(payload).eq('id', editing.id)
      : await supabase.from('media_clips').insert({ ...payload, media_customer_id: store.id, editor_id: me.id });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success(editing ? 'Đã cập nhật & nộp lại clip' : 'Đã đẩy clip — Ads sẽ duyệt'); onSaved();
  };
  return (
    <Modal title={editing ? 'Sửa video' : 'Dựng video'} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{store?.customer_name}</b></p>
      {store?.source_links?.length > 0 && <div className="mb-3"><div className="text-xs text-slate-400 mb-1">Nguồn để dựng:</div><LinkList links={store.source_links} label="Nguồn" icon={Film} /></div>}

      <label className="block text-sm font-semibold text-slate-700 mb-1">Tiêu đề video</label>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Review nâng mũi - KH Thanh Hà" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />

      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> Link clip đã dựng (mỗi dòng 1 link)</label>
      <textarea value={clip} onChange={e => setClip(e.target.value)} rows={2} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />

      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Image className="w-3.5 h-3.5" /> Ảnh thumbnail (tải trực tiếp)</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {thumbs.map((u, i) => (
          <div key={i} className="relative">
            <img src={u} alt="thumb" className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
            <button type="button" onClick={() => setThumbs(p => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><X className="w-3 h-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 disabled:opacity-50">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="text-[10px] mt-0.5">{uploading ? 'Đang tải' : 'Tải ảnh'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      </div>

      <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel={editing ? 'Cập nhật & nộp lại' : 'Đẩy clip'} />
    </Modal>
  );
};

// ---------- Modal: Ads đánh giá clip ----------
const ReviewClipModal = ({ clip, store, me, onClose, onSaved }) => {
  const [feedback, setFeedback] = useState(clip.ads_feedback || '');
  const [win, setWin] = useState(clip.win ?? false);
  const [amount, setAmount] = useState(clip.win_amount ? String(clip.win_amount) : '');
  const [score, setScore] = useState(clip.score ? String(clip.score) : '');
  const [note, setNote] = useState(clip.result_note || '');
  const [saving, setSaving] = useState(false);

  const submit = async (stage) => {
    setSaving(true);
    const payload = {
      ads_id: me.id, ads_feedback: feedback || null, stage,
      win: stage === 'revision' ? false : win,
      win_amount: stage !== 'revision' && win ? (Number(String(amount).replace(/\D/g, '')) || 0) : 0,
      score: Number(score) || 0, result_note: note || null,
      evaluated_at: stage === 'revision' ? null : new Date().toISOString(),
    };
    await onSaved(payload);
    setSaving(false);
  };
  return (
    <Modal title="Đánh giá clip" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{store?.customer_name}</b> · Editor: <b>{clip.editor?.full_name || '—'}</b></p>
      <div className="mb-3 flex flex-col gap-2">
        {(clip.clip_links || []).map((l, i) => <VideoPreview key={i} url={l} />)}
        {(clip.thumb_links || []).length > 0 && <div className="flex flex-wrap gap-2">{(clip.thumb_links || []).map((l, i) => <Thumb key={i} url={l} idx={i} size="h-24 w-24" download />)}</div>}
        {(clip.clip_links || []).length === 0 && <span className="text-xs text-slate-300">Chưa có clip</span>}
      </div>

      <label className="block text-sm font-semibold text-slate-700 mb-1">Phản hồi / góp ý cho editor</label>
      <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} placeholder="Nhận xét cho editor…" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />

      {/* Điểm video thành phẩm */}
      <label className="block text-sm font-semibold text-slate-700 mb-1">Điểm video thành phẩm (1–10)</label>
      <div className="flex items-center gap-2 mb-1">
        <input value={score} onChange={e => { const v = Math.min(10, Number(e.target.value.replace(/[^\d]/g, '')) || 0); setScore(v ? String(v) : ''); if (v < 10 && win) setWin(false); if (v === 10) setWin(true); }} inputMode="numeric" placeholder="0–10" className="w-24 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none text-center font-bold" />
        {(() => { const cat = scoreCat(score, win); return <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${cat.cls}`}>{cat.warn && '⚠️ '}{cat.label}</span>; })()}
        <span className="text-[11px] text-slate-400">10=Win · ≥8 Tốt · 5–7 TB · &lt;5 Tệ</span>
      </div>

      <button onClick={() => setWin(w => { const nw = !w; if (nw) setScore('10'); return nw; })} className={`w-full my-2 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 ${win ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' : 'bg-slate-100 text-slate-500 border-2 border-transparent'}`}>
        <Trophy className="w-5 h-5" /> {win ? 'WIN — 10 điểm' : 'Chấm WIN (=10đ)'}
      </button>
      {win && (
        <>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Tiền thưởng editor</label>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="VD: 100000" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-3" />
        </>
      )}
      <label className="block text-sm font-semibold text-slate-700 mb-1">Nhận xét kết quả</label>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: chuyển đổi tốt / cần đổi hook…" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
      <div className="flex justify-end gap-2">
        <button onClick={() => submit('revision')} disabled={saving} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600 disabled:opacity-50 flex items-center gap-1"><RotateCcw className="w-4 h-4" /> Cần sửa</button>
        <button onClick={() => submit('done')} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Lưu &amp; duyệt</button>
      </div>
    </Modal>
  );
};

// ---------- Trình phát video (phóng to/thu nhỏ + toàn màn hình) ----------
const VID_SIZES = [{ name: 'Nhỏ', w: '480px' }, { name: 'Vừa', w: '720px' }, { name: 'Lớn', w: '960px' }, { name: 'Tối đa', w: '100%' }];
const VideoModal = ({ clip, onClose }) => {
  const links = clip.clip_links || [];
  const [ci, setCi] = useState(0);
  const [zi, setZi] = useState(1);
  const playerRef = useRef(null);
  const cur = links[ci] || links[0];
  const goFs = () => { const el = playerRef.current; if (el?.requestFullscreen) el.requestFullscreen(); else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen(); };
  const IconBtn = ({ onClick, disabled, title, children }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">{children}</button>
  );
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><PlayCircle className="w-5 h-5 text-violet-600" /> Xem video clip</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4">
          {links.length > 1 && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {links.map((_, i) => <button key={i} onClick={() => setCi(i)} className={`px-3 py-1 rounded-lg text-xs font-semibold ${i === ci ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Video {i + 1}</button>)}
            </div>
          )}
          <div ref={playerRef} className="mx-auto bg-black rounded-xl overflow-hidden" style={{ width: VID_SIZES[zi].w, maxWidth: '100%' }}>
            <VideoPreview url={cur} />
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <IconBtn onClick={() => setZi(z => Math.max(0, z - 1))} disabled={zi === 0} title="Thu nhỏ"><ZoomOut className="w-4 h-4" /></IconBtn>
            <span className="text-xs font-semibold text-slate-500 w-12 text-center">{VID_SIZES[zi].name}</span>
            <IconBtn onClick={() => setZi(z => Math.min(VID_SIZES.length - 1, z + 1))} disabled={zi === VID_SIZES.length - 1} title="Phóng to"><ZoomIn className="w-4 h-4" /></IconBtn>
            <span className="w-px h-5 bg-slate-200 mx-1" />
            <IconBtn onClick={goFs} title="Toàn màn hình"><Maximize2 className="w-4 h-4" /> Toàn màn hình</IconBtn>
            <a href={cur} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"><ExternalLink className="w-4 h-4" /> Mở Drive</a>
          </div>
        </div>
      </div>
    </div>
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
