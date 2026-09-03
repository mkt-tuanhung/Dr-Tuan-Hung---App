// Wrapper quanh @vladmandic/human — tải LƯỜI (dynamic import) để không phình
// bundle chính; model tải từ CDN 1 lần rồi cache trong trình duyệt.
// Mọi thông số trả ra đều là DỮ LIỆU THẬT từ model (spec: không fake HUD).

let humanPromise = null;

const HUMAN_VERSION = 'human';
// Model tự host trong public/models (copy từ node_modules/@vladmandic/human/models)
// -> không phụ thuộc CDN ngoài, tải 1 lần (~13MB) rồi trình duyệt cache.
const MODEL_BASE = '/models/';

export async function loadEngine(onProgress) {
  if (!humanPromise) {
    humanPromise = (async () => {
      onProgress?.('Đang tải AI engine…');
      const mod = await import('@vladmandic/human');
      const Human = mod.Human || mod.default;
      const human = new Human({
        modelBasePath: MODEL_BASE,
        cacheSensitivity: 0,
        filter: { enabled: true, equalization: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 2, minConfidence: 0.4 },
          mesh: { enabled: true },
          iris: { enabled: true },
          description: { enabled: true },  // embedding 1024-d cho so khớp 1:1
          antispoof: { enabled: true },    // điểm chống giả mạo (ảnh/màn hình)
          liveness: { enabled: true },     // điểm người thật
          emotion: { enabled: false },
        },
        body: { enabled: false }, hand: { enabled: false },
        object: { enabled: false }, segmentation: { enabled: false },
        gesture: { enabled: true },        // 'blink' cho active liveness
      });
      onProgress?.('Đang tải model nhận diện…');
      await human.load();
      onProgress?.('Đang khởi động…');
      await human.warmup();
      return human;
    })();
    humanPromise.catch(() => { humanPromise = null; }); // lỗi mạng -> cho phép thử lại
  }
  return humanPromise;
}

const rad2deg = (r) => (r || 0) * 180 / Math.PI;

// Phân tích 1 frame -> trạng thái chuẩn hóa cho state machine
export function analyzeFrame(result, video) {
  const faces = result?.face || [];
  const vw = video?.videoWidth || 1, vh = video?.videoHeight || 1;
  if (faces.length === 0) return { code: 'NO_FACE', faces: 0 };
  if (faces.length > 1) return { code: 'MULTIPLE_FACES', faces: faces.length };

  const f = faces[0];
  const [bx, by, bw, bh] = f.box || [0, 0, 0, 0];
  const sizeRatio = bw / vw;
  const yaw = rad2deg(f.rotation?.angle?.yaw);
  const pitch = rad2deg(f.rotation?.angle?.pitch);
  const detScore = f.score ?? f.boxScore ?? 0;
  // Chất lượng tổng hợp từ số liệu THẬT: điểm detect × hệ số kích thước mặt
  const quality = Math.min(1, detScore * Math.min(1, sizeRatio / 0.28));

  let code = 'OK';
  if (sizeRatio < 0.16) code = 'FACE_TOO_SMALL';
  else if (Math.abs(yaw) > 28 || Math.abs(pitch) > 28) code = 'BAD_POSE';
  else if (detScore < 0.5) code = 'LOW_LIGHT';

  const blink = (result.gesture || []).some((g) => String(g.gesture || '').includes('blink'));

  return {
    code, faces: 1, quality, yaw, pitch, detScore, blink,
    box: { x: bx / vw, y: by / vh, w: bw / vw, h: bh / vh }, // tỉ lệ 0..1 để overlay
    mesh: (f.meshRaw || []).length ? f.meshRaw : null,        // landmark tỉ lệ 0..1
    embedding: Array.isArray(f.embedding) && f.embedding.length ? f.embedding : null,
    real: typeof f.real === 'number' ? f.real : null,          // antispoof 0..1
    live: typeof f.live === 'number' ? f.live : null,          // liveness 0..1
  };
}

export const MODEL_VERSION = `${HUMAN_VERSION}-faceres-v1`;
