import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload.js';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { ChevronLeft, Trophy, QrCode, X, Download, Copy, Minus, Plus, Crown, Target, Radio, Settings, Sparkles, ImagePlus, Loader2, Link2, Lock, CheckCircle2, Ban, FileDown, Pencil } from 'lucide-react';

// ===== MINIGAME DỰ ĐOÁN: VIỆT NAM vs THÁI LAN — giao diện theo mockup mobile =====
// Phiếu: tỉ số + cầu thủ VN ghi bàn (1 hoặc nhiều) + 1 cầu thủ xuất sắc nhất (đội VN).
// Đã gửi phiếu -> hiện THẺ TÓM TẮT như mockup; bấm "Sửa phiếu" để đổi (tới giờ khóa).
// Điểm: đúng tỉ số +100 · mỗi cầu thủ ghi bàn đúng +20 · đúng MVP +30.

const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
const shortName = (n) => String(n || '').split(' ').slice(-2).join(' ');
const posLabel = (p) => p === 'GK' ? 'Thủ môn' : p === 'DF' ? 'Hậu vệ' : p === 'MF' ? 'Tiền vệ' : 'Tiền đạo';
const PTS_DEFAULT = { exact: 100, scorer: 20, mvp: 30 };
const ROLE_LABELS = { admin: 'Quản trị', marketing: 'Marketing', truc_page: 'Trực page', telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', dieu_duong: 'Điều dưỡng', bac_si: 'Bác sĩ', accountant: 'Kế toán', media: 'Media', editor: 'Editor', designer: 'Designer', seeding: 'Seeding', shareholder: 'Cổ đông' };
const dept = (nguoi) => nguoi?.position || ROLE_LABELS[nguoi?.role] || nguoi?.role || '';

const predScorers = (p) => Array.isArray(p.scorers) && p.scorers.length ? p.scorers : (p.scorer ? [p.scorer] : []);
const getPts = (cfg) => ({ ...PTS_DEFAULT, ...(cfg.points || {}) });
const correctScorerCount = (p, cfg) => { const actual = (cfg.scorers || []).map(s => s.player || s); return predScorers(p).filter(n => actual.includes(n)).length; };
const isExact = (p, cfg) => p.pred_a === (Number(cfg.score_a) || 0) && p.pred_b === (Number(cfg.score_b) || 0);
const calcPoints = (p, cfg) => {
  if (cfg.match_status !== 'finished') return null;
  const PTS = getPts(cfg);
  let pts = 0;
  if (isExact(p, cfg)) pts += PTS.exact;
  pts += correctScorerCount(p, cfg) * PTS.scorer;
  if (p.mvp && cfg.mvp && p.mvp === cfg.mvp) pts += PTS.mvp;
  return pts;
};

// ===== TẨY NỀN TỰ ĐỘNG (nền trắng / caro sáng) =====
const fetchImageBlob = async (url) => {
  try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) return await r.blob(); } catch { /* thử proxy */ }
  const r2 = await fetch('https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')));
  if (!r2.ok) throw new Error('Không tải được ảnh');
  return await r2.blob();
};
const cleanLightBg = async (source) => {
  const blob = typeof source === 'string' ? await fetchImageBlob(source) : source;
  const bmp = await createImageBitmap(blob);
  const maxDim = 1100;
  const sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const W = Math.max(1, Math.round(bmp.width * sc)), H = Math.max(1, Math.round(bmp.height * sc));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, W, H); bmp.close?.();
  const img = ctx.getImageData(0, 0, W, H); const d = img.data;
  const isBg = (p) => { const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 10) return true; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx >= 165 && (mx - mn) <= 36; };
  const seen = new Uint8Array(W * H); const stack = [];
  const tryPush = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (seen[p]) return; seen[p] = 1; if (isBg(p)) stack.push(p); };
  for (let x = 0; x < W; x++) { tryPush(x, 0); tryPush(x, H - 1); }
  for (let y = 0; y < H; y++) { tryPush(0, y); tryPush(W - 1, y); }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop(); d[p * 4 + 3] = 0; removed++;
    const x = p % W, y = (p / W) | 0;
    tryPush(x + 1, y); tryPush(x - 1, y); tryPush(x, y + 1); tryPush(x, y - 1);
  }
  if (removed < W * H * 0.02) return null;
  ctx.putImageData(img, 0, 0);
  const out = await new Promise(res => c.toBlob(res, 'image/png'));
  return out ? new File([out], 'player.png', { type: 'image/png' }) : null;
};

// ===== CỜ VẼ CSS (thẻ bo góc như mockup) =====
const STAR_CLIP = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
const VNFlag = ({ className = '' }) => (
  <span className={`relative inline-block rounded-xl overflow-hidden shadow-lg ${className}`} style={{ background: '#da251d' }}>
    <span className="absolute inset-0 grid place-items-center"><span style={{ width: '46%', aspectRatio: '1/1', background: '#ffcd00', clipPath: STAR_CLIP }} /></span>
  </span>
);
const THFlag = ({ className = '' }) => (
  <span className={`inline-block rounded-xl overflow-hidden shadow-lg ${className}`}
    style={{ background: 'linear-gradient(180deg,#ef3340 0%,#ef3340 16%,#f4f5f8 16%,#f4f5f8 32%,#2d2a6e 32%,#2d2a6e 68%,#f4f5f8 68%,#f4f5f8 84%,#ef3340 84%)' }} />
);

// Icon QUẢ BÓNG vẽ SVG (không dùng emoji)
const BallIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2l4.2 3.1-1.6 4.9H9.4L7.8 10.3z" fill="currentColor" stroke="none" />
    <path d="M12 3v4.2M4 9.8l3.8.5M20 9.8l-3.8.5M6.6 19.2l2.8-4M17.4 19.2l-2.8-4" />
  </svg>
);

