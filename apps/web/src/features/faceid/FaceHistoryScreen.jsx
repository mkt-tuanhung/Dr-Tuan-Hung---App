// ============================================================
// MÀN 06 — Lịch sử chấm công Face AI.
// Nguồn dữ liệu THẬT: bảng face_attendance_audit (mỗi lượt quét gửi lên server,
// gồm cả lượt bị từ chối) — RLS chỉ cho nhân sự xem lượt của chính mình.
// Ảnh = snapshot_url thật đã lưu lúc quét; không có ảnh thì hiện biểu tượng, không dùng ảnh minh hoạ.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Filter, ScanFace, ChevronRight, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { vnToday } from '@/lib/vnTime';
import './faceV2.css';

const ERR_TEXT = {
  FACE_NOT_MATCHED: 'Khuôn mặt không khớp',
  LIVENESS_FAILED: 'Không xác minh được người thật',
  FACE_NOT_ENROLLED: 'Chưa đăng ký / cần đăng ký lại',
  FACE_BLURRY: 'Ảnh khuôn mặt chưa rõ',
  GPS_NOT_ALLOWED: 'Vị trí không hợp lệ',
  WIFI_NOT_VERIFIED: 'Wi‑Fi không hợp lệ',
  CRM_REJECTED: 'Không được chấp nhận',
  UNAUTHORIZED: 'Phiên đăng nhập hết hạn',
};

// Ngày (YYYY-MM-DD, giờ VN) -> khoảng thời gian UTC để lọc created_at
const dayRange = (ymd) => {
  const start = new Date(`${ymd}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return [start.toISOString(), end.toISOString()];
};
const timeVN = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateVN = (iso) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });

export default function FaceHistoryScreen({ profile, onClose }) {
  const [day, setDay] = useState(vnToday());
  const [kind, setKind] = useState('all'); // all | CHECK_IN | CHECK_OUT
  const [rows, setRows] = useState(null);  // null = đang tải
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(null);
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setRows(null); setErr(null);
    const [from, to] = dayRange(day);
    const { data, error } = await supabase.from('face_attendance_audit')
      .select('id, action, result, error_code, match_score, liveness_method, snapshot_url, created_at, result_json')
      .eq('user_id', profile.id)
      .gte('created_at', from).lt('created_at', to)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { setErr(error.message); setRows([]); return; }
    setRows(data || []);
  }, [profile?.id, day]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => (rows || []).filter((r) => kind === 'all' || r.action === kind), [rows, kind]);
  const okCount = list.filter((r) => r.result === 'ACCEPTED').length;
  const failCount = list.length - okCount;

  return (
    <div className="fv2-screen fv2-history">
      <div className="fv2-top">
        <button type="button" className="fv2-icon-btn" onClick={onClose} aria-label="Quay lại"><ArrowLeft /></button>
        <h1>Lịch sử chấm công Face AI</h1>
        <button type="button" className="fv2-icon-btn" onClick={load} aria-label="Tải lại"><RefreshCw /></button>
      </div>
      <div className="fv2-hist-body">
        <div className="max-w-xl mx-auto pb-[max(env(safe-area-inset-bottom),20px)]">
          <div className="fv2-toolbar">
            <label className="fv2-field">
              <CalendarDays />
              <input type="date" value={day} max={vnToday()} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Chọn ngày" />
            </label>
            <label className="fv2-field" style={{ flex: '0 0 42%' }}>
              <Filter />
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Loại chấm công">
                <option value="all">Tất cả lượt</option>
                <option value="CHECK_IN">Check-in</option>
                <option value="CHECK_OUT">Check-out</option>
              </select>
            </label>
          </div>

          <div className="fv2-stats">
            <div className="fv2-stat"><b>{rows ? list.length : '–'}</b><small>Lượt chấm công</small></div>
            <div className="fv2-stat good"><b>{rows ? okCount : '–'}</b><small>Thành công</small></div>
            <div className="fv2-stat bad"><b>{rows ? failCount : '–'}</b><small>Thất bại</small></div>
          </div>

          {rows === null ? (
            <div className="fv2-empty"><span className="fv2-spin inline-block align-middle" style={{ borderColor: '#CDE9EA', borderTopColor: '#08A39F' }} /></div>
          ) : err ? (
            <div className="fv2-empty">Không tải được lịch sử: {err}</div>
          ) : list.length === 0 ? (
            <div className="fv2-empty">Không có lượt chấm công Face AI nào trong ngày {dateVN(`${day}T05:00:00Z`)}.</div>
          ) : list.map((r) => {
            const ok = r.result === 'ACCEPTED';
            const isOpen = open === r.id;
            const reason = r.result_json?.message || ERR_TEXT[r.error_code] || (r.result === 'ERROR' ? 'Lỗi hệ thống' : null);
            return (
              <div key={r.id} className="fv2-entry" data-open={isOpen}>
                <button type="button" className="fv2-entry-main w-full text-left" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                  {r.snapshot_url
                    ? <img className="fv2-entry-photo" src={r.snapshot_url} alt="Ảnh chấm công" loading="lazy" />
                    : <span className="fv2-entry-photo"><ScanFace /></span>}
                  <span className="fv2-entry-text">
                    <b>{profile?.full_name || 'Tôi'}</b>
                    <small>{timeVN(r.created_at)} · {dateVN(r.created_at)}</small>
                    <span className={`fv2-tag ${r.action === 'CHECK_OUT' ? 'fv2-tag-out' : 'fv2-tag-in'}`}>{r.action === 'CHECK_OUT' ? 'Check-out' : 'Check-in'}</span>
                  </span>
                  <span className={`fv2-result ${ok ? 'ok' : 'fail'}`}>{ok ? 'Thành công' : 'Thất bại'}</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                {isOpen && (
                  <div className="fv2-entry-more">
                    {r.snapshot_url && (
                      <button type="button" onClick={() => setViewer(r.snapshot_url)} aria-label="Xem ảnh lớn" className="shrink-0">
                        <img src={r.snapshot_url} alt="Ảnh chấm công" />
                      </button>
                    )}
                    <div className="kv">
                      <div>Kết quả: <b>{ok ? (r.result_json?.repeated ? 'Đã ghi nhận trước đó' : 'Đã ghi nhận') : (reason || 'Thất bại')}</b></div>
                      {ok && r.result_json?.time && <div>Giờ ghi công: <b>{String(r.result_json.time).slice(0, 5)}</b></div>}
                      {r.match_score != null && <div>Độ khớp khuôn mặt: <b>{Math.round(Number(r.match_score) * 100)}%</b></div>}
                      {ok && Number(r.result_json?.lateMinutes) > 0 && <div>Đi muộn: <b>{r.result_json.lateMinutes} phút</b></div>}
                      {r.result_json?.locationWarning && <div>Vị trí: <b>{r.result_json.locationWarning}</b></div>}
                      {r.snapshot_url && <div className="mt-1 text-teal-700 font-semibold">Chạm ảnh để xem lớn</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {viewer && (
        <div className="fv2-viewer" onClick={() => setViewer(null)} role="dialog" aria-label="Ảnh chấm công">
          <button type="button" className="fv2-icon-btn absolute top-[max(env(safe-area-inset-top),14px)] right-3 text-white bg-white/10" aria-label="Đóng"><X /></button>
          <img src={viewer} alt="Ảnh chấm công" />
        </div>
      )}
    </div>
  );
}
