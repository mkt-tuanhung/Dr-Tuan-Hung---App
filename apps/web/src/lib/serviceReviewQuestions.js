// ============================================================
// Bộ 10 câu hỏi trọng tâm — SSM CarePulse (PRD §6, §7)
// Dùng chung cho trang chấm điểm công khai và module quản trị.
// ============================================================

// Nhãn thang điểm 1..5 (PRD §6.1)
export const RATING_LABELS = {
  1: 'Rất không hài lòng',
  2: 'Không hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
};

// Chủ đề chọn nhanh cho câu mở (PRD §6 câu 10)
export const QUICK_TOPICS = [
  'Chất lượng tư vấn', 'Thái độ nhân viên', 'Thời gian chờ',
  'Chăm sóc sau phẫu thuật', 'Cơ sở vật chất', 'Chi phí',
  'Khả năng liên hệ', 'Kết quả cảm nhận', 'Vấn đề khác',
];

// Vấn đề khi khách chấm 1–2 điểm (PRD §7.3)
export const LOW_SCORE_ISSUES = [
  'Tư vấn chưa đúng hoặc chưa đầy đủ', 'Thời gian chờ lâu',
  'Thái độ nhân sự', 'Khó liên hệ hỗ trợ', 'Chăm sóc hậu phẫu',
  'Chi phí chưa rõ ràng', 'Kết quả chưa như mong đợi', 'Vấn đề khác',
];

// Lựa chọn yêu cầu liên hệ (PRD §7.3)
export const CONTACT_OPTIONS = [
  { value: 'urgent', label: 'Liên hệ với tôi sớm nhất' },
  { value: 'office_hours', label: 'Liên hệ trong giờ hành chính' },
  { value: 'none', label: 'Tôi chỉ muốn góp ý, chưa cần liên hệ' },
];

// 10 câu hỏi. type: rating5 | staff | nps | open
// na = có lựa chọn "không áp dụng"
export const QUESTIONS = [
  {
    code: 'q1', type: 'rating5', required: true,
    title: 'Mức độ hài lòng tổng thể',
    text: 'Anh/chị hài lòng như thế nào về trải nghiệm dịch vụ phẫu thuật tại cơ sở?',
  },
  {
    code: 'q2', type: 'rating5', required: true,
    title: 'Chất lượng tư vấn trước phẫu thuật',
    text: 'Các thông tin về phương pháp, chi phí, quá trình hồi phục và vấn đề có thể phát sinh đã được tư vấn rõ ràng, dễ hiểu chưa?',
  },
  {
    code: 'q3', type: 'staff', required: true,
    title: 'Thái độ & sự chuyên nghiệp của nhân sự',
    text: 'Anh/chị đánh giá thế nào về thái độ, sự tận tâm và tính chuyên nghiệp của đội ngũ nhân sự đã phục vụ?',
  },
  {
    code: 'q4', type: 'rating5', required: true,
    title: 'Quy trình phục vụ',
    text: 'Quy trình tiếp đón, làm thủ tục, phẫu thuật và chăm sóc sau phẫu thuật có thuận tiện, rõ ràng, đúng thời gian không?',
  },
  {
    code: 'q5', type: 'rating5', required: true,
    title: 'Cơ sở vật chất & vệ sinh',
    text: 'Anh/chị hài lòng thế nào về cơ sở vật chất, phòng bệnh, sự sạch sẽ và môi trường chăm sóc?',
  },
  {
    code: 'q6', type: 'rating5', required: true,
    title: 'Hướng dẫn chăm sóc sau phẫu thuật',
    text: 'Anh/chị có được hướng dẫn đầy đủ, dễ hiểu về thuốc, vệ sinh, ăn uống, tái khám và dấu hiệu cần liên hệ bác sĩ không?',
  },
  {
    code: 'q7', type: 'rating5', required: false, na: true,
    naLabel: 'Tôi chưa từng cần liên hệ hỗ trợ',
    title: 'Khả năng hỗ trợ sau phẫu thuật',
    text: 'Khi cần hỗ trợ sau phẫu thuật, anh/chị có dễ dàng liên hệ và nhận phản hồi kịp thời không?',
  },
  {
    code: 'q8', type: 'rating5', required: false, na: true,
    naLabel: 'Chưa đủ thời gian để đánh giá',
    title: 'Quá trình hồi phục & kết quả cảm nhận',
    text: 'Tại thời điểm hiện tại, anh/chị hài lòng thế nào với quá trình hồi phục và kết quả cảm nhận?',
  },
  {
    code: 'q9', type: 'nps', required: true,
    title: 'Khả năng giới thiệu dịch vụ',
    text: 'Trên thang 0–10, anh/chị có sẵn sàng giới thiệu dịch vụ của chúng tôi cho người thân, bạn bè không?',
  },
  {
    code: 'q10', type: 'open', required: false,
    title: 'Ý kiến của anh/chị',
    text: 'Điều gì khiến anh/chị hài lòng nhất và điều gì chúng tôi cần cải thiện để phục vụ tốt hơn?',
  },
];

// Nhóm NPS (PRD §6 câu 9)
export const npsGroup = (n) => (n >= 9 ? 'promoter' : n >= 7 ? 'passive' : 'detractor');

// Nhãn nhóm nhân sự cho câu 3 (tách rõ từng bộ phận)
export const STAFF_ROLE_LABELS = {
  truc_page: 'Trực page (tư vấn online)',
  telesale: 'Telesale (tư vấn qua điện thoại)',
  sale_offline: 'Sale Offline (tư vấn trực tiếp)',
  consultant: 'Tư vấn viên',   // giữ tương thích dữ liệu cũ
  doctor: 'Bác sĩ',
  nurse: 'Điều dưỡng',
  cskh: 'Chăm sóc khách hàng',
};
