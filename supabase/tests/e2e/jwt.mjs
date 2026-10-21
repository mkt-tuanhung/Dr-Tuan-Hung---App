import crypto from 'crypto';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export const SECRET = 'e2e-local-secret-for-marketing-workspace-0123456789';
export function jwt(sub) {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 });
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
