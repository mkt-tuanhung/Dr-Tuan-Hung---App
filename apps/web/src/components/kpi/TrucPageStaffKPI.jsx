import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, AlertCircle, Phone, MessageCircle, Percent, Target, Plus, Trash2, Upload, Download, X } from 'lucide-react';
import { computeTrucPage, PHONE_COMMISSION } from '@/lib/kpiCalc';
import { parseCSV, downloadCsv } from '@/lib/csv';

const IMPORT_HEADERS = ['ngay', 'so_dien_thoai', 'so_sdt_quan_tam', 'so_tin_nhan', 'so_tin_spam'];
const IMPORT_TEMPLATE = IMPORT_HEADERS.join(',') + '\n' +
  '2026-06-01,12,8,40,5\n2026-06-02,9,6,33,3\n';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const todayStr = () => new Date().toISOString().split('T')[0];

const ACCENTS = {
  emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600', orange: 'bg-orange-50 text-orange-600',
};
const Card = ({ icon: Icon, label, value, sub, accent = 'emerald' }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ACCENTS[accent]}`}><Icon className="w-3.5 h-3.5" /></span>
      {label}
    </div>
    <div className="text-2xl font-black text-slate-800 mt-2">{value}</div>
    {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
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

  const deleteReport = async (id) => {
    if (!window.confirm('Xoá báo cáo này?')) return;
    const { error } = await supabase.from('page_daily_reports').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã xoá'); loadData();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + month nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">KPI của tôi · Trực page</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="text-sm font-medium text-slate-700 min-w-[96px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        {[['overview', 'Tổng quan KPI'], ['report', 'Báo cáo số']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Chỉ tiêu được giao */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="font-bold text-emerald-700 flex items-center gap-2"><Target className="w-4 h-4" /> KPI tháng được giao</h3>
            </div>
            <div className="p-5">
              {!kpi || (!kpi.target_phones && !kpi.target_close_rate) ? (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl py-8 flex flex-col items-center text-center">
                  <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                  <div className="font-semibold text-amber-700">Bạn chưa được giao KPI cho tháng này.</div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500">SĐT xin được</span><span className="font-bold">{phoneProgress}%</span></div>
                    <div className="text-lg font-black text-emerald-700 mt-1">{fmt(phones)}</div>
                    <div className="text-xs text-slate-400">Mục tiêu: {fmt(kpi.target_phones)}</div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${phoneProgress}%` }} /></div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Tỉ lệ xin số</span><span className="font-bold">{rateProgress}%</span></div>
                    <div className="text-lg font-black text-blue-700 mt-1">{rate.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">Mục tiêu: {Number(kpi.target_close_rate || 0).toFixed(1)}%</div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${rateProgress}%` }} /></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chỉ số nổi bật */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl p-4 shadow-md flex flex-col justify-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/90">Hoa hồng tạm tính</div>
              <div className="text-3xl font-black mt-1">{fmtM(hh)}</div>
              <div className="text-xs text-white/80 mt-1">SĐT quan tâm × {fmt(PHONE_COMMISSION)}đ</div>
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
          <div className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-emerald-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Báo cáo số điện thoại trong ngày</h3>
              <button onClick={() => { setImportPreview(null); setShowImport(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50">
                <Upload className="w-4 h-4" /> Import nhiều ngày
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ngày</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tổng SĐT xin được</label>
                <input type="number" min="0" value={form.total_phones} onChange={e => setForm(f => ({ ...f, total_phones: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">SĐT quan tâm (tính HH)</label>
                <input type="number" min="0" value={form.total_interested_phones} onChange={e => setForm(f => ({ ...f, total_interested_phones: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tổng tin nhắn tiếp nhận</label>
                <input type="number" min="0" value={form.total_messages} onChange={e => setForm(f => ({ ...f, total_messages: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tin nhắn spam</label>
                <input type="number" min="0" value={form.total_spam_messages} onChange={e => setForm(f => ({ ...f, total_spam_messages: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Telesale tiếp nhận số</label>
                <select value={form.telesale_id} onChange={e => setForm(f => ({ ...f, telesale_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400">
                  <option value="">— Chọn telesale —</option>
                  {telesales.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={saveReport} disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu báo cáo'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">* Mỗi ngày 1 báo cáo. Lưu lại cùng ngày sẽ ghi đè.</p>
          </div>

          {/* Bảng báo cáo */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Báo cáo số theo ngày</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Ngày</th>
                    <th className="text-center px-3 py-2.5 font-medium">SĐT xin được</th>
                    <th className="text-center px-3 py-2.5 font-medium">Quan tâm</th>
                    <th className="text-center px-3 py-2.5 font-medium">Tin nhắn</th>
                    <th className="text-center px-3 py-2.5 font-medium">Spam</th>
                    <th className="text-left px-4 py-2.5 font-medium">Telesale nhận</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reports.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">Chưa có báo cáo nào.</td></tr>
                  ) : reports.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">{r.date}</td>
                      <td className="text-center px-3 py-2.5 font-semibold text-emerald-700">{fmt(r.total_phones)}</td>
                      <td className="text-center px-3 py-2.5 text-violet-600">{fmt(r.total_interested_phones)}</td>
                      <td className="text-center px-3 py-2.5">{fmt(r.total_messages)}</td>
                      <td className="text-center px-3 py-2.5 text-slate-400">{fmt(r.total_spam_messages)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.telesale?.full_name || '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => deleteReport(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Import báo cáo số */}
      {showImport && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-emerald-50 shrink-0">
              <h3 className="font-bold text-emerald-800">Import báo cáo số điện thoại</h3>
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-600 space-y-2">
                <div className="font-semibold text-blue-700">Các cột đúng thứ tự (dòng đầu là tiêu đề):</div>
                <ol className="list-decimal ml-5 space-y-0.5 text-xs">
                  <li><b>ngay</b> — định dạng <code>YYYY-MM-DD</code></li>
                  <li><b>so_dien_thoai</b> — tổng SĐT xin được trong ngày</li>
                  <li><b>so_sdt_quan_tam</b> — SĐT khách quan tâm</li>
                  <li><b>so_tin_nhan</b> — tổng tin nhắn</li>
                  <li><b>so_tin_spam</b> — tin nhắn spam</li>
                </ol>
                <div className="text-xs text-slate-400">Trùng ngày sẽ được cập nhật đè (không tạo trùng).</div>
                <button onClick={() => downloadCsv('mau_bao_cao_so.csv', IMPORT_TEMPLATE)} className="mt-1 inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline">
                  <Download className="w-4 h-4" /> Tải file mẫu (.csv)
                </button>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:bg-emerald-50 text-emerald-700 font-semibold">
                <Upload className="w-5 h-5" /> Chọn file CSV để tải lên
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </label>

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{importPreview.valid.length} ngày hợp lệ</span>
                    {importPreview.errors.length > 0 && <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 font-semibold">{importPreview.errors.length} dòng lỗi</span>}
                  </div>
                  {importPreview.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5">
                      {importPreview.errors.map((er, i) => <div key={i}>• {er}</div>)}
                    </div>
                  )}
                  {importPreview.valid.length > 0 && (
                    <div className="border border-slate-100 rounded-xl max-h-48 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr>
                          <th className="text-left px-3 py-2">Ngày</th><th className="text-right px-3 py-2">SĐT</th><th className="text-right px-3 py-2">Quan tâm</th><th className="text-right px-3 py-2">Tin nhắn</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {importPreview.valid.slice(0, 50).map((v, i) => (
                            <tr key={i}><td className="px-3 py-1.5">{v.date}</td><td className="px-3 py-1.5 text-right">{v.total_phones}</td><td className="px-3 py-1.5 text-right">{v.total_interested_phones}</td><td className="px-3 py-1.5 text-right">{v.total_messages}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-white">Hủy</button>
              <button onClick={handleImport} disabled={importing || !importPreview?.valid?.length} className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-xl text-sm hover:bg-emerald-700 disabled:opacity-50">
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
