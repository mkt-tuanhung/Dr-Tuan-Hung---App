// ============================================================
// NGÀY / GIỜ THEO MÚI GIỜ VIỆT NAM (Asia/Ho_Chi_Minh, UTC+7)
// Dùng thay cho `new Date().toISOString().split('T')[0]` — cách đó trả về
// ngày theo giờ UTC nên từ 00:00 đến 06:59 sáng bị lùi về NGÀY HÔM TRƯỚC.
// Khớp với hàm vnNow() của Edge Function chấm công khuôn mặt.
// ============================================================
const VN_OFFSET_MS = 7 * 3600 * 1000;

// Dời mốc thời gian sang "giờ VN" rồi đọc bằng các trường UTC (không phụ thuộc múi giờ máy)
const shift = (d = new Date()) => new Date(new Date(d).getTime() + VN_OFFSET_MS);

// 'YYYY-MM-DD' theo giờ Việt Nam
export const vnToday = (d = new Date()) => shift(d).toISOString().slice(0, 10);

// 'HH:MM:SS' theo giờ Việt Nam
export const vnTimeHMS = (d = new Date()) => shift(d).toISOString().slice(11, 19);
