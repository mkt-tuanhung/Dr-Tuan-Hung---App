# Video hướng dẫn sử dụng app Dr Tuấn Hùng (bản điện thoại)

Video dọc 1080×1920, ~5 phút, dành cho nhân viên Điều dưỡng, Sale, Marketing (và leader).
Không có phần kế toán / dòng tiền / lãi lỗ.

## Cấu trúc
- `src/script.json` — kịch bản: các cảnh, câu phụ đề (`sub`), cách đọc riêng (`say`), ảnh màn (`shot`), điểm chỉ tay (`focus`)
- `src/Video.jsx` — dựng hình (khung điện thoại, chỉ tay, phụ đề, hoạt hoạ Face ID, nhạc nền tự hạ nhỏ khi có lời)
- `public/shots/` — ảnh chụp màn hình app thật ở cỡ điện thoại (dữ liệu mẫu) + `shots.json` (toạ độ nút)
- `public/voice/` — giọng thuyết minh tiếng Việt từng câu; `src/timing.json` — độ dài từng câu
- `public/music.mp3` — nhạc nền
- `tools/` — công cụ tạo lại ảnh / giọng / nhạc

## Thay nhạc nền (ví dụ nhạc từ Google Flow)
1. Tải bài nhạc về, đổi tên thành `music.mp3`, chép đè vào `public/music.mp3`
2. Render lại: `npm run render` → `out/huong-dan-nhan-vien.mp4`
(Nhạc tự lặp nếu ngắn hơn video, tự nhỏ đi khi có lời thuyết minh.)

## Sửa lời thuyết minh
1. Sửa `sub` (phụ đề) hoặc thêm `say` (cách đọc) trong `src/script.json`
2. Tạo lại giọng: `python3 tools/build_voice.py <thư mục model vits-piper-vi_VN-vais1000-medium>`
   (model: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2,
   cần `pip install sherpa-onnx numpy soundfile imageio-ffmpeg`)
3. `npm run render`

## Chụp lại ảnh màn hình (khi giao diện app thay đổi)
1. Dựng bản xem thử của app: trong `apps/web` chạy
   `VITE_DESIGN_PREVIEW=1 VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo npx vite build --outDir /tmp/demo && npx vite preview --outDir /tmp/demo --port 4174`
2. `node tools/capture_screens.mjs` (cần `playwright`) — có thể truyền tên ảnh để chụp lẻ, ví dụ `node tools/capture_screens.mjs home att`

## Xem / chỉnh trực tiếp
`npm run studio` để mở Remotion Studio.
