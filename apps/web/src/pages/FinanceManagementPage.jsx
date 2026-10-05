import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import MoneyInput from '@/components/MoneyInput.jsx';
import FinanceRevenueSummary from '@/components/FinanceRevenueSummary.jsx';
import FinanceAdsSummary from '@/components/FinanceAdsSummary.jsx';
import FinanceHospitalFeeSummary from '@/components/FinanceHospitalFeeSummary.jsx';
import { Banknote, Wallet, Users, TrendingUp, Calendar as CalendarIcon, Filter, Search, X, Upload, Download, Pencil, Trash2, ChevronLeft, ChevronRight, CircleDollarSign, Undo2, PiggyBank, ReceiptText, Plus, Phone, StickyNote } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

const COLORS = ['#067B7F', '#3CA7A9', '#76C2C3', '#F4B183', '#A99BE0', '#B8C4CC'];

// ===== Import doanh thu từ CSV =====
// Thứ tự cột BẮT BUỘC (đúng theo header dưới):
const IMPORT_HEADERS = [
  'ngay_phau_thuat', 'ten_khach_hang', 'so_dien_thoai', 'dich_vu', 'nhom_dich_vu',
  'nguon_khach', 'tep_khach', 'doanh_thu', 'doanh_thu_upsale', 'ma_telesale', 'ma_telesale_2', 'ma_sale', 'ghi_chu',
];
const IMPORT_TEMPLATE =
  IMPORT_HEADERS.join(',') + '\n' +
  '2026-06-19,Nguyễn Văn A,0901234567,Cắt mí trên,Hàm mặt,Ads,Mới,18000000,1500000,NV001,,NV002,Khách hài lòng\n' +
  '2026-06-20,Trần Thị B,0907654321,Nâng mũi,Hàm mặt,CTV,Cũ,35000000,0,NV001,NV003,NV002,2 telesale cùng care\n';

// Parse CSV đơn giản, hỗ trợ ô có dấu phẩy trong dấu ngoặc kép
const parseCSV = (text) => {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
};

// Chỉ các vai trò này được xem Chi phí Ads (khớp với RLS bảng marketing_*)
const CAN_VIEW_ADS = ['marketing', 'admin', 'accountant', 'shareholder'];

