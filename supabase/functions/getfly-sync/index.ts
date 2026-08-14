// ============================================================
// Supabase Edge Function: getfly-sync
// Kéo FULL THÔNG TIN khách từ GetFly /api/v6.1/accounts -> marketing_data.
// Hợp nhất theo SĐT. Ghi theo LÔ. Phân trang has_more + offset.
//
// Kéo đủ: tên, SĐT, mô tả, THÔNG TIN ĐÃ TIẾP CẬN (custom fields), trao đổi
// gần nhất, email, giới tính, sinh nhật, địa chỉ, website, nhóm KH, nguồn,
// người phụ trách GetFly, MỐI QUAN HỆ (map thẳng vào trạng thái app),
// doanh thu, ngày tạo/sửa.
//
// Secrets: GETFLY_DOMAIN, GETFLY_API_KEY, (tuỳ chọn) GETFLY_LIST_PATH
// Gọi: {} = kéo full · {max_pages:2} = cron 5' · {probe:true} = kiểm tra
//      {start_page:N} = kéo tiếp
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
// Toàn bộ trường cần lấy — đều nằm trong available_fields GetFly đã khai.
const FIELDS = [
  "id", "account_code", "account_name", "description", "billing_address_street",
  "phone_office", "email", "mgr_display_name", "website", "birthday",
  "created_at", "updated_at", "account_source", "account_source_details",
  "relation_id", "relation_name", "gender", "gender_detail", "total_revenue",
  "contacts", "detail_custom_fields_display_value", "account_manager",
  "account_type", "account_type_details", "industry_names",
  "last_active", "last_active_desc",
].join(",");
const QUERY_STYLES = [
  `fields=${FIELDS}&limit={s}&offset={o}`,
  "fields=id,account_name,phone_office,contacts&limit={s}&offset={o}",
];
const fill = (t: string, page: number, size: number) =>
  t.replace(/\{p\}/g, String(page)).replace(/\{s\}/g, String(size)).replace(/\{o\}/g, String((page - 1) * size));

// "Mối quan hệ" GetFly -> trạng thái app (trùng bộ nhãn).
const REL_MAP: Record<string, string> = {
  "nóng": "nong",
  "tiềm năng": "tiem_nang",
  "ra lịch hẹn": "da_hen_lich", "đã hẹn lịch": "da_hen_lich",
  "cọc": "coc",
  "đã làm dịch vụ": "da_lam_dv",
  "sài gòn": "sai_gon",
  "chốt fail": "chot_fail",
  "mất": "mat",
  "tiếp cận": "tiep_can", "mới": "tiep_can",
};
const mapRelation = (rel: string): string | null => REL_MAP[rel.trim().toLowerCase()] ?? null;

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
// Lấy "tên" từ giá trị bất kỳ (chuỗi / object {name} / mảng object).
function nameOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(nameOf).filter(Boolean).join(", ");
  if (typeof v === "object") return String(v.name ?? v.title ?? v.display ?? v.value ?? "").trim();
  return String(v);
}
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function toIso(v: any): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e9) return new Date(n > 1e12 ? n : n * 1000).toISOString();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
// "THÔNG TIN ĐÃ TIẾP CẬN" & các custom field -> text gọn.
function customFieldsText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return stripHtml(v);
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (x == null) return "";
      if (typeof x === "string") return stripHtml(x);
      const label = String(x.field_label ?? x.field_name ?? x.label ?? x.name ?? "").trim();
      const val = stripHtml(nameOf(x.display_value ?? x.value ?? x.display ?? ""));
      return val ? (label ? `${label}: ${val}` : val) : "";
    }).filter(Boolean).join(" · ");
  }
  if (typeof v === "object") {
    return Object.entries(v).map(([k, x]) => {
      const val = stripHtml(nameOf(x));
      return val ? `${k}: ${val}` : "";
    }).filter(Boolean).join(" · ");
  }
  return String(v);
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
function extractRecords(d: any): any[] {
  const cands = [d?.records, d?.accounts, d?.data?.records, d?.data?.accounts, d?.data?.data, Array.isArray(d?.data) ? d.data : null, Array.isArray(d) ? d : null];
  for (const c of cands) if (Array.isArray(c)) return c;
  return [];
}

