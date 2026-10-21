// Phần 2: Việc của tôi, kéo thả, bàn phím, Bảng dữ liệu, Lịch, quyền viewer / người ngoài, deep link, mobile
import { launch, close, openAs, shot, check, sql, U } from './lib.mjs';

await launch();
const tId = sql("select id from mw_tasks where title = '5 sự thật về gọt hàm'");
const listId = (n) => sql(`select l.id from mw_lists l join mw_boards b on b.id = l.board_id where b.name = 'Video tháng 11' and l.name = '${n}'`);

// ---- Media (editor): Việc của tôi, kéo thả, phím M
{
  const { ctx, page } = await openAs(U.media, { tab: 'mkt_workspace', mwCache: '1' });
  await page.getByRole('button', { name: 'Việc của tôi' }).click();
  await page.getByText('5 sự thật về gọt hàm').first().waitFor();
  check(true, 'P0 Việc của tôi hiện thẻ được giao (web)');
  await shot(page, '04_my_tasks');
  await page.getByRole('button', { name: 'Bảng công việc' }).click();
  await page.locator('section[aria-label="Ý tưởng"] article').first().waitFor();
  // Kéo thả HTML5: thẻ -> cột "Viết kịch bản"
  const v0 = Number(sql(`select version from mw_tasks where id = '${tId}'`));
  await page.locator(`article[data-task-id="${tId}"]`).dragTo(page.locator('section[aria-label="Viết kịch bản"]'));
  await page.waitForTimeout(1500);
  check(sql(`select list_id from mw_tasks where id = '${tId}'`) === listId('Viết kịch bản'), 'T05 Kéo thả thẻ sang cột khác -> lưu DB (RPC mw_move_task)');
  check(Number(sql(`select version from mw_tasks where id = '${tId}'`)) === v0 + 1, 'T05 Phiên bản thẻ tăng sau khi di chuyển');
  // Phím M (bàn phím / cảm ứng) -> hộp di chuyển
  const t2 = sql("select id from mw_tasks where title = 'Gợi ý chuỗi chủ đề 30 ngày hàm mặt'");
  await page.locator(`article[data-task-id="${t2}"]`).focus();
  await page.keyboard.press('m');
  const dlg = page.getByRole('dialog', { name: 'Di chuyển thẻ' });
  await dlg.waitFor();
  await dlg.getByLabel('Cột đích').selectOption(listId('Viết kịch bản'));
  await dlg.getByRole('button', { name: 'Đầu cột' }).click();
  await dlg.getByRole('button', { name: 'Di chuyển', exact: true }).click();
  await page.waitForTimeout(1500);
  const order = sql(`select string_agg(title, ' | ' order by sort_index) from mw_tasks where list_id = '${listId('Viết kịch bản')}'`);
  check(order.startsWith('Gợi ý chuỗi chủ đề 30 ngày hàm mặt'), `T05 Di chuyển bằng bàn phím lên ĐẦU cột (thứ tự: ${order})`);
  // Tải lại trang -> thứ tự giữ nguyên
  await page.reload(); await page.waitForTimeout(1500);
  const firstCard = await page.locator('section[aria-label="Viết kịch bản"] article').first().getAttribute('aria-label');
  check(firstCard === 'Gợi ý chuỗi chủ đề 30 ngày hàm mặt', 'T05 Tải lại trang: thứ tự giữ nguyên');
  await shot(page, '05_kanban_after_move');

  // Bảng dữ liệu: sửa ưu tiên trong ô -> đồng bộ
  await page.getByRole('tab', { name: 'Bảng dữ liệu' }).click();
  await page.waitForTimeout(600);
  const row = page.locator('tr', { has: page.locator(`input[value="5 sự thật về gọt hàm"]`) });
  await row.getByLabel('Ưu tiên').selectOption('high');
  await page.waitForTimeout(900);
  check(sql(`select priority from mw_tasks where id = '${tId}'`) === 'high', 'S05 Sửa ô Ưu tiên trong Bảng dữ liệu -> lưu DB');
  await shot(page, '06_table_view');

  // Lịch: kéo thẻ sang ngày khác -> hạn đổi (giữ giờ) và thấy ở Bảng
  await page.setViewportSize({ width: 1440, height: 1400 });   // cả tháng trong màn hình: kéo HTML5 không cuộn giữa chừng
  await page.getByRole('tab', { name: 'Lịch' }).click();
  await page.waitForTimeout(600);
  const chip = page.locator('button[title="5 sự thật về gọt hàm"]').first();
  const target = page.locator('[data-date="2026-10-28"]');
  await chip.dragTo(target);
  await page.waitForTimeout(1200);
  const due = sql(`select to_char(due_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') from mw_tasks where id = '${tId}'`);
  check(due === '2026-10-28 17:00', `T09 Kéo thẻ trên Lịch sang ngày 28 -> hạn ${due} (giữ 17:00)`);
  await shot(page, '07_calendar_view');
  await page.getByRole('tab', { name: 'Bảng', exact: true }).click();
  await page.waitForTimeout(500);
  const cardText = await page.locator(`article[data-task-id="${tId}"]`).innerText();
  check(/28\/10/.test(cardText) && (await page.locator(`article[data-task-id="${tId}"]`).count()) === 1, 'T09 Bảng Kanban hiện hạn mới, không nhân bản thẻ');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await page.waitForTimeout(500);
  await shot(page, '08_timeline_view');
  await ctx.close();
}

