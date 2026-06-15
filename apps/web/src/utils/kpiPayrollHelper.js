
export const normalize = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

export const matchId = (val, userOrTarget) => {
  if (!val || !userOrTarget) return false;
  const nVal = normalize(val);
  return nVal === normalize(userOrTarget.employeeId) || nVal === normalize(userOrTarget.id);
};

export const getMonth = (record) => {
  if (!record) return '';
  const dateStr = record.month || record.date || record.createdAt || record.appointmentDate || record.revenueDate || '';
  return String(dateStr).substring(0, 7);
};

export const getStatus = (record) => {
  if (!record) return '';
  return normalize(record.evaluationStatus || record.status);
};

export const isSurgery = (record) => {
  const s = getStatus(record);
  return ['surgery', 'phẫu thuật', 'phau thuat'].includes(s);
};

export const isDeposit = (record) => {
  const s = getStatus(record);
  return ['deposit', 'cọc', 'coc'].includes(s);
};

export const isBong = (record) => {
  const s = getStatus(record);
  return ['bong', 'bóng'].includes(s);
};

export const calculateKpiProgress = (actual, target) => {
  const t = Number(target);
  return t > 0 ? (Number(actual) / t) * 100 : 0;
};

export const getKpiSeverity = (progress) => {
  if (progress < 50) return { label: 'Chưa đạt', className: 'bg-rose-100 text-rose-700 border-rose-200', color: '#f43f5e' };
  if (progress < 80) return { label: 'Cần cải thiện', className: 'bg-amber-100 text-amber-700 border-amber-200', color: '#f59e0b' };
  if (progress < 100) return { label: 'Gần đạt', className: 'bg-blue-100 text-blue-700 border-blue-200', color: '#3b82f6' };
  if (progress < 120) return { label: 'Đạt KPI', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', color: '#10b981' };
  return { label: 'Vượt KPI', className: 'bg-purple-100 text-purple-700 border-purple-200', color: '#8b5cf6' };
};

export const getRevenueAmount = (record) => {
  return Number(record.revenueAmount || record.surgeryRevenue || record.amount || record.revenue || record.totalRevenue) || 0;
};

export const getUpsaleAmount = (record) => {
  return Number(record.upsaleRevenue || record.upsaleAmount || record.revenueUpsale) || 0;
};

export const calculateSaleOfflineKPI = (user, month, appointments, revenues) => {
  const myApps = appointments.filter(a => matchId(a.saleOfflineEmployeeId, user) && getMonth(a) === month);
  let surgeryCount = 0, depositCount = 0, bongCount = 0;

  myApps.forEach(a => {
    if (isSurgery(a)) surgeryCount++;
    else if (isDeposit(a)) depositCount++;
    else if (isBong(a)) bongCount++;
  });

  const totalAppointments = myApps.length;
  const actualCloseRate = totalAppointments > 0 ? ((surgeryCount + depositCount) / totalAppointments) * 100 : 0;

  const myRevenues = revenues.filter(r => matchId(r.saleOfflineEmployeeId, user) && getMonth(r) === month);

  let totalRevenue = 0;
  let totalUpsale = 0;

  myRevenues.forEach(r => {
    totalRevenue += getRevenueAmount(r);
    totalUpsale += getUpsaleAmount(r);
  });

  let revenueCommissionRate = 0;
  if (totalRevenue > 0 && totalRevenue < 500000000) revenueCommissionRate = 0.01;
  else if (totalRevenue >= 500000000 && totalRevenue < 1000000000) revenueCommissionRate = 0.015;
  else if (totalRevenue >= 1000000000) revenueCommissionRate = 0.02;

  const saleOfflineRevenueCommission = totalRevenue * revenueCommissionRate;
  const saleOfflineUpsaleCommission = totalUpsale * 0.03;
  const saleOfflineCommissionTotal = saleOfflineRevenueCommission + saleOfflineUpsaleCommission;

  return {
    totalAppointments,
    surgeryCount,
    depositCount,
    bongCount,
    actualCloseRate,
    totalRevenue,
    totalUpsale,
    saleOfflineRevenueCommission,
    saleOfflineUpsaleCommission,
    saleOfflineCommissionTotal,
    revenueCommissionRate,
    myAppointments: myApps,
    myRevenues
  };
};

export const calculateSaleOfflineKPIForAdmin = calculateSaleOfflineKPI; // Alias for backward compatibility if needed by other components
