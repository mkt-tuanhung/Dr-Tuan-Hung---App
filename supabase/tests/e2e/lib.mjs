// E2E helper: app thật (bản preview) + PostgREST + PostgreSQL cục bộ.
// Mỗi người dùng = 1 browser context; mọi request REST của app được chuyển tới PostgREST kèm JWT của người đó
// -> RLS / trigger / RPC thật quyết định kết quả.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { jwt } from './jwt.mjs';
import { execFileSync } from 'child_process';

export const BASE = process.env.MW_E2E_APP || 'http://localhost:4174';
export const REST = process.env.MW_E2E_REST || 'http://localhost:3011';
export const SHOTS = process.env.MW_E2E_SHOTS || new URL('../../../docs/marketing/screenshots', import.meta.url).pathname;
export const U = {
  admin: { id: '00000000-0000-0000-0000-0000000000a1', name: 'Admin Hùng', role: 'admin' },
  lead: { id: '00000000-0000-0000-0000-0000000000b1', name: 'Minh Dũng (MKT Lead)', role: 'marketing' },
  media: { id: '00000000-0000-0000-0000-0000000000c1', name: 'Thu Trang (Media)', role: 'media' },
  viewer: { id: '00000000-0000-0000-0000-0000000000d1', name: 'Ngọc Anh (Viewer)', role: 'telesale' },
  outsider: { id: '00000000-0000-0000-0000-0000000000e1', name: 'Hải (MKT ngoài)', role: 'marketing' },
  doctor: { id: '00000000-0000-0000-0000-0000000000f1', name: 'BS. Tuấn Hùng', role: 'bac_si' },
  compliance: { id: '00000000-0000-0000-0000-0000000000f2', name: 'Lan (Pháp lý)', role: 'cskh' },
  publisher: { id: '00000000-0000-0000-0000-0000000000f3', name: 'Quang (Người đăng)', role: 'marketing' },
};

export function sql(q) {
  return execFileSync('psql', ['-X', '-q', '-t', '-A', '-d', process.env.MW_E2E_DB || 'mw_e2e', '-c', q], { encoding: 'utf8' }).trim();
}

let browser;
export async function launch() {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  return browser;
}
export async function close() { await browser?.close(); }

const results = [];
export function check(cond, name) {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) process.exitCode = 1;
}
export const summary = () => results;

// Mở app với vai 1 nhân sự. opts: { tab, mobile, mwCache, extra }
export async function openAs(user, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || (opts.mobile ? { width: opts.mobile, height: 800 } : { width: 1440, height: 900 }),
    deviceScaleFactor: opts.viewport ? 2 : 1, hasTouch: !!(opts.mobile || opts.viewport), isMobile: !!(opts.mobile || opts.viewport), locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
  });
  const token = jwt(user.id);
  await ctx.addInitScript((c) => { try { if (c) localStorage.setItem('mw_enabled_cache', c); } catch { /* */ } }, opts.mwCache || '');
  await ctx.route('https://demo.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const target = REST + url.pathname.replace('/rest/v1', '') + url.search;
    const headers = { ...req.headers(), authorization: `Bearer ${token}` };
    delete headers.apikey; delete headers.host; delete headers['content-length'];
    try {
      const res = await fetch(target, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() });
      const body = Buffer.from(await res.arrayBuffer());
      const h = {};
      res.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) h[k] = v; });
      h['access-control-allow-origin'] = '*';
      h['access-control-expose-headers'] = 'Content-Range';
      await route.fulfill({ status: res.status, headers: h, body });
    } catch (e) { await route.fulfill({ status: 502, body: String(e) }); }
  });
  // R2 không chạy cục bộ: giả lập dịch vụ lưu trữ (presign + PUT) — sha256 vẫn tính thật trên tệp
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'access-control-allow-headers': '*' };
  // (Playwright chạy route đăng ký SAU trước -> route chung đăng ký trước)
  await ctx.route('https://demo.supabase.co/functions/v1/**', (route) => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{}' }));
  await ctx.route('https://demo.supabase.co/functions/v1/r2-presign', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const k = `e2e/${Date.now()}`;
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ uploadUrl: `https://upload.e2e.test/${k}`, publicUrl: `https://files.e2e.test/${k}.mp4`, key: k }) });
  });
  await ctx.route('https://upload.e2e.test/**', (route) => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers: CORS, body: '' }));
  await ctx.route('https://files.e2e.test/**', (route) => route.fulfill({ status: 404, body: '' }));
  await ctx.route('https://demo.supabase.co/auth/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror ${user.name}]`, e.message));
  const screen = user.role === 'admin' ? 'admin' : 'staff';
  const q = new URLSearchParams({ screen, uid: user.id, name: user.name, role: user.role, ...(opts.tab ? { tab: opts.tab } : {}), ...(opts.extra || {}) });
  await page.goto(`${BASE}/__preview?${q}`);
  await page.waitForTimeout(1200);
  return { ctx, page };
}

export async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

// Gọi RPC qua PostgREST với JWT của 1 người dùng (đúng quyền như trình duyệt)
export async function rpcAs(user, fn, args) {
  const r = await fetch(`${REST}/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt(user.id)}` }, body: JSON.stringify(args) });
  return r.json();
}
