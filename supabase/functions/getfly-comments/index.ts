// ============================================================
// Supabase Edge Function: getfly-comments
// Kéo LỊCH SỬ GHI CHÚ / TRAO ĐỔI của khách từ GetFly
//   GET /api/v6/accounts/{id}/comments  (phân trang limit/offset, has_more)
// -> bảng getfly_comments + getfly_comment_sync (supabase/getfly_comments.sql).
//
// Secrets: GETFLY_DOMAIN, GETFLY_API_KEY (dùng chung với getfly-sync)
// Gọi:
//   {getfly_id:"123"} | {data_id:"<uuid>"} -> kéo 1 khách (mở hồ sơ trong app)
//   {mode:"incremental"}                   -> cron 10': khách chưa kéo / có cập nhật mới trên GetFly
//   {mode:"incremental", limit:N}          -> giới hạn số khách / lượt
//   {probe:true, getfly_id:"123"}          -> xem thử, không ghi
// Không ghi vào marketing_data (bảng realtime) để tránh app tải lại liên tục.
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

const PATHS = ["/api/v6.1/accounts/{id}/comments", "/api/v6/accounts/{id}/comments", "/api/v6.0/accounts/{id}/comments"];
const FIELDS = "id,comment_title,content,creator,creator_display_name,account_id,is_feedback,created_at";
const PAGE = 100;
const MAX_PAGES_PER_ACCOUNT = 30;   // tối đa 3.000 ghi chú / khách
const TIME_BUDGET_MS = 110_000;
const WORKERS = 4;                  // số khách kéo song song

const stripHtml = (s: string) => s
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n")
  .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

// GetFly trả GIỜ VIỆT NAM không kèm múi giờ -> gắn +07:00 (giống getfly-sync)
function toIso(v: any): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e9) return new Date(n > 1e12 ? n : n * 1000).toISOString();
  const s = String(v).trim();
  const hasTz = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(s);
  let str = s.replace(" ", "T");
  if (!hasTz) { if (!str.includes("T")) str += "T00:00:00"; str += "+07:00"; }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function extractRecords(d: any): any[] {
  const cands = [d?.data, d?.records, d?.comments, d?.data?.records, d?.data?.data, Array.isArray(d) ? d : null];
  for (const c of cands) if (Array.isArray(c)) return c;
  return [];
}

let resolvedPath: string | null = null;   // nhớ đường dẫn đúng trong 1 lượt chạy

