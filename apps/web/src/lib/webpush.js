import { supabase } from '@/lib/supabaseClient';

// Khoá VAPID công khai (an toàn để lộ ra client). Khoá private nằm ở
// Supabase secret VAPID_PRIVATE_KEY, chỉ edge function push-web dùng.
export const VAPID_PUBLIC_KEY =
  'BONeGkhgR3fx-OIJdbvi8SF0RBtM_lbMFwe1tHL6AxQzopqRLbTZ5vXdQYT9-wcTrs4r-NDlaZAUqnYldfeCm-E';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// iOS chỉ cho phép Web Push khi app đã "Thêm vào Màn hình chính" (standalone).
export function iosNeedsInstall() {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent || navigator.platform || '');
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)')?.matches;
  return isIOS && !standalone;
}

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function isPushOn() {
  if (!pushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const sub = await getPushSubscription();
  return !!sub;
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('Trình duyệt/thiết bị không hỗ trợ thông báo đẩy');
  if (iosNeedsInstall())
    throw new Error('Trên iPhone: hãy “Thêm vào Màn hình chính” rồi mở app từ icon để bật thông báo');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Bạn chưa cho phép nhận thông báo trên trình duyệt');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return sub;
}

export async function disablePush() {
  const sub = await getPushSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}
