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

// ===================== ĐIỀU DƯỠNG =====================
// Thưởng trực đêm: 500k/khách
// Thưởng phụ mổ theo loại phẫu thuật & vị trí phụ:
//   Đại phẫu: P1 500k · P2 250k · P3 150k   |   Tiểu phẫu: P1 300k · P2 150k · P3 100k
const TRUC_DEM_BONUS = 500000;
const PHU_MO_BONUS = {
  'Đại phẫu': { 1: 500000, 2: 250000, 3: 150000 },
  'Tiểu phẫu': { 1: 300000, 2: 150000, 3: 100000 },
};

// surgeries: các ca phẫu thuật trong tháng (status=phau_thuat, surgery_date trong tháng)
export const computeDieuDuong = (surgeries = [], nurseId) => {
  let trucDem = 0, pm1 = 0, pm2 = 0, pm3 = 0, hauPhau = 0;
  let thuongTrucDem = 0, thuongPhuMo = 0;
  for (const s of surgeries) {
    const tier = PHU_MO_BONUS[s.surgery_type] || PHU_MO_BONUS['Tiểu phẫu'];
    if (s.truc_dem_id === nurseId) { trucDem++; thuongTrucDem += TRUC_DEM_BONUS; }
    if (s.truc_dem_id_2 === nurseId) { trucDem++; thuongTrucDem += TRUC_DEM_BONUS; }
    if (s.phu_mo_1_id === nurseId) { pm1++; thuongPhuMo += tier[1]; }
    if (s.phu_mo_2_id === nurseId) { pm2++; thuongPhuMo += tier[2]; }
    if (s.phu_mo_3_id === nurseId) { pm3++; thuongPhuMo += tier[3]; }
    if (s.hau_phau_id === nurseId || (s.additional_hau_phau_ids || []).includes(nurseId)) hauPhau++;
  }
  return { trucDem, pm1, pm2, pm3, hauPhau, thuongTrucDem, thuongPhuMo, tongHH: thuongTrucDem + thuongPhuMo };
};

// ===================== TELESALE =====================
// Thưởng doanh thu telesale theo bậc tổng doanh thu: <500tr=0.5% | <1 tỷ=1% | ≥1 tỷ=1.5%
export const telesaleRevRate = (rev) => {
  if (rev <= 0) return 0;
  if (rev < 500_000_000) return 0.5;
  if (rev < 1_000_000_000) return 1;
  return 1.5;
};

// Tính chỉ số + hoa hồng Telesale.
//   phones   : tổng SĐT nhận trong tháng (từ page_daily_reports tag telesale)
//   appts    : lịch hẹn theo appointment_date trong tháng (ĐÃ loại tái khám)
//   bongRows : khách bị đánh giá BONG trong tháng (bong_date trong tháng)
//   cocRows  : khách bị đánh giá CỌC trong tháng (deposit_date trong tháng)
//   surgRows : khách phẫu thuật trong tháng (surgery_date trong tháng)
// Phần chia của 1 telesale trên 1 khách: 1/2 nếu có 2 telesale phụ trách, ngược lại = 1
export const telesaleShare = (row) => (row?.telesale_id_2 ? 0.5 : 1);

