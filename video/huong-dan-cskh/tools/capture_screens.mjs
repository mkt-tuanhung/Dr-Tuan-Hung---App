// Chụp các màn điện thoại (vai trò CSKH) cho video + toạ độ điểm cần khoanh (CSS px, gốc = đầu trang)
// Dùng: node tools/capture_screens.mjs [tên ảnh ...]   (PLAYWRIGHT=<đường dẫn playwright/index.mjs> nếu không cài sẵn)
import fs from 'fs';
import T, { NOW } from './mock/cskh.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const OUT = new URL('../public/shots', import.meta.url).pathname;
const P = 'http://localhost:4174';
const st = (tab, role = 'cskh') => `/__preview?screen=staff&tab=${tab}&role=${role}`;
// Mở nhật ký 1 khách: gõ tên vào ô tìm rồi bấm "Mở nhật ký" của thẻ đầu tiên
const open = (name) => [{ fill: 'input[placeholder^="Tìm tên KH"]', text: name }, '=Mở nhật ký'];

// Bản ghi sau khi lưu mốc CSKH (để minh hoạ kết quả)
const SAVED = T.customer_appointments.map(r => r.id !== 'ck2' ? r : { ...r, cskh_status: 'Hài lòng',
  cskh_notes: '[15/10/2026 08:04:00] Đã gọi hỏi thăm\nKhách hài lòng kết quả. Mắt đã hết sưng, khách khen dáng mí tự nhiên.' });
