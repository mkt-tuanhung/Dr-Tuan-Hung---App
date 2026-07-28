-- Thêm giá trị 'designer' vào enum user_role (để gán role Designer cho nhân sự).
-- CHẠY RIÊNG câu này TRƯỚC (một mình), rồi mới chạy image_library.sql.
alter type user_role add value if not exists 'designer';
