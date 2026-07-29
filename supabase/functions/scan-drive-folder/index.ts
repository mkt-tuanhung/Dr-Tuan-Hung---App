// ============================================================
// Supabase Edge Function: scan-drive-folder (Service Account)
// Liệt kê thư mục con trong link Google Drive của khách bằng SERVICE ACCOUNT
// (API key không liệt kê được thư mục con), rồi phân loại 5 loại source:
// Trước PT / Sau PT / Beauty / Feedback / Tái khám (từ khoá + AI Gemini).
//
// SETUP (một lần):
//   1) console.cloud.google.com → IAM & Admin → Service Accounts → Create
//      → copy EMAIL của service account (dạng ...@...iam.gserviceaccount.com)
//   2) Vào service account đó → Keys → Add key → JSON → tải file .json về
//   3) Chia sẻ THƯ MỤC GỐC chứa source (vd folder "KHO SOURCE" / "Tháng 4"…)
//      cho EMAIL service account, quyền Người xem (Viewer). Thư mục con tự kế thừa.
//   4) Nạp key (base64) + deploy:
//        supabase secrets set GOOGLE_SA_B64="$(base64 -i service-account.json)"
//        supabase functions deploy scan-drive-folder
//   (GEMINI_API_KEY đã có sẵn — dùng cho lớp AI. Không có cũng chạy nhờ từ khoá.)
// ============================================================
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const KEYS = ["truoc_pt", "sau_pt", "beauty", "feedback", "tai_kham"];

function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase() + " ";
}
const RULES: { key: string; any: string[] }[] = [
  { key: "truoc_pt", any: ["truoc pt", "truoc phau", "truoc mo", "truoc khi", "before", "pre op", "preop", "b4", "truoc"] },
  { key: "sau_pt", any: ["sau pt", "sau phau", "sau mo", "hau phau", "after", "post op", "postop", "sau "] },
  { key: "beauty", any: ["beauty", "lam dep", "beauty shot"] },
  { key: "feedback", any: ["feedback", "phan hoi", "cam nhan", "review", "danh gia", "cam on"] },
  { key: "tai_kham", any: ["tai kham", "tham kham", "re kham", "recheck", "re-check", "follow up", "followup"] },
];
function keywordTypes(names: string[]): string[] {
  const found = new Set<string>();
  for (const raw of names) {
    const n = norm(raw);
    for (const r of RULES) if (r.any.some((k) => n.includes(k))) found.add(r.key);
  }
  return [...found];
}

function extractFolderId(link: string): string | null {
  if (!link) return null;
  let m = link.match(/\/folders\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
  m = link.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m) return m[1];
  m = link.match(/\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
  return null;
}

// ---- Ký JWT RS256 và lấy access token cho service account ----
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const input = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claim)))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(input));
  const jwt = `${input}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const tok = await res.json();
  if (!tok.access_token) throw new Error("Không lấy được access token: " + (tok.error_description || tok.error || "unknown"));
  return tok.access_token;
}

async function geminiTypes(names: string[]): Promise<string[]> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key || !names.length) return [];
  const prompt = `Phân loại các THƯ MỤC Google Drive của cơ sở thẩm mỹ vào các loại: truoc_pt (trước phẫu thuật), sau_pt (sau phẫu thuật, "sau N ngày", hậu phẫu), beauty (ảnh beauty), feedback (cảm nhận/review khách), tai_kham (tái khám/thăm khám lại). Bỏ qua thư mục không thuộc (vd "PT" một mình, "footage điện thoại", "raw").
