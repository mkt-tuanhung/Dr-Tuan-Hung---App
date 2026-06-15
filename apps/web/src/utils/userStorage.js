
import { 
  getPagePhoneAssignmentsFromSupabase, 
  mergePagePhoneAssignmentsFromSupabase, 
  savePagePhoneAssignmentToSupabase, 
  softDeletePagePhoneAssignmentFromSupabase 
} from '@/services/dataService.js';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const USERS_KEY = 'clinic_users';
const CURRENT_USER_KEY = 'clinic_current_user';
const PAGE_DAILY_REPORTS_KEY = 'pageDailyReports';
const KPI_TARGETS_KEY = 'kpiTargets';
const REVENUE_RECORDS_KEY = 'revenueRecords';
const PAGE_PHONE_ASSIGNMENTS_KEY = 'pagePhoneAssignments';

const defaultUsers = [
  {
    id: '1',
    employeeId: 'admin01',
    password: '12345678',
    fullName: 'Quản trị viên',
    role: 'Admin',
    departmentPosition: '',
    baseSalary: 20000000,
    probationStatus: false,
    allowance: 2000000,
    phone: '0901234567',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    employeeId: 'tele01',
    password: '12345678',
    fullName: 'Nhân viên Telesale',
    role: 'Nhân viên',
    departmentPosition: 'TELESALE',
    baseSalary: 8000000,
    probationStatus: true,
    allowance: 500000,
    phone: '0901234568',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    employeeId: 'sale01',
    password: '12345678',
    fullName: 'Nhân viên Sale Offline',
    role: 'Nhân viên',
    departmentPosition: 'Sale Offline',
    baseSalary: 9000000,
    probationStatus: false,
    allowance: 1000000,
    phone: '0901234569',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    employeeId: 'page01',
    password: '12345678',
    fullName: 'Nhân viên Trực page',
    role: 'Nhân viên',
    departmentPosition: 'Trực page',
    baseSalary: 7000000,
    probationStatus: false,
    allowance: 500000,
    phone: '0901234570',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const normalizeKpiTargets = () => {
  const targets = getStorageItem(KPI_TARGETS_KEY, []);
  let changed = false;
  
  const normalized = targets.map(t => {
    let newType = t.targetType;
    const currentType = (t.targetType || '').trim().toLowerCase();

    if (['telesale', 'tele', 'telesalekpi'].includes(currentType)) {
      newType = 'telesale';
    } else if (['sale offline', 'saleoffline', 'sale_offline'].includes(currentType)) {
      newType = 'sale_offline';
    } else if (['page', 'trực page', 'pagekpi'].includes(currentType)) {
      newType = 'page';
    }

    let newMonth = t.month || '';
    const monthMatch = newMonth.match(/tháng\s+(\d+)\s+năm\s+(\d+)/i);
    if (monthMatch) {
      const m = monthMatch[1].padStart(2, '0');
      const y = monthMatch[2];
      newMonth = `${y}-${m}`;
    }

    const newEmpId = (t.employeeId || '').trim().toLowerCase();

    if (newType !== t.targetType || newMonth !== t.month || newEmpId !== t.employeeId) {
      changed = true;
      return { ...t, targetType: newType, month: newMonth, employeeId: newEmpId };
    }
    return t;
  });
  
  if (changed) {
    setStorageItem(KPI_TARGETS_KEY, normalized);
  }
  return normalized;
};

export const initializeUsers = () => {
  const existingUsers = getStorageItem(USERS_KEY);
  if (!existingUsers) {
    setStorageItem(USERS_KEY, defaultUsers);
  }
  normalizeKpiTargets();
};

export const getUsers = () => {
  const users = getStorageItem(USERS_KEY);
  return users ? users : defaultUsers;
};

export const saveUsers = (users) => {
  setStorageItem(USERS_KEY, users);
};

export const getCurrentUser = () => {
  const user = getStorageItem(CURRENT_USER_KEY);
  return user ? user : null;
};

export const setCurrentUser = (user) => {
  setStorageItem(CURRENT_USER_KEY, user);
};

export const clearCurrentUser = () => {
  removeStorageItem(CURRENT_USER_KEY);
};

// --- KPI Targets Management ---
let isKpiSynced = false;

export const getKpiTargets = () => {
  if (!isKpiSynced && typeof window !== 'undefined') {
    isKpiSynced = true;
    import('@/services/dataService.js').then(mod => {
      if (mod.getKpiTargetsFromSupabase) {
        mod.getKpiTargetsFromSupabase().catch(console.error);
      }
    });
  }
  const targets = normalizeKpiTargets();
  return targets.filter(t => !t.isDeleted);
};

export const saveKpiTarget = (target) => {
  const targets = getStorageItem(KPI_TARGETS_KEY, []);
  const timestamp = new Date().toISOString();
  
  const normalizedEmployeeId = (target.employeeId || '').trim().toLowerCase();
  const normalizedTargetType = (target.targetType || '').trim().toLowerCase();

  const existingIndex = targets.findIndex(
    t => t.employeeId === normalizedEmployeeId && 
         t.month === target.month && 
         t.targetType === normalizedTargetType &&
         !t.isDeleted
  );

  const payload = {
    ...target,
    employeeId: normalizedEmployeeId,
    targetType: normalizedTargetType,
    updatedAt: timestamp
  };

  let savedRecord = null;
  if (existingIndex >= 0) {
    targets[existingIndex] = { ...targets[existingIndex], ...payload };
    savedRecord = targets[existingIndex];
  } else {
    savedRecord = {
      id: crypto.randomUUID(),
      createdAt: timestamp,
      ...payload
    };
    targets.push(savedRecord);
  }
  
  setStorageItem(KPI_TARGETS_KEY, targets);
  
  if (savedRecord) {
    import('@/services/dataService.js').then(mod => {
      if (mod.saveKpiTargetToSupabase) mod.saveKpiTargetToSupabase(savedRecord);
    });
  }
};

export const deleteKpiTarget = (id) => {
  const targets = getStorageItem(KPI_TARGETS_KEY, []);
  const index = targets.findIndex(t => t.id === id);
  if (index !== -1) {
    targets[index] = { ...targets[index], isDeleted: true, deleted_at: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setStorageItem(KPI_TARGETS_KEY, targets);
    
    import('@/services/dataService.js').then(mod => {
      if (mod.softDeleteKpiTargetFromSupabase) mod.softDeleteKpiTargetFromSupabase(id);
    });
  }
};

export const getKpiTargetsByMonth = (month) => {
  return getKpiTargets().filter(t => t.month === month);
};

export const getKpiTargetByEmployeeAndMonth = (employeeId, month) => {
  return getKpiTargets().find(t => t.employeeId === employeeId && t.month === month) || null;
};

export const updateKpiTarget = (id, updates) => {
  const targets = getStorageItem(KPI_TARGETS_KEY, []);
  const index = targets.findIndex(t => t.id === id);
  if (index !== -1) {
    targets[index] = { ...targets[index], ...updates, updatedAt: new Date().toISOString() };
    setStorageItem(KPI_TARGETS_KEY, targets);
    
    import('@/services/dataService.js').then(mod => {
      if (mod.saveKpiTargetToSupabase) mod.saveKpiTargetToSupabase(targets[index]);
    });
  }
};

export const normalizeAllKpiTargets = () => {
  return normalizeKpiTargets();
};

// --- Revenue Records Management ---

export const getRevenueRecords = (includeDeleted = false) => {
  const records = getStorageItem(REVENUE_RECORDS_KEY, []);
  if (includeDeleted) return records;
  return records.filter(r => !r.isDeleted);
};

export const saveRevenueRecords = (records) => {
  setStorageItem(REVENUE_RECORDS_KEY, records);
};

export const mergeRevenueRecords = (localRecords, supabaseRecords) => {
  const mergedMap = new Map();
  
  localRecords.forEach(r => {
    mergedMap.set(String(r.id), r);
  });

  supabaseRecords.forEach(sbRow => {
    const sbRec = { ...sbRow };
    delete sbRec._row;
    
    if (sbRow._row && sbRow._row.deleted_at) {
      sbRec.isDeleted = true;
    }

    const id = String(sbRec.id);
    const existing = mergedMap.get(id);

    if (existing) {
      const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const sbTime = new Date(sbRec.updatedAt || sbRec.createdAt || (sbRow._row && sbRow._row.updated_at) || 0).getTime();
      if (sbTime > localTime) mergedMap.set(id, sbRec);
    } else {
      mergedMap.set(id, sbRec);
    }
  });

  return Array.from(mergedMap.values());
};

export const getRevenueRecordsByMonth = (month, year = null) => {
  const records = getRevenueRecords();
  return records.filter(r => {
    if (!r.revenueDate) return r.month === month;
    if (year) {
      return r.revenueDate.startsWith(`${year}-${month.toString().padStart(2, '0')}`);
    }
    return r.revenueDate.startsWith(month) || r.month === month;
  });
};

export const saveRevenueRecord = (record) => {
  const records = getRevenueRecords(true);
  const newRecord = { 
    id: crypto.randomUUID(), 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString(), 
    ...record 
  };
  records.push(newRecord);
  saveRevenueRecords(records);
  return newRecord;
};

export const updateRevenueRecord = (id, updates) => {
  const records = getRevenueRecords(true);
  const index = records.findIndex(r => r.id === id);
  if (index !== -1) {
    records[index] = { 
      ...records[index], 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    saveRevenueRecords(records);
    return records[index];
  }
  return null;
};

export const deleteRevenueRecord = (id) => {
  const records = getRevenueRecords(true);
  const index = records.findIndex(r => r.id === id);
  if (index !== -1) {
    records[index] = {
      ...records[index],
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveRevenueRecords(records);
    return records[index];
  }
  return null;
};

export const getRevenueRecordsByEmployee = (employeeId, month) => {
  const records = getRevenueRecords();
  return records.filter(r => 
    (r.telesaleEmployeeId === employeeId || r.saleOfflineEmployeeId === employeeId || r.employeeId === employeeId) && 
    (!month || r.month === month)
  );
};

// --- Daily Reports Utils (Trực Page) ---
let isPageDailyReportsSynced = false;

export const getPageDailyReports = (month) => {
  if (!isPageDailyReportsSynced && typeof window !== 'undefined') {
    isPageDailyReportsSynced = true;
    import('@/services/dataService.js').then(mod => {
      if (mod.getPageDailyReportsFromSupabase) {
        mod.getPageDailyReportsFromSupabase().catch(console.error);
      }
    });
  }
  const reports = getStorageItem(PAGE_DAILY_REPORTS_KEY, []).filter(r => !r.isDeleted);
  if (month) return reports.filter(r => r.month === month || (r.date && r.date.startsWith(month)));
  return reports;
};

export const savePageDailyReport = (report) => {
  const reports = getStorageItem(PAGE_DAILY_REPORTS_KEY, []);
  const newReport = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...report };
  reports.push(newReport);
  setStorageItem(PAGE_DAILY_REPORTS_KEY, reports);
  
  import('@/services/dataService.js').then(mod => {
    if (mod.savePageDailyReportToSupabase) mod.savePageDailyReportToSupabase(newReport);
  });
};

export const updatePageDailyReport = (id, updates) => {
  const reports = getStorageItem(PAGE_DAILY_REPORTS_KEY, []);
  const index = reports.findIndex(r => r.id === id);
  if (index !== -1) {
    reports[index] = { ...reports[index], ...updates, updatedAt: new Date().toISOString() };
    setStorageItem(PAGE_DAILY_REPORTS_KEY, reports);
    
    import('@/services/dataService.js').then(mod => {
      if (mod.savePageDailyReportToSupabase) mod.savePageDailyReportToSupabase(reports[index]);
    });
  }
};

export const deletePageDailyReport = (id) => {
  const reports = getStorageItem(PAGE_DAILY_REPORTS_KEY, []);
  const index = reports.findIndex(r => r.id === id);
  if (index !== -1) {
    reports[index] = { ...reports[index], isDeleted: true, deleted_at: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setStorageItem(PAGE_DAILY_REPORTS_KEY, reports);
    
    import('@/services/dataService.js').then(mod => {
      if (mod.softDeletePageDailyReportFromSupabase) mod.softDeletePageDailyReportFromSupabase(id);
    });
  }
};

// --- Page to Telesale Phone Assignments ---
export const getPagePhoneAssignments = () => {
  const assignments = getStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, []);
  return assignments.filter(a => !a.isDeleted);
};

export const savePagePhoneAssignment = async (assignment) => {
  const assignments = getStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, []);
  const payload = { 
    id: assignment.id || crypto.randomUUID(), 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString(), 
    ...assignment 
  };
  assignments.push(payload);
  setStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, assignments);
  
  try {
    await savePagePhoneAssignmentToSupabase(payload);
  } catch (e) {
    console.error('Lỗi đồng bộ chia số', e);
  }
  return payload;
};

export const deletePagePhoneAssignment = async (id) => {
  const assignments = getStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, []);
  const index = assignments.findIndex(a => a.id === id);
  if (index !== -1) {
    assignments[index].isDeleted = true;
    assignments[index].deleted_at = new Date().toISOString();
    assignments[index].updatedAt = new Date().toISOString();
    setStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, assignments);
    
    try {
      await softDeletePagePhoneAssignmentFromSupabase(id);
    } catch (e) {
      console.error('Lỗi xóa chia số', e);
    }
  }
};

