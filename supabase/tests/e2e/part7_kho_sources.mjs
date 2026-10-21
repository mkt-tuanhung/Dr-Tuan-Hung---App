import { launch, close, openAs, shot, check, sql, U } from './lib.mjs';
await launch();
const LAN = '10000000-0000-0000-0000-000000000001';
const { ctx, page } = await openAs(U.lead, { tab: 'mkt_workspace' });
await page.getByRole('button', { name: 'Bảng công việc' }).click();
await page.getByRole('button', { name: /Order video/ }).click();
const col = page.locator('section[aria-label="Ý tưởng"]');
await col.waitFor();
await col.getByRole('button', { name: 'Thêm công việc' }).click();
await col.getByLabel('Tên công việc').fill('Video gọt hàm hỏi đáp');
await col.getByRole('button', { name: 'Gắn source từ Kho Media' }).click();
const dlg = page.getByRole('dialog', { name: 'Gắn source từ Kho Media' });
await dlg.getByText('Gợi ý cho thẻ này').waitFor();
const sugg = dlg.locator('section', { hasText: 'Gợi ý cho thẻ này' });
const firstCode = await sugg.locator('b.font-mono').first().innerText();
check(firstCode === 'Lan01092026_01', `Gợi ý số 1 là source đúng dịch vụ + tồn lâu + có clip Win (${firstCode})`);
check(await sugg.getByText('Đúng dịch vụ Hàm mặt').count() > 0, 'Gợi ý ghi rõ lý do (đúng dịch vụ)');
check(await sugg.getByText('Nga10092026_01').count() === 0, 'Nguồn "không được dùng hình" không được gợi ý');
check(await dlg.getByText('Không được dùng hình').count() > 0, 'Danh sách vẫn hiện nguồn bị cấm nhưng khoá');
await shot(page, 'kho_01_picker_suggestions');
await sugg.getByRole('button', { name: 'Cả nguồn' }).first().click();
await dlg.getByRole('button', { name: 'Gắn vào thẻ' }).click();
await col.getByRole('button', { name: 'Thêm thẻ' }).click();
await page.waitForTimeout(2500);
const t = sql("select id from mw_tasks where title = 'Video gọt hàm hỏi đáp'");
check(sql(`select count(*) from mw_task_sources where task_id = '${t}' and media_customer_id = '${LAN}'`) === '1', 'Tạo thẻ nhanh kèm source Kho Media');
check(await page.locator(`article[data-task-id="${t}"]`).getByTitle(/source Kho Media/).count() === 1, 'Thẻ hiện số source');

// Drawer: kịch bản order
await page.locator(`article[data-task-id="${t}"]`).click();
const d = page.getByRole('dialog');
await d.getByRole('tab', { name: 'Source & kịch bản' }).click();
await d.getByText('Lan01092026_01 · cả nguồn').waitFor();
await d.getByRole('button', { name: 'Hỏi – đáp' }).click();
await page.waitForTimeout(2500);
check(sql(`select count(*) from mw_task_scenes where task_id = '${t}'`) === '5', 'Mẫu kịch bản Hỏi – đáp tạo 5 cảnh');
await d.getByLabel('Source của cảnh').first().selectOption({ label: 'Lan01092026_01 · cả nguồn' });
await page.waitForTimeout(800);
await d.getByLabel('Cắt từ').first().fill('0:12');
await d.getByLabel('Cắt đến').first().fill('0:15');
await d.getByLabel('Nội dung cảnh').first().click();
await page.waitForTimeout(1500);
check(sql(`select clip_from || '-' || clip_to || '/' || (source_ref is not null)::text from mw_task_scenes where task_id = '${t}' order by sort_index limit 1`) === '0:12-0:15/true', 'Cảnh 1 trỏ source + đoạn cắt 0:12–0:15');
await shot(page, 'kho_02_scene_script');

// Chuyển cột "Đang dựng" -> Kho cập nhật
await page.keyboard.press('Escape');
await page.locator(`article[data-task-id="${t}"]`).focus();
await page.keyboard.press('m');
const mv = page.getByRole('dialog', { name: 'Di chuyển thẻ' });
await mv.getByLabel('Cột đích').selectOption({ label: 'Đang dựng' });
await mv.getByRole('button', { name: 'Di chuyển', exact: true }).click();
await page.waitForTimeout(2000);
check(sql(`select source_status from media_customers where id = '${LAN}'`) === 'dang_dung', 'Thẻ vào "Đang dựng" -> source bên Kho Media chuyển Đang dựng');
await shot(page, 'kho_03_board_after_move');

// Tạo nội dung từ thẻ -> consent bắt buộc + kịch bản
await page.locator(`article[data-task-id="${t}"]`).click();
await d.getByRole('tab', { name: 'Source & kịch bản' }).click();
await d.getByRole('button', { name: 'Tạo nội dung từ thẻ' }).click();
await page.waitForTimeout(2500);
check(sql(`select consent_required::text from mw_contents where task_id = '${t}'`) === 'true', 'Nội dung tạo từ thẻ dùng hình khách -> tự bật cần consent');
check(sql(`select count(*) from mw_content_versions v join mw_contents c on c.id = v.content_id where c.task_id = '${t}' and v.kind = 'script' and v.body like '%Lan01092026_01 · cả nguồn (0:12–0:15)%'`) === '1', 'Kịch bản cảnh được chép thành phiên bản kịch bản trong Content Studio');
check(await page.getByRole('button', { name: 'Content Studio' }).getAttribute('aria-current') === 'page', 'Mở thẳng Content Studio');
await shot(page, 'kho_04_content_from_task');
await ctx.close();

// Viewer (không có quyền Kho) mở thẻ: không thấy source, vẫn xem kịch bản
{
  sql(`select set_config('request.jwt.claims', '{"sub":"${U.admin.id}"}', false); insert into mw_members (workspace_id, user_id, role) select id, '${U.viewer.id}', 'viewer' from mw_workspaces where name = 'Order Ads' on conflict do nothing`);
  const r = await openAs(U.viewer, {});
  await r.page.evaluate((id) => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: `mkt_workspace#task:${id}` })), t);
  await r.page.waitForTimeout(2000);
  const dv = r.page.getByRole('dialog');
  await dv.getByRole('tab', { name: 'Source & kịch bản' }).click();
  await r.page.waitForTimeout(1200);
  check(await dv.getByText('không có quyền Kho Media').count() > 0 && await dv.getByText('Lan01092026_01').count() === 0, 'Viewer không có quyền Kho: không thấy source');
  check(await dv.getByLabel('Nội dung cảnh').count() === 5, 'Viewer vẫn xem kịch bản (chỉ đọc)');
  await r.ctx.close();
}
await close();
