// ============================================================
// Supabase Edge Function: scan-drive-folder
// Tự "soi" link Google Drive của khách: đọc các thư mục/tệp con rồi tự nhận diện
// đã có những loại source nào (Trước PT / Sau PT / Beauty / Feedback / Tái khám).
//
// Cần API key có bật Google Drive API:
//   1) Tạo project tại https://console.cloud.google.com → bật "Google Drive API"
//   2) Tạo API key (APIs & Services → Credentials → Create API key)
//   3) supabase secrets set GOOGLE_API_KEY=xxxxx
//   4) supabase functions deploy scan-drive-folder
//
// LƯU Ý: API key chỉ đọc được thư mục chia sẻ ở chế độ "Bất kỳ ai có đường liên kết".
// Thư mục để riêng tư sẽ không đọc được (trả về private=true) → nhân sự tick tay.
// ============================================================
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Bỏ dấu tiếng Việt + thường hoá để so khớp tên thư mục
function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// Quy tắc nhận diện loại source theo tên thư mục/tệp
const RULES: { key: string; any: string[] }[] = [
  { key: "truoc_pt", any: ["truoc pt", "truoc phau", "truoc mo", "before", "pre op", "preop", "b4"] },
  { key: "sau_pt", any: ["sau pt", "sau phau", "sau mo", "after", "post op", "postop"] },
  { key: "beauty", any: ["beauty", "lam dep", "review dep", "beauty shot"] },
  { key: "feedback", any: ["feedback", "phan hoi", "cam nhan", "review", "danh gia"] },
  { key: "tai_kham", any: ["tai kham", "recheck", "re-check", "follow up", "followup", "tk "] },
];

function detectTypes(names: string[]): string[] {
  const found = new Set<string>();
  for (const raw of names) {
    const n = norm(raw);
    for (const r of RULES) {
      if (r.any.some((kw) => n.includes(kw))) found.add(r.key);
    }
  }
  return [...found];
}

// Tách folder ID từ nhiều dạng link Google Drive
function extractFolderId(link: string): string | null {
  if (!link) return null;
  const m1 = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = link.match(/\/d\/([a-zA-Z0-9_-]+)/); // link tệp đơn
  if (m3) return m3[1];
  return null;
}

async function listChildren(folderId: string, key: string): Promise<{ names: string[]; ok: boolean; status: number }> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    key,
  });
  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return { names: [], ok: false, status: res.status };
  const data = await res.json().catch(() => ({}));
  const names: string[] = (data.files || []).map((f: { name: string }) => f.name || "");
  return { names, ok: true, status: 200 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ ok: false, error: "Chưa cấu hình GOOGLE_API_KEY" });

    const body = await req.json().catch(() => ({}));
    const rawLinks: string[] = Array.isArray(body.links) ? body.links : (body.link ? [body.link] : []);
    const links = rawLinks.filter((l) => typeof l === "string" && /^https?:\/\//i.test(l));
    if (links.length === 0) return json({ ok: false, error: "Không có link Drive hợp lệ" });

    const allNames: string[] = [];
    const foldersFound: string[] = [];
    let privateCount = 0;
    let readable = 0;

    for (const link of links) {
      const id = extractFolderId(link);
      if (!id) continue;
      // Liệt kê con trực tiếp
      const lvl1 = await listChildren(id, key);
      if (!lvl1.ok) { privateCount++; continue; }
      readable++;
      for (const nm of lvl1.names) { allNames.push(nm); foldersFound.push(nm); }
    }

    const types = detectTypes(allNames);
    return json({
      ok: true,
      types,
      folders: foldersFound.slice(0, 100),
      readableLinks: readable,
      privateLinks: privateCount,
    });
  } catch (e) {
    console.error("scan-drive-folder error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
