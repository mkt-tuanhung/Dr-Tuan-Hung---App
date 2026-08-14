// ============================================================
// Supabase Edge Function: getfly-sync
// Kéo danh sách khách hàng từ GetFly CRM -> đổ vào module "Data khách hàng"
// (bảng marketing_data), hợp nhất theo SỐ ĐIỆN THOẠI (trùng thì cập nhật
// tên/mô tả, KHÔNG ghi đè trạng thái & trực page đã gán tay).
//
// Secrets (Supabase → Project Settings → Edge Functions → Secrets):
//   GETFLY_DOMAIN    = drtuanhung.getflycrm.com   (chỉ tên miền, không http://)
//   GETFLY_API_KEY   = <API Key: Getfly → Cài đặt → Tích hợp → Getfly API Key>
//   GETFLY_LIST_PATH = (tuỳ chọn) route lấy danh sách, vd /api/client/gets
//                      — nếu để trống, function TỰ DÒ trong probe.
//
// Gọi:
//   { probe: true } -> TỰ DÒ route đúng + trả dữ liệu thô (KHÔNG ghi)
//   {}              -> kéo hết, upsert vào marketing_data theo phone
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Các route lấy danh sách khách khả dĩ của GetFly (thử lần lượt tới khi trúng).
const LIST_PATHS = [
  "/api/client/gets",
  "/api/client/list",
  "/api/client",
  "/api/clients",
  "/api/customer/gets",
  "/api/customer/list",
  "/api/client/getlist",
];

function normPhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!d.startsWith("0") && d.length === 9) d = "0" + d;
  return d;
}
function pick(obj: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
function findPhone(c: Record<string, any>): string {
  const direct = normPhone(pick(c, ["phone", "mobile", "phone_mobile", "tel", "hotline"]));
  if (direct) return direct;
  const contacts = c.contacts || c.contact || c.person || [];
  if (Array.isArray(contacts)) {
    for (const ct of contacts) {
      const p = normPhone(pick(ct, ["phone_mobile", "mobile", "phone", "tel"]));
      if (p) return p;
    }
  }
  return "";
}
function buildDescription(c: Record<string, any>): string {
  const parts: string[] = [];
  const source = pick(c, ["source_name", "source", "utm_source", "lead_source"]);
  if (source) parts.push(`Nguồn: ${source}`);
  const tags = c.tags ?? c.tag ?? c.tag_name;
  const tagStr = Array.isArray(tags) ? tags.map((t: any) => t?.name ?? t).filter(Boolean).join(", ") : (tags ? String(tags) : "");
  if (tagStr) parts.push(`Tag: ${tagStr}`);
  const note = pick(c, ["note", "description", "content", "account_note"]);
  if (note) parts.push(note);
  return parts.join(" · ") || "";
}
// Dò mảng khách trong nhiều dạng response khác nhau của GetFly.
function extractRecords(d: any): any[] {
  const cands = [d?.records, d?.data?.records, d?.data?.clients, d?.clients, d?.data?.data, Array.isArray(d?.data) ? d.data : null, Array.isArray(d) ? d : null];
  for (const c of cands) if (Array.isArray(c)) return c;
  return [];
}
function extractTotalPage(d: any): number {
  return Number(d?.total_page ?? d?.data?.total_page ?? d?.total_pages ?? d?.data?.total_pages ?? d?.data?.total_pages_count ?? 1) || 1;
}

// Gọi 1 route + phân trang. Gửi API key ở CẢ header lẫn query cho chắc.
async function callList(domain: string, apiKey: string, path: string, page: number, pageSize: number) {
  const url = `https://${domain}${path}?page=${page}&page_size=${pageSize}&api_key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { headers: { "X-API-KEY": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  let d: any = {};
  try { d = JSON.parse(text); } catch { /* HTML/redirect */ }
  const routeMissing = typeof (d?.message ?? d?.msg) === "string" && /not found|route|404/i.test(String(d?.message ?? d?.msg));
  const ok = r.ok && !routeMissing;
  return { status: r.status, ok, data: d, records: ok ? extractRecords(d) : [], totalPage: extractTotalPage(d), snippet: text.slice(0, 160) };
}

// Tìm route trả về danh sách hợp lệ (ưu tiên route đã cấu hình sẵn).
async function detectPath(domain: string, apiKey: string): Promise<{ path: string | null; tries: any[] }> {
  const forced = (Deno.env.get("GETFLY_LIST_PATH") || "").trim();
  const paths = forced ? [forced] : LIST_PATHS;
  const tries: any[] = [];
  let best: string | null = null;
  for (const p of paths) {
    try {
      const res = await callList(domain, apiKey, p, 1, 2);
      tries.push({ path: p, status: res.status, ok: res.ok, records: res.records.length, msg: res.data?.message ?? res.data?.msg ?? res.snippet });
      if (res.ok && (res.records.length > 0 || res.status === 200)) { best = p; break; }
    } catch (e) {
      tries.push({ path: p, error: String((e as Error)?.message || e) });
    }
  }
  return { path: best, tries };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const domain = (Deno.env.get("GETFLY_DOMAIN") || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const apiKey = Deno.env.get("GETFLY_API_KEY") || "";
    if (!domain) return json({ ok: false, error: "Chưa cấu hình GETFLY_DOMAIN" });
    if (!apiKey) return json({ ok: false, error: "Chưa cấu hình GETFLY_API_KEY" });

    const body = await req.json().catch(() => ({}));
    const pageSize = Math.min(Number(body.page_size) || 100, 200);

    // ---- Dò route đúng ----
    const { path, tries } = await detectPath(domain, apiKey);
    if (!path) {
      return json({ ok: false, error: "Không tìm được route API GetFly đúng — xem 'tries' để biết route/HTTP nào GetFly trả về (gửi cho kỹ thuật).", tries });
    }

    // ---- KIỂM TRA: trả dữ liệu thô + xem trước map (không ghi) ----
    if (body.probe) {
      const res = await callList(domain, apiKey, path, 1, Math.min(pageSize, 5));
      const sample = res.records.slice(0, 3).map((c: Record<string, any>) => ({
        customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]),
        phone: findPhone(c),
        description: buildDescription(c),
        _raw_keys: Object.keys(c || {}),
      }));
      return json({ ok: true, probe: true, path, total_page: res.totalPage, count_page1: res.records.length, sample, raw_first: res.records[0] ?? null, tries });
    }

    // ---- KÉO THẬT ----
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const maxPages = Math.min(Number(body.max_pages) || 100, 500);
    let page = 1, totalPage = 1, scanned = 0, upserted = 0, skippedNoPhone = 0, failed = 0;
    const seen = new Set<string>();

    do {
      const res = await callList(domain, apiKey, path, page, pageSize);
      if (!res.ok) break;
      totalPage = res.totalPage;
      for (const c of res.records) {
        scanned++;
        const phone = findPhone(c);
        if (!phone) { skippedNoPhone++; continue; }
        if (seen.has(phone)) continue;
        seen.add(phone);
        const name = pick(c, ["account_name", "client_name", "name", "full_name"]) || null;
        const description = buildDescription(c) || null;
        const { error } = await sb.from("marketing_data").upsert({ phone, customer_name: name, description }, { onConflict: "phone" });
        if (error) { failed++; console.error("upsert fail", phone, error.message); }
        else upserted++;
      }
      page++;
      await new Promise((r) => setTimeout(r, 200));
    } while (page <= totalPage && page <= maxPages);

    return json({ ok: true, path, scanned, upserted, skipped_no_phone: skippedNoPhone, failed, pages: Math.min(totalPage, maxPages) });
  } catch (e) {
    console.error("getfly-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
