// ============================================================
// MA SÓI — cấu hình vai (UI load từ đây, KHÔNG hardcode trong component)
// Khớp với vai server chia trong supabase/werewolf.sql (ww_start_room)
// ============================================================
import { PawPrint, Home, Eye, FlaskConical, Target, Shield, Heart, Crown } from 'lucide-react';
import { CharWolf, CharDog, CharOwl, CharCat, CharFox, CharBear, CharRabbit, CharDeer } from './wwCharacters';

// Design tokens — MODERN · CUTE · BRIGHT (theo art direction v2)
export const WW = {
  navy: '#1E2A44',
  blue: '#2F5BFF',
  mint: '#67D7C9',
  lilac: '#C7B6FF',
  peach: '#FFD1A6',
  cream: '#FFF7E6',
  slate: '#7C8AA5',
  softBlue: '#E9F1FF',
  gold: '#F2C14E',
};

export const ROLES = {
  wolf: {
    name: 'Sói', faction: 'Phe Sói', factionColor: '#E85C50',
    color: '#FF7A6E', bg: '#FFF0EE', border: '#FFC9C2',
    icon: PawPrint, Character: CharWolf,
    desc: 'Kẻ săn đêm tinh ranh của ngôi làng.',
    goal: 'Loại bỏ tất cả Dân Làng.',
    night: 'Cùng bầy sói chọn một người để tấn công.',
    day: 'Ẩn mình, đánh lạc hướng và đổ nghi ngờ cho người khác.',
    tip: 'Đừng im lặng quá — sói giỏi là sói nói chuyện tự nhiên nhất.',
  },
  villager: {
    name: 'Dân Làng', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#5BC8A8', bg: '#EAFBF4', border: '#BFEBDC',
    icon: Home, Character: CharDog,
    desc: 'Người dân lương thiện, lạc quan của làng.',
    goal: 'Tìm ra và loại bỏ hết Sói.',
    night: 'Ngủ ngon và cầu mong bình an.',
    day: 'Quan sát, suy luận và bỏ phiếu sáng suốt.',
    tip: 'Chú ý ai hay đổi lời khai — mâu thuẫn nhỏ lộ ra sói lớn.',
  },
  seer: {
    name: 'Tiên Tri', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#8F79E8', bg: '#F3EFFF', border: '#D9CDFB',
    icon: Eye, Character: CharOwl,
    desc: 'Cú mèo thông thái nhìn thấu màn đêm.',
    goal: 'Dùng khả năng soi để dẫn dắt phe Dân.',
    night: 'Chọn một người để biết họ là Sói hay Dân.',
    day: 'Khéo léo gợi ý mà không để lộ mình quá sớm.',
    tip: 'Lộ vai sớm dễ bị sói cắn — hãy soi kín đáo vài đêm đầu.',
  },
  witch: {
    name: 'Phù Thủy', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#B06AD8', bg: '#F9F0FF', border: '#E4CBF5',
    icon: FlaskConical, Character: CharCat,
    desc: 'Mèo phù thủy với hai bình thuốc quyền năng.',
    goal: 'Dùng thuốc cứu và thuốc độc đúng thời điểm.',
    night: 'Có thể CỨU nạn nhân của sói, hoặc ĐẦU ĐỘC một người. Mỗi bình chỉ dùng 1 lần.',
    day: 'Giữ bí mật về những gì bạn biết từ đêm qua.',
    tip: 'Đừng vội dùng thuốc đêm đầu — để dành cho thời khắc quyết định.',
  },
  hunter: {
    name: 'Thợ Săn', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#3AA88F', bg: '#EBF9F5', border: '#BFE8DD',
    icon: Target, Character: CharFox,
    desc: 'Cáo thợ săn gan dạ, phát cuối cùng luôn trúng đích.',
    goal: 'Khi bị loại, kéo theo một người mà bạn nghi là Sói.',
    night: 'Ngủ — nhưng cây cung luôn sẵn sàng.',
    day: 'Nếu bạn bị loại, được chọn 1 người "đi cùng".',
    tip: 'Ghi nhớ ai đáng nghi nhất mỗi ngày — phòng khi phải bắn gấp.',
  },
  guard: {
    name: 'Bảo Vệ', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#E4A93C', bg: '#FFF8EA', border: '#F5DFA8',
    icon: Shield, Character: CharBear,
    desc: 'Gấu bảo vệ đáng tin cậy với tấm khiên vàng.',
    goal: 'Bảo vệ dân làng khỏi nanh vuốt của sói.',
    night: 'Chọn một người để bảo vệ (không được bảo vệ 1 người 2 đêm liền).',
    day: 'Không ai biết đêm qua bạn đã cứu ai.',
    tip: 'Tự bảo vệ mình đêm đầu thường là nước đi an toàn.',
  },
  cupid: {
    name: 'Cupid', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#F06FA0', bg: '#FFF0F6', border: '#FBCBDE',
    icon: Heart, Character: CharRabbit,
    desc: 'Thỏ cupid gieo mối tơ duyên định mệnh.',
    goal: 'Ghép đôi 2 người — họ sống chết có nhau.',
    night: 'ĐÊM ĐẦU TIÊN: chọn 2 người thành một cặp. Một người chết, người kia chết theo.',
    day: 'Quan sát cặp đôi của mình và bảo vệ họ khéo léo.',
    tip: 'Ghép sói với dân sẽ tạo ra phe thứ ba đầy kịch tính.',
  },
  mayor: {
    name: 'Trưởng Làng', faction: 'Phe Dân', factionColor: '#2E9E7E',
    color: '#E8913C', bg: '#FFF5EB', border: '#F7D7B2',
    icon: Crown, Character: CharDeer,
    desc: 'Hươu trưởng làng uy nghiêm được mọi người tín nhiệm.',
    goal: 'Dẫn dắt dân làng bằng lá phiếu nặng ký.',
    night: 'Ngủ ngon giấc như một người lãnh đạo.',
    day: 'Phiếu bầu của bạn được tính GẤP ĐÔI.',
    tip: 'Uy tín là vũ khí — nói ít nhưng chuẩn.',
  },
};

// Cơ cấu vai theo số người (hiển thị ở lobby — khớp server ww_start_room)
export function composition(n) {
  const c = { wolf: 1, seer: 1 };
  if (n >= 8) c.wolf = 2;
  if (n >= 12) c.wolf = 3;
  if (n >= 6) c.witch = 1;
  if (n >= 7) c.guard = 1;
  if (n >= 8) c.hunter = 1;
  if (n >= 9) c.mayor = 1;
  if (n >= 10) c.cupid = 1;
  const special = Object.values(c).reduce((s, x) => s + x, 0);
  if (n > special) c.villager = n - special;
  return c;
}
