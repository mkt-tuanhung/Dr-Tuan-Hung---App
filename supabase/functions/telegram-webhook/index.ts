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

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    // 1) Bấm nút Duyệt / Từ chối
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const [act, type, id] = String(cq.data).split(':');
      const { data: resultText } = await supabase.rpc('tg_resolve', {
        p_action_type: type,
        p_action_id: id,
        p_approve: act === 'ok',
        p_chat_id: String(chatId),
      });
      await api('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: act === 'ok' ? 'Đã duyệt' : 'Đã từ chối',
      });
      // Sửa lại tin nhắn: bỏ nút, hiện kết quả
      const original = cq.message.text || '';
      await api('editMessageText', {
        chat_id: chatId,
        message_id: cq.message.message_id,
        text: `${original}\n\n${resultText || '✔️ Đã xử lý'}`,
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
