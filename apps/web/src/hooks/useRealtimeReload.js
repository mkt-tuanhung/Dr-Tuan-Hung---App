import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Tự gọi lại onChange (thường là loadData) khi 1 trong các bảng thay đổi (realtime).
 * GIẢM BĂNG THÔNG (Supabase tính phí egress theo dữ liệu tải ra):
 *  - Gom sự kiện: lượt tải đầu chờ 2 giây; trong đợt thay đổi dồn dập (vd đồng bộ GetFly ghi
 *    hàng loạt) chỉ tải lại TỐI ĐA 1 lần mỗi 20 giây.
 *  - App đang ở nền (tab ẩn / chuyển sang app khác): KHÔNG tải, chỉ ghi nhớ là có thay đổi;
 *    mở lại app thì tải bù đúng 1 lần.
 * Thao tác của chính người dùng vẫn cập nhật ngay vì các màn tự gọi loadData sau khi lưu.
 * @param {string} tables  Danh sách bảng, ngăn cách dấu phẩy. VD: 'attendance,leave_requests'
 * @param {Function} onChange  Hàm tải lại dữ liệu (nên là useCallback để ổn định)
 */
const FIRST_DELAY_MS = 2000;
const MIN_GAP_MS = 20000;

export function useRealtimeReload(tables, onChange) {
  const timer = useRef(null);
  const lastRun = useRef(0);
  const pendingHidden = useRef(false);
  useEffect(() => {
    if (!onChange || !tables) return;
    const run = () => {
      timer.current = null;
      if (document.hidden) { pendingHidden.current = true; return; }
      lastRun.current = Date.now();
      onChange();
    };
    const trigger = () => {
      if (document.hidden) { pendingHidden.current = true; return; }
      if (timer.current) return;                 // đã hẹn 1 lượt tải rồi -> gom
      const sinceLast = Date.now() - lastRun.current;
      const wait = Math.max(FIRST_DELAY_MS, MIN_GAP_MS - sinceLast);
      timer.current = setTimeout(run, wait);
    };
    const onVisible = () => {
      if (!document.hidden && pendingHidden.current) {
        pendingHidden.current = false;
        if (!timer.current) timer.current = setTimeout(run, 600);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const list = tables.split(',').map(s => s.trim()).filter(Boolean);
    const ch = supabase.channel('rt_' + Math.random().toString(36).slice(2));
    list.forEach(t =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, trigger)
    );
    ch.subscribe();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      supabase.removeChannel(ch);
    };
  }, [tables, onChange]);
}
