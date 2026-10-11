// ============================================================
// NHẬT KÝ THAO TÁC (supabase/audit_log.sql)
// - runWithReason: gửi kèm LÝ DO cho câu lệnh sửa dữ liệu (header x-audit-reason,
//   UTF-8 base64) -> trigger trên database ghi lý do vào audit_log.
// - logAuditEvent: ghi sự kiện không sửa bảng (xuất file, in…).
// Nhật ký KHÔNG được làm hỏng thao tác chính: lỗi phía nhật ký chỉ bị bỏ qua.
// ============================================================
import { supabase } from '@/lib/supabaseClient';

const b64 = (s) => {
  const bytes = new TextEncoder().encode(String(s).slice(0, 500));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

// Lỗi mạng / CORS (header lạ bị chặn) -> PostgREST trả status 0 hoặc "Failed to fetch"
const isNetworkError = (res) => !!res?.error && (res.status === 0 || /fetch|network|cors/i.test(res.error.message || ''));

// build: () => câu lệnh supabase MỚI (vì phải gửi lại được nếu header bị chặn)
// VD: runWithReason(() => supabase.from('profiles').update({ is_active: false }).in('id', ids), reason)
export async function runWithReason(build, reason) {
  if (!reason) return build();
  const res = await build().setHeader('x-audit-reason', b64(reason));
  if (isNetworkError(res)) return build();
  return res;
}

export async function logAuditEvent(action, entity, { entityId = null, details = null, reason = null } = {}) {
  try {
    await supabase.rpc('log_audit_event', {
      p_action: action, p_entity: entity, p_entity_id: entityId, p_details: details, p_reason: reason,
    });
  } catch { /* chưa chạy audit_log.sql hoặc mất mạng: bỏ qua */ }
}
