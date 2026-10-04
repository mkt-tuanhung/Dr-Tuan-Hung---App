import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Plus, X, BarChart2, Edit, Save, Trash2, Search, DollarSign, Target, TrendingUp, AlertCircle, Phone, Loader2 } from 'lucide-react';
import MoneyInput from '@/components/MoneyInput.jsx';
import { vnToday } from '@/lib/vnTime';

const AdsReportPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [targets, setTargets] = useState({ budget: 0, target_leads: 0 });
  const [performanceData, setPerformanceData] = useState([]);
  const [pageReports, setPageReports] = useState([]); // lead do Trực page nhập (page_daily_reports)

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({ budget: 0, target_leads: 0 });

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    id: null,
    date: vnToday(),
    amount_spent: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    try {
      // Load Targets
      const { data: targetData } = await supabase
        .from('marketing_monthly_targets')
        .select('*')
        .eq('month', startDate)
        .single();
        
      if (targetData) {
        setTargets(targetData);
      } else {
        setTargets({ budget: 0, target_leads: 0 });
      }

      // Load Performance Data
      const { data: perfData, error: perfError } = await supabase
        .from('marketing_ads_performance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (perfError) throw perfError;
      setPerformanceData(perfData || []);

      // Lead do Trực page nhập (gộp tất cả nhân sự trực page theo ngày)
      const { data: pageData } = await supabase
        .from('page_daily_reports')
        .select('date, total_phones, total_interested_phones, total_messages')
        .gte('date', startDate)
        .lte('date', endDate);
      setPageReports(pageData || []);

    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const [syncingCost, setSyncingCost] = useState(false);
  const syncDailyCost = async () => {
    setSyncingCost(true);
    try {
      const { data, error } = await supabase.functions.invoke('fb-daily-cost', { body: {} });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Lỗi lấy chi phí');
      toast.success(`Đã cập nhật chi phí ${data.date}: ${new Intl.NumberFormat('vi-VN').format(data.spend)}đ`);
      loadData();
    } catch (e) { toast.error('Lỗi: ' + e.message); }
    setSyncingCost(false);
  };

  // Gộp theo ngày: chi tiêu (Marketing nhập) + lead (Trực page nhập)
  const rows = useMemo(() => {
    const byDate = {};
    performanceData.forEach(p => {
      byDate[p.date] = { date: p.date, id: p.id, amount_spent: Number(p.amount_spent || 0), phones: 0, interested: 0, messages: 0 };
    });
    pageReports.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date, id: null, amount_spent: 0, phones: 0, interested: 0, messages: 0 };
      byDate[r.date].phones += Number(r.total_phones || 0);
      byDate[r.date].interested += Number(r.total_interested_phones || 0);
      byDate[r.date].messages += Number(r.total_messages || 0);
    });
    return Object.values(byDate)
      .map(r => ({ ...r, cpa: r.phones > 0 ? Math.round(r.amount_spent / r.phones) : 0 }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [performanceData, pageReports]);

  const stats = useMemo(() => {
    let totalSpent = 0, totalLeads = 0, totalInterested = 0, totalMessages = 0;
    rows.forEach(r => { totalSpent += r.amount_spent; totalLeads += r.phones; totalInterested += r.interested; totalMessages += r.messages; });
    const remaining = targets.budget - totalSpent;
    const cpa = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0;
    const daysWithData = rows.filter(r => r.phones > 0).length;
    const avgLeads = daysWithData > 0 ? Math.round((totalLeads / daysWithData) * 10) / 10 : 0;
    return { totalSpent, totalLeads, totalInterested, totalMessages, remaining, cpa, avgLeads };
  }, [rows, targets]);

  const chartData = useMemo(() => {
    return [...rows].sort((a, b) => new Date(a.date) - new Date(b.date)).map(r => ({
      name: new Date(r.date).getDate() + '/' + (new Date(r.date).getMonth() + 1),
      'Chi phí (VNĐ)': r.amount_spent,
      'SĐT xin được': r.phones,
      CPA: r.cpa,
    }));
  }, [rows]);

  // Handlers
  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    
    try {
      const { error } = await supabase.from('marketing_monthly_targets').upsert({
        month: startDate,
        budget: configForm.budget,
        target_leads: configForm.target_leads
      });
      if (error) throw error;
      toast.success('Đã lưu cấu hình KPI tháng');
      setShowConfigModal(false);
      loadData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const openConfig = () => {
    setConfigForm({ budget: targets.budget || 0, target_leads: targets.target_leads || 0 });
    setShowConfigModal(true);
  };

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        date: entryForm.date,
        amount_spent: Number(String(entryForm.amount_spent).replace(/\D/g, '')) || 0,
      };

      if (entryForm.id) {
        const { error } = await supabase.from('marketing_ads_performance').update(payload).eq('id', entryForm.id);
        if (error) throw error;
        toast.success('Đã cập nhật chi tiêu');
      } else {
        const { error } = await supabase.from('marketing_ads_performance').insert({ ...payload, leads: 0 });
        if (error) throw error;
        toast.success('Đã thêm chi tiêu ngày');
      }
      setShowEntryModal(false);
      loadData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const openEntry = (row = null) => {
    setEntryForm(row && row.id
      ? { id: row.id, date: row.date, amount_spent: row.amount_spent }
      : { id: null, date: row?.date || vnToday(), amount_spent: '' });
    setShowEntryModal(true);
  };

  const deleteEntry = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa dữ liệu ngày này?')) return;
    try {
      const { error } = await supabase.from('marketing_ads_performance').delete().eq('id', id);
      if (error) throw error;
      toast.success('Đã xóa thành công');
      loadData();
    } catch (error) {
      toast.error('Lỗi xóa: ' + error.message);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0);

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-4">
      {/* Thanh công cụ: kỳ báo cáo + thao tác */}
      <div className="e-toolbar justify-between">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent text-[14px] font-semibold text-slate-800 outline-none cursor-pointer">
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <span className="text-slate-300">/</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-[14px] font-semibold text-slate-800 outline-none cursor-pointer">
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <span className="e-page-desc hidden md:inline px-1">Ngân sách và hiệu quả quảng cáo hằng ngày</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['admin', 'marketing'].includes(profile?.role) && (
            <button onClick={openConfig} className="e-btn e-btn-secondary">
              <Target className="w-4 h-4" /> Cài KPI
            </button>
          )}
          {['admin', 'marketing'].includes(profile?.role) && (
            <button onClick={() => openEntry()} className="e-btn e-btn-primary">
              <Plus className="w-4 h-4" /> Nhập chi tiêu
            </button>
          )}
        </div>
      </div>

      {/* Chỉ số (MetricCard Ethics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
        <div className="e-metric">
          <span className="e-metric-icon"><DollarSign /></span>
          <div className="min-w-0">
            <p className="e-metric-label">Ngân sách</p>
            <div className="e-metric-value">{fmt(targets.budget)}đ</div>
            <p className="e-metric-hint">Data KPI <b className="text-slate-600 tabular-nums">{fmt(targets.target_leads)}</b></p>
          </div>
        </div>
        <div className="e-metric">
          <span className="e-metric-icon bg-peach-50 text-peach-600"><TrendingUp /></span>
          <div className="min-w-0">
            <p className="e-metric-label">Đã tiêu</p>
            <div className="e-metric-value">{fmt(stats.totalSpent)}đ</div>
            <p className="text-[12px] text-slate-400 truncate">Tiền còn <b className={`tabular-nums ${stats.remaining < 0 ? 'text-danger-600' : 'text-success-600'}`}>
                {fmt(stats.remaining)}đ
              </b></p>
          </div>
        </div>
        <div className="e-metric">
          <span className="e-metric-icon bg-info-50 text-info-600"><Phone /></span>
          <div className="min-w-0">
            <p className="e-metric-label">SĐT xin được</p>
            <div className="e-metric-value">{fmt(stats.totalLeads)}</div>
            <p className="e-metric-hint">QT {fmt(stats.totalInterested)} · Tin {fmt(stats.totalMessages)}</p>
          </div>
        </div>
        <div className="e-metric">
          <span className="e-metric-icon bg-lavender-50 text-lavender-600"><Target /></span>
          <div className="min-w-0">
            <p className="e-metric-label">Giá 1 số (CPA)</p>
            <div className="e-metric-value">{fmt(stats.cpa)}đ</div>
          </div>
        </div>
        <div className="e-metric">
          <span className="e-metric-icon bg-warning-50 text-warning-600"><BarChart2 /></span>
          <div className="min-w-0">
            <p className="e-metric-label">TB số/ngày</p>
            <div className="e-metric-value">{stats.avgLeads}</div>
          </div>
        </div>
      </div>

      {/* Biểu đồ */}
      <div className="e-card e-card-pad">
        <div className="e-card-header">
          <div>
            <h3 className="e-card-title">Biểu đồ Chi phí &amp; Số đơn PAGE</h3>
            <p className="e-card-sub">Chi phí quảng cáo (trục trái) so với SĐT xin được (trục phải)</p>
          </div>
          <span className="e-metric-icon w-10 h-10 lg:w-10 lg:h-10"><TrendingUp className="!w-5 !h-5" /></span>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} stroke="#A3ABAA" />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => (val/1000000) + 'M'} stroke="#A3ABAA" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} stroke="#A3ABAA" />
              <RechartsTooltip formatter={(val, name) => [fmt(val), name]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Chi phí (VNĐ)" stroke="#067B7F" strokeWidth={3} activeDot={{ r: 8 }} />
              <Line yAxisId="right" type="monotone" dataKey="SĐT xin được" stroke="#F4B183" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bảng chi tiết */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 pt-4 lg:pt-5 pb-3 flex justify-between items-center gap-2 flex-wrap">
          <div>
            <h3 className="e-card-title">Chi tiết theo ngày</h3>
            <p className="e-card-sub">Chi tiêu do Marketing nhập · SĐT/Quan tâm/Tin nhắn lấy từ báo cáo Trực page (theo ngày)</p>
          </div>
          {['admin', 'marketing', 'accountant'].includes(profile?.role) && (
            <button onClick={syncDailyCost} disabled={syncingCost} className="e-btn e-btn-outline e-btn-sm shrink-0">
              {syncingCost ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}{syncingCost ? 'Đang lấy…' : 'Lấy chi phí hôm qua'}
            </button>
          )}
        </div>
        {/* Mobile: dạng thẻ */}
        <div className="md:hidden divide-y divide-slate-100 border-t border-slate-100">
          {rows.length === 0 ? (
            <div className="e-empty"><p className="e-empty-title">Chưa có dữ liệu</p></div>
          ) : rows.map((r) => (
            <div key={r.date} className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 tabular-nums">{r.date}</span>
                <div className="flex gap-2">
                  {['admin', 'marketing'].includes(profile?.role) && (r.id
                    ? <><button onClick={() => openEntry(r)} className="e-icon-btn w-8 h-8 rounded-[10px]"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => deleteEntry(r.id)} className="e-icon-btn w-8 h-8 rounded-[10px] text-danger-600 hover:!text-danger-600 hover:!border-danger-200 hover:bg-danger-50"><Trash2 className="w-4 h-4" /></button></>
                    : <button onClick={() => openEntry(r)} className="e-btn e-btn-outline e-btn-sm"><Plus className="w-3.5 h-3.5" />Chi phí</button>)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="e-subtle py-2"><div className="text-[11px] text-slate-400">Chi phí</div><div className="font-bold text-slate-800 text-[13px] tabular-nums">{fmt(r.amount_spent)}đ</div></div>
                <div className="e-subtle py-2"><div className="text-[11px] text-slate-400">SĐT xin được</div><div className="font-bold text-info-600 text-[13px] tabular-nums">{fmt(r.phones)}</div></div>
                <div className="e-subtle py-2"><div className="text-[11px] text-slate-400">CP/số</div><div className="font-bold text-teal-700 text-[13px] tabular-nums">{r.cpa ? fmt(r.cpa) : 0}đ</div></div>
                <div className="e-subtle py-2"><div className="text-[11px] text-slate-400">Quan tâm</div><div className="font-bold text-lavender-600 text-[13px] tabular-nums">{fmt(r.interested)}</div></div>
                <div className="e-subtle py-2 col-span-2"><div className="text-[11px] text-slate-400">Tin nhắn</div><div className="font-bold text-peach-600 text-[13px] tabular-nums">{fmt(r.messages)}</div></div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: bảng */}
        <div className="hidden md:block e-table-wrap">
          <table className="e-table min-w-[760px]">
            <thead>
              <tr>
                <th>Ngày</th>
                <th className="num">Chi tiêu (Marketing)</th>
                <th className="num">SĐT xin được</th>
                <th className="num">Quan tâm</th>
                <th className="num">Tin nhắn</th>
                <th className="num">Chi phí/số (CPA)</th>
                <th className="!text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-slate-400">Chưa có dữ liệu</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date}>
                    <td className="font-semibold text-slate-900 tabular-nums">{r.date}</td>
                    <td className="num font-medium text-slate-700">{fmt(r.amount_spent)} đ</td>
                    <td className="num font-bold text-info-600">{fmt(r.phones)}</td>
                    <td className="num text-lavender-600">{fmt(r.interested)}</td>
                    <td className="num text-peach-600">{fmt(r.messages)}</td>
                    <td className="num font-bold text-teal-700">{r.cpa ? fmt(r.cpa) : 0} đ</td>
                    <td className="text-center">
                      {['admin', 'marketing'].includes(profile?.role) ? (
                        <div className="flex justify-center gap-2">
                          {r.id
                            ? <><button onClick={() => openEntry(r)} className="e-icon-btn w-8 h-8 rounded-[10px]"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => deleteEntry(r.id)} className="e-icon-btn w-8 h-8 rounded-[10px] text-danger-600 hover:!text-danger-600 hover:!border-danger-200 hover:bg-danger-50"><Trash2 className="w-4 h-4" /></button></>
                            : <button onClick={() => openEntry(r)} className="e-btn e-btn-outline e-btn-sm"><Plus className="w-3.5 h-3.5" />Chi phí</button>}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showConfigModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Cài đặt KPI Tháng {month}/{year}</h3>
              <button onClick={() => setShowConfigModal(false)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfigSubmit}>
              <div className="e-modal-body space-y-4">
                <div>
                  <label className="e-label">Ngân sách (VNĐ)</label>
                  <MoneyInput required value={configForm.budget} onChange={v => setConfigForm({...configForm, budget: v})} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Data KPI (Số Leads mục tiêu)</label>
                  <input required type="number" value={configForm.target_leads} onChange={e => setConfigForm({...configForm, target_leads: e.target.value})} className="e-input" />
                </div>
              </div>
              <div className="e-modal-footer">
                <button type="button" onClick={() => setShowConfigModal(false)} className="e-btn e-btn-secondary">Hủy</button>
                <button type="submit" disabled={saving} className="e-btn e-btn-primary">
                  {saving ? 'Đang lưu...' : <><Save className="w-4 h-4" /> Lưu KPI</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEntryModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">{entryForm.id ? 'Sửa chi tiêu ngày' : 'Nhập chi tiêu ngày'}</h3>
              <button onClick={() => setShowEntryModal(false)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEntrySubmit}>
              <div className="e-modal-body space-y-4">
                <div>
                  <label className="e-label">Ngày (Date)</label>
                  <input required type="date" value={entryForm.date} onChange={e => setEntryForm({...entryForm, date: e.target.value})} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Số tiền chi tiêu (VNĐ)</label>
                  <MoneyInput required value={entryForm.amount_spent} onChange={v => setEntryForm({...entryForm, amount_spent: v})} className="e-input" />
                </div>
                <p className="e-subtle text-[12px] text-slate-500 px-3 py-2.5">Số lead (SĐT xin được, quan tâm, tin nhắn) lấy tự động từ báo cáo Trực page theo ngày.</p>
              </div>
              <div className="e-modal-footer">
                <button type="button" onClick={() => setShowEntryModal(false)} className="e-btn e-btn-secondary">Hủy</button>
                <button type="submit" disabled={saving} className="e-btn e-btn-primary">
                  {saving ? 'Đang lưu...' : <><Save className="w-4 h-4" /> Lưu chi tiêu</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsReportPage;