// Nền thẻ cầu thủ: đỏ sao vàng
const vnCardBg = { background: 'radial-gradient(circle at 50% 40%, #e4392f 0%, #c8102e 55%, #8f1611 100%)' };
const VNBackdrop = () => (
  <span className="absolute inset-0 grid place-items-center"><span style={{ width: '58%', aspectRatio: '1 / 1', background: '#ffcd00', clipPath: STAR_CLIP, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.25))' }} /></span>
);

const PlayerAvatar = ({ p, size = 40 }) => p.photo
  ? <span className="relative inline-block rounded-full overflow-hidden border-2 border-white shadow shrink-0" style={{ width: size, height: size, ...vnCardBg }}><img src={p.photo} alt={p.name} className="w-full h-full object-cover object-top" /></span>
  : <span className="rounded-full grid place-items-center font-black text-white border-2 border-white shadow shrink-0" style={{ width: size, height: size, background: 'linear-gradient(135deg,#da251d,#8f1611)', fontSize: size * 0.34 }}>{p.num}</span>;

// Thẻ cầu thủ (chọn ghi bàn) — ảnh trên nền cờ đỏ sao vàng
const PlayerCard = ({ p, on, disabled, onClick }) => (
  <button type="button" disabled={disabled} onClick={onClick}
    className={`mg-card relative rounded-2xl border-2 overflow-hidden text-left transition-all duration-200 bg-white ${on ? 'border-emerald-500 ring-2 ring-emerald-200 scale-[1.02]' : 'border-slate-100 hover:border-slate-200 hover:scale-[1.02] active:scale-95'} disabled:opacity-60`}>
    <div className="relative h-24 sm:h-28 w-full overflow-hidden" style={vnCardBg}>
      <VNBackdrop />
      {p.photo
        ? <img src={p.photo} alt={p.name} className="relative w-full h-full object-contain object-bottom" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.35))' }} />
        : <span className="absolute inset-0 grid place-items-center text-4xl font-black" style={{ color: '#7f1d1d', textShadow: '0 1px 3px rgba(255,255,255,.3)' }}>{p.num}</span>}
      <span className="absolute top-1.5 left-1.5 min-w-6 h-6 px-1 rounded-lg bg-black/55 text-white text-[11px] font-black grid place-items-center">{p.num}</span>
      {on && <span className="mg-pop absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-500 text-white grid place-items-center shadow"><CheckCircle2 className="w-4 h-4" /></span>}
    </div>
    <div className="px-2 py-1.5">
      <div className={`text-[11.5px] font-bold leading-tight truncate ${on ? 'text-emerald-700' : 'text-slate-700'}`}>{p.name}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{posLabel(p.pos)}</div>
    </div>
  </button>
);

const Stepper = ({ value, onChange, disabled, color }) => (
  <div className="flex items-center gap-2.5">
    <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} className="w-10 h-10 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 active:scale-90 transition disabled:opacity-30"><Minus className="w-4 h-4" /></button>
    <span className="w-16 h-16 rounded-2xl grid place-items-center text-4xl font-black text-white shadow-inner tabular-nums" style={{ background: color }}>{value}</span>
    <button type="button" disabled={disabled || value >= 20} onClick={() => onChange(value + 1)} className="w-10 h-10 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 active:scale-90 transition disabled:opacity-30"><Plus className="w-4 h-4" /></button>
  </div>
);