const FinanceManagementPage = () => {
  const { profile } = useAuth();
  const canViewAds = CAN_VIEW_ADS.includes(profile?.role);
  const [activeTab, setActiveTab] = useState('revenue');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [revenueData, setRevenueData] = useState([]);
  const [staffList, setStaffList] = useState([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { valid: [], errors: [] }
  const [importing, setImporting] = useState(false);
  const [createForm, setCreateForm] = useState({
    surgery_date: vnToday(),
    customer_name: '', phone: '', service: '',
    service_group: 'Hàm mặt', customer_source: 'Ads', customer_type: 'Mới',
    revenue: '', upsale_revenue: '', sale_id: '', telesale_id: '', telesale_id_2: '', notes: ''
  });
  
  // Charts Data
  const [sourceData, setSourceData] = useState([]);
  const [serviceGroupData, setServiceGroupData] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalRev: 0, totalUpsale: 0, totalCustomers: 0, adsCustomers: 0, adsRevenue: 0, adsSpent: 0,
    hospitalFee: 0, hospitalFeeCash: 0, hospitalFeeTransfer: 0, hospitalFeeCount: 0,
    totalCocRev: 0, totalCocCustomers: 0, depositOffset: 0, depositOffsetCount: 0
  });

  // Chi tiết tiền cọc: danh sách khách cọc trong tháng, đối trừ cọc cho ca mổ tháng này, DT cọc theo từng tháng trong năm
  const [cocList, setCocList] = useState([]);       // khách có deposit_date trong tháng (mọi trạng thái)
  const [offsetList, setOffsetList] = useState([]); // ca mổ tháng này có cọc từ trước -> đối trừ
  const [cocByMonth, setCocByMonth] = useState([]); // [{m, total, count}] cả năm
  const [showCocModal, setShowCocModal] = useState(false);
  // Điện thoại: lọc nhóm dịch vụ + tìm + bảng chi tiết 1 giao dịch (chỉ hiển thị)
  const [mGroup, setMGroup] = useState('all');
  const [mQ, setMQ] = useState('');
  const [sheet, setSheet] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    let query = supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name)')
      .eq('status', 'phau_thuat');

    // Phân quyền hiển thị: nhóm quản lý xem tất cả, còn lại chỉ xem doanh thu cá nhân
    const canSeeAll = ['admin', 'accountant', 'shareholder', 'marketing'].includes(profile?.role)
      || ['admin', 'accountant', 'shareholder', 'marketing'].includes(profile?.role_2);
    if (!canSeeAll && profile?.id) {
      query = query.or(`telesale_id.eq.${profile.id},telesale_id_2.eq.${profile.id},sale_id.eq.${profile.id}`);
    }

    const { data, error } = await query.order('surgery_date', { ascending: false });

    // Fetch staff for dropdown
    const { data: staffData } = await supabase.from('profiles').select('id, full_name, role, role_2');
    if (staffData) setStaffList(staffData);

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      // Quy doanh thu theo tháng: ưu tiên surgery_date, thiếu thì dùng ngày đánh giá (updated_at)
      const inMonth = (r) => { const d = String(r.surgery_date || r.updated_at || '').slice(0, 10); return d >= startDate && d <= endDate; };
      const records = (data || []).filter(inMonth);
      setRevenueData(records);

      let tRev = 0, tUp = 0, adsC = 0, tFee = 0, tFeeCash = 0, tFeeTransfer = 0, feeCount = 0;
      const srcMap = {};
      const svcMap = {};

      records.forEach(r => {
        tRev += Number(r.revenue || 0);
        tUp += Number(r.upsale_revenue || 0);
        
        const src = r.customer_source || 'Khác';
        if (src === 'Ads') adsC++;
        srcMap[src] = (srcMap[src] || 0) + Number(r.revenue || 0);

        const svc = r.service_group || 'Khác';
        svcMap[svc] = (svcMap[svc] || 0) + Number(r.revenue || 0);

        if (r.hospital_fee) {
          feeCount++;
          tFee += Number(r.hospital_fee || 0);
          if (r.hospital_fee_method === 'cash') tFeeCash += Number(r.hospital_fee || 0);
          if (r.hospital_fee_method === 'transfer') tFeeTransfer += Number(r.hospital_fee || 0);
        }
      });

      // Fetch Ads Spent
      const { data: adsData } = await supabase
        .from('marketing_ads_performance')
        .select('amount_spent')
        .gte('date', startDate)
        .lte('date', endDate);
        
      let tAdsSpent = 0;
      if (adsData) {
        adsData.forEach(ad => { tAdsSpent += Number(ad.amount_spent || 0); });
      }

      // ===== TIỀN CỌC (kế toán theo tháng) =====
      // DT cọc THU trong tháng = mọi khoản cọc có deposit_date trong tháng, KHÔNG lọc theo status
      // (khách đã lên ca mổ thì status đổi thành phau_thuat nhưng tiền cọc vẫn thu ở tháng cọc).
      let cocQuery = supabase
        .from('customer_appointments')
        .select('id, customer_name, phone, service, deposit_amount, deposit_date, status, surgery_date, bong_date')
        .gt('deposit_amount', 0)
        .gte('deposit_date', `${year}-01-01`)
        .lte('deposit_date', `${year}-12-31`);

      if (!canSeeAll && profile?.id) {
        cocQuery = cocQuery.or(`telesale_id.eq.${profile.id},telesale_id_2.eq.${profile.id},sale_id.eq.${profile.id}`);
      }

      const { data: cocData } = await cocQuery;
      const yearCoc = cocData || [];
      // Phân theo 12 tháng trong năm
      const byMonth = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, total: 0, count: 0 }));
      yearCoc.forEach(c => {
        const mIdx = Number(String(c.deposit_date).slice(5, 7)) - 1;
        if (mIdx >= 0 && mIdx < 12) { byMonth[mIdx].total += Number(c.deposit_amount || 0); byMonth[mIdx].count++; }
      });
      setCocByMonth(byMonth);

      const monthCoc = yearCoc
        .filter(c => c.deposit_date >= startDate && c.deposit_date <= endDate)
        .sort((a, b) => String(a.deposit_date).localeCompare(String(b.deposit_date)));
      setCocList(monthCoc);
      const tCocRev = monthCoc.reduce((s, c) => s + Number(c.deposit_amount || 0), 0);
      const cocCustomers = monthCoc.length;

      // ĐỐI TRỪ CỌC: các ca mổ trong tháng này đã cọc từ trước (bất kể cọc tháng nào)
      // -> Thực thu ca mổ tháng này = doanh thu ca mổ − phần cọc đã thu của chính các ca đó.
      const offsetRows = records
        .filter(r => Number(r.deposit_amount || 0) > 0)
        .map(r => ({
          id: r.id, customer_name: r.customer_name, phone: r.phone, service: r.service,
          revenue: Number(r.revenue || 0), deposit_amount: Number(r.deposit_amount || 0),
          deposit_date: r.deposit_date, surgery_date: r.surgery_date
        }))
        .sort((a, b) => String(a.surgery_date).localeCompare(String(b.surgery_date)));
      setOffsetList(offsetRows);
      const tOffset = offsetRows.reduce((s, r) => s + r.deposit_amount, 0);

      setStats({
        totalRev: tRev,
        totalUpsale: tUp,
        totalCustomers: records.length,
        adsCustomers: adsC,
        adsRevenue: srcMap['Ads'] || 0,
        adsSpent: tAdsSpent,
        hospitalFee: tFee,
        hospitalFeeCash: tFeeCash,
        hospitalFeeTransfer: tFeeTransfer,
        hospitalFeeCount: feeCount,
        totalCocRev: tCocRev,
        totalCocCustomers: cocCustomers,
        depositOffset: tOffset,
        depositOffsetCount: offsetRows.length
      });

      setSourceData(Object.keys(srcMap).map(name => ({ name, value: srcMap[name] })));
      setServiceGroupData(Object.keys(svcMap).map(name => ({ name, value: svcMap[name] })));
    }
    setLoading(false);
  }, [month, year, profile?.id, profile?.role, profile?.role_2]);

  useEffect(() => {
    if (activeTab === 'revenue' && profile) loadData();
  }, [loadData, activeTab, profile]);
  useRealtimeReload('customer_appointments,marketing_ads_performance', loadData);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.phone || !createForm.customer_name) {
      toast.error('Vui lòng nhập Tên và SĐT khách hàng'); return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_name: createForm.customer_name,
        phone: createForm.phone,
        surgery_date: createForm.surgery_date,
        service: createForm.service,
        service_group: createForm.service_group,
        customer_source: createForm.customer_source,
        customer_type: createForm.customer_type,
        revenue: createForm.revenue || 0,
        upsale_revenue: createForm.upsale_revenue || 0,
        sale_id: createForm.sale_id || null,
        telesale_id: createForm.telesale_id || null,
        telesale_id_2: createForm.telesale_id_2 || null,
        notes: createForm.notes,
      };
      if (createForm.id) {
        const { error } = await supabase.from('customer_appointments').update(payload).eq('id', createForm.id);
        if (error) throw error;
        toast.success('Đã cập nhật doanh thu!');
      } else {
        const { error } = await supabase.from('customer_appointments').insert({
          ...payload, appointment_date: createForm.surgery_date, status: 'phau_thuat', created_by: profile.id,
        });
        if (error) throw error;
        toast.success('Đã thêm doanh thu thành công!');
      }
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openCreateRevenue = () => {
    setCreateForm({
      surgery_date: vnToday(),
      customer_name: '', phone: '', service: '',
      service_group: 'Hàm mặt', customer_source: 'Ads', customer_type: 'Mới',
      revenue: '', upsale_revenue: '', sale_id: '', telesale_id: '', telesale_id_2: '', notes: '',
    });
    setShowCreateModal(true);
  };

  const openEditRevenue = (r) => {
    setCreateForm({
      id: r.id,
      surgery_date: r.surgery_date || vnToday(),
      customer_name: r.customer_name || '', phone: r.phone || '', service: r.service || '',
      service_group: r.service_group || 'Hàm mặt', customer_source: r.customer_source || 'Ads', customer_type: r.customer_type || 'Mới',
      revenue: r.revenue || '', upsale_revenue: r.upsale_revenue || '',
      sale_id: r.sale_id || '', telesale_id: r.telesale_id || '', telesale_id_2: r.telesale_id_2 || '', notes: r.notes || '',
    });
    setShowCreateModal(true);
  };

  const handleDeleteRevenue = async (r) => {
    if (!window.confirm(`Xóa doanh thu của khách "${r.customer_name}"? Hành động không hoàn tác.`)) return;
    const { error } = await supabase.from('customer_appointments').delete().eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã xóa'); loadData();
  };

  // ===== Import CSV =====
  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mau_import_doanh_thu.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportPreview(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { toast.error('File trống hoặc thiếu dữ liệu'); return; }

    const { data: profs } = await supabase.from('profiles').select('id, employee_id');
    const empMap = {};
    (profs || []).forEach(p => { if (p.employee_id) empMap[p.employee_id.trim().toUpperCase()] = p.id; });

    const valid = [], errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (idx) => (r[idx] || '').trim();
      const lineNo = i + 1;
      const date = get(0), name = get(1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Dòng ${lineNo}: ngày phẫu thuật sai định dạng (YYYY-MM-DD)`); continue; }
      if (!name) { errors.push(`Dòng ${lineNo}: thiếu tên khách hàng`); continue; }
      const teleCode = get(9).toUpperCase(), teleCode2 = get(10).toUpperCase(), saleCode = get(11).toUpperCase();
      let telesale_id = null, telesale_id_2 = null, sale_id = null;
      if (teleCode) { if (empMap[teleCode]) telesale_id = empMap[teleCode]; else { errors.push(`Dòng ${lineNo}: không tìm thấy mã telesale "${teleCode}"`); continue; } }
      if (teleCode2) { if (empMap[teleCode2]) telesale_id_2 = empMap[teleCode2]; else { errors.push(`Dòng ${lineNo}: không tìm thấy mã telesale 2 "${teleCode2}"`); continue; } }
      if (saleCode) { if (empMap[saleCode]) sale_id = empMap[saleCode]; else { errors.push(`Dòng ${lineNo}: không tìm thấy mã sale "${saleCode}"`); continue; } }
      valid.push({
        customer_name: name, phone: get(2),
        appointment_date: date, surgery_date: date,
        service: get(3) || null, service_group: get(4) || 'Hàm mặt',
        customer_source: get(5) || 'Ads', customer_type: get(6) || 'Mới',
        revenue: Number(get(7).replace(/\D/g, '')) || 0,
        upsale_revenue: Number(get(8).replace(/\D/g, '')) || 0,
        telesale_id, telesale_id_2, sale_id, notes: get(12) || null,
        status: 'phau_thuat', created_by: profile.id,
      });
    }
    setImportPreview({ valid, errors });
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importPreview?.valid?.length) { toast.error('Không có dòng hợp lệ để import'); return; }
    setImporting(true);
    try {
      const { error } = await supabase.from('customer_appointments').insert(importPreview.valid);
      if (error) throw error;
      toast.success(`Đã import ${importPreview.valid.length} dòng doanh thu`);
      setShowImportModal(false); setImportPreview(null);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  const fmt = (val) => new Intl.NumberFormat('vi-VN').format(val) + 'đ';

  // Chuyển tháng nhanh bằng nút ◀ ▶
  const shiftMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };
  const goThisMonth = () => { const n = new Date(); setMonth(n.getMonth() + 1); setYear(n.getFullYear()); };

  // Dòng tiền tháng: thực thu ca mổ (sau đối trừ cọc) và tổng tiền thực về
  const netSurgery = (stats.totalRev || 0) - (stats.depositOffset || 0);
  const totalCashIn = netSurgery + (stats.totalCocRev || 0);

  return (
    <div className="space-y-4">
      {/* Mô tả + tab khu vực (gạch chân teal kiểu Ethics) */}
      <div className="space-y-3">
        <p className="e-page-desc">Báo cáo dòng tiền, nguồn khách và biểu đồ lợi nhuận</p>
        <div className="e-tabs">
          <button onClick={() => setActiveTab('revenue')} className={`e-tab ${activeTab === 'revenue' ? 'e-tab-active' : ''}`}>
            <Banknote /> Doanh Thu
          </button>
          {canViewAds && (
            <button onClick={() => setActiveTab('expenses')} className={`e-tab ${activeTab === 'expenses' ? 'e-tab-active' : ''}`}>
              <Wallet /> Tài chính
            </button>
          )}
        </div>
      </div>

      {activeTab === 'revenue' && (
        <div className="flex flex-col gap-4">
          {/* Controls */}
          <div className="e-toolbar justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <button type="button" onClick={() => shiftMonth(-1)} title="Tháng trước" className="e-icon-btn w-9 h-9 shrink-0"><ChevronLeft className="w-5 h-5" /></button>
              <CalendarIcon className="w-[18px] h-[18px] text-teal-600 hidden sm:block mx-1" />
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-800 outline-none cursor-pointer focus:border-teal-400">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Tháng {m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-800 outline-none cursor-pointer focus:border-teal-400">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>Năm {y}</option>)}
              </select>
              <button type="button" onClick={() => shiftMonth(1)} title="Tháng sau" className="e-icon-btn w-9 h-9 shrink-0"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <button type="button" onClick={goThisMonth} className="e-btn e-btn-outline e-btn-sm shrink-0">Tháng này</button>
          </div>

          {/* ===== DÒNG TIỀN THÁNG: phép tính trực quan 4 bước → tổng thực về ===== */}
          <div className="e-card e-card-pad">
            <div className="e-card-header flex-wrap max-lg:mb-3">
              <div className="min-w-0">
                <div className="e-card-title">Dòng tiền tháng {month}/{year}</div>
                <div className="e-card-sub">Doanh thu ca mổ − cọc đã thu trước + cọc thu trong tháng</div>
              </div>
              <button type="button" onClick={() => setShowCocModal(true)} className="e-btn e-btn-outline e-btn-sm shrink-0 max-lg:w-full">
                <Search className="w-4 h-4" /> Chi tiết khách cọc
              </button>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 lg:gap-3 [&>*]:max-lg:p-3 [&>*>span:first-child]:max-lg:hidden">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><CircleDollarSign className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-500 truncate">Doanh thu ca mổ</div>
                  <div className="text-[16px] sm:text-[18px] lg:text-[20px] font-bold text-slate-900 leading-tight truncate tabular-nums" title={fmt(stats.totalRev)}>{fmt(stats.totalRev)}</div>
                  <div className="text-[12px] text-slate-400 truncate">{stats.totalCustomers} ca mổ trong tháng</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowCocModal(true)} className="text-left rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3 min-w-0 transition hover:border-teal-300 hover:shadow-soft cursor-pointer">
                <span className="w-11 h-11 rounded-full bg-warning-50 text-warning-600 grid place-items-center shrink-0"><Undo2 className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-500 truncate">− Cọc đã thu trước</div>
                  <div className="text-[16px] sm:text-[18px] lg:text-[20px] font-bold text-warning-600 leading-tight truncate tabular-nums" title={fmt(stats.depositOffset || 0)}>− {fmt(stats.depositOffset || 0)}</div>
                  <div className="text-[12px] text-teal-700 font-medium truncate">{stats.depositOffsetCount || 0} ca đã cọc từ trước ▸</div>
                </div>
              </button>
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-full bg-white text-teal-700 grid place-items-center shrink-0"><Wallet className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-teal-800 truncate">= Thực thu ca mổ</div>
                  <div className="text-[16px] sm:text-[18px] lg:text-[20px] font-bold text-teal-800 leading-tight truncate tabular-nums" title={fmt(netSurgery)}>{fmt(netSurgery)}</div>
                  <div className="text-[12px] text-teal-700/80 truncate">tiền ca mổ thực về tháng này</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowCocModal(true)} className="text-left rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3 min-w-0 transition hover:border-teal-300 hover:shadow-soft cursor-pointer">
                <span className="w-11 h-11 rounded-full bg-info-50 text-info-600 grid place-items-center shrink-0"><PiggyBank className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-500 truncate">+ Cọc thu trong tháng</div>
                  <div className="text-[16px] sm:text-[18px] lg:text-[20px] font-bold text-info-600 leading-tight truncate tabular-nums" title={fmt(stats.totalCocRev || 0)}>+ {fmt(stats.totalCocRev || 0)}</div>
                  <div className="text-[12px] text-teal-700 font-medium truncate">{stats.totalCocCustomers || 0} khách cọc ▸</div>
                </div>
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="text-[13px] md:text-[14px] font-bold text-teal-900 flex items-center gap-2 min-w-0"><Banknote className="w-[18px] h-[18px] text-teal-600 shrink-0" /> <span className="truncate"><span className="lg:hidden">Tổng thực về</span><span className="hidden lg:inline">Tổng tiền thực về trong tháng</span></span></div>
              <div className="text-[19px] md:text-[24px] font-bold text-teal-900 tabular-nums shrink-0" title={fmt(totalCashIn)}>{fmt(totalCashIn)}</div>
            </div>
          </div>

          {/* Chỉ số phụ (MetricCard Ethics) */}
          <div className="grid grid-cols-3 gap-2.5 lg:gap-4 [&>.e-metric]:max-lg:flex-col [&>.e-metric]:max-lg:items-start [&>.e-metric]:max-lg:gap-1.5 [&>.e-metric]:max-lg:p-3 [&_.e-metric-icon]:max-lg:w-9 [&_.e-metric-icon]:max-lg:h-9 [&_.e-metric-icon_svg]:max-lg:w-[18px] [&_.e-metric-icon_svg]:max-lg:h-[18px] [&_.e-metric-value]:max-lg:text-[16px] [&_.e-metric-label]:max-lg:text-[11.5px]">
            <div className="e-metric">
              <span className="e-metric-icon"><TrendingUp /></span>
              <div className="min-w-0">
                <div className="e-metric-label">DT UPSALE</div>
                <div className="e-metric-value" title={fmt(stats.totalUpsale)}>{fmt(stats.totalUpsale)}</div>
              </div>
            </div>
            <div className="e-metric">
              <span className="e-metric-icon"><Users /></span>
              <div className="min-w-0">
                <div className="e-metric-label">TỔNG KHÁCH</div>
                <div className="e-metric-value">{stats.totalCustomers} <span className="text-[13px] font-medium text-slate-500">khách</span></div>
              </div>
            </div>
            <div className="e-metric">
              <span className="e-metric-icon"><Filter /></span>
              <div className="min-w-0">
                <div className="e-metric-label">KHÁCH TỪ ADS</div>
                <div className="e-metric-value">{stats.adsCustomers} <span className="text-[13px] font-medium text-slate-500">khách</span></div>
              </div>
            </div>
          </div>

          {/* ===== Modal chi tiết tiền cọc ===== */}
          {showCocModal && (
            <div className="e-modal-backdrop z-[80] flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setShowCocModal(false)}>
              <div className="e-modal md:max-w-3xl max-h-[92vh] md:max-h-[85vh] rounded-b-none rounded-t-3xl md:rounded-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="md:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2 shrink-0" />
                <div className="e-modal-header items-center shrink-0">
                  <div className="min-w-0">
                    <div className="e-modal-title truncate">Chi tiết tiền cọc — Tháng {month}/{year}</div>
                    <div className="e-card-sub truncate">Ai cọc, cọc ngày nào, và đối trừ vào ca mổ tháng nào</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => shiftMonth(-1)} title="Tháng trước" className="e-icon-btn w-9 h-9"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => shiftMonth(1)} title="Tháng sau" className="e-icon-btn w-9 h-9"><ChevronRight className="w-5 h-5" /></button>
                    <button onClick={() => setShowCocModal(false)} title="Đóng" className="e-icon-btn w-9 h-9"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="e-modal-body overflow-y-auto space-y-5">
                  {/* DT cọc theo 12 tháng */}
                  <div>
                    <div className="e-caption mb-2.5">DT cọc theo tháng — năm {year}</div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {cocByMonth.map(mm => (
                        <button key={mm.m} type="button" onClick={() => setMonth(mm.m)}
                          className={`rounded-xl border p-2.5 text-left transition ${mm.m === month ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-100' : 'border-slate-200 bg-white hover:border-teal-300'}`}>
                          <div className={`text-[11px] font-semibold ${mm.m === month ? 'text-teal-700' : 'text-slate-400'}`}>Tháng {mm.m}</div>
                          <div className={`text-[12.5px] font-bold tabular-nums truncate ${mm.total > 0 ? 'text-slate-900' : 'text-slate-300'}`} title={fmt(mm.total)}>{mm.total > 0 ? fmt(mm.total) : '—'}</div>
                          {mm.count > 0 && <div className="text-[11px] text-slate-400">{mm.count} khách</div>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Khách cọc trong tháng */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="e-caption">Khách cọc trong tháng {month} ({cocList.length})</div>
                      <div className="text-[14px] font-bold text-info-600 tabular-nums">{fmt(stats.totalCocRev || 0)}</div>
                    </div>
                    {cocList.length === 0 ? (
                      <div className="e-subtle p-4 text-center text-[13px] text-slate-400">Không có khách cọc trong tháng này</div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {cocList.map(c => (
                          <div key={c.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3 bg-white">
                            <div className="flex-1 min-w-0 max-sm:basis-full">
                              <div className="text-[14px] font-semibold text-slate-900 truncate">{c.customer_name} <span className="font-normal text-slate-400 text-[12px]">· {c.phone}</span></div>
                              <div className="text-[12px] text-slate-500 truncate">Cọc ngày {String(c.deposit_date).slice(0,10).split('-').reverse().join('/')}{c.service ? ` · ${c.service}` : ''}</div>
                            </div>
                            {c.status === 'phau_thuat'
                              ? <span className="e-badge e-badge-sm e-tone-success shrink-0">Đã mổ {c.surgery_date ? String(c.surgery_date).slice(5,10).split('-').reverse().join('/') : ''}</span>
                              : c.status === 'bong' || c.bong_date
                                ? <span className="e-badge e-badge-sm e-tone-danger shrink-0">Bong</span>
                                : <span className="e-badge e-badge-sm e-tone-info shrink-0">Đang cọc</span>}
                            <div className="shrink-0 text-[14px] font-bold text-slate-900 tabular-nums max-sm:ml-auto">{fmt(Number(c.deposit_amount || 0))}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Đối trừ cọc cho ca mổ tháng này */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="e-caption">Đối trừ cọc — ca mổ tháng {month} đã cọc trước ({offsetList.length})</div>
                      <div className="text-[14px] font-bold text-warning-600 tabular-nums shrink-0">− {fmt(stats.depositOffset || 0)}</div>
                    </div>
                    {offsetList.length === 0 ? (
                      <div className="e-subtle p-4 text-center text-[13px] text-slate-400">Tháng này không có ca mổ nào đã cọc từ trước</div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {offsetList.map(r => (
                          <div key={r.id} className="px-4 py-3 bg-white">
                            <div className="flex max-sm:flex-col sm:items-center gap-1.5 sm:gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-[14px] font-semibold text-slate-900 truncate">{r.customer_name} <span className="font-normal text-slate-400 text-[12px]">· {r.phone}</span></div>
                                <div className="text-[12px] text-slate-500 truncate">Mổ {String(r.surgery_date || '').slice(0,10).split('-').reverse().join('/')} · Cọc {r.deposit_date ? String(r.deposit_date).slice(0,10).split('-').reverse().join('/') : '?'}{r.service ? ` · ${r.service}` : ''}</div>
                              </div>
                              <div className="shrink-0 sm:text-right">
                                <div className="text-[12px] text-slate-500 tabular-nums">DT {fmt(r.revenue)} − cọc <span className="text-warning-600 font-semibold">{fmt(r.deposit_amount)}</span></div>
                                <div className="text-[14px] font-bold text-teal-700 tabular-nums">Thực thu {fmt(r.revenue - r.deposit_amount)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tổng kết dòng tiền tháng */}
                  <div className="e-subtle p-4 space-y-2 text-[13.5px] tabular-nums">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Doanh thu ca mổ tháng {month}</span><span className="font-semibold text-slate-900">{fmt(stats.totalRev || 0)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">− Cọc đã thu từ trước (đối trừ)</span><span className="font-semibold text-warning-600">− {fmt(stats.depositOffset || 0)}</span></div>
                    <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span className="font-semibold text-teal-800">= Thực thu từ ca mổ</span><span className="font-bold text-teal-800">{fmt((stats.totalRev || 0) - (stats.depositOffset || 0))}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">+ Tiền cọc thu trong tháng</span><span className="font-semibold text-info-600">+ {fmt(stats.totalCocRev || 0)}</span></div>
                    <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span className="font-bold text-teal-900">= Tổng tiền THỰC VỀ trong tháng</span><span className="font-bold text-[15px] text-teal-900">{fmt((stats.totalRev || 0) - (stats.depositOffset || 0) + (stats.totalCocRev || 0))}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* Charts — trên điện thoại xếp sau danh sách giao dịch */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-lg:order-last">
            <div className="e-card e-card-pad min-w-0">
              <div className="e-card-header"><h3 className="e-card-title">Tỷ trọng Nguồn Khách (VND)</h3></div>
              <div className="h-64 [&_.recharts-cartesian-axis-tick_text]:fill-[#A3ABAA] [&_.recharts-cartesian-grid_line]:[stroke-dasharray:0] [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!border-slate-200 [&_.recharts-legend-item-text]:!text-slate-600">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {sourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value) => fmt(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="e-card e-card-pad min-w-0">
              <div className="e-card-header"><h3 className="e-card-title">Doanh thu theo Nhóm dịch vụ</h3></div>
              <div className="h-64 [&_.recharts-cartesian-axis-tick_text]:fill-[#A3ABAA] [&_.recharts-cartesian-grid_line]:[stroke-dasharray:0] [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!border-slate-200 [&_.recharts-legend-item-text]:!text-slate-600">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceGroupData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => (val/1000000) + 'M'} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(value) => fmt(value)} cursor={{fill: '#F3F9F9'}} />
                    <Bar dataKey="value" fill="#067B7F" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table — danh sách giao dịch kiểu DataTable Ethics */}
          <div className="e-card overflow-hidden max-lg:overflow-visible max-lg:bg-transparent max-lg:border-0 max-lg:shadow-none">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 max-lg:px-1 max-lg:py-1 max-lg:border-0">
              <h3 className="e-card-title"><span className="lg:hidden">Giao dịch doanh thu</span><span className="hidden lg:inline">Danh sách Giao dịch Doanh Thu</span></h3>
              {(profile?.role === 'admin' || profile?.role === 'marketing') && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setImportPreview(null); setShowImportModal(true); }} className="e-btn e-btn-secondary e-btn-sm">
                    <Upload className="w-4 h-4" /> <span className="lg:hidden">Import</span><span className="hidden lg:inline">Import Excel/CSV</span>
                  </button>
                  <button onClick={openCreateRevenue}
                    className="e-btn e-btn-primary e-btn-sm max-lg:fixed max-lg:right-4 max-lg:bottom-[calc(88px+env(safe-area-inset-bottom))] max-lg:z-20 max-lg:h-12 max-lg:px-5 max-lg:rounded-full max-lg:text-[14.5px] max-lg:shadow-nav">
                    <span className="lg:hidden inline-flex items-center gap-2"><Plus className="w-5 h-5" /> Nhập doanh thu</span><span className="hidden lg:inline">+ Nhập trực tiếp</span>
                  </button>
                </div>
              )}
            </div>
            {loading ? (
              <div className="e-empty"><div className="w-7 h-7 mb-3 border-[3px] border-teal-100 border-t-teal-600 rounded-full animate-spin" /><div className="e-empty-desc mt-0">Đang tải...</div></div>
            ) : revenueData.length === 0 ? (
              <div className="e-empty"><div className="e-empty-icon"><ReceiptText /></div><div className="e-empty-title">Không có giao dịch nào trong tháng này.</div></div>
            ) : (
              <>
              {/* Điện thoại: danh sách gom theo ngày — không trượt ngang, bấm 1 dòng để xem chi tiết */}
              {(() => {
                const groupsOf = [...new Set(revenueData.map(r => r.service_group || 'Chưa rõ'))];
                const nq = mQ.trim().toLowerCase();
                const shown = revenueData.filter(r => (mGroup === 'all' || (r.service_group || 'Chưa rõ') === mGroup)
                  && (!nq || `${r.customer_name || ''} ${r.phone || ''} ${r.service || ''} ${r.customer_source || ''}`.toLowerCase().includes(nq)));
                const sumOf = (list) => list.reduce((t, r) => t + Number(r.revenue || 0), 0);
                const days = [];
                shown.forEach(r => { const g = days[days.length - 1]; if (g && g.date === r.surgery_date) g.items.push(r); else days.push({ date: r.surgery_date, items: [r] }); });
                const WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                const dayLabel = (ds) => { const x = new Date(ds); return isNaN(x) ? 'Chưa có ngày' : `${WD[x.getDay()]}, ${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`; };
                const ini = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
                return (
                  <div className="lg:hidden space-y-3 pt-2">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                      {[{ id: 'all', label: 'Tất cả', list: revenueData }, ...groupsOf.map(g => ({ id: g, label: g, list: revenueData.filter(r => (r.service_group || 'Chưa rõ') === g) }))].map(c => (
                        <button key={c.id} onClick={() => setMGroup(c.id)}
                          className={`shrink-0 flex flex-col items-start px-3.5 py-2 rounded-2xl border text-left transition ${mGroup === c.id ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-700 shadow-soft'}`}>
                          <span className="text-[13px] font-semibold whitespace-nowrap">{c.label} <span className={mGroup === c.id ? 'text-white/75' : 'text-slate-400'}>{c.list.length}</span></span>
                          <span className={`text-[12px] font-semibold tabular-nums whitespace-nowrap ${mGroup === c.id ? 'text-white/85' : 'text-teal-700'}`}>{fmt(sumOf(c.list))}</span>
                        </button>
                      ))}
                    </div>
                    <div className="e-search">
                      <Search />
                      <input value={mQ} onChange={e => setMQ(e.target.value)} placeholder="Tìm khách, SĐT, dịch vụ, nguồn…" className="!h-11 !text-[16px] !bg-white" />
                    </div>
                    {days.length === 0 ? (
                      <div className="e-empty"><div className="e-empty-icon"><ReceiptText /></div><div className="e-empty-title">Không có giao dịch phù hợp</div></div>
                    ) : days.map(g => (
                      <section key={g.date || 'none'}>
                        <div className="flex items-center justify-between px-1 mb-1.5">
                          <span className="text-[13px] font-bold text-slate-700">{dayLabel(g.date)} <span className="font-medium text-slate-400">· {g.items.length} ca</span></span>
                          <span className="text-[12.5px] font-semibold text-teal-700 tabular-nums">{fmt(sumOf(g.items))}</span>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft divide-y divide-slate-100 overflow-hidden">
                          {g.items.map(r => (
                            <button key={r.id} onClick={() => setSheet(r)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-teal-50/50 transition">
                              <span className="w-11 h-11 rounded-full grid place-items-center shrink-0 text-[14px] font-bold bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700">{ini(r.customer_name)}</span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-[14.5px] font-semibold text-slate-900 truncate">{r.customer_name}</span>
                                <span className="block text-[12.5px] text-slate-500 truncate">{r.service || 'N/A'}</span>
                                <span className="block text-[11.5px] text-slate-400 truncate">{[r.service_group || 'Chưa rõ', r.customer_source || 'Khác', r.customer_type || 'Mới'].join(' · ')}</span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-[15px] font-bold text-teal-700 tabular-nums whitespace-nowrap">{fmt(r.revenue || 0)}</span>
                                {Number(r.upsale_revenue || 0) > 0 && <span className="block text-[11.5px] text-slate-500 tabular-nums whitespace-nowrap">Upsale {fmt(r.upsale_revenue)}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                );
              })()}
              {/* Máy tính: bảng e-table */}
              <div className="e-table-wrap hidden lg:block">
                <table className="e-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Dịch vụ</th>
                      <th>Nguồn khách</th>
                      <th>Tệp khách</th>
                      <th className="num">Doanh thu tổng</th>
                      <th className="num">Upsale</th>
                      <th className="w-px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.map(r => (
                      <tr key={r.id}>
                        <td className="min-w-[180px]">
                          <div className="text-[14px] font-semibold !text-slate-900 truncate max-w-[240px]">{r.customer_name}</div>
                          <div className="text-[12px] text-slate-500 flex items-center gap-1 tabular-nums">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" /> {new Date(r.surgery_date).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                        <td className="min-w-[180px]">
                          <div className="text-[14px] !text-slate-800 truncate max-w-[260px]">{r.service || 'N/A'}</div>
                          <div className="e-badge e-badge-sm e-tone-brand mt-1">{r.service_group || 'Chưa rõ'}</div>
                        </td>
                        <td><span className="e-badge e-badge-sm e-tone-neutral">{r.customer_source || 'Khác'}</span></td>
                        <td className="whitespace-nowrap">{r.customer_type || 'Mới'}</td>
                        <td className="num whitespace-nowrap font-semibold !text-teal-700">{fmt(r.revenue || 0)}</td>
                        <td className="num whitespace-nowrap">{fmt(r.upsale_revenue || 0)}</td>
                        <td className="whitespace-nowrap">
                          {(profile?.role === 'admin' || profile?.role === 'marketing') && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => openEditRevenue(r)} className="e-btn e-btn-secondary e-btn-sm">
                                <Pencil className="w-4 h-4" /> Sửa
                              </button>
                              <button onClick={() => handleDeleteRevenue(r)} title="Xóa" className="e-btn e-btn-danger-soft e-btn-sm w-[34px] px-0">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'expenses' && canViewAds && (
        <div className="space-y-4">
          <FinanceRevenueSummary
            stats={stats}
            month={month}
            onViewDetail={() => setActiveTab('revenue')}
          />
          {canViewAds && (
            <FinanceAdsSummary
              stats={stats}
              month={month}
              onViewDetail={() => {
                  window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'ads_report', bubbles: true }));
                }}
            />
          )}
          <FinanceHospitalFeeSummary
            stats={stats}
            month={month}
            onViewDetail={() => {
                window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'vien_phi', bubbles: true }));
              }}
          />
        </div>
      )}

      {/* Điện thoại: chi tiết 1 giao dịch doanh thu + Sửa / Xoá */}
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="e-modal-backdrop" onClick={() => setSheet(null)} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-float px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto animate-page">
            <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-3" />
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-bold text-slate-900 break-words">{sheet.customer_name}</div>
                <div className="text-[13px] text-slate-500 mt-0.5">{sheet.surgery_date ? new Date(sheet.surgery_date).toLocaleDateString('vi-VN') : '—'}</div>
              </div>
              <button onClick={() => setSheet(null)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="mt-3 rounded-2xl bg-teal-50 p-4 grid grid-cols-2 gap-3">
              <div className="min-w-0"><div className="text-[12px] text-teal-800/70">Doanh thu tổng</div><div className="text-[20px] font-bold text-teal-800 tabular-nums truncate">{fmt(sheet.revenue || 0)}</div></div>
              <div className="min-w-0"><div className="text-[12px] text-teal-800/70">Upsale</div><div className="text-[17px] font-bold text-slate-800 tabular-nums truncate">{fmt(sheet.upsale_revenue || 0)}</div></div>
            </div>
            <div className="e-subtle mt-3 divide-y divide-slate-100">
              <div className="flex items-start gap-3 px-3.5 py-3"><ReceiptText className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /><span className="text-[13px] text-slate-500 w-24 shrink-0">Dịch vụ</span><span className="text-[14px] font-semibold text-slate-800 min-w-0 break-words">{sheet.service || 'N/A'}</span></div>
              <div className="flex items-start gap-3 px-3.5 py-3"><Filter className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /><span className="text-[13px] text-slate-500 w-24 shrink-0">Phân loại</span><span className="flex flex-wrap gap-1.5"><span className="e-badge e-badge-sm e-tone-brand">{sheet.service_group || 'Chưa rõ'}</span><span className="e-badge e-badge-sm e-tone-neutral">{sheet.customer_source || 'Khác'}</span><span className="e-badge e-badge-sm e-tone-neutral">{sheet.customer_type || 'Mới'}</span></span></div>
              {sheet.phone && <a href={`tel:${sheet.phone}`} className="flex items-center gap-3 px-3.5 py-3"><Phone className="w-4 h-4 text-teal-600 shrink-0" /><span className="text-[13px] text-slate-500 w-24 shrink-0">Điện thoại</span><span className="text-[14px] font-semibold text-teal-700 tabular-nums">{sheet.phone}</span></a>}
              {sheet.notes && <div className="flex items-start gap-3 px-3.5 py-3"><StickyNote className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /><span className="text-[13px] text-slate-500 w-24 shrink-0">Ghi chú</span><span className="text-[14px] text-slate-800 min-w-0 whitespace-pre-line break-words">{sheet.notes}</span></div>}
            </div>
            {(profile?.role === 'admin' || profile?.role === 'marketing') && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => { const r = sheet; setSheet(null); openEditRevenue(r); }} className="e-btn e-btn-outline h-12"><Pencil className="w-4 h-4" /> Sửa</button>
                <button onClick={() => { const r = sheet; setSheet(null); handleDeleteRevenue(r); }} className="e-btn e-btn-danger-soft h-12"><Trash2 className="w-4 h-4" /> Xoá</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Revenue Modal */}
      {showImportModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">Import doanh thu từ Excel / CSV</h3>
              <button onClick={() => { setShowImportModal(false); setImportPreview(null); }} title="Đóng" className="e-icon-btn w-8 h-8 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body space-y-4 overflow-y-auto">
              {/* Hướng dẫn */}
              <div className="e-subtle p-4 text-[13px] text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800">Các cột BẮT BUỘC đúng thứ tự (dòng đầu là tiêu đề):</div>
                <ol className="list-decimal ml-5 space-y-0.5 text-[12px] text-slate-500">
                  <li><b>ngay_phau_thuat</b> — định dạng <code>YYYY-MM-DD</code> (vd 2026-06-19)</li>
                  <li><b>ten_khach_hang</b></li>
                  <li><b>so_dien_thoai</b></li>
                  <li><b>dich_vu</b></li>
                  <li><b>nhom_dich_vu</b> — Hàm mặt / Body / Tiểu phẫu</li>
                  <li><b>nguon_khach</b> — Ads / CTV / Người quen / CSKH</li>
                  <li><b>tep_khach</b> — Mới / Cũ</li>
                  <li><b>doanh_thu</b> — số (vd 18000000)</li>
                  <li><b>doanh_thu_upsale</b> — số</li>
                  <li><b>ma_telesale</b> — mã NV telesale (vd NV001), để trống nếu không có</li>
                  <li><b>ma_telesale_2</b> — mã NV telesale phụ trách thứ 2 (nếu 2 người cùng care → chia đôi hoa hồng), để trống nếu không có</li>
                  <li><b>ma_sale</b> — mã NV sale offline, để trống nếu không có</li>
                  <li><b>ghi_chu</b></li>
                </ol>
                <button onClick={downloadTemplate} className="e-btn e-btn-ghost e-btn-sm -ml-3 mt-1">
                  <Download className="w-4 h-4" /> Tải file mẫu (.csv)
                </button>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-teal-300 bg-teal-50/40 rounded-xl cursor-pointer transition hover:bg-teal-50 text-teal-700 text-[14px] font-semibold">
                <Upload className="w-5 h-5" /> Chọn file CSV để tải lên
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </label>

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="e-badge e-tone-success">{importPreview.valid.length} dòng hợp lệ</span>
                    {importPreview.errors.length > 0 && <span className="e-badge e-tone-danger">{importPreview.errors.length} dòng lỗi</span>}
                  </div>
                  {importPreview.errors.length > 0 && (
                    <div className="bg-danger-50 border border-danger-100 rounded-xl p-3 max-h-32 overflow-y-auto text-[12px] text-danger-600 space-y-0.5">
                      {importPreview.errors.map((er, i) => <div key={i}>• {er}</div>)}
                    </div>
                  )}
                  {importPreview.valid.length > 0 && (
                    <div className="border border-slate-200 rounded-xl max-h-48 overflow-auto">
                      <table className="w-full text-[13px] border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-slate-50 text-[12px] text-slate-500"><tr>
                          <th className="text-left font-semibold px-3 h-9 border-b border-slate-200">Ngày</th><th className="text-left font-semibold px-3 h-9 border-b border-slate-200">Khách</th>
                          <th className="text-right font-semibold px-3 h-9 border-b border-slate-200">Doanh thu</th><th className="text-right font-semibold px-3 h-9 border-b border-slate-200">Upsale</th>
                        </tr></thead>
                        <tbody className="text-slate-700">
                          {importPreview.valid.slice(0, 50).map((v, i) => (
                            <tr key={i}><td className="px-3 h-9 border-b border-slate-100 tabular-nums">{v.surgery_date}</td><td className="px-3 h-9 border-b border-slate-100">{v.customer_name}</td>
                              <td className="px-3 h-9 border-b border-slate-100 text-right tabular-nums">{new Intl.NumberFormat('vi-VN').format(v.revenue)}</td>
                              <td className="px-3 h-9 border-b border-slate-100 text-right tabular-nums">{new Intl.NumberFormat('vi-VN').format(v.upsale_revenue)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="e-modal-footer shrink-0">
              <button onClick={() => { setShowImportModal(false); setImportPreview(null); }} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={handleImport} disabled={importing || !importPreview?.valid?.length}
                className="e-btn e-btn-primary">
                {importing ? 'Đang import...' : `Import ${importPreview?.valid?.length || 0} dòng`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="e-modal-backdrop z-50 flex justify-center items-end lg:items-start lg:py-10 lg:px-4 overflow-y-auto">
          <div className="e-modal max-w-3xl overflow-hidden lg:my-auto max-lg:max-w-none max-lg:rounded-b-none max-lg:rounded-t-3xl max-lg:max-h-[92vh] max-lg:flex max-lg:flex-col">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2 shrink-0" />
            <div className="e-modal-header items-center">
              <div className="min-w-0">
                <h3 className="e-modal-title">{createForm.id ? 'Sửa doanh thu' : 'Nhập doanh thu trực tiếp'}</h3>
                <p className="e-card-sub">Các trường có dấu * là bắt buộc</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} title="Đóng" className="e-icon-btn w-8 h-8 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="max-lg:flex max-lg:flex-col max-lg:min-h-0">
              <div className="e-modal-body space-y-5 max-lg:overflow-y-auto">
                <section>
                  <div className="e-caption mb-2.5">Thông tin khách</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                    <div>
                      <label className="e-label">Ngày <span className="text-danger-500">*</span></label>
                      <input required type="date" value={createForm.surgery_date} onChange={e => setCreateForm({...createForm, surgery_date: e.target.value})} className="e-input max-lg:h-12 max-lg:text-[16px]" />
                    </div>
                    <div>
                      <label className="e-label">Họ tên khách hàng <span className="text-danger-500">*</span></label>
                      <input required value={createForm.customer_name} onChange={e => setCreateForm({...createForm, customer_name: e.target.value})} className="e-input max-lg:h-12 max-lg:text-[16px]" placeholder="Nhập tên..." />
                    </div>
                    <div>
                      <label className="e-label">Số điện thoại <span className="text-danger-500">*</span></label>
                      <input required value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="e-input max-lg:h-12 max-lg:text-[16px]" placeholder="Nhập SĐT..." />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="e-caption mb-2.5">Dịch vụ &amp; nguồn khách</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                    <div>
                      <label className="e-label">Dịch vụ sử dụng <span className="text-danger-500">*</span></label>
                      <input required value={createForm.service} onChange={e => setCreateForm({...createForm, service: e.target.value})} className="e-input max-lg:h-12 max-lg:text-[16px]" placeholder="Ví dụ: Nâng mũi" />
                    </div>
                    <div>
                      <label className="e-label">Nhóm dịch vụ <span className="text-danger-500">*</span></label>
                      <select value={createForm.service_group} onChange={e => setCreateForm({...createForm, service_group: e.target.value})} className="e-input cursor-pointer max-lg:h-12 max-lg:text-[16px]">
                        <option value="Hàm mặt">Hàm mặt</option>
                        <option value="Body">Body</option>
                        <option value="Tiểu phẫu">Tiểu phẫu</option>
                      </select>
                    </div>
                    <div>
                      <label className="e-label">Nguồn khách <span className="text-danger-500">*</span></label>
                      <select value={createForm.customer_source} onChange={e => setCreateForm({...createForm, customer_source: e.target.value})} className="e-input cursor-pointer max-lg:h-12 max-lg:text-[16px]">
                        <option value="Ads">Ads</option>
                        <option value="Seeding">Seeding</option>
                        <option value="CTV">CTV</option>
                        <option value="Người quen">Người quen</option>
                        <option value="CSKH">CSKH</option>
                      </select>
                    </div>
                    <div>
                      <label className="e-label">Tệp khách <span className="text-danger-500">*</span></label>
                      <select value={createForm.customer_type} onChange={e => setCreateForm({...createForm, customer_type: e.target.value})} className="e-input cursor-pointer max-lg:h-12 max-lg:text-[16px]">
                        <option value="Mới">Khách Mới</option>
                        <option value="Cũ">Khách Cũ</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="e-caption mb-2.5">Doanh thu</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <label className="e-label">Doanh thu tổng (VNĐ) <span className="text-danger-500">*</span></label>
                      <MoneyInput required value={createForm.revenue} onChange={v => setCreateForm({...createForm, revenue: v})} className="e-input text-teal-700 font-bold tabular-nums max-lg:h-12 max-lg:text-[16px]" placeholder="0" />
                    </div>
                    <div>
                      <label className="e-label">Doanh thu Upsale (VNĐ)</label>
                      <MoneyInput value={createForm.upsale_revenue} onChange={v => setCreateForm({...createForm, upsale_revenue: v})} className="e-input font-bold tabular-nums max-lg:h-12 max-lg:text-[16px]" placeholder="0" />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="e-caption mb-2.5">Nhân sự phụ trách</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                    <div>
                      <label className="e-label">Sale Offline phụ trách</label>
                      <select value={createForm.sale_id} onChange={e => setCreateForm({...createForm, sale_id: e.target.value})} className="e-input cursor-pointer max-lg:h-12 max-lg:text-[16px]">
                        <option value="">-- Không có --</option>
                        {staffList.filter(s => s.role === 'sale_offline' || s.role_2 === 'sale_offline' || s.role === 'admin').map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="e-label">Telesale phụ trách</label>
                      <select value={createForm.telesale_id} onChange={e => setCreateForm({...createForm, telesale_id: e.target.value})} className="e-input cursor-pointer max-lg:h-12 max-lg:text-[16px]">
                        <option value="">-- Không có --</option>
                        {staffList.filter(s => s.role === 'telesale' || s.role_2 === 'telesale' || s.role === 'admin').map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="e-label">Telesale phụ trách 2 <span className="text-slate-400 font-normal">(chia đôi HH)</span></label>
                      <select value={createForm.telesale_id_2} onChange={e => setCreateForm({...createForm, telesale_id_2: e.target.value})} className="e-input cursor-pointer max-lg:h-12 max-lg:text-[16px]">
                        <option value="">-- Không có --</option>
                        {staffList.filter(s => (s.role === 'telesale' || s.role_2 === 'telesale' || s.role === 'admin') && s.id !== createForm.telesale_id).map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <div>
                  <label className="e-label">Ghi chú thêm</label>
                  <textarea rows={3} value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})} className="e-textarea resize-none max-lg:text-[16px]" placeholder="Nhập ghi chú..."></textarea>
                </div>
              </div>

              <div className="e-modal-footer max-lg:rounded-none max-lg:bg-white max-lg:pb-[calc(16px+env(safe-area-inset-bottom))]">
                <button type="button" onClick={() => setShowCreateModal(false)} className="e-btn e-btn-secondary lg:hidden h-12 flex-1">Huỷ</button>
                <button type="submit" disabled={saving} className="e-btn e-btn-primary max-lg:h-12 max-lg:flex-1">
                  {saving ? 'Đang lưu...' : (createForm.id ? 'Cập nhật' : 'Nhập Doanh Thu')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceManagementPage;
