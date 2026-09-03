// ============================================================
// MA SÓI — Bộ nhân vật thú vẽ thuần SVG (không emoji, không ảnh ngoài)
// Style: MODERN · CUTE · BRIGHT — đầu tròn mềm, mắt to có ánh sáng,
// má hồng, phụ kiện đặc trưng từng vai. Dùng chung viewBox 120x120.
// ============================================================
import React from 'react';

const S = ({ children, ...p }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>{children}</svg>
);

// Mắt to + ánh sáng (điểm nhấn cute)
const Eyes = ({ y = 63, dx = 16, r = 6.5, color = '#233150' }) => (
  <g>
    <circle cx={60 - dx} cy={y} r={r} fill={color} />
    <circle cx={60 + dx} cy={y} r={r} fill={color} />
    <circle cx={60 - dx + 2.2} cy={y - 2.2} r={r * 0.32} fill="#fff" />
    <circle cx={60 + dx + 2.2} cy={y - 2.2} r={r * 0.32} fill="#fff" />
  </g>
);
const Cheeks = ({ y = 76, dx = 27, c = '#FFB3A7', o = 0.55 }) => (
  <g opacity={o}><circle cx={60 - dx} cy={y} r="6" fill={c} /><circle cx={60 + dx} cy={y} r="6" fill={c} /></g>
);

// ================= SÓI (tinh ranh, tự tin) =================
export const CharWolf = (p) => (
  <S {...p}>
    <path d="M28 46 L20 18 L44 32 Z" fill="#8E9DB5" /><path d="M92 46 L100 18 L76 32 Z" fill="#8E9DB5" />
    <path d="M30 42 L26 26 L40 35 Z" fill="#5D6C86" /><path d="M90 42 L94 26 L80 35 Z" fill="#5D6C86" />
    <ellipse cx="60" cy="66" rx="36" ry="33" fill="#9AA9C2" />
    <ellipse cx="60" cy="79" rx="20" ry="15" fill="#EDF1F8" />
    {/* lông má xù nhẹ */}
    <path d="M24 66 l-7 3 7 4 z" fill="#9AA9C2" /><path d="M96 66 l7 3 -7 4 z" fill="#9AA9C2" />
    {/* chân mày tự tin */}
    <path d="M36 51 q8 -5 14 -1" stroke="#5D6C86" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M84 51 q-8 -5 -14 -1" stroke="#5D6C86" strokeWidth="3.4" strokeLinecap="round" />
    <Eyes y={62} />
    <path d="M54 76 q6 5 12 0" stroke="#233150" strokeWidth="3" strokeLinecap="round" />
    <path d="M64 78 l2.6 4.4 2.8 -3.4 z" fill="#fff" stroke="#D8DFEA" strokeWidth="0.8" />{/* răng nanh nhỏ */}
    <ellipse cx="60" cy="72" rx="5" ry="3.6" fill="#3A4763" />
    <Cheeks c="#F3A6A0" />
  </S>
);

// ============ MASCOT: SÓI THÔNG MINH (kính tròn + khăn navy) ============
export const MascotWolf = ({ book = false, confused = false, ...p }) => (
  <S {...p}>
    <path d="M28 44 L21 17 L45 31 Z" fill="#8E9DB5" /><path d="M92 44 L99 17 L75 31 Z" fill="#8E9DB5" />
    <path d="M30 40 L27 25 L41 34 Z" fill="#5D6C86" /><path d="M90 40 L93 25 L79 34 Z" fill="#5D6C86" />
    <ellipse cx="60" cy="63" rx="36" ry="32" fill="#9AA9C2" />
    <ellipse cx="60" cy="76" rx="20" ry="14" fill="#EDF1F8" />
    {/* kính tròn gold */}
    <circle cx="44" cy="60" r="12" stroke="#E4B85C" strokeWidth="3" fill="rgba(255,255,255,0.35)" />
    <circle cx="76" cy="60" r="12" stroke="#E4B85C" strokeWidth="3" fill="rgba(255,255,255,0.35)" />
    <path d="M56 60 h8" stroke="#E4B85C" strokeWidth="3" strokeLinecap="round" />
    <Eyes y={60} r={5.6} />
    {confused
      ? <path d="M54 76 q6 -3 12 0" stroke="#233150" strokeWidth="3" strokeLinecap="round" />
      : <path d="M53 74 q7 6 14 0" stroke="#233150" strokeWidth="3" strokeLinecap="round" />}
    <ellipse cx="60" cy="69" rx="5" ry="3.4" fill="#3A4763" />
    {/* khăn navy + chấm gold */}
    <path d="M30 90 q30 14 60 0 l-4 12 q-26 10 -52 0 z" fill="#1E2A44" />
    <circle cx="60" cy="98" r="2.6" fill="#E4B85C" />
    {book && (
      <g>
        <rect x="40" y="100" width="40" height="14" rx="3" fill="#2F5BFF" />
        <rect x="43" y="103" width="34" height="8" rx="2" fill="#E9F1FF" />
        <path d="M60 103 v8" stroke="#C4D4F5" strokeWidth="2" />
      </g>
    )}
  </S>
);

