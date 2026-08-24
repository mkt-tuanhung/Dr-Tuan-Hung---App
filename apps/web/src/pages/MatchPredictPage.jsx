import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload.js';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { ChevronLeft, Trophy, QrCode, X, Download, Copy, Minus, Plus, Crown, Target, Users, Radio, Settings, Sparkles, ImagePlus, Loader2, Link2, Lock, CheckCircle2, Ban, FileDown, Zap } from 'lucide-react';

// ===== MINIGAME DỰ ĐOÁN BÓNG ĐÁ — theo đặc tả v2.0 (VN vs Thái Lan, AFF Cup) =====
// - Phiếu: tỉ số + cầu thủ ghi bàn (1 hoặc nhiều, CẢ 2 ĐỘI, có ô "Không có bàn thắng")
//   + 1 cầu thủ xuất sắc nhất trận. Sửa được tới GIỜ KHÓA (lock_at, mặc định trước bóng lăn 5').
// - Điểm: đúng tỉ số +100 · mỗi cầu thủ ghi bàn đúng +20 · đúng MVP +30.
//   Đồng điểm: ưu tiên đúng tỉ số > nhiều cầu thủ ghi bàn đúng hơn > gửi phiếu sớm hơn.
// - Trước giờ khóa KHÔNG công khai phiếu chi tiết của người khác (chỉ hiện số người tham gia).
// - Admin: điều khiển trận (trạng thái, +1 bàn kèm người ghi bàn, MVP), ảnh cầu thủ, xuất CSV.

const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
const fmtD = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN') : '';
const shortName = (n) => String(n || '').split(' ').slice(-2).join(' ');
const PTS_DEFAULT = { exact: 100, scorer: 20, mvp: 30 };

