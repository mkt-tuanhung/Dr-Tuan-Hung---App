import { normalize, matchId, getMonth, isSurgery, isDeposit, isBong, calculateSaleOfflineKPI } from '@/utils/kpiPayrollHelper.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

export const safeParse = (key) => {
  try {
    return getStorageItem(key, []);
  } catch (e) {
    return [];
  }
};

export const getUserIdentityValues = (user) => {
  if (!user) return [];
  return [normalize(user.id), normalize(user.employeeId)].filter(Boolean);
};

export const calculateAttendanceData = (user, month) => {
  const records = safeParse('attendanceRecords');
  const monthRecords = records.filter(r => 
    matchId(r.employeeId, user) && 
    getMonth(r) === month
  );

  let paidWorkDays = 0;
  let checkInDays = 0;
  let leaveDays = 0;
  let lateEarlyCount = 0;

  monthRecords.forEach(r => {
    const s = normalize(r.status);
    let w = Number(r.workUnit);
    
    // Priority to workUnit, otherwise use defaults
    if (isNaN(w)) {
      if (['present', 'late', 'early_leave'].includes(s)) w = 1;
      else if (['half_day', 'leave_morning', 'leave_afternoon'].includes(s)) w = 0.5;
      else w = 0; // absent, leave_full
    }

    paidWorkDays += w;

    if (['present', 'late', 'early_leave'].includes(s)) checkInDays++;
    if (['leave_full', 'leave_morning', 'leave_afternoon'].includes(s)) leaveDays++;
    if (['late', 'early_leave'].includes(s)) lateEarlyCount++;
  });

  return { 
    paidWorkDays, 
    checkInDays, 
    leaveDays, 
    lateEarlyCount, 
    recordCount: monthRecords.length 
  };
};

export const calculateBaseSalary = (baseSalary, paidWorkDays, allowance) => {
  const salaryPerDay = (Number(baseSalary) || 0) / 26;
  const salaryByAttendance = Math.round(salaryPerDay * paidWorkDays);
  const fixedSalary = Math.round(salaryByAttendance + (Number(allowance) || 0));
  return { salaryPerDay, salaryByAttendance, fixedSalary };
};

export const calculatePageCommission = (user, month) => {
  const records = safeParse('pageDailyReports');
  const monthRecords = records.filter(r => 
    matchId(r.employeeId, user) && 
    getMonth(r) === month
  );
  
  const totalPhones = monthRecords.reduce((sum, r) => sum + (Number(r.totalPhones || r.phoneCount || r.phones || r.totalPhoneCount) || 0), 0);
  const commission = Math.round(totalPhones * 20000);
  
  return { totalPhones, commission };
};

export const calculateTelesaleCommission = (user, month) => {
  const appointments = safeParse('customerAppointments').filter(a => 
    matchId(a.telesaleEmployeeId, user) && getMonth(a) === month
  );
  
  let surgeryCount = 0, depositCount = 0, bongCount = 0;
  appointments.forEach(a => {
    if (isSurgery(a)) surgeryCount++;
    else if (isDeposit(a)) depositCount++;
    else if (isBong(a)) bongCount++;
  });

  const telesaleAppointmentCommission = Math.round((surgeryCount * 500000) + (depositCount * 250000) + (bongCount * 250000));

  const revenues = safeParse('revenueRecords').filter(r => 
    matchId(r.telesaleEmployeeId, user) && getMonth(r) === month
  );
  
  const totalRevenue = revenues.reduce((sum, r) => sum + (Number(r.revenueAmount || r.surgeryRevenue || r.amount || r.revenue) || 0), 0);

  let telesaleRevenueCommission = 0;
  if (totalRevenue > 0 && totalRevenue < 500000000) telesaleRevenueCommission = totalRevenue * 0.005;
  else if (totalRevenue >= 500000000 && totalRevenue < 1000000000) telesaleRevenueCommission = totalRevenue * 0.01;
  else if (totalRevenue >= 1000000000 && totalRevenue < 1500000000) telesaleRevenueCommission = totalRevenue * 0.015;
  else if (totalRevenue >= 1500000000) telesaleRevenueCommission = totalRevenue * 0.015;

  telesaleRevenueCommission = Math.round(telesaleRevenueCommission);

  return {
    surgeryCount, depositCount, bongCount, totalRevenue,
    telesaleAppointmentCommission,
    telesaleRevenueCommission,
    total: telesaleAppointmentCommission + telesaleRevenueCommission
  };
};

export const calculateSaleOfflineCommission = (user, month) => {
  const appointments = safeParse('customerAppointments');
  const revenues = safeParse('revenueRecords');
  
  const data = calculateSaleOfflineKPI(user, month, appointments, revenues);
  
  return {
    totalRevenue: data.totalRevenue,
    totalUpsale: data.totalUpsale,
    saleOfflineRevenueCommission: data.saleOfflineRevenueCommission,
    saleOfflineUpsaleCommission: data.saleOfflineUpsaleCommission,
    saleOfflineCommissionTotal: data.saleOfflineCommissionTotal,
    saleOfflineRevenueAmount: data.totalRevenue,
    saleOfflineUpsaleAmount: data.totalUpsale,
    total: data.saleOfflineCommissionTotal
  };
};

