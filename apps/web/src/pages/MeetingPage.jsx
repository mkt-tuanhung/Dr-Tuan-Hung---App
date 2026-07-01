import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import '@/styles/meeting-theme.css';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Video, Plus, X, Loader2, Radio, Clock, LogIn, Circle, Square, Sparkles, FileText, Link2, CalendarClock } from 'lucide-react';

const ST = {
  scheduled: { label: 'Sắp diễn ra', cls: 'bg-amber-100 text-amber-700' },
  live: { label: 'Đang họp', cls: 'bg-rose-100 text-rose-700' },
  ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500' },
};

// Ghi cuộc họp bằng LiveKit Egress (server-side) -> R2 -> webhook tự tạo biên bản
function RoomRecorder({ meeting }) {
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const egId = useRef(null);

  const start = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('livekit-egress', { body: { action: 'start', room: meeting.room_name, meetingId: meeting.id } });
    setBusy(false);
    if (error || data?.error) { toast.error('Không ghi được: ' + (error?.message || data?.error)); return; }
    egId.current = data.egressId; setRec(true);
    toast.success('Đang ghi cuộc họp (server) — rời máy vẫn ghi tiếp');
  };
  const stop = async () => {
    setBusy(true);
    await supabase.functions.invoke('livekit-egress', { body: { action: 'stop', egressId: egId.current, meetingId: meeting.id } });
    setBusy(false); setRec(false);
    toast.success('Đã dừng ghi — biên bản AI sẽ tạo khi file sẵn sàng (~1–2 phút)');
  };

  return (
    <button onClick={rec ? stop : start} disabled={busy}
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-[95] px-4 h-10 rounded-full text-sm font-bold shadow-lg inline-flex items-center gap-2 disabled:opacity-60 transition ${rec ? 'bg-white text-rose-600 ring-2 ring-rose-300' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : rec ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4 fill-current" />}
      {busy ? 'Đang xử lý…' : rec ? 'Dừng ghi & tạo biên bản' : 'Ghi lại cuộc họp'}
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

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-teal-600 to-emerald-700 p-6 shadow-lg shadow-teal-600/20 text-white">
        <div className="absolute -top-10 -right-6 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 left-20 w-36 h-36 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 mtg-float"><Video className="w-7 h-7 text-white" /></div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight">Phòng họp</h2>
            <p className="text-white/80 text-sm">Họp video · ghi lại · AI tự tạo biên bản, PRD &amp; việc cần làm</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-2xl bg-white/10 backdrop-blur"><div className="text-2xl font-bold leading-none">{meetings.length}</div><div className="text-[11px] text-white/70 mt-1">cuộc họp</div></div>
            {liveCount > 0 && <div className="text-center px-4 py-2 rounded-2xl bg-rose-500/90 shadow-lg shadow-rose-900/20"><div className="text-2xl font-bold leading-none">{liveCount}</div><div className="text-[11px] text-white/90 mt-1">đang họp</div></div>}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl border border-violet-100 shadow-sm p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-bold text-violet-800"><Sparkles className="w-4 h-4" /> Hỏi kho biên bản (AI) <span className="text-[11px] font-normal text-violet-400">— tra cứu mọi cuộc họp cũ</span></div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="VD: Tháng trước chốt gì về giá dịch vụ? Ai phụ trách việc X?" className="flex-1 px-3.5 py-2.5 text-[15px] rounded-xl border border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition" />
          <button onClick={askAI} disabled={asking} className="h-11 px-6 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 active:scale-[0.98] transition shadow-sm shadow-violet-500/25 disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap">{asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Hỏi AI</button>
        </div>
        {answer && <div className="mtg-in text-sm text-slate-700 bg-white border border-violet-100 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed">{answer}</div>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><span className="w-6 h-6 rounded-lg bg-teal-50 flex items-center justify-center"><Plus className="w-4 h-4 text-teal-600" /></span> Tạo cuộc họp mới</div>
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMeeting(!!schedAt)} placeholder="Tên cuộc họp…" className="w-full px-3.5 py-2.5 text-[15px] rounded-xl border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition" />
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="flex-1 px-3.5 py-2.5 text-[15px] rounded-xl border border-slate-200 focus:border-teal-400 outline-none text-slate-600" />
          <button onClick={() => createMeeting(!!schedAt)} disabled={creating} className="h-11 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold hover:from-teal-600 hover:to-teal-700 active:scale-[0.98] transition shadow-sm shadow-teal-500/25 disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : schedAt ? <CalendarClock className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {schedAt ? 'Lên lịch họp' : 'Tạo & vào họp ngay'}</button>
        </div>
        <p className="text-xs text-slate-400">Để trống ngày giờ = họp ngay. Chọn ngày giờ = lên lịch, rồi bấm <b>Copy link</b> ở thẻ để gửi mọi người.</p>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3"><Video className="w-7 h-7 text-teal-400" /></div>
          <div className="text-slate-500 font-semibold">Chưa có cuộc họp nào</div>
          <div className="text-slate-400 text-sm mt-1">Tạo cuộc họp mới ở trên để bắt đầu.</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((m, i) => {
            const live = m.status === 'live';
            return (
            <div key={m.id} className="mtg-card mtg-in bg-white rounded-2xl border border-slate-100 shadow-sm p-5 pt-6 flex flex-col relative overflow-hidden" style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}>
              <div className={`absolute top-0 inset-x-0 h-1.5 ${live ? 'bg-gradient-to-r from-rose-500 to-orange-400' : m.status === 'scheduled' ? 'bg-gradient-to-r from-teal-400 to-emerald-400' : 'bg-slate-200'}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-slate-800 text-[15px] truncate flex-1">{m.title}</div>
                <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${ST[m.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{live && <span className="w-2 h-2 rounded-full bg-rose-500 mtg-live-dot" />}{ST[m.status]?.label || m.status}</span>
              </div>
              <div className="text-xs text-slate-400 mt-2.5 flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center shrink-0">{initial(m.by?.full_name)}</span>
                <span className="truncate">{m.by?.full_name || '—'}</span>
                <span className="text-slate-300 shrink-0">·</span>
                <span className="inline-flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" /> {new Date(m.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              {m.scheduled_at && <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg w-fit"><CalendarClock className="w-3.5 h-3.5" /> {new Date(m.scheduled_at).toLocaleString('vi-VN')}</div>}
              {m.ai_status === 'processing' && <div className="mt-3 text-xs font-semibold text-amber-800 mtg-processing px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 w-fit"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo biên bản AI…</div>}
              {m.ai_status === 'done' && m.ai_result?.summary && <div className="mt-3 text-xs text-slate-600 bg-violet-50 border border-violet-100 rounded-lg p-2.5 line-clamp-2"><Sparkles className="w-3 h-3 inline text-violet-500 mr-1 -mt-0.5" />{m.ai_result.summary}</div>}
              <div className="mt-auto pt-4 flex flex-wrap gap-2">
                {m.status !== 'ended'
                  ? <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-bold hover:from-teal-600 hover:to-teal-700 active:scale-95 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào họp</button>
                  : <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 active:scale-95 transition inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào lại</button>}
                {m.status !== 'ended' && <button onClick={() => copyLink(m)} title="Copy link phòng họp" className="h-10 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition inline-flex items-center"><Link2 className="w-4 h-4" /></button>}
                {m.status === 'live' && (m.created_by === me?.id || me?.role === 'admin') && <button onClick={() => endMeeting(m)} className="h-10 px-3 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 active:scale-95 transition">Kết thúc</button>}
                {m.ai_status === 'done' && <button onClick={() => setView(m)} className="h-10 px-3 rounded-xl bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 active:scale-95 transition inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Biên bản</button>}
              </div>
            </div>
          );})}
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
