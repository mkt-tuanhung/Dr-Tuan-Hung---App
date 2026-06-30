import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, Legend
} from 'recharts';
import { 
  Plus, RefreshCw, Calendar, Filter, CheckCircle, XCircle, X, Trash2, 
  ArrowDownLeft, ArrowUpRight, Coins, LineChart as LineChartIcon, Banknote, Users, PackageOpen, TrendingUp, Activity, Wallet
} from 'lucide-react';

export default function CashFlowPage() {
  const { profile } = useAuth();
  const canWrite = ['admin', 'accountant'].includes(profile?.role);
  const canRead = ['admin', 'accountant', 'shareholder'].includes(profile?.role);

  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer', 'cash', 'stats'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [dashboardStats, setDashboardStats] = useState({
    revenue: 0, hospitalFee: 0, payroll: 0, advance: 0, material: 0
  });

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    flow_type: 'in', // 'in' or 'out'
    amount: '',
    method: 'transfer', // 'cash' or 'transfer'
    handover_person: '',
    notes: ''
  });

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    const startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`;
    const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0];

    const { data: flowsData, error } = await supabase
      .from('cash_flows')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) toast.error('Lỗi tải dữ liệu: ' + error.message);
    else setData(flowsData || []);

    try {
      const [payrollRes, appRes, expRes] = await Promise.all([
        supabase.from('payroll').select('net_salary').eq('month', filterMonth).eq('year', filterYear),
        supabase.from('customer_appointments').select('revenue, upsale_revenue, hospital_fee, surgery_date, hospital_fee_date')
          .or(`surgery_date.gte.${startDate},hospital_fee_date.gte.${startDate}`),
        supabase.from('expenses').select('amount, category, is_advance')
          .eq('status', 'paid')
          .gte('date', startDate).lte('date', endDate)
      ]);

      let rev = 0, fee = 0, pr = 0, adv = 0, mat = 0;
      payrollRes.data?.forEach(d => pr += Number(d.net_salary || 0));
      
      appRes.data?.forEach(d => {
        if (d.surgery_date && d.surgery_date >= startDate && d.surgery_date <= endDate) {
          rev += Number(d.revenue || 0); // revenue đã bao gồm upsale → không cộng thêm
        }
        if (d.hospital_fee_date && d.hospital_fee_date >= startDate && d.hospital_fee_date <= endDate) {
          fee += Number(d.hospital_fee || 0);
        }
      });

      expRes.data?.forEach(d => {
        if (d.is_advance) adv += Number(d.amount || 0);
        if (d.category === 'Vat_tu') mat += Number(d.amount || 0);
      });

      setDashboardStats({ revenue: rev, hospitalFee: fee, payroll: pr, advance: adv, material: mat });
    } catch (e) {
      console.error('Lỗi lấy dữ liệu tổng quan:', e);
    }

    setLoading(false);
  }, [filterMonth, filterYear, canRead]);

  useEffect(() => {
    if (profile) loadData();
  }, [loadData, profile]);
  useRealtimeReload('cash_flows,customer_appointments,expenses,payroll', loadData);

  if (!canRead) {
    return <div className="p-8 text-center text-slate-500">Bạn không có quyền truy cập trang này.</div>;
  }

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';

  const formatCurrencyInput = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers ? new Intl.NumberFormat('vi-VN').format(numbers) : '';
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) return toast.error('Vui lòng nhập số tiền');
    setSaving(true);
    
    const numericAmount = parseInt(form.amount.replace(/\./g, ''), 10);

    const { data, error } = await supabase.from('cash_flows').insert({
      date: form.date,
      flow_type: form.flow_type,
      amount: numericAmount,
      method: form.method,
      handover_person: form.handover_person,
      notes: form.notes,
      created_by: profile.id
    }).select('id');

    if (error) toast.error('Lỗi: ' + error.message);
    else if (!data || data.length === 0) toast.error('Không ghi nhận được — quyền RLS chặn. Cần chạy SQL phân quyền cho kế toán (role_2).');
    else {
      toast.success('Đã lưu giao dịch!');
      setShowCreateModal(false);
      setForm({ ...form, amount: '', handover_person: '', notes: '' });
      // Nhảy bộ lọc về đúng tháng của giao dịch vừa nhập để chắc chắn hiển thị
      const d = new Date(form.date);
      setFilterMonth(d.getMonth() + 1);
      setFilterYear(d.getFullYear());
      loadData();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn chắc chắn muốn xóa giao dịch này?')) return;
    const { error } = await supabase.from('cash_flows').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Đã xóa'); loadData(); }
  };

  // Calculations
  const transferData = data.filter(d => d.method === 'transfer');
  const cashData = data.filter(d => d.method === 'cash');

  let totalIn = 0, totalOut = 0;
  data.forEach(d => {
    if (d.flow_type === 'in') totalIn += Number(d.amount);
    if (d.flow_type === 'out') totalOut += Number(d.amount);
  });
  const workingCapital = totalIn - totalOut;

  // Render Table
  const renderTable = (list) => (
    <div className="overflow-x-auto bg-white rounded-b-2xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b">
            <th className="px-6 py-4 font-semibold w-16">STT</th>
            <th className="px-6 py-4 font-semibold">Ngày</th>
            <th className="px-6 py-4 font-semibold">Thu / Chi</th>
            <th className="px-6 py-4 font-semibold">Số tiền</th>
            <th className="px-6 py-4 font-semibold">Hình thức</th>
            <th className="px-6 py-4 font-semibold">Người bàn giao</th>
            <th className="px-6 py-4 font-semibold">Ghi chú</th>
            {canWrite && <th className="px-6 py-4 font-semibold text-center">Thao tác</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {loading ? (
            <tr><td colSpan="8" className="text-center py-10 text-slate-400">Đang tải...</td></tr>
          ) : list.length === 0 ? (
            <tr><td colSpan="8" className="text-center py-10 text-slate-400">Không có dữ liệu</td></tr>
          ) : list.map((d, index) => (
            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-400">{index + 1}</td>
              <td className="px-6 py-4 font-semibold text-slate-700">{new Date(d.date).toLocaleDateString('vi-VN')}</td>
              <td className="px-6 py-4">
                {d.flow_type === 'in' 
                  ? <span className="inline-flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-1 rounded-lg text-xs font-bold"><ArrowDownLeft className="w-3 h-3" /> Thu tiền</span>
                  : <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg text-xs font-bold"><ArrowUpRight className="w-3 h-3" /> Chi tiền</span>}
              </td>
              <td className={`px-6 py-4 font-bold text-base ${d.flow_type === 'in' ? 'text-teal-600' : 'text-red-600'}`}>
                {d.flow_type === 'in' ? '+' : '-'}{fmt(d.amount)}
              </td>
              <td className="px-6 py-4 font-medium text-slate-600">
                {d.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
              </td>
              <td className="px-6 py-4 font-medium text-slate-800">{d.handover_person || '-'}</td>
              <td className="px-6 py-4 text-slate-600">{d.notes}</td>
              {canWrite && (
                <td className="px-6 py-4 text-center">
                  <button onClick={() => handleDelete(d.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Kế toán dòng tiền (Vốn lưu động)</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý nhận/chi tiền mặt và chuyển khoản theo ngày</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
              {Array.from({length:12}, (_,i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <button onClick={loadData} className="px-4 py-2 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition-colors">
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
          {canWrite && (
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl text-sm shadow-md flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> Tạo giao dịch
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Overview */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-indigo-500" /> Báo cáo tổng quan Tháng {filterMonth}/{filterYear}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-2"><TrendingUp className="w-4 h-4"/> Tổng Doanh thu</div>
            <div className="text-xl font-black text-slate-800">{fmt(dashboardStats.revenue)}</div>
          </div>
          
          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'hospital_fee_inventory' }))} 
               className="bg-white rounded-2xl p-4 border border-teal-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between text-teal-600 font-semibold text-sm mb-2">
              <span className="flex items-center gap-2"><Banknote className="w-4 h-4"/> Tổng Viện phí</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xl font-black text-slate-800">{fmt(dashboardStats.hospitalFee)}</div>
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'payroll' }))}
               className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between text-rose-600 font-semibold text-sm mb-2">
              <span className="flex items-center gap-2"><Users className="w-4 h-4"/> Chi lương T{filterMonth}</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xl font-black text-slate-800">{fmt(dashboardStats.payroll)}</div>
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'advances' }))}
               className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between text-orange-600 font-semibold text-sm mb-2">
              <span className="flex items-center gap-2"><Wallet className="w-4 h-4"/> Tạm ứng chi</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xl font-black text-slate-800">{fmt(dashboardStats.advance)}</div>
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'hospital_fee_inventory' }))}
               className="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between text-purple-600 font-semibold text-sm mb-2">
              <span className="flex items-center gap-2"><PackageOpen className="w-4 h-4"/> Chi Vật tư</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xl font-black text-slate-800">{fmt(dashboardStats.material)}</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-teal-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowDownLeft className="w-16 h-16 text-teal-600" /></div>
          <div className="text-teal-600 text-sm font-bold flex items-center gap-2 mb-2">Tổng Nhận (Thu)</div>
          <div className="text-3xl font-black text-teal-700">{fmt(totalIn)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowUpRight className="w-16 h-16 text-red-600" /></div>
          <div className="text-red-600 text-sm font-bold flex items-center gap-2 mb-2">Tổng Chi</div>
          <div className="text-3xl font-black text-red-700">{fmt(totalOut)}</div>
        </div>
        <div className="bg-indigo-600 p-6 rounded-2xl shadow-md relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Coins className="w-16 h-16 text-white" /></div>
          <div className="text-indigo-100 text-sm font-bold flex items-center gap-2 mb-2">VỐN LƯU ĐỘNG</div>
          <div className="text-3xl font-black">{fmt(workingCapital)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex bg-slate-50 border-b overflow-x-auto">
          <button onClick={() => setActiveTab('transfer')} className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${activeTab === 'transfer' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Banknote className="w-4 h-4" /> Sổ Chuyển Khoản
          </button>
          <button onClick={() => setActiveTab('cash')} className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${activeTab === 'cash' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Coins className="w-4 h-4" /> Sổ Tiền Mặt
          </button>
          <button onClick={() => setActiveTab('stats')} className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${activeTab === 'stats' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            <LineChartIcon className="w-4 h-4" /> Thống kê dòng tiền
          </button>
        </div>

        {activeTab === 'transfer' && renderTable(transferData)}
        {activeTab === 'cash' && renderTable(cashData)}
        
        {activeTab === 'stats' && (
          <div className="p-6 bg-slate-50/50">
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 text-center text-lg">Biểu đồ Nhận / Chi theo ngày (Tháng {filterMonth})</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    const days = new Date(filterYear, filterMonth, 0).getDate();
                    const chartData = Array.from({length: days}, (_, i) => ({
                      name: `${i + 1}/${filterMonth}`,
                      dateStr: `${filterYear}-${String(filterMonth).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,
                      income: 0,
                      expense: 0
                    }));

                    data.forEach(d => {
                      const dayObj = chartData.find(c => c.dateStr === d.date);
                      if (dayObj) {
                        if (d.flow_type === 'in') dayObj.income += Number(d.amount);
                        if (d.flow_type === 'out') dayObj.expense += Number(d.amount);
                      }
                    });
                    return chartData;
                  })()} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => (val / 1000000) + 'M'} width={45} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(val) => fmt(val)} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar name="Thu tiền (+)" dataKey="income" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar name="Chi tiền (-)" dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateSubmit} className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 shrink-0">
              <h3 className="font-bold text-indigo-800 text-lg">Ghi nhận Dòng tiền</h3>
              <button type="button" onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-indigo-400 hover:text-indigo-600" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Ngày giao dịch *</label>
                  <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Phân loại *</label>
                  <select required value={form.flow_type} onChange={e => setForm({...form, flow_type: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold">
                    <option value="in">Thu / Nhận tiền (+)</option>
                    <option value="out">Chi / Trả tiền (-)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Hình thức *</label>
                  <select required value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500">
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Số tiền (VNĐ) *</label>
                  <input required type="text" value={form.amount} onChange={e => setForm({...form, amount: formatCurrencyInput(e.target.value)})} className={`w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500 font-bold text-lg ${form.flow_type === 'in' ? 'text-teal-600' : 'text-red-600'}`} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Người bàn giao / Đối tượng</label>
                <input type="text" value={form.handover_person} onChange={e => setForm({...form, handover_person: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" placeholder="Nguyễn Văn A..." />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Ghi chú chi tiết</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:border-indigo-500 h-20 resize-none" placeholder="Lý do thu chi..." />
              </div>
            </div>

            <div className="p-4 bg-slate-50 shrink-0 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">Ghi nhận</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
