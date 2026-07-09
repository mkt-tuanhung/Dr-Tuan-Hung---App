import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Printer, Save, Lock, TrendingUp, HandCoins, X, Check, KeyRound, Copy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import QRCode from 'qrcode';
import {
  computeSaleOffline, computeTelesale, computeTrucPage, computeDieuDuong, computeBacSi, computePartner, isRecheck, SALE_HALF_SOURCES,
} from '@/lib/kpiCalc';
import { encryptPayslip } from '@/lib/payslipCrypto';

// Escape ký tự HTML khi nhúng dữ liệu nhân sự vào cửa sổ in (chống vỡ layout / chèn mã)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const STANDARD_DAYS = 26;
const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH', truc_page: 'Trực Page',
  media: 'Media', marketing: 'Marketing', editor: 'Editor', dieu_duong: 'Điều dưỡng', accountant: 'Kế toán',
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
  const [pendingPV, setPendingPV] = useState([]);          // yêu cầu XEM LƯƠNG chờ duyệt
  const [saModal, setSaModal] = useState(null);            // { staff } khi tạo đơn ứng lương
  const [saForm, setSaForm] = useState({ amount: '', reason: '' });
  const [rejectSA, setRejectSA] = useState(null);          // { id } khi từ chối
  const [rejectReason, setRejectReason] = useState('');
  const [passModal, setPassModal] = useState(null);        // { staff } — đặt mã bảo mật RIÊNG cho từng nhân sự
  const [passInput, setPassInput] = useState('');
  const [saleDetail, setSaleDetail] = useState(null);      // row nhân sự — modal chi tiết hoa hồng + tăng ca
  const autosavedRef = useRef('');                         // chống tự-lưu nháp lặp lại cùng 1 tháng

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const meDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const meNext = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data: staff } = await supabase.from('profiles')
      .select('id, full_name, employee_id, role, role_2, base_salary, allowance, employment_status, fixed_salary, bank_name, bank_account, payslip_code')
      .eq('is_active', true).order('full_name');
    const ids = (staff || []).map(s => s.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];

    const [attRes, apptRes, surgRes, bongRes, cocRes, pageRes, advRes, payRes, histRes, salRes, winRes, partnerRes] = await Promise.all([
      supabase.from('attendance').select('staff_id, status, date, overtime_hours').gte('date', ms).lte('date', meDay).in('staff_id', safe),
      supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, status, service').gte('appointment_date', ms).lte('appointment_date', meDay),
      supabase.from('customer_appointments').select('customer_name, service, sale_id, telesale_id, telesale_id_2, revenue, upsale_revenue, customer_source, bong_date, deposit_date, surgery_type, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids').eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', meDay),
      supabase.from('customer_appointments').select('customer_name, telesale_id, telesale_id_2, surgery_type, customer_source').gte('bong_date', ms).lte('bong_date', meDay),
      supabase.from('customer_appointments').select('customer_name, telesale_id, telesale_id_2, surgery_type, customer_source').gte('deposit_date', ms).lte('deposit_date', meDay),
      supabase.from('page_daily_reports').select('staff_id, telesale_id, total_phones, total_interested_phones, total_messages, total_spam_messages').gte('date', ms).lte('date', meDay),
      supabase.from('expenses').select('staff_id, amount').eq('is_advance', true).eq('status', 'approved').gte('date', ms).lte('date', meDay),
      supabase.from('payroll').select('*').eq('month', month).eq('year', year),
      supabase.from('payroll').select('month, year, net_salary'),
      supabase.from('salary_advances').select('staff_id, amount').eq('status', 'approved').eq('month', month).eq('year', year),
      supabase.from('media_clips').select('editor_id, win, win_amount, approved_to_run').gte('evaluated_at', ms).lt('evaluated_at', meNext),
      supabase.from('partner_surgeries').select('customer_name, partner_name, surgery_type, partner_fee, surgery_fee, partner_paid, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id').gte('surgery_date', ms).lte('surgery_date', meDay),
    ]);

    const att = attRes.data || [], appts = apptRes.data || [], surg = surgRes.data || [];
    const bong = bongRes.data || [], coc = cocRes.data || [], pages = pageRes.data || [], partner = partnerRes.data || [];
    const adv = advRes.data || [], payroll = payRes.data || [], salAdv = salRes.data || [];
    const contentWins = winRes.data || [];
    const winBonusOf = (id) => contentWins.filter(w => w.editor_id === id).reduce((s, w) => s + (w.win ? Number(w.win_amount || 0) : 0) + (w.approved_to_run ? 500000 : 0), 0);

    const workingDaysOf = (id) => att.filter(a => a.staff_id === id && ['present', 'late', 'early_leave'].includes(a.status)).length;
    const advanceOf = (id) => adv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);
    const salaryAdvanceOf = (id) => salAdv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);
    // Tăng ca: số giờ × (CN:200% | thường:150%) × lương cơ bản/26/8
    const overtimeOf = (id, base) => att.filter(a => a.staff_id === id && Number(a.overtime_hours) > 0)
      .reduce((s, a) => {
        const rate = new Date(a.date).getDay() === 0 ? 2 : 1.5;
        return s + Number(a.overtime_hours) * rate * (Number(base || 0) / STANDARD_DAYS / 8);
      }, 0);
    const overtimeHoursOf = (id) => att.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.overtime_hours || 0), 0);

    const computed = (staff || []).map(s => {
      const workingDays = workingDaysOf(s.id);
      const effectiveBase = Number(s.base_salary || 0) * (s.employment_status === 'probation' ? 0.85 : 1);
      // Lương cố định: nhận đủ lương tháng, KHÔNG trừ theo ngày công (không cần chấm công)
      const luongCong = s.fixed_salary
        ? Math.round(effectiveBase)
        : Math.round(effectiveBase / STANDARD_DAYS * workingDays);
      const phuCap = Number(s.allowance || 0);

      // Tính chi tiết từng vị trí một lần — dùng chung cho tổng HH + modal chi tiết
      const rolesArr = [s.role, s.role_2].filter(Boolean);
      const mineTele = (a) => a.telesale_id === s.id || a.telesale_id_2 === s.id;
      const telePhones = pages.filter(p => p.telesale_id === s.id).reduce((x, p) => x + Number(p.total_phones || 0), 0);

      const saleOff = rolesArr.includes('sale_offline')
        ? computeSaleOffline(appts.filter(a => a.sale_id === s.id && !isRecheck(a)), surg.filter(a => a.sale_id === s.id))
        : null;
      const teleOff = rolesArr.includes('telesale')
        ? computeTelesale({ phones: telePhones, appts: appts.filter(a => mineTele(a) && !isRecheck(a)), bongRows: bong.filter(mineTele), cocRows: coc.filter(mineTele), surgRows: surg.filter(mineTele) })
        : null;
      const ddOff = rolesArr.includes('dieu_duong') ? computeDieuDuong(surg, s.id) : null;
      const trucOff = rolesArr.includes('truc_page') ? computeTrucPage(pages.filter(p => p.staff_id === s.id)) : null;
      const bacSiOff = rolesArr.includes('bac_si') ? computeBacSi(surg, s.id) : null;
      // Mổ đối tác: BS nhận 50% tiền đối tác, ĐD phụ mổ như khách nội bộ (áp dụng cho mọi nhân sự được phân)
      const partnerOff = computePartner(partner, s.id);
      const wins = winBonusOf(s.id);

      const commission = (saleOff?.tongHH || 0) + (teleOff?.tongHH || 0) + (ddOff?.tongHH || 0) + (trucOff?.hh || 0) + (bacSiOff?.tongHH || 0) + (partnerOff?.tongHH || 0) + wins;

      // Thành phần cho Trực page / Editor (các vị trí không có bảng từng khách)
      const commDetail = [];
      if (trucOff?.hh) commDetail.push({ label: `SĐT quan tâm (${trucOff.interested} × 20.000đ)`, amount: trucOff.hh });
      if (wins) commDetail.push({ label: 'Thưởng clip (Media/Editor)', amount: wins });

      // Chi tiết tăng ca theo từng ngày
      const otDetail = att.filter(a => a.staff_id === s.id && Number(a.overtime_hours) > 0)
        .map(a => {
          const rate = new Date(a.date).getDay() === 0 ? 2 : 1.5;
          return { date: a.date, hours: Number(a.overtime_hours), rate, amount: Math.round(Number(a.overtime_hours) * rate * (Number(s.base_salary || 0) / STANDARD_DAYS / 8)) };
        })
        .sort((x, y) => (x.date < y.date ? -1 : 1));

      const saved = payroll.find(p => p.staff_id === s.id);
      const otherBonus = Number(saved?.other_bonus || 0);
      const otherDeduction = Number(saved?.other_deduction || 0);
      const advance = advanceOf(s.id);              // tạm ứng chi (NV chi hộ) — KHÔNG cộng vào lương, thanh toán riêng
      const overtime = Math.round(overtimeOf(s.id, s.base_salary)); // lương tăng ca → CỘNG
      const salaryAdvance = salaryAdvanceOf(s.id);  // ứng lương → TRỪ
      const gross = luongCong + phuCap + commission + overtime + otherBonus;
      const net = gross - salaryAdvance - otherDeduction;

      const overtimeHours = overtimeHoursOf(s.id);
      const daysOff = Math.max(0, STANDARD_DAYS - workingDays);
      return { staff: s, workingDays, daysOff, overtimeHours, luongCong, phuCap, commission, overtime, otherBonus, otherDeduction, advance, salaryAdvance, gross, net, savedStatus: saved?.status, saleOff, teleOff, ddOff, bacSiOff, partnerOff, commDetail, otDetail };
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
          unpaid_advance: 0, other_deduction: r.otherDeduction,
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

    // Yêu cầu xem lương chờ duyệt (duyệt ngay trong app, không cần Telegram)
    const { data: pv } = await supabase.rpc('payslip_pending_requests');
    setPendingPV(pv || []);

    setLoading(false);
  }, [month, year, me?.role]);

  // Duyệt / từ chối xem lương ngay trong app
  const resolvePV = async (id, approve) => {
    const { data: res, error } = await supabase.rpc('resolve_payslip_view', { p_id: id, p_approve: approve });
    if (error) { toast.error(error.message); return; }
    if (res === 'approved') toast.success('Đã duyệt xem lương');
    else if (res === 'rejected') toast.success('Đã từ chối xem lương');
    else toast(res || 'Đã xử lý');
    setPendingPV(list => list.filter(p => p.id !== id));
  };

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

  // Tự làm mới danh sách yêu cầu xem lương (để duyệt kịp thời, không cần Telegram)
  useEffect(() => {
    const t = setInterval(async () => {
      const { data: pv } = await supabase.rpc('payslip_pending_requests');
      setPendingPV(pv || []);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Áp dụng chỉnh sửa thưởng/khấu trừ vào row hiển thị
  const rowsView = rows.map(r => {
    const e = edits[r.staff.id] || {};
    const otherBonus = Number(e.other_bonus || 0);
    const otherDeduction = Number(e.other_deduction || 0);
    const gross = r.luongCong + r.phuCap + r.commission + (r.overtime || 0) + otherBonus;
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
        unpaid_advance: 0, other_deduction: r.otherDeduction,
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
    const s = r.staff;
    const passcode = (s.payslip_code || '').trim();
    if (!passcode) { toast.error(`Hãy đặt mã bảo mật RIÊNG cho ${s.full_name} trước khi in`); setPassInput(''); setPassModal({ staff: s }); return; }

    // Chi tiết lương -> mã hoá -> QR. Phiếu in KHÔNG hiện số tiền nào.
    const congLabel = s.fixed_salary
      ? 'Lương (cố định — đủ tháng)'
      : `Lương theo công (${r.workingDays} công · nghỉ ${r.daysOff}/${STANDARD_DAYS})`;
    const items = [
      [congLabel, fmtM(r.luongCong)],
      ['Phụ cấp', fmtM(r.phuCap)],
      ['Hoa hồng / thưởng', fmtM(r.commission)],
      ...(r.overtime ? [[`Lương tăng ca (${r.overtimeHours} giờ)`, '+' + fmtM(r.overtime)]] : []),
      ['Thưởng khác', fmtM(r.otherBonus)],
      ['Tổng thu nhập', fmtM(r.gross)],
      ...(r.salaryAdvance ? [['Trừ: Ứng lương', '-' + fmtM(r.salaryAdvance)]] : []),
      ['Trừ: Khấu trừ khác', '-' + fmtM(r.otherDeduction)],
    ];
    // Chi tiết hoa hồng theo TỪNG khách/ca cho mọi vị trí — {n:tên, d:mô tả, a:tiền}
    const hhDetail = [];
    (r.saleOff?.perCustomer || []).forEach(c => hhDetail.push({ n: c.name, d: `Sale · DT ${fmtM(c.revenue)}${c.upsale ? ` · Upsale ${fmtM(c.upsale)}` : ''}`, a: fmtM(c.hh) }));
    (r.teleOff?.perCustomer || []).forEach(c => hhDetail.push({ n: c.name, d: `Telesale · ${c.journey} · ${c.dai ? 'Đại' : 'Tiểu'}${c.half ? ` · ${c.source || 'Quen/CTV'} 50%` : ''}`, a: fmtM(c.hh) }));
    (r.ddOff?.perCase || []).forEach(c => hhDetail.push({ n: c.name, d: `${c.surgeryType} · ${c.roles.join(', ')}`, a: fmtM(c.bonus) }));
    (r.bacSiOff?.perCase || []).forEach(c => hhDetail.push({ n: c.name, d: `Công mổ ${c.surgeryType} · ${c.ratePct}%`, a: fmtM(c.cong) }));
    (r.partnerOff?.bacSiCases || []).forEach(c => hhDetail.push({ n: c.name, d: `Mổ đối tác ${c.surgeryType} · công BS 50%${c.partner ? ` · ${c.partner}` : ''}`, a: fmtM(c.cong) }));
    (r.partnerOff?.phuMoCases || []).forEach(c => hhDetail.push({ n: c.name, d: `Mổ đối tác ${c.surgeryType} · ${c.roles.join(', ')}${c.partner ? ` · ${c.partner}` : ''}`, a: fmtM(c.bonus) }));
    (r.commDetail || []).forEach(d => hhDetail.push({ n: d.label, d: '', a: fmtM(d.amount) }));
    const payload = {
      n: s.full_name,
      r: (ROLE_LABELS[s.role] || s.role) + (s.employment_status === 'probation' ? ' · Thử việc (85%)' : ''),
      m: `${month}/${year}`,
      k: `${s.id}:${month}/${year}`,   // định danh phiếu (phát hiện thiết bị xem trùng)
      bank: s.bank_name ? `${s.bank_name} - ${s.bank_account || ''}` : '',
      items,
      ...(hhDetail.length ? { hh: hhDetail } : {}),
      net: fmtM(r.net),
    };

    let qrDataUrl;
    try {
      const token = await encryptPayslip(payload, passcode.toUpperCase());
      // Lưu blob mã hoá ở máy chủ, QR chỉ chứa id ngắn -> QR nhỏ, luôn quét được
      const { data: pid, error: saveErr } = await supabase.rpc('save_payslip', {
        p_key: payload.k, p_staff: payload.n, p_period: payload.m, p_token: token,
      });
      if (saveErr || !pid) throw saveErr || new Error('no id');
      const url = `${window.location.origin}/phieu-luong#${pid}`;
      qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
    } catch (err) {
      toast.error('Không tạo được mã QR phiếu lương' + (err?.message ? ': ' + err.message : ''));
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
        🔒 <b>Lương được bảo mật.</b> Quét mã QR → nhập <b>mã bảo mật</b> → gửi yêu cầu, <b>chờ Admin duyệt</b> mới xem được chi tiết lương.
        Mỗi lần xem đều cần Admin duyệt; xem trên 2 thiết bị sẽ bị cảnh báo.
      </div>
      <p class="sub" style="margin-top:24px;text-align:center">Phiếu lương tạo tự động — ${new Date().toLocaleString('vi-VN')}</p>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const savePasscode = async () => {
    if (!passModal?.staff) return;
    const code = passInput.trim().toUpperCase();
    if (code.length < 4) { toast.error('Mã bảo mật cần tối thiểu 4 ký tự'); return; }
    const staffId = passModal.staff.id;
    const { error } = await supabase.from('profiles').update({ payslip_code: code }).eq('id', staffId);
    if (error) { toast.error('Không lưu được mã: ' + error.message); return; }
    // Cập nhật ngay trong bảng để in được luôn, không cần tải lại
    setRows(rs => rs.map(r => r.staff.id === staffId ? { ...r, staff: { ...r.staff, payslip_code: code } } : r));
    setPassModal(null);
    setPassInput('');
    toast.success(`Đã đặt mã bảo mật riêng cho ${passModal.staff.full_name}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Bảng lương</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month - 1]} {year} · Tổng thực nhận: <b className="text-teal-600">{fmtM(totalNet)}</b>{locked && <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Đã chốt</span>}</p>
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
          <h3 className="font-bold text-teal-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Tổng lương các tháng</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmtM(v)} />
                <Bar dataKey="Tổng lương" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button onClick={() => savePayroll(false)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-teal-200 text-teal-600 text-sm font-semibold hover:bg-teal-50 disabled:opacity-50">
          <Save className="w-4 h-4" /> Lưu nháp
        </button>
        <button onClick={() => savePayroll(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">
          <Lock className="w-4 h-4" /> Chốt lương tháng
        </button>
      </div>

      {/* Bảng lương */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
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
                <th className="text-right px-4 py-3 font-medium">Ứng lương</th>
                <th className="text-right px-4 py-3 font-medium">Khấu trừ</th>
                <th className="text-right px-4 py-3 font-medium">Thực nhận</th>
                <th className="px-3 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rowsView.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-slate-400">Chưa có nhân sự.</td></tr>
                ) : rowsView.map(r => (
                  <tr key={r.staff.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}
                      <div className="text-[11px] text-slate-400">{ROLE_LABELS[r.staff.role] || r.staff.role}{r.staff.employment_status === 'probation' ? ' · TV' : ''}</div></td>
                    <td className="text-center px-3 py-2.5">{r.workingDays}</td>
                    <td className="text-right px-4 py-2.5">{fmtM(r.luongCong)}</td>
                    <td className="text-right px-4 py-2.5 text-slate-500">{fmtM(r.phuCap)}</td>
                    <td className="text-right px-4 py-2.5 text-teal-700 font-semibold">{fmtM(r.commission)}
                      {r.commission > 0 && (
                        <button onClick={() => setSaleDetail(r)}
                          className="block ml-auto mt-0.5 text-[11px] font-normal text-blue-500 hover:underline">
                          Chi tiết
                        </button>
                      )}</td>
                    <td className="text-right px-4 py-2.5 text-teal-700 font-semibold">{r.overtime ? '+' + fmtM(r.overtime) : '0đ'}
                      {r.otDetail?.length > 0 && (
                        <button onClick={() => setSaleDetail(r)}
                          className="block ml-auto mt-0.5 text-[11px] font-normal text-blue-500 hover:underline">
                          {r.overtimeHours}h · chi tiết
                        </button>
                      )}</td>
                    <td className="text-right px-2 py-2.5">
                      <input value={fmt(r.otherBonus)} onChange={e => setEdit(r.staff.id, 'other_bonus', e.target.value)} disabled={locked}
                        className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-400 disabled:bg-slate-50" />
                    </td>
                    <td className="text-right px-4 py-2.5 text-rose-600">{r.salaryAdvance ? '−' + fmtM(r.salaryAdvance) : '0đ'}</td>
                    <td className="text-right px-2 py-2.5">
                      <input value={fmt(r.otherDeduction)} onChange={e => setEdit(r.staff.id, 'other_deduction', e.target.value)} disabled={locked}
                        className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-400 disabled:bg-slate-50" />
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-slate-900">{fmtM(r.net)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setSaModal({ staff: r.staff }); setSaForm({ amount: '', reason: '' }); }} title="Ứng lương" className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"><HandCoins className="w-4 h-4" /></button>
                        <button onClick={() => { setPassInput(''); setPassModal({ staff: r.staff }); }} title={r.staff.payslip_code ? 'Đổi mã bảo mật phiếu lương' : 'Đặt mã bảo mật phiếu lương'}
                          className={`p-1.5 rounded-lg hover:bg-teal-50 ${r.staff.payslip_code ? 'text-teal-500 hover:text-teal-700' : 'text-amber-500 hover:text-amber-600'}`}><KeyRound className="w-4 h-4" /></button>
                        <button onClick={() => printPayslip(r)} title="In phiếu lương" className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"><Printer className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Yêu cầu XEM LƯƠNG chờ duyệt — duyệt ngay trong app */}
      {pendingPV.length > 0 && (
        <div className="bg-white border border-teal-200 rounded-2xl shadow-sm p-4">
          <h3 className="font-bold text-teal-700 mb-3 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Yêu cầu xem lương chờ duyệt ({pendingPV.length})</h3>
          <div className="space-y-2">
            {pendingPV.map(pv => (
              <div key={pv.id} className={`flex items-center justify-between gap-3 border rounded-xl p-3 ${pv.is_duplicate ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100'}`}>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{pv.staff_name || '—'} <span className="text-slate-400 font-normal">· {pv.period || ''}</span></div>
                  <div className="text-xs text-slate-400 truncate">📱 {pv.device_label || 'Thiết bị ?'}{pv.is_duplicate && <span className="text-rose-600 font-semibold"> · ⚠️ Thiết bị khác đã/đang xem phiếu này</span>}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resolvePV(pv.id, true)} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Duyệt</button>
                  <button onClick={() => resolvePV(pv.id, false)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Từ chối</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Tự làm mới mỗi 15 giây · nhân sự sẽ thấy lương ngay sau khi bạn duyệt.</p>
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
                  <button onClick={() => approveSA(sa.id)} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Duyệt</button>
                  <button onClick={() => { setRejectSA(sa); setRejectReason(''); }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Từ chối</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Thực nhận = Lương theo công + Phụ cấp + Hoa hồng + Lương tăng ca + Thưởng khác − Ứng lương − Khấu trừ. (Tạm ứng chi thanh toán riêng, không tính vào đây.)
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

      {passModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-teal-50">
              <div>
                <h3 className="font-bold text-teal-800 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Mã bảo mật phiếu lương</h3>
                <p className="text-xs text-teal-500 mt-0.5">{passModal.staff.full_name}</p>
              </div>
              <button onClick={() => setPassModal(null)}><X className="w-5 h-5 text-teal-400" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">
                Mỗi nhân sự có <b>một mã riêng</b> để mã hoá & mở phiếu lương. Chia sẻ mã này cho đúng <b>{passModal.staff.full_name}</b>.
                Sau khi nhập mã, nhân sự vẫn cần <b>Admin duyệt</b> mới xem được chi tiết.
              </p>
              <label className="block text-sm font-semibold mb-2 text-slate-700">Mã bảo mật (≥ 4 ký tự)</label>
              <input type="text" autoFocus value={passInput} onChange={e => setPassInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') savePasscode(); }}
                className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 text-center tracking-widest text-lg" placeholder="VD: 2468" />
              {passModal.staff.payslip_code && <p className="text-xs text-slate-400 mt-2">Nhân sự này đã có mã. Nhập mã mới để thay đổi.</p>}
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
              <button onClick={() => setPassModal(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Hủy</button>
              <button onClick={savePasscode} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700">Lưu mã</button>
            </div>
          </div>
        </div>
      )}

      {saleDetail && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-teal-50 shrink-0">
              <div>
                <h3 className="font-bold text-teal-800">Chi tiết lương — {saleDetail.staff.full_name}</h3>
                <p className="text-xs text-teal-600 mt-0.5">{ROLE_LABELS[saleDetail.staff.role] || saleDetail.staff.role}{saleDetail.staff.role_2 ? ' + ' + (ROLE_LABELS[saleDetail.staff.role_2] || saleDetail.staff.role_2) : ''} · {MONTHS[month - 1]} {year}</p>
              </div>
              <button onClick={() => setSaleDetail(null)}><X className="w-5 h-5 text-teal-400" /></button>
            </div>
            <div className="overflow-auto p-5 space-y-6">
              {/* Hoa hồng / thưởng */}
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hoa hồng / thưởng · Tổng {fmtM(saleDetail.commission)}</div>
                {saleDetail.commDetail?.length > 0 && (
                  <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl mb-3">
                    {saleDetail.commDetail.map((d, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-600 pr-2">{d.label}</span>
                        <span className="font-semibold text-teal-700 tabular-nums shrink-0">{fmtM(d.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {saleDetail.saleOff?.perCustomer?.length > 0 && (
                  <div className="overflow-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Khách (Sale Offline)</th>
                          <th className="text-left px-3 py-2 font-medium">Nguồn</th>
                          <th className="text-right px-3 py-2 font-medium">Doanh thu</th>
                          <th className="text-right px-3 py-2 font-medium">Upsale</th>
                          <th className="text-right px-3 py-2 font-medium">HH cơ bản</th>
                          <th className="text-right px-3 py-2 font-medium">HH upsale</th>
                          <th className="text-right px-3 py-2 font-medium">Tổng HH</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {saleDetail.saleOff.perCustomer.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.service && <div className="text-[11px] text-slate-400">{c.service}</div>}</td>
                            <td className="px-3 py-2 text-slate-500">{c.source || '—'}{SALE_HALF_SOURCES.includes(c.source) && <span className="text-[10px] text-amber-600"> ·×50%</span>}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtM(c.revenue)}</td>
                            <td className="text-right px-3 py-2 tabular-nums text-orange-600">{c.upsale ? fmtM(c.upsale) : '—'}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtM(c.hhBase)} <span className="text-[10px] text-slate-400">({c.dtRate}%)</span></td>
                            <td className="text-right px-3 py-2 tabular-nums">{c.hhUp ? `${fmtM(c.hhUp)} (${c.upRate}%)` : '—'}</td>
                            <td className="text-right px-3 py-2 font-bold text-teal-700 tabular-nums">{fmtM(c.hh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {saleDetail.teleOff?.perCustomer?.length > 0 && (
                  <div className="overflow-auto border border-slate-100 rounded-xl mt-3">
                    <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 border-b">Telesale · Thưởng DT {fmtM(saleDetail.teleOff.thuongDoanhThu)} ({saleDetail.teleOff.dtRate}%) + Thưởng hẹn {fmtM(saleDetail.teleOff.thuongLichHen)}</div>
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Khách</th>
                          <th className="text-left px-3 py-2 font-medium">Giai đoạn</th>
                          <th className="text-right px-3 py-2 font-medium">Doanh thu</th>
                          <th className="text-right px-3 py-2 font-medium">Thưởng DT</th>
                          <th className="text-right px-3 py-2 font-medium">Thưởng hẹn</th>
                          <th className="text-right px-3 py-2 font-medium">Tổng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {saleDetail.teleOff.perCustomer.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.share === 0.5 && <span className="text-[10px] text-amber-600"> ·½</span>}{c.half && <span className="text-[10px] text-rose-500"> ·{c.source || 'Quen/CTV'} 50%</span>}</td>
                            <td className="px-3 py-2 text-slate-500">{c.journey} · {c.dai ? 'Đại' : 'Tiểu'}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{c.revenue ? fmtM(c.revenue) : '—'}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{c.hhRev ? fmtM(c.hhRev) : '—'}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{c.hhHen ? fmtM(c.hhHen) : '—'}</td>
                            <td className="text-right px-3 py-2 font-bold text-teal-700 tabular-nums">{fmtM(c.hh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {saleDetail.ddOff?.perCase?.length > 0 && (
                  <div className="overflow-auto border border-slate-100 rounded-xl mt-3">
                    <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 border-b">Điều dưỡng · từng ca mổ</div>
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Khách</th>
                          <th className="text-left px-3 py-2 font-medium">Loại PT</th>
                          <th className="text-left px-3 py-2 font-medium">Vai trò</th>
                          <th className="text-right px-3 py-2 font-medium">Thưởng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {saleDetail.ddOff.perCase.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="px-3 py-2 text-slate-500">{c.roles.join(', ')}</td>
                            <td className="text-right px-3 py-2 font-bold text-teal-700 tabular-nums">{fmtM(c.bonus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {saleDetail.bacSiOff?.perCase?.length > 0 && (
                  <div className="overflow-auto border border-slate-100 rounded-xl mt-3">
                    <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 border-b">Bác sĩ · công mổ (Tiểu 10% · Đại 5% doanh thu)</div>
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Khách</th>
                          <th className="text-left px-3 py-2 font-medium">Loại PT</th>
                          <th className="text-right px-3 py-2 font-medium">Doanh thu</th>
                          <th className="text-right px-3 py-2 font-medium">%</th>
                          <th className="text-right px-3 py-2 font-medium">Công mổ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {saleDetail.bacSiOff.perCase.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtM(c.revenue)}</td>
                            <td className="text-right px-3 py-2 tabular-nums text-slate-500">{c.ratePct}%</td>
                            <td className="text-right px-3 py-2 font-bold text-teal-700 tabular-nums">{fmtM(c.cong)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(saleDetail.partnerOff?.bacSiCases?.length > 0 || saleDetail.partnerOff?.phuMoCases?.length > 0) && (
                  <div className="overflow-auto border border-amber-100 rounded-xl mt-3">
                    <div className="px-3 py-1.5 bg-amber-50 text-[11px] font-semibold text-amber-700 border-b">Mổ đối tác · BS 50% tiền đối tác · phụ mổ như khách nội bộ</div>
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Khách</th>
                          <th className="text-left px-3 py-2 font-medium">Loại PT</th>
                          <th className="text-left px-3 py-2 font-medium">Vai trò</th>
                          <th className="text-right px-3 py-2 font-medium">Nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(saleDetail.partnerOff.bacSiCases || []).map((c, i) => (
                          <tr key={'b' + i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.partner ? <span className="text-[11px] text-amber-600"> · {c.partner}</span> : ''}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="px-3 py-2 text-blue-600">Công BS 50% ({fmtM(c.fee)})</td>
                            <td className="text-right px-3 py-2 font-bold text-teal-700 tabular-nums">{fmtM(c.cong)}</td>
                          </tr>
                        ))}
                        {(saleDetail.partnerOff.phuMoCases || []).map((c, i) => (
                          <tr key={'p' + i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.partner ? <span className="text-[11px] text-amber-600"> · {c.partner}</span> : ''}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="px-3 py-2 text-slate-500">{c.roles.join(', ')}</td>
                            <td className="text-right px-3 py-2 font-bold text-teal-700 tabular-nums">{fmtM(c.bonus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!saleDetail.commDetail?.length && !saleDetail.saleOff?.perCustomer?.length && !saleDetail.teleOff?.perCustomer?.length && !saleDetail.ddOff?.perCase?.length && !saleDetail.bacSiOff?.perCase?.length && !saleDetail.partnerOff?.bacSiCases?.length && !saleDetail.partnerOff?.phuMoCases?.length && (
                  <div className="text-sm text-slate-400 italic">Không có hoa hồng/thưởng trong tháng.</div>
                )}
              </div>

              {/* Tăng ca theo ngày */}
              {saleDetail.otDetail?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tăng ca · {saleDetail.overtimeHours} giờ · {fmtM(saleDetail.overtime)}</div>
                  <div className="overflow-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Ngày</th>
                          <th className="text-right px-3 py-2 font-medium">Số giờ</th>
                          <th className="text-right px-3 py-2 font-medium">Hệ số</th>
                          <th className="text-right px-3 py-2 font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {saleDetail.otDetail.map((o, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-700">{new Date(o.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{o.hours}h</td>
                            <td className="text-right px-3 py-2 tabular-nums text-slate-500">{o.rate === 2 ? '200% (CN)' : '150%'}</td>
                            <td className="text-right px-3 py-2 font-semibold text-teal-700 tabular-nums">{fmtM(o.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPage;
