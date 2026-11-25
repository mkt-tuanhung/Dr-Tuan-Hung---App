// ============================================================
// ADMIN gửi (lại) ảnh chấm công + lời nhắn vào NHÓM TELEGRAM CHẤM CÔNG bằng BOT hệ thống.
// Mở từ cửa sổ "Chấm công" (Quản lý chấm công → bấm ô công của 1 nhân sự).
//   - Chọn lượt Check-in / Check-out → tự điền thẻ giống tin bot gửi lúc quét mặt
//   - Ảnh: mặc định ảnh chụp lúc chấm công; có thể chọn ảnh khác (vd ảnh đã chỉnh)
//   - Lời nhắn của admin → thêm dòng "📣 Admin: …"
// Máy chủ: supabase/functions/attendance-tg-send (chỉ admin gọi được).
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send, ImagePlus, X, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export const ROLE_VI = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', truc_page: 'Trực Page',
  media: 'Media', marketing: 'Marketing', editor: 'Editor', seeding: 'Seeding',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin', bac_si: 'Bác sĩ',
};

const MAX_CAPTION = 1024; // giới hạn chú thích ảnh của Telegram

// Thẻ giống hệt attendanceCard() trong supabase/functions/face-attendance
export function buildAttendanceCard({ kind, name, roleTxt, time, date }) {
  const [yy, mm, dd] = String(date || '').split('-');
  return [
    kind === 'CHECK_IN' ? '✅ CHECK-IN THÀNH CÔNG' : '🚪 CHECK-OUT THÀNH CÔNG',
    `👤 ${name || 'Nhân sự'}`,
    `🏢 ${roleTxt || '—'}`,
    `🕒 ${time ? String(time).slice(0, 8) : '—'} — ${dd}/${mm}/${yy}`,
  ].join('\n');
}

// Ảnh người dùng chọn (webp/heic/png…) → JPEG ≤ 2048px để Telegram nhận chắc chắn
async function toJpeg(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Không đọc được ảnh');
  return blob;
}

// Lấy câu lỗi thật từ Edge Function (supabase-js gói lỗi HTTP vào error.context)
async function fnError(error, data) {
  if (data?.error) return data.error;
  try { const j = await error?.context?.json(); if (j?.error) return j.error; } catch { /* bỏ qua */ }
  return error?.message || 'Gửi thất bại';
}

