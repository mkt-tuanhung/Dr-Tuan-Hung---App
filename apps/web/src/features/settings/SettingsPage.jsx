// ============================================================
// D12 — CÀI ĐẶT HỆ THỐNG (theo Ethics BOS 12_Cai_dat_He_thong.png)
// Bố cục: cột trái = danh sách mục trong 1 thẻ (icon + tên + mô tả ngắn, mục đang mở tô teal),
//         cột phải = nội dung mục.
// Chỉ Admin (vai trò chính hoặc role_2) mở được.
//
// Mục:
//   Thông tin phòng khám ...... form bảng clinic_settings (supabase/clinic_settings.sql)
//   Giờ làm việc & chấm công ... giờ mở cửa, ân hạn đi muộn, công chuẩn, IP văn phòng (clinic_settings)
//   Ca làm việc ................ thêm / sửa / ngừng dùng ca (bảng work_shifts)
//   Phân quyền ................. nhúng PermissionsPage
//   Face ID .................... nhúng FaceIdAdminPanel
//   Tích hợp ................... trạng thái chỉ xem (không hiện khoá bí mật)
//   Nhật ký hoạt động .......... nhúng AuditLogPage
//
// Tiêu đề trang: AuditLogPage tự gọi usePageTitle('Nhật ký hoạt động'), và khi bị gỡ
// (chuyển mục) thì đặt tiêu đề về rỗng. <KeepTitle key={mục}> đứng SAU nội dung mục nên
// effect của nó chạy sau effect của trang con (React chạy effect con trước, anh em theo
// thứ tự) -> tiêu đề "Cài đặt hệ thống" luôn thắng; đổi key khi chuyển mục để đặt lại
// tiêu đề sau khi trang con dọn dẹp.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, CalendarClock, Clock, ShieldCheck, ScanFace, Blocks, History, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePageTitle, PermissionDenied, ErrorState, AlertStrip, ConfirmDialog } from '@/components/ds';
import PermissionsPage from '@/features/permissions/PermissionsPage.jsx';
import AuditLogPage from '@/features/audit/AuditLogPage.jsx';
import FaceIdAdminPanel from '@/features/faceid/FaceIdAdminPanel.jsx';
import { useClinicSettings, isAdminProfile, SectionHeader } from './settingsShared.jsx';
import { ClinicInfoSection, WorkHoursSection } from './ClinicSections.jsx';
import ShiftsSection from './ShiftsSection.jsx';
import IntegrationsSection from './IntegrationsSection.jsx';

const TITLE = 'Cài đặt hệ thống';
const STORAGE_KEY = 'th_settings_section';

// bare: trang nhúng đã có thẻ riêng -> không bọc thêm thẻ ngoài
// usesClinic: mục đọc / ghi bảng clinic_settings
const SECTIONS = [
  { key: 'clinic', label: 'Thông tin phòng khám', desc: 'Tên, pháp nhân, liên hệ', icon: Building2, usesClinic: true },
  { key: 'hours', label: 'Giờ làm việc & chấm công', desc: 'Giờ mở cửa, ân hạn, công chuẩn, IP', icon: CalendarClock, usesClinic: true },
  { key: 'shifts', label: 'Ca làm việc', desc: 'Danh mục ca để xếp lịch', icon: Clock },
  { key: 'permissions', label: 'Phân quyền', desc: 'Vai trò × chức năng', icon: ShieldCheck, bare: true },
  { key: 'faceid', label: 'Face ID', desc: 'Khuôn mặt chấm công', icon: ScanFace },
  { key: 'integrations', label: 'Tích hợp', desc: 'Facebook, Telegram, thông báo…', icon: Blocks },
  { key: 'audit', label: 'Nhật ký hoạt động', desc: 'Ai sửa gì, lúc nào, vì sao', icon: History, bare: true },
];
const isSection = (k) => SECTIONS.some(s => s.key === k);

const readStored = () => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isSection(v) ? v : SECTIONS[0].key;
  } catch { return SECTIONS[0].key; }
};

function KeepTitle() {
  usePageTitle(TITLE);
  return null;
}

export default function SettingsPage({ onNavigate }) {
  usePageTitle(TITLE);
  const { profile } = useAuth();
  if (!isAdminProfile(profile)) {
    return <div className="e-card"><PermissionDenied description="Chỉ Admin được mở Cài đặt hệ thống." /></div>;
  }
  return <SettingsContent onNavigate={onNavigate} profile={profile} />;
}

