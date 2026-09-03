// ============================================================
// MA SÓI — dữ liệu vai + design tokens (theo gói thiết kế
// TuanHung_CRM_MaSoi_DualMode_v2_ModernCute: config/design_tokens.json,
// config/roles.json, asset_manifest.json). UI render động từ đây,
// KHÔNG bake luật chơi vào hình ảnh.
// ============================================================

// Design tokens v2 — MODERN · CUTE · BRIGHT · SMART · CLEAN
export const WW = {
  navy: '#1E2A44',
  primary: '#2F5BFF',
  mint: '#67D7C9',
  lilac: '#C7B6FF',
  peach: '#FFD1A6',
  cream: '#FFF7E6',
  slate: '#7C8AA5',
  softBlue: '#E9F1FF',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F7FF',
  textPrimary: '#17213A',
  textSecondary: '#66738F',
  success: '#42C98B',
  warning: '#F3B84B',
  danger: '#EF6473',
  gold: '#F2C14E',
  // navy immersive (nền các màn trong game)
  nightTop: '#141E38',
  nightBottom: '#2A3A66',
};

const A = '/masoi';
export const MASCOT = `${A}/mascot.png`;
export const BG_LOBBY = `${A}/bg_lobby.png`;
export const ICONS = {
  qr: `${A}/icons/01_qr_scan.png`,
  join: `${A}/icons/02_join_room.png`,
  ready: `${A}/icons/03_ready.png`,
  start: `${A}/icons/04_start_game.png`,
  host: `${A}/icons/05_host.png`,
  players: `${A}/icons/06_players.png`,
  video: `${A}/icons/07_video.png`,
  night: `${A}/icons/10_night.png`,
  reveal: `${A}/icons/13_role_reveal.png`,
};

// roleColors từ design_tokens.json
export const ROLES = {
  wolf: {
    name: 'Sói', faction: 'Phe Sói', factionColor: '#EF6A63',
    color: '#EF6A63', bg: '#FFF0EE', border: '#FBC9C4',
    character: `${A}/characters/01_soi.png`, icon: `${A}/icons/14_role_wolf.png`,
    desc: 'Mỗi đêm cùng phe Sói chọn một người để loại.',
    goal: 'Loại bỏ hết Dân Làng mà không bị phát hiện.',
    night: 'Cùng bầy sói chọn một người để tấn công.',
    day: 'Giả vờ là dân làng — ẩn mình và đánh lạc hướng.',
    tip: 'Đừng im lặng quá — sói giỏi là sói nói chuyện tự nhiên nhất.',
  },
  villager: {
    name: 'Dân Làng', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#58BD85', bg: '#EAFBF2', border: '#BFEBD4',
    character: `${A}/characters/02_dan_lang.png`, icon: `${A}/icons/15_role_villager.png`,
    desc: 'Không có kỹ năng đặc biệt; thảo luận và tìm Sói.',
    goal: 'Tìm ra và loại bỏ hết Sói.',
    night: 'Ngủ ngon và cầu mong bình an.',
    day: 'Quan sát, suy luận và bỏ phiếu sáng suốt.',
    tip: 'Chú ý ai hay đổi lời khai — mâu thuẫn nhỏ lộ ra sói lớn.',
  },
  seer: {
    name: 'Tiên Tri', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#6E6DEB', bg: '#F0F0FF', border: '#D2D1FA',
    character: `${A}/characters/03_tien_tri.png`, icon: `${A}/icons/16_role_seer.png`,
    desc: 'Mỗi đêm kiểm tra một người có thuộc phe Sói hay không.',
    goal: 'Dùng khả năng soi để dẫn dắt phe Dân.',
    night: 'Chọn một người để biết họ là Sói hay không phải Sói.',
    day: 'Khéo léo gợi ý mà không để lộ mình quá sớm.',
    tip: 'Lộ vai sớm dễ bị sói cắn — hãy soi kín đáo vài đêm đầu.',
  },
  witch: {
    name: 'Phù Thủy', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#A064E8', bg: '#F7F0FF', border: '#E0CBF7',
    character: `${A}/characters/04_phu_thuy.png`, icon: `${A}/icons/17_role_witch.png`,
    desc: 'Có một bình Cứu và một bình Độc trong mỗi ván.',
    goal: 'Dùng thuốc Cứu và thuốc Độc đúng thời điểm.',
    night: 'Có thể CỨU nạn nhân của sói, hoặc ĐẦU ĐỘC một người. Mỗi bình chỉ dùng 1 lần.',
    day: 'Giữ bí mật những gì bạn biết từ đêm qua.',
    tip: 'Đừng vội dùng thuốc đêm đầu — để dành cho thời khắc quyết định.',
  },
  hunter: {
    name: 'Thợ Săn', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#47B99C', bg: '#EBFAF5', border: '#BFE9DC',
    character: `${A}/characters/05_tho_san.png`, icon: `${A}/icons/18_role_hunter.png`,
    desc: 'Khi bị loại, có thể chọn một người cùng bị loại.',
    goal: 'Kéo theo một kẻ đáng ngờ nếu bạn gục ngã.',
    night: 'Ngủ — nhưng cây cung luôn sẵn sàng.',
    day: 'Nếu bạn bị loại, được chọn 1 người "đi cùng".',
    tip: 'Ghi nhớ ai đáng nghi nhất mỗi ngày — phòng khi phải bắn gấp.',
  },
  guard: {
    name: 'Bảo Vệ', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#E5A93E', bg: '#FFF7E8', border: '#F5DFA8',
    character: `${A}/characters/06_bao_ve.png`, icon: `${A}/icons/19_role_guard.png`,
    desc: 'Mỗi đêm bảo vệ một người khỏi đòn tấn công của Sói.',
    goal: 'Che chở dân làng khỏi nanh vuốt của sói.',
    night: 'Chọn một người để bảo vệ (không bảo vệ 1 người 2 đêm liền).',
    day: 'Không ai biết đêm qua bạn đã cứu ai.',
    tip: 'Tự bảo vệ mình đêm đầu thường là nước đi an toàn.',
  },
  cupid: {
    name: 'Cupid', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#EE73A7', bg: '#FFF0F6', border: '#FBCBDE',
    character: `${A}/characters/07_cupid.png`, icon: `${A}/icons/20_role_cupid.png`,
    desc: 'Đầu ván ghép hai người thành cặp người yêu.',
    goal: 'Cặp đôi của bạn sống chết có nhau.',
    night: 'ĐÊM ĐẦU TIÊN: chọn 2 người thành một cặp. Một người chết, người kia chết theo.',
    day: 'Quan sát cặp đôi của mình và bảo vệ họ khéo léo.',
    tip: 'Ghép sói với dân sẽ tạo ra phe thứ ba đầy kịch tính.',
  },
  mayor: {
    name: 'Trưởng Làng', faction: 'Phe Dân', factionColor: '#58BD85',
    color: '#D99A35', bg: '#FCF4E4', border: '#F0DBAE',
    character: `${A}/characters/08_truong_lang.png`, icon: `${A}/icons/21_role_mayor.png`,
    desc: 'Phiếu bầu ban ngày có trọng số 2.',
    goal: 'Dẫn dắt dân làng bằng lá phiếu nặng ký.',
    night: 'Ngủ ngon giấc như một người lãnh đạo.',
    day: 'Phiếu bầu của bạn được tính GẤP ĐÔI.',
    tip: 'Uy tín là vũ khí — nói ít nhưng chuẩn.',
  },
};