// ================= DÂN LÀNG — CÚN CON (mũ rơm nông dân) =================
export const CharDog = (p) => (
  <S {...p}>
    <path d="M27 52 q-9 16 2 26 q7 5 10 -4 z" fill="#D19B6B" /><path d="M93 52 q9 16 -2 26 q-7 5 -10 -4 z" fill="#D19B6B" />
    <ellipse cx="60" cy="68" rx="34" ry="31" fill="#E8BC8D" />
    <ellipse cx="60" cy="80" rx="19" ry="14" fill="#FFF3E2" />
    {/* mũ rơm */}
    <ellipse cx="60" cy="42" rx="34" ry="9" fill="#FFD1A6" />
    <path d="M40 42 q0 -18 20 -18 q20 0 20 18 z" fill="#FFDDBB" />
    <path d="M40 41 q20 6 40 0" stroke="#E8A96B" strokeWidth="3" fill="none" />
    <Eyes y={64} color="#4A3423" />
    <path d="M52 77 q8 7 16 0" stroke="#4A3423" strokeWidth="3" strokeLinecap="round" fill="none" />
    <ellipse cx="60" cy="73" rx="5" ry="3.6" fill="#6B4A2F" />
    <Cheeks c="#FFB08A" />
  </S>
);

// ================= TIÊN TRI — CÚ MÈO (kính + sao) =================
export const CharOwl = (p) => (
  <S {...p}>
    <path d="M34 34 l-6 -14 12 8 z" fill="#9C86E8" /><path d="M86 34 l6 -14 -12 8 z" fill="#9C86E8" />
    <ellipse cx="60" cy="66" rx="35" ry="33" fill="#B9A6F5" />
    <path d="M60 44 q-16 0 -20 16 q10 -6 20 -6 q10 0 20 6 q-4 -16 -20 -16 z" fill="#9C86E8" />
    <circle cx="45" cy="64" r="13.5" fill="#F4EFFF" /><circle cx="75" cy="64" r="13.5" fill="#F4EFFF" />
    <circle cx="45" cy="64" r="13.5" stroke="#7E66D6" strokeWidth="2.6" /><circle cx="75" cy="64" r="13.5" stroke="#7E66D6" strokeWidth="2.6" />
    <path d="M58 62 h4" stroke="#7E66D6" strokeWidth="2.6" strokeLinecap="round" />
    <Eyes y={64} dx={15} r={5.4} color="#3D2E6E" />
    <path d="M60 74 l-4.5 6 h9 z" fill="#F0A24F" />
    <ellipse cx="60" cy="90" rx="14" ry="9" fill="#D9CDFB" />
    <path d="M97 40 l2.2 4.6 4.8 .7 -3.5 3.4 .8 4.8 -4.3 -2.3 -4.3 2.3 .8 -4.8 -3.5 -3.4 4.8 -.7 z" fill="#E4B85C" />
    <circle cx="24" cy="46" r="2.4" fill="#E4B85C" opacity="0.8" />
  </S>
);

