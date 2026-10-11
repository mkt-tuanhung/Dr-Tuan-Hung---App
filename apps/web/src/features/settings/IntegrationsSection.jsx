// ============================================================
// CÀI ĐẶT › TÍCH HỢP — trạng thái CHỈ XEM các kết nối đang có.
// Chỉ đọc số lượng / trạng thái, KHÔNG bao giờ đọc hay hiện khoá bí mật / token / chat_id.
// Nguồn: fb_ads_config (fb_auto_campaign.sql), profiles.telegram_chat_id (telegram.sql),
//        push_subscriptions (push_subscriptions.sql), trusted_devices (device_approval.sql),
//        face_config + face_profiles (face_attendance.sql).
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Blocks, Megaphone, Send, Bell, MonitorSmartphone, ScanFace, RotateCw, CircleCheck, CircleAlert, CircleX } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { SectionHeader, isMissingTable } from './settingsShared.jsx';

const fmtVnd = (n) => `${new Intl.NumberFormat('vi-VN').format(Number(n) || 0)}đ`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '');

// Đếm số dòng (head: true -> không tải dữ liệu)
const countOf = async (build) => {
  const { count, error } = await build();
  if (error) return { missing: isMissingTable(error), error: !isMissingTable(error) ? error : null, count: null };
  return { count: count ?? 0 };
};

const STATUS = {
  ok: { label: 'Đang hoạt động', cls: 'e-tone-success', Icon: CircleCheck },
  partial: { label: 'Cần cấu hình', cls: 'e-tone-warning', Icon: CircleAlert },
  off: { label: 'Chưa thiết lập', cls: 'e-tone-neutral', Icon: CircleX },
  error: { label: 'Không đọc được', cls: 'e-tone-danger', Icon: CircleAlert },
};

function IntegrationCard({ icon: Icon, name, category, status, lines, foot }) {
  const s = STATUS[status] || STATUS.off;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Icon className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800 truncate">{name}</div>
          <div className="text-[11.5px] text-slate-400">{category}</div>
        </div>
        <span className={`e-badge e-badge-sm ${s.cls}`}><s.Icon />{s.label}</span>
      </div>
      <dl className="grid gap-1.5 text-[13px]">
        {lines.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {foot && <div className="text-[12px] text-slate-400 mt-auto pt-2 border-t border-slate-100">{foot}</div>}
    </div>
  );
}

