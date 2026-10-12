// ============================================================
// Supabase Edge Function: fb-page-setup — KẾT NỐI FANPAGE (chạy tay, cần JWT)
// Dùng token từng page trong secret FB_PAGE_TOKENS = [{"id":"<page_id>","token":"…"}, …]
// KHÔNG BAO GIỜ trả token ra ngoài — chỉ trả tên page, quyền đọc tin, trạng thái đăng ký.
// Gọi:
//   { probe: true }      -> tên page, đọc được hộp thư không, app đã đăng ký nhận tin chưa (không ghi)
//   { subscribe: true }  -> đăng ký app nhận webhook messages + message_echoes cho từng page
//                           (giữ nguyên các trường đã đăng ký khác) + lưu tên page vào fb_pages
// Page mới lưu vào fb_pages với active=false (chỉ để hiện tên) — không ảnh hưởng màn tạo quảng cáo.
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
const API = "v21.0";
const NEED_FIELDS = ["messages", "message_echoes"];

function pageTokens(): { id: string; token: string }[] {
  try {
    const list = JSON.parse(Deno.env.get("FB_PAGE_TOKENS") || "[]");
    return (Array.isArray(list) ? list : []).filter((x: any) => x?.id && x?.token).map((x: any) => ({ id: String(x.id), token: String(x.token) }));
  } catch { return []; }
}

async function graph(method: "GET" | "POST", path: string, params: Record<string, string>, token: string) {
  const p = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${API}/${path}?${p.toString()}`, { method });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d?.error?.message || `FB HTTP ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const pages = pageTokens();
    if (!pages.length) return json({ ok: false, error: "Secret FB_PAGE_TOKENS trống hoặc sai định dạng JSON [{id, token}]" });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const out: any[] = [];
    for (const pg of pages) {
      const row: any = { page_id: pg.id };
      try {
        const info = await graph("GET", pg.id, { fields: "id,name" }, pg.token);
        row.name = info.name || null;
        if (String(info.id) !== pg.id) row.warning = `Token này thuộc page ${info.id}, không phải ${pg.id}`;
      } catch (e) { row.error = "Token không dùng được: " + String((e as Error)?.message || e); out.push(row); continue; }

      try {
        const conv = await graph("GET", `${pg.id}/conversations`, { platform: "messenger", fields: "id,updated_time", limit: "1" }, pg.token);
        row.inbox_read = true;
        row.last_conversation_at = conv.data?.[0]?.updated_time || null;
      } catch (e) { row.inbox_read = false; row.inbox_error = String((e as Error)?.message || e); }

      let fields: string[] = [];
      try {
        const subs = await graph("GET", `${pg.id}/subscribed_apps`, {}, pg.token);
        fields = (subs.data || []).flatMap((a: any) => a.subscribed_fields || []);
        row.subscribed_fields = fields;
      } catch (e) { row.subscribe_error = String((e as Error)?.message || e); }

      if (body.subscribe) {
        try {
          const want = [...new Set([...fields, ...NEED_FIELDS])];
          await graph("POST", `${pg.id}/subscribed_apps`, { subscribed_fields: want.join(",") }, pg.token);
          row.subscribed_fields = want;
          row.subscribed = true;
        } catch (e) { row.subscribed = false; row.subscribe_error = String((e as Error)?.message || e); }
        if (row.name) {
          const { data: ex } = await sb.from("fb_pages").select("page_id").eq("page_id", pg.id).maybeSingle();
          if (ex) await sb.from("fb_pages").update({ name: row.name }).eq("page_id", pg.id);
          else await sb.from("fb_pages").insert({ page_id: pg.id, name: row.name, active: false });
        }
      }
      row.ready = !!row.inbox_read && NEED_FIELDS.every((f) => (row.subscribed_fields || []).includes(f));
      out.push(row);
    }
    return json({ ok: out.every((r) => !r.error), mode: body.subscribe ? "subscribe" : "probe", pages: out });
  } catch (e) {
    console.error("fb-page-setup error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
