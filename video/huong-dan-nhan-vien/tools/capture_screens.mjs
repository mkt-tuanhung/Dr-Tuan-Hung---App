// Chụp các màn điện thoại cho video + toạ độ điểm cần chỉ (CSS px, gốc = đầu trang)
import { chromium } from 'playwright';
import fs from 'fs';
import T from './mock/vmock.mjs';
const OUT = new URL('../public/shots', import.meta.url).pathname;
const P = 'http://localhost:4174';
const st = (tab, role = 'sale_offline') => `/__preview?screen=staff&tab=${tab}&role=${role}`;
const SPECS = [
  { id: 'login', url: '/', hl: [{ sel: 'input[placeholder="Nhập ID nhân sự"]' }, { sel: 'input[placeholder="Nhập mật khẩu"]' }, '=Đăng nhập'] },
  { id: 'home', url: st('overview'), full: true, hl: ['=Chấm công vào', '=Lịch làm việc', 'Ngày công tháng', '=Tháng này', 'Lịch hẹn hôm nay của tôi'] },
  { id: 'nav', url: st('overview'), hl: [{ sel: 'nav button[aria-label="Chấm công"]' }, { sel: 'nav button:has-text("Tất cả")' }] },
  { id: 'all', url: st('overview'), steps: [{ sel: 'nav button:has-text("Tất cả")' }], hl: [{ sel: 'input[placeholder="Tìm chức năng…"]' }] },
  { id: 'att_noface', url: st('attendance'), extra: { face_profiles: [], attendance: [] }, hl: ['Đăng ký Face ID'] },
  { id: 'att', url: st('attendance'), full: true, hl: ['Check-out bằng khuôn mặt', 'Mạng Wi‑Fi văn phòng', '=Tạo đơn', '=Ghi tăng ca', 'Bảng chấm công', 'Lịch sử chi tiết'] },
  { id: 'leave', url: st('attendance'), steps: ['=Tạo đơn'], hl: ['Loại đơn', '=Ngày', 'Lý do', 'Gửi đơn'] },
  { id: 'ot', url: st('attendance'), steps: ['=Ghi tăng ca'], hl: ['Khoảng giờ tăng ca', '=Lưu tăng ca'] },
  { id: 'schedule', url: st('my_schedule'), full: true, hl: ['Ca hôm nay', 'Lịch trong tuần', { sel: 'button:has(svg.lucide-users)' }, { sel: 'header button[aria-label="Quay lại"]' }, { sel: 'header button[aria-label="Thông báo"]' }] },
  { id: 'adv', url: st('advances'), full: true, hl: ['=Tạo phiếu'] },
  { id: 'adv_new', url: st('advances'), steps: ['=Tạo phiếu'], hl: ['Danh mục chi *', 'Số tiền (VNĐ) *', 'Lý do / Mô tả chi tiết *', '=Gửi yêu cầu'] },
  { id: 'payroll', url: st('my_payroll'), full: true, hl: ['Kỳ lương', 'Thực nhận Tháng', '=Khấu trừ'] },
  { id: 'kpi', url: st('kpi'), full: true, hl: ['Chỉ tiêu KPI được giao', 'Doanh thu & Hoa hồng'] },
  { id: 'kpi_dd', url: st('kpi', 'dieu_duong'), full: true, hl: ['Tổng hoa hồng ước tính'] },
  { id: 'bell', url: st('my_schedule'), steps: [{ sel: 'header button[aria-label="Thông báo"]' }], hl: [] },
  { id: 'account', url: st('my_schedule'), steps: [{ sel: 'header .cursor-pointer' }], full: false, hl: ['Đổi mật khẩu', 'Nhận thông báo Telegram', 'Bật thông báo về máy'] },
  { id: 'dd_pt', url: st('khach_phau_thuat', 'dieu_duong'), full: true, hl: [] },
  { id: 'dd_hp', url: st('hau_phau', 'dieu_duong'), full: true, hl: [] },
  { id: 'dd_sq', url: st('service_quality', 'dieu_duong'), full: true, hl: [] },
  { id: 'sale_appt', url: st('appointments'), full: true, hl: [] },
  { id: 'sale_tv', url: st('khach_tu_van'), full: true, hl: [] },
  { id: 'sale_coc', url: st('khach_coc'), full: true, hl: [] },
  { id: 'tele_data', url: st('data_kh', 'telesale'), full: true, hl: [{ sel: 'main a[href^="tel:"], main button:has(svg.lucide-phone)' }] },
  { id: 'mkt_kho', url: st('content_kho', 'marketing'), full: true, hl: [] },
  { id: 'mkt_video', url: st('content_video', 'marketing'), full: true, hl: [] },
  { id: 'community', url: st('community'), full: true, hl: [] },
  { id: 'meetings', url: st('meetings'), full: true, hl: [{ sel: 'main button:has(svg.lucide-plus)' }] },
  { id: 'minigame', url: st('minigame'), full: true, hl: [] },
];
const only = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const meta = fs.existsSync(`${OUT}/../shots.json`) ? JSON.parse(fs.readFileSync(`${OUT}/../shots.json`, 'utf8')) : {};
const find = async (p, h) => {
  if (typeof h === 'object') return p.locator(h.sel).locator('visible=true').first();
  const exact = h.startsWith('=');
  return p.getByText(exact ? h.slice(1) : h, { exact }).locator('visible=true').first();
};
for (const s of SPECS.filter(s => !only.length || only.includes(s.id))) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-10-05T08:05:00+07:00'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const TT = { ...T, ...(s.extra || {}) };
  await p.route('https://demo.supabase.co/**', async (route) => {
    const u = new URL(route.request().url());
    const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    let data = TT[m[1]] || [];
    if (Number(u.searchParams.get('offset')) > 0) data = [];
    const single = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, data.length - 1)}/${data.length}` }, body: JSON.stringify(single ? (data[0] || null) : data) });
  });
  await p.goto(P + s.url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1300);
  for (const step of s.steps || []) {
    try { const el = await find(p, step); await el.tap({ timeout: 5000 }); } catch (e) { console.log('STEP FAIL', s.id, JSON.stringify(step)); }
    await p.waitForTimeout(900);
  }
  // Ẩn thanh cuộn
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} *{scrollbar-width:none}' });
  const boxes = [];
  for (const h of s.hl || []) {
    try {
      const el = await find(p, h);
      const bb = await el.boundingBox({ timeout: 2000 });
      const sy = await p.evaluate(() => window.scrollY);
      if (bb) boxes.push({ key: typeof h === 'object' ? h.sel : h.replace(/^=/, ''), x: bb.x, y: bb.y + sy, w: bb.width, h: bb.height });
      else console.log('NO BOX', s.id, h);
    } catch { console.log('NO BOX', s.id, JSON.stringify(h)); }
  }
  const height = s.full ? await p.evaluate(() => document.documentElement.scrollHeight) : 844;
  if (s.full) {
    // Ảnh khung (header + thanh dưới) ở trạng thái màn hình thật, rồi ẩn mọi phần tử cố định để chụp nội dung dài
    await p.screenshot({ path: `${OUT}/${s.id}_vp.png` });
    await p.addStyleTag({ content: 'nav.fixed, .fixed { display: none !important; }' });
    await p.waitForTimeout(150);
  }
  await p.screenshot({ path: `${OUT}/${s.id}.png`, fullPage: !!s.full });
  meta[s.id] = { w: 390, h: height, boxes };
  console.log(`${s.id}: h=${height} boxes=${boxes.length}${errs.length ? ' ERR ' + errs[0].slice(0, 80) : ''}`);
  await ctx.close();
}
fs.writeFileSync(`${OUT}/../shots.json`, JSON.stringify(meta, null, 1));
await b.close();
