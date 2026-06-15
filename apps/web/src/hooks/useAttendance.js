
import { useState, useEffect, useCallback } from 'react';
import { 
  syncAttendanceRecordsWithSupabase, 
  syncAttendanceRequestsWithSupabase,
  saveAttendanceRecordToSupabase,
  saveAttendanceRequestToSupabase
} from '@/services/dataService.js';
import { createApprovalNotificationIfNotExists, updateApprovalNotificationStatus, getApprovalNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const RECORDS_KEY = 'attendanceRecords';
const REQUESTS_KEY = 'attendanceRequests';

export const useAttendance = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  const initStorage = useCallback(() => {
    if (!getStorageItem(RECORDS_KEY)) setStorageItem(RECORDS_KEY, []);
    if (!getStorageItem(REQUESTS_KEY)) setStorageItem(REQUESTS_KEY, []);
  }, []);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    await Promise.all([
      syncAttendanceRecordsWithSupabase(),
      syncAttendanceRequestsWithSupabase()
    ]);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    initStorage();
    syncData();
  }, [initStorage, syncData]);

  const getAttendanceRecords = useCallback((filters = {}) => {
    initStorage();
    let records = getStorageItem(RECORDS_KEY, []);
    
    if (filters.employeeId) records = records.filter(r => r.employeeId === filters.employeeId);
    if (filters.date) records = records.filter(r => r.date === filters.date);
    if (filters.month && filters.year) {
      records = records.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() + 1 === filters.month && d.getFullYear() === filters.year;
      });
    }
    return records;
  }, [initStorage]);

  const createAttendanceRecord = useCallback((data) => {
    const records = getAttendanceRecords();
    const newRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStorageItem(RECORDS_KEY, [...records, newRecord]);
    saveAttendanceRecordToSupabase(newRecord);
    return newRecord;
  }, [getAttendanceRecords]);

  const updateAttendanceRecord = useCallback((id, data) => {
    const records = getAttendanceRecords();
    let updatedRecord = null;
    const updated = records.map(r => {
      if (r.id === id) {
        updatedRecord = { ...r, ...data, updatedAt: new Date().toISOString() };
        return updatedRecord;
      }
      return r;
    });
    setStorageItem(RECORDS_KEY, updated);
    if (updatedRecord) {
      saveAttendanceRecordToSupabase(updatedRecord);
    }
  }, [getAttendanceRecords]);

  const getAttendanceRequests = useCallback((filters = {}) => {
    initStorage();
    let requests = getStorageItem(REQUESTS_KEY, []);
    
    if (filters.employeeId) requests = requests.filter(r => r.employeeId === filters.employeeId);
    if (filters.status) requests = requests.filter(r => r.status === filters.status);
    if (filters.date) requests = requests.filter(r => r.date === filters.date);
    if (filters.month && filters.year) {
      requests = requests.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() + 1 === filters.month && d.getFullYear() === filters.year;
      });
    }
    return requests;
  }, [initStorage]);

  const createAttendanceRequest = useCallback((data) => {
    const requests = getAttendanceRequests();
    const newRequest = {
      ...data,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStorageItem(REQUESTS_KEY, [...requests, newRequest]);
    saveAttendanceRequestToSupabase(newRequest);

    createApprovalNotificationIfNotExists(
      newRequest.id,
      'attendance_requests',
      'attendance_request',
      'Yêu cầu chấm công',
      `Yêu cầu ${newRequest.requestType} ngày ${newRequest.date}`,
      newRequest.employeeId,
      newRequest.employeeName || newRequest.employeeId,
      ['Admin']
    );

    return newRequest;
  }, [getAttendanceRequests]);

  const updateAttendanceRequest = useCallback((id, data) => {
    const requests = getAttendanceRequests();
    let updatedRequest = null;
    const updated = requests.map(r => {
      if (r.id === id) {
        updatedRequest = { ...r, ...data, updatedAt: new Date().toISOString() };
        return updatedRequest;
      }
      return r;
    });
    setStorageItem(REQUESTS_KEY, updated);
    if (updatedRequest) {
      saveAttendanceRequestToSupabase(updatedRequest);
      
      if (data.status === 'approved' || data.status === 'rejected') {
        const notifications = getApprovalNotifications();
        const notification = notifications.find(n => n.relatedId === id && n.type === 'attendance_request');
        if (notification) {
          updateApprovalNotificationStatus(notification.id, data.status, data.approvedBy || data.updatedBy || 'System', new Date().toISOString());
        }
      }
    }
  }, [getAttendanceRequests]);

  // Helper Functions
  const getAttendanceByDate = useCallback((employeeId, date) => {
    const records = getAttendanceRecords({ employeeId, date });
    return records[0] || null;
  }, [getAttendanceRecords]);

  const saveOrUpdateAttendance = useCallback((employeeId, date, data) => {
    const existing = getAttendanceByDate(employeeId, date);
    if (existing) {
      updateAttendanceRecord(existing.id, { ...data, updatedAt: new Date().toISOString() });
      return existing.id;
    } else {
      const newRecord = createAttendanceRecord({
        employeeId,
        date,
        ...data,
        createdBy: employeeId,
      });
      return newRecord.id;
    }
  }, [getAttendanceByDate, updateAttendanceRecord, createAttendanceRecord]);

  const getAttendanceStatus = useCallback((employeeId, date) => {
    const record = getAttendanceByDate(employeeId, date);
    return record ? record.status : null;
  }, [getAttendanceByDate]);

  const calculateWorkUnits = useCallback((records, month, year) => {
    return records.reduce((total, r) => {
      const d = new Date(r.date);
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        return total + (Number(r.workUnit) || 0);
      }
      return total;
    }, 0);
  }, []);

  const getStatusBadge = useCallback((status) => {
    const map = {
      'present': { label: 'Có mặt', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
      'leave_full': { label: 'Nghỉ cả ngày', class: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
      'leave_morning': { label: 'Nghỉ sáng', class: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
      'leave_afternoon': { label: 'Nghỉ chiều', class: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
      'late': { label: 'Đi muộn', class: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
      'early_leave': { label: 'Về sớm', class: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
      'absent': { label: 'Vắng mặt', class: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
      'pending': { label: 'Chờ duyệt', class: 'bg-blue-100 text-blue-700 hover:bg-blue-200' }
    };
    return map[status] || { label: status, class: 'bg-gray-100 text-gray-700' };
  }, []);

  const formatDateVN = useCallback((dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, []);

  const formatTimeVN = useCallback((timeString) => {
    if (!timeString) return '';
    if (timeString.includes('T')) {
      const d = new Date(timeString);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return timeString;
  }, []);

  return {
    isSyncing,
    syncData,
    getAttendanceRecords,
    createAttendanceRecord,
    updateAttendanceRecord,
    getAttendanceRequests,
    createAttendanceRequest,
    updateAttendanceRequest,
    getAttendanceByDate,
    saveOrUpdateAttendance,
    getAttendanceStatus,
    calculateWorkUnits,
    getStatusBadge,
    formatDateVN,
    formatTimeVN
  };
};
