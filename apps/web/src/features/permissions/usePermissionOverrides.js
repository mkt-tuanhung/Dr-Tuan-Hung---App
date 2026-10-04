// Đọc các ô Admin đã GHI ĐÈ trong ma trận phân quyền (bảng role_permissions).
// Bảng chưa tạo / lỗi mạng -> trả Map rỗng = dùng quyền mặc định (không vỡ app).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { overrideKey } from './menuConfig';

const EMPTY = new Map();

export const loadPermissionOverrides = async () => {
  const { data, error } = await supabase.from('role_permissions').select('role, module, granted');
  if (error || !data) return EMPTY;
  return new Map(data.map(r => [overrideKey(r.role, r.module), !!r.granted]));
};

export function usePermissionOverrides({ withReload = false } = {}) {
  const [map, setMap] = useState(EMPTY);
  const reload = useCallback(() => loadPermissionOverrides().then(setMap), []);
  useEffect(() => {
    reload();
    // Admin đổi quyền -> menu nhân sự tự cập nhật (nếu bảng đã bật realtime)
    const ch = supabase.channel('role_permissions_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);
  return withReload ? [map, reload] : map;
}
