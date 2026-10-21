import { launch, close, openAs, shot, check, sql, U } from './lib.mjs';
await launch();
const ws = sql("select id from mw_workspaces where name = 'Order Ads'");
sql(`select set_config('request.jwt.claims', '{"sub":"${U.admin.id}"}', false); insert into mw_members (workspace_id, user_id, role) values ('${ws}', '${U.lead.id}', 'manager'), ('${ws}', '${U.media.id}', 'editor') on conflict do nothing`);
const board = "Order Ads";
const lid = (n) => sql(`select l.id from mw_lists l join mw_boards b on b.id = l.board_id where b.name = '${board}' and l.name = '${n}'`);
// 2 thẻ trong cột "Chờ duyệt"
sql(`select set_config('request.jwt.claims', '{"sub":"${U.admin.id}"}', false); insert into mw_tasks (board_id, list_id, title) select b.id, '${lid('Chờ duyệt')}', t from mw_boards b, unnest(array['Thẻ X','Thẻ Y']) t where b.name = '${board}'`);
{ // Editor không thấy nút xoá cột
  const { ctx, page } = await openAs(U.media, { tab: 'mkt_workspace' });
  await page.getByRole('button', { name: 'Bảng công việc' }).click();
  await page.locator('section[aria-label="Nhận order"]').waitFor();
  check(await page.getByRole('button', { name: /^Xoá cột/ }).count() === 0, 'Thực hiện (editor) KHÔNG thấy nút xoá cột');
  await ctx.close();
}
{
  const { ctx, page } = await openAs(U.lead, { tab: 'mkt_workspace' });
  await page.getByRole('button', { name: 'Bảng công việc' }).click();
  await page.locator('section[aria-label="Nhận order"]').waitFor();
  await shot(page, 'fix_04_delete_column_buttons');
  // xoá cột trống
  await page.getByRole('button', { name: 'Xoá cột Đang làm creative' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xoá cột' }).click();
  await page.waitForTimeout(1500);
  check(await page.locator('section[aria-label="Đang làm creative"]').count() === 0, 'Quản lý xoá cột trống');
  // xoá cột có thẻ -> chuyển sang "Nhận order"
  await page.getByRole('button', { name: 'Xoá cột Chờ duyệt' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Chuyển thẻ sang cột').selectOption(lid('Nhận order'));
  await shot(page, 'fix_05_delete_column_with_cards');
  await d.getByRole('button', { name: 'Xoá cột' }).click();
  await page.waitForTimeout(2000);
  const inTarget = sql(`select string_agg(title, ',' order by sort_index) from mw_tasks where list_id = '${lid('Nhận order')}'`);
  check(inTarget === 'Thẻ X,Thẻ Y', `Xoá cột có thẻ: thẻ được chuyển sang cột khác (${inTarget})`);
  check(await page.locator('section[aria-label="Chờ duyệt"]').count() === 0, 'Cột "Chờ duyệt" đã biến mất khỏi bảng');
  await ctx.close();
}
await close();
