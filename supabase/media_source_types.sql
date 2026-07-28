-- ============================================================
-- Feature #5: Checklist loại source đã có trong link Google Drive của khách.
-- Media tick: Trước PT / Sau PT / Beauty / Feedback / Tái khám → thẻ hiện badge.
-- Chạy 1 lần, an toàn chạy lại.
-- ============================================================
alter table media_customers
  add column if not exists source_types text[] not null default '{}';

notify pgrst, 'reload schema';
