
export const normalize = (value) => {
  if (!value) return '';
  return value.toString().trim().toLowerCase();
};

export const matchUser = (val, user) => {
  if (!val || !user) return false;
  const normalizedVal = normalize(val);
  return normalizedVal === normalize(user.employeeId) || normalizedVal === normalize(user.id);
};

export const resolveEmployeeId = (value, users) => {
  if (!value || !users) return value;
  const user = users.find(u => matchUser(value, u));
  return user && user.employeeId ? user.employeeId : value;
};
