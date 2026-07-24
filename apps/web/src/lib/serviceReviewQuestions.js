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

// ---- Khảo sát lại sau khi xử lý phản hồi (PRD §10) ----
export const RESURVEY_QUESTIONS = [
  {
    code: 'rs_resolved', type: 'single', required: true,
    title: 'Kết quả xử lý',
    text: 'Vấn đề của anh/chị đã được giải quyết chưa?',
    options: ['Đã giải quyết', 'Mới giải quyết một phần', 'Chưa giải quyết'],
  },
  {
    code: 'q1', type: 'rating5', required: true,
    title: 'Mức hài lòng với cách xử lý',
    text: 'Anh/chị hài lòng như thế nào với cách chúng tôi tiếp nhận và xử lý phản hồi?',
  },
  {
    code: 'rs_need', type: 'single', required: true,
    title: 'Hỗ trợ thêm',
    text: 'Anh/chị có cần chúng tôi tiếp tục hỗ trợ không?',
    options: ['Không cần thêm', 'Vẫn cần được hỗ trợ'],
  },
];

// ---- Nhận diện chủ đề từ nhận xét tự do (không cần AI ngoài) ----
export const TOPIC_KEYWORDS = [
  { topic: 'Thời gian chờ', re: /chờ|đợi|lâu|chậm trễ/i },
  { topic: 'Thái độ nhân viên', re: /thái độ|cáu|quát|lạnh lùng|nhiệt tình|tận tâm|chu đáo|niềm nở/i },
  { topic: 'Chất lượng tư vấn', re: /tư vấn|giải thích|thông tin|dặn dò/i },
  { topic: 'Khả năng liên hệ', re: /liên hệ|gọi (điện|lại)|nghe máy|hotline|nhắn tin|zalo/i },
  { topic: 'Chi phí', re: /giá|chi phí|tiền|đắt|phụ thu|báo giá/i },
  { topic: 'Cơ sở vật chất', re: /phòng|sạch|bẩn|cơ sở|vệ sinh|máy lạnh|giường|nhà vệ sinh/i },
  { topic: 'Chăm sóc sau phẫu thuật', re: /hậu phẫu|chăm sóc|thay băng|hướng dẫn|tái khám/i },
  { topic: 'Kết quả cảm nhận', re: /kết quả|đẹp|sưng|đau|hồi phục|dáng|form/i },
];
export const detectTopics = (text) => {
  if (!text) return [];
  return TOPIC_KEYWORDS.filter(t => t.re.test(text)).map(t => t.topic);
};

// Màu badge cảm xúc
export const SENTIMENT_STYLE = {
  'rất tích cực': 'bg-emerald-100 text-emerald-700',
  'tích cực': 'bg-teal-100 text-teal-700',
  'trung lập': 'bg-slate-100 text-slate-600',
  'tiêu cực': 'bg-orange-100 text-orange-700',
  'rất tiêu cực': 'bg-rose-100 text-rose-700',
};

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