export const calculateNursingBonus = (user, month) => {
  const assignments = safeParse('surgicalCareAssignments').filter(a => 
    getMonth(a) === month
  );

  let scrub1Count = 0, scrub2Count = 0, scrub3Count = 0, nightCount = 0;
  let scrub1Bonus = 0, scrub2Bonus = 0, scrub3Bonus = 0, nursingNightShiftBonus = 0;
  
  assignments.forEach(a => {
    const isMajor = normalize(a.surgeryGroup) === 'đại phẫu';
    
    const isScrub1 = matchId(a.scrubNurse1EmployeeId, user);
    const isScrub2 = matchId(a.scrubNurse2EmployeeId, user);
    const isScrub3 = matchId(a.scrubNurse3EmployeeId, user);
    
    const isNight = Array.isArray(a.nightNurseEmployeeIds) && 
                    a.nightNurseEmployeeIds.some(id => matchId(id, user));

    if (isScrub1) {
      scrub1Count++;
      scrub1Bonus += isMajor ? 500000 : 300000;
    }
    if (isScrub2) {
      scrub2Count++;
      scrub2Bonus += isMajor ? 250000 : 150000;
    }
    if (isScrub3) {
      scrub3Count++;
      scrub3Bonus += isMajor ? 150000 : 100000;
    }
    if (isNight) {
      nightCount++;
      nursingNightShiftBonus += 500000;
    }
  });

  const nursingSurgeryAssistantBonus = scrub1Bonus + scrub2Bonus + scrub3Bonus;

  return {
    scrub1Count, scrub2Count, scrub3Count, nightCount,
    scrub1Bonus, scrub2Bonus, scrub3Bonus,
    nursingSurgeryAssistantBonus,
    nursingNightShiftBonus,
    total: nursingSurgeryAssistantBonus + nursingNightShiftBonus
  };
};

export const generatePayrollForUser = (user, month) => {
  const attData = calculateAttendanceData(user, month);
  const salaryData = calculateBaseSalary(user.baseSalary, attData.paidWorkDays, user.allowance);
  
  const position = normalize(user.departmentPosition || user.role);

  let pageData = { totalPhones: 0, commission: 0 };
  let teleData = { surgeryCount: 0, depositCount: 0, bongCount: 0, totalRevenue: 0, telesaleAppointmentCommission: 0, telesaleRevenueCommission: 0, total: 0 };
  let saleData = { totalRevenue: 0, totalUpsale: 0, saleOfflineRevenueCommission: 0, saleOfflineUpsaleCommission: 0, saleOfflineCommissionTotal: 0, total: 0 };
  let nursingData = { scrub1Count: 0, scrub2Count: 0, scrub3Count: 0, nightCount: 0, scrub1Bonus: 0, scrub2Bonus: 0, scrub3Bonus: 0, nursingSurgeryAssistantBonus: 0, nursingNightShiftBonus: 0, total: 0 };

  let pageCommission = 0;
  
  let telesaleRevenueAmount = 0;
  let telesaleAppointmentCommission = 0;
  let telesaleRevenueCommission = 0;
  
  let saleOfflineRevenueAmount = 0;
  let saleOfflineUpsaleAmount = 0;
  let saleOfflineRevenueCommission = 0;
  let saleOfflineUpsaleCommission = 0;
  let saleOfflineCommissionTotal = 0;
  
  let nursingSurgeryAssistantBonus = 0;
  let nursingNightShiftBonus = 0;

  if (position.includes('trực page') || position.includes('truc page') || position.includes('page')) {
    pageData = calculatePageCommission(user, month);
    pageCommission = pageData.commission;
  }
  if (position.includes('telesale') || position.includes('tele')) {
    teleData = calculateTelesaleCommission(user, month);
    telesaleRevenueAmount = teleData.totalRevenue;
    telesaleAppointmentCommission = teleData.telesaleAppointmentCommission;
    telesaleRevenueCommission = teleData.telesaleRevenueCommission;
  } else if (position.includes('sale offline') || position.includes('sale')) {
    saleData = calculateSaleOfflineCommission(user, month);
    saleOfflineRevenueAmount = saleData.totalRevenue;
    saleOfflineUpsaleAmount = saleData.totalUpsale;
    saleOfflineRevenueCommission = saleData.saleOfflineRevenueCommission;
    saleOfflineUpsaleCommission = saleData.saleOfflineUpsaleCommission;
    saleOfflineCommissionTotal = saleData.saleOfflineCommissionTotal;
  }
  if (position.includes('điều dưỡng') || position.includes('dieu duong') || position.includes('nursing')) {
    nursingData = calculateNursingBonus(user, month);
    nursingSurgeryAssistantBonus = nursingData.nursingSurgeryAssistantBonus;
    nursingNightShiftBonus = nursingData.nursingNightShiftBonus;
  }

  const totalCommission = Math.round(
    pageCommission + 
    telesaleAppointmentCommission + 
    telesaleRevenueCommission + 
    saleOfflineCommissionTotal + 
    nursingSurgeryAssistantBonus + 
    nursingNightShiftBonus
  );

  const existingPayrolls = safeParse('monthlyPayrolls');
  const existing = existingPayrolls.find(p => p.month === month && matchId(p.employeeId, user));
  
  const otherBonus = existing ? Math.round(Number(existing.otherBonus) || 0) : 0;
  const unpaidAdvance = existing ? Math.round(Number(existing.unpaidAdvance) || 0) : 0;
  const otherDeduction = existing ? Math.round(Number(existing.otherDeduction) || 0) : 0;
  const note = existing ? existing.note : '';

  const grossIncome = Math.round(salaryData.fixedSalary + totalCommission + otherBonus);
  const totalDeductions = Math.round(unpaidAdvance + otherDeduction);
  const netSalary = Math.round(grossIncome - totalDeductions);

  return {
    id: existing?.id || crypto.randomUUID(),
    month,
    employeeId: user.employeeId || user.id,
    fullName: user.fullName,
    position: user.departmentPosition || user.role,
    baseSalary: Number(user.baseSalary) || 0,
    allowance: Number(user.allowance) || 0,
    standardWorkDays: 26,
    paidWorkDays: attData.paidWorkDays,
    checkInDays: attData.checkInDays,
    leaveDays: attData.leaveDays,
    lateEarlyCount: attData.lateEarlyCount,
    salaryByAttendance: salaryData.salaryByAttendance,
    fixedSalary: salaryData.fixedSalary, 
    
    pageTotalPhones: pageData.totalPhones,
    pageCommission,

    telesaleSurgeryCount: teleData.surgeryCount,
    telesaleDepositCount: teleData.depositCount,
    telesaleBongCount: teleData.bongCount,
    telesaleRevenueAmount,
    telesaleAppointmentCommission,
    telesaleRevenueCommission,
    
    saleOfflineRevenueAmount,
    saleOfflineUpsaleAmount,
    saleOfflineRevenueCommission,
    saleOfflineUpsaleCommission,
    saleOfflineCommissionTotal,
    
    nursingScrub1Count: nursingData.scrub1Count,
    nursingScrub2Count: nursingData.scrub2Count,
    nursingScrub3Count: nursingData.scrub3Count,
    nursingNightShiftCount: nursingData.nightCount,
    nursingScrub1Bonus: nursingData.scrub1Bonus,
    nursingScrub2Bonus: nursingData.scrub2Bonus,
    nursingScrub3Bonus: nursingData.scrub3Bonus,
    nursingSurgeryAssistantBonus,
    nursingNightShiftBonus,
    nursingBonusTotal: nursingSurgeryAssistantBonus + nursingNightShiftBonus,

    totalCommission,
    otherBonus,
    unpaidAdvance,
    otherDeduction,
    grossIncome,
    totalDeductions,
    netSalary,
    note,
    status: existing?.status || 'draft',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lockedAt: existing?.lockedAt || null,
    lockedBy: existing?.lockedBy || null
  };
};

