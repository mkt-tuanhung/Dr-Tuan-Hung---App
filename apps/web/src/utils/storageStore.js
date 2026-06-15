import localforage from 'localforage';

// Global memory cache for synchronous access
const memoryCache = {};

// Keys used in the app
const STORAGE_KEYS = [
  'clinic_users',
  'clinic_current_user',
  'pageDailyReports',
  'kpiTargets',
  'revenueRecords',
  'pagePhoneAssignments',
  'customerAppointments',
  'monthlyPayrolls',
  'staffExpenseClaims',
  'attendanceRecords',
  'attendanceRequests',
  'approvalNotifications',
  'surgicalCareAssignments'
];

export const initializeStorage = async () => {
  // Configure localforage to use IndexedDB
  localforage.config({
    name: 'DrTuanHungApp',
    storeName: 'offline_data'
  });

  // Migrate data from localStorage to localforage (if any exists)
  for (const key of STORAGE_KEYS) {
    const lsData = localStorage.getItem(key);
    if (lsData) {
      try {
        const parsed = JSON.parse(lsData);
        await localforage.setItem(key, parsed);
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Migration error for ${key}:`, e);
      }
    }
  }

  // Load all data from localforage into memory
  for (const key of STORAGE_KEYS) {
    const data = await localforage.getItem(key);
    memoryCache[key] = data || null;
  }
};

export const getStorageItem = (key, defaultValue = null) => {
  return memoryCache[key] !== undefined && memoryCache[key] !== null ? memoryCache[key] : defaultValue;
};

export const setStorageItem = (key, value) => {
  memoryCache[key] = value;
  localforage.setItem(key, value).catch(e => console.error(`Failed to save ${key} to localforage:`, e));
};

export const removeStorageItem = (key) => {
  memoryCache[key] = null;
  localforage.removeItem(key).catch(e => console.error(`Failed to remove ${key} from localforage:`, e));
};