const MatchPredictPage = ({ gameId: propGameId, onBack, standalone = false }) => {
  const params = useParams();
  const gameId = propGameId || params.id;
  const { profile: me } = useAuth();
  const isAdmin = [me?.role, me?.role_2].includes('admin');

  const [game, setGame] = useState(null);
  const [preds, setPreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState('my');
  const [editing, setEditing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: g }, { data: ps }] = await Promise.all([
      supabase.from('minigames').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('minigame_predictions').select('*, nguoi:profiles!user_id(full_name, role, position, avatar_url)').eq('game_id', gameId).order('created_at', { ascending: true }),
    ]);
    setGame(g || null); setPreds(ps || []); setLoading(false);
  }, [gameId]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('minigames,minigame_predictions', load);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cfg = game?.config || {};
  const A = cfg.team_a || { name: 'Việt Nam', color: '#da251d' };
  const B = cfg.team_b || { name: 'Thái Lan', color: '#2d2a6e' };
  const squad = (cfg.squad || []);                       // CHỈ đội hình VIỆT NAM
  const kickoff = cfg.kickoff ? new Date(cfg.kickoff) : null;
  const lockAt = cfg.lock_at ? new Date(cfg.lock_at) : (kickoff ? new Date(kickoff.getTime() - 5 * 60000) : null);
  const locked = (cfg.match_status && cfg.match_status !== 'upcoming') || (lockAt && now >= lockAt.getTime());
  const PTS = getPts(cfg);

  const mine = preds.find(p => p.user_id === me?.id);
  const [f, setF] = useState(null);
  useEffect(() => {
    if (f !== null || loading) return;
    setF({ pred_a: mine?.pred_a ?? 0, pred_b: mine?.pred_b ?? 0, scorers: mine ? predScorers(mine) : [], mvp: mine?.mvp ?? null, noGoal: !!mine && predScorers(mine).length === 0 });
  }, [mine, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const savePred = async () => {
    setSaving(true);
    const { error } = await supabase.from('minigame_predictions').upsert({
      game_id: gameId, user_id: me.id,
      pred_a: f.pred_a, pred_b: f.pred_b,
      scorers: f.scorers || [], scorer: (f.scorers || [])[0] || null, mvp: f.mvp,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'game_id,user_id' });
    setSaving(false);
    if (error) return toast.error(/policy|security/i.test(error.message) ? 'Đã quá giờ khóa dự đoán!' : 'Lỗi: ' + error.message);
    toast.success(mine ? 'Đã cập nhật phiếu dự đoán!' : 'Đã gửi phiếu dự đoán!');
    setEditing(false); load();
  };
  const toggleScorer = (name) => {
    const cur = f.scorers || [];
    if (cur.includes(name)) return setF({ ...f, scorers: cur.filter(n => n !== name), noGoal: false });
    setF({ ...f, scorers: [...cur, name], noGoal: false });
  };

  const cd = useMemo(() => {
    if (!kickoff) return null;
    const d = kickoff.getTime() - now;
    if (d <= 0) return null;
    return { dd: Math.floor(d / 86400000), hh: Math.floor(d % 86400000 / 3600000), mm: Math.floor(d % 3600000 / 60000), ss: Math.floor(d % 60000 / 1000) };
  }, [kickoff, now]);

  const ranked = useMemo(() => {
    const list = preds.map(p => ({ ...p, pts: calcPoints(p, cfg) }));
    if (cfg.match_status === 'finished') {
      list.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0)
        || (isExact(b, cfg) ? 1 : 0) - (isExact(a, cfg) ? 1 : 0)
        || correctScorerCount(b, cfg) - correctScorerCount(a, cfg)
        || new Date(a.created_at) - new Date(b.created_at));
    }
    return list;
  }, [preds, cfg]);

  // Thống kê dự đoán: tỉ số / cầu thủ ghi bàn / MVP được chọn nhiều nhất
  const stats = useMemo(() => {
    const cnt = (map, k) => { if (!k) return; map[k] = (map[k] || 0) + 1; };
    const score = {}, scorer = {}, mvp = {};
    preds.forEach(p => {
      cnt(score, `${p.pred_a}-${p.pred_b}`);
      predScorers(p).forEach(n => cnt(scorer, n));
      cnt(mvp, p.mvp);
    });
    const top = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
    return { score: top(score, 5), scorer: top(scorer, 5), mvp: top(mvp, 3), total: preds.length };
  }, [preds]);

  if (loading) return <div className={`flex items-center justify-center h-60 ${standalone ? 'min-h-screen bg-slate-50' : ''}`}><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!game) return <div className={`grid place-items-center h-60 text-slate-400 ${standalone ? 'min-h-screen bg-slate-50' : ''}`}>Không tìm thấy trận đấu.</div>;

  const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const playerByName = (name) => squad.find(p => p.name === name);
  const showForm = !mine || editing;

  // ===== khối giữa banner theo trạng thái =====
  const centerView = () => {
    if (cfg.match_status === 'live') return (
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-black text-rose-300 tracking-[0.2em]"><span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />LIVE{cfg.live_minute ? ` · ${cfg.live_minute}'` : ''}</div>
        <div className="text-5xl sm:text-6xl font-black tabular-nums mt-1 drop-shadow">{cfg.score_a ?? 0} - {cfg.score_b ?? 0}</div>
      </div>
    );
    if (cfg.match_status === 'finished') return (
      <div className="text-center">
        <div className="text-[10px] font-black text-emerald-300 tracking-[0.25em]">KẾT THÚC</div>
        <div className="text-5xl sm:text-6xl font-black tabular-nums mt-1 drop-shadow">{cfg.score_a ?? 0} - {cfg.score_b ?? 0}</div>
        {cfg.mvp && <div className="mt-1 text-[11px] text-amber-300 font-bold inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> {cfg.mvp}</div>}
      </div>
    );
    return (
      <div className="text-center">
        <div className="text-[11px] font-bold text-white/60 tracking-wide">{kickoff ? `${kickoff.toLocaleDateString('vi-VN').replace(/\//g, '.')} • ${(cfg.stadium || 'MỸ ĐÌNH').toUpperCase().replace('SVĐ ', '')}` : ''}</div>
        <div className="text-6xl sm:text-7xl font-black tabular-nums leading-none mt-1 drop-shadow">{kickoff ? kickoff.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'VS'}</div>
        {cd && <>
          <div className="text-[11px] text-white/55 font-semibold mt-2">Bắt đầu sau</div>
          <div className="inline-flex items-center bg-black/40 border border-white/10 rounded-2xl px-4 py-1.5 mt-1 text-lg font-black tabular-nums tracking-wide backdrop-blur-sm">
            {cd.dd > 0 && <span className="mr-1.5 text-[12px] text-amber-300">{cd.dd} ngày</span>}
            {String(cd.hh).padStart(2, '0')} : {String(cd.mm).padStart(2, '0')} : {String(cd.ss).padStart(2, '0')}
          </div>
        </>}
      </div>
    );
  };

  return (
    <div className={standalone ? 'min-h-screen bg-slate-50 pb-10' : ''}>
      {/* Animation keyframes */}
      <style>{`
        @keyframes mgFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes mgPop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.18)}100%{transform:scale(1);opacity:1}}
        .mg-fade{animation:mgFadeUp .5s cubic-bezier(.2,.7,.3,1) both}
        .mg-d1{animation-delay:.06s}.mg-d2{animation-delay:.14s}.mg-d3{animation-delay:.22s}
        .mg-pop{animation:mgPop .28s cubic-bezier(.2,.7,.3,1) both}
      `}</style>
      <div className={`space-y-3.5 ${standalone ? 'max-w-2xl mx-auto px-3 pt-3' : 'max-w-2xl mx-auto'}`}>
        {/* ===== Thanh trên ===== */}
        <div className="mg-fade bg-white rounded-3xl border border-slate-100 shadow-sm px-3 py-2.5 flex items-center gap-2">
          {onBack
            ? <button onClick={onBack} className="w-10 h-10 grid place-items-center rounded-2xl text-slate-400 hover:bg-slate-50 shrink-0"><ChevronLeft className="w-6 h-6" /></button>
            : <span className="w-2" />}
          <div className="min-w-0 flex-1">
            <div className="font-black text-slate-800 text-[17px] leading-tight truncate">{A.name} vs {B.name}</div>
            <div className="text-[12px] text-slate-400 truncate">{cfg.round || 'Chung kết'} • AFF Cup 2026</div>
          </div>
          <button onClick={() => setQrOpen(true)} title="Mã QR" className="w-10 h-10 grid place-items-center rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shrink-0"><QrCode className="w-5 h-5" /></button>
          {isAdmin && <button onClick={() => setAdminOpen(v => !v)} title="Điều khiển" className={`w-10 h-10 grid place-items-center rounded-2xl shrink-0 ${adminOpen ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Settings className="w-5 h-5" /></button>}
        </div>

        {/* ===== BANNER ===== */}
        <div className="mg-fade mg-d1 relative overflow-hidden rounded-[28px] text-white shadow-xl px-4 pt-4 pb-4" style={{ background: 'linear-gradient(165deg,#07301f 0%,#0d5233 55%,#07301f 100%)' }}>
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 64px), repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 64px)' }} />
          <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-white/10" />
          {/* pill vòng đấu */}
          <div className="relative flex justify-center">
            <span className="inline-flex items-center gap-2 bg-black/45 rounded-full px-5 py-1.5 text-[11px] font-black tracking-[0.3em] text-amber-300 backdrop-blur-sm"><span className="w-1.5 h-1.5 rounded-full bg-amber-300" />{String(cfg.round || 'CHUNG KẾT').toUpperCase()}</span>
          </div>
          {/* 2 đội + giữa */}
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-1 mt-4">
            <div className="text-center">
              <VNFlag className="w-20 h-14 sm:w-24 sm:h-16" />
              <div className="font-black mt-2.5 text-lg sm:text-2xl tracking-wide">{A.name?.toUpperCase()}</div>
              <div className="text-[11px] text-white/50 font-semibold">{A.nickname || 'Sao Vàng'}</div>
            </div>
            <div className="px-1 min-w-[150px] sm:min-w-[210px]">{centerView()}</div>
            <div className="text-center">
              <THFlag className="w-20 h-14 sm:w-24 sm:h-16" />
              <div className="font-black mt-2.5 text-lg sm:text-2xl tracking-wide">{B.name?.toUpperCase()}</div>
              <div className="text-[11px] text-white/50 font-semibold">{B.nickname || 'Voi chiến'}</div>
            </div>
          </div>
          {/* thanh đen: lượt đi + giờ khóa */}
          <div className="relative mt-4 bg-black/45 rounded-2xl px-4 py-2.5 flex items-center gap-2 backdrop-blur-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.match_status === 'live' ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[12.5px] font-semibold text-white/85 flex-1 min-w-0 truncate">{cfg.leg1_note || 'Trận chung kết AFF Cup 2026'}</span>
            <span className="text-[12.5px] font-black text-amber-300 shrink-0">{locked ? 'ĐÃ KHÓA' : `Khóa lúc ${lockAt ? lockAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}`}</span>
          </div>
          {(cfg.scorers || []).length > 0 && (
            <div className="relative mt-2.5 text-center text-[12px] text-white/80 inline-flex w-full items-center justify-center gap-1.5"><BallIcon className="w-3.5 h-3.5 shrink-0" /><span>{(cfg.scorers || []).map(s => `${s.player || s}${s.minute ? ` ${s.minute}'` : ''}`).join(' · ')}</span></div>
          )}
        </div>

        {/* ADMIN */}
        {isAdmin && adminOpen && <AdminControl game={game} cfg={cfg} squad={squad} preds={ranked} onSaved={load} />}

        {/* ===== TABS dạng viên thuốc ===== */}
        <div className="mg-fade mg-d2 bg-white rounded-full border border-slate-100 shadow-sm p-1.5 flex">
          {[['my', 'Dự đoán của tôi', Target], ['rank', 'Bảng xếp hạng', Trophy]].map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 h-11 rounded-full inline-flex items-center justify-center gap-1.5 text-[14px] font-bold transition-all ${tab === k ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon className="w-4 h-4" /> {label}
              {k === 'rank' && <span className={`min-w-6 h-6 px-1.5 rounded-full text-[11px] font-black grid place-items-center ${tab === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{preds.length}</span>}
            </button>
          ))}
        </div>

        {/* ===== TAB: DỰ ĐOÁN CỦA TÔI ===== */}
        {tab === 'my' && f && !showForm && (
          /* ---- THẺ TÓM TẮT (đã gửi phiếu) — theo mockup ---- */
          <div className="mg-fade mg-d3 bg-white rounded-[28px] border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-2xl font-black text-slate-800">Dự đoán của tôi</h3>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Đã gửi phiếu</span>
            </div>
            {/* tỉ số */}
            <div className="mt-4 bg-slate-50 rounded-3xl border border-slate-100 px-5 py-5 grid grid-cols-[1fr_auto_1fr] items-center">
              <div className="text-center">
                <div className="text-[11px] font-black tracking-widest text-slate-400">{A.name?.toUpperCase()}</div>
                <div className="text-5xl font-black tabular-nums mt-1" style={{ color: A.color || '#da251d' }}>{mine.pred_a}</div>
              </div>
              <span className="text-2xl font-black text-slate-300 px-3">—</span>
              <div className="text-center">
                <div className="text-[11px] font-black tracking-widest text-slate-400">{B.name?.toUpperCase()}</div>
                <div className="text-5xl font-black tabular-nums mt-1" style={{ color: B.color || '#2d2a6e' }}>{mine.pred_b}</div>
              </div>
            </div>
            {/* ghi bàn */}
            <div className="mt-5">
              <div className="text-[11.5px] font-black tracking-widest text-slate-400 mb-2">CẦU THỦ GHI BÀN</div>
              {predScorers(mine).length === 0 ? (
                <div className="text-[13.5px] text-slate-500 bg-slate-50 rounded-2xl px-4 py-3 inline-flex items-center gap-2"><Ban className="w-4 h-4 text-slate-400" /> Không có bàn thắng (0–0)</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {predScorers(mine).map(name => {
                    const p = playerByName(name);
                    return (
                      <div key={name} className="flex items-center gap-3 bg-slate-50 rounded-2xl border border-slate-100 px-3 py-2.5">
                        {p ? <PlayerAvatar p={p} size={40} /> : <span className="w-10 h-10 rounded-full grid place-items-center font-black text-white shrink-0" style={{ background: 'linear-gradient(135deg,#da251d,#8f1611)' }}>{initials(name)}</span>}
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-slate-800 truncate">{name}</div>
                          <div className="text-[11px] text-slate-400">{p ? `${posLabel(p.pos)} • ${A.name}` : A.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* MVP */}
            {mine.mvp && (
              <div className="mt-5">
                <div className="text-[11.5px] font-black tracking-widest text-slate-400 mb-2">CẦU THỦ XUẤT SẮC NHẤT</div>
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white" style={{ background: 'linear-gradient(135deg,#07301f,#0d5233)' }}>
                  {(() => { const p = playerByName(mine.mvp); return p
                    ? <span className="w-11 h-11 rounded-full grid place-items-center font-black text-amber-300 bg-white/10 border border-amber-300/40 shrink-0 overflow-hidden">{p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover object-top" /> : p.num}</span>
                    : <Crown className="w-6 h-6 text-amber-300 shrink-0" />; })()}
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-black truncate">{mine.mvp}</div>
                    <div className="text-[11px] text-white/60">Lựa chọn của bạn</div>
                  </div>
                  <span className="mg-pop w-7 h-7 rounded-full bg-emerald-500 grid place-items-center shrink-0"><CheckCircle2 className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /></span>
                </div>
              </div>
            )}
            {/* nút sửa */}
            {!locked
              ? <button onClick={() => setEditing(true)} className="mt-5 w-full h-12 rounded-2xl border-2 border-emerald-600 text-emerald-700 font-black text-[14.5px] hover:bg-emerald-50 active:scale-[0.99] transition inline-flex items-center justify-center gap-2"><Pencil className="w-4 h-4" /> SỬA PHIẾU DỰ ĐOÁN</button>
              : <div className="mt-5 text-center text-[12.5px] text-slate-400 inline-flex w-full items-center justify-center gap-1.5"><Lock className="w-4 h-4" /> Phiếu đã khóa — chờ kết quả trận đấu</div>}
          </div>
        )}

        {tab === 'my' && f && showForm && (
          /* ---- FORM DỰ ĐOÁN (chưa gửi / đang sửa) ---- */
          <div className="mg-fade mg-d3 bg-white rounded-[28px] border border-slate-100 shadow-sm p-4 sm:p-5 space-y-6">
            {/* 1. Tỉ số */}
            <section>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[13px] font-black shrink-0">1</span>
                <h4 className="font-bold text-slate-800">Dự đoán tỉ số chung cuộc</h4>
              </div>
              <p className="text-[11.5px] text-slate-400 ml-9 mb-3">Tính cả thời gian thi đấu chính thức</p>
              <div className="flex items-start justify-center gap-8 sm:gap-14 py-1">
                {[{ t: A, k: 'pred_a', F: VNFlag }, { t: B, k: 'pred_b', F: THFlag }].map(({ t, k, F }) => (
                  <div key={k} className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-600"><F className="w-6 h-4" /> {t.name}</div>
                    <Stepper value={f[k]} onChange={v => setF({ ...f, [k]: v })} disabled={locked} color={t.color} />
                  </div>
                ))}
              </div>
            </section>
            {/* 2. Ghi bàn — CHỈ đội VN */}
            <section>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[13px] font-black shrink-0">2</span>
                <h4 className="font-bold text-slate-800">Cầu thủ Việt Nam ghi bàn</h4>
              </div>
              <p className="text-[11.5px] text-slate-400 ml-9 mb-3">Chọn một hoặc nhiều cầu thủ {f.scorers?.length > 0 && <b className="text-emerald-600">— đã chọn {f.scorers.length}</b>}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {squad.map(p => (
                  <PlayerCard key={p.num + p.name} p={p} on={(f.scorers || []).includes(p.name)} disabled={locked} onClick={() => toggleScorer(p.name)} />
                ))}
                <button type="button" disabled={locked} onClick={() => setF({ ...f, scorers: [], noGoal: !f.noGoal })}
                  className={`rounded-2xl border-2 grid place-items-center p-3 transition min-h-[120px] ${f.noGoal ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50' : 'border-dashed border-slate-200 hover:border-slate-300 bg-slate-50/50'} disabled:opacity-60`}>
                  <div className="text-center">
                    <Ban className={`w-6 h-6 mx-auto mb-1.5 ${f.noGoal ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <div className={`text-[11.5px] font-bold ${f.noGoal ? 'text-emerald-700' : 'text-slate-500'}`}>Không có bàn thắng</div>
                  </div>
                </button>
              </div>
            </section>
            {/* 3. MVP — CHỈ đội VN */}
            <section>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[13px] font-black shrink-0">3</span>
                <h4 className="font-bold text-slate-800">Cầu thủ xuất sắc nhất trận</h4>
              </div>
              <p className="text-[11.5px] text-slate-400 ml-9 mb-3">Chỉ chọn một cầu thủ</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {squad.map(p => {
                  const on = f.mvp === p.name;
                  return (
                    <button key={'mvp' + p.num + p.name} type="button" disabled={locked} onClick={() => setF({ ...f, mvp: on ? null : p.name })}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left transition-all ${on ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-200 bg-white'} active:scale-[0.98] disabled:opacity-60`}>
                      <PlayerAvatar p={p} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] font-bold truncate ${on ? 'text-emerald-700' : 'text-slate-700'}`}>{p.name}</div>
                        <div className="text-[10.5px] text-slate-400">#{p.num} · {posLabel(p.pos)}</div>
                      </div>
                      {on && <span className="mg-pop"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /></span>}
                    </button>
                  );
                })}
              </div>
            </section>
            {/* Cách tính điểm */}
            <div className="bg-slate-50 rounded-2xl p-3.5">
              <div className="text-[12px] font-bold text-slate-600 mb-1.5">Cách tính điểm</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                <span><b className="text-emerald-600">+{PTS.exact}</b> đúng tỉ số</span>
                <span><b className="text-emerald-600">+{PTS.scorer}</b> mỗi cầu thủ ghi bàn đúng</span>
                <span><b className="text-emerald-600">+{PTS.mvp}</b> đúng xuất sắc nhất</span>
              </div>
            </div>
            {!locked ? (
              <div className="flex gap-2">
                {mine && <button onClick={() => setEditing(false)} className="px-5 h-12 rounded-2xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Hủy</button>}
                <button onClick={savePred} disabled={saving} className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-black text-[15px] hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60 shadow-lg shadow-emerald-900/15">
                  {saving ? 'Đang lưu…' : (mine ? 'CẬP NHẬT PHIẾU' : 'GỬI PHIẾU DỰ ĐOÁN')}
                </button>
              </div>
            ) : <div className="text-center text-[13px] text-slate-400 flex items-center justify-center gap-1.5"><Lock className="w-4 h-4" /> Đã quá giờ khóa dự đoán</div>}
          </div>
        )}

        {/* ===== TAB: BẢNG XẾP HẠNG (biểu đồ + thẻ dự đoán) ===== */}
        {tab === 'rank' && ranked.length === 0 && (
          <div className="mg-fade mg-d3 bg-white rounded-[28px] border border-slate-100 shadow-sm p-8 text-center text-slate-300">Chưa có ai dự đoán — làm người đầu tiên nào!</div>
        )}
        {tab === 'rank' && ranked.length > 0 && (
          <>
            {/* --- BIỂU ĐỒ THỐNG KÊ --- */}
            <div className="mg-fade mg-d2 bg-white rounded-[28px] border border-slate-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h4 className="font-black text-slate-800 text-lg">Thống kê dự đoán</h4>
                <span className="text-[10.5px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-50 text-slate-500 shrink-0 text-right leading-tight">+{PTS.exact} tỉ số<br />+{PTS.scorer}/ghi bàn · +{PTS.mvp} MVP</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Tỉ số được chọn nhiều nhất */}
                <div>
                  <div className="text-[11.5px] font-black tracking-widest text-slate-400 mb-2.5 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-emerald-600" /> TỈ SỐ ĐƯỢC CHỌN NHIỀU NHẤT</div>
                  <div className="space-y-2">
                    {stats.score.map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2.5">
                        <span className="w-12 text-[14px] font-black text-slate-700 tabular-nums shrink-0">{k}</span>
                        <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(v / stats.total * 100)}%`, background: 'linear-gradient(90deg,#10b981,#059669)' }} />
                        </div>
                        <span className="w-14 text-right text-[11.5px] font-bold text-slate-500 shrink-0">{v} · {Math.round(v / stats.total * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Cầu thủ được dự đoán ghi bàn nhiều nhất */}
                <div>
                  <div className="text-[11.5px] font-black tracking-widest text-slate-400 mb-2.5 flex items-center gap-1.5"><BallIcon className="w-3.5 h-3.5 text-emerald-600" /> ĐƯỢC CHỌN GHI BÀN NHIỀU NHẤT</div>
                  <div className="space-y-2">
                    {stats.scorer.length === 0 ? <div className="text-[12px] text-slate-300 py-2">Chưa có lựa chọn</div> : stats.scorer.map(([name, v]) => {
                      const pl = playerByName(name);
                      const max = stats.scorer[0]?.[1] || 1;
                      return (
                        <div key={name} className="flex items-center gap-2.5">
                          {pl ? <PlayerAvatar p={pl} size={28} /> : <span className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-black text-white shrink-0" style={{ background: 'linear-gradient(135deg,#da251d,#8f1611)' }}>{initials(name)}</span>}
                          <span className="w-20 text-[11.5px] font-bold text-slate-700 truncate shrink-0">{shortName(name)}</span>
                          <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(v / max * 100)}%`, background: 'linear-gradient(90deg,#f43f5e,#c8102e)' }} />
                          </div>
                          <span className="w-8 text-right text-[11.5px] font-bold text-slate-500 shrink-0">{v}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* MVP được chọn nhiều nhất */}
                  <div className="text-[11.5px] font-black tracking-widest text-slate-400 mt-4 mb-2 flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-amber-500" /> MVP ĐƯỢC CHỌN NHIỀU NHẤT</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.mvp.length === 0 ? <div className="text-[12px] text-slate-300">Chưa có lựa chọn</div> : stats.mvp.map(([name, v], i) => (
                      <span key={name} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {i === 0 && <Crown className="w-3.5 h-3.5" />}{shortName(name)} · {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* --- THẺ DỰ ĐOÁN TỪNG NGƯỜI --- */}
            <div className="mg-fade mg-d3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ranked.map((p, i) => {
                const isMe = p.user_id === me?.id;
                const fin = cfg.match_status === 'finished';
                return (
                  <div key={p.id} className={`bg-white rounded-3xl border-2 shadow-sm p-4 relative overflow-hidden ${isMe ? 'border-emerald-300' : fin && i < 3 ? 'border-amber-200' : 'border-slate-100'}`}>
                    {fin && i < 3 && <span className={`absolute -right-6 top-3 rotate-45 text-[10px] font-black text-white px-8 py-0.5 ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-300'}`}>TOP {i + 1}</span>}
                    {/* người dự đoán */}
                    <div className="flex items-center gap-2.5">
                      {p.nguoi?.avatar_url
                        ? <img src={p.nguoi.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0" />
                        : <span className="w-10 h-10 rounded-full bg-slate-800 text-white grid place-items-center text-[13px] font-black shrink-0">{initials(p.nguoi?.full_name)}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-black text-slate-800 truncate">{p.nguoi?.full_name || '—'} {isMe && <span className="text-[10px] font-black text-emerald-600">(Bạn)</span>}</div>
                        <div className="text-[11px] text-slate-400 truncate">{dept(p.nguoi) || 'Nhân sự'}</div>
                      </div>
                      {p.pts != null && <span className="shrink-0 text-[12.5px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 tabular-nums">{p.pts}đ</span>}
                    </div>
                    {/* tỉ số */}
                    <div className="mt-3 bg-slate-50 rounded-2xl px-3 py-2.5 grid grid-cols-[1fr_auto_1fr] items-center">
                      <div className="flex items-center justify-end gap-2"><VNFlag className="w-7 h-5" /><span className="text-2xl font-black tabular-nums" style={{ color: A.color || '#da251d' }}>{p.pred_a}</span></div>
                      <span className="px-2 text-slate-300 font-black">—</span>
                      <div className="flex items-center gap-2"><span className="text-2xl font-black tabular-nums" style={{ color: B.color || '#2d2a6e' }}>{p.pred_b}</span><THFlag className="w-7 h-5" /></div>
                    </div>
                    {/* ghi bàn + MVP */}
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-start gap-1.5 text-[11.5px] text-slate-500">
                        <BallIcon className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                        {predScorers(p).length === 0 ? <span className="text-slate-300">Không chọn ghi bàn</span> : (
                          <span className="flex flex-wrap gap-1">
                            {predScorers(p).map(n => {
                              const pl = playerByName(n);
                              return <span key={n} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full pl-0.5 pr-2 py-0.5 font-bold text-slate-600">{pl ? <PlayerAvatar p={pl} size={18} /> : null}{shortName(n)}</span>;
                            })}
                          </span>
                        )}
                      </div>
                      {p.mvp && (
                        <div className="flex items-center gap-1.5 text-[11.5px]">
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-bold text-slate-600">{p.mvp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {qrOpen && <QrModal game={game} onClose={() => setQrOpen(false)} />}
    </div>
  );
};

// ================= ADMIN: điều khiển trận / ảnh cầu thủ / CSV =================
const AdminControl = ({ game, cfg, squad, preds, onSaved }) => {
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [uploadingIx, setUploadingIx] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const patch = async (changes) => {
    setBusy(true);
    const { error } = await supabase.from('minigames').update({ config: { ...cfg, ...changes } }).eq('id', game.id);
    setBusy(false);
    if (error) return toast.error('Lỗi: ' + error.message);
    onSaved?.();
  };
  const addGoal = async (side) => {
    const key = side === 'a' ? 'score_a' : 'score_b';
    const changes = { match_status: 'live', [key]: (Number(cfg[key]) || 0) + 1 };
    const name = prompt(`Ai ghi bàn cho ${side === 'a' ? cfg.team_a?.name : cfg.team_b?.name}? (gõ tên, bỏ trống nếu chưa rõ)`) || '';
    if (name.trim()) changes.scorers = [...(cfg.scorers || []), { player: name.trim() }];
    patch(changes);
  };
  const setPhoto = (i, url) => patch({ squad: squad.map((p, j) => j === i ? { ...p, photo: url || null } : p) });
  const uploadPhoto = async (i, file, name) => {
    if (!file) return;
    setUploadingIx(i);
    try {
      let toUp = file;
      try { toUp = (await cleanLightBg(file)) || file; } catch { /* giữ gốc */ }
      const url = await uploadToR2(toUp, 'players');
      await setPhoto(i, url);
      toast.success(`Đã gắn ảnh ${name} (đã tự tẩy nền)`);
    } catch (e) { toast.error('Upload lỗi: ' + (e?.message || e)); }
    setUploadingIx(null);
  };
  const pastePhoto = (i, p) => {
    const url = prompt(`Dán link ảnh cho ${p.name} (bỏ trống để XOÁ ảnh):`, p.photo || '');
    if (url === null) return;
    setPhoto(i, url.trim());
  };
  const cleanAll = async () => {
    const targets = squad.map((p, i) => ({ ...p, i })).filter(p => p.photo);
    if (!targets.length) return toast.error('Chưa có ảnh nào để xử lý');
    setCleaning(true);
    const newSquad = squad.map(p => ({ ...p }));
    let ok = 0, skip = 0, fail = 0;
    for (const p of targets) {
      toast.loading(`Đang tẩy nền ${p.name}… (${ok + skip + fail + 1}/${targets.length})`, { id: 'mg-clean' });
      try {
        const cleaned = await cleanLightBg(p.photo);
        if (!cleaned) { skip++; continue; }
        const url = await uploadToR2(cleaned, 'players');
        newSquad[p.i] = { ...newSquad[p.i], photo: url };
        ok++;
      } catch (e) { fail++; console.error('clean fail', p.name, e); }
    }
    if (ok) await patch({ squad: newSquad });
    setCleaning(false);
    toast.success(`Tẩy nền xong: ${ok} ảnh xử lý · ${skip} vốn sạch${fail ? ` · ${fail} lỗi` : ''}`, { id: 'mg-clean', duration: 9000 });
  };
  const exportCsv = () => {
    const head = ['Họ tên', 'Bộ phận', 'Tỉ số dự đoán', 'Cầu thủ ghi bàn', 'MVP', 'Điểm', 'Gửi lúc'];
    const rows = preds.map(p => [
      p.nguoi?.full_name || '', dept(p.nguoi), `${p.pred_a}-${p.pred_b}`,
      predScorers(p).join('; '), p.mvp || '', p.pts ?? '', new Date(p.created_at).toLocaleString('vi-VN'),
    ]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'du-doan-vn-thai.csv'; a.click();
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-4 space-y-3 shadow-xl">
      <div className="text-[12px] font-black tracking-widest text-white/60 flex items-center gap-1.5"><Radio className="w-4 h-4" /> BẢNG ĐIỀU KHIỂN (admin — mọi người thấy realtime)</div>
      <div className="flex flex-wrap gap-2">
        {[['upcoming', 'Chưa bắt đầu'], ['live', 'Đang đá ●'], ['finished', 'Kết thúc']].map(([k, label]) => (
          <button key={k} disabled={busy} onClick={() => patch({ match_status: k })}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold ${cfg.match_status === k ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>{label}</button>
        ))}
        <button disabled={busy} onClick={() => { const m = prompt('Phút thi đấu hiện tại (bỏ trống để ẩn):', cfg.live_minute || ''); if (m !== null) patch({ live_minute: m.trim() || null }); }} className="px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20">Phút: {cfg.live_minute || '—'}</button>
        <button disabled={busy} onClick={() => patch({ score_a: 0, score_b: 0, scorers: [], mvp: null, live_minute: null, match_status: 'upcoming' })} className="px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-rose-300">Reset</button>
        <button onClick={exportCsv} className="ml-auto px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 inline-flex items-center gap-1.5"><FileDown className="w-4 h-4" /> Xuất CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => addGoal('a')} className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-black text-sm">+1 BÀN VIỆT NAM</button>
        <button disabled={busy} onClick={() => addGoal('b')} className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-black text-sm">+1 BÀN THÁI LAN</button>
      </div>
      <div>
        <div className="text-[11px] font-bold text-white/50 mb-1.5">Chọn MVP (khi kết thúc):</div>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
          {squad.map(p => (
            <button key={'m' + p.num + p.name} disabled={busy} onClick={() => patch({ mvp: cfg.mvp === p.name ? null : p.name })}
              className={`px-2.5 h-8 rounded-full text-[11px] font-bold ${cfg.mvp === p.name ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>#{p.num} {shortName(p.name)}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setPhotoOpen(v => !v)} className="text-[11px] font-bold text-white/50 hover:text-white/80 inline-flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> ẢNH CẦU THỦ {photoOpen ? '▲' : '▼'}</button>
          <button onClick={cleanAll} disabled={cleaning} className="px-3 h-8 rounded-xl text-[11px] font-bold bg-amber-400/90 text-slate-900 hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-1.5">
            {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {cleaning ? 'Đang tẩy nền…' : 'Tẩy nền TẤT CẢ ảnh'}
          </button>
        </div>
        {photoOpen && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {squad.map((p, i) => (
              <div key={'ph' + p.num + p.name} className="flex items-center gap-2 bg-white/5 rounded-xl px-2 py-1.5">
                <PlayerAvatar p={p} size={34} />
                <span className="text-[11px] font-bold flex-1 min-w-0 truncate">#{p.num} {p.name}</span>
                <label className="cursor-pointer w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/25" title="Tải ảnh từ máy">
                  {uploadingIx === i ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingIx != null} onChange={e => uploadPhoto(i, e.target.files?.[0], p.name)} />
                </label>
                <button onClick={() => pastePhoto(i, p)} className="w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/25" title="Dán link ảnh"><Link2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ================= MÃ QR =================
const QrModal = ({ game, onClose }) => {
  const url = `${window.location.origin}/du-doan/${game.id}`;
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#07301f' } }).then(setQr); }, [url]);
  const download = async () => {
    const cfg = game.config || {};
    const W = 640, H = 880;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#07301f'; ctx.fillRect(0, 0, W, 190);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = `900 40px ${FONT}`; ctx.fillText('DỰ ĐOÁN TỈ SỐ', W / 2, 74);
    ctx.font = `800 30px ${FONT}`; ctx.fillText(`${cfg.team_a?.name || ''} vs ${cfg.team_b?.name || ''}`, W / 2, 124);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(cfg.kickoff ? `${new Date(cfg.kickoff).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${new Date(cfg.kickoff).toLocaleDateString('vi-VN')}` : '', W / 2, 162);
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = qr; });
    ctx.drawImage(img, (W - 480) / 2, 230, 480, 480);
    ctx.fillStyle = '#07301f'; ctx.font = `900 30px ${FONT}`; ctx.fillText('QUÉT MÃ ĐỂ DỰ ĐOÁN', W / 2, 780);
    ctx.fillStyle = '#94a3b8'; ctx.font = `600 18px ${FONT}`; ctx.fillText('DR TUẤN HÙNG — Minigame nội bộ', W / 2, 820);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png'); a.download = 'du-doan-vn-thai.png'; a.click();
  };
  return (
    <div className="fixed inset-0 z-[95] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 text-center" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><QrCode className="w-4 h-4 text-emerald-600" /> Quét để vào dự đoán</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        {qr ? <img src={qr} alt="QR" className="w-full rounded-2xl border border-slate-100" /> : <div className="h-72 grid place-items-center text-slate-300">Đang tạo…</div>}
        <div className="text-[11px] text-slate-400 mt-2 break-all">{url}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => { navigator.clipboard?.writeText(url); toast.success('Đã copy link'); }} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"><Copy className="w-4 h-4" /> Copy link</button>
          <button onClick={download} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 inline-flex items-center justify-center gap-1.5"><Download className="w-4 h-4" /> Tải poster</button>
        </div>
        <p className="text-[10.5px] text-slate-400 mt-2.5 flex items-center justify-center gap-1"><Sparkles className="w-3 h-3" /> In poster dán ở clinic — nhân sự quét là chơi ngay</p>
      </div>
    </div>
  );
};

export default MatchPredictPage;
