// ============================================================
// MA SÓI — KHÁCH VÃNG LAI (không cần tài khoản Dr Tuấn Hùng).
// Quét QR /ma-soi/:code khi CHƯA đăng nhập -> vào đây: nhập tên -> chơi.
// Đọc lobby/realtime bằng anon client; mọi thao tác ghi qua Edge Function
// ww-guest (xác thực bằng mã phòng + guest_token lưu ở máy). Chỉ JOIN & chơi,
// không tạo/không bắt đầu ván (host luôn là nhân sự). Hoàn toàn tách khỏi CRM.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { LogOut, Check } from 'lucide-react';
import { WW, MASCOT, BG_LOBBY, ICONS } from './wwRoles';
import { Styles, Stars, GoldBtn, NightPanel, HoldToReveal, RoleCard, PlayerTile } from './WerewolfGame.jsx';

// Token khách cố định theo máy (để nhận lại đúng ghế khi refresh)
function getGuestToken() {
  try {
    let t = localStorage.getItem('ww_guest_token');
    if (!t) { t = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now()).replace(/-/g, ''); localStorage.setItem('ww_guest_token', t); }
    return t;
  } catch { return 'g' + Date.now(); }
}

// Khách gọi thẳng RPC (security definer) — không cần Edge Function.
const callGuest = async ({ action, code, guestToken, guestName, ready }) => {
  const map = {
    join:    ['ww_guest_join',    { p_code: code, p_token: guestToken, p_name: guestName || '' }],
    ready:   ['ww_guest_ready',   { p_code: code, p_token: guestToken, p_ready: !!ready }],
    my_role: ['ww_guest_my_role', { p_code: code, p_token: guestToken }],
    ack:     ['ww_guest_ack',     { p_code: code, p_token: guestToken }],
    leave:   ['ww_guest_leave',   { p_code: code, p_token: guestToken }],
  }[action];
  if (!map) return { error: 'Hành động không hợp lệ' };
  const { data, error } = await supabase.rpc(map[0], map[1]);
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { data };
};

