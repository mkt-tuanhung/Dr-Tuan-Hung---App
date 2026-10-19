// SỔ TAY CHUYÊN MÔN — video mô phỏng phương pháp, giải thích chuyên môn từng dịch vụ
// (trình phát dùng chung: HandbookPage.jsx; bảng pro_handbook_* — supabase/so_tay_chuyen_mon.sql)
import React from 'react';
import HandbookPage from './HandbookPage.jsx';
import { PRO_HANDBOOK } from './handbookConfigs';

export default function ProHandbookPage() {
  return <HandbookPage config={PRO_HANDBOOK} />;
}
