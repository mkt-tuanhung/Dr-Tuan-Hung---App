import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Printer, Save, Lock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  computeSaleOffline, computeTelesale, computeTrucPage, computeDieuDuong, isRecheck,
} from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const STANDARD_DAYS = 26;
const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', truc_page: 'Trực Page',
  media: 'Media', marketing: 'Marketing', dieu_duong: 'Điều dưỡng', accountant: 'Kế toán',
  shareholder: 'Cổ đông', admin: 'Admin',
};

const PayrollPage = () => {
  const { profile: me } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({}); // staff_id -> { other_bonus, other_deduction }
  const [locked, setLocked] = useState(false);
  const [history, setHistory] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const meDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const { data: staff } = await supabase.from('profiles')
      .select('id, full_name, employee_id, role, base_salary, allowance, employment_status, bank_name, bank_account')
      .eq('is_active', true).order('full_name');
    const ids = (staff || []).map(s => s.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];

    const [attRes, apptRes, surgRes, bongRes, cocRes, pageRes, advRes, payRes, histRes] = await Promise.all([
      supabase.from('attendance').select('staff_id, status').gte('date', ms).lte('date', meDay).in('staff_id', safe),
      supabase.from('customer_appointments').select('sale_id, telesale_id, status, service').gte('appointment_date', ms).lte('appointment_date', meDay),
      supabase.from('customer_appointments').select('sale_id, telesale_id, revenue, upsale_revenue, bong_date, deposit_date, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, hau_phau_id, additional_hau_phau_ids').eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', meDay),
      supabase.from('customer_appointments').select('telesale_id').gte('bong_date', ms).lte('bong_date', meDay),
      supabase.from('customer_appointments').select('telesale_id').gte('deposit_date', ms).lte('deposit_date', meDay),
      supabase.from('page_daily_reports').select('staff_id, telesale_id, total_phones, total_interested_phones, total_messages, total_spam_messages').gte('date', ms).lte('date', meDay),
      supabase.from('expenses').select('staff_id, amount').eq('is_advance', true).eq('status', 'approved'),
      supabase.from('payroll').select('*').eq('month', month).eq('year', year),
      supabase.from('payroll').select('month, year, net_salary'),
    ]);

    const att = attRes.data || [], appts = apptRes.data || [], surg = surgRes.data || [];
    const bong = bongRes.data || [], coc = cocRes.data || [], pages = pageRes.data || [];
    const adv = advRes.data || [], payroll = payRes.data || [];

    const workingDaysOf = (id) => att.filter(a => a.staff_id === id && ['present', 'late', 'early_leave'].includes(a.status)).length;
    const advanceOf = (id) => adv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);

    const computed = (staff || []).map(s => {
      const workingDays = workingDaysOf(s.id);
      const effectiveBase = Number(s.base_salary || 0) * (s.employment_status === 'probation' ? 0.85 : 1);
      const luongCong = Math.round(effectiveBase / STANDARD_DAYS * workingDays);
      const phuCap = Number(s.allowance || 0);

      let commission = 0;
      if (s.role === 'sale_offline') {
        commission = computeSaleOffline(appts.filter(a => a.sale_id === s.id && !isRecheck(a)), surg.filter(a => a.sale_id === s.id)).tongHH;
      } else if (s.role === 'telesale') {
        const phones = pages.filter(p => p.telesale_id === s.id).reduce((x, p) => x + Number(p.total_phones || 0), 0);
        commission = computeTelesale({
          phones,
          appts: appts.filter(a => a.telesale_id === s.id && !isRecheck(a)),
          bongRows: bong.filter(b => b.telesale_id === s.id),
          cocRows: coc.filter(c => c.telesale_id === s.id),
          surgRows: surg.filter(a => a.telesale_id === s.id),
        }).tongHH;
      } else if (s.role === 'truc_page') {
        commission = computeTrucPage(pages.filter(p => p.staff_id === s.id)).hh;
      } else if (s.role === 'dieu_duong') {
        commission = computeDieuDuong(surg, s.id).tongHH;
      }

      const saved = payroll.find(p => p.staff_id === s.id);
      const otherBonus = Number(saved?.other_bonus || 0);
      const otherDeduction = Number(saved?.other_deduction || 0);
      const advance = advanceOf(s.id);
      const gross = luongCong + phuCap + commission + otherBonus;
      const net = gross - advance - otherDeduction;

      return { staff: s, workingDays, luongCong, phuCap, commission, otherBonus, otherDeduction, advance, gross, net, savedStatus: saved?.status };
    });

    setRows(computed);
    setEdits(Object.fromEntries(computed.map(r => [r.staff.id, { other_bonus: r.otherBonus, other_deduction: r.otherDeduction }])));
    setLocked((payroll[0]?.status) === 'locked' && payroll.length > 0 && payroll.every(p => p.status === 'locked'));

    // Chart: tổng lương thực nhận theo tháng (từ bảng payroll đã lưu)
    const hist = {};
    (histRes.data || []).forEach(p => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      hist[key] = (hist[key] || 0) + Number(p.net_salary || 0);
    });
    setHistory(Object.entries(hist).sort().slice(-6).map(([k, v]) => ({ name: k, 'Tổng lương': v })));

    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Áp dụng chỉnh sửa thưởng/khấu trừ vào row hiển thị
  const rowsView = rows.map(r => {
    const e = edits[r.staff.id] || {};
    const otherBonus = Number(e.other_bonus || 0);
    const otherDeduction = Number(e.other_deduction || 0);
    const gross = r.luongCong + r.phuCap + r.commission + otherBonus;
    const net = gross - r.advance - otherDeduction;
    return { ...r, otherBonus, otherDeduction, gross, net };
  });
  const totalNet = rowsView.reduce((s, r) => s + r.net, 0);

  const setEdit = (id, field, val) => setEdits(e => ({ ...e, [id]: { ...e[id], [field]: val.replace(/\D/g, '') } }));

  const savePayroll = async (lock = false) => {
    setSaving(true);
    try {
      const payload = rowsView.map(r => ({
        staff_id: r.staff.id, month, year,
        base_salary: r.staff.base_salary || 0, allowance: r.phuCap,
        working_days: r.workingDays, salary_by_attendance: r.luongCong,
        total_commission: r.commission, other_bonus: r.otherBonus,
        unpaid_advance: r.advance, other_deduction: r.otherDeduction,
        gross_income: r.gross, total_deductions: r.advance + r.otherDeduction, net_salary: r.net,
        status: lock ? 'locked' : 'draft',
        locked_at: lock ? new Date().toISOString() : null, locked_by: lock ? me?.id : null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('payroll').upsert(payload, { onConflict: 'staff_id,month,year' });
      if (error) throw error;
      toast.success(lock ? 'Đã chốt & lưu bảng lương' : 'Đã lưu bảng lương');
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const printPayslip = (r) => {
    const s = r.staff;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { toast.error('Trình duyệt chặn cửa sổ in'); return; }
    const line = (label, val, strong) => `<tr><td style="padding:6px 0;color:#475569">${label}</td><td style="padding:6px 0;text-align:right;${strong ? 'font-weight:700' : ''}">${val}</td></tr>`;
    win.document.write(`
      <html><head><meta charset="utf-8"><title>Phiếu lương ${s.full_name}</title>
      <style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:640px;margin:24px auto;padding:0 16px}
      h1{font-size:20px;margin:0}.sub{color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;font-size:14px}
      .box{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px}
      .net{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center}
      .net b{font-size:22px;color:#047857}hr{border:none;border-top:1px dashed #cbd5e1;margin:8px 0}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>PHIẾU LƯƠNG</h1><div class="sub">Tháng ${month}/${year}</div></div>
        <div style="text-align:right"><div style="font-weight:700">PK Dr Tuấn Hùng</div><div class="sub">Internal System</div></div>
      </div>
      <div class="box">
        <div style="font-weight:700;font-size:16px">${s.full_name} <span class="sub">(${s.employee_id})</span></div>
        <div class="sub">${ROLE_LABELS[s.role] || s.role}${s.employment_status === 'probation' ? ' · Thử việc (85%)' : ''}</div>
        ${s.bank_name ? `<div class="sub">${s.bank_name} - ${s.bank_account || ''}</div>` : ''}
      </div>
      <div class="box"><table>
        ${line('Lương theo công (' + r.workingDays + '/' + STANDARD_DAYS + ' công)', fmtM(r.luongCong))}
        ${line('Phụ cấp', fmtM(r.phuCap))}
        ${line('Hoa hồng / thưởng', fmtM(r.commission))}
        ${line('Thưởng khác', fmtM(r.otherBonus))}
        <tr><td colspan="2"><hr></td></tr>
        ${line('Tổng thu nhập', fmtM(r.gross), true)}
        ${line('Trừ: Tạm ứng chưa hoàn', '-' + fmtM(r.advance))}
        ${line('Trừ: Khấu trừ khác', '-' + fmtM(r.otherDeduction))}
      </table></div>
      <div class="net"><div style="font-weight:700">THỰC NHẬN</div><b>${fmtM(r.net)}</b></div>
      <p class="sub" style="margin-top:24px;text-align:center">Phiếu lương tạo tự động — ${new Date().toLocaleString('vi-VN')}</p>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Bảng lương</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month - 1]} {year} · Tổng thực nhận: <b className="text-emerald-600">{fmtM(totalNet)}</b>{locked && <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Đã chốt</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {/* Chart lương các tháng */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-emerald-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Tổng lương các tháng</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmtM(v)} />
                <Bar dataKey="Tổng lương" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button onClick={() => savePayroll(false)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 text-emerald-600 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50">
          <Save className="w-4 h-4" /> Lưu nháp
        </button>
        <button onClick={() => savePayroll(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">
          <Lock className="w-4 h-4" /> Chốt lương tháng
        </button>
      </div>

      {/* Bảng lương */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
                <th className="text-left px-4 py-3 font-medium">Nhân sự</th>
                <th className="text-center px-3 py-3 font-medium">Công</th>
                <th className="text-right px-4 py-3 font-medium">Lương theo công</th>
                <th className="text-right px-4 py-3 font-medium">Phụ cấp</th>
                <th className="text-right px-4 py-3 font-medium">Hoa hồng</th>
                <th className="text-right px-4 py-3 font-medium">Thưởng khác</th>
                <th className="text-right px-4 py-3 font-medium">Tạm ứng</th>
                <th className="text-right px-4 py-3 font-medium">Khấu trừ</th>
                <th className="text-right px-4 py-3 font-medium">Thực nhận</th>
                <th className="px-3 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rowsView.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">Chưa có nhân sự.</td></tr>
                ) : rowsView.map(r => (
                  <tr key={r.staff.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}
                      <div className="text-[11px] text-slate-400">{ROLE_LABELS[r.staff.role] || r.staff.role}{r.staff.employment_status === 'probation' ? ' · TV' : ''}</div></td>
                    <td className="text-center px-3 py-2.5">{r.workingDays}</td>
                    <td className="text-right px-4 py-2.5">{fmtM(r.luongCong)}</td>
                    <td className="text-right px-4 py-2.5 text-slate-500">{fmtM(r.phuCap)}</td>
                    <td className="text-right px-4 py-2.5 text-emerald-700 font-semibold">{fmtM(r.commission)}</td>
                    <td className="text-right px-2 py-2.5">
                      <input value={fmt(r.otherBonus)} onChange={e => setEdit(r.staff.id, 'other_bonus', e.target.value)} disabled={locked}
                        className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 disabled:bg-slate-50" />
                    </td>
                    <td className="text-right px-4 py-2.5 text-rose-600">{fmtM(r.advance)}</td>
                    <td className="text-right px-2 py-2.5">
                      <input value={fmt(r.otherDeduction)} onChange={e => setEdit(r.staff.id, 'other_deduction', e.target.value)} disabled={locked}
                        className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 disabled:bg-slate-50" />
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-slate-900">{fmtM(r.net)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => printPayslip(r)} title="In phiếu lương" className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Printer className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Lương theo công = (Lương cơ bản {'×'} 85% nếu thử việc) ÷ {STANDARD_DAYS} công {'×'} số công thực tế. Thực nhận = Lương theo công + Phụ cấp + Hoa hồng + Thưởng khác − Tạm ứng − Khấu trừ.
        Sửa "Thưởng khác"/"Khấu trừ" rồi bấm <b>Lưu nháp</b> hoặc <b>Chốt lương</b> để lưu.
      </p>
    </div>
  );
};

export default PayrollPage;
