
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';
import { 
  syncAppointmentRecordsWithSupabase, 
  saveAppointmentRecordToSupabase,
  uploadAllAppointmentsToSupabase,
  refreshAppointmentsFromSupabase
} from '@/services/dataService.js';

const APPOINTMENTS_KEY = 'customerAppointments';

export const getAppointments = (includeDeleted = false) => {
  try {
    const all = getStorageItem(APPOINTMENTS_KEY, []);
    if (includeDeleted) return all;
    return all.filter(a => !a.isDeleted);
  } catch (e) {
    console.error('Error parsing appointments', e);
    return [];
  }
};

export const getCustomerAppointments = () => {
  return getAppointments();
};

export const saveAppointment = (appointment) => {
  const appointments = getAppointments(true);
  const timestamp = new Date().toISOString();
  const newAppointment = {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'pending',
    ...appointment
  };
  appointments.push(newAppointment);
  setStorageItem(APPOINTMENTS_KEY, appointments);
  return newAppointment;
};

export const updateAppointment = (id, updates) => {
  const appointments = getAppointments(true);
  const index = appointments.findIndex(a => a.id === id);
  if (index !== -1) {
    appointments[index] = {
      ...appointments[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    setStorageItem(APPOINTMENTS_KEY, appointments);
    return appointments[index];
  }
  return null;
};

// Legacy permanent deletion - kept for compatibility but should use markAppointmentAsDeleted instead
export const deleteAppointment = (id) => {
  const appointments = getAppointments(true);
  const filtered = appointments.filter(a => a.id !== id);
  setStorageItem(APPOINTMENTS_KEY, filtered);
};

export const markAppointmentAsDeleted = async (id) => {
  const appointments = getAppointments(true);
  const index = appointments.findIndex(a => a.id === id);
  if (index !== -1) {
    appointments[index] = {
      ...appointments[index],
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setStorageItem(APPOINTMENTS_KEY, appointments);
    // Non-blocking Supabase sync
    saveAppointmentRecordToSupabase(appointments[index]);
    return true;
  }
  return false;
};

// Expose Supabase Sync functions to components
export const syncAppointmentsWithSupabase = syncAppointmentRecordsWithSupabase;
export const saveAppointmentToSupabase = saveAppointmentRecordToSupabase;
export { uploadAllAppointmentsToSupabase, refreshAppointmentsFromSupabase };
