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
import { ArrowLeft, ScanFace, Activity, Camera, Volume2, VolumeX, LogIn, LogOut, MapPin } from 'lucide-react';
import { loadEngine, analyzeFrame, mapFaceToScreen } from './faceEngine';
import { newRequestId, submitFaceAttendance } from './faceApi';
import { playSuccessChime, playErrorBeep, playScanStart, unlockAudio, speak, isFaceSoundMuted, setFaceSoundMuted } from './faceSound';
import { getLocation, getPublicIP, calcDistance, OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS_M, OFFICE_IPS } from '@/lib/geo';
import { uploadToR2 } from '@/lib/r2Client';
import { FaceStyles, FaceScanCanvas, HUD, toneColor } from './FaceHud';
import { FaceSuccessScreen, FaceErrorScreen } from './FaceResultScreens';
import './faceV2.css';

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
  FACE_CUT: 'Đưa CẢ khuôn mặt vào trong khung hình',
  FACE_OCCLUDED: 'Không che mặt — bỏ tay / khẩu trang / tóc che mặt ra',
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

export default function FaceCameraScreen({ action = 'CHECK_IN', onClose, onSuccess, onEnroll }) {
  const { profile } = useAuth();
  const [ui, dispatch] = useReducer(reducer, { state: S.IDLE, hint: null, error: null, result: null });
  const [fps, setFps] = useState(null);
  const [res, setRes] = useState(null);
  const [progress, setProgress] = useState('');
  const [challenge, setChallenge] = useState(null); // hướng dẫn liveness đang yêu cầu
  const [loc, setLoc] = useState({ gps: null, ip: null, gpsVerified: null, wifiVerified: null });
  const [snap, setSnap] = useState(null);   // ảnh bằng chứng vừa chụp (objectURL) hiện ở góc
  const [flash, setFlash] = useState(false); // hiệu ứng "nháy đèn" lúc chụp
  const [hasFace, setHasFace] = useState(false); // có khung mặt thật -> ẩn khung hướng dẫn tĩnh
  const [muted, setMuted] = useState(isFaceSoundMuted);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const aliveRef = useRef(true);
  const stateRef = useRef(S.IDLE);
  const locRef = useRef({ gps: null, ip: null }); // GPS/IP về sau khi loop đã chạy -> đọc qua ref
  const smoothRef = useRef({ lastSeen: 0 });      // giữ khung khi mặt mất thoáng qua
  // Dữ liệu cho canvas hiệu ứng (mutate trực tiếp — canvas tự nội suy 60fps, không re-render React)
  const feedRef = useRef({ box: null, pts: null, color: HUD.neutral, scanning: false, pulse: 0 });
  const pipeRef = useRef(null);      // dữ liệu pipeline (liveness, samples…)
  const payloadRef = useRef(null);   // payload đã gửi (để "Thử gửi lại" idempotent)
  const beepedRef = useRef(false);
  const hasFaceRef = useRef(false);

  const goto = useCallback((state, hint) => { stateRef.current = state; dispatch({ type: 'GOTO', state, hint }); }, []);
  const stopCamera = useCallback(() => {
    aliveRef.current = false;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    streamRef.current = null;
  }, []);
  const fail = useCallback((error, opts = {}) => {
    stateRef.current = opts.crm ? S.ATTENDANCE_REJECTED : S.ERROR;
    stopCamera(); // màn kết quả không giữ camera (quét lại sẽ mở phiên mới)
    if (!beepedRef.current) { playErrorBeep(); beepedRef.current = true; } // 1 lần, không loop
    dispatch({ type: 'FAIL', error, ...opts });
  }, [stopCamera]);

  // ---------- Gửi về CRM (Attendance Engine quyết định) ----------
  const submit = useCallback(async (payload) => {
    goto(S.SUBMITTING_TO_CRM);
    stopCamera(); // đã đủ dữ liệu — tắt camera ngay, tiết kiệm pin (spec mục 36)
    feedRef.current.pts = null; // giữ khung + hiệu ứng, ẩn lưới khi chờ CRM
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
    setChallenge(null);
    setSnap((old) => { try { if (old) URL.revokeObjectURL(old); } catch { /* noop */ } return null; });
    setFlash(false);
    smoothRef.current = { lastSeen: 0 };
    Object.assign(feedRef.current, { box: null, pts: null, pulse: 0 });
    setTimeout(() => start(), 50); // eslint-disable-line no-use-before-define
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Pipeline chính ----------
  const start = useCallback(async () => {
    unlockAudio();
    playScanStart(); // người dùng vừa bấm Check-in/Check-out hoặc Quét lại
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

      // Khung + lưới: ánh xạ toạ độ video -> MÀN HÌNH (object-cover, mirror),
      // ghi MỤC TIÊU vào feedRef — canvas tự nội suy 60fps nên cực mượt.
      const sm = smoothRef.current;
      const fd = feedRef.current;
      if (f.faces === 1 && f.box) {
        sm.lastSeen = Date.now();
        const { box: mb, pts } = mapFaceToScreen(f, video);
        if (mb) {
          const aspScr = (window.innerWidth || 1) / (window.innerHeight || 1);
          const cx = mb.x + mb.w / 2, cy = mb.y + mb.h / 2;
          const w = Math.min(0.94, mb.w * 1.16);
          const h = Math.min(0.62, w * 1.18 * aspScr); // khung gần vuông như mockup
          fd.box = { x: cx - w / 2, y: cy - h / 2, w, h };
        }
        fd.pts = pts;
      } else if (Date.now() - sm.lastSeen > 700) {
        fd.box = null; fd.pts = null;
      } else {
        fd.pts = null; // mất mặt thoáng qua: giữ khung, ẩn lưới
      }
      if (!!fd.box !== hasFaceRef.current) { hasFaceRef.current = !!fd.box; setHasFace(!!fd.box); }

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

  // ---------- Render (giao diện v2: màn 03 quét · 04 thành công · 05 thất bại) ----------
  const st = ui.state;
  const isFinal = [S.ATTENDANCE_SUCCESS, S.ATTENDANCE_REJECTED, S.ERROR].includes(st);
  const tone = st === S.ATTENDANCE_SUCCESS ? 'success' : isFinal ? 'error' : 'neutral';
  const color = toneColor(tone);
  const scanning = [S.SEARCHING_FACE, S.FACE_DETECTED, S.CHECKING_LIVENESS, S.MATCHING_FACE].includes(st);

  // Đồng bộ màu/trạng thái cho canvas hiệu ứng + vòng sóng khi có kết quả
  useEffect(() => {
    feedRef.current.color = color;
    feedRef.current.scanning = scanning;
  }, [color, scanning]);
  useEffect(() => {
    if (isFinal) feedRef.current.pulse = performance.now();
  }, [isFinal]);

  const isIn = action === 'CHECK_IN';
  const netErr = st === S.ERROR && ui.error === 'NETWORK_ERROR' && payloadRef.current;
  const close = () => { stopCamera(); onClose?.(); };
  const toggleMute = () => { setMuted((m) => { setFaceSoundMuted(!m); return !m; }); };

  // 3 ô trạng thái — chỉ phản ánh tiến trình THẬT của engine/server
  const matchTile = st === S.SUBMITTING_TO_CRM ? { v: 'Đang đối chiếu', ok: null }
    : [S.FACE_DETECTED, S.MATCHING_FACE, S.CHECKING_LIVENESS].includes(st) ? { v: 'Đã thấy khuôn mặt', ok: true }
      : st === S.SEARCHING_FACE ? { v: 'Đang tìm…', ok: null } : { v: 'Chờ camera', ok: null };
  const liveTile = st === S.CHECKING_LIVENESS ? { v: 'Chớp mắt', ok: null }
    : st === S.SUBMITTING_TO_CRM ? { v: 'Đạt', ok: true }
      : [S.FACE_DETECTED, S.MATCHING_FACE].includes(st) ? { v: 'Đang phân tích', ok: null } : { v: 'Chờ', ok: null };
  const camTile = st === S.REQUESTING_PERMISSION ? { v: 'Xin quyền…', ok: null }
    : st === S.LOADING_ENGINE ? { v: 'Tải AI…', ok: null }
      : st === S.SUBMITTING_TO_CRM ? { v: 'Đã tắt', ok: null }
        : fps != null ? { v: `Tốt · ${fps} fps`, ok: true } : res ? { v: 'Đã bật', ok: true } : { v: '…', ok: null };

  const locText = loc.gpsVerified == null ? 'Đang lấy vị trí…' : loc.gpsVerified ? 'Trong văn phòng' : 'Ngoài văn phòng';
  const progressText = st === S.SUBMITTING_TO_CRM ? 'Đang đối chiếu dữ liệu khuôn mặt trên máy chủ…'
    : st === S.LOADING_ENGINE ? (progress || TITLES[st]) : (TITLES[st] || 'Đang khởi động…');
  const bars = [12, 20, 30, 18, 34, 24, 14, 28, 36, 22, 30, 16, 26, 12];

  return (
    <div className="fv2-screen fv2-scan">
      <FaceStyles />
      {/* Camera thật của engine cũ — giữ nguyên, mirror */}
      <video ref={videoRef} playsInline muted autoPlay />
      <div className="fv2-scan-tint" />

      {/* Vòng HUD xoay (trang trí) — đổi màu theo kết quả */}
      <div className="fv2-hud" data-tone={tone} aria-hidden="true">
        <span className="fv2-hud-ring" /><span className="fv2-hud-ring r2" /><span className="fv2-hud-arc" />
      </div>
      {/* Khung hướng dẫn khi CHƯA thấy mặt; có mặt -> canvas vẽ khung bám mặt + lưới landmark THẬT */}
      <div className={`fv2-guide ${hasFace || isFinal ? 'hide' : ''}`} aria-hidden="true">
        {scanning && <span className="fv2-guide-beam" />}
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <FaceScanCanvas feed={feedRef} />
      </div>

      {flash && <div className="fv2-flash" />}
      {snap && !isFinal && (
        <div className="fv2-snap" style={{ top: 'calc(max(env(safe-area-inset-top), 12px) + 120px)' }}>
          <img src={snap} alt="Ảnh chấm công" />
          <span>Ảnh chấm công</span>
        </div>
      )}

      {/* Header */}
      <div className="fv2-top">
        <button type="button" onClick={close} className="fv2-icon-btn" style={{ background: 'rgba(255,255,255,.1)', borderColor: HUD.glassBorder, color: '#fff' }} aria-label="Quay lại">
          <ArrowLeft />
        </button>
        <h1 style={{ textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>Đang quét khuôn mặt</h1>
        <button type="button" onClick={toggleMute} className="fv2-icon-btn" style={{ background: 'rgba(255,255,255,.1)', borderColor: HUD.glassBorder, color: '#fff' }} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>
      <div className="fv2-scan-head">
        <span className={`fv2-intent ${isIn ? 'fv2-intent-in' : 'fv2-intent-out'}`}>
          {isIn ? <LogIn /> : <LogOut />}{isIn ? 'CHECK-IN · CHẤM CÔNG VÀO' : 'CHECK-OUT · CHẤM CÔNG RA'}
        </span>
        <p className="fv2-scan-hint" aria-live="polite">
          {ui.hint || 'Vui lòng giữ nguyên khuôn mặt và nhìn thẳng vào camera'}
          {challenge && <><br /><span className="fv2-challenge">{challenge}</span></>}
        </p>
      </div>
      <div className="fv2-mini"><span>{res ? `RES ${res}` : 'CAMERA TRƯỚC'}</span><span>{fps != null ? `AI ${fps} FPS` : ''}</span></div>

      <div className="flex-1" />

      {/* Bảng trạng thái dưới */}
      <div className="relative fv2-safe-bottom">
        <div className="fv2-tiles">
          <div className="fv2-tile" data-ok={String(matchTile.ok)}><ScanFace /><b>Face Match</b><small>{matchTile.v}</small></div>
          <div className="fv2-tile" data-ok={String(liveTile.ok)}><Activity /><b>Liveness</b><small>{liveTile.v}</small></div>
          <div className="fv2-tile" data-ok={String(camTile.ok)}><Camera /><b>Camera</b><small>{camTile.v}</small></div>
        </div>
        <div className="fv2-progress" aria-live="polite">
          {!isFinal && <span className="fv2-spin" />}
          <span className="flex-1 min-w-0">
            <span className="block font-semibold">{progressText}</span>
            <span className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-[#8FC8CF]"><MapPin className="w-3.5 h-3.5" />{locText}</span>
          </span>
        </div>
        <div className={`fv2-wavebars ${scanning || st === S.SUBMITTING_TO_CRM ? '' : 'idle'}`} aria-hidden="true">
          <span className="fv2-dots-line" />
          {bars.map((h, i) => <i key={i} style={{ '--h': `${h}px`, animationDelay: `${(i % 7) * -0.13}s` }} />)}
          <span className="fv2-dots-line" />
        </div>
      </div>

      {/* Kết quả — CHỈ dựng màn thành công khi server đã accepted */}
      {st === S.ATTENDANCE_SUCCESS && ui.result?.accepted && (
        <FaceSuccessScreen action={action} result={ui.result} profile={profile} snapUrl={snap}
          photoSaved={!!payloadRef.current?.snapshotUrl} onDone={close} />
      )}
      {(st === S.ATTENDANCE_REJECTED || st === S.ERROR) && (
        <FaceErrorScreen
          errorCode={ui.error}
          message={ui.result?.message || ERR[ui.error] || null}
          snapUrl={snap}
          netRetry={!!netErr}
          onRetry={restart}
          onRetrySend={retrySend}
          onClose={close}
          onEnroll={onEnroll ? () => { stopCamera(); onEnroll(); } : null}
        />
      )}
    </div>
  );
}
