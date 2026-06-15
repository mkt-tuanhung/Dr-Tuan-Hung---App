
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const NOTIFICATIONS_KEY = 'approvalNotifications';
const EVENT_NAME = 'notificationsUpdated';

export const notifyChange = () => {
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const getApprovalNotifications = () => {
  try {
    const data = getStorageItem(NOTIFICATIONS_KEY, []);
    return data.filter(n => !n.isDeleted && !n.deleted_at);
  } catch (e) {
    console.error('Error parsing notifications', e);
    return [];
  }
};

export const saveApprovalNotifications = (notifications) => {
  setStorageItem(NOTIFICATIONS_KEY, notifications);
  notifyChange();
};

export const isNotificationForUser = (notification, userId, userRole) => {
  if (notification.receiverEmployeeId && String(notification.receiverEmployeeId) === String(userId)) return true;
  if (notification.receiverRoles && notification.receiverRoles.includes(userRole)) return true;
  // If no specific receiver is set, assume it's for Admin/Accountant by default for backward compatibility
  if (!notification.receiverEmployeeId && (!notification.receiverRoles || notification.receiverRoles.length === 0)) {
    return ['Admin', 'Kế toán'].includes(userRole);
  }
  return false;
};

export const countPendingNotifications = (userId, userRole) => {
  const all = getApprovalNotifications();
  return all.filter(n => 
    n.status === 'pending' && 
    isNotificationForUser(n, userId, userRole)
  ).length;
};

export const getApprovalNotificationsByStatus = (status, userId, userRole) => {
  const all = getApprovalNotifications().filter(n => isNotificationForUser(n, userId, userRole));
  
  if (status === 'pending') {
    return all.filter(n => n.status === 'pending');
  } else if (status === 'processed') {
    return all.filter(n => ['processed', 'approved', 'rejected', 'completed'].includes(n.status));
  }
  return all;
};

export const mergeApprovalNotificationsFromSupabase = (supabaseNotifications) => {
  const localNotifications = getStorageItem(NOTIFICATIONS_KEY, []);
  const mergedMap = new Map();
  
  localNotifications.forEach(n => mergedMap.set(String(n.id), n));

  supabaseNotifications.forEach(sbRow => {
    const sbRec = { ...sbRow };
    delete sbRec._row;
    if (sbRow._row && sbRow._row.deleted_at) {
      sbRec.isDeleted = true;
      sbRec.deleted_at = sbRow._row.deleted_at;
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

  const mergedArray = Array.from(mergedMap.values());
  saveApprovalNotifications(mergedArray);
  return mergedArray;
};

export const createApprovalNotification = async (sourceId, sourceTable, type, title, message, senderId = null, senderName = null, receiverRoles = [], receiverEmployeeId = null) => {
  const notifications = getStorageItem(NOTIFICATIONS_KEY, []);
  
  // Prevent duplicates
  const exists = notifications.find(n => n.sourceId === sourceId && n.type === type);
  if (exists) return exists;

  const newNotification = {
    id: crypto.randomUUID(),
    sourceId,
    sourceTable,
    type,
    title,
    message,
    senderId,
    senderName,
    receiverRoles,
    receiverEmployeeId,
    status: 'pending',
    isRead: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  notifications.unshift(newNotification);
  saveApprovalNotifications(notifications);

  import('@/services/dataService.js').then(({ saveApprovalNotificationToSupabase }) => {
    saveApprovalNotificationToSupabase(newNotification);
  });
  
  return newNotification;
};

// Legacy wrapper for backward compatibility
export const createApprovalNotificationIfNotExists = createApprovalNotification;

export const updateNotificationStatus = async (notificationId, status, processedBy) => {
  const notifications = getStorageItem(NOTIFICATIONS_KEY, []);
  const index = notifications.findIndex(n => n.id === notificationId || n.sourceId === notificationId); // Fallback to sourceId for legacy calls
  
  if (index !== -1) {
    const actualId = notifications[index].id;
    notifications[index].status = status;
    notifications[index].processedBy = processedBy;
    notifications[index].processedAt = new Date().toISOString();
    notifications[index].updatedAt = new Date().toISOString();
    notifications[index].isRead = true;
    
    saveApprovalNotifications(notifications);
    
    import('@/services/dataService.js').then(({ saveApprovalNotificationToSupabase }) => {
      saveApprovalNotificationToSupabase(notifications[index]);
    });
  }
};

// Legacy wrapper
export const updateApprovalNotificationStatus = updateNotificationStatus;
export const syncNotificationStatus = (sourceId, status = 'completed') => updateNotificationStatus(sourceId, status, 'System');

export const markAsRead = (notificationId) => {
  const notifications = getStorageItem(NOTIFICATIONS_KEY, []);
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    notifications[index].isRead = true;
    notifications[index].updatedAt = new Date().toISOString();
    saveApprovalNotifications(notifications);
    
    import('@/services/dataService.js').then(({ saveApprovalNotificationToSupabase }) => {
      saveApprovalNotificationToSupabase(notifications[index]);
    });
  }
};

export const markAllAsRead = (userId, userRole) => {
  const notifications = getStorageItem(NOTIFICATIONS_KEY, []);
  let changed = false;
  
  const updated = notifications.map(n => {
    if (!n.isRead && isNotificationForUser(n, userId, userRole)) {
      changed = true;
      return { ...n, isRead: true, updatedAt: new Date().toISOString() };
    }
    return n;
  });
  
  if (changed) {
    saveApprovalNotifications(updated);
    import('@/services/dataService.js').then(({ saveApprovalNotificationToSupabase }) => {
      updated.forEach(n => {
        if (!n.isRead && isNotificationForUser(n, userId, userRole)) {
          saveApprovalNotificationToSupabase(n);
        }
      });
    });
  }
};

export const deleteNotification = (notificationId) => {
  const notifications = getStorageItem(NOTIFICATIONS_KEY, []);
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    notifications[index].isDeleted = true;
    notifications[index].deleted_at = new Date().toISOString();
    saveApprovalNotifications(notifications);
    
    import('@/services/dataService.js').then(({ saveApprovalNotificationToSupabase }) => {
      saveApprovalNotificationToSupabase(notifications[index]);
    });
  }
};

export const refreshApprovalNotificationsFromSupabase = async () => {
  const { refreshApprovalNotificationsFromSupabase: refreshFn } = await import('@/services/dataService.js');
  return await refreshFn();
};

export const syncApprovalNotificationsWithSupabase = async () => {
  const { syncApprovalNotificationsWithSupabase: syncFn } = await import('@/services/dataService.js');
  return await syncFn();
};
