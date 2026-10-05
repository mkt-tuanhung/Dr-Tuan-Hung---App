# Catalogue hướng dẫn nhân viên — App Dr Tuấn Hùng

Bộ cẩm nang 18 trang A4 (794×1123) giới thiệu chi tiết tính năng cho nhân viên
Điều dưỡng, Sale/Telesale, Marketing và Trưởng bộ phận, bản điện thoại.
Không gồm phần kế toán, dòng tiền, lãi lỗ.

Bản xem / xuất PDF: Claude Artifact (Design canvas) https://claude.ai/artifact/PWdrKVLidQvYtTRJmbAxCo

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `pages/` | 18 trang `*.dc.html` + `canvas.json` (thứ tự và vị trí trang) |
| `img/` | Ảnh màn hình đã cắt, lấy từ `video/huong-dan-nhan-vien/public/shots` |
| `tools/mkimg.py` | Cắt ảnh từ bộ shot của video (cần Pillow) |
| `tools/build_pages.py` + `pages_content.py` | Sinh trang 11–18 |
| `tools/measure.mjs` | Kiểm tra trang có tràn khổ A4 không (cần playwright) |
| `tools/blobmap.json` | Mã ảnh đã tải lên artifact ↔ tên file trong `img/` |

Trong trang, ảnh tham chiếu `/_blob/<id>` (ảnh đã tải lên artifact).

## Sửa nội dung

1. Trang 02–10 và bìa: sửa thẳng file trong `pages/`.
   Trang 11–18: sửa `tools/pages_content.py` rồi chạy `python3 tools/build_pages.py`.
2. Kiểm tra tràn trang: `node tools/measure.mjs`.
3. Đăng lại các file `pages/*` lên artifact.

Số liệu hoa hồng/KPI trong trang 11 lấy từ code tại thời điểm viết (10/2026);
khi đổi công thức trong app cần cập nhật lại trang này.
