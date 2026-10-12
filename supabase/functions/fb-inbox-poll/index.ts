// ============================================================
// Supabase Edge Function: fb-inbox-poll — HỎI FACEBOOK MỖI PHÚT (thay webhook khi app chưa qua Xét duyệt)
// App chưa được Meta duyệt quyền pages_messaging thì webhook chỉ nhận tin của người có vai trò
// trong app -> hàm này đọc hộp thư bằng token từng page (secret FB_PAGE_TOKENS).
//
// Mỗi lượt, mỗi page: 1 lần gọi Graph lấy 10 hội thoại mới nhất kèm 10 tin gần nhất.
// CHỈ ghi hội thoại có tin mới hơn lần trước (so last_time) -> không có tin mới thì không ghi gì.
// Không kéo lịch sử. Tin lưu theo mid của Facebook -> không trùng với webhook / fb-messenger-sync.
// Trigger trên fb_messages (inbox_sla.sql) tự tính khách đang chờ để cảnh báo Telegram.
//
// Secrets: FB_PAGE_TOKENS = [{"id":"<page_id>","token":"<Page Access Token>"}, …]
// Gọi: {} (cron 'fb-inbox-poll-1min') | { conversations: 25 } khi cần quét rộng hơn
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

function pageTokens(): { id: string; token: string }[] {
  try {
    const list = JSON.parse(Deno.env.get("FB_PAGE_TOKENS") || "[]");
    return (Array.isArray(list) ? list : []).filter((x: any) => x?.id && x?.token).map((x: any) => ({ id: String(x.id), token: String(x.token) }));
  } catch { return []; }
}

// Quét SĐT Việt Nam trong text (giống fb-messenger-webhook)
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

// Gán hội thoại vào khách theo SĐT; chưa có khách -> tạo trong Data (giống webhook)
async function linkPhone(sb: any, convKey: string, phone: string, name: string | null) {
  const { data: existing } = await sb.from("marketing_data").select("id").eq("phone", phone).maybeSingle();
  let dataId = existing?.id;
  if (!dataId) {
    const { data: ins } = await sb.from("marketing_data")
      .upsert({ phone, customer_name: name || null, source: "Messenger", description: "Tự tạo từ hội thoại Messenger" }, { onConflict: "phone" })
      .select("id").maybeSingle();
    dataId = ins?.id;
  }
  await sb.from("fb_conversations").update({ phone, data_id: dataId || null }).eq("conv_key", convKey);
}

async function gget(path: string, params: Record<string, string>, token: string) {
  const p = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${API}/${path}?${p.toString()}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d?.error?.message || `FB HTTP ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const pages = pageTokens();
    if (!pages.length) return json({ ok: false, error: "Secret FB_PAGE_TOKENS trống hoặc sai định dạng" });
    const body = await req.json().catch(() => ({}));
    const limit = String(Math.min(Number(body.conversations) || 10, 50));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: known } = await sb.from("fb_pages").select("page_id").in("page_id", pages.map((p) => p.id));
    const knownIds = new Set((known || []).map((p: any) => String(p.page_id)));

    const out: any[] = [];
    await Promise.all(pages.map(async (pg) => {
      const stat: any = { page_id: pg.id, changed: 0, messages: 0 };
      try {
        // Page mới -> lưu tên (active=false: chỉ để hiện tên, không ảnh hưởng màn tạo quảng cáo)
        if (!knownIds.has(pg.id)) {
          const info = await gget(pg.id, { fields: "name" }, pg.token);
          if (info?.name) await sb.from("fb_pages").insert({ page_id: pg.id, name: info.name, active: false });
        }
        const d = await gget(`${pg.id}/conversations`, {
          platform: "messenger", limit,
          fields: "id,updated_time,participants,messages.limit(10){id,message,from,created_time,attachments}",
        }, pg.token);
        const convs = (d.data || []).map((c: any) => {
          const user = (c.participants?.data || []).find((u: any) => String(u.id) !== pg.id) || {};
          return { c, user, key: user.id ? `${pg.id}:${user.id}` : null };
        }).filter((x: any) => x.key);
        if (!convs.length) { out.push(stat); return; }

        const { data: rows } = await sb.from("fb_conversations").select("conv_key, last_time, participant_name, phone")
          .in("conv_key", convs.map((x: any) => x.key));
        const have = new Map((rows || []).map((r: any) => [r.conv_key, r]));

        for (const { c, user, key } of convs) {
          const prev: any = have.get(key);
          const updated = new Date(c.updated_time).getTime();
          if (prev?.last_time && new Date(prev.last_time).getTime() >= updated) continue;   // không có tin mới

          const msgs = [...(c.messages?.data || [])].sort((a: any, b: any) => String(a.created_time).localeCompare(String(b.created_time)));
          const last = msgs[msgs.length - 1];
          const name = user.name || prev?.participant_name || null;
          await sb.from("fb_conversations").upsert({
            conv_key: key, page_id: pg.id, psid: String(user.id), thread_id: c.id, participant_name: name,
          }, { onConflict: "conv_key" });
          // Thứ tự thời gian: trigger SLA tính "khách chờ từ lúc nào" đúng
          for (const m of msgs) {
            const isPage = String(m.from?.id) === pg.id;
            const { error } = await sb.from("fb_messages").upsert({
              id: String(m.id), conv_key: key, page_id: pg.id, is_page: isPage,
              from_name: m.from?.name || (isPage ? "Page" : name || "Khách"),
              text: m.message || null,
              attachments: m.attachments?.data?.length ? m.attachments.data : null,
              created_time: m.created_time,
            }, { onConflict: "id" });
            if (!error) stat.messages++;
          }
          await sb.from("fb_conversations").update({
            last_message: last ? (last.message || "[đính kèm]").slice(0, 300) : null,
            last_time: c.updated_time,   // = thời điểm hội thoại có tin mới nhất; lượt sau so với mốc này để bỏ qua
          }).eq("conv_key", key);
          const phone = msgs.map((m: any) => (String(m.from?.id) === pg.id ? null : scanPhone(m.message || ""))).filter(Boolean).pop() || null;
          if (phone && phone !== prev?.phone) await linkPhone(sb, key, phone, name);
          stat.changed++;
        }
      } catch (e) { stat.error = String((e as Error)?.message || e); }
      out.push(stat);
    }));
    return json({ ok: out.every((s) => !s.error), pages: out });
  } catch (e) {
    console.error("fb-inbox-poll error", e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
