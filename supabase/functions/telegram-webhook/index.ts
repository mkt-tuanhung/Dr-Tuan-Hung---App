// Telegram bot webhook — liên kết tài khoản (/start <nonce>) + duyệt/từ chối qua nút bấm.
// Deploy với "Verify JWT" = OFF (Telegram không gửi JWT).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const api = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const sendMessage = (chatId: number | string, text: string) =>
  api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Trạng thái hành trình khách hàng (nút bấm trong nhóm HÀNH TRÌNH)
const JOURNEY: Record<string, { icon: string; label: string }> = {
  xn_xong: { icon: '🧪', label: 'ĐÃ XÉT NGHIỆM XONG' },
  dang_mo: { icon: '🔪', label: 'ĐANG PHẪU THUẬT' },
  mo_xong: { icon: '✅', label: 'ĐÃ PHẪU THUẬT XONG' },
  ra_vien: { icon: '🏠', label: 'ĐÃ RA VIỆN' },
};
// Vai trò được phép bấm nút hành trình (nếu đã liên kết Telegram trong app)
const JOURNEY_ROLES = ['dieu_duong', 'admin'];
// HOẶC: danh sách ID Telegram được phép bấm — secret TELEGRAM_JOURNEY_ALLOWED_IDS
// (các ID cách nhau dấu phẩy, VD "123456789,987654321"). Không cần liên kết app.
const ALLOWED_IDS = (Deno.env.get('TELEGRAM_JOURNEY_ALLOWED_IDS') || '')
  .split(',').map((x) => x.trim()).filter(Boolean);

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    // 1) Bấm nút Duyệt / Từ chối
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const [act, type, id] = String(cq.data).split(':');

      // 1b) NÚT HÀNH TRÌNH KHÁCH HÀNG: js:<trạng_thái>:<appointment_id>
      if (act === 'js') {
        const st = JOURNEY[type];
        const presserId = String(cq.from?.id || '');
        // Cách 1: ID nằm trong danh sách cho phép (secret TELEGRAM_JOURNEY_ALLOWED_IDS)
        // Cách 2: đã liên kết Telegram trong app và có vai trò Điều dưỡng/Admin
        const { data: staff } = await supabase.from('profiles')
          .select('full_name, role, role_2').eq('telegram_chat_id', presserId).maybeSingle();
        const roles = [staff?.role, staff?.role_2].filter(Boolean) as string[];
        const allowed = ALLOWED_IDS.includes(presserId) ||
          (!!staff && roles.some((r) => JOURNEY_ROLES.includes(r)));
        if (!st || !allowed) {
          await api('answerCallbackQuery', {
            callback_query_id: cq.id, show_alert: true,
            text: !st
              ? 'Nút không hợp lệ.'
              : `Bạn chưa có quyền cập nhật hành trình khách.\n\nID Telegram của bạn: ${presserId}\nGửi ID này cho quản lý để được cấp quyền.`,
          });
          return new Response('ok');
        }
        // Tên hiển thị: ưu tiên tên trong app, không có thì lấy tên Telegram
        const presserName = staff?.full_name ||
          [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(' ') || 'Thành viên nhóm';
        const { data: appt } = await supabase.from('customer_appointments')
          .select('customer_name, journey_status').eq('id', id).maybeSingle();
        if (!appt) {
          await api('answerCallbackQuery', { callback_query_id: cq.id, show_alert: true, text: 'Không tìm thấy hồ sơ khách (có thể đã bị xoá).' });
          return new Response('ok');
        }
        if (appt.journey_status === type) {
          await api('answerCallbackQuery', { callback_query_id: cq.id, text: `Đã ở trạng thái ${st.label} rồi` });
          return new Response('ok');
        }
        await supabase.from('customer_appointments').update({
          journey_status: type,
          journey_updated_at: new Date().toISOString(),
          journey_updated_by: presserName,
        }).eq('id', id);
        const t = new Date(Date.now() + 7 * 3600 * 1000);
        const hhmm = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
        // Đăng tin cập nhật vào chính nhóm chứa nút (giữ nguyên nút để bấm bước tiếp theo)
        await sendMessage(chatId, `${st.icon} <b>${esc(appt.customer_name)} — ${st.label}</b>\n🕒 ${hhmm} · cập nhật bởi <b>${esc(presserName)}</b>`);
        await api('answerCallbackQuery', { callback_query_id: cq.id, text: `Đã cập nhật: ${st.label}` });
        return new Response('ok');
      }
      const { data: resultText, error: rpcErr } = await supabase.rpc('tg_resolve', {
        p_action_type: type,
        p_action_id: id,
        p_approve: act === 'ok',
        p_chat_id: String(chatId),
      });
      const resultMsg = rpcErr ? ('⚠️ Lỗi xử lý: ' + rpcErr.message) : (resultText || '✔️ Đã xử lý');
      await api('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: rpcErr ? 'Có lỗi, xem chi tiết' : (act === 'ok' ? 'Đã duyệt' : 'Đã từ chối'),
      });
      // Sửa lại tin nhắn: bỏ nút, hiện kết quả
      const original = cq.message.text || '';
      await api('editMessageText', {
        chat_id: chatId,
        message_id: cq.message.message_id,
        text: `${original}\n\n${resultMsg}`,
        parse_mode: 'HTML',
      });
      return new Response('ok');
    }

    // 2) Liên kết tài khoản
    const msg = update.message;
    if (msg?.text?.startsWith('/start')) {
      const chatId = msg.chat.id;
      const nonce = msg.text.split(' ')[1];
      if (nonce) {
        const { data: link } = await supabase
          .from('telegram_links').select('user_id').eq('nonce', nonce).single();
        if (link) {
          await supabase.from('profiles')
            .update({ telegram_chat_id: String(chatId) }).eq('id', link.user_id);
          await supabase.from('telegram_links').delete().eq('nonce', nonce);
          await sendMessage(chatId, '✅ <b>Đã liên kết tài khoản!</b>\nTừ giờ bạn sẽ nhận thông báo ngay tại đây.');
        } else {
          await sendMessage(chatId, '⚠️ Mã liên kết không hợp lệ hoặc đã dùng. Mở app → menu tài khoản → "Nhận thông báo Telegram" để thử lại.');
        }
      } else {
        await sendMessage(chatId, '👋 Chào bạn! Mở app Dr Tuấn Hùng → menu tài khoản → "Nhận thông báo Telegram" để liên kết.');
      }
    }
  } catch (_e) {
    // luôn trả 200 để Telegram không retry dồn
  }
  return new Response('ok');
});
