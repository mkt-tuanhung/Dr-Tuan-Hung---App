// Mã hoá / giải mã chi tiết phiếu lương để nhúng vào QR code.
// Dùng Web Crypto (AES-GCM 256-bit) + PBKDF2 dẫn khoá từ mã bảo mật do admin đặt.
// Toàn bộ xử lý ở trình duyệt — số liệu lương không bao giờ rời thiết bị ở dạng rõ.

const enc = new TextEncoder();
const dec = new TextDecoder();

// Byte phiên bản đứng đầu token -> số vòng PBKDF2 tương ứng.
// Nhờ vậy sau này nâng số vòng vẫn giải được QR đã in trước đó (chỉ cần thêm version mới).
const VERSION = 1;
const ITER_BY_VERSION = { 1: 310000 }; // 310k vòng theo khuyến nghị OWASP (PBKDF2-SHA256)

// base64url <-> bytes (an toàn cho URL/QR, không dùng dấu + / =)
const toB64url = (bytes) => {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
};

const deriveKey = async (passcode, salt, iterations) => {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Mã hoá object -> chuỗi base64url (version[1] + salt[16] + iv[12] + ciphertext)
export const encryptPayslip = async (obj, passcode) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt, ITER_BY_VERSION[VERSION]);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const out = new Uint8Array(1 + 16 + 12 + ct.byteLength);
  out[0] = VERSION;
  out.set(salt, 1);
  out.set(iv, 17);
  out.set(new Uint8Array(ct), 29);
  return toB64url(out);
};

// Giải mã chuỗi base64url -> object. Sai mã / dữ liệu hỏng sẽ throw.
export const decryptPayslip = async (payload, passcode) => {
  const bytes = fromB64url(payload);
  const iterations = ITER_BY_VERSION[bytes[0]];
  if (!iterations) throw new Error('Phiên bản phiếu lương không hỗ trợ');
  const salt = bytes.slice(1, 17);
  const iv = bytes.slice(17, 29);
  const ct = bytes.slice(29);
  const key = await deriveKey(passcode, salt, iterations);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(pt));
};
