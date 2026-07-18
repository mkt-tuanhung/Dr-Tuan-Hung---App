import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LiveKitRoom, VideoConference, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import '@/styles/meeting-theme.css';
import { supabase } from '@/lib/supabaseClient';
import { uploadViaPresign } from '@/lib/r2Client';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Video, Plus, X, Loader2, Radio, LogIn, Circle, Square, Sparkles, FileText, Link2, CalendarClock, ChevronRight, Trash2, SlidersHorizontal, Users } from 'lucide-react';

const ST = {
  scheduled: { label: 'Sắp diễn ra', cls: 'bg-amber-100 text-amber-700' },
  live: { label: 'Đang họp', cls: 'bg-rose-100 text-rose-600' },
  ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500' },
};

// Ghi cuộc họp ngay trong trình duyệt (trộn mic mình + tiếng mọi người) -> R2 -> AI biên bản
function RoomRecorder({ meeting }) {
  const room = useRoomContext();
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const ctx = useRef(null); const dest = useRef(null); const mr = useRef(null);
  const chunks = useRef([]); const added = useRef(new Set());

  const addTrack = (mst) => {
    if (!mst || added.current.has(mst.id) || !ctx.current) return;
    added.current.add(mst.id);
    try { ctx.current.createMediaStreamSource(new MediaStream([mst])).connect(dest.current); } catch { /* noop */ }
  };
  const collect = () => {
    room?.localParticipant?.audioTrackPublications?.forEach(p => p.track?.mediaStreamTrack && addTrack(p.track.mediaStreamTrack));
    room?.remoteParticipants?.forEach(rp => rp.audioTrackPublications?.forEach(p => p.track?.mediaStreamTrack && addTrack(p.track.mediaStreamTrack)));
  };
  const onSub = (track) => { if (track.kind === 'audio') addTrack(track.mediaStreamTrack); };

  const start = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx.current = new AC();
    dest.current = ctx.current.createMediaStreamDestination();
    added.current = new Set();
    collect();
    room?.on(RoomEvent.TrackSubscribed, onSub);
    chunks.current = [];
    const m = new MediaRecorder(dest.current.stream, { audioBitsPerSecond: 96000 });
    m.ondataavailable = e => e.data.size > 0 && chunks.current.push(e.data);
    m.start(1000);
    mr.current = m; setRec(true);
    toast.success('Đang ghi lại cuộc họp…');
  };

  const stop = async () => {
    setBusy(true);
    room?.off(RoomEvent.TrackSubscribed, onSub);
    await new Promise(res => { mr.current.onstop = res; mr.current.stop(); });
    try { if (ctx.current?.state !== 'closed') ctx.current.close(); } catch { /* noop */ }
    setRec(false);
    try {
      const blob = new Blob(chunks.current, { type: mr.current.mimeType || 'audio/webm' });
      const file = new File([blob], `meeting-${Date.now()}.webm`, { type: blob.type });
      const url = await uploadViaPresign(file, 'meeting-audio');
      const segs = [...(meeting.segment_urls || []), url];
      await supabase.from('meetings').update({ segment_urls: segs, recording_url: url, ai_status: 'processing' }).eq('id', meeting.id);
      toast.success('Đã lưu bản ghi — đang tạo biên bản AI…');
      supabase.functions.invoke('analyze-meeting', { body: { meeting_id: meeting.id } });
    } catch (e) { toast.error('Lỗi lưu bản ghi: ' + e.message); }
    setBusy(false);
  };

  return (
    <button onClick={rec ? stop : start} disabled={busy}
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-[95] px-4 h-10 rounded-full text-sm font-bold shadow-lg inline-flex items-center gap-2 disabled:opacity-60 transition ${rec ? 'bg-white text-rose-600 ring-2 ring-rose-300' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : rec ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4 fill-current" />}
      {busy ? 'Đang lưu…' : rec ? 'Dừng ghi & tạo biên bản' : 'Ghi lại cuộc họp'}
    </button>
  );
}

