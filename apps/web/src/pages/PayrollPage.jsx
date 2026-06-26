import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Printer, Save, Lock, TrendingUp, HandCoins, X, Check, KeyRound, Copy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import QRCode from 'qrcode';
import {
  computeSaleOffline, computeTelesale, computeTrucPage, computeDieuDuong, isRecheck,
} from '@/lib/kpiCalc';
import { encryptPayslip } from '@/lib/payslipCrypto';

// Sinh mã bảo mật ngẫu nhiên cho MỖI lần in (bỏ ký tự dễ nhầm: 0 O 1 I L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;
const genPayslipCode = () => {
  const limit = 256 - (256 % CODE_ALPHABET.length); // loại byte gây lệch xác suất (modulo bias)
  let out = '';
  while (out.length < CODE_LEN) {
    const [b] = crypto.getRandomValues(new Uint8Array(1));
    if (b < limit) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return out;
};

// Escape ký tự HTML khi nhúng dữ liệu nhân sự vào cửa sổ in (chống vỡ layout / chèn mã)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  const [pendingSA, setPendingSA] = useState([]);          // đơn ứng lương chờ duyệt
  const [saModal, setSaModal] = useState(null);            // { staff } khi tạo đơn ứng lương
  const [saForm, setSaForm] = useState({ amount: '', reason: '' });
  const [rejectSA, setRejectSA] = useState(null);          // { id } khi từ chối
  const [rejectReason, setRejectReason] = useState('');
  const [codeReveal, setCodeReveal] = useState(null);      // { name, code } — hiện mã 1 lần cho admin sau khi in
  const [copied, setCopied] = useState(false);
  const autosavedRef = useRef('');                         // chống tự-lưu nháp lặp lại cùng 1 tháng

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const meDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const { data: staff } = await supabase.from('profiles')
      .select('id, full_name, employee_id, role, role_2, base_salary, allowance, employment_status, bank_name, bank_account')
      .eq('is_active', true).order('full_name');
    const ids = (staff || []).map(s => s.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];

    const [attRes, apptRes, surgRes, bongRes, cocRes, pageRes, advRes, payRes, histRes, salRes] = await Promise.all([
      supabase.from('attendance').select('staff_id, status, date, overtime_hours').gte('date', ms).lte('date', meDay).in('staff_id', safe),
      supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, status, service').gte('appointment_date', ms).lte('appointment_date', meDay),
      supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, revenue, upsale_revenue, customer_source, bong_date, deposit_date, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids').eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', meDay),
      supabase.from('customer_appointments').select('telesale_id, telesale_id_2, surgery_type').gte('bong_date', ms).lte('bong_date', meDay),
      supabase.from('customer_appointments').select('telesale_id, telesale_id_2, surgery_type').gte('deposit_date', ms).lte('deposit_date', meDay),
      supabase.from('page_daily_reports').select('staff_id, telesale_id, total_phones, total_interested_phones, total_messages, total_spam_messages').gte('date', ms).lte('date', meDay),
      supabase.from('expenses').select('staff_id, amount').eq('is_advance', true).eq('status', 'approved'),
      supabase.from('payroll').select('*').eq('month', month).eq('year', year),
      supabase.from('payroll').select('month, year, net_salary'),
      supabase.from('salary_advances').select('staff_id, amount').eq('status', 'approved').eq('month', month).eq('year', year),
    ]);

    const att = attRes.data || [], appts = apptRes.data || [], surg = surgRes.data || [];
    const bong = bongRes.data || [], coc = cocRes.data || [], pages = pageRes.data || [];
    const adv = advRes.data || [], payroll = payRes.data || [], salAdv = salRes.data || [];

    const workingDaysOf = (id) => att.filter(a => a.staff_id === id && ['present', 'late', 'early_leave'].includes(a.status)).length;
    const advanceOf = (id) => adv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);
    const salaryAdvanceOf = (id) => salAdv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);
    // Tăng ca: số giờ × (CN:200% | thường:150%) × lương cơ bản/26/8
    const overtimeOf = (id, base) => att.filter(a => a.staff_id === id && Number(a.overtime_hours) > 0)
      .reduce((s, a) => {
        const rate = new Date(a.date).getDay() === 0 ? 2 : 1.5;
        return s + Number(a.overtime_hours) * rate * (Number(base || 0) / STANDARD_DAYS / 8);
      }, 0);

    const computed = (staff || []).map(s => {
      const workingDays = workingDaysOf(s.id);
      const effectiveBase = Number(s.base_salary || 0) * (s.employment_status === 'probation' ? 0.85 : 1);
      const luongCong = Math.round(effectiveBase / STANDARD_DAYS * workingDays);
      const phuCap = Number(s.allowance || 0);

      // Hoa hồng theo từng vị trí — cộng dồn nếu kiêm nhiệm 2 vị trí
      const commissionForRole = (role) => {
        if (role === 'sale_offline') {
          return computeSaleOffline(appts.filter(a => a.sale_id === s.id && !isRecheck(a)), surg.filter(a => a.sale_id === s.id)).tongHH;
        } else if (role === 'telesale') {
          const mine = (a) => a.telesale_id === s.id || a.telesale_id_2 === s.id;
          const phones = pages.filter(p => p.telesale_id === s.id).reduce((x, p) => x + Number(p.total_phones || 0), 0);
          return computeTelesale({
            phones,
            appts: appts.filter(a => mine(a) && !isRecheck(a)),
            bongRows: bong.filter(mine), cocRows: coc.filter(mine), surgRows: surg.filter(mine),
          }).tongHH;
        } else if (role === 'truc_page') {
          return computeTrucPage(pages.filter(p => p.staff_id === s.id)).hh;
        } else if (role === 'dieu_duong') {
          return computeDieuDuong(surg, s.id).tongHH;
        }
        return 0;
      };
      const commission = [s.role, s.role_2].filter(Boolean).reduce((sum, role) => sum + commissionForRole(role), 0);

      const saved = payroll.find(p => p.staff_id === s.id);
      const otherBonus = Number(saved?.other_bonus || 0);
      const otherDeduction = Number(saved?.other_deduction || 0);
      const advance = advanceOf(s.id);              // tạm ứng chi (NV chi hộ) → CỘNG (hoàn lại)
      const overtime = Math.round(overtimeOf(s.id, s.base_salary)); // lương tăng ca → CỘNG
      const salaryAdvance = salaryAdvanceOf(s.id);  // ứng lương → TRỪ
      const gross = luongCong + phuCap + commission + overtime + advance + otherBonus;
      const net = gross - salaryAdvance - otherDeduction;

      return { staff: s, workingDays, luongCong, phuCap, commission, overtime, otherBonus, otherDeduction, advance, salaryAdvance, gross, net, savedStatus: saved?.status };
    });

    setRows(computed);
    setEdits(Object.fromEntries(computed.map(r => [r.staff.id, { other_bonus: r.otherBonus, other_deduction: r.otherDeduction }])));
    setLocked((payroll[0]?.status) === 'locked' && payroll.length > 0 && payroll.every(p => p.status === 'locked'));

    // Tự lưu BẢN NHÁP để nhân sự xem được ngay (chỉ admin/kế toán; KHÔNG đụng dòng đã chốt).
    // Chạy 1 lần/tháng để tránh ghi lặp.
    const monthKey = `${year}-${month}`;
    if (['admin', 'accountant'].includes(me?.role) && autosavedRef.current !== monthKey) {
      autosavedRef.current = monthKey;
      const draft = computed
        .filter(r => r.savedStatus !== 'locked')
        .map(r => ({
          staff_id: r.staff.id, month, year,
          base_salary: r.staff.base_salary || 0, allowance: r.phuCap,
          working_days: r.workingDays, salary_by_attendance: r.luongCong,
          total_commission: r.commission, other_bonus: r.otherBonus,
          overtime_pay: r.overtime || 0, salary_advance: r.salaryAdvance || 0,
          unpaid_advance: r.advance, other_deduction: r.otherDeduction,
          gross_income: r.gross, total_deductions: (r.salaryAdvance || 0) + r.otherDeduction, net_salary: r.net,
          status: 'draft', updated_at: new Date().toISOString(),
        }));
      if (draft.length) {
        const { error: draftErr } = await supabase.from('payroll').upsert(draft, { onConflict: 'staff_id,month,year' });
        if (draftErr) toast.error('Tự lưu nháp lỗi (chạy salary_overtime.sql?): ' + draftErr.message);
      }
    }

    // Chart: tổng lương thực nhận theo tháng (từ bảng payroll đã lưu)
    const hist = {};
    (histRes.data || []).forEach(p => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      hist[key] = (hist[key] || 0) + Number(p.net_salary || 0);
    });
    setHistory(Object.entries(hist).sort().slice(-6).map(([k, v]) => ({ name: k, 'Tổng lương': v })));

    // Đơn ứng lương chờ duyệt
    const { data: pend } = await supabase.from('salary_advances')
      .select('*, staff:profiles!staff_id(full_name)').eq('status', 'pending').order('created_at', { ascending: false });
    setPendingSA(pend || []);

    setLoading(false);
  }, [month, year, me?.role]);

  // Tạo đơn ứng lương cho 1 nhân sự
  const submitSalaryAdvance = async () => {
    const amount = Number(String(saForm.amount).replace(/\D/g, '')) || 0;
    if (!amount) { toast.error('Nhập số tiền'); return; }
    const { error } = await supabase.from('salary_advances').insert({
      staff_id: saModal.staff.id, amount, reason: saForm.reason || null,
      month, year, status: 'pending',
    });
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã gửi yêu cầu ứng lương — chờ duyệt');
    setSaModal(null); setSaForm({ amount: '', reason: '' });
    loadData();
  };

  const approveSA = async (id) => {
    const { error } = await supabase.from('salary_advances').update({ status: 'approved', reviewed_by: me?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã duyệt ứng lương'); loadData();
  };

  const doRejectSA = async () => {
    const { error } = await supabase.from('salary_advances').update({ status: 'rejected', reject_reason: rejectReason || 'Không nêu lý do', reviewed_by: me?.id, reviewed_at: new Date().toISOString() }).eq('id', rejectSA.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã từ chối'); setRejectSA(null); setRejectReason(''); loadData();
  };

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Áp dụng chỉnh sửa thưởng/khấu trừ vào row hiển thị
  const rowsView = rows.map(r => {
    const e = edits[r.staff.id] || {};
    const otherBonus = Number(e.other_bonus || 0);
    const otherDeduction = Number(e.other_deduction || 0);
    const gross = r.luongCong + r.phuCap + r.commission + (r.overtime || 0) + r.advance + otherBonus;
    const net = gross - (r.salaryAdvance || 0) - otherDeduction;
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
        overtime_pay: r.overtime || 0, salary_advance: r.salaryAdvance || 0,
        unpaid_advance: r.advance, other_deduction: r.otherDeduction,
        gross_income: r.gross, total_deductions: (r.salaryAdvance || 0) + r.otherDeduction, net_salary: r.net,
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

  const printPayslip = async (r) => {
    const passcode = genPayslipCode();   // mỗi lần in 1 mã ngẫu nhiên mới
    const s = r.staff;

    // Chi tiết lương -> mã hoá -> QR. Phiếu in KHÔNG hiện số tiền nào.
    const items = [
      ['Lương theo công (' + r.workingDays + '/' + STANDARD_DAYS + ' công)', fmtM(r.luongCong)],
      ['Phụ cấp', fmtM(r.phuCap)],
      ['Hoa hồng / thưởng', fmtM(r.commission)],
      ...(r.overtime ? [['Lương tăng ca', '+' + fmtM(r.overtime)]] : []),
      ...(r.advance ? [['Hoàn tạm ứng chi (NV chi hộ)', '+' + fmtM(r.advance)]] : []),
      ['Thưởng khác', fmtM(r.otherBonus)],
      ['Tổng thu nhập', fmtM(r.gross)],
      ...(r.salaryAdvance ? [['Trừ: Ứng lương', '-' + fmtM(r.salaryAdvance)]] : []),
      ['Trừ: Khấu trừ khác', '-' + fmtM(r.otherDeduction)],
    ];
    const payload = {
      n: s.full_name,
      r: (ROLE_LABELS[s.role] || s.role) + (s.employment_status === 'probation' ? ' · Thử việc (85%)' : ''),
      m: `${month}/${year}`,
      bank: s.bank_name ? `${s.bank_name} - ${s.bank_account || ''}` : '',
      items,
      net: fmtM(r.net),
    };

    let qrDataUrl;
    try {
      const token = await encryptPayslip(payload, passcode);
      const url = `${window.location.origin}/phieu-luong#${token}`;
      qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
    } catch {
      toast.error('Không tạo được mã QR phiếu lương');
      return;
    }

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { toast.error('Trình duyệt chặn cửa sổ in'); return; }
    win.document.write(`
      <html><head><meta charset="utf-8"><title>Phiếu lương ${esc(s.full_name)}</title>
      <style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:640px;margin:24px auto;padding:0 16px;position:relative}
      h1{font-size:20px;margin:0}.sub{color:#64748b;font-size:13px}
      .box{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px}
      .qr{text-align:center;margin-top:20px}.qr img{width:240px;height:240px}
      .note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-top:16px;color:#475569;font-size:13px;line-height:1.6}
      .watermark{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:9999;pointer-events:none}
      .watermark span{font-size:64px;font-weight:800;color:#0f766e;opacity:.12;transform:rotate(-30deg);white-space:nowrap;letter-spacing:6px}
      @media print{.watermark span{opacity:.14;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
      <div class="watermark"><span>DR TUAN HUNG</span></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>PHIẾU LƯƠNG</h1><div class="sub">Tháng ${month}/${year}</div></div>
        <div style="text-align:right"><div style="font-weight:700">PK Dr Tuấn Hùng</div><div class="sub">Internal System</div></div>
      </div>
      <div class="box">
        <div style="font-weight:700;font-size:16px">${esc(s.full_name)} <span class="sub">(${esc(s.employee_id)})</span></div>
        <div class="sub">${esc(ROLE_LABELS[s.role] || s.role)}${s.employment_status === 'probation' ? ' · Thử việc (85%)' : ''}</div>
        ${s.bank_name ? `<div class="sub">${esc(s.bank_name)} - ${esc(s.bank_account || '')}</div>` : ''}
      </div>
      <div class="qr"><img src="${qrDataUrl}" alt="QR phiếu lương"/></div>
      <div class="note">
        🔒 <b>Lương được bảo mật.</b> Quét mã QR bằng điện thoại, sau đó nhập <b>mã bảo mật</b> để xem chi tiết lương của bạn.
        Chi tiết từng mục và số tiền chỉ hiển thị sau khi nhập đúng mã.
      </div>
      <p class="sub" style="margin-top:24px;text-align:center">Phiếu lương tạo tự động — ${new Date().toLocaleString('vi-VN')}</p>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);

    // Hiện mã 1 lần cho admin để gửi riêng cho nhân sự (KHÔNG in lên giấy)
    setCopied(false);
    setCodeReveal({ name: s.full_name, code: passcode });
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
                <th className="text-right px-4 py-3 font-medium">Lương tăng ca</th>
                <th className="text-right px-4 py-3 font-medium">Thưởng khác</th>
                <th className="text-right px-4 py-3 font-medium">Tạm ứng chi (hoàn)</th>
                <th className="text-right px-4 py-3 font-medium">Ứng lương</th>
                <th className="text-right px-4 py-3 font-medium">Khấu trừ</th>
                <th className="text-right px-4 py-3 font-medium">Thực nhận</th>
                <th className="px-3 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rowsView.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-8 text-slate-400">Chưa có nhân sự.</td></tr>
                ) : rowsView.map(r => (
                  <tr key={r.staff.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}
                      <div className="text-[11px] text-slate-400">{ROLE_LABELS[r.staff.role] || r.staff.role}{r.staff.employment_status === 'probation' ? ' · TV' : ''}</div></td>
                    <td className="text-center px-3 py-2.5">{r.workingDays}</td>
                    <td className="text-right px-4 py-2.5">{fmtM(r.luongCong)}</td>
                    <td className="text-right px-4 py-2.5 text-slate-500">{fmtM(r.phuCap)}</td>
                    <td className="text-right px-4 py-2.5 text-emerald-700 font-semibold">{fmtM(r.commission)}</td>
                    <td className="text-right px-4 py-2.5 text-emerald-700 font-semibold">{r.overtime ? '+' + fmtM(r.overtime) : '0đ'}</td>
                    <td className="text-right px-2 py-2.5">
                      <input value={fmt(r.otherBonus)} onChange={e => setEdit(r.staff.id, 'other_bonus', e.target.value)} disabled={locked}
                        className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 disabled:bg-slate-50" />
                    </td>
                    <td className="text-right px-4 py-2.5 text-emerald-700">{r.advance ? '+' + fmtM(r.advance) : '0đ'}</td>
                    <td className="text-right px-4 py-2.5 text-rose-600">{r.salaryAdvance ? '−' + fmtM(r.salaryAdvance) : '0đ'}</td>
                    <td className="text-right px-2 py-2.5">
                      <input value={fmt(r.otherDeduction)} onChange={e => setEdit(r.staff.id, 'other_deduction', e.target.value)} disabled={locked}
                        className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 disabled:bg-slate-50" />
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-slate-900">{fmtM(r.net)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setSaModal({ staff: r.staff }); setSaForm({ amount: '', reason: '' }); }} title="Ứng lương" className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"><HandCoins className="w-4 h-4" /></button>
                        <button onClick={() => printPayslip(r)} title="In phiếu lương" className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Printer className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Đơn ứng lương chờ duyệt */}
      {pendingSA.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-4">
          <h3 className="font-bold text-amber-700 mb-3 flex items-center gap-2"><HandCoins className="w-5 h-5" /> Đơn ứng lương chờ duyệt ({pendingSA.length})</h3>
          <div className="space-y-2">
            {pendingSA.map(sa => (
              <div key={sa.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{sa.staff?.full_name} · <span className="text-amber-600">{fmtM(sa.amount)}</span></div>
                  <div className="text-xs text-slate-400">{sa.reason || 'Không nêu lý do'} · {new Date(sa.created_at).toLocaleDateString('vi-VN')}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveSA(sa.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Duyệt</button>
                  <button onClick={() => { setRejectSA(sa); setRejectReason(''); }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Từ chối</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Thực nhận = Lương theo công + Phụ cấp + Hoa hồng + Lương tăng ca + Tạm ứng chi (hoàn lại) + Thưởng khác − Ứng lương − Khấu trừ.
        Tăng ca = số giờ {'×'} (150% ngày thường / 200% chủ nhật) {'×'} Lương cơ bản ÷ {STANDARD_DAYS} ÷ 8.
      </p>

      {/* Modal tạo đơn ứng lương */}
      {saModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-amber-50">
              <div><h3 className="font-bold text-amber-800">Ứng lương</h3><p className="text-xs text-amber-500">{saModal.staff.full_name}</p></div>
              <button onClick={() => setSaModal(null)}><X className="w-5 h-5 text-amber-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Số tiền ứng (VNĐ)</label>
                <input type="text" inputMode="numeric" value={saForm.amount} onChange={e => setSaForm(f => ({ ...f, amount: fmt(Number(e.target.value.replace(/\D/g, ''))) }))} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500 font-bold text-amber-700 text-lg" placeholder="2.000.000" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Lý do</label>
                <textarea rows={2} value={saForm.reason} onChange={e => setSaForm(f => ({ ...f, reason: e.target.value }))} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500 resize-none text-sm" placeholder="Lý do ứng lương..." />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
              <button onClick={() => setSaModal(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Hủy</button>
              <button onClick={submitSalaryAdvance} className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700">Gửi duyệt</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal từ chối ứng lương */}
      {rejectSA && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-800">Từ chối ứng lương</h3>
              <button onClick={() => setRejectSA(null)}><X className="w-5 h-5 text-red-400" /></button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold mb-2 text-slate-700">Lý do từ chối</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:border-red-500 resize-none text-sm" placeholder="Nhập lý do..." />
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
              <button onClick={() => setRejectSA(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Hủy</button>
              <button onClick={doRejectSA} className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Từ chối</button>
            </div>
          </div>
        </div>
      )}

      {codeReveal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-emerald-800 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Mã bảo mật phiếu lương</h3>
              <button onClick={() => setCodeReveal(null)}><X className="w-5 h-5 text-emerald-400" /></button>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-1">Mã xem phiếu lương của</p>
              <p className="font-bold text-slate-800 mb-4">{codeReveal.name}</p>
              <div className="bg-slate-50 border-2 border-dashed border-emerald-200 rounded-xl py-4 mb-2">
                <span className="text-3xl font-bold tracking-[0.3em] text-emerald-700">{codeReveal.code}</span>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(codeReveal.code); setCopied(true); toast.success('Đã copy mã'); }}
                className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-semibold hover:text-emerald-700">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Đã copy' : 'Copy mã'}
              </button>
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-left text-xs text-amber-700 leading-relaxed">
                ⚠️ Mã này <b>chỉ hiện 1 lần</b> và <b>không in lên giấy</b>. Hãy gửi riêng cho nhân sự (Zalo/tin nhắn) để họ quét QR và nhập mã.
                Mỗi lần in sẽ tạo mã mới — nếu quên, chỉ cần in lại.
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setCodeReveal(null)} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700">Xong</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPage;
