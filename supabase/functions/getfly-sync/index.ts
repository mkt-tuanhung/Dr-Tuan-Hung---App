// ============================================================
// Supabase Edge Function: getfly-sync
// Kéo khách từ GetFly CRM (endpoint "accounts" có version) -> marketing_data,
// hợp nhất theo SỐ ĐIỆN THOẠI. Tự dò route + kiểu phân trang đúng.
//
// Secrets: GETFLY_DOMAIN, GETFLY_API_KEY
//   (tuỳ chọn) GETFLY_LIST_PATH = ép route, vd /api/v6.1/accounts
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

const LIST_PATHS = [
  "/api/v6.1/accounts", "/api/v6.0/accounts", "/api/v6.2/accounts",
  "/api/v5.0/accounts", "/api/v4.0/accounts", "/api/v3.0/accounts",
  "/api/accounts",
];
// Nhiều kiểu tham số phân trang (GetFly mỗi bản khác nhau). {p}=trang, {s}=cỡ trang.
const QUERY_STYLES = [
  "page_size={s}&page={p}",
  "page_size={s}&page_index={p}",
  "page_size={s}&page_no={p}",
  "per_page={s}&page={p}",
  "limit={s}&page={p}",
  "page_size={s}",
  "page={p}",
  "",
];
const buildQuery = (style: string, page: number, size: number) => style.replace(/\{p\}/g, String(page)).replace(/\{s\}/g, String(size));

function normPhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!d.startsWith("0") && d.length === 9) d = "0" + d;
  return d;
}
function pick(obj: Record<string, any>, keys: string[]): string {
  for (const k of keys) { const v = obj?.[k]; if (v != null && String(v).trim() !== "") return String(v).trim(); }
  return "";
}
function findPhone(c: Record<string, any>): string {
  const direct = normPhone(pick(c, ["phone", "mobile", "phone_mobile", "tel", "hotline"]));
  if (direct) return direct;
  const contacts = c.contacts || c.contact || c.person || [];
  if (Array.isArray(contacts)) for (const ct of contacts) { const p = normPhone(pick(ct, ["phone_mobile", "mobile", "phone", "tel"])); if (p) return p; }
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
function extractRecords(d: any): any[] {
  const cands = [d?.records, d?.data?.records, d?.data?.accounts, d?.accounts, d?.data?.clients, d?.clients, d?.data?.data, Array.isArray(d?.data) ? d.data : null, Array.isArray(d) ? d : null];
  for (const c of cands) if (Array.isArray(c)) return c;
  return [];
}
function extractTotalPage(d: any): number {
  return Number(d?.total_page ?? d?.data?.total_page ?? d?.total_pages ?? d?.data?.total_pages ?? 1) || 1;
}

// Gọi route + query. API key gửi qua HEADER (đã xác thực OK).
async function call(domain: string, apiKey: string, path: string, query: string) {
  const url = `https://${domain}${path}${query ? "?" + query : ""}`;
  const r = await fetch(url, { headers: { "X-API-KEY": apiKey, "api_key": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  let d: any = {};
  try { d = JSON.parse(text); } catch { /* HTML */ }
  const msg = String(d?.message ?? d?.msg ?? "");
  const routeMissing = /not found|route/i.test(msg);
  const records = extractRecords(d);
  return { status: r.status, ok: r.ok, routeMissing, msg, data: d, records, totalPage: extractTotalPage(d), snippet: text.slice(0, 140) };
}

// Dò (route + kiểu phân trang) trả về danh sách hợp lệ.
async function detect(domain: string, apiKey: string): Promise<{ path: string | null; style: string | null; tries: any[] }> {
  const forced = (Deno.env.get("GETFLY_LIST_PATH") || "").trim();
  const paths = forced ? [forced] : LIST_PATHS;
  const tries: any[] = [];
  // Vòng 1: tìm route KHÔNG phải 404 (route tồn tại) bằng style mặc định.
  const alive: string[] = [];
  for (const p of paths) {
    try {
      const res = await call(domain, apiKey, p, buildQuery(QUERY_STYLES[0], 1, 20));
      tries.push({ path: p, style: QUERY_STYLES[0], status: res.status, records: res.records.length, msg: res.msg || res.snippet });
      if (res.ok && res.records.length >= 0 && !res.routeMissing && res.status === 200) return { path: p, style: QUERY_STYLES[0], tries };
      if (!res.routeMissing && res.status !== 404) alive.push(p);
    } catch (e) { tries.push({ path: p, error: String((e as Error)?.message || e) }); }
  }
  // Vòng 2: route tồn tại nhưng sai tham số -> thử các kiểu phân trang khác.
  for (const p of alive) {
    for (const style of QUERY_STYLES.slice(1)) {
      try {
        const res = await call(domain, apiKey, p, buildQuery(style, 1, 20));
        tries.push({ path: p, style, status: res.status, records: res.records.length, msg: res.msg || res.snippet });
        if (res.ok && res.status === 200 && !res.routeMissing) return { path: p, style, tries };
      } catch (e) { tries.push({ path: p, style, error: String((e as Error)?.message || e) }); }
    }
  }
  return { path: null, style: null, tries };
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

    const { path, style, tries } = await detect(domain, apiKey);
    if (!path || style == null) {
      const summary = tries.map((t: any) => `${t.path}[${t.style ?? ''}]→${t.status ?? t.error ?? '?'}${t.msg ? '(' + String(t.msg).slice(0, 40) + ')' : ''}`).join("  ·  ");
      return json({ ok: false, error: `Không route/tham số nào trúng (domain=${domain}). ${summary}`, tries });
    }

    if (body.probe) {
      const res = await call(domain, apiKey, path, buildQuery(style, 1, Math.min(pageSize, 5)));
      const sample = res.records.slice(0, 3).map((c: Record<string, any>) => ({
        customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]),
        phone: findPhone(c), description: buildDescription(c), _raw_keys: Object.keys(c || {}),
      }));
      return json({ ok: true, probe: true, path, style, total_page: res.totalPage, count_page1: res.records.length, sample, raw_first: res.records[0] ?? null, tries });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const maxPages = Math.min(Number(body.max_pages) || 100, 500);
    let page = 1, totalPage = 1, scanned = 0, upserted = 0, skippedNoPhone = 0, failed = 0;
    const seen = new Set<string>();
    do {
      const res = await call(domain, apiKey, path, buildQuery(style, page, pageSize));
      if (res.status !== 200) break;
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
        if (error) { failed++; console.error("upsert fail", phone, error.message); } else upserted++;
      }
      page++;
      await new Promise((r) => setTimeout(r, 200));
    } while (page <= totalPage && page <= maxPages);

    return json({ ok: true, path, style, scanned, upserted, skipped_no_phone: skippedNoPhone, failed, pages: Math.min(totalPage, maxPages) });
  } catch (e) {
    console.error("getfly-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
