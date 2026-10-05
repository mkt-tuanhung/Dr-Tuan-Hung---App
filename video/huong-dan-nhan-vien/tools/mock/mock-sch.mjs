const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
export default {
  notifications: [
    { id: 'n1', user_id: 'demo-staff', actor_id: null, actor: null, type: 'expense_approved', title: 'Yêu cầu tạm ứng đã được duyệt', body: 'Khoản tạm ứng 2.000.000đ đã được quản lý phê duyệt.', link: 'my_advance', is_read: false, created_at: ago(5) },
    { id: 'n2', user_id: 'demo-staff', actor_id: null, actor: null, type: 'community_post', title: 'Bài viết mới trong Cộng đồng', body: 'Lê Minh Anh vừa chia sẻ: Lịch đào tạo tư vấn tuần này.', link: 'community', is_read: false, created_at: ago(42) },
    { id: 'n3', user_id: 'demo-staff', actor_id: null, actor: null, type: 'clip_scored', title: 'Clip của bạn đã được chấm điểm', body: 'Clip "Nâng mũi cấu trúc" đạt 8.5 điểm.', link: 'content', is_read: false, created_at: ago(180) },
    { id: 'n4', user_id: 'demo-staff', actor_id: null, actor: null, type: 'community_like', title: 'Trần Thu Thuỷ thích bài viết của bạn', body: null, link: 'community', is_read: true, created_at: ago(60 * 26) },
    { id: 'n5', user_id: 'demo-staff', actor_id: null, actor: null, type: 'member_added', title: 'Bạn được thêm vào nhóm Tư vấn', body: 'Nhóm Tư vấn – Chi nhánh Q3', link: null, is_read: true, created_at: ago(60 * 24 * 3) },
    { id: 'n6', user_id: 'demo-staff', actor_id: null, actor: null, type: 'clip_approved', title: 'Clip đã được duyệt đăng', body: 'Clip "Cắt mí Hàn Quốc" đã được duyệt.', link: 'content', is_read: true, created_at: ago(60 * 24 * 9) },
  ],
};
