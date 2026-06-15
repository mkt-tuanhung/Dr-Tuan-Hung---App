import os
import re

known_keys = [
    'clinic_users', 'clinic_current_user', 'pageDailyReports', 'kpiTargets',
    'revenueRecords', 'pagePhoneAssignments', 'customerAppointments',
    'monthlyPayrolls', 'staffExpenseClaims', 'attendanceRecords',
    'attendanceRequests', 'approvalNotifications', 'surgicalCareAssignments',
    'mediaDailyReports', 'cskhDailyReports', 'marketingDailyReports',
    'saleOfflineDailyReports'
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changed = False

    for key in known_keys:
        # JSON.parse(localStorage.getItem('key') || '[]')
        pattern1 = re.compile(r"JSON\.parse\(localStorage\.getItem\(['\"`]" + key + r"['\"`]\)\s*\|\|\s*['\"`]\[\]['\"`]\)")
        if pattern1.search(content):
            content = pattern1.sub(f"getStorageItem('{key}', [])", content)
            changed = True
            
        # localStorage.getItem('key')
        pattern2 = re.compile(r"localStorage\.getItem\(['\"`]" + key + r"['\"`]\)")
        if pattern2.search(content):
            content = pattern2.sub(f"getStorageItem('{key}')", content)
            changed = True

        # localStorage.setItem('key', JSON.stringify(var))
        pattern3 = re.compile(r"localStorage\.setItem\(['\"`]" + key + r"['\"`]\s*,\s*JSON\.stringify\((.*?)\)\)")
        if pattern3.search(content):
            content = pattern3.sub(f"setStorageItem('{key}', \\1)", content)
            changed = True

        # localStorage.setItem('key', var)
        pattern4 = re.compile(r"localStorage\.setItem\(['\"`]" + key + r"['\"`]\s*,\s*([^)]+)\)")
        if pattern4.search(content):
            content = pattern4.sub(f"setStorageItem('{key}', \\1)", content)
            changed = True

        # localStorage.removeItem('key')
        pattern5 = re.compile(r"localStorage\.removeItem\(['\"`]" + key + r"['\"`]\)")
        if pattern5.search(content):
            content = pattern5.sub(f"removeStorageItem('{key}')", content)
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

