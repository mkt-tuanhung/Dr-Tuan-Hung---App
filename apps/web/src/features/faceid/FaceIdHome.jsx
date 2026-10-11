// ============================================================
// MÀN 01 — Tổng quan chấm công Face AI (giao diện v2, phong cách Ethics BOS đã duyệt).
// Banner động: chân dung minh hoạ + vòng HUD xoay + tia quét + lưới sáng + sóng (CSS/SVG).
// Các điểm/lưới trên banner chỉ để trang trí, KHÔNG phải nhận diện thật.
// 4 thẻ: Check-in · Check-out · Lịch sử chấm công · Thiết lập Face ID — đều gọi
// đúng luồng cũ (FaceCameraScreen action CHECK_IN / CHECK_OUT, FaceEnrollScreen).
// ============================================================
import React from 'react';
import { LogIn, LogOut, History, Settings, ChevronRight, ShieldCheck } from 'lucide-react';
import './faceV2.css';

// Toạ độ lưới trang trí khớp riêng ảnh /faceid/hero-portrait.webp (1200x600) — không dùng cho camera thật
const ROWS = [
  [[650, 236], [705, 178], [756, 155], [807, 163], [848, 198]],
  [[625, 275], [685, 257], [742, 248], [800, 250], [865, 272]],
  [[620, 318], [677, 309], [738, 303], [790, 316], [886, 321]],
  [[631, 366], [684, 358], [738, 354], [787, 365], [861, 368]],
  [[660, 412], [701, 408], [753, 411], [790, 416], [837, 415]],
  [[697, 459], [731, 477], [781, 478], [813, 456]],
];
const POINTS = ROWS.flat();
const LINES = [];
ROWS.forEach((r, i) => r.forEach((p, j) => {
  if (j < r.length - 1) LINES.push([p, r[j + 1]]);
  const n = ROWS[i + 1];
  if (n) { const k = Math.round((j * (n.length - 1)) / Math.max(r.length - 1, 1)); LINES.push([p, n[k]]); }
}));

export function FaceHeroBanner({ now, title = 'Chấm công Face AI' }) {
  const t = now ? now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  const d = now ? now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }) : null;
  return (
    <section className="fv2-hero" aria-label={title}>
      <img className="fv2-hero-photo" src="/faceid/hero-portrait.webp" alt="" aria-hidden="true" />
      <span className="fv2-hero-shade" aria-hidden="true" />
      <span className="fv2-hero-rings" aria-hidden="true" />
      <span className="fv2-hero-rings r2" aria-hidden="true" />
      <svg className="fv2-hero-mesh" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g>{LINES.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />)}</g>
        <g>{POINTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 3.4 : 2.1} style={{ animationDelay: `${(i % 7) * -0.31}s` }} />)}</g>
      </svg>
      <span className="fv2-hero-beam" aria-hidden="true" />
      <span className="fv2-hero-wave" aria-hidden="true" />
      <span className="fv2-hero-glint" aria-hidden="true" />
      <div className="fv2-hero-copy">
        <h2>{title}</h2>
        <p className="fv2-hero-tag">Nhanh chóng • Chính xác • Bảo mật</p>
        <p className="fv2-hero-desc">Ứng dụng trí tuệ nhân tạo trong quản lý nhân sự y tế</p>
        {t && <span className="fv2-hero-clock"><i />{t} · <span className="capitalize">{d}</span></span>}
      </div>
    </section>
  );
}

const fmt = (t) => (t ? String(t).slice(0, 5) : null);

/**
 * faceStatus: undefined = đang tải · null = chưa đăng ký · { status: 'ACTIVE' | 'NEEDS_REENROLLMENT' | ... }
 * todayRecord: bản ghi attendance hôm nay (dữ liệu thật) — quyết định trạng thái 2 thẻ Check-in/Check-out
 * theo đúng nghiệp vụ cũ: chưa vào -> Check-in; đã vào -> Check-out (quét lại để cập nhật giờ ra).
 */
