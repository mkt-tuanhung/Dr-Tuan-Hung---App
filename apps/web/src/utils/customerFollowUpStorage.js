
import { normalize, matchUser } from '@/utils/userMatchHelper.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const FOLLOW_UPS_KEY = 'customerFollowUps';

export const getAppointmentStatus = (appointment) => {
  if (!appointment) return '';
  return normalize(appointment.evaluationStatus || appointment.status);
};

export const isBongCustomer = (appointment) => {
  const status = getAppointmentStatus(appointment);
  return ['bong', 'bóng'].includes(status);
};

export const isDepositCustomer = (appointment) => {
  const status = getAppointmentStatus(appointment);
  return ['cọc', 'coc', 'deposit'].includes(status);
};

export const isSurgeryCustomer = (appointment) => {
  const status = getAppointmentStatus(appointment);
  return ['phẫu thuật', 'phau thuat', 'surgery'].includes(status);
};

export const canViewFollowUpCustomer = (appointment, currentUser) => {
  if (!currentUser) return false;
  if (currentUser.role === 'Admin') return true;
  
  const pos = normalize(currentUser.departmentPosition);
  if (pos.includes('tele')) return matchUser(appointment.telesaleEmployeeId, currentUser);
  if (pos.includes('sale')) return matchUser(appointment.saleOfflineEmployeeId, currentUser);
  
  return false;
};

export const canUpdateFollowUpCustomer = (appointment, currentUser) => {
  return canViewFollowUpCustomer(appointment, currentUser);
};

export const canConvertToSurgery = (appointment, currentUser) => {
  return canViewFollowUpCustomer(appointment, currentUser);
};

// CRUD Operations
export const getFollowUps = () => {
  try {
    return getStorageItem(FOLLOW_UPS_KEY, []);
  } catch {
    return [];
  }
};

export const getFollowUpByAppointmentId = (appointmentId) => {
  const followUps = getFollowUps();
  return followUps.find(f => f.appointmentId === appointmentId) || null;
};

export const saveFollowUp = (followUpData) => {
  const followUps = getFollowUps();
  const newFollowUp = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...followUpData
  };
  followUps.push(newFollowUp);
  setStorageItem(FOLLOW_UPS_KEY, followUps);
  return newFollowUp;
};

export const updateFollowUp = (id, followUpData) => {
  const followUps = getFollowUps();
  const index = followUps.findIndex(f => f.id === id);
  if (index !== -1) {
    followUps[index] = { 
      ...followUps[index], 
      ...followUpData, 
      updatedAt: new Date().toISOString() 
    };
    setStorageItem(FOLLOW_UPS_KEY, followUps);
    return followUps[index];
  }
  return null;
};

export const saveOrUpdateFollowUpByAppointmentId = (appointmentId, followUpData) => {
  const existing = getFollowUpByAppointmentId(appointmentId);
  if (existing) {
    return updateFollowUp(existing.id, followUpData);
  } else {
    return saveFollowUp({ appointmentId, ...followUpData });
  }
};

export const deleteFollowUp = (id) => {
  const followUps = getFollowUps();
  const filtered = followUps.filter(f => f.id !== id);
  setStorageItem(FOLLOW_UPS_KEY, filtered);
};

export const getFollowUpCustomers = (month, currentUser) => {
  const customerAppointments = getStorageItem('customerAppointments', []);
  
  return customerAppointments.filter(app => {
    if (month && app.month !== month && (!app.appointmentDate || !app.appointmentDate.startsWith(month))) {
      return false;
    }
    
    const status = getAppointmentStatus(app);
    const isFollowUpStatus = ['deposit', 'cọc', 'coc', 'bong', 'bóng'].includes(status);
    
    if (!isFollowUpStatus) return false;
    
    return canViewFollowUpCustomer(app, currentUser);
  });
};
