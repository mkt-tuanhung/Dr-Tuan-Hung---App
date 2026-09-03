// Bộ HUD "biometric scanner" dùng chung cho Chấm công + Đăng ký khuôn mặt.
// 100% CSS/SVG (không GIF). Mọi thông số hiển thị là dữ liệu THẬT từ engine.
import React from 'react';
import { FACE_EDGES, FACE_VERTS } from './faceEngine';

// Design tokens theo spec (mục 41)
export const HUD = {
  bg: '#050908',
  neutral: '#8EEBFF',
  success: '#37F58A',
  error: '#FF515C',
  glass: 'rgba(5,12,11,0.68)',
  glassBorder: 'rgba(255,255,255,0.12)',
};

export const toneColor = (tone) => (tone === 'success' ? HUD.success : tone === 'error' ? HUD.error : HUD.neutral);

// Keyframes dùng riêng cho feature — render 1 lần trong mỗi screen
export const FaceStyles = () => (
  <style>{`
    @keyframes faceScanLine { 0% { top: 4%; opacity: .25; } 50% { opacity: 1; } 100% { top: 92%; opacity: .25; } }
    @keyframes hudPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
    @keyframes ringPulse { 0% { transform: scale(.9); opacity: .8; } 100% { transform: scale(1.45); opacity: 0; } }
    @keyframes iconPop { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes hudDot { 0%,100% { opacity: .25; } 50% { opacity: .5; } }
    @keyframes hudFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .fh-fade-up { animation: hudFadeUp .3s ease-out; }
    @keyframes snapFlash { 0% { opacity: .95; } 100% { opacity: 0; } }
    @keyframes snapPop { 0% { transform: scale(1.6); opacity: 0; } 55% { transform: scale(.95); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  `}</style>
);

