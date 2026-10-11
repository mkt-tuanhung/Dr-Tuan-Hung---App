// ============================================================
// X05 HỘP THƯ ĐA KÊNH (chỉ xem) — theo Ethics InboxPage
// Dữ liệu Messenger fanpage do Edge Function fb-messenger-webhook / fb-messenger-sync
// ghi vào (supabase/fb_messenger.sql):
//   fb_conversations: conv_key (page_id:psid), page_id, psid, thread_id, participant_name,
//                     phone (SĐT quét được), data_id -> marketing_data, last_message, last_time
//   fb_messages:      id (mid), conv_key, page_id, is_page, from_name, text, attachments, created_time
// CHƯA trả lời trực tiếp được (chưa có quyền gửi tin của Meta) -> ô soạn tin bị khoá,
// KHÔNG gọi API gửi tin. Nút "Mở trên Messenger" mở Meta Business Suite.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessagesSquare, ArrowLeft, ExternalLink, Send, RotateCw, Phone, Paperclip, Link2, UserX, MessageCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { phoneView, isSaleOffline } from '@/lib/phoneMask';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { AlertStrip, EmptyState, ErrorState, FilterSelect, SearchInput, usePageTitle } from '@/components/ds';
import { Customer360Button } from '@/features/crm/Customer360.jsx';

const CONV_STEP = 300;  // số hội thoại tải mỗi lần
const MSG_LIMIT = 500;  // số tin gần nhất của 1 hội thoại
const SEGMENTS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'phone', label: 'Có SĐT' },
  { value: 'unlinked', label: 'Chưa gắn khách' },
];
const TZ = 'Asia/Ho_Chi_Minh';
const CONV_COLS = 'conv_key, page_id, psid, thread_id, participant_name, phone, data_id, last_message, last_time';

const isMissing = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205'
  || (/fb_(conversations|messages)/.test(e.message || '') && /does not exist|could not find|schema cache/i.test(e.message || '')));
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const vnDay = (s) => new Date(s).toLocaleDateString('en-CA', { timeZone: TZ });
const hm = (s) => new Date(s).toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fullTime = (s) => new Date(s).toLocaleString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

// "vừa xong" · "5 phút" · "3 giờ" · "Hôm qua" · "12/09"
function ago(s) {
  if (!s) return '';
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  const today = vnDay(new Date());
  const d = vnDay(s);
  if (d === today) return `${Math.floor(diff / 3600)} giờ`;
  const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: TZ });
  if (d === y) return 'Hôm qua';
  const [yy, mm, dd] = d.split('-');
  return yy === today.slice(0, 4) ? `${dd}/${mm}` : `${dd}/${mm}/${yy.slice(2)}`;
}
function dayLabel(d) {
  const today = vnDay(new Date());
  if (d === today) return 'Hôm nay';
  if (d === new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: TZ })) return 'Hôm qua';
  return d.split('-').reverse().join('/');
}

// Sale Offline không được xem SĐT khách -> che cả SĐT nằm trong nội dung chat
const PHONE_IN_TEXT = /(?:\+?84|0)(?:[\s.-]?\d){8,9}/g;
const maskText = (t, hide) => (hide && t ? String(t).replace(PHONE_IN_TEXT, (m) => `${m.slice(0, -4)}••••`) : t);

// Link mở hội thoại trong Meta Business Suite
const metaInboxUrl = (c) => `https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(c.page_id)}&selected_item_id=${encodeURIComponent(c.psid)}`;

// Tệp đính kèm: webhook lưu [{type, payload:{url}}]; sync (Graph API) lưu [{mime_type, name, image_data:{url}, file_url, video_data:{url}}]
function attachmentsOf(v) {
  const list = Array.isArray(v) ? v : [];
  return list.map((a) => {
    const url = a?.payload?.url || a?.image_data?.url || a?.image_data?.preview_url || a?.video_data?.url || a?.file_url || a?.url || '';
    const type = a?.type || (a?.image_data ? 'image' : a?.video_data ? 'video' : String(a?.mime_type || '').split('/')[0] || 'file');
    return { url: /^https?:\/\//.test(url) ? url : '', type, name: a?.name || a?.title || '' };
  });
}

function Avatar({ name, size = 40 }) {
  return <span className="e-avatar text-[13px]" style={{ width: size, height: size }} aria-hidden>{initials(name)}</span>;
}

function Attachment({ a, mine }) {
  if (a.type === 'image' && a.url) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block">
        <img src={a.url} alt="Ảnh đính kèm" loading="lazy" className="max-w-[220px] max-h-[220px] rounded-xl object-cover bg-slate-100" />
      </a>
    );
  }
  const label = a.type === 'video' ? 'Video' : a.type === 'audio' ? 'Ghi âm' : a.name || 'Tệp đính kèm';
  const cls = `inline-flex items-center gap-1.5 text-[13px] underline-offset-2 ${mine ? 'text-white/90' : 'text-teal-700'}`;
  return a.url
    ? <a href={a.url} target="_blank" rel="noreferrer" className={`${cls} hover:underline`}><Paperclip className="w-3.5 h-3.5" />{label}</a>
    : <span className={cls}><Paperclip className="w-3.5 h-3.5" />{label}</span>;
}