export const updatePagePhoneAssignment = async (id, updates) => {
  const assignments = getStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, []);
  const index = assignments.findIndex(a => a.id === id);
  if (index !== -1) {
    assignments[index] = { ...assignments[index], ...updates, updatedAt: new Date().toISOString() };
    setStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, assignments);
    
    try {
      await savePagePhoneAssignmentToSupabase(assignments[index]);
    } catch (e) {
      console.error('Lỗi cập nhật chia số', e);
    }
  }
};

export const mergePagePhoneAssignmentsWithSupabase = async () => {
  try {
    const local = getStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, []);
    const sbRecords = await getPagePhoneAssignmentsFromSupabase();
    const merged = mergePagePhoneAssignmentsFromSupabase(local, sbRecords);
    setStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, merged);
    return merged;
  } catch (error) {
    console.error('Error merging page phone assignments:', error);
    toast.error('Lỗi đồng bộ chia số trực page');
    return getStorageItem(PAGE_PHONE_ASSIGNMENTS_KEY, []);
  }
};

// --- Customer Appointments ---
export const CUSTOMER_APPOINTMENTS_KEY = 'customerAppointments';
export const getCustomerAppointments = () => {
  return getStorageItem(CUSTOMER_APPOINTMENTS_KEY, []);
};
