// Âm thanh + haptic cho chấm công khuôn mặt.
// - Dùng bộ WAV của Face UI v2 (/faceid/scan|success|error.wav), giải mã vào WebAudio
//   để phát được cả sau khi chờ server (iOS chỉ cần mở khoá 1 lần lúc người dùng bấm).
// - Chưa tải xong WAV / trình duyệt chặn -> rơi về tiếng "ting" tổng hợp như cũ.
// - Chime thành công CHỈ phát sau khi CRM accepted. Có nút tắt tiếng (lưu trên máy).

let ctx = null;
const audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

const MUTE_KEY = 'faceSoundMuted';
export function isFaceSoundMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setFaceSoundMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* chế độ riêng tư */ }
}

const SOUND_URLS = { scan: '/faceid/scan.wav', success: '/faceid/success.wav', error: '/faceid/error.wav' };
const buffers = {};
let loading = null;
function loadBuffers() {
  if (loading) return loading;
  loading = Promise.all(Object.entries(SOUND_URLS).map(async ([k, url]) => {
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      buffers[k] = await new Promise((ok, no) => audio().decodeAudioData(arr, ok, no));
    } catch { /* thiếu file -> dùng tiếng tổng hợp */ }
  }));
  return loading;
}

const playBuffer = (kind, gain = 0.32) => {
  const buf = buffers[kind];
  if (!buf) return false;
  const ac = audio();
  const src = ac.createBufferSource();
  const g = ac.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(ac.destination);
  src.start();
  return true;
};

const tone = (freq, start, dur, type = 'sine', gain = 0.18) => {
  const ac = audio();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + start);
  o.stop(ac.currentTime + start + dur + 0.05);
};

// Tiếng "bắt đầu quét" — chỉ gọi ngay sau khi người dùng bấm Check-in/Check-out
export function playScanStart() {
  if (isFaceSoundMuted()) return;
  // Lần đầu file chưa giải mã xong -> chờ tối đa 600ms rồi mới phát (AudioContext đã mở khoá)
  Promise.race([loadBuffers(), new Promise((r) => setTimeout(r, 600))]).then(() => {
    try { if (!playBuffer('scan', 0.22)) tone(1046.5, 0, 0.08, 'sine', 0.08); } catch { /* noop */ }
  });
}

// "Ting" xác nhận — CHỈ sau khi CRM accepted
export function playSuccessChime() {
  if (!isFaceSoundMuted()) {
    try { if (!playBuffer('success')) { tone(880, 0, 0.14); tone(1318.5, 0.09, 0.22); } } catch { /* iOS chưa unlock audio */ }
  }
  try { navigator.vibrate?.([30, 40, 60]); } catch { /* không hỗ trợ */ }
}

// Cảnh báo ngắn — KHÔNG loop
export function playErrorBeep() {
  if (!isFaceSoundMuted()) {
    try { if (!playBuffer('error')) { tone(320, 0, 0.1, 'square', 0.1); tone(260, 0.14, 0.12, 'square', 0.1); } } catch { /* noop */ }
  }
  try { navigator.vibrate?.([80, 60, 80]); } catch { /* noop */ }
}

// Giọng nói tiếng Việt (Web Speech API — có sẵn trên iOS/Android, không cần dịch vụ ngoài)
// Chỉ đọc câu chung chung ("Đã check in thành công"), KHÔNG đọc tên nhân sự.
export function speak(text) {
  if (isFaceSoundMuted()) return;
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    u.rate = 1.05;
    u.volume = 1;
    const viVoice = window.speechSynthesis.getVoices().find((v) => (v.lang || '').toLowerCase().startsWith('vi'));
    if (viVoice) u.voice = viVoice;
    window.speechSynthesis.cancel(); // không chồng câu
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

// iOS yêu cầu 1 tương tác người dùng trước khi phát âm thanh -> gọi khi mở camera
export function unlockAudio() {
  try { const ac = audio(); if (ac.state === 'suspended') ac.resume(); } catch { /* noop */ }
  try { window.speechSynthesis?.getVoices(); } catch { /* noop */ } // nạp sẵn danh sách giọng
  loadBuffers();
}
