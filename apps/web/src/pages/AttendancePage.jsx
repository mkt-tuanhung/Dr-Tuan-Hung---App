import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { LogIn, LogOut, Clock, CalendarCheck, ChevronLeft, ChevronRight, Plus, X, MapPin, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';

// Tọa độ văn phòng Dr Tuấn Hùng - 10 ngõ 168 Hào Nam, Hà Nội
const OFFICE_LAT = 21.025956;
const OFFICE_LNG = 105.828384;
const OFFICE_RADIUS_M = 200; // bán kính cho phép 200m

const calcDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const getLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('Thiết bị không hỗ trợ GPS')); return; }
  navigator.geolocation.getCurrentPosition(
    pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    err => reject(new Error('Không lấy được vị trí. Vui lòng bật GPS.')),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

const getPublicIP = async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch { return null; }
};

const STATUS_CONFIG = {
  present:  { label: 'Có mặt',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  late:     { label: 'Đi trễ',    color: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500' },
  absent:   { label: 'Vắng mặt', color: 'bg-red-100 text-red-700',         dot: 'bg-red-400' },
  half_day: { label: 'Nửa ngày', color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-400' },
  leave:    { label: 'Nghỉ phép', color: 'bg-purple-100 text-purple-700',  dot: 'bg-purple-400' },
};

const LEAVE_TYPES = [
  { value: 'late',     label: 'Xin đi muộn' },
  { value: 'early',    label: 'Xin về sớm' },
  { value: 'leave',    label: 'Xin nghỉ phép' },
  { value: 'half_day', label: 'Nghỉ nửa ngày (0.5 công)' },
];

const LEAVE_STATUS = {
  pending:  { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Đã duyệt',  color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Từ chối',   color: 'bg-red-100 text-red-700' },
};

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DAYS_SHORT = ['CN','T2','T3','T4','T5','T6','T7'];

// Thay đổi địa chỉ IP Public của phòng khám ở đây. Để mảng rỗng [] nếu không muốn check IP.
const OFFICE_IPS = ['42.114.215.104'];

const fmtTime = (t) => t ? t.slice(0, 5) : null;

const AttendancePage = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [anomalyAlert, setAnomalyAlert] = useState(null);
  const todayStr = today.toISOString().split('T')[0];

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'late', date: todayStr, half_day_period: 'morning', reason: '' });
  const [showOtForm, setShowOtForm] = useState(false);
  const [otForm, setOtForm] = useState({ date: todayStr, hours: '' });
  const [locationInfo, setLocationInfo] = useState(null); // { lat, lng, distance, inOffice, ip }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const [todayRes, histRes, leaveRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('staff_id', profile.id).eq('date', todayStr).single(),
      supabase.from('attendance').select('*').eq('staff_id', profile.id)
        .gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
      supabase.from('leave_requests').select('*').eq('staff_id', profile.id)
        .order('created_at', { ascending: false }).limit(50),
    ]);

    setTodayRecord(todayRes.data || null);
    setHistory(histRes.data || []);
    setLeaveRequests(leaveRes.data || []);
    setLoading(false);
  }, [profile?.id, year, month, todayStr]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('attendance,leave_requests', loadData);

  const handleCheckIn = async () => {
    setSaving(true);
    try {
      const checkInTime = now.toTimeString().slice(0, 8);
      const status = checkInTime >= '09:01:00' ? 'late' : 'present';

      // Lấy GPS và IP đồng thời
      let lat = null, lng = null, ip = null, location_status = 'unknown';
      let warningMsg = null;
      try {
        const [pos, ipAddr] = await Promise.all([getLocation(), getPublicIP()]);
        lat = pos.lat; lng = pos.lng; ip = ipAddr;
        const dist = calcDistance(lat, lng, OFFICE_LAT, OFFICE_LNG);
        const isGpsValid = dist <= OFFICE_RADIUS_M;
        const isIpValid = OFFICE_IPS.length === 0 || OFFICE_IPS.includes(ipAddr);
        
        location_status = isGpsValid ? 'in_office' : 'outside';
        setLocationInfo({ lat, lng, distance: Math.round(dist), inOffice: isGpsValid, ip: ipAddr });

        if (!isGpsValid && !isIpValid) {
          warningMsg = `Sai vị trí (${Math.round(dist)}m) và sai mạng Wi-Fi`;
        } else if (!isGpsValid) {
          warningMsg = `Sai vị trí (${Math.round(dist)}m so với VP)`;
        } else if (!isIpValid) {
          warningMsg = `Sai mạng Wi-Fi`;
        }
      } catch (gpsErr) {
        toast.warning('Không lấy được vị trí — chấm công không có GPS');
        warningMsg = 'Không bật định vị GPS hoặc lỗi mạng';
      }

      const { error } = await supabase.from('attendance').insert({
        staff_id: profile.id, date: todayStr, check_in: checkInTime, status,
        latitude: lat, longitude: lng, ip_address: ip, location_status,
      });
      if (error) throw error;
      
      if (warningMsg) {
        setAnomalyAlert(warningMsg);
      } else {
        toast.success('Đã chấm công vào!');
      }
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleCheckOut = async () => {
    if (!todayRecord?.id) return;
    setSaving(true);
    try {
      let lat = null, lng = null, ip = null, dist = 0, warningMsg = null;
      let isGpsValid = true, isIpValid = true;
      try {
        const [pos, ipAddr] = await Promise.all([getLocation(), getPublicIP()]);
        lat = pos.lat; lng = pos.lng; ip = ipAddr;
        dist = calcDistance(lat, lng, OFFICE_LAT, OFFICE_LNG);
        isGpsValid = dist <= OFFICE_RADIUS_M;
        isIpValid = OFFICE_IPS.length === 0 || OFFICE_IPS.includes(ipAddr);
        
        if (!isGpsValid && !isIpValid) {
          warningMsg = `Sai vị trí (${Math.round(dist)}m) và sai mạng Wi-Fi`;
        } else if (!isGpsValid) {
          warningMsg = `Sai vị trí (${Math.round(dist)}m so với VP)`;
        } else if (!isIpValid) {
          warningMsg = `Sai mạng Wi-Fi`;
        }
      } catch {}

      const updatePayload = {
        check_out: now.toTimeString().slice(0, 8),
        updated_at: new Date().toISOString(),
      };

      if (lat) {
        updatePayload.note = `Check-out: ${warningMsg || 'Hợp lệ'}`;
        // Nếu có lỗi lúc check-out HOẶC lúc check-in chưa có dữ liệu GPS/IP, thì ghi đè dữ liệu mới vào
        if (warningMsg || !todayRecord.ip_address || !todayRecord.latitude) {
          updatePayload.location_status = isGpsValid ? 'in_office' : 'outside';
          updatePayload.ip_address = ip;
          updatePayload.latitude = lat;
          updatePayload.longitude = lng;
        }
      }

      const { error } = await supabase.from('attendance').update(updatePayload).eq('id', todayRecord.id);
      if (error) throw error;
      
      if (warningMsg) {
        setAnomalyAlert(warningMsg);
      } else {
        toast.success('Đã chấm công ra!');
      }
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleOtSubmit = async () => {
    const hours = Number(otForm.hours);
    if (!otForm.date) { toast.error('Chọn ngày'); return; }
    if (!hours || hours <= 0) { toast.error('Nhập số giờ tăng ca (chỉ số)'); return; }
    setSaving(true);
    const { error } = await supabase.from('attendance')
      .upsert({ staff_id: profile.id, date: otForm.date, overtime_hours: hours }, { onConflict: 'staff_id,date' });
    if (error) toast.error(error.message);
    else {
      toast.success(`Đã ghi ${hours} giờ tăng ca ngày ${new Date(otForm.date).toLocaleDateString('vi-VN')}`);
      setShowOtForm(false); setOtForm({ date: todayStr, hours: '' });
      loadData();
    }
    setSaving(false);
  };

  const handleLeaveSubmit = async () => {
    if (!leaveForm.reason.trim()) { toast.error('Vui lòng nhập lý do'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('leave_requests').insert({
        staff_id: profile.id,
        type: leaveForm.type,
        date: leaveForm.date,
        half_day_period: leaveForm.type === 'half_day' ? leaveForm.half_day_period : null,
        reason: leaveForm.reason,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Đã gửi đơn xin phép!');
      setShowLeaveForm(false);
      setLeaveForm({ type: 'late', date: todayStr, half_day_period: 'morning', reason: '' });
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const presentCount = history.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentCount = history.filter(a => a.status === 'absent').length;
  const lateCount = history.filter(a => a.status === 'late').length;

  // Build calendar
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month-1, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getAttendanceForDay = (d) => {
    if (!d) return null;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return history.find(a => a.date === dateStr);
  };

  const [selectedDay, setSelectedDay] = useState(null);

  const handleDayClick = (d) => {
    const date = new Date(year, month-1, d);
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (isPast) return; // nhân sự không được sửa quá khứ
    setSelectedDay(d);
  };

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
          <div className="space-y-3">
            {locationInfo && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${locationInfo.inOffice ? 'bg-white/20 text-white' : 'bg-red-400/30 text-white'}`}>
                {locationInfo.inOffice ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {locationInfo.inOffice ? 'Trong văn phòng' : `Ngoài văn phòng (${locationInfo.distance}m)`}
                {locationInfo.ip && <span className="text-white/60 text-[10px]">· {locationInfo.ip}</span>}
              </div>
            )}
            <button onClick={handleCheckIn} disabled={saving}
              className="flex items-center gap-2 mx-auto px-8 py-3 rounded-2xl bg-white text-emerald-600 font-semibold text-sm shadow-lg hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50">
              <LogIn className="w-4 h-4" /> Chấm công vào
            </button>
            <p className="text-emerald-200 text-[11px]">GPS + IP sẽ được ghi nhận tự động</p>
          </div>
        ) : !todayRecord.check_out ? (
          <div className="space-y-3">
            <div className="bg-white/15 rounded-xl px-4 py-2 inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-200" />
              <span className="text-sm">Vào lúc <strong>{fmtTime(todayRecord.check_in)}</strong></span>
            </div>
            <div>
              <button onClick={handleCheckOut} disabled={saving}
                className="flex items-center gap-2 mx-auto px-8 py-3 rounded-2xl bg-white/20 text-white font-semibold text-sm border border-white/30 hover:bg-white/30 transition-all active:scale-95 disabled:opacity-50">
                <LogOut className="w-4 h-4" /> Chấm công ra
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
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
              <CalendarCheck className="w-3 h-3" />
              {STATUS_CONFIG[todayRecord.status]?.label || 'Đã chấm công'}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
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

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-50">
          <h3 className="text-sm font-semibold text-slate-700">Bảng chấm công</h3>
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
        <div className="p-3">
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${d === 'CN' || d === 'T7' ? 'text-slate-300' : 'text-slate-400'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const rec = getAttendanceForDay(d);
              const date = new Date(year, month-1, d);
              const isToday = date.toDateString() === today.toDateString();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isFuture = date > today;
              const isSelected = selectedDay === d;
              return (
                <button
                  key={d}
                  onClick={() => !isPast && handleDayClick(d)}
                  className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-all
                    ${isSelected ? 'ring-2 ring-emerald-400 bg-emerald-50' : ''}
                    ${isToday && !isSelected ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}
                    ${isWeekend ? 'opacity-40' : ''}
                    ${isPast ? 'cursor-default' : 'cursor-pointer hover:bg-emerald-50/60'}
                  `}
                >
                  <span className={`text-[11px] font-semibold leading-none
                    ${isToday ? 'text-emerald-600' : isWeekend ? 'text-slate-300' : 'text-slate-600'}
                  `}>{d}</span>
                  <div className="mt-0.5 h-1.5 flex items-center justify-center">
                    {rec ? (
                      <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[rec.status]?.dot || 'bg-slate-300'}`} />
                    ) : !isFuture && !isWeekend ? (
                      <div className="w-1 h-1 rounded-full bg-slate-200" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-emerald-50">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                <span className="text-[10px] text-slate-400">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day action modal */}
      {selectedDay && (() => {
        const selDate = `${year}-${String(month).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
        const selRec = getAttendanceForDay(selectedDay);
        const isToday = new Date(year, month-1, selectedDay).toDateString() === today.toDateString();
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {new Date(year, month-1, selectedDay).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    {selRec && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_CONFIG[selRec.status]?.color}`}>
                        {STATUS_CONFIG[selRec.status]?.label}
                        {selRec.check_in && ` · ${fmtTime(selRec.check_in)}${selRec.check_out ? ' → '+fmtTime(selRec.check_out) : ''}`}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedDay(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {isToday && !selRec && (
                  <button onClick={() => { setSelectedDay(null); handleCheckIn(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <LogIn className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">Chấm công vào</div>
                      <div className="text-xs text-slate-400">Ghi nhận GPS + IP tự động</div>
                    </div>
                  </button>
                )}
                {isToday && selRec && !selRec.check_out && (
                  <button onClick={() => { setSelectedDay(null); handleCheckOut(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-teal-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                      <LogOut className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">Chấm công ra</div>
                      <div className="text-xs text-slate-400">Vào lúc {fmtTime(selRec.check_in)}</div>
                    </div>
                  </button>
                )}
                {[
                  { type: 'leave', icon: '🏖️', label: 'Xin nghỉ phép cả ngày', sub: 'Nghỉ 1 ngày công' },
                  { type: 'half_day', icon: '🌓', label: 'Nghỉ nửa ngày', sub: '0.5 công (sáng hoặc chiều)' },
                  { type: 'late', icon: '⏰', label: 'Xin đi muộn', sub: 'Nhập giờ đến trễ' },
                  { type: 'early', icon: '🏃', label: 'Xin về sớm', sub: 'Nhập giờ về sớm' },
                ].map(item => (
                  <button key={item.type}
                    onClick={() => {
                      setSelectedDay(null);
                      setLeaveForm(f => ({ ...f, type: item.type, date: selDate,
                        half_day_period: item.type === 'half_day' ? 'morning' : f.half_day_period }));
                      setShowLeaveForm(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-base">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{item.label}</div>
                      <div className="text-xs text-slate-400">{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Leave requests */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-50">
          <h3 className="text-sm font-semibold text-slate-700">Đơn xin phép</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setOtForm({ date: todayStr, hours: '' }); setShowOtForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" /> Ghi tăng ca
            </button>
            <button
              onClick={() => setShowLeaveForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo đơn
            </button>
          </div>
        </div>
        {leaveRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Chưa có đơn xin phép</div>
        ) : (
          <div>
          <div className="grid grid-cols-3 gap-2 p-3 border-b border-emerald-50">
            <div className="text-center bg-yellow-50 rounded-xl py-2">
              <div className="text-lg font-bold text-yellow-600">{leaveRequests.filter(r => r.status === 'pending').length}</div>
              <div className="text-[11px] text-yellow-700">Chờ duyệt</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl py-2">
              <div className="text-lg font-bold text-emerald-600">{leaveRequests.filter(r => r.status === 'approved').length}</div>
              <div className="text-[11px] text-emerald-700">Đã duyệt</div>
            </div>
            <div className="text-center bg-red-50 rounded-xl py-2">
              <div className="text-lg font-bold text-red-600">{leaveRequests.filter(r => r.status === 'rejected').length}</div>
              <div className="text-[11px] text-red-700">Từ chối</div>
            </div>
          </div>
          <div className="divide-y divide-emerald-50">
            {leaveRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {LEAVE_TYPES.find(t => t.value === r.type)?.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(r.date).toLocaleDateString('vi-VN')} · {r.reason}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${LEAVE_STATUS[r.status]?.color}`}>
                  {LEAVE_STATUS[r.status]?.label}
                </span>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* History list */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-emerald-50">
          <h3 className="text-sm font-semibold text-slate-700">Lịch sử chi tiết</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Chưa có dữ liệu chấm công</div>
        ) : (
          <div className="divide-y divide-emerald-50">
            {history.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {new Date(r.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
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
            ))}
          </div>
        )}
      </div>

      {/* Overtime form modal */}
      {showOtForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Ghi giờ tăng ca</h3>
              <button onClick={() => setShowOtForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ngày</label>
                <input type="date" value={otForm.date} onChange={e => setOtForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Số giờ tăng ca</label>
                <input type="number" min="0" step="0.5" inputMode="decimal" value={otForm.hours}
                  onChange={e => setOtForm(f => ({ ...f, hours: e.target.value.replace(/[^\d.]/g, '') }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-400" placeholder="VD: 2" />
                <p className="text-[11px] text-slate-400 mt-1">Chỉ nhập số. Tăng ca CN tính 200%, ngày thường 150%.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowOtForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Hủy</button>
              <button onClick={handleOtSubmit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-50">Lưu tăng ca</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave form modal */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 text-lg">Tạo đơn xin phép</h3>
              <button onClick={() => setShowLeaveForm(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Loại đơn</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(t => (
                    <button key={t.value} onClick={() => setLeaveForm(f => ({ ...f, type: t.value }))}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left ${
                        leaveForm.type === t.value
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-slate-100 text-slate-500 hover:border-emerald-200'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {leaveForm.type === 'half_day' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Buổi nghỉ</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{value:'morning',label:'Buổi sáng'},{value:'afternoon',label:'Buổi chiều'}].map(p => (
                      <button key={p.value} onClick={() => setLeaveForm(f => ({ ...f, half_day_period: p.value }))}
                        className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                          leaveForm.half_day_period === p.value
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 text-slate-500'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ngày</label>
                <input type="date" value={leaveForm.date}
                  onChange={e => setLeaveForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Lý do</label>
                <textarea value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Nhập lý do xin phép..."
                  className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLeaveForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
                Hủy
              </button>
              <button onClick={handleLeaveSubmit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Đang gửi...' : 'Gửi đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Cảnh báo vi phạm GPS / IP */}
      {anomalyAlert && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-[340px] shadow-2xl animate-in zoom-in-95 duration-300 p-6 flex flex-col items-center text-center">
            
            {/* Icon Container */}
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5 ring-8 ring-red-50/50">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-extrabold text-slate-800 mb-2 tracking-tight">Cảnh báo vi phạm</h3>
            
            {/* Content */}
            <p className="text-slate-500 text-[15px] leading-relaxed mb-5">
              Hệ thống vẫn ghi nhận giờ công cho bạn, tuy nhiên đã phát hiện lỗi:
              <span className="text-red-600 font-bold block mt-3 px-3 py-2.5 bg-red-50 rounded-xl border border-red-100 shadow-sm">{anomalyAlert}</span>
            </p>
            
            {/* Warning Note */}
            <div className="w-full bg-amber-50 border border-amber-100/50 p-3.5 rounded-2xl mb-6 text-[13px] text-amber-800 font-medium leading-snug">
              Thông báo này đã được gửi đến ban quản trị. Bạn vui lòng chủ động giải trình với Admin.
            </div>
            
            {/* Button */}
            <button
              onClick={() => setAnomalyAlert(null)}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
            >
              Tôi đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
