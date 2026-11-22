# Event · Thi Văn Nghệ mừng sinh nhật 1 tuổi Dr Tuấn Hùng — Chấm điểm Gala

Menu: **SỰ KIỆN → Event → Thi Văn Nghệ mừng SN Dr Tuấn Hùng**

## Cài đặt (1 lần)

1. Supabase → **SQL Editor** → dán toàn bộ `supabase/event_gala_van_nghe.sql` → **Run**.
   - Chỉ tạo mới bảng/hàm tiền tố `gala_*`, không đụng bảng cũ. Chạy lại được.
2. Tải lại app. Chưa chạy SQL thì trang hiện thông báo "Chưa cài đặt dữ liệu chấm điểm".

## Ai làm được gì

| Vai trò | Quyền |
|---|---|
| **Admin** (`profiles.role = 'admin'`, đang hoạt động) = Ban tổ chức | Tạo chương trình, thêm/sửa/xoá tiết mục, cấp/thu hồi giám khảo, mở/dừng/khoá chấm, công bố, xuất CSV, xem xếp hạng trực tiếp |
| **Giám khảo** (nhân sự được Admin chỉ định cho chương trình) | Chấm điểm từng tiết mục, sửa phiếu tới khi khoá; chỉ thấy phiếu của mình; xem kết quả sau khi công bố |
| Nhân sự khác | Không đọc/ghi được dữ liệu gala |

Quyền kiểm ở **database** (RLS + RPC), không dựa vào giao diện.

## Quy trình

1. Admin tạo chương trình → bộ tiêu chí 100 điểm tự tạo: Chất lượng tiết mục 40 · Sáng tạo & ý tưởng 25 · Phong cách biểu diễn 20 · Tinh thần tập thể 15.
2. Tab **Tiết mục**: thêm từng tiết mục (một đội có thể có nhiều tiết mục).
3. Tab **Giám khảo**: tìm nhân sự → **Cấp quyền**.
4. **Tổng quan → Mở chấm điểm**. Giám khảo mở menu Event trên điện thoại và chấm (bước 0,5).
5. Theo dõi tiến độ + bảng xếp hạng (tự làm mới 12 giây) → **Khoá chấm** → **Công bố** → tab **Công bố** để trình chiếu.

## Quy tắc dữ liệu

- Xếp hạng = trung bình phiếu của giám khảo **đang được cấp quyền**; bằng điểm thì đồng hạng.
- Đã có điểm hoặc đã công bố → không sửa/thêm/xoá tiết mục.
- Công bố khi thiếu phiếu phải xác nhận "công bố tạm tính".
- Thu hồi giám khảo: phiếu cũ vẫn lưu (bảng `gala_score_audit` ghi mọi lần nộp/sửa) nhưng không tính xếp hạng.

## Đã kiểm thử

Chạy SQL trên Postgres 16 (giả lập `auth.uid()` + `profiles` như Supabase), 25 kịch bản đều đúng: admin / giám khảo / nhân viên thường / admin đã nghỉ / anon;
chấm sai bước, vượt điểm, thiếu/thừa tiêu chí; ghi thẳng vào bảng; xem điểm người khác; công bố thiếu phiếu; thu hồi giám khảo.