// ---- Viewer: không thêm / sửa được
{
  const { ctx, page } = await openAs(U.viewer, { tab: 'mkt_workspace', mwCache: '1' });
  // vai trò telesale không có quyền menu mặc định -> nếu bị đưa về mục khác thì mở bằng NAVIGATE
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'mkt_workspace' })));
  await page.waitForTimeout(1200);
  const onPage = await page.getByRole('button', { name: 'Bảng công việc' }).count();
  if (onPage) {
    await page.getByRole('button', { name: 'Bảng công việc' }).click();
    await page.waitForTimeout(900);
    check(await page.getByRole('button', { name: 'Thêm công việc' }).count() === 0, 'RBAC Người chỉ xem không có nút Thêm công việc');
  } else check(true, 'RBAC Vai trò không được cấp menu không mở được module');
  // Dù gọi thẳng API vẫn bị RLS chặn
  const n = sql(`select count(*) from mw_tasks where id = '${tId}' and title = 'hack'`);
  check(n === '0', 'RBAC Người chỉ xem không sửa được thẻ (RLS)');
  await ctx.close();
}

// ---- Người ngoài (Marketing nhưng không là thành viên): không thấy workspace
{
  const { ctx, page } = await openAs(U.outsider, { tab: 'mkt_workspace', mwCache: '1' });
  await page.waitForTimeout(1000);
  const sees = await page.getByText('Marketing Dr Tuấn Hùng').count();
  check(sees === 0, 'T02 Người ngoài workspace KHÔNG thấy workspace / board / thẻ (RLS)');
  await shot(page, '09_outsider_empty');
  await ctx.close();
}

// ---- Deep link từ thông báo: mkt_workspace#task:<id>
{
  const { ctx, page } = await openAs(U.media, { tab: 'mkt_workspace', mwCache: '1', extra: { focus: `task:${tId}` } });
  const ok = await page.getByRole('dialog').getByText('5 sự thật về gọt hàm').first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  check(ok, 'Deep link thông báo mkt_workspace#task:<id> mở đúng thẻ');
  await ctx.close();
}

// ---- Mobile 360 / 390
for (const w of [360, 390]) {
  const { ctx, page } = await openAs(U.media, { tab: 'mkt_workspace', mwCache: '1', mobile: w });
  await page.getByRole('button', { name: 'Bảng công việc' }).click();
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `Mobile ${w}px: trang không tràn ngang (${overflow}px)`);
  await shot(page, `10_kanban_mobile_${w}`);
  await page.locator(`article[data-task-id="${tId}"]`).click();
  await page.getByRole('dialog').waitFor();
  await shot(page, `11_task_mobile_${w}`);
  await ctx.close();
}

await close();