export const computeTelesale = ({ phones = 0, appts = [], bongRows = [], cocRows = [], surgRows = [] }) => {
  const tongLichHen = appts.length; // số lịch hẹn (đếm đủ, không chia)
  const tyLeChotHen = phones > 0 ? (tongLichHen / phones) * 100 : 0;

  // Doanh thu cá nhân: chia đều nếu khách do 2 telesale phụ trách
  const doanhThu = surgRows.reduce((s, a) => s + Number(a.revenue || 0) * telesaleShare(a), 0);

  const dtRate = telesaleRevRate(doanhThu);
  const thuongDoanhThu = Math.round(doanhThu * dtRate / 100);

  // Thưởng hẹn khách — trả theo từng giai đoạn (bong/cọc → phẫu thuật).
  // Tổng mỗi ca: Đại phẫu 500k, Tiểu phẫu 300k. Co-care 2 telesale → chia đôi.
  //   Tiểu: bong 150k (+150k khi PT) | cọc 200k (+100k khi PT) | trực tiếp 300k
  //   Đại : bong 200k (+300k khi PT) | cọc 300k (+200k khi PT) | trực tiếp 500k
  const isDai = (a) => a?.surgery_type === 'Đại phẫu';
  let thuongLichHen = 0;
  // Khách bị BONG (chưa lên PT)
  thuongLichHen += bongRows.reduce((s, a) => s + (isDai(a) ? 200000 : 150000) * telesaleShare(a), 0);
  // Khách CỌC (chưa lên PT)
  thuongLichHen += cocRows.reduce((s, a) => s + (isDai(a) ? 300000 : 200000) * telesaleShare(a), 0);
  // Khi lên PHẪU THUẬT — cộng phần còn lại tùy hành trình
  let direct = 0, fromBong = 0, fromCoc = 0;
  for (const a of surgRows) {
    const sh = telesaleShare(a);
    const dai = isDai(a);
    if (a.bong_date) { thuongLichHen += (dai ? 300000 : 150000) * sh; fromBong++; }
    else if (a.deposit_date) { thuongLichHen += (dai ? 200000 : 100000) * sh; fromCoc++; }
    else { thuongLichHen += (dai ? 500000 : 300000) * sh; direct++; }
  }
  thuongLichHen = Math.round(thuongLichHen);

  const tongHH = thuongDoanhThu + thuongLichHen;
  return {
    phones, tongLichHen, tyLeChotHen, doanhThu, dtRate,
    thuongDoanhThu, thuongLichHen, tongHH,
    bongCount: bongRows.length, cocCount: cocRows.length, ptCount: surgRows.length,
    direct, fromBong, fromCoc,
  };
};

// Tính bộ chỉ số Sale Offline cho 1 nhân sự.
//   appts     : lịch hẹn trong tháng theo appointment_date (ĐÃ loại tái khám)
//   surgeries : khách phẫu thuật trong tháng theo surgery_date (status=phau_thuat)
// Nguồn khách "quen/CTV" → Sale Offline chỉ tính 50% phần doanh thu cơ bản (upsale vẫn 100%)
export const SALE_HALF_SOURCES = ['Người quen', 'CTV'];
const saleBaseOf = (a) => {
  let base = Number(a.revenue || 0) - Number(a.upsale_revenue || 0);
  if (base < 0) base = 0;
  if (SALE_HALF_SOURCES.includes(a.customer_source)) base = base / 2;
  return base;
};

export const computeSaleOffline = (appts = [], surgeries = []) => {
  const total = appts.length;                 // Tổng lịch hẹn (mẫu số tỉ lệ chốt)
  const cntPT = surgeries.length;             // Khách phẫu thuật (tử số)
  const cntCoc = appts.filter(a => a.status === 'coc').length;
  const cntBong = appts.filter(a => a.status === 'bong').length;
  const closeRate = total > 0 ? (cntPT / total) * 100 : 0;

  const upsale = surgeries.reduce((s, a) => s + Number(a.upsale_revenue || 0), 0);
  // Tổng phần cơ bản (đã giảm 50% với nguồn quen/CTV)
  const sumBase = surgeries.reduce((s, a) => s + saleBaseOf(a), 0);
  // Doanh thu cá nhân ghi nhận KPI = phần cơ bản (đã điều chỉnh) + upsale
  const doanhThu = sumBase + upsale;

  // Thưởng doanh thu = phần cơ bản × A% (A theo bậc doanh thu cá nhân)
  const dtRate = saleRevCommissionRate(doanhThu);
  const hhDoanhThu = Math.round(sumBase * dtRate / 100);

  // Thưởng upsale = Σ (upsale từng khách × B% theo bậc upsale của khách đó)
  const hhUpsale = surgeries.reduce((s, a) => {
    const u = Number(a.upsale_revenue || 0);
    return s + Math.round(u * saleUpsaleRate(u) / 100);
  }, 0);

  const tongHH = hhDoanhThu + hhUpsale;

  return { total, cntPT, cntCoc, cntBong, closeRate, doanhThu, upsale, dtRate, hhDoanhThu, hhUpsale, tongHH };
};

