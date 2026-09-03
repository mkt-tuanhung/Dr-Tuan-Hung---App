// Gọi CRM backend (Edge Functions). CRM là nơi QUYẾT ĐỊNH chấm công —
// client chỉ gửi kết quả xác minh. requestId đảm bảo retry không ghi công 2 lần.
import { supabase } from '@/lib/supabaseClient';
import { getDeviceId } from '@/lib/device';
import { MODEL_VERSION } from './faceEngine';

export const newRequestId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const deviceId = () => { try { return getDeviceId(); } catch { return null; } };

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error('NETWORK_TIMEOUT')), ms)),
]);

// Trạng thái Face Profile của CHÍNH MÌNH (không bao giờ thấy template)
export async function fetchMyFaceStatus(userId) {
  const { data } = await supabase.from('face_profiles')
    .select('status, quality_score, enrolled_at, sample_count')
    .eq('user_id', userId).maybeSingle();
  return data; // null = chưa đăng ký
}

export async function fetchFaceConfig() {
  const { data } = await supabase.from('face_config').select('*').eq('id', 1).maybeSingle();
  return data;
}

export async function submitEnrollment({ embeddings, quality }) {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('face-enroll', { body: { embeddings, quality, modelVersion: MODEL_VERSION } }),
    15000,
  );
  if (error) throw new Error(error.message || 'Không thể kết nối CRM');
  if (!data?.ok) throw new Error(data?.message || data?.error || 'Đăng ký thất bại');
  return data;
}

// Timeout 8s theo spec; retry là việc của người dùng bấm "Thử gửi lại"
// (cùng requestId -> backend idempotent, không tạo 2 lượt chấm công)
export async function submitFaceAttendance({ requestId, action, embeddings, liveness, quality, gps, ip }) {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('face-attendance', {
      body: {
        requestId, action, embeddings, liveness, quality,
        modelVersion: MODEL_VERSION,
        gps, ip,
        device: { platform: 'web', deviceId: deviceId(), appVersion: import.meta.env?.VITE_APP_VERSION || 'web' },
        capturedAt: new Date().toISOString(),
      },
    }),
    8000,
  );
  if (error) throw new Error('NETWORK_ERROR');
  return data; // { accepted, time, status, lateMinutes, errorCode, message, ... }
}
