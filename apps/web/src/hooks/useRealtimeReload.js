import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Tự gọi lại onChange (thường là loadData) khi 1 trong các bảng thay đổi (realtime).
 * CÓ GOM SỰ KIỆN: nhiều thay đổi dồn dập (vd đồng bộ GetFly ghi hàng nghìn dòng)
 * chỉ tải lại TỐI ĐA 1 lần mỗi 2 giây — tránh app tải lại liên tục đến treo.
 * @param {string} tables  Danh sách bảng, ngăn cách dấu phẩy. VD: 'attendance,leave_requests'
 * @param {Function} onChange  Hàm tải lại dữ liệu (nên là useCallback để ổn định)
 */
export function useRealtimeReload(tables, onChange) {
  const timer = useRef(null);
  const lastRun = useRef(0);
  useEffect(() => {
    if (!onChange || !tables) return;
    const DEBOUNCE_MS = 2000;
    const trigger = () => {
      const now = Date.now();
      const wait = Math.max(0, DEBOUNCE_MS - (now - lastRun.current));
      if (timer.current) return;                 // đã hẹn 1 lượt tải rồi -> gom
      timer.current = setTimeout(() => {
        timer.current = null;
        lastRun.current = Date.now();
        onChange();
      }, wait);
    };
    const list = tables.split(',').map(s => s.trim()).filter(Boolean);
    const ch = supabase.channel('rt_' + Math.random().toString(36).slice(2));
    list.forEach(t =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, trigger)
    );
    ch.subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); supabase.removeChannel(ch); };
  }, [tables, onChange]);
}
