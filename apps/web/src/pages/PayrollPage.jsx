import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Printer, Save, Lock, TrendingUp, HandCoins, X, Check, KeyRound, Copy, ImageDown, Wallet, UserRound } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import QRCode from 'qrcode';
import {
  computeSaleOffline, computeTelesale, computeTrucPage, computeDieuDuong, computeBacSi, computePartner, computeSeeding, computeOvertime, fetchTelesalePrior, isRecheck, SALE_HALF_SOURCES,
} from '@/lib/kpiCalc';
import { encryptPayslip } from '@/lib/payslipCrypto';

// Escape ký tự HTML khi nhúng dữ liệu nhân sự vào cửa sổ in (chống vỡ layout / chèn mã)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const STANDARD_DAYS = 26;
// Nhãn trạng thái chấm công KHÔNG tính là ngày công (dùng cho chi tiết ngày nghỉ)
const ATT_STATUS_LABEL = { leave: 'Nghỉ phép', half_day: 'Nghỉ nửa ngày', absent: 'Vắng', unpaid_leave: 'Nghỉ không lương', sick: 'Nghỉ ốm' };
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
  const [exportSel, setExportSel] = useState(new Set()); // nhân sự được TÍCH để xuất ảnh
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
      .select('id, full_name, employee_id, role, role_2, position, base_salary, allowance, employment_status, fixed_salary, bank_name, bank_account, payslip_code')
      .eq('is_active', true).order('full_name');
    const ids = (staff || []).map(s => s.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];

    const [attRes, apptRes, surgRes, bongRes, cocRes, pageRes, advRes, payRes, histRes, salRes, winRes, partnerRes, prior] = await Promise.all([
      supabase.from('attendance').select('staff_id, status, date, overtime_hours, late_early_hours').gte('date', ms).lte('date', meDay).in('staff_id', safe),
      supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, status, service').gte('appointment_date', ms).lte('appointment_date', meDay),
      supabase.from('customer_appointments').select('customer_name, phone, service, sale_id, telesale_id, telesale_id_2, revenue, upsale_revenue, hospital_fee, customer_source, bong_date, deposit_date, surgery_type, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids').eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', meDay),
      supabase.from('customer_appointments').select('customer_name, phone, consult_received, telesale_id, telesale_id_2, surgery_type, customer_source').gte('bong_date', ms).lte('bong_date', meDay),
      supabase.from('customer_appointments').select('customer_name, phone, consult_received, telesale_id, telesale_id_2, surgery_type, customer_source').gte('deposit_date', ms).lte('deposit_date', meDay),
      supabase.from('page_daily_reports').select('staff_id, telesale_id, total_phones, total_interested_phones, total_messages, total_spam_messages').gte('date', ms).lte('date', meDay),
      supabase.from('expenses').select('staff_id, amount').eq('is_advance', true).eq('status', 'approved').gte('date', ms).lte('date', meDay),
      supabase.from('payroll').select('*').eq('month', month).eq('year', year),
      supabase.from('payroll').select('month, year, net_salary'),
      supabase.from('salary_advances').select('staff_id, amount').eq('status', 'approved').eq('month', month).eq('year', year),
      supabase.from('media_clips').select('editor_id, win, win_amount, approved_to_run').gte('evaluated_at', ms).lt('evaluated_at', meNext),
      supabase.from('partner_surgeries').select('customer_name, partner_name, surgery_type, partner_fee, surgery_fee, partner_paid, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id').gte('surgery_date', ms).lte('surgery_date', meDay),
      fetchTelesalePrior(ms), // lịch sử bong/cọc trước tháng — chống thưởng lịch hẹn lặp
    ]);

    const att = attRes.data || [], appts = apptRes.data || [], surg = surgRes.data || [];
    const bong = bongRes.data || [], coc = cocRes.data || [], pages = pageRes.data || [], partner = partnerRes.data || [];
    const adv = advRes.data || [], payroll = payRes.data || [], salAdv = salRes.data || [];
    const contentWins = winRes.data || [];
    // Editor OUTSOURCE không nhận 500k/clip duyệt (chỉ nhận thưởng Win nếu có)
    const winBonusOf = (id, isOutsource) => contentWins.filter(w => w.editor_id === id).reduce((s, w) => s + (w.win ? Number(w.win_amount || 0) : 0) + (w.approved_to_run && !isOutsource ? 500000 : 0), 0);

    // Số công = tổng ngày chấm công CÓ MẶT (present/đi muộn/về sớm = 1 công; nghỉ nửa ngày = 0.5 công)
    const workingDaysOf = (id) => att.filter(a => a.staff_id === id)
      .reduce((s, a) => s + (['present', 'late', 'early_leave'].includes(a.status) ? 1 : a.status === 'half_day' ? 0.5 : 0), 0);
    const advanceOf = (id) => adv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);
    const salaryAdvanceOf = (id) => salAdv.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.amount || 0), 0);
    // Tăng ca (đã trừ giờ đi muộn/về sớm) — computeOvertime dùng chung
    const overtimeOf = (id, base) => computeOvertime(att.filter(a => a.staff_id === id), base, STANDARD_DAYS).pay;
    const overtimeInfoOf = (id, base) => computeOvertime(att.filter(a => a.staff_id === id), base, STANDARD_DAYS);
    const overtimeHoursOf = (id) => att.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.overtime_hours || 0), 0);
    const lateEarlyHoursOf = (id) => att.filter(a => a.staff_id === id).reduce((s, a) => s + Number(a.late_early_hours || 0), 0);

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
        ? computeTelesale({ phones: telePhones, appts: appts.filter(a => mineTele(a) && !isRecheck(a)), bongRows: bong.filter(mineTele), cocRows: coc.filter(mineTele), surgRows: surg.filter(mineTele), prior })
        : null;
      const ddOff = rolesArr.includes('dieu_duong') ? computeDieuDuong(surg, s.id) : null;
      const trucOff = rolesArr.includes('truc_page') ? computeTrucPage(pages.filter(p => p.staff_id === s.id)) : null;
      const bacSiOff = rolesArr.includes('bac_si') ? computeBacSi(surg, s.id) : null;
      // Mổ đối tác: BS nhận 50% tiền đối tác, ĐD phụ mổ như khách nội bộ (áp dụng cho mọi nhân sự được phân)
      const partnerOff = computePartner(partner, s.id);
      // Team seeding dùng chung 1 tài khoản → hoa hồng tính trên TẤT CẢ ca nguồn "Seeding"
      const seedOff = rolesArr.includes('seeding') ? computeSeeding(surg.filter(a => a.customer_source === 'Seeding')) : null;
      const wins = winBonusOf(s.id, s.position === 'Outsource');

      const commission = (saleOff?.tongHH || 0) + (teleOff?.tongHH || 0) + (ddOff?.tongHH || 0) + (trucOff?.hh || 0) + (bacSiOff?.tongHH || 0) + (partnerOff?.tongHH || 0) + (seedOff?.tongHH || 0) + wins;

      // Thành phần cho Trực page / Editor (các vị trí không có bảng từng khách)
      const commDetail = [];
      if (trucOff?.hh) commDetail.push({ label: `SĐT quan tâm (${trucOff.interested} × 20.000đ)`, amount: trucOff.hh });
      if (seedOff?.tongHH) commDetail.push({ label: `Hoa hồng Seeding (${seedOff.perCase.length} ca × 20% DT−viện phí)`, amount: seedOff.tongHH });
      if (wins) commDetail.push({ label: 'Thưởng clip (Media/Editor)', amount: wins });

      // Chi tiết tăng ca theo từng ngày
      const otDetail = att.filter(a => a.staff_id === s.id && Number(a.overtime_hours) > 0)
        .map(a => {
          const rate = new Date(a.date).getDay() === 0 ? 2 : 1.5;
          return { date: a.date, hours: Number(a.overtime_hours), rate, amount: Math.round(Number(a.overtime_hours) * rate * (Number(s.base_salary || 0) / STANDARD_DAYS / 8)) };
        })
        .sort((x, y) => (x.date < y.date ? -1 : 1));

      // Chi tiết ngày nghỉ — các ngày chấm công KHÔNG tính là ngày công (nghỉ phép, vắng, nửa ngày...)
      const offDetail = s.fixed_salary ? [] : att.filter(a => a.staff_id === s.id && !['present', 'late', 'early_leave'].includes(a.status))
        .map(a => ({ date: a.date, status: a.status }))
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
      const lateEarlyHours = lateEarlyHoursOf(s.id);
      const otInfo = overtimeInfoOf(s.id, s.base_salary); // { otHours, leHours, netHours, ... }
      // Số ngày nghỉ = đếm theo bản ghi chấm công nghỉ thực tế (nửa ngày = 0.5), KHÔNG lấy 26 − công
      const daysOff = offDetail.reduce((sum, o) => sum + (o.status === 'half_day' ? 0.5 : 1), 0);
      return { staff: s, workingDays, daysOff, overtimeHours, lateEarlyHours, otNetHours: otInfo.netHours, luongCong, phuCap, commission, overtime, otherBonus, otherDeduction, advance, salaryAdvance, gross, net, savedStatus: saved?.status, saleOff, teleOff, ddOff, bacSiOff, partnerOff, commDetail, otDetail, offDetail };
    });

    setRows(computed);
    setExportSel(new Set(computed.map(r => r.staff.id))); // mặc định tích tất cả
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

  // Xuất bảng lương thành ẢNH PNG (vẽ canvas trực tiếp — không cần in/PDF)
  const exportImage = () => {
    // Chỉ xuất những nhân sự ĐÃ TÍCH trong bảng
    const list = rowsView.filter(r => exportSel.has(r.staff.id));
    if (!list.length) { toast.error('Hãy tích chọn ít nhất 1 nhân sự để xuất'); return; }
    const totalSel = list.reduce((s, r) => s + r.net, 0);
    const cols = [
      { h: 'Nhân sự', v: r => r.staff.full_name, sub: r => (ROLE_LABELS[r.staff.role] || r.staff.role) + (r.staff.employment_status === 'probation' ? ' · TV' : ''), align: 'left' },
      { h: 'Công', v: r => String(r.workingDays || 0) + (r.daysOff > 0 ? ` (nghỉ ${r.daysOff})` : ''), align: 'center' },
      { h: 'Lương theo công', v: r => fmtM(r.luongCong), align: 'right' },
      { h: 'Phụ cấp', v: r => fmtM(r.phuCap), align: 'right' },
      { h: 'Hoa hồng', v: r => fmtM(r.commission), align: 'right' },
      { h: 'Tăng ca', v: r => (r.overtime ? '+' + fmtM(r.overtime) : '0đ'), align: 'right' },
      { h: 'Thưởng khác', v: r => fmtM(r.otherBonus), align: 'right' },
      { h: 'Ứng lương', v: r => (r.salaryAdvance ? '−' + fmtM(r.salaryAdvance) : '0đ'), align: 'right', color: '#e11d48' },
      { h: 'Khấu trừ', v: r => (r.otherDeduction ? '−' + fmtM(r.otherDeduction) : '0đ'), align: 'right', color: '#e11d48' },
      { h: 'THỰC NHẬN', v: r => fmtM(r.net), align: 'right', bold: true },
    ];
    const F = (bold, size) => `${bold ? '700' : '400'} ${size}px Arial, "Helvetica Neue", sans-serif`;
    const mc = document.createElement('canvas').getContext('2d');
    const wOf = (t, bold, size) => { mc.font = F(bold, size); return mc.measureText(t).width; };
    const PAD = 14;
    const widths = cols.map((c, i) => {
      let w = wOf(c.h, true, 13);
      list.forEach(r => {
        w = Math.max(w, wOf(c.v(r), c.bold || false, 14));
        if (c.sub) w = Math.max(w, wOf(c.sub(r), false, 11));
      });
      return Math.ceil(w) + PAD * 2 + (i === 0 ? 6 : 0);
    });
    const rowH = 46, headH = 44, titleH = 92, totalH = 56, footH = 34;
    const W = widths.reduce((s, x) => s + x, 0) + 2;
    const H = titleH + headH + rowH * list.length + totalH + footH;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Nền + tiêu đề
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#06686C'; ctx.fillRect(0, 0, W, titleH);
    ctx.fillStyle = '#ffffff'; ctx.font = F(true, 22); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`BẢNG LƯƠNG ${MONTHS[month - 1].toUpperCase()}/${year}`, 20, 34);
    ctx.font = F(false, 13); ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`PK Dr Tuấn Hùng · ${list.length}/${rowsView.length} nhân sự · Tổng thực nhận: ${fmtM(totalSel)}${locked ? ' · ĐÃ CHỐT' : ' · BẢN NHÁP'}`, 20, 62);

    // Header bảng
    let y = titleH;
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, y, W, headH);
    let x = 0;
    cols.forEach((c, i) => {
      ctx.fillStyle = '#475569'; ctx.font = F(true, 13);
      ctx.textAlign = c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left';
      const tx = c.align === 'right' ? x + widths[i] - PAD : c.align === 'center' ? x + widths[i] / 2 : x + PAD;
      ctx.fillText(c.h, tx, y + headH / 2);
      x += widths[i];
    });

    // Từng dòng nhân sự
    y += headH;
    list.forEach((r, ri) => {
      if (ri % 2 === 1) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, y, W, rowH); }
      x = 0;
      cols.forEach((c, i) => {
        ctx.textAlign = c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left';
        const tx = c.align === 'right' ? x + widths[i] - PAD : c.align === 'center' ? x + widths[i] / 2 : x + PAD;
        ctx.font = F(c.bold || false, 14);
        ctx.fillStyle = c.bold ? '#0f172a' : (c.color && c.v(r).startsWith('−') ? c.color : '#334155');
        ctx.fillText(c.v(r), tx, c.sub ? y + 17 : y + rowH / 2);
        if (c.sub) { ctx.font = F(false, 11); ctx.fillStyle = '#94a3b8'; ctx.fillText(c.sub(r), tx, y + 34); }
        x += widths[i];
      });
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + rowH - 0.5); ctx.lineTo(W, y + rowH - 0.5); ctx.stroke();
      y += rowH;
    });

    // Dòng tổng
    ctx.fillStyle = '#ecfdf5'; ctx.fillRect(0, y, W, totalH);
    ctx.fillStyle = '#06686C'; ctx.font = F(true, 15); ctx.textAlign = 'left';
    ctx.fillText('TỔNG THỰC NHẬN', PAD, y + totalH / 2);
    ctx.textAlign = 'right'; ctx.font = F(true, 17);
    ctx.fillText(fmtM(totalSel), W - PAD, y + totalH / 2);
    y += totalH;
    ctx.font = F(false, 11); ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText(`Xuất từ hệ thống lúc ${new Date().toLocaleString('vi-VN')} — Lưu hành nội bộ`, PAD, y + footH / 2);

    canvas.toBlob((blob) => {
      if (!blob) { toast.error('Không tạo được ảnh'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Bang-luong-thang-${month}-${year}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast.success(`Đã xuất ảnh bảng lương ${MONTHS[month - 1]}/${year}`);
    }, 'image/png');
  };

  const printPayslip = async (r) => {
    const s = r.staff;
    const passcode = (s.payslip_code || '').trim();
    if (!passcode) { toast.error(`Hãy đặt mã bảo mật RIÊNG cho ${s.full_name} trước khi in`); setPassInput(''); setPassModal({ staff: s }); return; }

    // Chi tiết lương -> mã hoá -> QR. Phiếu in KHÔNG hiện số tiền nào.
    const congLabel = s.fixed_salary
      ? 'Lương (cố định — đủ tháng)'
      : `Lương theo công (${r.workingDays}/${STANDARD_DAYS} công${r.daysOff ? ` · nghỉ ${r.daysOff} ngày` : ''})`;
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
    (r.saleOff?.perCustomer || []).forEach(c => {
      const half = SALE_HALF_SOURCES.includes(c.source);
      hhDetail.push({
        n: c.name,
        d: `Sale · DT ${fmtM(c.revenue)}${c.upsale ? ` · Upsale ${fmtM(c.upsale)}` : ''}`,
        half, hsrc: c.source || 'Người quen',
        parts: [
          { l: `HH doanh thu (${c.dtRate}%)`, v: fmtM(c.hhBase) },
          ...(c.hhUp ? [{ l: `HH upsale (${c.upRate}%)`, v: fmtM(c.hhUp) }] : []),
        ],
        a: fmtM(c.hh),
      });
    });
    (r.teleOff?.perCustomer || []).forEach(c => hhDetail.push({
      n: c.name,
      d: `Telesale · ${c.journey} · ${c.dai ? 'Đại' : 'Tiểu'}`,
      half: c.half, hsrc: c.source || 'Người quen',
      parts: [
        ...(c.hhRev ? [{ l: 'HH doanh thu', v: fmtM(c.hhRev) }] : []),
        { l: 'Thưởng hẹn', v: fmtM(c.hhHen) },
      ],
      a: fmtM(c.hh),
    }));
    (r.ddOff?.perCase || []).forEach(c => hhDetail.push({ n: c.name, d: `${c.surgeryType} · ${c.roles.join(', ')}`, a: fmtM(c.bonus) }));
    (r.bacSiOff?.perCase || []).forEach(c => hhDetail.push({ n: c.name, d: `Công mổ ${c.surgeryType} · ${c.ratePct}%`, a: fmtM(c.cong) }));
    (r.commDetail || []).forEach(d => hhDetail.push({ n: d.label, d: '', a: fmtM(d.amount) }));
    // Mổ đối tác — tách riêng thành mục màu vàng (giống chi tiết bảng lương)
    const partnerList = [];
    (r.partnerOff?.bacSiCases || []).forEach(c => partnerList.push({ n: c.name, t: c.surgeryType, role: `Công BS 50%${c.partner ? ` · ${c.partner}` : ''}`, a: fmtM(c.cong) }));
    (r.partnerOff?.phuMoCases || []).forEach(c => partnerList.push({ n: c.name, t: c.surgeryType, role: `${c.roles.join(', ')}${c.partner ? ` · ${c.partner}` : ''}`, a: fmtM(c.bonus) }));
    // Chi tiết ngày nghỉ & tăng ca theo từng ngày (đưa vào phiếu lương digital)
    const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dLabel = (ds) => { const dt = new Date(ds); return `${WD[dt.getDay()]} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`; };
    const offList = (r.offDetail || []).map(o => ({ d: dLabel(o.date), s: ATT_STATUS_LABEL[o.status] || o.status || 'Nghỉ' }));
    const otList = (r.otDetail || []).map(o => ({ d: dLabel(o.date), h: o.hours, r: o.rate === 2 ? '200%' : '150%', a: '+' + fmtM(o.amount) }));
    const payload = {
      n: s.full_name,
      r: (ROLE_LABELS[s.role] || s.role) + (s.employment_status === 'probation' ? ' · Thử việc (85%)' : ''),
      m: `${month}/${year}`,
      k: `${s.id}:${month}/${year}`,   // định danh phiếu (phát hiện thiết bị xem trùng)
      bank: s.bank_name ? `${s.bank_name} - ${s.bank_account || ''}` : '',
      cong: s.fixed_salary ? null : { w: r.workingDays, off: r.daysOff, std: STANDARD_DAYS },
      items,
      ...(hhDetail.length ? { hh: hhDetail } : {}),
      ...(partnerList.length ? { pt: partnerList } : {}),
      ...(offList.length ? { off: offList } : {}),
      ...(otList.length ? { ot: otList } : {}),
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
      .watermark span{font-size:64px;font-weight:800;color:#06686C;opacity:.12;transform:rotate(-30deg);white-space:nowrap;letter-spacing:6px}
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
    <div className="space-y-4">
      {/* Thanh chọn kỳ lương */}
      <div className="e-toolbar">
        <button onClick={prevMonth} className="e-icon-btn w-9 h-9" aria-label="Tháng trước"><ChevronLeft className="w-4 h-4" /></button>
        <span className="min-w-[120px] text-center text-[14px] font-semibold text-slate-800 tabular-nums">{MONTHS[month - 1]} {year}</span>
        <button onClick={nextMonth} className="e-icon-btn w-9 h-9" aria-label="Tháng sau"><ChevronRight className="w-4 h-4" /></button>
        <span className="e-page-desc hidden sm:inline ml-2">Bảng lương tổng hợp — tính tự động từ chấm công, CRM và ca phẫu thuật</span>
      </div>

      {/* Tổng kỳ lương + thao tác (kiểu pay-flow Ethics) */}
      <div className="e-card e-card-pad flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="e-metric-icon"><Wallet /></div>
          <div className="min-w-0">
            <p className="e-metric-label">Tổng thực nhận · {MONTHS[month - 1]} {year}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[24px] lg:text-[28px] font-bold text-teal-800 leading-tight tabular-nums">{fmtM(totalNet)}</b>{locked && <span className="e-badge e-badge-sm e-badge-dot e-tone-brand">Đã chốt</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap lg:justify-end">
          <button onClick={exportImage} disabled={loading || exportSel.size === 0} className="e-btn e-btn-secondary">
            <ImageDown /> Xuất ảnh ({exportSel.size}/{rowsView.length})
          </button>
          <button onClick={() => savePayroll(false)} disabled={saving} className="e-btn e-btn-outline">
            <Save /> Lưu nháp
          </button>
          <button onClick={() => savePayroll(true)} disabled={saving} className="e-btn e-btn-primary">
            <Lock /> Chốt lương tháng
          </button>
        </div>
      </div>

      {/* Chart lương các tháng */}
      {history.length > 0 && (
        <div className="e-card e-card-pad">
          <h3 className="e-card-title mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-teal-600" /> Tổng lương các tháng</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmtM(v)} />
                <Bar dataKey="Tổng lương" fill="#067B7F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bảng lương */}
      {loading ? (
        <div className="e-card flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : (
        <div className="e-card overflow-hidden">
          <div className="e-table-wrap">
            <table className="e-table whitespace-nowrap">
              <thead><tr>
                <th className="w-10">
                  <input type="checkbox" title="Tích/bỏ tích tất cả để xuất ảnh"
                    checked={rowsView.length > 0 && exportSel.size === rowsView.length}
                    onChange={e => setExportSel(e.target.checked ? new Set(rowsView.map(r => r.staff.id)) : new Set())}
                    className="w-4 h-4 accent-teal-600 cursor-pointer align-middle" />
                </th>
                <th>Nhân sự</th>
                <th className="!text-center">Công</th>
                <th className="num">Lương theo công</th>
                <th className="num">Phụ cấp</th>
                <th className="num">Hoa hồng</th>
                <th className="num">Lương tăng ca</th>
                <th className="num">Thưởng khác</th>
                <th className="num">Ứng lương</th>
                <th className="num">Khấu trừ</th>
                <th className="num">Thực nhận</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rowsView.length === 0 ? (
                  <tr><td colSpan={12} className="!h-24 text-center text-[13px] text-slate-400">Chưa có nhân sự.</td></tr>
                ) : rowsView.map(r => (
                  <tr key={r.staff.id} className={exportSel.has(r.staff.id) ? '' : 'opacity-50'}>
                    <td>
                      <input type="checkbox" title="Tích để đưa vào ảnh xuất"
                        checked={exportSel.has(r.staff.id)}
                        onChange={() => setExportSel(sel => { const s = new Set(sel); s.has(r.staff.id) ? s.delete(r.staff.id) : s.add(r.staff.id); return s; })}
                        className="w-4 h-4 accent-teal-600 cursor-pointer align-middle" />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="e-avatar w-11 h-11 ring-2 ring-teal-50"><UserRound className="w-5 h-5" /></span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{r.staff.full_name}</div>
                          <div className="text-[12px] text-slate-400">{ROLE_LABELS[r.staff.role] || r.staff.role}{r.staff.employment_status === 'probation' ? ' · TV' : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="font-semibold text-slate-800 tabular-nums">{r.workingDays}</div>
                      {r.daysOff > 0 && <div className="text-[11px] font-medium text-danger-500">nghỉ {r.daysOff}</div>}
                    </td>
                    <td className="num">{fmtM(r.luongCong)}</td>
                    <td className="num text-slate-500">{fmtM(r.phuCap)}</td>
                    <td className="num font-semibold text-slate-800">{fmtM(r.commission)}
                      {r.commission > 0 && (
                        <button onClick={() => setSaleDetail(r)}
                          className="block ml-auto mt-0.5 text-[12px] font-medium text-teal-700 hover:underline">
                          Chi tiết
                        </button>
                      )}</td>
                    <td className="num font-semibold text-slate-800">{r.overtime ? '+' + fmtM(r.overtime) : '0đ'}
                      {(r.otDetail?.length > 0 || r.lateEarlyHours > 0) && (
                        <button onClick={() => setSaleDetail(r)}
                          className="block ml-auto mt-0.5 text-[12px] font-medium text-teal-700 hover:underline">
                          {r.overtimeHours}h{r.lateEarlyHours > 0 ? ` − ${r.lateEarlyHours}h muộn/sớm = ${r.otNetHours}h` : ''} · chi tiết
                        </button>
                      )}</td>
                    <td className="num">
                      <input value={fmt(r.otherBonus)} onChange={e => setEdit(r.staff.id, 'other_bonus', e.target.value)} disabled={locked}
                        className="e-input h-9 w-28 text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-400" />
                    </td>
                    <td className="num text-danger-600">{r.salaryAdvance ? '−' + fmtM(r.salaryAdvance) : '0đ'}</td>
                    <td className="num">
                      <input value={fmt(r.otherDeduction)} onChange={e => setEdit(r.staff.id, 'other_deduction', e.target.value)} disabled={locked}
                        className="e-input h-9 w-28 text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-400" />
                    </td>
                    <td className="num text-[15px] font-bold text-teal-700">{fmtM(r.net)}</td>
                    <td>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => { setSaModal({ staff: r.staff }); setSaForm({ amount: '', reason: '' }); }} title="Ứng lương" className="e-icon-btn w-8 h-8 rounded-[10px] text-slate-500"><HandCoins className="w-4 h-4" /></button>
                        <button onClick={() => { setPassInput(''); setPassModal({ staff: r.staff }); }} title={r.staff.payslip_code ? 'Đổi mã bảo mật phiếu lương' : 'Đặt mã bảo mật phiếu lương'}
                          className={`e-icon-btn w-8 h-8 rounded-[10px] ${r.staff.payslip_code ? 'text-teal-600' : 'text-warning-600 border-warning-200 bg-warning-50'}`}><KeyRound className="w-4 h-4" /></button>
                        <button onClick={() => printPayslip(r)} title="In phiếu lương" className="e-icon-btn w-8 h-8 rounded-[10px] text-slate-500"><Printer className="w-4 h-4" /></button>
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
        <div className="e-card e-card-pad">
          <h3 className="e-card-title mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5 text-teal-600" /> Yêu cầu xem lương chờ duyệt ({pendingPV.length})</h3>
          <div className="space-y-2">
            {pendingPV.map(pv => (
              <div key={pv.id} className={`e-subtle flex items-center justify-between gap-3 p-3 ${pv.is_duplicate ? '!border-danger-200 !bg-danger-50/60' : ''}`}>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{pv.staff_name || '—'} <span className="text-slate-400 font-normal">· {pv.period || ''}</span></div>
                  <div className="text-[12px] text-slate-500 truncate mt-0.5">Thiết bị: {pv.device_label || 'Thiết bị ?'}{pv.is_duplicate && <span className="e-badge e-badge-sm e-badge-dot e-tone-danger ml-1.5">Thiết bị khác đã/đang xem phiếu này</span>}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resolvePV(pv.id, false)} className="e-btn e-btn-sm e-btn-danger-soft">Từ chối</button>
                  <button onClick={() => resolvePV(pv.id, true)} className="e-btn e-btn-sm e-btn-primary"><Check className="w-4 h-4" /> Duyệt</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate-400 mt-3">Tự làm mới mỗi 15 giây · nhân sự sẽ thấy lương ngay sau khi bạn duyệt.</p>
        </div>
      )}

      {/* Đơn ứng lương chờ duyệt */}
      {pendingSA.length > 0 && (
        <div className="e-card e-card-pad">
          <h3 className="e-card-title mb-4 flex items-center gap-2"><HandCoins className="w-5 h-5 text-warning-600" /> Đơn ứng lương chờ duyệt ({pendingSA.length})</h3>
          <div className="space-y-2">
            {pendingSA.map(sa => (
              <div key={sa.id} className="e-subtle flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{sa.staff?.full_name} · <span className="text-warning-600 tabular-nums">{fmtM(sa.amount)}</span></div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{sa.reason || 'Không nêu lý do'} · {new Date(sa.created_at).toLocaleDateString('vi-VN')}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setRejectSA(sa); setRejectReason(''); }} className="e-btn e-btn-sm e-btn-danger-soft">Từ chối</button>
                  <button onClick={() => approveSA(sa.id)} className="e-btn e-btn-sm e-btn-primary"><Check className="w-4 h-4" /> Duyệt</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="e-subtle px-4 py-3 text-[12px] text-slate-500 leading-relaxed">
        <span className="e-caption mr-2">Công thức</span>
        Thực nhận = Lương theo công + Phụ cấp + Hoa hồng + Lương tăng ca + Thưởng khác − Ứng lương − Khấu trừ. (Tạm ứng chi thanh toán riêng, không tính vào đây.)
        Tăng ca = số giờ {'×'} (150% ngày thường / 200% chủ nhật) {'×'} Lương cơ bản ÷ {STANDARD_DAYS} ÷ 8.
      </p>

      {/* Modal tạo đơn ứng lương */}
      {saModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-sm overflow-hidden">
            <div className="e-modal-header items-center">
              <div><h3 className="e-modal-title">Ứng lương</h3><p className="e-card-sub">{saModal.staff.full_name}</p></div>
              <button onClick={() => setSaModal(null)} className="e-icon-btn w-9 h-9" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Số tiền ứng (VNĐ)</label>
                <input type="text" inputMode="numeric" value={saForm.amount} onChange={e => setSaForm(f => ({ ...f, amount: fmt(Number(e.target.value.replace(/\D/g, ''))) }))} className="e-input h-11 text-[18px] font-bold text-slate-900 tabular-nums" placeholder="2.000.000" />
              </div>
              <div>
                <label className="e-label">Lý do</label>
                <textarea rows={2} value={saForm.reason} onChange={e => setSaForm(f => ({ ...f, reason: e.target.value }))} className="e-textarea resize-none" placeholder="Lý do ứng lương..." />
              </div>
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setSaModal(null)} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={submitSalaryAdvance} className="e-btn e-btn-primary">Gửi duyệt</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal từ chối ứng lương */}
      {rejectSA && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-sm overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Từ chối ứng lương</h3>
              <button onClick={() => setRejectSA(null)} className="e-icon-btn w-9 h-9" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body">
              <label className="e-label">Lý do từ chối</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="e-textarea resize-none" placeholder="Nhập lý do..." />
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setRejectSA(null)} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={doRejectSA} className="e-btn e-btn-danger">Từ chối</button>
            </div>
          </div>
        </div>
      )}

      {passModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-sm overflow-hidden">
            <div className="e-modal-header items-center">
              <div>
                <h3 className="e-modal-title flex items-center gap-2"><KeyRound className="w-5 h-5 text-teal-600" /> Mã bảo mật phiếu lương</h3>
                <p className="e-card-sub">{passModal.staff.full_name}</p>
              </div>
              <button onClick={() => setPassModal(null)} className="e-icon-btn w-9 h-9" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body">
              <p className="text-[13px] text-slate-500 leading-relaxed mb-4">
                Mỗi nhân sự có <b>một mã riêng</b> để mã hoá & mở phiếu lương. Chia sẻ mã này cho đúng <b>{passModal.staff.full_name}</b>.
                Sau khi nhập mã, nhân sự vẫn cần <b>Admin duyệt</b> mới xem được chi tiết.
              </p>
              <label className="e-label">Mã bảo mật (≥ 4 ký tự)</label>
              <input type="text" autoFocus value={passInput} onChange={e => setPassInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') savePasscode(); }}
                className="e-input h-12 text-center tracking-[0.3em] text-[18px] font-semibold" placeholder="VD: 2468" />
              {passModal.staff.payslip_code && <p className="text-[12px] text-slate-400 mt-2">Nhân sự này đã có mã. Nhập mã mới để thay đổi.</p>}
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setPassModal(null)} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={savePasscode} className="e-btn e-btn-primary">Lưu mã</button>
            </div>
          </div>
        </div>
      )}

      {saleDetail && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="e-modal-header items-center shrink-0">
              <div>
                <h3 className="e-modal-title">Chi tiết lương — {saleDetail.staff.full_name}</h3>
                <p className="e-card-sub">{ROLE_LABELS[saleDetail.staff.role] || saleDetail.staff.role}{saleDetail.staff.role_2 ? ' + ' + (ROLE_LABELS[saleDetail.staff.role_2] || saleDetail.staff.role_2) : ''} · {MONTHS[month - 1]} {year}</p>
              </div>
              <button onClick={() => setSaleDetail(null)} className="e-icon-btn w-9 h-9" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-auto px-5 py-5 space-y-6">
              {/* Hoa hồng / thưởng */}
              <div>
                <div className="e-caption mb-2.5">Hoa hồng / thưởng · Tổng {fmtM(saleDetail.commission)}</div>
                {saleDetail.commDetail?.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl mb-3">
                    {saleDetail.commDetail.map((d, i) => (
                      <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                        <span className="text-slate-600 pr-2">{d.label}</span>
                        <span className="font-semibold text-teal-700 tabular-nums shrink-0">{fmtM(d.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {saleDetail.saleOff?.perCustomer?.length > 0 && (
                  <div className="overflow-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead className="bg-slate-50 text-[12px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 h-10 font-semibold">Khách (Sale Offline)</th>
                          <th className="text-left px-3 h-10 font-semibold">Nguồn</th>
                          <th className="text-right px-3 h-10 font-semibold">Doanh thu</th>
                          <th className="text-right px-3 h-10 font-semibold">Upsale</th>
                          <th className="text-right px-3 h-10 font-semibold">HH cơ bản</th>
                          <th className="text-right px-3 h-10 font-semibold">HH upsale</th>
                          <th className="text-right px-3 h-10 font-semibold">Tổng HH</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {saleDetail.saleOff.perCustomer.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.service && <div className="text-[11px] text-slate-400">{c.service}</div>}</td>
                            <td className="px-3 py-2 text-slate-500">{c.source || '—'}{SALE_HALF_SOURCES.includes(c.source) && <span className="text-[11px] text-warning-600"> ·×50%</span>}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{fmtM(c.revenue)}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums text-peach-600">{c.upsale ? fmtM(c.upsale) : '—'}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{fmtM(c.hhBase)} <span className="text-[11px] text-slate-400">({c.dtRate}%)</span></td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{c.hhUp ? `${fmtM(c.hhUp)} (${c.upRate}%)` : '—'}</td>
                            <td className="text-right px-3 py-2.5 font-bold text-teal-700 tabular-nums">{fmtM(c.hh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {saleDetail.teleOff?.perCustomer?.length > 0 && (
                  <div className="overflow-auto border border-slate-200 rounded-xl mt-3">
                    <div className="px-3.5 py-2 bg-teal-50/60 text-[12px] font-semibold text-teal-800 border-b border-slate-200">Telesale · Thưởng DT {fmtM(saleDetail.teleOff.thuongDoanhThu)} ({saleDetail.teleOff.dtRate}%) + Thưởng hẹn {fmtM(saleDetail.teleOff.thuongLichHen)}</div>
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead className="bg-slate-50 text-[12px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 h-10 font-semibold">Khách</th>
                          <th className="text-left px-3 h-10 font-semibold">Giai đoạn</th>
                          <th className="text-right px-3 h-10 font-semibold">Doanh thu</th>
                          <th className="text-right px-3 h-10 font-semibold">Thưởng DT</th>
                          <th className="text-right px-3 h-10 font-semibold">Thưởng hẹn</th>
                          <th className="text-right px-3 h-10 font-semibold">Tổng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {saleDetail.teleOff.perCustomer.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.share === 0.5 && <span className="text-[11px] text-warning-600"> ·½</span>}{c.half && <span className="text-[11px] text-danger-500"> ·{c.source || 'Quen/CTV'} 50%</span>}</td>
                            <td className="px-3 py-2 text-slate-500">{c.journey} · {c.dai ? 'Đại' : 'Tiểu'}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{c.revenue ? fmtM(c.revenue) : '—'}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{c.hhRev ? fmtM(c.hhRev) : '—'}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{c.hhHen ? fmtM(c.hhHen) : '—'}</td>
                            <td className="text-right px-3 py-2.5 font-bold text-teal-700 tabular-nums">{fmtM(c.hh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {saleDetail.ddOff?.perCase?.length > 0 && (
                  <div className="overflow-auto border border-slate-200 rounded-xl mt-3">
                    <div className="px-3.5 py-2 bg-teal-50/60 text-[12px] font-semibold text-teal-800 border-b border-slate-200">Điều dưỡng · từng ca mổ</div>
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead className="bg-slate-50 text-[12px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 h-10 font-semibold">Khách</th>
                          <th className="text-left px-3 h-10 font-semibold">Loại PT</th>
                          <th className="text-left px-3 h-10 font-semibold">Vai trò</th>
                          <th className="text-right px-3 h-10 font-semibold">Thưởng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {saleDetail.ddOff.perCase.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="px-3 py-2 text-slate-500">{c.roles.join(', ')}</td>
                            <td className="text-right px-3 py-2.5 font-bold text-teal-700 tabular-nums">{fmtM(c.bonus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {saleDetail.bacSiOff?.perCase?.length > 0 && (
                  <div className="overflow-auto border border-slate-200 rounded-xl mt-3">
                    <div className="px-3.5 py-2 bg-teal-50/60 text-[12px] font-semibold text-teal-800 border-b border-slate-200">Bác sĩ · công mổ (Tiểu 10% · Đại 5% doanh thu)</div>
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead className="bg-slate-50 text-[12px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 h-10 font-semibold">Khách</th>
                          <th className="text-left px-3 h-10 font-semibold">Loại PT</th>
                          <th className="text-right px-3 h-10 font-semibold">Doanh thu</th>
                          <th className="text-right px-3 h-10 font-semibold">%</th>
                          <th className="text-right px-3 h-10 font-semibold">Công mổ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {saleDetail.bacSiOff.perCase.map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{fmtM(c.revenue)}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums text-slate-500">{c.ratePct}%</td>
                            <td className="text-right px-3 py-2.5 font-bold text-teal-700 tabular-nums">{fmtM(c.cong)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(saleDetail.partnerOff?.bacSiCases?.length > 0 || saleDetail.partnerOff?.phuMoCases?.length > 0) && (
                  <div className="overflow-auto border border-peach-200 rounded-xl mt-3">
                    <div className="px-3.5 py-2 bg-peach-50 text-[12px] font-semibold text-peach-700 border-b border-peach-200">Mổ đối tác · BS 50% tiền đối tác · phụ mổ như khách nội bộ</div>
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead className="bg-slate-50 text-[12px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 h-10 font-semibold">Khách</th>
                          <th className="text-left px-3 h-10 font-semibold">Loại PT</th>
                          <th className="text-left px-3 h-10 font-semibold">Vai trò</th>
                          <th className="text-right px-3 h-10 font-semibold">Nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(saleDetail.partnerOff.bacSiCases || []).map((c, i) => (
                          <tr key={'b' + i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.partner ? <span className="text-[11px] text-peach-600"> · {c.partner}</span> : ''}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="px-3 py-2 text-info-600">Công BS 50% ({fmtM(c.fee)})</td>
                            <td className="text-right px-3 py-2.5 font-bold text-teal-700 tabular-nums">{fmtM(c.cong)}</td>
                          </tr>
                        ))}
                        {(saleDetail.partnerOff.phuMoCases || []).map((c, i) => (
                          <tr key={'p' + i}>
                            <td className="px-3 py-2 font-medium text-slate-800">{c.name}{c.partner ? <span className="text-[11px] text-peach-600"> · {c.partner}</span> : ''}</td>
                            <td className="px-3 py-2 text-slate-500">{c.surgeryType}</td>
                            <td className="px-3 py-2 text-slate-500">{c.roles.join(', ')}</td>
                            <td className="text-right px-3 py-2.5 font-bold text-teal-700 tabular-nums">{fmtM(c.bonus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!saleDetail.commDetail?.length && !saleDetail.saleOff?.perCustomer?.length && !saleDetail.teleOff?.perCustomer?.length && !saleDetail.ddOff?.perCase?.length && !saleDetail.bacSiOff?.perCase?.length && !saleDetail.partnerOff?.bacSiCases?.length && !saleDetail.partnerOff?.phuMoCases?.length && (
                  <div className="e-subtle px-4 py-3 text-[13px] text-slate-400">Không có hoa hồng/thưởng trong tháng.</div>
                )}
              </div>

              {/* Ngày công & ngày nghỉ */}
              {!saleDetail.staff?.fixed_salary && (
                <div>
                  <div className="e-caption mb-2.5">Ngày công · {saleDetail.workingDays}/{STANDARD_DAYS} · nghỉ {saleDetail.daysOff}</div>
                  {saleDetail.offDetail?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {saleDetail.offDetail.map((o, i) => (
                        <span key={i} className="e-badge e-badge-sm e-tone-rose">
                          {new Date(o.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })} · {ATT_STATUS_LABEL[o.status] || o.status || 'Nghỉ'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="e-subtle px-4 py-3 text-[13px] text-slate-400">{saleDetail.daysOff > 0 ? 'Nghỉ (không có bản ghi chấm công cụ thể).' : 'Đi làm đủ công.'}</div>
                  )}
                </div>
              )}

              {/* Tăng ca theo ngày */}
              {saleDetail.otDetail?.length > 0 && (
                <div>
                  <div className="e-caption mb-2.5">Tăng ca · {saleDetail.overtimeHours} giờ · {fmtM(saleDetail.overtime)}</div>
                  <div className="overflow-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-[13px]">
                      <thead className="bg-slate-50 text-[12px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 h-10 font-semibold">Ngày</th>
                          <th className="text-right px-3 h-10 font-semibold">Số giờ</th>
                          <th className="text-right px-3 h-10 font-semibold">Hệ số</th>
                          <th className="text-right px-3 h-10 font-semibold">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {saleDetail.otDetail.map((o, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2.5 text-slate-700">{new Date(o.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                            <td className="text-right px-3 py-2.5 tabular-nums">{o.hours}h</td>
                            <td className="text-right px-3 py-2.5 tabular-nums text-slate-500">{o.rate === 2 ? '200% (CN)' : '150%'}</td>
                            <td className="text-right px-3 py-2.5 font-semibold text-teal-700 tabular-nums">{fmtM(o.amount)}</td>
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