export const saveOrUpdatePayroll = (payrollData) => {
  const payrolls = safeParse('monthlyPayrolls');
  const existingIndex = payrolls.findIndex(p => p.month === payrollData.month && matchId(p.employeeId, { employeeId: payrollData.employeeId }));
  
  if (existingIndex >= 0) {
    if (payrolls[existingIndex].status === 'locked') return payrolls[existingIndex];
    payrolls[existingIndex] = { ...payrolls[existingIndex], ...payrollData, updatedAt: new Date().toISOString() };
  } else {
    payrolls.push(payrollData);
  }
  
  setStorageItem('monthlyPayrolls', payrolls);
  return payrollData;
};

export const calculateMonthlyPayrollAllUsers = (month) => {
  const users = safeParse('clinic_users').filter(u => {
    const s = normalize(u.status);
    return s === 'active' || s === 'đang làm' || s === 'dang lam';
  });
  
  let generatedCount = 0;

  users.forEach(user => {
    if (!user.employeeId && !user.id) return;
    const payrollData = generatePayrollForUser(user, month);
    saveOrUpdatePayroll(payrollData);
    generatedCount++;
  });

  return generatedCount;
};

// Task 3: New Auto Recalculation Logic
export const calculateMonthlyPayrollAllUsersForMonth = (month, year) => {
  const monthStr = year ? `${year}-${String(month).padStart(2, '0')}` : month;
  
  const users = safeParse('clinic_users').filter(u => {
    const s = normalize(u.status);
    return s === 'active' || s === 'đang làm' || s === 'dang lam';
  });

  let updatedPayrolls = [];
  const allPayrolls = safeParse('monthlyPayrolls');

  users.forEach(user => {
    if (!user.employeeId && !user.id) return;
    
    // Check if locked
    const existing = allPayrolls.find(p => p.month === monthStr && matchId(p.employeeId, user));
    if (existing && existing.status === 'locked') {
      return; // Skip locked payrolls
    }

    const payrollData = generatePayrollForUser(user, monthStr);
    const saved = saveOrUpdatePayroll(payrollData);
    updatedPayrolls.push(saved);
  });

  return updatedPayrolls;
};
