# Bàn giao phiên làm việc — 2026-06-29

> File này để mở lại trên máy khác và nắm ngay mạch việc. App: **Dr Tuan Hung - App**.

## ✅ Đã làm xong & đã push (nhánh `main`)

- **Ghi âm tư vấn:** chuyển upload sang **presigned R2** + nâng bitrate **96kbps** (rõ hơn, transcribe chính xác hơn). Thêm Edge Function `r2-presign`.
- **Khách tư vấn:** che 4 số cuối SĐT trên thẻ; làm mới UI hiện đại (avatar màu, badge, điểm AI vòng tròn, nút to); **tăng cỡ chữ dễ đọc**; dọn modal "Đánh giá" (đồng bộ teal, bỏ tím, ô nhập đều, fix 2 ô đè nhau).
- **Đổi tông màu toàn app:** emerald → **teal (Teal Mint)**, 49 file.
- **AI phân tích tư vấn:** prompt rõ bối cảnh PTTM Dr Tuấn Hùng (bác sĩ Nội Trú); **văn bản chia mốc 30 giây + bôi đỏ câu chưa phù hợp** (Whisper verbose_json + GPT trả `issues`).
- **Xoá ghi âm an toàn:** Sale **xin xoá → admin duyệt → Thùng rác** (khôi phục / xoá vĩnh viễn); quyền xoá chốt ở DB.
- **Sản xuất Ads:** fix trình phát video trên mobile (fullscreen iOS, playsInline) + UX bộ lọc.
- **Ô nhập tiền (toàn hệ thống):** component dùng chung `MoneyInput` tự thêm dấu chấm `1.000.000`.

## ⚠️ Việc thủ công còn nợ (để tính năng chạy đủ)

- [ ] **Deploy Edge Function `r2-presign`** + **bật CORS bucket R2** (PUT/GET, origins `*`).
- [ ] **Chạy SQL** `supabase/consult_recordings_trash.sql` (xoá mềm + duyệt xoá) và **thêm cột** `transcript_timeline` (`alter table consult_recordings add column if not exists transcript_timeline jsonb default '[]'::jsonb;`).
- [ ] **Deploy lại Edge Function `analyze-consult`** (bản mới: timeline 30s + issues + prompt bối cảnh).

## 🗺️ Roadmap đang muốn làm dần (chưa build)

Ưu tiên đã chọn:
- **B — ROI nội dung/Ads:** truy vết Ad/Video/Source → lead → ca mổ → doanh thu; thưởng editor/media theo **doanh thu chốt thực tế**.
- **D — Khai thác khách cũ:** LTV, gợi ý upsell, **chiến dịch reactivation** cho telesale, referral.

→ Đề xuất làm **D trước**, rồi **B**.

## 🔵 Đang bàn dở — Inbox hợp nhất Zalo/Messenger + chăm sóc tự động

Đã có kiến trúc + implementation (webhook → lưu hội thoại → inbox trực page → gửi qua API; cron + ZNS chăm sóc tự động).

**Câu hỏi đang chờ chốt** — chọn hướng:
1. **Bridge Zalo cá nhân** (zca-js) — dùng nick cá nhân, **chấp nhận rủi ro khoá nick**, cần VPS/máy chạy 24/7.
2. **Zalo OA + ZNS** — chính thống, ổn định, tốn phí + cần duyệt template.
3. **Hybrid (khuyến nghị)** — OA/ZNS cho chăm sóc tự động hàng loạt + Zalo cá nhân cho 1-1 ấm.

Và cho biết: **có sẵn VPS/máy chạy 24/7 không?**

> Ghi chú: Zalo cá nhân **không có API chính thức**; tool tự động (Sale Work Zalo…) vi phạm điều khoản → rủi ro khoá nick. Chăm sóc tự động hàng loạt nên đi qua **Zalo OA + ZNS** hoặc SMS cho an toàn.

## 📌 Việc nhỏ còn treo

- [ ] Lệnh tạo PR (repo `mkt-tuanhung/hoccungannhien`) — đang gác lại.
- [ ] Khi xác nhận Khách tư vấn ổn → **gỡ nút "Đánh giá" / "Hồ sơ tư vấn" khỏi Lịch hẹn** (đang để tạm ở cả 2 nơi).
- [ ] "Xoá vĩnh viễn" ghi âm **chưa dọn file trên R2** (file mồ côi) — làm thêm nếu cần.

---
*Cập nhật: 2026-06-29 — qua Claude Code.*
