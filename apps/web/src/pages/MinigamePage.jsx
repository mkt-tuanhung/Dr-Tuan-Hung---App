import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload.js';
import { toast } from 'sonner';
import { Gamepad2, Plus, X, Trash2, Gift, Trophy, Users, Clock, Sparkles, Play, Lock, ChevronLeft } from 'lucide-react';

// ===== Module MINIGAME — sân chơi cho nhân sự =====
// Đợt đầu: VÒNG QUAY MAY MẮN. Admin tạo game (giải thưởng, lượt, thời gian);
// nhân sự quay — server chọn giải (RPC play_minigame), kết quả realtime.

const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white';
const PALETTE = ['#14b8a6', '#f59e0b', '#8b5cf6', '#f43f5e', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#6366f1', '#84cc16'];
const fmtDT = (s) => s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

const gameState = (g) => {
  const now = new Date();
  if (g.status !== 'active') return { label: 'Đã đóng', cls: 'bg-slate-100 text-slate-500' };
  if (g.starts_at && now < new Date(g.starts_at)) return { label: 'Sắp mở', cls: 'bg-amber-100 text-amber-700' };
  if (g.ends_at && now > new Date(g.ends_at)) return { label: 'Hết hạn', cls: 'bg-slate-100 text-slate-500' };
  return { label: 'Đang mở', cls: 'bg-emerald-100 text-emerald-700' };
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

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;

  if (current) {
    const g = games.find(x => x.id === current) || null;
    if (g) return <WheelPlay game={g} me={me} plays={plays.filter(p => p.game_id === g.id)} onBack={() => setCurrent(null)} onPlayed={load} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden -mx-4 -mt-4 px-4 pt-5 pb-6 lg:mx-0 lg:mt-0 lg:rounded-3xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#a855f7 55%,#ec4899 100%)' }}>
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Gamepad2 className="w-6 h-6" /> Minigame</h2>
            <p className="text-white/75 text-[13px] mt-0.5">Sân chơi nội bộ — quay là trúng, chơi là vui 🎉</p>
          </div>
          {isAdmin && (
            <button onClick={() => setEditGame({})} className="shrink-0 inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-white/15 hover:bg-white/25 font-bold text-sm backdrop-blur">
              <Plus className="w-4 h-4" /> Tạo game
            </button>
          )}
        </div>
      </div>

      {/* Danh sách game */}
      {games.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
          <Gamepad2 className="w-10 h-10 mx-auto mb-2 text-slate-200" />
          Chưa có sân chơi nào{isAdmin ? ' — bấm "Tạo game" để mở màn!' : '. Chờ admin mở game nhé!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {games.map(g => {
            const st = gameState(g);
            const gPlays = plays.filter(p => p.game_id === g.id);
            const mine = gPlays.filter(p => p.user_id === me?.id).length;
            const left = Math.max(0, (g.spins_per_user || 1) - mine);
            const prizes = g.config?.prizes || [];
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{g.title}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-slate-400">
                      <span className={`font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{gPlays.length} lượt</span>
                      {g.ends_at && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />đến {fmtDT(g.ends_at)}</span>}
                    </div>
                  </div>
                  <span className="w-11 h-11 shrink-0 rounded-2xl grid place-items-center bg-violet-50 text-violet-600"><Gift className="w-5 h-5" /></span>
                </div>
                {/* Giải thưởng */}
                <div className="flex flex-wrap gap-1.5">
                  {prizes.slice(0, 5).map((p, i) => (
                    <span key={i} className="text-[10.5px] font-bold px-2 py-1 rounded-full text-white" style={{ background: p.color || PALETTE[i % PALETTE.length] }}>{p.label}</span>
                  ))}
                  {prizes.length > 5 && <span className="text-[10.5px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500">+{prizes.length - 5}</span>}
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <button onClick={() => setCurrent(g.id)} disabled={!isOpen(g) && !isAdmin}
                    className="flex-1 h-10 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                    {isOpen(g) ? <><Play className="w-4 h-4" /> Chơi ngay{left > 0 ? ` · còn ${left} lượt` : ''}</> : <><Lock className="w-4 h-4" /> Xem kết quả</>}
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => setEditGame(g)} className="h-10 px-3 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">Sửa</button>
                      <button onClick={() => toggleClose(g)} className="h-10 px-3 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">{g.status === 'active' ? 'Đóng' : 'Mở'}</button>
                      <button onClick={() => del(g)} className="h-10 w-10 grid place-items-center rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-[13px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Trúng thưởng gần đây</div>
          <div className="divide-y divide-slate-50">
            {plays.slice(0, 12).map(p => (
              <div key={p.id} className="py-2 flex items-center gap-2 text-[13px] flex-wrap">
                <b className="text-slate-800">{p.nguoi?.full_name || '—'}</b>
                <span className="text-slate-400">trúng</span>
                <span className="font-bold text-violet-600">{p.prize}</span>
                <span className="ml-auto text-[11px] text-slate-300 tabular-nums">{fmtDT(p.created_at)}</span>
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
        <button onClick={onBack} className="w-9 h-9 grid place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <div className="font-bold text-slate-800 truncate">{game.title}</div>
          <div className="text-[12px] text-slate-400">{open ? `Bạn còn ${left} lượt quay` : 'Game đã đóng — xem kết quả'}</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
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
            <div className="text-2xl font-black text-violet-600 flex items-center gap-2 justify-center"><Sparkles className="w-6 h-6 text-amber-400" /> {won} <Sparkles className="w-6 h-6 text-amber-400" /></div>
          </div>
        )}
      </div>

      {/* Kết quả của tôi + bảng vàng game này */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Gift className="w-4 h-4 text-violet-500" /> Lượt quay của tôi ({mine.length})</div>
          {mine.length === 0 ? <div className="text-slate-300 text-sm py-3 text-center">Chưa quay lượt nào</div> :
            mine.map(p => <div key={p.id} className="py-1.5 text-[13px] flex justify-between"><b className="text-violet-600">{p.prize}</b><span className="text-slate-300 text-[11px] tabular-nums">{fmtDT(p.created_at)}</span></div>)}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Bảng vàng ({plays.length} lượt)</div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
            {plays.length === 0 ? <div className="text-slate-300 text-sm py-3 text-center">Chưa ai quay</div> :
              plays.map(p => (
                <div key={p.id} className="py-1.5 text-[13px] flex items-center gap-2">
                  <b className="text-slate-700">{p.nguoi?.full_name || '—'}</b>
                  <span className="text-violet-600 font-bold">{p.prize}</span>
                  <span className="ml-auto text-slate-300 text-[11px] tabular-nums">{fmtDT(p.created_at)}</span>
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
    <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-5 py-3.5 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-violet-600" /> {editing ? 'Sửa game' : 'Tạo minigame'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tên game *</label>
            <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="VD: Vòng quay sinh nhật công ty" className={inp} />
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lượt / người</label>
              <input type="number" min="1" value={f.spins_per_user} onChange={e => setF({ ...f, spins_per_user: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mở từ</label>
              <input type="datetime-local" value={f.starts_at} onChange={e => setF({ ...f, starts_at: e.target.value })} className={`${inp} min-w-0`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Đến</label>
              <input type="datetime-local" value={f.ends_at} onChange={e => setF({ ...f, ends_at: e.target.value })} className={`${inp} min-w-0`} />
            </div>
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600">Giải thưởng (tên · số lượng · tỉ lệ)</label>
            <button onClick={() => setF(s => ({ ...s, prizes: [...s.prizes, { label: '', qty: '', weight: 1 }] }))} className="text-violet-600 text-xs font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm giải</button>
          </div>
          <div className="space-y-2">
            {f.prizes.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-8 rounded-full shrink-0" style={{ background: p.color || PALETTE[i % PALETTE.length] }} />
                <input value={p.label} onChange={e => setPrize(i, 'label', e.target.value)} placeholder="Tên giải" className={`${inp} flex-1 min-w-0`} />
                <input type="number" min="0" value={p.qty} onChange={e => setPrize(i, 'qty', e.target.value)} placeholder="SL" title="Số lượng (bỏ trống = không giới hạn)" className={`${inp} w-16 shrink-0 px-2 text-center`} />
                <input type="number" min="0" step="0.1" value={p.weight} onChange={e => setPrize(i, 'weight', e.target.value)} placeholder="Tỉ lệ" title="Tỉ lệ trúng (số càng lớn càng dễ trúng)" className={`${inp} w-16 shrink-0 px-2 text-center`} />
                <button onClick={() => setF(s => ({ ...s, prizes: s.prizes.filter((_, j) => j !== i) }))} className="w-8 h-8 grid place-items-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Số lượng bỏ trống = không giới hạn. Tỉ lệ là trọng số: giải tỉ lệ 10 dễ trúng gấp 10 lần giải tỉ lệ 1. Hết số lượng thì giải tự ngừng rơi.</p>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-5 py-3 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-60 text-sm">{saving ? 'Đang lưu…' : (editing ? 'Lưu' : 'Tạo game')}</button>
        </div>
      </div>
    </div>
  );
};

export default MinigamePage;
