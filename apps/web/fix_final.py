import os

files = [
    'src/components/SaleOfflineKpiPersonalClean.jsx',
    'src/components/KpiSaleOfflineAdminProgressModule.jsx',
    'src/components/KpiSaleOfflineAdminModule.jsx'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    import re
    pattern = re.compile(r"JSON\.parse\(localStorage\.getItem\(key\)\s*\|\|\s*['\"`]\[\]['\"`]\)")
    if pattern.search(content):
        content = pattern.sub("getStorageItem(key, [])", content)
        
        if 'getStorageItem' in content:
            if 'utils/storageStore.js' not in content:
                import_stmt = "import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';\n"
                last_import = content.rfind('import ')
                if last_import != -1:
                    end_of_line = content.find('\n', last_import)
                    content = content[:end_of_line + 1] + import_stmt + content[end_of_line + 1:]
                else:
                    content = import_stmt + content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

