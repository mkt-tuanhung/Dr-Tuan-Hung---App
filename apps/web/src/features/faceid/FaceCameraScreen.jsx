// ============================================================
// MÀN HÌNH CHẤM CÔNG KHUÔN MẶT — HUD biometric theo mockup.
// State machine rõ ràng (không boolean rời rạc — spec mục 25).
// Nguyên tắc sống còn (spec mục 10, 48):
//   - Face match do SERVER quyết định (template không rời server).
//   - "CHECK-IN THÀNH CÔNG" + chime + haptic CHỈ sau khi CRM accepted.
//   - CRM timeout -> "Không thể kết nối CRM" + [Thử gửi lại] (idempotent).
// Camera dispose khi: xong / đóng / back / app vào background.
// ============================================================
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ArrowLeft, ShieldCheck, User, RefreshCw, Send } from 'lucide-react';
import { loadEngine, analyzeFrame, MODEL_VERSION } from './faceEngine';
import { newRequestId, submitFaceAttendance } from './faceApi';
import { playSuccessChime, playErrorBeep, unlockAudio, speak } from './faceSound';
import { getLocation, getPublicIP, calcDistance, OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS_M, OFFICE_IPS } from '@/lib/geo';
import { uploadToR2 } from '@/lib/r2Client';
import { FaceStyles, CornerFrame, ScanLine, LandmarkOverlay, StatusRow, ResultIcon, ResultBar, Glass, CameraTelemetry, HUD, toneColor } from './FaceHud';

// ---------- State machine ----------
const S = {
  IDLE: 'IDLE', REQUESTING_PERMISSION: 'REQUESTING_PERMISSION', LOADING_ENGINE: 'LOADING_ENGINE',
  CAMERA_READY: 'CAMERA_READY', SEARCHING_FACE: 'SEARCHING_FACE', FACE_DETECTED: 'FACE_DETECTED',
  CHECKING_LIVENESS: 'CHECKING_LIVENESS', MATCHING_FACE: 'MATCHING_FACE',
  SUBMITTING_TO_CRM: 'SUBMITTING_TO_CRM',
  ATTENDANCE_SUCCESS: 'ATTENDANCE_SUCCESS', ATTENDANCE_REJECTED: 'ATTENDANCE_REJECTED', ERROR: 'ERROR',
};
const reducer = (st, a) => {
  switch (a.type) {
    case 'GOTO': return { ...st, state: a.state, hint: a.hint ?? null, error: null };
    case 'HINT': return st.hint === a.hint ? st : { ...st, hint: a.hint };
    case 'FAIL': return { ...st, state: a.crm ? S.ATTENDANCE_REJECTED : S.ERROR, error: a.error, hint: null, result: a.result || null };
    case 'SUCCESS': return { ...st, state: S.ATTENDANCE_SUCCESS, result: a.result, error: null, hint: null };
    default: return st;
  }
};

// Câu chữ theo từng mã lỗi (spec mục 24 — không dùng 1 câu cho mọi lỗi)
const ERR = {
  NO_FACE: 'Đưa khuôn mặt vào khung hình',
  MULTIPLE_FACES: 'Chỉ một người được xuất hiện trước camera',
  FACE_TOO_SMALL: 'Đưa điện thoại lại gần hơn',
  FACE_BLURRY: 'Chất lượng hình khuôn mặt quá thấp — giữ máy cố định',
  LOW_LIGHT: 'Khuôn mặt đang quá tối',
  BAD_POSE: 'Vui lòng nhìn thẳng vào camera',
  LIVENESS_FAILED: 'Không xác minh được người thật',
  FACE_NOT_MATCHED: 'Khuôn mặt không khớp tài khoản',
  FACE_NOT_ENROLLED: 'Tài khoản chưa đăng ký khuôn mặt',
  CAMERA_PERMISSION_DENIED: 'Vui lòng bật quyền Camera trong Cài đặt để sử dụng chấm công khuôn mặt',
  GPS_NOT_ALLOWED: 'Vị trí không hợp lệ — cần ở văn phòng',
  WIFI_NOT_VERIFIED: 'Mạng Wi-Fi không hợp lệ',
  NETWORK_ERROR: 'Không thể kết nối CRM',
  CRM_REJECTED: 'CRM không chấp nhận lượt chấm công',
  TIMEOUT: 'Không thể hoàn tất xác minh',
  BACKGROUND: 'Ứng dụng bị chuyển nền — camera đã dừng',
  UNKNOWN: 'Có lỗi xảy ra',
};

