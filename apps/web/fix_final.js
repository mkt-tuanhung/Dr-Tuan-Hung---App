const fs = require('fs');

const files = [
  'src/components/SaleOfflineKpiPersonalClean.jsx',
  'src/components/KpiSaleOfflineAdminProgressModule.jsx',
  'src/components/KpiSaleOfflineAdminModule.jsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("localStorage.getItem(key)")) {
    content = content.replace(/JSON\.parse\(localStorage\.getItem\(key\)\s*\|\|\s*['"`]\[\]['"`]\)/g, "getStorageItem(key, [])");
    if (!content.includes("getStorageItem")) {
        // Did not replace
    } else {
        if (!content.includes('utils/storageStore.js')) {
            const importStmt = "import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';\n";
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