// Cơ cấu vai theo số người — theo recommendedCompositions trong config/roles.json
// (6/7/8/9/10/12); 4–5 người chơi bản rút gọn, 11 và 13+ nội suy thêm Dân Làng.
// PHẢI khớp hàm server ww_start_room trong supabase/werewolf.sql.
export function composition(n) {
  let c;
  if (n <= 4) c = { wolf: 1, seer: 1 };
  else if (n === 5) c = { wolf: 1, seer: 1, guard: 1 };
  else if (n === 6) c = { wolf: 2, seer: 1, guard: 1 };
  else if (n === 7) c = { wolf: 2, seer: 1, witch: 1, guard: 1 };
  else if (n === 8) c = { wolf: 2, seer: 1, witch: 1, hunter: 1, guard: 1 };
  else if (n === 9) c = { wolf: 2, seer: 1, witch: 1, hunter: 1, guard: 1 };
  else if (n <= 11) c = { wolf: 3, seer: 1, witch: 1, hunter: 1, guard: 1, cupid: 1 };
  else c = { wolf: 3, seer: 1, witch: 1, hunter: 1, guard: 1, cupid: 1, mayor: 1 };
  const special = Object.values(c).reduce((s, x) => s + x, 0);
  if (n > special) c.villager = n - special;
  return c;
}

// Avatar thú cho người chơi trong lobby (theo mockup): host = Sói đeo kính,
// người khác lần lượt các thú còn lại theo thứ tự vào phòng.
export const AVATARS = [
  `${A}/characters/02_dan_lang.png`,
  `${A}/characters/04_phu_thuy.png`,
  `${A}/characters/06_bao_ve.png`,
  `${A}/characters/07_cupid.png`,
  `${A}/characters/05_tho_san.png`,
  `${A}/characters/03_tien_tri.png`,
  `${A}/characters/08_truong_lang.png`,
  `${A}/characters/01_soi.png`,
];