export default function InboxPage() {
  usePageTitle('Hộp thư đa kênh');
  const { profile } = useAuth();
  const hidePhone = isSaleOffline(profile);

  const [convs, setConvs] = useState([]);
  const [limit, setLimit] = useState(CONV_STEP);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState('all');
  const [page, setPage] = useState('');
  const [currentKey, setCurrentKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [msgs, setMsgs] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(null);
  const endRef = useRef(null);

  const loadConvs = useCallback(async () => {
    setLoading(true); setError(null);
    const query = (cols) => supabase.from('fb_conversations').select(cols)
      .order('last_time', { ascending: false, nullsFirst: false })
      .limit(limit);
    let { data, error: err } = await query(`${CONV_COLS}, khach:marketing_data!data_id(customer_name)`);
    // Không nối được sang marketing_data (thiếu khoá ngoại) -> tải không kèm tên khách
    if (err?.code === 'PGRST200') ({ data, error: err } = await query(CONV_COLS));
    if (err) {
      const miss = isMissing(err);
      setMissing(miss); setError(miss ? null : err);
      setConvs([]); setLoading(false); return;
    }
    setMissing(false);
    setConvs(data || []);
    setHasMore((data || []).length >= limit);
    setLoading(false);
  }, [limit]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  // Hội thoại mới / cập nhật (realtime) -> tải lại danh sách
  useEffect(() => {
    if (missing) return undefined;
    let t = null;
    const ch = supabase.channel('inbox-fb-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fb_conversations' }, () => {
        clearTimeout(t); t = setTimeout(() => loadConvs(), 800);
      })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [missing, loadConvs]);

  const pages = useMemo(() => [...new Set(convs.map(c => c.page_id).filter(Boolean))], [convs]);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const digits = kw.replace(/\D/g, '');
    return convs.filter(c => {
      if (seg === 'phone' && !c.phone) return false;
      if (seg === 'unlinked' && c.data_id) return false;
      if (page && c.page_id !== page) return false;
      if (!kw) return true;
      if (digits.length >= 3 && !hidePhone && String(c.phone || '').includes(digits)) return true;
      return [c.participant_name, c.khach?.customer_name, maskText(c.last_message, hidePhone)].some(x => String(x || '').toLowerCase().includes(kw));
    });
  }, [convs, q, seg, page, hidePhone]);

  const counts = useMemo(() => ({
    all: convs.length,
    phone: convs.filter(c => c.phone).length,
    unlinked: convs.filter(c => !c.data_id).length,
  }), [convs]);

  // Máy tính: tự chọn hội thoại đầu tiên; điện thoại: chờ người dùng bấm
  const current = convs.find(c => c.conv_key === currentKey) || null;
  useEffect(() => {
    if (!currentKey && list.length && window.matchMedia?.('(min-width: 1024px)').matches) setCurrentKey(list[0].conv_key);
  }, [currentKey, list]);

  const loadMsgs = useCallback(async (key, silent = false) => {
    if (!key) { setMsgs([]); return; }
    if (!silent) { setMsgLoading(true); setMsgError(null); }
    const { data, error: err } = await supabase.from('fb_messages')
      .select('id, is_page, from_name, text, attachments, created_time')
      .eq('conv_key', key)
      .order('created_time', { ascending: false })
      .limit(MSG_LIMIT);
    if (err) { if (!silent) { setMsgError(err); setMsgs([]); setMsgLoading(false); } return; }
    setMsgs((data || []).slice().reverse());
    setMsgLoading(false);
  }, []);

  useEffect(() => { loadMsgs(currentKey); }, [currentKey, loadMsgs]);

  // Tin mới của hội thoại đang mở (realtime)
  useEffect(() => {
    if (!currentKey || missing) return undefined;
    const ch = supabase.channel(`inbox-fb-messages-${currentKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fb_messages', filter: `conv_key=eq.${currentKey}` }, () => loadMsgs(currentKey, true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentKey, missing, loadMsgs]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, currentKey]);

  const openConv = (key) => { setCurrentKey(key); setMobileOpen(true); };

  // Nhóm tin theo ngày (giờ VN)
  const grouped = useMemo(() => {
    const out = [];
    let last = '';
    msgs.forEach(m => {
      const d = vnDay(m.created_time);
      if (d !== last) { out.push({ kind: 'day', key: `d-${d}`, label: dayLabel(d) }); last = d; }
      out.push({ kind: 'msg', key: m.id, m });
    });
    return out;
  }, [msgs]);

  if (missing) {
    return (
      <div className="e-card">
        <EmptyState icon={MessagesSquare} title="Chưa kết nối Messenger"
          description="Hộp thư chưa được cấu hình đồng bộ tin nhắn fanpage. Chạy supabase/fb_messenger.sql và bật Edge Function fb-messenger-webhook / fb-messenger-sync để tin nhắn hiện ở đây." />
      </div>
    );
  }

  const displayName = (c) => c.participant_name || c.khach?.customer_name || 'Khách Messenger';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 lg:h-[calc(100vh-150px)] lg:min-h-[560px]">
      {/* ---------- Danh sách hội thoại ---------- */}
      <section className={`e-card overflow-hidden flex-col min-h-0 ${mobileOpen ? 'hidden lg:flex' : 'flex'}`} aria-label="Danh sách hội thoại">
        <div className="p-3 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, SĐT, tin nhắn…" className="flex-1 min-w-0" />
            <button type="button" onClick={loadConvs} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Tải lại" title="Tải lại"><RotateCw className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="e-seg" role="tablist" aria-label="Lọc hội thoại">
              {SEGMENTS.map(s => (
                <button key={s.value} type="button" role="tab" aria-selected={seg === s.value} onClick={() => setSeg(s.value)}
                  className={`e-seg-item !px-2.5 ${seg === s.value ? 'e-seg-active' : ''}`}>
                  {s.label}<span className="text-[11px] text-slate-400 font-medium tabular-nums">{counts[s.value]}</span>
                </button>
              ))}
            </div>
            {pages.length > 1 && (
              <FilterSelect label="Fanpage" allLabel="Mọi fanpage" value={page} onChange={setPage}
                options={pages.map(p => ({ value: p, label: `Page …${String(p).slice(-5)}` }))} />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 max-lg:max-h-[calc(100vh-260px)] max-lg:min-h-[320px]">
          {error ? <ErrorState onRetry={loadConvs} /> : loading && !convs.length ? (
            [0, 1, 2, 3, 4].map(i => <div key={i} className="h-16 m-1.5 rounded-xl bg-slate-50 animate-pulse" />)
          ) : list.length === 0 ? (
            <EmptyState icon={MessageCircle} title={convs.length ? 'Không có hội thoại phù hợp' : 'Chưa có hội thoại'}
              description={convs.length ? 'Thử đổi bộ lọc hoặc từ khoá.' : 'Tin nhắn fanpage sẽ hiện ở đây khi đồng bộ Messenger chạy.'} />
          ) : (
            <>
              {list.map(c => {
                const active = c.conv_key === currentKey;
                return (
                  <button key={c.conv_key} type="button" onClick={() => openConv(c.conv_key)} aria-current={active || undefined}
                    className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 p-2.5 rounded-xl text-left transition ${active ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                    <Avatar name={displayName(c)} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-slate-900 truncate">{displayName(c)}</span>
                      <span className="block text-[12.5px] text-slate-500 truncate">{maskText(c.last_message, hidePhone) || 'Chưa có tin nhắn'}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums">{ago(c.last_time)}</span>
                      {c.data_id
                        ? <span className="e-badge e-badge-sm e-tone-success !px-1.5" title="Đã gắn khách trong Data"><Link2 className="!w-3 !h-3" /></span>
                        : c.phone
                          ? <span className="e-badge e-badge-sm e-tone-info !px-1.5" title="Có SĐT"><Phone className="!w-3 !h-3" /></span>
                          : null}
                    </span>
                  </button>
                );
              })}
              {hasMore && (
                <div className="p-2 text-center">
                  <button type="button" className="e-btn e-btn-ghost e-btn-sm" disabled={loading} onClick={() => setLimit(l => l + CONV_STEP)}>
                    {loading ? 'Đang tải…' : 'Tải thêm hội thoại'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ---------- Khung hội thoại ---------- */}
      <section className={`e-card overflow-hidden flex-col min-h-0 max-lg:min-h-[calc(100vh-170px)] ${mobileOpen ? 'flex' : 'hidden lg:flex'}`} aria-label="Nội dung hội thoại">
        {!current ? (
          <div className="flex-1 grid place-items-center">
            <EmptyState icon={MessagesSquare} title="Chọn một hội thoại" description="Bấm vào một hội thoại bên trái để xem tin nhắn." />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 px-3 lg:px-4 py-3 border-b border-slate-100 flex-wrap">
              <button type="button" onClick={() => setMobileOpen(false)} className="e-icon-btn w-9 h-9 lg:hidden" aria-label="Quay lại danh sách"><ArrowLeft className="w-4 h-4" /></button>
              <Avatar name={displayName(current)} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-slate-900 truncate">{displayName(current)}</div>
                <div className="text-[12.5px] text-slate-500 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span>Messenger</span>
                  {current.phone
                    ? <span className="inline-flex items-center gap-1 tabular-nums"><Phone className="w-3 h-3" />{phoneView(current.phone, profile)}</span>
                    : <span className="text-slate-400">Chưa có SĐT</span>}
                  {current.data_id
                    ? <span className="e-badge e-badge-sm e-tone-success">Đã gắn khách{current.khach?.customer_name && current.khach.customer_name !== current.participant_name ? ` · ${current.khach.customer_name}` : ''}</span>
                    : <span className="e-badge e-badge-sm e-tone-neutral"><UserX />Chưa gắn khách</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
                <Customer360Button phone={current.phone} name={current.khach?.customer_name || current.participant_name} />
                <a href={metaInboxUrl(current)} target="_blank" rel="noreferrer" className="e-btn e-btn-secondary e-btn-sm h-8 px-2.5">
                  <ExternalLink /> Mở trên Messenger
                </a>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-3 lg:px-5 py-4 bg-slate-50/70 flex flex-col gap-2 max-lg:min-h-[320px]">
              {msgError ? <ErrorState onRetry={() => loadMsgs(currentKey)} /> : msgLoading ? (
                [0, 1, 2, 3].map(i => <div key={i} className={`h-11 w-2/3 rounded-2xl bg-white animate-pulse ${i % 2 ? 'self-end' : ''}`} />)
              ) : msgs.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Chưa có tin nhắn được đồng bộ" description={current.last_message ? `Tin gần nhất: “${maskText(current.last_message, hidePhone)}”` : undefined} />
              ) : (
                <>
                  {msgs.length >= MSG_LIMIT && <div className="text-center text-[12px] text-slate-400">Đang hiện {MSG_LIMIT} tin gần nhất — mở trên Messenger để xem cũ hơn</div>}
                  {grouped.map(g => (g.kind === 'day' ? (
                    <div key={g.key} className="self-center my-1.5 px-2.5 py-0.5 rounded-full bg-white border border-slate-100 text-[11.5px] text-slate-500 font-medium">{g.label}</div>
                  ) : (
                    <Bubble key={g.key} m={g.m} hidePhone={hidePhone} />
                  )))}
                </>
              )}
              <div ref={endRef} />
            </div>

            {/* Ô soạn tin — khoá cho tới khi có quyền gửi tin của Meta */}
            <div className="px-3 lg:px-4 py-3 border-t border-slate-100 space-y-2.5">
              <AlertStrip tone="info">Trả lời trực tiếp sẽ bật khi kết nối quyền gửi tin của Meta. Tạm thời bấm <b>Mở trên Messenger</b> để trả lời khách.</AlertStrip>
              <div className="flex items-end gap-2.5">
                <textarea className="e-textarea min-h-[48px] flex-1 resize-none cursor-not-allowed opacity-60" disabled
                  placeholder="Chưa thể gửi tin từ ứng dụng" aria-label="Tin nhắn (chưa khả dụng)" />
                <button type="button" className="e-btn e-btn-primary" disabled title="Chưa kết nối quyền gửi tin"><Send /> Gửi</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Bubble({ m, hidePhone }) {
  const mine = m.is_page;
  const files = attachmentsOf(m.attachments);
  const text = maskText(m.text, hidePhone);
  return (
    <div className={`max-w-[80%] lg:max-w-[70%] flex flex-col gap-1 ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      {mine && m.from_name && m.from_name !== 'Page' && <span className="text-[11px] text-slate-400 px-1">{m.from_name}</span>}
      <div className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-[1.45] whitespace-pre-wrap break-words space-y-1.5 ${mine
        ? 'bg-teal-600 text-white rounded-br-md'
        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'}`}>
        {text && <div>{text}</div>}
        {files.map((a, i) => <Attachment key={i} a={a} mine={mine} />)}
        {!text && !files.length && <div className={mine ? 'text-white/70 italic' : 'text-slate-400 italic'}>(Tin nhắn không có nội dung)</div>}
        <div className={`text-[10.5px] tabular-nums ${mine ? 'text-white/70 text-right' : 'text-slate-400'}`} title={fullTime(m.created_time)}>{hm(m.created_time)}</div>
      </div>
    </div>
  );
}
