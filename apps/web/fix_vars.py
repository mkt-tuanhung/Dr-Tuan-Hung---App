import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changed = False

    # For variables like APPOINTMENTS_KEY, SURGICAL_ASSIGNMENTS_KEY, TELESALE_DAILY_REPORTS_KEY, etc.
    # JSON.parse(localStorage.getItem(VAR) || '[]')
    pattern1 = re.compile(r"JSON\.parse\(localStorage\.getItem\(([A-Z_]+)\)\s*\|\|\s*['\"`]\[\]['\"`]\)")
    if pattern1.search(content):
        content = pattern1.sub(r"getStorageItem(\1, [])", content)
        changed = True

    # localStorage.getItem(VAR)
    pattern2 = re.compile(r"localStorage\.getItem\(([A-Z_]+)\)")
    if pattern2.search(content):
        content = pattern2.sub(r"getStorageItem(\1)", content)
        changed = True

    # localStorage.setItem(VAR, JSON.stringify(var))
    pattern3 = re.compile(r"localStorage\.setItem\(([A-Z_]+)\s*,\s*JSON\.stringify\((.*?)\)\)")
    if pattern3.search(content):
        content = pattern3.sub(r"setStorageItem(\1, \2)", content)
        changed = True

    # localStorage.setItem(VAR, var)
    pattern4 = re.compile(r"localStorage\.setItem\(([A-Z_]+)\s*,\s*([^)]+)\)")
    if pattern4.search(content):
        content = pattern4.sub(r"setStorageItem(\1, \2)", content)
        changed = True

    # localStorage.removeItem(VAR)
    pattern5 = re.compile(r"localStorage\.removeItem\(([A-Z_]+)\)")
    if pattern5.search(content):
        content = pattern5.sub(r"removeStorageItem(\1)", content)
        changed = True

    if changed:
        if 'getStorageItem' in content or 'setStorageItem' in content or 'removeStorageItem' in content:
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

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))

