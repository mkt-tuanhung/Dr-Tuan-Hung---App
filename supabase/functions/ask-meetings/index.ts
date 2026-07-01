// Hỏi đáp trên kho biên bản cuộc họp (RAG đơn giản: dùng biên bản AI làm ngữ cảnh).
// Env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI = Deno.env.get('OPENAI_API_KEY')!;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ error: 'Unauthorized (chưa đăng nhập)' }, 401);

    const { question } = await req.json();
    if (!question || !String(question).trim()) return json({ error: 'Thiếu câu hỏi' }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: meetings } = await db.from('meetings').select('title, created_at, ai_result, transcript').eq('ai_status', 'done').order('created_at', { ascending: false }).limit(60);

    const blocks: string[] = [];
    for (const m of (meetings || [])) {
      const r = m.ai_result || {};
      const parts = [`### Cuộc họp: ${m.title} (${new Date(m.created_at).toLocaleDateString('vi-VN')})`];
      if (r.summary) parts.push('Tóm tắt: ' + r.summary);
      if ((r.key_points || []).length) parts.push('Ý chính: ' + r.key_points.join('; '));
      if ((r.decisions || []).length) parts.push('Quyết định: ' + r.decisions.join('; '));
      if ((r.action_items || []).length) parts.push('Việc cần làm: ' + r.action_items.map((a: { task: string; assignee?: string }) => `${a.task}${a.assignee ? ' (' + a.assignee + ')' : ''}`).join('; '));
      blocks.push(parts.join('\n'));
    }
    const context = blocks.join('\n\n').slice(0, 22000);
    if (!context) return json({ answer: 'Chưa có biên bản cuộc họp nào để tra cứu.' });

    const cr = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2,
        messages: [
          { role: 'system', content: 'Bạn là trợ lý tra cứu biên bản họp của công ty thẩm mỹ Dr Tuấn Hùng. CHỈ trả lời dựa trên các biên bản cuộc họp được cung cấp. Nêu rõ thông tin đến từ cuộc họp nào (tên + ngày). Nếu không có thông tin, nói thẳng "Không tìm thấy trong biên bản". Trả lời tiếng Việt, ngắn gọn, đúng trọng tâm.' },
          { role: 'user', content: `CÁC BIÊN BẢN:\n${context}\n\n---\nCÂU HỎI: ${question}` },
        ] }),
    });
    const cj = await cr.json();
    if (!cr.ok) throw new Error('GPT: ' + (cj.error?.message || cr.status));
    return json({ answer: cj.choices[0].message.content });
  } catch (e) {
    return json({ error: (e as Error).message }, 200);
  }
});
