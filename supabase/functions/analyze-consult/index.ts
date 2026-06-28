// Transcribe (Whisper) + chấm điểm chất lượng tư vấn (GPT) cho 1 bản ghi âm.
// Gọi từ client: supabase.functions.invoke('analyze-consult', { body: { recording_id } })
// Env cần: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI = Deno.env.get('OPENAI_API_KEY')!;
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const RUBRIC = `Bạn là chuyên gia đào tạo & giám sát chất lượng tư vấn tại "Dr Tuấn Hùng" — phòng khám/thẩm mỹ chuyên PHẪU THUẬT THẨM MỸ, dẫn dắt bởi bác sĩ trình độ Bác sĩ Nội Trú (uy tín chuyên môn cao).

Bối cảnh: Transcript tiếng Việt bên dưới là một CUỘC TƯ VẤN TRỰC TIẾP về dịch vụ phẫu thuật thẩm mỹ cho khách hàng. Các dịch vụ thường gặp: vùng hàm mặt (gọt hàm, hạ gò má, trượt cằm, bóc cơ cắn), tạo hình (cắt mí, nâng mũi, độn cằm), body (hút mỡ, nâng ngực)... Lời thoại có thể gồm cả tư vấn viên/bác sĩ và khách hàng nhưng KHÔNG ghi rõ ai nói; bản ghi có thể có lỗi nhận dạng giọng nói. Bạn CHỈ chấm chất lượng phần tư vấn của phía Dr Tuấn Hùng (tư vấn viên/bác sĩ), không chấm khách hàng.

Hãy chấm chất lượng cuộc tư vấn theo thang điểm tổng (1-10) và từng tiêu chí (1-10). Trả về DUY NHẤT 1 JSON theo schema:
{"score": number, "level": "Tốt|Trung bình|Kém",
 "summary": string,
 "strengths": [string], "weaknesses": [string], "suggestions": [string],
 "criteria": {"thien_cam": number, "khai_thac_nhu_cau": number, "tu_van_chuyen_mon": number, "xu_ly_tu_choi": number, "chot": number, "thai_do": number}}

Diễn giải tiêu chí (bối cảnh phẫu thuật thẩm mỹ):
- thien_cam: tạo thiện cảm, lắng nghe, xưng hô phù hợp, khiến khách thoải mái khi nói về khuyết điểm ngoại hình.
- khai_thac_nhu_cau: khai thác mong muốn thẩm mỹ, khuyết điểm, ngân sách, tiền sử (đã từng phẫu thuật, bệnh lý), kỳ vọng thực tế.
- tu_van_chuyen_mon: giải thích đúng & dễ hiểu về phương pháp, quy trình, gây mê, hồi phục, rủi ro/an toàn; nhấn mạnh uy tín bác sĩ Nội Trú; cam kết TRUNG THỰC, không thổi phồng "đẹp tuyệt đối".
- xu_ly_tu_choi: xử lý băn khoăn về giá, đau, an toàn, sợ hỏng; đưa giải pháp (trả góp, đặt cọc, bảo hành, xem ca thực tế).
- chot: kêu gọi hành động rõ ràng — đặt lịch, cọc giữ suất, hẹn ngày mổ, bước tiếp theo cụ thể.
- thai_do: giọng điệu chuyên nghiệp, tự tin, tận tâm, không hứa ẩu, không gây áp lực thái quá.

Nhận xét bằng tiếng Việt, ngắn gọn, cụ thể, thực tế để đội tư vấn cải thiện. Nếu transcript quá ngắn/không rõ thì cho điểm thấp và nêu rõ trong summary.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let recId: string | null = null;
  try {
    const body = await req.json();
    recId = body.recording_id;
    if (!recId) return json({ error: 'thiếu recording_id' }, 400);

    const { data: rec } = await supabase.from('consult_recordings').select('*').eq('id', recId).single();
    if (!rec) return json({ error: 'không tìm thấy bản ghi' }, 404);
    await supabase.from('consult_recordings').update({ status: 'processing' }).eq('id', recId);

    // Danh sách đoạn (cuộc dài đã chia 10 phút/đoạn). Fallback file đơn.
    const urls: string[] = (Array.isArray(rec.segment_urls) && rec.segment_urls.length) ? rec.segment_urls : [rec.audio_url];

    // Whisper từng đoạn -> transcript tiếng Việt (chạy song song, tối đa 4 đoạn cùng lúc)
    const transcribe = async (u: string): Promise<string> => {
      const ar = await fetch(u);
      if (!ar.ok) throw new Error('Không tải được file audio');
      const blob = await ar.blob();
      const fd = new FormData();
      fd.append('file', blob, 'audio.webm');
      fd.append('model', 'whisper-1');
      fd.append('language', 'vi');
      const wr = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: fd });
      const wj = await wr.json();
      if (!wr.ok) throw new Error('Whisper: ' + (wj.error?.message || wr.status));
      return wj.text || '';
    };
    const texts: string[] = new Array(urls.length).fill('');
    let next = 0;
    const LIMIT = 4;
    await Promise.all(Array.from({ length: Math.min(LIMIT, urls.length) }, async () => {
      while (next < urls.length) { const i = next++; texts[i] = await transcribe(urls[i]); }
    }));
    const transcript: string = texts.join('\n');

    if (transcript.trim().length < 5) {
      await supabase.from('consult_recordings').update({ transcript, status: 'done', ai_score: null, ai_analysis: { summary: 'Bản ghi quá ngắn / không nghe rõ.' } }).eq('id', recId);
      return json({ ok: true, score: null });
    }

    // 3) GPT chấm điểm
    const cr = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', temperature: 0.3, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: RUBRIC },
          { role: 'user', content: `Transcript cuộc tư vấn:\n${transcript.slice(0, 14000)}` },
        ],
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) throw new Error('GPT: ' + (cj.error?.message || cr.status));
    const analysis = JSON.parse(cj.choices[0].message.content);

    await supabase.from('consult_recordings').update({
      transcript, ai_score: analysis.score ?? null, ai_analysis: analysis, status: 'done',
    }).eq('id', recId);
    return json({ ok: true, score: analysis.score });
  } catch (e) {
    if (recId) await supabase.from('consult_recordings').update({ status: 'error', ai_analysis: { error: (e as Error).message } }).eq('id', recId);
    return json({ error: (e as Error).message }, 200);
  }
});
