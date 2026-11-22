// ============================================================
// GALA SCORING — chấm điểm thi văn nghệ (module con của Event)
// • Admin của app = Ban tổ chức: tạo chương trình, tiết mục, cấp quyền giám khảo, công bố.
// • Giám khảo = tài khoản app được Admin chỉ định: chấm trên điện thoại.
// • Nhân sự khác: thấy thông báo chưa được cấp quyền.
// Dùng đăng nhập + Supabase sẵn có của app; quyền kiểm ở DB (supabase/event_gala_van_nghe.sql).
// ============================================================
import React, { useState } from 'react';
import { RefreshCw, Plus, Database, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { EmptyState } from '@/components/ds';
import { useGala } from './useGala';
import GalaAdmin from './GalaAdmin.jsx';
import GalaJudge from './GalaJudge.jsx';
import { DEFAULT_EVENT_TITLE, phaseInfo } from './galaUtil';

export default function GalaScoring() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const g = useGala({ userId: profile?.id, isAdmin });
  const [newTitle, setNewTitle] = useState(DEFAULT_EVENT_TITLE);
  const [showCreate, setShowCreate] = useState(false);

  if (g.loading) return <div className="e-card e-card-pad text-slate-400">Đang tải dữ liệu chương trình…</div>;

  if (g.missing) {
    return (
      <div className="e-card">
        <EmptyState icon={Database} title="Chưa cài đặt dữ liệu chấm điểm"
          description={isAdmin
            ? 'Admin chạy file supabase/event_gala_van_nghe.sql trong Supabase → SQL Editor rồi tải lại trang.'
            : 'Ban tổ chức đang chuẩn bị. Vui lòng quay lại sau.'} />
      </div>
    );
  }

  const createForm = (
    <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xl">
      <input className="e-input flex-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Tên chương trình" />
      <button type="button" className="e-btn e-btn-primary" disabled={g.working}
        onClick={async () => { if (await g.actions.createEvent(newTitle)) { setShowCreate(false); setNewTitle(DEFAULT_EVENT_TITLE); } }}>
        <Plus /> Tạo chương trình
      </button>
    </div>
  );

  if (!g.events.length) {
    return (
      <div className="e-card">
        <EmptyState icon={isAdmin ? Sparkles : Lock}
          title={isAdmin ? 'Tạo chương trình chấm thi đầu tiên' : 'Chưa được cấp quyền giám khảo'}
          description={isAdmin
            ? 'Tạo chương trình → thêm tiết mục → cấp quyền giám khảo → mở chấm. Bộ tiêu chí 100 điểm được tạo tự động.'
            : 'Khi Ban tổ chức chỉ định bạn làm giám khảo, phiếu chấm sẽ hiện ở đây.'}
          action={isAdmin ? createForm : null} />
      </div>
    );
  }

  const ph = phaseInfo(g.selectedEvent);

  return (
    <div className="space-y-4">
      {/* Thanh chương trình */}
      <div className="e-toolbar">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
          {g.events.length > 1 ? (
            <select aria-label="Chọn chương trình" className="e-input h-9 max-w-[320px] font-semibold"
              value={g.eventId || ''} onChange={(e) => g.setEventId(e.target.value)}>
              {g.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
          ) : (
            <span className="font-semibold text-slate-800 truncate">{g.selectedEvent?.title}</span>
          )}
          <span className={`e-badge e-badge-sm ${ph.tone}`}>{ph.label}</span>
        </div>
        <span className="text-[12.5px] text-slate-500 hidden sm:inline">
          {g.performances.length} tiết mục · {g.activeJudges.length} giám khảo
        </span>
        {isAdmin && (
          <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus /> Chương trình mới
          </button>
        )}
        <button type="button" className="e-icon-btn w-9 h-9" title="Làm mới" onClick={g.refresh}><RefreshCw className="w-4 h-4" /></button>
      </div>

      {isAdmin && showCreate && <div className="e-card e-card-pad">{createForm}</div>}

      {isAdmin ? <GalaAdmin g={g} /> : <GalaJudge g={g} userId={profile?.id} />}
    </div>
  );
}
