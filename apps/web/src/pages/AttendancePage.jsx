import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { LogIn, LogOut, Clock, CalendarCheck, ChevronLeft, ChevronRight, Plus, X, MapPin, Wifi, AlertTriangle, CheckCircle, ScanFace } from 'lucide-react';
// Helper vị trí dùng chung (tách ra lib/geo.js — dùng cho cả chấm công khuôn mặt)
import { OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS_M, OFFICE_IPS, calcDistance, getLocation, getPublicIP } from '@/lib/geo';
import FaceCameraScreen from '@/features/faceid/FaceCameraScreen.jsx';
import FaceEnrollScreen from '@/features/faceid/FaceEnrollScreen.jsx';
import { fetchMyFaceStatus } from '@/features/faceid/faceApi';
import { vnToday, vnTimeHMS } from '@/lib/vnTime';

const STATUS_CONFIG = {
  present:  { label: 'Có mặt',    color: 'e-tone-success', dot: 'bg-success-500' },
  late:     { label: 'Đi trễ',    color: 'e-tone-danger',   dot: 'bg-danger-500' },
  absent:   { label: 'Vắng mặt', color: 'e-tone-rose',         dot: 'bg-rose-500' },
  half_day: { label: 'Nửa ngày', color: 'e-tone-info',       dot: 'bg-info-500' },
  leave:    { label: 'Nghỉ phép', color: 'e-tone-lavender',  dot: 'bg-lavender-500' },
};

const LEAVE_TYPES = [
  { value: 'late',     label: 'Xin đi muộn' },
  { value: 'early',    label: 'Xin về sớm' },
  { value: 'leave',    label: 'Xin nghỉ phép' },
  { value: 'half_day', label: 'Nghỉ nửa ngày (0.5 công)' },
];

const LEAVE_STATUS = {
  pending:  { label: 'Chờ duyệt', color: 'e-tone-warning' },
  approved: { label: 'Đã duyệt',  color: 'e-tone-success' },
  rejected: { label: 'Từ chối',   color: 'e-tone-danger' },
};

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DAYS_SHORT = ['CN','T2','T3','T4','T5','T6','T7'];

const fmtTime = (t) => t ? t.slice(0, 5) : null;

// Số giờ giữa 2 mốc "HH:MM" (hỗ trợ qua đêm)
const rangeHours = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  let mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
};
const sumRanges = (ranges) => (ranges || []).reduce((s, r) => s + rangeHours(r.from, r.to), 0);

