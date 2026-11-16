// Chuẩn hoá TÊN KHÁCH: viết hoa chữ cái đầu mỗi chữ, còn lại viết thường.
//   "vũ minh dũng"      → "Vũ Minh Dũng"
//   "NGUYỄN linh GIANG" → "Nguyễn Linh Giang"
//   "Ng.T.Lan"          → "Ng.T.Lan"
// Giữ nguyên: cụm có số / "_" / "@" (tên tài khoản TikTok/IG, số điện thoại, ngày),
// emoji, và các chữ viết tắt trong NAME_ACRONYMS (KH, ADS, FB…).
// PHẢI GIỐNG HỆT hàm SQL public.vn_name_case (supabase/customer_name_case.sql) —
// DB có trigger tự sửa khi lưu; hàm này chỉ để người nhập thấy ngay kết quả.
export const NAME_ACRONYMS = ['KH', 'ADS', 'FB', 'VIP', 'DS', 'CTV', 'KOL', 'KOC', 'MC', 'BS', 'SĐT', 'TT', 'ID', 'IG', 'TK', 'TEST'];
const ACR = new Set(NAME_ACRONYMS);

export function formatPersonName(input) {
  if (input == null) return input;
  const s = String(input).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!s) return s;
  return s.split(' ').map(tok => {
    if (/[0-9_@]/.test(tok)) return tok;
    return tok.replace(/\p{L}+/gu, run => {
      const up = run.toUpperCase();
      if (ACR.has(up)) return up;
      return run.charAt(0).toUpperCase() + run.slice(1).toLowerCase();
    });
  }).join(' ');
}