// ============================================================
// Tính 1 DÒNG LƯƠNG cho 1 nhân sự từ dữ liệu nguồn.
// Dùng chung cho Bảng lương (admin) và trang "Lương của tôi" (tính live).
// Trả về đúng tên trường như bảng `payroll` để hiển thị thống nhất.
// ============================================================
export const PAYROLL_STANDARD_DAYS = 26;

export const computePayrollRow = ({ staff, att = [], appts = [], surg = [], bong = [], coc = [], pages = [], adv = [], salAdv = [], contentWins = [], saved = null }) => {
  const D = PAYROLL_STANDARD_DAYS;
  const workingDays = att.filter(a => a.staff_id === staff.id && ['present', 'late', 'early_leave'].includes(a.status)).length;
  const effectiveBase = Number(staff.base_salary || 0) * (staff.employment_status === 'probation' ? 0.85 : 1);
  const luongCong = Math.round(effectiveBase / D * workingDays);
  const phuCap = Number(staff.allowance || 0);
  // Tăng ca: số giờ × (CN:200% | thường:150%) × lương cơ bản/26/8
  const overtime = Math.round(att.filter(a => a.staff_id === staff.id && Number(a.overtime_hours) > 0)
    .reduce((s, a) => s + Number(a.overtime_hours) * (new Date(a.date).getDay() === 0 ? 2 : 1.5) * (Number(staff.base_salary || 0) / D / 8), 0));

  const commissionForRole = (role) => {
    if (role === 'sale_offline') return computeSaleOffline(appts.filter(a => a.sale_id === staff.id && !isRecheck(a)), surg.filter(a => a.sale_id === staff.id)).tongHH;
    if (role === 'telesale') {
      const mine = (a) => a.telesale_id === staff.id || a.telesale_id_2 === staff.id;
      const phones = pages.filter(p => p.telesale_id === staff.id).reduce((x, p) => x + Number(p.total_phones || 0), 0);
      return computeTelesale({ phones, appts: appts.filter(a => mine(a) && !isRecheck(a)), bongRows: bong.filter(mine), cocRows: coc.filter(mine), surgRows: surg.filter(mine) }).tongHH;
    }
    if (role === 'truc_page') return computeTrucPage(pages.filter(p => p.staff_id === staff.id)).hh;
    if (role === 'dieu_duong') return computeDieuDuong(surg, staff.id).tongHH;
    return 0;
  };
  // Thưởng Win clip quảng cáo (cho editor) — cộng vào hoa hồng/thưởng
  const winBonus = contentWins.filter(w => w.editor_id === staff.id).reduce((s, w) => s + Number(w.win_amount || 0), 0);
  const commission = [staff.role, staff.role_2].filter(Boolean).reduce((sum, role) => sum + commissionForRole(role), 0) + winBonus;

  const otherBonus = Number(saved?.other_bonus || 0);
  const otherDeduction = Number(saved?.other_deduction || 0);
  const advance = adv.filter(a => a.staff_id === staff.id).reduce((s, a) => s + Number(a.amount || 0), 0);       // tạm ứng chi (chi hộ) → CỘNG
  const salaryAdvance = salAdv.filter(a => a.staff_id === staff.id).reduce((s, a) => s + Number(a.amount || 0), 0); // ứng lương → TRỪ
  const gross = luongCong + phuCap + commission + overtime + advance + otherBonus;
  const net = gross - salaryAdvance - otherDeduction;

  return {
    base_salary: Number(staff.base_salary || 0), working_days: workingDays, salary_by_attendance: luongCong,
    allowance: phuCap, total_commission: commission, overtime_pay: overtime, unpaid_advance: advance,
    salary_advance: salaryAdvance, other_bonus: otherBonus, other_deduction: otherDeduction,
    gross_income: gross, total_deductions: salaryAdvance + otherDeduction, net_salary: net,
  };
};
