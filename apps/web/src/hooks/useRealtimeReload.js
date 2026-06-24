import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Tự gọi lại onChange (thường là loadData) mỗi khi 1 trong các bảng thay đổi (realtime).
 * @param {string} tables  Danh sách bảng, ngăn cách dấu phẩy. VD: 'attendance,leave_requests'
 * @param {Function} onChange  Hàm tải lại dữ liệu (nên là useCallback để ổn định)
 */
export function useRealtimeReload(tables, onChange) {
  useEffect(() => {
    if (!onChange || !tables) return;
    const list = tables.split(',').map(s => s.trim()).filter(Boolean);
    const ch = supabase.channel('rt_' + Math.random().toString(36).slice(2));
    list.forEach(t =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => onChange())
    );
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tables, onChange]);
}
