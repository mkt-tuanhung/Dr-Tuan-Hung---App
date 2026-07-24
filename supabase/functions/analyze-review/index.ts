// ============================================================
// Supabase Edge Function: analyze-review
// Tóm tắt & phân tích 1 nhận xét đánh giá bằng Gemini (Google AI Studio - FREE).
// Chỉ gửi NỘI DUNG NHẬN XÉT (không gửi tên/SĐT khách) để bảo vệ riêng tư.
// Trả JSON { summary, sentiment, topics[], urgency, action }.
//
// Bật: tạo API key miễn phí tại https://aistudio.google.com/apikey
//   supabase secrets set GEMINI_API_KEY=xxxxx
//   supabase functions deploy analyze-review
// (Muốn dùng OpenAI thay vì Gemini: đổi endpoint bên dưới — key OPENAI_API_KEY đã có sẵn.)
// ============================================================
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const MODEL = "gemini-2.0-flash";
const SENTIMENTS = ["rất tích cực", "tích cực", "trung lập", "tiêu cực", "rất tiêu cực"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "Chưa cấu hình GEMINI_API_KEY" });

    const { text, score } = await req.json().catch(() => ({}));
    const comment = (text || "").toString().slice(0, 4000).trim();
    if (!comment) return json({ error: "Không có nội dung để phân tích" });

    const prompt = `Bạn là trợ lý phân tích phản hồi khách hàng của một cơ sở thẩm mỹ/phẫu thuật.
Phân tích NHẬN XÉT sau của khách (điểm tổng thể khách chấm: ${score ?? "không rõ"}/5).
Chỉ dựa vào nội dung, KHÔNG suy diễn y tế, KHÔNG đưa kết luận chuyên môn.
Trả về DUY NHẤT một JSON đúng cấu trúc:
{
  "summary": "tóm tắt 1-2 câu ngắn gọn bằng tiếng Việt",
  "sentiment": một trong ${JSON.stringify(SENTIMENTS)},
  "topics": ["các chủ đề liên quan, ví dụ: Thái độ nhân viên, Thời gian chờ, Chi phí, Chăm sóc sau phẫu thuật, Kết quả cảm nhận, Khả năng liên hệ, Cơ sở vật chất, Chất lượng tư vấn"],
  "urgency": "low | medium | high",
  "action": "đề xuất hành động ngắn gọn cho bộ phận CSKH (1 câu)"
}

NHẬN XÉT: """${comment}"""`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error", res.status, t);
      return json({ error: `Gemini lỗi (HTTP ${res.status})` });
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { summary: raw }; }

    // Chuẩn hoá
    const sentiment = SENTIMENTS.includes(parsed.sentiment as string) ? parsed.sentiment : null;
    const topics = Array.isArray(parsed.topics) ? (parsed.topics as string[]).slice(0, 8) : [];
    const urgency = ["low", "medium", "high"].includes(parsed.urgency as string) ? parsed.urgency : null;

    return json({
      ok: true,
      summary: (parsed.summary || "").toString(),
      sentiment,
      topics,
      urgency,
      action: (parsed.action || "").toString(),
    });
  } catch (e) {
    console.error("analyze-review crashed", e);
    return json({ error: "Lỗi phân tích: " + String(e) });
  }
});
