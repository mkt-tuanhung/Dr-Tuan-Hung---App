// Ghi âm cuộc họp -> transcript (Whisper) -> AI biên bản/PRD/action items (GPT).
// Env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI = Deno.env.get('OPENAI_API_KEY')!;
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROMPT = `Bạn là trợ lý thư ký cuộc họp cho công ty thẩm mỹ "Dr Tuấn Hùng". Dưới đây là transcript tiếng Việt của một cuộc họp nội bộ (có thể lẫn nhiều người nói, có lỗi nhận dạng). Hãy tổng hợp thành tài liệu hữu ích.
Trả về DUY NHẤT 1 JSON theo schema:
{
 "title_suggest": string,                 // tiêu đề gợi ý cho cuộc họp
 "summary": string,                        // tóm tắt 3-6 câu
 "key_points": [string],                   // các ý chính đã bàn
 "decisions": [string],                    // quyết định đã chốt
 "action_items": [{"task": string, "assignee": string, "due": string}],  // việc cần làm, ai làm, hạn (để "" nếu không rõ)
 "prd": string                             // nếu họp về sản phẩm/tính năng/dự án: viết PRD ngắn dạng Markdown (Mục tiêu, Phạm vi, Yêu cầu, Tiêu chí hoàn thành). Nếu không liên quan sản phẩm thì để ""
}
Viết tiếng Việt, súc tích, thực tế. Nếu transcript quá ngắn/không rõ, ghi rõ trong summary.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let id: string | null = null;
  try {
    const body = await req.json();
    id = body.meeting_id;
    if (!id) return json({ error: 'thiếu meeting_id' }, 400);

    const { data: m } = await supabase.from('meetings').select('*').eq('id', id).single();
    if (!m) return json({ error: 'không tìm thấy cuộc họp' }, 404);
    await supabase.from('meetings').update({ ai_status: 'processing' }).eq('id', id);

    const urls: string[] = (Array.isArray(m.segment_urls) && m.segment_urls.length) ? m.segment_urls : (m.recording_url ? [m.recording_url] : []);
    if (!urls.length) { await supabase.from('meetings').update({ ai_status: 'error', ai_result: { error: 'Chưa có bản ghi' } }).eq('id', id); return json({ error: 'Chưa có bản ghi' }, 400); }

    // Whisper từng đoạn (song song, tối đa 4)
    const transcribe = async (u: string): Promise<string> => {
      const ar = await fetch(u); if (!ar.ok) throw new Error('Không tải được file ghi âm');
      const blob = await ar.blob();
      const fd = new FormData();
      fd.append('file', blob, 'meeting.webm'); fd.append('model', 'whisper-1'); fd.append('language', 'vi');
      const wr = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: fd });
      const wj = await wr.json(); if (!wr.ok) throw new Error('Whisper: ' + (wj.error?.message || wr.status));
      return wj.text || '';
    };
    const texts: string[] = new Array(urls.length).fill('');
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (next < urls.length) { const i = next++; texts[i] = await transcribe(urls[i]); }
    }));
    const transcript = texts.join('\n').trim();

    if (transcript.length < 5) {
      await supabase.from('meetings').update({ transcript, ai_status: 'done', ai_result: { summary: 'Bản ghi quá ngắn / không nghe rõ.' } }).eq('id', id);
      return json({ ok: true });
    }

    const cr = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: `Transcript cuộc họp:\n${transcript.slice(0, 24000)}` }] }),
    });
    const cj = await cr.json(); if (!cr.ok) throw new Error('GPT: ' + (cj.error?.message || cr.status));
    const result = JSON.parse(cj.choices[0].message.content);

    await supabase.from('meetings').update({ transcript, ai_result: result, ai_status: 'done' }).eq('id', id);

    // Đẩy "việc cần làm" cho từng nhân sự (khớp tên) -> notifications -> Telegram tự bắn qua webhook
    try {
      const items = Array.isArray(result.action_items) ? result.action_items : [];
      const named = items.filter((it: { assignee?: string }) => it.assignee && String(it.assignee).trim());
      if (named.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').eq('is_active', true);
        const norm = (s: string) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
        const notifs: Record<string, unknown>[] = [];
        for (const it of named) {
          const a = norm(it.assignee);
          const p = (profs || []).find((x: { full_name?: string }) => { const f = norm(x.full_name || ''); return f && (f === a || f.includes(a) || a.includes(f)); });
          if (p) notifs.push({ user_id: (p as { id: string }).id, actor_id: m.created_by, type: 'meeting_task', title: 'Việc cần làm — họp: ' + m.title, body: it.task + (it.due ? ` (hạn: ${it.due})` : ''), link: 'meetings' });
        }
        if (notifs.length) await supabase.from('notifications').insert(notifs);
      }
    } catch (_) { /* không chặn luồng chính */ }

    return json({ ok: true });
  } catch (e) {
    if (id) await supabase.from('meetings').update({ ai_status: 'error', ai_result: { error: (e as Error).message } }).eq('id', id);
    return json({ error: (e as Error).message }, 200);
  }
});
