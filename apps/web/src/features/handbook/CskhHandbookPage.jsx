// SỔ TAY CSKH — các tập video cẩm nang chăm sóc khách hàng (trình phát dùng chung: HandbookPage.jsx)
import React from 'react';
import HandbookPage from './HandbookPage.jsx';
import { CSKH_HANDBOOK } from './handbookConfigs';

export default function CskhHandbookPage() {
  return <HandbookPage config={CSKH_HANDBOOK} />;
}
