// Dùng chung cho face-enroll + face-attendance.
// Template khuôn mặt được mã hóa AES-256-GCM bằng key trong Edge Secret
// FACE_TEMPLATE_KEY (base64 32 bytes) — template KHÔNG bao giờ trả về client.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export const serviceClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Xác thực người gọi bằng JWT của chính họ (không tin employeeId từ payload)
export async function getAuthedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// ---------- Vector ----------
export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}
export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // hai vector đã normalize -> dot = cosine similarity
}
export function averageVec(vs: number[][]): number[] {
  const out = new Array(vs[0].length).fill(0);
  for (const v of vs) for (let i = 0; i < v.length; i++) out[i] += v[i];
  return normalize(out.map((x) => x / vs.length));
}
export function validEmbedding(v: unknown): v is number[] {
  return Array.isArray(v) && v.length >= 128 && v.length <= 2048 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}

// ---------- Mã hóa template ----------
async function aesKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get('FACE_TEMPLATE_KEY');
  if (!b64) throw new Error('Thiếu Edge Secret FACE_TEMPLATE_KEY');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('FACE_TEMPLATE_KEY phải là base64 của đúng 32 bytes');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptTemplate(vec: number[]): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(vec));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const pack = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return JSON.stringify({ iv: pack(iv), data: pack(enc) });
}
export async function decryptTemplate(encStr: string): Promise<number[]> {
  const key = await aesKey();
  const { iv, data } = JSON.parse(encStr);
  const unpack = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unpack(iv) }, key, unpack(data));
  return JSON.parse(new TextDecoder().decode(dec));
}

// ---------- Cấu hình & vị trí ----------
export async function loadFaceConfig(db: SupabaseClient) {
  const { data } = await db.from('face_config').select('*').eq('id', 1).single();
  return data;
}
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Giờ Việt Nam (server chạy UTC) — server là nguồn thời gian, không tin capturedAt
export function vnNow() {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  return { date: vn.toISOString().slice(0, 10), time: vn.toISOString().slice(11, 19) };
}
