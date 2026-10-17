"""Nhạc nền vui tươi tạm thời (tự tổng hợp, không bản quyền) — 112 BPM, Sol trưởng,
vòng hợp âm I–V–vi–IV: tiếng gảy ukulele (Karplus-Strong), marimba, bass, trống nhẹ.
Thay bằng nhạc từ Google Flow: chép file vào public/music.mp3 rồi render lại."""
import numpy as np, soundfile as sf, subprocess, imageio_ffmpeg, os
SR = 44100; BPM = 112; BEAT = 60 / BPM; BAR = 4 * BEAT
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)
def midi(n): return 440 * 2 ** ((n - 69) / 12)
BARS = 32
N = int(BARS * BAR * SR) + SR * 2
L = np.zeros(N); R = np.zeros(N)
def add(buf, start, sig, gain=1.0):
    i = int(start * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i] * gain
def ks(freq, dur, bright=0.5):  # Karplus-Strong gảy dây
    n = int(SR * dur); p = int(SR / freq)
    buf = rng.uniform(-1, 1, p) * 0.5; out = np.zeros(n); idx = 0
    for k in range(n):
        out[k] = buf[idx]; nxt = buf[(idx + 1) % p]
        buf[idx] = (bright * buf[idx] + (1 - bright) * nxt) * 0.996; idx = (idx + 1) % p
    return out * np.minimum(1, np.linspace(8, 0, n))
def marimba(freq, dur=0.6):
    t = np.arange(int(SR * dur)) / SR
    return (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 30)) * np.exp(-t * 7)
def bass(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return s * np.minimum(1, t * 80) * np.exp(-t * 2.2)
def kick():
    t = np.arange(int(SR * 0.35)) / SR; f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def noise(dur, decay, hp=True):
    n = rng.uniform(-1, 1, int(SR * dur))
    if hp: n = np.diff(np.concatenate([[0], n]))
    return n * np.exp(-np.arange(len(n)) / SR * decay)
# Sol trưởng: G D Em C
CH = [[55, 59, 62, 67], [50, 54, 57, 62], [52, 55, 59, 64], [48, 52, 55, 60]]
BASSN = [43, 38, 40, 36]
SCALE = [67, 69, 71, 74, 76, 79, 81, 83]  # ngũ cung Sol cho giai điệu
MOTIF = [[0, 2, 4, 2], [3, 2, 1, 0], [4, 5, 4, 2], [1, 2, 0, -1]]
for bar in range(BARS):
    t0 = bar * BAR; c = bar % 4; sect = (bar // 8) % 4
    # Gảy ukulele: nhịp đảo phách
    for k, off in enumerate([0, 1.5, 2, 3, 3.5]):
        ch = CH[c]; d = 0.012 if k % 2 == 0 else -0.012
        for m, n in enumerate(ch[::(1 if k % 2 == 0 else -1)]):
            s = ks(midi(n + 12), 0.9, 0.55)
            add(L, t0 + off * BEAT + m * abs(d), s, 0.10); add(R, t0 + off * BEAT + m * abs(d), s, 0.13)
    # Bass
    for off, n in [(0, BASSN[c]), (1.5, BASSN[c] + 12), (2, BASSN[c]), (3, BASSN[c] + 7)]:
        s = bass(midi(n), BEAT * 0.9); add(L, t0 + off * BEAT, s, 0.30); add(R, t0 + off * BEAT, s, 0.30)
    # Trống (vào từ ô nhịp 2)
    if bar >= 1:
        for b in range(4):
            if b in (0, 2): s = kick(); add(L, t0 + b * BEAT, s, 0.45); add(R, t0 + b * BEAT, s, 0.45)
            if b in (1, 3): s = noise(0.18, 28); add(L, t0 + b * BEAT, s, 0.16); add(R, t0 + b * BEAT, s, 0.16)
        for e in range(8):
            s = noise(0.05, 90); g = 0.05 if e % 2 else 0.03
            add(L, t0 + e * BEAT / 2, s, g * 0.7); add(R, t0 + e * BEAT / 2, s, g)
    # Giai điệu marimba (từ ô nhịp 4, nghỉ 1 đoạn cho đỡ dày)
    if bar >= 4 and sect != 2:
        mot = MOTIF[(bar + sect) % 4]
        for i, deg in enumerate(mot):
            n = SCALE[(deg + c * 2) % len(SCALE)]
            s = marimba(midi(n)); add(L, t0 + i * BEAT, s, 0.13); add(R, t0 + i * BEAT + 0.006, s, 0.10)
    # Chuông lấp lánh đầu mỗi 4 ô nhịp
    if bar % 4 == 0:
        s = marimba(midi(CH[c][-1] + 24), 1.2); add(L, t0, s, 0.05); add(R, t0 + 0.01, s, 0.07)
# Reverb đơn giản + giới hạn mềm
ir = rng.uniform(-1, 1, int(SR * 1.2)) * np.exp(-np.linspace(0, 6, int(SR * 1.2))) * 0.02
def verb(x): return x + np.convolve(x, ir)[:len(x)]
L = np.tanh(verb(L) * 1.4); R = np.tanh(verb(R) * 1.4)
loop = int(BARS * BAR * SR)
out = np.stack([L[:loop], R[:loop]], 1)
# Cuối vòng hoà mượt với đầu vòng để lặp không bị khựng
fade = int(0.5 * SR); out[-fade:] *= np.linspace(1, 0.6, fade)[:, None]
tmp = f"{ROOT}/public/music.wav"; sf.write(tmp, out * 0.8, SR)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", tmp, "-af", "loudnorm=I=-18:TP=-2", "-b:a", "192k", f"{ROOT}/public/music.mp3"], check=True)
os.remove(tmp); print("music.mp3", round(loop / SR, 1), "giây/vòng")