const AttendancePage = ({ autoScan = 0, onAutoScanDone }) => {
  const { profile } = useAuth();
  const today = new Date();
  const [anomalyAlert, setAnomalyAlert] = useState(null);
  const todayStr = vnToday();

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
  const [otForm, setOtForm] = useState({ date: todayStr, ranges: [{ from: '', to: '' }] });
  const [locationInfo, setLocationInfo] = useState(null); // { lat, lng, distance, inOffice, ip }

  // ---- Chấm công KHUÔN MẶT (FACE_AI) ----
  const [faceMode, setFaceMode] = useState(null);      // null | 'CHECK_IN' | 'CHECK_OUT'
  const [showEnroll, setShowEnroll] = useState(false);
  const [faceStatus, setFaceStatus] = useState(undefined); // undefined=đang tải, null=chưa đăng ký
  const faceReady = faceStatus?.status === 'ACTIVE';
  const loadFaceStatus = useCallback(async () => {
    if (!profile?.id) return;
    try { setFaceStatus(await fetchMyFaceStatus(profile.id)); } catch { setFaceStatus(null); }
  }, [profile?.id]);
  useEffect(() => { loadFaceStatus(); }, [loadFaceStatus]);
  // Tải sẵn AI model ngầm khi vào trang Chấm công -> bấm quét là chạy ngay, không phải chờ
  useEffect(() => {
    if (faceStatus === undefined) return;
    const t = setTimeout(() => {
      import('@/features/faceid/faceEngine').then(m => m.loadEngine().catch(() => {}));
    }, 1200);
    return () => clearTimeout(t);
  }, [faceStatus]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

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

  // Bấm nút Face ID giữa thanh dưới → mở camera ngay (giống bấm nút Check-in/Check-out trên trang).
  // Chưa đăng ký Face ID hoặc đã chấm đủ vào/ra → chỉ mở trang, không tự làm gì thêm.
  useEffect(() => {
    if (!autoScan || loading || saving || faceStatus === undefined || faceMode || showEnroll) return;
    if (faceReady && !todayRecord) setFaceMode('CHECK_IN');
    else if (faceReady && !todayRecord.check_out) setFaceMode('CHECK_OUT');
    else if (faceReady) toast.info('Hôm nay bạn đã chấm công vào và ra');
    onAutoScanDone?.();
  }, [autoScan, loading, saving, faceStatus, faceReady, todayRecord, faceMode, showEnroll, onAutoScanDone]);

  const handleCheckIn = async () => {
    setSaving(true);
    try {
      const checkInTime = vnTimeHMS(now);
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
    // Chống bấm nhầm check-out ngay sau check-in (do lag) → Ra trùng Vào.
    // Yêu cầu cách lần vào tối thiểu 1 phút.
    if (todayRecord.check_in) {
      const [h, m, s] = todayRecord.check_in.split(':').map(Number);
      const inSec = h * 3600 + m * 60 + (s || 0);
      const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      if (nowSec - inSec < 60) {
        toast.error('Chưa thể chấm công ra ngay sau khi vào (tránh bấm nhầm). Vui lòng thử lại sau ít phút.');
        return;
      }
    }
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
        check_out: vnTimeHMS(now),
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

  // Lấy khoảng giờ tăng ca đã lưu của 1 ngày (để sửa lại)
  const rangesForDate = (date) => {
    const rec = (date === todayStr ? todayRecord : null) || history.find(a => a.date === date);
    const rs = rec?.overtime_ranges;
    if (Array.isArray(rs) && rs.length) return rs.map(r => ({ from: r.from || '', to: r.to || '' }));
    return [{ from: '', to: '' }];
  };
  const openOtForm = () => { setOtForm({ date: todayStr, ranges: rangesForDate(todayStr) }); setShowOtForm(true); };
  const setOtDate = (date) => setOtForm({ date, ranges: rangesForDate(date) });
  const addRange = () => setOtForm(f => ({ ...f, ranges: [...f.ranges, { from: '', to: '' }] }));
  const removeRange = (i) => setOtForm(f => ({ ...f, ranges: f.ranges.length > 1 ? f.ranges.filter((_, idx) => idx !== i) : f.ranges }));
  const setRange = (i, key, val) => setOtForm(f => ({ ...f, ranges: f.ranges.map((r, idx) => idx === i ? { ...r, [key]: val } : r) }));

  const handleOtSubmit = async () => {
    if (!otForm.date) { toast.error('Chọn ngày'); return; }
    const ranges = otForm.ranges.filter(r => r.from && r.to);
    if (!ranges.length) { toast.error('Nhập ít nhất 1 khoảng giờ (từ … đến …)'); return; }
    const hours = Math.round(sumRanges(ranges) * 100) / 100;
    if (hours <= 0) { toast.error('Khoảng giờ không hợp lệ'); return; }
    const withHours = ranges.map(r => ({ from: r.from, to: r.to, hours: rangeHours(r.from, r.to) }));
    setSaving(true);
    const { error } = await supabase.from('attendance')
      .upsert({ staff_id: profile.id, date: otForm.date, overtime_hours: hours, overtime_ranges: withHours }, { onConflict: 'staff_id,date' });
    if (error) toast.error(error.message);
    else {
      toast.success(`Đã ghi ${hours} giờ tăng ca ngày ${new Date(otForm.date).toLocaleDateString('vi-VN')}`);
      setShowOtForm(false); setOtForm({ date: todayStr, ranges: [{ from: '', to: '' }] });
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
  // Tăng ca trong tháng
  const otDays = history.filter(a => Number(a.overtime_hours) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const otTotal = Math.round(otDays.reduce((s, a) => s + Number(a.overtime_hours || 0), 0) * 100) / 100;

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
    <div className="space-y-4">
      <p className="e-page-desc capitalize">{dateStr}</p>

      {/* Chấm công hôm nay — vòng tròn kiểu Face ID (Ethics M05/M06) */}
      <div className="e-card e-card-pad text-center">
        <div className="e-caption">Chấm công hôm nay</div>
        <div
          className="mx-auto mt-4 w-[208px] h-[208px] lg:w-[228px] lg:h-[228px] rounded-full p-2 shadow-[0_16px_40px_rgba(6,123,127,0.22)]"
          style={{ background: 'conic-gradient(#12A4A5, #76C2C3, #06686C, #12A4A5)' }}
        >
          <div className="w-full h-full rounded-full bg-white grid place-content-center">
            <div className="text-[34px] lg:text-[38px] font-bold tracking-wide text-slate-900 tabular-nums leading-none">{timeStr}</div>
            <div className="text-[12.5px] text-slate-500 mt-2 capitalize px-6">{dateStr}</div>
          </div>
        </div>
        <div className="mt-5">
        {loading ? (
          <div className="w-6 h-6 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin mx-auto" />
        ) : !todayRecord ? (
          <div className="space-y-3">
            {locationInfo && (
              <div className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[12px] font-semibold ${locationInfo.inOffice ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
                {locationInfo.inOffice ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {locationInfo.inOffice ? 'Trong văn phòng' : `Ngoài văn phòng (${locationInfo.distance}m)`}
                {locationInfo.ip && <span className="text-slate-400 font-normal text-[11px]">· {locationInfo.ip}</span>}
              </div>
            )}
            {faceReady ? (
              <button onClick={() => setFaceMode('CHECK_IN')} disabled={saving}
                className="e-btn e-btn-primary e-btn-lg flex w-full sm:w-auto sm:min-w-[280px] mx-auto active:scale-[0.98]">
                <ScanFace /> Check-in bằng khuôn mặt
              </button>
            ) : (
              <button onClick={() => setShowEnroll(true)}
                className="e-btn e-btn-outline e-btn-lg flex w-full sm:w-auto sm:min-w-[280px] mx-auto active:scale-[0.98]">
                <ScanFace /> {faceStatus === undefined ? 'Face ID…' : faceStatus?.status === 'NEEDS_REENROLLMENT' ? 'Đăng ký lại khuôn mặt' : 'Đăng ký Face ID để chấm công'}
              </button>
            )}
            <p className="text-[12px] text-slate-500">
              {faceReady ? 'Chấm công bằng nhận diện khuôn mặt · GPS được ghi nhận tự động' : 'Cần đăng ký Face ID để chấm công'}
            </p>
          </div>
        ) : !todayRecord.check_out ? (
          <div className="space-y-3">
            <div className="e-subtle px-4 py-2 inline-flex items-center gap-2 text-[13.5px] text-slate-700">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Vào lúc <strong className="text-slate-900 tabular-nums">{fmtTime(todayRecord.check_in)}</strong></span>
            </div>
            <div className="space-y-2">
              {faceReady ? (
                <button onClick={() => setFaceMode('CHECK_OUT')} disabled={saving}
                  className="e-btn e-btn-primary e-btn-lg flex w-full sm:w-auto sm:min-w-[280px] mx-auto active:scale-[0.98]">
                  <ScanFace /> Check-out bằng khuôn mặt
                </button>
              ) : (
                <button onClick={() => setShowEnroll(true)}
                  className="e-btn e-btn-outline e-btn-lg flex w-full sm:w-auto sm:min-w-[280px] mx-auto active:scale-[0.98]">
                  <ScanFace /> Đăng ký Face ID để check-out
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="e-subtle px-5 py-2.5 text-center min-w-[100px]">
                <div className="text-[12px] text-slate-500">Vào</div>
                <div className="text-[20px] font-bold text-slate-900 tabular-nums">{fmtTime(todayRecord.check_in)}</div>
              </div>
              <div className="text-slate-300">→</div>
              <div className="e-subtle px-5 py-2.5 text-center min-w-[100px]">
                <div className="text-[12px] text-slate-500">Ra</div>
                <div className="text-[20px] font-bold text-slate-900 tabular-nums">{fmtTime(todayRecord.check_out)}</div>
              </div>
            </div>
            <div className="e-badge e-tone-success">
              <CalendarCheck />
              {STATUS_CONFIG[todayRecord.status]?.label || 'Đã chấm công'}
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {faceReady ? (
                <button onClick={() => setFaceMode('CHECK_OUT')} disabled={saving}
                  className="e-btn e-btn-secondary e-btn-sm">
                  <ScanFace /> Cập nhật giờ ra (Face)
                </button>
              ) : (
                <button onClick={() => setShowEnroll(true)}
                  className="e-btn e-btn-outline e-btn-sm">
                  <ScanFace /> Đăng ký Face ID
                </button>
              )}
            </div>
            <p className="text-[12px] text-slate-400">Quét lại khi về để cập nhật đúng giờ ra</p>
          </div>
        )}
        </div>
      </div>

      {/* ===== Thẻ FACE ID — LUÔN hiển thị, bất kể đã chấm công hay chưa ===== */}
      {faceStatus !== undefined && (
        !faceReady ? (
          <button onClick={() => setShowEnroll(true)}
            className="w-full flex items-center gap-3 e-card e-card-hover p-4 border-dashed border-teal-300 text-left active:scale-[0.99]">
            <span className="w-11 h-11 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0">
              <ScanFace className="w-6 h-6" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-slate-900 text-[14.5px]">
                {faceStatus?.status === 'NEEDS_REENROLLMENT' ? 'Cần đăng ký lại Face ID' : 'Đăng ký Face ID'}
              </span>
              <span className="block text-[12px] text-slate-500 mt-0.5">Chấm công bằng khuôn mặt — quét ~1 giây, chống chấm hộ</span>
            </span>
            <ChevronRight className="w-5 h-5 text-teal-600 shrink-0" />
          </button>
        ) : (
          <div className="e-card-flat flex items-center gap-3 p-3">
            <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0">
              <ScanFace className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-[14px]">Face ID</span>
              <span className="e-badge e-badge-sm e-tone-success">Đã kích hoạt</span>
            </span>
            <button onClick={() => setShowEnroll(true)} className="e-btn e-btn-ghost e-btn-sm shrink-0">
              Đăng ký lại
            </button>
          </div>
        )
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        <div className="e-metric flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 p-3.5 lg:p-5">
          <span className="e-metric-icon w-9 h-9 lg:w-12 lg:h-12 e-tone-success"><CheckCircle className="w-[18px] h-[18px] lg:w-6 lg:h-6" /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Có mặt</div>
            <div className="e-metric-value">{presentCount}</div>
          </div>
        </div>
        <div className="e-metric flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 p-3.5 lg:p-5">
          <span className="e-metric-icon w-9 h-9 lg:w-12 lg:h-12 e-tone-danger"><Clock className="w-[18px] h-[18px] lg:w-6 lg:h-6" /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Đi trễ</div>
            <div className="e-metric-value">{lateCount}</div>
          </div>
        </div>
        <div className="e-metric flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 p-3.5 lg:p-5">
          <span className="e-metric-icon w-9 h-9 lg:w-12 lg:h-12 e-tone-rose"><X className="w-[18px] h-[18px] lg:w-6 lg:h-6" /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Vắng mặt</div>
            <div className="e-metric-value">{absentCount}</div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="e-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900">Bảng chấm công</h3>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-white">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng trước">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-slate-700 min-w-[96px] text-center tabular-nums">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng sau">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-3 lg:p-4">
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className={`text-center text-[11px] font-semibold py-1 ${d === 'CN' || d === 'T7' ? 'text-slate-300' : 'text-slate-400'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                  className={`relative flex flex-col items-center justify-center min-h-[46px] lg:min-h-[52px] rounded-xl text-xs transition
                    ${isSelected ? 'ring-2 ring-teal-500 bg-teal-50' : ''}
                    ${isToday && !isSelected ? 'bg-teal-50 ring-1 ring-teal-400' : ''}
                    ${isWeekend ? 'opacity-40' : ''}
                    ${isPast ? 'cursor-default' : 'cursor-pointer hover:bg-teal-50/70'}
                  `}
                >
                  <span className={`text-[13px] font-semibold leading-none tabular-nums
                    ${isToday ? 'text-teal-700' : isWeekend ? 'text-slate-300' : 'text-slate-700'}
                  `}>{d}</span>
                  <div className="mt-1 h-1.5 flex items-center justify-center">
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
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-slate-100">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${v.dot}`} />
                <span className="text-[11.5px] text-slate-500">{v.label}</span>
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-end sm:items-center justify-center p-4">
            <div className="e-modal max-w-sm overflow-hidden">
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="e-modal-title capitalize">
                    {new Date(year, month-1, selectedDay).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {selRec && (
                    <span className={`e-badge e-badge-sm mt-1.5 ${STATUS_CONFIG[selRec.status]?.color}`}>
                      {STATUS_CONFIG[selRec.status]?.label}
                      {selRec.check_in && ` · ${fmtTime(selRec.check_in)}${selRec.check_out ? ' → '+fmtTime(selRec.check_out) : ''}`}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelectedDay(null)} className="e-icon-btn w-8 h-8 rounded-full shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-1">
                {isToday && !selRec && (
                  <button onClick={() => { setSelectedDay(null); if (faceReady) setFaceMode('CHECK_IN'); else setShowEnroll(true); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-teal-50 transition-colors text-left">
                    <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0">
                      <ScanFace className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-slate-800">{faceReady ? 'Check-in bằng khuôn mặt' : 'Đăng ký Face ID để chấm công'}</div>
                      <div className="text-[12px] text-slate-500">{faceReady ? 'Quét ~1 giây · GPS ghi nhận tự động' : 'Chấm công chỉ dùng Face ID'}</div>
                    </div>
                  </button>
                )}
                {isToday && selRec && !selRec.check_out && (
                  <button onClick={() => { setSelectedDay(null); if (faceReady) setFaceMode('CHECK_OUT'); else setShowEnroll(true); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-teal-50 transition-colors text-left">
                    <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0">
                      <ScanFace className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-slate-800">{faceReady ? 'Check-out bằng khuôn mặt' : 'Đăng ký Face ID để check-out'}</div>
                      <div className="text-[12px] text-slate-500">Vào lúc {fmtTime(selRec.check_in)}</div>
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
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                    <div className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center shrink-0 text-base">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-slate-800">{item.label}</div>
                      <div className="text-[12px] text-slate-500">{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tăng ca tháng này */}
      <div className="e-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full grid place-items-center bg-warning-50 text-warning-600"><Clock className="w-4 h-4" /></span>
            Tăng ca {MONTHS[month - 1]}
          </h3>
          <span className="e-badge e-tone-warning tabular-nums">{otTotal} giờ</span>
        </div>
        {otDays.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-[13px]">Chưa có giờ tăng ca trong tháng</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {otDays.map(a => {
              const d = new Date(a.date);
              const ranges = Array.isArray(a.overtime_ranges) ? a.overtime_ranges : [];
              return (
                <div key={a.id} className="flex items-start justify-between gap-3 px-4 lg:px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-800">{DAYS_SHORT[d.getDay()]} {d.toLocaleDateString('vi-VN')}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 tabular-nums">
                      {ranges.length
                        ? ranges.map((r, i) => <span key={i}>{i > 0 && ', '}{r.from}–{r.to}</span>)
                        : 'Không ghi khoảng giờ'}
                    </div>
                  </div>
                  <span className="text-[14px] font-bold text-warning-600 shrink-0 tabular-nums">{Number(a.overtime_hours)}h</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave requests */}
      <div className="e-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900">Đơn xin phép</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={openOtForm}
              className="e-btn e-btn-secondary e-btn-sm"
            >
              <Clock /> Ghi tăng ca
            </button>
            <button
              onClick={() => setShowLeaveForm(true)}
              className="e-btn e-btn-primary e-btn-sm"
            >
              <Plus /> Tạo đơn
            </button>
          </div>
        </div>
        {leaveRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-[13px]">Chưa có đơn xin phép</div>
        ) : (
          <div>
          <div className="grid grid-cols-3 gap-2 p-3 lg:px-5 border-b border-slate-100">
            <div className="text-center rounded-xl py-2.5 bg-warning-50">
              <div className="text-[18px] font-bold text-warning-600 tabular-nums">{leaveRequests.filter(r => r.status === 'pending').length}</div>
              <div className="text-[11.5px] font-medium text-warning-600">Chờ duyệt</div>
            </div>
            <div className="text-center rounded-xl py-2.5 bg-success-50">
              <div className="text-[18px] font-bold text-success-600 tabular-nums">{leaveRequests.filter(r => r.status === 'approved').length}</div>
              <div className="text-[11.5px] font-medium text-success-600">Đã duyệt</div>
            </div>
            <div className="text-center rounded-xl py-2.5 bg-danger-50">
              <div className="text-[18px] font-bold text-danger-600 tabular-nums">{leaveRequests.filter(r => r.status === 'rejected').length}</div>
              <div className="text-[11.5px] font-medium text-danger-600">Từ chối</div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {leaveRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-800">
                    {LEAVE_TYPES.find(t => t.value === r.type)?.label}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5 truncate">
                    {new Date(r.date).toLocaleDateString('vi-VN')} · {r.reason}
                  </div>
                </div>
                <span className={`e-badge e-badge-sm shrink-0 ${LEAVE_STATUS[r.status]?.color}`}>
                  {LEAVE_STATUS[r.status]?.label}
                </span>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* History list */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900">Lịch sử chi tiết</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-[13px]">Chưa có dữ liệu chấm công</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-800 capitalize">
                    {new Date(r.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2 tabular-nums">
                    {fmtTime(r.check_in) && <span>Vào: {fmtTime(r.check_in)}</span>}
                    {fmtTime(r.check_out) && <span>Ra: {fmtTime(r.check_out)}</span>}
                    {(r.check_in_method === 'face_ai' || r.check_out_method === 'face_ai') && (
                      <span className="e-badge e-badge-sm e-tone-brand h-5">
                        <ScanFace className="w-3 h-3" /> Face AI
                      </span>
                    )}
                  </div>
                </div>
                <span className={`e-badge e-badge-sm shrink-0 ${STATUS_CONFIG[r.status]?.color || 'e-tone-neutral'}`}>
                  {STATUS_CONFIG[r.status]?.label || r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overtime form modal */}
      {showOtForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-end sm:items-center justify-center p-4">
          <div className="e-modal max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title flex items-center gap-2"><Clock className="w-5 h-5 text-warning-500" /> Ghi giờ tăng ca</h3>
              <button onClick={() => setShowOtForm(false)} className="e-icon-btn w-8 h-8 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Ngày</label>
                <input type="date" value={otForm.date} onChange={e => setOtDate(e.target.value)} className="e-input" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="e-label mb-0">Khoảng giờ tăng ca</label>
                  <button type="button" onClick={addRange} className="e-btn e-btn-ghost e-btn-sm h-8 px-2"><Plus /> Thêm khoảng</button>
                </div>
                <div className="space-y-2">
                  {otForm.ranges.map((r, i) => {
                    const h = rangeHours(r.from, r.to);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <input type="time" value={r.from} onChange={e => setRange(i, 'from', e.target.value)} className="e-input flex-1 min-w-0 px-2 tabular-nums" />
                        <span className="text-slate-400 text-sm shrink-0">→</span>
                        <input type="time" value={r.to} onChange={e => setRange(i, 'to', e.target.value)} className="e-input flex-1 min-w-0 px-2 tabular-nums" />
                        <span className="text-[12.5px] font-semibold text-warning-600 w-12 text-right shrink-0 tabular-nums">{h ? h + 'h' : '—'}</span>
                        {otForm.ranges.length > 1 && <button type="button" onClick={() => removeRange(i)} className="text-slate-300 hover:text-danger-500 shrink-0"><X className="w-4 h-4" /></button>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3 e-subtle px-3 py-2">
                  <span className="text-[12.5px] text-slate-500">Tổng giờ tăng ca</span>
                  <span className="text-[14px] font-bold text-warning-600 tabular-nums">{Math.round(sumRanges(otForm.ranges) * 100) / 100} giờ</span>
                </div>
                <p className="text-[12px] text-slate-400 mt-1.5">Có thể thêm nhiều khoảng (VD sáng + tối). Tăng ca CN 200%, ngày thường 150%.</p>
              </div>
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setShowOtForm(false)} className="e-btn e-btn-secondary flex-1">Hủy</button>
              <button onClick={handleOtSubmit} disabled={saving} className="e-btn e-btn-primary flex-1">Lưu tăng ca</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave form modal */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-end sm:items-center justify-center p-4">
          <div className="e-modal max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Tạo đơn xin phép</h3>
              <button onClick={() => setShowLeaveForm(false)} className="e-icon-btn w-8 h-8 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Loại đơn</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(t => (
                    <button key={t.value} onClick={() => setLeaveForm(f => ({ ...f, type: t.value }))}
                      className={`min-h-[40px] py-2 px-3 rounded-xl text-[13px] font-medium border transition text-left ${
                        leaveForm.type === t.value
                          ? 'border-teal-500 bg-teal-50 text-teal-800 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-teal-300'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {leaveForm.type === 'half_day' && (
                <div>
                  <label className="e-label">Buổi nghỉ</label>
                  <div className="e-seg w-full">
                    {[{value:'morning',label:'Buổi sáng'},{value:'afternoon',label:'Buổi chiều'}].map(p => (
                      <button key={p.value} onClick={() => setLeaveForm(f => ({ ...f, half_day_period: p.value }))}
                        className={`e-seg-item flex-1 ${
                          leaveForm.half_day_period === p.value
                            ? 'e-seg-active'
                            : 'text-slate-500'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="e-label">Ngày</label>
                <input type="date" value={leaveForm.date}
                  onChange={e => setLeaveForm(f => ({ ...f, date: e.target.value }))}
                  className="e-input"
                />
              </div>

              <div>
                <label className="e-label">Lý do</label>
                <textarea value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Nhập lý do xin phép..."
                  className="e-textarea resize-none"
                />
              </div>
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setShowLeaveForm(false)}
                className="e-btn e-btn-secondary flex-1">
                Hủy
              </button>
              <button onClick={handleLeaveSubmit} disabled={saving}
                className="e-btn e-btn-primary flex-1">
                {saving ? 'Đang gửi...' : 'Gửi đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Cảnh báo vi phạm GPS / IP */}
      {anomalyAlert && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-[1px] animate-in fade-in duration-200">
          <div className="e-modal max-w-[340px] animate-in zoom-in-95 duration-300 p-6 flex flex-col items-center text-center">

            {/* Icon Container */}
            <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center mb-4 ring-8 ring-danger-50/50">
              <AlertTriangle className="w-8 h-8 text-danger-500" />
            </div>

            {/* Title */}
            <h3 className="e-modal-title mb-2">Cảnh báo vi phạm</h3>

            {/* Content */}
            <p className="text-slate-500 text-[14px] leading-relaxed mb-4">
              Hệ thống vẫn ghi nhận giờ công cho bạn, tuy nhiên đã phát hiện lỗi:
              <span className="text-danger-600 font-semibold block mt-3 px-3 py-2.5 bg-danger-50 rounded-xl">{anomalyAlert}</span>
            </p>

            {/* Warning Note */}
            <div className="w-full e-subtle p-3.5 mb-5 text-[13px] text-slate-600 leading-snug">
              Thông báo này đã được gửi đến ban quản trị. Bạn vui lòng chủ động giải trình với Admin.
            </div>

            {/* Button */}
            <button
              onClick={() => setAnomalyAlert(null)}
              className="e-btn e-btn-primary e-btn-lg e-btn-block"
            >
              Tôi đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* ===== CHẤM CÔNG KHUÔN MẶT (FACE_AI) ===== */}
      {faceMode && (
        <FaceCameraScreen
          action={faceMode}
          onClose={() => setFaceMode(null)}
          onSuccess={() => { loadData(); }}
        />
      )}
      {showEnroll && (
        <FaceEnrollScreen
          onClose={() => { setShowEnroll(false); loadFaceStatus(); }}
          onDone={() => { loadFaceStatus(); toast.success('Đã đăng ký khuôn mặt — từ giờ chấm công bằng Face ID!'); }}
        />
      )}
    </div>
  );
};

export default AttendancePage;
