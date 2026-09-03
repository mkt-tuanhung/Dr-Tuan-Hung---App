// ============================================================
// ĐĂNG KÝ KHUÔN MẶT (Face Enrollment)
// Client gửi 3–12 embedding (đã tính trên máy — KHÔNG gửi ảnh).
// Server kiểm tra tính nhất quán (cùng 1 người), tạo template trung bình,
// MÃ HÓA rồi lưu face_profiles. Deploy: supabase functions deploy face-enroll
// Cần Edge Secret: FACE_TEMPLATE_KEY (base64 32 bytes ngẫu nhiên).
// ============================================================
import {
  CORS, json, serviceClient, getAuthedUser,
  normalize, cosine, averageVec, validEmbedding, encryptTemplate,
} from '../_shared/face.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    const body = await req.json();
    const raw: unknown[] = body?.embeddings || [];
    if (!Array.isArray(raw) || raw.length < 3 || raw.length > 12) {
      return json({ ok: false, error: 'BAD_SAMPLES', message: 'Cần 3–12 mẫu khuôn mặt' }, 400);
    }
    if (!raw.every(validEmbedding)) return json({ ok: false, error: 'BAD_EMBEDDING' }, 400);
    const dims = new Set((raw as number[][]).map((v) => v.length));
    if (dims.size !== 1) return json({ ok: false, error: 'BAD_EMBEDDING', message: 'Các mẫu không cùng kích thước' }, 400);

    const db = serviceClient();

    // Admin có thể đã KHÓA face của tài khoản này
    const { data: existing } = await db.from('face_profiles').select('status').eq('user_id', user.id).maybeSingle();
    if (existing?.status === 'DISABLED') {
      return json({ ok: false, error: 'DISABLED', message: 'Face ID của tài khoản đã bị khóa — liên hệ admin' }, 403);
    }

    // Kiểm tra các mẫu là CÙNG MỘT NGƯỜI: so từng mẫu với TÂM (trung bình) thay vì
    // so đôi một — enrollment đa góc (quay trái/phải/ngẩng/cúi) làm 2 mẫu khác góc
    // lệch nhau tự nhiên, so đôi một quá chặt gây từ chối oan người thật.
    const vecs = (raw as number[][]).map(normalize);
    const template = averageVec(vecs);
    let minToCenter = 1;
    for (const v of vecs) minToCenter = Math.min(minToCenter, cosine(template, v));
    if (minToCenter < 0.38) {
      return json({ ok: false, error: 'INCONSISTENT_SAMPLES', message: 'Các mẫu khuôn mặt không nhất quán — thử lại nơi đủ sáng, giữ máy ngang tầm mặt, xoay đầu CHẬM' }, 400);
    }

    const template_enc = await encryptTemplate(template);

    const { error } = await db.from('face_profiles').upsert({
      user_id: user.id,
      status: 'ACTIVE',
      template_enc,
      template_version: 'v1',
      model_version: String(body?.modelVersion || 'human'),
      sample_count: vecs.length,
      quality_score: Number(body?.quality) || null,
      enrolled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return json({ ok: true, status: 'ACTIVE', samples: vecs.length, consistency: Number(minToCenter.toFixed(3)) });
  } catch (e) {
    return json({ ok: false, error: 'UNKNOWN', message: (e as Error).message }, 500);
  }
});