// Khung 4 góc bám theo khuôn mặt (box tỉ lệ 0..1, ĐÃ mirror sẵn từ screen)
export const CornerFrame = ({ box, color, pulsing }) => {
  const b = box || { x: 0.24, y: 0.2, w: 0.52, h: 0.42 };
  const seg = '26%';
  const corner = (pos) => ({
    position: 'absolute', width: seg, height: seg,
    borderColor: color, borderStyle: 'solid', borderWidth: 0,
    filter: `drop-shadow(0 0 6px ${color})`,
    ...(pos === 'tl' && { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 }),
    ...(pos === 'tr' && { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 }),
    ...(pos === 'bl' && { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 }),
    ...(pos === 'br' && { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 }),
  });
  return (
    <div style={{
      position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`,
      width: `${b.w * 100}%`, height: `${b.h * 100}%`,
      transition: 'all .1s linear', // đã làm mượt bằng JS -> transition ngắn, không "nhảy hình"
      animation: pulsing ? 'hudPulse 1.2s ease-in-out infinite' : 'none',
      pointerEvents: 'none',
    }}>
      <div style={corner('tl')} /><div style={corner('tr')} />
      <div style={corner('bl')} /><div style={corner('br')} />
    </div>
  );
};

// Tia quét chạy dọc trong vùng khuôn mặt
export const ScanLine = ({ box, color, active }) => {
  if (!active) return null;
  const b = box || { x: 0.24, y: 0.2, w: 0.52, h: 0.42 };
  return (
    <div style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: '-8%', width: '116%', height: 3, borderRadius: 3,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        boxShadow: `0 0 14px 3px ${color}66`,
        animation: 'faceScanLine 1.7s ease-in-out infinite',
      }} />
    </div>
  );
};

// Lưới LOW-POLY khuôn mặt (đúng phong cách mockup): cạnh tam giác mảnh phát sáng
// + đỉnh trắng nhỏ. pts = { landmarkIndex: [x, y] } đã map sang toạ độ MÀN HÌNH.
export const LowPolyMesh = ({ pts, color }) => {
  if (!pts) return null;
  // viewBox 100x100 bị kéo giãn theo màn dọc -> bù tỉ lệ để chấm luôn TRÒN
  const asp = (window.innerWidth || 1) / (window.innerHeight || 1);
  const rx = 0.55, ry = 0.55 * asp;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <g opacity="0.42">
        {FACE_EDGES.map(([a, b], i) => (pts[a] && pts[b]) ? (
          <line key={i} x1={pts[a][0] * 100} y1={pts[a][1] * 100} x2={pts[b][0] * 100} y2={pts[b][1] * 100}
            stroke={color} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1 }} />
        ) : null)}
      </g>
      {FACE_VERTS.map((i) => pts[i] ? (
        <ellipse key={i} cx={pts[i][0] * 100} cy={pts[i][1] * 100} rx={rx} ry={ry} fill="#fff" opacity="0.92"
          style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
      ) : null)}
    </svg>
  );
};

// ============================================================
// FaceScanCanvas — toàn bộ hiệu ứng quét vẽ bằng CANVAS 60fps:
// khung 4 góc + lưới low-poly + tia quét NỘI SUY MƯỢT từng frame màn hình
// (không phụ thuộc nhịp AI ~7fps). Đọc dữ liệu qua `feed` (ref, không re-render):
//   feed.current = { box, pts, color, scanning, pulse }
// Hiệu ứng: khung "thở" glow; tia quét ease-in-out có vệt mờ; đỉnh lưới
// SÁNG BỪNG khi tia quét chạy qua; vòng sóng lan khi có kết quả (pulse).
// ============================================================
export const FaceScanCanvas = ({ feed }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let raf; let alive = true;
    const disp = { box: null, pts: {} };
    const lerp = (a, b, k) => a + (b - a) * k;

    const draw = (now) => {
      if (!alive) return;
      const f = feed.current || {};
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const color = f.color || HUD.neutral;

      // Nội suy khung + đỉnh lưới về mục tiêu mới nhất (mượt 60fps)
      if (f.box) {
        disp.box = disp.box
          ? { x: lerp(disp.box.x, f.box.x, 0.22), y: lerp(disp.box.y, f.box.y, 0.22), w: lerp(disp.box.w, f.box.w, 0.22), h: lerp(disp.box.h, f.box.h, 0.22) }
          : { ...f.box };
      } else disp.box = null;
      if (f.pts) {
        for (const k in f.pts) {
          const t = f.pts[k], c = disp.pts[k];
          disp.pts[k] = c ? [lerp(c[0], t[0], 0.3), lerp(c[1], t[1], 0.3)] : [t[0], t[1]];
        }
        for (const k in disp.pts) if (!f.pts[k]) delete disp.pts[k];
      } else disp.pts = {};

      const b = disp.box;
      if (b) {
        const bx = b.x * w, by = b.y * h, bw = b.w * w, bh = b.h * h;

        // Khung 4 góc bo tròn + glow "thở"
        const glow = f.scanning ? 8 + 5 * (0.5 + 0.5 * Math.sin(now / 450)) : 11;
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.shadowColor = color; ctx.shadowBlur = glow;
        const seg = Math.min(bw, bh) * 0.26, r = 14;
        const corner = (x, y, sx, sy) => {
          ctx.beginPath();
          ctx.moveTo(x + sx * seg, y);
          ctx.lineTo(x + sx * r, y);
          ctx.quadraticCurveTo(x, y, x, y + sy * r);
          ctx.lineTo(x, y + sy * seg);
          ctx.stroke();
        };
        corner(bx, by, 1, 1); corner(bx + bw, by, -1, 1);
        corner(bx, by + bh, 1, -1); corner(bx + bw, by + bh, -1, -1);
        ctx.restore();

        // Tia quét ease-in-out + vệt mờ
        let scanY = null;
        if (f.scanning) {
          const T = 1800, ph = (now % T) / T;
          const e = ph < 0.5 ? 2 * ph * ph : 1 - ((-2 * ph + 2) ** 2) / 2;
          scanY = by + e * bh;
          const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.save();
          ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.shadowColor = color; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.moveTo(bx - bw * 0.06, scanY); ctx.lineTo(bx + bw * 1.06, scanY); ctx.stroke();
          ctx.globalAlpha = 0.16; ctx.lineWidth = 14; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.moveTo(bx, scanY - 6); ctx.lineTo(bx + bw, scanY - 6); ctx.stroke();
          ctx.restore();
        }

        // Cạnh lưới low-poly
        const P = disp.pts;
        ctx.save();
        ctx.strokeStyle = color; ctx.globalAlpha = 0.32; ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b2] of FACE_EDGES) {
          const p = P[a], q = P[b2];
          if (p && q) { ctx.moveTo(p[0] * w, p[1] * h); ctx.lineTo(q[0] * w, q[1] * h); }
        }
        ctx.stroke();
        ctx.restore();

        // Đỉnh lưới: chấm trắng phát sáng, SÁNG BỪNG khi tia quét chạy qua
        ctx.save();
        ctx.fillStyle = '#fff';
        for (const k in P) {
          const x = P[k][0] * w, y = P[k][1] * h;
          const near = scanY != null ? Math.max(0, 1 - Math.abs(y - scanY) / 26) : 0;
          const rr = 1.9 + 0.4 * Math.sin(now / 500 + x * 0.05) + near * 1.7;
          ctx.globalAlpha = 0.7 + 0.3 * near;
          ctx.shadowColor = color; ctx.shadowBlur = 4 + near * 12;
          ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Vòng sóng lan 1 lần khi có kết quả (xanh/đỏ)
        if (f.pulse && now - f.pulse < 700) {
          const t = (now - f.pulse) / 700;
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.8;
          ctx.strokeStyle = color; ctx.lineWidth = 3;
          ctx.shadowColor = color; ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(bx + bw / 2, by + bh / 2, (Math.min(bw, bh) / 2) * (0.9 + t * 0.85), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [feed]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
};

// Hàng trạng thái: Liveness | Face Match | Wi-Fi | GPS — chỉ hiện giá trị THẬT
export const StatusRow = ({ items }) => (
  <div className="flex items-stretch justify-between gap-1 rounded-2xl px-2 py-2"
    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${HUD.glassBorder}` }}>
    {items.map((it) => (
      <div key={it.label} className="flex-1 min-w-0 text-center px-1">
        <div className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{it.label}</div>
        <div className="text-[11px] font-bold truncate" style={{ color: it.ok === true ? HUD.success : it.ok === false ? HUD.error : 'rgba(255,255,255,0.8)' }}>
          {it.value}
        </div>
      </div>
    ))}
  </div>
);

// Dấu ✓ / ✕ với vòng pulse — SVG scale-in
export const ResultIcon = ({ ok }) => {
  const c = ok ? HUD.success : HUD.error;
  return (
    <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${c}`, animation: 'ringPulse 1.1s ease-out infinite' }} />
      <div style={{
        position: 'absolute', inset: 6, borderRadius: '50%',
        background: `radial-gradient(circle, ${c}33, ${c}18)`, border: `2.5px solid ${c}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 26px ${c}88`, animation: 'iconPop .35s cubic-bezier(.2,1.4,.4,1)',
      }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          {ok ? <path d="M4 12.5l5 5L20 6.5" /> : <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>}
        </svg>
      </div>
    </div>
  );
};

// Thanh kết quả cuối: "CHECK-IN THÀNH CÔNG · 08:26:17" — chỉ sau khi CRM accepted
export const ResultBar = ({ tone, title, time }) => {
  const c = toneColor(tone);
  return (
    <div className="fh-fade-up flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
      style={{ background: `${c}14`, border: `1.5px solid ${c}55`, boxShadow: `0 0 22px ${c}22` }}>
      <div className="font-black tracking-widest text-sm" style={{ color: c }}>{title}</div>
      {time && <div className="font-black tabular-nums text-base" style={{ color: c }}>{time}</div>}
    </div>
  );
};

// Panel kính mờ chung
export const Glass = ({ children, className = '', style = {} }) => (
  <div className={className} style={{ background: HUD.glass, border: `1px solid ${HUD.glassBorder}`, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 22, ...style }}>
    {children}
  </div>
);

// Telemetry góc phải: RES/FPS thật từ camera + vòng lặp detect
export const CameraTelemetry = ({ res, fps, color }) => (
  <div className="text-right select-none" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.8, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
    <div style={{ color, fontWeight: 700, letterSpacing: 1 }}>CAMERA</div>
    <div>FRONT</div>
    {res && <div>RES: {res}</div>}
    {fps != null && <div>FPS: {fps}</div>}
  </div>
);
