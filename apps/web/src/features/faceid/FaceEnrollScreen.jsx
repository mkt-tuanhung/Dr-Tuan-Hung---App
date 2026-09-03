// ============================================================
// ĐĂNG KÝ KHUÔN MẶT — Guided Enrollment 5 bước (spec mục 4):
// Nhìn thẳng → quay trái → quay phải → ngẩng nhẹ → cúi nhẹ.
// Thu nhiều frame, chỉ giữ embedding chất lượng tốt; server tạo template
// mã hóa. Có màn ĐỒNG Ý sử dụng dữ liệu sinh trắc học (spec mục 34).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ScanFace, ShieldCheck, Check } from 'lucide-react';
import { loadEngine, analyzeFrame, mapFaceToScreen } from './faceEngine';
import { submitEnrollment } from './faceApi';
import { playSuccessChime, playErrorBeep, unlockAudio } from './faceSound';
import { FaceStyles, CornerFrame, ScanLine, LowPolyMesh, Glass, HUD, toneColor } from './FaceHud';

// Mỗi bước: điều kiện góc mặt (độ) + số mẫu cần thu
const STEPS = [
  { id: 'front', label: 'NHÌN THẲNG', hint: 'Giữ khuôn mặt trong khung, nhìn thẳng camera', test: (y, p) => Math.abs(y) < 12 && Math.abs(p) < 12, need: 3 },
  // Preview là ảnh GƯƠNG -> chiều yaw phải đảo lại cho khớp cảm nhận người dùng
  { id: 'left',  label: 'QUAY NHẸ SANG TRÁI', hint: 'Xoay đầu nhẹ nhàng, không cần xoay mạnh', test: (y) => y < -13, need: 2 },
  { id: 'right', label: 'QUAY NHẸ SANG PHẢI', hint: 'Xoay đầu nhẹ nhàng, không cần xoay mạnh', test: (y) => y > 13, need: 2 },
  { id: 'up',    label: 'NGẨNG NHẸ', hint: 'Ngẩng cằm lên một chút', test: (_y, p) => p < -8, need: 2 },
  { id: 'down',  label: 'CÚI NHẸ', hint: 'Cúi cằm xuống một chút', test: (_y, p) => p > 8, need: 2 },
];

