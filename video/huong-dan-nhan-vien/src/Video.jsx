import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, interpolate, spring,
  useVideoConfig, Easing, delayRender, continueRender,
} from 'remotion';
import { scenes, TOTAL, voiceWindows, shotMeta, findBox, title, subtitle } from './timeline.js';

// ===== Nhận diện Ethics / Dr Tuấn Hùng =====
const C = {
  teal: '#067B7F', teal5: '#12A4A5', teal3: '#76C2C3', mint: '#E2F6F5', bg: '#F3F9F9',
  ink: '#1B2020', ink6: '#5B6B6A', peach: '#F4B183', lav: '#A99BE0',
};
const FONT = '"Inter", system-ui, sans-serif';

// ===== Khung điện thoại =====
const SCREEN_W = 600;
const K = SCREEN_W / 390;            // tỉ lệ px ảnh chụp (CSS) -> px video
const SCREEN_H = Math.round(844 * K);
const BEZEL = 20;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const PHONE_X = (1080 - PHONE_W) / 2;
const PHONE_Y = 236;

const ease = Easing.bezier(0.22, 1, 0.36, 1);

const FontLoader = () => {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const faces = ['inter-vietnamese', 'inter-latin', 'inter-latin-ext'].map(n => new FontFace('Inter', `url(${staticFile(`fonts/${n}-wght-normal.woff2`)})`, { weight: '100 900' }));
    Promise.all(faces.map(f => f.load().then(ff => document.fonts.add(ff)))).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
  return null;
};

// ===== Nền chuyển động nhẹ =====
const Background = () => {
  const f = useCurrentFrame();
  const blob = (x, y, r, c, sp, ph) => (
    <div style={{
      position: 'absolute', width: r, height: r, borderRadius: '50%', background: c, filter: 'blur(90px)', opacity: 0.55,
      left: x + Math.sin(f / sp + ph) * 60, top: y + Math.cos(f / (sp * 1.3) + ph) * 50,
    }} />
  );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, #F7FBFB 0%, ${C.bg} 45%, ${C.mint} 100%)`, overflow: 'hidden' }}>
      {blob(-180, 120, 620, '#CAE8E9', 90, 0)}
      {blob(620, 900, 680, '#E2F6F5', 110, 2)}
      {blob(500, -200, 520, '#FDE7D6', 130, 4)}
      {blob(-100, 1400, 560, '#E9E4FB', 100, 1)}
    </AbsoluteFill>
  );
};

// ===== Thanh tiến độ toàn video =====
const Progress = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, height: 8, width: `${(f / TOTAL) * 100}%`, background: `linear-gradient(90deg, ${C.teal}, ${C.teal5})` }} />
  );
};

