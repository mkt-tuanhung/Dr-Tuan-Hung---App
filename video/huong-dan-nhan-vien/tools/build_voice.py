"""Tạo giọng thuyết minh tiếng Việt (Piper vais1000 qua sherpa-onnx, chạy offline)
cho từng câu trong src/script.json -> public/voice/*.mp3 + src/timing.json (độ dài từng câu).
Dùng: python3 tools/build_voice.py <thư mục model vits-piper-vi_VN-vais1000-medium>"""
import json, re, sys, os, glob, subprocess, tempfile
import numpy as np, soundfile as sf, sherpa_onnx, imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = sys.argv[1]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SPEED = 0.88  # chậm nhẹ cho giọng thuyết minh

# Phiên âm từ tiếng Anh / viết tắt để giọng Việt đọc tự nhiên (phụ đề vẫn giữ chữ gốc)
SAY = [
    (r"Dr Tuấn Hùng", "Đốc tơ Tuấn Hùng"), (r"Face ID", "phây ai đi"), (r"\bKPI\b", "ca pê i"),
    (r"Wi-?Fi", "wai phai"), (r"Telegram", "tê lê gờ ram"), (r"Telesale", "tê lê sêu"), (r"\bSale\b", "sêu"),
    (r"Marketing", "ma két tinh"), (r"\bZalo\b", "da lô"), (r"Data khách hàng", "đa ta khách hàng"),
    (r"Kho Media", "kho mê đi a"), (r"Video Ads", "vi đê ô át"), (r"\bAI\b", "ây ai"), (r"\bapp\b", "áp"),
    (r"\badmin\b", "át min"), (r"\bleader\b", "li đơ"), (r"ê kíp", "ê kíp"), (r"\bcamera\b", "ca mê ra"),
]
def say(t):
    for a, b in SAY: t = re.sub(a, b, t)
    return t

onnx = glob.glob(f"{MODEL}/*.onnx")[0]
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=onnx, lexicon="", data_dir=f"{MODEL}/espeak-ng-data", tokens=f"{MODEL}/tokens.txt"),
    num_threads=4)))

script = json.load(open(f"{ROOT}/src/script.json", encoding="utf-8"))
timing = {}
os.makedirs(f"{ROOT}/public/voice", exist_ok=True)
for si, sc in enumerate(script["scenes"]):
    for li, ln in enumerate(sc["lines"]):
        name = f"{sc['id']}-{li}"
        text = say(ln.get("say") or ln["sub"])
        a = tts.generate(text, sid=0, speed=SPEED)
        wav = np.array(a.samples, dtype=np.float32)
        wav = np.concatenate([np.zeros(int(0.08 * a.sample_rate), np.float32), wav, np.zeros(int(0.35 * a.sample_rate), np.float32)])  # đệm lặng đầu/cuối, tránh nuốt chữ
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: tmp = f.name
        sf.write(tmp, wav, a.sample_rate)
        out = f"{ROOT}/public/voice/{name}.mp3"
        # Lọc nhẹ cho giọng thuyết minh: bỏ ù tần thấp, nén, ấm giọng, chuẩn hoá âm lượng
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", tmp, "-af",
            "highpass=f=80,equalizer=f=180:t=q:w=1:g=2,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7",
            "-ar", "44100", "-ac", "1", "-b:a", "128k", out], check=True)
        os.unlink(tmp)
        timing[name] = round(len(wav) / a.sample_rate, 3)
        print(name, timing[name], "s")
json.dump(timing, open(f"{ROOT}/src/timing.json", "w"), indent=1)
print("TỔNG", round(sum(timing.values()), 1), "giây")
