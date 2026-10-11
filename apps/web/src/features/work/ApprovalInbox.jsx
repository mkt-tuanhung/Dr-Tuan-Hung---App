// ============================================================
// HỘP "CHỜ DUYỆT" GỘP (Ethics docs/09 "Approval inbox") — CHỈ XEM
// Gom các yêu cầu đang chờ từ những bảng sẵn có; việc duyệt vẫn làm ở màn gốc
// (bấm "Mở để duyệt" -> onNavigate(tab)):
//   Đơn nghỉ / đi muộn ...... leave_requests (pending)            -> 'hr' (Nhân sự → Duyệt đơn)
//   Ứng lương ............... salary_advances (pending)           -> 'payroll'
//   Tạm ứng chi ............. expenses (pending, is_advance)      -> 'advances'
//   Yêu cầu xem phiếu lương . rpc payslip_pending_requests()      -> 'payroll'
//   Thiết bị đăng nhập mới .. trusted_devices (approved = false)  -> 'notifications' (duyệt qua Telegram) — chỉ Admin
// Nguồn nào lỗi (chưa chạy SQL / không có quyền) thì bỏ qua, không làm hỏng trang.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Wallet, Banknote, FileText, MonitorSmartphone, ArrowRight, RotateCw, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { EmptyState } from '@/components/ds';
import { timeAgo, fmtDT } from './taskMeta';

const fmtMoney = (n) => `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0))}đ`;
const fmtDay = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const LEAVE_TYPE = { leave: 'Nghỉ phép', half_day: 'Nghỉ nửa ngày', late: 'Đi muộn', early: 'Về sớm' };
const HALF = { morning: 'buổi sáng', afternoon: 'buổi chiều' };
const EXPENSE_CAT = {
  Vat_tu: 'Mua vật tư / Trang thiết bị', Van_phong: 'Văn phòng phẩm', Cong_tac: 'Chi phí công tác',
  Tiep_khach: 'Tiếp khách', MKT: 'Marketing / Quảng cáo', Tho_cung: 'Đồ thờ / cúng', Nhan_cong: 'Nhân công', Khac: 'Khác',
};

// Mỗi nguồn: load() trả mảng item chuẩn hoá { id, who, what, when, amount, note, at }
const SOURCES = [
  {
    id: 'leave', title: 'Đơn nghỉ / đi muộn', icon: CalendarCheck, tone: 'e-tone-sky', tab: 'hr',
    async load({ name }) {
      const { data, error } = await supabase.from('leave_requests')
        .select('id, staff_id, date, type, half_day_period, reason, created_at')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, who: name(r.staff_id),
        what: `${LEAVE_TYPE[r.type] || r.type || 'Đơn từ'}${r.half_day_period ? ` (${HALF[r.half_day_period] || r.half_day_period})` : ''}`,
        when: `Ngày ${fmtDay(r.date)}`, note: r.reason, at: r.created_at,
      }));
    },
  },
  {
    id: 'salary_advance', title: 'Ứng lương', icon: Wallet, tone: 'e-tone-peach', tab: 'payroll',
    async load({ name }) {
      const { data, error } = await supabase.from('salary_advances')
        .select('id, staff_id, amount, reason, month, year, created_at')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, who: name(r.staff_id), what: 'Xin ứng lương',
        when: r.month && r.year ? `Trừ lương tháng ${r.month}/${r.year}` : '', amount: r.amount, note: r.reason, at: r.created_at,
      }));
    },
  },
  {
    id: 'expense', title: 'Tạm ứng chi', icon: Banknote, tone: 'e-tone-lavender', tab: 'advances',
    async load({ name }) {
      const base = () => supabase.from('expenses')
        .select('id, staff_id, date, category, amount, description, created_at')
        .eq('status', 'pending').eq('is_advance', true).order('created_at', { ascending: false }).limit(100);
      let { data, error } = await base().is('deleted_at', null);
      if (error && /deleted_at/.test(error.message || '')) ({ data, error } = await base()); // DB cũ chưa có cột thùng rác
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, who: name(r.staff_id), what: EXPENSE_CAT[r.category] || r.category || 'Tạm ứng',
        when: r.date ? `Ngày chi ${fmtDay(r.date)}` : '', amount: r.amount, note: r.description, at: r.created_at,
      }));
    },
  },
  {
    id: 'payslip_view', title: 'Yêu cầu xem phiếu lương', icon: FileText, tone: 'e-tone-info', tab: 'payroll',
    async load() {
      const { data, error } = await supabase.rpc('payslip_pending_requests');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, who: r.staff_name || 'Nhân sự', what: `Xem phiếu lương${r.period ? ` ${r.period}` : ''}`,
        when: r.device_label ? `Thiết bị: ${r.device_label}` : '', note: r.is_duplicate ? 'Mã đã được mở trên thiết bị khác' : '', at: r.created_at,
        warn: !!r.is_duplicate,
      }));
    },
  },
  {
    id: 'device', title: 'Thiết bị đăng nhập mới', icon: MonitorSmartphone, tone: 'e-tone-warning', tab: 'notifications',
    adminOnly: true, hint: 'Duyệt bằng nút trên Telegram của Admin.', actionLabel: 'Xem thông báo',
    async load({ name, meId }) {
      let q = supabase.from('trusted_devices').select('id, user_id, device_label, created_at')
        .eq('approved', false).order('created_at', { ascending: false }).limit(100);
      if (meId) q = q.neq('user_id', meId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, who: name(r.user_id), what: 'Đăng nhập thiết bị mới', when: r.device_label || '', at: r.created_at,
      }));
    },
  },
];

