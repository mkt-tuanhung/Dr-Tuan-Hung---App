import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, AlertCircle, Phone, MessageCircle, Percent, Target, Plus, Trash2, Upload, Download, X, Pencil } from 'lucide-react';
import { computeTrucPage, PHONE_COMMISSION } from '@/lib/kpiCalc';
import { parseCSV, downloadCsv } from '@/lib/csv';
import { vnToday } from '@/lib/vnTime';

const IMPORT_HEADERS = ['ngay', 'so_dien_thoai', 'so_sdt_quan_tam', 'so_tin_nhan', 'so_tin_spam'];
const IMPORT_TEMPLATE = IMPORT_HEADERS.join(',') + '\n' +
  '2026-06-01,12,8,40,5\n2026-06-02,9,6,33,3\n';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const todayStr = () => vnToday();

const ACCENTS = {
  emerald: 'bg-teal-50 text-teal-700', blue: 'bg-info-50 text-info-600',
  violet: 'bg-lavender-50 text-lavender-600', orange: 'bg-peach-50 text-peach-600',
};
const Card = ({ icon: Icon, label, value, sub, accent = 'emerald' }) => (
<div className="e-metric flex-col lg:flex-row items-start p-3.5 lg:p-4 gap-2.5 lg:gap-3">
    <span className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full grid place-items-center shrink-0 ${ACCENTS[accent]}`}><Icon className="w-5 h-5" /></span>
    <div className="min-w-0 w-full lg:w-auto">
      <div className="e-metric-label whitespace-normal text-[12.5px] lg:text-[13px]">{label}</div>
      <div className="text-[18px] lg:text-[20px] font-bold text-slate-900 leading-tight tabular-nums break-words mt-0.5">{value}</div>
      {sub && <div className="text-[11.5px] text-slate-400 mt-1">{sub}</div>}
    </div>
  </div>
);

const EMPTY = { date: todayStr(), total_phones: '', total_interested_phones: '', total_messages: '', total_spam_messages: '', telesale_id: '' };

const TrucPageStaffKPI = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [tab, setTab] = useState('overview'); // overview | report
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [reports, setReports] = useState([]);
  const [telesales, setTelesales] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const [kpiRes, repRes, tsRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('staff_id', profile.id).eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('page_daily_reports').select('*, telesale:telesale_id(full_name)')
        .eq('staff_id', profile.id).gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: false }),
      supabase.from('profiles').select('id, full_name').or('role.eq.telesale,role_2.eq.telesale').eq('is_active', true).order('full_name'),
    ]);
    if (repRes.error) toast.error('Không tải được báo cáo: ' + repRes.error.message);
    setKpi(kpiRes.data || null);
    setReports(repRes.data || []);
    setTelesales(tsRes.data || []);
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const { phones, interested, messages, spam, rate, hh } = computeTrucPage(reports);
  const phoneProgress = kpi?.target_phones > 0 ? Math.min(Math.round(phones / kpi.target_phones * 100), 100) : 0;
  const rateProgress = kpi?.target_close_rate > 0 ? Math.min(Math.round(rate / kpi.target_close_rate * 100), 100) : 0;

  const saveReport = async () => {
    if (!form.date) { toast.error('Chọn ngày'); return; }
    setSaving(true);
    try {
      const payload = {
        staff_id: profile.id, date: form.date,
        total_phones: Number(form.total_phones) || 0,
        total_interested_phones: Number(form.total_interested_phones) || 0,
        total_messages: Number(form.total_messages) || 0,
        total_spam_messages: Number(form.total_spam_messages) || 0,
        telesale_id: form.telesale_id || null,
      };
      const { error } = await supabase.from('page_daily_reports').upsert(payload, { onConflict: 'staff_id,date' });
      if (error) throw error;
      toast.success('Đã lưu báo cáo ngày ' + form.date);
      setForm(EMPTY);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportPreview(null);
    const rows = parseCSV(await file.text());
    if (rows.length < 2) { toast.error('File trống hoặc thiếu dữ liệu'); e.target.value = ''; return; }
    const valid = [], errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (idx) => (r[idx] || '').trim();
      const date = get(0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Dòng ${i + 1}: ngày sai định dạng (YYYY-MM-DD)`); continue; }
      valid.push({
        staff_id: profile.id, date,
        total_phones: Number(get(1).replace(/\D/g, '')) || 0,
        total_interested_phones: Number(get(2).replace(/\D/g, '')) || 0,
        total_messages: Number(get(3).replace(/\D/g, '')) || 0,
        total_spam_messages: Number(get(4).replace(/\D/g, '')) || 0,
      });
    }
    setImportPreview({ valid, errors });
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importPreview?.valid?.length) { toast.error('Không có dòng hợp lệ'); return; }
    setImporting(true);
    try {
      const { error } = await supabase.from('page_daily_reports').upsert(importPreview.valid, { onConflict: 'staff_id,date' });
      if (error) throw error;
      toast.success(`Đã import ${importPreview.valid.length} ngày báo cáo`);
      setShowImport(false); setImportPreview(null);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  const editReport = (r) => {
    setForm({
      date: r.date,
      total_phones: String(r.total_phones ?? ''),
      total_interested_phones: String(r.total_interested_phones ?? ''),
      total_messages: String(r.total_messages ?? ''),
      total_spam_messages: String(r.total_spam_messages ?? ''),
      telesale_id: r.telesale_id || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Đang sửa báo cáo ngày ' + r.date + ' — lưu lại để cập nhật');
  };

  const deleteReport = async (id) => {
    if (!window.confirm('Xoá báo cáo này?')) return;
    const { error } = await supabase.from('page_daily_reports').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã xoá'); loadData();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header + month nav (điện thoại: chỉ còn bộ chuyển tháng to, dễ bấm) */}
      <div className="e-toolbar justify-between pl-2.5 lg:pl-4">
        <div className="hidden lg:block">
          <h2 className="text-[15px] font-semibold text-slate-900">KPI của tôi · Trực page</h2>
          <p className="e-page-desc">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
          <button onClick={prevMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng trước"><ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <span className="flex flex-col items-center lg:block min-w-[104px] text-center">
            <span className="block text-[15px] lg:text-[13.5px] font-semibold text-slate-800 tabular-nums">{MONTHS[month - 1]} {year}</span>
            <span className="lg:hidden text-[12px] text-slate-500 mt-0.5">KPI Trực page</span>
          </span>
          <button onClick={nextMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng sau"><ChevronRight className="w-5 h-5 lg:w-4 lg:h-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="e-seg flex w-full lg:inline-flex lg:w-auto">
        {[['overview', 'Tổng quan KPI'], ['report', 'Báo cáo số']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`e-seg-item flex-1 lg:flex-none h-10 lg:h-8 text-[14px] lg:text-[13px] ${tab === id ? 'e-seg-active' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Chỉ tiêu được giao */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><Target className="w-4 h-4 text-teal-700 lg:text-current" /> KPI tháng được giao</h3>
            </div>
            <div className="p-4 lg:p-5">
              {!kpi || (!kpi.target_phones && !kpi.target_close_rate) ? (
                <div className="e-subtle e-empty">
                  <AlertCircle className="w-12 h-12 p-3 rounded-full bg-warning-50 text-warning-600 mb-3" />
                  <div className="e-empty-title">Bạn chưa được giao KPI cho tháng này.</div>
                </div>
              ) : (
                <>
                  {/* Điện thoại: vòng KPI to + dòng tiến độ (kiểu Ethics M15) */}
                  <div className="lg:hidden">
                    <div className="relative w-[200px] h-[200px] mx-auto mt-1 rounded-full"
                      style={{ background: `conic-gradient(#3CA7A9 0%, #067B7F ${phoneProgress}%, #EAF4F4 ${phoneProgress}% 100%)` }}>
                      <div className="absolute inset-[22px] rounded-full bg-white grid place-items-center text-center">
                        <div>
                          <div className="text-[44px] font-bold text-slate-900 leading-none tabular-nums">{phoneProgress}%</div>
                          <div className="text-[13px] text-slate-500 mt-1.5">KPI SĐT xin được</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-4">
                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13.5px] font-medium text-slate-700">SĐT xin được</span>
                          <span className="text-[13.5px] font-bold text-teal-700 tabular-nums">{phoneProgress}%</span>
                        </div>
                        <div className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums"><b className="font-semibold text-slate-900">{fmt(phones)}</b> / {fmt(kpi.target_phones)}</div>
                        <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden"><div className="h-2 rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9]" style={{ width: `${phoneProgress}%` }} /></div>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13.5px] font-medium text-slate-700">Tỉ lệ xin số</span>
                          <span className="text-[13.5px] font-bold text-teal-700 tabular-nums">{rateProgress}%</span>
                        </div>
                        <div className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums"><b className="font-semibold text-slate-900">{rate.toFixed(1)}%</b> / {Number(kpi.target_close_rate || 0).toFixed(1)}%</div>
                        <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden"><div className="h-2 rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9]" style={{ width: `${rateProgress}%` }} /></div>
                      </div>
                    </div>
                  </div>

                  {/* Máy tính: giữ nguyên */}
                  <div className="hidden lg:grid sm:grid-cols-2 gap-4">
                    <div className="e-subtle p-4">
                      <div className="flex items-center justify-between text-sm"><span className="text-slate-500">SĐT xin được</span><span className="font-bold">{phoneProgress}%</span></div>
                      <div className="text-[20px] font-bold text-slate-900 mt-1 tabular-nums">{fmt(phones)}</div>
                      <div className="text-xs text-slate-400">Mục tiêu: {fmt(kpi.target_phones)}</div>
                      <div className="w-full bg-white rounded-full h-2 mt-3 overflow-hidden"><div className="h-2 rounded-full bg-teal-500" style={{ width: `${phoneProgress}%` }} /></div>
                    </div>
                    <div className="e-subtle p-4">
                      <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Tỉ lệ xin số</span><span className="font-bold">{rateProgress}%</span></div>
                      <div className="text-[20px] font-bold text-slate-900 mt-1 tabular-nums">{rate.toFixed(1)}%</div>
                      <div className="text-xs text-slate-400">Mục tiêu: {Number(kpi.target_close_rate || 0).toFixed(1)}%</div>
                      <div className="w-full bg-white rounded-full h-2 mt-3 overflow-hidden"><div className="h-2 rounded-full bg-teal-700" style={{ width: `${rateProgress}%` }} /></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chỉ số nổi bật */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2 e-card e-card-pad bg-teal-50 border-teal-100 flex flex-col justify-center">
              <div className="e-caption text-teal-700">Hoa hồng tạm tính</div>
              <div className="text-[28px] font-bold text-teal-800 mt-1 tabular-nums">{fmtM(hh)}</div>
              <div className="text-[12px] text-slate-600 mt-1">SĐT quan tâm × {fmt(PHONE_COMMISSION)}đ</div>
            </div>
            <Card icon={Phone} label="SĐT xin được" value={fmt(phones)} sub={`Quan tâm: ${fmt(interested)}`} accent="emerald" />
            <Card icon={MessageCircle} label="Tin nhắn" value={fmt(messages)} sub={`Spam: ${fmt(spam)}`} accent="blue" />
            <Card icon={Percent} label="Tỉ lệ xin số" value={`${rate.toFixed(1)}%`} sub="SĐT / Tin nhắn" accent="orange" />
          </div>
        </>
      )}

      {tab === 'report' && (
        <>
          {/* Form báo cáo ngày */}
          <div className="e-card e-card-pad">
            <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
              <h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><Plus className="w-4 h-4 text-teal-700 lg:text-current" /> Báo cáo số điện thoại trong ngày</h3>
              <button onClick={() => { setImportPreview(null); setShowImport(true); }} className="e-btn e-btn-outline e-btn-sm h-11 lg:h-[34px]">
                <Upload className="w-4 h-4" /> Import nhiều ngày
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              <div className="col-span-2 lg:col-span-1">
                <label className="e-label">Ngày</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="e-input h-12 lg:h-10 text-[16px] lg:text-[14px]" />
              </div>
              <div className="min-w-0">
                <label className="e-label">Tổng SĐT xin được</label>
                <input type="number" min="0" value={form.total_phones} onChange={e => setForm(f => ({ ...f, total_phones: e.target.value }))}
                  className="e-input h-12 lg:h-10 text-[16px] lg:text-[14px] tabular-nums" />
              </div>
              <div className="min-w-0">
                <label className="e-label">SĐT quan tâm (tính HH)</label>
                <input type="number" min="0" value={form.total_interested_phones} onChange={e => setForm(f => ({ ...f, total_interested_phones: e.target.value }))}
                  className="e-input h-12 lg:h-10 text-[16px] lg:text-[14px] tabular-nums" />
              </div>
              <div className="min-w-0">
                <label className="e-label">Tổng tin nhắn tiếp nhận</label>
                <input type="number" min="0" value={form.total_messages} onChange={e => setForm(f => ({ ...f, total_messages: e.target.value }))}
                  className="e-input h-12 lg:h-10 text-[16px] lg:text-[14px] tabular-nums" />
              </div>
              <div className="min-w-0">
                <label className="e-label">Tin nhắn spam</label>
                <input type="number" min="0" value={form.total_spam_messages} onChange={e => setForm(f => ({ ...f, total_spam_messages: e.target.value }))}
                  className="e-input h-12 lg:h-10 text-[16px] lg:text-[14px] tabular-nums" />
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label className="e-label">Telesale tiếp nhận số</label>
                <select value={form.telesale_id} onChange={e => setForm(f => ({ ...f, telesale_id: e.target.value }))}
                  className="e-input h-12 lg:h-10 text-[16px] lg:text-[14px]">
                  <option value="">— Chọn telesale —</option>
                  {telesales.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
              <button onClick={saveReport} disabled={saving}
                className="e-btn e-btn-primary w-full lg:w-auto h-12 lg:h-10 text-[15px] lg:text-[14px]">
                {saving ? 'Đang lưu...' : 'Lưu báo cáo'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center lg:text-left">* Mỗi ngày 1 báo cáo. Lưu lại cùng ngày sẽ ghi đè.</p>
          </div>

          {/* Bảng báo cáo */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Báo cáo số theo ngày</h3></div>
            {/* Điện thoại: danh sách thẻ */}
            <div className="lg:hidden divide-y divide-slate-100">
              {reports.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-slate-400">Chưa có báo cáo nào.</div>
              ) : reports.map(r => (
                <div key={r.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold text-slate-900 tabular-nums">{r.date}</div>
                      <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">Telesale nhận: {r.telesale?.full_name || '—'}</div>
                    </div>
                    <button onClick={() => editReport(r)} className="w-10 h-10 rounded-xl border border-slate-200 bg-white grid place-items-center text-slate-500 active:bg-teal-50 active:text-teal-700 shrink-0" title="Sửa" aria-label="Sửa"><Pencil className="w-[18px] h-[18px]" /></button>
                    <button onClick={() => deleteReport(r.id)} className="w-10 h-10 rounded-xl bg-danger-50 grid place-items-center text-danger-600 active:brightness-95 shrink-0" title="Xoá" aria-label="Xoá"><Trash2 className="w-[18px] h-[18px]" /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="rounded-xl bg-teal-50 px-1 py-2 text-center"><div className="text-[16px] font-bold text-teal-700 tabular-nums leading-tight">{fmt(r.total_phones)}</div><div className="text-[11.5px] text-slate-500 mt-0.5">SĐT</div></div>
                    <div className="rounded-xl bg-lavender-50 px-1 py-2 text-center"><div className="text-[16px] font-bold text-lavender-600 tabular-nums leading-tight">{fmt(r.total_interested_phones)}</div><div className="text-[11.5px] text-slate-500 mt-0.5">Quan tâm</div></div>
                    <div className="rounded-xl bg-slate-50 px-1 py-2 text-center"><div className="text-[16px] font-bold text-slate-800 tabular-nums leading-tight">{fmt(r.total_messages)}</div><div className="text-[11.5px] text-slate-500 mt-0.5">Tin nhắn</div></div>
                    <div className="rounded-xl bg-slate-50 px-1 py-2 text-center"><div className="text-[16px] font-bold text-slate-400 tabular-nums leading-tight">{fmt(r.total_spam_messages)}</div><div className="text-[11.5px] text-slate-500 mt-0.5">Spam</div></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="e-table whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="text-left">Ngày</th>
                    <th className="text-center">SĐT xin được</th>
                    <th className="text-center">Quan tâm</th>
                    <th className="text-center">Tin nhắn</th>
                    <th className="text-center">Spam</th>
                    <th className="text-left">Telesale nhận</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">Chưa có báo cáo nào.</td></tr>
                  ) : reports.map(r => (
                    <tr key={r.id}>
                      <td className="text-slate-700">{r.date}</td>
                      <td className="text-center font-semibold text-teal-700">{fmt(r.total_phones)}</td>
                      <td className="text-center text-lavender-600">{fmt(r.total_interested_phones)}</td>
                      <td className="text-center">{fmt(r.total_messages)}</td>
                      <td className="text-center text-slate-400">{fmt(r.total_spam_messages)}</td>
                      <td className="text-slate-600">{r.telesale?.full_name || '—'}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => editReport(r)} className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-teal-50 hover:text-teal-700" title="Sửa"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteReport(r.id)} className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-danger-50 hover:text-danger-600" title="Xoá"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Import báo cáo số (điện thoại: dạng bottom sheet) */}
      {showImport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-end lg:items-center justify-center lg:p-4">
          <div className="e-modal max-w-xl overflow-hidden flex flex-col max-h-[88vh] lg:max-h-[90vh] rounded-b-none rounded-t-3xl lg:rounded-2xl">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2 shrink-0" />
            <div className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3 lg:py-4 border-b border-slate-100 shrink-0">
              <h3 className="e-modal-title">Import báo cáo số điện thoại</h3>
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} className="e-icon-btn w-10 h-10 lg:w-8 lg:h-8 rounded-full shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 lg:p-6 space-y-4 overflow-y-auto">
              <div className="e-subtle p-4 text-[13px] text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800">Các cột đúng thứ tự (dòng đầu là tiêu đề):</div>
                <ol className="list-decimal ml-5 space-y-0.5 text-xs">
                  <li><b>ngay</b> — định dạng <code>YYYY-MM-DD</code></li>
                  <li><b>so_dien_thoai</b> — tổng SĐT xin được trong ngày</li>
                  <li><b>so_sdt_quan_tam</b> — SĐT khách quan tâm</li>
                  <li><b>so_tin_nhan</b> — tổng tin nhắn</li>
                  <li><b>so_tin_spam</b> — tin nhắn spam</li>
                </ol>
                <div className="text-xs text-slate-400">Trùng ngày sẽ được cập nhật đè (không tạo trùng).</div>
                <button onClick={() => downloadCsv('mau_bao_cao_so.csv', IMPORT_TEMPLATE)} className="mt-1 inline-flex items-center gap-1.5 min-h-[40px] lg:min-h-0 text-teal-700 font-semibold hover:underline">
                  <Download className="w-4 h-4" /> Tải file mẫu (.csv)
                </button>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-teal-300 rounded-xl cursor-pointer hover:bg-teal-50 text-teal-700 font-semibold">
                <Upload className="w-5 h-5" /> Chọn file CSV để tải lên
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </label>

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <span className="e-badge e-tone-success">{importPreview.valid.length} ngày hợp lệ</span>
                    {importPreview.errors.length > 0 && <span className="e-badge e-tone-danger">{importPreview.errors.length} dòng lỗi</span>}
                  </div>
                  {importPreview.errors.length > 0 && (
                    <div className="rounded-xl bg-danger-50 p-3 max-h-32 overflow-y-auto text-xs text-danger-600 space-y-0.5">
                      {importPreview.errors.map((er, i) => <div key={i}>• {er}</div>)}
                    </div>
                  )}
                  {importPreview.valid.length > 0 && (
                    <div className="e-card-flat max-h-48 overflow-auto">
                      <table className="e-table text-[12.5px] [&_td]:h-10 [&_th]:h-10">
                        <thead className="sticky top-0 z-10"><tr>
                          <th className="text-left">Ngày</th><th className="text-right">SĐT</th><th className="text-right">Quan tâm</th><th className="text-right">Tin nhắn</th>
                        </tr></thead>
                        <tbody>
                          {importPreview.valid.slice(0, 50).map((v, i) => (
                            <tr key={i}><td className="tabular-nums">{v.date}</td><td className="text-right tabular-nums">{v.total_phones}</td><td className="text-right">{v.total_interested_phones}</td><td className="text-right">{v.total_messages}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="e-modal-footer shrink-0 rounded-b-none lg:rounded-b-2xl px-4 lg:px-5 pb-[calc(16px+env(safe-area-inset-bottom))] lg:pb-4">
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} className="e-btn e-btn-secondary flex-1 lg:flex-none h-11 lg:h-10">Hủy</button>
              <button onClick={handleImport} disabled={importing || !importPreview?.valid?.length} className="e-btn e-btn-primary flex-1 lg:flex-none h-11 lg:h-10">
                {importing ? 'Đang import...' : `Import ${importPreview?.valid?.length || 0} ngày`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrucPageStaffKPI;
