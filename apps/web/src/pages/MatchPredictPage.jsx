import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload.js';
import { toast } from 'sonner';
import { ChevronLeft, Trophy, QrCode, X, Download, Copy, Minus, Plus, Save, Crown, Target, Users, Radio, Settings, Sparkles } from 'lucide-react';

// ===== MINIGAME: DỰ ĐOÁN BÓNG ĐÁ (VN vs Thái Lan — AFF Cup) =====
// Dự đoán tỉ số + cầu thủ ghi bàn + MVP trước giờ bóng lăn.
// Admin cập nhật tỉ số/ghi bàn/MVP ngay trong trang -> realtime cho mọi người.

const fmtT = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

// Điểm: đúng tỉ số +3 · đúng kết quả (thắng/hòa/thua) +1 · đúng người ghi bàn +1 · đúng MVP +1
const calcPoints = (p, cfg) => {
  if (cfg.match_status !== 'finished') return null;
  let pts = 0;
  const sa = Number(cfg.score_a) || 0, sb = Number(cfg.score_b) || 0;
  if (p.pred_a === sa && p.pred_b === sb) pts += 3;
  else if (Math.sign(p.pred_a - p.pred_b) === Math.sign(sa - sb)) pts += 1;
  const scorers = (cfg.scorers || []).map(s => s.player || s);
  if (p.scorer && scorers.includes(p.scorer)) pts += 1;
  if (p.mvp && cfg.mvp && p.mvp === cfg.mvp) pts += 1;
  return pts;
};

// Avatar cầu thủ: có ảnh thì hiện ảnh, chưa có thì hiện số áo trên nền cờ đỏ
const PlayerAvatar = ({ p, size = 56 }) => p.photo
  ? <img src={p.photo} alt={p.name} className="rounded-full object-cover border-2 border-white shadow" style={{ width: size, height: size }} />
  : <span className="rounded-full grid place-items-center font-black text-white border-2 border-white shadow" style={{ width: size, height: size, background: 'linear-gradient(135deg,#da251d,#8f1611)', fontSize: size * 0.34 }}>{p.num}</span>;

