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

export const PROC_HANDBOOK = {
  key: 'proc',
  name: 'Quy Trình Công Việc',
  unit: 'Quy trình',
  unitLower: 'quy trình',
  blurb: 'video hướng dẫn vận hành nội bộ',
  videosTable: 'proc_handbook_videos',
  progressTable: 'proc_handbook_progress',
  folder: 'quy-trinh-cong-viec',
  thumb: (ep) => `/quy-trinh-cong-viec/qt-${pad2(ep)}.jpg`,
  filePrefix: 'QT',
  sqlFile: 'supabase/quy_trinh_cong_viec.sql',
};