export const SPECS = [
  { id: 'login', url: '/', hl: [{ sel: 'input[placeholder="Nhập ID nhân sự"]' }, '=Đăng nhập'] },
  { id: 'home', url: st('overview'), extra: { attendance: [] }, full: true, hl: ['=Chấm công vào', 'Lịch hẹn hôm nay của tôi'] },
  { id: 'nav', url: st('overview'), extra: { attendance: [] }, hl: [{ sel: 'nav button:has-text("Tất cả")' }, { sel: 'nav button:has-text("Lịch hẹn")' }, { sel: 'nav button[aria-label="Chấm công"]' }] },
  { id: 'all', url: st('overview'), steps: [{ sel: 'nav button:has-text("Tất cả")' }], hl: ['=Hậu phẫu / CSKH', '=Đánh giá dịch vụ', '=Khách Bong', '=Hộp thư đa kênh', { sel: 'input[placeholder="Tìm chức năng…"]' }] },
  // Hậu phẫu / CSKH
  { id: 'hp_list', url: st('hau_phau'), full: true, hl: [{ sel: 'main button:has-text("Hậu phẫu")' }, { sel: 'main button:has-text("CSKH")' }, '=Cần ưu tiên theo dõi', { sel: 'input[placeholder^="Tìm tên KH"]' }, '=Gọi', '=Mở nhật ký'] },
  { id: 'ck_list', url: st('hau_phau'), steps: [{ sel: 'main button:has-text("CSKH")' }], full: true, hl: [{ sel: 'main button:has-text("CSKH")' }, '=Chưa phân loại', { sel: 'main button:has-text("Gặp vấn đề")' }, '=Mở nhật ký'] },
  { id: 'hp_care', url: st('hau_phau'), steps: [...open('Lê Hoàng Yến')], full: true, hl: ['=Hành trình hồi phục', '=Rủi ro', 'Bạn chỉ có quyền xem', '=Nhật ký chăm sóc hậu phẫu', '=Sửa', '=Phân công điều dưỡng'] },
  { id: 'ck_care', url: st('hau_phau'), steps: [{ sel: 'main button:has-text("CSKH")' }, ...open('Hồ Mỹ Duyên')], full: true,
    hl: ['=Nhật ký CSKH', '=Phân loại khách hàng', { sel: 'button:text-is("Hài lòng")' }, '+ Đã gọi hỏi thăm', { sel: 'textarea[placeholder^="Ghi chú chăm sóc CSKH"]' }, 'Thêm ảnh', '=Lưu mốc CSKH', '=Hồ sơ 360'] },
  { id: 'ck_care_fill', url: st('hau_phau'), steps: [{ sel: 'main button:has-text("CSKH")' }, ...open('Hồ Mỹ Duyên'), { sel: 'button:text-is("Hài lòng")' }, '+ Đã gọi hỏi thăm', '+ Khách hài lòng kết quả',
    { fill: 'textarea[placeholder^="Ghi chú chăm sóc CSKH"]', text: '. Mắt đã hết sưng, khách khen dáng mí tự nhiên.' }], full: true,
    hl: [{ sel: 'button:text-is("Hài lòng")' }, '+ Đã gọi hỏi thăm', { sel: 'textarea[placeholder^="Ghi chú chăm sóc CSKH"]' }, '=Lưu mốc CSKH'] },
  { id: 'ck_saved', url: st('hau_phau'), extra: { customer_appointments: SAVED }, steps: [{ sel: 'main button:has-text("CSKH")' }, ...open('Hồ Mỹ Duyên')], full: true, hl: ['=Nhật ký CSKH', { sel: 'span:text-is("CSKH: Hài lòng")' }] },
  // Đánh giá dịch vụ
  { id: 'sq_overview', url: st('service_quality'), full: true, hl: ['=Tổng quan', '=Phản hồi', 'Xử lý phản hồi', '=CSAT', '=Ticket đang mở', '=Quá hạn SLA'] },
  { id: 'sq_resp', url: st('service_quality'), steps: ['=Phản hồi'], full: true, hl: ['=Chỉ tiêu cực', { sel: 'input[placeholder^="Tìm tên khách / nội dung"]' }] },
  { id: 'sq_detail', url: st('service_quality'), steps: ['=Phản hồi', 'Gọi tổng đài mãi'], hl: ['Tóm tắt & phân tích bằng AI', 'Điểm từng điểm chạm'] },
  { id: 'sq_tickets', url: st('service_quality'), steps: ['Xử lý phản hồi'], full: true, hl: ['=Đang mở', '=Quá hạn', 'Chưa giao', '=Lý Gia Hân'] },
  { id: 'sq_ticket', url: st('service_quality'), steps: ['Xử lý phản hồi', '=Dương Kim Chi'], hl: ['Muốn liên hệ gấp', { sel: 'select >> nth=0' }, { sel: 'select >> nth=1' }, { sel: 'textarea >> nth=0' }, '=Lưu cập nhật', '=Đóng ticket'] },
  { id: 'sq_ticket2', url: st('service_quality'), steps: ['Xử lý phản hồi', '=Dương Kim Chi'], scrollTo: 'Khảo sát lại sau xử lý', hl: ['Nhật ký xử lý', { sel: 'textarea >> nth=1' }, { sel: 'textarea >> nth=-1' }, 'Tạo phiếu khảo sát lại', '=Lưu cập nhật', '=Đóng ticket'] },
  // Khách Bong
  { id: 'kb_list', url: st('khach_bong'), full: true, hl: [{ sel: 'main button:has-text("Đang chăm sóc")' }, 'Lý do rớt', 'Mở nhật ký'] },
  { id: 'kb_care', url: st('khach_bong'), steps: ['=Trịnh Bích Ngọc'], full: true, hl: ['=Nhật ký chăm sóc', '=Thêm mốc chăm sóc', '=Cập nhật trạng thái', 'Đã gọi, không nghe máy', '=Lưu mốc', 'Quay lại lịch hẹn', '=Chốt cọc', 'Chốt phẫu thuật'] },
  // Hộp thư
  { id: 'ib_list', url: st('inbox'), full: false, hl: [{ sel: 'input[placeholder^="Tìm tên, SĐT"]' }, { sel: 'main button:has-text("Có SĐT")' }, { sel: 'main button:has-text("Chưa gắn khách")' }, '=Nguyễn Thị Lan'] },
  { id: 'ib_thread', url: st('inbox'), steps: ['=Nguyễn Thị Lan'], full: false, hl: ['Mở trên Messenger', 'Hồ sơ 360', 'Trả lời trực tiếp sẽ bật'] },
  { id: 'kb_revert', url: st('khach_bong'), steps: ['=Trịnh Bích Ngọc', 'Quay lại lịch hẹn'], hl: ['Đặt Lịch Hẹn Mới', '=Ngày hẹn', '=Giờ hẹn', 'Xác nhận tạo lịch'] },
  { id: 'kb_deposit', url: st('khach_bong'), steps: ['=Trịnh Bích Ngọc', '=Chốt cọc'], hl: ['Số tiền cọc', 'Chốt cọc & chuyển'] },
  // Lịch hẹn + Khách phẫu thuật
  { id: 'appt', url: st('appointments'), full: false, hl: [{ sel: 'main button:has-text("Tái khám")' }, { sel: 'main button:has-text("Danh sách")' }] },
  { id: 'appt_re', url: st('appointments'), steps: [{ sel: 'main button:has-text("Tái khám")' }], full: true, hl: [] },
  { id: 'pt_list', url: st('khach_phau_thuat'), full: true, hl: ['Nhập viện phí', 'Báo cáo Vật tư', 'Hồ sơ 360'] },
  { id: 'pt_fee', url: st('khach_phau_thuat'), steps: ['Nhập viện phí'], hl: ['Chuyển khoản', 'Tải bill', 'Lưu Viện Phí'] },
  { id: 'pt_vt', url: st('khach_phau_thuat'), steps: ['Báo cáo Vật tư', 'Thêm dòng'], hl: ['Thêm dòng', 'Lưu Vật Tư'] },
  // Chấm công
  { id: 'att', url: st('attendance'), full: true, hl: ['Check-in', 'Check-out'] },
];