export default function FaceIdHome({ now, faceStatus, todayRecord, loading, onCheckIn, onCheckOut, onHistory, onSetup }) {
  const ready = faceStatus?.status === 'ACTIVE';
  const inT = fmt(todayRecord?.check_in);
  const outT = fmt(todayRecord?.check_out);
  const busy = loading || faceStatus === undefined;

  const setupSub = faceStatus === undefined ? 'Đang kiểm tra…'
    : ready ? 'Đã kích hoạt · Quản lý khuôn mặt'
      : faceStatus?.status === 'NEEDS_REENROLLMENT' ? 'Cần đăng ký lại khuôn mặt'
        : 'Chưa thiết lập · Đăng ký để chấm công';

  return (
    <div className="fv2 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-5 lg:items-start">
      <FaceHeroBanner now={now} />
      <div className="fv2-actions">
        <button type="button" className="fv2-action" onClick={onCheckIn} disabled={busy || !!inT}
          aria-label={inT ? `Đã check-in lúc ${inT}` : 'Check-in, chấm công vào'}>
          <span className="fv2-action-icon fv2-i-teal"><LogIn /></span>
          <span className="fv2-action-text">
            <b>Check-in {inT && <span className="fv2-pill fv2-pill-ok">Đã vào {inT}</span>}</b>
            <small>{inT ? 'Bạn đã chấm công vào hôm nay' : ready ? 'Chấm công vào · quét ~1 giây' : 'Chấm công vào · cần thiết lập Face ID'}</small>
          </span>
          <ChevronRight className="fv2-action-chev" />
        </button>
        <button type="button" className="fv2-action" onClick={onCheckOut} disabled={busy || !inT}
          aria-label={!inT ? 'Check-out, cần check-in trước' : outT ? `Cập nhật giờ ra, đã ra lúc ${outT}` : 'Check-out, chấm công ra'}>
          <span className="fv2-action-icon fv2-i-blue"><LogOut /></span>
          <span className="fv2-action-text">
            <b>Check-out {outT && <span className="fv2-pill fv2-pill-ok">Đã ra {outT}</span>}</b>
            <small>{!inT ? 'Chấm công ra · cần check-in trước' : outT ? 'Quét lại khi về để cập nhật giờ ra' : 'Chấm công ra'}</small>
          </span>
          <ChevronRight className="fv2-action-chev" />
        </button>
        <button type="button" className="fv2-action" onClick={onHistory}>
          <span className="fv2-action-icon fv2-i-indigo"><History /></span>
          <span className="fv2-action-text">
            <b>Lịch sử chấm công</b>
            <small>Xem lịch sử và ảnh chấm công</small>
          </span>
          <ChevronRight className="fv2-action-chev" />
        </button>
        <button type="button" className="fv2-action" onClick={onSetup}>
          <span className="fv2-action-icon fv2-i-sea"><Settings /></span>
          <span className="fv2-action-text">
            <b>Thiết lập Face ID {ready
              ? <span className="fv2-pill fv2-pill-ok">Đã kích hoạt</span>
              : faceStatus !== undefined && <span className="fv2-pill fv2-pill-warn">{faceStatus?.status === 'NEEDS_REENROLLMENT' ? 'Đăng ký lại' : 'Chưa có'}</span>}</b>
            <small>{setupSub}</small>
          </span>
          <ChevronRight className="fv2-action-chev" />
        </button>
        <div className="fv2-info">
          <span className="fv2-info-icon"><ShieldCheck className="w-6 h-6" /></span>
          <span>
            <b>Ảnh chấm công được lưu an toàn</b>
            <small>Mỗi lượt quét chụp 1 ảnh làm bằng chứng, lưu trên máy chủ của phòng khám và báo về nhóm chấm công.</small>
          </span>
        </div>
      </div>
    </div>
  );
}
