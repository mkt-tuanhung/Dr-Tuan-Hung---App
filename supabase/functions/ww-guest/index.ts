// ============================================================
// MA SÓI — CỔNG KHÁCH VÃNG LAI (guest). Deploy: Verify JWT = OFF.
// Khách KHÔNG đăng nhập; mọi thao tác đi qua đây, xác thực bằng
// mã phòng (code) + guest_token (chuỗi ngẫu nhiên lưu ở máy khách).
// TUYỆT ĐỐI chỉ đụng bảng ww_rooms / ww_players — không chạm CRM.
// Actions: join | ready | my_role | ack | leave
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Lấy phòng đang mở theo mã (mới nhất, chưa kết thúc)
async function roomByCode(code: string) {
  const { data } = await db.from('ww_rooms').select('*')
    .eq('code', code).neq('status', 'ENDED')
    .order('created_at', { ascending: false }).limit(1);
  return data?.[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || '');
    const code = String(b.code || '').replace(/\D/g, '').slice(0, 6);
    const token = String(b.guestToken || '').slice(0, 64);
    if (!code || !token) return json({ error: 'Thiếu mã phòng hoặc mã khách' }, 400);

    const room = await roomByCode(code);
    if (!room) return json({ error: 'Mã phòng không tồn tại hoặc đã kết thúc' }, 404);

    // Ghế của khách trong phòng (nếu đã có)
    const findSeat = async () => {
      const { data } = await db.from('ww_players').select('id, ready, acked, role')
        .eq('room_id', room.id).eq('guest_token', token).maybeSingle();
      return data;
    };

    if (action === 'join') {
      const name = String(b.guestName || '').trim().slice(0, 40) || 'Khách';
      const seat = await findSeat();
      if (seat) return json({ ok: true, room_id: room.id, player_id: seat.id, rejoined: true });   // đã trong phòng -> cho vào lại
      if (room.status !== 'LOBBY') return json({ error: 'Ván đã bắt đầu — chờ ván sau nhé' }, 409);
      const { count } = await db.from('ww_players').select('id', { count: 'exact', head: true }).eq('room_id', room.id);
      if ((count || 0) >= 20) return json({ error: 'Phòng đã đầy (tối đa 20 người)' }, 409);
      const { data: ins, error } = await db.from('ww_players').insert({
        room_id: room.id, user_id: null, guest_token: token, guest_name: name, ready: false,
      }).select('id').single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, room_id: room.id, player_id: ins.id });
    }

    // Các action còn lại: bắt buộc khách đã có ghế
    const seat = await findSeat();
    if (!seat) return json({ error: 'Bạn chưa ở trong phòng này' }, 403);

    if (action === 'ready') {
      await db.from('ww_players').update({ ready: !!b.ready }).eq('id', seat.id);
      return json({ ok: true });
    }

    if (action === 'my_role') {
      return json({ ok: true, player_id: seat.id, role: room.status === 'LOBBY' ? null : (seat.role || null) });
    }

    if (action === 'ack') {
      await db.from('ww_players').update({ acked: true }).eq('id', seat.id);
      // Đủ người xác nhận -> chuyển HANDOFF (giống RPC ww_ack_role)
      const { count } = await db.from('ww_players')
        .select('id', { count: 'exact', head: true }).eq('room_id', room.id).eq('acked', false);
      if ((count || 0) === 0 && room.status === 'REVEAL') {
        await db.from('ww_rooms').update({ status: 'HANDOFF' }).eq('id', room.id).eq('status', 'REVEAL');
      }
      return json({ ok: true });
    }

    if (action === 'leave') {
      await db.from('ww_players').delete().eq('id', seat.id);
      return json({ ok: true });
    }

    return json({ error: 'Action không hợp lệ' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 200);
  }
});
