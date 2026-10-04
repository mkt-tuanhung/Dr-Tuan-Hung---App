// ============================================================
// Tiện ích cho LỊCH HẸN dạng lịch (Ethics BOS): ngày, giờ, màu, xếp làn.
// Ngày luôn xử lý theo chuỗi 'YYYY-MM-DD' giờ ĐỊA PHƯƠNG (tránh lệch múi giờ).
// ============================================================

export const pad2 = (n) => String(n).padStart(2, '0');
export const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseYMD = (s) => {
  const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameYMD = (a, b) => toYMD(a) === toYMD(b);

// Thứ 2 đầu tuần
export const startOfWeek = (d) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; };
export const weekDays = (d) => { const s = startOfWeek(d); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };

// Lưới tháng 6 tuần x 7 ngày (bắt đầu Thứ 2) — giống lịch mini Ethics BOS
export const monthGrid = (d) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

export const WD_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const wdLabel = (d) => WD_SHORT[(d.getDay() + 6) % 7];

// 'HH:MM' | 'HH:MM:SS' -> phút trong ngày (null nếu không có giờ)
export const timeToMin = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const minToTime = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

// Lịch tư vấn mặc định 60', tái khám 30' (DB chỉ lưu giờ bắt đầu)
export const isRecheck = (app) => String(app?.service || '').startsWith('[Tái khám]');
export const durationOf = (app) => (isRecheck(app) ? 30 : 60);

// Màu khối lịch theo TRẠNG THÁI (pastel nền + viền trái đậm, kiểu Ethics BOS)
export const APPT_TONE = {
  scheduled: { label: 'Chờ tư vấn', bg: '#FDF4E7', bar: '#E5A13C', text: '#7A4E0E', dot: '#E5A13C' },
  coc:       { label: 'Đã cọc',     bg: '#E9F0FB', bar: '#5B8DD6', text: '#24487E', dot: '#5B8DD6' },
  phau_thuat:{ label: 'Phẫu thuật', bg: '#E4F1EF', bar: '#468A86', text: '#284D4B', dot: '#468A86' },
  bong:      { label: 'Khách bong', bg: '#FBECEC', bar: '#D9635C', text: '#7E2723', dot: '#D9635C' },
  cancelled: { label: 'Đã huỷ',     bg: '#EEF2F2', bar: '#97A4A5', text: '#4E5C5E', dot: '#97A4A5' },
  recheck:   { label: 'Tái khám',   bg: '#EFEBFA', bar: '#8B7BD8', text: '#3F3478', dot: '#8B7BD8' },
};
export const toneOf = (app) => (isRecheck(app) ? APPT_TONE.recheck : (APPT_TONE[app?.status] || APPT_TONE.scheduled));

// Màu nhận diện nhân sự (ô tick trong bộ lọc, chấm cột)
export const STAFF_COLORS = ['#8B7BD8', '#D9635C', '#5B8DD6', '#5BAE7B', '#E5A13C', '#3FA7A2', '#C46FB0', '#8A9A5B', '#D98A4E', '#6C7FD8'];

// Xếp các lịch chồng giờ trong CÙNG một cột thành các làn song song.
// Trả về [{ app, start, end, lane, lanes }]
export const layoutLanes = (apps) => {
  const items = apps
    .map(app => {
      const start = timeToMin(app.appointment_time);
      return { app, start: start ?? 0, end: (start ?? 0) + durationOf(app) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds = [];
    cluster.forEach(it => {
      let lane = laneEnds.findIndex(e => e <= it.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.end); } else laneEnds[lane] = it.end;
      it.lane = lane;
    });
    const cStart = cluster[0].start;
    const cEnd = Math.max(...cluster.map(c => c.end));
    const cid = out.length ? out[out.length - 1].cluster + 1 : 0; // cùng 1 mã cho cả cụm
    cluster.forEach(it => { it.lanes = laneEnds.length; it.cluster = cid; it.cStart = cStart; it.cEnd = cEnd; out.push(it); });
    cluster = []; clusterEnd = -1;
  };
  items.forEach(it => {
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  });
  if (cluster.length) flush();
  return out;
};

export const fmtMonthTitle = (d) => `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
export const fmtDayTitle = (d) => `${wdLabel(d) === 'CN' ? 'Chủ nhật' : 'Thứ ' + (((d.getDay() + 6) % 7) + 2)}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const fmtVND = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
