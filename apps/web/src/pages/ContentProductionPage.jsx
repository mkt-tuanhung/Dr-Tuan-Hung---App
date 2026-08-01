import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import MoneyInput from '@/components/MoneyInput.jsx';
import {
  Clapperboard, Plus, Search, X, Link as LinkIcon, ExternalLink, Trophy,
  Film, Scissors, CheckCircle2, RotateCcw, PlayCircle, PauseCircle, Circle, Image, Link2, FolderOpen, Upload, Loader2, Download, Trash2, ZoomIn, ZoomOut, Maximize2, AlertTriangle, List, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight,
  Heart, MessageCircle, Share2, Star, Volume2, VolumeX, Play, Pause, Send, MoreHorizontal, MoreVertical, Pencil, BarChart2, Ban, EyeOff,
  Clock, Wallet, TrendingUp, Phone, LayoutDashboard, Copy, Users, User, ShoppingCart, CircleDollarSign,
} from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';
import ImageLibrary from '@/components/ImageLibrary.jsx';
import { useFocusHighlight } from '@/lib/useFocusHighlight';

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
// Checklist các loại source đã có trong link Google Drive của khách (Feature #5)
const SOURCE_CHECKLIST = [
  { key: 'truoc_pt', label: 'Trước PT' },
  { key: 'sau_pt', label: 'Sau PT' },
  { key: 'beauty', label: 'Beauty' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'tai_kham', label: 'Tái khám' },
];
const SRC_LABEL = Object.fromEntries(SOURCE_CHECKLIST.map(t => [t.key, t.label]));
// Số ngày kể từ khi thêm nguồn (để tính "tồn đọng")
const staleAgeDays = (s) => { const t = s.created_at || s.shoot_date; if (!t) return 0; return Math.floor((Date.now() - new Date(t).getTime()) / 86400000); };
// Soi qua edge function scan-drive-folder (service account) — liệt kê thư mục con + phân loại.
// Trả { ok, types[], folders[], readableLinks, privateLinks, linkCount, noId, diag }
async function scanDrive(links) {
  const valid = (links || []).filter(l => typeof l === 'string' && /^https?:\/\//i.test(l));
  if (!valid.length) return { ok: true, types: [], folders: [], readableLinks: 0, privateLinks: 0, linkCount: 0, noId: 0, diag: [] };
  const { data, error } = await supabase.functions.invoke('scan-drive-folder', { body: { links: valid } });
  if (error) throw new Error(error.message || 'Lỗi gọi soi Drive');
  if (!data?.ok) throw new Error(data?.error || 'Soi Drive thất bại');
  return { ...data, linkCount: valid.length };
}
// Quét TỪNG FILE (video/ảnh) trong Drive — trả về danh sách chi tiết (mode: 'files')
async function scanDriveFiles(links) {
  const valid = (links || []).filter(l => typeof l === 'string' && /^https?:\/\//i.test(l));
  if (!valid.length) return { ok: true, files: [] };
  const { data, error } = await supabase.functions.invoke('scan-drive-folder', { body: { links: valid, mode: 'files' } });
  if (error) throw new Error(error.message || 'Lỗi gọi quét file');
  if (!data?.ok) throw new Error(data?.error || 'Quét file thất bại');
  return data;
}
// Helper hiển thị cho kho tài sản
const fmtSize = (b) => { const n = Number(b) || 0; if (n >= 1073741824) return (n / 1073741824).toFixed(1) + ' GB'; if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB'; if (n >= 1024) return (n / 1024).toFixed(0) + ' KB'; return n + ' B'; };
const fmtDur = (ms) => { if (!ms) return null; const s = Math.round(ms / 1000); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
const assetThumb = (a) => a?.drive_id ? `https://drive.google.com/thumbnail?id=${a.drive_id}&sz=w400` : (a?.thumb_link || null);
// Quét THƯ MỤC NGUỒN (khách hàng) để tự tạo record (mode: 'sources')
async function scanDriveSources(links) {
  const valid = (links || []).filter(l => typeof l === 'string' && /^https?:\/\//i.test(l));
  if (!valid.length) return { ok: true, sources: [] };
  const { data, error } = await supabase.functions.invoke('scan-drive-folder', { body: { links: valid, mode: 'sources' } });
  if (error) throw new Error(error.message || 'Lỗi gọi quét nguồn');
  if (!data?.ok) throw new Error(data?.error || 'Quét nguồn thất bại');
  return data;
}
// Đoán dịch vụ từ tên thư mục cha (dịch vụ) + phần mô tả sau tên khách
function detectService(ancestors, detail) {
  const hay = (ancestors || []).map(a => noDiacritics(a).toLowerCase()).join(' ') + ' ' + noDiacritics(detail || '').toLowerCase();
  const has = (arr) => arr.some(k => hay.includes(k));
  const svc = [];
  if (has(['ham mat', 'xuong ham', 'got ham', 'ha go', 'ha ham', 'don cam', 'truot cam', 'vline', 'v-line', 'v line', 'midface', 'mid face', 'go ma', 'nang co'])) svc.push('Hàm mặt');
  if (has(['body', 'nang nguc', 'nang mong', 'nguc', 'mong', 'hut mo', 'cay mo', 'thanh bung', 'tao hinh bung'])) svc.push('Body');
  if (has(['tieu phau', 'cat mi', 'mi mat', 'nang mui', 'sua mui', 'nang mui', 'moi'])) svc.push('Tiểu phẫu');
  return svc.join(', ');
}
// Phân tích 1 thư mục nguồn -> {name, date, service, source_id, link, driveId}
function parseSourceCandidate(c) {
  const raw = c.name || '';
  const m = raw.match(/^\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  const dd = m ? m[1].padStart(2, '0') : null;
  const mm = m ? m[2].padStart(2, '0') : null;
  const rest = raw.replace(/^\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[-–—]?\s*/, '');
  const name = (rest.split(/\s[-–—(]|[(,]/)[0] || rest).trim().replace(/\s+/g, ' ');
  const detail = rest.slice(name.length);
  let year = null;
  for (const a of (c.ancestors || [])) { const ym = String(a).match(/(20\d{2})/); if (ym) { year = ym[1]; break; } }
  if (!year && c.created) year = String(new Date(c.created).getFullYear());
  if (!year) year = String(new Date().getFullYear());
  const date = (dd && mm) ? `${year}-${mm}-${dd}` : (c.created ? c.created.slice(0, 10) : '');
  return { name, date, service: detectService(c.ancestors, detail), source_id: suggestSourceId(name, date), link: c.link, driveId: c.id };
}
// Soi rồi tự lưu danh sách TÊN thư mục con (chạy nền, không chặn lưu)
async function scanDriveAndUpdate(id, links) {
  try {
    const d = await scanDrive(links);
    if (d?.ok && d.folders?.length) {
      const { error } = await supabase.from('media_customers').update({ source_folders: d.folders, source_video_count: d.videoCount ?? 0, source_image_count: d.imageCount ?? 0 }).eq('id', id);
      if (error) toast.error('Lưu thư mục lỗi: ' + error.message);
      else toast.success('Đã đọc source: ' + d.folders.slice(0, 8).join(', '));
    } else if (d?.ok && d.privateLinks > 0 && !d.readableLinks) {
      toast('Link Drive chưa share cho service account (http404).', { icon: '🔒' });
    }
  } catch { /* im lặng để không chặn thao tác lưu */ }
}
const SERVICE_GROUPS = ['Hàm mặt', 'Body', 'Tiểu phẫu'];
// Lọc nhanh theo giai đoạn (suy từ tiến độ dựng clip)
const KHO_PHASES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'dang_dung', label: 'Đang dựng' },
  { id: 'cho_duyet', label: 'Chờ duyệt' },
  { id: 'da_duyet', label: 'Đã duyệt' },
];
const SOURCE_STATUS = {
  chua_dung: { label: 'Chưa dựng', cls: 'bg-slate-100 text-slate-600' },
  dang_dung: { label: 'Đang dựng', cls: 'bg-blue-100 text-blue-700' },
  da_dung: { label: 'Đã dựng', cls: 'bg-teal-100 text-teal-700' },
  loi: { label: 'Source lỗi', cls: 'bg-rose-100 text-rose-700' },
  can_bo_sung: { label: 'Cần bổ sung', cls: 'bg-amber-100 text-amber-700' },
};
// Phân loại điểm video thành phẩm do Ads chấm (1-10)
const scoreCat = (score, win) => {
  const n = Number(score) || 0;
  if (win || n >= 10) return { label: 'WIN', cls: 'bg-amber-100 text-amber-700', warn: false };
  if (n >= 8) return { label: 'Tốt', cls: 'bg-teal-100 text-teal-700', warn: false };
  if (n >= 5) return { label: 'Trung bình', cls: 'bg-yellow-100 text-yellow-700', warn: false };
  if (n > 0) return { label: 'Tệ', cls: 'bg-rose-100 text-rose-700', warn: true };
  return { label: 'Chưa chấm', cls: 'bg-slate-100 text-slate-500', warn: false };
};
// Tự chấm Win/điểm theo định nghĩa Ads (CPA mục tiêu = ngân sách ÷ số điện thoại)
function scoreByRule(spend, phones, rule) {
  const target = rule && rule.win_phones > 0 && Number(rule.win_budget) > 0 ? Number(rule.win_budget) / rule.win_phones : null;
  if (!target) return null; // chưa định nghĩa -> không tự chấm
  if (!phones || phones <= 0) return { win: false, score: Number(spend) > 0 ? 2 : 0 };
  const ratio = (Number(spend) / phones) / target;   // <=1 là đạt/tốt hơn chuẩn
  const score = ratio <= 1 ? 10 : ratio <= 1.3 ? 8 : ratio <= 2 ? 6 : 3;
  return { win: score >= 10, score };
}
// "Lượt mua (SĐT)" = lead (form/SĐT) + purchase (lượt mua trên Ads Manager).
// Chiến dịch tối ưu theo Tin nhắn/Mua hàng có thể chỉ bắn "purchase" chứ không
// bắn "lead" -> phải cộng cả hai để CRM khớp với Ads Manager.
const phonesOf = (c) => (Number(c?.fb_leads) || 0) + (Number(c?.fb_purchases) || 0);
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
  done: { label: 'Hoàn tất', cls: 'bg-teal-100 text-teal-700' },
};
const AD_STATUS = { dang_chay: { label: 'Đang chạy', cls: 'text-teal-600', icon: PlayCircle }, tam_dung: { label: 'Tạm dừng', cls: 'text-amber-600', icon: PauseCircle }, chua_chay: { label: 'Chưa chạy', cls: 'text-slate-400', icon: Circle } };

// Trạng thái campaign lấy trực tiếp từ Facebook Ads Manager (effective_status).
// Gom về 3 nhóm hiển thị: đang chạy / đang duyệt / đã tắt.
const FB_REVIEW = ['IN_PROCESS', 'PENDING_REVIEW', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'WITH_ISSUES'];
const fbStatusInfo = (s) => {
  if (!s) return null;
  if (s === 'ACTIVE') return { kind: 'running', label: 'Đang chạy', cls: 'bg-emerald-100 text-emerald-700' };
  if (FB_REVIEW.includes(s)) return { kind: 'review', label: 'Đang duyệt', cls: 'bg-amber-100 text-amber-700' };
  return { kind: 'off', label: 'Đã tắt', cls: 'bg-slate-200 text-slate-600' };
};
// Nhóm trạng thái của 1 clip: ưu tiên trạng thái thật từ Facebook; nếu chưa đồng bộ thì tạm dựa vào cờ cũ.
const fbKind = (c) => {
  if (c.fb_status) return fbStatusInfo(c.fb_status).kind;
  if (c.ad_status === 'dang_chay') return 'running';
  if (c.ad_status === 'tam_dung') return 'off';
  return null;
};

// Nhãn theo CHI PHÍ/SĐT khi clip còn đang chạy & chưa tiêu quá ngân sách Win.
const cpaTier = (cpa) => {
  if (cpa == null) return { text: 'Đang chạy — chưa đủ dữ liệu', cls: 'bg-slate-100 text-slate-500' };
  if (cpa < 800000) return { text: 'Chỉ số Tốt', cls: 'bg-emerald-100 text-emerald-700' };
  if (cpa < 1000000) return { text: 'Tiềm năng', cls: 'bg-teal-100 text-teal-700' };
  if (cpa <= 1200000) return { text: 'Bình thường', cls: 'bg-amber-100 text-amber-700' };
  return { text: 'Báo động', cls: 'bg-rose-100 text-rose-700' };
};

// Clip MỚI chạy chỉ số còn ít -> chưa vội chấm. Chỉ chấm điểm khi:
//   - đã tiêu ≥ ngân sách Win, HOẶC
//   - campaign đã TẮT (không còn chạy/duyệt).
// Còn đang chạy & chưa tiêu quá ngân sách -> "tiềm năng" (hiện nhãn theo CPA).
const clipVerdict = (c, rule) => {
  const wb = Number(rule?.win_budget) || 0;
  const hasRule = wb > 0 && Number(rule?.win_phones) > 0;
  const kind = fbKind(c);
  const inProgress = kind === 'running' || kind === 'review';
  const reachedBudget = wb > 0 && Number(c.fb_spend) >= wb;
  if (c.fb_campaign_id && hasRule && inProgress && !reachedBudget) {
    const phones = phonesOf(c);
    const cpa = phones > 0 ? Math.round(Number(c.fb_spend) / phones) : null;
    return { potential: true, tier: cpaTier(cpa) };
  }
  return { potential: false };
};

// Độ hiệu quả để xếp bài Ads tốt lên TRÊN: WIN > điểm cao > nhiều SĐT & CPA thấp.
const adEffValue = (c) => {
  const phones = phonesOf(c);
  const spend = Number(c.fb_spend) || 0;
  const cpa = phones > 0 ? spend / phones : null;
  let v = 0;
  if (c.win) v += 1000000;                       // WIN ưu tiên cao nhất
  v += (Number(c.score) || 0) * 10000;           // điểm hệ thống
  v += phones * 100;                              // nhiều SĐT hơn = hiệu quả hơn
  if (cpa != null) v += Math.max(0, 1500000 - cpa) / 1500; // CPA thấp -> cộng thêm (tối đa ~1000)
  return v;
};

// Tự chấm có điều kiện (dùng khi đồng bộ chỉ số). Trả null nếu CHƯA đến lúc chấm.
function autoScore(spend, phones, status, rule) {
  const wb = Number(rule?.win_budget) || 0;
  if (!wb || !(Number(rule?.win_phones) > 0)) return null; // chưa định nghĩa Win
  const kind = status ? fbStatusInfo(status)?.kind : null;
  const inProgress = kind === 'running' || kind === 'review';
  if (inProgress && Number(spend) < wb) return null; // đang chạy & chưa đủ ngân sách -> chưa chấm
  return scoreByRule(spend, phones, rule);
}

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
const VIDEO_BASE = 'block w-full rounded-lg border border-slate-200 bg-black';
// Mặc định: khung dọc 9:16, canh giữa, giới hạn chiều cao — hợp clip quảng cáo (quay dọc)
// và tránh trình phát (Google Drive / YouTube) bị nhồi vào khung ngang gây lỗi giao diện trên mobile.
const VideoPreview = ({ url, className = 'max-w-[300px] mx-auto aspect-[9/16] max-h-[75vh]' }) => {
  const emb = embedUrl(url);
  if (emb) return <iframe src={emb} loading="lazy" allow="autoplay; fullscreen" allowFullScreen title="clip" className={`${VIDEO_BASE} ${className}`} />;
  if (isVideoFile(url)) return <video src={url} controls playsInline preload="metadata" className={`${VIDEO_BASE} ${className}`} />;
  return <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Mở clip</a>;
};
const thumbSrc = (url) => { const id = driveId(url); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w600` : url; };
const imgFull = (url) => { const id = driveId(url); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : url; };
const viewImage = (url) => window.dispatchEvent(new CustomEvent('ads-view-image', { detail: imgFull(url) }));
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

// ---------- Bộ lọc khoảng ngày (kiểu FB Ads) ----------
const ymd = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
const parseYmd = (s) => { if (!s) return null; const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
const VN_DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DateRangeFilter = ({ from, to, onApply, headerLabel = 'Lọc theo ngày quay/chụp' }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parseYmd(from) || new Date());
  const [a, setA] = useState(parseYmd(from));
  const [b, setB] = useState(parseYmd(to));
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const pickDay = (d) => {
    if (!a || (a && b)) { setA(d); setB(null); }
    else if (d < a) { setB(a); setA(d); }
    else setB(d);
  };
  const preset = (kind) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dow = (now.getDay() + 6) % 7; let f, t;
    if (kind === 'week') { f = new Date(now); f.setDate(now.getDate() - dow); t = new Date(f); t.setDate(f.getDate() + 6); }
    else if (kind === 'lastweek') { t = new Date(now); t.setDate(now.getDate() - dow - 1); f = new Date(t); f.setDate(t.getDate() - 6); }
    else if (kind === 'month') { f = new Date(now.getFullYear(), now.getMonth(), 1); t = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
    else { f = new Date(now.getFullYear(), now.getMonth() - 1, 1); t = new Date(now.getFullYear(), now.getMonth(), 0); }
    setA(f); setB(t); setView(f);
  };

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  const inRange = (d) => a && b && d >= a && d <= b;
  const isEnd = (d) => (a && +d === +a) || (b && +d === +b);
  const label = from && to ? `${parseYmd(from).toLocaleDateString('vi-VN')} – ${parseYmd(to).toLocaleDateString('vi-VN')}` : 'Lọc theo ngày';

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className={`px-3 py-2 text-sm rounded-xl border bg-white outline-none inline-flex items-center gap-1.5 ${from && to ? 'border-teal-400 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
        <CalendarDays className="w-4 h-4" /> {label}
      </button>
      {open && (
        <div className="absolute z-40 mt-1 right-0 w-[290px] bg-white border border-slate-200 rounded-2xl shadow-xl p-3">
          <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wide mb-2">{headerLabel}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[['week', 'Tuần này'], ['lastweek', 'Tuần trước'], ['month', 'Tháng này'], ['lastmonth', 'Tháng trước']].map(([k, l]) => (
              <button key={k} onClick={() => preset(k)} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700">{l}</button>
            ))}
          </div>
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold">Tháng {view.getMonth() + 1}/{view.getFullYear()}</span>
            <button onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-slate-400 mb-1">{VN_DOW.map(d => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => d === null ? <div key={i} /> : (
              <button key={i} onClick={() => pickDay(d)} className={`h-8 text-xs rounded-lg ${isEnd(d) ? 'bg-teal-600 text-white font-bold' : inRange(d) ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 text-slate-600'}`}>{d.getDate()}</button>
            ))}
          </div>
          <div className="flex justify-between gap-2 mt-3">
            <button onClick={() => { setA(null); setB(null); onApply('', ''); setOpen(false); }} className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Xoá lọc</button>
            <button onClick={() => { onApply(ymd(a), ymd(b || a)); setOpen(false); }} disabled={!a} className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">Lọc</button>
          </div>
        </div>
      )}
    </div>
  );
};

