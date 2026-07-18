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
import { Video, Plus, X, Loader2, Radio, LogIn, Circle, Square, Sparkles, FileText, Link2, CalendarClock, ChevronRight, Trash2, SlidersHorizontal, Users, CheckCircle2 } from 'lucide-react';

const ST = {
  scheduled: { label: 'Sắp diễn ra', cls: 'bg-amber-100 text-amber-700' },
  live: { label: 'Đang họp', cls: 'bg-emerald-100 text-emerald-700' },
  ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500' },
};

// Icon + màu tròn cho từng cuộc họp (đa dạng như mockup)
const CARD_ICONS = [
  { Icon: CalendarClock, cls: 'bg-violet-100 text-violet-600' },
  { Icon: Users, cls: 'bg-sky-100 text-sky-600' },
  { Icon: FileText, cls: 'bg-amber-100 text-amber-600' },
  { Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-600' },
];
const hashStr = (s) => { let h = 0; const str = String(s || ''); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };
const iconFor = (m) => m.status === 'live' ? { Icon: Radio, cls: 'bg-emerald-100 text-emerald-600' } : CARD_ICONS[hashStr(m.room_name || m.id) % CARD_ICONS.length];
const roomLabel = (m) => 'Phòng họp ' + String.fromCharCode(65 + (hashStr(m.room_name || m.id) % 3));

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
    if (s === t.toLocaleDateString('vi-VN')) return 'Hôm nay - ' + s;
    if (s === y.toLocaleDateString('vi-VN')) return 'Hôm qua - ' + s;
    return s;
  };
  const groups = (() => { const map = new Map(); for (const m of filtered) { const l = dayLabel(m.scheduled_at || m.created_at); if (!map.has(l)) map.set(l, []); map.get(l).push(m); } return [...map.entries()]; })();

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-[calc(100vh-3.25rem)] bg-[#f4f7f6]">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Hero — xanh nhạt, ảnh phòng họp bên phải */}
        <div className="relative overflow-hidden rounded-3xl p-5 border border-emerald-100/70 shadow-sm" style={{ background: 'linear-gradient(120deg, #eafaf1 0%, #e2f5ec 55%, #d6f0e3 100%)' }}>
          {/* Minh hoạ phòng họp — chiếm nửa phải, hoà vào nền */}
          <div className="absolute inset-y-0 right-0 w-[46%] pointer-events-none">
            <svg viewBox="0 0 200 160" className="w-full h-full mtg-float" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="mtgScr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8fe3c0" /><stop offset="1" stopColor="#c9f0dd" /></linearGradient>
              </defs>
              {/* cửa sổ trái */}
              <rect x="6" y="18" width="26" height="104" rx="3" fill="#ffffff" fillOpacity="0.85" />
              <rect x="14" y="18" width="2" height="104" fill="#dfeee7" />
              {/* TV treo tường */}
              <rect x="70" y="30" width="118" height="72" rx="6" fill="#2f3a40" />
              <rect x="76" y="36" width="106" height="60" rx="3" fill="url(#mtgScr)" />
              <path d="M76 84c22-10 36-22 62-6 8 5 18 6 44-2v14a3 3 0 0 1-3 3H79a3 3 0 0 1-3-3z" fill="#ffffff" fillOpacity="0.55" />
              {/* camera + soundbar */}
              <rect x="120" y="22" width="18" height="8" rx="2" fill="#2f3a40" /><circle cx="129" cy="20" r="4" fill="#3a464d" />
              <rect x="104" y="104" width="50" height="8" rx="4" fill="#2f3a40" /><circle cx="146" cy="108" r="2.2" fill="#5b6a72" />
              {/* cây */}
              <path d="M50 118c-6-14-2-30 8-38-2 12 0 24 6 34z" fill="#4bb98a" /><path d="M50 118c8-12 20-18 32-16-10 4 -18 12-22 22z" fill="#5cc79a" />
              <rect x="44" y="116" width="20" height="16" rx="3" fill="#ffffff" />
              {/* bàn kính + ghế */}
              <ellipse cx="118" cy="140" rx="72" ry="14" fill="#ffffff" fillOpacity="0.9" />
              <ellipse cx="118" cy="138" rx="52" ry="9" fill="#e5f6ee" />
              <rect x="112" y="126" width="14" height="20" rx="3" fill="#eef4f2" />
              <circle cx="66" cy="132" r="13" fill="#ffffff" /><circle cx="170" cy="132" r="13" fill="#ffffff" fillOpacity="0.9" />
              <circle cx="96" cy="150" r="13" fill="#ffffff" /><circle cx="140" cy="150" r="13" fill="#ffffff" fillOpacity="0.95" />
            </svg>
            {/* fade trái để ảnh tan vào nền */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #e6f6ee 0%, rgba(230,246,238,0.35) 42%, rgba(230,246,238,0) 70%)' }} />
          </div>

          <div className="relative max-w-[58%]">
            <span className="inline-flex items-center gap-2 w-10 h-10 rounded-xl bg-white/80 text-emerald-600 justify-center shadow-sm"><Video className="w-5 h-5" /></span>
            <div className="mt-3 text-slate-800 font-bold text-lg">Tổng quan phòng họp</div>
            <div className="flex items-end gap-2.5 mt-2">
              <div className="text-5xl font-bold leading-none text-emerald-600">{meetings.length}</div>
              <span className={`mb-1 px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 ${liveCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-white/70 text-slate-500'}`}>{liveCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mtg-live-dot" />}{liveCount > 0 ? `${liveCount} đang họp` : 'Rảnh'}</span>
            </div>
            <div className="text-slate-500 text-xs mt-1">Tổng cuộc họp</div>
            <div className="text-slate-500 text-xs mt-2.5">Họp video · ghi lại · AI biên bản &amp; việc cần làm</div>
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
              <button key={f.k} onClick={() => setFilterTab(f.k)} className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold border transition ${filterTab === f.k ? 'bg-white text-emerald-600 border-emerald-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{f.label}</button>
            ))}
          </div>
          <span className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0"><SlidersHorizontal className="w-4 h-4" /></span>
        </div>

        <div className="flex items-center justify-between px-1 pt-1">
          <h2 className="text-slate-800 font-bold text-lg">Cuộc họp</h2>
          <span className="text-slate-400 text-sm">{filtered.length} cuộc họp</span>
        </div>

        {loading ? (
          <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3"><Video className="w-7 h-7 text-emerald-500" /></div>
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
                    const { Icon, cls } = iconFor(m);
                    return (
                    <button key={m.id} onClick={() => setSheet(m)} className="mtg-in w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md hover:border-emerald-200 active:scale-[0.99] transition text-left" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                      <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${cls}`}><Icon className="w-5 h-5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-800 font-semibold truncate">{m.title}</div>
                        <div className="text-slate-400 text-xs truncate mt-0.5">{m.by?.full_name || '—'} · {new Date(m.scheduled_at || m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {roomLabel(m)}{m.ai_status === 'done' ? ' · có biên bản' : m.ai_status === 'processing' ? ' · đang tạo biên bản…' : ''}</div>
                      </div>
                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${ST[m.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mtg-live-dot" />}{ST[m.status]?.label || m.status}</span>
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
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên cuộc họp…" className="w-full px-3.5 py-3 text-[15px] rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:bg-white outline-none" />
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-xl p-1">
              <button onClick={() => { setSchedOn(false); setSchedAt(''); }} className={`h-9 rounded-lg text-sm font-semibold transition ${!schedOn ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Họp ngay</button>
              <button onClick={() => setSchedOn(true)} className={`h-9 rounded-lg text-sm font-semibold transition ${schedOn ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Lên lịch</button>
            </div>
            {schedOn && (
              <div>
                <label className="block text-slate-500 text-xs mb-1.5 px-0.5">Chọn ngày &amp; giờ họp</label>
                <label className="relative flex items-center justify-between gap-2 w-full px-3.5 py-3 text-[15px] rounded-xl bg-slate-50 border border-slate-200 focus-within:border-emerald-400 cursor-pointer">
                  <span className={schedAt ? 'text-slate-800' : 'text-slate-400'}>{schedAt ? new Date(schedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chọn ngày & giờ họp'}</span>
                  <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
                  <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </label>
              </div>
            )}
            <button onClick={async () => { await createMeeting(schedOn && !!schedAt); setShowCreate(false); }} disabled={creating || (schedOn && !schedAt)} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.98] transition shadow-lg shadow-emerald-600/25 disabled:opacity-50 inline-flex items-center justify-center gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : schedOn ? <CalendarClock className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {schedOn ? 'Lên lịch họp' : 'Tạo & vào họp ngay'}</button>
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
            <button onClick={() => { setSheet(null); join(sheet); }} className={`w-full h-12 rounded-xl font-bold active:scale-[0.98] transition inline-flex items-center justify-center gap-2 ${sheet.status !== 'ended' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/25' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}><LogIn className="w-4 h-4" /> {sheet.status !== 'ended' ? 'Vào họp' : 'Vào lại'}</button>
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
          className="fixed z-[60] bottom-20 lg:bottom-8 right-5 lg:right-8 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-2xl shadow-emerald-900/40 ring-4 ring-emerald-500/20 flex items-center justify-center hover:bg-emerald-700 hover:scale-105 active:scale-95 transition">
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
                <div key={i} className="text-sm bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
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
