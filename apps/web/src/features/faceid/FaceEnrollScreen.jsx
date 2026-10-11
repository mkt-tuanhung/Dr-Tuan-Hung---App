// ============================================================
// ĐĂNG KÝ KHUÔN MẶT — Guided Enrollment 5 bước (spec mục 4):
// Nhìn thẳng → quay trái → quay phải → ngẩng nhẹ → cúi nhẹ.
// Thu nhiều frame, chỉ giữ embedding chất lượng tốt; server tạo template
// mã hóa. Có màn ĐỒNG Ý sử dụng dữ liệu sinh trắc học (spec mục 34).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ScanFace, ShieldCheck, Check, SunMedium, Glasses, RotateCcw, Lock, CircleCheck, RefreshCw } from 'lucide-react';
import { loadEngine, analyzeFrame, mapFaceToScreen } from './faceEngine';
import { submitEnrollment } from './faceApi';
import { playSuccessChime, playErrorBeep, playScanStart, unlockAudio } from './faceSound';
import { FaceStyles, FaceScanCanvas, HUD, toneColor } from './FaceHud';
import './faceV2.css';

// Mỗi bước: điều kiện góc mặt (độ) + số mẫu cần thu
const STEPS = [
  { id: 'front', label: 'NHÌN THẲNG', hint: 'Giữ khuôn mặt trong khung, nhìn thẳng camera', test: (y, p) => Math.abs(y) < 12 && Math.abs(p) < 12, need: 3 },
  // Preview là ảnh GƯƠNG -> chiều yaw phải đảo lại cho khớp cảm nhận người dùng
  { id: 'left',  label: 'QUAY NHẸ SANG TRÁI', hint: 'Xoay đầu nhẹ nhàng, không cần xoay mạnh', test: (y) => y < -13, need: 2 },
  { id: 'right', label: 'QUAY NHẸ SANG PHẢI', hint: 'Xoay đầu nhẹ nhàng, không cần xoay mạnh', test: (y) => y > 13, need: 2 },
  { id: 'up',    label: 'NGẨNG NHẸ', hint: 'Ngẩng cằm lên một chút', test: (_y, p) => p < -8, need: 2 },
  { id: 'down',  label: 'CÚI NHẸ', hint: 'Cúi cằm xuống một chút', test: (_y, p) => p > 8, need: 2 },
];

