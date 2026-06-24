-- Cộng đồng: thêm tiêu đề bài viết (để phân loại danh sách)
alter table community_posts add column if not exists title text;
