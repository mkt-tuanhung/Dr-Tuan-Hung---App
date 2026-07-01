import React, { useState, useEffect, useCallback } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Video, Plus, X, Loader2, Users, Radio, Clock, LogIn } from 'lucide-react';

const ST = {
  scheduled: { label: 'Sắp diễn ra', cls: 'bg-amber-100 text-amber-700' },
  live: { label: 'Đang họp', cls: 'bg-rose-100 text-rose-700' },
  ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500' },
};

export default function MeetingPage() {
  const { profile: me } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [joining, setJoining] = useState(null);      // id đang lấy token
  const [room, setRoom] = useState(null);            // { meeting, token, url }

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
    setTitle(''); toast.success('Đã tạo cuộc họp'); load();
    join(data);
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

  const leave = () => setRoom(null);

  const endMeeting = async (m) => {
    await supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', m.id);
    toast.success('Đã kết thúc cuộc họp'); load();
  };

  // ---- Trong phòng họp ----
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
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  // ---- Danh sách ----
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20"><Video className="w-6 h-6 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">Phòng họp</h2>
          <p className="text-slate-400 text-sm">Họp video · lưu nội dung · tự tạo biên bản &amp; PRD bằng AI</p>
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
              <div className="mt-auto pt-3 flex gap-2">
                {m.status !== 'ended'
                  ? <button onClick={() => join(m)} disabled={joining === m.id} className="flex-1 h-10 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">{joining === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Vào họp</button>
                  : <span className="flex-1 h-10 rounded-xl bg-slate-50 text-slate-400 text-sm font-semibold inline-flex items-center justify-center gap-1.5"><Users className="w-4 h-4" /> Đã kết thúc</span>}
                {m.status === 'live' && (m.created_by === me?.id || me?.role === 'admin') && (
                  <button onClick={() => endMeeting(m)} className="h-10 px-3 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50">Kết thúc</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
