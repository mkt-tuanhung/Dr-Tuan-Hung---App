// ============================================================
// CÀI ĐẶT HỆ THỐNG — phần dùng chung giữa các mục
//  - useClinicSettings: đọc / lưu dòng duy nhất của bảng clinic_settings
//  - SectionHeader: tiêu đề + mô tả + nút bên phải (Ethics .set-head)
//  - Field: nhãn + ô nhập + gợi ý / lỗi
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { runWithReason } from '@/lib/audit';

// Bảng chưa tạo (chưa chạy file SQL) — PostgREST báo 42P01 / PGRST205 / "could not find"
export const isMissingTable = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205'
  || /does not exist|could not find|schema cache/i.test(e.message || ''));

export const isAdminProfile = (p) => p?.role === 'admin' || p?.role_2 === 'admin';

export function useClinicSettings() {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.from('clinic_settings').select('*').eq('id', true).maybeSingle();
    if (err) {
      const miss = isMissingTable(err);
      setMissing(miss);
      if (!miss) setError(err);
      setRow(null);
    } else {
      setMissing(false);
      setRow(data || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // patch: chỉ các cột của mục đang lưu. Upsert để vẫn chạy khi dòng seed bị thiếu.
  const save = useCallback(async (patch, reason) => {
    const res = await runWithReason(
      () => supabase.from('clinic_settings').upsert({ id: true, ...patch }, { onConflict: 'id' }).select('*').maybeSingle(),
      reason,
    );
    if (res.error) return { error: res.error };
    if (!res.data) return { error: { message: 'Không có quyền lưu (chỉ Admin được sửa cài đặt).' } };
    setRow(res.data);
    return { data: res.data };
  }, []);

  return { row, loading, missing, error, reload, save };
}

export function SectionHeader({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Icon className="w-5 h-5" /></span>}
        <div className="min-w-0">
          <h2 className="text-[18px] lg:text-[20px] font-bold text-slate-900 leading-tight">{title}</h2>
          {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-[720px] leading-relaxed">{desc}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function Field({ label, required, hint, error, className = '', children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="e-label">{label}{required && <span className="text-danger-500"> *</span>}</span>
      {children}
      {error ? <span className="block text-[12px] text-danger-600 mt-1">{error}</span>
        : hint ? <span className="block text-[12px] text-slate-400 mt-1">{hint}</span> : null}
    </label>
  );
}

// Thanh lưu dưới form: hiện "Có thay đổi chưa lưu" + Hoàn tác + Lưu
export function SaveBar({ dirty, saving, disabled, onReset, onSave, label = 'Lưu thay đổi' }) {
  return (
    <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 flex-wrap">
      {dirty && <span className="mr-auto e-badge e-badge-sm e-badge-dot e-tone-warning">Có thay đổi chưa lưu</span>}
      <button type="button" className="e-btn e-btn-secondary" disabled={!dirty || saving} onClick={onReset}>Hoàn tác</button>
      <button type="button" className="e-btn e-btn-primary" disabled={!dirty || saving || disabled} onClick={onSave}>
        {saving ? 'Đang lưu…' : label}
      </button>
    </div>
  );
}
