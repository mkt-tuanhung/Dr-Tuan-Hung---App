// ============================================================
// Supabase Edge Function: getfly-sync
// Kéo khách từ GetFly /api/v6.1/accounts -> marketing_data (hợp nhất theo SĐT).
//
// Đã xác nhận bằng curl thật:
//   GET ?fields=...&limit=..&offset=.. — header X-API-KEY — phân trang has_more.
//   SĐT: phone_office (cấp khách) hoặc contacts[].phone_home.
//   Danh sách sắp theo id DESC (khách MỚI NHẤT trước) -> đồng bộ định kỳ chỉ
//   cần quét vài trang đầu là bắt được khách mới.
//
// Gọi:
//   {}                     -> kéo FULL (mặc định tối đa 300 trang x 200 = 60.000 khách)
//   { max_pages: 2 }       -> kéo nhanh N trang đầu (dùng cho cron 5 phút)
//   { probe: true }        -> kiểm tra kết nối + xem trước, không ghi
//   { start_page: 51 }     -> kéo tiếp từ trang 51 (nếu lần trước chưa hết)
//
// Ghi theo LÔ (1 upsert / trang 200 khách) -> kéo full rất nhanh.
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

const LIST_PATHS = ["/api/v6.1/accounts", "/api/v6.0/accounts", "/api/v6.2/accounts"];
const FIELDS = "id,account_code,account_name,description,phone_office,email,account_source,created_at,contacts";
const QUERY_STYLES = [
  `fields=${FIELDS}&limit={s}&offset={o}`,
  "fields=id,account_name,phone_office,contacts&limit={s}&offset={o}",
  `fields=${FIELDS}`,
];
const fill = (t: string, page: number, size: number) =>
  t.replace(/\{p\}/g, String(page)).replace(/\{s\}/g, String(size)).replace(/\{o\}/g, String((page - 1) * size));

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
// SĐT: phone_office (cấp khách) -> contacts[].phone_home / phone_mobile.
function findPhone(c: Record<string, any>): string {
  const direct = normPhone(pick(c, ["phone_office", "phone", "mobile", "phone_mobile", "phone_home", "tel", "hotline"]));
  if (direct) return direct;
  const contacts = c.contacts || c.contact || [];
  if (Array.isArray(contacts)) {
    for (const ct of contacts) {
      const p = normPhone(pick(ct, ["phone_home", "phone_mobile", "mobile", "phone", "phone_office", "tel"]));
      if (p) return p;
    }
  }
  return "";
}
function buildDescription(c: Record<string, any>): string {
  const parts: string[] = [];
  const source = pick(c, ["account_source", "source_name", "source"]);
  if (source) parts.push(`Nguồn: ${source}`);
  const email = pick(c, ["email"]);
  if (email) parts.push(email);
  const note = pick(c, ["description", "note", "content"]);
  if (note) parts.push(note);
  return parts.join(" · ") || "";
}
function extractRecords(d: any): any[] {
  const cands = [d?.records, d?.accounts, d?.data?.records, d?.data?.accounts, d?.data?.data, Array.isArray(d?.data) ? d.data : null, Array.isArray(d) ? d : null];
  for (const c of cands) if (Array.isArray(c)) return c;
  return [];
}

async function call(domain: string, apiKey: string, path: string, style: string, page: number, size: number) {
  const q = fill(style, page, size);
  const r = await fetch(`https://${domain}${path}${q ? "?" + q : ""}`, {
    headers: { "X-API-KEY": apiKey, "Accept": "application/json" },
  });
  const text = await r.text();
  let d: any = {};
  try { d = JSON.parse(text); } catch { /* HTML */ }
  const msg = String(d?.message ?? d?.msg ?? "");
  const routeMissing = /not found|route/i.test(msg);
  const records = extractRecords(d);
  const hasMore = d?.has_more === true;
  return { status: r.status, ok: r.ok && !routeMissing, msg, data: d, records, hasMore, snippet: text.slice(0, 140) };
}

