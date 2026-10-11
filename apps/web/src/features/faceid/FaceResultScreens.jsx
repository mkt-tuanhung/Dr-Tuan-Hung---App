// ============================================================
// MÀN 04 (thành công — xanh) và MÀN 05 (thất bại — đỏ) của chấm công Face AI.
// Chỉ hiển thị dữ liệu THẬT: kết quả server trả về (giờ, ngày, đi muộn, khớp mặt, vị trí),
// hồ sơ đăng nhập (tên, mã NV, vị trí công việc) và ảnh bằng chứng vừa chụp.
// Thành công CHỈ được dựng khi server trả accepted (FaceCameraScreen quyết định).
// ============================================================
import React, { useMemo } from 'react';
import {
  ArrowLeft, Clock, CalendarDays, MapPin, Check, RefreshCw, Send, ScanFace, AlertTriangle,
  SunMedium, UserX, ShieldAlert, Wifi, Camera, Timer, Smartphone, Settings, CircleCheck,
} from 'lucide-react';
import { ROLE_LABELS } from '@/features/permissions/menuConfig';
import './faceV2.css';

const hm = (t) => (t ? String(t).slice(0, 5) : '—');
const dmy = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

function Avatar({ profile }) {
  const name = profile?.full_name || '';
  const initial = name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || '?';
  return profile?.avatar_url
    ? <img className="fv2-avatar" src={profile.avatar_url} alt="" />
    : <span className="fv2-avatar">{initial}</span>;
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 9) * 0.09}s`,
    color: ['#19C38A', '#5BE0C2', '#FFC94D', '#53B6FF', '#0EA371'][i % 5],
    rot: `${(i * 47) % 180}deg`,
  })), []);
  return (
    <div className="fv2-confetti" aria-hidden="true">
      {bits.map((b, i) => <i key={i} style={{ left: b.left, animationDelay: b.delay, background: b.color, transform: `rotate(${b.rot})` }} />)}
    </div>
  );
}

export function FaceSuccessScreen({ action, result, profile, snapUrl, photoSaved, onDone }) {
  const isIn = action === 'CHECK_IN';
  const title = isIn
    ? (result?.repeated ? 'Bạn đã check-in hôm nay' : 'Check-in thành công')
    : (result?.repeated ? 'Đã cập nhật giờ ra' : 'Check-out thành công');
  const sub = isIn && result?.repeated
    ? (result?.message || 'Giờ vào giữ nguyên lần đầu')
    : 'Hệ thống đã xác thực khuôn mặt và ghi nhận thời gian chấm công.';
  const late = isIn && !result?.repeated && Number(result?.lateMinutes) > 0 ? Number(result.lateMinutes) : 0;
  const role = [profile?.position && profile.position !== 'Nhân viên' ? profile.position : null, ROLE_LABELS[profile?.role] || null].filter(Boolean).join(' · ');
  const loc = result?.locationWarning
    ? result.locationWarning
    : result?.gpsVerified ? 'Trong văn phòng' : result?.gpsVerified === false ? 'Ngoài văn phòng' : null;

  return (
    <div className="fv2-screen fv2-success" role="status" aria-live="polite">
      <Confetti />
      <div className="fv2-top">
        <span className="w-11" />
        <h1 className="sr-only">Kết quả chấm công</h1>
      </div>
      <div className="relative px-4 pb-4 max-w-md w-full mx-auto">
        <div className="fv2-badge-ring">
          <div className="fv2-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="fv2-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
        </div>
        <h2 className="fv2-result-title">{title}</h2>
        <p className="fv2-result-sub">{sub}</p>

        <div className="fv2-card mt-4">
          <div className="fv2-emp">
            <Avatar profile={profile} />
            <div className="min-w-0">
              <b className="truncate">{profile?.full_name || '—'}</b>
              {role && <small className="truncate">{role}</small>}
              {profile?.employee_id && <small>Mã NV: <span className="font-semibold text-slate-700">{profile.employee_id}</span></small>}
            </div>
          </div>
          <div className="mt-3">
            <div className="fv2-kv"><Clock /><span>{isIn ? 'Giờ vào' : 'Giờ ra'}</span><b className="ml-auto text-[17px]">{hm(result?.time)}</b></div>
            <div className="fv2-kv"><CalendarDays /><span>Ngày</span><b className="ml-auto">{dmy(result?.date) || '—'}</b></div>
            {loc && <div className="fv2-kv"><MapPin /><span>Vị trí</span><b className="ml-auto text-right">{loc}</b></div>}
          </div>
        </div>

        <div className="mt-3">
          <div className="fv2-check" style={{ animationDelay: '.25s' }}>
            <span className="dot"><Check strokeWidth={3.2} /></span>Đúng khuôn mặt
            {result?.matchScore != null && <em>{Math.round(result.matchScore * 100)}%</em>}
          </div>
          {photoSaved && (
            <div className="fv2-check" style={{ animationDelay: '.35s' }}>
              <span className="dot"><Check strokeWidth={3.2} /></span>Đã lưu ảnh chấm công
            </div>
          )}
          {isIn && !result?.repeated && (
            <div className={`fv2-check ${late ? 'warn' : ''}`} style={{ animationDelay: '.45s' }}>
              <span className="dot">{late ? <Timer /> : <Check strokeWidth={3.2} />}</span>
              {late ? `Đi muộn ${late} phút` : 'Đúng giờ'}
            </div>
          )}
        </div>

        {snapUrl && (
          <div className="fv2-card mt-3 !p-3" style={{ animationDelay: '.3s' }}>
            <div className="fv2-photo-row">
              <img src={snapUrl} alt="Ảnh chụp lúc chấm công" />
              <p><b className="block text-[13px] text-slate-700 mb-0.5">Ảnh chấm công</b>{photoSaved ? 'Ảnh chụp tại thời điểm quét đã được lưu vào bản ghi chấm công của bạn.' : 'Ảnh chưa tải lên được — lượt chấm công vẫn được ghi nhận.'}</p>
            </div>
          </div>
        )}

        <div className="mt-4 fv2-safe-bottom">
          <button type="button" className="fv2-btn fv2-btn-green" onClick={onDone}><CircleCheck /> Hoàn tất</button>
        </div>
      </div>
    </div>
  );
}

// Lý do + gợi ý theo từng mã lỗi (không dùng 1 câu cho mọi lỗi)
const REASONS = {
  FACE_NOT_MATCHED: { title: 'Không đúng nhân sự hoặc khuôn mặt chưa rõ', items: [[UserX, 'Khuôn mặt không khớp với dữ liệu đã đăng ký'], [SunMedium, 'Ảnh bị mờ hoặc thiếu sáng'], [ShieldAlert, 'Có thể đang đeo khẩu trang / kính râm']] },
  LIVENESS_FAILED: { title: 'Không xác minh được người thật', items: [[ScanFace, 'Đưa chính khuôn mặt bạn vào khung, không dùng ảnh hay màn hình'], [SunMedium, 'Đứng nơi đủ sáng, không ngược sáng'], [Check, 'Chớp mắt khi được yêu cầu']] },
  FACE_NOT_ENROLLED: { title: 'Tài khoản chưa có Face ID', items: [[Settings, 'Vào Thiết lập Face ID để đăng ký khuôn mặt'], [ScanFace, 'Đăng ký khoảng 10 giây, chỉ cần làm một lần']] },
  FACE_BLURRY: { title: 'Hình khuôn mặt chưa đủ rõ', items: [[Smartphone, 'Giữ điện thoại cố định khi quét'], [SunMedium, 'Đứng nơi đủ sáng'], [ScanFace, 'Đưa điện thoại lại gần mặt hơn']] },
  GPS_NOT_ALLOWED: { title: 'Vị trí chưa hợp lệ', items: [[MapPin, 'Bạn đang ở ngoài khu vực phòng khám'], [Settings, 'Bật định vị (GPS) cho trình duyệt'], [Wifi, 'Kết nối Wi‑Fi văn phòng rồi thử lại']] },
  WIFI_NOT_VERIFIED: { title: 'Mạng Wi‑Fi chưa hợp lệ', items: [[Wifi, 'Kết nối Wi‑Fi của văn phòng'], [MapPin, 'Bật định vị để hệ thống xác minh vị trí']] },
  NETWORK_ERROR: { title: 'Không thể kết nối máy chủ', items: [[Wifi, 'Mạng yếu hoặc máy chủ phản hồi chậm'], [ScanFace, 'Khuôn mặt đã được nhận diện — chỉ chưa gửi được'], [Send, 'Bấm "Thử gửi lại", không cần quét lại']] },
  CAMERA_PERMISSION_DENIED: { title: 'Chưa có quyền dùng camera', items: [[Camera, 'Trình duyệt đang chặn camera'], [Settings, 'Cài đặt → Safari/Chrome → Camera → Cho phép'], [RefreshCw, 'Sau đó bấm Quét lại']] },
  TIMEOUT: { title: 'Chưa nhận được khuôn mặt đủ rõ', items: [[ScanFace, 'Nhìn thẳng, đưa trọn khuôn mặt vào khung'], [SunMedium, 'Đứng nơi đủ sáng'], [Smartphone, 'Đưa điện thoại lại gần hơn']] },
  BACKGROUND: { title: 'Ứng dụng bị chuyển nền', items: [[Camera, 'Camera đã dừng để bảo vệ quyền riêng tư'], [Smartphone, 'Giữ màn hình mở trong lúc quét']] },
};

export function FaceErrorScreen({ errorCode, message, snapUrl, netRetry, onRetry, onRetrySend, onClose, onEnroll }) {
  const r = REASONS[errorCode] || { title: message || 'Xác thực thất bại', items: [[AlertTriangle, message || 'Có lỗi xảy ra'], [ScanFace, 'Nhìn thẳng vào camera và thử lại'], [SunMedium, 'Đứng nơi đủ sáng']] };
  const sub = netRetry
    ? 'Lượt quét chưa được ghi nhận. Thử gửi lại khi có mạng.'
    : (message && REASONS[errorCode] ? message : 'Vui lòng thử lại trong điều kiện đủ sáng và nhìn thẳng vào camera.');
  return (
    <div className="fv2-screen fv2-error" role="alert">
      <div className="fv2-top">
        <button type="button" className="fv2-icon-btn" onClick={onClose} aria-label="Quay lại"><ArrowLeft /></button>
        <h1>Xác thực thất bại</h1>
        <span className="w-11" />
      </div>
      <div className="relative pb-4 max-w-md w-full mx-auto">
        <div className="fv2-err-face">
          <span className="ring2" />
          <div className="img">
            {snapUrl ? <img src={snapUrl} alt="" /> : <ScanFace className="w-1/2 h-1/2 text-[#FF8A92] opacity-50" />}
          </div>
          <span className="ring" />
          <span className="fv2-err-scan" />
          <div className="fv2-err-x">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FF4D5A" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </div>
        </div>
        <h2 className="fv2-result-title">{r.title}</h2>
        <p className="fv2-result-sub px-4">{sub}</p>
        <div className="fv2-reasons">
          {r.items.map(([Ic, text], i) => (
            <div key={i} className="fv2-reason"><span><Ic /></span>{text}</div>
          ))}
        </div>
        <div className="px-4 mt-5 space-y-2.5 fv2-safe-bottom">
          {netRetry ? (
            <button type="button" className="fv2-btn fv2-btn-red" onClick={onRetrySend}><Send /> Thử gửi lại</button>
          ) : errorCode === 'FACE_NOT_ENROLLED' && onEnroll ? (
            <button type="button" className="fv2-btn fv2-btn-red" onClick={onEnroll}><Settings /> Thiết lập Face ID</button>
          ) : (
            <button type="button" className="fv2-btn fv2-btn-red" onClick={onRetry}><RefreshCw /> Quét lại</button>
          )}
          <button type="button" className="fv2-btn fv2-btn-ghost-red" onClick={onClose}><ArrowLeft /> Về trang chấm công</button>
        </div>
      </div>
    </div>
  );
}