async function fetchPage(domain: string, apiKey: string, path: string, getflyId: string, offset: number) {
  const url = `https://${domain}${path.replace("{id}", encodeURIComponent(getflyId))}?fields=${FIELDS}&limit=${PAGE}&offset=${offset}`;
  const r = await fetch(url, { headers: { "X-API-KEY": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  let d: any = {};
  try { d = JSON.parse(text); } catch { /* HTML */ }
  const msg = String(d?.message ?? d?.msg ?? "");
  return { status: r.status, ok: r.ok && !/not found|route/i.test(msg), records: extractRecords(d), hasMore: d?.has_more === true, msg, snippet: text.slice(0, 160) };
}

async function fetchAll(domain: string, apiKey: string, getflyId: string) {
  const paths = resolvedPath ? [resolvedPath] : PATHS;
  let lastErr = "";
  for (const path of paths) {
    const all: any[] = [];
    let offset = 0, ok = true;
    for (let p = 0; p < MAX_PAGES_PER_ACCOUNT; p++) {
      const res = await fetchPage(domain, apiKey, path, getflyId, offset);
      if (!res.ok || res.status !== 200) { ok = false; lastErr = `${path} → ${res.status} ${res.msg || res.snippet}`; break; }
      all.push(...res.records);
      if (!res.hasMore || !res.records.length) break;
      offset += res.records.length;
      await new Promise((r) => setTimeout(r, 80));
    }
    if (ok) { resolvedPath = path; return { ok: true, records: all, error: null as string | null }; }
    if (resolvedPath) break;   // đường dẫn đã từng đúng mà giờ lỗi -> không thử tiếp
  }
  return { ok: false, records: [] as any[], error: lastErr };
}

const toRow = (c: Record<string, any>, getflyId: string, dataId: string | null) => ({
  id: String(c.id),
  account_getfly_id: getflyId,
  data_id: dataId,
  title: c.comment_title ? stripHtml(String(c.comment_title)) || null : null,
  content: stripHtml(String(c.content ?? "")) || null,
  creator_name: c.creator_display_name ? String(c.creator_display_name).trim() : null,
  creator_getfly_id: c.creator != null ? String(c.creator) : null,
  is_feedback: Number(c.is_feedback) === 1,
  created_at: toIso(c.created_at),
  synced_at: new Date().toISOString(),
});

async function syncOne(sb: any, domain: string, apiKey: string, acc: { getfly_id: string; id: string | null; getfly_updated_at?: string | null }) {
  const res = await fetchAll(domain, apiKey, acc.getfly_id);
  const now = new Date().toISOString();
  if (!res.ok) {
    await sb.from("getfly_comment_sync").upsert({ account_getfly_id: acc.getfly_id, data_id: acc.id, synced_at: now, source_updated_at: acc.getfly_updated_at ?? null, last_error: res.error?.slice(0, 300) ?? "lỗi" }, { onConflict: "account_getfly_id" });
    return { ok: false, count: 0, error: res.error };
  }
  const rows = res.records.filter((c) => c?.id != null).map((c) => toRow(c, acc.getfly_id, acc.id));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("getfly_comments").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) return { ok: false, count: 0, error: error.message };
  }
  // Ghi chú đã bị xoá bên GetFly -> xoá khỏi app (giới hạn để URL không quá dài)
  const ids = rows.map((r) => r.id);
  if (!ids.length) await sb.from("getfly_comments").delete().eq("account_getfly_id", acc.getfly_id);
  else if (ids.length <= 300) await sb.from("getfly_comments").delete().eq("account_getfly_id", acc.getfly_id).not("id", "in", `(${ids.map((x) => `"${x}"`).join(",")})`);
  const lastAt = rows.map((r) => r.created_at).filter(Boolean).sort().pop() ?? null;
  await sb.from("getfly_comment_sync").upsert({
    account_getfly_id: acc.getfly_id, data_id: acc.id, synced_at: now, source_updated_at: acc.getfly_updated_at ?? null,
    comment_count: rows.length, last_comment_at: lastAt, last_error: null,
  }, { onConflict: "account_getfly_id" });
  return { ok: true, count: rows.length, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const domain = (Deno.env.get("GETFLY_DOMAIN") || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const apiKey = Deno.env.get("GETFLY_API_KEY") || "";
    if (!domain || !apiKey) return json({ ok: false, error: "Chưa cấu hình GETFLY_DOMAIN / GETFLY_API_KEY" });
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- 1 khách ----
    if (body.getfly_id || body.data_id) {
      let q = sb.from("marketing_data").select("id, getfly_id, getfly_updated_at").limit(1);
      q = body.data_id ? q.eq("id", body.data_id) : q.eq("getfly_id", String(body.getfly_id));
      const { data: accs } = await q;
      const acc = accs?.[0] ?? (body.getfly_id ? { id: null, getfly_id: String(body.getfly_id), getfly_updated_at: null } : null);
      if (!acc?.getfly_id) return json({ ok: false, error: "Khách chưa có mã GetFly" });
      if (body.probe) {
        const res = await fetchAll(domain, apiKey, acc.getfly_id);
        return json({ ok: res.ok, path: resolvedPath, error: res.error, count: res.records.length, sample: res.records.slice(0, 3) });
      }
      const r = await syncOne(sb, domain, apiKey, acc);
      return json({ ok: r.ok, getfly_id: acc.getfly_id, count: r.count, error: r.error });
    }

    // ---- Đồng bộ nền: khách chưa kéo hoặc GetFly có cập nhật mới ----
    if (body.mode === "incremental") {
      const limit = Math.min(Number(body.limit) || 2000, 5000);
      const started = Date.now();
      // PostgREST trả tối đa 1.000 dòng / lần -> đọc theo lô
      const syncMap = new Map<string, any>();
      for (let from = 0; from < 100000; from += 1000) {
        const { data, error } = await sb.from("getfly_comment_sync").select("account_getfly_id, source_updated_at").range(from, from + 999);
        if (error) return json({ ok: false, error: "getfly_comment_sync: " + error.message });
        (data || []).forEach((s: any) => syncMap.set(s.account_getfly_id, s));
        if (!data || data.length < 1000) break;
      }
      const todo: any[] = [];
      for (let from = 0; from < 50000 && todo.length < limit; from += 1000) {
        const { data, error } = await sb.from("marketing_data")
          .select("id, getfly_id, getfly_updated_at")
          .not("getfly_id", "is", null)
          .order("getfly_updated_at", { ascending: false, nullsFirst: false })
          .range(from, from + 999);
        if (error || !data?.length) break;
        for (const m of data) {
          const s: any = syncMap.get(m.getfly_id);
          if (!s) todo.push({ ...m, _new: true });
          else if (m.getfly_updated_at && (!s.source_updated_at || m.getfly_updated_at > s.source_updated_at)) todo.push(m);
        }
        if (data.length < 1000) break;
      }
      // Khách có cập nhật mới trước, rồi tới khách chưa từng kéo
      todo.sort((a, b) => Number(!!a._new) - Number(!!b._new));
      let done = 0, notes = 0, failed = 0;
      const errors: string[] = [];
      const queue = todo.slice(0, limit);
      // Khách đầu tiên chạy riêng để dò đúng đường dẫn API, rồi mới kéo song song
      const runOne = async (acc: any) => {
        const r = await syncOne(sb, domain, apiKey, acc);
        if (r.ok) { done++; notes += r.count; } else { failed++; if (errors.length < 3) errors.push(`${acc.getfly_id}: ${r.error}`); }
      };
      const worker = async () => {
        while (queue.length) {
          if (Date.now() - started > TIME_BUDGET_MS) break;
          if (failed >= 15 && done === 0) break;   // lỗi hàng loạt (sai đường dẫn / key) -> dừng sớm
          await runOne(queue.shift());
        }
      };
      if (queue.length) await runOne(queue.shift());
      await Promise.all(Array.from({ length: WORKERS }, worker));
      return json({ ok: failed === 0 || done > 0, path: resolvedPath, pending_before: todo.length, synced: done, notes, failed, remaining: Math.max(0, todo.length - done - failed), errors });
    }

    return json({ ok: false, error: "Thiếu tham số: getfly_id | data_id | mode" }, 400);
  } catch (e) {
    console.error("getfly-comments error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
