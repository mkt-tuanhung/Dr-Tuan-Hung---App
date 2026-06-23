// ============================================================
// Hàm tính KPI & hoa hồng dùng chung (admin + nhân sự phải khớp số)
// ============================================================

export const UPSALE_RATE = 3; // % hoa hồng doanh thu upsale của Sale Offline

// Hoa hồng doanh thu Sale Offline (bậc thang):
//   < 500tr  = 1%   |  500tr – < 1 tỷ = 1.5%  |  ≥ 1 tỷ = 2%
export const saleRevCommissionRate = (rev) => {
  if (rev <= 0) return 0;
  if (rev < 500_000_000) return 1;
  if (rev < 1_000_000_000) return 1.5;
  return 2;
};

// Lịch tái khám được đánh dấu bằng service bắt đầu "[Tái khám]"
export const isRecheck = (a) => (a?.service || '').startsWith('[Tái khám]');

// Tính bộ chỉ số Sale Offline cho 1 nhân sự.
//   appts     : lịch hẹn trong tháng theo appointment_date (ĐÃ loại tái khám)
//   surgeries : khách phẫu thuật trong tháng theo surgery_date (status=phau_thuat)
export const computeSaleOffline = (appts = [], surgeries = []) => {
  const total = appts.length;                 // Tổng lịch hẹn (mẫu số tỉ lệ chốt)
  const cntPT = surgeries.length;             // Khách phẫu thuật (tử số)
  const cntCoc = appts.filter(a => a.status === 'coc').length;
  const cntBong = appts.filter(a => a.status === 'bong').length;
  const closeRate = total > 0 ? (cntPT / total) * 100 : 0;

  const doanhThu = surgeries.reduce((s, a) => s + Number(a.revenue || 0), 0);
  const upsale = surgeries.reduce((s, a) => s + Number(a.upsale_revenue || 0), 0);

  const dtRate = saleRevCommissionRate(doanhThu);
  const hhDoanhThu = Math.round(doanhThu * dtRate / 100);
  const hhUpsale = Math.round(upsale * UPSALE_RATE / 100);
  const tongHH = hhDoanhThu + hhUpsale;

  return { total, cntPT, cntCoc, cntBong, closeRate, doanhThu, upsale, dtRate, hhDoanhThu, hhUpsale, tongHH };
};
