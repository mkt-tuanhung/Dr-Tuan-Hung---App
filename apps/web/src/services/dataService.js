
import { supabase } from './supabaseClient.js';
import { toast } from 'sonner';
import { mergeRevenueRecords, saveRevenueRecords } from '@/utils/userStorage.js';
import * as StaffStorage from '@/utils/staffExpenseClaimsStorage.js';
import { mergeApprovalNotificationsFromSupabase } from '@/utils/ApprovalNotificationHelper.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

/**
 * Lấy tất cả bản ghi (chưa bị xóa mềm)
 */
export const getRecords = async (tableName) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .is('deleted_at', null);

    if (error) {
      console.error(`Supabase getRecords error (${tableName}):`, error);
      return [];
    }
    
    return data.map(row => ({ id: row.id, ...row.data, _row: row }));
  } catch (error) {
    console.error(`Supabase getRecords exception (${tableName}):`, error);
    return [];
  }
};

/**
 * Lưu bản ghi mới (hoặc ghi đè nếu id đã tồn tại)
 */
export const saveRecord = async (tableName, record) => {
  try {
    const id = String(record.employeeId || record.id || crypto.randomUUID());
    const { data, error } = await supabase
      .from(tableName)
      .upsert(
        { 
          id, 
          data: record,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Supabase saveRecord exception (${tableName}):`, error);
    toast.warning(`Cảnh báo: Không đồng bộ Supabase (${tableName}), dữ liệu vẫn lưu trên máy`);
    return null;
  }
};

/**
 * Cập nhật bản ghi (chỉ cập nhật trường data JSON)
 */
export const updateRecord = async (tableName, id, updates) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from(tableName)
      .select('data')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    
    const newData = { ...existing.data, ...updates };

    const { data, error } = await supabase
      .from(tableName)
      .update({ 
        data: newData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Supabase updateRecord exception (${tableName}):`, error);
    toast.warning(`Cảnh báo: Không đồng bộ Supabase (${tableName}), dữ liệu vẫn lưu trên máy`);
    return null;
  }
};

/**
 * Xóa mềm bản ghi
 */
export const softDeleteRecord = async (tableName, id) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Supabase softDeleteRecord exception (${tableName}):`, error);
    toast.warning(`Cảnh báo: Không đồng bộ Supabase (${tableName}), dữ liệu vẫn lưu trên máy`);
    return null;
  }
};

/**
 * Đồng bộ và gộp dữ liệu clinic_users giữa LocalStorage và Supabase
 */
export const mergeClinicUsersWithSupabase = async () => {
  try {
    const localUsers = getStorageItem('clinic_users', []);
    const sbUsers = await getRecords('clinic_users');
    
    if (!sbUsers || sbUsers.length === 0) {
      return localUsers;
    }

    const mergedMap = new Map();
    
    localUsers.forEach(u => {
      mergedMap.set(String(u.employeeId || u.id), u);
    });

    sbUsers.forEach(sbRow => {
      const sbUser = { ...sbRow };
      delete sbUser._row;
      
      const sbId = String(sbUser.employeeId || sbUser.id);
      const existingLocal = mergedMap.get(sbId);
      
      if (existingLocal) {
        const localTime = new Date(existingLocal.updatedAt || existingLocal.createdAt || 0).getTime();
        const sbTime = new Date(sbUser.updatedAt || sbUser.createdAt || (sbRow._row && sbRow._row.updated_at) || 0).getTime();
        
        if (sbTime > localTime) {
          mergedMap.set(sbId, sbUser);
        }
      } else {
        mergedMap.set(sbId, sbUser);
      }
    });

    const mergedArray = Array.from(mergedMap.values());
    setStorageItem('clinic_users', mergedArray);
    return mergedArray;

  } catch (error) {
    console.error('Lỗi khi merge clinic_users:', error);
    return getStorageItem('clinic_users', []);
  }
};

export const syncLocalStorageToSupabase = async (localKey, tableName) => {
  try {
    const localData = getStorageItem(localKey, []);
    if (!Array.isArray(localData) || localData.length === 0) return;

    const upsertData = localData.map(item => ({
      id: String(item.employeeId || item.id || crypto.randomUUID()),
      data: item,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(tableName)
      .upsert(upsertData, { onConflict: 'id' });

    if (error) {
      console.error(`Supabase sync error (${tableName}):`, error);
    }
  } catch (error) {
    console.error(`Lỗi đồng bộ bảng ${tableName}:`, error);
  }
};

// ==========================================
// REVENUE RECORDS MODULE SYNC
// ==========================================

export const syncRevenueRecordsWithSupabase = async () => {
  try {
    const localRecords = getStorageItem('revenueRecords', []);
    const { data: sbRaw, error } = await supabase.from('revenue_records').select('*');
    if (error) throw error;

    const sbRecords = sbRaw.map(row => ({ id: row.id, ...row.data, _row: row }));
    if (!sbRecords || sbRecords.length === 0) return localRecords;

    const mergedArr = mergeRevenueRecords(localRecords, sbRecords);
    saveRevenueRecords(mergedArr);
    return mergedArr;
  } catch (error) {
    console.error('Sync revenue_records exception:', error);
    toast.warning('Cảnh báo: Không thể tải dữ liệu doanh thu từ Supabase');
    return getStorageItem('revenueRecords', []);
  }
};

export const saveRevenueRecordToSupabase = async (record) => {
  try {
    const id = String(record.id);
    const { error } = await supabase
      .from('revenue_records')
      .upsert({ 
        id, 
        data: record,
        updated_at: new Date().toISOString(),
        deleted_at: record.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save revenue record to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ doanh thu lên Supabase, dữ liệu vẫn lưu trên máy');
    return false;
  }
};

export const updateRevenueRecordToSupabase = saveRevenueRecordToSupabase;

export const softDeleteRevenueRecordToSupabase = async (id) => {
  try {
    const { error } = await supabase
      .from('revenue_records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Soft delete revenue record to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ xóa lên Supabase, dữ liệu chỉ xóa trên máy');
    return false;
  }
};

export const refreshRevenueRecordsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('revenue_records')
      .select('*')
      .is('deleted_at', null);

    if (error) throw error;

    const localData = data.map(row => row.data);
    saveRevenueRecords(localData);
    toast.success('Đã làm mới dữ liệu doanh thu từ Supabase');
    return true;
  } catch (error) {
    console.error('Refresh revenue records exception:', error);
    toast.error('Lỗi khi làm mới doanh thu từ Supabase');
    return false;
  }
};

// ==========================================
// ATTENDANCE MODULE SYNC
// ==========================================

export const syncAttendanceRecordsWithSupabase = async () => {
  try {
    const localRecords = getStorageItem('attendanceRecords', []);
    const sbRecords = await getRecords('attendance_records');
    
    if (!sbRecords || sbRecords.length === 0) return localRecords;

    const mergedMap = new Map();
    localRecords.forEach(r => mergedMap.set(`${r.employeeId}_${r.date}`, r));

    sbRecords.forEach(sbRow => {
      const sbRec = { ...sbRow };
      delete sbRec._row;
      const id = `${sbRec.employeeId}_${sbRec.date}`;
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
    setStorageItem('attendanceRecords', mergedArr);
    return mergedArr;
  } catch (error) {
    console.error('Sync attendance_records exception:', error);
    toast.warning('Cảnh báo: Không thể tải bảng công từ Supabase');
    return getStorageItem('attendanceRecords', []);
  }
};

export const syncAttendanceRequestsWithSupabase = async () => {
  try {
    const localRequests = getStorageItem('attendanceRequests', []);
    const sbRequests = await getRecords('attendance_requests');
    
    if (!sbRequests || sbRequests.length === 0) return localRequests;

    const mergedMap = new Map();
    localRequests.forEach(r => mergedMap.set(String(r.id), r));

    sbRequests.forEach(sbRow => {
      const sbReq = { ...sbRow };
      delete sbReq._row;
      const id = String(sbReq.id);
      const existing = mergedMap.get(id);

      if (existing) {
        const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const sbTime = new Date(sbReq.updatedAt || sbReq.createdAt || (sbRow._row && sbRow._row.updated_at) || 0).getTime();
        if (sbTime > localTime) mergedMap.set(id, sbReq);
      } else {
        mergedMap.set(id, sbReq);
      }
    });

    const mergedArr = Array.from(mergedMap.values());
    setStorageItem('attendanceRequests', mergedArr);
    return mergedArr;
  } catch (error) {
    console.error('Sync attendance_requests exception:', error);
    toast.warning('Cảnh báo: Không thể tải yêu cầu chấm công từ Supabase');
    return getStorageItem('attendanceRequests', []);
  }
};

export const saveAttendanceRecordToSupabase = async (record) => {
  try {
    const id = `${record.employeeId}_${record.date}`;
    const { error } = await supabase
      .from('attendance_records')
      .upsert({ 
        id, 
        data: record,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save attendance record to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ Supabase, dữ liệu chấm công vẫn lưu trên máy');
    return false;
  }
};

export const saveAttendanceRequestToSupabase = async (request) => {
  try {
    const id = String(request.id);
    const { error } = await supabase
      .from('attendance_requests')
      .upsert({ 
        id, 
        data: request,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save attendance request to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ yêu cầu lên Supabase, vẫn lưu trên máy');
    return false;
  }
};

export const uploadAllAttendanceToSupabase = async () => {
  try {
    const records = getStorageItem('attendanceRecords', []);
    const requests = getStorageItem('attendanceRequests', []);

    let recordError = null;
    let requestError = null;

    if (records.length > 0) {
      const upsertRecords = records.map(r => ({
        id: `${r.employeeId}_${r.date}`,
        data: r,
        updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('attendance_records').upsert(upsertRecords);
      if (error) recordError = error;
    }

    if (requests.length > 0) {
      const upsertRequests = requests.map(r => ({
        id: String(r.id),
        data: r,
        updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('attendance_requests').upsert(upsertRequests);
      if (error) requestError = error;
    }

    if (recordError || requestError) {
      console.error('Bulk upload errors:', { recordError, requestError });
      return false;
    }
    return true;
  } catch (error) {
    console.error('Exception during bulk upload attendance:', error);
    return false;
  }
};

// ==========================================
// APPOINTMENTS MODULE SYNC
// ==========================================

export const syncAppointmentRecordsWithSupabase = async () => {
  try {
    const localRecords = getStorageItem('customerAppointments', []);
    const { data: sbRaw, error } = await supabase.from('customer_appointments').select('*');
    if (error) throw error;

    const sbRecords = sbRaw.map(row => ({ id: row.id, ...row.data, _row: row }));
    if (!sbRecords || sbRecords.length === 0) return localRecords;

    const mergedMap = new Map();
    localRecords.forEach(r => mergedMap.set(String(r.id), r));

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
    setStorageItem('customerAppointments', mergedArr);
    return mergedArr;
  } catch (error) {
    console.error('Sync customer_appointments exception:', error);
    toast.warning('Cảnh báo: Không thể tải dữ liệu lịch hẹn từ Supabase');
    return getStorageItem('customerAppointments', []);
  }
};

export const saveAppointmentRecordToSupabase = async (record) => {
  try {
    const id = String(record.id);
    const { error } = await supabase
      .from('customer_appointments')
      .upsert({ 
        id, 
        data: record,
        updated_at: new Date().toISOString(),
        deleted_at: record.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save appointment to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ lịch hẹn lên Supabase, dữ liệu vẫn lưu trên máy');
    return false;
  }
};

export const uploadAllAppointmentsToSupabase = async () => {
  try {
    const records = getStorageItem('customerAppointments', []);
    if (records.length === 0) return { success: 0, fail: 0 };

    const upsertRecords = records.map(r => ({
      id: String(r.id),
      data: r,
      updated_at: new Date().toISOString(),
      deleted_at: r.isDeleted ? new Date().toISOString() : null
    }));

    const { error } = await supabase.from('customer_appointments').upsert(upsertRecords);

    if (error) throw error;
    return { success: records.length, fail: 0 };
  } catch (error) {
    console.error('Bulk upload appointments exception:', error);
    return { success: 0, fail: 1 };
  }
};

export const refreshAppointmentsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*')
      .is('deleted_at', null);

    if (error) throw error;

    const localData = data.map(row => row.data);
    setStorageItem('customerAppointments', localData);
    toast.success('Đã làm mới dữ liệu lịch hẹn từ Supabase');
    return true;
  } catch (error) {
    console.error('Refresh appointments exception:', error);
    toast.error('Lỗi khi làm mới lịch hẹn từ Supabase');
    return false;
  }
};

// ==========================================
// KPI TARGETS & PAGE DAILY REPORTS SYNC
// ==========================================

export const getKpiTargetsFromSupabase = async () => {
  try {
    const localRecords = getStorageItem('kpiTargets', []);
    const { data: sbRaw, error } = await supabase.from('kpi_targets').select('*');
    if (error) throw error;

    const sbRecords = sbRaw.map(row => ({ id: row.id, ...row.data, _row: row }));
    if (!sbRecords || sbRecords.length === 0) return localRecords;

    const mergedMap = new Map();
    localRecords.forEach(r => mergedMap.set(String(r.id), r));

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

    const mergedArr = Array.from(mergedMap.values()).filter(r => !r.isDeleted);
    setStorageItem('kpiTargets', Array.from(mergedMap.values()));
    return mergedArr;
  } catch (error) {
    console.error('Sync kpi_targets exception:', error);
    toast.warning('Cảnh báo: Không thể tải dữ liệu KPI từ Supabase');
    return getStorageItem('kpiTargets', []).filter(r => !r.isDeleted);
  }
};

export const saveKpiTargetToSupabase = async (record) => {
  try {
    const id = String(record.id);
    const { error } = await supabase
      .from('kpi_targets')
      .upsert({ 
        id, 
        data: record,
        updated_at: new Date().toISOString(),
        deleted_at: record.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save KPI target to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ KPI lên Supabase, dữ liệu vẫn lưu trên máy');
    return false;
  }
};

export const softDeleteKpiTargetFromSupabase = async (id) => {
  try {
    const { error } = await supabase
      .from('kpi_targets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Soft delete KPI target to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ xóa KPI lên Supabase, chỉ xóa trên máy');
    return false;
  }
};

export const getPageDailyReportsFromSupabase = async () => {
  try {
    const localRecords = getStorageItem('pageDailyReports', []);
    const { data: sbRaw, error } = await supabase.from('page_daily_reports').select('*');
    if (error) throw error;

    const sbRecords = sbRaw.map(row => ({ id: row.id, ...row.data, _row: row }));
    if (!sbRecords || sbRecords.length === 0) return localRecords;

    const mergedMap = new Map();
    localRecords.forEach(r => mergedMap.set(String(r.id), r));

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

    const mergedArr = Array.from(mergedMap.values()).filter(r => !r.isDeleted);
    setStorageItem('pageDailyReports', Array.from(mergedMap.values()));
    return mergedArr;
  } catch (error) {
    console.error('Sync page_daily_reports exception:', error);
    toast.warning('Cảnh báo: Không thể tải báo cáo Page từ Supabase');
    return getStorageItem('pageDailyReports', []).filter(r => !r.isDeleted);
  }
};

export const savePageDailyReportToSupabase = async (record) => {
  try {
    const id = String(record.id);
    const { error } = await supabase
      .from('page_daily_reports')
      .upsert({ 
        id, 
        data: record,
        updated_at: new Date().toISOString(),
        deleted_at: record.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save page daily report to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ báo cáo Page lên Supabase, dữ liệu vẫn lưu trên máy');
    return false;
  }
};

export const softDeletePageDailyReportFromSupabase = async (id) => {
  try {
    const { error } = await supabase
      .from('page_daily_reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Soft delete page daily report to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ xóa báo cáo Page lên Supabase, chỉ xóa trên máy');
    return false;
  }
};

// ==========================================
// PAYROLL MODULE SYNC
// ==========================================

export const getPayrollsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('monthly_payrolls')
      .select('*')
      .is('deleted_at', null);

    if (error) {
      console.error('Supabase getPayrollsFromSupabase error:', error);
      return [];
    }
    
    return data.map(row => ({ id: row.id, ...row.data, _row: row }));
  } catch (error) {
    console.error('Supabase getPayrollsFromSupabase exception:', error);
    return [];
  }
};

export const savePayrollRecordToSupabase = async (payroll) => {
  try {
    const id = String(payroll.id || `${payroll.employeeId}_${payroll.month}`);
    const { error } = await supabase
      .from('monthly_payrolls')
      .upsert({ 
        id, 
        data: payroll,
        updated_at: new Date().toISOString(),
        deleted_at: payroll.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Save payroll record to Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ bảng lương lên Supabase, dữ liệu vẫn lưu trên máy');
    return false;
  }
};

export const softDeletePayrollFromSupabase = async (id) => {
  try {
    const { error } = await supabase
      .from('monthly_payrolls')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Soft delete payroll from Supabase failed:', error);
    toast.warning('Cảnh báo: Không đồng bộ xóa bảng lương lên Supabase, dữ liệu chỉ xóa trên máy');
    return false;
  }
};

export const refreshPayrollsFromSupabase = async () => {
  try {
    const data = await getPayrollsFromSupabase();
    const localData = data.map(row => {
      const rec = { ...row };
      delete rec._row;
      return rec;
    });
    setStorageItem('monthlyPayrolls', localData);
    toast.success('Đã làm mới dữ liệu lương từ Supabase');
    return true;
  } catch (error) {
    console.error('Refresh payroll records exception:', error);
    toast.error('Lỗi khi làm mới lương từ Supabase');
    return false;
  }
};

// ==========================================
// STAFF EXPENSE CLAIMS SYNC
// ==========================================

export const syncStaffExpenseClaimsWithSupabase = () => StaffStorage.syncStaffExpenseClaimsWithSupabase();
export const saveExpenseClaimToSupabase = (claim) => StaffStorage.saveExpenseClaimToSupabase(claim);
export const updateExpenseClaimToSupabase = (claimId, updates) => StaffStorage.updateExpenseClaimToSupabase(claimId, updates);
export const softDeleteExpenseClaimFromSupabase = (claimId) => StaffStorage.softDeleteExpenseClaimFromSupabase(claimId);
export const refreshExpenseClaimsFromSupabase = () => StaffStorage.refreshExpenseClaimsFromSupabase();


// ==========================================
// APPROVAL NOTIFICATIONS SYNC
// ==========================================

export const getApprovalNotificationsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('approval_notifications')
      .select('*')
      .is('deleted_at', null);

    if (error) {
      console.error('Supabase getApprovalNotificationsFromSupabase error:', error);
      return [];
    }
    
    return data.map(row => ({ id: row.id, ...row.data, _row: row }));
  } catch (error) {
    console.error('Supabase getApprovalNotificationsFromSupabase exception:', error);
    return [];
  }
};

export const saveApprovalNotificationToSupabase = async (notification) => {
  try {
    const { error } = await supabase
      .from('approval_notifications')
      .upsert({
        id: String(notification.id),
        data: notification,
        updated_at: new Date().toISOString(),
        deleted_at: notification.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('saveApprovalNotificationToSupabase error:', error);
    return false;
  }
};

export const refreshApprovalNotificationsFromSupabase = async () => {
  try {
    const sbRecords = await getApprovalNotificationsFromSupabase();
    setStorageItem('approvalNotifications', []); 
    mergeApprovalNotificationsFromSupabase(sbRecords);
    window.dispatchEvent(new Event('notificationsUpdated'));
    return true;
  } catch (error) {
    console.error('refreshApprovalNotificationsFromSupabase error:', error);
    return false;
  }
};

export const syncApprovalNotificationsWithSupabase = async () => {
  try {
    const local = getStorageItem('approvalNotifications', []);
    const sbRecords = await getApprovalNotificationsFromSupabase();
    
    const merged = mergeApprovalNotificationsFromSupabase(sbRecords);
    
    for (const n of merged) {
      await saveApprovalNotificationToSupabase(n);
    }
    
    window.dispatchEvent(new Event('notificationsUpdated'));
    return merged;
  } catch (error) {
    console.error('syncApprovalNotificationsWithSupabase error:', error);
    return getStorageItem('approvalNotifications', []);
  }
};

// ==========================================
// SURGICAL CARE ASSIGNMENTS SYNC
// ==========================================

export const getSurgicalCareAssignmentsFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('surgical_care_assignments')
      .select('*')
      .is('deleted_at', null);

    if (error) {
      console.error('Supabase getSurgicalCareAssignmentsFromSupabase error:', error);
      return [];
    }
    
    return data.map(row => ({ id: row.id, ...row.data, _row: row }));
  } catch (error) {
    console.error('Supabase getSurgicalCareAssignmentsFromSupabase exception:', error);
    return [];
  }
};

export const saveSurgicalAssignmentToSupabase = async (assignmentData) => {
  try {
    const { error } = await supabase
      .from('surgical_care_assignments')
      .upsert({
        id: String(assignmentData.id),
        data: assignmentData,
        updated_at: new Date().toISOString(),
        deleted_at: assignmentData.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('saveSurgicalAssignmentToSupabase error:', error);
    toast.warning('Cảnh báo: Lỗi đồng bộ phân công phẫu thuật lên Supabase');
    return false;
  }
};

export const updateSurgicalAssignmentToSupabase = async (id, assignmentData) => {
  return await saveSurgicalAssignmentToSupabase({ ...assignmentData, id });
};

export const softDeleteSurgicalAssignmentFromSupabase = async (id) => {
  try {
    const { error } = await supabase
      .from('surgical_care_assignments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', String(id));

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('softDeleteSurgicalAssignmentFromSupabase error:', error);
    toast.warning('Cảnh báo: Lỗi đồng bộ xóa phân công phẫu thuật lên Supabase');
    return false;
  }
};

export const mergeSurgicalAssignmentsFromSupabase = (localData, supabaseData) => {
  const mergedMap = new Map();
  localData.forEach(r => mergedMap.set(String(r.id), r));

  supabaseData.forEach(sbRow => {
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

// ==========================================
// PAGE PHONE ASSIGNMENTS SYNC
// ==========================================

export const getPagePhoneAssignmentsFromSupabase = async () => {
  // Temporarily disabled Supabase call to prevent "Could not find the table" error
  /*
  try {
    const { data, error } = await supabase
      .from('page_phone_assignments')
      .select('*')
      .is('deleted_at', null);

    if (error) {
      console.error('Supabase getPagePhoneAssignmentsFromSupabase error:', error);
      toast.warning('Không thể tải dữ liệu phân công số điện thoại từ Supabase');
      return getStorageItem('pagePhoneAssignments', []);
    }
    
    return data.map(row => ({ id: row.id, ...row.data, _row: row }));
  } catch (error) {
    console.error('Supabase getPagePhoneAssignmentsFromSupabase exception:', error);
    toast.warning('Không thể tải dữ liệu phân công số điện thoại từ Supabase');
    return getStorageItem('pagePhoneAssignments', []);
  }
  */
  return getStorageItem('pagePhoneAssignments', []);
};

export const savePagePhoneAssignmentToSupabase = async (assignmentData) => {
  // Temporarily disabled Supabase call to prevent "Could not find the table" error
  return true;
  /*
  try {
    const { error } = await supabase
      .from('page_phone_assignments')
      .upsert({
        id: String(assignmentData.id),
        data: assignmentData,
        updated_at: new Date().toISOString(),
        deleted_at: assignmentData.isDeleted ? new Date().toISOString() : null
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('savePagePhoneAssignmentToSupabase error:', error);
    toast.warning('Cảnh báo: Lỗi đồng bộ chia số trực page lên Supabase');
    return false;
  }
  */
};

export const softDeletePagePhoneAssignmentFromSupabase = async (id) => {
  // Temporarily disabled Supabase call to prevent "Could not find the table" error
  return true;
  /*
  try {
    const { error } = await supabase
      .from('page_phone_assignments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', String(id));

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('softDeletePagePhoneAssignmentFromSupabase error:', error);
    toast.warning('Cảnh báo: Lỗi đồng bộ xóa chia số trực page lên Supabase');
    return false;
  }
  */
};

export const mergePagePhoneAssignmentsFromSupabase = (localData, supabaseData) => {
  const mergedMap = new Map();
  localData.forEach(r => mergedMap.set(String(r.id), r));

  supabaseData.forEach(sbRow => {
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
