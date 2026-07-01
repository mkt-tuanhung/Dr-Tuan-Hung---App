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
  scheduled: { label: 'Sắp diễn ra', cls: 'bg-amber-400/15 text-amber-300' },
  live: { label: 'Đang họp', cls: 'bg-rose-500/20 text-rose-300' },
  ended: { label: 'Đã kết thúc', cls: 'bg-white/10 text-white/50' },
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
    <div className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-[calc(100vh-3.25rem)]" style={{ background: 'radial-gradient(130% 90% at 50% -10%, #123a29 0%, #0b1712 55%, #070b09 100%)' }}>
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_360px] gap-5 items-start">

        {/* CỘT TRÁI: danh sách cuộc họp */}
        <div className="order-2 lg:order-1 space-y-4 min-w-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-white font-bold text-xl">Cuộc họp</h2>
            <span className="text-white/40 text-sm">{meetings.length} cuộc</span>
          </div>
          {loading ? (
            <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-white/15 border-t-emerald-400 rounded-full animate-spin" /></div>
          ) : sorted.length === 0 ? (
            <div className="bg-white/[0.03] rounded-2xl border border-dashed border-white/10 p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-3"><Video className="w-7 h-7 text-emerald-300" /></div>
              <div className="text-white/70 font-semibold">Chưa có cuộc họp nào</div>
              <div className="text-white/40 text-sm mt-1">Tạo cuộc họp ở cột bên phải để bắt đầu.</div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
              {sorted.map((m, i) => {
            const live = m.status === 'live';
            return (
            <div key={m.id} className="mtg-card mtg-in rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-5 pt-6 flex flex-col relative overflow-hidden" style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}>
              <div className={`absolute top-0 inset-x-0 h-1.5 ${live ? 'bg-gradient-to-r from-rose-500 to-orange-400' : m.status === 'scheduled' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-white/10'}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-white text-[15px] truncate flex-1">{m.title}</div>
                <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${ST[m.status]?.cls || 'bg-white/10 text-white/50'}`}>{live && <span className="w-2 h-2 rounded-full bg-rose-400 mtg-live-dot" />}{ST[m.status]?.label || m.status}</span>
              </div>
              <div className="text-xs text-white/45 mt-2.5 flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-emerald-500/25 text-emerald-200 text-[10px] font-bold flex items-center justify-center shrink-0">{initial(m.by?.full_name)}</span>
                <span className="truncate">{m.by?.full_name || '—'}</span>
                <span className="text-white/25 shrink-0">·</span>
                <span className="inline-flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" /> {new Date(m.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              {m.scheduled_at && <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2.5 py-1 rounded-lg w-fit"><CalendarClock className="w-3.5 h-3.5" /> {new Date(m.scheduled_at).toLocaleString('vi-VN')}</div>}
              {m.ai_status === 'processing' && <div className="mt-3 text-xs font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 w-fit"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo biên bản AI…</div>}
              {m.ai_status === 'done' && m.ai_result?.summary && <div className="mt-3 text-xs text-slate-200 bg-violet-500/10 border border-violet-400/20 rounded-lg p-2.5 line-clamp-2"><Sparkles className="w-3 h-3 inline text-violet-300 mr-1 -mt-0.5" />{m.ai_result.summary}</div>}
              <div className="mt-auto pt-4 flex flex-wrap gap-2">
                {m.status !== 'ended'
                  ? <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-95 transition shadow-lg shadow-emerald-900/40 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào họp</button>
                  : <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl border border-white/15 text-white/80 text-sm font-bold hover:bg-white/5 active:scale-95 transition inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào lại</button>}
                {m.status !== 'ended' && <button onClick={() => copyLink(m)} title="Copy link phòng họp" className="h-10 px-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 active:scale-95 transition inline-flex items-center"><Link2 className="w-4 h-4" /></button>}
                {m.status === 'live' && (m.created_by === me?.id || me?.role === 'admin') && <button onClick={() => endMeeting(m)} className="h-10 px-3 rounded-xl border border-rose-400/30 text-rose-300 text-sm font-bold hover:bg-rose-500/10 active:scale-95 transition">Kết thúc</button>}
                {m.ai_status === 'done' && <button onClick={() => setView(m)} className="h-10 px-3 rounded-xl bg-violet-500/15 text-violet-300 text-sm font-bold hover:bg-violet-500/25 active:scale-95 transition inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Biên bản</button>}
              </div>
            </div>
          );})}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: hero + tạo họp + hỏi AI */}
        <div className="order-1 lg:order-2 space-y-4 lg:sticky lg:top-4 min-w-0">
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-xl shadow-emerald-900/40" style={{ background: 'linear-gradient(135deg, #1fa25a 0%, #157a48 55%, #0d5636 100%)' }}>
            <div className="absolute -top-10 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-white/85 text-sm font-medium"><Video className="w-4 h-4" /> Phòng họp</span>
                <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center mtg-float"><Radio className="w-4 h-4" /></span>
              </div>
              <div className="mt-4 text-white/70 text-xs">Tổng cuộc họp</div>
              <div className="text-4xl font-bold leading-none mt-0.5">{meetings.length}</div>
              <div className="mt-3 text-[11px]">
                {liveCount > 0
                  ? <span className="px-2.5 py-1 rounded-full bg-rose-500 font-semibold inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white mtg-live-dot" />{liveCount} đang họp</span>
                  : <span className="text-white/60">Không có cuộc đang họp</span>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/10 backdrop-blur-xl space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-white/90"><span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center"><Plus className="w-4 h-4 text-emerald-300" /></span> Tạo cuộc họp mới</div>
            <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMeeting(!!schedAt)} placeholder="Tên cuộc họp…" className="w-full px-3.5 py-2.5 text-[15px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/35 focus:border-emerald-400 outline-none transition" />
            <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="w-full px-3.5 py-2.5 text-[15px] rounded-xl bg-white/5 border border-white/10 text-white/80 [color-scheme:dark] focus:border-emerald-400 outline-none" />
            <button onClick={() => createMeeting(!!schedAt)} disabled={creating} className="w-full h-11 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 active:scale-[0.98] transition shadow-lg shadow-emerald-900/40 disabled:opacity-50 inline-flex items-center justify-center gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : schedAt ? <CalendarClock className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {schedAt ? 'Lên lịch họp' : 'Tạo & vào họp ngay'}</button>
            <p className="text-xs text-white/40">Để trống ngày giờ = họp ngay. Chọn ngày giờ = lên lịch, rồi bấm <b className="text-white/60">Copy link</b> ở thẻ.</p>
          </div>

          <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/10 backdrop-blur-xl space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><Sparkles className="w-4 h-4" /> Hỏi kho biên bản (AI)</div>
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="VD: Tháng trước chốt gì về giá dịch vụ?" className="w-full px-3.5 py-2.5 text-[15px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/35 focus:border-emerald-400 outline-none transition" />
            <button onClick={askAI} disabled={asking} className="w-full h-11 rounded-xl bg-emerald-500/90 text-white font-bold hover:bg-emerald-600 active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-2">{asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Hỏi AI</button>
            {answer && <div className="mtg-in text-sm text-slate-200 bg-white/5 border border-white/10 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{answer}</div>}
          </div>
        </div>
      </div>

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
