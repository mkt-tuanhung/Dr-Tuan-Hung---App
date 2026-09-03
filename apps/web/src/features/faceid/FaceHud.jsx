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
