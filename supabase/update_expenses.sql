-- Cập nhật bảng expenses để hỗ trợ chức năng duyệt và hoàn ứng
ALTER TABLE expenses
ADD COLUMN reject_reason text,
ADD COLUMN advance_repaid_proof text,
ADD COLUMN advance_repaid_amount numeric(15,0),
ADD COLUMN advance_repaid_method text;

-- Cập nhật thêm các giá trị mới cho ENUM expense_category
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Cong_tac';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Tiep_khach';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Tho_cung';
