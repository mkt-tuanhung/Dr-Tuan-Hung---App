// Phần 3: Chiến dịch, Content Studio (phiên bản + sha256), duyệt 3 bước, consent, huỷ hiệu lực khi đổi phiên bản,
// xuất bản thủ công có bằng chứng + người khác xác minh
import crypto from 'crypto';
import { launch, close, openAs, shot, check, sql, U, rpcAs } from './lib.mjs';

await launch();
const TITLE = 'Video: Gọt hàm có đau không?';
const cid = () => sql(`select id from mw_contents where title = '${TITLE}'`);
const open = async (user, opts = {}) => {
  const r = await openAs(user, { tab: 'mkt_workspace', mwCache: '1', ...opts });
  if (!(await r.page.getByRole('button', { name: 'Content Studio' }).count())) {
    // vai trò chưa được cấp menu mặc định (VD CSKH làm pháp lý) -> mở bằng điều hướng nội bộ
    await r.page.evaluate(() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'mkt_workspace' })));
    await r.page.waitForTimeout(1200);
  }
  return r;
};
const toastText = async (page) => (await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | ');
const approveAs = async (user, name, { verifyConsentFirst = false, screenshot } = {}) => {
  const { ctx, page } = await open(user);
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Duyệt' }).click();
  await page.getByRole('button', { name: new RegExp(TITLE.replace(/[?:]/g, '.')) }).first().click();
  const panel = page.locator('section', { hasText: 'Bạn duyệt bước' });
  await panel.waitFor();
  if (verifyConsentFirst) {
    await panel.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await page.waitForTimeout(900);
    check(/consent/i.test(await toastText(page)), `T16 ${name}: chưa xác minh consent -> server từ chối duyệt bước Pháp lý`);
    await page.getByRole('button', { name: 'Xác minh consent' }).click();
    await page.waitForTimeout(900);
  }
  if (screenshot) await shot(page, screenshot);
  await panel.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await page.waitForTimeout(1200);
  await ctx.close();
};

// ---- Lead: chiến dịch + nội dung + phiên bản + consent + gửi duyệt
{
  const { ctx, page } = await open(U.lead);
  await page.getByRole('button', { name: 'Chiến dịch' }).click();
  await page.getByRole('button', { name: 'Chiến dịch mới' }).click();
  const m = page.getByRole('dialog', { name: 'Chiến dịch mới' });
  await m.locator('input').first().fill('Hàm mặt Q4/2026');
  await m.getByPlaceholder('VD: Phẫu thuật hàm mặt').fill('Phẫu thuật hàm mặt');
  await m.getByRole('button', { name: 'Facebook' }).click();
  await m.getByRole('button', { name: 'TikTok' }).click();
  await m.locator('input[type="number"]').first().fill('50000000');
  await m.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(900);
  check(sql("select count(*) from mw_campaigns where name = 'Hàm mặt Q4/2026'") === '1', 'S08 Tạo chiến dịch (lưu DB)');
  await shot(page, '12_campaigns');

  await page.getByRole('button', { name: 'Content Studio' }).click();
  await page.getByRole('button', { name: 'Nội dung mới' }).click();
  const n = page.getByRole('dialog', { name: 'Nội dung mới (brief)' });
  await n.getByPlaceholder('VD: 5 sự thật về gọt hàm').fill(TITLE);
  await n.locator('select').nth(1).selectOption({ label: 'Hàm mặt Q4/2026' });
  await n.getByRole('button', { name: 'Facebook' }).click();
  await n.getByRole('button', { name: 'TikTok' }).click();
  await n.locator('textarea').fill('Mục đích: giải đáp nỗi sợ đau. Hook 3s: "Gọt hàm có đau không?". CTA: đặt lịch tư vấn.');
  await n.getByText('Có hình ảnh / câu chuyện khách hàng').click();
  await n.getByRole('button', { name: 'Tạo' }).click();
  await page.waitForTimeout(1000);
  check(sql(`select medical_review_required::text || consent_required::text from mw_contents where id = '${cid()}'`) === 'truetrue', 'S09 Tạo nội dung (mặc định cần duyệt y khoa, có consent)');

  await page.getByRole('tab', { name: 'Phiên bản' }).click();
  await page.locator('textarea').first().fill('Hook: Gọt hàm có đau không?\nThân: BS giải thích gây mê, giảm đau sau mổ.\nCTA: Đặt lịch tư vấn.');
  await page.getByRole('button', { name: /Lưu Kịch bản v1/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Caption', exact: true }).click();
  await page.locator('textarea').first().fill('Gọt hàm có đau không? BS Tuấn Hùng giải đáp 👇 #hammat');
  await page.getByRole('button', { name: /Lưu Caption v1/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Tệp media', exact: true }).click();
  const buf = crypto.randomBytes(48 * 1024);
  const expected = crypto.createHash('sha256').update(buf).digest('hex');
  await page.locator('input[type="file"]').setInputFiles({ name: 'got-ham-v1.mp4', mimeType: 'video/mp4', buffer: buf });
  await page.waitForTimeout(1800);
  check(sql(`select sha256 from mw_content_versions where content_id = '${cid()}' and kind = 'asset'`) === expected, 'S09/S11 Tệp media lưu đúng sha256 tính trong trình duyệt');
  await shot(page, '13_content_versions');

  await page.getByRole('tab', { name: 'Consent' }).click();
  await page.getByLabel(/Mã hồ sơ consent/).fill('CS-2026-0412');
  await page.getByPlaceholder('VD: ảnh trước/sau, che mắt, FB + TikTok').fill('Video hồi phục, che mắt, Facebook + TikTok');
  await page.getByRole('button', { name: 'Thêm consent' }).click();
  await page.waitForTimeout(800);
  check(sql(`select count(*) from mw_consents where content_id = '${cid()}' and verified_at is null`) === '1', 'Consent lưu MÃ hồ sơ (chưa xác minh)');

  await page.getByRole('tab', { name: 'Duyệt' }).click();
  await page.getByRole('button', { name: 'Gửi duyệt phiên bản hiện tại' }).click();
  await page.waitForTimeout(1000);
  check(sql(`select state from mw_approval_runs where content_id = '${cid()}'`) === 'pending', 'T13 Gửi duyệt -> lượt duyệt chờ bước 1 (bác sĩ)');
  check(sql(`select count(*) from notifications where user_id = '${U.doctor.id}' and type = 'mw_approval'`) === '1', 'T13 Bác sĩ nhận thông báo chờ duyệt');
  await shot(page, '14_content_approval_tab');
  await ctx.close();
}

// ---- Bác sĩ -> Marketing -> Pháp lý (consent) theo thứ tự
{
  // Pháp lý chưa tới lượt: không thấy mục "Chờ tôi"
  const { ctx, page } = await open(U.compliance);
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Duyệt' }).click();
  await page.waitForTimeout(800);
  check(await page.locator('section', { hasText: 'Bạn duyệt bước' }).count() === 0, 'T13 Duyệt tuần tự: Pháp lý chưa được duyệt khi bác sĩ chưa duyệt');
  await ctx.close();
}
await approveAs(U.doctor, 'Bác sĩ', { screenshot: '15_approval_center_doctor' });
check(sql(`select s.state from mw_approval_steps s join mw_approval_runs r on r.id = s.run_id where r.content_id = '${cid()}' and s.kind = 'medical'`) === 'approved', 'T13 Bác sĩ duyệt bước chuyên môn');
await approveAs(U.lead, 'Marketing');
await approveAs(U.compliance, 'Pháp lý', { verifyConsentFirst: true });
check(sql(`select state from mw_approval_runs where content_id = '${cid()}'`) === 'approved' && sql(`select workflow_status from mw_contents where id = '${cid()}'`) === 'approved', 'T13 Đủ 3 bước -> nội dung Đã duyệt');

// ---- Lead: tạo bài đăng Facebook + lên lịch thủ công
const pubFor = (cap) => sql(`select p.id from mw_publications p join mw_content_versions v on v.id = p.caption_version_id where p.content_id = '${cid()}' and v.revision = ${cap} and p.platform = 'facebook'`);
async function createAndSchedule(page) {
  await page.getByRole('button', { name: 'Content Studio' }).click();
  await page.getByRole('button', { name: new RegExp(TITLE.replace(/[?:]/g, '.')) }).first().click();
  await page.getByRole('tab', { name: /Xuất bản/ }).click();
  await page.getByRole('button', { name: /Thêm bài đăng/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Lên lịch' }).first().click();
  await page.getByRole('dialog', { name: 'Lên lịch đăng thủ công' }).locator('input').fill('2026-10-25T19:30');
  await page.getByRole('dialog', { name: 'Lên lịch đăng thủ công' }).getByRole('button', { name: 'Lên lịch' }).click();
  await page.waitForTimeout(1200);
}
{
  const { ctx, page } = await open(U.lead);
  await createAndSchedule(page);
  check(sql(`select state from mw_publications where id = '${pubFor(1)}'`) === 'scheduled', 'S12 Lên lịch đăng thủ công khi đủ gate');
  await ctx.close();
}

// ---- T15: Media sửa caption -> duyệt mất hiệu lực, lịch đăng bị chặn
{
  const { ctx, page } = await open(U.media);
  await page.getByRole('button', { name: 'Content Studio' }).click();
  await page.getByRole('button', { name: new RegExp(TITLE.replace(/[?:]/g, '.')) }).first().click();
  await page.getByRole('tab', { name: 'Phiên bản' }).click();
  await page.getByRole('button', { name: 'Caption', exact: true }).click();
  await page.locator('textarea').first().fill('Gọt hàm có đau không? (bản sửa) #hammat #drtuanhung');
  await page.getByRole('button', { name: /Lưu Caption v2/ }).click();
  await page.waitForTimeout(1200);
  check(sql(`select state from mw_approval_runs where content_id = '${cid()}' order by created_at desc limit 1`) === 'invalidated', 'T15 Sửa caption sau khi duyệt -> lượt duyệt MẤT HIỆU LỰC');
  check(sql(`select state from mw_publications where id = '${pubFor(1)}'`) === 'blocked', 'T15 Lịch đăng đang chờ bị CHẶN ngay');
  check(sql(`select workflow_status from mw_contents where id = '${cid()}'`) === 'revision_required', 'T15 Nội dung chuyển Cần sửa');
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Xuất bản' }).click();
  await page.waitForTimeout(900);
  await shot(page, '16_publishing_blocked');
  await ctx.close();
}

// ---- Gửi duyệt lại -> 3 bước -> bài cũ (caption v1) vẫn bị chặn; bài mới (caption v2) lên lịch được
{
  const { ctx, page } = await open(U.lead);
  await page.getByRole('button', { name: 'Content Studio' }).click();
  await page.getByRole('button', { name: new RegExp(TITLE.replace(/[?:]/g, '.')) }).first().click();
  await page.getByRole('tab', { name: 'Duyệt' }).click();
  await page.getByRole('button', { name: 'Gửi duyệt phiên bản hiện tại' }).click();
  await page.waitForTimeout(900);
  await ctx.close();
}
await approveAs(U.doctor, 'Bác sĩ');
await approveAs(U.lead, 'Marketing');
await approveAs(U.compliance, 'Pháp lý');
{
  const { ctx, page } = await open(U.lead);
  const gate = await rpcAs(U.lead, 'mw_publication_gate', { p_pub: pubFor(1) });
  check(/Caption của bài đăng khác/.test(gate), `T15 Bài đăng gắn caption cũ không đăng được (gate: ${gate})`);
  await createAndSchedule(page);
  check(sql(`select state from mw_publications where id = '${pubFor(2)}'`) === 'scheduled', 'S12 Bài đăng caption v2 đã duyệt -> lên lịch được');
  await ctx.close();
}

// ---- Người đăng nộp link; không tự xác minh; Lead xác minh -> Đã đăng
{
  const { ctx, page } = await open(U.publisher);
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Xuất bản' }).click();
  await page.getByRole('button', { name: 'Đã đăng — nộp link' }).first().click();
  await page.getByPlaceholder('https://…').fill('https://www.facebook.com/drtuanhung/posts/123456789');
  await page.getByRole('button', { name: 'Nộp link', exact: true }).click();
  await page.waitForTimeout(1000);
  check(sql(`select state from mw_publications where id = '${pubFor(2)}'`) === 'pending_verification', 'T20 Nộp link bằng chứng -> Chờ xác minh (CHƯA tính là đã đăng)');
  check(await page.getByText('Chờ người khác xác minh link').count() > 0, 'T20 Người nộp link không tự xác minh được');
  await shot(page, '17_publishing_pending_verification');
  await ctx.close();
}
{
  const { ctx, page } = await open(U.lead);
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Xuất bản' }).click();
  await page.getByRole('button', { name: 'Xác minh đúng' }).first().click();
  await page.waitForTimeout(1200);
  check(sql(`select state || '/' || (verified_by = '${U.lead.id}')::text from mw_publications where id = '${pubFor(2)}'`) === 'published/true', 'T20 Người khác xác minh -> Đã đăng (có người + thời điểm)');
  check(sql(`select workflow_status from mw_contents where id = '${cid()}'`) === 'published', 'Nội dung chuyển Đã đăng');
  await shot(page, '18_publishing_published');
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Tổng quan' }).click();
  await page.waitForTimeout(1500);
  await shot(page, '19_overview_dashboard');
  await ctx.close();
}
// ---- Mobile duyệt (bác sĩ, 390px) — xem lại lượt đã duyệt
{
  const { ctx, page } = await open(U.doctor, { mobile: 390 });
  await page.getByRole('navigation', { name: 'Mục Marketing Workspace' }).getByRole('button', { name: 'Duyệt' }).click();
  await page.getByRole('tab', { name: /Đã xử lý/ }).click();
  await page.getByRole('button', { name: new RegExp(TITLE.replace(/[?:]/g, '.')) }).first().click();
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `Mobile 390px Trung tâm duyệt không tràn ngang (${overflow}px)`);
  await shot(page, '20_approval_mobile_390');
  await ctx.close();
}
check(Number(sql(`select count(*) from mw_activity where entity in ('approval', 'approval_step', 'publication', 'consent', 'content_version')`)) >= 15, 'Audit: duyệt / consent / phiên bản / xuất bản đều ghi nhật ký');
await close();