// 1 khách GetFly -> 1 dòng marketing_data (FULL thông tin).
function rowFrom(c: Record<string, any>, phone: string): { row: Record<string, unknown>; hasStatus: boolean } {
  const relationName = nameOf(c.relation_name) || nameOf(c.account_relation_detail);
  const status = relationName ? mapRelation(relationName) : null;
  const manager = (typeof c.account_manager === "string" && c.account_manager.trim() && !/^\d+$/.test(c.account_manager.trim()))
    ? c.account_manager.trim()
    : (nameOf(c.account_manager) || pick(c, ["mgr_display_name"]) || null);
  const row: Record<string, unknown> = {
    phone,
    customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]) || null,
    description: stripHtml(String(c.description ?? "")) || null,
    reached_info: customFieldsText(c.detail_custom_fields_display_value) || null,   // THÔNG TIN ĐÃ TIẾP CẬN
    last_exchange: stripHtml(String(c.last_active_desc ?? "")) || null,             // Trao đổi gần nhất
    getfly_id: c.id != null ? String(c.id) : null,
    getfly_code: pick(c, ["account_code"]) || null,
    email: pick(c, ["email"]) || null,
    gender: nameOf(c.gender_detail) || (c.gender === 1 ? "Nam" : c.gender === 2 ? "Nữ" : null),
    birthday: pick(c, ["birthday"]) || null,
    address: pick(c, ["billing_address_street"]) || null,
    website: pick(c, ["website"]) || null,
    customer_group: nameOf(c.account_type_details) || nameOf(c.industry_names) || null,  // Nhóm khách hàng
    source: nameOf(c.account_source_details) || pick(c, ["account_source"]) || null,     // Nguồn khách hàng
    manager_name: manager,                                                                // Người phụ trách GetFly
    relation_name: relationName || null,                                                  // Mối quan hệ (nguyên văn)
    total_revenue: Number(c.total_revenue) || 0,
    getfly_created_at: toIso(c.created_at),
    getfly_updated_at: toIso(c.updated_at ?? c.last_active),
    getfly_synced_at: new Date().toISOString(),
  };
  if (status) row.status = status;   // Mối quan hệ GetFly -> trạng thái app
  return { row, hasStatus: !!status };
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
        tries.push({ path: p, style: style.slice(0, 60), status: res.status, records: res.records.length, msg: res.msg || res.snippet });
        if (res.ok && res.status === 200) return { path: p, style, tries };
        if (res.status === 404) break;
      } catch (e) { tries.push({ path: p, error: String((e as Error)?.message || e) }); }
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
    const pageSize = Math.min(Number(body.page_size) || 200, 500);
    const maxPages = Math.min(Number(body.max_pages) || 300, 1000);
    const startPage = Math.max(Number(body.start_page) || 1, 1);

    const { path, style, tries } = await detect(domain, apiKey);
    if (!path || !style) {
      const summary = tries.map((t: any) => `${t.path}→${t.status ?? t.error ?? '?'}${t.msg ? '(' + String(t.msg).slice(0, 45) + ')' : ''}`).join("  ·  ");
      return json({ ok: false, error: `Không cách gọi nào trúng (domain=${domain}). ${summary}`, tries });
    }

    // ---- KIỂM TRA: xem trước map FULL thông tin, không ghi ----
    if (body.probe) {
      const res = await call(domain, apiKey, path, style, 1, 5);
      const sample = res.records.slice(0, 3).map((c: Record<string, any>) => {
        const phone = findPhone(c);
        return phone ? rowFrom(c, phone).row : { customer_name: pick(c, ["account_name"]), phone: "" };
      });
      return json({ ok: true, probe: true, path, has_more: res.hasMore, count_page1: res.records.length, sample });
    }

    // ---- KÉO: ghi theo LÔ ----
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let page = startPage, pagesDone = 0, scanned = 0, upserted = 0, skippedNoPhone = 0, failed = 0;
    let stoppedEarly = false;
    const seen = new Set<string>();
    const started = Date.now();
    const TIME_BUDGET_MS = 110_000;

    for (;;) {
      const res = await call(domain, apiKey, path, style, page, pageSize);
      if (res.status !== 200 || !res.records.length) break;

      // PostgREST yêu cầu các dòng trong 1 lô có CÙNG bộ cột
      // -> tách lô "có status" và "không status" (mối quan hệ lạ thì không đè trạng thái).
      const withStatus: Record<string, unknown>[] = [];
      const noStatus: Record<string, unknown>[] = [];
      for (const c of res.records) {
        scanned++;
        const phone = findPhone(c);
        if (!phone) { skippedNoPhone++; continue; }
        if (seen.has(phone)) continue;
        seen.add(phone);
        const { row, hasStatus } = rowFrom(c, phone);
        (hasStatus ? withStatus : noStatus).push(row);
      }
      for (const batch of [withStatus, noStatus]) {
        if (!batch.length) continue;
        const { error } = await sb.from("marketing_data").upsert(batch, { onConflict: "phone" });
        if (error) { failed += batch.length; console.error("batch upsert fail", page, error.message); }
        else upserted += batch.length;
      }
      pagesDone++;

      if (!res.hasMore) break;
      if (pagesDone >= maxPages) { stoppedEarly = true; break; }
      if (Date.now() - started > TIME_BUDGET_MS) { stoppedEarly = true; break; }
      page++;
      await new Promise((r) => setTimeout(r, 120));
    }

    return json({
      ok: true, path, scanned, upserted, skipped_no_phone: skippedNoPhone, failed,
      pages: pagesDone, from_page: startPage,
      next_page: stoppedEarly ? page + 1 : null,
      done: !stoppedEarly,
    });
  } catch (e) {
    console.error("getfly-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
