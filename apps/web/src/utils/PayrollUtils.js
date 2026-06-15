
export const calculateDailySalary = (baseSalary, standardWorkDays = 26) => {
  if (!baseSalary || !standardWorkDays) return 0;
  return Number(baseSalary) / standardWorkDays;
};

export const calculateSalaryByAttendance = (baseSalary, paidWorkDays, standardWorkDays = 26) => {
  const daily = calculateDailySalary(baseSalary, standardWorkDays);
  return daily * paidWorkDays;
};

export const calculateProbationSalary = (salaryAmount, isProbation) => {
  return isProbation ? salaryAmount * 0.85 : salaryAmount;
};

export const calculatePageCommission = (phoneCount, ratePerPhone = 20000) => {
  return (Number(phoneCount) || 0) * ratePerPhone;
};

export const calculateTelesaleCommission = (surgeryCount, depositCount, bongCount, revenueAmount) => {
  const surgeryComm = (Number(surgeryCount) || 0) * 500000;
  const depositComm = (Number(depositCount) || 0) * 250000;
  const bongComm = (Number(bongCount) || 0) * 250000;
  const appointmentComm = surgeryComm + depositComm + bongComm;

  let revenueComm = 0;
  const rev = Number(revenueAmount) || 0;
  if (rev > 0 && rev <= 500000000) revenueComm = rev * 0.005;
  else if (rev > 500000000 && rev <= 1000000000) revenueComm = rev * 0.01;
  else if (rev > 1000000000 && rev <= 1500000000) revenueComm = rev * 0.015;
  else if (rev > 1500000000) revenueComm = rev * 0.015; // Max tier

  return { appointmentComm, revenueComm, total: appointmentComm + revenueComm };
};

export const calculateSaleOfflineCommission = (revenueAmount, upsaleAmount) => {
  let revenueComm = 0;
  const rev = Number(revenueAmount) || 0;
  // Sale offline tiers
  if (rev > 0 && rev <= 500000000) revenueComm = rev * 0.01;
  else if (rev > 500000000 && rev <= 1000000000) revenueComm = rev * 0.02;
  else if (rev > 1000000000) revenueComm = rev * 0.03;

  const upsaleComm = (Number(upsaleAmount) || 0) * 0.05; // Flat 5% on upsale

  return { revenueComm, upsaleComm, total: revenueComm + upsaleComm };
};

export const calculateNursingBonus = (role, surgeryGroup) => {
  const isDaiPhau = String(surgeryGroup || '').toUpperCase() === 'ĐẠI PHẪU';
  
  if (role === 'Phụ mổ 1') return isDaiPhau ? 300000 : 150000;
  if (role === 'Phụ mổ 2') return isDaiPhau ? 200000 : 100000;
  if (role === 'Phụ mổ 3') return isDaiPhau ? 100000 : 50000;
  if (role === 'Trực đêm') return isDaiPhau ? 200000 : 150000;
  
  return 0;
};

export const calculateGrossIncome = (fixedSalary, commissions, bonuses, allowances) => {
  return (Number(fixedSalary) || 0) + (Number(commissions) || 0) + (Number(bonuses) || 0) + (Number(allowances) || 0);
};

export const calculateNetSalary = (grossIncome, deductions) => {
  return (Number(grossIncome) || 0) - (Number(deductions) || 0);
};

export const normalizeId = (id) => String(id || '').trim().toLowerCase();

export const filterRecordsByMonth = (records, monthField, targetMonth) => {
  if (!Array.isArray(records)) return [];
  return records.filter(r => {
    const rMonth = r[monthField] ? String(r[monthField]).substring(0, 7) : '';
    return rMonth === targetMonth;
  });
};
