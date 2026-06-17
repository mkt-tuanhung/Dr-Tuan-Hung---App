import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Plus, X, BarChart2, Edit, Save, Trash2, Search, DollarSign, Target, TrendingUp, AlertCircle, Phone } from 'lucide-react';

const AdsReportPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [targets, setTargets] = useState({ budget: 0, target_leads: 0 });
  const [performanceData, setPerformanceData] = useState([]);
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({ budget: 0, target_leads: 0 });

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    id: null,
    date: new Date().toISOString().split('T')[0],
    amount_spent: '',
    impressions: '',
    leads: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

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

    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculations
  const stats = useMemo(() => {
    let totalSpent = 0;
    let totalLeads = 0;
    performanceData.forEach(p => {
      totalSpent += Number(p.amount_spent || 0);
      totalLeads += Number(p.leads || 0);
    });

    const remaining = targets.budget - totalSpent;
    const cpa = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0;
    const daysWithData = performanceData.filter(p => p.leads > 0).length;
    const avgLeads = daysWithData > 0 ? Math.round((totalLeads / daysWithData) * 10) / 10 : 0;

    return { totalSpent, totalLeads, remaining, cpa, avgLeads };
  }, [performanceData, targets]);

  const chartData = useMemo(() => {
    // Sort ascending for chart
    return [...performanceData].sort((a,b) => new Date(a.date) - new Date(b.date)).map(p => ({
      name: new Date(p.date).getDate() + '/' + (new Date(p.date).getMonth()+1),
      'Chi phí (VNĐ)': Number(p.amount_spent || 0),
      'Số SĐT (Leads)': Number(p.leads || 0),
      CPA: p.leads > 0 ? Math.round(Number(p.amount_spent || 0)/Number(p.leads || 0)) : 0
    }));
  }, [performanceData]);

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
        amount_spent: Number(entryForm.amount_spent),
        impressions: entryForm.impressions || '',
        leads: Number(entryForm.leads)
      };

      if (entryForm.id) {
        const { error } = await supabase.from('marketing_ads_performance').update(payload).eq('id', entryForm.id);
        if (error) throw error;
        toast.success('Đã cập nhật số liệu');
      } else {
        const { error } = await supabase.from('marketing_ads_performance').insert(payload);
        if (error) throw error;
        toast.success('Đã thêm số liệu mới');
      }
      setShowEntryModal(false);
      loadData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const openEntry = (item = null) => {
    if (item) {
      setEntryForm({ ...item });
    } else {
      setEntryForm({
        id: null,
        date: new Date().toISOString().split('T')[0],
        amount_spent: '', impressions: '', leads: ''
      });
    }
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

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 lg:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            Báo cáo Quảng cáo (Ads)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý ngân sách và hiệu quả quảng cáo hằng ngày</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <span className="text-slate-300">/</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {['admin', 'marketing'].includes(profile?.role) && (
            <button onClick={openConfig} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2">
              <Target className="w-4 h-4" /> Cài KPI
            </button>
          )}
          {['admin', 'marketing'].includes(profile?.role) && (
            <button onClick={() => openEntry()} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-md flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nhập số liệu
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards (Giống hệt Excel) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Ngân sách */}
        <div className="col-span-2 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1">Ngân sách</p>
              <div className="text-2xl font-bold">{fmt(targets.budget)}đ</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between items-end">
              <div>
                <p className="text-slate-400 text-[10px] uppercase">Data KPI</p>
                <p className="text-lg font-bold text-blue-400">{fmt(targets.target_leads)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tiêu thụ */}
        <div className="col-span-2 md:col-span-2 lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Đã tiêu</p>
            <div className="text-2xl font-bold text-slate-800">{fmt(stats.totalSpent)}đ</div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-end">
            <div>
              <p className="text-slate-500 text-[10px] uppercase">Tiền còn</p>
              <p className={`text-sm font-bold ${stats.remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {fmt(stats.remaining)}đ
              </p>
            </div>
          </div>
        </div>

        {/* Lead thu về */}
        <div className="col-span-2 md:col-span-2 lg:col-span-1 bg-blue-50 rounded-2xl border border-blue-100 p-4 flex flex-col justify-center items-center text-center">
          <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider mb-1">Lead QT</p>
          <div className="text-3xl font-black text-blue-700">{fmt(stats.totalLeads)}</div>
        </div>

        {/* Giá 1 số */}
        <div className="col-span-2 md:col-span-2 lg:col-span-1 bg-slate-800 rounded-2xl border border-slate-700 p-4 flex flex-col justify-center items-center text-center text-white">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Giá 1 số</p>
          <div className="text-lg font-bold text-emerald-400">{fmt(stats.cpa)}đ</div>
        </div>

        {/* TB số */}
        <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-amber-50 rounded-2xl border border-amber-100 p-4 flex flex-col justify-center items-center text-center">
          <p className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-1">TB số/ngày</p>
          <div className="text-2xl font-black text-amber-600">{stats.avgLeads}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-slate-700 font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" /> Biểu đồ Chi phí & Số đơn PAGE
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => (val/1000000) + 'M'} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={(val, name) => [fmt(val), name]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Chi phí (VNĐ)" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
              <Line yAxisId="right" type="monotone" dataKey="Số SĐT (Leads)" stroke="#f59e0b" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-800 text-white flex justify-between items-center">
          <h3 className="font-bold">Chi tiết theo ngày</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-amber-400 text-slate-800 uppercase text-xs font-bold">
              <tr>
                <th className="px-4 py-3">Date (Day)</th>
                <th className="px-4 py-3">Spend (Amount)</th>
                <th className="px-4 py-3">Ghi chú (Impressions)</th>
                <th className="px-4 py-3 text-center">DATA (Số đơn PAGE)</th>
                <th className="px-4 py-3 text-right">Chi phí/số (CPA)</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-slate-500">Chưa có dữ liệu</td></tr>
              ) : (
                performanceData.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{item.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{fmt(item.amount_spent)} đ</td>
                    <td className="px-4 py-3 text-slate-500">{item.impressions || '-'}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-600">{fmt(item.leads)}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      {item.leads > 0 ? fmt(Math.round(item.amount_spent / item.leads)) : 0} đ
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEntry(item)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteEntry(item.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Cài đặt KPI Tháng {month}/{year}</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfigSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngân sách (VNĐ)</label>
                <input required type="number" value={configForm.budget} onChange={e => setConfigForm({...configForm, budget: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data KPI (Số Leads mục tiêu)</label>
                <input required type="number" value={configForm.target_leads} onChange={e => setConfigForm({...configForm, target_leads: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium">Hủy</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center gap-2">
                  {saving ? 'Đang lưu...' : <><Save className="w-4 h-4" /> Lưu KPI</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEntryModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">{entryForm.id ? 'Sửa số liệu' : 'Nhập số liệu mới'}</h3>
              <button onClick={() => setShowEntryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEntrySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày (Date)</label>
                <input required type="date" value={entryForm.date} onChange={e => setEntryForm({...entryForm, date: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Đã tiêu (Spend VNĐ)</label>
                <input required type="number" value={entryForm.amount_spent} onChange={e => setEntryForm({...entryForm, amount_spent: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số đơn PAGE (DATA Leads)</label>
                <input required type="number" value={entryForm.leads} onChange={e => setEntryForm({...entryForm, leads: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú (Impressions / V.v.)</label>
                <input type="text" value={entryForm.impressions} onChange={e => setEntryForm({...entryForm, impressions: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" placeholder="VD: 54,000 lượt hiển thị" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEntryModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium">Hủy</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center gap-2">
                  {saving ? 'Đang lưu...' : <><Save className="w-4 h-4" /> Lưu số liệu</>}
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
