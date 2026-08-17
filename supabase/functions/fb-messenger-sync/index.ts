// ============================================================
// Supabase Edge Function: fb-messenger-sync
// Kéo LỊCH SỬ hội thoại Messenger của các fanpage (bảng fb_pages) về CRM.
// Quét SĐT trong nội dung -> gán/tạo khách marketing_data theo SĐT.
//
// Secrets: FB_PAGE_TOKEN — token System User (quyền pages_messaging,
//          pages_read_engagement, pages_manage_metadata trên các page).
//          Function TỰ đổi token này thành Page Access Token cho từng page.
//
// KÉO HẾT SẠCH (resumable): mỗi lần chạy tối đa ~TIME_BUDGET; nếu chưa hết
//   trả { done:false, next:{page_id, after} }. Gọi lại với { resume:next }
//   để kéo tiếp từ đúng điểm dừng. Client lặp tới khi done=true.
// Gọi:
//   { probe: true }                 -> kiểm tra kết nối (không ghi)
//   {}                              -> bắt đầu kéo hết (từ page đầu)
//   { resume: {page_id, after} }    -> kéo tiếp từ điểm dừng
//   { messages_per: 100 }           -> số tin mỗi hội thoại (tối đa 100)
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
    const msgPer = Math.min(Number(body.messages_per) || 100, 100);   // tin mỗi hội thoại
    const resume = body.resume || null;                                // { page_id, after }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Thứ tự page ổn định để resume đúng
    const { data: pagesRaw } = await sb.from("fb_pages").select("page_id, name").eq("active", true).order("page_id", { ascending: true });
    const pages = pagesRaw || [];
    if (!pages.length) return json({ ok: false, error: "Bảng fb_pages chưa có page nào (active=true)" });

    // ---- KIỂM TRA ----
    if (body.probe) {
      const out: any[] = [];
      for (const pg of pages) {
        try {
          const pageToken = await getPageToken(pg.page_id, userToken);
          if (!pageToken) { out.push({ page: pg.name, page_id: pg.page_id, error: "Không lấy được Page Access Token — token System User chưa gán page này (Full control) hoặc thiếu quyền" }); continue; }
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

    // ---- KÉO (resumable, theo LÔ 50 hội thoại) ----
    let convDone = 0, msgDone = 0, linked = 0, failed = 0, skipped = 0;
    const started = Date.now();
    const TIME_BUDGET_MS = 80_000;
    const isThrottle = (msg: string) => /\(#(4|17|32|613)\)|request limit|rate limit|too many/i.test(msg || "");
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Xử lý 1 hội thoại (KHÔNG ghi synced_at trước — chỉ ghi sau khi kéo tin xong,
    // để lần sau biết chính xác hội thoại nào đã xong mà bỏ qua)
    const handleConv = async (pg: any, conv: any, user: any, convKey: string, pageToken: string) => {
      await sb.from("fb_conversations").upsert({
        conv_key: convKey, page_id: pg.page_id, psid: String(user.id), thread_id: conv.id,
        participant_name: user.name || null,
      }, { onConflict: "conv_key" });

      const md = await gget(`${conv.id}/messages`, { fields: "id,message,from,created_time,attachments", limit: String(msgPer) }, pageToken);
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
      const upd: any = { last_message: lastText || null, last_time: lastTime, synced_at: new Date().toISOString() };
      if (phone) {
        const { data: exist } = await sb.from("marketing_data").select("id").eq("phone", phone).maybeSingle();
        let dataId = exist?.id;
        if (!dataId) {
          // Ngày về = thời điểm tin nhắn cuối (KHÔNG phải lúc bấm kéo) — kẻo
          // hội thoại cũ import về bị đếm nhầm thành "số mới" của hôm nay.
          const { data: ins } = await sb.from("marketing_data")
            .upsert({ phone, customer_name: user.name || null, source: "Messenger", description: "Tự tạo từ hội thoại Messenger", created_at: lastTime || new Date().toISOString() }, { onConflict: "phone" })
            .select("id").maybeSingle();
          dataId = ins?.id;
        }
        upd.phone = phone; upd.data_id = dataId || null;
        linked++;
      }
      await sb.from("fb_conversations").update(upd).eq("conv_key", convKey);
      convDone++;
    };

    // Trả điểm dừng để client gọi tiếp (kèm cờ throttled nếu bị FB giới hạn)
    const pause = (pageId: string, after: string | null, throttled = false) =>
      json({ ok: true, done: false, next: { page_id: pageId, after }, throttled, conversations: convDone, messages: msgDone, linked_phone: linked, failed, skipped });

    // Bắt đầu từ page nào (nếu resume)
    const startIdx = resume?.page_id ? Math.max(0, pages.findIndex((p) => String(p.page_id) === String(resume.page_id))) : 0;

    for (let pi = startIdx; pi < pages.length; pi++) {
      const pg = pages[pi];
      const pageToken = await getPageToken(pg.page_id, userToken);
      if (!pageToken) { failed++; console.error("no page token", pg.page_id); continue; }

      // Danh sách hội thoại ĐÃ đồng bộ của page này -> lần chạy sau bỏ qua cái
      // không có tin mới, dồn thời gian + hạn mức FB cho hội thoại chưa kéo.
      const known: Record<string, string> = {};
      for (let fromI = 0; fromI < 100000; fromI += 1000) {
        const { data: ex } = await sb.from("fb_conversations").select("conv_key, synced_at").eq("page_id", pg.page_id).range(fromI, fromI + 999);
        if (!ex?.length) break;
        ex.forEach((r: any) => { if (r.synced_at) known[r.conv_key] = r.synced_at; });
        if (ex.length < 1000) break;
      }

      // Trang đầu (hoặc tiếp từ cursor resume); lật trang bằng URL paging.next của FB.
      let curAfter: string | null = (pi === startIdx && resume?.after) ? resume.after : null;
      let d: any = null;
      try {
        const params: Record<string, string> = { platform: "messenger", fields: "id,updated_time,participants", limit: "50" };
        if (curAfter) params.after = curAfter;
        d = await gget(`${pg.page_id}/conversations`, params, pageToken);
      } catch (e) {
        // Lỗi ngay trang đầu (thường là FB giới hạn) -> KHÔNG được báo "xong",
        // trả điểm dừng để client chờ rồi gọi lại đúng chỗ này.
        console.error("conv list fail", pg.page_id, (e as Error)?.message);
        return pause(pg.page_id, curAfter, isThrottle(String((e as Error)?.message)));
      }

      while (d) {
        // FB trả lỗi trong body (fetch nextUrl không throw) -> cũng phải dừng-chờ chứ không phải "hết"
        if (d.error) {
          console.error("conv page error", pg.page_id, d.error?.message);
          return pause(pg.page_id, curAfter, isThrottle(String(d.error?.message)));
        }
        for (const conv of d.data || []) {
          const parts = conv.participants?.data || [];
          const user = parts.find((x: any) => String(x.id) !== String(pg.page_id)) || {};
          const psid = String(user.id || "");
          if (!psid) continue;
          const convKey = `${pg.page_id}:${psid}`;
          // Đã đồng bộ & không có tin mới hơn -> bỏ qua (không tốn lượt gọi FB)
          if (known[convKey] && conv.updated_time && new Date(conv.updated_time) <= new Date(known[convKey])) { skipped++; continue; }
          try { await handleConv(pg, conv, user, convKey, pageToken); }
          catch (e) {
            const msg = String((e as Error)?.message || e);
            if (isThrottle(msg)) return pause(pg.page_id, curAfter, true);   // FB chặn -> dừng-chờ tại trang hiện tại
            failed++; console.error("conv fail", conv.id, msg);
          }
          await sleep(120);   // giãn nhịp gọi FB, đỡ dính giới hạn
        }
        const nextUrl: string | null = d.paging?.next || null;
        let nextAfter: string | null = d.paging?.cursors?.after || null;
        if (!nextAfter && nextUrl) { try { nextAfter = new URL(nextUrl).searchParams.get("after"); } catch { /*noop*/ } }

        // Hết giờ mà còn trang -> dừng, trả điểm resume để client gọi tiếp
        if (nextUrl && Date.now() - started > TIME_BUDGET_MS) return pause(pg.page_id, nextAfter);
        if (!nextUrl) break;      // page này hết hội thoại
        curAfter = nextAfter;
        try { d = await (await fetch(nextUrl)).json(); }
        catch (e) { console.error("conv next fail", pg.page_id, (e as Error)?.message); return pause(pg.page_id, curAfter, true); }
      }

      // Page này xong. Nếu hết giờ mà còn page sau -> resume từ page kế (after=null)
      if (Date.now() - started > TIME_BUDGET_MS && pi + 1 < pages.length) return pause(pages[pi + 1].page_id, null);
    }

    // Hết tất cả page
    return json({ ok: true, done: true, conversations: convDone, messages: msgDone, linked_phone: linked, failed, skipped });
  } catch (e) {
    console.error("fb-messenger-sync error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
