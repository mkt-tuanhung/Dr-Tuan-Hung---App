// Lịch sử ghi chú / trao đổi kéo từ GetFly (bảng getfly_comments — supabase/getfly_comments.sql)
// Edge Function getfly-comments đồng bộ nền mỗi 10'; mở hồ sơ mà khách chưa kéo / GetFly có
// cập nhật mới hơn lần kéo trước -> tự kéo ngay cho khách đó.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { RefreshCw, StickyNote, MessageSquareReply, Clock } from 'lucide-react';

const isMissingTable = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));
const fmtFull = (s) => s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export function useGetflyNotes(row) {
  const [notes, setNotes] = useState([]);
  const [sync, setSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [available, setAvailable] = useState(true);
  const autoDone = useRef(null);

  const load = useCallback(async () => {
    if (!row?.id) return null;
    const [{ data, error }, { data: s }] = await Promise.all([
      supabase.from('getfly_comments').select('id, title, content, creator_name, is_feedback, created_at')
        .eq('data_id', row.id).order('created_at', { ascending: false, nullsFirst: false }).limit(500),
      supabase.from('getfly_comment_sync').select('synced_at, source_updated_at, comment_count, last_error').eq('data_id', row.id).maybeSingle(),
    ]);
    if (isMissingTable(error)) { setAvailable(false); setNotes([]); setSync(null); setLoading(false); return null; }
    setAvailable(true); setNotes(data || []); setSync(s || null); setLoading(false);
    return s || null;
  }, [row?.id]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!row?.getfly_id) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('getfly-comments', { body: { data_id: row.id } });
    setSyncing(false);
    if (error || !data?.ok) { if (!silent) toast.error('Không kéo được ghi chú GetFly: ' + (data?.error || error?.message || 'lỗi')); }
    else if (!silent) toast.success(`Đã cập nhật ${data.count} ghi chú từ GetFly`);
    await load();
  }, [row?.id, row?.getfly_id, load]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setNotes([]); setSync(null);
    load().then((s) => {
      if (!alive || !row?.getfly_id || autoDone.current === row.id) return;
      const stale = !s || (row.getfly_updated_at && (!s.source_updated_at || new Date(row.getfly_updated_at) > new Date(s.source_updated_at)));
      if (stale) { autoDone.current = row.id; refresh({ silent: true }); }
    });
    return () => { alive = false; };
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { notes, sync, loading, syncing, available, refresh };
}

export function GetflyNotesList({ row, gf }) {
  const { notes, sync, loading, syncing, available, refresh } = gf;
  if (!available) return <div className="text-center py-8 text-slate-400 text-sm">Chưa bật lịch sử ghi chú GetFly (chạy supabase/getfly_comments.sql).</div>;
  if (!row.getfly_id) return <div className="text-center py-8 text-slate-400 text-sm">Khách này không có trên GetFly.</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[12px] text-slate-500">
          {sync?.synced_at ? <>Kéo lần cuối {fmtFull(sync.synced_at)} · {notes.length} ghi chú</> : syncing ? 'Đang kéo lần đầu…' : 'Chưa kéo lần nào'}
          {sync?.last_error && <span className="text-rose-500"> · Lỗi lần trước: {sync.last_error}</span>}
        </div>
        <button onClick={() => refresh()} disabled={syncing} className="e-btn e-btn-secondary e-btn-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Đang tải…' : 'Tải lại từ GetFly'}
        </button>
      </div>
      {loading || (syncing && !notes.length) ? <div className="text-center py-8 text-slate-300 text-sm">Đang tải…</div>
        : !notes.length ? <div className="text-center py-8 text-slate-300 text-sm">GetFly chưa có ghi chú nào cho khách này</div>
        : (
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${n.is_feedback ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                    {n.is_feedback ? <MessageSquareReply className="w-3 h-3" /> : <StickyNote className="w-3 h-3" />}{n.is_feedback ? 'Phản hồi' : 'Trao đổi'}
                  </span>
                  <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtFull(n.created_at)}</span>
                  {n.creator_name && <span className="text-[11px] font-semibold text-slate-500">{n.creator_name}</span>}
                </div>
                {n.title && <div className="text-[13px] font-semibold text-slate-800 mt-1.5 break-words">{n.title}</div>}
                {n.content && <div className="text-[13px] text-slate-700 mt-1 whitespace-pre-wrap break-words">{n.content}</div>}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
