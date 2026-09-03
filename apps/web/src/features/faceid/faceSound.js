// Âm thanh + haptic cho chấm công khuôn mặt — sinh bằng WebAudio,
// không cần file asset. Chime thành công CHỈ phát sau khi CRM accepted.

let ctx = null;
const audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

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

// "Ting" xác nhận ~300ms — ngắn, sạch, digital
export function playSuccessChime() {
  try { tone(880, 0, 0.14); tone(1318.5, 0.09, 0.22); } catch { /* iOS chưa unlock audio */ }
  try { navigator.vibrate?.([30, 40, 60]); } catch { /* không hỗ trợ */ }
}

// double-beep trầm ngắn — cảnh báo, KHÔNG loop
export function playErrorBeep() {
  try { tone(320, 0, 0.1, 'square', 0.1); tone(260, 0.14, 0.12, 'square', 0.1); } catch { /* noop */ }
  try { navigator.vibrate?.([80, 60, 80]); } catch { /* noop */ }
}

// Giọng nói tiếng Việt (Web Speech API — có sẵn trên iOS/Android, không cần dịch vụ ngoài)
// Chỉ đọc câu chung chung ("Đã check in thành công"), KHÔNG đọc tên nhân sự.
export function speak(text) {
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
}
