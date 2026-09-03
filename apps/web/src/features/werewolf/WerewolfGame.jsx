// ============================================================
// MA SÓI — Dual Mode (đợt 1: OFFLINE hoàn chỉnh)
// Art direction: MODERN · CUTE · BRIGHT · SMART · CLEAN
// Luồng: Landing -> Tạo/Vào phòng (QR) -> Lobby realtime -> Host bắt đầu
// -> Server chia vai -> HOLD-TO-REVEAL lật bài -> Xác nhận -> OFFLINE HANDOFF
// (cất điện thoại chơi trực tiếp; quản trò xem toàn bộ vai để dẫn game)
// ONLINE (video + engine đêm/ngày) là capability riêng — chưa render gì của
// ONLINE trong OFFLINE (conditional render, không display:none).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  ArrowLeft, Copy, Share2, Play, Check, X, Users, QrCode, LogOut,
  Sparkles, ShieldCheck, RotateCcw, DoorOpen, Video, Moon,
} from 'lucide-react';
import { ROLES, WW, composition } from './wwRoles';
import { MascotWolf, AVATAR_SET } from './wwCharacters';

const GAME_ID = 'aa50aa50-0001-4000-8000-000000000001';

const Styles = () => (
  <style>{`
    @keyframes wwPop { 0% { transform: scale(.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes wwFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
    @keyframes wwStar { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
    .ww-pop { animation: wwPop .28s cubic-bezier(.2,1.3,.4,1); }
    .ww-float { animation: wwFloat 3.2s ease-in-out infinite; }
    .ww-flip { transform-style: preserve-3d; transition: transform .6s cubic-bezier(.3,1.2,.4,1); }
    .ww-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  `}</style>
);

// ---------- Thẻ mascot nhắn nhủ ----------
const MascotTip = ({ children, confused = false, book = true }) => (
  <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: WW.softBlue, border: '1px solid #D6E4FB' }}>
    <div className="w-14 h-14 shrink-0 ww-float"><MascotWolf book={book} confused={confused} /></div>
    <div className="text-[13px] leading-relaxed" style={{ color: WW.navy }}>{children}</div>
  </div>
);

// ---------- NHẤN GIỮ ĐỂ XEM VAI ----------
const HoldToReveal = ({ onDone, label = 'NHẤN GIỮ ĐỂ XEM VAI' }) => {
  const [prog, setProg] = useState(0);
  const timer = useRef(null);
  const startAt = useRef(0);
  const DURATION = 1100;
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
  const R = 30, C = 2 * Math.PI * R;
  return (
    <button
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()}
      className="mx-auto flex flex-col items-center gap-2 select-none touch-none"
      style={{ WebkitUserSelect: 'none' }}>
      <span className="relative w-[76px] h-[76px] grid place-items-center">
        <svg width="76" height="76" className="-rotate-90">
          <circle cx="38" cy="38" r={R} stroke="rgba(255,255,255,0.25)" strokeWidth="6" fill="none" />
          <circle cx="38" cy="38" r={R} stroke={WW.gold} strokeWidth="6" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - prog)} />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <Sparkles className="w-7 h-7" style={{ color: WW.gold }} />
        </span>
      </span>
      <span className="text-xs font-black tracking-widest text-white/90">{label}</span>
    </button>
  );
};

// ---------- Thẻ vai đầy đủ ----------
const RoleCard = ({ roleId }) => {
  const r = ROLES[roleId] || ROLES.villager;
  const Icon = r.icon;
  return (
    <div className="ww-pop rounded-[26px] overflow-hidden shadow-xl" style={{ background: '#fff', border: `2px solid ${r.border}` }}>
      <div className="relative pt-5 pb-3 px-5 text-center" style={{ background: r.bg }}>
        <div className="mx-auto w-36 h-36 ww-float"><r.Character /></div>
        <span className="absolute top-4 right-4 w-10 h-10 rounded-2xl grid place-items-center shadow-sm" style={{ background: '#fff', border: `1.5px solid ${r.border}` }}>
          <Icon className="w-5 h-5" style={{ color: r.color }} />
        </span>
      </div>
      <div className="px-5 pt-3 pb-5 text-center">
        <div className="text-3xl font-black tracking-wide" style={{ color: r.color }}>{r.name.toUpperCase()}</div>
        <span className="inline-block mt-1.5 px-3 py-1 rounded-full text-[11px] font-bold" style={{ background: r.bg, color: r.factionColor }}>{r.faction}</span>
        <p className="text-[13px] mt-2" style={{ color: WW.slate }}>{r.desc}</p>
        <div className="mt-3 space-y-2 text-left">
          {[['Mục tiêu', r.goal], ['Ban đêm', r.night], ['Ban ngày', r.day]].map(([k, v]) => (
            <div key={k} className="rounded-2xl px-3.5 py-2.5" style={{ background: '#FAFBFE', border: '1px solid #EEF2F9' }}>
              <div className="text-[10px] font-black tracking-widest" style={{ color: r.color }}>{k.toUpperCase()}</div>
              <div className="text-[13px] font-medium mt-0.5" style={{ color: WW.navy }}>{v}</div>
            </div>
          ))}
          <div className="rounded-2xl px-3.5 py-2.5 flex gap-2 items-start" style={{ background: '#FFFBEF', border: '1px solid #F5E6BB' }}>
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: WW.gold }} />
            <div className="text-[12px]" style={{ color: '#8A6D1F' }}>{r.tip}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Avatar thú cho lobby ----------
