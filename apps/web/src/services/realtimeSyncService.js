
import { supabase } from './supabaseClient.js';
import { mergeApprovalNotificationsFromSupabase } from '@/utils/ApprovalNotificationHelper.js';
import { mergeSurgicalAssignmentsFromSupabase } from '@/services/dataService.js';
import { mergePagePhoneAssignmentsFromSupabase } from '@/services/dataService.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

let channel = null;

const processPayload = (payload, storageKey, matchFn) => {
  const { eventType, new: newRow, old: oldRow } = payload;
  const localData = getStorageItem(storageKey, []);

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const incomingData = newRow.data;
    if (!incomingData) return;

    // Handle soft delete flag
    if (newRow.deleted_at) {
      incomingData.isDeleted = true;
    }

    const existingIndex = localData.findIndex(item => matchFn(item, incomingData));
    
    if (existingIndex >= 0) {
      const existing = localData[existingIndex];
      const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(incomingData.updatedAt || incomingData.createdAt || newRow.updated_at || 0).getTime();

      // Prioritize newer updatedAt
      if (incomingTime >= localTime) {
        localData[existingIndex] = { ...existing, ...incomingData };
        setStorageItem(storageKey, localData);
      }
    } else {
      localData.push(incomingData);
      setStorageItem(storageKey, localData);
    }
  } else if (eventType === 'DELETE') {
    // Hard delete fallback (though we mostly use soft deletes)
    const existingIndex = localData.findIndex(item => matchFn(item, { id: oldRow.id, employeeId: oldRow.id }));
    if (existingIndex >= 0) {
      localData[existingIndex].isDeleted = true;
      localData[existingIndex].deleted_at = new Date().toISOString();
      setStorageItem(storageKey, localData);
    }
  }
};

export const startRealtimeSync = () => {
  if (channel) return;

  channel = supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_users' }, (payload) => {
      processPayload(payload, 'clinic_users', (a, b) => String(a.employeeId || a.id) === String(b.employeeId || b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'clinic_users' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
      processPayload(payload, 'attendanceRecords', (a, b) => `${a.employeeId}_${a.date}` === `${b.employeeId}_${b.date}`);
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'attendance_records' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_requests' }, (payload) => {
      processPayload(payload, 'attendanceRequests', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'attendance_requests' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_appointments' }, (payload) => {
      processPayload(payload, 'customerAppointments', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'customer_appointments' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue_records' }, (payload) => {
      processPayload(payload, 'revenueRecords', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'revenue_records' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_targets' }, (payload) => {
      processPayload(payload, 'kpiTargets', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'kpi_targets' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'page_daily_reports' }, (payload) => {
      processPayload(payload, 'pageDailyReports', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'page_daily_reports' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_payrolls' }, (payload) => {
      processPayload(payload, 'monthlyPayrolls', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'monthly_payrolls' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_expense_claims' }, (payload) => {
      processPayload(payload, 'staffExpenseClaims', (a, b) => String(a.id) === String(b.id));
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'staff_expense_claims' } }));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_notifications' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const sbRow = { id: payload.new.id, data: payload.new.data, _row: payload.new };
        mergeApprovalNotificationsFromSupabase([sbRow]);
      } else if (payload.eventType === 'DELETE') {
        const localData = getStorageItem('approvalNotifications', []);
        const existingIndex = localData.findIndex(item => String(item.id) === String(payload.old.id));
        if (existingIndex >= 0) {
          localData[existingIndex].isDeleted = true;
          localData[existingIndex].deleted_at = new Date().toISOString();
          setStorageItem('approvalNotifications', localData);
        }
      }
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'approval_notifications' } }));
      window.dispatchEvent(new Event('notificationsUpdated'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'surgical_care_assignments' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const sbRow = { id: payload.new.id, data: payload.new.data, _row: payload.new };
        const localData = getStorageItem('surgicalCareAssignments', []);
        const merged = mergeSurgicalAssignmentsFromSupabase(localData, [sbRow]);
        setStorageItem('surgicalCareAssignments', merged);
      } else if (payload.eventType === 'DELETE') {
        const localData = getStorageItem('surgicalCareAssignments', []);
        const existingIndex = localData.findIndex(item => String(item.id) === String(payload.old.id));
        if (existingIndex >= 0) {
          localData[existingIndex].isDeleted = true;
          localData[existingIndex].deleted_at = new Date().toISOString();
          setStorageItem('surgicalCareAssignments', localData);
        }
      }
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'surgical_care_assignments' } }));
    })
    /* Temporarily disabled page_phone_assignments realtime sync to prevent "Could not find the table" error
    .on('postgres_changes', { event: '*', schema: 'public', table: 'page_phone_assignments' }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const sbRow = { id: payload.new.id, data: payload.new.data, _row: payload.new };
        const localData = getStorageItem('pagePhoneAssignments', []);
        const merged = mergePagePhoneAssignmentsFromSupabase(localData, [sbRow]);
        setStorageItem('pagePhoneAssignments', merged);
      } else if (payload.eventType === 'DELETE') {
        const localData = getStorageItem('pagePhoneAssignments', []);
        const existingIndex = localData.findIndex(item => String(item.id) === String(payload.old.id));
        if (existingIndex >= 0) {
          localData[existingIndex].isDeleted = true;
          localData[existingIndex].deleted_at = new Date().toISOString();
          setStorageItem('pagePhoneAssignments', localData);
        }
      }
      window.dispatchEvent(new CustomEvent('supabase-data-updated', { detail: { table: 'page_phone_assignments' } }));
    })
    */
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Supabase realtime sync started');
      }
    });
};

export const stopRealtimeSync = () => {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
    console.log('Supabase realtime sync stopped');
  }
};
