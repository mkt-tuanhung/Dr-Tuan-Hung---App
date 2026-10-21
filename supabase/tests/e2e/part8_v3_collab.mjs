import { launch, close, openAs, shot, check, sql, U } from './lib.mjs';
await launch();
const asAdmin = (q) => sql(`select set_config('request.jwt.claims', '{"sub":"${U.admin.id}","role":"authenticated"}', false); ${q}`);
const errors = [];
asAdmin("delete from mw_messages; delete from mw_docs; delete from mw_bases; delete from mw_automations; delete from mw_tasks where title in ('Thẻ thử automation','Hook: 3 dấu hiệu cần phẫu thuật hàm','Before/After hàm móm (ẩn mặt)') or description like '%Tạo từ chat%'; delete from notifications where link like 'mkt_workspace#chat:%'");

const { ctx, page } = await openAs(U.lead, { tab: 'mkt_workspace' });
page.on('pageerror', (e) => errors.push(e.message));
await ctx.route('https://maps.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="background:#e5f0e8;font:14px sans-serif;display:grid;place-items:center">Google Maps (giả lập E2E)</body>' }));
await ctx.route('https://demo.supabase.co/functions/v1/mw-ai', (r) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,OPTIONS' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors, body: '' });
  const body = JSON.parse(r.request().postData() || '{}');
  const ok = body.context?.board === 'Order video' && !JSON.stringify(body).includes('Lan01092026');
  return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ cards: ok ? [
    { title: 'Hook: 3 dấu hiệu cần phẫu thuật hàm', description: 'Video 30s hỏi đáp', priority: 'high', checklist: ['Viết hook', 'Cần bác sĩ duyệt'] },
    { title: 'Before/After hàm móm (ẩn mặt)', description: '', priority: 'normal', checklist: [] },
  ] : [] }) });
});
const nav = (name) => page.locator('nav, aside, [role="tablist"]').getByRole('button', { name, exact: true }).first().click();
await page.getByRole('button', { name: 'Bảng công việc' }).waitFor();

// ---- CHAT ----
await nav('Chat');
const box = page.getByPlaceholder('Nhắn cho team… gõ @ để nhắc người');
await box.waitFor();
await box.fill('Nhờ ');
await box.pressSequentially('@Thu');
await page.waitForTimeout(500);
const opt = page.getByRole('option', { name: /Thu Trang/ }).or(page.getByRole('button', { name: /Thu Trang/ })).first();
if (await opt.count()) await opt.click();
await box.pressSequentially(' dựng gấp video hàm móm');
await page.getByRole('button', { name: 'Gửi' }).click();
await page.waitForTimeout(1500);
check(sql("select count(*) from mw_messages where body like '%dựng gấp video hàm móm%'") === '1', 'Chat: gửi tin nhắn');
check(sql(`select count(*) from notifications where user_id = '${U.media.id}' and link like 'mkt_workspace#chat:%'`) >= '1', 'Chat: @nhắc -> thông báo cho người được nhắc');
await page.getByText('dựng gấp video hàm móm').hover();
await page.getByRole('button', { name: 'Tạo thẻ từ tin nhắn' }).first().click();
const mt = page.getByRole('dialog', { name: 'Tạo thẻ việc từ tin nhắn' });
await mt.getByLabel('Board').selectOption({ label: 'Order video' });
await page.waitForTimeout(600);
await mt.getByRole('button', { name: 'Tạo thẻ' }).click();
await page.waitForTimeout(2000);
check(sql("select count(*) from mw_messages m join mw_tasks t on t.id = m.task_id where m.body like '%dựng gấp video hàm móm%' and t.description like '%Tạo từ chat%'") === '1', 'Chat: biến tin nhắn thành thẻ việc (gắn link 2 chiều)');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await shot(page, 'v3_01_chat');

// ---- WIKI ----
await nav('Tài liệu & Wiki');
await page.getByRole('button', { name: 'Trang mới' }).click();
await page.getByRole('button', { name: 'Sửa' }).click();
await page.getByLabel('Tiêu đề trang').fill('Quy chuẩn kịch bản video');
await page.getByLabel('Nội dung (Markdown)').fill('# Quy chuẩn\n- [ ] Hook 3 giây\n- **Ẩn mặt** khách nếu chưa đồng ý\n[Brand guideline](https://example.com)');
await page.getByRole('button', { name: 'Lưu phiên bản mới' }).click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Sửa' }).click();
await page.getByLabel('Nội dung (Markdown)').fill('# Quy chuẩn v2\n- Hook 2 giây');
await page.getByRole('button', { name: 'Lưu phiên bản mới' }).click();
await page.waitForTimeout(1200);
check(sql("select version from mw_docs where title = 'Quy chuẩn kịch bản video'") === '3', 'Wiki: tạo trang + 2 lần sửa -> v3');
await page.getByRole('button', { name: 'Lịch sử' }).click();
const hist = page.getByRole('dialog', { name: 'Lịch sử phiên bản' });
await hist.locator('li').first().waitFor();
check(await hist.getByRole('button', { name: 'Khôi phục' }).count() === 2, 'Wiki: lịch sử có 2 phiên bản cũ');
await hist.locator('li', { hasText: 'v2' }).getByRole('button', { name: 'Khôi phục' }).click();
await page.waitForTimeout(1200);
check(sql("select body like '%Hook 3 giây%' from mw_docs where title = 'Quy chuẩn kịch bản video'") === 't', 'Wiki: khôi phục phiên bản cũ');
await shot(page, 'v3_02_wiki');