const PlayerAvatar = ({ index, name, ready, isHost, size = 'md' }) => {
  const A = AVATAR_SET[index % AVATAR_SET.length];
  const dim = size === 'md' ? 'w-16 h-16' : 'w-12 h-12';
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className={`relative ${dim} rounded-3xl grid place-items-center`} style={{ background: WW.softBlue, border: '2px solid #D6E4FB' }}>
        <div className="w-[86%] h-[86%]"><A /></div>
        {ready && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center" style={{ background: WW.mint, border: '2px solid #fff' }}>
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
        {isHost && (
          <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-lg text-[9px] font-black text-white" style={{ background: WW.gold }}>HOST</span>
        )}
      </div>
      <span className="text-[11px] font-semibold truncate max-w-[76px]" style={{ color: WW.navy }}>{name}</span>
    </div>
  );
};

// ============================================================
export default function WerewolfGame({ onBack, joinCode = null, standalone = false }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [hostRoles, setHostRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [qr, setQr] = useState(null);
  const [revealed, setRevealed] = useState(false);   // đã lật bài trong phiên xem hiện tại
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
        if (r.host_id === me) {
          const { data: hr } = await supabase.rpc('ww_room_roles', { p_room: r.id });
          setHostRoles(hr || null);
        }
      } else { setMyRole(null); setHostRoles(null); setRevealed(false); setReviewing(false); }
    } else { setPlayers([]); setMyRole(null); setHostRoles(null); }
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

  // ---------- Khung trang ----------
  const Shell = ({ children }) => (
    <div className={standalone ? 'min-h-screen px-3 py-4' : ''} style={standalone ? { background: WW.cream } : {}}>
      <Styles />
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="w-10 h-10 rounded-2xl grid place-items-center bg-white shadow-sm" style={{ border: '1px solid #EDE4D3' }}>
              <ArrowLeft className="w-5 h-5" style={{ color: WW.navy }} />
            </button>
          )}
          <div>
            <div className="font-black text-lg leading-tight" style={{ color: WW.navy }}>Ma Sói</div>
            <div className="text-[11px] font-semibold" style={{ color: WW.slate }}>Đêm Trăng Làng Dr Hùng</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <div className="rounded-[26px] p-8 text-center" style={{ background: '#fff', border: '1px solid #EEF2F9' }}>
          <div className="mx-auto w-24 h-24 ww-float"><MascotWolf book /></div>
          <div className="mt-3 font-bold" style={{ color: WW.navy }}>Đang chuẩn bị ván chơi...</div>
        </div>
      </Shell>
    );
  }

  // ================= LANDING =================
  if (!room) {
    return (
      <Shell>
        {/* Hero navy immersive */}
        <div className="rounded-[26px] p-6 relative overflow-hidden text-center" style={{ background: `linear-gradient(160deg, ${WW.navy}, #27385E)` }}>
          {[[14, 18], [92, 12], [78, 40], [22, 52], [55, 8]].map(([x, y], i) => (
            <span key={i} className="absolute w-1.5 h-1.5 rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animation: `wwStar ${2 + i * 0.5}s ease-in-out infinite` }} />
          ))}
          <div className="mx-auto w-32 h-32 ww-float"><MascotWolf book /></div>
          <div className="text-white font-black text-2xl mt-1">MA SÓI</div>
          <div className="text-[13px] mt-1" style={{ color: '#B9C6E4' }}>Trò chơi suy luận xã hội cho cả đội — cùng nhau tìm ra kẻ giấu mặt!</div>
        </div>

        {/* Mode selector: OFFLINE hoạt động, ONLINE sắp ra mắt */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[20px] p-4 bg-white shadow-sm" style={{ border: `2px solid ${WW.mint}` }}>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black text-white" style={{ background: WW.mint }}>
              <Moon className="w-3 h-3" /> OFFLINE
            </span>
            <div className="font-bold text-sm mt-2" style={{ color: WW.navy }}>Chơi trực tiếp</div>
            <div className="text-[11px] mt-0.5" style={{ color: WW.slate }}>App chia vai bí mật, cả đội ngồi chơi cùng nhau tại văn phòng.</div>
          </div>
          <div className="rounded-[20px] p-4 bg-white/70 shadow-sm relative overflow-hidden" style={{ border: '2px dashed #D9E1F0' }}>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black text-white" style={{ background: WW.slate }}>
              <Video className="w-3 h-3" /> ONLINE
            </span>
            <div className="font-bold text-sm mt-2" style={{ color: WW.slate }}>Video call + engine</div>
            <div className="text-[11px] mt-0.5" style={{ color: WW.slate }}>Sắp ra mắt — chơi từ xa với vòng đêm/ngày tự động.</div>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-[26px] p-5 bg-white shadow-sm space-y-3" style={{ border: '1px solid #EEF2F9' }}>
          <button onClick={createRoom} disabled={busy}
            className="w-full py-3.5 rounded-[20px] font-black text-[15px] text-white shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${WW.gold}, #E8A93C)` }}>
            <span className="inline-flex items-center gap-2"><Play className="w-4 h-4" /> TẠO PHÒNG MỚI</span>
          </button>
          <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: WW.slate }}>
            <span className="flex-1 h-px" style={{ background: '#EEF2F9' }} /> hoặc vào phòng có sẵn <span className="flex-1 h-px" style={{ background: '#EEF2F9' }} />
          </div>
          <div className="flex gap-2">
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" placeholder="Nhập mã 6 số"
              className="flex-1 min-w-0 px-4 py-3 rounded-[16px] text-center font-black tracking-[0.3em] outline-none"
              style={{ background: WW.softBlue, border: '1.5px solid #D6E4FB', color: WW.navy }} />
            <button onClick={joinRoom} disabled={busy}
              className="px-5 rounded-[16px] font-black text-white active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: WW.blue }}>
              <QrCode className="w-5 h-5" />
            </button>
          </div>
          <MascotTip>Tối thiểu <b>4 người</b> để bắt đầu. Cần <b>1 quản trò</b> (người tạo phòng) dẫn dắt các đêm — app sẽ đưa quản trò danh sách vai đầy đủ.</MascotTip>
        </div>
      </Shell>
    );
  }

  const n = players.length;
  const comp = composition(Math.max(n, 4));
  const nameOf = (uid) => players.find((p) => p.user_id === uid)?.profiles?.full_name || '—';

  // ================= LOBBY =================
  if (room.status === 'LOBBY') {
    const allReady = n >= 4 && players.every((p) => p.ready);
    return (
      <Shell>
        {/* Room summary */}
        <div className="rounded-[26px] p-5 bg-white shadow-sm" style={{ border: '1px solid #EEF2F9' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black text-base truncate" style={{ color: WW.navy }}>Phòng của {nameOf(room.host_id)}</div>
              <div className="text-[12px] font-semibold mt-0.5" style={{ color: WW.slate }}>
                <Users className="w-3.5 h-3.5 inline mr-1" />{n} người · Ván {room.round}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-black tracking-widest" style={{ color: WW.slate }}>MÃ PHÒNG</div>
              <button onClick={copyCode} className="font-black text-2xl tracking-[0.18em]" style={{ color: WW.blue }}>{room.code}</button>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-black text-white" style={{ background: WW.mint }}>
            <Moon className="w-3 h-3" /> OFFLINE — chơi trực tiếp
          </span>
        </div>

        {/* Invite */}
        <div className="rounded-[26px] p-5 bg-white shadow-sm text-center" style={{ border: '1px solid #EEF2F9' }}>
          <div className="font-bold text-sm" style={{ color: WW.navy }}>Mời người chơi</div>
          <div className="text-[11px] mt-0.5" style={{ color: WW.slate }}>Quét QR hoặc nhập mã phòng trong Minigame → Ma Sói</div>
          {qr && <img src={qr} alt="QR mời" className="mx-auto mt-3 w-44 h-44 rounded-2xl" style={{ border: '1px solid #EEF2F9' }} />}
          <div className="flex justify-center gap-2 mt-3">
            <button onClick={copyCode} className="px-3.5 py-2 rounded-[14px] text-[12px] font-bold inline-flex items-center gap-1.5" style={{ background: WW.softBlue, color: WW.blue }}>
              <Copy className="w-3.5 h-3.5" /> Sao chép mã
            </button>
            <button onClick={shareLink} className="px-3.5 py-2 rounded-[14px] text-[12px] font-bold inline-flex items-center gap-1.5" style={{ background: WW.softBlue, color: WW.blue }}>
              <Share2 className="w-3.5 h-3.5" /> Chia sẻ link
            </button>
          </div>
        </div>

        {/* Roster */}
        <div className="rounded-[26px] p-5 bg-white shadow-sm" style={{ border: '1px solid #EEF2F9' }}>
          <div className="font-bold text-sm mb-3" style={{ color: WW.navy }}>Người chơi ({n})</div>
          {n <= 1 ? (
            <div className="text-center py-4">
              <div className="mx-auto w-24 h-24"><MascotWolf book /></div>
              <div className="text-[13px] font-semibold mt-2" style={{ color: WW.navy }}>Chưa có ai tham gia.</div>
              <div className="text-[12px]" style={{ color: WW.slate }}>Chia sẻ mã phòng để bắt đầu nhé!</div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {players.map((p, i) => (
                <div key={p.id} className="relative">
                  <PlayerAvatar index={i} name={p.user_id === me ? 'Bạn' : (p.profiles?.full_name || '—')} ready={p.ready} isHost={p.user_id === room.host_id} />
                  {isHost && p.user_id !== me && (
                    <button onClick={() => kick(p)} className="absolute -top-1 -right-0.5 w-5 h-5 rounded-full grid place-items-center bg-white shadow" style={{ border: '1px solid #F3D3D0' }}>
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Cơ cấu vai dự kiến */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px dashed #EEF2F9' }}>
            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: WW.slate }}>CƠ CẤU VAI ({Math.max(n, 4)} NGƯỜI)</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(comp).map(([rid, cnt]) => {
                const r = ROLES[rid];
                return (
                  <span key={rid} className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>
                    {r.name}{cnt > 1 ? ` ×${cnt}` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-2 pb-6">
          {myPlayer && (
            <button onClick={toggleReady}
              className="w-full py-3 rounded-[20px] font-black text-[14px] active:scale-[0.98] transition-transform"
              style={myPlayer.ready
                ? { background: '#EAFBF4', color: '#2E9E7E', border: `2px solid ${WW.mint}` }
                : { background: WW.blue, color: '#fff' }}>
              {myPlayer.ready ? '✓ ĐÃ SẴN SÀNG — bấm để huỷ' : 'SẴN SÀNG'}
            </button>
          )}
          {isHost && (
            <button onClick={() => act('ww_start_room', { p_room: room.id })} disabled={busy || !allReady}
              className="w-full py-4 rounded-[20px] font-black text-[15px] text-white shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${WW.gold}, #E8A93C)` }}>
              <span className="inline-flex items-center gap-2"><Play className="w-5 h-5" /> BẮT ĐẦU VÁN</span>
            </button>
          )}
          {isHost && !allReady && (
            <div className="text-center text-[11px] font-semibold" style={{ color: WW.slate }}>
              {n < 4 ? `Cần thêm ${4 - n} người nữa (tối thiểu 4)` : 'Chờ mọi người bấm SẴN SÀNG'}
            </div>
          )}
          <div className="flex justify-center gap-4 pt-1">
            {!isHost && myPlayer && (
              <button onClick={leaveRoom} className="text-[12px] font-bold inline-flex items-center gap-1" style={{ color: WW.slate }}>
                <LogOut className="w-3.5 h-3.5" /> Rời phòng
              </button>
            )}
            {isHost && (
              <button onClick={closeRoom} className="text-[12px] font-bold inline-flex items-center gap-1" style={{ color: '#D9776E' }}>
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

  // Panel quản trò (host xem toàn bộ vai)
  const HostPanel = () => hostRoles && (
    <div className="rounded-[26px] p-5 shadow-sm" style={{ background: '#fff', border: `2px solid ${WW.peach}` }}>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4" style={{ color: WW.gold }} />
        <span className="font-black text-sm" style={{ color: WW.navy }}>Bảng vai — CHỈ QUẢN TRÒ</span>
      </div>
      <div className="text-[11px] mb-3" style={{ color: WW.slate }}>Giữ kín màn hình này. Dùng để dẫn dắt các lượt đêm.</div>
      <div className="space-y-1.5">
        {[...hostRoles].sort((a, b) => (a.role === 'wolf' ? -1 : 1) - (b.role === 'wolf' ? -1 : 1)).map((hr) => {
          const r = ROLES[hr.role] || ROLES.villager;
          return (
            <div key={hr.user_id} className="flex items-center justify-between px-3 py-2 rounded-2xl" style={{ background: r.bg }}>
              <span className="text-[13px] font-bold truncate" style={{ color: WW.navy }}>{nameOf(hr.user_id)}{hr.user_id === me ? ' (Bạn)' : ''}</span>
              <span className="text-[12px] font-black shrink-0" style={{ color: r.color }}>{r.name}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => act('ww_new_round', { p_room: room.id }, 'Đã mở ván mới!')} disabled={busy}
          className="flex-1 py-2.5 rounded-[16px] font-black text-[13px] text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: WW.blue }}>
          <RotateCcw className="w-4 h-4" /> Ván mới
        </button>
        <button onClick={closeRoom} className="px-4 py-2.5 rounded-[16px] font-black text-[13px]" style={{ background: '#FFF0EE', color: '#D9776E' }}>
          Kết thúc
        </button>
      </div>
    </div>
  );

  return (
    <Shell>
      {/* Khu lật bài — nền navy immersive */}
      <div className="rounded-[26px] p-5 relative overflow-hidden" style={{ background: `linear-gradient(165deg, ${WW.navy}, #2A3C66)` }}>
        {[[10, 14], [88, 10], [70, 30], [18, 44], [50, 6], [92, 48]].map(([x, y], i) => (
          <span key={i} className="absolute w-1.5 h-1.5 rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animation: `wwStar ${2 + i * 0.4}s ease-in-out infinite` }} />
        ))}
        <div className="absolute top-4 right-5 w-10 h-10 rounded-full" style={{ background: WW.cream, boxShadow: `0 0 24px ${WW.cream}88` }} />

        <div className="relative" style={{ perspective: 1200 }}>
          <div className="ww-flip" style={{ transform: showCard ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            {/* MẶT ÚP */}
            <div className="ww-face" style={{ transform: 'rotateY(0deg)' }}>
              <div className="rounded-[22px] px-5 py-9 text-center" style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px dashed rgba(255,255,255,0.3)' }}>
                <div className="mx-auto w-24 h-24 ww-float"><MascotWolf /></div>
                <div className="text-white font-black text-lg mt-2">Vai trò của bạn đang được giữ bí mật</div>
                <div className="text-[12px] mt-1 mb-5" style={{ color: '#B9C6E4' }}>Đảm bảo không ai nhìn thấy màn hình rồi hãy mở nhé</div>
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
            className="relative w-full mt-3 py-3.5 rounded-[18px] font-black text-[14px] text-white active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${WW.mint}, #46B9A9)` }}>
            ✓ TÔI ĐÃ HIỂU VAI CỦA MÌNH
          </button>
        )}
        {showCard && (room.status === 'HANDOFF' || myPlayer?.acked) && (
          <button onClick={() => setReviewing(false)}
            className="relative w-full mt-3 py-3 rounded-[18px] font-black text-[13px]" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Ẩn vai đi
          </button>
        )}
      </div>

      {/* Trạng thái chờ / handoff */}
      {room.status === 'REVEAL' && myPlayer?.acked && !reviewing && (
        <div className="rounded-[26px] p-5 bg-white shadow-sm text-center" style={{ border: '1px solid #EEF2F9' }}>
          <div className="font-black" style={{ color: WW.navy }}>Chờ mọi người nhận vai… {ackedCount}/{n}</div>
          <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
            {players.map((p, i) => (
              <span key={p.id} className="w-3 h-3 rounded-full" style={{ background: p.acked ? WW.mint : '#E3E9F4' }} title={p.profiles?.full_name} />
            ))}
          </div>
        </div>
      )}

      {room.status === 'HANDOFF' && !reviewing && (
        <div className="rounded-[26px] p-6 text-center shadow-sm" style={{ background: '#fff', border: `2px solid ${WW.mint}` }}>
          <span className="mx-auto w-14 h-14 rounded-full grid place-items-center" style={{ background: '#EAFBF4' }}>
            <Check className="w-7 h-7" style={{ color: '#2E9E7E' }} />
          </span>
          <div className="font-black text-xl mt-2" style={{ color: WW.navy }}>ĐÃ NHẬN VAI</div>
          <div className="text-[13px] mt-1" style={{ color: WW.slate }}>Hãy cất điện thoại<br />và tham gia trò chơi trực tiếp.</div>
          <button onClick={() => setReviewing(true)}
            className="mt-4 px-5 py-2.5 rounded-[16px] font-bold text-[13px]" style={{ background: WW.softBlue, color: WW.blue }}>
            Xem lại vai của tôi
          </button>
        </div>
      )}

      {isHost && (room.status === 'REVEAL' || room.status === 'HANDOFF') && <div className="pb-6"><HostPanel /></div>}
    </Shell>
  );
}
