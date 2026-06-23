// ============================================================
// Hàm tính KPI & hoa hồng dùng chung (admin + nhân sự phải khớp số)
// ============================================================

export const PHONE_COMMISSION = 20000; // 20.000đ / 1 SĐT quan tâm (Trực page)

// Thưởng upsale Sale Offline — bậc thang theo upsale CỦA TỪNG KHÁCH:
//   < 50tr = 3%  |  50tr – < 100tr = 4%  |  ≥ 100tr = 5%
export const saleUpsaleRate = (u) => {
  if (u <= 0) return 0;
  if (u < 50_000_000) return 3;
  if (u < 100_000_000) return 4;
  return 5;
};

// Tính bộ chỉ số Trực page từ các báo cáo ngày (page_daily_reports) trong tháng
export const computeTrucPage = (reports = []) => {
  const phones = reports.reduce((s, r) => s + Number(r.total_phones || 0), 0);            // SĐT xin được
  const interested = reports.reduce((s, r) => s + Number(r.total_interested_phones || 0), 0); // SĐT quan tâm
  const messages = reports.reduce((s, r) => s + Number(r.total_messages || 0), 0);        // tin nhắn tiếp nhận
  const spam = reports.reduce((s, r) => s + Number(r.total_spam_messages || 0), 0);       // tin nhắn spam
  const rate = messages > 0 ? (phones / messages) * 100 : 0;                              // tỉ lệ xin số
  const hh = interested * PHONE_COMMISSION;                                               // hoa hồng
  return { phones, interested, messages, spam, rate, hh };
};

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

  // Thưởng doanh thu cá nhân = (doanh thu − upsale) × A% (A theo bậc tổng doanh thu)
  const dtRate = saleRevCommissionRate(doanhThu);
  const hhDoanhThu = Math.round(Math.max(doanhThu - upsale, 0) * dtRate / 100);

  // Thưởng upsale = Σ (upsale từng khách × B% theo bậc upsale của khách đó)
  const hhUpsale = surgeries.reduce((s, a) => {
    const u = Number(a.upsale_revenue || 0);
    return s + Math.round(u * saleUpsaleRate(u) / 100);
  }, 0);

  const tongHH = hhDoanhThu + hhUpsale;

  return { total, cntPT, cntCoc, cntBong, closeRate, doanhThu, upsale, dtRate, hhDoanhThu, hhUpsale, tongHH };
};