// Dùng ở trang cha để có số đếm cho tab "Chờ duyệt (n)" ngay khi mở trang
export function useApprovalInbox({ enabled, isAdmin, meId, peopleById }) {
  const [groups, setGroups] = useState([]);       // [{ ...source, items }]
  const [failed, setFailed] = useState([]);       // tiêu đề nguồn không đọc được
  const [loading, setLoading] = useState(enabled);

  const name = useCallback((id) => peopleById[id]?.full_name || 'Nhân sự', [peopleById]);

  const reload = useCallback(async () => {
    if (!enabled) { setGroups([]); setLoading(false); return; }
    setLoading(true);
    const list = SOURCES.filter(s => !s.adminOnly || isAdmin);
    const res = await Promise.allSettled(list.map(s => s.load({ name, meId })));
    setGroups(list.map((s, i) => ({ ...s, items: res[i].status === 'fulfilled' ? res[i].value : null })).filter(g => g.items));
    setFailed(list.filter((_, i) => res[i].status === 'rejected').map(s => s.title));
    setLoading(false);
  }, [enabled, isAdmin, meId, name]);

  useEffect(() => { reload(); }, [reload]);

  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  return { groups, failed, loading, total, reload };
}

function ItemRow({ it, source, onNavigate }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[14px] font-semibold text-slate-900">{it.who}</span>
          <span className="text-[13.5px] text-slate-600">{it.what}</span>
          {it.amount != null && <span className="text-[14px] font-bold text-slate-900 tabular-nums">{fmtMoney(it.amount)}</span>}
        </div>
        <div className="text-[12.5px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
          {it.when && <span>{it.when}</span>}
          <span title={fmtDT(it.at)}>Gửi {timeAgo(it.at)}</span>
        </div>
        {it.note && <div className={`text-[12.5px] mt-0.5 line-clamp-2 ${it.warn ? 'text-danger-600 font-medium' : 'text-slate-500'}`}>{it.note}</div>}
      </div>
      {onNavigate && (
        <button type="button" onClick={() => onNavigate(source.tab)} className="e-btn e-btn-outline e-btn-sm self-start sm:self-center shrink-0">
          {source.actionLabel || 'Mở để duyệt'} <ArrowRight />
        </button>
      )}
    </li>
  );
}

export default function ApprovalInbox({ inbox, onNavigate }) {
  const { groups, failed, loading, total, reload } = inbox;

  if (loading && groups.length === 0) {
    return <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  }

  const withItems = groups.filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[13.5px] text-slate-600">
          {total > 0 ? <><b className="text-slate-900">{total}</b> yêu cầu đang chờ bạn xử lý. Bấm "Mở để duyệt" để đến đúng màn duyệt.</> : 'Danh sách tổng hợp các yêu cầu đang chờ duyệt.'}
        </div>
        <button onClick={reload} className="e-btn e-btn-secondary e-btn-sm ml-auto" disabled={loading}><RotateCw className={loading ? 'animate-spin' : ''} /> Tải lại</button>
      </div>

      {withItems.length === 0 ? (
        <div className="e-card"><EmptyState title="Không có yêu cầu nào đang chờ duyệt" description="Đơn nghỉ, ứng lương, tạm ứng, xem phiếu lương mới sẽ hiện ở đây." icon={Inbox} /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          {withItems.map(g => (
            <section key={g.id} className="e-card e-card-pad">
              <header className="e-card-header !mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${g.tone}`}><g.icon className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <div className="e-card-title !text-[16px] truncate">{g.title}</div>
                    {g.hint && <div className="e-card-sub">{g.hint}</div>}
                  </div>
                </div>
                <span className={`e-badge ${g.tone}`}>{g.items.length}</span>
              </header>
              <ul className="divide-y divide-slate-100">
                {g.items.slice(0, 8).map(it => <ItemRow key={it.id} it={it} source={g} onNavigate={onNavigate} />)}
              </ul>
              {g.items.length > 8 && onNavigate && (
                <button onClick={() => onNavigate(g.tab)} className="e-btn e-btn-ghost e-btn-sm mt-2 w-full">Xem tất cả {g.items.length} yêu cầu <ArrowRight /></button>
              )}
            </section>
          ))}
        </div>
      )}

      {groups.length > 0 && groups.length > withItems.length && (
        <div className="text-[12.5px] text-slate-400">
          Không có yêu cầu chờ: {groups.filter(g => g.items.length === 0).map(g => g.title).join(' · ')}
        </div>
      )}
      {failed.length > 0 && (
        <div className="text-[12px] text-slate-400">Chưa đọc được (chưa bật hoặc không có quyền): {failed.join(' · ')}</div>
      )}
    </div>
  );
}