// ================= PHÙ THỦY — MÈO (nón phù thủy) =================
export const CharCat = (p) => (
  <S {...p}>
    <path d="M30 50 L26 28 L46 40 Z" fill="#C9A8EE" /><path d="M90 50 L94 28 L74 40 Z" fill="#C9A8EE" />
    <path d="M33 47 L31 34 L43 41 Z" fill="#F3B8E0" /><path d="M87 47 L89 34 L77 41 Z" fill="#F3B8E0" />
    <ellipse cx="60" cy="70" rx="33" ry="30" fill="#D7BCF4" />
    {/* nón phù thủy */}
    <path d="M60 6 L82 46 Q60 54 38 46 Z" fill="#7E4FD1" />
    <path d="M60 6 L74 32 Q60 38 48 31 Z" fill="#9B6EE8" opacity="0.55" />
    <ellipse cx="60" cy="47" rx="30" ry="7.5" fill="#6A3DBB" />
    <rect x="54" y="36" width="12" height="7" rx="2" fill="#E4B85C" />
    <Eyes y={68} color="#472B78" />
    <path d="M54 80 q6 5 12 0" stroke="#472B78" strokeWidth="3" strokeLinecap="round" />
    <path d="M57 77 l3 3 3 -3" stroke="#B03E86" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    {/* ria mép */}
    <path d="M28 72 h-9 M29 78 l-8 3" stroke="#B79AE0" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M92 72 h9 M91 78 l8 3" stroke="#B79AE0" strokeWidth="2.4" strokeLinecap="round" />
    <Cheeks c="#F5A9D0" />
  </S>
);

// ================= THỢ SĂN — CÁO (băng đô xanh rừng) =================
export const CharFox = (p) => (
  <S {...p}>
    <path d="M27 45 L20 16 L46 31 Z" fill="#F59B6B" /><path d="M93 45 L100 16 L74 31 Z" fill="#F59B6B" />
    <path d="M30 42 L26 24 L42 34 Z" fill="#C96F3D" /><path d="M90 42 L94 24 L78 34 Z" fill="#C96F3D" />
    <ellipse cx="60" cy="66" rx="35" ry="32" fill="#F8AC7C" />
    <path d="M60 68 q-15 22 0 26 q15 -4 0 -26 z" fill="#FFF3E8" />
    <ellipse cx="38" cy="74" rx="12" ry="14" fill="#FFF3E8" /><ellipse cx="82" cy="74" rx="12" ry="14" fill="#FFF3E8" />
    {/* băng đô thợ săn */}
    <path d="M26 51 q34 -12 68 0 l-2 8 q-32 -10 -64 0 z" fill="#2E8B72" />
    <circle cx="88" cy="53" r="3.2" fill="#E4B85C" />
    <Eyes y={64} color="#5A3117" />
    <ellipse cx="60" cy="74" rx="5" ry="3.8" fill="#5A3117" />
    <path d="M53 80 q7 5 14 0" stroke="#5A3117" strokeWidth="3" strokeLinecap="round" fill="none" />
    <Cheeks c="#FF9E77" y={74} />
  </S>
);

// ================= BẢO VỆ — GẤU (khiên vàng) =================
export const CharBear = (p) => (
  <S {...p}>
    <circle cx="31" cy="36" r="12" fill="#C08A5E" /><circle cx="89" cy="36" r="12" fill="#C08A5E" />
    <circle cx="31" cy="36" r="6" fill="#E9BE93" /><circle cx="89" cy="36" r="6" fill="#E9BE93" />
    <ellipse cx="60" cy="66" rx="36" ry="33" fill="#C99368" />
    <ellipse cx="60" cy="80" rx="18" ry="13" fill="#F2D9BC" />
    <Eyes y={62} color="#4A3018" />
    <ellipse cx="60" cy="74" rx="6" ry="4.4" fill="#4A3018" />
    <path d="M54 82 q6 4 12 0" stroke="#4A3018" strokeWidth="3" strokeLinecap="round" fill="none" />
    <Cheeks c="#E8A87C" />
    {/* khiên gold góc phải */}
    <g transform="translate(84 84)">
      <path d="M0 -14 L13 -9 V4 Q13 15 0 20 Q-13 15 -13 4 V-9 Z" fill="#F2C14E" stroke="#D9A32E" strokeWidth="2.4" />
      <path d="M0 -8 V12" stroke="#D9A32E" strokeWidth="2.4" /><path d="M-8 1 H8" stroke="#D9A32E" strokeWidth="2.4" />
    </g>
  </S>
);