// ===== Màn tiêu đề (mở đầu / kết) =====
const TitleScene = ({ sc }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14 } });
  const outro = sc.id === 'outro';
  const chips = ['Điều dưỡng', 'Sale', 'Marketing'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 80 }}>
      <div style={{ transform: `scale(${0.6 + 0.4 * s})`, opacity: s, width: 260, height: 260, borderRadius: '50%', background: '#111', boxShadow: '0 30px 80px rgba(6,123,127,0.35)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <Img src={staticFile('logo.png')} style={{ width: 200, height: 200, objectFit: 'contain' }} />
      </div>
      <div style={{ marginTop: 70, textAlign: 'center', opacity: interpolate(f, [10, 30], [0, 1], { extrapolateRight: 'clamp' }), transform: `translateY(${interpolate(f, [10, 30], [40, 0], { extrapolateRight: 'clamp', easing: ease })}px)` }}>
        <div style={{ fontSize: 30, letterSpacing: 6, fontWeight: 700, color: C.teal, textTransform: 'uppercase' }}>{outro ? 'Cảm ơn bạn đã theo dõi' : 'Video hướng dẫn'}</div>
        <div style={{ fontSize: 84, lineHeight: 1.1, fontWeight: 800, color: C.ink, marginTop: 24 }}>{outro ? 'Chúc bạn làm việc hiệu quả!' : title}</div>
        <div style={{ fontSize: 38, color: C.ink6, marginTop: 28, fontWeight: 500 }}>{outro ? 'Mọi thắc mắc, liên hệ quản lý hoặc admin' : subtitle}</div>
      </div>
      {!outro && (
        <div style={{ display: 'flex', gap: 22, marginTop: 64 }}>
          {chips.map((c, i) => {
            const v = spring({ frame: f - 30 - i * 6, fps, config: { damping: 12 } });
            return <div key={c} style={{ transform: `scale(${v})`, padding: '18px 34px', borderRadius: 999, background: [C.teal, '#3CA7A9', '#76C2C3'][i], color: '#fff', fontSize: 36, fontWeight: 700, boxShadow: '0 12px 30px rgba(6,123,127,0.25)' }}>{c}</div>;
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ===== Tiêu đề chương =====
const ChapterHeader = ({ sc }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [0, 16], [0, 1], { extrapolateRight: 'clamp', easing: ease });
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 64, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 26, opacity: v, transform: `translateY(${(1 - v) * -30}px)` }}>
      <div style={{ width: 120, height: 120, borderRadius: 34, background: `linear-gradient(135deg, ${C.teal}, ${C.teal5})`, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 54, fontWeight: 800, boxShadow: '0 16px 36px rgba(6,123,127,0.3)', flexShrink: 0 }}>
        {String(sc.chapterNo).padStart(2, '0')}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.teal, letterSpacing: 3, textTransform: 'uppercase' }}>Phần {sc.chapterNo}/{sc.chapterTotal}</div>
        <div style={{ fontSize: sc.chapter.length > 20 ? 48 : 58, fontWeight: 800, color: C.ink, lineHeight: 1.1, marginTop: 6, whiteSpace: 'nowrap' }}>{sc.chapter}</div>
      </div>
    </div>
  );
};

// ===== Hoạt hoạ quét khuôn mặt (đăng ký / chấm công) =====
const FaceAnim = ({ mode, local }) => {
  const { fps } = useVideoConfig();
  const t = local / fps;
  const prog = Math.min(1, t / 2.6);
  const done = prog >= 1;
  const pop = spring({ frame: local - 2.6 * fps, fps, config: { damping: 12 } });
  const ring = 360;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0B2B2D 0%, #06474A 100%)', fontFamily: FONT, alignItems: 'center' }}>
      <div style={{ marginTop: 70, color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: 4 }}>{mode === 'register' ? 'ĐĂNG KÝ KHUÔN MẶT' : 'CHẤM CÔNG KHUÔN MẶT'}</div>
      <div style={{ position: 'relative', width: ring, height: ring, marginTop: 110 }}>
        <svg width={ring} height={ring} style={{ position: 'absolute', inset: 0, transform: `rotate(${local * 3}deg)` }}>
          <circle cx={ring / 2} cy={ring / 2} r={ring / 2 - 8} fill="none" stroke="rgba(118,194,195,0.35)" strokeWidth="6" strokeDasharray="18 14" />
        </svg>
        <svg width={ring} height={ring} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={ring / 2} cy={ring / 2} r={ring / 2 - 24} fill="none" stroke={done ? '#3BD08F' : C.teal5} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * (ring / 2 - 24)} strokeDashoffset={2 * Math.PI * (ring / 2 - 24) * (1 - prog)} />
        </svg>
        {/* Khuôn mặt cách điệu */}
        <svg width={ring} height={ring} viewBox="0 0 360 360" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="180" cy="180" r="122" fill="#DDEFEF" />
          <path d="M98 168c0-62 38-96 82-96s82 34 82 96c-14-30-40-46-82-46s-68 16-82 46z" fill="#2A3534" />
          <circle cx="146" cy="186" r="9" fill="#2A3534" /><circle cx="214" cy="186" r="9" fill="#2A3534" />
          <path d={done ? 'M146 232q34 28 68 0' : 'M152 236q28 12 56 0'} stroke="#2A3534" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M90 300q90 -50 180 0v60H90z" fill="#12A4A5" />
        </svg>
        {!done && <div style={{ position: 'absolute', left: 40, right: 40, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, transparent, #76F2E0, transparent)', top: 60 + ((Math.sin(t * 3.4) + 1) / 2) * 240, boxShadow: '0 0 24px #76F2E0' }} />}
        {/* Khung góc */}
        {[[0, 0, 0], [1, 0, 90], [1, 1, 180], [0, 1, 270]].map(([x, y, r], i) => (
          <div key={i} style={{ position: 'absolute', left: x ? ring - 70 : 10, top: y ? ring - 70 : 10, width: 60, height: 60, borderTop: '6px solid #fff', borderLeft: '6px solid #fff', borderRadius: '18px 0 0 0', transform: `rotate(${r}deg)`, opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ marginTop: 70, color: 'rgba(255,255,255,0.85)', fontSize: 28, fontWeight: 600 }}>
        {done ? '' : mode === 'register' ? `Đang ghi nhận khuôn mặt… ${Math.min(5, 1 + Math.floor(prog * 5))}/5` : 'Giữ yên, đang nhận diện…'}
      </div>
      {done && (
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 120, transform: `translateY(${(1 - pop) * 200}px)`, opacity: pop, background: '#fff', borderRadius: 32, padding: '30px 34px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#E5F7EE', color: '#1E9E62', display: 'grid', placeItems: 'center', fontSize: 46, fontWeight: 900 }}>✓</div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>{mode === 'register' ? 'Đăng ký thành công' : 'Check-in thành công'}</div>
              <div style={{ fontSize: 26, color: C.ink6, marginTop: 4 }}>{mode === 'register' ? 'Từ giờ chấm công bằng Face ID' : 'Vào ca lúc 08:02 · Thứ 2, 05/10'}</div>
            </div>
          </div>
          {mode !== 'register' && (
            <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
              {['📶 Wi-Fi hợp lệ', '📍 Trong văn phòng'].map(x => <div key={x} style={{ flex: 1, textAlign: 'center', background: '#E2F6F5', color: C.teal, borderRadius: 18, padding: '14px 0', fontSize: 24, fontWeight: 700 }}>{x}</div>)}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ===== Một ảnh màn hình (có cuộn + header/thanh dưới cố định) =====
// Ảnh dài: nội dung (đã ẩn phần tử cố định) cuộn bên dưới; header + thanh dưới lấy từ ảnh khung _vp
const HEADER_H = { home: 100 };
const NO_OVERLAY = new Set(['login', 'all', 'bell', 'leave', 'ot', 'adv_new', 'account']);
const ShotView = ({ shot, scrollY, opacity }) => {
  const m = shotMeta[shot];
  if (!m) return null;
  const tall = m.h > 844 && !NO_OVERLAY.has(shot);
  const hh = HEADER_H[shot] || 56;
  const NAV = 96;
  const src = staticFile(`shots/${shot}.png`);
  const vp = staticFile(`shots/${shot}_vp.png`);
  return (
    <AbsoluteFill style={{ opacity, background: '#F3F9F9' }}>
      <Img src={src} style={{ position: 'absolute', left: 0, top: -scrollY * K, width: SCREEN_W, height: m.h * K }} />
      {tall && (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: hh * K, overflow: 'hidden', opacity: Math.min(1, scrollY / 20) }}>
            <Img src={vp} style={{ width: SCREEN_W, height: SCREEN_H }} />
          </div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: SCREEN_W, height: NAV * K, overflow: 'hidden' }}>
            <Img src={vp} style={{ position: 'absolute', left: 0, top: -(844 - NAV) * K, width: SCREEN_W, height: SCREEN_H }} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// Vị trí cuộn để điểm cần chỉ nằm khoảng 40% chiều cao màn
const scrollFor = (shot, box) => {
  const m = shotMeta[shot];
  if (!m || m.h <= 844 || NO_OVERLAY.has(shot) || !box) return 0;
  return Math.max(0, Math.min(m.h - 844, box.y + box.h / 2 - 844 * 0.42));
};

// ===== Cảnh hướng dẫn: điện thoại + chỉ tay + phụ đề =====
const PhoneScene = ({ sc }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16, mass: 0.9 } });
  // Câu hiện tại
  let idx = 0;
  sc.lines.forEach((l, i) => { if (f >= l.start - 4) idx = i; });
  const line = sc.lines[idx];
  const prev = sc.lines[idx - 1];
  const local = f - line.start;

  const boxOf = (l) => (l && !l.shot.startsWith('@') ? findBox(l.shot, l.focus) : null);
  const box = boxOf(line);
  const targetScroll = (l) => {
    if (!l || l.shot.startsWith('@')) return 0;
    const b = boxOf(l);
    if (b) return scrollFor(l.shot, b);
    // không có điểm chỉ: câu cuối của ảnh dài thì cuộn nhẹ xuống giữa, còn lại giữ đầu trang
    return 0;
  };
  const sameShot = prev && prev.shot === line.shot;
  const fromScroll = sameShot ? targetScroll(prev) : targetScroll(line);
  const toScroll = targetScroll(line);
  const sp = spring({ frame: local + 4, fps, config: { damping: 20, mass: 1.1 } });
  const scrollY = fromScroll + (toScroll - fromScroll) * sp;
  const fade = sameShot || !prev ? 1 : interpolate(local, [-4, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Điểm chỉ (toạ độ màn hình video)
  let ring = null;
  if (box) {
    const x = box.x * K, y = (box.y - scrollY) * K, w = box.w * K, h = box.h * K;
    const appear = interpolate(local, [6, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const pulse = 1 + 0.06 * Math.sin((local / fps) * Math.PI * 2 * 1.2);
    const tap = interpolate(local, [14, 20, 26], [1, 0.82, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const pad = 10;
    ring = (
      <>
        <div style={{ position: 'absolute', left: x - pad, top: y - pad, width: w + pad * 2, height: h + pad * 2, borderRadius: 22, boxShadow: `0 0 0 3000px rgba(10,30,32,${0.38 * appear})`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: x - pad, top: y - pad, width: w + pad * 2, height: h + pad * 2, borderRadius: 22, border: `5px solid ${C.teal5}`, opacity: appear, transform: `scale(${pulse})`, boxShadow: '0 0 30px rgba(18,164,165,0.6)' }} />
        {/* Ngón tay chạm */}
        <div style={{ position: 'absolute', left: x + w / 2 - 10, top: y + h / 2 - 6, opacity: appear, transform: `scale(${tap}) translate(${(1 - appear) * 80}px, ${(1 - appear) * 120}px)`, transformOrigin: '20px 10px', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.35))' }}>
          <svg width="92" height="110" viewBox="0 0 46 55"><path d="M17 5a4 4 0 0 1 8 0v17l2-1a4 4 0 0 1 5 2l1-1a4 4 0 0 1 5 2 4 4 0 0 1 5 3v12c0 8-6 14-14 14h-3c-5 0-9-3-11-7L6 33a4 4 0 0 1 6-5l5 5z" fill="#fff" stroke="#1B2020" strokeWidth="2.4" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ position: 'absolute', left: x + w / 2 - 40, top: y + h / 2 - 40, width: 80, height: 80, borderRadius: '50%', border: `4px solid ${C.teal5}`, opacity: interpolate(local, [16, 34], [0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), transform: `scale(${interpolate(local, [16, 34], [0.3, 1.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})` }} />
      </>
    );
  }

  const face = line.shot.startsWith('@');
  // Khi đổi giữa hai hoạt hoạ khuôn mặt liên tiếp thì giữ đồng hồ chạy tiếp
  let faceLocal = local;
  if (face) { let i = idx; while (i > 0 && sc.lines[i - 1].shot === line.shot) i--; faceLocal = f - sc.lines[i].start; }

  return (
    <AbsoluteFill>
      <ChapterHeader sc={sc} />
      {/* Điện thoại */}
      <div style={{ position: 'absolute', left: PHONE_X, top: PHONE_Y, width: PHONE_W, height: PHONE_H, borderRadius: 86, background: '#1A2524', boxShadow: '0 50px 100px rgba(6,60,62,0.35), inset 0 0 0 3px #3A4747', transform: `translateY(${(1 - enter) * 300}px)`, opacity: enter }}>
        <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SCREEN_W, height: SCREEN_H, borderRadius: 66, overflow: 'hidden', background: '#F3F9F9' }}>
          {prev && !sameShot && fade < 1 && (prev.shot.startsWith('@') ? null : <ShotView shot={prev.shot} scrollY={targetScroll(prev)} opacity={1 - fade} />)}
          {face ? <FaceAnim mode={line.shot === '@face-register' ? 'register' : 'checkin'} local={faceLocal} /> : <ShotView shot={line.shot} scrollY={scrollY} opacity={fade} />}
          {ring}
          {/* Tai thỏ */}
          <div style={{ position: 'absolute', left: SCREEN_W / 2 - 80, top: 14, width: 160, height: 40, borderRadius: 24, background: '#0D1414' }} />
        </div>
      </div>
      <Subtitle text={line.sub} local={local} />
    </AbsoluteFill>
  );
};

const Subtitle = ({ text, local }) => {
  const v = interpolate(local, [-2, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: PHONE_Y + PHONE_H + 36, fontFamily: FONT, opacity: v, transform: `translateY(${(1 - v) * 24}px)` }}>
      <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 34, padding: '28px 38px', boxShadow: '0 18px 40px rgba(6,95,99,0.14)', borderLeft: `10px solid ${C.teal5}`, fontSize: 38, lineHeight: 1.36, fontWeight: 600, color: C.ink, textAlign: 'left' }}>
        {text}
      </div>
    </div>
  );
};

const TitleSubtitle = ({ sc }) => {
  const f = useCurrentFrame();
  let idx = 0;
  sc.lines.forEach((l, i) => { if (f >= l.start - 4) idx = i; });
  const line = sc.lines[idx];
  if (f < line.start - 6) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1560 }}>
      <div style={{ position: 'relative', height: 300 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
          <SubtitleAbs text={line.sub} local={f - line.start} />
        </div>
      </div>
    </div>
  );
};
const SubtitleAbs = ({ text, local }) => {
  const v = interpolate(local, [-2, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  return (
    <div style={{ margin: '0 80px', fontFamily: FONT, opacity: v, transform: `translateY(${(1 - v) * 24}px)`, background: 'rgba(255,255,255,0.9)', borderRadius: 34, padding: '28px 38px', fontSize: 38, lineHeight: 1.36, fontWeight: 600, color: C.ink, textAlign: 'center', boxShadow: '0 18px 40px rgba(6,95,99,0.12)' }}>{text}</div>
  );
};

// ===== Nhạc nền: hạ nhỏ khi có lời =====
const musicVolume = (f) => {
  const ramp = 8;
  let duck = 0;
  for (const [a, b] of voiceWindows) {
    if (f >= a - ramp && f <= b + ramp) {
      const v = f < a ? (f - (a - ramp)) / ramp : f > b ? 1 - (f - b) / ramp : 1;
      duck = Math.max(duck, v);
    }
  }
  const base = 0.30 - 0.21 * duck;  // 0.30 khi không nói, ~0.09 khi đang nói
  const fadeIn = Math.min(1, f / 30);
  const fadeOut = Math.min(1, (TOTAL - f) / 75);
  return base * fadeIn * Math.max(0, fadeOut);
};

export const Video = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <FontLoader />
    <Background />
    <Audio src={staticFile('music.mp3')} loop volume={musicVolume} />
    {scenes.map(sc => (
      <Sequence key={sc.id} from={sc.from} durationInFrames={sc.duration} name={sc.chapter || sc.id}>
        {sc.isTitle ? <><TitleScene sc={sc} /><TitleSubtitle sc={sc} /></> : <PhoneScene sc={sc} />}
        {sc.lines.map(l => (
          <Sequence key={l.name} from={l.start} durationInFrames={l.dur + 10} name={l.name}>
            <Audio src={staticFile(`voice/${l.name}.mp3`)} volume={1} />
          </Sequence>
        ))}
      </Sequence>
    ))}
    <Progress />
  </AbsoluteFill>
);
