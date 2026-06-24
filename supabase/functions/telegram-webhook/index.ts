// Telegram bot webhook — nhận /start <nonce> để liên kết tài khoản.
// Deploy với "Verify JWT" = OFF (Telegram không gửi JWT).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sendMessage(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();
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