// ================= CUPID — THỎ (tim + cánh nhỏ) =================
export const CharRabbit = (p) => (
  <S {...p}>
    <ellipse cx="43" cy="24" rx="9" ry="22" fill="#FFF0F4" transform="rotate(-8 43 24)" />
    <ellipse cx="43" cy="26" rx="4.5" ry="15" fill="#FFC7DA" transform="rotate(-8 43 26)" />
    <g transform="rotate(28 77 30)">
      <ellipse cx="77" cy="30" rx="9" ry="21" fill="#FFF0F4" /><ellipse cx="77" cy="32" rx="4.5" ry="14" fill="#FFC7DA" />
    </g>
    <ellipse cx="60" cy="70" rx="33" ry="30" fill="#FFF6F9" />
    <Eyes y={66} color="#8A4A63" />
    <path d="M56 78 l4 3.4 4 -3.4" stroke="#8A4A63" strokeWidth="2.8" strokeLinecap="round" fill="none" />
    <ellipse cx="60" cy="74" rx="4" ry="3" fill="#F27DA8" />
    <Cheeks c="#FFB9CF" o={0.8} />
    {/* tim + cánh */}
    <path d="M89 82 c5 -7 15 -2 12 6 c-2 6 -12 11 -12 11 c0 0 -10 -5 -12 -11 c-3 -8 7 -13 12 -6 z" fill="#FF6E9C" />
    <path d="M20 78 q-8 -2 -10 6 q7 2 10 -1 z M22 86 q-8 0 -8 7 q7 0 9 -4 z" fill="#CFE2FF" />
  </S>
);

// ================= TRƯỞNG LÀNG — HƯƠU (gạc + huy hiệu) =================
export const CharDeer = (p) => (
  <S {...p}>
    <path d="M36 40 q-9 -8 -7 -21 q6 1 8 8 q1 -8 8 -11 q3 9 -2 16 q6 -2 9 2 q-6 8 -16 6 z" fill="#B0723F" />
    <path d="M84 40 q9 -8 7 -21 q-6 1 -8 8 q-1 -8 -8 -11 q-3 9 2 16 q-6 -2 -9 2 q6 8 16 6 z" fill="#B0723F" />
    <ellipse cx="32" cy="50" rx="8" ry="12" fill="#DCA878" transform="rotate(-24 32 50)" />
    <ellipse cx="88" cy="50" rx="8" ry="12" fill="#DCA878" transform="rotate(24 88 50)" />
    <ellipse cx="60" cy="70" rx="32" ry="30" fill="#E2B183" />
    <ellipse cx="60" cy="82" rx="17" ry="12" fill="#F9E7CE" />
    <circle cx="44" cy="56" r="2.6" fill="#FFF" opacity="0.75" /><circle cx="76" cy="56" r="2.6" fill="#FFF" opacity="0.75" />
    <Eyes y={66} color="#54331B" />
    <ellipse cx="60" cy="77" rx="5" ry="3.8" fill="#54331B" />
    <path d="M54 85 q6 4 12 0" stroke="#54331B" strokeWidth="2.8" strokeLinecap="round" fill="none" />
    {/* huy hiệu trưởng làng */}
    <circle cx="60" cy="104" r="9" fill="#F2C14E" stroke="#D9A32E" strokeWidth="2.2" />
    <path d="M60 99 l1.7 3.4 3.8 .6 -2.7 2.7 .6 3.8 -3.4 -1.8 -3.4 1.8 .6 -3.8 -2.7 -2.7 3.8 -.6 z" fill="#FFF7E6" />
  </S>
);

// Danh sách avatar thú dùng cho LOBBY (gán theo thứ tự vào phòng — spec: không dùng user circle chung chung)
export const AVATAR_SET = [CharDog, CharCat, CharBear, CharRabbit, CharFox, CharOwl, CharDeer, CharWolf];
