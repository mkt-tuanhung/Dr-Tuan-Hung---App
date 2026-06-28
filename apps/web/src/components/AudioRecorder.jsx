import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, X, Loader2, Trash2, Save } from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const SEGMENT_MS = 10 * 60 * 1000; // tự cắt đoạn mỗi 10 phút (mỗi đoạn 1 file độc lập, dễ transcribe)

// Popup ghi âm tư vấn — như recorder điện thoại (sóng âm + dB). Cuộc dài tự cắt đoạn 10'.
export default function AudioRecorder({ onClose, onSaved }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [db, setDb] = useState(-60);
  const [segs, setSegs] = useState([]);      // [{ url, blob }] sau khi dừng
  const [uploading, setUploading] = useState(false);

  const mediaRec = useRef(null);
  const chunks = useRef([]);
  const segBlobs = useRef([]);
  const rotating = useRef(false);
  const stream = useRef(null);
  const audioCtx = useRef(null);
  const analyser = useRef(null);
  const raf = useRef(null);
  const timer = useRef(null);
  const segTimer = useRef(null);
  const canvasRef = useRef(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    clearInterval(timer.current); clearInterval(segTimer.current);
    if (stream.current) stream.current.getTracks().forEach(t => t.stop());
    if (audioCtx.current && audioCtx.current.state !== 'closed') audioCtx.current.close();
    stream.current = null; audioCtx.current = null; analyser.current = null;
  }, []);
  useEffect(() => () => cleanup(), [cleanup]);

  const draw = useCallback(() => {
    const cv = canvasRef.current; const an = analyser.current;
    if (!cv || !an) return;
    const ctx = cv.getContext('2d');
    const N = an.frequencyBinCount;
    const data = new Uint8Array(N);
    an.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < N; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / N);
    setDb(rms > 0 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60);
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const bars = 48; const bw = W / bars;
    for (let b = 0; b < bars; b++) {
      const idx = Math.floor(b / bars * N);
      const amp = Math.abs(data[idx] - 128) / 128;
      const h = Math.max(3, amp * H * 0.95);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(b * bw + bw * 0.2, (H - h) / 2, bw * 0.6, h);
    }
    raf.current = requestAnimationFrame(draw);
  }, []);

  const startRecorder = () => {
    chunks.current = [];
    const mr = new MediaRecorder(stream.current);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
      if (blob.size > 0) segBlobs.current.push(blob);
      if (rotating.current) { rotating.current = false; startRecorder(); }
      else {
        setSegs(segBlobs.current.map(b => ({ url: URL.createObjectURL(b), blob: b })));
        if (stream.current) stream.current.getTracks().forEach(t => t.stop());
      }
    };
    mediaRec.current = mr;
    mr.start();
  };

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx.current = new Ctx();
      const src = audioCtx.current.createMediaStreamSource(s);
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 512;
      src.connect(analyser.current);

      segBlobs.current = []; setSegs([]); setSeconds(0);
      startRecorder();
      setRecording(true);
      timer.current = setInterval(() => setSeconds(x => x + 1), 1000);
      segTimer.current = setInterval(() => { rotating.current = true; if (mediaRec.current?.state === 'recording') mediaRec.current.stop(); }, SEGMENT_MS);
      draw();
    } catch {
      toast.error('Không truy cập được micro. Hãy cấp quyền micro cho trình duyệt.');
    }
  };

  const stop = () => {
    clearInterval(segTimer.current); clearInterval(timer.current); cancelAnimationFrame(raf.current);
    rotating.current = false;
    if (mediaRec.current && mediaRec.current.state !== 'inactive') mediaRec.current.stop();
    setRecording(false);
  };

  const reset = () => { setSegs([]); segBlobs.current = []; setSeconds(0); };

  const save = async () => {
    if (segBlobs.current.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (let i = 0; i < segBlobs.current.length; i++) {
        const b = segBlobs.current[i];
        const ext = b.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([b], `tu-van-${Date.now()}-p${i + 1}.${ext}`, { type: b.type });
        urls.push(await uploadToR2(file, 'consult-audio'));
      }
      onSaved(urls, seconds);
    } catch (err) { toast.error('Lỗi tải lên: ' + err.message); }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[55] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Mic className="w-5 h-5 text-emerald-600" /> Ghi âm tư vấn</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 flex flex-col items-center">
          <div className="text-4xl font-bold tabular-nums text-slate-800">{fmtTime(seconds)}</div>
          <div className="text-xs text-slate-400 mt-1">{recording ? `${db} dB` : segs.length ? `Đã ghi ${segs.length} đoạn` : 'Sẵn sàng ghi'}</div>

          <div className="w-full my-5 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
            {recording ? <canvas ref={canvasRef} width={320} height={88} className="w-full h-24" />
              : segs.length ? <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto">{segs.map((s, i) => (<div key={i} className="flex items-center gap-2"><span className="text-[10px] text-slate-400 w-12 shrink-0">Đoạn {i + 1}</span><audio src={s.url} controls className="h-7 flex-1 min-w-0" /></div>))}</div>
                : <div className="h-24 flex items-center justify-center text-slate-300 text-sm gap-2"><Mic className="w-5 h-5" /> Bấm nút đỏ để ghi</div>}
          </div>

          {segs.length === 0 ? (
            <button onClick={recording ? stop : start}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${recording ? 'bg-slate-800 scale-95' : 'bg-rose-500 hover:bg-rose-600'}`}>
              {recording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-9 h-9 text-white" />}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={reset} className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"><Trash2 className="w-5 h-5" /></button>
              <button onClick={save} disabled={uploading} className="px-6 h-12 rounded-full bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {uploading ? 'Đang lưu…' : 'Lưu ghi âm'}
              </button>
            </div>
          )}
          {recording && <p className="text-[11px] text-rose-500 mt-3 animate-pulse">● Đang ghi… (tự cắt đoạn mỗi 10 phút) — bấm ô vuông để dừng</p>}
          {!recording && !segs.length && <p className="text-[11px] text-slate-400 mt-3">Cuộc dài 30–90 phút được tự chia đoạn để transcribe nhanh & chính xác</p>}
        </div>
      </div>
    </div>
  );
}
