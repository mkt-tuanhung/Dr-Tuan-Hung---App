// ============================================================
// MA SÓI — Dual Mode (đợt 1: OFFLINE hoàn chỉnh)
// Giao diện theo gói thiết kế TuanHung_CRM_MaSoi_DualMode_v2_ModernCute
// (MODERN · CUTE · BRIGHT · SMART · CLEAN — navy immersive + gold CTA,
// mascot sói thông minh, nhân vật thú PNG, icon PNG — không emoji icon).
// Luồng: Landing -> Tạo/Vào phòng (QR) -> Lobby realtime -> Host bắt đầu
// -> Server chia vai -> NHẤN GIỮ lật bài -> Xác nhận -> OFFLINE HANDOFF.
// Quản trò CHỈ thấy số người đã nhận vai — không thấy vai của ai (theo spec).
// ONLINE (video + engine đêm/ngày) là capability riêng, chưa render trong
// OFFLINE (conditional render, không display:none).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Share2, Check, X, LogOut, RotateCcw, DoorOpen, Lock } from 'lucide-react';
import { ROLES, WW, composition, MASCOT, BG_LOBBY, ICONS, AVATARS } from './wwRoles';

const GAME_ID = 'aa50aa50-0001-4000-8000-000000000001'; // eslint-disable-line no-unused-vars

const Styles = () => (
  <style>{`
    @keyframes wwPop { 0% { transform: scale(.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes wwFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
    @keyframes wwStar { 0%,100% { opacity: .2; } 50% { opacity: .9; } }
    .ww-pop { animation: wwPop .22s cubic-bezier(.2,1.3,.4,1); }
    .ww-float { animation: wwFloat 3.2s ease-in-out infinite; }
    .ww-flip { transform-style: preserve-3d; transition: transform .6s cubic-bezier(.3,1.2,.4,1); }
    .ww-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  `}</style>
);

const STARS = [[8, 6], [22, 14], [40, 4], [58, 10], [76, 5], [90, 12], [14, 22], [68, 20], [94, 28], [4, 34]];
const Stars = () => STARS.map(([x, y], i) => (
  <span key={i} className="absolute w-1 h-1 rounded-full bg-white pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, animation: `wwStar ${2 + (i % 5) * 0.6}s ease-in-out infinite` }} />
));

// Nút CTA vàng gold (primary theo design tokens)
const GoldBtn = ({ children, className = '', ...props }) => (
  <button {...props}
    className={`w-full py-3.5 rounded-[20px] font-black text-[15px] shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40 ${className}`}
    style={{ background: 'linear-gradient(160deg,#FFDD7A,#F2C14E 55%,#E8AB37)', color: '#5C3D07', boxShadow: '0 6px 20px rgba(242,193,78,.35)' }}>
    {children}
  </button>
);

// Panel kính mờ trên nền navy
const NightPanel = ({ children, className = '', style = {} }) => (
  <div className={`rounded-[26px] p-5 ${className}`} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)', ...style }}>
    {children}
  </div>
);

// Thẻ mascot nhắn nhủ
const MascotTip = ({ children }) => (
  <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
    <img src={MASCOT} alt="" className="w-12 h-16 shrink-0 object-contain ww-float" />
    <div className="text-[13px] leading-relaxed text-white/85">{children}</div>
  </div>
);

// ---------- NHẤN GIỮ ĐỂ XEM VAI (1200ms theo game_modes.json) ----------
const HoldToReveal = ({ onDone, label = 'NHẤN GIỮ ĐỂ XEM VAI' }) => {
  const [prog, setProg] = useState(0);
  const timer = useRef(null);
  const startAt = useRef(0);
  const DURATION = 1200;
  const stop = () => { cancelAnimationFrame(timer.current); setProg(0); };
  const start = () => {
    startAt.current = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - startAt.current) / DURATION);
      setProg(p);
      if (p >= 1) { try { navigator.vibrate?.(40); } catch { /* noop */ } onDone(); return; }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(timer.current), []);
  const R = 32, C = 2 * Math.PI * R;
  return (
    <button
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()}
      className="mx-auto flex flex-col items-center gap-2 select-none touch-none"
      style={{ WebkitUserSelect: 'none' }}>
      <span className="relative w-[84px] h-[84px] grid place-items-center">
        <svg width="84" height="84" className="-rotate-90">
          <circle cx="42" cy="42" r={R} stroke="rgba(255,255,255,0.22)" strokeWidth="6" fill="none" />
          <circle cx="42" cy="42" r={R} stroke={WW.gold} strokeWidth="6" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - prog)} />
        </svg>
        <img src={ICONS.reveal} alt="" className="absolute w-11 h-11 object-contain" />
      </span>
      <span className="text-xs font-black tracking-widest text-white/90">{label}</span>
    </button>
  );
};