Danh sách:
${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}
Trả DUY NHẤT JSON {"types":[các key có mặt trong ${JSON.stringify(KEYS)}]}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.types) ? parsed.types.filter((t: string) => KEYS.includes(t)) : [];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const rawJson = Deno.env.get("GOOGLE_SA_JSON");
    const b64 = Deno.env.get("GOOGLE_SA_B64");
    let sa: { client_email: string; private_key: string };
    try {
      if (rawJson) sa = JSON.parse(rawJson);
      else if (b64) sa = JSON.parse(atob(b64.replace(/\s/g, "")));
      else return json({ ok: false, error: "Chưa cấu hình GOOGLE_SA_JSON (service account)" });
    } catch { return json({ ok: false, error: "Service account key không hợp lệ" }); }
    if (!sa?.client_email || !sa?.private_key) return json({ ok: false, error: "Thiếu client_email/private_key trong service account" });

    const body = await req.json().catch(() => ({}));
    const rawLinks: string[] = Array.isArray(body.links) ? body.links : (body.link ? [body.link] : []);
    const links = rawLinks.filter((l) => typeof l === "string" && /^https?:\/\//i.test(l));
    if (!links.length) return json({ ok: false, error: "Không có link Drive hợp lệ" });

    const token = await getAccessToken(sa);
    const FOLDER = "application/vnd.google-apps.folder";

    // ---- mode: 'sources' -> tìm các THƯ MỤC NGUỒN (khách hàng) để tự tạo record ----
    // Thư mục nguồn = tên bắt đầu bằng "DD.MM ...". Trả kèm ancestors (dịch vụ/năm/tháng).
    if (body.mode === "sources") {
      const listF = async (fid: string): Promise<{ ok: boolean; files: Record<string, any>[] }> => {
        const out: Record<string, any>[] = [];
        let pageToken = "";
        for (let p = 0; p < 30; p++) {
          const params = new URLSearchParams({
            q: `'${fid}' in parents and trashed = false and mimeType = '${FOLDER}'`,
            fields: "nextPageToken,files(id,name,mimeType,createdTime,webViewLink)", pageSize: "1000",
            supportsAllDrives: "true", includeItemsFromAllDrives: "true",
          });
          if (pageToken) params.set("pageToken", pageToken);
          const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) { if (p === 0) return { ok: false, files: [] }; break; }
          const data = await res.json();
          if (Array.isArray(data.files)) out.push(...data.files);
          if (!data.nextPageToken) break;
          pageToken = data.nextPageToken;
        }
        return { ok: true, files: out };
      };
      const DATE_RE = /^\s*\d{1,2}\s*[.\-/]\s*\d{1,2}(\D|$)/;
      const sources: Record<string, unknown>[] = [];
      const guard = { n: 0 };
      const walk = async (fid: string, path: string[], depth: number) => {
        if (guard.n > 2000 || depth > 6) return;
        const r = await listF(fid);
        if (!r.ok) return;
        for (const f of r.files) {
          guard.n++;
          if (DATE_RE.test(f.name || "")) {
            sources.push({ id: f.id, name: f.name || "", link: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`, created: f.createdTime || null, ancestors: path });
          } else {
            await walk(f.id, [...path, f.name || ""], depth + 1);
          }
        }
      };
      for (const link of links) {
        const rootId = extractFolderId(link);
        if (!rootId) continue;
        let rootName = "";
        try {
          const rm = await fetch(`https://www.googleapis.com/drive/v3/files/${rootId}?fields=name&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
          if (rm.ok) rootName = (await rm.json()).name || "";
        } catch { /* bỏ qua */ }
        await walk(rootId, rootName ? [rootName] : [], 0);
      }
      return json({ ok: true, sources, count: sources.length });
    }

    // mode: 'files' -> trả về danh sách TỪNG file (ảnh thu nhỏ, dung lượng, thời lượng, thư mục)
    const wantFiles = body.mode === "files";
    const fileFields = wantFiles
      ? "files(id,name,mimeType,size,thumbnailLink,webViewLink,createdTime,videoMediaMetadata)"
      : "files(id,name,mimeType)";

    // Liệt kê con của 1 thư mục — CÓ lật trang (pageToken) để lấy HẾT file, không dừng ở 1000
    const listChildren = async (fid: string): Promise<{ ok: boolean; status: number; files: Record<string, any>[] }> => {
      const out: Record<string, any>[] = [];
      let pageToken = "";
      for (let p = 0; p < 30; p++) { // tối đa 30 trang = 30.000 file / thư mục
        const params = new URLSearchParams({
          q: `'${fid}' in parents and trashed = false`,
          fields: `nextPageToken,${fileFields}`, pageSize: "1000",
          supportsAllDrives: "true", includeItemsFromAllDrives: "true",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { if (p === 0) return { ok: false, status: res.status, files: [] }; break; }
        const data = await res.json();
        if (Array.isArray(data.files)) out.push(...data.files);
        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
      }
      return { ok: true, status: 200, files: out };
    };

    const names: string[] = [];
    const files: Record<string, unknown>[] = [];
    const MAX_FILES = 20000;
    let readable = 0, priv = 0, noId = 0, videoCount = 0, imageCount = 0;
    const diag: string[] = [];
    const pushFile = (f: Record<string, any>, folder: string) => {
      const kind = (f.mimeType || "").startsWith("video/") ? "video" : "image";
      if (kind === "video") videoCount++; else imageCount++;
      if (wantFiles && files.length < MAX_FILES) {
        files.push({
          drive_id: f.id, name: f.name || "", kind, mime: f.mimeType || "",
          size: Number(f.size) || 0,
          duration_ms: f.videoMediaMetadata?.durationMillis ? Number(f.videoMediaMetadata.durationMillis) : null,
          thumb: f.thumbnailLink || null, link: f.webViewLink || null,
          created: f.createdTime || null, folder,
        });
      }
    };
    for (const link of links) {
      const rootId = extractFolderId(link);
      if (!rootId) { noId++; diag.push("no-id"); continue; }
      const first = await listChildren(rootId);
      if (!first.ok) { priv++; diag.push("http" + first.status); continue; }
      readable++;
      diag.push("ok:" + first.files.length);
      // BFS toàn bộ cây con (giới hạn số thư mục để tránh quá tải)
      const queue: { id: string; name: string }[] = [];
      let guard = 0;
      const maxFolders = wantFiles ? 600 : 80;
      for (const f of first.files) {
        if (f.mimeType === FOLDER) { names.push(f.name || ""); queue.push({ id: f.id, name: f.name || "" }); }
        else if ((f.mimeType || "").startsWith("video/") || (f.mimeType || "").startsWith("image/")) pushFile(f, "");
      }
      while (queue.length && guard < maxFolders) {
        guard++;
        const cur = queue.shift()!;
        const sub = await listChildren(cur.id);
        if (!sub.ok) continue;
        for (const f of sub.files) {
          if (f.mimeType === FOLDER) queue.push({ id: f.id, name: f.name || "" });
          else if ((f.mimeType || "").startsWith("video/") || (f.mimeType || "").startsWith("image/")) pushFile(f, cur.name);
        }
      }
    }

    // Chế độ 'files' KHÔNG gọi AI (miễn phí) — phân loại thư mục chỉ dùng ở chế độ đếm.
    const types = wantFiles ? keywordTypes(names) : [...new Set([...keywordTypes(names), ...(await geminiTypes(names))])];
    return json({ ok: true, types, folders: names.slice(0, 100), videoCount, imageCount, files: wantFiles ? files : undefined, fileCount: files.length, readableLinks: readable, privateLinks: priv, noId, diag });
  } catch (e) {
    console.error("scan-drive-folder error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
