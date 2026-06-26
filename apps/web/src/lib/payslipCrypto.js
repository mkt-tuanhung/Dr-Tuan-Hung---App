// Mã hoá / giải mã chi tiết phiếu lương để nhúng vào QR code.
// Dùng Web Crypto (AES-GCM 256-bit) + PBKDF2 dẫn khoá từ mã bảo mật do admin đặt.
// Toàn bộ xử lý ở trình duyệt — số liệu lương không bao giờ rời thiết bị ở dạng rõ.

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 100000; // số vòng PBKDF2

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

const deriveKey = async (passcode, salt) => {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Mã hoá object -> chuỗi base64url (salt[16] + iv[12] + ciphertext)
export const encryptPayslip = async (obj, passcode) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const out = new Uint8Array(16 + 12 + ct.byteLength);
  out.set(salt, 0);
  out.set(iv, 16);
  out.set(new Uint8Array(ct), 28);
  return toB64url(out);
};

// Giải mã chuỗi base64url -> object. Sai mã / dữ liệu hỏng sẽ throw.
export const decryptPayslip = async (payload, passcode) => {
  const bytes = fromB64url(payload);
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ct = bytes.slice(28);
  const key = await deriveKey(passcode, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(pt));
};
