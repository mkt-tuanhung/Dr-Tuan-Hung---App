// mw-ai: Trợ lý AI của Marketing Workspace — CHỈ đề xuất bản nháp thẻ việc (không ghi gì vào database).
// Đầu vào: câu yêu cầu của người dùng + tên workspace / board / cột. Không nhận dữ liệu khách hàng.
// Yêu cầu đăng nhập (Verify JWT = ON, mặc định). Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Chưa đăng nhập' }, 401);
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ error: 'Chưa đăng nhập' }, 401);
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return json({ error: 'Thiếu secret OPENAI_API_KEY trên Supabase' });

    const body = await req.json().catch(() => ({}));
    const prompt = clip(body.prompt, 2000).trim();
    if (!prompt) return json({ error: 'Chưa nhập yêu cầu' });
    const ctx = body.context || {};
    const context = `Workspace: ${clip(ctx.workspace, 120)}\nBoard: ${clip(ctx.board, 120)}\nCác cột: ${(Array.isArray(ctx.columns) ? ctx.columns : []).slice(0, 30).map((c: unknown) => clip(c, 60)).join(' → ')}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', temperature: 0.4, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Bạn là trợ lý lập kế hoạch nội dung marketing cho phòng khám thẩm mỹ Dr Tuấn Hùng (Việt Nam). '
            + 'Trả về JSON {"cards":[{"title":string,"description":string,"priority":"low|normal|high|urgent","checklist":[string]}]} — tối đa 30 thẻ, tiếng Việt, ngắn gọn, thực tế. '
            + 'KHÔNG bịa số liệu y khoa, KHÔNG hứa hẹn kết quả, KHÔNG dùng tên / thông tin khách hàng thật. Nội dung y khoa ghi chú "cần bác sĩ duyệt".' },
          { role: 'user', content: `${context}\n\nYÊU CẦU: ${prompt}` },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: 'AI lỗi: ' + (j.error?.message || r.status) });
    let parsed: { cards?: unknown[] } = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; }
    const cards = (Array.isArray(parsed.cards) ? parsed.cards : []).slice(0, 30).map((c: any) => ({
      title: clip(c?.title, 300).trim(),
      description: clip(c?.description, 2000),
      priority: ['low', 'normal', 'high', 'urgent'].includes(c?.priority) ? c.priority : 'normal',
      checklist: (Array.isArray(c?.checklist) ? c.checklist : []).slice(0, 15).map((x: unknown) => clip(x, 300)).filter(Boolean),
    })).filter((c: { title: string }) => c.title);
    return json({ cards });
  } catch (e) {
    return json({ error: (e as Error).message });
  }
});
