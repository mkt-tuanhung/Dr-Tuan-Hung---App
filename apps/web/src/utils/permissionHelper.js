import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

export const MODULES = [
  'Tổng quan',
  'Nhân sự',
  'Chấm công',
  'Lịch hẹn',
  'Khách Bong',
  'Khách Cọc',
  'Khách phẫu thuật',
  'KPI',
  'Doanh thu',
  'Bảng lương',
  'Tạm ứng chi',
  'Thông báo',
  'Cài đặt phân quyền'
];

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

const ROLE_PERMISSIONS_KEY = 'rolePermissions';
const USER_PERMISSIONS_KEY = 'userPermissions';

const createEmptyMatrix = () => {
  const matrix = {};
  MODULES.forEach(m => {
    matrix[m] = {};
    ACTIONS.forEach(a => {
      matrix[m][a] = false;
    });
  });
  return matrix;
};

const createFullMatrix = () => {
  const matrix = {};
  MODULES.forEach(m => {
    matrix[m] = {};
    ACTIONS.forEach(a => {
      matrix[m][a] = true;
    });
  });
  return matrix;
};

export const getDefaultRolePermissions = () => {
  const adminMatrix = createFullMatrix();
  
  const ketoanMatrix = createEmptyMatrix();
  ketoanMatrix['Tổng quan'].view = true;
  ketoanMatrix['Doanh thu'] = { ...ketoanMatrix['Doanh thu'], view: true, create: true, edit: true, export: true };
  ketoanMatrix['Tạm ứng chi'] = { ...ketoanMatrix['Tạm ứng chi'], view: true, create: true, edit: true, approve: true };
  ketoanMatrix['Bảng lương'] = { ...ketoanMatrix['Bảng lương'], view: true, edit: true, export: true };
  ketoanMatrix['Thông báo'].view = true;

  const nhanvienMatrix = createEmptyMatrix();
  nhanvienMatrix['Tổng quan'].view = true;
  nhanvienMatrix['Chấm công'].view = true;
  nhanvienMatrix['Tạm ứng chi'] = { ...nhanvienMatrix['Tạm ứng chi'], view: true, create: true };
  nhanvienMatrix['Bảng lương'].view = true;
  nhanvienMatrix['Thông báo'].view = true;

  const codongMatrix = createEmptyMatrix();
  codongMatrix['Tổng quan'].view = true;
  codongMatrix['Doanh thu'].view = true;

  return {
    'Admin': adminMatrix,
    'Kế toán': ketoanMatrix,
    'Nhân viên': nhanvienMatrix,
    'Cổ đông': codongMatrix
  };
};

export const getDefaultUserPermissions = () => {
  return {};
};

export const getRolePermissions = (role) => {
  try {
    const stored = getStorageItem(ROLE_PERMISSIONS_KEY, {});
    if (stored[role]) return stored[role];
  } catch (e) {
    console.error("Error parsing role permissions", e);
  }
  const defaults = getDefaultRolePermissions();
  return defaults[role] || createEmptyMatrix();
};

export const getUserPermissions = (userId) => {
  try {
    const stored = getStorageItem(USER_PERMISSIONS_KEY, {});
    if (stored[userId]) return stored[userId];
  } catch (e) {
    console.error("Error parsing user permissions", e);
  }
  return null;
};

export const saveRolePermissions = (role, permissions) => {
  try {
    const stored = getStorageItem(ROLE_PERMISSIONS_KEY, {});
    stored[role] = permissions;
    setStorageItem(ROLE_PERMISSIONS_KEY, stored);
    window.dispatchEvent(new Event('permissionsUpdated'));
  } catch (e) {
    console.error("Error saving role permissions", e);
  }
};

export const saveUserPermissions = (userId, permissions) => {
  try {
    const stored = getStorageItem(USER_PERMISSIONS_KEY, {});
    stored[userId] = permissions;
    setStorageItem(USER_PERMISSIONS_KEY, stored);
    window.dispatchEvent(new Event('permissionsUpdated'));
  } catch (e) {
    console.error("Error saving user permissions", e);
  }
};

export const normalize = (v) => String(v || '').trim().toLowerCase();

export const isTelesale = (val) => {
  const str = typeof val === 'object' && val !== null ? (val?.departmentPosition || val?.position) : val;
  return normalize(str).includes('telesale');
};

export const isSaleOffline = (val) => {
  const str = typeof val === 'object' && val !== null ? (val?.departmentPosition || val?.position) : val;
  return normalize(str).includes('sale offline');
};

