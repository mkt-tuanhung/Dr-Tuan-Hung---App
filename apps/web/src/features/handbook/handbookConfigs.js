// Cấu hình từng SỔ TAY VIDEO — dùng chung trình phát HandbookPage.jsx
// Mỗi sổ tay có bảng video + bảng tiến độ riêng (chạy file SQL tương ứng), thư mục R2 riêng.
const pad2 = (n) => String(n).padStart(2, '0');

export const CSKH_HANDBOOK = {
  key: 'cskh',
  name: 'Sổ Tay CSKH',
  unit: 'Tập',
  unitLower: 'tập',
  blurb: 'cẩm nang chăm sóc khách hàng',
  videosTable: 'cskh_handbook_videos',
  progressTable: 'cskh_handbook_progress',
  folder: 'so-tay-cskh',
  thumb: (ep) => `/so-tay-cskh/tap-${pad2(ep)}.jpg`,
  filePrefix: 'Tap',
  sqlFile: 'supabase/so_tay_cskh.sql',
};

export const PRO_HANDBOOK = {
  key: 'pro',
  name: 'Sổ Tay Chuyên môn',
  unit: 'Bài',
  unitLower: 'bài',
  blurb: 'video mô phỏng, giải thích chuyên môn từng dịch vụ',
  videosTable: 'pro_handbook_videos',
  progressTable: 'pro_handbook_progress',
  folder: 'so-tay-chuyen-mon',
  thumb: (ep) => `/so-tay-chuyen-mon/bai-${pad2(ep)}.jpg`,
  filePrefix: 'Bai',
  sqlFile: 'supabase/so_tay_chuyen_mon.sql',
};