export default function WerewolfGuest({ code }) {
  const token = useRef(getGuestToken()).current;
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState(null);   // id ghế của tôi (xác định 'tôi' trong danh sách)
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ---------- Đọc trạng thái phòng (anon select — RLS cho phép đọc, trừ cột role) ----------
  const load = useCallback(async () => {
    const { data: rooms } = await supabase.from('ww_rooms').select('*')
      .eq('code', code).neq('status', 'ENDED').order('created_at', { ascending: false }).limit(1);
    const r = rooms?.[0] || null;
    setRoom(r);
    if (r) {
      const { data: ps } = await supabase.from('ww_players')
        .select('id, room_id, user_id, ready, acked, joined_at, guest_name')
        .eq('room_id', r.id).order('joined_at');
      setPlayers(ps || []);
      // Đã join & ván đã chia vai -> lấy vai của mình qua cổng khách
      if (joined) {
        const { data } = await callGuest({ action: 'my_role', code, guestToken: token });
        if (data?.player_id) setMyId(data.player_id);
        setMyRole(r.status !== 'LOBBY' ? (data?.role || null) : null);
        if (r.status === 'LOBBY') { setRevealed(false); setReviewing(false); }
      } else if (r.status === 'LOBBY') { setMyRole(null); setRevealed(false); setReviewing(false); }
    } else { setPlayers([]); setMyRole(null); }
    setLoading(false);
  }, [code, joined, token]);

  useEffect(() => { load(); }, [load]);
  useRealtimeReload('ww_rooms,ww_players', load);

  // Nếu máy này đã từng join (còn ghế) -> tự nhận lại, bỏ qua bước nhập tên
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current || !room) return;
    checkedRef.current = true;
    callGuest({ action: 'my_role', code, guestToken: token }).then(({ data, error }) => {
      if (!error && data) { setJoined(true); if (data.player_id) setMyId(data.player_id); }
    });
  }, [room, players, code, token]);

  const doJoin = async () => {
    const nm = name.trim();
    if (nm.length < 2) return toast.error('Nhập tên của bạn (tối thiểu 2 ký tự)');
    setBusy(true);
    const { data, error } = await callGuest({ action: 'join', code, guestToken: token, guestName: nm });
    setBusy(false);
    if (error) return toast.error(error);
    if (data?.player_id) setMyId(data.player_id);
    setJoined(true); toast.success('Đã vào phòng!'); load();
  };
  const toggleReady = async (val) => { await callGuest({ action: 'ready', code, guestToken: token, ready: val }); load(); };
  const ackRole = async () => { setReviewing(false); await callGuest({ action: 'ack', code, guestToken: token }); load(); };
  const leave = async () => { if (!confirm('Rời phòng?')) return; await callGuest({ action: 'leave', code, guestToken: token }); setJoined(false); setMyRole(null); load(); };

  const dispName = (p) => p?.guest_name || (room && p?.user_id === room.host_id ? 'Chủ phòng' : (p?.user_id ? 'Nhân sự' : '—'));
  const Shell = ({ children }) => (
    <div className="min-h-screen px-3 py-4 relative" style={{ background: `linear-gradient(180deg, ${WW.nightTop} 0%, ${WW.nightBottom} 100%)` }}>
      <Styles /><Stars />
      <div className="max-w-2xl mx-auto space-y-4 relative">
        <div className="flex items-center gap-2.5">
          <img src={ICONS.night} alt="" className="w-8 h-8 object-contain" />
          <div>
            <div className="font-black text-lg leading-tight" style={{ color: WW.gold }}>Làng Sói Tuấn Hùng</div>
            <div className="text-[10.5px] font-bold tracking-wide text-white/60">KHÁCH THAM GIA · PHÒNG {code}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return <Shell><NightPanel className="text-center py-8"><img src={MASCOT} alt="" className="mx-auto h-32 object-contain ww-float" /><div className="mt-3 font-bold text-white">Đang tải phòng...</div></NightPanel></Shell>;
  }
  if (!room) {
    return <Shell><NightPanel className="text-center py-8"><img src={MASCOT} alt="" className="mx-auto h-28 object-contain" /><div className="mt-3 font-black text-white">Phòng không tồn tại hoặc đã kết thúc</div><div className="text-[12px] text-white/60 mt-1">Xin mã phòng mới từ người tạo phòng nhé.</div></NightPanel></Shell>;
  }

  // ---------- Chưa join: nhập tên ----------
  if (!joined) {
    return (
      <Shell>
        <div className="rounded-[26px] relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
          <img src={BG_LOBBY} alt="" className="w-full h-40 object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,30,56,0) 30%, rgba(20,30,56,0.9) 100%)' }} />
          <img src={MASCOT} alt="" className="absolute bottom-0 left-3 h-[86%] object-contain ww-float" draggable={false} />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center w-full pl-16">
            <div className="font-black text-2xl" style={{ color: WW.gold }}>Vào Làng Sói Tuấn Hùng</div>
            <div className="text-[11.5px] font-semibold text-white/85">Nhập tên để cùng chơi — không cần tài khoản!</div>
          </div>
        </div>
        <NightPanel className="space-y-3">
          <div className="text-[12px] font-bold text-white/75">Tên của bạn</div>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} onKeyDown={(e) => { if (e.key === 'Enter') doJoin(); }}
            placeholder="VD: Minh Anh" autoFocus
            className="w-full px-4 py-3 rounded-[16px] text-center font-black text-lg outline-none"
            style={{ background: '#fff', border: '1.5px solid #D6E4FB', color: WW.textPrimary }} />
          <GoldBtn onClick={doJoin} disabled={busy}>
            <span className="inline-flex items-center gap-2"><img src={ICONS.join} alt="" className="w-5 h-5 object-contain" /> Tham gia phòng {code}</span>
          </GoldBtn>
          <div className="text-[11px] text-white/50 text-center">Bạn chỉ tham gia trò chơi Làng Sói Tuấn Hùng, không truy cập dữ liệu nội bộ.</div>
        </NightPanel>
      </Shell>
    );
  }

  const playersOnly = players.filter((p) => !room || p.user_id !== room.host_id); // trừ quản trò
  const n = playersOnly.length;
  const showCard = (revealed || reviewing) && myRole;

  // ---------- LOBBY ----------
  if (room.status === 'LOBBY') {
    const me = players.find((p) => p.id === myId);
    const slots = Math.max(4, Math.ceil(n / 4) * 4);
    return (
      <Shell>
        <NightPanel>
          <div className="font-black text-[14px] text-white mb-1 inline-flex items-center gap-1.5">
            <img src={ICONS.players} alt="" className="w-5 h-5 object-contain" /> Người chơi ({n})
          </div>
          <div className="text-[11.5px] text-white/60 mb-3">Chờ chủ phòng bắt đầu ván…</div>
          <div className="grid grid-cols-4 gap-2.5">
            {players.map((p, i) => (
              <PlayerTile key={p.id} index={i} name={p.id === myId ? "Bạn" : dispName(p)} ready={p.ready} isHost={!!room && p.user_id === room.host_id} onKick={null} />
            ))}
            {Array.from({ length: slots - n }).map((_, i) => (
              <div key={`e${i}`} className="rounded-[18px] grid place-items-center py-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px dashed rgba(255,255,255,0.2)' }}>
                <span className="text-[9.5px] font-bold text-white/40">Đợi người chơi</span>
              </div>
            ))}
          </div>
        </NightPanel>
        <div className="space-y-2 pb-6">
          <button onClick={() => toggleReady(!(me?.ready))}
            className="w-full py-3 rounded-[20px] font-black text-[14px] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
            style={me?.ready ? { background: 'rgba(103,215,201,0.15)', color: WW.mint, border: `2px solid ${WW.mint}` } : { background: WW.primary, color: '#fff' }}>
            <img src={ICONS.ready} alt="" className="w-5 h-5 object-contain" />
            {me?.ready ? 'ĐÃ SẴN SÀNG — bấm để huỷ' : 'SẴN SÀNG'}
          </button>
          <div className="flex justify-center pt-1">
            <button onClick={leave} className="text-[12px] font-bold inline-flex items-center gap-1 text-white/60"><LogOut className="w-3.5 h-3.5" /> Rời phòng</button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- REVEAL / HANDOFF ----------
  const ackedCount = playersOnly.filter((p) => p.acked).length;
  return (
    <Shell>
      <div className="text-center">
        <div className="font-black text-lg text-white">Vai trò của bạn</div>
        <div className="text-[12px] text-white/60">Ván {room.round} · Giữ bí mật nhé!</div>
      </div>
      <div className="relative" style={{ perspective: 1200 }}>
        <div className="ww-flip" style={{ transform: showCard ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
          <div className="ww-face" style={{ transform: 'rotateY(0deg)' }}>
            <div className="rounded-[26px] px-5 py-10 text-center" style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px dashed rgba(255,255,255,0.3)' }}>
              <img src={MASCOT} alt="" className="mx-auto h-32 object-contain ww-float" />
              <div className="text-white font-black text-lg mt-2">Vai trò của bạn đang được giữ bí mật</div>
              <div className="text-[12px] mt-1 mb-6 text-white/65">Đảm bảo không ai nhìn thấy màn hình rồi hãy mở nhé</div>
              <HoldToReveal onDone={() => { setRevealed(true); setReviewing(true); }} />
            </div>
          </div>
          <div className="ww-face absolute inset-0" style={{ transform: 'rotateY(180deg)' }}>
            {showCard && <RoleCard roleId={myRole} />}
          </div>
        </div>
        {showCard && <div className="invisible"><RoleCard roleId={myRole} /></div>}
      </div>

      {showCard && room.status === 'REVEAL' && (
        <button onClick={ackRole} disabled={busy}
          className="w-full py-3.5 rounded-[18px] font-black text-[14px] text-white active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: WW.primary, boxShadow: '0 6px 18px rgba(47,91,255,.35)' }}>Đã hiểu</button>
      )}
      {showCard && room.status === 'HANDOFF' && (
        <button onClick={() => setReviewing(false)} className="w-full py-3 rounded-[18px] font-black text-[13px] text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>Ẩn vai đi</button>
      )}

      {room.status === 'REVEAL' && !reviewing && (
        <NightPanel className="text-center">
          <div className="font-black text-white">Chờ mọi người nhận vai… {ackedCount}/{n}</div>
          <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
            {playersOnly.map((p) => (<span key={p.id} className="w-3 h-3 rounded-full" style={{ background: p.acked ? WW.success : 'rgba(255,255,255,0.2)' }} />))}
          </div>
        </NightPanel>
      )}
      {room.status === 'HANDOFF' && !reviewing && (
        <div className="rounded-[26px] p-6 text-center" style={{ background: '#fff' }}>
          <span className="mx-auto w-14 h-14 rounded-full grid place-items-center" style={{ background: '#E7F9F1' }}><Check className="w-7 h-7" style={{ color: WW.success }} /></span>
          <div className="font-black text-xl mt-2" style={{ color: WW.textPrimary }}>ĐÃ NHẬN VAI</div>
          <div className="text-[13px] mt-1" style={{ color: WW.textSecondary }}>Hãy cất điện thoại<br />và tham gia trò chơi trực tiếp.</div>
          <button onClick={() => setReviewing(true)} className="mt-4 px-5 py-2.5 rounded-[16px] font-bold text-[13px]" style={{ background: WW.softBlue, color: WW.primary }}>Xem lại vai của tôi</button>
        </div>
      )}
    </Shell>
  );
}