export default function FaceEnrollScreen({ onClose, onDone, faceStatus }) {
  const [phase, setPhase] = useState('consent'); // consent | capturing | uploading | done | error
  const [stepIdx, setStepIdx] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const feedRef = useRef({ box: null, pts: null, color: HUD.neutral, scanning: false, pulse: 0 });
  const [progress, setProgress] = useState('');
  const [hint, setHint] = useState(null);
  const [errMsg, setErrMsg] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const aliveRef = useRef(false);
  const dataRef = useRef(null);

  const stopCamera = useCallback(() => {
    aliveRef.current = false;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    streamRef.current = null;
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCapture = useCallback(async () => {
    unlockAudio();
    playScanStart();
    setPhase('capturing'); setStepIdx(0); setStepCount(0); setErrMsg(null);
    aliveRef.current = true;
    dataRef.current = { embeddings: [], qualities: [], stepIdx: 0, stepGot: 0, lastAt: 0 };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch {
      setErrMsg('Vui lòng bật quyền Camera trong Cài đặt để đăng ký khuôn mặt'); setPhase('error'); return;
    }
    if (!aliveRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
    streamRef.current = stream;
    const video = videoRef.current;
    video.srcObject = stream;
    await video.play().catch(() => {});

    let human;
    try { human = await loadEngine(setProgress); }
    catch { setErrMsg('Không tải được AI model — kiểm tra mạng rồi thử lại'); setPhase('error'); stopCamera(); return; }
    setProgress('');
    if (!aliveRef.current) return;

    const d = dataRef.current;
    const loop = async () => {
      if (!aliveRef.current || !streamRef.current) return;
      let f;
      try { f = analyzeFrame(await human.detect(video), video); }
      catch { f = { code: 'NO_FACE', faces: 0 }; }
      if (!aliveRef.current) return;

      if (f.faces === 1 && f.box) {
        // Ánh xạ toạ độ video -> màn hình rồi ghi vào feed — canvas nội suy 60fps
        const { box: mb, pts } = mapFaceToScreen(f, video);
        feedRef.current.box = mb; feedRef.current.pts = pts;
      } else { feedRef.current.box = null; feedRef.current.pts = null; }

      const step = STEPS[d.stepIdx];
      if (!step) return; // đã xong

      if (f.faces !== 1) setHint(f.faces === 0 ? 'Đưa khuôn mặt vào khung hình' : 'Chỉ một người trước camera');
      else if (f.code === 'FACE_TOO_SMALL') setHint('Đưa điện thoại lại gần hơn');
      else if (f.code === 'LOW_LIGHT') setHint('Khuôn mặt đang quá tối — tìm chỗ sáng hơn');
      else {
        setHint(null);
        // Đúng tư thế + đủ chất lượng + có embedding + cách mẫu trước >=350ms
        if (step.test(f.yaw, f.pitch) && f.embedding && f.quality >= 0.45 && Date.now() - d.lastAt >= 350) {
          d.embeddings.push(f.embedding);
          d.qualities.push(f.quality);
          d.stepGot++; d.lastAt = Date.now();
          setStepCount(d.stepGot);
          try { navigator.vibrate?.(20); } catch { /* noop */ }
          if (d.stepGot >= step.need) {
            d.stepIdx++; d.stepGot = 0;
            setStepIdx(d.stepIdx); setStepCount(0);
            if (d.stepIdx >= STEPS.length) { finishCapture(); return; } // eslint-disable-line no-use-before-define
          }
        }
      }
      setTimeout(loop, 150);
    };
    loop();
  }, [stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishCapture = useCallback(async () => {
    stopCamera();
    setPhase('uploading');
    const d = dataRef.current;
    try {
      // Giữ tối đa 10 mẫu chất lượng cao nhất
      const ranked = d.embeddings.map((e, i) => ({ e, q: d.qualities[i] })).sort((a, b) => b.q - a.q).slice(0, 10);
      const avgQ = ranked.reduce((s, x) => s + x.q, 0) / ranked.length;
      await submitEnrollment({ embeddings: ranked.map((x) => x.e), quality: Number(avgQ.toFixed(3)) });
      playSuccessChime();
      setPhase('done');
      onDone?.();
    } catch (e) {
      playErrorBeep();
      setErrMsg(e.message || 'Đăng ký thất bại');
      setPhase('error');
    }
  }, [stopCamera, onDone]);


  const color = phase === 'done' ? HUD.success : phase === 'error' ? HUD.error : toneColor('neutral');
  const step = STEPS[stepIdx];

  // Đồng bộ màu/trạng thái quét cho canvas + vòng sóng khi xong/lỗi
  useEffect(() => {
    feedRef.current.color = color;
    feedRef.current.scanning = phase === 'capturing';
    if (phase === 'done' || phase === 'error') feedRef.current.pulse = performance.now();
  }, [color, phase]);

  const close = () => { stopCamera(); onClose?.(); };
  const active = faceStatus?.status === 'ACTIVE';
  const reenroll = faceStatus?.status === 'NEEDS_REENROLLMENT';

  // ---------- MÀN 02 — Thiết lập Face AI (sáng) ----------
  if (phase === 'consent') {
    return (
      <div className="fv2-screen fv2-setup">
        <div className="fv2-top">
          <button type="button" className="fv2-icon-btn" onClick={close} aria-label="Quay lại"><ArrowLeft /></button>
          <h1>Thiết lập Face AI</h1>
          <span className="w-11" />
        </div>
        <div className="max-w-md w-full mx-auto pb-4">
          <h2>{active ? 'Face ID đã được kích hoạt' : reenroll ? 'Cần quét lại khuôn mặt' : 'Quét khuôn mặt ban đầu để kích hoạt chấm công'}</h2>
          <p className="lead">
            {active
              ? 'Chỉ cần quét lại khi khuôn mặt thay đổi nhiều hoặc chấm công hay báo không khớp.'
              : 'Hệ thống lưu mã đặc trưng khuôn mặt của bạn (đã mã hoá) để phục vụ chấm công hằng ngày.'}
          </p>
          <div className="fv2-portrait" aria-hidden="true">
            <img src="/faceid/hero-portrait.webp" alt="" />
            <span className="fv2-hud-ring" />
            <span className="corners" />
            <span className="beam" />
            <span className="fv2-status-chip">
              {active ? <><CircleCheck className="w-4 h-4 text-[#5BF2A0]" /> Đã kích hoạt</> : <><ScanFace className="w-4 h-4" /> Ảnh minh hoạ</>}
            </span>
          </div>
          <div className="fv2-steps">
            <div className="fv2-step"><span><ScanFace /></span>Nhìn thẳng vào camera</div>
            <div className="fv2-step"><span><SunMedium /></span>Đủ ánh sáng, không quá tối</div>
            <div className="fv2-step"><span><Glasses /></span>Bỏ khẩu trang / kính râm</div>
            <div className="fv2-step"><span><RotateCcw /></span>Quay nhẹ trái – phải, ngẩng – cúi theo hướng dẫn (~10 giây)</div>
          </div>
          <div className="fv2-privacy">
            <Lock />
            <span>Khi đăng ký, hệ thống <b>không lưu ảnh</b> — chỉ lưu mã đặc trưng đã <b>mã hoá</b>. Khi chấm công, app chụp 1 ảnh làm bằng chứng và lưu vào bản ghi chấm công.</span>
          </div>
          <div className="px-[18px] mt-4 space-y-2.5 fv2-safe-bottom">
            <button type="button" onClick={startCapture} className="fv2-btn fv2-btn-teal">
              <ScanFace /> {active ? 'Quét lại khuôn mặt' : 'Bắt đầu quét'}
            </button>
            {active && <button type="button" onClick={close} className="fv2-btn fv2-btn-ghost">Giữ Face ID hiện tại</button>}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Đăng ký xong ----------
  if (phase === 'done') {
    return (
      <div className="fv2-screen fv2-success" role="status">
        <div className="fv2-top"><span className="w-11" /></div>
        <div className="px-4 max-w-md w-full mx-auto">
          <div className="fv2-badge-ring">
            <div className="fv2-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="fv2-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
          </div>
          <h2 className="fv2-result-title">Hoàn tất đăng ký Face ID</h2>
          <p className="fv2-result-sub">Từ giờ bạn có thể Check-in / Check-out bằng khuôn mặt.</p>
          <div className="mt-6 fv2-safe-bottom">
            <button type="button" onClick={close} className="fv2-btn fv2-btn-green"><CircleCheck /> Xong</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Đăng ký lỗi ----------
  if (phase === 'error') {
    return (
      <div className="fv2-screen fv2-error" role="alert">
        <div className="fv2-top">
          <button type="button" className="fv2-icon-btn" onClick={close} aria-label="Quay lại"><ArrowLeft /></button>
          <h1>Đăng ký chưa thành công</h1>
          <span className="w-11" />
        </div>
        <div className="max-w-md w-full mx-auto">
          <div className="fv2-err-face" style={{ width: 'min(48vw, 180px)' }}>
            <span className="ring2" /><div className="img"><ScanFace className="w-1/2 h-1/2 text-[#FF8A92] opacity-50" /></div>
            <span className="ring" />
            <div className="fv2-err-x"><svg viewBox="0 0 24 24" fill="none" stroke="#FF4D5A" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg></div>
          </div>
          <p className="fv2-result-sub px-6 mt-5">{errMsg}</p>
          <div className="fv2-reasons">
            <div className="fv2-reason"><span><SunMedium /></span>Đổi sang chỗ sáng hơn</div>
            <div className="fv2-reason"><span><ScanFace /></span>Chỉ một người trước camera, đưa điện thoại gần mặt</div>
          </div>
          <div className="px-4 mt-5 space-y-2.5 fv2-safe-bottom">
            <button type="button" onClick={startCapture} className="fv2-btn fv2-btn-red"><RefreshCw /> Thử lại</button>
            <button type="button" onClick={close} className="fv2-btn fv2-btn-ghost-red"><ArrowLeft /> Đóng</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Đang quét đăng ký (camera thật + HUD) ----------
  return (
    <div className="fv2-screen fv2-scan">
      <FaceStyles />
      <video ref={videoRef} playsInline muted autoPlay />
      <div className="fv2-scan-tint" />
      <div className="fv2-hud" aria-hidden="true"><span className="fv2-hud-ring" /><span className="fv2-hud-ring r2" /><span className="fv2-hud-arc" /></div>
      <div className="absolute inset-0 pointer-events-none"><FaceScanCanvas feed={feedRef} /></div>

      <div className="fv2-top">
        <button type="button" onClick={close} className="fv2-icon-btn" style={{ background: 'rgba(255,255,255,.1)', borderColor: HUD.glassBorder, color: '#fff' }} aria-label="Quay lại"><ArrowLeft /></button>
        <h1 style={{ textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>Thiết lập Face AI</h1>
        <span className="w-11" />
      </div>
      <div className="fv2-scan-head">
        <span className="fv2-intent fv2-intent-in"><ScanFace />ĐĂNG KÝ KHUÔN MẶT</span>
      </div>

      <div className="flex-1" />

      <div className="relative fv2-safe-bottom">
        {phase === 'uploading' ? (
          <div className="fv2-capture-card text-center">
            <div className="fv2-spin mx-auto" style={{ width: 40, height: 40 }} />
            <div className="mt-3 font-bold">Đang tạo Face Profile…</div>
            <div className="text-[#8FC8CF] text-xs mt-1">Mã đặc trưng được mã hoá trước khi lưu</div>
          </div>
        ) : (
          <div className="fv2-capture-card">
            <div className="flex items-center gap-1.5 mb-3">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    background: i < stepIdx ? HUD.success : HUD.neutral,
                    width: i < stepIdx ? '100%' : i === stepIdx ? `${Math.round((stepCount / s.need) * 100)}%` : '0%',
                  }} />
                </div>
              ))}
            </div>
            <div className="text-center">
              <div className="font-black text-xl" style={{ color: HUD.neutral }}>{step?.label}</div>
              <div className="text-[#B5E6EC] text-[13px] mt-1">{hint || step?.hint}</div>
              {progress && <div className="text-white/45 text-[11px] mt-2">{progress}</div>}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <span key={s.id} className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    background: i < stepIdx ? `${HUD.success}22` : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${i < stepIdx ? HUD.success : i === stepIdx ? HUD.neutral : 'rgba(255,255,255,0.15)'}`,
                    color: i < stepIdx ? HUD.success : 'rgba(255,255,255,0.7)',
                  }}>
                  {i < stepIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-white/50">
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: HUD.success }} /> Dữ liệu sinh trắc học được mã hoá và bảo mật
        </div>
      </div>
    </div>
  );
}
