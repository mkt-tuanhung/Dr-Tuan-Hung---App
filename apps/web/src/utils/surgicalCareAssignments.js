
import { 
  getSurgicalCareAssignmentsFromSupabase, 
  mergeSurgicalAssignmentsFromSupabase, 
  saveSurgicalAssignmentToSupabase, 
  softDeleteSurgicalAssignmentFromSupabase 
} from '@/services/dataService.js';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

export const SURGICAL_ASSIGNMENTS_KEY = 'surgicalCareAssignments';

export const normalize = (value) => String(value || '').trim().toLowerCase();

export const isSurgeryCustomer = (appointment) => {
  if (!appointment) return false;
  const status = normalize(appointment.status);
  const evalStatus = normalize(appointment.evaluationStatus);
  const service = normalize(appointment.service || appointment.serviceName);
  
  const surgeryKeywords = ['phẫu thuật', 'phau thuat', 'surgery', 'đại phẫu', 'tiểu phẫu'];
  
  return surgeryKeywords.some(k => 
    status.includes(k) || 
    evalStatus.includes(k) || 
    service.includes(k)
  );
};

export const getSurgicalAssignments = () => {
  try {
    const assignments = getStorageItem(SURGICAL_ASSIGNMENTS_KEY, []);
    return assignments.filter(a => !a.isDeleted);
  } catch (e) {
    console.error('Error parsing surgical assignments', e);
    return [];
  }
};

export const getSurgicalAssignmentByAppointmentId = (appointmentId) => {
  const assignments = getSurgicalAssignments();
  return assignments.find(a => a.appointmentId === appointmentId) || null;
};

export const saveSurgicalAssignment = async (assignment) => {
  const assignments = getStorageItem(SURGICAL_ASSIGNMENTS_KEY, []);
  const existingIndex = assignments.findIndex(a => a.appointmentId === assignment.appointmentId);
  
  const timestamp = new Date().toISOString();
  const payload = {
    ...assignment,
    updatedAt: timestamp
  };

  if (existingIndex >= 0) {
    payload.createdAt = assignments[existingIndex].createdAt || timestamp;
    assignments[existingIndex] = { ...assignments[existingIndex], ...payload };
  } else {
    payload.id = assignment.id || crypto.randomUUID();
    payload.createdAt = timestamp;
    assignments.push(payload);
  }
  
  setStorageItem(SURGICAL_ASSIGNMENTS_KEY, assignments);
  
  try {
    await saveSurgicalAssignmentToSupabase(payload);
  } catch (e) {
    console.error('Lỗi đồng bộ Supabase:', e);
  }

  return payload;
};

export const deleteSurgicalAssignment = async (id) => {
  const assignments = getStorageItem(SURGICAL_ASSIGNMENTS_KEY, []);
  const index = assignments.findIndex(a => a.id === id);
  if (index !== -1) {
    assignments[index].isDeleted = true;
    assignments[index].deleted_at = new Date().toISOString();
    assignments[index].updatedAt = new Date().toISOString();
    setStorageItem(SURGICAL_ASSIGNMENTS_KEY, assignments);
    
    try {
      await softDeleteSurgicalAssignmentFromSupabase(id);
    } catch (e) {
      console.error('Lỗi đồng bộ xóa lên Supabase:', e);
    }
  }
};

export const getSurgicalAssignmentsByNurse = (employeeId) => {
  const assignments = getSurgicalAssignments();
  const normalizedId = normalize(employeeId);
  
  return assignments.filter(a => {
    const isScrub = normalize(a.scrubNurse1EmployeeId) === normalizedId || 
                    normalize(a.scrubNurse2EmployeeId) === normalizedId || 
                    normalize(a.scrubNurse3EmployeeId) === normalizedId;
                    
    const isNight = Array.isArray(a.nightNurseEmployeeIds) && 
                    a.nightNurseEmployeeIds.some(id => normalize(id) === normalizedId);
                    
    const isPostOp = Array.isArray(a.postOpNurseEmployeeIds) && 
                     a.postOpNurseEmployeeIds.some(id => normalize(id) === normalizedId);
                     
    return isScrub || isNight || isPostOp;
  });
};

export const getSurgicalAssignmentsByMonth = (month) => {
  if (!month) return getSurgicalAssignments();
  const assignments = getSurgicalAssignments();
  return assignments.filter(a => {
    const assignMonth = a.surgeryDate ? a.surgeryDate.substring(0, 7) : 
                       (a.appointmentDate ? a.appointmentDate.substring(0, 7) : '');
    return assignMonth === month;
  });
};

export const mergeSurgicalAssignmentsWithSupabase = async () => {
  try {
    const local = getStorageItem(SURGICAL_ASSIGNMENTS_KEY, []);
    const sbRecords = await getSurgicalCareAssignmentsFromSupabase();
    const merged = mergeSurgicalAssignmentsFromSupabase(local, sbRecords);
    setStorageItem(SURGICAL_ASSIGNMENTS_KEY, merged);
    return merged;
  } catch (error) {
    console.error('Error merging surgical assignments:', error);
    toast.error('Lỗi đồng bộ phân công phẫu thuật');
    return getStorageItem(SURGICAL_ASSIGNMENTS_KEY, []);
  }
};
