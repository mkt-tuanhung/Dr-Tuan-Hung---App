import os, re

src_dir = '/Users/mac/Downloads/Dr Tuan Hung - App/apps/web/src'
import_regex = re.compile(r"from\s+['\"]([^'\"]+)['\"]")
import_dynamic = re.compile(r"import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")

def check_import(filepath, import_path):
    if import_path.startswith('@/'):
        target = os.path.join(src_dir, import_path[2:])
    elif import_path.startswith('./') or import_path.startswith('../'):
        target = os.path.normpath(os.path.join(os.path.dirname(filepath), import_path))
    else:
        return # Skip node_modules

    original_target = target

    if not os.path.exists(target):
        if os.path.exists(target + '.js'):
            target += '.js'
        elif os.path.exists(target + '.jsx'):
            target += '.jsx'
        elif os.path.exists(target + '/index.js'):
            target += '/index.js'
        elif os.path.exists(target + '/index.jsx'):
            target += '/index.jsx'
        else:
            print(f"MISSING IMPORT in {filepath}: imported '{import_path}'")
            return

    if os.path.exists(target):
        dir_path, file_name = os.path.split(target)
        try:
            actual_files = os.listdir(dir_path)
            if file_name not in actual_files:
                for actual_file in actual_files:
                    if actual_file.lower() == file_name.lower():
                        print(f"CASE MISMATCH in {filepath}: imported '{import_path}' but file is '{actual_file}'")
        except Exception as e:
            pass

for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.js') or f.endswith('.jsx'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                try:
                    content = file.read()
                    for match in import_regex.findall(content):
                        check_import(filepath, match)
                    for match in import_dynamic.findall(content):
                        check_import(filepath, match)
                except:
                    pass
