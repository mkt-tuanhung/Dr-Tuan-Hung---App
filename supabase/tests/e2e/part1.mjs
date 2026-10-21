// Phần 1: cờ module, workspace, thành viên, người duyệt, board, thẻ, kéo thả, drawer, thông báo
import { launch, close, openAs, shot, check, sql, U } from './lib.mjs';

await launch();

// ---- P0: cờ tắt -> menu y như cũ
{
  const { ctx, page } = await openAs(U.lead);
  await page.getByText('Marketing', { exact: true }).first().click();
  await page.waitForTimeout(500);
  const has = await page.getByText('Marketing Workspace', { exact: true }).count();
  await shot(page, '00_flag_off_menu');
  check(has === 0, 'FLAG tắt: nhân sự Marketing KHÔNG thấy menu Marketing Workspace');
  await ctx.close();
}

// ---- Admin bật cờ ở Cài đặt hệ thống
{
  const { ctx, page } = await openAs(U.admin, { tab: 'settings' });
  await page.getByRole('button', { name: /Marketing Workspace/ }).first().click();
  await page.getByRole('button', { name: 'Bật module' }).click();
  await page.getByText('Đang bật').waitFor();
  check(sql('select mw_enabled from clinic_settings') === 't', 'FLAG: Admin bật module ở Cài đặt hệ thống (RPC mw_set_enabled)');
  await shot(page, '00_settings_flag');
  // menu hiện ngay
  await page.getByRole('button', { name: 'Mở Marketing Workspace' }).click();
  await page.waitForTimeout(800);
  // Tạo workspace
  await page.getByRole('button', { name: 'Workspace mới' }).first().click();
  await page.getByPlaceholder('VD: Marketing Dr Tuấn Hùng').fill('Marketing Dr Tuấn Hùng');
  await page.getByRole('button', { name: 'Tạo', exact: true }).click();
  await page.getByText('Thành viên workspace').waitFor();
  const wsId = sql("select id from mw_workspaces where name = 'Marketing Dr Tuấn Hùng'");
  check(!!wsId, 'T04 Admin tạo workspace (RPC mw_create_workspace)');
  // Thêm thành viên
  const addMember = async (name, role) => {
    const sel = page.getByLabel('Chọn nhân sự');
    await sel.selectOption({ label: new RegExp(name.replace(/[()]/g, '.')) });
    await page.getByLabel('Vai trò', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.waitForTimeout(700);
  };
  for (const [u, r] of [[U.lead, 'manager'], [U.media, 'editor'], [U.viewer, 'viewer'], [U.publisher, 'editor']]) {
    const opt = await page.getByLabel('Chọn nhân sự').locator('option', { hasText: u.name }).getAttribute('value');
    await page.getByLabel('Chọn nhân sự').selectOption(opt);
    await page.getByLabel('Vai trò', { exact: true }).selectOption(r);
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.waitForTimeout(700);
  }
  check(sql(`select count(*) from mw_members where workspace_id = '${wsId}'`) === '5', 'S19 Thêm 4 thành viên từ danh sách nhân sự có sẵn (+ chủ)');
  // Cấp người duyệt
  for (const [u, k] of [[U.doctor, 'medical'], [U.lead, 'marketing'], [U.compliance, 'compliance'], [U.publisher, 'publisher']]) {
    const opt = await page.getByLabel('Chọn người duyệt').locator('option', { hasText: u.name }).getAttribute('value');
    await page.getByLabel('Chọn người duyệt').selectOption(opt);
    await page.getByLabel('Loại duyệt').selectOption(k);
    await page.getByRole('button', { name: 'Cấp', exact: true }).click();
    await page.waitForTimeout(600);
  }
  check(sql('select count(*) from mw_reviewers') === '4', 'S19 Admin cấp 4 người duyệt (y khoa / marketing / pháp lý / người đăng)');
  check(sql(`select count(*) from mw_reviewers where user_id = '${U.admin.id}'`) === '0', 'Admin KHÔNG tự động là người duyệt y khoa');
  // Nhãn
  for (const n of ['Video giáo dục', 'Kịch bản']) {
    await page.getByLabel('Tên nhãn').fill(n);
    await page.getByRole('button', { name: 'Thêm nhãn' }).click();
    await page.waitForTimeout(500);
  }
  await shot(page, '01_settings_members');
  await ctx.close();
}

// ---- MKT lead (manager): menu hiện sau khi bật; tạo board theo mẫu, thêm thẻ
let boardId;
{
  const { ctx, page } = await openAs(U.lead);
  await page.waitForTimeout(800);
  // nhóm Marketing là dropdown -> mở nhóm rồi tìm mục
  await page.getByText('Marketing', { exact: true }).first().click();
  const menu = page.getByText('Marketing Workspace', { exact: true }).first();
  check(await menu.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false), 'FLAG bật: nhân sự Marketing thấy menu');
  await menu.click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Bảng công việc' }).click();
  await page.getByRole('button', { name: 'Tạo board' }).first().click();
  await page.getByPlaceholder('VD: Video tháng 11').fill('Video tháng 11');
  await page.getByRole('button', { name: /Sản xuất video/ }).click();
  await page.getByRole('button', { name: 'Tạo board', exact: true }).last().click();
  await page.waitForTimeout(1200);
  boardId = sql("select id from mw_boards where name = 'Video tháng 11'");
  check(sql(`select count(*) from mw_lists where board_id = '${boardId}'`) === '12', 'T04 Tạo board mẫu Sản xuất video (12 cột)');
  const col = page.locator('section[aria-label="Ý tưởng"]');
  for (const t of ['Storyboard: Hạ gò má có làm mặt nhỏ lại?', 'Gợi ý chuỗi chủ đề 30 ngày hàm mặt', '5 sự thật về gọt hàm']) {
    if (await col.getByPlaceholder('Tên công việc…').count() === 0) await col.getByRole('button', { name: 'Thêm công việc' }).click();
    await col.getByPlaceholder('Tên công việc…').fill(t);
    await col.getByPlaceholder('Tên công việc…').press('Enter');
    await page.waitForTimeout(600);
  }
  check(sql(`select count(*) from mw_tasks where board_id = '${boardId}'`) === '3', 'T04 Thêm 3 thẻ vào cột (lưu DB)');
  await page.keyboard.press('Escape');
  await shot(page, '02_kanban_desktop');

  // Mở thẻ -> drawer: giao việc, hạn, checklist, nhãn, bình luận @nhắc
  await page.getByText('5 sự thật về gọt hàm', { exact: true }).click();
  await page.getByRole('dialog').waitFor();
  const dlg = page.getByRole('dialog');
  const pick = async (label, name) => { const v = await dlg.getByLabel(label).locator('option', { hasText: name }).getAttribute('value'); await dlg.getByLabel(label).selectOption(v); await page.waitForTimeout(700); };
  await pick('Thêm phụ trách', U.media.name);
  await dlg.getByLabel('Hạn', { exact: true }).fill('2026-10-24T17:00');
  await page.waitForTimeout(800);
  await dlg.getByRole('button', { name: 'Video giáo dục' }).click();
  await page.waitForTimeout(600);
  await dlg.getByRole('tab', { name: /Checklist/ }).click();
  await dlg.getByLabel('Mục checklist mới').fill('Viết hook 3 giây đầu');
  const ck = await dlg.getByLabel('Người phụ trách mục').locator('option', { hasText: U.media.name }).getAttribute('value');
  await dlg.getByLabel('Người phụ trách mục').selectOption(ck);
  await dlg.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.waitForTimeout(700);
  await dlg.getByRole('tab', { name: /Bình luận/ }).click();
  const input = dlg.getByPlaceholder('Bình luận… gõ @ để nhắc thành viên');
  await input.fill('');
  await input.type('Nhờ @Thu', { delay: 20 });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /@Thu Trang/ }).click();
  await input.type('dựng bản nháp trước thứ 6 #0912', { delay: 10 });
  await page.waitForTimeout(500);
  check(await page.getByText('📞').count() === 0, 'Bình luận Marketing KHÔNG tra cứu khách hàng (#SĐT bị tắt)');
  await dlg.getByRole('button', { name: 'Gửi bình luận' }).click();
  await page.waitForTimeout(900);
  await dlg.getByRole('tab', { name: /Lịch sử/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '03_task_drawer');
  const tId = sql("select id from mw_tasks where title = '5 sự thật về gọt hàm'");
  check(sql(`select count(*) from mw_task_assignees where task_id = '${tId}' and user_id = '${U.media.id}'`) === '1', 'S04 Giao việc lưu DB');
  check(sql(`select to_char(due_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') from mw_tasks where id = '${tId}'`) === '2026-10-24 17:00', 'S04 Hạn lưu đúng giờ VN');
  check(sql(`select count(*) from notifications where user_id = '${U.media.id}' and type = 'mw_assigned' and link = 'mkt_workspace#task:${tId}'`) === '1', 'T04 Người được giao nhận thông báo thật (link deep link)');
  check(sql(`select count(*) from notifications where user_id = '${U.media.id}' and type = 'mw_mention'`) === '1', 'T11 @nhắc thành viên -> 1 thông báo');
  check(sql(`select count(*) from notifications where user_id = '${U.media.id}' and type = 'mw_check_assigned'`) === '1', 'T07 Giao mục checklist -> thông báo');
  check(Number(sql(`select count(*) from mw_activity where task_id = '${tId}'`)) >= 5, 'S04 Lịch sử (audit) ghi mọi thay đổi');
  await ctx.close();
}

console.log('BOARD', boardId);
await close();
