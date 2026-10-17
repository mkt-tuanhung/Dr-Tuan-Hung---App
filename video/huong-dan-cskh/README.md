# Video hướng dẫn app cho nhân viên Chăm sóc khách hàng (CSKH)

Video dọc 1080×1920, khoảng 5 phút, dành cho nhân viên CSKH (bản điện thoại).
Ảnh minh hoạ là màn hình app thật (dữ liệu mẫu, không có dữ liệu khách thật); nút cần bấm được khoanh sáng có hoạt hoạ;
giọng thuyết minh tiếng Việt tạo offline bằng Piper (vais1000), không dùng giọng của macOS.

## Nội dung (11 phần)
1. Đăng nhập & Trang chủ, mở "Tất cả" chức năng
2. Chấm công Face ID (vào / ra ca)
3. Danh sách chăm sóc: thẻ Hậu phẫu (< 1 tháng) và CSKH (≥ 1 tháng), ưu tiên, tìm, Gọi, Mở nhật ký
4. Hồ sơ hậu phẫu: rủi ro, hành trình hồi phục, nhật ký (CSKH chỉ xem phần hậu phẫu)
5. Ghi nhật ký CSKH: phân loại khách → thẻ ghi nhanh → ghi chú/ảnh → Lưu mốc CSKH
6. Đánh giá dịch vụ: tổng quan, phản hồi, chỉ tiêu cực, tóm tắt AI
7. Xử lý phản hồi (ticket): giao việc, trạng thái, nguyên nhân, khắc phục, nhật ký, khảo sát lại, đóng ticket
8. Khách Bong: lý do rớt, thêm mốc chăm sóc, quay lại lịch hẹn, chốt cọc
9. Hộp thư đa kênh: lọc, đọc hội thoại, trả lời qua Messenger, Hồ sơ 360
10. Lịch hẹn (Tái khám) & Khách phẫu thuật (nhập viện phí, báo cáo vật tư)
11. Việc mỗi ngày (tóm tắt)

## Cấu trúc
- `src/script.json` — kịch bản: cảnh, phụ đề (`sub`), cách đọc riêng (`say`), ảnh (`shot`), nút cần khoanh (`focus`), nhãn chú thích (`tag`)
- `src/Video.jsx` — dựng hình: khung điện thoại, khoanh vùng nút (nền mờ + viền tự vẽ + nhãn + ngón tay chạm), máy quay zoom vào nút, phụ đề, nhạc nền tự hạ khi có lời
- `public/shots/` + `public/shots.json` — ảnh màn hình và toạ độ nút
- `public/voice/` + `src/timing.json` — giọng đọc từng câu và độ dài
- `tools/` — công cụ chụp ảnh (`capture_screens.mjs`, dữ liệu mẫu `mock/cskh.mjs`), tạo giọng (`build_voice.py`), nhạc (`make_music.py`)

## Làm lại
1. Giọng: `pip install sherpa-onnx numpy soundfile imageio-ffmpeg`, tải model
   https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2 rồi
   `python3 tools/build_voice.py <thư mục model>`
2. Ảnh (khi giao diện app đổi): trong `apps/web` dựng bản xem thử
   `VITE_DESIGN_PREVIEW=1 VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo npx vite build --outDir /tmp/demo && npx vite preview --outDir /tmp/demo --port 4174`,
   rồi `node tools/capture_screens.mjs [tên ảnh…]` (cần `playwright`)
3. Render: `npm install && npm run render` → `out/huong-dan-cskh.mp4`
4. Xem / chỉnh trực tiếp: `npm run studio`