const ROLE_LABELS = { admin: 'Quản trị', marketing: 'Marketing', truc_page: 'Trực page', telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', dieu_duong: 'Điều dưỡng', bac_si: 'Bác sĩ', accountant: 'Kế toán', media: 'Media', editor: 'Editor', designer: 'Designer', seeding: 'Seeding', shareholder: 'Cổ đông' };
const dept = (nguoi) => nguoi?.position || ROLE_LABELS[nguoi?.role] || nguoi?.role || '';

// Dự đoán ghi bàn: mảng tên (tương thích bản cũ 1 tên ở cột scorer)
const predScorers = (p) => Array.isArray(p.scorers) && p.scorers.length ? p.scorers : (p.scorer ? [p.scorer] : []);

const getPts = (cfg) => ({ ...PTS_DEFAULT, ...(cfg.points || {}) });
const correctScorerCount = (p, cfg) => {
  const actual = (cfg.scorers || []).map(s => s.player || s);
  return predScorers(p).filter(n => actual.includes(n)).length;
};
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

// Avatar: có ảnh -> ảnh thật; chưa có -> số áo trên nền màu đội
const PlayerAvatar = ({ p, team = 'a', size = 46 }) => p.photo
  ? <img src={p.photo} alt={p.name} className="rounded-full object-cover border-2 border-white shadow shrink-0" style={{ width: size, height: size }} />
  : <span className="rounded-full grid place-items-center font-black text-white border-2 border-white shadow shrink-0" style={{ width: size, height: size, background: team === 'a' ? 'linear-gradient(135deg,#da251d,#8f1611)' : 'linear-gradient(135deg,#2d2a6e,#191740)', fontSize: size * 0.34 }}>{p.num}</span>;

// Nền thẻ cầu thủ theo quốc kỳ: VN = đỏ sao vàng · Thái = sọc đỏ–trắng–xanh
const STAR_CLIP = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
const teamBgStyle = (team) => team === 'a'
  ? { background: 'radial-gradient(circle at 50% 40%, #e4392f 0%, #c8102e 55%, #8f1611 100%)' }
  : { background: 'linear-gradient(180deg,#ef3340 0%,#ef3340 15%,#f4f5f8 15%,#f4f5f8 31%,#2d2a6e 31%,#2d2a6e 69%,#f4f5f8 69%,#f4f5f8 85%,#ef3340 85%,#ef3340 100%)' };
const TeamBackdrop = ({ team }) => team === 'a'
  ? <span className="absolute inset-0 grid place-items-center"><span style={{ width: '58%', aspectRatio: '1 / 1', background: '#ffcd00', clipPath: STAR_CLIP, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.25))' }} /></span>
  : null;

// Thẻ cầu thủ: ảnh trên nền cờ + tên. variant 'scorer' (xanh, chọn nhiều) | 'mvp' (vàng + 👑, chọn 1)
const POS_VI = { GK: 'Thủ môn', DF: 'Hậu vệ', MF: 'Tiền vệ', FW: 'Tiền đạo' };
const PlayerCard = ({ p, team = 'a', flag, on, disabled, onClick, delay = 0, variant = 'scorer' }) => {
  const mvp = variant === 'mvp';
  const onCls = mvp ? 'border-amber-400 ring-2 ring-amber-200' : 'border-emerald-500 ring-2 ring-emerald-200';
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`mg-card relative rounded-2xl border-2 overflow-hidden text-left transition bg-white active:scale-95 ${on ? `${onCls} mg-pop` : 'border-slate-100 hover:border-slate-200 hover:-translate-y-0.5 hover:shadow-md'} disabled:opacity-60`}
      style={{ animationDelay: `${delay}ms` }}>
      <div className="relative h-20 sm:h-28 w-full overflow-hidden" style={teamBgStyle(team)}>
        <TeamBackdrop team={team} />
        {p.photo
          ? <img src={p.photo} alt={p.name} loading="lazy" className="relative w-full h-full object-contain object-bottom" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.35))' }} />
          : <span className="absolute inset-0 grid place-items-center text-3xl sm:text-4xl font-black" style={{ color: team === 'a' ? '#7f1d1d' : '#ffffffd9', textShadow: '0 1px 3px rgba(0,0,0,.25)' }}>{p.num}</span>}
        <span className="absolute top-1.5 left-1.5 min-w-6 h-6 px-1 rounded-lg bg-black/55 text-white text-[11px] font-black grid place-items-center">{p.num}</span>
        {on && (
          <span className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-white grid place-items-center shadow mg-check ${mvp ? 'bg-amber-400' : 'bg-emerald-500'}`}>
            {mvp ? <Crown className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-4 h-4" />}
          </span>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className={`text-[11px] sm:text-[11.5px] font-bold leading-tight truncate ${on ? (mvp ? 'text-amber-600' : 'text-emerald-700') : 'text-slate-700'}`}>{p.name}</div>
        <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5">{flag} {POS_VI[p.pos] || p.pos}</div>
      </div>
    </button>
  );
};

const Stepper = ({ value, onChange, disabled, color }) => (
  <div className="flex items-center gap-2.5">
    <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} className="w-10 h-10 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Minus className="w-4 h-4" /></button>
    <span className="w-16 h-16 rounded-2xl grid place-items-center text-4xl font-black text-white shadow-inner tabular-nums" style={{ background: color }}>{value}</span>
    <button type="button" disabled={disabled || value >= 20} onClick={() => onChange(value + 1)} className="w-10 h-10 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Plus className="w-4 h-4" /></button>
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
  const [tab, setTab] = useState('my');            // my | rank
  const [qrOpen, setQrOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: g }, { data: ps }] = await Promise.all([
      supabase.from('minigames').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('minigame_predictions').select('*, nguoi:profiles!user_id(full_name, role, position)').eq('game_id', gameId).order('created_at', { ascending: true }),
    ]);
    setGame(g || null); setPreds(ps || []); setLoading(false);
  }, [gameId]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('minigames,minigame_predictions', load);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cfg = game?.config || {};
  const A = cfg.team_a || { name: 'Đội A', flag: '🏳️', color: '#334155' };
  const B = cfg.team_b || { name: 'Đội B', flag: '🏳️', color: '#334155' };
  const squadA = (cfg.squad || []).map(p => ({ ...p, team: 'a' }));
  const squadB = (cfg.squad_b || []).map(p => ({ ...p, team: 'b' }));
  const allPlayers = [...squadA, ...squadB];
  const kickoff = cfg.kickoff ? new Date(cfg.kickoff) : null;
  const lockAt = cfg.lock_at ? new Date(cfg.lock_at) : (kickoff ? new Date(kickoff.getTime() - 5 * 60000) : null);
  const locked = (cfg.match_status && cfg.match_status !== 'upcoming') || (lockAt && now >= lockAt.getTime());
  const PTS = getPts(cfg);

  // ---- Phiếu của tôi ----
  const mine = preds.find(p => p.user_id === me?.id);
  const [f, setF] = useState(null);
  useEffect(() => {
    if (f !== null || loading) return;
    setF({
      pred_a: mine?.pred_a ?? 0, pred_b: mine?.pred_b ?? 0,
      scorers: mine ? predScorers(mine) : [], mvp: mine?.mvp ?? null,
      noGoal: !!mine && predScorers(mine).length === 0,
    });
  }, [mine, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const savePred = async () => {
    setSaving(true);
    const { error } = await supabase.from('minigame_predictions').upsert({
      game_id: gameId, user_id: me.id,
      pred_a: f.pred_a, pred_b: f.pred_b,
      scorers: f.scorers || [], scorer: (f.scorers || [])[0] || null,
      mvp: f.mvp,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'game_id,user_id' });
    setSaving(false);
    if (error) return toast.error(/policy|security/i.test(error.message) ? 'Đã quá giờ khóa dự đoán!' : 'Lỗi: ' + error.message);
    toast.success(mine ? 'Đã cập nhật phiếu dự đoán ⚽' : 'Đã gửi phiếu dự đoán ⚽'); load();
  };
  const toggleScorer = (name) => {
    const cur = f.scorers || [];
    if (cur.includes(name)) return setF({ ...f, scorers: cur.filter(n => n !== name), noGoal: false });
    setF({ ...f, scorers: [...cur, name], noGoal: false });
  };

  // ---- Đếm ngược ----
  const cd = useMemo(() => {
    if (!kickoff) return null;
    const d = kickoff.getTime() - now;
    if (d <= 0) return null;
    return { dd: Math.floor(d / 86400000), hh: Math.floor(d % 86400000 / 3600000), mm: Math.floor(d % 3600000 / 60000) };
  }, [kickoff, now]);

  // ---- Xếp hạng (đồng điểm: đúng tỉ số > nhiều ghi bàn đúng > gửi sớm) ----
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

  if (loading) return <div className={`flex items-center justify-center h-60 ${standalone ? 'min-h-screen bg-slate-50' : ''}`}><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!game) return <div className={`grid place-items-center h-60 text-slate-400 ${standalone ? 'min-h-screen bg-slate-50' : ''}`}>Không tìm thấy trận đấu.</div>;

  const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

  // ---- Khối giữa banner theo trạng thái ----
  const centerView = () => {
    if (cfg.match_status === 'live') return (
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-300 tracking-widest"><span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" /> ĐANG THI ĐẤU{cfg.live_minute ? ` · ${cfg.live_minute}'` : ''}</div>
        <div className="text-6xl font-black tabular-nums mt-1 drop-shadow">{cfg.score_a ?? 0} - {cfg.score_b ?? 0}</div>
      </div>
    );
    if (cfg.match_status === 'finished') return (
      <div className="text-center">
        <div className="text-[11px] font-black text-emerald-300 tracking-widest">KẾT THÚC</div>
        <div className="text-6xl font-black tabular-nums mt-1 drop-shadow">{cfg.score_a ?? 0} - {cfg.score_b ?? 0}</div>
        {cfg.mvp && <div className="mt-1.5 text-[12px] text-amber-300 font-bold inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> MVP: {cfg.mvp}</div>}
      </div>
    );
    return (
      <div className="text-center">
        <div className="inline-block bg-white/10 border border-white/15 rounded-2xl px-5 py-2 text-3xl sm:text-4xl font-black tabular-nums backdrop-blur-sm">{kickoff ? kickoff.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'VS'}</div>
        <div className="text-[11.5px] text-white/60 mt-1.5 font-semibold">{kickoff ? `${fmtD(cfg.kickoff)} · ${cfg.stadium || cfg.venue || ''}` : ''}</div>
        {cd && (
          <div className="flex items-center justify-center gap-1.5 mt-2.5">
            {[[cd.dd, 'NGÀY'], [cd.hh, 'GIỜ'], [cd.mm, 'PHÚT']].map(([v, l], i) => (
              <React.Fragment key={l}>
                {i > 0 && <span className="text-white/40 font-black">:</span>}
                <div className="bg-white/10 border border-white/15 rounded-xl w-12 py-1.5 text-center backdrop-blur-sm">
                  <div className="text-lg font-black tabular-nums leading-none">{String(v).padStart(2, '0')}</div>
                  <div className="text-[8px] text-white/50 font-black tracking-widest mt-0.5">{l}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---- Phiếu tóm tắt ----
  const TicketSummary = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="text-[10.5px] font-black tracking-widest text-slate-400 mb-3">PHIẾU DỰ ĐOÁN</div>
      <div className="flex items-center justify-center gap-3 text-3xl font-black text-slate-800 tabular-nums">
        <span className="text-xl">{A.flag}</span>{f?.pred_a ?? 0}<span className="text-slate-300 text-xl">—</span>{f?.pred_b ?? 0}<span className="text-xl">{B.flag}</span>
      </div>
      <div className="border-t border-slate-50 mt-3 pt-3">
        <div className="text-[10.5px] text-slate-400 font-bold">Cầu thủ ghi bàn</div>
        <div className="text-[13px] font-bold text-slate-700 mt-0.5 leading-snug">
          {f?.noGoal ? 'Không có bàn thắng' : (f?.scorers?.length ? f.scorers.join(', ') : '—')}
        </div>
      </div>
      <div className="border-t border-slate-50 mt-3 pt-3">
        <div className="text-[10.5px] text-slate-400 font-bold">Xuất sắc nhất</div>
        <div className="text-[13px] font-bold text-slate-700 mt-0.5">{f?.mvp || '—'}</div>
      </div>
      <div className="mt-3">
        {locked
          ? <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-500"><Lock className="w-3 h-3" /> ĐÃ KHÓA</span>
          : mine
            ? <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> ĐÃ GỬI — sửa được tới {lockAt ? fmtDT(lockAt.toISOString()) : 'giờ khóa'}</span>
            : <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">CHƯA GỬI</span>}
      </div>
    </div>
  );
  const PointsCard = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="text-[13px] font-bold text-slate-700 mb-2">Cách tính điểm</div>
      {[[`+${PTS.exact}`, 'Đúng tỉ số'], [`+${PTS.scorer}`, 'Mỗi cầu thủ ghi bàn đúng'], [`+${PTS.mvp}`, 'Đúng cầu thủ xuất sắc nhất']].map(([v, l]) => (
        <div key={l} className="flex items-center gap-2.5 py-1 text-[12.5px]"><b className="text-emerald-600 w-10">{v}</b><span className="text-slate-600">{l}</span></div>
      ))}
      <p className="text-[10.5px] text-slate-400 mt-1.5">Đồng điểm: ưu tiên đúng tỉ số → nhiều cầu thủ ghi bàn đúng hơn → gửi phiếu sớm hơn.</p>
    </div>
  );

  return (
    <div className={standalone ? 'min-h-screen bg-slate-50 pb-10' : 'space-y-4'}>
      <style>{`
        @keyframes mgFadeUp { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes mgPopIn  { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
        @keyframes mgCheck  { 0% { transform: scale(0) rotate(-30deg); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
        .mg-card  { animation: mgFadeUp .45s cubic-bezier(.2,.7,.3,1) both; }
        .mg-pop   { animation: mgPopIn .28s ease; }
        .mg-check { animation: mgCheck .3s cubic-bezier(.2,.7,.3,1.4); }
      `}</style>
      <div className={standalone ? 'max-w-5xl mx-auto px-3 pt-3 space-y-4' : 'space-y-4'}>
        {/* Thanh trên */}
        <div className="flex items-center gap-2">
          {onBack && <button onClick={onBack} className="w-9 h-9 grid place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800 truncate">{game.title}</div>
            <div className="text-[11px] text-slate-400">{cfg.venue || 'AFF Cup'}</div>
          </div>
          <button onClick={() => setQrOpen(true)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50"><QrCode className="w-4 h-4" /> Mã QR</button>
          {isAdmin && <button onClick={() => setAdminOpen(v => !v)} className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold ${adminOpen ? 'bg-slate-800 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><Settings className="w-4 h-4" /> Điều khiển</button>}
        </div>

        {/* ===== BANNER SÂN VẬN ĐỘNG ===== */}
        <div className="relative overflow-hidden rounded-3xl text-white shadow-xl px-4 pt-5 pb-6" style={{ background: 'linear-gradient(160deg,#0a3d2c 0%,#0e5a40 48%,#0a3d2c 100%)' }}>
          {/* vạch sân */}
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 70px), repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 70px)' }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border border-white/10" />
          <div className="relative text-center text-[10px] font-black tracking-[0.25em] text-amber-300/90 mb-4">● {String(cfg.round || 'TRẬN ĐẤU').toUpperCase()}</div>
          <div className="relative grid grid-cols-3 items-center gap-2">
            <div className="text-center sm:text-left sm:pl-4">
              <div className="text-5xl sm:text-6xl leading-none drop-shadow">{A.flag}</div>
              <div className="font-black mt-2 text-lg sm:text-2xl tracking-wide">{A.name?.toUpperCase()}</div>
              <div className="text-[10.5px] text-white/50 font-semibold">{A.nickname || A.short}</div>
            </div>
            {centerView()}
            <div className="text-center sm:text-right sm:pr-4">
              <div className="text-5xl sm:text-6xl leading-none drop-shadow">{B.flag}</div>
              <div className="font-black mt-2 text-lg sm:text-2xl tracking-wide">{B.name?.toUpperCase()}</div>
              <div className="text-[10.5px] text-white/50 font-semibold">{B.nickname || B.short}</div>
            </div>
          </div>
          {(cfg.scorers || []).length > 0 && (
            <div className="relative mt-4 text-center text-[12px] text-white/80">⚽ {(cfg.scorers || []).map(s => `${s.player || s}${s.minute ? ` ${s.minute}'` : ''}`).join(' · ')}</div>
          )}
        </div>

        {/* Dải thông tin lượt đi + giờ khóa */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-3.5 py-2.5 text-[12.5px] text-amber-900 flex-wrap">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="flex-1 min-w-0">{cfg.leg1_note ? <b>{cfg.leg1_note} </b> : null}Dự đoán sẽ khóa lúc <b>{lockAt ? fmtDT(lockAt.toISOString()) : '—'}</b>.</span>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold shrink-0 ${cfg.match_status === 'live' ? 'text-rose-600' : 'text-emerald-700'}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.match_status === 'live' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} /> Tỉ số trực tiếp
          </span>
        </div>

        {/* ADMIN */}
        {isAdmin && adminOpen && <AdminControl game={game} cfg={cfg} squadA={squadA} squadB={squadB} preds={ranked} onSaved={load} />}

        {/* ===== TABS ===== */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center border-b border-slate-100 px-2 sm:px-4">
            {[['my', 'Dự đoán của tôi', Target], ['rank', 'Bảng xếp hạng', Trophy]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-[13.5px] font-bold border-b-2 -mb-px transition ${tab === k ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
            <span className="ml-auto text-[11.5px] text-slate-400 pr-2 sm:pr-3 shrink-0">{preds.length.toLocaleString('vi-VN')} người đã tham gia</span>
          </div>

          {/* ---- TAB 1: PHIẾU CỦA TÔI ---- */}
          {tab === 'my' && f && (
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5">
              <div className="space-y-6 min-w-0">
                {/* 1. Tỉ số */}
                <section>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[13px] font-black shrink-0">1</span>
                    <h4 className="font-bold text-slate-800">Dự đoán tỉ số chung cuộc</h4>
                  </div>
                  <p className="text-[11.5px] text-slate-400 ml-9 mb-3">Tính cả thời gian thi đấu chính thức</p>
                  <div className="flex items-start justify-center gap-6 sm:gap-14 py-2">
                    {[{ t: A, k: 'pred_a' }, { t: B, k: 'pred_b' }].map(({ t, k }) => (
                      <div key={k} className="flex flex-col items-center gap-2">
                        <div className="text-[13px] font-bold text-slate-600">{t.flag} {t.name}</div>
                        <Stepper value={f[k]} onChange={v => setF({ ...f, [k]: v })} disabled={locked} color={t.color} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* 2. Cầu thủ ghi bàn */}
                <section>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[13px] font-black shrink-0">2</span>
                    <h4 className="font-bold text-slate-800">Cầu thủ ghi bàn</h4>
                  </div>
                  <p className="text-[11.5px] text-slate-400 ml-9 mb-3">Chọn một hoặc nhiều cầu thủ Việt Nam {f.scorers?.length > 0 && <b className="text-emerald-600">— đã chọn {f.scorers.length}</b>}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
                    {squadA.map((p, i) => (
                      <PlayerCard key={'sc' + p.num + p.name} p={p} team="a" flag={A.flag} delay={i * 30}
                        on={(f.scorers || []).includes(p.name)} disabled={locked} onClick={() => toggleScorer(p.name)} />
                    ))}
                    {/* Không có bàn thắng */}
                    <button type="button" disabled={locked} onClick={() => setF({ ...f, scorers: [], noGoal: !f.noGoal })}
                      className={`mg-card rounded-2xl border-2 grid place-items-center p-3 transition min-h-[110px] active:scale-95 ${f.noGoal ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50 mg-pop' : 'border-dashed border-slate-200 hover:border-slate-300 bg-slate-50/50'} disabled:opacity-60`}
                      style={{ animationDelay: `${squadA.length * 30}ms` }}>
                      <div className="text-center">
                        <Ban className={`w-6 h-6 mx-auto mb-1.5 ${f.noGoal ? 'text-emerald-600' : 'text-slate-300'}`} />
                        <div className={`text-[11.5px] font-bold ${f.noGoal ? 'text-emerald-700' : 'text-slate-500'}`}>Không có bàn thắng</div>
                        <div className="text-[10px] text-slate-400">VN không ghi bàn</div>
                      </div>
                    </button>
                  </div>
                </section>

                {/* 3. MVP */}
                <section>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[13px] font-black shrink-0">3</span>
                    <h4 className="font-bold text-slate-800">Cầu thủ xuất sắc nhất trận</h4>
                  </div>
                  <p className="text-[11.5px] text-slate-400 ml-9 mb-3">Chỉ chọn một cầu thủ Việt Nam {f.mvp && <b className="text-amber-600">— 👑 {f.mvp}</b>}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
                    {squadA.map((p, i) => (
                      <PlayerCard key={'mvp' + p.num + p.name} p={p} team="a" flag={A.flag} variant="mvp" delay={i * 30}
                        on={f.mvp === p.name} disabled={locked} onClick={() => setF({ ...f, mvp: f.mvp === p.name ? null : p.name })} />
                    ))}
                  </div>
                </section>

                {!locked && (
                  <button onClick={savePred} disabled={saving} className="w-full h-13 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-[15px] hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/15">
                    {saving ? 'Đang lưu…' : (mine ? 'CẬP NHẬT PHIẾU DỰ ĐOÁN' : 'GỬI PHIẾU DỰ ĐOÁN')}
                  </button>
                )}
                {locked && <div className="text-center text-[13px] text-slate-400 flex items-center justify-center gap-1.5"><Lock className="w-4 h-4" /> Phiếu đã khóa lúc {lockAt ? fmtDT(lockAt.toISOString()) : ''}</div>}
              </div>

              {/* Sidebar phiếu + điểm */}
              <div className="space-y-3 lg:sticky lg:top-3 self-start">
                <TicketSummary />
                <PointsCard />
              </div>
            </div>
          )}

          {/* ---- TAB 2: BẢNG XẾP HẠNG ---- */}
          {tab === 'rank' && (
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-slate-800">Bảng xếp hạng dự đoán</h4>
                  <div className="text-[11px] text-slate-400 mt-0.5">{cfg.match_status === 'finished' ? 'Đã chốt kết quả — chúc mừng các nhà tiên tri! 🏆' : locked ? 'Trận đang diễn ra — điểm chốt khi kết thúc' : 'Phiếu chi tiết công khai sau giờ khóa'}</div>
                </div>
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500">Thể lệ: +{PTS.exact} tỉ số · +{PTS.scorer}/ghi bàn · +{PTS.mvp} MVP</span>
              </div>

              {!locked ? (
                <div className="text-center py-10 text-slate-400">
                  <Lock className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  Dự đoán của mọi người được <b>giữ kín tới giờ khóa</b> ({lockAt ? fmtDT(lockAt.toISOString()) : ''}) cho công bằng.<br />
                  Hiện đã có <b className="text-emerald-600">{preds.length.toLocaleString('vi-VN')}</b> người tham gia{mine ? ' (bạn đã gửi phiếu ✓)' : ''}.
                </div>
              ) : ranked.length === 0 ? (
                <div className="text-center py-10 text-slate-300">Chưa có ai dự đoán.</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {ranked.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-3 px-2 py-2.5 rounded-xl ${cfg.match_status === 'finished' && i < 3 ? 'bg-amber-50/60' : ''}`}>
                      {cfg.match_status === 'finished' && (
                        <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-[12px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'text-slate-400'}`}>{i + 1}</span>
                      )}
                      <span className="w-9 h-9 shrink-0 rounded-full bg-slate-800 text-white grid place-items-center text-[12px] font-black">{initials(p.nguoi?.full_name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold text-slate-800 truncate">{p.nguoi?.full_name || '—'}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {dept(p.nguoi)}{dept(p.nguoi) ? ' · ' : ''}<b className="text-emerald-700">{p.pred_a}-{p.pred_b}</b>
                          {predScorers(p).length > 0 && <> · ⚽ {predScorers(p).map(shortName).join(', ')}</>}
                          {p.mvp && <> · 👑 {shortName(p.mvp)}</>}
                        </div>
                      </div>
                      {p.pts != null && <b className="text-[14px] text-slate-800 shrink-0 tabular-nums">{p.pts} điểm</b>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {qrOpen && <QrModal game={game} onClose={() => setQrOpen(false)} />}
    </div>
  );
};

// ================= ADMIN: điều khiển trận / ảnh cầu thủ / xuất CSV =================
const AdminControl = ({ game, cfg, squadA, squadB, preds, onSaved }) => {
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null);
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
  const stripPhoto = (team, i, url) => {
    const k = team === 'a' ? 'squad' : 'squad_b';
    const list = (team === 'a' ? squadA : squadB).map(({ team: _t, ...p }) => p);
    patch({ [k]: list.map((p, j) => j === i ? { ...p, photo: url || null } : p) });
  };
  const uploadPhoto = async (team, i, file, name) => {
    if (!file) return;
    setUploadingKey(team + i);
    try {
      const url = await uploadToR2(file, 'players');
      await stripPhoto(team, i, url);
      toast.success(`Đã gắn ảnh ${name}`);
    } catch (e) { toast.error('Upload lỗi: ' + (e?.message || e)); }
    setUploadingKey(null);
  };
  const pastePhoto = (team, i, p) => {
    const url = prompt(`Dán link ảnh cho ${p.name} (bỏ trống để XOÁ ảnh):`, p.photo || '');
    if (url === null) return;
    stripPhoto(team, i, url.trim());
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
  // Bình chọn chỉ dùng đội VN -> quản trị MVP/ảnh cũng chỉ cần đội VN
  const allP = squadA.map((p, i) => ({ ...p, i }));

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-4 space-y-3 shadow-xl">
      <div className="text-[12px] font-black tracking-widest text-white/60 flex items-center gap-1.5"><Radio className="w-4 h-4" /> BẢNG ĐIỀU KHIỂN TRẬN ĐẤU (admin — mọi người thấy realtime)</div>
      <div className="flex flex-wrap gap-2">
        {[['upcoming', 'Chưa bắt đầu'], ['live', '🔴 Đang đá'], ['finished', 'Kết thúc']].map(([k, label]) => (
          <button key={k} disabled={busy} onClick={() => patch({ match_status: k })}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold ${cfg.match_status === k ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>{label}</button>
        ))}
        <button disabled={busy} onClick={() => { const m = prompt('Phút thi đấu hiện tại (bỏ trống để ẩn):', cfg.live_minute || ''); if (m !== null) patch({ live_minute: m.trim() || null }); }} className="px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20">Phút: {cfg.live_minute || '—'}</button>
        <button disabled={busy} onClick={() => patch({ score_a: 0, score_b: 0, scorers: [], mvp: null, live_minute: null, match_status: 'upcoming' })} className="px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-rose-300">Reset</button>
        <button onClick={exportCsv} className="ml-auto px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 inline-flex items-center gap-1.5"><FileDown className="w-4 h-4" /> Xuất CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => addGoal('a')} className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-black text-sm">+1 BÀN {cfg.team_a?.flag} {cfg.team_a?.short || ''}</button>
        <button disabled={busy} onClick={() => addGoal('b')} className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-black text-sm">+1 BÀN {cfg.team_b?.flag} {cfg.team_b?.short || ''}</button>
      </div>
      <div>
        <div className="text-[11px] font-bold text-white/50 mb-1.5">Chọn MVP (khi kết thúc):</div>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
          {allP.map(p => (
            <button key={'m' + p.team + p.num + p.name} disabled={busy} onClick={() => patch({ mvp: cfg.mvp === p.name ? null : p.name })}
              className={`px-2.5 h-8 rounded-full text-[11px] font-bold ${cfg.mvp === p.name ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>#{p.num} {shortName(p.name)}</button>
          ))}
        </div>
      </div>
      {/* Ảnh cầu thủ: upload (kho R2) hoặc dán link */}
      <div>
        <button onClick={() => setPhotoOpen(v => !v)} className="text-[11px] font-bold text-white/50 hover:text-white/80 inline-flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> ẢNH CẦU THỦ {photoOpen ? '▲' : '▼'}</button>
        {photoOpen && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {allP.map(p => (
              <div key={'ph' + p.team + p.num + p.name} className="flex items-center gap-2 bg-white/5 rounded-xl px-2 py-1.5">
                <PlayerAvatar p={p} team={p.team} size={34} />
                <span className="text-[11px] font-bold flex-1 min-w-0 truncate">{p.team === 'a' ? cfg.team_a?.flag : cfg.team_b?.flag} #{p.num} {p.name}</span>
                <label className="cursor-pointer w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/25" title="Tải ảnh từ máy">
                  {uploadingKey === p.team + p.i ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingKey != null} onChange={e => uploadPhoto(p.team, p.i, e.target.files?.[0], p.name)} />
                </label>
                <button onClick={() => pastePhoto(p.team, p.i, p)} className="w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/25" title="Dán link ảnh"><Link2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ================= MÃ QR vào trang dự đoán =================
const QrModal = ({ game, onClose }) => {
  const url = `${window.location.origin}/du-doan/${game.id}`;
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#0a3d2c' } }).then(setQr); }, [url]);
  const download = async () => {
    const cfg = game.config || {};
    const W = 640, H = 880;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0a3d2c'; ctx.fillRect(0, 0, W, 190);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = `900 40px ${FONT}`; ctx.fillText('DỰ ĐOÁN TỈ SỐ', W / 2, 74);
    ctx.font = `800 30px ${FONT}`; ctx.fillText(`${cfg.team_a?.name || ''} vs ${cfg.team_b?.name || ''}`, W / 2, 124);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(cfg.kickoff ? `${new Date(cfg.kickoff).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${new Date(cfg.kickoff).toLocaleDateString('vi-VN')}` : '', W / 2, 162);
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = qr; });
    ctx.drawImage(img, (W - 480) / 2, 230, 480, 480);
    ctx.fillStyle = '#0a3d2c'; ctx.font = `900 30px ${FONT}`; ctx.fillText('QUÉT MÃ ĐỂ DỰ ĐOÁN', W / 2, 780);
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
