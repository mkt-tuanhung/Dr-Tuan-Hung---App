import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload.js';
import { toast } from 'sonner';
import { Gamepad2, Plus, X, Trash2, Gift, Trophy, Users, Clock, Sparkles, Play, Lock, ChevronLeft, Moon } from 'lucide-react';
import MatchPredictPage from '@/pages/MatchPredictPage.jsx';
import WerewolfGame from '@/features/werewolf/WerewolfGame.jsx';

// ===== Module MINIGAME — sân chơi cho nhân sự =====
// Đợt đầu: VÒNG QUAY MAY MẮN. Admin tạo game (giải thưởng, lượt, thời gian);
// nhân sự quay — server chọn giải (RPC play_minigame), kết quả realtime.

const inp = 'e-input';
const PALETTE = ['#12A4A5', '#f59e0b', '#8b5cf6', '#f43f5e', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#6366f1', '#84cc16'];
const fmtDT = (s) => s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

const gameState = (g) => {
  const now = new Date();
  if (g.status !== 'active') return { label: 'Đã đóng', cls: 'e-tone-neutral' };
  if (g.starts_at && now < new Date(g.starts_at)) return { label: 'Sắp mở', cls: 'e-tone-warning' };
  if (g.ends_at && now > new Date(g.ends_at)) return { label: 'Hết hạn', cls: 'e-tone-danger' };
  return { label: 'Đang mở', cls: 'e-tone-success' };
};
const isOpen = (g) => gameState(g).label === 'Đang mở';

const MinigamePage = () => {
  const { profile: me } = useAuth();
  const isAdmin = [me?.role, me?.role_2].includes('admin');
  const [games, setGames] = useState([]);
  const [plays, setPlays] = useState([]);          // toàn bộ lượt quay (kèm tên)
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);    // game đang mở màn chơi
  const [editGame, setEditGame] = useState(null);  // admin: tạo/sửa game

  const load = useCallback(async () => {
    const [{ data: gs }, { data: ps }] = await Promise.all([
      supabase.from('minigames').select('*').order('created_at', { ascending: false }),
      supabase.from('minigame_plays').select('*, nguoi:profiles!user_id(full_name)').order('created_at', { ascending: false }).limit(1000),
    ]);
    setGames(gs || []); setPlays(ps || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('minigames,minigame_plays', load);

  const del = async (g) => {
    if (!confirm(`Xoá game "${g.title}"? Kết quả quay cũng bị xoá.`)) return;
    const { error } = await supabase.from('minigames').delete().eq('id', g.id);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success('Đã xoá game'); load();
  };
  const toggleClose = async (g) => {
    const status = g.status === 'active' ? 'closed' : 'active';
    const { error } = await supabase.from('minigames').update({ status }).eq('id', g.id);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success(status === 'closed' ? 'Đã đóng game' : 'Đã mở lại game');
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>;

  if (current) {
    const g = games.find(x => x.id === current) || null;
    if (g?.type === 'match') return <MatchPredictPage gameId={g.id} onBack={() => setCurrent(null)} />;
    if (g?.type === 'werewolf') return <WerewolfGame onBack={() => setCurrent(null)} />;
    if (g) return <WheelPlay game={g} me={me} plays={plays.filter(p => p.game_id === g.id)} onBack={() => setCurrent(null)} onPlayed={load} />;
  }

  return (
    <div className="space-y-4">
      {/* Thanh công cụ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="e-page-desc flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-teal-600" /> Sân chơi nội bộ — quay là trúng, chơi là vui</p>
        {isAdmin && (
          <button onClick={() => setEditGame({})} className="e-btn e-btn-primary shrink-0">
            <Plus className="w-4 h-4" /> Tạo game
          </button>
        )}
      </div>

      {/* Danh sách game */}
      {games.length === 0 ? (
        <div className="e-card e-empty py-12 text-[14px] text-slate-500">
          <Gamepad2 className="w-12 h-12 p-3 rounded-full bg-teal-50 text-teal-600 mb-3" />
          Chưa có sân chơi nào{isAdmin ? ' — bấm "Tạo game" để mở màn!' : '. Chờ admin mở game nhé!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {games.map(g => {
            const st = gameState(g);
            const isMatch = g.type === 'match';
            const isWolf = g.type === 'werewolf';
            const gPlays = plays.filter(p => p.game_id === g.id);
            const mine = gPlays.filter(p => p.user_id === me?.id).length;
            const left = Math.max(0, (g.spins_per_user || 1) - mine);
            const prizes = g.config?.prizes || [];
            const A = g.config?.team_a, B = g.config?.team_b;
            return (
              <div key={g.id} className="e-card e-card-pad flex flex-col gap-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-slate-900 truncate">{g.title}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12px] text-slate-500">
                      <span className={`e-badge e-badge-sm e-badge-dot ${st.cls}`}>{st.label}</span>
                      <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{gPlays.length} lượt</span>
                      {g.ends_at && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />đến {fmtDT(g.ends_at)}</span>}
                    </div>
                  </div>
                  <span className={`w-12 h-12 shrink-0 rounded-full grid place-items-center overflow-hidden ${isMatch ? 'bg-success-50' : isWolf ? '' : 'bg-teal-50 text-teal-700'}`} style={isWolf ? { background: '#1E2A44' } : undefined}>{isMatch ? <span className="text-xl">⚽</span> : isWolf ? <img src="/masoi/mascot.png" alt="" className="w-9 h-10 object-contain object-top mt-1.5" /> : <Gift className="w-5 h-5" />}</span>
                </div>
                {/* Werewolf: mô tả · Match: 2 đội · Wheel: giải thưởng */}
                {isWolf ? (
                  <div className="rounded-xl px-3 py-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-white" style={{ background: 'linear-gradient(160deg,#1E2A44,#2A3A66)' }}>
                    <Moon className="w-4 h-4 shrink-0 text-amber-300" />
                    <span>Trò chơi trí tuệ 4–20 người · Quét QR vào làng, nhận vai bí mật rồi chơi trực tiếp cùng nhau</span>
                  </div>
                ) : isMatch ? (
                  <div className="e-subtle flex items-center justify-center gap-3 py-2.5 text-[15px] font-bold text-slate-800">
                    <span>{A?.flag} {A?.name}</span><span className="text-slate-400 text-[12px] font-semibold">VS</span><span>{B?.flag} {B?.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {prizes.slice(0, 5).map((p, i) => (
                      <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: p.color || PALETTE[i % PALETTE.length] }}>{p.label}</span>
                    ))}
                    {prizes.length > 5 && <span className="e-badge e-badge-sm e-tone-neutral">+{prizes.length - 5}</span>}
                  </div>
                )}
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button onClick={() => setCurrent(g.id)} disabled={!isOpen(g) && !isAdmin && !isMatch && !isWolf}
                    className={`e-btn flex-1 min-w-0 ${isWolf ? 'text-white hover:opacity-90' : 'e-btn-primary'}`}
                    style={isWolf ? { background: '#1E2A44' } : undefined}>
                    {isWolf ? <><Play className="w-4 h-4" /> Vào Làng Sói Tuấn Hùng</>
                      : isMatch ? <><Play className="w-4 h-4" /> {isOpen(g) ? 'Dự đoán ngay' : 'Xem kết quả'}</>
                      : isOpen(g) ? <><Play className="w-4 h-4" /> Chơi ngay{left > 0 ? ` · còn ${left} lượt` : ''}</> : <><Lock className="w-4 h-4" /> Xem kết quả</>}
                  </button>
                  {isAdmin && (
                    <>
                      {!isMatch && !isWolf && <button onClick={() => setEditGame(g)} className="e-btn e-btn-secondary px-3">Sửa</button>}
                      <button onClick={() => toggleClose(g)} className="e-btn e-btn-secondary px-3">{g.status === 'active' ? 'Đóng' : 'Mở'}</button>
                      <button onClick={() => del(g)} className="e-icon-btn shrink-0 hover:!text-danger-600 hover:!border-danger-200 hover:bg-danger-50"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bảng vàng gần đây */}
      {plays.length > 0 && (
        <div className="e-card e-card-pad">
          <div className="e-card-header">
            <h3 className="e-card-title flex items-center gap-2"><Trophy className="w-5 h-5 text-warning-500" /> Trúng thưởng gần đây</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {plays.slice(0, 12).map(p => (
              <div key={p.id} className="py-2.5 flex items-center gap-2 text-[14px] flex-wrap">
                <b className="text-slate-900 font-semibold">{p.nguoi?.full_name || '—'}</b>
                <span className="text-slate-400">trúng</span>
                <span className="e-badge e-badge-sm e-tone-brand">{p.prize}</span>
                <span className="ml-auto text-[12px] text-slate-400 tabular-nums">{fmtDT(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editGame !== null && <GameEditModal game={editGame} me={me} onClose={() => setEditGame(null)} onSaved={() => { setEditGame(null); load(); }} />}
    </div>
  );
};

// ================= MÀN CHƠI: VÒNG QUAY =================
const WheelPlay = ({ game, me, plays, onBack, onPlayed }) => {
  const prizes = (game.config?.prizes || []).map((p, i) => ({ ...p, color: p.color || PALETTE[i % PALETTE.length] }));
  const n = Math.max(prizes.length, 1);
  const seg = 360 / n;
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState(null);            // giải vừa trúng (hiện popup)
  const spinningRef = useRef(false);

  const mine = plays.filter(p => p.user_id === me?.id);
  const left = Math.max(0, (game.spins_per_user || 1) - mine.length);
  const open = isOpen(game);

  const spin = async () => {
    if (spinningRef.current) return;
    spinningRef.current = true; setSpinning(true); setWon(null);
    const { data, error } = await supabase.rpc('play_minigame', { p_game: game.id });
    if (error || !data?.ok) {
      spinningRef.current = false; setSpinning(false);
      return toast.error(data?.error || error?.message || 'Không quay được');
    }
    // Quay tới đúng ô giải server đã chọn: 5 vòng + đưa TÂM ô về kim (đỉnh)
    const ix = Number(data.prize_index) || 0;
    const target = 360 * 6 - (ix * seg + seg / 2);
    setAngle(a => a + 360 * 2 + ((target - ((a + 720) % 360)) % 360) + 360 * 3);
    setTimeout(() => {
      spinningRef.current = false; setSpinning(false);
      setWon(data.prize); onPlayed?.();
    }, 4200);
  };

  // conic-gradient các ô giải
  const stops = prizes.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="e-icon-btn" aria-label="Quay lại"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold text-slate-900 truncate">{game.title}</div>
          <div className="text-[12px] text-slate-500">{open ? `Bạn còn ${left} lượt quay` : 'Game đã đóng — xem kết quả'}</div>
        </div>
      </div>

      <div className="e-card p-6 flex flex-col items-center">
        {/* Kim chỉ */}
        <div className="relative">
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 w-0 h-0" style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '22px solid #0f172a' }} />
          {/* Vòng quay */}
          <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] rounded-full border-[10px] border-slate-800 shadow-2xl overflow-hidden"
            style={{ background: `conic-gradient(${stops})`, transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.6, 0.08, 1)' : 'none' }}>
            {prizes.map((p, i) => (
              <div key={i} className="absolute left-1/2 top-1/2 origin-top-left text-[11px] font-bold text-white whitespace-nowrap"
                style={{ transform: `rotate(${i * seg + seg / 2 - 90}deg) translateX(52px)`, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>
                {p.label}
              </div>
            ))}
          </div>
          {/* Nút giữa */}
          <button onClick={spin} disabled={!open || left <= 0 || spinning}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white shadow-xl border-4 border-slate-800 font-black text-slate-800 text-sm disabled:opacity-60 active:scale-95 transition">
            {spinning ? '…' : (open && left > 0 ? 'QUAY!' : 'HẾT LƯỢT')}
          </button>
        </div>

        {won && (
          <div className="mt-6 text-center animate-bounce">
            <div className="text-[13px] text-slate-400">Chúc mừng! Bạn trúng</div>
            <div className="text-2xl font-black text-teal-700 flex items-center gap-2 justify-center"><Sparkles className="w-6 h-6 text-warning-400" /> {won} <Sparkles className="w-6 h-6 text-warning-400" /></div>
          </div>
        )}
      </div>

      {/* Kết quả của tôi + bảng vàng game này */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="e-card e-card-pad">
          <div className="e-card-title text-[15px] lg:text-[16px] mb-3 flex items-center gap-2"><Gift className="w-5 h-5 text-teal-600" /> Lượt quay của tôi ({mine.length})</div>
          {mine.length === 0 ? <div className="text-slate-400 text-[13px] py-3 text-center">Chưa quay lượt nào</div> :
            mine.map(p => <div key={p.id} className="py-2 text-[14px] flex justify-between border-b border-slate-100 last:border-0"><b className="text-teal-700">{p.prize}</b><span className="text-slate-400 text-[12px] tabular-nums">{fmtDT(p.created_at)}</span></div>)}
        </div>
        <div className="e-card e-card-pad">
          <div className="e-card-title text-[15px] lg:text-[16px] mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-warning-500" /> Bảng vàng ({plays.length} lượt)</div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {plays.length === 0 ? <div className="text-slate-400 text-[13px] py-3 text-center">Chưa ai quay</div> :
              plays.map(p => (
                <div key={p.id} className="py-2 text-[14px] flex items-center gap-2">
                  <b className="text-slate-800 font-semibold">{p.nguoi?.full_name || '—'}</b>
                  <span className="text-teal-700 font-bold">{p.prize}</span>
                  <span className="ml-auto text-slate-400 text-[12px] tabular-nums">{fmtDT(p.created_at)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ================= ADMIN: TẠO / SỬA GAME =================
const GameEditModal = ({ game, me, onClose, onSaved }) => {
  const editing = !!game.id;
  const [f, setF] = useState({
    title: game.title || '',
    spins_per_user: game.spins_per_user || 1,
    starts_at: toLocalInput(game.starts_at),
    ends_at: toLocalInput(game.ends_at),
    prizes: game.config?.prizes?.length ? game.config.prizes : [
      { label: 'Voucher 100k', qty: 5, weight: 3 },
      { label: 'Chúc bạn may mắn lần sau', qty: '', weight: 10 },
    ],
  });
  const [saving, setSaving] = useState(false);
  const setPrize = (i, k, v) => setF(s => ({ ...s, prizes: s.prizes.map((p, j) => j === i ? { ...p, [k]: v } : p) }));

  const save = async () => {
    if (!f.title.trim()) return toast.error('Nhập tên game');
    const prizes = f.prizes.filter(p => String(p.label || '').trim());
    if (!prizes.length) return toast.error('Thêm ít nhất 1 giải thưởng');
    setSaving(true);
    const payload = {
      title: f.title.trim(), type: 'wheel',
      spins_per_user: Math.max(1, Number(f.spins_per_user) || 1),
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      config: { prizes: prizes.map((p, i) => ({ label: String(p.label).trim(), qty: p.qty === '' || p.qty == null ? null : Number(p.qty), weight: Number(p.weight) || 1, color: p.color || PALETTE[i % PALETTE.length] })) },
    };
    const q = editing
      ? supabase.from('minigames').update(payload).eq('id', game.id)
      : supabase.from('minigames').insert({ ...payload, created_by: me.id });
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success(editing ? 'Đã cập nhật game' : 'Đã tạo game 🎉');
    onSaved();
  };

  return (
    <div className="e-modal-backdrop z-[90] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="e-modal sm:max-w-lg rounded-b-none sm:rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="e-modal-header items-center shrink-0">
          <h3 className="e-modal-title flex items-center gap-2"><Gamepad2 className="w-5 h-5 text-teal-600" /> {editing ? 'Sửa game' : 'Tạo minigame'}</h3>
          <button onClick={onClose} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="mb-3">
            <label className="e-label">Tên game *</label>
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="VD: Vòng quay sinh nhật công ty" className={inp} />
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div>
              <label className="e-label">Lượt / người</label>
              <input type="number" min="1" value={f.spins_per_user} onChange={e => setF({ ...f, spins_per_user: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="e-label">Mở từ</label>
              <input type="datetime-local" value={f.starts_at} onChange={e => setF({ ...f, starts_at: e.target.value })} className={`${inp} min-w-0`} />
            </div>
            <div>
              <label className="e-label">Đến</label>
              <input type="datetime-local" value={f.ends_at} onChange={e => setF({ ...f, ends_at: e.target.value })} className={`${inp} min-w-0`} />
            </div>
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <label className="e-label mb-0">Giải thưởng (tên · số lượng · tỉ lệ)</label>
            <button onClick={() => setF(s => ({ ...s, prizes: [...s.prizes, { label: '', qty: '', weight: 1 }] }))} className="e-btn e-btn-ghost e-btn-sm"><Plus className="w-3.5 h-3.5" /> Thêm giải</button>
          </div>
          <div className="space-y-2">
            {f.prizes.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-8 rounded-full shrink-0" style={{ background: p.color || PALETTE[i % PALETTE.length] }} />
                <input value={p.label} onChange={e => setPrize(i, 'label', e.target.value)} placeholder="Tên giải" className={`${inp} flex-1 min-w-0`} />
                <input type="number" min="0" value={p.qty} onChange={e => setPrize(i, 'qty', e.target.value)} placeholder="SL" title="Số lượng (bỏ trống = không giới hạn)" className={`${inp} w-16 shrink-0 px-2 text-center`} />
                <input type="number" min="0" step="0.1" value={p.weight} onChange={e => setPrize(i, 'weight', e.target.value)} placeholder="Tỉ lệ" title="Tỉ lệ trúng (số càng lớn càng dễ trúng)" className={`${inp} w-16 shrink-0 px-2 text-center`} />
                <button onClick={() => setF(s => ({ ...s, prizes: s.prizes.filter((_, j) => j !== i) }))} className="w-9 h-9 grid place-items-center rounded-xl text-slate-400 hover:text-danger-600 hover:bg-danger-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="e-subtle text-[12px] text-slate-500 mt-3 px-3 py-2.5">Số lượng bỏ trống = không giới hạn. Tỉ lệ là trọng số: giải tỉ lệ 10 dễ trúng gấp 10 lần giải tỉ lệ 1. Hết số lượng thì giải tự ngừng rơi.</p>
        </div>
        <div className="e-modal-footer shrink-0 rounded-b-none sm:rounded-b-2xl">
          <button onClick={onClose} className="e-btn e-btn-secondary">Hủy</button>
          <button onClick={save} disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu…' : (editing ? 'Lưu' : 'Tạo game')}</button>
        </div>
      </div>
    </div>
  );
};

export default MinigamePage;
