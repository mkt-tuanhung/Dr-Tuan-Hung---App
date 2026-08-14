// ============================================================
// Supabase Edge Function: getfly-sync
// Kéo khách từ GetFly (/api/v6.1/accounts, limit/offset) -> marketing_data.
// Secrets: GETFLY_DOMAIN, GETFLY_API_KEY, (tuỳ chọn) GETFLY_LIST_PATH
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
  "/api/v5.0/accounts", "/api/accounts",
];
// limit/offset đã được chấp nhận; chỉ còn custom_fields cần đúng ĐỊNH DẠNG
// (nhiều khả năng là mảng JSON). Thử GET nhiều giá trị + POST body.
// {s}=limit, {o}=offset, {p}=trang.
type Attempt = { m: "GET" | "POST"; q?: string; b?: string };
const ATTEMPTS: Attempt[] = [
  { m: "GET", q: "custom_fields=%5B%5D&limit={s}&offset={o}" },   // custom_fields=[] (mã hoá)
  { m: "GET", q: "custom_fields=[]&limit={s}&offset={o}" },        // custom_fields=[] (thô)
  { m: "GET", q: "custom_fields=%7B%7D&limit={s}&offset={o}" },   // custom_fields={}
  { m: "GET", q: "custom_fields=null&limit={s}&offset={o}" },
  { m: "GET", q: "custom_fields=false&limit={s}&offset={o}" },
  { m: "GET", q: "custom_fields=all&limit={s}&offset={o}" },
  { m: "GET", q: "limit={s}&offset={o}" },
  { m: "POST", b: '{"limit":{s},"offset":{o},"custom_fields":[]}' },
  { m: "POST", b: '{"limit":{s},"offset":{o}}' },
  { m: "POST", b: '{"page_size":{s},"page":{p},"custom_fields":[]}' },
];
const fill = (t: string, page: number, size: number) =>
  t.replace(/\{p\}/g, String(page)).replace(/\{s\}/g, String(size)).replace(/\{o\}/g, String((page - 1) * size));
const attemptLabel = (a: Attempt) => `${a.m} ${a.q ?? a.b ?? ""}`;

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
function extractTotal(d: any): { totalPage: number; totalRecord: number } {
  const totalPage = Number(d?.total_page ?? d?.data?.total_page ?? d?.total_pages ?? d?.data?.total_pages ?? 0) || 0;
  const totalRecord = Number(d?.total_record ?? d?.data?.total_record ?? d?.total ?? d?.data?.total ?? 0) || 0;
  return { totalPage, totalRecord };
}

async function call(domain: string, apiKey: string, path: string, a: Attempt, page: number, size: number) {
  const headers: Record<string, string> = { "X-API-KEY": apiKey, "api_key": apiKey, "Accept": "application/json" };
  let r: Response;
  if (a.m === "GET") {
    const q = fill(a.q || "", page, size);
    r = await fetch(`https://${domain}${path}${q ? "?" + q : ""}`, { headers });
  } else {
    headers["Content-Type"] = "application/json";
    r = await fetch(`https://${domain}${path}`, { method: "POST", headers, body: fill(a.b || "{}", page, size) });
  }
  const text = await r.text();
  let d: any = {};
  try { d = JSON.parse(text); } catch { /* HTML */ }
  const msg = String(d?.message ?? d?.msg ?? "");
  const routeMissing = /not found|route/i.test(msg);
  const records = extractRecords(d);
  const { totalPage, totalRecord } = extractTotal(d);
  return { status: r.status, ok: r.ok && !routeMissing, msg, data: d, records, totalPage, totalRecord, snippet: text.slice(0, 140) };
}

async function detect(domain: string, apiKey: string): Promise<{ path: string | null; att: Attempt | null; tries: any[] }> {
  const forced = (Deno.env.get("GETFLY_LIST_PATH") || "").trim();
  const paths = forced ? [forced] : LIST_PATHS;
  const tries: any[] = [];
  const alive: string[] = [];
  for (const p of paths) {
    try {
      const res = await call(domain, apiKey, p, ATTEMPTS[0], 1, 20);
      tries.push({ path: p, att: attemptLabel(ATTEMPTS[0]), status: res.status, records: res.records.length, msg: res.msg || res.snippet });
      if (res.ok && res.status === 200) return { path: p, att: ATTEMPTS[0], tries };
      if (res.status !== 404) alive.push(p);
    } catch (e) { tries.push({ path: p, error: String((e as Error)?.message || e) }); }
  }
  for (const p of alive) {
    for (const a of ATTEMPTS.slice(1)) {
      try {
        const res = await call(domain, apiKey, p, a, 1, 20);
        tries.push({ path: p, att: attemptLabel(a), status: res.status, records: res.records.length, msg: res.msg || res.snippet });
        if (res.ok && res.status === 200) return { path: p, att: a, tries };
      } catch (e) { tries.push({ path: p, att: attemptLabel(a), error: String((e as Error)?.message || e) }); }
    }
  }
  return { path: null, att: null, tries };
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

    const { path, att, tries } = await detect(domain, apiKey);
    if (!path || !att) {
      const summary = tries.map((t: any) => `${t.path}[${t.att ?? ''}]→${t.status ?? t.error ?? '?'}${t.msg ? '(' + String(t.msg).slice(0, 45) + ')' : ''}`).join("  ·  ");
      return json({ ok: false, error: `Không cách gọi nào trúng (domain=${domain}). ${summary}`, tries });
    }

    if (body.probe) {
      const res = await call(domain, apiKey, path, att, 1, Math.min(pageSize, 5));
      const sample = res.records.slice(0, 3).map((c: Record<string, any>) => ({
        customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]),
        phone: findPhone(c), description: buildDescription(c), _raw_keys: Object.keys(c || {}),
      }));
      return json({ ok: true, probe: true, path, method: attemptLabel(att), total_page: res.totalPage, total_record: res.totalRecord, count_page1: res.records.length, sample, raw_first: res.records[0] ?? null, tries });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const maxPages = Math.min(Number(body.max_pages) || 200, 500);
    let page = 1, scanned = 0, upserted = 0, skippedNoPhone = 0, failed = 0;
    const seen = new Set<string>();
    for (;;) {
      const res = await call(domain, apiKey, path, att, page, pageSize);
      if (res.status !== 200 || !res.records.length) break;
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
      // Dừng khi đã hết: theo total_page nếu có, hoặc trang trả ít hơn cỡ trang.
      if ((res.totalPage && page >= res.totalPage) || res.records.length < pageSize || page >= maxPages) break;
      page++;
      await new Promise((r) => setTimeout(r, 200));
    }

    return json({ ok: true, path, method: attemptLabel(att), scanned, upserted, skipped_no_phone: skippedNoPhone, failed, pages: page });
  } catch (e) {
    console.error("getfly-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
