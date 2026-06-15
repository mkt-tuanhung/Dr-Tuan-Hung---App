import { supabase } from '@/services/supabaseClient.js';
import { toast } from 'sonner';
import { createApprovalNotificationIfNotExists, updateApprovalNotificationStatus, getApprovalNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { getStorageItem, setStorageItem } from '@/utils/storageStore.js';

export const CLAIMS_KEY = 'staffExpenseClaims';

export const getClaims = () => {
  const data = getStorageItem(CLAIMS_KEY);
  if (!data) {
    setStorageItem(CLAIMS_KEY, []);
    return [];
  }
  return data;
};

export const getActiveTransactions = () => {
  return getClaims().filter(c => !c.isDeleted);
};

export const getDeletedTransactions = () => {
  return getClaims().filter(c => c.isDeleted);
};

export const getReimbursementsForClaim = (claimId) => {
  const claims = getActiveTransactions();
  return claims.filter(c => c.transactionType === 'reimbursement' && c.sourceClaimId === claimId && c.status !== 'rejected');
};

export const calculateRemainingAmount = (claimId) => {
  const claims = getActiveTransactions();
  const claim = claims.find(c => c.id === claimId);
  if (!claim || claim.transactionType !== 'advance_expense') return 0;
  
  const reimbursements = getReimbursementsForClaim(claimId);
  const totalReimbursed = reimbursements.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  
  return Math.max(0, (Number(claim.amount) || 0) - totalReimbursed);
};

export const getAvailableClaimsForReimbursement = () => {
  const claims = getActiveTransactions();
  return claims
    .filter(c => c.transactionType === 'advance_expense' && c.status !== 'rejected')
    .map(c => ({
      ...c,
      remainingAmount: calculateRemainingAmount(c.id)
    }))
    .filter(c => c.remainingAmount > 0);
};

export const getClaimsByMonth = (month) => {
  const claims = getActiveTransactions();
  if (!month) return claims;
  return claims.filter(c => c.expenseDate && c.expenseDate.startsWith(month));
};

export const getClaimsByEmployee = (employeeId) => {
  const claims = getActiveTransactions();
  return claims.filter(c => String(c.employeeId) === String(employeeId));
};

export const getClaimsByStatus = (status) => {
  const claims = getActiveTransactions();
  return claims.filter(c => c.status === status);
};

export const saveNewClaim = (claimData) => {
  const claims = getClaims();
  const timestamp = new Date().toISOString();
  const newClaim = {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: claimData.status || 'pending',
    attachments: [],
    isDeleted: false,
    ...claimData
  };
  claims.push(newClaim);
  setStorageItem(CLAIMS_KEY, claims);

  createApprovalNotificationIfNotExists(
    newClaim.id,
    'staff_expense_claims',
    'expense_claim',
    'Tạm ứng chi mới',
    `${newClaim.employeeName} yêu cầu tạm ứng ${Number(newClaim.amount).toLocaleString('vi-VN')}đ cho ${newClaim.category}.`,
    newClaim.employeeId,
    newClaim.employeeName,
    ['Admin', 'Kế toán']
  );

  return newClaim;
};

export const updateClaim = (id, updates) => {
  const claims = getClaims();
  const index = claims.findIndex(c => c.id === id);
  if (index !== -1) {
    let updatedClaim = { ...claims[index], ...updates, updatedAt: new Date().toISOString() };
    
    if (updatedClaim.transactionType === 'advance_expense' && updatedClaim.status !== 'rejected' && !updatedClaim.isDeleted) {
      const reimbursements = claims.filter(c => c.transactionType === 'reimbursement' && c.sourceClaimId === id && c.status !== 'rejected' && !c.isDeleted);
      const totalReimbursed = reimbursements.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const remaining = Math.max(0, (Number(updatedClaim.amount) || 0) - totalReimbursed);
      
      if (remaining === 0) {
        updatedClaim.status = 'reimbursed';
      } else if (remaining > 0 && remaining < updatedClaim.amount) {
        updatedClaim.status = 'partially_reimbursed';
      } else if (remaining === updatedClaim.amount && (updatedClaim.status === 'reimbursed' || updatedClaim.status === 'partially_reimbursed')) {
        updatedClaim.status = 'approved';
      }
    }

    claims[index] = updatedClaim;
    setStorageItem(CLAIMS_KEY, claims);

    if (updatedClaim.status === 'approved' || updatedClaim.status === 'rejected') {
      const notifications = getApprovalNotifications();
      const notification = notifications.find(n => n.relatedId === id && n.type === 'expense_claim');
      if (notification) {
        updateApprovalNotificationStatus(notification.id, updatedClaim.status, updatedClaim.approvedBy || updatedClaim.updatedBy || 'System', new Date().toISOString());
      }
    }

    return claims[index];
  }
  return null;
};

export const deleteClaim = (id) => {
  const claims = getClaims();
  const filtered = claims.filter(c => c.id !== id && c.sourceClaimId !== id);
  setStorageItem(CLAIMS_KEY, filtered);
  
  const deletedClaim = claims.find(c => c.id === id);
  if (deletedClaim && deletedClaim.transactionType === 'reimbursement' && deletedClaim.sourceClaimId) {
    updateClaim(deletedClaim.sourceClaimId, {}); 
  }
};

export const markTransactionAsDeleted = (id, reason, deletedBy) => {
  const claims = getClaims();
  const index = claims.findIndex(c => c.id === id);
  if (index !== -1) {
    claims[index] = {
      ...claims[index],
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: deletedBy,
      deleteReason: reason || '',
      updatedAt: new Date().toISOString()
    };
    setStorageItem(CLAIMS_KEY, claims);

    if (claims[index].transactionType === 'reimbursement' && claims[index].sourceClaimId) {
      updateClaim(claims[index].sourceClaimId, {});
    }
    return true;
  }
  return false;
};

export const restoreTransaction = (id, restoredBy) => {
  const claims = getClaims();
  const index = claims.findIndex(c => c.id === id);
  if (index !== -1) {
    claims[index] = {
      ...claims[index],
      isDeleted: false,
      restoredAt: new Date().toISOString(),
      restoredBy: restoredBy,
      updatedAt: new Date().toISOString()
    };
    setStorageItem(CLAIMS_KEY, claims);

    if (claims[index].transactionType === 'reimbursement' && claims[index].sourceClaimId) {
      updateClaim(claims[index].sourceClaimId, {});
    }
    return true;
  }
  return false;
};

export const clearOldTransactionData = (deletedBy) => {
  const claims = getClaims();
  const updatedClaims = claims.map(c => {
    if (!c.isDeleted) {
      return {
        ...c,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy,
        deleteReason: 'Dọn dữ liệu cũ',
        updatedAt: new Date().toISOString()
      };
    }
    return c;
  });
  setStorageItem(CLAIMS_KEY, updatedClaims);
  return true;
};

export const updateClaimStatus = (claimId, newStatus, approverInfo = {}) => {
  return updateClaim(claimId, {
    status: newStatus,
    ...approverInfo
  });
};

export const createReimbursementRecord = (data) => {
  const { sourceClaimId, employeeId, employeeName, departmentPosition, amount, expenseDate, paymentMethod, note, attachments, paidBy } = data;
  
  if (!sourceClaimId) throw new Error('Thiếu thông tin phiếu tạm ứng gốc');
  
  const remaining = calculateRemainingAmount(sourceClaimId);
  if (amount > remaining) {
    throw new Error(`Số tiền hoàn ứng (${amount}) không được vượt quá số còn thiếu (${remaining})`);
  }

  const claims = getClaims();
  const timestamp = new Date().toISOString();
  const newRecord = {
    id: crypto.randomUUID(),
    sourceClaimId,
    employeeId,
    employeeName,
    departmentPosition,
    transactionType: 'reimbursement',
    expenseDate,
    category: 'Hoàn ứng',
    amount: Number(amount),
    description: 'Ghi nhận hoàn ứng',
    supplierName: '',
    paymentMethod,
    note,
    attachments: attachments || [],
    status: 'paid',
    paidBy,
    paidAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    isDeleted: false
  };
  
  claims.push(newRecord);
  setStorageItem(CLAIMS_KEY, claims);
  
  updateClaim(sourceClaimId, {});
  
  return newRecord;
};

export const getEmployeeSummary = (employeeId) => {
  const claims = getClaimsByEmployee(employeeId);
  let totalAdvance = 0;
  let totalReimbursement = 0;
  let remaining = 0;
  let claimCount = 0;

  claims.forEach(claim => {
    if (claim.status !== 'rejected') {
      claimCount++;
      if (claim.transactionType === 'advance_expense') {
        totalAdvance += Number(claim.amount) || 0;
        remaining += calculateRemainingAmount(claim.id);
      } else if (claim.transactionType === 'reimbursement') {
        totalReimbursement += Number(claim.amount) || 0;
      }
    }
  });

  return {
    employeeId,
    totalAdvance,
    totalReimbursement,
    remaining: Math.max(0, remaining),
    claimCount
  };
};

export const getAllEmployeeSummaries = () => {
  const claims = getActiveTransactions();
  const summaries = {};

  claims.forEach(claim => {
    if (claim.status === 'rejected') return;

    if (!summaries[claim.employeeId]) {
      summaries[claim.employeeId] = {
        employeeId: claim.employeeId,
        employeeName: claim.employeeName,
        departmentPosition: claim.departmentPosition,
        totalAdvance: 0,
        totalReimbursement: 0,
        remaining: 0,
        claimCount: 0
      };
    }

    summaries[claim.employeeId].claimCount++;
    if (claim.transactionType === 'advance_expense') {
      summaries[claim.employeeId].totalAdvance += Number(claim.amount) || 0;
      summaries[claim.employeeId].remaining += calculateRemainingAmount(claim.id);
    } else if (claim.transactionType === 'reimbursement') {
      summaries[claim.employeeId].totalReimbursement += Number(claim.amount) || 0;
    }
  });

  return Object.values(summaries).map(s => ({
    ...s,
    remaining: Math.max(0, s.remaining)
  }));
};

// ==========================================
// SUPABASE SYNC FUNCTIONS
// ==========================================

export const syncStaffExpenseClaimsWithSupabase = async () => {
  try {
    const local = getStorageItem(CLAIMS_KEY, []);
    const { data: sbRaw, error } = await supabase
      .from('staff_expense_claims')
      .select('*')
      .is('deleted_at', null);
      
    if (error) throw error;

    const sbRecords = sbRaw.map(row => ({ id: row.id, ...row.data, _row: row }));
    if (!sbRecords || sbRecords.length === 0) return local;

    const mergedMap = new Map();
    local.forEach(c => mergedMap.set(String(c.id), c));

    sbRecords.forEach(sbRow => {
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
    setStorageItem(CLAIMS_KEY, mergedArr);
    return mergedArr;
  } catch (error) {
    console.error('syncStaffExpenseClaimsWithSupabase error:', error);
    toast.warning('Không thể đồng bộ Tạm ứng chi, dùng dữ liệu trên máy');
    return getStorageItem(CLAIMS_KEY, []);
  }
};

export const saveExpenseClaimToSupabase = async (claim) => {
  try {
    const { error } = await supabase
      .from('staff_expense_claims')
      .upsert({
        id: String(claim.id),
        data: claim,
        updated_at: new Date().toISOString(),
        deleted_at: claim.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('saveExpenseClaimToSupabase error:', error);
    toast.warning('Cảnh báo: Không đồng bộ Tạm ứng chi lên Supabase, dữ liệu vẫn lưu trên máy');
    return false;
  }
};

export const updateExpenseClaimToSupabase = async (claimId, updates) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('staff_expense_claims')
      .select('data')
      .eq('id', String(claimId))
      .single();
    
    let newData = updates;
    if (!fetchError && existing) {
      newData = { ...existing.data, ...updates };
    }

    const { error } = await supabase
      .from('staff_expense_claims')
      .upsert({
        id: String(claimId),
        data: newData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('updateExpenseClaimToSupabase error:', error);
    toast.warning('Cảnh báo: Không thể cập nhật Tạm ứng chi lên Supabase');
    return false;
  }
};

export const softDeleteExpenseClaimFromSupabase = async (claimId) => {
  try {
    const { error } = await supabase
      .from('staff_expense_claims')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', String(claimId));

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('softDeleteExpenseClaimFromSupabase error:', error);
    toast.warning('Cảnh báo: Không thể xóa Tạm ứng chi trên Supabase');
    return false;
  }
};

export const refreshExpenseClaimsFromSupabase = async () => {
  try {
    const { data: sbRaw, error } = await supabase
      .from('staff_expense_claims')
      .select('*')
      .is('deleted_at', null);

    if (error) throw error;
    
    const sbRecords = sbRaw.map(row => row.data);
    setStorageItem(CLAIMS_KEY, sbRecords);
    toast.success('Đã làm mới dữ liệu Tạm ứng chi từ Supabase');
    return true;
  } catch (error) {
    console.error('refreshExpenseClaimsFromSupabase error:', error);
    toast.error('Lỗi khi làm mới Tạm ứng chi từ Supabase');
    return false;
  }
};
