import { useEffect } from 'react';
import { takePendingFocus } from '@/lib/notif';

// Cuộn tới & làm nổi bật đúng item khi mở từ thông báo.
//   tab      : id tab của trang (vd 'appointments', 'content_video')
//   idPrefix : tiền tố id DOM của item (vd 'appt-' -> phần tử id="appt-<uuid>")
//   ready    : dữ liệu đã tải xong chưa (để chờ list render rồi mới cuộn)
export function useFocusHighlight(tab, idPrefix, ready) {
  useEffect(() => {
    if (!ready) return;

    const focusTo = (id) => {
      if (!id) return;
      let tries = 0;
      const tick = () => {
        const el = document.getElementById(idPrefix + id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('focus-flash');
          setTimeout(() => el.classList.remove('focus-flash'), 2600);
        } else if (tries++ < 20) {
          setTimeout(tick, 150); // list có thể render trễ -> thử lại vài lần
        }
      };
      tick();
    };

    const pending = takePendingFocus(tab);
    if (pending) focusTo(pending.id);

    const onFocus = (e) => {
      if (!tab || e.detail?.tab === tab) focusTo(e.detail?.id);
    };
    window.addEventListener('FOCUS_ITEM', onFocus);
    return () => window.removeEventListener('FOCUS_ITEM', onFocus);
  }, [tab, idPrefix, ready]);
}