// ---------- Thẻ vai (render động từ wwRoles — RoleCharacterPNG + icon + copy) ----------
const RoleCard = ({ roleId }) => {
  const r = ROLES[roleId] || ROLES.villager;
  return (
    <div className="ww-pop rounded-[26px] overflow-hidden shadow-xl" style={{ background: '#fff', border: `2px solid ${r.border}` }}>
      <div className="relative pt-5 pb-2 px-5 text-center" style={{ background: `linear-gradient(180deg, ${r.bg}, #FFFFFF)` }}>
        <img src={r.character} alt={r.name} className="mx-auto h-44 object-contain ww-float" draggable={false} />
        <img src={r.icon} alt="" className="absolute top-4 right-4 w-11 h-11 object-contain drop-shadow" />
      </div>
      <div className="px-5 pt-2 pb-5 text-center">
        <div className="text-3xl font-black tracking-wide" style={{ color: r.color }}>{r.name.toUpperCase()}</div>
        <span className="inline-block mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold" style={{ background: r.bg, color: r.factionColor, border: `1px solid ${r.border}` }}>{r.faction}</span>
        <p className="text-[13px] mt-2" style={{ color: WW.textSecondary }}>{r.desc}</p>
        <div className="mt-3 space-y-2 text-left">
          {[['Mục tiêu của bạn', r.goal], ['Ban đêm', r.night], ['Ban ngày', r.day]].map(([k, v]) => (
            <div key={k} className="rounded-2xl px-3.5 py-2.5" style={{ background: WW.surfaceAlt, border: '1px solid #EAEDFB' }}>
              <div className="text-[10px] font-black tracking-widest" style={{ color: r.color }}>{k.toUpperCase()}</div>
              <div className="text-[13px] font-medium mt-0.5" style={{ color: WW.textPrimary }}>{v}</div>
            </div>
          ))}
          <div className="rounded-2xl px-3.5 py-2.5 flex gap-2 items-start" style={{ background: '#FFFBEF', border: '1px solid #F5E6BB' }}>
            <img src={ICONS.host} alt="" className="w-6 h-6 mt-0.5 shrink-0 object-contain" />
            <div className="text-[12px]" style={{ color: '#8A6D1F' }}><b>Mẹo hay:</b> {r.tip}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Ô người chơi trong lobby (theo mockup: tile lilac + avatar thú) ----------
const PlayerTile = ({ index, name, ready, isHost, onKick }) => (
  <div className="relative rounded-[18px] p-1.5 pb-2 text-center" style={{ background: 'linear-gradient(180deg,#E9EEFF,#DCD9FA)', border: '1.5px solid #C9CCF2' }}>
    <span className="absolute top-1 left-1.5 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full text-[9px] font-black grid place-items-center text-white z-10" style={{ background: WW.primary }}>{index + 1}</span>
    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full z-10" style={{ background: ready ? WW.success : '#C4CBE2', border: '1.5px solid #fff' }} />
    <div className="h-16 overflow-hidden rounded-[13px]" style={{ background: 'rgba(255,255,255,0.5)' }}>
      <img src={isHost ? MASCOT : AVATARS[index % AVATARS.length]} alt="" draggable={false}
        className="w-full h-24 object-contain object-top -mt-0.5" />
    </div>
    <div className="text-[11px] font-bold truncate mt-1 px-0.5" style={{ color: WW.textPrimary }}>{name}</div>
    {isHost && <span className="inline-block px-2 py-[1px] rounded-full text-[8.5px] font-black text-white" style={{ background: WW.success }}>Host</span>}
    {onKick && (
      <button onClick={onKick} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full grid place-items-center bg-white shadow z-10" style={{ border: '1px solid #F3D3D0' }}>
        <X className="w-3 h-3" style={{ color: WW.danger }} />
      </button>
    )}
  </div>
);

// ============================================================
export default function WerewolfGame({ onBack, joinCode = null, standalone = false }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [qr, setQr] = useState(null);
  const [revealed, setRevealed] = useState(false);   // đã lật bài trong phiên hiện tại
  const [reviewing, setReviewing] = useState(false); // đang "xem lại vai"
  const joinedRef = useRef(false);

  const me = profile?.id;
  const isHost = room && room.host_id === me;
  const myPlayer = players.find((p) => p.user_id === me);

  // ---------- Load phòng hiện tại của tôi ----------
  const load = useCallback(async () => {
    if (!me) return;
    const { data: mine } = await supabase.from('ww_players').select('room_id').eq('user_id', me);
    const roomIds = (mine || []).map((x) => x.room_id);
    let r = null;
    if (roomIds.length) {
      const { data: rooms } = await supabase.from('ww_rooms').select('*').in('id', roomIds).neq('status', 'ENDED')
        .order('created_at', { ascending: false }).limit(1);
      r = rooms?.[0] || null;
    }
    setRoom(r);
    if (r) {
      const { data: ps } = await supabase.from('ww_players')
        .select('id, room_id, user_id, ready, acked, joined_at, profiles(full_name, avatar_url)')
        .eq('room_id', r.id).order('joined_at');
      setPlayers(ps || []);
      if (r.status !== 'LOBBY') {
        const { data: role } = await supabase.rpc('ww_my_role', { p_room: r.id });
        setMyRole(role || null);
      } else { setMyRole(null); setRevealed(false); setReviewing(false); }
    } else { setPlayers([]); setMyRole(null); }
    setLoading(false);
  }, [me]);

  useEffect(() => { load(); }, [load]);
  useRealtimeReload('ww_rooms,ww_players', load);

  // Vào phòng qua QR /ma-soi/:code
  useEffect(() => {
    if (!joinCode || !me || joinedRef.current) return;
    joinedRef.current = true;
    supabase.rpc('ww_join_room', { p_code: joinCode }).then(({ error }) => {
      if (error) toast.error(error.message);
      load();
    });
  }, [joinCode, me, load]);

  // QR mời
  useEffect(() => {
    if (!room) { setQr(null); return; }
    const url = `${window.location.origin}/ma-soi/${room.code}`;
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#1E2A44', light: '#FFFFFF' } }).then(setQr).catch(() => {});
  }, [room?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Actions ----------
  const act = async (fn, args, okMsg) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    if (okMsg) toast.success(okMsg);
    load();
    return true;
  };
  const createRoom = () => act('ww_create_room', { p_mode: 'OFFLINE' }, 'Đã tạo phòng!');
  const joinRoom = () => {
    const c = codeInput.replace(/\D/g, '');
    if (c.length !== 6) return toast.error('Mã phòng gồm 6 chữ số');
    act('ww_join_room', { p_code: c }, 'Đã vào phòng!');
  };
  const toggleReady = async () => {
    await supabase.from('ww_players').update({ ready: !myPlayer?.ready }).eq('id', myPlayer.id);
    load();
  };
  const leaveRoom = async () => {
    if (!confirm('Rời phòng này?')) return;
    await supabase.from('ww_players').delete().eq('id', myPlayer.id);
    load();
  };
  const kick = async (p) => {
    if (!confirm(`Mời ${p.profiles?.full_name || 'người này'} ra khỏi phòng?`)) return;
    await supabase.from('ww_players').delete().eq('id', p.id);
    load();
  };
  const closeRoom = async () => {
    if (!confirm('Kết thúc và đóng phòng?')) return;
    await supabase.from('ww_rooms').update({ status: 'ENDED' }).eq('id', room.id);
    load();
  };
  const copyCode = () => { navigator.clipboard?.writeText(room.code); toast.success('Đã sao chép mã phòng'); };
  const shareLink = async () => {
    const url = `${window.location.origin}/ma-soi/${room.code}`;
    try { await navigator.share({ title: 'Ma Sói — Dr Tuấn Hùng', text: `Vào phòng Ma Sói, mã ${room.code}`, url }); }
    catch { navigator.clipboard?.writeText(url); toast.success('Đã sao chép link mời'); }
  };

  // ---------- Khung trang: navy immersive (theo mockup mobile) ----------
  const Shell = ({ children }) => (
    <div className={standalone ? 'min-h-screen px-3 py-4 relative' : '-mx-4 -my-4 lg:mx-0 lg:my-0 px-3 py-4 lg:rounded-[26px] relative overflow-hidden'}
      style={{ background: `linear-gradient(180deg, ${WW.nightTop} 0%, ${WW.nightBottom} 100%)` }}>
      <Styles />
      <Stars />
      <div className="max-w-2xl mx-auto space-y-4 relative">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button onClick={onBack} className="w-10 h-10 rounded-2xl grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <img src={ICONS.night} alt="" className="w-8 h-8 object-contain" />
          <div>
            <div className="font-black text-lg leading-tight" style={{ color: WW.gold }}>Ma Sói</div>
            <div className="text-[10.5px] font-bold tracking-wide text-white/60">CRM MINI GAME</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <NightPanel className="text-center py-8">
          <img src={MASCOT} alt="" className="mx-auto h-32 object-contain ww-float" />
          <div className="mt-3 font-bold text-white">Đang chuẩn bị ván chơi...</div>
        </NightPanel>
      </Shell>
    );
  }

  // ================= LANDING =================
  if (!room) {
    return (
      <Shell>
        {/* Hero: nền làng đêm trăng + mascot */}
        <div className="rounded-[26px] relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
          <img src={BG_LOBBY} alt="" className="w-full h-44 sm:h-56 object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,30,56,0) 30%, rgba(20,30,56,0.9) 100%)' }} />
          <img src={MASCOT} alt="Mascot sói" className="absolute bottom-0 left-3 h-[86%] object-contain ww-float" draggable={false} />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center w-full pl-16">
            <div className="font-black text-3xl tracking-wide" style={{ color: WW.gold, textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>Ma Sói</div>
            <div className="text-[11.5px] font-semibold text-white/85">Trò chơi trí tuệ — Kết nối đội nhóm — Vui vẻ, công bằng, đáng nhớ!</div>
          </div>
        </div>

        {/* 2 CHẾ ĐỘ CHƠI */}
        <NightPanel>
          <div className="text-center text-[12px] font-black tracking-widest text-white/70 mb-3">2 CHẾ ĐỘ CHƠI</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] p-3.5 relative" style={{ background: 'rgba(255,255,255,0.95)', border: `2px solid ${WW.gold}`, boxShadow: '0 0 16px rgba(242,193,78,.25)' }}>
              <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full grid place-items-center" style={{ background: WW.success }}>
                <Check className="w-3 h-3 text-white" />
              </span>
              <img src={ICONS.qr} alt="" className="w-10 h-10 object-contain" />
              <div className="font-black text-[14px] mt-1.5" style={{ color: WW.textPrimary }}>OFFLINE</div>
              <div className="text-[11px] mt-0.5 leading-snug" style={{ color: WW.textSecondary }}>Chơi trực tiếp, đơn giản &amp; nhanh gọn</div>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-black" style={{ background: WW.cream, color: '#8A6D1F', border: '1px solid #F5E6BB' }}>ROLE DEALER</span>
              <ul className="mt-2 space-y-1 text-[10.5px] font-semibold" style={{ color: WW.textSecondary }}>
                <li>· Quét QR để tham gia</li>
                <li>· Phát bài &amp; xem vai trò bí mật</li>
                <li>· Chơi trực tiếp ngoài đời</li>
              </ul>
            </div>
            <div className="rounded-[20px] p-3.5 relative" style={{ background: 'rgba(255,255,255,0.10)', border: '2px dashed rgba(255,255,255,0.25)' }}>
              <img src={ICONS.video} alt="" className="w-10 h-10 object-contain opacity-80" />
              <div className="font-black text-[14px] mt-1.5 text-white/85">ONLINE</div>
              <div className="text-[11px] mt-0.5 leading-snug text-white/60">Kết nối mọi lúc, mọi nơi</div>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white/80" style={{ background: 'rgba(255,255,255,0.14)' }}>FULL GAME ENGINE</span>
              <ul className="mt-2 space-y-1 text-[10.5px] font-semibold text-white/55">
                <li>· Video call + mic giao tiếp</li>
                <li>· Chu kỳ Ngày / Đêm</li>
                <li>· Thảo luận &amp; biểu quyết</li>
              </ul>
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black text-white whitespace-nowrap" style={{ background: WW.slate }}>SẮP RA MẮT</span>
            </div>
          </div>
        </NightPanel>

        {/* Tham gia / tạo phòng */}
        <NightPanel className="space-y-3">
          <div className="text-center">
            <div className="text-[12px] font-bold text-white/75">Nhập mã phòng</div>
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" placeholder="123456"
              className="mt-1.5 w-full px-4 py-3 rounded-[16px] text-center font-black text-xl tracking-[0.35em] outline-none"
              style={{ background: '#fff', border: '1.5px solid #D6E4FB', color: WW.textPrimary }} />
          </div>
          <GoldBtn onClick={joinRoom} disabled={busy}>
            <span className="inline-flex items-center gap-2"><img src={ICONS.join} alt="" className="w-5 h-5 object-contain" /> Tham gia phòng</span>
          </GoldBtn>
          <div className="flex items-center gap-2 text-[11px] font-bold text-white/50">
            <span className="flex-1 h-px bg-white/15" /> hoặc <span className="flex-1 h-px bg-white/15" />
          </div>
          <button onClick={createRoom} disabled={busy}
            className="w-full py-3.5 rounded-[20px] font-black text-[14px] text-white active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.10)', border: `1.5px solid ${WW.gold}` }}>
            <span className="inline-flex items-center gap-2"><img src={ICONS.start} alt="" className="w-5 h-5 object-contain" /> Tạo phòng mới — bạn làm chủ phòng</span>
          </button>
          <MascotTip>Tối thiểu <b>4 người</b> để bắt đầu. Vai trò được chia <b>bí mật phía server</b> — chỉ bạn xem được vai của mình.</MascotTip>
        </NightPanel>
      </Shell>
    );
  }

  const n = players.length;
  const comp = composition(Math.max(n, 4));
  const nameOf = (uid) => players.find((p) => p.user_id === uid)?.profiles?.full_name || '—';
  const slots = Math.max(4, Math.ceil(n / 4) * 4);

  // ================= LOBBY =================
  if (room.status === 'LOBBY') {
    const allReady = n >= 4 && players.every((p) => p.ready);
    return (
      <Shell>
        {/* Room summary — ảnh làng đêm trăng */}
        <div className="rounded-[26px] relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
          <img src={BG_LOBBY} alt="" className="w-full h-32 object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,30,56,0.15), rgba(20,30,56,0.92))' }} />
          <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black text-lg text-white truncate">Phòng của {nameOf(room.host_id)}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold text-white" style={{ background: 'rgba(255,255,255,0.16)' }}>
                  <img src={ICONS.players} alt="" className="w-3.5 h-3.5 object-contain" /> {n} người · Ván {room.round}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black text-white" style={{ background: WW.success }}>OFFLINE</span>
              </div>
            </div>
            <button onClick={copyCode} className="text-right shrink-0">
              <span className="block text-[9px] font-black tracking-widest text-white/60">MÃ PHÒNG</span>
              <span className="font-black text-2xl tracking-[0.15em]" style={{ color: WW.gold }}>{room.code}</span>
            </button>
          </div>
        </div>

        {/* Mời người chơi */}
        <div className="rounded-[26px] p-5 text-center" style={{ background: '#fff' }}>
          <div className="font-black text-[15px]" style={{ color: WW.textPrimary }}>Mời người chơi</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: WW.textSecondary }}>Chia sẻ mã phòng hoặc quét QR để bạn bè tham gia ngay!</div>
          {qr && (
            <div className="mx-auto mt-3 w-44 p-2 rounded-2xl" style={{ background: '#fff', border: `1.5px solid ${WW.softBlue}`, boxShadow: '0 4px 14px rgba(30,42,68,.08)' }}>
              <img src={qr} alt="QR mời" className="w-full rounded-xl" />
            </div>
          )}
          <div className="flex justify-center gap-2 mt-3">
            <button onClick={copyCode} className="px-3.5 py-2 rounded-[14px] text-[12px] font-bold inline-flex items-center gap-1.5" style={{ background: WW.softBlue, color: WW.primary }}>
              <Copy className="w-3.5 h-3.5" /> Mã: {room.code}
            </button>
            <button onClick={shareLink} className="px-3.5 py-2 rounded-[14px] text-[12px] font-bold text-white inline-flex items-center gap-1.5" style={{ background: WW.primary }}>
              <Share2 className="w-3.5 h-3.5" /> Chia sẻ link
            </button>
          </div>
        </div>

        {/* Danh sách người chơi */}
        <NightPanel>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-[14px] text-white inline-flex items-center gap-1.5">
              <img src={ICONS.players} alt="" className="w-5 h-5 object-contain" /> Danh sách người chơi ({n})
            </span>
            {allReady && <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: 'rgba(103,215,201,.2)', color: WW.mint }}>✓ Đã đủ người</span>}
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {players.map((p, i) => (
              <PlayerTile key={p.id} index={i}
                name={p.user_id === me ? 'Bạn' : (p.profiles?.full_name || '—')}
                ready={p.ready} isHost={p.user_id === room.host_id}
                onKick={isHost && p.user_id !== me ? () => kick(p) : null} />
            ))}
            {Array.from({ length: slots - n }).map((_, i) => (
              <div key={`e${i}`} className="rounded-[18px] grid place-items-center py-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px dashed rgba(255,255,255,0.2)' }}>
                <Lock className="w-5 h-5 text-white/30" />
                <span className="text-[9.5px] font-bold text-white/40 mt-1">Đợi người chơi</span>
              </div>
            ))}
          </div>
          {/* Cơ cấu vai dự kiến */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
            <div className="text-[10px] font-black tracking-widest text-white/55 mb-2">CƠ CẤU VAI ({Math.max(n, 4)} NGƯỜI)</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(comp).map(([rid, cnt]) => {
                const r = ROLES[rid];
                return (
                  <span key={rid} className="pl-1 pr-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1" style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>
                    <img src={r.icon} alt="" className="w-4 h-4 object-contain" />
                    {r.name}{cnt > 1 ? ` ×${cnt}` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </NightPanel>

        {/* CTA */}
        <div className="space-y-2 pb-6">
          {myPlayer && (
            <button onClick={toggleReady}
              className="w-full py-3 rounded-[20px] font-black text-[14px] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
              style={myPlayer.ready
                ? { background: 'rgba(103,215,201,0.15)', color: WW.mint, border: `2px solid ${WW.mint}` }
                : { background: WW.primary, color: '#fff' }}>
              <img src={ICONS.ready} alt="" className="w-5 h-5 object-contain" />
              {myPlayer.ready ? 'ĐÃ SẴN SÀNG — bấm để huỷ' : 'SẴN SÀNG'}
            </button>
          )}
          {isHost && (
            <GoldBtn onClick={() => act('ww_start_room', { p_room: room.id })} disabled={busy || !allReady} className="py-4">
              <span className="inline-flex items-center gap-2"><img src={ICONS.start} alt="" className="w-6 h-6 object-contain" /> Bắt đầu ván</span>
            </GoldBtn>
          )}
          {isHost && (
            <div className="text-center text-[11.5px] font-semibold text-white/60">
              {!allReady
                ? (n < 4 ? `Cần thêm ${4 - n} người nữa (tối thiểu 4)` : 'Chờ mọi người bấm SẴN SÀNG')
                : 'Mọi người đã sẵn sàng? Hãy bắt đầu và tận hưởng những phút giây kịch tính!'}
            </div>
          )}
          <div className="flex justify-center gap-4 pt-1">
            {!isHost && myPlayer && (
              <button onClick={leaveRoom} className="text-[12px] font-bold inline-flex items-center gap-1 text-white/60">
                <LogOut className="w-3.5 h-3.5" /> Rời phòng
              </button>
            )}
            {isHost && (
              <button onClick={closeRoom} className="text-[12px] font-bold inline-flex items-center gap-1" style={{ color: '#F0A9A2' }}>
                <DoorOpen className="w-3.5 h-3.5" /> Đóng phòng
              </button>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ================= REVEAL / HANDOFF =================
  const ackedCount = players.filter((p) => p.acked).length;
  const showCard = (revealed || reviewing) && myRole;

  return (
    <Shell>
      <div className="text-center">
        <div className="font-black text-lg text-white">Vai trò của bạn</div>
        <div className="text-[12px] text-white/60">Ván {room.round} · Giữ bí mật tuyệt đối nhé!</div>
      </div>

      {/* Khu lật bài */}
      <div className="relative" style={{ perspective: 1200 }}>
        <div className="ww-flip" style={{ transform: showCard ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
          {/* MẶT ÚP */}
          <div className="ww-face" style={{ transform: 'rotateY(0deg)' }}>
            <div className="rounded-[26px] px-5 py-10 text-center" style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px dashed rgba(255,255,255,0.3)' }}>
              <img src={MASCOT} alt="" className="mx-auto h-32 object-contain ww-float" />
              <div className="text-white font-black text-lg mt-2">Vai trò của bạn đang được giữ bí mật</div>
              <div className="text-[12px] mt-1 mb-6 text-white/65">Đảm bảo không ai nhìn thấy màn hình rồi hãy mở nhé</div>
              <HoldToReveal onDone={() => { setRevealed(true); setReviewing(true); }} />
            </div>
          </div>
          {/* MẶT MỞ */}
          <div className="ww-face absolute inset-0" style={{ transform: 'rotateY(180deg)' }}>
            {showCard && <RoleCard roleId={myRole} />}
          </div>
        </div>
        {/* giữ chiều cao khi lật */}
        {showCard && <div className="invisible"><RoleCard roleId={myRole} /></div>}
      </div>

      {showCard && room.status === 'REVEAL' && !myPlayer?.acked && (
        <button onClick={() => { setReviewing(false); act('ww_ack_role', { p_room: room.id }); }} disabled={busy}
          className="w-full py-3.5 rounded-[18px] font-black text-[14px] text-white active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: WW.primary, boxShadow: '0 6px 18px rgba(47,91,255,.35)' }}>
          Đã hiểu
        </button>
      )}
      {showCard && (room.status === 'HANDOFF' || myPlayer?.acked) && (
        <button onClick={() => setReviewing(false)}
          className="w-full py-3 rounded-[18px] font-black text-[13px] text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
          Ẩn vai đi
        </button>
      )}

      {/* Chờ mọi người nhận vai */}
      {room.status === 'REVEAL' && myPlayer?.acked && !reviewing && (
        <NightPanel className="text-center">
          <div className="font-black text-white">Chờ mọi người nhận vai… {ackedCount}/{n}</div>
          <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
            {players.map((p) => (
              <span key={p.id} className="w-3 h-3 rounded-full" style={{ background: p.acked ? WW.success : 'rgba(255,255,255,0.2)' }} title={p.profiles?.full_name} />
            ))}
          </div>
        </NightPanel>
      )}

      {/* OFFLINE HANDOFF */}
      {room.status === 'HANDOFF' && !reviewing && (
        <div className="rounded-[26px] p-6 text-center" style={{ background: '#fff' }}>
          <span className="mx-auto w-14 h-14 rounded-full grid place-items-center" style={{ background: '#E7F9F1' }}>
            <Check className="w-7 h-7" style={{ color: WW.success }} />
          </span>
          <div className="font-black text-xl mt-2" style={{ color: WW.textPrimary }}>ĐÃ NHẬN VAI</div>
          <div className="text-[13px] mt-1" style={{ color: WW.textSecondary }}>Hãy cất điện thoại<br />và tham gia trò chơi trực tiếp.</div>
          <button onClick={() => setReviewing(true)}
            className="mt-4 px-5 py-2.5 rounded-[16px] font-bold text-[13px]" style={{ background: WW.softBlue, color: WW.primary }}>
            Xem lại vai của tôi
          </button>
        </div>
      )}

      {/* Host: CHỈ thấy tiến độ nhận vai — không thấy vai của ai (theo spec) */}
      {isHost && (
        <div className="pb-6">
          <NightPanel>
            <div className="flex items-center gap-2 mb-2">
              <img src={ICONS.host} alt="" className="w-7 h-7 object-contain" />
              <div>
                <div className="font-black text-[14px] text-white">Bảng điều khiển chủ phòng</div>
                <div className="text-[11px] text-white/60">Chủ phòng không thể xem vai của người chơi — vai là bí mật tuyệt đối.</div>
              </div>
            </div>
            <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <span className="text-[13px] font-bold text-white/85">Đã nhận vai</span>
              <span className="font-black text-lg" style={{ color: ackedCount === n ? WW.mint : WW.gold }}>{ackedCount}/{n}</span>
            </div>
            {room.status === 'HANDOFF' && (
              <div className="mt-2 text-center text-[12px] font-bold" style={{ color: WW.mint }}>✓ Sẵn sàng chơi Offline — cả làng đã nhận vai!</div>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => act('ww_new_round', { p_room: room.id }, 'Đã mở ván mới!')} disabled={busy}
                className="flex-1 py-2.5 rounded-[16px] font-black text-[13px] text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: WW.primary }}>
                <RotateCcw className="w-4 h-4" /> Ván mới
              </button>
              <button onClick={closeRoom} className="px-4 py-2.5 rounded-[16px] font-black text-[13px]" style={{ background: 'rgba(239,100,115,0.18)', color: '#F0A9A2' }}>
                Kết thúc phòng
              </button>
            </div>
          </NightPanel>
        </div>
      )}
    </Shell>
  );
}