const ContentProductionPage = ({ setActiveTab, view }) => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const isAdmin = roles.includes('admin');
  const isManager = isAdmin || roles.includes('accountant') || roles.includes('shareholder');
  const canAddMedia = roles.includes('media') || isAdmin;
  const canEdit = roles.includes('editor') || isAdmin;
  const canAds = roles.includes('marketing') || isAdmin;
  const canDesign = roles.includes('designer') || isAdmin; // được upload/quản lý thư viện ảnh

  const tabs = [];
  if (canAds || isManager) tabs.push('overview');
  if (canAddMedia || canEdit || isManager || canDesign) tabs.push('kho');
  if (canEdit || canAds || isManager) tabs.push('video');
  tabs.push('images'); // Thư viện ảnh mở cho mọi người trong module (chỉ designer/admin được sửa)
  // Tab do sidebar điều khiển (prop view: 'kho' | 'video' | 'images'); vẫn giữ setTab cho điều hướng nội bộ.
  const [tab, setTab] = useState(view || tabs[0] || 'kho');
  useEffect(() => { if (view && view !== tab) setTab(view); /* eslint-disable-next-line */ }, [view]);
  // Chuyển sang mục con khác trên sidebar (đồng bộ cả thanh menu bên trái)
  const gotoView = (v) => { setTab(v); setActiveTab?.(v === 'overview' ? 'content_overview' : v === 'kho' ? 'content_kho' : v === 'video' ? 'content_video' : 'content_images'); };

  const [stores, setStores] = useState([]);
  const [clips, setClips] = useState([]);
  const [assets, setAssets] = useState([]);   // kho tài sản media (từng file Drive)
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [search, setSearch] = useState('');
  const [khoPhase, setKhoPhase] = useState('all');  // lọc nhanh theo giai đoạn (chip)
  const [khoStatus, setKhoStatus] = useState('');   // lọc trạng thái source
  const [khoService, setKhoService] = useState(''); // lọc dịch vụ
  const [khoFrom, setKhoFrom] = useState('');       // lọc ngày quay từ
  const [khoTo, setKhoTo] = useState('');           // lọc ngày quay đến
  const [khoStale, setKhoStale] = useState(0);      // lọc nguồn tồn đọng (chưa dựng > N ngày); 0 = tắt
  const [khoTag, setKhoTag] = useState('');         // lọc theo nhãn
  const [khoUndone, setKhoUndone] = useState(false); // chỉ nguồn chưa dựng clip nào
  const [khoView, setKhoView] = useState('card');   // 'list' | 'card'
  const [khoMode, setKhoMode] = useState('library'); // 'library' (kho tài sản) | 'sources' (quản lý nguồn)
  const [scanningFiles, setScanningFiles] = useState(false);
  const [autoImportOpen, setAutoImportOpen] = useState(false);
  const [approveFor, setApproveFor] = useState(null); // clip đang mở popup Duyệt & Đăng ngay
  const [videoScore, setVideoScore] = useState(''); // lọc theo điểm Ads
  const [videoService, setVideoService] = useState(''); // lọc dịch vụ (Video Ads)
  const [videoView, setVideoView] = useState('card'); // 'card' | 'grid' (xem lưới thumbnail)
  const [videoTab, setVideoTab] = useState('all'); // all | pending | running | off
  const [videoFrom, setVideoFrom] = useState('');   // lọc ngày dựng từ
  const [videoTo, setVideoTo] = useState('');       // lọc ngày dựng đến
  const [focusClipId, setFocusClipId] = useState(null); // clip cần focus khi mở từ thông báo (luôn hiện dù đang lọc)
  const [addOpen, setAddOpen] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [winRule, setWinRule] = useState(null);      // định nghĩa Ads Win
  const [winModal, setWinModal] = useState(false);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [editSource, setEditSource] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [buildFor, setBuildFor] = useState(null);   // store đang dựng clip mới
  const [editClip, setEditClip] = useState(null);   // clip editor đang sửa
  const [reviewFor, setReviewFor] = useState(null);
  const [videoFor, setVideoFor] = useState(null);   // clip đang xem video
  const [sourceFor, setSourceFor] = useState(null); // store đang xem source
  const [scoreFor, setScoreFor] = useState(null);   // store đang chấm điểm/góp ý source
  const [clipsModal, setClipsModal] = useState(null); // { store, clips } xem video đã dựng từ source
  const [confirmState, setConfirmState] = useState(null); // hộp thoại xác nhận
  const ask = (message, onOk, opts = {}) => setConfirmState({ message, onOk, ...opts });

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const [scRes, clRes, wrRes] = await Promise.all([
      supabase.from('media_customers').select('*, media:profiles!media_id(full_name)').order('updated_at', { ascending: false }),
      supabase.from('media_clips').select('*, editor:profiles!editor_id(full_name), ads:profiles!ads_id(full_name)').order('updated_at', { ascending: false }),
      supabase.from('ads_win_rule').select('*').eq('id', 1).maybeSingle(),
    ]);
    setStores(scRes.data || []);
    setClips(clRes.data || []);
    if (wrRes.data) setWinRule(wrRes.data);
    // Kho tài sản: nạp phân trang (tránh giới hạn 1000 dòng của PostgREST)
    const allAssets = [];
    for (let from = 0; from < 60000; from += 1000) {
      const { data } = await supabase.from('media_assets').select('*').order('created_time', { ascending: false, nullsFirst: false }).range(from, from + 999);
      if (!data || !data.length) break;
      allAssets.push(...data);
      if (data.length < 1000) break;
    }
    setAssets(allAssets);
    didLoad.current = true;
    setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('media_customers,media_clips', loadData);
  useFocusHighlight('content_video', 'clip-', !loading, (id) => {
    // Bỏ mọi bộ lọc + ép hiện đúng clip để cuộn tới được, rồi trả lại bình thường
    setSearch(''); setVideoScore(''); setVideoService(''); setVideoFrom(''); setVideoTo('');
    setFocusClipId(id);
    setTimeout(() => setFocusClipId(null), 6000);
  });

  const clipsOf = (storeId) => clips.filter(c => c.media_customer_id === storeId);
  const storeOf = (id) => stores.find(s => s.id === id);
  // Ảnh thumbnail đầu tiên từ clip (nếu có) để hiện preview thẻ media
  const firstThumbOf = (storeId) => { for (const c of clipsOf(storeId)) { const t = (c.thumb_links || [])[0]; if (t) return t; } return null; };
  // Tiến độ suy ra: Chưa dựng 0 → Đang dựng 50 → Có clip chờ duyệt 75 → Đã duyệt 100
  const progressOf = (storeId, sourceStatus) => {
    const cs = clipsOf(storeId);
    if (cs.some(c => c.approved_to_run || c.stage === 'approved' || c.stage === 'done')) return 100;
    if (cs.length) return 75;
    if (sourceStatus === 'dang_dung') return 50;
    return 0;
  };

  const patchClip = async (id, payload, msg) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
    const { error } = await supabase.from('media_clips').update(payload).eq('id', id);
    if (error) { toast.error('Lỗi: ' + error.message); loadData(); return; }
    if (msg) toast.success(msg);
  };
  // Kéo chỉ số Facebook theo ID chiến dịch, lưu vào clip
  const syncFbClip = async (clipId, campaignId) => {
    const cid = (campaignId || '').replace(/\D/g, '');
    if (!cid) { toast.error('Chưa có ID chiến dịch Facebook'); return; }
    toast.loading('Đang kéo chỉ số Facebook…', { id: 'fb-' + clipId });
    try {
      const { data, error } = await supabase.functions.invoke('fb-ads-insights', { body: { campaign_id: cid } });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Lỗi Facebook');
      const m = data.metrics || {};
      const upd = {
        fb_campaign_id: cid, fb_spend: m.spend ?? 0, fb_messages: m.messages ?? 0, fb_leads: m.leads ?? 0,
        fb_purchases: m.purchases ?? 0,
        fb_reach: m.reach ?? 0, fb_impressions: m.impressions ?? 0, fb_results: m.results ?? 0,
        fb_status: m.status ?? null, fb_synced_at: new Date().toISOString(),
      };
      const mPhones = (m.leads ?? 0) + (m.purchases ?? 0);
      const v = autoScore(m.spend ?? 0, mPhones, m.status, winRule); // chỉ chấm khi đủ điều kiện
      if (v) { upd.win = v.win; upd.score = v.score; }
      const { error: upErr } = await supabase.from('media_clips').update(upd).eq('id', clipId);
      if (upErr) throw upErr;
      toast.success(`Đã cập nhật: ${m.messages || 0} khách tiềm năng · ${mPhones} lượt mua (SĐT)`, { id: 'fb-' + clipId, duration: 6000 });
      loadData();
    } catch (e) { toast.error('Facebook: ' + e.message, { id: 'fb-' + clipId, duration: 8000 }); }
  };
  // Đồng bộ chỉ số tất cả clip đã gán ID chiến dịch
  const [syncingAll, setSyncingAll] = useState(false);
  const syncAllFb = async () => {
    const targets = clips.filter(c => c.fb_campaign_id);
    if (!targets.length) { toast.error('Chưa có clip nào gán ID chiến dịch'); return; }
    setSyncingAll(true);
    let done = 0, ok = 0, fail = false;
    toast.loading(`Đang cập nhật 0/${targets.length}…`, { id: 'fb-all' });
    for (const c of targets) {
      try {
        const { data } = await supabase.functions.invoke('fb-ads-insights', { body: { campaign_id: c.fb_campaign_id } });
        if (data?.ok) {
          const m = data.metrics || {};
          const upd = {
            fb_spend: m.spend ?? 0, fb_messages: m.messages ?? 0, fb_leads: m.leads ?? 0,
            fb_purchases: m.purchases ?? 0,
            fb_reach: m.reach ?? 0, fb_impressions: m.impressions ?? 0, fb_results: m.results ?? 0,
            fb_status: m.status ?? null, fb_synced_at: new Date().toISOString(),
          };
          const v = autoScore(m.spend ?? 0, (m.leads ?? 0) + (m.purchases ?? 0), m.status, winRule);
          if (v) { upd.win = v.win; upd.score = v.score; }
          const { error } = await supabase.from('media_clips').update(upd).eq('id', c.id);
          if (error) fail = true; else ok++;
        } else fail = true;
      } catch { fail = true; }
      done++; toast.loading(`Đang cập nhật ${done}/${targets.length}…`, { id: 'fb-all' });
    }
    setSyncingAll(false);
    toast[fail && ok === 0 ? 'error' : 'success'](`Đã cập nhật ${ok}/${targets.length} clip`, { id: 'fb-all', duration: 6000 });
    loadData();
  };
  // Lưu định nghĩa Win + chấm lại toàn bộ clip đã có chỉ số (không gọi lại FB)
  const saveWinRule = async (budget, phones) => {
    const rule = { win_budget: Number(String(budget).replace(/\D/g, '')) || 0, win_phones: Number(String(phones).replace(/\D/g, '')) || 0 };
    if (!rule.win_budget || !rule.win_phones) { toast.error('Nhập cả ngân sách và số điện thoại'); return; }
    const { error } = await supabase.from('ads_win_rule').upsert({ id: 1, ...rule, updated_by: me.id, updated_at: new Date().toISOString() });
    if (error) { toast.error('Lỗi lưu: ' + error.message); return; }
    setWinRule({ id: 1, ...rule });
    const targets = clips.filter(c => c.fb_campaign_id && (Number(c.fb_spend) > 0 || phonesOf(c) > 0));
    let n = 0;
    for (const c of targets) { const v = autoScore(c.fb_spend, phonesOf(c), c.fb_status, rule); if (v) { await supabase.from('media_clips').update({ win: v.win, score: v.score }).eq('id', c.id); n++; } }
    toast.success(`Đã lưu định nghĩa Win — tự chấm lại ${n} clip`);
    setWinModal(false); loadData();
  };
  // Duyệt chạy Ads + tuỳ chọn "Đăng ngay" — thực thi từ popup ApproveModal
  const doApprove = async (c, postNow) => {
    const payload = { approved_to_run: true, stage: c.stage === 'submitted' ? 'done' : c.stage, ads_id: me.id, evaluated_at: c.evaluated_at || new Date().toISOString() };
    if (postNow) { payload.post_now = true; payload.post_now_at = new Date().toISOString(); payload.post_status = 'queued'; }
    await patchClip(c.id, payload, postNow ? 'Đã duyệt & bật ĐĂNG NGAY lên page' : 'Đã duyệt chạy Ads — Editor +500.000đ');
    setApproveFor(null);
  };
  // Gỡ ID chiến dịch (gán nhầm) — xoá chỉ số FB & điểm tự chấm để tránh chấm nhầm
  const removeFbCampaign = (c) => ask(
    'Gỡ ID chiến dịch khỏi clip này? Chỉ số Facebook và điểm tự chấm sẽ bị xoá để tránh chấm nhầm điểm.',
    async () => {
      await patchClip(c.id, {
        fb_campaign_id: null, fb_spend: 0, fb_messages: 0, fb_leads: 0, fb_purchases: 0,
        fb_reach: 0, fb_impressions: 0, fb_results: 0, fb_status: null, fb_synced_at: null,
        win: false, score: null,
      }, 'Đã gỡ ID chiến dịch — clip trở về "Chưa chấm"');
    },
    { okLabel: 'Gỡ ID', danger: true }
  );
  // Bật/tắt nhãn "Đăng ngay" — hệ thống ngoài đọc cờ này để tự đăng video lên page
  const markPostNow = (c, on) => patchClip(c.id,
    { post_now: on, post_now_at: on ? new Date().toISOString() : null, post_status: on ? 'queued' : null, ads_id: me.id },
    on ? 'Đã bật ĐĂNG NGAY — hệ thống sẽ tự đăng lên page' : 'Đã huỷ Đăng ngay');
  // Mở thẳng link Google Drive nguồn (thư mục tổng) trong tab mới
  const openSource = (s) => {
    const links = (s.source_links || []).filter(Boolean);
    if (!links.length) { toast.error('Khách này chưa có link nguồn'); return; }
    window.open(links[0], '_blank', 'noopener');
  };
  const delStore = (s) => ask('Xoá media khách hàng này (kèm các clip)?', async () => {
    setStores(prev => prev.filter(x => x.id !== s.id));
    await supabase.from('media_customers').delete().eq('id', s.id);
  }, { okLabel: 'Xoá', danger: true });
  // Soi 1 phát tất cả khách có link Drive
  const rescanAll = async () => {
    const targets = stores.filter(s => (s.source_links || []).length > 0);
    if (!targets.length) { toast.error('Không có khách nào có link Drive'); return; }
    setScanningAll(true);
    const tid = 'scan-all';
    let done = 0, ok = 0, failCol = false;
    toast.loading(`Đang soi 0/${targets.length}…`, { id: tid });
    const BATCH = 5;
    for (let i = 0; i < targets.length; i += BATCH) {
      const chunk = targets.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (s) => {
        try {
          const d = await scanDrive(s.source_links);
          if (d?.ok && d.folders?.length) {
            const { error } = await supabase.from('media_customers').update({ source_folders: d.folders, source_video_count: d.videoCount ?? 0, source_image_count: d.imageCount ?? 0 }).eq('id', s.id);
            if (error) failCol = true; else ok++;
          }
        } catch { /* bỏ qua khách lỗi */ }
        done++;
        toast.loading(`Đang soi ${done}/${targets.length}…`, { id: tid });
      }));
    }
    setScanningAll(false);
    if (failCol) toast.error('Lưu lỗi — cần chạy media_source_folders.sql', { id: tid, duration: 9000 });
    else toast.success(`Soi xong ${ok}/${targets.length} khách có thư mục`, { id: tid, duration: 6000 });
    loadData();
  };
  const rescanStore = async (s) => {
    const links = s.source_links || [];
    if (!links.length) { toast.error('Khách này chưa có link Drive'); return; }
    toast.loading('Đang soi Drive…', { id: 'scan-' + s.id });
    try {
      const d = await scanDrive(links);
      if (d?.ok && d.folders?.length) {
        const { error } = await supabase.from('media_customers').update({ source_folders: d.folders, source_video_count: d.videoCount ?? 0, source_image_count: d.imageCount ?? 0 }).eq('id', s.id);
        if (error) { toast.error('Lưu lỗi: ' + error.message + ' — cần chạy media_source_folders.sql', { id: 'scan-' + s.id, duration: 9000 }); return; }
        toast.success('Đã đọc ' + d.folders.length + ' thư mục: ' + d.folders.slice(0, 8).join(', '), { id: 'scan-' + s.id, duration: 6000 });
        loadData();
      } else if (d?.ok && d.privateLinks && !d.readableLinks) {
        toast('Link riêng tư — chưa share thư mục cho service account (báo http404).', { id: 'scan-' + s.id, icon: '🔒' });
      } else {
        toast('Đọc ' + (d.folders?.length || 0) + ' thư mục [link:' + d.linkCount + ' • ' + (d.diag || []).join(',') + ']: ' + (d.folders || []).slice(0, 8).join(', '), { id: 'scan-' + s.id, icon: 'ℹ️', duration: 9000 });
      }
    } catch (e) { toast.error('Soi lỗi: ' + e.message, { id: 'scan-' + s.id }); }
  };
  // Quét TỪNG FILE từ Drive vào kho tài sản (media_assets)
  const scanAllFiles = async () => {
    const targets = stores.filter(s => (s.source_links || []).length > 0);
    if (!targets.length) { toast.error('Không có khách nào có link Drive'); return; }
    setScanningFiles(true);
    const tid = 'scan-files';
    let done = 0, totalFiles = 0, failCol = false;
    toast.loading(`Đang quét file Drive 0/${targets.length}…`, { id: tid });
    for (const s of targets) {
      try {
        const d = await scanDriveFiles(s.source_links);
        const rows = (d.files || []).map(f => ({
          drive_id: f.drive_id, media_customer_id: s.id, name: f.name, kind: f.kind, mime: f.mime,
          size_bytes: f.size || 0, duration_ms: f.duration_ms ?? null, folder: f.folder || null,
          web_link: f.link, thumb_link: f.thumb, created_time: f.created,
        }));
        if (rows.length) {
          let rowErr = false;
          for (let i = 0; i < rows.length; i += 500) {
            const { error } = await supabase.from('media_assets').upsert(rows.slice(i, i + 500), { onConflict: 'drive_id' });
            if (error) { rowErr = true; failCol = true; }
          }
          if (!rowErr) totalFiles += rows.length;
        }
      } catch { /* bỏ qua khách lỗi */ }
      done++;
      toast.loading(`Đang quét file Drive ${done}/${targets.length}… (${totalFiles} file)`, { id: tid });
    }
    setScanningFiles(false);
    if (failCol) toast.error('Lưu lỗi — cần chạy media_assets.sql', { id: tid, duration: 9000 });
    else toast.success(`Đã quét ${totalFiles} file từ ${targets.length} nguồn`, { id: tid, duration: 6000 });
    loadData();
  };
  const toggleFav = async (a) => {
    setAssets(prev => prev.map(x => x.id === a.id ? { ...x, favorite: !x.favorite } : x));
    await supabase.from('media_assets').update({ favorite: !a.favorite }).eq('id', a.id);
  };
  const delClip = (id) => ask('Xoá clip này?', async () => {
    setClips(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('media_clips').delete().eq('id', id);
    if (error) { toast.error(error.message); loadData(); }
  }, { okLabel: 'Xoá', danger: true });

  // Bảng điểm Editor tháng này (theo điểm Ads chấm)
  const now = new Date();
  const evalC = clips.filter(c => c.editor_id && c.evaluated_at && new Date(c.evaluated_at).getMonth() === now.getMonth() && new Date(c.evaluated_at).getFullYear() === now.getFullYear());
  const lb = Object.values(evalC.reduce((a, c) => {
    const scored = c.win || (Number(c.score) || 0) > 0; // clip chưa chấm điểm thì KHÔNG tính vào trung bình
    const pts = c.win ? 10 : (Number(c.score) || 0);
    a[c.editor_id] = a[c.editor_id] || { id: c.editor_id, name: c.editor?.full_name || 'Editor', n: 0, sum: 0, sc: 0, w: 0, m: 0 };
    const e = a[c.editor_id];
    e.n++; if (scored) { e.sum += pts; e.sc++; } if (c.win) e.w++; e.m += Number(c.win_amount || 0);
    return a;
  }, {})).map(e => ({ ...e, avg: e.sc ? e.sum / e.sc : null })).sort((x, y) => (y.avg ?? -1) - (x.avg ?? -1)).slice(0, 5);

  // "Điểm Editor" trên thẻ clip = trung bình TÍCH LŨY mọi thời gian (không reset
  // theo tháng như bảng điểm) — để luôn thấy trình độ editor; clip chưa chấm bỏ qua.
  const editorAvgMap = clips.reduce((a, c) => {
    if (c.editor_id && (c.win || (Number(c.score) || 0) > 0)) {
      const pts = c.win ? 10 : (Number(c.score) || 0);
      a[c.editor_id] = a[c.editor_id] || { sum: 0, n: 0 };
      a[c.editor_id].sum += pts; a[c.editor_id].n++;
    }
    return a;
  }, {});
  const editorAvg = (id) => { const e = editorAvgMap[id]; return e && e.n ? e.sum / e.n : null; };
  const builtCustomerIds = new Set(clips.map(c => c.media_customer_id));

  // Danh sách "Việc cần xử lý" (dùng chung cho panel & trang Tổng quan)
  const clearKhoFilters = () => { setKhoStatus(''); setKhoService(''); setKhoFrom(''); setKhoTo(''); setKhoTag(''); setKhoPhase('all'); };
  const todoTiles = (() => {
    const withSrc = stores.filter(s => (s.source_links || []).length > 0 && clipsOf(s.id).length === 0);
    const staleSrc = withSrc.filter(s => staleAgeDays(s) >= 14);
    const pending = clips.filter(c => c.stage === 'submitted' && !c.approved_to_run);
    const revision = clips.filter(c => c.stage === 'revision');
    const t = [];
    if (canEdit || isManager) t.push({ n: withSrc.length, label: 'Nguồn mới chưa dựng', tone: 'teal', icon: FolderOpen, onClick: () => { gotoView('kho'); clearKhoFilters(); setKhoStale(0); setKhoUndone(true); } });
    if (canEdit || isManager) t.push({ n: staleSrc.length, label: 'Nguồn tồn đọng > 14 ngày', tone: 'rose', icon: AlertTriangle, onClick: () => { gotoView('kho'); clearKhoFilters(); setKhoUndone(false); setKhoStale(14); } });
    if (canAds || isManager) t.push({ n: pending.length, label: 'Clip chờ Ads duyệt', tone: 'violet', icon: PlayCircle, onClick: () => { gotoView('video'); setVideoScore(''); setVideoService(''); setVideoFrom(''); setVideoTo(''); setVideoTab('pending'); } });
    if (canEdit || isManager) t.push({ n: revision.length, label: 'Clip cần sửa lại', tone: 'amber', icon: RotateCcw, onClick: () => { gotoView('video'); setVideoTab('all'); setVideoScore(''); } });
    return t;
  })();

  const q = search.trim().toLowerCase();
  // Giai đoạn của 1 media (suy từ tiến độ): đã duyệt / chờ duyệt / đang dựng
  const phaseOf = (s) => { const p = progressOf(s.id, s.source_status); return p === 100 ? 'da_duyet' : p >= 75 ? 'cho_duyet' : 'dang_dung'; };
  const phaseBase = stores.filter(s =>
    // Kho media CHỈ hiện khách có SOURCE gốc do Media up (có link nguồn).
    // Thẻ do Editor tự tạo khi up video (không có source) sẽ không lẫn vào đây — clip nằm ở Video Ads.
    (s.source_links || []).length > 0 &&
    (!q || (s.customer_name || '').toLowerCase().includes(q) || (s.customer_phone || '').includes(q)) &&
    (!khoStatus || (s.source_status || 'chua_dung') === khoStatus) &&
    (!khoService || (s.service || '').includes(khoService)) &&
    (!khoFrom || (s.shoot_date && s.shoot_date >= khoFrom)) &&
    (!khoTo || (s.shoot_date && s.shoot_date <= khoTo)) &&
    // Tồn đọng: chưa dựng clip nào & đã quá N ngày kể từ khi thêm nguồn
    (!khoStale || (clipsOf(s.id).length === 0 && staleAgeDays(s) >= khoStale)) &&
    (!khoTag || (s.tags || []).includes(khoTag)) &&
    (!khoUndone || clipsOf(s.id).length === 0));
  const phaseCount = (id) => id === 'all' ? phaseBase.length : phaseBase.filter(s => phaseOf(s) === id).length;
  const visStores = khoPhase === 'all' ? phaseBase : phaseBase.filter(s => phaseOf(s) === khoPhase);
  const allTags = [...new Set(stores.flatMap(s => s.tags || []))].sort();
  // Clip cho Ads duyệt: tháng này (theo submitted_at) hoặc chưa xong
  const reviewClips = clips.filter(c => {
    if (c.id === focusClipId) return true; // clip mở từ thông báo -> luôn hiện dù đang lọc
    const st = storeOf(c.media_customer_id);
    if (q) {
      const matchQ = (st?.customer_name || '').toLowerCase().includes(q)
        || (st?.customer_phone || '').includes(q)
        || (c.title || '').toLowerCase().includes(q)
        || String(c.fb_campaign_id || '').toLowerCase().includes(q);
      if (!matchQ) return false;
      return true; // đang tìm kiếm -> tìm xuyên tất cả sub-tab & không giới hạn tháng
    }
    // Sub-tab theo trạng thái campaign — "Đang chạy"/"Đã tắt" = ĐÃ GÁN ID chiến dịch + trạng thái tương ứng
    const k = fbKind(c);
    if (videoTab === 'pending') return c.stage === 'submitted' && !c.approved_to_run;
    if (videoTab === 'running') return !!c.fb_campaign_id && k === 'running';
    if (videoTab === 'review') return !!c.fb_campaign_id && k === 'review';
    if (videoTab === 'off') return !!c.fb_campaign_id && k === 'off';
    if (!matchScoreFilter(c, videoScore)) return false;
    if (videoService && !((st?.service || '').includes(videoService))) return false;
    const day = (c.submitted_at || c.created_at || '').slice(0, 10);
    if (videoFrom && day < videoFrom) return false;
    if (videoTo && day > videoTo) return false;
    return true; // hiện TẤT CẢ clip (không giới hạn theo tháng) — dùng sub-tab/lọc ngày để thu hẹp
  }).sort((a, b) => adEffValue(b) - adEffValue(a)); // bài Ads hiệu quả ưu tiên lên trên
  const videoCounts = {
    pending: clips.filter(c => c.stage === 'submitted' && !c.approved_to_run).length,
    running: clips.filter(c => c.fb_campaign_id && fbKind(c) === 'running').length,
    review: clips.filter(c => c.fb_campaign_id && fbKind(c) === 'review').length,
    off: clips.filter(c => c.fb_campaign_id && fbKind(c) === 'off').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {tab === 'overview' ? <><LayoutDashboard className="w-6 h-6 text-teal-600" /> Tổng quan Marketing</>
              : tab === 'kho' ? <><FolderOpen className="w-6 h-6 text-teal-600" /> Kho Media</>
              : tab === 'video' ? <><PlayCircle className="w-6 h-6 text-violet-600" /> Video Ads</>
              : <><Image className="w-6 h-6 text-fuchsia-600" /> Thư viện ảnh</>}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {tab === 'overview' ? 'Tổng hợp hiệu suất Video Ads · chỉ số chiến dịch · bảng điểm editor'
              : tab === 'kho' ? 'Media up nguồn → Editor dựng clip cho từng khách'
              : tab === 'video' ? 'Ads duyệt clip · gán chiến dịch · theo dõi chỉ số & chấm Win'
              : 'Thư viện hình ảnh dùng chung (Designer/Admin được chỉnh sửa)'}
          </p>
        </div>
        {tab === 'kho' && (canAddMedia || canEdit) && (
          <div className="flex items-center gap-2 flex-wrap">
            {khoMode === 'library' ? (
              <>
                <button onClick={() => setKhoMode('sources')} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"><FolderOpen className="w-4 h-4" /> Quản lý nguồn</button>
                <button onClick={scanAllFiles} disabled={scanningFiles} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-60">{scanningFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Kết nối Drive</button>
              </>
            ) : (
              <>
                <button onClick={() => setKhoMode('library')} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"><LayoutGrid className="w-4 h-4" /> Thư viện</button>
                {canAddMedia && <button onClick={() => setAutoImportOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600"><FolderOpen className="w-4 h-4" /> Tự động thêm nguồn</button>}
                <button onClick={rescanAll} disabled={scanningAll} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-60">{scanningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Soi tất cả</button>
              </>
            )}
            {canAddMedia && (
              <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700">
                <Plus className="w-4 h-4" /> Thêm media
              </button>
            )}
          </div>
        )}
        {tab === 'video' && canEdit && (
          <button onClick={() => setAddVideoOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Thêm Video Ads
          </button>
        )}
      </div>

      {/* Kho media (chế độ Quản lý nguồn): Việc cần xử lý full-width */}
      {tab === 'kho' && khoMode === 'sources' && <TodoPanel tiles={todoTiles.filter(t => t.n > 0)} />}

      {/* Video Ads: Việc cần xử lý + Bảng điểm Editor cạnh nhau (theo mockup) */}
      {tab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TodoPanel tiles={todoTiles.filter(t => t.n > 0)} compact />
          <LeaderboardCard lb={lb} now={now} onSeeAll={() => gotoView('overview')} />
        </div>
      )}

      <div className={`gap-2 flex-wrap ${(tab === 'overview' || (tab === 'kho' && khoMode === 'library')) ? 'hidden' : 'flex'}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === 'video' ? 'Tìm theo tên / SĐT / ID chiến dịch…' : 'Tìm theo tên / SĐT khách…'} className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white" />
        </div>
        {tab === 'kho' && (
          <>
            <select value={khoStatus} onChange={e => setKhoStatus(e.target.value)} className="flex-1 sm:flex-none min-w-[140px] px-3 py-2.5 sm:py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white">
              <option value="">Mọi trạng thái source</option>
              {Object.entries(SOURCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={khoService} onChange={e => setKhoService(e.target.value)} className="flex-1 sm:flex-none min-w-[140px] px-3 py-2.5 sm:py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white">
              <option value="">Mọi dịch vụ</option>
              {SERVICE_GROUPS.map(sv => <option key={sv} value={sv}>{sv}</option>)}
            </select>
            <DateRangeFilter from={khoFrom} to={khoTo} onApply={(f, t) => { setKhoFrom(f); setKhoTo(t); }} />
            <select value={khoStale} onChange={e => setKhoStale(Number(e.target.value))} className={`flex-1 sm:flex-none min-w-[150px] px-3 py-2.5 sm:py-2 text-sm rounded-xl border outline-none ${khoStale ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-slate-200 bg-white'}`}>
              <option value={0}>Mọi nguồn (tồn đọng)</option>
              <option value={7}>Tồn đọng &gt; 7 ngày</option>
              <option value={14}>Tồn đọng &gt; 14 ngày</option>
              <option value={30}>Tồn đọng &gt; 30 ngày</option>
            </select>
            {allTags.length > 0 && (
              <select value={khoTag} onChange={e => setKhoTag(e.target.value)} className={`flex-1 sm:flex-none min-w-[130px] px-3 py-2.5 sm:py-2 text-sm rounded-xl border outline-none ${khoTag ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold' : 'border-slate-200 bg-white'}`}>
                <option value="">Mọi nhãn</option>
                {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
              </select>
            )}
            {khoUndone && <span className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-xl bg-teal-600 text-white font-semibold">Chưa dựng<button onClick={() => setKhoUndone(false)}><X className="w-3.5 h-3.5" /></button></span>}
            {(khoStatus || khoService || khoFrom || khoTo || khoStale || khoTag || khoUndone) && <button onClick={() => { setKhoStatus(''); setKhoService(''); setKhoFrom(''); setKhoTo(''); setKhoStale(0); setKhoTag(''); setKhoUndone(false); }} className="px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">Xoá lọc</button>}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setKhoView('list')} title="Xem danh sách" className={`px-2.5 py-2 ${khoView === 'list' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><List className="w-4 h-4" /></button>
              <button onClick={() => setKhoView('card')} title="Xem thẻ" className={`px-2.5 py-2 ${khoView === 'card' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><LayoutGrid className="w-4 h-4" /></button>
            </div>
          </>
        )}
        {tab === 'video' && (
          <>
            <select value={videoScore} onChange={e => setVideoScore(e.target.value)} className="flex-1 sm:flex-none min-w-[140px] px-3 py-2.5 sm:py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white">
              <option value="">Mọi mức điểm</option>
              {Object.entries(SCORE_FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={videoService} onChange={e => setVideoService(e.target.value)} className="flex-1 sm:flex-none min-w-[140px] px-3 py-2.5 sm:py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white">
              <option value="">Mọi dịch vụ</option>
              {SERVICE_GROUPS.map(sv => <option key={sv} value={sv}>{sv}</option>)}
            </select>
            <DateRangeFilter from={videoFrom} to={videoTo} headerLabel="Lọc theo ngày dựng" onApply={(f, t) => { setVideoFrom(f); setVideoTo(t); }} />
            {(videoScore || videoService || videoFrom || videoTo) && <button onClick={() => { setVideoScore(''); setVideoService(''); setVideoFrom(''); setVideoTo(''); }} className="px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">Xoá lọc</button>}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden ml-auto">
              <button onClick={() => setVideoView('card')} title="Xem thẻ" className={`px-3 py-2 ${videoView === 'card' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><List className="w-4 h-4" /></button>
              <button onClick={() => setVideoView('grid')} title="Xem lưới" className={`px-3 py-2 ${videoView === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>

      {/* Chip lọc theo giai đoạn — Kho media (chế độ Quản lý nguồn) */}
      {tab === 'kho' && khoMode === 'sources' && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {KHO_PHASES.map(p => {
            const active = khoPhase === p.id;
            return (
              <button key={p.id} onClick={() => setKhoPhase(p.id)}
                className={`shrink-0 whitespace-nowrap h-9 px-4 rounded-full text-[13.5px] font-bold transition ${active ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/25' : 'bg-white text-slate-600 border border-slate-200 active:bg-slate-50'}`}>
                {p.label} ({phaseCount(p.id)})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : tab === 'overview' ? (
        <AdsOverview clips={clips} stores={stores} storeOf={storeOf} now={now} videoCounts={videoCounts} todoTiles={todoTiles} lb={lb} onOpenClip={setVideoFor} onGoVideo={() => gotoView('video')} />
      ) : tab === 'images' ? (
        <ImageLibrary me={me} canWrite={canDesign} />
      ) : tab === 'kho' && khoMode === 'library' ? (
        <MediaVault assets={assets} storeOf={storeOf} builtCustomerIds={builtCustomerIds} scanning={scanningFiles} onScan={scanAllFiles}
          onToggleFav={toggleFav} canAddMedia={canAddMedia} onAddMedia={() => setAddOpen(true)} onManageSources={() => setKhoMode('sources')} />
      ) : tab === 'kho' ? (
        visStores.length === 0 ? (
          <Empty icon={FolderOpen} title="Kho media trống"
            desc={canAddMedia ? 'Bấm “Thêm media” để up link nguồn và gắn với khách hàng.' : canEdit ? 'Khi Media up nguồn, bạn vào đây bấm “Dựng video” cho từng khách.' : 'Chưa có dữ liệu media.'}
            cta={canAddMedia ? { label: 'Thêm media', onClick: () => setAddOpen(true) } : null} />
        ) : khoView === 'card' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visStores.map(s => (
              <StoreCard key={s.id} s={s} clipCount={clipsOf(s.id).length} thumb={null} progress={progressOf(s.id, s.source_status)} me={me} canAddMedia={canAddMedia} canEdit={canEdit}
                onClips={() => setClipsModal({ store: s, clips: clipsOf(s.id) })} onViewSource={() => openSource(s)}
                onEditSource={() => setEditSource(s)} onLink={() => setLinkFor(s)} onBuild={() => setBuildFor(s)} onScore={() => setScoreFor(s)} onRescan={() => rescanStore(s)} onDelete={() => delStore(s)} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
            {visStores.map(s => (
              <StoreRow key={s.id} s={s} clipCount={clipsOf(s.id).length} me={me} canAddMedia={canAddMedia} canEdit={canEdit}
                onClips={() => setClipsModal({ store: s, clips: clipsOf(s.id) })} onViewSource={() => openSource(s)}
                onEditSource={() => setEditSource(s)} onLink={() => setLinkFor(s)} onBuild={() => setBuildFor(s)} onScore={() => setScoreFor(s)} onRescan={() => rescanStore(s)} onDelete={() => delStore(s)} />
            ))}
          </div>
        )
      ) : (
        <>
          {(canAds || isManager) && <FbSummaryStrip clips={clips} onReport={setActiveTab ? () => setActiveTab('ads_report') : null} />}
          {/* Sub-tab trạng thái — thiết kế nổi bật, "Đang chạy" có hiệu ứng live */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 p-1.5 bg-gradient-to-r from-slate-100 to-slate-50 rounded-2xl border border-slate-200/70 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { k: 'all', label: 'Tất cả', Icon: LayoutGrid, n: reviewClips.length, c: 'teal' },
                { k: 'running', label: 'Đang chạy', Icon: PlayCircle, n: videoCounts.running, c: 'emerald', live: true },
                { k: 'review', label: 'Đang duyệt', Icon: Clock, n: videoCounts.review, c: 'amber' },
                { k: 'off', label: 'Đã tắt', Icon: PauseCircle, n: videoCounts.off, c: 'slate' },
                { k: 'pending', label: 'Chờ duyệt', Icon: Clapperboard, n: videoCounts.pending, c: 'violet' },
              ].map(({ k, label, Icon, n, c, live }) => {
                const active = videoTab === k;
                const grad = { teal: 'from-teal-500 to-cyan-500', emerald: 'from-emerald-500 to-green-500', amber: 'from-amber-500 to-orange-500', slate: 'from-slate-500 to-slate-600', violet: 'from-violet-500 to-purple-500' }[c];
                const iconCol = { teal: 'text-teal-500', emerald: 'text-emerald-500', amber: 'text-amber-500', slate: 'text-slate-500', violet: 'text-violet-500' }[c];
                const inactive = live
                  ? 'bg-white text-emerald-600 ring-1 ring-emerald-200 shadow-sm hover:ring-emerald-300'
                  : 'bg-white text-slate-500 shadow-sm hover:text-slate-700 hover:shadow';
                return (
                  <button key={k} onClick={() => setVideoTab(k)}
                    className={`relative shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-4 h-11 rounded-xl text-sm font-bold transition-all duration-200 ${active ? `bg-gradient-to-r ${grad} text-white shadow-lg ${live ? 'tab-live' : ''}` : inactive}`}>
                    {live && (
                      <span className="relative flex h-2.5 w-2.5">
                        {n > 0 && <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${active ? 'bg-white' : 'bg-emerald-400'}`} />}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? 'bg-white' : 'bg-emerald-500'}`} />
                      </span>
                    )}
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : iconCol}`} />
                    {label}
                    <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {canAds && <button onClick={() => setWinModal(true)} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"><Trophy className="w-4 h-4 text-amber-500" />Định nghĩa Win</button>}
              {canAds && <button onClick={syncAllFb} disabled={syncingAll} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60">{syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}Cập nhật chỉ số FB</button>}
            </div>
          </div>
          {winRule && winRule.win_phones > 0 && (
            <div className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
              <Trophy className="w-3.5 h-3.5 text-amber-500 inline align-[-2px] mr-1" />
              Định nghĩa Win: chi <b>{fmtM(winRule.win_budget)}</b> ra <b>{winRule.win_phones} SĐT</b> (CPA ≤ <b>{fmtM(Math.round(winRule.win_budget / winRule.win_phones))}</b>/SĐT) → tự chấm.
            </div>
          )}
          {reviewClips.length === 0 ? (
          <Empty icon={PlayCircle} title="Chưa có clip nào" desc="Editor dựng clip từ Kho media; clip sẽ hiện ở đây để Ads duyệt & chấm Win." />
        ) : videoView === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {reviewClips.map(c => {
              const st = storeOf(c.media_customer_id);
              const thumb = (c.thumb_links || [])[0];
              const vd = clipVerdict(c, winRule);
              const sc = vd.potential ? { label: vd.tier.text, cls: vd.tier.cls } : scoreCat(c.score, c.win);
              return (
                <button key={c.id} onClick={() => setVideoFor(c)} className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 text-left">
                  {thumb ? <img src={thumbSrc(thumb)} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="absolute inset-0 grid place-items-center text-white/70"><PlayCircle className="w-8 h-8" /></span>}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                    <span className="block text-white text-[11px] font-semibold truncate">{st?.customer_name || c.title || 'Clip'}</span>
                  </span>
                  <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${sc.cls}`}>{sc.label}</span>
                  {c.approved_to_run && <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">RUN</span>}
                  {(st?.no_image || st?.hide_face) && <span className="absolute bottom-1.5 right-1.5 text-white bg-rose-600 rounded-full p-1"><Ban className="w-3 h-3" /></span>}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center transition"><Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 fill-current" /></span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {reviewClips.map(c => (
              <ClipReviewCard key={c.id} c={c} store={storeOf(c.media_customer_id)} me={me} isAdmin={isAdmin} canAds={canAds} winRule={winRule} editorAvg={editorAvg(c.editor_id)}
                onReview={() => setReviewFor(c)} onEdit={() => setEditClip(c)} onDelete={() => delClip(c.id)} onView={() => setVideoFor(c)} onApproveRun={() => setApproveFor(c)} onSyncFb={syncFbClip} onRemoveFb={removeFbCampaign} onPostNow={markPostNow} />
            ))}
          </div>
        )}
        </>
      )}

      {addOpen && <AddMediaModal me={me} stores={stores} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); loadData(); }} />}
      {autoImportOpen && <AutoImportModal me={me} stores={stores} onClose={() => setAutoImportOpen(false)} onSaved={() => { setAutoImportOpen(false); loadData(); }} />}
      {approveFor && <ApproveModal clip={approveFor} store={storeOf(approveFor.media_customer_id)} onClose={() => setApproveFor(null)} onConfirm={(postNow) => doApprove(approveFor, postNow)} />}
      {addVideoOpen && <AddVideoModal me={me} onClose={() => setAddVideoOpen(false)} onSaved={() => { setAddVideoOpen(false); loadData(); }} />}
      {editSource && <SourceModal store={editSource} onClose={() => setEditSource(null)} onSaved={() => { setEditSource(null); loadData(); }} />}
      {linkFor && <LinkCustomerModal store={linkFor} onClose={() => setLinkFor(null)} onSaved={() => { setLinkFor(null); loadData(); }} />}
      {buildFor && <BuildClipModal store={buildFor} me={me} onClose={() => setBuildFor(null)} onSaved={() => { setBuildFor(null); loadData(); }} />}
      {editClip && <BuildClipModal clip={editClip} store={storeOf(editClip.media_customer_id)} me={me} onClose={() => setEditClip(null)} onSaved={() => { setEditClip(null); loadData(); }} />}
      {scoreFor && <SourceScoreModal store={scoreFor} onClose={() => setScoreFor(null)} onSaved={() => { setScoreFor(null); loadData(); }} />}
      {reviewFor && <ReviewClipModal clip={reviewFor} store={storeOf(reviewFor.media_customer_id)} me={me} onClose={() => setReviewFor(null)}
        onSaved={async (payload) => { await patchClip(reviewFor.id, payload, payload.approved_to_run ? 'Đã duyệt cho chạy Ads' : 'Đã gửi lại editor để sửa'); setReviewFor(null); }} />}
      {winModal && <WinRuleModal rule={winRule} onClose={() => setWinModal(false)} onSave={saveWinRule} />}
      {videoFor && <VideoModal clip={videoFor} me={me} canScore={canAds} onScore={() => { setReviewFor(videoFor); setVideoFor(null); }} onClose={() => setVideoFor(null)} />}
      {sourceFor && <VideoModal clip={{ clip_links: sourceFor.source_links }} title={`Xem source — ${sourceFor.customer_name || ''}`} onClose={() => setSourceFor(null)} />}
      {confirmState && <ConfirmDialog {...confirmState} onClose={() => setConfirmState(null)} />}
      <ImageLightbox />
      {clipsModal && (
        <Modal title={`Video đã dựng — ${clipsModal.store.customer_name || ''}`} onClose={() => setClipsModal(null)}>
          {clipsModal.clips.length === 0 ? <p className="text-sm text-slate-400">Chưa có video nào.</p> : (
            <div className="space-y-2">
              {clipsModal.clips.map(c => { const cat = scoreCat(c.score, c.win); return (
                <div key={c.id} className="bg-slate-50 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-700 text-sm truncate">{c.title || '(Chưa đặt tiêu đề)'}</div>
                    <div className="text-[11px] text-slate-400">{c.editor?.full_name || '—'} · {STAGE[c.stage]?.label || c.stage}{(c.win || c.score > 0) ? ` · ${c.win ? 10 : c.score}/10 ${cat.label}` : ''}</div>
                  </div>
                  {(c.clip_links || []).length > 0 && <button onClick={() => { setVideoFor(c); setClipsModal(null); }} className="shrink-0 text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 inline-flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" /> Xem</button>}
                </div>); })}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${active ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

// Thẻ điều hướng lớn (Kho media / Video Ads / Chi phí Ads)
const FEAT_TONE = {
  teal:   { bg: 'bg-teal-50',   icon: 'bg-teal-500',   blob: 'bg-teal-200/50' },
  violet: { bg: 'bg-violet-50', icon: 'bg-violet-500', blob: 'bg-violet-200/50' },
  amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-500',  blob: 'bg-amber-200/50' },
  fuchsia:{ bg: 'bg-fuchsia-50', icon: 'bg-fuchsia-500', blob: 'bg-fuchsia-200/50' },
};
const FeatureCard = ({ tone, icon: Icon, title, sub, active, onClick }) => {
  const t = FEAT_TONE[tone];
  return (
    <button onClick={onClick} className={`relative overflow-hidden rounded-3xl p-3.5 text-left min-h-[124px] flex flex-col transition ${t.bg} ${active ? 'ring-2 ring-offset-1 ring-teal-500' : 'active:scale-[0.98]'}`}>
      <span className={`absolute -right-4 -bottom-3 w-20 h-20 rounded-full ${t.blob}`} />
      <span className={`relative w-12 h-12 rounded-2xl grid place-items-center text-white shadow-sm ${t.icon}`}><Icon className="w-6 h-6" /></span>
      <span className="relative mt-auto pt-5 block">
        <span className="block font-extrabold text-slate-800 text-[15px] leading-tight">{title}</span>
        <span className="block text-xs text-slate-500 font-medium mt-0.5">{sub}</span>
      </span>
    </button>
  );
};

const Empty = ({ icon: Icon, title, desc, cta }) => (
  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
    <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
    <p className="text-slate-600 font-semibold">{title}</p>
    <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto leading-relaxed">{desc}</p>
    {cta && <button onClick={cta.onClick} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700"><Plus className="w-4 h-4" /> {cta.label}</button>}
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
      <button type="button" onClick={() => viewImage(url)} title="Xem ảnh" className="block">
        <img src={thumbSrc(url)} onError={() => setErr(true)} loading="lazy" alt="thumbnail" className={`${size} object-cover rounded-md border border-slate-200 cursor-zoom-in`} />
      </button>
      {download && (
        <button type="button" onClick={() => downloadFile(url, `thumb-${idx + 1}.jpg`)} title="Tải ảnh về"
          className="absolute bottom-1 right-1 bg-white/90 hover:bg-white text-slate-700 rounded-lg p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );
};

// ---------- Lightbox xem ảnh ----------
const ImageLightbox = () => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const open = (e) => setUrl(e.detail);
    const esc = (e) => { if (e.key === 'Escape') setUrl(null); };
    window.addEventListener('ads-view-image', open);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('ads-view-image', open); window.removeEventListener('keydown', esc); };
  }, []);
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => setUrl(null)}>
      <button onClick={() => setUrl(null)} className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-7 h-7" /></button>
      <button onClick={(e) => { e.stopPropagation(); downloadFile(url, 'thumbnail.jpg'); }} title="Tải ảnh" className="absolute top-4 right-16 text-white/80 hover:text-white"><Download className="w-6 h-6" /></button>
      <img src={url} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl" />
    </div>
  );
};

// ---------- Hộp thoại xác nhận (thay confirm mặc định) ----------
const ConfirmDialog = ({ message, okLabel = 'Xác nhận', danger = false, onOk, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-[55] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="p-5 flex gap-3">
        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${danger ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}><AlertTriangle className="w-5 h-5" /></div>
        <p className="text-sm text-slate-700 leading-relaxed pt-1.5">{message}</p>
      </div>
      <div className="px-4 py-3 bg-slate-50 border-t flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-white text-sm">Hủy</button>
        <button onClick={() => { onOk(); onClose(); }} className={`px-5 py-2 rounded-xl text-white font-semibold text-sm ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'}`}>{okLabel}</button>
      </div>
    </div>
  </div>
);

// ---------- Menu hành động phụ "⋯" (gọn, tránh rối) ----------
const ActionMenu = ({ items, vertical = false }) => {
  const list = items.filter(Boolean);
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const Icon = vertical ? MoreVertical : MoreHorizontal;
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Thêm">
        <Icon className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[160px] overflow-hidden">
            {list.map((it, i) => (
              <button key={i} type="button" onClick={() => { setOpen(false); it.onClick(); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-slate-50 ${it.danger ? 'text-rose-600' : 'text-slate-700'}`}>
                {it.icon}{it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ---------- Chọn / hiển thị checklist loại source (Feature #5) ----------
const SourceTypePicker = ({ value = [], onChange }) => (
  <div className="flex flex-wrap gap-2">
    {SOURCE_CHECKLIST.map(t => {
      const on = (value || []).includes(t.key);
      return (
        <button type="button" key={t.key}
          onClick={() => onChange(on ? value.filter(x => x !== t.key) : [...(value || []), t.key])}
          className={`px-3.5 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-1.5 transition ${on ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
          {on ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}{t.label}
        </button>
      );
    })}
  </div>
);

const SourceTypeBadges = ({ types = [], showMissing = true }) => {
  const present = SOURCE_CHECKLIST.filter(t => (types || []).includes(t.key));
  const missing = SOURCE_CHECKLIST.filter(t => !(types || []).includes(t.key));
  if (present.length === 0 && !showMissing) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {present.map(t => (
        <span key={t.key} className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />{t.label}
        </span>
      ))}
      {showMissing && missing.map(t => (
        <span key={t.key} className="text-[11px] font-medium bg-slate-50 text-slate-400 px-2 py-0.5 rounded-md inline-flex items-center gap-1 border border-dashed border-slate-200">
          <Circle className="w-2.5 h-2.5" />{t.label}
        </span>
      ))}
    </div>
  );
};

// Cảnh báo quyền dùng source (Media set; Designer/Editor thấy)
const PermissionBadges = ({ s, size = 'md' }) => {
  if (!s?.no_image && !s?.hide_face) return null;
  const cls = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1';
  return (
    <div className="flex flex-wrap gap-1.5">
      {s.no_image && <span className={`font-bold bg-rose-100 text-rose-700 rounded-md inline-flex items-center gap-1 ${cls}`}><Ban className="w-3 h-3" />KHÔNG DÙNG HÌNH ẢNH</span>}
      {s.hide_face && <span className={`font-bold bg-amber-100 text-amber-800 rounded-md inline-flex items-center gap-1 ${cls}`}><EyeOff className="w-3 h-3" />CHE MẶT</span>}
    </div>
  );
};

// Nhập nhãn (tag) tự do
const TagInput = ({ value = [], onChange }) => {
  const [text, setText] = useState('');
  const add = () => { const t = text.trim(); if (t && !value.includes(t)) onChange([...value, t]); setText(''); };
  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(t => (
            <span key={t} className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
              {t}<button type="button" onClick={() => onChange(value.filter(x => x !== t))} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add}
        placeholder="Nhập nhãn rồi Enter (vd: gấp, VIP, chờ feedback)" className={inpCls} />
    </div>
  );
};
const TagChips = ({ tags = [] }) => (tags || []).length === 0 ? null : (
  <div className="flex flex-wrap gap-1">
    {tags.map(t => <span key={t} className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">#{t}</span>)}
  </div>
);

// Hiện đúng TÊN các thư mục con đọc được trong link Drive
const FolderChips = ({ folders = [], max = 12 }) => {
  const list = folders || [];
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, max).map((f, i) => (
        <span key={i} className="text-[11px] font-medium bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1 max-w-[160px]">
          <FolderOpen className="w-3 h-3 shrink-0" /><span className="truncate">{f}</span>
        </span>
      ))}
      {list.length > max && <span className="text-[11px] text-slate-400 px-1">+{list.length - max}</span>}
    </div>
  );
};

// ---------- Bảng hiệu quả Facebook Ads (Feature #1) ----------
const FbAdsPanel = () => {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('last_30d');
  const [sortBy, setSortBy] = useState('messages'); // messages | leads | cpa | spend
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState(null);
  const [err, setErr] = useState('');

  const sync = async () => {
    setLoading(true); setErr('');
    try {
      const { data, error } = await supabase.functions.invoke('fb-ads-insights', { body: { date_preset: preset } });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Không lấy được dữ liệu');
      setAds(data.ads || []);
      if (!data.ads?.length) toast('Không có ad nào trong khoảng thời gian này', { icon: 'ℹ️' });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const sorted = (ads || []).slice().sort((a, b) => {
    if (sortBy === 'messages') return (b.messages || 0) - (a.messages || 0);
    if (sortBy === 'leads') return (b.leads || 0) - (a.leads || 0);
    if (sortBy === 'cpa') return (a.cpa ?? 1e15) - (b.cpa ?? 1e15);
    return (b.spend || 0) - (a.spend || 0);
  });
  const totSpend = (ads || []).reduce((s, a) => s + (a.spend || 0), 0);
  const totMsg = (ads || []).reduce((s, a) => s + (a.messages || 0), 0);
  const totLead = (ads || []).reduce((s, a) => s + (a.leads || 0), 0);
  const totRes = totMsg + totLead;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
        <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><BarChart2 className="w-5 h-5" /></span>
        <div className="flex-1 text-left">
          <div className="font-bold text-slate-800">Hiệu quả Facebook Ads</div>
          <div className="text-xs text-slate-400">Clip nào “đẻ tiền” — chi phí, lead, CPA từ tài khoản Ads</div>
        </div>
        <ChevronRight className={`w-5 h-5 text-slate-300 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-50 pt-3">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select value={preset} onChange={e => setPreset(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400">
              <option value="today">Hôm nay</option>
              <option value="last_7d">7 ngày</option>
              <option value="last_30d">30 ngày</option>
              <option value="last_90d">90 ngày</option>
              <option value="this_month">Tháng này</option>
            </select>
            <button onClick={sync} disabled={loading} className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Đồng bộ số liệu
            </button>
            {ads && ads.length > 0 && (
              <div className="ml-auto flex items-center gap-1 text-xs">
                <span className="text-slate-400 mr-1">Sắp xếp:</span>
                {[['messages', 'Nhắn tin'], ['leads', 'Lead'], ['cpa', 'CPA rẻ'], ['spend', 'Chi nhiều']].map(([k, l]) => (
                  <button key={k} onClick={() => setSortBy(k)} className={`px-2.5 py-1 rounded-lg font-semibold ${sortBy === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
                ))}
              </div>
            )}
          </div>

          {err && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              {err}
              <div className="text-amber-600 mt-1">Cần cấu hình <b>FB_ADS_TOKEN</b> + <b>FB_AD_ACCOUNT_ID</b> và deploy function <b>fb-ads-insights</b>.</div>
            </div>
          )}

          {ads && ads.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <div className="bg-slate-50 rounded-xl p-3"><div className="text-lg font-bold text-slate-800">{fmtM(totSpend)}</div><div className="text-[11px] text-slate-400">Tổng chi</div></div>
                <div className="bg-blue-50 rounded-xl p-3"><div className="text-lg font-bold text-blue-700">{totMsg}</div><div className="text-[11px] text-slate-400">Lượt nhắn tin</div></div>
                <div className="bg-teal-50 rounded-xl p-3"><div className="text-lg font-bold text-teal-700">{totLead}</div><div className="text-[11px] text-slate-400">Lead xin được</div></div>
                <div className="bg-amber-50 rounded-xl p-3"><div className="text-lg font-bold text-amber-700">{totRes ? fmtM(Math.round(totSpend / totRes)) : '—'}</div><div className="text-[11px] text-slate-400">Chi phí / kết quả</div></div>
              </div>
              <div className="space-y-2">
                {sorted.map((a, i) => (
                  <div key={a.ad_id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
                    <span className={`w-6 text-center font-bold ${i < 3 ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 text-sm truncate">{a.ad_name || a.ad_id}</div>
                      <div className="text-[11px] text-slate-400 truncate">{a.campaign_name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-800">💬 {a.messages} · 📩 {a.leads}</div>
                      <div className="text-[11px] text-slate-400">CPA {a.cpa != null ? fmtM(a.cpa) : '—'} · chi {fmtM(a.spend)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Hàng Kho media (danh sách) ----------
const StoreRow = ({ s, clipCount, me, canAddMedia, canEdit, onClips, onViewSource, onEditSource, onLink, onBuild, onScore, onRescan, onDelete }) => {
  const owner = canAddMedia || s.media_id === me?.id;
  return (
    <div className={`p-3 flex flex-col lg:flex-row lg:items-center gap-3 ${s.no_image ? 'bg-rose-50 hover:bg-rose-100' : s.hide_face ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50/60'}`}>
      <div className="min-w-0 lg:w-60 shrink-0">
        <div className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
          <span className="truncate">{s.customer_name || 'Khách chưa đặt tên'}</span>
          {s.appointment_id
            ? <span className="shrink-0 text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">LK</span>
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
        <PermissionBadges s={s} size="sm" />
        <FolderChips folders={s.source_folders} max={6} />
        {(s.source_video_count > 0 || s.source_image_count > 0) && (
          <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-violet-600"><Film className="w-3 h-3" />{s.source_video_count}</span>
            <span className="inline-flex items-center gap-0.5 text-teal-600"><Image className="w-3 h-3" />{s.source_image_count}</span>
          </span>
        )}
        <button onClick={onClips} disabled={!clipCount} className="text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-1 rounded-lg hover:bg-violet-100 disabled:opacity-60 disabled:cursor-default">{clipCount} clip{clipCount ? ' ▸' : ''}</button>
        {clipCount === 0 && staleAgeDays(s) >= 14 && <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-lg inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Tồn {staleAgeDays(s)}n</span>}
        {s.source_score != null && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">★ {s.source_score}/10</span>}
        {s.source_feedback && <span className="text-[11px] text-slate-500 italic truncate max-w-[200px]" title={s.source_feedback}>“{s.source_feedback}”</span>}
        {s.updated_at && <span className="text-[11px] text-slate-300 ml-auto">{new Date(s.updated_at).toLocaleDateString('vi-VN')}</span>}
      </div>

      <div className="flex items-center gap-1.5 lg:justify-end shrink-0">
        {canEdit
          ? <button onClick={onBuild} className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 inline-flex items-center gap-1"><Scissors className="w-3.5 h-3.5" />Dựng video</button>
          : (s.source_links || []).length > 0 && <button onClick={onViewSource} className="text-xs font-bold text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50 inline-flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" />Xem source</button>}
        {canEdit && (s.source_links || []).length > 0 && <button onClick={onViewSource} className="text-xs font-semibold text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" />Source</button>}
        <ActionMenu items={[
          canEdit && { label: 'Chấm / Góp ý source', icon: <Star className="w-4 h-4" />, onClick: onScore },
          owner && { label: 'Sửa nguồn', icon: <Pencil className="w-4 h-4" />, onClick: onEditSource },
          (owner && (s.source_links || []).length > 0) && { label: 'Soi lại Drive (tự nhận diện source)', icon: <Search className="w-4 h-4" />, onClick: onRescan },
          (!s.appointment_id && owner) && { label: 'Kết nối hồ sơ khách', icon: <Link2 className="w-4 h-4" />, onClick: onLink },
          owner && { label: 'Xoá media', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, danger: true },
        ]} />
      </div>
    </div>
  );
};

// ---------- Thẻ Kho media (chế độ thẻ) ----------
const StoreCard = ({ s, clipCount, thumb, progress = 0, me, canAddMedia, canEdit, onClips, onViewSource, onEditSource, onLink, onBuild, onScore, onRescan, onDelete }) => {
  const owner = canAddMedia || s.media_id === me?.id;
  const ss = SOURCE_STATUS[s.source_status || 'chua_dung'] || { label: s.source_status, cls: 'bg-slate-100 text-slate-600' };
  const hasSrc = (s.source_links || []).length > 0;
  const permTone = s.no_image ? 'bg-rose-50 border-rose-300' : s.hide_face ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-100';
  const menuItems = [
    canEdit && { label: 'Chấm / Góp ý source', icon: <Star className="w-4 h-4" />, onClick: onScore },
    owner && { label: 'Sửa nguồn', icon: <Pencil className="w-4 h-4" />, onClick: onEditSource },
    (owner && hasSrc) && { label: 'Soi lại Drive (tự nhận diện source)', icon: <Search className="w-4 h-4" />, onClick: onRescan },
    (!s.appointment_id && owner) && { label: 'Kết nối hồ sơ khách', icon: <Link2 className="w-4 h-4" />, onClick: onLink },
    owner && { label: 'Xoá media', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, danger: true },
  ];
  return (
    <div className={`rounded-2xl border shadow-sm p-3.5 ${permTone}`}>
      <div className="flex gap-3">
        {/* Thumbnail */}
        <button onClick={hasSrc ? onViewSource : (canEdit ? onBuild : undefined)} className="relative w-[104px] h-[104px] rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-teal-300 to-teal-600">
          {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
          <span className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-white/85 grid place-items-center text-slate-800"><Play className="w-4 h-4 fill-current ml-0.5" /></span>
        </button>
        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-[15px] leading-tight truncate">{s.customer_name || 'Khách chưa đặt tên'}</div>
              <div className="text-xs text-slate-400 truncate mt-0.5">{s.customer_phone}{s.media?.full_name ? ` · ${s.media.full_name}` : ''}</div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {s.appointment_id
                ? <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">LK</span>
                : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Chưa LK</span>}
              <ActionMenu vertical items={menuItems} />
            </div>
          </div>
          {s.source_id && <div className="font-mono text-violet-600 text-xs font-bold mt-1.5">#{s.source_id}</div>}
          {s.service && <div className="text-[13px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{s.service}</div>}
          {s.shoot_date && <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mt-1.5"><CalendarDays className="w-3.5 h-3.5" />{new Date(s.shoot_date).toLocaleDateString('vi-VN')}</div>}
          <div className="mt-2"><PermissionBadges s={s} /></div>
          {(s.tags || []).length > 0 && <div className="mt-2"><TagChips tags={s.tags} /></div>}
          <div className="mt-2"><FolderChips folders={s.source_folders} /></div>
          {(s.source_video_count > 0 || s.source_image_count > 0) && (
            <div className="flex items-center gap-3 mt-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 text-violet-600"><Film className="w-3.5 h-3.5" />{s.source_video_count} video</span>
              <span className="inline-flex items-center gap-1 text-teal-600"><Image className="w-3.5 h-3.5" />{s.source_image_count} ảnh</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {hasSrc && <button onClick={onViewSource} className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full inline-flex items-center gap-1 hover:bg-blue-100">Nguồn <ExternalLink className="w-3 h-3" /></button>}
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${ss.cls}`}>{ss.label}</span>
            <button onClick={onClips} disabled={!clipCount} className="text-[11px] font-semibold bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full hover:bg-violet-100 disabled:opacity-60">{clipCount} clip</button>
            {s.source_score != null && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">★ {s.source_score}/10</span>}
            {clipCount === 0 && staleAgeDays(s) >= 14 && <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Tồn {staleAgeDays(s)}n</span>}
          </div>
        </div>
      </div>
      {s.source_feedback && <div className="text-[11px] text-slate-500 italic mt-2 truncate" title={s.source_feedback}>“{s.source_feedback}”</div>}
      {progress > 0 && progress < 100 && (
        <div className="flex items-center gap-2.5 mt-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${progress}%` }} /></div>
          <span className="text-xs font-bold text-slate-600 tabular-nums">{progress}%</span>
        </div>
      )}
      {(canEdit || hasSrc) && (
        <div className="mt-3 flex items-center gap-2">
          {canEdit
            ? <button onClick={onBuild} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-50 text-teal-700 font-bold text-sm hover:bg-teal-100"><Scissors className="w-4 h-4" />{clipCount > 0 ? 'Tiếp tục dựng' : 'Dựng video'}</button>
            : hasSrc && <button onClick={onViewSource} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 text-violet-700 font-bold text-sm hover:bg-violet-100"><PlayCircle className="w-4 h-4" />Xem source</button>}
          {canEdit && hasSrc && <button onClick={onViewSource} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"><PlayCircle className="w-4 h-4" />Source</button>}
        </div>
      )}
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

// ---------- Panel "Việc cần xử lý" (dùng lại ở nhiều nơi) ----------
const TODO_TONE = { teal: 'text-teal-600', rose: 'text-rose-600', violet: 'text-violet-600', amber: 'text-amber-600' };
const TODO_DOT = { teal: 'bg-teal-500', rose: 'bg-rose-500', violet: 'bg-violet-500', amber: 'bg-amber-500' };
const TodoPanel = ({ tiles, compact }) => {
  if (!tiles.length) {
    return compact ? (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Việc cần xử lý</h3>
        <p className="text-sm text-slate-400 py-4 text-center">Không có việc tồn đọng 🎉</p>
      </div>
    ) : null;
  }
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 shadow-sm p-4 ring-1 ring-amber-200/50">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-9 h-9 rounded-xl bg-amber-500 text-white grid place-items-center shadow-sm shrink-0"><AlertTriangle className="w-5 h-5" /></span>
        <div className="min-w-0">
          <div className="text-base font-extrabold text-slate-800 leading-tight">Việc cần xử lý</div>
          <div className="text-[11px] font-medium text-amber-700/80">Bấm vào ô để mở danh sách đã lọc sẵn</div>
        </div>
      </div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {tiles.map((t, i) => (
          <button key={i} onClick={t.onClick} className="text-left rounded-xl p-3 bg-white border border-amber-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
            <div className="flex items-center justify-between">
              <span className={`w-8 h-8 rounded-lg grid place-items-center bg-slate-50 ${TODO_TONE[t.tone]}`}><t.icon className="w-4 h-4" /></span>
              <span className={`text-2xl font-extrabold tabular-nums ${TODO_TONE[t.tone]}`}>{t.n}</span>
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1.5 flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${TODO_DOT[t.tone]}`} />{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------- Trang Tổng quan Marketing (dashboard) ----------
const AdsOverview = ({ clips, stores, storeOf, now, videoCounts, todoTiles, lb, onOpenClip, onGoVideo }) => {
  const approved = clips.filter(c => c.approved_to_run);
  const winCount = clips.filter(c => c.win).length;
  const winRate = approved.length ? Math.round(winCount / approved.length * 100) : 0;
  const recent = [...clips].sort((a, b) => new Date(b.fb_synced_at || b.submitted_at || b.created_at || 0) - new Date(a.fb_synced_at || a.submitted_at || a.created_at || 0)).slice(0, 6);
  const topPhones = clips.filter(c => phonesOf(c) > 0).sort((a, b) => phonesOf(b) - phonesOf(a)).slice(0, 5);
  const maxP = (topPhones[0] ? phonesOf(topPhones[0]) : 0) || 1;
  // Chỉ số Kho media
  const sourcesN = stores.filter(s => (s.source_links || []).length > 0).length;
  const totalVideo = stores.reduce((s, x) => s + (Number(x.source_video_count) || 0), 0);
  const totalImage = stores.reduce((s, x) => s + (Number(x.source_image_count) || 0), 0);
  const undoneSrc = stores.filter(s => (s.source_links || []).length > 0 && !clips.some(c => c.media_customer_id === s.id)).length;
  const segs = [
    { key: 'pending', label: 'Chờ duyệt', n: videoCounts.pending, color: '#8b5cf6' },
    { key: 'running', label: 'Đang chạy', n: videoCounts.running, color: '#10b981' },
    { key: 'review', label: 'Đang duyệt', n: videoCounts.review, color: '#f59e0b' },
    { key: 'off', label: 'Đã tắt', n: videoCounts.off, color: '#94a3b8' },
  ];
  const segTotal = segs.reduce((s, x) => s + x.n, 0);
  let acc = 0;
  const gradient = segTotal > 0
    ? 'conic-gradient(' + segs.filter(s => s.n > 0).map(s => { const a = acc; acc += s.n; return `${s.color} ${(a / segTotal * 360)}deg ${(acc / segTotal * 360)}deg`; }).join(', ') + ')'
    : '#e2e8f0';
  const KT = { teal: 'bg-teal-50 text-teal-600', violet: 'bg-violet-50 text-violet-600', blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600', amber: 'bg-amber-50 text-amber-600' };
  const kpis = [
    { icon: PlayCircle, tone: 'teal', spark: '#14b8a6', value: approved.length, label: 'Video Ads', sub: 'clip đã duyệt' },
    { icon: Clock, tone: 'violet', spark: '#8b5cf6', value: videoCounts.pending, label: 'Clip chờ duyệt', sub: 'clip' },
    { icon: FolderOpen, tone: 'blue', spark: '#3b82f6', value: sourcesN, label: 'Nguồn media', sub: 'nguồn trong kho' },
    { icon: Film, tone: 'indigo', spark: '#6366f1', value: totalVideo, label: 'Video gốc', sub: 'video trong kho' },
    { icon: Image, tone: 'amber', spark: '#f59e0b', value: totalImage, label: 'Ảnh gốc', sub: 'ảnh trong kho' },
  ];
  const insights = [
    { icon: Trophy, cls: 'bg-amber-50 text-amber-600', text: winRate > 0 ? `${winRate}% clip đã duyệt đạt Win — hiệu quả đang cải thiện.` : 'Chưa có clip đạt Win tháng này — cần tối ưu nội dung.' },
    { icon: Clock, cls: 'bg-violet-50 text-violet-600', text: videoCounts.pending === 0 ? '0 clip chờ duyệt. Quy trình đang vận hành trơn tru.' : `${videoCounts.pending} clip đang chờ Ads duyệt — nên xử lý sớm.` },
    { icon: FolderOpen, cls: 'bg-teal-50 text-teal-600', text: undoneSrc > 0 ? `${undoneSrc} nguồn media mới chưa dựng — cần editor xử lý.` : 'Tất cả nguồn media đã được dựng clip.' },
  ];
  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2.5">
              <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${KT[k.tone]}`}><k.icon className="w-5 h-5" /></span>
              <span className="text-[13px] font-semibold text-slate-500 leading-tight">{k.label}</span>
            </div>
            <div className="text-[26px] font-extrabold text-slate-800 mt-2 tabular-nums leading-none">{k.value}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-slate-400">{k.sub}</span>
              <Sparkline color={k.spark} />
            </div>
          </div>
        ))}
      </div>

      {/* Hiệu suất video gần đây (bảng) + Top clip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Film className="w-4 h-4 text-teal-500" />Hiệu suất video gần đây</h3>
            <button onClick={onGoVideo} className="text-xs font-semibold text-teal-600 hover:underline">Xem tất cả →</button>
          </div>
          {recent.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Chưa có clip nào</p> : (
            <div className="divide-y divide-slate-50">
              {recent.map(c => {
                const st = storeOf(c.media_customer_id); const thumb = (c.thumb_links || [])[0];
                const eff = c.approved_to_run && c.stage === 'submitted' ? 'done' : c.stage; const fb = fbStatusInfo(c.fb_status);
                const badge = fb || { label: STAGE[eff]?.label || eff, cls: STAGE[eff]?.cls || 'bg-slate-100 text-slate-500' };
                const d = c.fb_synced_at || c.submitted_at || c.created_at;
                return (
                  <button key={c.id} onClick={() => onOpenClip(c)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 rounded-lg px-1 -mx-1">
                    <span className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 grid place-items-center shrink-0">{thumb ? <img src={thumbSrc(thumb)} alt="" className="w-full h-full object-cover" /> : <PlayCircle className="w-4 h-4 text-white/60" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-700 truncate">{c.title || st?.customer_name || 'Clip'}</span>
                      <span className="block text-[11px] text-slate-400 truncate">{st?.customer_name || '—'}</span>
                    </span>
                    <span className="shrink-0 flex flex-col items-end gap-0.5">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">{d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" />Top clip theo số điện thoại</h3>
            <span className="text-[11px] text-slate-400 border border-slate-200 rounded-lg px-2 py-1">2 tháng gần nhất</span>
          </div>
          <div className="space-y-3">
            {topPhones.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Chưa có dữ liệu SĐT</p>}
            {topPhones.map((c, idx) => {
              const st = storeOf(c.media_customer_id); const pct = Math.round(phonesOf(c) / maxP * 100);
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-white' : idx === 2 ? 'bg-orange-200 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[13px] mb-1"><span className="font-medium text-slate-600 truncate pr-2">{c.title || st?.customer_name || 'Clip'}</span><span className="font-bold text-teal-600 shrink-0">{phonesOf(c)} SĐT</span></div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600" style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-50 text-[11px] text-teal-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500" />Số điện thoại thu được</div>
        </div>
      </div>

      {/* Row 3: Việc cần xử lý + Bảng điểm + Donut + Insight */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <TodoPanel tiles={todoTiles.filter(t => t.n > 0)} compact />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4 text-amber-500" />Bảng điểm Editor tháng {now.getMonth() + 1}</h3>
          <div className="space-y-2.5 flex-1">
            {lb.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Chưa có dữ liệu</p>}
            {lb.slice(0, 3).map((e, i) => {
              const cat = e.avg == null ? null : scoreCat(e.avg, false);
              return (
                <div key={e.id} className="flex items-center gap-2.5">
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : 'bg-orange-200 text-orange-700'}`}>{i + 1}</span>
                  <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 grid place-items-center text-xs font-bold shrink-0">{(e.name || '?').charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700 truncate">{e.name}</div>
                    <div className="text-[11px] text-slate-400">{e.avg == null ? 'Chưa chấm' : `TB ${e.avg.toFixed(1)}`} · {e.w} Win</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cat ? cat.cls : 'bg-slate-100 text-slate-400'}`}>{e.avg == null ? '—' : e.avg.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
          <button onClick={onGoVideo} className="text-[11px] font-semibold text-teal-600 hover:underline mt-3 text-left">Xem bảng điểm chi tiết →</button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-blue-500" />Phân bổ trạng thái clip</h3>
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-24 h-24 shrink-0 rounded-full" style={{ background: gradient }}>
              <div className="absolute inset-[22%] rounded-full bg-white grid place-items-center"><div className="text-center"><div className="text-lg font-extrabold text-slate-800 leading-none">{segTotal}</div><div className="text-[10px] text-slate-400">clip</div></div></div>
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              {segs.map(s => (
                <div key={s.key} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 text-slate-600 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} /><span className="truncate">{s.label}</span></span>
                  <span className="font-bold text-slate-700 shrink-0">{s.n}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onGoVideo} className="text-[11px] font-semibold text-teal-600 hover:underline mt-3 text-left">Xem chi tiết →</button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-500" />Insight nhanh</h3>
          <div className="space-y-3 flex-1">
            {insights.map((it, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${it.cls}`}><it.icon className="w-4 h-4" /></span>
                <p className="text-[12px] text-slate-600 leading-snug">{it.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ================= KHO TÀI SẢN MEDIA (thư viện file Drive) =================
const MediaVault = ({ assets, storeOf, builtCustomerIds, scanning, onScan, onToggleFav, canAddMedia, onAddMedia, onManageSources }) => {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');       // all | video | image | fav | unused | recent
  const [sort, setSort] = useState('new');     // new | size | name
  const [view, setView] = useState('grid');    // grid | list
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);
  const PER = 16;

  const isUnused = (a) => !builtCustomerIds.has(a.media_customer_id);
  const recentTs = Date.now() - 30 * 86400000;
  const counts = {
    all: assets.length,
    video: assets.filter(a => a.kind === 'video').length,
    image: assets.filter(a => a.kind === 'image').length,
    fav: assets.filter(a => a.favorite).length,
    unused: assets.filter(isUnused).length,
    recent: assets.filter(a => a.scanned_at && new Date(a.scanned_at).getTime() > recentTs).length,
  };
  const totalSize = assets.reduce((s, a) => s + (Number(a.size_bytes) || 0), 0);

  const ql = q.trim().toLowerCase();
  const list = assets.filter(a => {
    if (cat === 'video' && a.kind !== 'video') return false;
    if (cat === 'image' && a.kind !== 'image') return false;
    if (cat === 'fav' && !a.favorite) return false;
    if (cat === 'unused' && !isUnused(a)) return false;
    if (ql) {
      const cust = storeOf(a.media_customer_id)?.customer_name || '';
      if (!((a.name || '').toLowerCase().includes(ql) || cust.toLowerCase().includes(ql) || (a.folder || '').toLowerCase().includes(ql))) return false;
    }
    return true;
  }).sort((x, y) => {
    if (sort === 'size') return (Number(y.size_bytes) || 0) - (Number(x.size_bytes) || 0);
    if (sort === 'name') return (x.name || '').localeCompare(y.name || '');
    return new Date(y.created_time || y.scanned_at || 0) - new Date(x.created_time || x.scanned_at || 0);
  });
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * PER, cur * PER);
  const reset = (fn) => { fn(); setPage(1); };

  const kpis = [
    { icon: Film, tone: 'bg-violet-50 text-violet-600', value: counts.all, label: 'Tổng media', sub: 'file trong kho' },
    { icon: PlayCircle, tone: 'bg-blue-50 text-blue-600', value: counts.video, label: 'Video', sub: counts.all ? `${Math.round(counts.video / counts.all * 100)}% tổng media` : '—' },
    { icon: Image, tone: 'bg-teal-50 text-teal-600', value: counts.image, label: 'Hình ảnh', sub: counts.all ? `${Math.round(counts.image / counts.all * 100)}% tổng media` : '—' },
    { icon: FolderOpen, tone: 'bg-orange-50 text-orange-600', value: fmtSize(totalSize), label: 'Dung lượng', sub: 'đã quét' },
    { icon: Star, tone: 'bg-amber-50 text-amber-600', value: counts.unused, label: 'Chưa khai thác', sub: 'cần dựng clip' },
  ];
  const CATS = [
    ['all', 'Tất cả media', counts.all], ['video', 'Video', counts.video], ['image', 'Hình ảnh', counts.image],
    ['unused', 'Chưa khai thác', counts.unused], ['fav', 'Yêu thích', counts.fav],
  ];
  const chips = [];
  if (cat !== 'all') chips.push({ label: CATS.find(c => c[0] === cat)?.[1] || cat, clear: () => reset(() => setCat('all')) });
  if (ql) chips.push({ label: `Tìm: "${q}"`, clear: () => reset(() => setQ('')) });

  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <span className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-500 grid place-items-center mx-auto mb-3"><FolderOpen className="w-8 h-8" /></span>
        <h3 className="font-bold text-slate-800 text-lg">Kho tài sản còn trống</h3>
        <p className="text-sm text-slate-400 mt-1 mb-4 max-w-md mx-auto">Bấm “Kết nối Drive” để quét toàn bộ video &amp; ảnh trong các nguồn Drive về đây (ảnh thu nhỏ, dung lượng, thư mục).</p>
        <button onClick={onScan} disabled={scanning} className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-60">{scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}Kết nối &amp; quét Drive</button>
        <button onClick={onManageSources} className="block mx-auto mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600">Quản lý nguồn theo khách hàng →</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2.5">
              <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${k.tone}`}><k.icon className="w-5 h-5" /></span>
              <span className="text-[13px] font-semibold text-slate-500 leading-tight">{k.label}</span>
            </div>
            <div className="text-[24px] font-extrabold text-slate-800 mt-2 tabular-nums leading-none">{k.value}</div>
            <div className="text-[11px] text-slate-400 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Cột trái */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-2 mb-1.5">Danh mục nhanh</h4>
            {CATS.map(([k, l, n]) => (
              <button key={k} onClick={() => reset(() => setCat(k))} className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium transition ${cat === k ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span className="inline-flex items-center gap-2">{k === 'video' ? <PlayCircle className="w-4 h-4" /> : k === 'image' ? <Image className="w-4 h-4" /> : k === 'fav' ? <Star className="w-4 h-4" /> : k === 'unused' ? <Star className="w-4 h-4" /> : <Film className="w-4 h-4" />}{l}</span>
                <span className="text-xs text-slate-400">{n}</span>
              </button>
            ))}
          </div>
          {chips.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1 mb-2">Bộ lọc đã chọn</h4>
              <div className="flex flex-col gap-1.5">
                {chips.map((c, i) => (
                  <button key={i} onClick={c.clear} className="flex items-center justify-between gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 hover:bg-slate-100">
                    <span className="truncate">{c.label}</span><X className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  </button>
                ))}
                <button onClick={() => reset(() => { setCat('all'); setQ(''); })} className="text-xs font-semibold text-rose-500 hover:underline text-left px-1 mt-1">Xóa tất cả</button>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input value={q} onChange={e => reset(() => setQ(e.target.value))} placeholder="Tìm theo tên file, khách hàng, thư mục…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white" />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)} className="h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-teal-400">
              <option value="new">Sắp xếp: Mới nhất</option>
              <option value="size">Dung lượng lớn</option>
              <option value="name">Tên A→Z</option>
            </select>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setView('grid')} className={`w-9 h-9 grid place-items-center ${view === 'grid' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setView('list')} className={`w-9 h-9 grid place-items-center ${view === 'list' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}><List className="w-4 h-4" /></button>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm">Không có file khớp bộ lọc.</div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {shown.map(a => {
                const st = storeOf(a.media_customer_id); const dur = fmtDur(a.duration_ms); const thumb = assetThumb(a);
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
                    <button onClick={() => setPreview(a)} className="relative block w-full aspect-video bg-slate-900">
                      {thumb ? <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                      <span className="absolute inset-0 grid place-items-center"><span className="w-10 h-10 rounded-full bg-black/40 grid place-items-center group-hover:bg-black/60 transition">{a.kind === 'video' ? <Play className="w-4 h-4 text-white fill-white ml-0.5" /> : <ZoomIn className="w-4 h-4 text-white" />}</span></span>
                      {dur && <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">{dur}</span>}
                      {a.kind === 'image' && <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><Image className="w-2.5 h-2.5" />Ảnh</span>}
                    </button>
                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-sm font-semibold text-slate-700 truncate">{a.name || 'Không tên'}</div>
                        <button onClick={() => onToggleFav(a)} className="shrink-0 text-slate-300 hover:text-amber-400"><Star className={`w-4 h-4 ${a.favorite ? 'fill-amber-400 text-amber-400' : ''}`} /></button>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{st?.customer_name || '—'}</div>
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {a.folder && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 truncate max-w-[110px]">{a.folder}</span>}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{fmtSize(a.size_bytes)}</span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1">{a.created_time ? new Date(a.created_time).toLocaleDateString('vi-VN') : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
              {shown.map(a => {
                const st = storeOf(a.media_customer_id); const dur = fmtDur(a.duration_ms); const thumb = assetThumb(a);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50">
                    <button onClick={() => setPreview(a)} className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                      {thumb ? <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                      <span className="absolute inset-0 grid place-items-center text-white/70">{a.kind === 'video' ? <Play className="w-4 h-4 fill-white" /> : <Image className="w-4 h-4" />}</span>
                      {dur && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold text-white bg-black/60 px-1 rounded">{dur}</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-700 truncate">{a.name || 'Không tên'}</div>
                      <div className="text-[11px] text-slate-400 truncate">{st?.customer_name || '—'}{a.folder ? ` · ${a.folder}` : ''}</div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">{fmtSize(a.size_bytes)}</span>
                    <button onClick={() => onToggleFav(a)} className="shrink-0 text-slate-300 hover:text-amber-400"><Star className={`w-4 h-4 ${a.favorite ? 'fill-amber-400 text-amber-400' : ''}`} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Phân trang */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur === 1} className="w-8 h-8 grid place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-slate-500 px-2">Trang {cur}/{pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={cur === pages} className="w-8 h-8 grid place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <Modal title={preview.name || 'Xem media'} onClose={() => setPreview(null)}>
          <VideoPreview url={preview.web_link || `https://drive.google.com/file/d/${preview.drive_id}/view`} className="w-full aspect-video" />
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-slate-500">{storeOf(preview.media_customer_id)?.customer_name || ''}{preview.folder ? ` · ${preview.folder}` : ''} · {fmtSize(preview.size_bytes)}</span>
            <a href={preview.web_link || `https://drive.google.com/file/d/${preview.drive_id}/view`} target="_blank" rel="noopener noreferrer" className="text-teal-600 font-semibold inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-4 h-4" />Mở Drive</a>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------- Thanh "Hiệu quả Facebook Ads" (tổng hợp các clip) ----------
const Sparkline = ({ color }) => (
  <svg viewBox="0 0 60 20" className="w-12 h-5 shrink-0" preserveAspectRatio="none">
    <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points="0,16 12,11 24,13 36,6 48,9 60,3" />
  </svg>
);
const FbSummaryStrip = ({ clips, onReport }) => {
  const spend = clips.reduce((s, c) => s + (Number(c.fb_spend) || 0), 0);
  const contacts = clips.reduce((s, c) => s + (Number(c.fb_messages) || 0), 0);
  const phones = clips.reduce((s, c) => s + phonesOf(c), 0);
  const cpa = phones > 0 ? Math.round(spend / phones) : null;
  const cells = [
    { label: 'Chi phí', value: fmtM(spend) },
    { label: 'Khách hàng tiềm năng', value: contacts, spark: '#14b8a6' },
    { label: 'Lượt mua (SĐT)', value: phones, spark: '#3b82f6' },
    { label: 'Giá/SĐT', value: cpa != null ? fmtM(cpa) : '—' },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-3 min-w-[210px]">
        <span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 grid place-items-center shrink-0"><BarChart2 className="w-5 h-5" /></span>
        <div><div className="font-bold text-slate-800">Hiệu quả Facebook Ads</div><div className="text-[11px] text-slate-400">Clip nào “đẻ tiền” — chi phí, lead, CPA từ tài khoản Ads</div></div>
      </div>
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 min-w-[260px]">
        {cells.map((c, i) => (
          <div key={i}>
            <div className="text-[11px] text-slate-400">{c.label}</div>
            <div className="text-lg font-extrabold text-slate-800 flex items-center gap-2 leading-tight">{c.value}{c.spark && <Sparkline color={c.spark} />}</div>
          </div>
        ))}
      </div>
      {onReport && <button onClick={onReport} className="shrink-0 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"><BarChart2 className="w-4 h-4" />Xem báo cáo chi tiết</button>}
    </div>
  );
};

// ---------- Card "Bảng điểm Editor" (3 top editor) ----------
const LeaderboardCard = ({ lb, now, onSeeAll }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
        <div><div className="font-bold text-slate-800 text-sm leading-tight">Bảng điểm Editor tháng {now.getMonth() + 1}</div><div className="text-[11px] text-slate-400">Top editor theo điểm Win</div></div>
      </div>
      {onSeeAll && <button onClick={onSeeAll} className="text-xs font-semibold text-teal-600 hover:underline shrink-0">Xem bảng điểm →</button>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {lb.length === 0 && <p className="text-sm text-slate-400 py-3 text-center col-span-full">Chưa có dữ liệu</p>}
      {lb.slice(0, 3).map((e, i) => {
        const cat = e.avg == null ? null : scoreCat(e.avg, false);
        const rankCls = i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : 'bg-orange-200 text-orange-700';
        return (
          <div key={e.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${rankCls}`}>{i + 1}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cat ? cat.cls : 'bg-slate-100 text-slate-400'}`}>{e.avg == null ? 'Chưa chấm' : `${i === 0 ? 'TB ' : ''}${e.avg.toFixed(1)}/10`}</span>
            </div>
            <div className="text-sm font-bold text-slate-700 truncate">{e.name}</div>
            <div className="text-[11px] text-slate-400">{e.n} clip · {e.w} Win</div>
          </div>
        );
      })}
    </div>
  </div>
);

// ---------- Popup: Duyệt chạy Ads + hỏi Đăng ngay ----------
const ApproveModal = ({ clip, store, onClose, onConfirm }) => {
  const [saving, setSaving] = useState(false);
  const go = async (postNow) => { setSaving(true); await onConfirm(postNow); /* parent tự đóng */ };
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-600 grid place-items-center mx-auto mb-3"><CheckCircle2 className="w-7 h-7" /></div>
          <h3 className="text-lg font-extrabold text-slate-800">Duyệt cho chạy Ads?</h3>
          <p className="text-sm text-slate-500 mt-1">Clip <b className="text-slate-700">{clip.title || store?.customer_name || 'này'}</b> sẽ được duyệt chạy. Editor +500.000đ.</p>

          <div className="mt-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white grid place-items-center mx-auto mb-2 shadow-md text-xl">⚡</div>
            <div className="font-bold text-orange-700">Đăng ngay lên page luôn?</div>
            <p className="text-[12px] text-slate-500 mt-1 leading-snug">Chọn <b>“Đăng ngay”</b> — sau khi duyệt, hệ thống sẽ tự quét &amp; đăng video này lên page.<br />Chọn <b>“Chỉ duyệt”</b> nếu muốn đăng sau.</p>
          </div>
        </div>
        <div className="px-6 pb-6 space-y-2.5">
          <button onClick={() => go(true)} disabled={saving} className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-lg">⚡</span>} Duyệt &amp; Đăng ngay
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={onClose} disabled={saving} className="h-11 rounded-2xl border border-slate-200 text-slate-500 font-semibold hover:bg-slate-50 disabled:opacity-60">Huỷ</button>
            <button onClick={() => go(false)} disabled={saving} className="h-11 rounded-2xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Chỉ duyệt</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Thẻ clip (Video Ads: editor + ads) ----------
const ClipReviewCard = ({ c, store, me, isAdmin, canAds, winRule, editorAvg, onReview, onEdit, onDelete, onView, onApproveRun, onSyncFb, onRemoveFb, onPostNow }) => {
  const verdict = clipVerdict(c, winRule);
  const mine = c.editor_id === me?.id;
  const eff = c.approved_to_run && c.stage === 'submitted' ? 'done' : c.stage;
  const cat = scoreCat(c.score, c.win);
  const fbInfo = fbStatusInfo(c.fb_status);
  const status = fbInfo || { label: STAGE[eff]?.label || eff, cls: STAGE[eff]?.cls || 'bg-slate-100 text-slate-500' };
  const [cidInput, setCidInput] = useState('');
  const doAssign = () => {
    const cid = cidInput.replace(/\D/g, '');
    if (!cid) { toast.error('Nhập ID chiến dịch Facebook'); return; }
    onSyncFb?.(c.id, cid);
  };
  const contacts = c.fb_messages || 0;    // Khách hàng tiềm năng = khách nhắn tin + tương tác page
  const phones = phonesOf(c);             // Lượt mua (SĐT) = lead + purchase (khớp Ads Manager)
  const cpa = phones > 0 ? Math.round(c.fb_spend / phones) : null; // Giá mỗi SĐT
  const clipUrl = (c.clip_links || [])[0];
  const menuItems = [
    canAds && !c.approved_to_run && { label: 'Duyệt chạy Ads', icon: <CheckCircle2 className="w-4 h-4" />, onClick: onApproveRun },
    canAds && c.approved_to_run && !c.post_now && c.post_status !== 'posted' && { label: '⚡ Đăng ngay lên page', icon: <Send className="w-4 h-4" />, onClick: () => onPostNow?.(c, true) },
    canAds && c.post_now && c.post_status !== 'posted' && { label: 'Huỷ Đăng ngay', icon: <X className="w-4 h-4" />, onClick: () => onPostNow?.(c, false) },
    canAds && { label: c.approved_to_run ? 'Ghi chú / đánh giá' : 'Xem & góp ý', icon: <Pencil className="w-4 h-4" />, onClick: onReview },
    (mine || isAdmin) && { label: 'Sửa clip', icon: <Pencil className="w-4 h-4" />, onClick: onEdit },
    (mine || isAdmin) && { label: 'Xoá clip', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, danger: true },
  ];
  const syncedAt = c.fb_synced_at ? new Date(c.fb_synced_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const thumb = (c.thumb_links || [])[0];
  const MetaItem = ({ Icon, label, children }) => (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400 leading-none mb-0.5">{label}</div>
        <div className="text-[13px] font-bold text-slate-700 truncate">{children}</div>
      </div>
    </div>
  );
  const MetricCol = ({ Icon, label, value, ring, chip }) => (
    <div className="flex flex-col items-center text-center px-2 py-3.5">
      <div className={`w-10 h-10 rounded-full grid place-items-center ${ring}`}><Icon className="w-5 h-5" /></div>
      <div className="text-[11px] text-slate-400 mt-1.5 leading-tight">{label}</div>
      <div className="font-bold text-slate-800 text-[16px] mt-0.5 whitespace-nowrap">{value}</div>
      {chip && <div className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.text}</div>}
    </div>
  );
  return (
    <div id={`clip-${c.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-3.5 sm:p-5 max-w-2xl mx-auto">
      {/* Hàng đầu: nhãn thẻ · Xem chi tiết · menu (giống mockup) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-bold text-slate-800 text-[15px]">Chiến dịch</span>
        <div className="flex items-center gap-2">
          <button onClick={onView} className="text-[13px] font-bold text-white px-4 h-9 rounded-xl bg-[#12274a] hover:bg-[#1b3866] whitespace-nowrap">Xem chi tiết</button>
          <ActionMenu items={menuItems} />
        </div>
      </div>

      {/* Video — poster + nút play (bấm để xem), phủ kín khung, không viền đen */}
      <button onClick={onView} className="group relative block w-full rounded-2xl overflow-hidden bg-slate-900 aspect-video ring-1 ring-slate-200/60 shadow-sm">
        {thumb
          ? <img src={thumbSrc(thumb)} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full grid place-items-center text-white/25"><PlayCircle className="w-14 h-14" /></div>}
        <span className="absolute inset-0 grid place-items-center bg-black/5 group-hover:bg-black/15 transition-colors">
          <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-sm grid place-items-center group-hover:bg-black/70 group-hover:scale-105 transition"><Play className="w-7 h-7 text-white fill-current ml-1" /></span>
        </span>
        {(c.post_status === 'posted' || c.post_now) && (
          <span className="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur bg-black/45 text-white">
            {c.post_status === 'posted' ? '✅ Đã đăng page' : '⚡ Đã gửi đăng page'}
          </span>
        )}
      </button>

      {/* Trạng thái */}
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mt-3.5 ${status.cls}`}>
        {fbInfo?.kind === 'running' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
        {status.label}
      </span>

      {/* Tiêu đề + ô khách hàng */}
      <div className="flex items-start justify-between gap-3 mt-2">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 text-[17px] leading-snug">{c.title || '(Chưa đặt tiêu đề)'}</h3>
          <div className="w-7 h-[3px] bg-slate-200 rounded-full mt-2" />
        </div>
        {store?.customer_name && (
          <div className="shrink-0 w-36 sm:w-44 rounded-2xl bg-slate-50 border border-slate-100 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><CalendarDays className="w-3.5 h-3.5" />Khách hàng</div>
            <div className="font-bold text-slate-800 text-[13px] mt-0.5 leading-snug line-clamp-2">{store.customer_name}</div>
            {store?.service && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{store.service}</div>}
          </div>
        )}
      </div>

      {/* Meta: Cập nhật · Editor · Nguồn */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 mt-3">
        <MetaItem Icon={CalendarDays} label="Cập nhật">{syncedAt || '—'}</MetaItem>
        <MetaItem Icon={User} label="Editor">{c.editor?.full_name || '—'}</MetaItem>
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 leading-none mb-0.5">Nguồn</div>
            {(store?.source_links || []).length > 0
              ? <button onClick={() => window.open(store.source_links[0], '_blank', 'noopener')} className="text-[13px] text-teal-600 font-bold inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-3.5 h-3.5" />Mở Drive</button>
              : <span className="text-[13px] text-slate-300 font-bold">—</span>}
          </div>
        </div>
      </div>

      {/* ID chiến dịch: avatar · label + số · nút copy vuông · Đồng bộ / Gỡ ID bên phải */}
      {c.fb_campaign_id ? (
        <div className="flex items-center gap-3 flex-wrap mt-3.5">
          {thumb && <img src={thumbSrc(thumb)} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0" loading="lazy" />}
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 leading-none mb-1">ID chiến dịch</div>
            <div className="font-bold text-slate-800 text-[13px] tracking-wide truncate">{c.fb_campaign_id}</div>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(c.fb_campaign_id); toast.success('Đã copy ID chiến dịch'); }} className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 shrink-0"><Copy className="w-4 h-4" /></button>
          {canAds && (
            <span className="flex items-center gap-2 ml-auto">
              <button onClick={() => onSyncFb?.(c.id, c.fb_campaign_id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 border border-blue-200 rounded-full px-3.5 py-2 hover:bg-blue-50 transition-colors"><RotateCcw className="w-3.5 h-3.5" />Đồng bộ</button>
              <button onClick={() => onRemoveFb?.(c)} className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 border border-rose-200 rounded-full px-3.5 py-2 hover:bg-rose-50 transition-colors"><X className="w-3.5 h-3.5" />Gỡ ID</button>
            </span>
          )}
        </div>
      ) : null}

      {/* Chỉ số Ads — 1 thẻ, 4 cột icon màu */}
      {c.fb_campaign_id ? (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 [&>*:nth-child(3)]:border-t sm:[&>*:nth-child(3)]:border-t-0 [&>*:nth-child(4)]:border-t sm:[&>*:nth-child(4)]:border-t-0 [&>*:nth-child(3)]:border-slate-100 [&>*:nth-child(4)]:border-slate-100">
          <MetricCol Icon={Users} label="Khách hàng tiềm năng" value={contacts} ring="bg-teal-50 text-teal-600" />
          <MetricCol Icon={ShoppingCart} label="Lượt mua (SĐT)" value={phones} ring="bg-violet-50 text-violet-600" />
          <MetricCol Icon={CircleDollarSign} label="Chi phí" value={fmtM(c.fb_spend)} ring="bg-amber-50 text-amber-600" />
          <MetricCol Icon={Wallet} label="Giá/SĐT" value={cpa != null ? fmtM(cpa) : '—'} ring="bg-blue-50 text-blue-600" chip={verdict.potential ? verdict.tier : null} />
        </div>
      ) : canAds && c.approved_to_run ? (
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 mt-3">
          <p className="text-xs text-slate-500 mb-2">Chạy Ads xong, dán <b className="text-blue-700">ID chiến dịch Facebook</b> để kéo chỉ số về:</p>
          <div className="flex gap-2">
            <input value={cidInput} onChange={e => setCidInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAssign()} inputMode="numeric" placeholder="VD: 120212345678900000" className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-400 outline-none" />
            <button onClick={doAssign} className="shrink-0 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 inline-flex items-center gap-1.5"><LinkIcon className="w-4 h-4" />Gán &amp; Kéo</button>
          </div>
        </div>
      ) : canAds ? (
        <div className="text-sm text-slate-400 bg-slate-50 rounded-2xl p-3 mt-3 inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-slate-300" />Duyệt chạy Ads trước, rồi mới gán ID chiến dịch.</div>
      ) : (
        <div className="text-sm text-slate-400 bg-slate-50 rounded-2xl p-3 mt-3">Chưa gán ID chiến dịch Facebook.</div>
      )}

      {/* Dải điểm hệ thống — nền navy 1 hàng: nhãn · điểm giữa · trạng thái phải */}
      <div className="rounded-2xl bg-[#0f2140] px-4 sm:px-5 py-3 mt-4 flex items-center gap-2">
        <span className="text-xs font-semibold text-white/85 whitespace-nowrap shrink-0">{verdict.potential ? 'Chỉ số Ads' : 'Điểm hệ thống'}</span>
        <span className="flex-1 flex justify-center min-w-0 px-1">
          {verdict.potential
            ? <span title="Ads còn đang chạy & chưa tiêu quá ngân sách Win — chưa chấm điểm, chỉ đánh giá theo Chi phí/SĐT" className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ${verdict.tier.cls}`}>{verdict.tier.text}</span>
            : (c.win || c.score > 0)
              ? <span className={`text-lg font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap ${c.win ? 'text-amber-400' : 'text-white'}`}>{c.win && <Trophy className="w-5 h-5 text-amber-400" />}{c.win ? 10 : c.score}/10{c.win ? ' · WIN' : ''}</span>
              : <span className="text-sm font-semibold text-slate-400 whitespace-nowrap">Chưa có điểm</span>}
        </span>
        {c.approved_to_run
          ? <span className="text-[11px] sm:text-xs font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap shrink-0"><CheckCircle2 className="w-3.5 h-3.5" />Đã duyệt chạy</span>
          : canAds ? <button onClick={(e) => { e.stopPropagation(); onApproveRun(); }} className="text-[11px] sm:text-xs font-bold text-white px-3 py-1.5 rounded-full bg-teal-500 hover:bg-teal-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0"><CheckCircle2 className="w-4 h-4" />Duyệt chạy</button>
            : <span className="shrink-0 w-1" />}
      </div>

      {/* Điểm Editor · Ghi chú */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
        <span className="flex items-center gap-2 whitespace-nowrap" title="Điểm trung bình tích lũy của editor (tính trên mọi clip đã được chấm, không reset theo tháng)">
          <span className="text-[13px] text-slate-500">Điểm Editor</span>
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">{editorAvg != null ? `${editorAvg.toFixed(1)}/10` : '—'}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[13px] min-w-0">
          <span className="text-slate-500 shrink-0">Ghi chú:</span>
          {c.ads_feedback
            ? <span className="text-slate-600 truncate max-w-[220px]">{c.ads_feedback}</span>
            : <span className="text-slate-300">chưa có</span>}
          {canAds && <button onClick={onReview} className="text-slate-400 hover:text-violet-600 shrink-0"><Pencil className="w-4 h-4" /></button>}
        </span>
      </div>
    </div>
  );
};

// ---------- Modal: Thêm media (Media up nguồn) ----------
const inpCls = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none';
const Field = ({ label, children }) => (
  <div className="mb-3"><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>
);
const AddMediaModal = ({ me, stores = [], onClose, onSaved }) => {
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
  const [sourceTypes, setSourceTypes] = useState([]);
  const [sourceStatus, setSourceStatus] = useState('chua_dung');
  const [noImage, setNoImage] = useState(false);
  const [hideFace, setHideFace] = useState(false);
  const [tags, setTags] = useState([]);
  const [dupAck, setDupAck] = useState(false);
  const [mediaStaff, setMediaStaff] = useState([]);
  const [links, setLinks] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const timer = useRef(null);

  const doScan = async () => {
    const arr = parseLinks(links);
    if (!arr.length) { toast.error('Dán link Google Drive trước đã'); return; }
    setScanning(true);
    try {
      const d = await scanDrive(arr);
      if (d?.ok) {
        setSourceTypes(d.types || []);
        if (d.types?.length) toast.success('Đã nhận diện: ' + d.types.map(k => SRC_LABEL[k] || k).join(', '));
        else if (d.privateLinks) toast('Link riêng tư — không đọc được, chỉnh tay nhé', { icon: '🔒' });
        else toast('Đọc ' + (d.folders?.length || 0) + ' thư mục [link:' + d.linkCount + ' • ' + (d.diag || []).join(',') + ']: ' + (d.folders || []).slice(0, 8).join(', '), { icon: 'ℹ️', duration: 9000 });
      } else toast.error(d?.error || 'Soi thất bại');
    } catch (e) { toast.error('Soi lỗi: ' + e.message); }
    setScanning(false);
  };

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
  const canSuggest = !!(cname && cname.trim() && shootDate);
  const fillId = () => {
    const s = suggestSourceId(cname, shootDate);
    if (!s) { toast('Nhập Tên khách + Ngày quay/chụp để gợi ý ID', { icon: 'ℹ️' }); return; }
    setSourceId(s);
    toast.success('Đã gợi ý ID source');
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
      no_image: noImage, hide_face: hideFace, tags,
    };
    if (mode === 'existing') {
      if (!picked) { toast.error('Hãy TAG (chọn) khách hàng'); return; }
      payload = { ...payload, appointment_id: picked.appointment_id, customer_name: picked.customer_name, customer_phone: picked.phone, service: picked.service || null };
    } else {
      if (!name.trim()) { toast.error('Nhập tên khách hàng'); return; }
      payload = { ...payload, appointment_id: null, customer_name: name.trim(), customer_phone: phone.trim() || null, service: service.trim() || null };
    }
    // Cảnh báo trùng: cùng SĐT/tên khách, hoặc trùng link Drive
    const nrm = (x) => (x || '').trim().toLowerCase();
    const dupLink = stores.find(s => (s.source_links || []).some(l => arr.includes(l)));
    const dupCust = stores.find(s => (payload.customer_phone && nrm(s.customer_phone) === nrm(payload.customer_phone)) || (nrm(s.customer_name) === nrm(payload.customer_name)));
    if ((dupLink || dupCust) && !dupAck) {
      const msg = dupLink ? `Link Drive này đã có ở "${dupLink.customer_name}".` : `Đã có source cho khách "${dupCust.customer_name}".`;
      toast(msg + ' Bấm Lưu lần nữa nếu vẫn muốn thêm.', { icon: '⚠️', duration: 7000 });
      setDupAck(true);
      return;
    }
    setSaving(true);
    const { data: ins, error } = await supabase.from('media_customers').insert(payload).select('id').single();
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã thêm vào kho media');
    // Chưa có loại source → tự soi Drive điền giúp (chạy nền)
    if (ins?.id) scanDriveAndUpdate(ins.id, arr);
    onSaved();
  };

  return (
    <Modal title="Thêm media khách hàng" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setMode('existing')} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'existing' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>Tag khách đã có</button>
        <button onClick={() => setMode('new')} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'new' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>Khách chưa có (tạo mới)</button>
      </div>

      {mode === 'existing' ? (
        picked ? (
          <div className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 mb-3">
            <span className="text-sm font-medium text-slate-700">{picked.customer_name} · {picked.phone}{picked.service ? ` · ${picked.service}` : ''}</span>
            <button onClick={() => setPicked(null)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        ) : (
          <div className="mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input autoFocus value={q} onChange={e => onSearch(e.target.value)} placeholder="Tag khách: tìm theo tên / SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none" />
            </div>
            <div className="max-h-40 overflow-y-auto mt-1 border border-slate-100 rounded-xl divide-y">
              {results.map(r => (
                <button key={r.appointment_id} onClick={() => setPicked(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">
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
          <Field label="Số điện thoại"><input value={phone} onChange={e => setPhone(e.target.value)} className={inpCls} /></Field>
          <Field label="Dịch vụ (chọn nhiều)">
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_GROUPS.map(g => {
                const on = (service || '').split(',').map(x => x.trim()).includes(g);
                return <button type="button" key={g} onClick={() => setService(prev => { const arr = (prev || '').split(',').map(x => x.trim()).filter(Boolean); return arr.includes(g) ? arr.filter(x => x !== g).join(', ') : [...arr, g].join(', '); })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${on ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{g}</button>;
              })}
            </div>
          </Field>
        </>
      )}

      {(mode === 'new' || picked) && (
        <>
          <Field label="ID source">
            <div className="flex gap-2">
              <input value={sourceId} onChange={e => setSourceId(e.target.value)} placeholder="VD: Dung27062026_01" className={inpCls} />
              <button type="button" onClick={fillId} disabled={!canSuggest} title={canSuggest ? 'Tự tạo ID source' : 'Nhập Tên khách + Ngày quay/chụp trước'} className="shrink-0 px-3 rounded-xl bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200 hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-teal-50">Gợi ý</button>
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
          <Field label="Cảnh báo quyền sử dụng (Designer/Editor sẽ thấy)">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setNoImage(v => !v)} className={`px-3.5 py-2 rounded-xl text-sm font-bold border inline-flex items-center gap-1.5 transition ${noImage ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Ban className="w-4 h-4" />Không dùng hình ảnh</button>
              <button type="button" onClick={() => setHideFace(v => !v)} className={`px-3.5 py-2 rounded-xl text-sm font-bold border inline-flex items-center gap-1.5 transition ${hideFace ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><EyeOff className="w-4 h-4" />Che mặt</button>
            </div>
          </Field>
          <Field label="Nhãn (tag)"><TagInput value={tags} onChange={setTags} /></Field>
          <Field label="Trong link đã có những source nào?">
            <button type="button" onClick={doScan} disabled={scanning}
              className="mb-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-60">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Soi Drive tự động
            </button>
            <SourceTypePicker value={sourceTypes} onChange={setSourceTypes} />
            <p className="text-[11px] text-slate-400 mt-1.5">Bấm để hệ thống tự đọc thư mục trong link. Bỏ trống cũng được — sẽ tự soi khi lưu. (Có thể chỉnh tay nếu link riêng tư.)</p>
          </Field>
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
  const [sourceTypes, setSourceTypes] = useState(store.source_types || []);
  const [sourceStatus, setSourceStatus] = useState(store.source_status || 'chua_dung');
  const [noImage, setNoImage] = useState(!!store.no_image);
  const [hideFace, setHideFace] = useState(!!store.hide_face);
  const [tags, setTags] = useState(store.tags || []);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const doScan = async () => {
    const arr = parseLinks(links);
    if (!arr.length) { toast.error('Dán link Google Drive trước đã'); return; }
    setScanning(true);
    try {
      const d = await scanDrive(arr);
      if (d?.ok) {
        setSourceTypes(d.types || []);
        if (d.types?.length) toast.success('Đã nhận diện: ' + d.types.map(k => SRC_LABEL[k] || k).join(', '));
        else if (d.privateLinks) toast('Link riêng tư — không đọc được, chỉnh tay nhé', { icon: '🔒' });
        else toast('Đọc ' + (d.folders?.length || 0) + ' thư mục [link:' + d.linkCount + ' • ' + (d.diag || []).join(',') + ']: ' + (d.folders || []).slice(0, 8).join(', '), { icon: 'ℹ️', duration: 9000 });
      } else toast.error(d?.error || 'Soi thất bại');
    } catch (e) { toast.error('Soi lỗi: ' + e.message); }
    setScanning(false);
  };
  const save = async () => {
    setSaving(true);
    const arr = parseLinks(links);
    const { error } = await supabase.from('media_customers').update({ source_links: arr, note: note || null, source_type: sourceType || null, source_status: sourceStatus || 'chua_dung', no_image: noImage, hide_face: hideFace, tags }).eq('id', store.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã cập nhật nguồn');
    scanDriveAndUpdate(store.id, arr);
    onSaved();
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
      <Field label="Cảnh báo quyền sử dụng (Designer/Editor sẽ thấy)">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setNoImage(v => !v)} className={`px-3.5 py-2 rounded-xl text-sm font-bold border inline-flex items-center gap-1.5 transition ${noImage ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Ban className="w-4 h-4" />Không dùng hình ảnh</button>
          <button type="button" onClick={() => setHideFace(v => !v)} className={`px-3.5 py-2 rounded-xl text-sm font-bold border inline-flex items-center gap-1.5 transition ${hideFace ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><EyeOff className="w-4 h-4" />Che mặt</button>
        </div>
      </Field>
      <Field label="Trong link đã có những source nào?">
        <button type="button" onClick={doScan} disabled={scanning}
          className="mb-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-60">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Soi Drive tự động
        </button>
        <SourceTypePicker value={sourceTypes} onChange={setSourceTypes} />
      </Field>
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
        <input autoFocus value={q} onChange={e => onSearch(e.target.value)} placeholder="Tìm tên/SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none" />
      </div>
      <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y">
        {results.map(r => (
          <button key={r.appointment_id} onClick={() => link(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">
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
      {(store?.no_image || store?.hide_face) && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-xs font-bold text-rose-700 mb-1.5 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />LƯU Ý QUYỀN SỬ DỤNG</div>
          <PermissionBadges s={store} />
        </div>
      )}
      {store?.source_links?.length > 0 && <div className="mb-3"><div className="text-xs text-slate-400 mb-1">Nguồn để dựng:</div><LinkList links={store.source_links} label="Nguồn" icon={Film} /></div>}

      <label className="block text-sm font-semibold text-slate-700 mb-1">Tiêu đề video</label>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Review nâng mũi - KH Thanh Hà" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none mb-3" />

      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Scissors className="w-3.5 h-3.5" /> Link clip đã dựng (mỗi dòng 1 link)</label>
      <textarea value={clip} onChange={e => setClip(e.target.value)} rows={2} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none mb-3" />

      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1"><Image className="w-3.5 h-3.5" /> Ảnh thumbnail (tải trực tiếp)</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {thumbs.map((u, i) => (
          <div key={i} className="relative">
            <img src={u} alt="thumb" className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
            <button type="button" onClick={() => setThumbs(p => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><X className="w-3 h-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-teal-400 hover:text-teal-500 disabled:opacity-50">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="text-[10px] mt-0.5">{uploading ? 'Đang tải' : 'Tải ảnh'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      </div>

      <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none mb-4" />
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel={editing ? 'Cập nhật & nộp lại' : 'Đẩy clip'} />
    </Modal>
  );
};

// ---------- Modal: Ads đánh giá clip ----------
// ---------- Modal: Định nghĩa Ads Win ----------
const WinRuleModal = ({ rule, onClose, onSave }) => {
  const [budget, setBudget] = useState(rule?.win_budget ? String(rule.win_budget) : '');
  const [phones, setPhones] = useState(rule?.win_phones ? String(rule.win_phones) : '');
  const [saving, setSaving] = useState(false);
  const b = Number(String(budget).replace(/\D/g, '')), p = Number(String(phones).replace(/\D/g, ''));
  const cpa = b && p ? Math.round(b / p) : null;
  return (
    <Modal title="Định nghĩa Ads Win" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">Win không cố định theo con số cứng — bạn đặt theo thị trường. Hệ thống sẽ <b>tự chấm</b> mỗi clip dựa trên chỉ số Facebook đã kéo về (Ads khỏi chấm tay).</p>
      <Field label="Ngân sách đã chi tiêu (đồng)"><MoneyInput value={budget} onChange={setBudget} placeholder="VD: 1.000.000" className={inpCls} /></Field>
      <Field label="Số điện thoại (SĐT xin được) tương ứng"><input value={phones} onChange={e => setPhones(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="VD: 10" className={inpCls} /></Field>
      {cpa && <div className="text-sm bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-700 mb-3">→ Chuẩn Win: <b>CPA ≤ {fmtM(cpa)}/SĐT</b>. Clip có chi phí mỗi SĐT thấp hơn mức này sẽ tự chấm <b>Win</b>; cao hơn thì Tốt / TB / Tệ.</div>}
      <ModalActions onClose={onClose} onSave={async () => { setSaving(true); await onSave(budget, phones); setSaving(false); }} saving={saving} saveLabel="Lưu & tự chấm lại" />
    </Modal>
  );
};

// Modal DUYỆT clip (giai đoạn trước khi chạy Ads): Ads xem clip -> góp ý cho editor
// rồi quyết định "Cần sửa" (gửi lại editor) hoặc "Duyệt & chạy Ads".
// KHÔNG chấm điểm tay ở đây — điểm/Win do hệ thống tự tính từ chỉ số Ads sau khi chạy.
const ReviewClipModal = ({ clip, store, me, onClose, onSaved }) => {
  const [feedback, setFeedback] = useState(clip.ads_feedback || '');
  const [postNow, setPostNow] = useState(clip.post_now || false);
  const [saving, setSaving] = useState(false);

  const submit = async (action) => {
    setSaving(true);
    const approve = action === 'approve';
    const payload = {
      ads_id: me.id,
      ads_feedback: feedback || null,
      stage: approve ? 'done' : 'revision',
      approved_to_run: approve,
      evaluated_at: approve ? new Date().toISOString() : null,
    };
    if (approve && postNow && !clip.post_now) { payload.post_now = true; payload.post_now_at = new Date().toISOString(); payload.post_status = 'queued'; }
    await onSaved(payload);
    setSaving(false);
  };
  return (
    <Modal title="Duyệt clip" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Khách: <b>{store?.customer_name}</b> · Editor: <b>{clip.editor?.full_name || '—'}</b></p>
      <div className="mb-3 flex flex-col gap-2">
        {(clip.clip_links || []).map((l, i) => <VideoPreview key={i} url={l} />)}
        {(clip.thumb_links || []).length > 0 && <div className="flex flex-wrap gap-2">{(clip.thumb_links || []).map((l, i) => <Thumb key={i} url={l} idx={i} size="h-24 w-24" download />)}</div>}
        {(clip.clip_links || []).length === 0 && <span className="text-xs text-slate-300">Chưa có clip</span>}
      </div>

      <label className="block text-sm font-semibold text-slate-700 mb-1">Phản hồi / góp ý cho editor</label>
      <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} placeholder="VD: đổi hook 3 giây đầu, chỉnh lại nhạc…" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none mb-2" />
      <p className="text-[11px] text-slate-400 mb-3 flex items-start gap-1"><BarChart2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />Điểm &amp; Win sẽ do hệ thống tự chấm theo chỉ số Ads sau khi clip chạy (không cần chấm tay).</p>

      <label className="flex items-start gap-2.5 p-3 rounded-xl border-2 border-orange-200 bg-orange-50/50 cursor-pointer mb-4">
        <input type="checkbox" checked={postNow} onChange={e => setPostNow(e.target.checked)} className="mt-0.5" />
        <span className="text-sm">
          <span className="font-bold text-orange-700">⚡ Đăng ngay lên page</span>
          <span className="block text-[11px] text-slate-500">Gắn nhãn để hệ thống tự quét video này và đăng lên page ngay sau khi duyệt.</span>
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={() => submit('revision')} disabled={saving} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600 disabled:opacity-50 flex items-center gap-1"><RotateCcw className="w-4 h-4" /> Cần sửa — gửi lại editor</button>
        <button onClick={() => submit('approve')} disabled={saving} className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Duyệt &amp; chạy Ads</button>
      </div>
    </Modal>
  );
};

// ---------- Player kiểu TikTok: file trực tiếp = điều khiển tùy biến; Drive/YouTube = iframe ----------
const fmtT = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
};
const TikTokPlayer = ({ url, onLike }) => {
  const emb = embedUrl(url);
  const direct = !emb && isVideoFile(url);
  const vref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [prog, setProg] = useState(0);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [burst, setBurst] = useState(false);
  const tapTimer = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const v = vref.current;
    if (!v || !direct) return;
    v.muted = true;
    const p = v.play(); if (p?.catch) p.catch(() => {});
  }, [url, direct]);

  const togglePlay = () => { const v = vref.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };
  const heartBurst = () => { setBurst(true); setTimeout(() => setBurst(false), 700); onLike?.(); };
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) { clearTimeout(tapTimer.current); lastTap.current = 0; heartBurst(); }
    else { lastTap.current = now; tapTimer.current = setTimeout(togglePlay, 280); }
  };

  if (!direct) {
    if (emb) return <iframe src={emb} loading="lazy" allow="autoplay; fullscreen" allowFullScreen title="clip" className="block w-full h-full bg-black" />;
    return <div className="w-full h-full flex items-center justify-center"><a href={url} target="_blank" rel="noreferrer" className="text-violet-300 underline text-sm">Mở clip</a></div>;
  }

  return (
    <div className="relative w-full h-full bg-black select-none" onClick={onTap}>
      <video ref={vref} src={url} playsInline loop muted={muted}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={e => { const v = e.target; setCur(v.currentTime); setProg(v.duration ? v.currentTime / v.duration : 0); }}
        onLoadedMetadata={e => setDur(e.target.duration)}
        className="w-full h-full object-cover" />

      {burst && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Heart className="w-24 h-24 text-rose-500 fill-rose-500 animate-ping" /></div>}
      {!playing && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center"><Play className="w-8 h-8 text-white fill-white ml-1" /></div></div>}

      <div className="absolute left-0 right-0 bottom-0 px-3 pb-3 pt-6 bg-gradient-to-t from-black/70 to-transparent" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-white text-[11px] mb-1.5">
          <button onClick={() => { const v = vref.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} className="p-1">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
          <span className="tabular-nums">{fmtT(cur)} / {fmtT(dur)}</span>
        </div>
        <input type="range" min={0} max={1000} value={Math.round(prog * 1000)}
          onChange={e => { const v = vref.current; if (v && v.duration) v.currentTime = (Number(e.target.value) / 1000) * v.duration; }}
          className="w-full h-1 accent-rose-500 cursor-pointer" />
      </div>
    </div>
  );
};

// ---------- Modal "Xem lớn" kiểu TikTok: player + thả tim / bình luận / chấm điểm / chia sẻ ----------
const VideoModal = ({ clip, onClose, title = 'Xem video clip', me, canScore, onScore }) => {
  const links = clip.clip_links || [];
  // Nếu clip có cả link Drive lẫn file trực tiếp (R2) → ưu tiên mở file trực tiếp (player TikTok)
  const firstDirect = links.findIndex(l => !embedUrl(l) && isVideoFile(l));
  const [ci, setCi] = useState(firstDirect >= 0 ? firstDirect : 0);
  const cur = links[ci] || links[0];
  const isDirect = (l) => !embedUrl(l) && isVideoFile(l);
  const socialId = clip.id; // chỉ clip thật có id (xem "source" thì không → ẩn tim/bình luận)

  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [cmt, setCmt] = useState('');
  const [sending, setSending] = useState(false);

  const loadSocial = useCallback(async () => {
    if (!socialId) return;
    const [likesRes, cmtRes] = await Promise.all([
      supabase.from('media_clip_likes').select('user_id').eq('clip_id', socialId),
      supabase.from('media_clip_comments').select('*, user:profiles!user_id(full_name)').eq('clip_id', socialId).is('deleted_at', null).order('created_at', { ascending: true }),
    ]);
    const likes = likesRes.data || [];
    setLikeCount(likes.length);
    setLiked(me ? likes.some(l => l.user_id === me.id) : false);
    setComments(cmtRes.data || []);
  }, [socialId, me]);
  useEffect(() => { loadSocial(); }, [loadSocial]);

  const toggleLike = async () => {
    if (!socialId || !me) return;
    if (liked) {
      setLiked(false); setLikeCount(c => Math.max(0, c - 1));
      await supabase.from('media_clip_likes').delete().eq('clip_id', socialId).eq('user_id', me.id);
    } else {
      setLiked(true); setLikeCount(c => c + 1);
      const { error } = await supabase.from('media_clip_likes').insert({ clip_id: socialId, user_id: me.id });
      if (error && !String(error.message || '').toLowerCase().includes('duplicate')) { setLiked(false); setLikeCount(c => Math.max(0, c - 1)); toast.error('Lỗi thả tim: ' + error.message); }
    }
  };
  const doubleTapLike = () => { if (!liked) toggleLike(); };

  const sendComment = async () => {
    const text = cmt.trim();
    if (!text || !socialId || !me) return;
    setSending(true);
    const { error } = await supabase.from('media_clip_comments').insert({ clip_id: socialId, user_id: me.id, content: text });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setCmt(''); loadSocial();
  };

  const share = async () => {
    if (!cur) return;
    try {
      if (navigator.share) await navigator.share({ title, url: cur });
      else { await navigator.clipboard.writeText(cur); toast.success('Đã sao chép link clip'); }
    } catch { /* người dùng huỷ chia sẻ */ }
  };

  const RailBtn = ({ icon, label, active, activeCls = 'text-rose-500', onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-white">
      <span className={`w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center ${active ? activeCls : ''}`}>{icon}</span>
      <span className="text-[11px] font-semibold drop-shadow max-w-[52px] truncate">{label}</span>
    </button>
  );

  const thumb = (clip.thumb_links || [])[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Nền: ảnh clip làm mờ cho sang, không còn nền đen thô */}
      <div className="absolute inset-0 overflow-hidden bg-slate-950">
        {thumb && <img src={thumbSrc(thumb)} alt="" className="w-full h-full object-cover opacity-40 blur-3xl scale-125" />}
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* Nút đóng nổi góc trên */}
      <button onClick={onClose} className="absolute top-4 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 backdrop-blur text-white hover:bg-white/25 transition"><X className="w-5 h-5" /></button>

      {/* Thẻ video dạng reel 9:16 bo tròn, canh giữa */}
      <div className="relative z-10 w-full flex justify-center px-3 sm:px-0" onClick={e => e.stopPropagation()}>
        <div className="relative w-full max-w-[400px] aspect-[9/16] max-h-[90vh] bg-black rounded-[26px] overflow-hidden shadow-2xl ring-1 ring-white/10">
          <TikTokPlayer key={cur} url={cur} onLike={doubleTapLike} />

          {/* Tiêu đề trên cùng */}
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3.5 pb-6 bg-gradient-to-b from-black/55 to-transparent pointer-events-none">
            <h3 className="text-white font-bold text-sm truncate drop-shadow pr-10">{clip.title || title}</h3>
          </div>

          {/* Rail thao tác bên phải */}
          <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-20">
            {socialId && <RailBtn onClick={toggleLike} active={liked} icon={<Heart className={`w-6 h-6 ${liked ? 'fill-rose-500' : ''}`} />} label={String(likeCount)} />}
            {socialId && <RailBtn onClick={() => setShowComments(true)} icon={<MessageCircle className="w-6 h-6" />} label={String(comments.length)} />}
            {canScore && onScore && <RailBtn onClick={onScore} active={!!(clip.win || clip.score)} activeCls="text-amber-400" icon={<Star className={`w-6 h-6 ${clip.win || clip.score ? 'fill-amber-400 text-amber-400' : ''}`} />} label={clip.win ? '10' : (clip.score ? String(clip.score) : 'Chấm')} />}
            <RailBtn onClick={share} icon={<Share2 className="w-6 h-6" />} label="Chia sẻ" />
          </div>

          {links.length > 1 && (
            <div className="absolute left-3 bottom-24 flex flex-col gap-1.5 z-20">
              {links.map((l, i) => (
                <button key={i} onClick={() => setCi(i)} title={isDirect(l) ? 'Video trực tiếp (TikTok)' : 'Link Google Drive'}
                  className={`w-8 h-8 rounded-full text-[11px] font-bold flex items-center justify-center ${i === ci ? 'bg-white text-black' : 'bg-black/40 text-white'} ${isDirect(l) ? 'ring-2 ring-rose-500' : ''}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          {showComments && (
            <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setShowComments(false)}>
              <div className="bg-white rounded-t-3xl max-h-[70%] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="pt-2 flex justify-center"><span className="w-10 h-1 rounded-full bg-slate-300" /></div>
                <div className="px-4 py-2.5 border-b flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">{comments.length} bình luận</span>
                  <button onClick={() => setShowComments(false)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {comments.length === 0 ? <div className="text-center text-slate-400 text-sm py-8">Chưa có bình luận — hãy là người đầu tiên!</div>
                    : comments.map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">{(c.user?.full_name || '?').charAt(0)}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-700">{c.user?.full_name || 'Ẩn danh'}</div>
                          <div className="text-sm text-slate-600 break-words whitespace-pre-wrap">{c.content}</div>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="p-3 border-t flex items-center gap-2">
                  <input value={cmt} onChange={e => setCmt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendComment(); }} placeholder="Thêm bình luận..." className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm outline-none" />
                  <button onClick={sendComment} disabled={sending || !cmt.trim()} className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center disabled:opacity-40 shrink-0"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- Modal: Thêm Video Ads (tạo clip + tự gán/kết nối kho media với khách) ----------
const AddVideoModal = ({ me, onClose, onSaved }) => {
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(null);   // THÔNG TIN KHÁCH HÀNG đã tag
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [sourceLink, setSourceLink] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [clip, setClip] = useState('');
  const [thumbs, setThumbs] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const timer = useRef(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const onSearch = (val) => {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { const { data } = await supabase.rpc('search_content_customers', { q: val }); setResults(data || []); }, 250);
  };
  const onPickFiles = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try { for (const f of files) { if (!f.type.startsWith('image/')) { toast.error('Chỉ nhận file ảnh'); continue; } const url = await uploadToR2(f, 'ads-thumb'); setThumbs(p => [...p, url]); } }
    catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    setUploading(false);
  };
  // Tải video trực tiếp lên R2 -> link file trực tiếp -> dùng được player TikTok tùy biến
  const onPickVideo = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    setUploadingVideo(true);
    try {
      for (const f of files) {
        if (!f.type.startsWith('video/')) { toast.error('Chỉ nhận file video'); continue; }
        const url = await uploadToR2(f, 'ads-clip');
        setClip(prev => (prev.trim() ? prev.trim() + '\n' : '') + url);
      }
      toast.success('Đã tải video lên');
    } catch (err) { toast.error('Lỗi tải video: ' + err.message); }
    setUploadingVideo(false);
  };

  const save = async () => {
    if (!title.trim()) { toast.error('Nhập tiêu đề video'); return; }
    if (!name.trim()) { toast.error('Nhập tên khách hàng'); return; }
    const clipArr = parseLinks(clip);
    if (clipArr.length === 0) { toast.error('Dán link clip đã dựng (http...)'); return; }
    if (thumbs.length === 0) { toast.error('Tải ít nhất 1 ảnh thumbnail'); return; }
    setSaving(true);
    try {
      // 1) Tìm/tạo kho media (tự gán với khách nếu đã tag)
      let storeId = null;
      if (picked?.appointment_id) {
        const { data: ex } = await supabase.from('media_customers').select('id').eq('appointment_id', picked.appointment_id).limit(1);
        if (ex && ex[0]) storeId = ex[0].id;
      }
      if (!storeId) {
        const { data: ins, error: e1 } = await supabase.from('media_customers').insert({
          appointment_id: picked?.appointment_id || null, customer_name: name.trim(), customer_phone: picked?.phone || null,
          media_id: me.id, source_links: parseLinks(sourceLink), source_id: sourceId.trim() || null, source_status: 'dang_dung',
          service: picked?.service || null,
        }).select('id').single();
        if (e1) throw e1;
        storeId = ins.id;
      }
      // 2) Tạo clip
      const { error: e2 } = await supabase.from('media_clips').insert({
        media_customer_id: storeId, editor_id: me.id, title: title.trim(),
        clip_links: clipArr, thumb_links: thumbs, editor_note: note || null, stage: 'submitted', submitted_at: new Date().toISOString(),
      });
      if (e2) throw e2;
      toast.success('Đã thêm Video Ads'); onSaved();
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    setSaving(false);
  };

  return (
    <Modal title="Thêm Video Ads" onClose={onClose}>
      <Field label="Tiêu đề video *"><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Feedback nâng mũi - bản cảm xúc" className={inpCls} /></Field>

      <Field label="Kết nối Thông tin khách hàng (@ tên / SĐT)">
        {picked ? (
          <div className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
            <span className="text-sm font-medium text-slate-700">@ {picked.customer_name} · {picked.phone}</span>
            <button onClick={() => setPicked(null)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        ) : (
          <>
            <input value={q} onChange={e => onSearch(e.target.value)} placeholder="Gõ tên hoặc SĐT để tag hồ sơ khách…" className={inpCls} />
            {results.length > 0 && (
              <div className="max-h-36 overflow-y-auto mt-1 border border-slate-100 rounded-xl divide-y">
                {results.map(r => (
                  <button key={r.appointment_id} onClick={() => { setPicked(r); setName(r.customer_name || ''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">
                    <span className="font-medium text-slate-700">{r.customer_name}</span> <span className="text-slate-400">· {r.phone}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Tag để tự kết nối hồ sơ khách + gán kho media với khách. Không tag thì tạo mới.</p>
          </>
        )}
      </Field>

      <Field label="Tên khách hàng *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Tên khách" className={inpCls} /></Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Nguồn Source (link)"><input value={sourceLink} onChange={e => setSourceLink(e.target.value)} placeholder="https://drive.google.com/..." className={inpCls} /></Field>
        <Field label="ID Source"><input value={sourceId} onChange={e => setSourceId(e.target.value)} placeholder="VD: Dung27062026_01" className={inpCls} /></Field>
      </div>

      <Field label="Link clip đã dựng * (link riêng clip)">
        <textarea value={clip} onChange={e => setClip(e.target.value)} rows={2} placeholder="https://drive.google.com/..." className={inpCls} />
        <button type="button" onClick={() => videoRef.current?.click()} disabled={uploadingVideo} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-100 disabled:opacity-50">
          {uploadingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {uploadingVideo ? 'Đang tải video…' : 'Tải video trực tiếp (bật player TikTok)'}
        </button>
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={onPickVideo} />
        <p className="text-[11px] text-slate-400 mt-1">Dán link Google Drive để phát cơ bản, hoặc tải file video trực tiếp để dùng trình phát kiểu TikTok (double-tap thả tim, tua mượt).</p>
      </Field>

      <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh thumbnail * (tải trực tiếp)</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {thumbs.map((u, i) => (
          <div key={i} className="relative">
            <img src={u} alt="thumb" className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
            <button type="button" onClick={() => setThumbs(p => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><X className="w-3 h-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-teal-400 hover:text-teal-500 disabled:opacity-50">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="text-[10px] mt-0.5">{uploading ? 'Đang tải' : 'Tải ảnh'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      </div>

      <Field label="Ghi chú"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inpCls} /></Field>
      <ModalActions onClose={onClose} onSave={save} saving={saving} saveLabel="Thêm Video Ads" />
    </Modal>
  );
};

// ---------- Khung modal chung ----------
// ---------- Modal: Tự động thêm nguồn từ Drive ----------
const AutoImportModal = ({ me, stores, onClose, onSaved }) => {
  const [links, setLinks] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState({});
  const [saving, setSaving] = useState(false);
  const [defMediaId, setDefMediaId] = useState(null);
  const [defMediaName, setDefMediaName] = useState('Đặng Hồng Khôi');

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').ilike('full_name', '%Đặng Hồng Khôi%').limit(1).maybeSingle()
      .then(({ data }) => { if (data) { setDefMediaId(data.id); setDefMediaName(data.full_name); } });
  }, []);

  const norm = (x) => (x || '').trim().toLowerCase();
  const folderId = (l) => { const m = (l || '').match(/\/folders\/([\w-]+)/) || (l || '').match(/[?&]id=([\w-]+)/) || (l || '').match(/\/d\/([\w-]+)/); return m ? m[1] : null; };
  // Tập ID thư mục đã có (từ nguồn thêm tay) — so khớp theo ID nên bỏ qua khác biệt định dạng URL
  const existingIds = new Set(stores.flatMap(s => (s.source_links || []).map(folderId).filter(Boolean)));
  // Phân loại: đã có (trùng ID thư mục Drive) / nghi trùng (trùng tên + gần ngày) / mới
  const classify = (p) => {
    if ((p.driveId && existingIds.has(p.driveId)) || existingIds.has(folderId(p.link))) return { kind: 'exists' };
    const dup = stores.find(s => norm(s.customer_name) === norm(p.name)
      && s.shoot_date && p.date && Math.abs((new Date(s.shoot_date) - new Date(p.date)) / 86400000) <= 10);
    return dup ? { kind: 'dup', store: dup } : { kind: 'new' };
  };

  const doScan = async () => {
    const arr = parseLinks(links);
    if (!arr.length) { toast.error('Dán link thư mục gốc (dịch vụ / master) trước'); return; }
    setScanning(true);
    try {
      const d = await scanDriveSources(arr);
      const seen = new Set();
      const parsed = (d.sources || []).map(parseSourceCandidate).filter(p => { if (seen.has(p.link)) return false; seen.add(p.link); return true; });
      setRows(parsed);
      // mặc định: nguồn MỚI được tick, nghi trùng / đã có KHÔNG tick
      const s = {}; parsed.forEach(p => { s[p.driveId] = classify(p).kind === 'new'; });
      setSel(s);
      if (!parsed.length) toast('Không tìm thấy thư mục nguồn nào (tên dạng "DD.MM Tên khách…")', { icon: 'ℹ️' });
      else toast.success(`Tìm thấy ${parsed.length} nguồn`);
    } catch (e) { toast.error('Quét lỗi: ' + e.message); }
    setScanning(false);
  };

  const inRange = (p) => (!from || (p.date && p.date >= from)) && (!to || (p.date && p.date <= to));
  const all = (rows || []).map(p => ({ ...p, ...classify(p) })).filter(inRange);
  const news = all.filter(p => p.kind === 'new');
  const dups = all.filter(p => p.kind === 'dup');
  const existsN = all.filter(p => p.kind === 'exists').length;
  const chosen = all.filter(p => p.kind !== 'exists' && sel[p.driveId]);

  const doImport = async () => {
    if (!chosen.length) { toast.error('Chọn ít nhất 1 nguồn để thêm'); return; }
    setSaving(true);
    const payload = chosen.map(p => ({
      customer_name: p.name || 'Chưa rõ', source_links: [p.link], source_id: p.source_id || null,
      shoot_date: p.date || null, service: p.service || null,
      media_id: me.id, media_in_charge_id: defMediaId, media_in_charge: defMediaName,
      source_status: 'chua_dung',
    }));
    const { error } = await supabase.from('media_customers').insert(payload);
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success(`Đã thêm ${payload.length} nguồn từ Drive`);
    onSaved();
  };

  const Row = ({ p, warn }) => (
    <label className="flex items-start gap-2.5 p-2.5 text-sm hover:bg-slate-50 cursor-pointer">
      <input type="checkbox" checked={!!sel[p.driveId]} onChange={e => setSel(s => ({ ...s, [p.driveId]: e.target.checked }))} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-700 truncate">{p.name || '(không rõ tên)'}</div>
        <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
          <span>ID: {p.source_id || '—'}</span><span>· Ngày: {p.date || '—'}</span><span>· DV: {p.service || '—'}</span>
        </div>
        {warn && p.store && <div className="text-[11px] text-amber-600 mt-0.5">⚠️ Giống nguồn đã có: <b>{p.store.customer_name}</b> · {p.store.shoot_date || '—'}</div>}
      </div>
    </label>
  );
  const toggleGroup = (grp, val) => setSel(s => { const n = { ...s }; grp.forEach(p => { n[p.driveId] = val; }); return n; });

  return (
    <Modal title="Tự động thêm nguồn từ Drive" onClose={onClose} wide>
      <p className="text-sm text-slate-500 mb-2">Dán link <b>thư mục gốc</b> (thư mục dịch vụ như “Xương hàm mặt”, hoặc thư mục tổng). Hệ thống quét sâu tìm các thư mục nguồn dạng <b>“DD.MM Tên khách…”</b> rồi tự điền tên · dịch vụ · ngày · ID · link.</p>
      <textarea value={links} onChange={e => setLinks(e.target.value)} rows={2} placeholder="https://drive.google.com/drive/folders/... (mỗi dòng 1 link)" className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none mb-2" />
      <div className="flex items-end gap-2 flex-wrap mb-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Từ ngày</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-teal-400" /></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Đến ngày</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-teal-400" /></div>
        <button onClick={doScan} disabled={scanning} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-60">{scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Quét thư mục</button>
        {rows && <span className="text-[11px] text-slate-400 pb-2.5">Media mặc định: <b>{defMediaName}</b></span>}
      </div>

      {rows && (
        <>
          {rows.length > 0 && (from || to) && <p className="text-[11px] text-slate-400 mb-2">Đang lọc theo khoảng ngày — hiện {all.length}/{rows.length} nguồn.</p>}

          {news.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-sm font-bold text-teal-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Nguồn mới ({news.length})</h4>
                <div className="flex gap-2 text-[11px] font-semibold"><button onClick={() => toggleGroup(news, true)} className="text-teal-600">Chọn hết</button><button onClick={() => toggleGroup(news, false)} className="text-slate-400">Bỏ chọn</button></div>
              </div>
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-[32vh] overflow-y-auto">
                {news.map(p => <Row key={p.driveId} p={p} />)}
              </div>
            </div>
          )}

          {dups.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-sm font-bold text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Nghi trùng ({dups.length}) — trùng tên &amp; gần ngày với nguồn đã có</h4>
                <button onClick={() => toggleGroup(dups, true)} className="text-[11px] font-semibold text-amber-600">Vẫn thêm tất cả</button>
              </div>
              <div className="border-2 border-amber-200 bg-amber-50/40 rounded-xl divide-y divide-amber-100 max-h-[28vh] overflow-y-auto">
                {dups.map(p => <Row key={p.driveId} p={p} warn />)}
              </div>
            </div>
          )}

          {news.length === 0 && dups.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Không có nguồn mới trong khoảng đã chọn.{existsN > 0 ? ` (${existsN} nguồn đã có sẵn)` : ''}</p>}
          {existsN > 0 && <p className="text-[11px] text-slate-400 mb-2">{existsN} nguồn đã có sẵn trong kho — đã bỏ qua.</p>}

          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
            <button onClick={doImport} disabled={saving || !chosen.length} className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 inline-flex items-center gap-1.5">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Thêm {chosen.length} nguồn</button>
          </div>
        </>
      )}
    </Modal>
  );
};

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} shadow-xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
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
    <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50 text-sm">{saving ? 'Đang lưu…' : saveLabel}</button>
  </div>
);

export default ContentProductionPage;
