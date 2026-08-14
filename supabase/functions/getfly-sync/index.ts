// ============================================================
// Supabase Edge Function: getfly-sync
// Kéo danh sách khách hàng từ GetFly CRM -> đổ vào module "Data khách hàng"
// (bảng marketing_data), hợp nhất theo SỐ ĐIỆN THOẠI (trùng thì cập nhật
// tên/mô tả, KHÔNG ghi đè trạng thái & trực page đã gán tay).
//
// Secrets cần đặt (Supabase → Project Settings → Edge Functions → Secrets):
//   GETFLY_DOMAIN   = drtuanhung.getflycrm.com   (chỉ tên miền, không http://)
//   GETFLY_API_KEY  = <API Key lấy ở Getfly: Cài đặt → Tích hợp → Getfly API Key>
//
// Gọi:
//   { probe: true }  -> kéo thử 1 trang, TRẢ VỀ dữ liệu thô để soi tên trường (KHÔNG ghi)
//   {}               -> kéo hết, upsert vào marketing_data theo phone
//   { max_pages: 5 } -> giới hạn số trang (mặc định 100)
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

// Chuẩn hoá SĐT VN: bỏ ký tự thừa, 84xxxx -> 0xxxx.
function normPhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!d.startsWith("0") && d.length === 9) d = "0" + d;
  return d;
}
// Lấy field đầu tiên có giá trị trong nhiều tên khả dĩ (GetFly đặt tên khác nhau tuỳ bản).
function pick(obj: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
// Tìm SĐT ở cấp khách hoặc trong danh bạ liên hệ (contacts).
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

async function fetchPage(domain: string, apiKey: string, page: number, pageSize: number) {
  const url = `https://${domain}/api/client/list?page=${page}&page_size=${pageSize}`;
  const r = await fetch(url, { headers: { "X-API-KEY": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  let d: any = {};
  try { d = JSON.parse(text); } catch { /* để nguyên */ }
  if (!r.ok) throw new Error(d?.message || d?.msg || `GetFly HTTP ${r.status}: ${text.slice(0, 200)}`);
  // GetFly trả nhiều dạng khác nhau -> dò mảng khách + tổng trang.
  const records = d.records || d.data?.records || d.data?.clients || d.clients || (Array.isArray(d.data) ? d.data : []) || [];
  const totalPage = Number(d.total_page ?? d.data?.total_page ?? d.total_pages ?? d.data?.total_pages ?? 1) || 1;
  return { records: Array.isArray(records) ? records : [], totalPage, raw: d };
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

    // ---- Chế độ KIỂM TRA: kéo thử trang 1, trả dữ liệu thô + xem trước map (không ghi) ----
    if (body.probe) {
      const { records, totalPage, raw } = await fetchPage(domain, apiKey, 1, Math.min(pageSize, 5));
      const sample = records.slice(0, 3).map((c: Record<string, any>) => ({
        customer_name: pick(c, ["account_name", "client_name", "name", "full_name"]),
        phone: findPhone(c),
        description: buildDescription(c),
        _raw_keys: Object.keys(c || {}),
      }));
      return json({ ok: true, probe: true, total_page: totalPage, count_page1: records.length, sample, raw_first: records[0] ?? null, raw_shape_keys: Object.keys(raw || {}) });
    }

    // ---- Chế độ KÉO THẬT ----
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const maxPages = Math.min(Number(body.max_pages) || 100, 500);

    let page = 1, totalPage = 1;
    let scanned = 0, upserted = 0, skippedNoPhone = 0, failed = 0;
    const seen = new Set<string>();

    do {
      const res = await fetchPage(domain, apiKey, page, pageSize);
      totalPage = res.totalPage;
      for (const c of res.records) {
        scanned++;
        const phone = findPhone(c);
        if (!phone) { skippedNoPhone++; continue; }
        if (seen.has(phone)) continue;       // trùng trong cùng đợt kéo
        seen.add(phone);
        const name = pick(c, ["account_name", "client_name", "name", "full_name"]) || null;
        const description = buildDescription(c) || null;
        // CHỈ set customer_name + description: KHÔNG đụng status / truc_page_id / last_exchange
        // -> khách đã có giữ nguyên phân loại & người phụ trách đã gán tay.
        // (status mới sẽ nhận default 'tiep_can' của bảng khi là dòng insert)
        const { error } = await sb.from("marketing_data")
          .upsert({ phone, customer_name: name, description }, { onConflict: "phone" });
        if (error) { failed++; console.error("upsert fail", phone, error.message); }
        else upserted++;
      }
      page++;
      await new Promise((r) => setTimeout(r, 200)); // giãn nhịp cho đỡ dồn request
    } while (page <= totalPage && page <= maxPages);

    return json({ ok: true, scanned, upserted, skipped_no_phone: skippedNoPhone, failed, pages: Math.min(totalPage, maxPages) });
  } catch (e) {
    console.error("getfly-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
