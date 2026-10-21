import { launch, close, openAs, shot, check, sql } from './lib.mjs';
await launch();
const editor = { id: '00000000-0000-0000-0000-0000000000e2', name: 'Tú (Editor)', role: 'editor' };
const media = { id: '00000000-0000-0000-0000-0000000000c1', name: 'Thu Trang (Media)', role: 'media' };
// media: xem được thư viện nhưng không có nút xoá thư mục
let r = await openAs(media, { tab: 'content_images' });
await r.page.getByText('Banner tháng 10').waitFor({ timeout: 15000 });
check(await r.page.getByRole('button', { name: 'Xoá thư mục Banner tháng 10' }).count() === 0, 'Media: không có nút xoá thư mục');
await r.ctx.close();
// editor: có nút xoá thư mục và xoá được (kể cả trên điện thoại)
r = await openAs(editor, { tab: 'content_images', mobile: 390 });
const errs = []; r.page.on('pageerror', e => errs.push(e.message));
await r.page.getByText('Banner tháng 10').waitFor({ timeout: 15000 });
const btn = r.page.getByRole('button', { name: 'Xoá thư mục Banner tháng 10' });
check(await btn.isVisible(), 'Editor (điện thoại): thấy nút xoá thư mục');
await shot(r.page, 'img_folder_delete_editor');
r.page.once('dialog', d => d.accept());
await btn.click();
await r.page.waitForTimeout(1500);
check(sql("select count(*) from image_folders where name = 'Banner tháng 10'") === '0', 'Editor xoá thư mục thành công');
check(await r.page.getByRole('button', { name: 'Tải ảnh lên' }).count() === 0, 'Editor vẫn không có quyền tải ảnh / tạo thư mục (chỉ được xoá)');
check(errs.length === 0, 'Không lỗi JS');
await close();