export default function IntegrationsSection() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setData(null);
    const [fb, tg, tgTotal, push, devApproved, devPending, faceCfg, faceActive] = await Promise.all([
      // Chỉ lấy cột không nhạy cảm; ad_account_id chỉ dùng để biết "đã điền hay chưa"
      supabase.from('fb_ads_config').select('ad_account_id, template_adset_id, daily_budget, campaign_status, optimization_goal, updated_at').eq('id', 1).maybeSingle(),
      countOf(() => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).not('telegram_chat_id', 'is', null)),
      countOf(() => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true)),
      countOf(() => supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })),
      countOf(() => supabase.from('trusted_devices').select('id', { count: 'exact', head: true }).eq('approved', true)),
      countOf(() => supabase.from('trusted_devices').select('id', { count: 'exact', head: true }).eq('approved', false)),
      supabase.from('face_config').select('require_liveness, location_rule, office_ips, updated_at').eq('id', 1).maybeSingle(),
      countOf(() => supabase.from('face_profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'ACTIVE')),
    ]);
    setData({ fb, tg, tgTotal, push, devApproved, devPending, faceCfg, faceActive });
  }, []);
  useEffect(() => { load(); }, [load]);

  const cards = [];
  if (data) {
    const { fb, tg, tgTotal, push, devApproved, devPending, faceCfg, faceActive } = data;
    const fbRow = fb.data;
    const fbMissing = fb.error && isMissingTable(fb.error);
    cards.push({
      key: 'fb', icon: Megaphone, name: 'Facebook Ads — tự tạo chiến dịch', category: 'Quảng cáo',
      status: fb.error ? (fbMissing ? 'off' : 'error') : !fbRow ? 'off' : (fbRow.ad_account_id || fbRow.template_adset_id) ? 'ok' : 'partial',
      lines: fbRow ? [
        ['Tài khoản quảng cáo', fbRow.ad_account_id ? 'Đã điền' : 'Dùng secret mặc định'],
        ['Nhóm QC mẫu (target)', fbRow.template_adset_id ? 'Đã chọn' : 'Chưa chọn'],
        ['Ngân sách ngày', fmtVnd(fbRow.daily_budget)],
        ['Trạng thái khi tạo', fbRow.campaign_status === 'PAUSED' ? 'Tạm dừng (duyệt tay)' : 'Chạy ngay'],
      ] : [['Cấu hình', fbMissing ? 'Chưa chạy fb_auto_campaign.sql' : '—']],
      foot: fbRow?.updated_at ? `Cập nhật ${fmtDate(fbRow.updated_at)} · Token Meta lưu ở secret máy chủ, không hiện ở đây.` : 'Token Meta lưu ở secret máy chủ, không hiện ở đây.',
    });
    cards.push({
      key: 'tg', icon: Send, name: 'Telegram — thông báo về điện thoại', category: 'Thông báo',
      status: tg.count == null ? 'error' : tg.count > 0 ? 'ok' : 'off',
      lines: [['Nhân sự đã liên kết', tg.count == null ? '—' : `${tg.count}/${tgTotal.count ?? '…'}`]],
      foot: 'Mỗi nhân sự tự liên kết Telegram trong menu hồ sơ cá nhân (góc trên).',
    });
    cards.push({
      key: 'push', icon: Bell, name: 'Thông báo đẩy (Web Push)', category: 'Thông báo',
      status: push.missing ? 'off' : push.count == null ? 'error' : push.count > 0 ? 'ok' : 'partial',
      lines: [['Thiết bị CỦA BẠN đã bật', push.missing ? 'Chưa chạy push_subscriptions.sql' : push.count ?? '—']],
      foot: 'Quyền đọc chỉ cho xem thiết bị của chính mình, nên không có tổng toàn phòng khám.',
    });
    cards.push({
      key: 'dev', icon: MonitorSmartphone, name: 'Duyệt thiết bị đăng nhập', category: 'Bảo mật',
      status: devApproved.missing ? 'off' : devApproved.count == null ? 'error' : devPending.count > 0 ? 'partial' : 'ok',
      lines: devApproved.missing ? [['Bảng', 'Chưa chạy device_approval.sql']] : [
        ['Thiết bị đã duyệt', devApproved.count ?? '—'],
        ['Đang chờ duyệt', devPending.count ?? '—'],
      ],
      foot: devPending.count > 0 ? 'Có thiết bị đăng nhập mới đang chờ Admin duyệt.' : 'Nhân sự đăng nhập trên máy mới phải chờ Admin duyệt.',
    });
    const fc = faceCfg.data;
    const faceMissing = faceCfg.error && isMissingTable(faceCfg.error);
    cards.push({
      key: 'face', icon: ScanFace, name: 'Chấm công Face ID', category: 'Chấm công',
      status: faceCfg.error ? (faceMissing ? 'off' : 'error') : !fc ? 'off' : (faceActive.count || 0) > 0 ? 'ok' : 'partial',
      lines: fc ? [
        ['Nhân sự đã đăng ký mặt', faceActive.count ?? '—'],
        ['Kiểm tra người thật (liveness)', fc.require_liveness ? 'Bật' : 'Tắt'],
        ['Sai vị trí', fc.location_rule === 'require' ? 'Từ chối ghi công' : 'Ghi công + cảnh báo'],
        ['IP văn phòng', Array.isArray(fc.office_ips) ? fc.office_ips.length : 0],
      ] : [['Cấu hình', faceMissing ? 'Chưa chạy face_attendance.sql' : '—']],
      foot: 'Quản lý khuôn mặt từng nhân sự ở mục Face ID.',
    });
  }

  return (
    <div>
      <SectionHeader icon={Blocks} title="Tích hợp hệ thống"
        desc="Trạng thái các kết nối đang dùng. Chỉ xem — khoá bí mật và token nằm ở máy chủ, không bao giờ hiện ra màn hình."
        action={<button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={load} disabled={!data}><RotateCw />Tải lại</button>} />
      {!data ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="h-[180px] rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {cards.map(({ key, ...c }) => <IntegrationCard key={key} {...c} />)}
        </div>
      )}
    </div>
  );
}