const TITLES = {
  [S.REQUESTING_PERMISSION]: 'Đang xin quyền camera…',
  [S.LOADING_ENGINE]: 'Đang tải AI model…',
  [S.CAMERA_READY]: 'Đang khởi động…',
  [S.SEARCHING_FACE]: 'Đang tìm khuôn mặt',
  [S.FACE_DETECTED]: 'Đang kiểm tra chất lượng',
  [S.CHECKING_LIVENESS]: 'Đang xác minh người thật',
  [S.MATCHING_FACE]: 'Đang nhận diện',
  [S.SUBMITTING_TO_CRM]: 'Đang xác nhận chấm công…',
};

export default function FaceCameraScreen({ action = 'CHECK_IN', onClose, onSuccess }) {
  const { profile } = useAuth();
  const [ui, dispatch] = useReducer(reducer, { state: S.IDLE, hint: null, error: null, result: null });
  const [box, setBox] = useState(null);       // vị trí khung mặt (đã mirror)
  const [mesh, setMesh] = useState(null);
  const [fps, setFps] = useState(null);
  const [res, setRes] = useState(null);
  const [progress, setProgress] = useState('');
  const [challenge, setChallenge] = useState(null); // hướng dẫn liveness đang yêu cầu
  const [loc, setLoc] = useState({ gps: null, ip: null, gpsVerified: null, wifiVerified: null });
  const [snap, setSnap] = useState(null);   // ảnh bằng chứng vừa chụp (objectURL) hiện ở góc
  const [flash, setFlash] = useState(false); // hiệu ứng "nháy đèn" lúc chụp

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const aliveRef = useRef(true);
  const stateRef = useRef(S.IDLE);
  const locRef = useRef({ gps: null, ip: null }); // GPS/IP về sau khi loop đã chạy -> đọc qua ref
  const pipeRef = useRef(null);      // dữ liệu pipeline (liveness, samples…)
  const payloadRef = useRef(null);   // payload đã gửi (để "Thử gửi lại" idempotent)
  const beepedRef = useRef(false);

  const goto = useCallback((state, hint) => { stateRef.current = state; dispatch({ type: 'GOTO', state, hint }); }, []);
  const fail = useCallback((error, opts = {}) => {
    stateRef.current = opts.crm ? S.ATTENDANCE_REJECTED : S.ERROR;
    if (!beepedRef.current) { playErrorBeep(); beepedRef.current = true; } // 1 lần, không loop
    dispatch({ type: 'FAIL', error, ...opts });
  }, []);

  const stopCamera = useCallback(() => {
    aliveRef.current = false;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    streamRef.current = null;
  }, []);

  // ---------- Gửi về CRM (Attendance Engine quyết định) ----------
  const submit = useCallback(async (payload) => {
    goto(S.SUBMITTING_TO_CRM);
    stopCamera(); // đã đủ dữ liệu — tắt camera ngay, tiết kiệm pin (spec mục 36)
    try {
      const data = await submitFaceAttendance(payload);
      if (data?.accepted) {
        playSuccessChime(); // CHỈ sau khi CRM accepted
        // Giọng nói xác nhận sau tiếng "ting" (không đọc tên nhân sự)
        setTimeout(() => speak(
          action === 'CHECK_IN'
            ? 'Đã check in thành công'
            : (data.repeated ? 'Đã cập nhật giờ ra' : 'Đã check out thành công')
        ), 350);
        stateRef.current = S.ATTENDANCE_SUCCESS;
        dispatch({ type: 'SUCCESS', result: data });
        onSuccess?.(data);
      } else {
        const code = data?.errorCode || 'CRM_REJECTED';
        fail(code === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : code, { crm: true, result: data });
      }
    } catch {
      // Timeout/mạng lỗi: TUYỆT ĐỐI không nói thành công — cho thử gửi lại cùng requestId
      fail('NETWORK_ERROR');
    }
  }, [goto, stopCamera, fail, onSuccess]);

  const retrySend = useCallback(() => {
    if (payloadRef.current) { beepedRef.current = false; submit(payloadRef.current); }
  }, [submit]);

  const restart = useCallback(() => {
    beepedRef.current = false;
    payloadRef.current = null;
    pipeRef.current = null;
    aliveRef.current = false; // dừng loop cũ
    setBox(null); setMesh(null); setChallenge(null);
    setSnap((old) => { try { if (old) URL.revokeObjectURL(old); } catch { /* noop */ } return null; });
    setFlash(false);
    setTimeout(() => start(), 50); // eslint-disable-line no-use-before-define
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Pipeline chính ----------
  const start = useCallback(async () => {
    unlockAudio();
    aliveRef.current = true;
    beepedRef.current = false;

    // GPS + IP lấy song song từ helper CŨ (tái sử dụng, không viết lại)
    getLocation().then((pos) => {
      const dist = calcDistance(pos.lat, pos.lng, OFFICE_LAT, OFFICE_LNG);
      locRef.current.gps = { latitude: pos.lat, longitude: pos.lng, accuracy: pos.accuracy };
      setLoc((l) => ({ ...l, gps: locRef.current.gps, gpsVerified: dist <= OFFICE_RADIUS_M }));
    }).catch(() => setLoc((l) => ({ ...l, gps: null, gpsVerified: false })));
    getPublicIP().then((ip) => {
      locRef.current.ip = ip;
      setLoc((l) => ({ ...l, ip, wifiVerified: OFFICE_IPS.length === 0 ? true : OFFICE_IPS.includes(ip) }));
    });

    // 1) Camera
    goto(S.REQUESTING_PERMISSION);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch {
      fail('CAMERA_PERMISSION_DENIED');
      return;
    }
    if (!aliveRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
    streamRef.current = stream;
    const video = videoRef.current;
    video.srcObject = stream;
    await video.play().catch(() => {});
    const st = stream.getVideoTracks()[0]?.getSettings?.() || {};
    if (st.width) setRes(`${st.width}x${st.height}`);

    // 2) AI engine
    goto(S.LOADING_ENGINE);
    let human;
    try { human = await loadEngine(setProgress); }
    catch { fail('NETWORK_ERROR'); return; }
    if (!aliveRef.current) return;

    // 3) Vòng lặp detect. Chiến lược TỐC ĐỘ (spec mục 9 liveness: passive trước):
    //    thu embedding + điểm passive antispoof NGAY khi mặt đạt chuẩn (~0.5-1s);
    //    chỉ khi điểm passive thấp mới yêu cầu CHỚP MẮT (active fallback).
    goto(S.SEARCHING_FACE);
    const pipe = {
      startedAt: Date.now(),
      livenessStart: null,
      activeDone: false, // fallback chớp mắt đã đạt?
      passiveReal: [], passiveLive: [],
      samples: [], qualities: [], lastSampleAt: 0,
      frames: 0, fpsWindowStart: Date.now(),
    };
    pipeRef.current = pipe;

    // Chụp 1 ảnh khuôn mặt tại thời điểm quét làm BẰNG CHỨNG chấm công
    // (ảnh nhỏ ~420px, JPEG, upload R2 qua hạ tầng sẵn có — không chặn luồng quét)
    const captureSnapshot = () => {
      try {
        const v = videoRef.current;
        if (!v?.videoWidth) return Promise.resolve(null);
        const w = 420, h = Math.round((w * v.videoHeight) / v.videoWidth);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.translate(w, 0); ctx.scale(-1, 1); // mirror giống preview
        ctx.drawImage(v, 0, 0, w, h);
        return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.72));
      } catch { return Promise.resolve(null); }
    };

    const buildAndSubmit = async (method, score) => {
      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      // Chờ ảnh bằng chứng tối đa 3s — không có ảnh vẫn chấm công bình thường
      const snapshotUrl = await Promise.race([
        pipe.snapshotPromise || Promise.resolve(null),
        new Promise((r) => setTimeout(() => r(null), 3000)),
      ]).catch(() => null);
      const payload = {
        requestId: newRequestId(),
        action,
        embeddings: pipe.samples.slice(0, 3),
        liveness: { passed: true, score: Number(score.toFixed(3)), method },
        quality: Number((avg(pipe.qualities) || 0).toFixed(3)),
        gps: locRef.current.gps, ip: locRef.current.ip,
        snapshotUrl,
      };
      payloadRef.current = payload;
      submit(payload);
    };

    const loop = async () => {
      if (!aliveRef.current || !streamRef.current) return;
      const t0 = Date.now();
      let f;
      try {
        const result = await human.detect(video);
        f = analyzeFrame(result, video);
      } catch { f = { code: 'NO_FACE', faces: 0 }; }
      if (!aliveRef.current) return;

      // FPS thật của vòng lặp AI
      pipe.frames++;
      if (t0 - pipe.fpsWindowStart >= 2000) {
        setFps(Math.round((pipe.frames * 1000) / (t0 - pipe.fpsWindowStart)));
        pipe.frames = 0; pipe.fpsWindowStart = t0;
      }

      const phase = stateRef.current;
      const searchTimeout = Date.now() - pipe.startedAt > 15000;

      if (f.faces === 1 && f.box) {
        setBox({ x: 1 - f.box.x - f.box.w, y: f.box.y, w: f.box.w, h: f.box.h }); // mirror theo video
        setMesh(f.mesh);
      } else { setBox(null); setMesh(null); }

      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      // Điểm passive kết hợp antispoof (real) + liveness (live) — số THẬT từ model
      const passiveScore = () => {
        const r = avg(pipe.passiveReal), l = avg(pipe.passiveLive);
        if (r == null && l == null) return null;
        return Math.min(1, ((r ?? l) + (l ?? r)) / 2 + 0.15); // +0.15: đã qua multi-frame thật
      };

      if (phase === S.SEARCHING_FACE || phase === S.FACE_DETECTED || phase === S.MATCHING_FACE) {
        if (searchTimeout) { fail('TIMEOUT'); return; }
        if (f.code !== 'OK') {
          dispatch({ type: 'HINT', hint: ERR[f.code] || null });
        } else {
          if (phase === S.SEARCHING_FACE) goto(S.FACE_DETECTED);
          // Thu NGAY embedding + điểm passive trên từng frame đạt chuẩn (không bắt người dùng làm gì)
          if (typeof f.real === 'number') pipe.passiveReal.push(f.real);
          if (typeof f.live === 'number') pipe.passiveLive.push(f.live);
          if (f.embedding && Date.now() - pipe.lastSampleAt >= 120) {
            pipe.samples.push(f.embedding);
            pipe.qualities.push(f.quality);
            pipe.lastSampleAt = Date.now();
            if (pipe.samples.length === 1) {
              goto(S.MATCHING_FACE);
              // Chụp ảnh bằng chứng ngay frame đạt chuẩn đầu tiên, upload song song.
              // Hiệu ứng máy ảnh: flash trắng + rung nhẹ + ảnh thu nhỏ hiện ở góc
              pipe.snapshotPromise = captureSnapshot()
                .then((b) => {
                  if (!b) return null;
                  try {
                    setSnap(URL.createObjectURL(b));
                    setFlash(true);
                    setTimeout(() => setFlash(false), 260);
                    navigator.vibrate?.(18);
                  } catch { /* noop */ }
                  return uploadToR2(new File([b], 'face.jpg', { type: 'image/jpeg' }), 'face-attendance');
                })
                .catch(() => null);
            }
          }
          if (pipe.samples.length >= 3) {
            const ps = passiveScore();
            if (ps != null && ps >= 0.5) { buildAndSubmit('PASSIVE', ps); return; } // ĐỦ TIN CẬY -> gửi luôn (~1s)
            // Passive thấp/không có -> fallback ACTIVE: yêu cầu chớp mắt
            pipe.livenessStart = Date.now();
            goto(S.CHECKING_LIVENESS);
          }
        }
      } else if (phase === S.CHECKING_LIVENESS) {
        if (Date.now() - pipe.livenessStart > 8000) { fail('LIVENESS_FAILED'); return; }
        if (f.faces === 1) {
          setChallenge('Chớp mắt để xác minh');
          if (typeof f.real === 'number') pipe.passiveReal.push(f.real);
          if (typeof f.live === 'number') pipe.passiveLive.push(f.live);
          if (f.embedding && Date.now() - pipe.lastSampleAt >= 120) { pipe.samples.push(f.embedding); pipe.qualities.push(f.quality); pipe.lastSampleAt = Date.now(); }
          if (f.blink) {
            setChallenge(null);
            const ps = passiveScore();
            // Chớp mắt thật đã xác nhận -> điểm tối thiểu 0.7 (ghi method ACTIVE)
            buildAndSubmit('ACTIVE', Math.max(ps ?? 0, 0.7));
            return;
          }
        }
      }

      setTimeout(loop, 60); // human.detect tự giới hạn tốc độ theo máy
    };
    loop();
  }, [action, goto, fail, submit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount / unmount / background
  useEffect(() => {
    start();
    const onVis = () => {
      if (document.hidden && ![S.ATTENDANCE_SUCCESS, S.ATTENDANCE_REJECTED, S.ERROR, S.SUBMITTING_TO_CRM].includes(stateRef.current)) {
        stopCamera();
        fail('BACKGROUND');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); stopCamera(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Render ----------
  const st = ui.state;
  const isFinal = [S.ATTENDANCE_SUCCESS, S.ATTENDANCE_REJECTED, S.ERROR].includes(st);
  const tone = st === S.ATTENDANCE_SUCCESS ? 'success' : isFinal ? 'error' : 'neutral';
  const color = toneColor(tone);
  const scanning = [S.SEARCHING_FACE, S.FACE_DETECTED, S.CHECKING_LIVENESS, S.MATCHING_FACE].includes(st);
  const actLabel = action === 'CHECK_IN' ? 'CHECK-IN' : 'CHECK-OUT';
  const netErr = st === S.ERROR && ui.error === 'NETWORK_ERROR' && payloadRef.current;

  // Tên chỉ hiện sau khi identity được server xác nhận (không flicker theo frame)
  const identityLocked = st === S.ATTENDANCE_SUCCESS || (st === S.ATTENDANCE_REJECTED && ui.result?.accepted === false && !['FACE_NOT_MATCHED', 'LIVENESS_FAILED', 'FACE_NOT_ENROLLED'].includes(ui.error));
  const displayName = identityLocked ? (profile?.full_name || '—') : 'Chưa xác định danh tính';

  const bigTitle = st === S.ATTENDANCE_SUCCESS ? 'Nhận diện thành công'
    : st === S.ATTENDANCE_REJECTED || st === S.ERROR
      ? (ui.error === 'FACE_NOT_MATCHED' || ui.error === 'LIVENESS_FAILED' ? 'Không nhận diện được' : ERR[ui.error] ? (ui.result?.message || ERR[ui.error]) : 'Không nhận diện được')
      : TITLES[st] || 'Đang quét…';

  const badges = [
    { label: 'Liveness', value: st === S.ATTENDANCE_SUCCESS ? 'OK' : isFinal && ['LIVENESS_FAILED'].includes(ui.error) ? 'Thất bại' : scanning || st === S.SUBMITTING_TO_CRM ? 'Đang kiểm tra' : isFinal ? 'Cần xác minh' : '…', ok: st === S.ATTENDANCE_SUCCESS ? true : isFinal ? false : null },
    { label: 'Face Match', value: ui.result?.matchScore != null ? `${Math.round(ui.result.matchScore * 100)}%` : isFinal ? 'Thất bại' : '…', ok: ui.result?.accepted ? true : isFinal ? false : null },
    { label: 'Wi-Fi', value: loc.wifiVerified == null ? '…' : loc.wifiVerified ? 'Verified' : 'Sai mạng', ok: loc.wifiVerified },
    { label: 'GPS', value: loc.gpsVerified == null ? '…' : loc.gpsVerified ? 'Verified' : 'Ngoài VP', ok: loc.gpsVerified },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: HUD.bg }}>
      <FaceStyles />

      {/* Camera */}
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,9,8,.75) 0%, rgba(5,9,8,.15) 22%, rgba(5,9,8,.1) 55%, rgba(5,9,8,.88) 100%)' }} />

      {/* HUD trên video */}
      <div className="absolute inset-0 pointer-events-none">
        {!isFinal && <LandmarkOverlay mesh={mesh} color={color} />}
        <CornerFrame box={box} color={color} pulsing={scanning} />
        <ScanLine box={box} color={color} active={scanning} />
      </div>

      {/* Hiệu ứng nháy đèn máy ảnh lúc chụp */}
      {flash && <div className="absolute inset-0 bg-white pointer-events-none z-20" style={{ animation: 'snapFlash .26s ease-out forwards' }} />}

      {/* Ảnh bằng chứng vừa chụp — người dùng biết ảnh đã được lưu */}
      {snap && (
        <div className="absolute right-3 z-10 pointer-events-none" style={{ top: 'calc(max(env(safe-area-inset-top), 14px) + 118px)', animation: 'snapPop .45s cubic-bezier(.2,1.3,.4,1)' }}>
          <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${st === S.ATTENDANCE_SUCCESS ? HUD.success : HUD.neutral}`, boxShadow: `0 4px 18px rgba(0,0,0,.5), 0 0 12px ${st === S.ATTENDANCE_SUCCESS ? HUD.success : HUD.neutral}55`, width: 64 }}>
            <img src={snap} alt="Ảnh chấm công" className="w-full h-20 object-cover block" />
          </div>
          <div className="mt-1 text-center text-[9px] font-bold px-1 py-0.5 rounded-md"
            style={{ background: 'rgba(5,12,11,0.7)', color: st === S.ATTENDANCE_SUCCESS ? HUD.success : 'rgba(255,255,255,0.85)' }}>
            {st === S.ATTENDANCE_SUCCESS ? '✓ Đã lưu hệ thống' : 'Ảnh chấm công'}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 pt-safe" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}>
        <button onClick={() => { stopCamera(); onClose?.(); }} className="pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${HUD.glassBorder}`, color: '#fff' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center select-none">
          <div className="font-black tracking-[0.18em] text-white text-sm" style={{ textShadow: '0 1px 6px rgba(0,0,0,.7)' }}>CHẤM CÔNG KHUÔN MẶT</div>
          <div className="mx-auto mt-1 h-[2px] w-40 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        </div>
        <div className="w-11 h-11 rounded-full flex items-center justify-center relative" style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${HUD.glassBorder}` }}>
          <ShieldCheck className="w-5 h-5" style={{ color }} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        </div>
      </div>

      {/* Telemetry 2 bên (dữ liệu thật) */}
      <div className="relative flex items-start justify-between px-4 mt-3 select-none">
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: 1 }}>
          <span className="px-2 py-1 rounded-lg font-bold" style={{ border: `1px solid ${color}55`, color }}>
            SCAN <span style={{ animation: 'hudDot 1.2s infinite' }}>●</span>
          </span>
          <div className="mt-2" style={{ lineHeight: 1.8 }}>
            <div>{scanning ? 'SEARCHING…' : isFinal ? (tone === 'success' ? 'LOCKED' : 'FAILED') : 'INIT'}</div>
            <div>MODEL: {MODEL_VERSION.slice(0, 14)}</div>
          </div>
        </div>
        <CameraTelemetry res={res} fps={fps} color={color} />
      </div>

      <div className="flex-1" />

      {/* Card kết quả */}
      <div className="relative px-3 pb-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <User className="w-4 h-4 text-white/80" />
                </span>
                <span className="text-white/85 font-semibold text-sm truncate">{displayName}</span>
              </div>
              <div className="font-black text-xl leading-tight" style={{ color: isFinal ? color : '#fff' }}>{bigTitle}</div>
              <div className="text-white/60 text-xs mt-1">
                {st === S.ATTENDANCE_SUCCESS ? (ui.result?.message || (ui.result?.lateMinutes > 0 ? `Đi muộn ${ui.result.lateMinutes} phút` : 'Đúng giờ'))
                  : isFinal ? (ui.error === 'NETWORK_ERROR' ? 'Đã nhận diện khuôn mặt — chưa gửi được về CRM' : 'Vui lòng nhìn thẳng vào camera và thử lại')
                  : challenge || ui.hint || 'Giữ khuôn mặt trong khung hình'}
              </div>
            </div>
            {isFinal && <ResultIcon ok={st === S.ATTENDANCE_SUCCESS} />}
            {st === S.SUBMITTING_TO_CRM && (
              <div className="w-12 h-12 rounded-full border-[3px] border-t-transparent animate-spin shrink-0" style={{ borderColor: `${color}66`, borderTopColor: 'transparent' }} />
            )}
          </div>

          <div className="mt-3"><StatusRow items={badges} /></div>

          {st === S.ATTENDANCE_SUCCESS && ui.result?.time && (
            <div className="mt-3"><ResultBar tone="success" title={`${actLabel} THÀNH CÔNG`} time={ui.result.time.slice(0, 8)} /></div>
          )}
          {st === S.ATTENDANCE_REJECTED && (
            <div className="mt-3"><ResultBar tone="error" title="XÁC MINH THẤT BẠI" time={new Date().toTimeString().slice(0, 8)} /></div>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/50">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: HUD.success }} />
            Dữ liệu được <b className="text-white/70">mã hóa</b> và bảo mật — không lưu ảnh khuôn mặt
          </div>

          {isFinal && (
            <div className="mt-3 flex gap-2">
              {st === S.ATTENDANCE_SUCCESS ? (
                <button onClick={() => { stopCamera(); onClose?.(); }} className="flex-1 py-3 rounded-2xl font-bold text-slate-900" style={{ background: HUD.success }}>Hoàn tất</button>
              ) : netErr ? (
                <>
                  <button onClick={retrySend} className="flex-1 py-3 rounded-2xl font-bold text-slate-900 flex items-center justify-center gap-2" style={{ background: HUD.neutral }}><Send className="w-4 h-4" /> Thử gửi lại</button>
                  <button onClick={() => { stopCamera(); onClose?.(); }} className="px-5 py-3 rounded-2xl font-bold text-white/80" style={{ background: 'rgba(255,255,255,0.1)' }}>Đóng</button>
                </>
              ) : (
                <>
                  <button onClick={restart} className="flex-1 py-3 rounded-2xl font-bold text-slate-900 flex items-center justify-center gap-2" style={{ background: HUD.neutral }}><RefreshCw className="w-4 h-4" /> Thử lại</button>
                  <button onClick={() => { stopCamera(); onClose?.(); }} className="px-5 py-3 rounded-2xl font-bold text-white/80" style={{ background: 'rgba(255,255,255,0.1)' }}>Đóng</button>
                </>
              )}
            </div>
          )}
          {(st === S.LOADING_ENGINE) && progress && <div className="mt-2 text-center text-[11px] text-white/50">{progress}</div>}
        </Glass>
      </div>
    </div>
  );
}
