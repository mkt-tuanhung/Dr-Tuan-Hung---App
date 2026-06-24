// Đẩy thông báo về Telegram. Gọi bởi Supabase Database Webhook khi INSERT vào bảng notifications.
// Deploy với "Verify JWT" = OFF; bảo vệ bằng header x-webhook-secret = WEBHOOK_SECRET.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SECRET = Deno.env.get('WEBHOOK_SECRET'); // tùy chọn nhưng nên đặt
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (SECRET && req.headers.get('x-webhook-secret') !== SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  try {
    const payload = await req.json();
    const rec = payload.record ?? payload; // DB webhook gửi { type, record, ... }
    if (!rec?.user_id) return new Response('no user');

    const { data: prof } = await supabase
      .from('profiles').select('telegram_chat_id').eq('id', rec.user_id).single();

    if (prof?.telegram_chat_id) {
      const text = `🔔 <b>${rec.title ?? 'Thông báo'}</b>` + (rec.body ? `\n${rec.body}` : '');
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: prof.telegram_chat_id, text, parse_mode: 'HTML' }),
      });
    }
  } catch (e) {
    return new Response('error: ' + (e as Error).message, { status: 200 });
  }
  return new Response('ok');
});
