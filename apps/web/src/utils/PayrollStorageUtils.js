
import { getPayrollsFromSupabase, savePayrollRecordToSupabase, softDeletePayrollFromSupabase } from '@/services/dataService.js';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const PAYROLL_KEY = 'monthlyPayrolls';

export const getMonthlyPayrolls = () => {
  try {
    return getStorageItem(PAYROLL_KEY, []);
  } catch {
    return [];
  }
};

export const syncPayrollsWithSupabase = async () => {
  try {
    const local = getMonthlyPayrolls();
    const remote = await getPayrollsFromSupabase();
    
    if (!remote || remote.length === 0) return local;

    const mergedMap = new Map();
    local.forEach(p => mergedMap.set(String(p.id), p));

    remote.forEach(sbRow => {
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

    const mergedArr = Array.from(mergedMap.values());
    setStorageItem(PAYROLL_KEY, mergedArr);
    return mergedArr;
  } catch (error) {
    console.error('syncPayrollsWithSupabase error:', error);
    toast.warning('Không thể đồng bộ bảng lương, dùng dữ liệu trên máy');
    return getMonthlyPayrolls();
  }
};

export const savePayrollToSupabase = async (payroll) => {
  return await savePayrollRecordToSupabase(payroll);
};

export const getMonthlyPayrollsWithSync = async () => {
  if (typeof window !== 'undefined') {
    const merged = await syncPayrollsWithSupabase();
    return merged.filter(p => !p.isDeleted);
  }
  return getMonthlyPayrolls().filter(p => !p.isDeleted);
};

export const getPayrollByMonthAndEmployee = (month, employeeId) => {
  const payrolls = getMonthlyPayrolls();
  const normalizedId = String(employeeId || '').trim().toLowerCase();
  return payrolls.find(p => p.month === month && String(p.employeeId || '').trim().toLowerCase() === normalizedId) || null;
};

export const savePayroll = (payrollData) => {
  const payrolls = getMonthlyPayrolls();
  const newPayroll = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    ...payrollData
  };
  payrolls.push(newPayroll);
  setStorageItem(PAYROLL_KEY, payrolls);
  return newPayroll;
};

export const updatePayroll = (id, updates) => {
  const payrolls = getMonthlyPayrolls();
  const index = payrolls.findIndex(p => p.id === id);
  if (index !== -1) {
    payrolls[index] = { 
      ...payrolls[index], 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    setStorageItem(PAYROLL_KEY, payrolls);
    return payrolls[index];
  }
  return null;
};

export const lockPayroll = (id, lockedByUserId) => {
  return updatePayroll(id, { 
    status: 'locked', 
    lockedAt: new Date().toISOString(),
    lockedBy: lockedByUserId 
  });
};

export const unlockPayroll = (id) => {
  return updatePayroll(id, { 
    status: 'draft', 
    lockedAt: null,
    lockedBy: null 
  });
};

export const lockPayrollInSupabase = async (id, locked = true, lockedByUserId = null) => {
  const updated = locked ? lockPayroll(id, lockedByUserId) : unlockPayroll(id);
  if (updated) {
    await savePayrollToSupabase(updated);
  }
  return updated;
};

export const deletePayroll = (id) => {
  const payrolls = getMonthlyPayrolls();
  const filtered = payrolls.filter(p => p.id !== id);
  setStorageItem(PAYROLL_KEY, filtered);
};

export const deletePayrollFromSupabase = async (payrollId) => {
  const payrolls = getMonthlyPayrolls();
  const idx = payrolls.findIndex(x => x.id === payrollId);
  if (idx !== -1) {
    payrolls[idx].isDeleted = true;
    payrolls[idx].deleted_at = new Date().toISOString();
    setStorageItem(PAYROLL_KEY, payrolls);
  }
  return await softDeletePayrollFromSupabase(payrollId);
};

export const saveOrUpdatePayroll = (employeeId, month, payrollData) => {
  const existing = getPayrollByMonthAndEmployee(month, employeeId);
  if (existing) {
    if (existing.status === 'locked') return existing; // Skip update if locked
    return updatePayroll(existing.id, payrollData);
  } else {
    return savePayroll({ employeeId, month, ...payrollData });
  }
};
