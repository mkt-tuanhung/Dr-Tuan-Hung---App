const fs = require('fs');
const path = require('path');

const replaceInFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add imports
  if (!content.includes('storageStore.js')) {
    content = `import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';\n` + content;
  }

  // Replace JSON.parse(localStorage.getItem(KEY) || '[]')
  content = content.replace(/JSON\.parse\(localStorage\.getItem\((.*?)\)\s*\|\|\s*'\[\]'\)/g, "getStorageItem($1, [])");
  // Replace JSON.parse(localStorage.getItem(KEY) || 'null') - if any
  content = content.replace(/JSON\.parse\(localStorage\.getItem\((.*?)\)\s*\|\|\s*'null'\)/g, "getStorageItem($1, null)");
  // Replace JSON.parse(localStorage.getItem(KEY))
  content = content.replace(/JSON\.parse\(localStorage\.getItem\((.*?)\)\)/g, "getStorageItem($1)");
  
  // Replace localStorage.setItem(KEY, JSON.stringify(VAL))
  content = content.replace(/localStorage\.setItem\((.*?),\s*JSON\.stringify\((.*?)\)\)/g, "setStorageItem($1, $2)");

  // Replace raw localStorage.getItem
  content = content.replace(/localStorage\.getItem\((.*?)\)/g, "getStorageItem($1)");
  // Replace raw localStorage.setItem
  content = content.replace(/localStorage\.setItem\((.*?),\s*(.*?)\)/g, "setStorageItem($1, $2)");
  // Replace raw localStorage.removeItem
  content = content.replace(/localStorage\.removeItem\((.*?)\)/g, "removeStorageItem($1)");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${filePath}`);
};

replaceInFile(path.join(__dirname, 'src/utils/userStorage.js'));
replaceInFile(path.join(__dirname, 'src/services/dataService.js'));
replaceInFile(path.join(__dirname, 'src/utils/staffExpenseClaimsStorage.js'));
