// ============================================================
// QUẢN LÝ FACE ID (admin) — tab trong Chấm công & Nghỉ phép.
// Xem trạng thái đăng ký khuôn mặt của toàn bộ nhân sự và:
//   • Bắt đăng ký lại  -> status NEEDS_REENROLLMENT: nhân sự phải đăng ký
//     lại mới chấm công Face được (app tự hiện "Cần đăng ký lại Face ID")
//   • Khóa / Mở khóa   -> DISABLED: chặn hẳn chấm công Face của người đó
//   • Xóa Face ID      -> xóa vĩnh viễn template (đăng ký lại từ đầu)
// RLS đã giới hạn: chỉ admin thấy tất cả & được sửa status/xóa.
// Không ai (kể cả admin) đọc được template sinh trắc học.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { ScanFace, RefreshCw, Trash2, Lock, Unlock, Search } from 'lucide-react';

const CHIP = {
  ACTIVE: { label: 'Đã kích hoạt', cls: 'bg-teal-100 text-teal-700' },
  NEEDS_REENROLLMENT: { label: 'Chờ đăng ký lại', cls: 'bg-amber-100 text-amber-700' },
  DISABLED: { label: 'Đã khóa', cls: 'bg-red-100 text-red-600' },
  NONE: { label: 'Chưa đăng ký', cls: 'bg-slate-100 text-slate-500' },
};

const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();

export default function FaceIdAdminPanel() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null); // user_id đang thao tác

  const load = useCallback(async () => {
    const [{ data: staff }, { data: fps }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, employee_id, avatar_url').eq('is_active', true).order('full_name'),
      supabase.from('face_profiles').select('user_id, status, quality_score, sample_count, enrolled_at'),
    ]);
    const map = Object.fromEntries((fps || []).map((f) => [f.user_id, f]));
    setRows((staff || []).map((s) => ({ ...s, fp: map[s.id] || null })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (userId, name, kind) => {
    const cfg = {
      reenroll: { confirm: `Bắt ${name} đăng ký lại khuôn mặt? Người này sẽ KHÔNG chấm công Face được cho tới khi đăng ký lại.`, update: { status: 'NEEDS_REENROLLMENT' }, ok: 'Đã yêu cầu đăng ký lại' },
      lock: { confirm: `KHÓA Face ID của ${name}? Người này sẽ không chấm công bằng khuôn mặt được nữa (GPS vẫn dùng bình thường).`, update: { status: 'DISABLED' }, ok: 'Đã khóa Face ID' },
      unlock: { confirm: null, update: { status: 'ACTIVE' }, ok: 'Đã mở khóa Face ID' },
      remove: { confirm: `XÓA VĨNH VIỄN Face ID của ${name}? Dữ liệu khuôn mặt bị xóa, muốn dùng lại phải đăng ký từ đầu.`, remove: true, ok: 'Đã xóa Face ID' },
    }[kind];
    if (cfg.confirm && !window.confirm(cfg.confirm)) return;
    setBusy(userId);
    const res = cfg.remove
      ? await supabase.from('face_profiles').delete().eq('user_id', userId).select('user_id')
      : await supabase.from('face_profiles').update(cfg.update).eq('user_id', userId).select('user_id');
    setBusy(null);
    if (res.error) { toast.error(res.error.message); return; }
    if (!res.data?.length) { toast.error('Không có quyền thao tác (cần admin, hoặc chưa chạy face_attendance.sql)'); return; }
    toast.success(cfg.ok);
    load();
  };

  const visible = (rows || []).filter((r) => !q.trim() || (r.full_name || '').toLowerCase().includes(q.toLowerCase()) || (r.employee_id || '').toLowerCase().includes(q.toLowerCase()));
  const enrolled = (rows || []).filter((r) => r.fp?.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      {/* Tổng quan + tìm kiếm */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center"><ScanFace className="w-5 h-5 text-teal-600" /></span>
          <div>
            <div className="font-bold text-slate-800">Face ID nhân sự</div>
            <div className="text-xs text-slate-400">{enrolled}/{rows?.length ?? '…'} đã đăng ký khuôn mặt</div>
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân sự…"
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-400 bg-white" />
        </div>
      </div>

      {!rows ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {visible.map((r) => {
            const st = r.fp ? (CHIP[r.fp.status] ? r.fp.status : 'NONE') : 'NONE';
            const chip = CHIP[st];
            const isBusy = busy === r.id;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : initials(r.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{r.full_name} {r.employee_id && <span className="text-slate-400 font-normal text-xs">· {r.employee_id}</span>}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.cls}`}>{chip.label}</span>
                    {r.fp?.status === 'ACTIVE' && r.fp.enrolled_at && (
                      <span className="text-[10px] text-slate-400">
                        {r.fp.quality_score != null ? `Chất lượng ${Math.round(r.fp.quality_score * 100)}/100 · ` : ''}
                        {new Date(r.fp.enrolled_at).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.fp && r.fp.status === 'ACTIVE' && (
                    <>
                      <button disabled={isBusy} onClick={() => act(r.id, r.full_name, 'reenroll')} title="Bắt đăng ký lại khuôn mặt"
                        className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition disabled:opacity-40"><RefreshCw className="w-4 h-4" /></button>
                      <button disabled={isBusy} onClick={() => act(r.id, r.full_name, 'lock')} title="Khóa Face ID"
                        className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-40"><Lock className="w-4 h-4" /></button>
                    </>
                  )}
                  {r.fp?.status === 'DISABLED' && (
                    <button disabled={isBusy} onClick={() => act(r.id, r.full_name, 'unlock')} title="Mở khóa Face ID"
                      className="p-2 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 transition disabled:opacity-40"><Unlock className="w-4 h-4" /></button>
                  )}
                  {r.fp && (
                    <button disabled={isBusy} onClick={() => act(r.id, r.full_name, 'remove')} title="Xóa Face ID vĩnh viễn"
                      className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
                  )}
                  {!r.fp && <span className="text-[11px] text-slate-300 pr-1">Nhân sự tự đăng ký trong app</span>}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">Không tìm thấy nhân sự</div>}
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed">
        <b>Bắt đăng ký lại</b>: nhân sự không chấm Face được cho tới khi đăng ký lại (app tự hiện nút đăng ký lại).
        <b> Khóa</b>: chặn hẳn chấm công khuôn mặt của người đó. <b>Xóa</b>: xóa vĩnh viễn dữ liệu khuôn mặt.
        Không ai xem được dữ liệu sinh trắc học gốc — hệ thống chỉ lưu mã đặc trưng đã mã hóa.
      </p>
    </div>
  );
}
