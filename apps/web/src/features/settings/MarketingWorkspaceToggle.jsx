// Cài đặt hệ thống › Marketing Workspace: bật / tắt cờ clinic_settings.mw_enabled (chỉ Admin — RPC kiểm tra).
// Chưa chạy supabase/marketing_workspace_v1.sql -> báo cần cài, không có nút bật.
import React, { useCallback, useEffect, useState } from 'react';
import { KanbanSquare, Power } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { mwApi, isMissingSchema } from '@/features/marketingWorkspace/mwApi';
import { announceMwEnabled } from '@/features/marketingWorkspace/useMwEnabled';
import { SectionHeader } from './settingsShared.jsx';

export default function MarketingWorkspaceToggle({ onNavigate }) {
  const [st, setSt] = useState({ loading: true });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('clinic_settings').select('mw_enabled').maybeSingle();
    setSt({ loading: false, missing: !!error && isMissingSchema(error), error: error && !isMissingSchema(error) ? error.message : null, on: !!data?.mw_enabled });
  }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = async () => {
    setBusy(true);
    try {
      await mwApi.setEnabled(!st.on);
      announceMwEnabled(!st.on);
      toast.success(st.on ? 'Đã tắt Marketing Workspace' : 'Đã bật Marketing Workspace');
      await load();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <SectionHeader icon={KanbanSquare} title="Marketing Workspace"
        desc="Bảng công việc kiểu Trello, chiến dịch, Content Studio, duyệt y khoa / consent và xuất bản thủ công có bằng chứng. Tắt: menu ẩn với mọi người, dữ liệu giữ nguyên." />
      {st.loading ? <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
        : st.missing ? <div className="e-alert e-alert-warning text-[13px]">Chưa cài trên database — chạy file <b className="font-mono">supabase/marketing_workspace_v1.sql</b> trong Supabase SQL Editor rồi quay lại đây.</div>
          : st.error ? <div className="e-alert e-alert-danger text-[13px]">{st.error}</div>
            : (
              <div className="flex flex-wrap items-center gap-3">
                <span className={`e-badge ${st.on ? 'e-tone-success' : 'e-tone-neutral'}`}>{st.on ? 'Đang bật' : 'Đang tắt'}</span>
                <button type="button" className={`e-btn ${st.on ? 'e-btn-danger-soft' : 'e-btn-primary'}`} disabled={busy} onClick={toggle}><Power /> {st.on ? 'Tắt module' : 'Bật module'}</button>
                {st.on && onNavigate && <button type="button" className="e-btn e-btn-secondary" onClick={() => onNavigate('mkt_workspace')}>Mở Marketing Workspace</button>}
              </div>
            )}
      <ul className="text-[13px] text-slate-500 list-disc pl-5 space-y-1">
        <li>Ai thấy menu: vai trò mặc định Marketing, Media, Editor, Designer, Bác sĩ, Admin — đổi ở mục Phân quyền (chức năng “Marketing Workspace”).</li>
        <li>Ai xem được dữ liệu: chỉ thành viên của từng workspace (thêm trong module › Thành viên & cấu hình).</li>
        <li>Người duyệt y khoa / marketing / pháp lý-consent / người đăng bài: Admin cấp trong module — Admin không tự động là người duyệt y khoa.</li>
      </ul>
    </div>
  );
}