// ---- BASE ----
await nav('Base');
await page.getByRole('button', { name: 'Base mới' }).first().click();
const nb = page.getByRole('dialog', { name: 'Base mới' });
await nb.getByLabel('Tên Base').fill('KOL tháng 11');
await nb.getByRole('button', { name: 'KOL / Influencer' }).click();
await nb.getByRole('button', { name: 'Tạo' }).click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Dòng' }).click();
await page.waitForTimeout(800);
await page.getByLabel('Tên KOL').first().fill('Bác sĩ review');
await page.getByLabel('Phí (đ)').first().fill('5000000');
await page.getByLabel('Kênh').first().selectOption('TikTok');
await page.getByLabel('Tên KOL').first().click();
await page.waitForTimeout(1500);
check(sql("select (data->>(fields->0->>'id')) || '/' || (data->>(fields->3->>'id')) || '/' || (data->>(fields->1->>'id')) from mw_base_rows r join mw_bases b on b.id = r.base_id where b.name = 'KOL tháng 11'") === 'Bác sĩ review/5000000/TikTok', 'Base: thêm dòng, nhập chữ/số/lựa chọn');
await page.getByRole('button', { name: 'Kanban' }).click();
check(await page.locator('section', { hasText: 'TikTok' }).getByText('Bác sĩ review').count() === 1, 'Base: view Kanban theo cột lựa chọn');
await shot(page, 'v3_03_base');

// ---- AUTOMATION ----
await nav('Automation');
await page.getByRole('button', { name: 'Luật mới' }).click();
const am = page.getByRole('dialog', { name: 'Luật automation mới' });
await am.getByLabel('Tên luật').fill('Vào Đang dựng → giao editor');
await am.getByLabel('Board').selectOption({ label: 'Order video' });
await page.waitForTimeout(600);
await am.getByLabel('Cột').selectOption({ label: 'Đang dựng' });
await am.getByLabel('Người').selectOption({ label: 'Thu Trang (Media)' });
await am.getByRole('button', { name: 'Thêm hành động' }).click();
await am.getByRole('button', { name: 'Thêm hành động' }).click();
await am.getByLabel('Hành động').nth(2).selectOption('add_checklist');
await am.getByLabel('Các mục checklist').fill('Cắt hook\nChèn logo\nPhụ đề');
await am.getByRole('button', { name: 'Tạo luật' }).click();
await page.waitForTimeout(1200);
check(sql("select count(*) from mw_automations where name = 'Vào Đang dựng → giao editor' and enabled") === '1', 'Automation: tạo luật');
await page.getByRole('button', { name: 'Bảng công việc' }).click();
await page.getByRole('button', { name: /Order video/ }).click();
const col = page.locator('section[aria-label="Ý tưởng"]');
await col.waitFor();
await col.getByRole('button', { name: 'Thêm công việc' }).click();
await col.getByLabel('Tên công việc').fill('Thẻ thử automation');
await col.getByRole('button', { name: 'Thêm thẻ' }).click();
await page.waitForTimeout(1500);
const tA = sql("select id from mw_tasks where title = 'Thẻ thử automation'");
await page.locator(`article[data-task-id="${tA}"]`).focus();
await page.keyboard.press('m');
const mv = page.getByRole('dialog', { name: 'Di chuyển thẻ' });
await mv.getByLabel('Cột đích').selectOption({ label: 'Đang dựng' });
await mv.getByRole('button', { name: 'Di chuyển', exact: true }).click();
await page.waitForTimeout(2000);
check(sql(`select count(*) from mw_task_assignees where task_id = '${tA}' and user_id = '${U.media.id}'`) === '1', 'Automation: kéo thẻ vào "Đang dựng" -> tự giao editor');
check(sql(`select count(*) from mw_checklist_items where task_id = '${tA}'`) === '3', 'Automation: tự thêm 3 mục checklist');
check(sql(`select to_char(due_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') from mw_tasks where id = '${tA}'`) === '17:00', 'Automation: tự đặt hạn 17:00');
await nav('Automation');
await page.getByText(/✓/).first().waitFor({ timeout: 5000 }).catch(() => {});
check(await page.getByText(/✓/).count() >= 1, 'Automation: hiện nhật ký lần chạy');
await shot(page, 'v3_04_automation');

