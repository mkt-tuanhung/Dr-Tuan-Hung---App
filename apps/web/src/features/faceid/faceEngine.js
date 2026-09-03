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

// ================= LƯỚI LOW-POLY (theo chỉ số landmark MediaPipe FaceMesh) =================
// Viền mặt (rút gọn 16 điểm, theo thứ tự vòng)
const OVAL = [10, 297, 284, 389, 454, 361, 397, 378, 152, 149, 172, 132, 234, 162, 54, 67];
export const FACE_EDGES = [
  // viền mặt khép kín
  ...OVAL.map((p, i) => [p, OVAL[(i + 1) % OVAL.length]]),
  // trán
  [151, 10], [151, 67], [151, 297], [151, 107], [151, 336],
  // lông mày + nối viền/mắt/sống mũi
  [70, 105], [105, 107], [336, 334], [334, 300],
  [70, 54], [300, 284], [70, 33], [107, 133], [336, 362], [300, 263],
  [107, 168], [336, 168],
  // mắt (2 hình thoi)
  [33, 159], [159, 133], [133, 145], [145, 33],
  [362, 386], [386, 263], [263, 374], [374, 362],
  [133, 168], [362, 168],
  // mũi
  [168, 4], [4, 98], [4, 327], [98, 327],
  // gò má nối mắt/mũi/miệng/hàm
  [33, 50], [145, 50], [50, 98], [50, 61], [50, 132],
  [263, 280], [374, 280], [280, 327], [280, 291], [280, 361],
  // miệng + nhân trung
  [61, 0], [0, 291], [291, 17], [17, 61], [4, 0],
  // cằm
  [17, 199], [199, 152], [61, 172], [291, 397],
];
export const FACE_VERTS = [...new Set(FACE_EDGES.flat())];

// Ánh xạ toạ độ chuẩn hoá của VIDEO (4:3) sang toạ độ MÀN HÌNH (object-cover, mirror)
// — thiếu bước này thì khung/lưới bị MÉO trên màn hình dọc.
export function mapFaceToScreen(f, video) {
  const vw = video?.videoWidth || 640, vh = video?.videoHeight || 480;
  const sw = window.innerWidth || 1, sh = window.innerHeight || 1;
  const scale = Math.max(sw / vw, sh / vh); // object-cover
  const dx = (sw - vw * scale) / 2, dy = (sh - vh * scale) / 2;
  const map = (nx, ny) => [1 - (nx * vw * scale + dx) / sw, (ny * vh * scale + dy) / sh]; // mirror X

  let box = null;
  if (f.box) {
    const [xRight, y1] = map(f.box.x, f.box.y);               // sau mirror: cạnh phải
    const [xLeft, y2] = map(f.box.x + f.box.w, f.box.y + f.box.h); // cạnh trái
    box = { x: xLeft, y: y1, w: xRight - xLeft, h: y2 - y1 };
  }
  let pts = null;
  if (f.mesh?.length) {
    pts = {};
    for (const i of FACE_VERTS) {
      const p = f.mesh[i];
      if (p) pts[i] = map(p[0], p[1]);
    }
  }
  return { box, pts };
}
