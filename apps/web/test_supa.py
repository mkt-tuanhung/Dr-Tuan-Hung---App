import requests

url = ""
key = ""
with open('/Users/mac/Downloads/Dr Tuan Hung - App/apps/web/.env') as f:
    for line in f:
        if line.startswith('VITE_SUPABASE_URL='):
            url = line.strip().split('=', 1)[1].strip('"').strip("'")
        elif line.startswith('VITE_SUPABASE_ANON_KEY='):
            key = line.strip().split('=', 1)[1].strip('"').strip("'")

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}
res = requests.get(f"{url}/rest/v1/leave_requests?select=*,profiles(full_name)", headers=headers)
print("Relationship check:", res.text)

res2 = requests.get(f"{url}/rest/v1/leave_requests?select=*&or=(and(date.gte.2026-06-01,date.lte.2026-06-30),status.eq.pending)", headers=headers)
print("Query check:", res2.text)
