import { launch, close, openAs, check, sql, U } from './lib.mjs';
await launch();
const errs = [];
const back = (page) => page.evaluate(() => history.back()).then(() => page.waitForTimeout(700));
// ---- Điện thoại ----
const { ctx, page } = await openAs(U.lead, { tab: 'overview', viewport: { width: 390, height: 844 } });
page.on('pageerror', e => errs.push(e.message));
await page.getByText('Xin chào,').waitFor();
// Tất cả -> chọn Marketing Workspace -> Back về Trang chủ
await page.locator('nav.fixed.bottom-0').getByRole('button', { name: 'Tất cả' }).click();
await page.getByText('Tất cả chức năng').waitFor();
await back(page);
check(!(await page.getByText('Tất cả chức năng').isVisible()), 'Back đóng màn "Tất cả chức năng"');
await page.locator('nav.fixed.bottom-0').getByRole('button', { name: 'Tất cả' }).click();
await page.locator('[data-back-close]').getByRole('button', { name: 'Marketing Workspace' }).click();
await page.getByRole('button', { name: 'Workspace mới' }).waitFor();
// Mở thẻ (ngăn kéo)
await page.getByRole('button', { name: 'Bảng công việc' }).click();
await page.getByRole('button', { name: /Order video/ }).click();
await page.locator('article[data-task-id]').first().click();
const drawer = page.getByRole('dialog').first();
await drawer.waitFor();
const qb = drawer.getByRole('button', { name: 'Quay lại' });
check(await qb.isVisible(), 'Ngăn kéo có nút ‹ Quay lại bên trái trên điện thoại');
const bb = await qb.boundingBox();
check(bb.x < 60, `Nút Quay lại nằm bên trái (x=${Math.round(bb.x)})`);
await back(page);
check(await page.getByRole('dialog').count() === 0, 'Back đóng ngăn kéo thẻ, vẫn ở Marketing Workspace');
check(await page.getByRole('button', { name: 'Workspace mới' }).isVisible(), 'Vẫn ở màn Marketing Workspace');
// Hộp thoại trên ngăn kéo: Back chỉ đóng hộp thoại
await page.locator('article[data-task-id]').first().click();
await page.getByRole('dialog').first().waitFor();
await page.locator('article[data-task-id]').first().evaluate(() => {});
await page.getByRole('button', { name: 'Workspace mới' }).count();
await back(page);
await page.getByRole('button', { name: 'Workspace mới' }).click();
await page.getByRole('dialog', { name: 'Workspace mới' }).waitFor();
await back(page);
check(await page.getByRole('dialog', { name: 'Workspace mới' }).count() === 0, 'Back đóng hộp thoại "Workspace mới"');
// Back tiếp -> về Trang chủ
await back(page);
check(await page.getByText('Xin chào,').isVisible(), 'Back tiếp -> về màn trước (Trang chủ)');
// Nút ‹ trên header cũng quay về đúng màn trước
await page.locator('nav.fixed.bottom-0').getByRole('button', { name: 'KPI của tôi' }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Quay lại' }).first().click();
await page.waitForTimeout(700);
check(await page.getByText('Xin chào,').isVisible(), 'Nút ‹ trên header về Trang chủ');
await ctx.close();

// ---- App cài ra màn hình chính (standalone): vuốt từ mép trái ----
const s = await openAs(U.lead, { tab: 'overview', viewport: { width: 390, height: 844 } });
await s.ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
await s.page.reload(); await s.page.waitForTimeout(1500);
await s.page.locator('nav.fixed.bottom-0').getByRole('button', { name: 'KPI của tôi' }).click();
await s.page.waitForTimeout(600);
const cdp = await s.ctx.newCDPSession(s.page);
const tp = (x, y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }];
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(4, 420) });
for (const x of [30, 60, 100, 140]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x, 425) });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await s.page.waitForTimeout(800);
check(await s.page.getByText('Xin chào,').isVisible(), 'Standalone: vuốt từ mép trái -> quay lại màn trước');
await s.ctx.close();

// ---- Desktop: Back đóng hộp thoại, không phá luồng ----
const d = await openAs(U.lead, { tab: 'mkt_workspace' });
await d.page.getByRole('button', { name: 'Workspace mới' }).click();
await d.page.getByRole('dialog', { name: 'Workspace mới' }).waitFor();
await back(d.page);
check(await d.page.getByRole('dialog', { name: 'Workspace mới' }).count() === 0, 'Desktop: Back đóng hộp thoại');
await d.page.getByRole('button', { name: 'Workspace mới' }).click();
await d.page.getByRole('dialog', { name: 'Workspace mới' }).getByRole('button', { name: 'Huỷ' }).click();
await d.page.waitForTimeout(500);
check(await d.page.evaluate(() => history.state?.__ov) === undefined, 'Đóng bằng nút trong app -> bỏ mục lịch sử của hộp thoại');
check(d.page.url().includes('/__preview'), 'Vẫn ở trong app');
await d.ctx.close();
check(errs.length === 0, `Không lỗi JS ${errs.join('|')}`);
await close();
