// ============================================================
// Supabase Edge Function: classify-folders
// Dùng Gemini ĐỌC HIỂU tên các thư mục trong Google Drive của khách rồi phân loại
// vào 5 loại source: Trước PT / Sau PT / Beauty / Feedback / Tái khám.
// Xử lý tốt tên "người" đặt: "30.04 sau 1 ngày", "01.07 Thăm khám", "footage điện thoại"...
//
// Dùng chung GEMINI_API_KEY (đã có sẵn cho analyze-review):
//   supabase functions deploy classify-folders
// Gọi: supabase.functions.invoke('classify-folders', { body: { names: [...] } })
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
const KEYS = ["truoc_pt", "sau_pt", "beauty", "feedback", "tai_kham"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ ok: false, error: "Chưa cấu hình GEMINI_API_KEY" });

    const { names } = await req.json().catch(() => ({}));
    const list = Array.isArray(names) ? names.map((n) => String(n || "").slice(0, 120)).filter(Boolean) : [];
    if (list.length === 0) return json({ ok: true, types: [] });

    const prompt = `Bạn phân loại các THƯ MỤC trong Google Drive của một cơ sở thẩm mỹ/phẫu thuật.
Mỗi khách có nhiều thư mục chứa ảnh/video. Hãy xác định trong danh sách CÓ những loại source nào dưới đây (chỉ dựa vào TÊN thư mục, hiểu tiếng Việt có/không dấu, viết tắt, có ngày tháng):

- "truoc_pt": ảnh/video TRƯỚC phẫu thuật (vd: "Trước PT", "trước mổ", "before", "b4").
- "sau_pt": SAU phẫu thuật (vd: "Sau PT", "sau mổ", "sau 1 ngày", "sau 3 ngày", "hậu phẫu", "after", "post op"). Bất kỳ mốc thời gian SAU khi làm.
- "beauty": ảnh beauty/nghệ thuật/làm đẹp (vd: "Beauty", "beauty shot").
- "feedback": feedback/cảm nhận/review/đánh giá của khách.
- "tai_kham": TÁI KHÁM / thăm khám lại sau này (vd: "Tái khám", "Thăm khám", "recheck", "follow up").

BỎ QUA các thư mục không thuộc 5 loại trên (vd: "PT" một mình = trong lúc mổ, "footage điện thoại", "raw"...).

Danh sách thư mục:
${list.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Trả về DUY NHẤT JSON: {"types": [danh sách key có mặt, mỗi key một lần, chỉ trong ${JSON.stringify(KEYS)}]}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error", res.status, t);
      return json({ ok: false, error: `Gemini lỗi HTTP ${res.status}` });
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: { types?: string[] } = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }
    const types = Array.isArray(parsed.types) ? parsed.types.filter((t) => KEYS.includes(t)) : [];
    return json({ ok: true, types: [...new Set(types)] });
  } catch (e) {
    console.error("classify-folders error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
