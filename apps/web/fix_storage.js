const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
};

const files = walk('src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // We need to add the import if it's not there and we use it
  const needsImport = /localStorage\.(getItem|setItem|removeItem)/.test(content) && !content.includes("utils/storageStore.js");

  // Only replace for STORAGE_KEYS. Actually it's easier to replace all or just specific ones.
  // Actually, replacing all localStorage might break things like theme settings.
  // Let's replace ONLY for known keys.
  const knownKeys = [
    'clinic_users', 'clinic_current_user', 'pageDailyReports', 'kpiTargets',
    'revenueRecords', 'pagePhoneAssignments', 'customerAppointments',
    'monthlyPayrolls', 'staffExpenseClaims', 'attendanceRecords',
    'attendanceRequests', 'approvalNotifications', 'surgicalCareAssignments',
    'mediaDailyReports', 'cskhDailyReports', 'marketingDailyReports',
    'saleOfflineDailyReports'
  ];

  // For now, let's just make a regex to replace JSON.parse(localStorage.getItem('KEY') || '[]')
  // We can just use a regex for all known keys.
  
  knownKeys.forEach(key => {
    const getItemRegex = new RegExp(`JSON\\.parse\\(localStorage\\.getItem\\(['"\`]${key}['"\`]\\)\\s*\\|\\|\\s*['"\`]\\[\\]['"\`]\\)`, 'g');
    if (getItemRegex.test(content)) {
      content = content.replace(getItemRegex, `getStorageItem('${key}', [])`);
      changed = true;
    }

    const getItemNullRegex = new RegExp(`localStorage\\.getItem\\(['"\`]${key}['"\`]\\)`, 'g');
    if (getItemNullRegex.test(content)) {
      content = content.replace(getItemNullRegex, `getStorageItem('${key}')`);
      changed = true;
    }

    const setItemRegex = new RegExp(`localStorage\\.setItem\\(['"\`]${key}['"\`]\\s*,\\s*JSON\\.stringify\\(([^)]+)\\)\\)`, 'g');
    if (setItemRegex.test(content)) {
      content = content.replace(setItemRegex, `setStorageItem('${key}', $1)`);
      changed = true;
    }

    const setItemRawRegex = new RegExp(`localStorage\\.setItem\\(['"\`]${key}['"\`]\\s*,\\s*([^)]+)\\)`, 'g');
    if (setItemRawRegex.test(content)) {
      content = content.replace(setItemRawRegex, `setStorageItem('${key}', $1)`);
      changed = true;
    }
    
    const removeItemRegex = new RegExp(`localStorage\\.removeItem\\(['"\`]${key}['"\`]\\)`, 'g');
    if (removeItemRegex.test(content)) {
      content = content.replace(removeItemRegex, `removeStorageItem('${key}')`);
      changed = true;
    }
  });

  if (changed) {
    if (!content.includes('getStorageItem') && !content.includes('setStorageItem') && !content.includes('removeStorageItem')) {
        // Did not actually inject the words
    } else {
        if (!content.includes('utils/storageStore.js')) {
            const importStmt = "import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';\n";
            // Insert after the last import, or at the top
            const lastImportIndex = content.lastIndexOf('import ');
            if (lastImportIndex !== -1) {
                const endOfLine = content.indexOf('\n', lastImportIndex);
                content = content.slice(0, endOfLine + 1) + importStmt + content.slice(endOfLine + 1);
            } else {
                content = importStmt + content;
            }
        }
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
  }
});
