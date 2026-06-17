import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Banknote, Wallet, Users, TrendingUp, Calendar as CalendarIcon, Filter, Search } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

const FinanceManagementPage = () => {
  const [activeTab, setActiveTab] = useState('revenue');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [revenueData, setRevenueData] = useState([]);
  
  // Charts Data
  const [sourceData, setSourceData] = useState([]);
  const [serviceGroupData, setServiceGroupData] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({ totalRev: 0, totalUpsale: 0, totalCustomers: 0, adsCustomers: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name)')
      .eq('status', 'phau_thuat')
      .gte('surgery_date', startDate)
      .lte('surgery_date', endDate)
      .order('surgery_date', { ascending: false });

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      const records = data || [];
      setRevenueData(records);

      let tRev = 0, tUp = 0, adsC = 0;
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
      });

      setStats({
        totalRev: tRev,
        totalUpsale: tUp,
        totalCustomers: records.length,
        adsCustomers: adsC
      });

      setSourceData(Object.keys(srcMap).map(name => ({ name, value: srcMap[name] })));
      setServiceGroupData(Object.keys(svcMap).map(name => ({ name, value: svcMap[name] })));
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    if (activeTab === 'revenue') loadData();
  }, [loadData, activeTab]);

  const fmt = (val) => new Intl.NumberFormat('vi-VN').format(val) + 'đ';

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Doanh thu / Tài chính</h2>
          <p className="text-slate-500 text-sm mt-1">Báo cáo dòng tiền, nguồn khách và biểu đồ lợi nhuận</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('revenue')} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === 'revenue' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
            <Banknote className="w-4 h-4 inline-block mr-2" /> Doanh Thu
          </button>
          <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === 'expenses' ? 'bg-white text-rose-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
            <Wallet className="w-4 h-4 inline-block mr-2" /> Chi Phí & Tạm Ứng
          </button>
        </div>
      </div>

      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-slate-400" />
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="font-semibold text-slate-700 bg-slate-50 border-none rounded-lg p-2 outline-none">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Tháng {m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="font-semibold text-slate-700 bg-slate-50 border-none rounded-lg p-2 outline-none">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>Năm {y}</option>)}
              </select>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-100">
              <div className="text-emerald-600 text-sm font-bold flex items-center gap-2"><Banknote className="w-4 h-4" /> TỔNG DOANH THU</div>
              <div className="text-2xl font-black text-emerald-800 mt-2">{fmt(stats.totalRev)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-5 rounded-2xl border border-purple-100">
              <div className="text-purple-600 text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> DOANH THU UPSALE</div>
              <div className="text-2xl font-black text-purple-800 mt-2">{fmt(stats.totalUpsale)}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-2xl border border-blue-100">
              <div className="text-blue-600 text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4" /> TỔNG SỐ KHÁCH</div>
              <div className="text-2xl font-black text-blue-800 mt-2">{stats.totalCustomers} <span className="text-sm font-medium text-blue-600">Khách</span></div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-2xl border border-amber-100">
              <div className="text-amber-600 text-sm font-bold flex items-center gap-2"><Filter className="w-4 h-4" /> KHÁCH TỪ ADS</div>
              <div className="text-2xl font-black text-amber-800 mt-2">{stats.adsCustomers} <span className="text-sm font-medium text-amber-600">Khách</span></div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-500" /> Tỷ trọng Nguồn Khách (VND)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {sourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value) => fmt(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><BarChart className="w-5 h-5 text-teal-500" /> Doanh thu theo Nhóm dịch vụ</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceGroupData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => (val/1000000) + 'M'} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(value) => fmt(value)} cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
               <h3 className="font-bold text-slate-800">Danh sách Giao dịch Doanh Thu</h3>
               <button className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl text-sm shadow hover:bg-emerald-700 transition-colors">
                 + Nhập doanh thu trực tiếp
               </button>
             </div>
             {loading ? (
                <div className="p-10 text-center text-slate-400">Đang tải...</div>
             ) : revenueData.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Không có giao dịch nào trong tháng này.</div>
             ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-medium">Khách hàng / SĐT</th>
                      <th className="px-6 py-3 font-medium">Dịch vụ</th>
                      <th className="px-6 py-3 font-medium">Phân loại</th>
                      <th className="px-6 py-3 font-medium text-right">Doanh thu</th>
                      <th className="px-6 py-3 font-medium text-right">Upsale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {revenueData.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{r.customer_name}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{r.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700">{r.service || 'N/A'}</div>
                          <div className="text-xs text-slate-400 mt-1">Lên mổ: {new Date(r.surgery_date).toLocaleDateString('vi-VN')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{r.service_group || 'Chưa rõ'}</span>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">{r.customer_source || 'Khác'}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{r.customer_type || 'Mới'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{fmt(r.revenue || 0)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-purple-600">{fmt(r.upsale_revenue || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             )}
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center">
           <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <h3 className="text-lg font-bold text-slate-700">Module Tài chính & Tạm ứng</h3>
           <p className="text-slate-500 mt-2">Tính năng ghi nhận dòng tiền chi phí và tạm ứng của nhân viên đang được tích hợp.</p>
        </div>
      )}
    </div>
  );
};

export default FinanceManagementPage;