// ---- Board views: Gantt / Dashboard / Gallery / Map ----
asAdmin(`update mw_tasks set location = 'Bệnh viện Thẩm mỹ Dr Tuấn Hùng, Hà Nội' where id = '${tA}'`);
await page.getByRole('button', { name: 'Bảng công việc' }).click();
await page.getByRole('button', { name: /Order video/ }).click();
await page.getByRole('tab', { name: 'Gantt' }).click();
const bar = page.getByRole('button', { name: /^Thẻ thử automation: hạn/ });
await bar.waitFor();
const due0 = sql(`select due_at::date from mw_tasks where id = '${tA}'`);
const bb = await bar.boundingBox();
const track = await page.locator('.min-w-\\[960px\\] .relative.h-7').boundingBox();
const dayPx = track.width / 42;
await page.mouse.move(bb.x + 10, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + 10 + dayPx * 1.5, bb.y + bb.height / 2, { steps: 6 });
await page.mouse.move(bb.x + 10 + dayPx * 3, bb.y + bb.height / 2, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(1500);
const due1 = sql(`select due_at::date from mw_tasks where id = '${tA}'`);
check(sql(`select ('${due1}'::date - '${due0}'::date)`) === '3', `Gantt: kéo thanh dời hạn +3 ngày (${due0} -> ${due1})`);
await shot(page, 'v3_05_gantt');
await page.getByRole('tab', { name: 'Dashboard' }).click();
await page.getByText('Hạn 7 ngày tới').waitFor();
check(true, 'Dashboard board hiển thị KPI');
await shot(page, 'v3_06_dashboard');
await page.getByRole('tab', { name: 'Gallery' }).click();
await page.waitForTimeout(800);
check(await page.getByText('Thẻ thử automation').count() >= 1, 'Gallery hiển thị thẻ');
await page.getByRole('tab', { name: 'Map' }).click();
await page.waitForTimeout(800);
check(await page.locator('iframe[title^="Bản đồ"]').count() === 1, 'Map: thẻ có địa điểm hiện trên bản đồ');
await shot(page, 'v3_07_map');

// ---- Kho media / Báo cáo / AI ----
await nav('Kho media');
await page.waitForTimeout(1500);
check(await page.getByText('Lan01092026_01').count() >= 1, 'Kho media workspace gom source Kho đã gắn');
await shot(page, 'v3_08_media');
await nav('Báo cáo');
await page.getByText('Thẻ hoàn thành', { exact: true }).waitFor();
check(true, 'Báo cáo hiển thị KPI');
await shot(page, 'v3_09_reports');
await nav('Trợ lý AI');
await page.getByPlaceholder(/Lập 20 chủ đề/).fill('Lên 2 ý tưởng video phẫu thuật hàm');
await page.getByLabel('Board').selectOption({ label: 'Order video' });
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Đề xuất' }).click();
await page.getByText('Hook: 3 dấu hiệu cần phẫu thuật hàm').waitFor();
check(sql("select count(*) from mw_tasks where title like 'Hook: 3 dấu hiệu%'") === '0', 'AI: chỉ đề xuất, chưa tạo gì');
await page.getByRole('button', { name: /Tạo 2 thẻ đã chọn/ }).click();
await page.waitForTimeout(2000);
check(sql("select count(*) from mw_tasks t join mw_checklist_items c on c.task_id = t.id where t.title like 'Hook: 3 dấu hiệu%'") === '2', 'AI: tạo thẻ + checklist sau khi người dùng chọn');
await shot(page, 'v3_10_ai');

// ---- Quyền: viewer xem chat được, không tạo luật / không sửa wiki ----
const v = await openAs(U.viewer, { tab: 'dashboard' });
await v.page.evaluate(() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'mkt_workspace' })));
await v.page.waitForTimeout(1500);
await v.page.locator('nav, aside, [role="tablist"]').getByRole('button', { name: 'Automation', exact: true }).first().click();
await v.page.waitForTimeout(800);
check(await v.page.getByRole('button', { name: 'Luật mới' }).count() === 0, 'Viewer: không thấy nút tạo luật');
await v.page.locator('nav, aside, [role="tablist"]').getByRole('button', { name: 'Tài liệu & Wiki', exact: true }).first().click();
await v.page.waitForTimeout(800);
check(await v.page.getByRole('button', { name: 'Trang mới' }).count() === 0, 'Viewer: không tạo được trang wiki');
await v.page.getByRole('button', { name: 'Quy chuẩn kịch bản video' }).click();
check(await v.page.getByRole('button', { name: 'Sửa' }).count() === 0, 'Viewer: đọc wiki, không sửa');

// Mobile
const m = await openAs(U.lead, { tab: 'mkt_workspace', mobile: 390 });
await m.page.waitForTimeout(800);
await shot(m.page, 'v3_11_mobile');
check(errors.length === 0, `Không có lỗi JS (${errors.join(' | ')})`);
await close();
