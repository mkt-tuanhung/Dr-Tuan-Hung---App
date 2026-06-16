import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { LogIn, LogOut, Clock, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  present:  { label: 'Có mặt',    color: 'bg-emerald-100 text-emerald-700' },
  late:     { label: 'Đi trễ',    color: 'bg-yellow-100 text-yellow-700' },
  absent:   { label: 'Vắng mặt', color: 'bg-red-100 text-red-700' },
  half_day: { label: 'Nửa ngày', color: 'bg-blue-100 text-blue-700' },
  leave:    { label: 'Nghỉ phép', color: 'bg-purple-100 text-purple-700' },
};

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const fmtTime = (t) => t ? t.slice(0, 5) : null;

const AttendancePage = () => {
  const { profile } = useAuth();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  // Cập nhật đồng hồ realtime
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const [todayRes, histRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('staff_id', profile.id).eq('date', todayStr).single(),
      supabase.from('attendance').select('*').eq('staff_id', profile.id)
        .gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
    ]);

    setTodayRecord(todayRes.data || null);
    setHistory(histRes.data || []);
    setLoading(false);
  }, [profile?.id, year, month, todayStr]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCheckIn = async () => {
    setSaving(true);
    try {
      const checkInTime = now.toTimeString().slice(0, 8);
      const workStart = '08:30:00';
      const status = checkInTime > workStart ? 'late' : 'present';

      const { error } = await supabase.from('attendance').insert({
        staff_id: profile.id,
        date: todayStr,
        check_in: checkInTime,
        status,
      });
      if (error) throw error;
      toast.success('Đã chấm công vào!');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('attendance').update({
        check_out: now.toTimeString().slice(0, 8),
        updated_at: new Date().toISOString(),
      }).eq('id', todayRecord.id);
      if (error) throw error;
      toast.success('Đã chấm công ra!');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const presentCount = history.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentCount = history.filter(a => a.status === 'absent').length;
  const lateCount = history.filter(a => a.status === 'late').length;

  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Chấm công</h2>
        <p className="text-slate-400 text-sm mt-0.5">{dateStr}</p>
      </div>

      {/* Clock & check in/out */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white text-center">
        <div className="text-4xl font-bold tracking-wider mb-1">{timeStr}</div>
        <div className="text-emerald-200 text-sm mb-6">{dateStr}</div>

        {loading ? (
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        ) : !todayRecord ? (
          <button
            onClick={handleCheckIn}
            disabled={saving}
            className="flex items-center gap-2 mx-auto px-8 py-3 rounded-2xl bg-white text-emerald-600 font-semibold text-sm shadow-lg hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            Chấm công vào
          </button>
        ) : !todayRecord.check_out ? (
          <div className="space-y-3">
            <div className="bg-white/15 rounded-xl px-4 py-2 inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-200" />
              <span className="text-sm">Vào lúc <strong>{fmtTime(todayRecord.check_in)}</strong></span>
            </div>
            <div>
              <button
                onClick={handleCheckOut}
                disabled={saving}
                className="flex items-center gap-2 mx-auto px-8 py-3 rounded-2xl bg-white/20 text-white font-semibold text-sm border border-white/30 hover:bg-white/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Chấm công ra
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                <div className="text-xs text-emerald-200">Vào</div>
                <div className="font-bold">{fmtTime(todayRecord.check_in)}</div>
              </div>
              <div className="text-emerald-300">→</div>
              <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                <div className="text-xs text-emerald-200">Ra</div>
                <div className="font-bold">{fmtTime(todayRecord.check_out)}</div>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white`}>
              <CalendarCheck className="w-3 h-3" />
              {STATUS_CONFIG[todayRecord.status]?.label || 'Đã chấm công'}
            </div>
          </div>
        )}
      </div>

      {/* Monthly stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-sm text-center">
          <div className="text-2xl font-bold text-emerald-600">{presentCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Có mặt</div>
        </div>
        <div className="bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-sm text-center">
          <div className="text-2xl font-bold text-yellow-500">{lateCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Đi trễ</div>
        </div>
        <div className="bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-sm text-center">
          <div className="text-2xl font-bold text-red-400">{absentCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Vắng mặt</div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-50">
          <h3 className="text-sm font-semibold text-slate-700">Lịch sử chấm công</h3>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="w-3 h-3 text-slate-500" />
            </button>
            <span className="text-xs font-medium text-slate-600">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Chưa có dữ liệu chấm công</div>
        ) : (
          <div className="divide-y divide-emerald-50">
            {history.map(r => {
              const dt = new Date(r.date);
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      {dt.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      {fmtTime(r.check_in) && <span>Vào: {fmtTime(r.check_in)}</span>}
                      {fmtTime(r.check_out) && <span>Ra: {fmtTime(r.check_out)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_CONFIG[r.status]?.color || 'bg-slate-100 text-slate-400'}`}>
                    {STATUS_CONFIG[r.status]?.label || r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendancePage;
