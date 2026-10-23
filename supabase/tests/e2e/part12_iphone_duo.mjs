import { launch, close, openAs, U, check } from './lib.mjs';
// iPhone Duo: gập ~382x580 / 466x678; mở ~669x825, 890x626, xoay ngang 951x543 (CSS px)
const OUT = process.env.DUO_SHOTS || new URL('../../../docs/iphone-duo', import.meta.url).pathname;
await launch();
const errs = [];
// Tất cả chức năng — màn mở ngang
let r = await openAs(U.lead, { tab: 'overview', viewport: { width: 951, height: 543 } });
r.page.on('pageerror', e => errs.push(e.message));
await r.page.getByRole('navigation', { name: 'Điều hướng nhanh' }).getByRole('button', { name: 'Tất cả' }).click();
await r.page.waitForTimeout(700);
await r.page.screenshot({ path: `${OUT}/openL2_all.png` });
check(await r.page.getByText('Tất cả chức năng').isVisible(), 'Màn mở: "Tất cả" mở lưới chức năng, thanh dọc vẫn hiện');
await r.page.getByRole('navigation', { name: 'Điều hướng nhanh' }).getByRole('button', { name: 'Lịch hẹn' }).click();
await r.page.waitForTimeout(800);
check(!(await r.page.getByText('Tất cả chức năng').isVisible()), 'Bấm mục trên thanh dọc -> đóng lưới, chuyển màn');
check(await r.page.locator('nav:has-text("Trang chủ")').filter({ hasText: 'Tất cả' }).count() >= 1, 'Có thanh điều hướng');
check(!(await r.page.locator('nav.fixed.bottom-0').isVisible()), 'Màn mở: ẩn thanh dưới');
await r.ctx.close();
// Hộp thoại khi màn thấp (xoay ngang): nút cuối vẫn bấm được
r = await openAs(U.lead, { tab: 'mkt_workspace', viewport: { width: 951, height: 543 } });
await r.page.getByRole('button', { name: 'Workspace mới' }).click();
const dlg = r.page.getByRole('dialog');
await dlg.waitFor();
const box = await dlg.boundingBox();
check(box.y >= 0 && box.y + box.height <= 543, `Hộp thoại nằm trọn trong màn thấp (${Math.round(box.y)}–${Math.round(box.y + box.height)})`);
await r.page.screenshot({ path: `${OUT}/openL2_modal.png` });
await r.ctx.close();
// Điện thoại thường (390x844) không đổi: vẫn thanh dưới, không có thanh dọc
r = await openAs(U.lead, { tab: 'overview', viewport: { width: 390, height: 844 } });
check(await r.page.locator('nav.fixed.bottom-0').isVisible() && !(await r.page.getByRole('navigation', { name: 'Điều hướng nhanh' }).isVisible()), 'iPhone thường: giữ thanh dưới như cũ');
await r.page.screenshot({ path: `${OUT}/iphone_overview.png` });
await r.ctx.close();
// Desktop không đổi
r = await openAs(U.lead, { tab: 'overview' });
check(!(await r.page.getByRole('navigation', { name: 'Điều hướng nhanh' }).isVisible()) && !(await r.page.locator('nav.fixed.bottom-0').isVisible()), 'Desktop: giữ sidebar như cũ');
await r.ctx.close();
check(errs.length === 0, 'Không lỗi JS');
await close();
