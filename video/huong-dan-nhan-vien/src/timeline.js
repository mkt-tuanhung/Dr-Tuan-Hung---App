// Tính mốc thời gian (frame) cho từng cảnh / từng câu từ script.json + timing.json (độ dài giọng đọc)
import script from './script.json';
import timing from './timing.json';
import shots from '../public/shots.json';

export const FPS = 30;
export const W = 1080;
export const H = 1920;

const SCENE_IN = 20;   // khoảng mở đầu mỗi cảnh (tiêu đề bay vào) trước câu đầu
const GAP = 9;         // nghỉ giữa các câu
const SCENE_OUT = 14;  // nghỉ cuối cảnh trước khi chuyển
const TITLE_IN = 30;

export const scenes = [];
let cursor = 0;
let chapterNo = 0;
const chapterTotal = script.scenes.filter(s => s.kind !== 'title').length;

for (const sc of script.scenes) {
  const isTitle = sc.kind === 'title';
  if (!isTitle) chapterNo += 1;
  let t = isTitle ? TITLE_IN : SCENE_IN;
  const lines = sc.lines.map((ln, i) => {
    const name = `${sc.id}-${i}`;
    const dur = Math.ceil((timing[name] || 3) * FPS);
    const line = { ...ln, name, start: t, dur, shot: ln.shot || sc.shot };
    t += dur + GAP;
    return line;
  });
  const duration = t - GAP + SCENE_OUT + (isTitle ? 20 : 0);
  scenes.push({ ...sc, isTitle, chapterNo, chapterTotal, from: cursor, duration, lines });
  cursor += duration;
}
export const TOTAL = cursor;

// Khoảng có giọng đọc (frame tuyệt đối) — để hạ nhỏ nhạc nền khi đang nói
export const voiceWindows = scenes.flatMap(sc => sc.lines.map(l => [sc.from + l.start, sc.from + l.start + l.dur]));

export const shotMeta = shots;
export const findBox = (shotId, focus) => {
  if (!focus) return null;
  if (typeof focus === 'object' && focus.box) { const [x, y, w, h] = focus.box; return { x, y, w, h }; }
  const m = shots[shotId];
  if (!m) return null;
  return m.boxes.find(b => b.key.startsWith(focus)) || null;
};
export const title = script.title;
export const subtitle = script.subtitle;
