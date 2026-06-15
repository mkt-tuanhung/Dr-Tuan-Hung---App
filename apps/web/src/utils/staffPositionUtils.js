
import { getUsers } from './userStorage.js';

export const normalizePosition = (position) => {
  if (!position) return '';
  return position.toLowerCase().trim();
};

export const getStaffByPosition = (positionName) => {
  const users = getUsers();
  const normalizedTarget = normalizePosition(positionName);
  
  return users.filter(
    (u) => u.role === 'Nhân viên' && normalizePosition(u.departmentPosition) === normalizedTarget
  );
};