async function detect(domain: string, apiKey: string): Promise<{ path: string | null; style: string | null; tries: any[] }> {
  const forced = (Deno.env.get("GETFLY_LIST_PATH") || "").trim();
  const paths = forced ? [forced] : LIST_PATHS;
  const tries: any[] = [];
  for (const p of paths) {
    for (const style of QUERY_STYLES) {
      try {
        const res = await call(domain, apiKey, p, style, 1, 5);
        tries.push({ path: p, style, status: res.status, records: res.records.length, msg: res.msg || res.snippet });
        if (res.ok && res.status === 200) return { path: p, style, tries };
        if (res.status === 404) break;
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
    const pageSize = Math.min(Number(body.page_size) || 200, 500);   // 200/trang cho kéo nhanh
    const maxPages = Math.min(Number(body.max_pages) || 300, 1000);  // full: tới 60.000 khách
    const startPage = Math.max(Number(body.start_page) || 1, 1);

    const { path, style, tries } = await detect(domain, apiKey);
    if (!path || !style) {
      const summary = tries.map((t: any) => `${t.path}[${t.style ?? ''}]→${t.status ?? t.error ?? '?'}${t.msg ? '(' + String(t.msg).slice(0, 45) + ')' : ''}`).join("  ·  ");
      return json({ ok: false, error: `Không cách gọi nào trúng (domain=${domain}). ${summary}`, tries });
    }

    // ---- KIỂM TRA: xem trước map, không ghi ----
    if (body.probe) {
      const res = await call(domain, apiKey, path, style, 1, 5);
      const sample = res.records.slice(0, 3).map((c: Record<string, any>) => ({
        customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]),
        phone: findPhone(c), description: buildDescription(c),
      }));
      return json({ ok: true, probe: true, path, style, has_more: res.hasMore, count_page1: res.records.length, sample });
    }

    // ---- KÉO: ghi theo LÔ (1 upsert / trang) ----
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let page = startPage, pagesDone = 0, scanned = 0, upserted = 0, skippedNoPhone = 0, failed = 0;
    let stoppedEarly = false;
    const seen = new Set<string>();
    const started = Date.now();
    const TIME_BUDGET_MS = 110_000; // dừng an toàn trước giới hạn chạy của edge function

    for (;;) {
      const res = await call(domain, apiKey, path, style, page, pageSize);
      if (res.status !== 200 || !res.records.length) break;

      const rows: Record<string, unknown>[] = [];
      for (const c of res.records) {
        scanned++;
        const phone = findPhone(c);
        if (!phone) { skippedNoPhone++; continue; }
        if (seen.has(phone)) continue;   // trùng trong cùng đợt kéo
        seen.add(phone);
        rows.push({
          phone,
          customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]) || null,
          description: buildDescription(c) || null,
        });
      }
      if (rows.length) {
        // Chỉ set tên + mô tả -> giữ nguyên trạng thái & người phụ trách đã gán tay.
        const { error } = await sb.from("marketing_data").upsert(rows, { onConflict: "phone" });
        if (error) { failed += rows.length; console.error("batch upsert fail", page, error.message); }
        else upserted += rows.length;
      }
      pagesDone++;

      if (!res.hasMore) break;                                   // đã hết dữ liệu
      if (pagesDone >= maxPages) { stoppedEarly = true; break; } // chạm trần trang
      if (Date.now() - started > TIME_BUDGET_MS) { stoppedEarly = true; break; } // hết giờ an toàn
      page++;
      await new Promise((r) => setTimeout(r, 120));
    }

    return json({
      ok: true, path, style, scanned, upserted, skipped_no_phone: skippedNoPhone, failed,
      pages: pagesDone, from_page: startPage,
      // Chưa hết dữ liệu -> gọi lại với start_page này để kéo tiếp
      next_page: stoppedEarly ? page + 1 : null,
      done: !stoppedEarly,
    });
  } catch (e) {
    console.error("getfly-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