export default function AttendanceTgSendModal({ info, onClose }) {
  // info: { staffName, roleTxt, date, check_in, check_out, check_in_photo, check_out_photo }
  const [kind, setKind] = useState(info.check_out ? 'CHECK_OUT' : 'CHECK_IN');
  const autoCard = useMemo(() => buildAttendanceCard({
    kind, name: info.staffName, roleTxt: info.roleTxt, date: info.date,
    time: kind === 'CHECK_IN' ? info.check_in : info.check_out,
  }), [kind, info]);
  const [card, setCard] = useState(autoCard);
  const [cardEdited, setCardEdited] = useState(false);
  useEffect(() => { if (!cardEdited) setCard(autoCard); }, [autoCard, cardEdited]);

  const [adminMsg, setAdminMsg] = useState('');
  const [file, setFile] = useState(null);          // ảnh admin chọn thay
  const [noPhoto, setNoPhoto] = useState(false);   // gửi chữ, không kèm ảnh
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const defaultPhoto = kind === 'CHECK_IN' ? info.check_in_photo : info.check_out_photo;
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);
  const previewSrc = noPhoto ? null : (filePreview || defaultPhoto || null);

  const caption = (card.trim() + (adminMsg.trim() ? `\n\n📣 Admin: ${adminMsg.trim()}` : '')).trim();
  const tooLong = caption.length > MAX_CAPTION;

  const send = async () => {
    if (!caption && !previewSrc) { toast.error('Chưa có ảnh hay nội dung'); return; }
    if (tooLong) { toast.error(`Nội dung dài ${caption.length} ký tự, tối đa ${MAX_CAPTION}`); return; }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('caption', caption);
      if (!noPhoto) {
        if (file) fd.append('photo', await toJpeg(file), 'cham-cong.jpg');
        else if (defaultPhoto) fd.append('photo_url', defaultPhoto);
      }
      const { data, error } = await supabase.functions.invoke('attendance-tg-send', { body: fd });
      if (error || !data?.ok) throw new Error(await fnError(error, data));
      toast.success('Đã gửi vào nhóm Chấm Công');
      onClose();
    } catch (e) {
      toast.error('Gửi Telegram: ' + (e.message || e));
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[110] flex items-center justify-center p-4">
      <div className="e-modal max-w-sm w-full p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="e-modal-title">Gửi vào nhóm Chấm Công</h3>
            <p className="text-[12.5px] text-slate-500 mt-0.5">Gửi bằng bot hệ thống (tư cách Admin)</p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} className="e-icon-btn w-8 h-8" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4 mt-4 pt-3 border-t border-slate-100">
          <div className="e-seg w-full" role="tablist">
            {['CHECK_IN', 'CHECK_OUT'].map(k => (
              <button key={k} type="button" role="tab" aria-selected={kind === k}
                onClick={() => { setKind(k); setFile(null); }}
                className={`e-seg-item flex-1 ${kind === k ? 'e-seg-active' : ''}`}>
                {k === 'CHECK_IN' ? 'Check-in' : 'Check-out'}
              </button>
            ))}
          </div>

          <div>
            <label className="e-label">Ảnh</label>
            {previewSrc ? (
              <img src={previewSrc} alt="Ảnh gửi vào nhóm" className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-slate-50" />
            ) : (
              <div className="h-24 rounded-lg border border-dashed border-slate-300 grid place-items-center text-[12.5px] text-slate-400">
                <span className="flex items-center gap-1.5"><ImageOff className="w-4 h-4" />{noPhoto ? 'Chỉ gửi chữ' : 'Lượt này chưa có ảnh'}</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setNoPhoto(false); } e.target.value = ''; }} />
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="e-btn e-btn-secondary e-btn-sm"><ImagePlus className="w-3.5 h-3.5" />Chọn ảnh khác</button>
              {file && <button type="button" onClick={() => setFile(null)} className="e-btn e-btn-ghost e-btn-sm">Dùng ảnh chấm công</button>}
              {(file || defaultPhoto) && (
                <button type="button" onClick={() => setNoPhoto(v => !v)} className="e-btn e-btn-ghost e-btn-sm">{noPhoto ? 'Gửi kèm ảnh' : 'Không gửi ảnh'}</button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="e-label">Nội dung thẻ</label>
              {cardEdited && <button type="button" onClick={() => setCardEdited(false)} className="text-[12px] text-teal-700 font-medium">Điền lại tự động</button>}
            </div>
            <textarea value={card} rows={5} onChange={e => { setCard(e.target.value); setCardEdited(true); }}
              className="e-textarea font-mono text-[12.5px]" />
          </div>

          <div>
            <label className="e-label">Lời nhắn của Admin</label>
            <textarea value={adminMsg} rows={2} onChange={e => setAdminMsg(e.target.value)}
              className="e-textarea resize-none" placeholder="VD: Huyền ơi, hôm nay xinh quá" />
            <p className={`text-[11.5px] mt-1 tabular-nums ${tooLong ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{caption.length}/{MAX_CAPTION} ký tự</p>
          </div>
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} disabled={sending} className="e-btn e-btn-secondary flex-1">Hủy</button>
          <button type="button" onClick={send} disabled={sending || tooLong} className="e-btn e-btn-primary flex-1">
            <Send className="w-4 h-4" />{sending ? 'Đang gửi…' : 'Gửi vào nhóm'}
          </button>
        </div>
      </div>
    </div>
  );
}