export default function MeetingPage() {
  const { profile: me } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [schedAt, setSchedAt] = useState('');  // lên lịch (datetime-local); trống = họp ngay
  const [joining, setJoining] = useState(null);
  const [room, setRoom] = useState(null);
  const [view, setView] = useState(null);     // xem biên bản
  const [q, setQ] = useState(''); const [answer, setAnswer] = useState(''); const [asking, setAsking] = useState(false);
  const [showCreate, setShowCreate] = useState(false); const [showAsk, setShowAsk] = useState(false); const [schedOn, setSchedOn] = useState(false);
  const [sheet, setSheet] = useState(null); const [filterTab, setFilterTab] = useState('all');
  const autoJoined = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('meetings').select('*, by:profiles!created_by(full_name)').order('created_at', { ascending: false }).limit(200);
    setMeetings(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('meetings', load);

  const createMeeting = async (schedule) => {
    if (!title.trim()) { toast.error('Nhập tên cuộc họp'); return; }
    setCreating(true);
    const room_name = 'room-' + crypto.randomUUID().slice(0, 8);
    const payload = { title: title.trim(), room_name, created_by: me.id, status: 'scheduled' };
    if (schedule && schedAt) payload.scheduled_at = new Date(schedAt).toISOString();
    const { data, error } = await supabase.from('meetings').insert(payload).select('*').single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setTitle(''); setSchedAt(''); load();
    if (schedule && schedAt) toast.success('Đã lên lịch họp — chia sẻ link cho mọi người');
    else join(data);
  };

  const copyLink = (m) => {
    const url = `${window.location.origin}/?meeting=${m.room_name}`;
    navigator.clipboard?.writeText(url).then(() => toast.success('Đã copy link phòng họp'), () => toast.error('Không copy được — link: ' + url));
  };

  // Vào phòng tự động khi mở app bằng link ?meeting=<room_name>
  useEffect(() => {
    if (autoJoined.current || loading) return;
    const rn = new URLSearchParams(window.location.search).get('meeting');
    if (!rn) return;
    autoJoined.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    const m = meetings.find(x => x.room_name === rn);
    if (m) join(m); else toast.error('Không tìm thấy phòng họp từ link');
  }, [loading, meetings]);

  const join = async (m) => {
    setJoining(m.id);
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', { body: { room: m.room_name } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (m.status !== 'live') await supabase.from('meetings').update({ status: 'live', started_at: m.started_at || new Date().toISOString() }).eq('id', m.id);
      setRoom({ meeting: m, token: data.token, url: data.url });
    } catch (e) { toast.error('Không vào được phòng: ' + e.message); }
    setJoining(null);
  };

  const askAI = async () => {
    if (!q.trim()) return;
    setAsking(true); setAnswer('');
    const { data, error } = await supabase.functions.invoke('ask-meetings', { body: { question: q } });
    setAsking(false);
    if (error) { toast.error(error.message); return; }
    if (data?.error) { toast.error(data.error); return; }
    setAnswer(data.answer || '');
  };

  const leave = () => { setRoom(null); load(); };
  const endMeeting = async (m) => { await supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', m.id); toast.success('Đã kết thúc cuộc họp'); load(); };
  const delMeeting = async (m) => {
    if (!window.confirm(`Xoá cuộc họp “${m.title}”? Không thể khôi phục.`)) return;
    const { error } = await supabase.from('meetings').delete().eq('id', m.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã xoá cuộc họp'); setSheet(null); load();
  };
  const reanalyze = (m) => { supabase.from('meetings').update({ ai_status: 'processing' }).eq('id', m.id); supabase.functions.invoke('analyze-meeting', { body: { meeting_id: m.id } }).then(load); toast.success('Đang tạo lại biên bản…'); };

  if (room) {
    return (
      <div className="fixed inset-0 z-[80] bg-[#1a1a1a] flex flex-col" data-lk-theme="default">
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0"><Radio className="w-4 h-4 text-rose-400 shrink-0" /><span className="font-semibold truncate">{room.meeting.title}</span></div>
          <button onClick={leave} className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-sm font-semibold shrink-0">Rời phòng</button>
        </div>
        <div className="flex-1 min-h-0">
          <LiveKitRoom serverUrl={room.url} token={room.token} connect audio video onDisconnected={leave} style={{ height: '100%' }}>
            <VideoConference />
            <RoomRecorder meeting={room.meeting} />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  const order = { live: 0, scheduled: 1, ended: 2 };
  const sorted = [...meetings].sort((a, b) => (order[a.status] - order[b.status]) || (new Date(b.scheduled_at || b.created_at) - new Date(a.scheduled_at || a.created_at)));
  const liveCount = meetings.filter(m => m.status === 'live').length;
  const initial = (n) => (n || '?').trim().charAt(0).toUpperCase();
  const isOwner = (m) => m.created_by === me?.id || me?.role === 'admin';
  const FILTERS = [{ k: 'all', label: 'Tất cả' }, { k: 'live', label: 'Đang họp' }, { k: 'scheduled', label: 'Sắp tới' }, { k: 'ended', label: 'Đã xong' }];
  const filtered = filterTab === 'all' ? sorted : sorted.filter(m => m.status === filterTab);
  const dayLabel = (d) => {
    const s = new Date(d).toLocaleDateString('vi-VN'); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    if (s === t.toLocaleDateString('vi-VN')) return 'Hôm nay';
    if (s === y.toLocaleDateString('vi-VN')) return 'Hôm qua';
    return s;
  };
  const groups = (() => { const map = new Map(); for (const m of filtered) { const l = dayLabel(m.scheduled_at || m.created_at); if (!map.has(l)) map.set(l, []); map.get(l).push(m); } return [...map.entries()]; })();

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-[calc(100vh-3.25rem)] bg-[#eef4f3]">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Hero — teal, tổng quan phòng họp + minh hoạ */}
        <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-teal-900/10" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)' }}>
          <div className="absolute -top-14 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-white/70 text-sm"><Video className="w-4 h-4" /> Tổng quan phòng họp</span>
              <div className="flex items-end gap-2.5 mt-2">
                <div className="text-5xl font-bold leading-none">{meetings.length}</div>
                <span className={`mb-1 px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 ${liveCount > 0 ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'}`}>{liveCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-white mtg-live-dot" />}{liveCount > 0 ? `${liveCount} đang họp` : 'Rảnh'}</span>
              </div>
              <div className="text-white/70 text-xs mt-2.5">Họp video · ghi lại · AI biên bản &amp; việc cần làm</div>
            </div>
            {/* Minh hoạ phòng họp */}
            <svg viewBox="0 0 120 96" className="w-28 h-24 shrink-0 mtg-float" fill="none" aria-hidden="true">
              <rect x="8" y="10" width="104" height="58" rx="6" fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
              <rect x="18" y="20" width="38" height="26" rx="3" fill="#ffffff" fillOpacity="0.25" />
              <rect x="64" y="20" width="38" height="26" rx="3" fill="#ffffff" fillOpacity="0.18" />
              <circle cx="37" cy="30" r="6" fill="#ffffff" fillOpacity="0.7" />
              <path d="M27 42c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#ffffff" fillOpacity="0.7" />
              <circle cx="83" cy="30" r="6" fill="#ffffff" fillOpacity="0.5" />
              <path d="M73 42c0-5.5 4.5-9 10-9s10 3.5 10 9" fill="#ffffff" fillOpacity="0.5" />
              <ellipse cx="60" cy="80" rx="34" ry="8" fill="#ffffff" fillOpacity="0.16" />
              <rect x="56" y="66" width="8" height="12" rx="2" fill="#ffffff" fillOpacity="0.3" />
            </svg>
          </div>
        </div>

        {/* Hỏi kho biên bản (AI) — thẻ trắng */}
        <button onClick={() => setShowAsk(true)} className="w-full rounded-2xl bg-white border border-slate-200/70 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:border-violet-200 active:scale-[0.99] transition text-left">
          <span className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800">Hỏi kho biên bản (AI)</div>
            <div className="text-slate-500 text-xs truncate">Tra cứu nhanh mọi quyết định &amp; nội dung đã họp</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
        </button>

        {/* Bộ lọc pill + nút lọc */}
        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
            {FILTERS.map(f => (
              <button key={f.k} onClick={() => setFilterTab(f.k)} className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition ${filterTab === f.k ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>{f.label}</button>
            ))}
          </div>
          <span className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0"><SlidersHorizontal className="w-4 h-4" /></span>
        </div>

        <div className="flex items-center justify-between px-1 pt-1">
          <h2 className="text-slate-800 font-bold text-lg">Cuộc họp</h2>
          <span className="text-slate-400 text-sm">{filtered.length} cuộc họp</span>
        </div>

        {loading ? (
          <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3"><Video className="w-7 h-7 text-teal-500" /></div>
            <div className="text-slate-700 font-semibold">Chưa có cuộc họp</div>
            <div className="text-slate-400 text-sm mt-1">Bấm nút “+” để tạo cuộc họp.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([label, items]) => (
              <div key={label}>
                <div className="text-slate-400 text-xs font-semibold px-1 mb-2">{label}</div>
                <div className="space-y-2.5">
                  {items.map((m, i) => {
                    const live = m.status === 'live';
                    return (
                    <button key={m.id} onClick={() => setSheet(m)} className="mtg-in w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md hover:border-teal-200 active:scale-[0.99] transition text-left" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                      <span className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${live ? 'bg-rose-100 text-rose-600' : m.status === 'scheduled' ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'}`}>{initial(m.title)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-800 font-semibold truncate">{m.title}</div>
                        <div className="text-slate-400 text-xs truncate mt-0.5 flex items-center gap-1"><Users className="w-3.5 h-3.5 shrink-0" />{m.by?.full_name || '—'} · {new Date(m.scheduled_at || m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{m.ai_status === 'done' ? ' · có biên bản' : m.ai_status === 'processing' ? ' · đang tạo biên bản…' : ''}</div>
                      </div>
                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${ST[m.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{live && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mtg-live-dot" />}{ST[m.status]?.label || m.status}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  );})}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <Sheet title="Tạo cuộc họp" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên cuộc họp…" className="w-full px-3.5 py-3 text-[15px] rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-teal-400 focus:bg-white outline-none" />
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
              <button onClick={() => { setSchedOn(false); setSchedAt(''); }} className={`h-9 rounded-lg text-sm font-semibold transition ${!schedOn ? 'bg-white text-teal-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Họp ngay</button>
              <button onClick={() => setSchedOn(true)} className={`h-9 rounded-lg text-sm font-semibold transition ${schedOn ? 'bg-white text-teal-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Lên lịch</button>
            </div>
            {schedOn && (
              <div>
                <label className="block text-slate-500 text-xs mb-1.5 px-0.5">Chọn ngày &amp; giờ họp</label>
                <label className="relative flex items-center justify-between gap-2 w-full px-3.5 py-3 text-[15px] rounded-xl bg-slate-50 border border-slate-200 focus-within:border-teal-400 cursor-pointer">
                  <span className={schedAt ? 'text-slate-800' : 'text-slate-400'}>{schedAt ? new Date(schedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chọn ngày & giờ họp'}</span>
                  <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
                  <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </label>
              </div>
            )}
            <button onClick={async () => { await createMeeting(schedOn && !!schedAt); setShowCreate(false); }} disabled={creating || (schedOn && !schedAt)} className="w-full h-12 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 active:scale-[0.98] transition shadow-lg shadow-teal-600/25 disabled:opacity-50 inline-flex items-center justify-center gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : schedOn ? <CalendarClock className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {schedOn ? 'Lên lịch họp' : 'Tạo & vào họp ngay'}</button>
          </div>
        </Sheet>
      )}

      {showAsk && (
        <Sheet title="Hỏi kho biên bản (AI)" onClose={() => setShowAsk(false)}>
          <div className="space-y-3">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="VD: Tháng trước chốt gì về giá dịch vụ?" className="w-full px-3.5 py-3 text-[15px] rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-violet-400 focus:bg-white outline-none" />
            <button onClick={askAI} disabled={asking} className="w-full h-12 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-2">{asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Hỏi AI</button>
            {answer && <div className="mtg-in text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{answer}</div>}
          </div>
        </Sheet>
      )}

      {sheet && (
        <Sheet title={sheet.title} onClose={() => setSheet(null)}>
          <div className="text-slate-500 text-sm mb-4">{ST[sheet.status]?.label || sheet.status} · {sheet.by?.full_name || '—'} · {new Date(sheet.scheduled_at || sheet.created_at).toLocaleString('vi-VN')}</div>
          <div className="space-y-2.5">
            <button onClick={() => { setSheet(null); join(sheet); }} className={`w-full h-12 rounded-xl font-bold active:scale-[0.98] transition inline-flex items-center justify-center gap-2 ${sheet.status !== 'ended' ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/25' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}><LogIn className="w-4 h-4" /> {sheet.status !== 'ended' ? 'Vào họp' : 'Vào lại'}</button>
            {sheet.status !== 'ended' && <button onClick={() => copyLink(sheet)} className="w-full h-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 font-bold hover:bg-sky-100 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"><Link2 className="w-4 h-4" /> Copy link phòng họp</button>}
            {sheet.ai_status === 'done' && <button onClick={() => { setSheet(null); setView(sheet); }} className="w-full h-12 rounded-xl bg-violet-50 text-violet-600 border border-violet-200 font-bold hover:bg-violet-100 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Xem biên bản AI</button>}
            {sheet.status === 'live' && isOwner(sheet) && <button onClick={() => { endMeeting(sheet); setSheet(null); }} className="w-full h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold hover:bg-rose-100 active:scale-[0.98] transition">Kết thúc cuộc họp</button>}
            {isOwner(sheet) && <button onClick={() => delMeeting(sheet)} className="w-full h-11 rounded-xl text-rose-500 text-sm font-semibold hover:bg-rose-50 active:scale-[0.98] transition inline-flex items-center justify-center gap-2 mt-1"><Trash2 className="w-4 h-4" /> Xoá cuộc họp</button>}
          </div>
        </Sheet>
      )}

      {view && <MinutesModal m={view} onClose={() => setView(null)} onReanalyze={() => { reanalyze(view); setView(null); }} />}

      {/* FAB tạo cuộc họp — góc dưới phải, thuận ngón cái (như Google Meet) */}
      {!showCreate && !showAsk && !sheet && !view && (
        <button onClick={() => { setSchedOn(false); setSchedAt(''); setShowCreate(true); }} title="Tạo cuộc họp"
          className="fixed z-[60] bottom-20 lg:bottom-8 right-5 lg:right-8 w-14 h-14 rounded-full bg-teal-600 text-white shadow-2xl shadow-teal-900/40 ring-4 ring-teal-500/20 flex items-center justify-center hover:bg-teal-700 hover:scale-105 active:scale-95 transition">
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-bold text-lg truncate pr-2">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MinutesModal({ m, onClose, onReanalyze }) {
  const r = m.ai_result || {};
  const Section = ({ title, children }) => <div className="mb-4"><div className="text-sm font-bold text-slate-700 mb-1.5">{title}</div>{children}</div>;
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" /> Biên bản: {m.title}</h3>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5">
          {r.summary && <Section title="Tóm tắt"><p className="text-sm text-slate-600 leading-relaxed">{r.summary}</p></Section>}
          {(r.key_points || []).length > 0 && <Section title="Ý chính"><ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">{r.key_points.map((x, i) => <li key={i}>{x}</li>)}</ul></Section>}
          {(r.decisions || []).length > 0 && <Section title="Quyết định"><ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">{r.decisions.map((x, i) => <li key={i}>{x}</li>)}</ul></Section>}
          {(r.action_items || []).length > 0 && (
            <Section title="Việc cần làm">
              <div className="space-y-1.5">{r.action_items.map((a, i) => (
                <div key={i} className="text-sm bg-teal-50 border border-teal-100 rounded-lg p-2.5">
                  <span className="font-semibold text-slate-800">{a.task}</span>
                  <div className="text-xs text-slate-500 mt-0.5">{a.assignee ? `👤 ${a.assignee}` : ''}{a.due ? ` · ⏰ ${a.due}` : ''}</div>
                </div>
              ))}</div>
            </Section>
          )}
          {r.prd && <Section title="Tài liệu / PRD"><div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap max-h-72 overflow-y-auto">{r.prd}</div></Section>}
          {m.transcript && <details className="mt-2"><summary className="text-sm font-bold text-slate-500 cursor-pointer flex items-center gap-1.5"><FileText className="w-4 h-4" /> Xem transcript</summary><div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap max-h-60 overflow-y-auto mt-2">{m.transcript}</div></details>}
          <div className="flex justify-end pt-2"><button onClick={onReanalyze} className="text-sm font-semibold text-violet-600 hover:underline">Tạo lại biên bản</button></div>
        </div>
      </div>
    </div>
  );
}
