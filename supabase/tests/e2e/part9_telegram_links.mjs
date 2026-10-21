import { launch, close, openAs, shot, check, sql, U } from './lib.mjs';
await launch();
const src = sql("select id from media_customers where source_id = 'Hoa27102026_01'");
const clip = sql("select id from media_clips where title = 'Hỏi đáp V-line' order by created_at desc limit 1");
const task = sql("select id from mw_tasks where title = 'Video hỏi đáp gọt hàm V-line' order by created_at desc limit 1");
const errs = [];
// 1) Kho Media: mở đúng source
let r = await openAs(U.media, { tab: 'content_kho', extra: { focus: src } });
r.page.on('pageerror', e => errs.push(e.message));
await r.page.locator(`#kho-${src}`).waitFor({ timeout: 15000 }).catch(() => {});
check(await r.page.locator(`#kho-${src}`).isVisible(), 'Link Telegram -> Kho Media mở đúng source (chế độ Quản lý nguồn)');
check(!(await r.page.evaluate(() => location.search)).includes('focus='), 'Đã bỏ ?tab/&focus khỏi thanh địa chỉ');
await shot(r.page, 'tg_01_kho_focus'); await r.ctx.close();
// 2) Video Ads: mở đúng clip
r = await openAs(U.lead, { tab: 'content_video', extra: { focus: clip } });
await r.page.locator(`#clip-${clip}`).waitFor({ timeout: 15000 }).catch(() => {});
check(await r.page.locator(`#clip-${clip}`).isVisible(), 'Link Telegram -> Video Ads mở đúng clip');
await shot(r.page, 'tg_02_clip_focus'); await r.ctx.close();
// 3) Workspace: mở đúng thẻ (dạng tab=mkt_workspace#task:id như thông báo đẩy)
r = await openAs(U.lead, { tab: `mkt_workspace#task:${task}` });
await r.page.getByRole('dialog').waitFor({ timeout: 15000 }).catch(() => {});
check(await r.page.getByRole('dialog').getByText('Video hỏi đáp gọt hàm V-line').count() > 0, 'Link -> Workspace mở đúng thẻ');
await shot(r.page, 'tg_03_task_focus'); await r.ctx.close();
// 4) Workspace: cấu hình bật/tắt báo Telegram
r = await openAs(U.lead, { tab: 'mkt_workspace' });
await r.page.locator('nav, aside, [role="tablist"]').getByRole('button', { name: 'Thành viên & cấu hình', exact: true }).first().click();
const cb = r.page.getByRole('checkbox', { name: /nhóm Telegram Media/ });
await cb.waitFor();
check(await cb.isChecked(), 'Cấu hình workspace: mặc định đang bật báo Telegram');
await cb.uncheck(); await r.page.waitForTimeout(1200);
check(sql("select bool_and(not tg_media) from mw_workspaces where name = 'Order Ads'") === 't', 'Tắt báo Telegram cho workspace');
await cb.check(); await r.page.waitForTimeout(1200);
check(sql("select bool_and(tg_media) from mw_workspaces where name = 'Order Ads'") === 't', 'Bật lại báo Telegram');
check(errs.length === 0, `Không lỗi JS ${errs.join('|')}`);
await close();