// Lưới chọn cầu thủ (ghi bàn / MVP)
const PlayerPick = ({ squad, value, onChange, disabled }) => (
  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
    {squad.map(p => {
      const on = value === p.name;
      return (
        <button key={p.num + p.name} type="button" disabled={disabled} onClick={() => onChange(on ? null : p.name)}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl border transition text-center ${on ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 bg-white hover:bg-slate-50'} disabled:opacity-60`}>
          <PlayerAvatar p={p} size={46} />
          <span className={`text-[10px] font-bold leading-tight ${on ? 'text-emerald-700' : 'text-slate-600'}`}>{p.name.split(' ').slice(-2).join(' ')}</span>
          <span className="text-[9px] text-slate-400">#{p.num} · {p.pos}</span>
        </button>
      );
    })}
  </div>
);

const Stepper = ({ value, onChange, disabled, color }) => (
  <div className="flex items-center gap-2">
    <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Minus className="w-4 h-4" /></button>
    <span className="w-14 h-14 rounded-2xl grid place-items-center text-3xl font-black text-white shadow-inner tabular-nums" style={{ background: color }}>{value}</span>
    <button type="button" disabled={disabled || value >= 20} onClick={() => onChange(value + 1)} className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Plus className="w-4 h-4" /></button>
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
  const [qrOpen, setQrOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: g }, { data: ps }] = await Promise.all([
      supabase.from('minigames').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('minigame_predictions').select('*, nguoi:profiles!user_id(full_name)').eq('game_id', gameId).order('created_at', { ascending: true }),
    ]);
    setGame(g || null); setPreds(ps || []); setLoading(false);
  }, [gameId]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('minigames,minigame_predictions', load);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cfg = game?.config || {};
  const A = cfg.team_a || { name: 'Đội A', flag: '🏳️', color: '#334155' };
  const B = cfg.team_b || { name: 'Đội B', flag: '🏳️', color: '#334155' };
  const squad = cfg.squad || [];
  const kickoff = cfg.kickoff ? new Date(cfg.kickoff) : null;
  const locked = (cfg.match_status && cfg.match_status !== 'upcoming') || (kickoff && now >= kickoff.getTime());

  // Dự đoán của tôi
  const mine = preds.find(p => p.user_id === me?.id);
  const [f, setF] = useState(null);   // form dự đoán (khởi tạo khi có dữ liệu)
  useEffect(() => {
    if (f !== null || loading) return;
    setF({ pred_a: mine?.pred_a ?? 0, pred_b: mine?.pred_b ?? 0, scorer: mine?.scorer ?? null, mvp: mine?.mvp ?? null });
  }, [mine, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const savePred = async () => {
    setSaving(true);
    const { error } = await supabase.from('minigame_predictions').upsert({
      game_id: gameId, user_id: me.id,
      pred_a: f.pred_a, pred_b: f.pred_b, scorer: f.scorer, mvp: f.mvp,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'game_id,user_id' });
    setSaving(false);
    if (error) return toast.error(/policy|security/i.test(error.message) ? 'Đã quá giờ chốt dự đoán!' : 'Lỗi: ' + error.message);
    toast.success('Đã lưu dự đoán của bạn ⚽'); load();
  };

  // Đếm ngược
  const countdown = useMemo(() => {
    if (!kickoff) return '';
    const d = kickoff.getTime() - now;
    if (d <= 0) return '';
    const dd = Math.floor(d / 86400000), hh = Math.floor(d % 86400000 / 3600000), mm = Math.floor(d % 3600000 / 60000), ss = Math.floor(d % 60000 / 1000);
    return (dd > 0 ? `${dd} ngày ` : '') + `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }, [kickoff, now]);

  // Bảng xếp hạng (khi kết thúc thì tính điểm)
  const ranked = useMemo(() => {
    const list = preds.map(p => ({ ...p, pts: calcPoints(p, cfg) }));
    if (cfg.match_status === 'finished') list.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || new Date(a.created_at) - new Date(b.created_at));
    return list;
  }, [preds, cfg]);

  if (loading) return <div className={`flex items-center justify-center h-60 ${standalone ? 'min-h-screen bg-slate-50' : ''}`}><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (!game) return <div className={`grid place-items-center h-60 text-slate-400 ${standalone ? 'min-h-screen bg-slate-50' : ''}`}>Không tìm thấy trận đấu.</div>;

  const statusView = () => {
    if (cfg.match_status === 'live') return (
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-300 tracking-widest"><span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" /> ĐANG THI ĐẤU</div>
        <div className="text-6xl font-black tabular-nums mt-1">{cfg.score_a ?? 0} - {cfg.score_b ?? 0}</div>
      </div>
    );
    if (cfg.match_status === 'finished') return (
      <div className="text-center">
        <div className="text-[11px] font-black text-emerald-300 tracking-widest">KẾT THÚC</div>
        <div className="text-6xl font-black tabular-nums mt-1">{cfg.score_a ?? 0} - {cfg.score_b ?? 0}</div>
        {cfg.mvp && <div className="mt-1.5 text-[12px] text-amber-300 font-bold inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> MVP: {cfg.mvp}</div>}
      </div>
    );
    return (
      <div className="text-center">
        <div className="text-[11px] font-black text-white/60 tracking-widest">TRẬN ĐẤU CHƯA BẮT ĐẦU</div>
        <div className="text-4xl font-black tabular-nums mt-1">{countdown || 'VS'}</div>
        <div className="text-[12px] text-white/60 mt-1">{kickoff ? `Bóng lăn ${fmtT(cfg.kickoff)}` : ''}</div>
      </div>
    );
  };

  return (
    <div className={standalone ? 'min-h-screen bg-slate-50 pb-10' : 'space-y-4'}>
      <div className={standalone ? 'max-w-2xl mx-auto px-3 pt-3 space-y-4' : 'space-y-4'}>
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

        {/* SCOREBOARD */}
        <div className="relative overflow-hidden rounded-3xl text-white shadow-xl px-4 py-7" style={{ background: 'linear-gradient(150deg,#065f46 0%,#047857 45%,#065f46 100%)' }}>
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fff 0 2px, transparent 2px 90px)' }} />
          <div className="relative grid grid-cols-3 items-center gap-2">
            <div className="text-center">
              <div className="text-6xl leading-none drop-shadow">{A.flag}</div>
              <div className="font-black mt-2 text-lg">{A.name}</div>
              <div className="text-[10px] text-white/50 font-bold tracking-widest">{A.short}</div>
            </div>
            {statusView()}
            <div className="text-center">
              <div className="text-6xl leading-none drop-shadow">{B.flag}</div>
              <div className="font-black mt-2 text-lg">{B.name}</div>
              <div className="text-[10px] text-white/50 font-bold tracking-widest">{B.short}</div>
            </div>
          </div>
          {(cfg.scorers || []).length > 0 && (
            <div className="relative mt-4 text-center text-[12px] text-white/80">
              ⚽ {(cfg.scorers || []).map(s => `${s.player || s}${s.minute ? ` ${s.minute}'` : ''}`).join(' · ')}
            </div>
          )}
        </div>

        {/* ADMIN: điều khiển trận đấu */}
        {isAdmin && adminOpen && <AdminControl game={game} cfg={cfg} squad={squad} onSaved={load} />}

        {/* DỰ ĐOÁN CỦA TÔI */}
        {f && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5"><Target className="w-4 h-4 text-emerald-600" /> Dự đoán của tôi</div>
              {locked
                ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500">ĐÃ CHỐT</span>
                : mine && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Sửa được tới giờ bóng lăn</span>}
            </div>

            {/* Tỉ số */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 py-2">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-3xl">{A.flag}</span>
                <Stepper value={f.pred_a} onChange={v => setF({ ...f, pred_a: v })} disabled={locked} color={A.color} />
              </div>
              <span className="text-2xl font-black text-slate-300">—</span>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-3xl">{B.flag}</span>
                <Stepper value={f.pred_b} onChange={v => setF({ ...f, pred_b: v })} disabled={locked} color={B.color} />
              </div>
            </div>

            {/* Cầu thủ ghi bàn */}
            <div className="mt-4">
              <div className="text-[12px] font-bold text-slate-600 mb-2">⚽ Cầu thủ Việt Nam sẽ ghi bàn {f.scorer && <span className="text-emerald-600">— {f.scorer}</span>}</div>
              <PlayerPick squad={squad} value={f.scorer} onChange={v => setF({ ...f, scorer: v })} disabled={locked} />
            </div>

            {/* MVP */}
            <div className="mt-4">
              <div className="text-[12px] font-bold text-slate-600 mb-2"><Crown className="w-3.5 h-3.5 inline text-amber-500" /> MVP trận đấu {f.mvp && <span className="text-emerald-600">— {f.mvp}</span>}</div>
              <PlayerPick squad={squad} value={f.mvp} onChange={v => setF({ ...f, mvp: v })} disabled={locked} />
            </div>

            {!locked && (
              <button onClick={savePred} disabled={saving} className="mt-4 w-full h-12 rounded-2xl bg-emerald-600 text-white font-black text-[15px] hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                <Save className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />{saving ? 'Đang lưu…' : (mine ? 'CẬP NHẬT DỰ ĐOÁN' : 'CHỐT DỰ ĐOÁN')}
              </button>
            )}
            {locked && mine && <div className="mt-3 text-center text-[13px] text-slate-500">Bạn đã dự đoán <b>{mine.pred_a}-{mine.pred_b}</b>{mine.scorer ? <> · ghi bàn <b>{mine.scorer}</b></> : ''}{mine.mvp ? <> · MVP <b>{mine.mvp}</b></> : ''}</div>}
            {locked && !mine && <div className="mt-3 text-center text-[13px] text-slate-400">Đã quá giờ chốt — hẹn bạn trận sau nhé!</div>}
          </div>
        )}

        {/* BẢNG DỰ ĐOÁN MỌI NGƯỜI */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-5">
          <div className="text-[13px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
            {cfg.match_status === 'finished' ? <><Trophy className="w-4 h-4 text-amber-500" /> Bảng xếp hạng</> : <><Users className="w-4 h-4 text-emerald-600" /> Mọi người dự đoán ({preds.length})</>}
          </div>
          {ranked.length === 0 ? <div className="text-center text-slate-300 text-sm py-5">Chưa ai dự đoán — làm người đầu tiên nào!</div> : (
            <div className="divide-y divide-slate-50">
              {ranked.map((p, i) => (
                <div key={p.id} className="py-2 flex items-center gap-2 text-[13px] flex-wrap">
                  {cfg.match_status === 'finished' && <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-[11px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>}
                  <b className="text-slate-800">{p.nguoi?.full_name || '—'}</b>
                  <span className="font-black text-emerald-700 tabular-nums">{p.pred_a}-{p.pred_b}</span>
                  {p.scorer && <span className="text-slate-400">⚽ {p.scorer.split(' ').slice(-2).join(' ')}</span>}
                  {p.mvp && <span className="text-slate-400">👑 {p.mvp.split(' ').slice(-2).join(' ')}</span>}
                  {p.pts != null && <span className="ml-auto text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{p.pts} điểm</span>}
                </div>
              ))}
            </div>
          )}
          {cfg.match_status !== 'finished' && <p className="text-[11px] text-slate-400 mt-3">Tính điểm: đúng tỉ số <b>+3</b> · đúng kết quả <b>+1</b> · đúng người ghi bàn <b>+1</b> · đúng MVP <b>+1</b></p>}
        </div>
      </div>

      {qrOpen && <QrModal game={game} onClose={() => setQrOpen(false)} />}
    </div>
  );
};

// ================= ADMIN: cập nhật tỉ số / ghi bàn / MVP (realtime) =================
const AdminControl = ({ game, cfg, squad, onSaved }) => {
  const [busy, setBusy] = useState(false);
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
    if (side === 'a') {
      const name = prompt('Ai ghi bàn cho Việt Nam? (gõ tên, bỏ trống nếu chưa rõ)') || '';
      if (name.trim()) changes.scorers = [...(cfg.scorers || []), { player: name.trim() }];
    }
    patch(changes);
  };
  return (
    <div className="bg-slate-900 text-white rounded-3xl p-4 space-y-3 shadow-xl">
      <div className="text-[12px] font-black tracking-widest text-white/60 flex items-center gap-1.5"><Radio className="w-4 h-4" /> BẢNG ĐIỀU KHIỂN TRẬN ĐẤU (admin — mọi người thấy realtime)</div>
      <div className="flex flex-wrap gap-2">
        {[['upcoming', 'Chưa bắt đầu'], ['live', '🔴 Đang đá'], ['finished', 'Kết thúc']].map(([k, label]) => (
          <button key={k} disabled={busy} onClick={() => patch({ match_status: k })}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold ${cfg.match_status === k ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>{label}</button>
        ))}
        <button disabled={busy} onClick={() => patch({ score_a: 0, score_b: 0, scorers: [], mvp: null, match_status: 'upcoming' })} className="px-3.5 h-9 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-rose-300">Reset</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => addGoal('a')} className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-black text-sm">+1 BÀN {cfg.team_a?.flag} VN</button>
        <button disabled={busy} onClick={() => addGoal('b')} className="h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-black text-sm">+1 BÀN {cfg.team_b?.flag} Thái</button>
      </div>
      <div>
        <div className="text-[11px] font-bold text-white/50 mb-1.5">Chọn MVP (khi kết thúc):</div>
        <div className="flex flex-wrap gap-1.5">
          {squad.map(p => (
            <button key={p.num} disabled={busy} onClick={() => patch({ mvp: cfg.mvp === p.name ? null : p.name })}
              className={`px-2.5 h-8 rounded-full text-[11px] font-bold ${cfg.mvp === p.name ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>#{p.num} {p.name.split(' ').slice(-2).join(' ')}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ================= MÃ QR vào trang dự đoán =================
const QrModal = ({ game, onClose }) => {
  const url = `${window.location.origin}/du-doan/${game.id}`;
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#065f46' } }).then(setQr); }, [url]);
  const download = async () => {
    const cfg = game.config || {};
    const W = 640, H = 880;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#065f46'; ctx.fillRect(0, 0, W, 190);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = `900 40px ${FONT}`; ctx.fillText('DỰ ĐOÁN TỈ SỐ', W / 2, 74);
    ctx.font = `800 30px ${FONT}`; ctx.fillText(`${cfg.team_a?.name || ''} vs ${cfg.team_b?.name || ''}`, W / 2, 124);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(cfg.kickoff ? `20:00 · ${new Date(cfg.kickoff).toLocaleDateString('vi-VN')}` : '', W / 2, 162);
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = qr; });
    ctx.drawImage(img, (W - 480) / 2, 230, 480, 480);
    ctx.fillStyle = '#065f46'; ctx.font = `900 30px ${FONT}`; ctx.fillText('QUÉT MÃ ĐỂ DỰ ĐOÁN', W / 2, 780);
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
