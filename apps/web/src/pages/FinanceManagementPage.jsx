import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import FinanceRevenueSummary from '@/components/FinanceRevenueSummary.jsx';
import FinanceAdsSummary from '@/components/FinanceAdsSummary.jsx';
import FinanceHospitalFeeSummary from '@/components/FinanceHospitalFeeSummary.jsx';
import { Banknote, Wallet, Users, TrendingUp, Calendar as CalendarIcon, Filter, Search, X } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

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
  const [createForm, setCreateForm] = useState({
    surgery_date: new Date().toISOString().split('T')[0],
    customer_name: '', phone: '', service: '',
    service_group: 'Hàm mặt', customer_source: 'Ads', customer_type: 'Mới',
    revenue: '', upsale_revenue: '', sale_id: '', telesale_id: '', notes: ''
  });
  
  // Charts Data
  const [sourceData, setSourceData] = useState([]);
  const [serviceGroupData, setServiceGroupData] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({ 
    totalRev: 0, totalUpsale: 0, totalCustomers: 0, adsCustomers: 0, adsRevenue: 0, adsSpent: 0,
    hospitalFee: 0, hospitalFeeCash: 0, hospitalFeeTransfer: 0, hospitalFeeCount: 0,
    totalCocRev: 0, totalCocCustomers: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    let query = supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name)')
      .eq('status', 'phau_thuat')
      .gte('surgery_date', startDate)
      .lte('surgery_date', endDate);

    // Phân quyền hiển thị
    if (profile?.role === 'telesale') {
      query = query.eq('telesale_id', profile.id);
    } else if (profile?.role === 'sale_offline') {
      query = query.eq('sale_id', profile.id);
    }

    const { data, error } = await query.order('surgery_date', { ascending: false });

    // Fetch staff for dropdown
    const { data: staffData } = await supabase.from('profiles').select('id, full_name, role');
    if (staffData) setStaffList(staffData);

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      const records = data || [];
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

      // Fetch Coc Data
      let cocQuery = supabase
        .from('customer_appointments')
        .select('deposit_amount')
        .eq('status', 'coc')
        .gte('deposit_date', startDate)
        .lte('deposit_date', endDate);
      
      if (profile?.role === 'telesale') cocQuery = cocQuery.eq('telesale_id', profile.id);
      else if (profile?.role === 'sale_offline') cocQuery = cocQuery.eq('sale_id', profile.id);

      const { data: cocData } = await cocQuery;
      let tCocRev = 0;
      let cocCustomers = 0;
      if (cocData) {
        cocCustomers = cocData.length;
        cocData.forEach(c => { tCocRev += Number(c.deposit_amount || 0); });
      }

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
        totalCocCustomers: cocCustomers
      });

      setSourceData(Object.keys(srcMap).map(name => ({ name, value: srcMap[name] })));
      setServiceGroupData(Object.keys(svcMap).map(name => ({ name, value: svcMap[name] })));
    }
    setLoading(false);
  }, [month, year, profile?.id, profile?.role]);

  useEffect(() => {
    if (activeTab === 'revenue' && profile) loadData();
  }, [loadData, activeTab, profile]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.phone || !createForm.customer_name) {
      toast.error('Vui lòng nhập Tên và SĐT khách hàng'); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('customer_appointments').insert({
        customer_name: createForm.customer_name,
        phone: createForm.phone,
        appointment_date: createForm.surgery_date,
        surgery_date: createForm.surgery_date,
        service: createForm.service,
        service_group: createForm.service_group,
        customer_source: createForm.customer_source,
        customer_type: createForm.customer_type,
        revenue: createForm.revenue || 0,
        upsale_revenue: createForm.upsale_revenue || 0,
        sale_id: createForm.sale_id || null,
        telesale_id: createForm.telesale_id || null,
        notes: createForm.notes,
        status: 'phau_thuat',
        created_by: profile.id
      });
      if (error) throw error;
      toast.success('Đã thêm doanh thu thành công!');
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

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
          {canViewAds && (
            <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === 'expenses' ? 'bg-white text-rose-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              <Wallet className="w-4 h-4 inline-block mr-2" /> Tài chính
            </button>
          )}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 md:p-5 rounded-2xl border border-emerald-100">
              <div className="text-emerald-600 text-xs md:text-sm font-bold flex items-center gap-2"><Banknote className="w-4 h-4" /> TỔNG DOANH THU</div>
              <div className="text-lg md:text-2xl font-black text-emerald-800 mt-2 truncate" title={fmt(stats.totalRev)}>{fmt(stats.totalRev)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 md:p-5 rounded-2xl border border-purple-100">
              <div className="text-purple-600 text-xs md:text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> DOANH THU UPSALE</div>
              <div className="text-lg md:text-2xl font-black text-purple-800 mt-2 truncate" title={fmt(stats.totalUpsale)}>{fmt(stats.totalUpsale)}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 md:p-5 rounded-2xl border border-blue-100">
              <div className="text-blue-600 text-xs md:text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4" /> TỔNG SỐ KHÁCH</div>
              <div className="text-lg md:text-2xl font-black text-blue-800 mt-2 truncate">{stats.totalCustomers} <span className="text-xs md:text-sm font-medium text-blue-600">Khách</span></div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 md:p-5 rounded-2xl border border-amber-100">
              <div className="text-amber-600 text-xs md:text-sm font-bold flex items-center gap-2"><Filter className="w-4 h-4" /> KHÁCH TỪ ADS</div>
              <div className="text-lg md:text-2xl font-black text-amber-800 mt-2 truncate">{stats.adsCustomers} <span className="text-xs md:text-sm font-medium text-amber-600">Khách</span></div>
            </div>
          </div>

          

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
               {(profile?.role === 'admin' || profile?.role === 'marketing') && (
                 <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl text-sm shadow hover:bg-emerald-700 transition-colors">
                   + Nhập doanh thu trực tiếp
                 </button>
               )}
             </div>
             {loading ? (
                <div className="p-10 text-center text-slate-400">Đang tải...</div>
             ) : revenueData.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Không có giao dịch nào trong tháng này.</div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50">
                  {revenueData.map(r => (
                    <div key={r.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-slate-800">{r.customer_name}</h4>
                          <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                             <CalendarIcon className="w-3.5 h-3.5" /> {new Date(r.surgery_date).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                        <div className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                          {r.service_group || 'Chưa rõ'}
                        </div>
                      </div>
                      
                      <div className="text-sm font-medium text-slate-700 mb-4 pb-4 border-b border-dashed border-slate-200">
                        Dịch vụ: <span className="text-slate-900">{r.service || 'N/A'}</span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Nguồn khách:</span>
                          <span className="font-semibold text-amber-600">{r.customer_source || 'Khác'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Tệp khách:</span>
                          <span className="font-semibold text-blue-600">{r.customer_type || 'Mới'}</span>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 font-medium">Doanh thu tổng:</span>
                          <span className="font-bold text-emerald-600 text-base">{fmt(r.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 font-medium">Upsale:</span>
                          <span className="font-bold text-purple-600 text-base">{fmt(r.upsale_revenue || 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        </div>
      )}

      {activeTab === 'expenses' && canViewAds && (
        <div className="space-y-6">
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

      {/* Direct Revenue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-start pt-10 pb-10 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xl">Nhập doanh thu trực tiếp</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày <span className="text-red-500">*</span></label>
                  <input required type="date" value={createForm.surgery_date} onChange={e => setCreateForm({...createForm, surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên khách hàng <span className="text-red-500">*</span></label>
                  <input required value={createForm.customer_name} onChange={e => setCreateForm({...createForm, customer_name: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" placeholder="Nhập tên..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                  <input required value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" placeholder="Nhập SĐT..." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ sử dụng <span className="text-red-500">*</span></label>
                  <input required value={createForm.service} onChange={e => setCreateForm({...createForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" placeholder="Ví dụ: Nâng mũi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm dịch vụ <span className="text-red-500">*</span></label>
                  <select value={createForm.service_group} onChange={e => setCreateForm({...createForm, service_group: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none bg-white">
                    <option value="Hàm mặt">Hàm mặt</option>
                    <option value="Body">Body</option>
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nguồn khách <span className="text-red-500">*</span></label>
                  <select value={createForm.customer_source} onChange={e => setCreateForm({...createForm, customer_source: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none bg-white">
                    <option value="Ads">Ads</option>
                    <option value="CTV">CTV</option>
                    <option value="Người quen">Người quen</option>
                    <option value="CSKH">CSKH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tệp khách <span className="text-red-500">*</span></label>
                  <select value={createForm.customer_type} onChange={e => setCreateForm({...createForm, customer_type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none bg-white">
                    <option value="Mới">Khách Mới</option>
                    <option value="Cũ">Khách Cũ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Doanh thu tổng (VNĐ) <span className="text-red-500">*</span></label>
                  <input required type="number" value={createForm.revenue} onChange={e => setCreateForm({...createForm, revenue: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-emerald-700 font-bold" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Doanh thu Upsale (VNĐ)</label>
                  <input type="number" value={createForm.upsale_revenue} onChange={e => setCreateForm({...createForm, upsale_revenue: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-purple-700 font-bold" placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale Offline phụ trách</label>
                  <select value={createForm.sale_id} onChange={e => setCreateForm({...createForm, sale_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none bg-white">
                    <option value="">-- Không có --</option>
                    {staffList.filter(s => s.role === 'sale_offline' || s.role === 'admin').map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telesale phụ trách</label>
                  <select value={createForm.telesale_id} onChange={e => setCreateForm({...createForm, telesale_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none bg-white">
                    <option value="">-- Không có --</option>
                    {staffList.filter(s => s.role === 'telesale' || s.role === 'admin').map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú thêm</label>
                <textarea rows={3} value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none resize-none" placeholder="Nhập ghi chú..."></textarea>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors">
                  {saving ? 'Đang lưu...' : 'Nhập Doanh Thu'}
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
