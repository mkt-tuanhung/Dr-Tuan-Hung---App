// QUY TRÌNH CÔNG VIỆC — video hướng dẫn quy trình vận hành nội bộ (QT01, QT02…)
// (trình phát dùng chung: HandbookPage.jsx; bảng proc_handbook_* — supabase/quy_trinh_cong_viec.sql)
import React from 'react';
import HandbookPage from './HandbookPage.jsx';
import { PROC_HANDBOOK } from './handbookConfigs';

export default function ProcHandbookPage() {
  return <HandbookPage config={PROC_HANDBOOK} />;
}