function SettingsContent({ onNavigate, profile }) {
  const [section, setSection] = useState(readStored);
  const [pending, setPending] = useState(null); // mục muốn chuyển tới khi đang có thay đổi chưa lưu
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const settings = useClinicSettings();

  const onDirtyChange = useCallback((v) => { dirtyRef.current = !!v; setDirty(!!v); }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, section); } catch { /* trình duyệt chặn lưu: bỏ qua */ }
  }, [section]);

  // Đóng tab / tải lại trang khi còn thay đổi chưa lưu -> trình duyệt hỏi lại
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const choose = (key) => {
    if (key === section) return;
    if (dirtyRef.current) { setPending(key); return; }
    setSection(key);
  };

  const current = SECTIONS.find(s => s.key === section) || SECTIONS[0];
  const clinicMissing = settings.missing;
  const readOnlyClinic = clinicMissing || !!settings.error;

  const renderSection = () => {
    if (current.usesClinic) {
      if (settings.loading) return <div className="space-y-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />)}</div>;
      if (settings.error) return <ErrorState title="Không tải được cài đặt" description={settings.error.message} onRetry={settings.reload} />;
      const props = { settings, readOnly: readOnlyClinic, onDirtyChange };
      return current.key === 'clinic' ? <ClinicInfoSection {...props} /> : <WorkHoursSection {...props} />;
    }
    switch (current.key) {
      case 'shifts': return <ShiftsSection canWrite={profile?.role === 'admin'} onNavigate={onNavigate} />;
      case 'permissions': return <PermissionsPage />;
      case 'faceid': return (
        <div>
          <SectionHeader icon={ScanFace} title="Face ID"
            desc="Trạng thái đăng ký khuôn mặt của nhân sự: bắt đăng ký lại, khoá / mở khoá, xoá. Cùng nội dung với tab Face ID trong Chấm công." />
          <FaceIdAdminPanel />
        </div>
      );
      case 'integrations': return <IntegrationsSection settings={settings} />;
      case 'audit': return (
        <div className="space-y-4">
          <div className="e-card e-card-pad">
            <SectionHeader icon={History} title="Nhật ký hoạt động"
              desc="Mọi thay đổi dữ liệu nhạy cảm (lương, tài chính, lịch hẹn, nhân sự, cài đặt) — chỉ ghi thêm, không sửa / xoá được." />
            <div className="-mt-2 text-[12.5px] text-slate-400 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Thay đổi trong Cài đặt hệ thống được ghi với đối tượng <b className="font-mono font-medium">clinic_settings</b> / <b className="font-mono font-medium">work_shifts</b>.</div>
          </div>
          <AuditLogPage />
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
      <nav className="e-card p-2.5 lg:p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-[88px] scrollbar-hide" aria-label="Mục cài đặt">
        {SECTIONS.map(s => {
          const active = s.key === current.key;
          const Icon = s.icon;
          return (
            <button key={s.key} type="button" onClick={() => choose(s.key)} aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 shrink-0 lg:shrink min-h-[48px] px-3 lg:px-3.5 py-2 rounded-xl text-left transition ${active ? 'text-white shadow-nav' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'}`}
              style={active ? { backgroundImage: 'linear-gradient(135deg, #067B7F 0%, #12A4A5 100%)' } : undefined}>
              <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-teal-700'}`} strokeWidth={1.8} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold whitespace-nowrap lg:whitespace-normal leading-snug">
                  {s.label}
                  {s.usesClinic && clinicMissing && <span className="w-1.5 h-1.5 rounded-full bg-warning-500 shrink-0" aria-label="Chưa tạo bảng" />}
                </span>
                <span className={`hidden lg:block text-[12px] leading-snug mt-0.5 ${active ? 'text-white/80' : 'text-slate-400'}`}>{s.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="min-w-0 space-y-4" aria-label={current.label}>
        {current.usesClinic && clinicMissing && (
          <AlertStrip tone="warning">
            <b>Chưa tạo bảng cài đặt.</b> Chạy file <code className="px-1 rounded bg-white/60">supabase/clinic_settings.sql</code> trong Supabase › SQL Editor rồi tải lại trang. Các mục khác vẫn dùng bình thường.
          </AlertStrip>
        )}
        {current.bare ? renderSection() : <div className="e-card e-card-pad">{renderSection()}</div>}
      </section>
      <KeepTitle key={current.key} />

      <ConfirmDialog open={!!pending} onClose={() => setPending(null)}
        title="Bỏ thay đổi chưa lưu?"
        description="Mục hiện tại có thay đổi chưa lưu. Chuyển mục sẽ bỏ các thay đổi này."
        confirmLabel="Bỏ thay đổi" cancelLabel="Ở lại" danger
        onConfirm={() => { const k = pending; setPending(null); onDirtyChange(false); setSection(k); }} />
    </div>
  );
}
