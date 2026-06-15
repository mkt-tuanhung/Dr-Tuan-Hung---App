
import { getRevenueRecordsByEmployee, getPagePhoneAssignments } from './userStorage.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

export const CUSTOMER_APPOINTMENTS_KEY = 'customerAppointments';
export const TELESALE_DAILY_REPORTS_KEY = 'telesaleDailyReports';

// --- Telesale Daily Reports CRUD ---
export const getTelesaleDailyReports = () => {
  return getStorageItem(TELESALE_DAILY_REPORTS_KEY, []);
};

export const saveTelesaleDailyReport = (report) => {
  const reports = getTelesaleDailyReports();
  reports.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...report
  });
  setStorageItem(TELESALE_DAILY_REPORTS_KEY, reports);
};

export const updateTelesaleDailyReport = (id, updates) => {
  const reports = getTelesaleDailyReports();
  const index = reports.findIndex(r => r.id === id);
  if (index !== -1) {
    reports[index] = { ...reports[index], ...updates, updatedAt: new Date().toISOString() };
    setStorageItem(TELESALE_DAILY_REPORTS_KEY, reports);
  }
};

export const deleteTelesaleDailyReport = (id) => {
  const reports = getTelesaleDailyReports();
  setStorageItem(TELESALE_DAILY_REPORTS_KEY, reports.filter(r => r.id !== id));
};

// --- Customer Appointments CRUD ---
export const getCustomerAppointments = () => {
  return getStorageItem(CUSTOMER_APPOINTMENTS_KEY, []);
};

export const saveCustomerAppointment = (appointment) => {
  const appointments = getCustomerAppointments();
  appointments.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...appointment
  });
  setStorageItem(CUSTOMER_APPOINTMENTS_KEY, appointments);
};

export const updateCustomerAppointment = (id, updates) => {
  const appointments = getCustomerAppointments();
  const index = appointments.findIndex(a => a.id === id);
  if (index !== -1) {
    appointments[index] = { ...appointments[index], ...updates, updatedAt: new Date().toISOString() };
    setStorageItem(CUSTOMER_APPOINTMENTS_KEY, appointments);
  }
};

export const deleteCustomerAppointment = (id) => {
  const appointments = getCustomerAppointments();
  setStorageItem(CUSTOMER_APPOINTMENTS_KEY, appointments.filter(a => a.id !== id));
};

// --- Page to Telesale Phone Assignments ---
export const getPagePhoneAssignmentsForTelesale = (telesaleEmployeeId, month) => {
  if (!telesaleEmployeeId) return [];
  const normalizedId = telesaleEmployeeId.trim().toLowerCase();
  return getPagePhoneAssignments().filter(a => 
    a.telesaleEmployeeId?.trim().toLowerCase() === normalizedId && 
    (!month || a.month === month)
  );
};

export const calculateTotalPhonesReceivedFromPageAssignments = (telesaleEmployeeId, month) => {
  const assignments = getPagePhoneAssignmentsForTelesale(telesaleEmployeeId, month);
  return assignments.reduce((sum, a) => sum + (Number(a.phoneCount) || 0), 0);
};

export const getAppointmentsForTelesale = (telesaleEmployeeId, month) => {
  if (!telesaleEmployeeId) return [];
  const normalizedId = telesaleEmployeeId.trim().toLowerCase();
  return getCustomerAppointments().filter(a => 
    a.telesaleEmployeeId?.trim().toLowerCase() === normalizedId && 
    (!month || a.month === month)
  );
};

// --- KPI Calculations ---
export const calculateCloseRate = (totalAppointments, totalPhones) => {
  if (!totalPhones || totalPhones === 0) return 0;
  return (totalAppointments / totalPhones) * 100;
};

export const calculateTelesaleRevenue = (employeeId, month) => {
  const records = getRevenueRecordsByEmployee(employeeId, month);
  return records
    .filter(r => r.telesaleEmployeeId?.trim().toLowerCase() === employeeId?.trim().toLowerCase())
    .reduce((sum, r) => sum + (Number(r.revenueAmount) || Number(r.amount) || 0), 0);
};

export const calculateCommissionRevenue = (revenue) => {
  if (revenue < 500000000) return revenue * 0.005;
  if (revenue < 1000000000) return revenue * 0.01;
  if (revenue < 1500000000) return revenue * 0.015;
  return revenue * 0.015;
};

export const calculateCommissionAppointments = (appointmentsArray) => {
  if (!appointmentsArray || !Array.isArray(appointmentsArray)) return 0;
  
  return appointmentsArray.reduce((sum, app) => {
    const status = (app.status || '').toLowerCase();
    if (status === 'surgery' || status === 'phẫu thuật') {
      return sum + 500000;
    }
    if (status === 'deposit' || status === 'cọc') {
      return sum + 250000;
    }
    if (status === 'bong' || status === 'bỏng') {
      return sum + 250000;
    }
    return sum;
  }, 0);
};

export const calculateTotalCommission = (revenueCommission, appointmentCommission) => {
  return revenueCommission + appointmentCommission;
};

export const calculateTelesaleCommission = (customerAppointments, revenueRecords, telesaleEmployeeId, month) => {
  const normalizedId = telesaleEmployeeId?.trim().toLowerCase();
  
  const apps = customerAppointments.filter(a => 
    a.telesaleEmployeeId?.trim().toLowerCase() === normalizedId && 
    (!month || a.month === month)
  );
  
  const revs = revenueRecords.filter(r => 
    r.telesaleEmployeeId?.trim().toLowerCase() === normalizedId && 
    (!month || r.month === month)
  );

  const appointmentCommission = calculateCommissionAppointments(apps);
  
  const totalRev = revs.reduce((sum, r) => sum + (Number(r.revenueAmount) || Number(r.amount) || 0), 0);
  const revenueCommission = calculateCommissionRevenue(totalRev);

  return {
    appointmentCommission,
    revenueCommission,
    totalCommission: appointmentCommission + revenueCommission
  };
};
