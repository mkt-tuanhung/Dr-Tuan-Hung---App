// ============================================================
// Supabase Edge Function: fb-messenger-sync
// Kéo LỊCH SỬ hội thoại Messenger của các fanpage (bảng fb_pages) về CRM.
// Quét SĐT trong nội dung -> gán/tạo khách marketing_data theo SĐT.
//
// Secrets: FB_PAGE_TOKEN — token System User (quyền pages_messaging,
//          pages_read_engagement, pages_manage_metadata trên các page).
//          Function TỰ đổi token này thành Page Access Token cho từng page
//          (API đọc hội thoại bắt buộc dùng Page Access Token — lỗi #190).
// Gọi:
//   { probe: true }                           -> kiểm tra kết nối (không ghi)
//   {}                                        -> kéo 25 hội thoại mới nhất/page
//   { conversations: 200, messages_per: 200 } -> kéo sâu (import lần đầu)
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

function scanPhone(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,9}/g);
  if (!m) return null;
  for (const raw of m) {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("84")) d = "0" + d.slice(2);
    if (d.length === 10 && /^0(3|5|7|8|9)/.test(d)) return d;
  }
  return null;
}

async function gget(path: string, params: Record<string, string>, token: string) {
  const p = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${API}/${path}?${p.toString()}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d?.error?.message || `FB HTTP ${r.status}`);
  return d;
}

// Đổi token System User -> Page Access Token của page (đọc inbox bắt buộc cái này).
async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  try {
    const r = await fetch(`https://graph.facebook.com/${API}/${pageId}?fields=access_token&access_token=${userToken}`);
    const d = await r.json().catch(() => ({}));
    return d?.access_token || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userToken = Deno.env.get("FB_PAGE_TOKEN") || "";
    if (!userToken) return json({ ok: false, error: "Chưa cấu hình FB_PAGE_TOKEN" });

    const body = await req.json().catch(() => ({}));
    const convLimit = Math.min(Number(body.conversations) || 25, 500);   // hội thoại mới nhất mỗi page
    const msgPer = Math.min(Number(body.messages_per) || 100, 500);      // tin mỗi hội thoại

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pages } = await sb.from("fb_pages").select("page_id, name").eq("active", true);
    if (!pages?.length) return json({ ok: false, error: "Bảng fb_pages chưa có page nào (active=true)" });

    // ---- KIỂM TRA ----
    if (body.probe) {
      const out: any[] = [];
      for (const pg of pages) {
        try {
          const pageToken = await getPageToken(pg.page_id, userToken);
          if (!pageToken) { out.push({ page: pg.name, page_id: pg.page_id, error: "Không lấy được Page Access Token — token System User chưa được gán page này (Full control) hoặc thiếu quyền pages_show_list/pages_manage_metadata" }); continue; }
          const d = await gget(`${pg.page_id}/conversations`, { platform: "messenger", fields: "id,updated_time,participants", limit: "3" }, pageToken);
          const convs = d.data || [];
          let sampleMsg = null;
          if (convs[0]) {
            const md = await gget(`${convs[0].id}/messages`, { fields: "id,message,from,created_time", limit: "3" }, pageToken);
            sampleMsg = (md.data || []).map((m: any) => ({ from: m.from?.name, text: (m.message || "").slice(0, 80), time: m.created_time }));
          }
          out.push({ page: pg.name, page_id: pg.page_id, conversations: convs.length, sample: sampleMsg });
        } catch (e) { out.push({ page: pg.name, page_id: pg.page_id, error: String((e as Error)?.message || e) }); }
      }
      return json({ ok: true, probe: true, pages: out });
    }

    // ---- KÉO ----
    let convDone = 0, msgDone = 0, linked = 0, failed = 0;
    const started = Date.now();
    const TIME_BUDGET_MS = 110_000;

    outer:
    for (const pg of pages) {
      const pageToken = await getPageToken(pg.page_id, userToken);
      if (!pageToken) { failed++; console.error("no page token", pg.page_id); continue; }
      let url: string | null = null;
      let fetched = 0;
      do {
        let d: any;
        try {
          d = url
            ? await (await fetch(url)).json()
            : await gget(`${pg.page_id}/conversations`, { platform: "messenger", fields: "id,updated_time,participants", limit: "25" }, pageToken);
        } catch (e) { failed++; console.error("conv list fail", pg.page_id, (e as Error)?.message); break; }
        for (const conv of d.data || []) {
          if (Date.now() - started > TIME_BUDGET_MS) break outer;
          fetched++;
          if (fetched > convLimit) break;
          try {
            // Người tham gia (khác page) = khách
            const parts = conv.participants?.data || [];
            const user = parts.find((x: any) => String(x.id) !== String(pg.page_id)) || {};
            const psid = String(user.id || "");
            if (!psid) continue;
            const convKey = `${pg.page_id}:${psid}`;
            await sb.from("fb_conversations").upsert({
              conv_key: convKey, page_id: pg.page_id, psid, thread_id: conv.id,
              participant_name: user.name || null, synced_at: new Date().toISOString(),
            }, { onConflict: "conv_key" });

            // Tin nhắn (mới nhất trước) — ghi theo LÔ
            const md = await gget(`${conv.id}/messages`, { fields: "id,message,from,created_time,attachments", limit: String(Math.min(msgPer, 100)) }, pageToken);
            const rows: any[] = [];
            let phone: string | null = null;
            let lastText = "", lastTime = null as string | null;
            for (const m of md.data || []) {
              const isPage = String(m.from?.id) === String(pg.page_id);
              rows.push({
                id: String(m.id), conv_key: convKey, page_id: pg.page_id,
                is_page: isPage, from_name: m.from?.name || (isPage ? "Page" : user.name || "Khách"),
                text: m.message || null,
                attachments: m.attachments?.data?.length ? m.attachments.data : null,
                created_time: m.created_time,
              });
              if (!phone) phone = scanPhone(m.message || "");
              if (!lastTime) { lastTime = m.created_time; lastText = (m.message || "[đính kèm]").slice(0, 300); }
              msgDone++;
            }
            if (rows.length) {
              const { error } = await sb.from("fb_messages").upsert(rows, { onConflict: "id" });
              if (error) { failed++; console.error("msg upsert fail", convKey, error.message); }
            }
            const upd: any = { last_message: lastText || null, last_time: lastTime };
            if (phone) {
              // Gán/tạo khách theo SĐT quét được
              const { data: exist } = await sb.from("marketing_data").select("id").eq("phone", phone).maybeSingle();
              let dataId = exist?.id;
              if (!dataId) {
                const { data: ins } = await sb.from("marketing_data")
                  .upsert({ phone, customer_name: user.name || null, source: "Messenger", description: "Tự tạo từ hội thoại Messenger" }, { onConflict: "phone" })
                  .select("id").maybeSingle();
                dataId = ins?.id;
              }
              upd.phone = phone; upd.data_id = dataId || null;
              linked++;
            }
            await sb.from("fb_conversations").update(upd).eq("conv_key", convKey);
            convDone++;
          } catch (e) { failed++; console.error("conv fail", conv.id, (e as Error)?.message); }
          await new Promise((r) => setTimeout(r, 80));
        }
        url = fetched < convLimit ? (d.paging?.next || null) : null;
      } while (url && Date.now() - started < TIME_BUDGET_MS);
    }

    return json({ ok: true, conversations: convDone, messages: msgDone, linked_phone: linked, failed });
  } catch (e) {
    console.error("fb-messenger-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
