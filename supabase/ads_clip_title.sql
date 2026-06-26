-- Tiêu đề cho clip dựng + chấm điểm/góp ý source từ editor
alter table media_clips add column if not exists title text;
alter table media_customers add column if not exists source_score int;       -- editor chấm điểm source (1-10)
alter table media_customers add column if not exists source_feedback text;     -- editor góp ý source