// ---- Supabase giả: trả dữ liệu theo bảng, áp các bộ lọc đơn giản (eq / neq / in / is) ----
const SKIP = new Set(['select', 'order', 'limit', 'offset', 'or', 'and', 'on_conflict', 'columns']);
const val = (v) => v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
const keep = (row, key, expr) => {
  if (!(key in row)) return true;                     // cột không có trong dữ liệu giả -> bỏ qua lọc
  const neg = expr.startsWith('not.');
  const e = neg ? expr.slice(4) : expr;
  const dot = e.indexOf('.');
  const op = e.slice(0, dot), raw = e.slice(dot + 1);
  const x = row[key];
  let ok = true;
  if (op === 'eq') ok = String(x) === raw;
  else if (op === 'neq') ok = String(x) !== raw;
  else if (op === 'is') ok = raw === 'null' ? x == null : x === val(raw);
  else if (op === 'in') ok = raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(x));
  else return true;                                    // gte/lte/ilike... không lọc
  return neg ? !ok : ok;
};
export const mockRoute = (TT) => async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  if (u.pathname.includes('/functions/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
  if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (m[1] === 'rpc') return route.fulfill({ status: 200, contentType: 'application/json', body: '"ok"' });
  if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'x' }]) });
  let data = TT[m[1]] || [];
  for (const [k, v] of u.searchParams) if (!SKIP.has(k)) data = data.filter(r => keep(r, k, v));
  if (Number(u.searchParams.get('offset')) > 0) data = [];
  const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, data.length - 1)}/${data.length}` }, body: JSON.stringify(single ? (data[0] || null) : data) });
};

const find = async (p, h) => {
  if (typeof h === 'object') return p.locator(h.sel).locator('visible=true').first();
  const exact = h.startsWith('=');
  return p.getByText(exact ? h.slice(1) : h, { exact }).locator('visible=true').first();
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const only = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const metaPath = `${OUT}/../shots.json`;
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  for (const s of SPECS.filter(s => !only.length || only.includes(s.id))) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(NOW);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('https://demo.supabase.co/**', mockRoute({ ...T, ...(s.extra || {}) }));
    await p.goto(P + s.url, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(1300);
    for (const step of s.steps || []) {
      try {
        if (step.fill) { const el = p.locator(step.fill).locator('visible=true').first(); await el.focus(); await el.evaluate(e => { e.selectionStart = e.selectionEnd = e.value.length; }); await el.pressSequentially(step.text, { delay: 5 }); }
        else { const el = await find(p, step); await el.scrollIntoViewIfNeeded({ timeout: 4000 }); await el.tap({ timeout: 5000 }); }
      } catch (e) { console.log('STEP FAIL', s.id, JSON.stringify(step), e.message.split('\n')[0]); }
      await p.waitForTimeout(900);
    }
    await p.evaluate(() => { document.activeElement?.blur?.(); });
    await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} *{scrollbar-width:none} [data-sonner-toaster]{display:none!important} *{caret-color:transparent!important}' });
    if (s.scrollTo) { try { await (await find(p, s.scrollTo)).evaluate(e => e.scrollIntoView({ block: 'center' })); } catch { console.log('NO SCROLL', s.id); } }
    else if (s.full) await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300);
    const boxes = [];
    for (const h of s.hl || []) {
      try {
        const el = await find(p, h);
        const bb = await el.boundingBox({ timeout: 2000 });
        const sy = await p.evaluate(() => window.scrollY);
        // Ảnh không cuộn (màn có bảng trượt khoá cuộn trang): toạ độ = toạ độ khung nhìn
        if (bb) boxes.push({ key: typeof h === 'object' ? h.sel : h.replace(/^=/, ''), x: bb.x, y: bb.y + (s.full ? sy : 0), w: bb.width, h: bb.height });
        else console.log('NO BOX', s.id, h);
      } catch { console.log('NO BOX', s.id, JSON.stringify(h)); }
    }
    const height = s.full ? await p.evaluate(() => document.documentElement.scrollHeight) : 844;
    if (s.full) {
      // Ảnh khung (header + thanh dưới) như màn hình thật, rồi ẩn phần tử cố định để chụp trọn trang dài
      await p.screenshot({ path: `${OUT}/${s.id}_vp.png` });
      await p.addStyleTag({ content: 'nav.fixed, .fixed { display: none !important; }' });
      await p.waitForTimeout(150);
    }
    await p.screenshot({ path: `${OUT}/${s.id}.png`, fullPage: !!s.full });
    meta[s.id] = { w: 390, h: height, boxes };
    console.log(`${s.id}: h=${height} boxes=${boxes.length}/${(s.hl || []).length}${errs.length ? ' ERR ' + errs[0].slice(0, 100) : ''}`);
    await ctx.close();
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
  await b.close();
}