export const hasPermission = (user, module, action = 'view') => {
  if (!user || !user.role) return false;
  if (user.role === 'Admin') return true;

  // Allow Telesale and Sale Offline access to Doanh thu
  if (module === 'Doanh thu' && (isTelesale(user) || isSaleOffline(user))) return true;

  try {
    const storedUsers = getStorageItem(USER_PERMISSIONS_KEY, {});
    const userId = user.id || user.employeeId;
    if (storedUsers[userId] && storedUsers[userId][module] && typeof storedUsers[userId][module][action] === 'boolean') {
      return storedUsers[userId][module][action];
    }
  } catch(e) {}

  try {
    const storedRoles = getStorageItem(ROLE_PERMISSIONS_KEY, {});
    if (storedRoles[user.role] && storedRoles[user.role][module] && typeof storedRoles[user.role][module][action] === 'boolean') {
      return storedRoles[user.role][module][action];
    }
  } catch(e) {}

  return true;
};

export const getAccessibleModules = (user) => {
  return MODULES.filter(m => hasPermission(user, m, 'view'));
};

export const getAccessibleMenus = (user) => {
  if (!user) return [];
  const role = user.role;
  const isUserTelesale = isTelesale(user);
  const isUserSaleOffline = isSaleOffline(user);

  const getHomePath = () => {
    switch(role) {
      case 'Admin': return '/admin-dashboard';
      case 'Nhân viên': return '/staff-dashboard';
      case 'Kế toán': return '/accountant-dashboard';
      case 'Cổ đông': return '/shareholder-dashboard';
      default: return '/';
    }
  };

  const menus = [];

  if (hasPermission(user, 'Tổng quan', 'view')) menus.push({ id: 'Tổng quan', label: 'Tổng quan', path: getHomePath() });
  if (hasPermission(user, 'Nhân sự', 'view')) menus.push({ id: 'Nhân sự', label: 'Nhân sự', path: '/staff-management' });
  if (hasPermission(user, 'Chấm công', 'view')) menus.push({ id: 'Chấm công', label: 'Chấm công', path: role === 'Admin' ? '/attendance-admin' : '/attendance' });
  if (hasPermission(user, 'Lịch hẹn', 'view')) menus.push({ id: 'Lịch hẹn', label: 'Lịch hẹn', path: '/appointments' });
  if (hasPermission(user, 'Khách Bong', 'view')) menus.push({ id: 'Khách Bong', label: 'Khách Bong', path: '/bong-customers' });
  if (hasPermission(user, 'Khách Cọc', 'view')) menus.push({ id: 'Khách Cọc', label: 'Khách Cọc', path: '/deposit-customers' });
  if (hasPermission(user, 'Khách phẫu thuật', 'view')) menus.push({ id: 'Khách phẫu thuật', label: 'Phẫu thuật', path: '/surgical-customers' });
  if (hasPermission(user, 'KPI', 'view')) menus.push({ id: 'KPI', label: 'KPI', path: role === 'Admin' ? '/kpi-admin' : '/kpi-personal' });
  
  if (hasPermission(user, 'Doanh thu', 'view') || isUserTelesale || isUserSaleOffline) {
    menus.push({ id: 'Doanh thu', label: 'Doanh thu', path: '/admin/revenue-management' });
  }
  
  if (hasPermission(user, 'Bảng lương', 'view')) {
    menus.push({ id: 'Bảng lương', label: 'Bảng lương', path: (role === 'Admin' || role === 'Kế toán') ? '/payroll' : '/payroll/employee' });
  }
  
  if (hasPermission(user, 'Tạm ứng chi', 'view')) menus.push({ id: 'Tạm ứng chi', label: 'Tạm ứng', path: '/staff-expense-claims' });
  if (hasPermission(user, 'Thông báo', 'view')) menus.push({ id: 'Thông báo', label: 'Thông báo', path: '/approval-notifications' });
  
  if (role === 'Admin') menus.push({ id: 'Cài đặt phân quyền', label: 'Cài đặt', path: '/permission-settings' });

  return menus;
};

export const resetRolePermissionsToDefault = (role) => {
  try {
    const stored = getStorageItem(ROLE_PERMISSIONS_KEY, {});
    delete stored[role];
    setStorageItem(ROLE_PERMISSIONS_KEY, stored);
    window.dispatchEvent(new Event('permissionsUpdated'));
  } catch (e) {}
};

export const resetUserPermissionsToDefault = (userId) => {
  try {
    const stored = getStorageItem(USER_PERMISSIONS_KEY, {});
    delete stored[userId];
    setStorageItem(USER_PERMISSIONS_KEY, stored);
    window.dispatchEvent(new Event('permissionsUpdated'));
  } catch (e) {}
};

export const getEffectiveUserMatrix = (userId, role) => {
  const userPerms = getUserPermissions(userId);
  if (userPerms) return userPerms;
  const rolePerms = getRolePermissions(role);
  return JSON.parse(JSON.stringify(rolePerms));
};

export const canManageAppointment = (user) => {
  if (!user) return false;
  const role = String(user.role).toLowerCase();
  if (role === 'admin') return true;
  
  return isTelesale(user) || isSaleOffline(user);
};