export default function FaceEnrollScreen({ onClose, onDone }) {
  const [phase, setPhase] = useState('consent'); // consent | capturing | uploading | done | error
  const [stepIdx, setStepIdx] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [box, setBox] = useState(null);
  const [mesh, setMesh] = useState(null);
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
        // Ánh xạ toạ độ video -> màn hình (object-cover, mirror) để khung/lưới không méo
        const { box: mb, pts } = mapFaceToScreen(f, video);
        setBox(mb); setMesh(pts);
      } else { setBox(null); setMesh(null); }

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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: HUD.bg }}>
      <FaceStyles />
      {phase !== 'consent' && (
        <>
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,9,8,.78) 0%, rgba(5,9,8,.12) 25%, rgba(5,9,8,.1) 55%, rgba(5,9,8,.9) 100%)' }} />
          <div className="absolute inset-0 pointer-events-none">
            <LowPolyMesh pts={mesh} color={color} />
            <CornerFrame box={box} color={color} pulsing={phase === 'capturing'} />
            <ScanLine box={box} color={color} active={phase === 'capturing'} />
          </div>
        </>
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}>
        <button onClick={() => { stopCamera(); onClose?.(); }} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${HUD.glassBorder}`, color: '#fff' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-black tracking-[0.16em] text-white text-sm" style={{ textShadow: '0 1px 6px rgba(0,0,0,.7)' }}>ĐĂNG KÝ KHUÔN MẶT</div>
        <div className="w-11" />
      </div>

      <div className="flex-1" />

      <div className="relative px-3 pb-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}>
        {phase === 'consent' && (
          <Glass className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${HUD.neutral}1c`, border: `1px solid ${HUD.neutral}44` }}>
                <ScanFace className="w-6 h-6" style={{ color: HUD.neutral }} />
              </span>
              <div className="font-black text-white text-lg leading-tight">Chấm công bằng nhận diện khuôn mặt</div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Chấm công khuôn mặt sử dụng <b className="text-white">dữ liệu sinh trắc học</b> để xác minh danh tính khi Check-in/Check-out.
              Hệ thống <b className="text-white">không lưu ảnh</b> khuôn mặt — chỉ lưu mã đặc trưng đã <b className="text-white">mã hóa</b>.
              Bạn vẫn có thể chấm công bằng GPS/Wi-Fi như bình thường.
            </p>
            <div className="mt-3 text-white/60 text-xs leading-relaxed">
              Quy trình ~10 giây: nhìn thẳng → quay nhẹ trái → quay nhẹ phải → ngẩng nhẹ → cúi nhẹ.
            </div>
            <button onClick={startCapture} className="mt-4 w-full py-3.5 rounded-2xl font-bold text-slate-900" style={{ background: HUD.neutral }}>
              Đồng ý & Đăng ký khuôn mặt
            </button>
            <button onClick={() => onClose?.()} className="mt-2 w-full py-3 rounded-2xl font-bold text-white/70" style={{ background: 'rgba(255,255,255,0.08)' }}>Để sau</button>
          </Glass>
        )}

        {phase === 'capturing' && (
          <Glass className="p-4">
            {/* Tiến trình 5 bước */}
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
              <div className="text-white/60 text-xs mt-1">{hint || step?.hint}</div>
              {progress && <div className="text-white/45 text-[11px] mt-2">{progress}</div>}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <span key={s.id} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: i < stepIdx ? `${HUD.success}22` : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${i < stepIdx ? HUD.success : i === stepIdx ? HUD.neutral : 'rgba(255,255,255,0.15)'}`,
                    color: i < stepIdx ? HUD.success : 'rgba(255,255,255,0.6)',
                  }}>
                  {i < stepIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
              ))}
            </div>
          </Glass>
        )}

        {phase === 'uploading' && (
          <Glass className="p-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: `${HUD.neutral}66`, borderTopColor: 'transparent' }} />
            <div className="mt-3 font-bold text-white">Đang tạo Face Profile…</div>
            <div className="text-white/55 text-xs mt-1">Mã đặc trưng được mã hóa trước khi lưu</div>
          </Glass>
        )}

        {phase === 'done' && (
          <Glass className="p-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${HUD.success}1e`, border: `2px solid ${HUD.success}` }}>
              <Check className="w-7 h-7" style={{ color: HUD.success }} />
            </div>
            <div className="mt-3 font-black text-lg" style={{ color: HUD.success }}>HOÀN TẤT ĐĂNG KÝ</div>
            <div className="text-white/60 text-xs mt-1">Từ giờ bạn có thể chấm công bằng khuôn mặt</div>
            <button onClick={() => onClose?.()} className="mt-4 w-full py-3 rounded-2xl font-bold text-slate-900" style={{ background: HUD.success }}>Xong</button>
          </Glass>
        )}

        {phase === 'error' && (
          <Glass className="p-5 text-center">
            <div className="font-black text-lg" style={{ color: HUD.error }}>Đăng ký chưa thành công</div>
            <div className="text-white/65 text-sm mt-1">{errMsg}</div>
            <div className="mt-4 flex gap-2">
              <button onClick={startCapture} className="flex-1 py-3 rounded-2xl font-bold text-slate-900" style={{ background: HUD.neutral }}>Thử lại</button>
              <button onClick={() => onClose?.()} className="px-5 py-3 rounded-2xl font-bold text-white/75" style={{ background: 'rgba(255,255,255,0.08)' }}>Đóng</button>
            </div>
          </Glass>
        )}

        {phase !== 'consent' && (
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-white/45">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: HUD.success }} /> Dữ liệu sinh trắc học được mã hóa và bảo mật
          </div>
        )}
      </div>
    </div>
  );
}
