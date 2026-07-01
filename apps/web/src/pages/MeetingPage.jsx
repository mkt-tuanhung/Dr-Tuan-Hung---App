import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LiveKitRoom, VideoConference, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadViaPresign } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Video, Plus, X, Loader2, Users, Radio, Clock, LogIn, Circle, Square, Sparkles, FileText } from 'lucide-react';

const ST = {
  scheduled: { label: 'Sắp diễn ra', cls: 'bg-amber-100 text-amber-700' },
  live: { label: 'Đang họp', cls: 'bg-rose-100 text-rose-700' },
  ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500' },
};

// Ghi âm cả phòng (trộn mic mình + tiếng mọi người) -> R2 -> AI biên bản
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
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-[95] px-4 h-10 rounded-full text-sm font-bold shadow-lg inline-flex items-center gap-2 disabled:opacity-60 ${rec ? 'bg-white text-rose-600' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : rec ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4 fill-current" />}
      {busy ? 'Đang lưu…' : rec ? 'Dừng & tạo biên bản' : 'Ghi lại cuộc họp'}
    </button>
  );
}

export default function MeetingPage() {
  const { profile: me } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [joining, setJoining] = useState(null);
  const [room, setRoom] = useState(null);
  const [view, setView] = useState(null);     // xem biên bản

  const load = useCallback(async () => {
    const { data } = await supabase.from('meetings').select('*, by:profiles!created_by(full_name)').order('created_at', { ascending: false }).limit(200);
    setMeetings(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('meetings', load);

  const createMeeting = async () => {
    if (!title.trim()) { toast.error('Nhập tên cuộc họp'); return; }
    setCreating(true);
    const room_name = 'room-' + crypto.randomUUID().slice(0, 8);
    const { data, error } = await supabase.from('meetings').insert({ title: title.trim(), room_name, created_by: me.id, status: 'scheduled' }).select('*').single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setTitle(''); load(); join(data);
  };

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

  const leave = () => { setRoom(null); load(); };
  const endMeeting = async (m) => { await supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', m.id); toast.success('Đã kết thúc cuộc họp'); load(); };
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20"><Video className="w-6 h-6 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">Phòng họp</h2>
          <p className="text-slate-400 text-sm">Họp video · ghi lại · AI tự tạo biên bản, PRD &amp; việc cần làm</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMeeting()} placeholder="Tên cuộc họp mới…" className="flex-1 px-3.5 py-2.5 text-[15px] rounded-xl border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
        <button onClick={createMeeting} disabled={creating} className="h-11 px-5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo &amp; vào họp</button>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">Chưa có cuộc họp nào. Tạo cuộc họp mới ở trên.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {meetings.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-slate-800 truncate flex-1">{m.title}</div>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${ST[m.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{ST[m.status]?.label || m.status}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(m.created_at).toLocaleString('vi-VN')} · {m.by?.full_name || '—'}</div>

              {m.ai_status === 'processing' && <div className="mt-2 text-xs text-amber-600 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo biên bản AI…</div>}
              {m.ai_status === 'done' && m.ai_result?.summary && <div className="mt-2 text-xs text-slate-500 line-clamp-2">{m.ai_result.summary}</div>}

              <div className="mt-auto pt-3 flex flex-wrap gap-2">
                {m.status !== 'ended'
                  ? <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào họp</button>
                  : <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào lại</button>}
                {m.status === 'live' && (m.created_by === me?.id || me?.role === 'admin') && (
                  <button onClick={() => endMeeting(m)} className="h-10 px-3 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50">Kết thúc</button>
                )}
                {m.ai_status === 'done' && <button onClick={() => setView(m)} className="h-10 px-3 rounded-xl bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Biên bản</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view && <MinutesModal m={view} onClose={() => setView(null)} onReanalyze={() => { reanalyze(view); setView(null); }} />}
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
