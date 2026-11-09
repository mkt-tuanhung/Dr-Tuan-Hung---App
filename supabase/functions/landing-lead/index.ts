// Nhận lead từ landing page (dr-tuan-hung-landing): lưu vào landing_leads
// và đẩy Telegram cho tất cả admin đã liên kết bot.
// Deploy với "Verify JWT" = OFF (form công khai, không có JWT).
// Chống spam bot cơ bản: honeypot field "website" - bot điền vào sẽ bị bỏ qua lặng lẽ.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let payload: Record<string, string>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // Honeypot: trả về "ok" giả để bot không biết bị chặn
  if (payload.website) return json({ ok: true });

  const name = (payload.name ?? '').trim().slice(0, 120);
  const phone = (payload.phone ?? '').trim().slice(0, 20);
  const service = (payload.service ?? '').trim().slice(0, 120);
  const message = (payload.message ?? '').trim().slice(0, 2000);

  if (name.length < 2) return json({ error: 'name required' }, 400);
  if (!/^[0-9+ ]{8,15}$/.test(phone)) return json({ error: 'invalid phone' }, 400);

  const { error } = await supabase
    .from('landing_leads')
    .insert({ name, phone, service: service || null, message: message || null });
  if (error) return json({ error: 'insert failed' }, 500);

  // Gửi Telegram cho mọi admin đã liên kết bot; lỗi gửi không làm fail request
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('role', 'admin')
      .not('telegram_chat_id', 'is', null);

    const text =
      `🩺 <b>Lead mới từ landing page</b>\n` +
      `👤 ${escapeHtml(name)}\n` +
      `📞 ${escapeHtml(phone)}` +
      (service ? `\n💉 ${escapeHtml(service)}` : '') +
      (message ? `\n💬 ${escapeHtml(message)}` : '');

    await Promise.allSettled(
      (admins ?? []).map((a) =>
        fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: a.telegram_chat_id,
            text,
            parse_mode: 'HTML',
          }),
        }),
      ),
    );
  } catch (_e) {
    // đã lưu lead thành công, bỏ qua lỗi Telegram
  }

  return json({ ok: true });
});
