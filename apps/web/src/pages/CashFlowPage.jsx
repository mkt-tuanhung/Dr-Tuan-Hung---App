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
  Plus, RefreshCw, Calendar, Filter, CheckCircle, XCircle, X, Trash2, Pencil, 
  ArrowDownLeft, ArrowUpRight, Coins, LineChart as LineChartIcon, Banknote, Users, PackageOpen, TrendingUp, Activity, Wallet, Shield
} from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

export default function CashFlowPage() {
  const { profile } = useAuth();
  // Xét CẢ vai chính lẫn vai phụ (kiêm nhiệm) — khớp RLS bảng cash_flows
  const myRoles = [profile?.role, profile?.role_2].filter(Boolean);
  const canWrite = myRoles.some(r => ['admin', 'accountant'].includes(r));
  const canEdit = myRoles.includes('admin'); // CHỈ admin được SỬA giao dịch đã ghi
  const canRead = myRoles.some(r => ['admin', 'accountant', 'shareholder'].includes(r));

  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer', 'cash', 'stats'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [dashboardStats, setDashboardStats] = useState({
    revenue: 0, hospitalFee: 0, payroll: 0, advance: 0, material: 0
  });
  // Quỹ rủi ro trích trong tháng (trích − rút) — vốn lưu động tự trừ khoản này
  const [riskNet, setRiskNet] = useState(0);

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editId, setEditId] = useState(null); // id giao dịch đang SỬA (null = tạo mới)
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: vnToday(),
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
    const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(new Date(filterYear, filterMonth, 0).getDate()).padStart(2, '0')}`;

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
      const [payrollRes, appRes, expRes, partnerRes, riskRes] = await Promise.all([
        supabase.from('payroll').select('net_salary').eq('month', filterMonth).eq('year', filterYear),
        supabase.from('customer_appointments').select('revenue, upsale_revenue, hospital_fee, surgery_date, hospital_fee_date')
          .or(`surgery_date.gte.${startDate},hospital_fee_date.gte.${startDate}`),
        supabase.from('expenses').select('amount, category, is_advance')
          .eq('status', 'paid')
          .gte('date', startDate).lte('date', endDate),
        supabase.from('partner_surgeries').select('partner_fee, surgery_date')
          .eq('partner_paid', true)
          .gte('surgery_date', startDate).lte('surgery_date', endDate),
        supabase.from('risk_fund').select('amount, kind, date')
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
      // Thu nhập thêm từ mổ đối tác → cộng vào doanh thu
      partnerRes.data?.forEach(d => rev += Number(d.partner_fee || 0));

      expRes.data?.forEach(d => {
        if (d.is_advance) adv += Number(d.amount || 0);
        if (d.category === 'Vat_tu') mat += Number(d.amount || 0);
      });

      setDashboardStats({ revenue: rev, hospitalFee: fee, payroll: pr, advance: adv, material: mat });
      setRiskNet((riskRes.data || []).reduce((s, r) => s + (r.kind === 'withdraw' ? -1 : 1) * Number(r.amount || 0), 0));
    } catch (e) {
      console.error('Lỗi lấy dữ liệu tổng quan:', e);
    }

    setLoading(false);
  }, [filterMonth, filterYear, canRead]);

  useEffect(() => {
    if (profile) loadData();
  }, [loadData, profile]);
  useRealtimeReload('cash_flows,customer_appointments,expenses,payroll,risk_fund', loadData);

  if (!canRead) {
    return <div className="e-card e-empty text-[14px] text-slate-500">Bạn không có quyền truy cập trang này.</div>;
  }

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';

  const formatCurrencyInput = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers ? new Intl.NumberFormat('vi-VN').format(numbers) : '';
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) return toast.error('Vui lòng nhập số tiền');
    if (editId && !canEdit) return toast.error('Chỉ admin được sửa giao dịch đã ghi');
    setSaving(true);
    
    const numericAmount = parseInt(form.amount.replace(/\./g, ''), 10);

    const payload = {
      date: form.date,
      flow_type: form.flow_type,
      amount: numericAmount,
      method: form.method,
      handover_person: form.handover_person,
      notes: form.notes,
    };
    const { data, error } = editId
      ? await supabase.from('cash_flows').update(payload).eq('id', editId).select('id')
      : await supabase.from('cash_flows').insert({ ...payload, created_by: profile.id }).select('id');

    if (error) { console.error('cash_flows insert error', error); toast.error(`LỖI [${error.code || '?'}]: ${error.message}${error.hint ? ' | ' + error.hint : ''}`, { duration: 20000 }); }
    else if (!data || data.length === 0) toast.error(editId ? 'Không có quyền sửa giao dịch này (RLS).' : 'Insert OK nhưng RLS SELECT chặn đọc lại — chạy SQL phân quyền.', { duration: 20000 });
    else {
      toast.success(editId ? 'Đã cập nhật giao dịch!' : 'Đã lưu giao dịch!');
      setShowCreateModal(false);
      setEditId(null);
      setForm({ ...form, amount: '', handover_person: '', notes: '' });
      // Nhảy bộ lọc về đúng tháng của giao dịch vừa nhập để chắc chắn hiển thị
      const d = new Date(form.date);
      setFilterMonth(d.getMonth() + 1);
      setFilterYear(d.getFullYear());
      loadData();
    }
    setSaving(false);
  };

  const openEdit = (d) => {
    setEditId(d.id);
    setForm({
      date: d.date,
      flow_type: d.flow_type,
      amount: Number(d.amount || 0).toLocaleString('vi-VN'),
      method: d.method,
      handover_person: d.handover_person || '',
      notes: d.notes || '',
    });
    setShowCreateModal(true);
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
  // Vốn lưu động = thu − chi − trích quỹ rủi ro (nhập vào quỹ là dòng tiền tự trừ)
  const workingCapital = totalIn - totalOut - riskNet;

  // Render Table
  const renderTable = (list) => (
    <div className="e-table-wrap">
      <table className="e-table">
        <thead>
          <tr>
            <th className="w-16">STT</th>
            <th>Ngày</th>
            <th>Thu / Chi</th>
            <th className="num">Số tiền</th>
            <th>Hình thức</th>
            <th>Người bàn giao</th>
            <th>Ghi chú</th>
            {canWrite && <th className="!text-center">Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="8"><div className="e-empty py-8"><div className="w-7 h-7 mb-3 border-[3px] border-teal-100 border-t-teal-600 rounded-full animate-spin" /><div className="e-empty-desc mt-0">Đang tải...</div></div></td></tr>
          ) : list.length === 0 ? (
            <tr><td colSpan="8"><div className="e-empty"><div className="e-empty-icon"><Coins /></div><div className="e-empty-title">Không có dữ liệu</div></div></td></tr>
          ) : list.map((d, index) => (
            <tr key={d.id}>
              <td className="!text-slate-400 tabular-nums">{index + 1}</td>
              <td className="!text-slate-800 font-medium tabular-nums whitespace-nowrap">{new Date(d.date).toLocaleDateString('vi-VN')}</td>
              <td>
                {d.flow_type === 'in' 
                  ? <span className="e-badge e-badge-sm e-tone-success"><ArrowDownLeft className="!w-3 !h-3" /> Thu tiền</span>
                  : <span className="e-badge e-badge-sm e-tone-danger"><ArrowUpRight className="!w-3 !h-3" /> Chi tiền</span>}
              </td>
              <td className={`num whitespace-nowrap font-semibold ${d.flow_type === 'in' ? '!text-success-600' : '!text-danger-600'}`}>
                {d.flow_type === 'in' ? '+' : '-'}{fmt(d.amount)}
              </td>
              <td className="whitespace-nowrap">
                {d.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
              </td>
              <td className="!text-slate-800 font-medium">{d.handover_person || '-'}</td>
              <td className="!text-slate-500 max-w-[320px]">{d.notes}</td>
              {canWrite && (
                <td className="!text-center whitespace-nowrap">
                  {canEdit && (
                    <button onClick={() => openEdit(d)} title="Sửa giao dịch (chỉ admin)" className="inline-grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(d.id)} title="Xóa giao dịch" className="inline-grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition">
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
    <div className="space-y-4">
      {/* Thanh công cụ: mô tả + kỳ + hành động */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <p className="e-page-desc">Quản lý nhận/chi tiền mặt và chuyển khoản theo ngày</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white">
            <Calendar className="w-4 h-4 text-teal-600" />
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="bg-transparent text-[14px] font-semibold outline-none text-slate-800 cursor-pointer">
              {Array.from({length:12}, (_,i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="bg-transparent text-[14px] font-semibold outline-none text-slate-800 cursor-pointer">
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <button onClick={loadData} className="e-btn e-btn-secondary">
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
          {canWrite && (
            <button onClick={() => { setEditId(null); setForm({ date: vnToday(), flow_type: 'in', amount: '', method: 'transfer', handover_person: '', notes: '' }); setShowCreateModal(true); }} className="e-btn e-btn-primary">
              <Plus className="w-4 h-4" /> Tạo giao dịch
            </button>
          )}
        </div>
      </div>

      {/* Chỉ số chính (MetricCard Ethics) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="e-metric">
          <span className="e-metric-icon e-tone-success"><ArrowDownLeft /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Tổng Nhận (Thu)</div>
            <div className="e-metric-value">{fmt(totalIn)}</div>
          </div>
        </div>
        <div className="e-metric">
          <span className="e-metric-icon e-tone-danger"><ArrowUpRight /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Tổng Chi</div>
            <div className="e-metric-value">{fmt(totalOut)}</div>
          </div>
        </div>
        <div className="e-metric border-teal-300">
          <span className="e-metric-icon"><Coins /></span>
          <div className="min-w-0">
            <div className="e-metric-label">VỐN LƯU ĐỘNG</div>
            <div className="e-metric-value !text-teal-700">{fmt(workingCapital)}</div>
            {riskNet !== 0 && <div className="e-metric-hint">đã trừ trích quỹ rủi ro {fmt(riskNet)}</div>}
          </div>
        </div>
      </div>

      {/* Báo cáo tổng quan tháng — ô bấm để mở màn liên quan */}
      <div className="e-card e-card-pad">
        <div className="e-card-header">
          <h3 className="e-card-title">Báo cáo tổng quan Tháng {filterMonth}/{filterYear}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="e-subtle p-3.5 flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-teal-700 grid place-items-center shrink-0"><TrendingUp className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-500 truncate">Tổng Doanh thu</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums truncate">{fmt(dashboardStats.revenue)}</div>
            </div>
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'hospital_fee_inventory' }))} 
               className="e-subtle p-3.5 flex items-center gap-3 min-w-0 cursor-pointer transition hover:bg-white hover:border-teal-300 hover:shadow-soft group">
            <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-teal-700 grid place-items-center shrink-0"><Banknote className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-500 truncate">Tổng Viện phí</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums truncate">{fmt(dashboardStats.hospitalFee)}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-teal-600 transition" />
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'payroll' }))}
               className="e-subtle p-3.5 flex items-center gap-3 min-w-0 cursor-pointer transition hover:bg-white hover:border-teal-300 hover:shadow-soft group">
            <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-teal-700 grid place-items-center shrink-0"><Users className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-500 truncate">Chi lương T{filterMonth}</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums truncate">{fmt(dashboardStats.payroll)}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-teal-600 transition" />
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'advances' }))}
               className="e-subtle p-3.5 flex items-center gap-3 min-w-0 cursor-pointer transition hover:bg-white hover:border-teal-300 hover:shadow-soft group">
            <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-teal-700 grid place-items-center shrink-0"><Wallet className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-500 truncate">Tạm ứng chi</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums truncate">{fmt(dashboardStats.advance)}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-teal-600 transition" />
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'hospital_fee_inventory' }))}
               className="e-subtle p-3.5 flex items-center gap-3 min-w-0 cursor-pointer transition hover:bg-white hover:border-teal-300 hover:shadow-soft group">
            <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-teal-700 grid place-items-center shrink-0"><PackageOpen className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-500 truncate">Chi Vật tư</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums truncate">{fmt(dashboardStats.material)}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-teal-600 transition" />
          </div>

          <div onClick={() => window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: 'pl' }))}
               className="e-subtle p-3.5 flex items-center gap-3 min-w-0 cursor-pointer transition hover:bg-white hover:border-teal-300 hover:shadow-soft group">
            <span className="w-10 h-10 rounded-full bg-white border border-slate-200 text-teal-700 grid place-items-center shrink-0"><Shield className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-500 truncate">Trích quỹ rủi ro</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums truncate">{fmt(riskNet)}</div>
            </div>
            <ArrowUpRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-teal-600 transition" />
          </div>
        </div>
      </div>

      {/* Sổ & thống kê — tab gạch chân teal, bảng e-table */}
      <div className="e-card overflow-hidden flex flex-col">
        <div className="e-tabs px-2 lg:px-3">
          <button onClick={() => setActiveTab('transfer')} className={`e-tab ${activeTab === 'transfer' ? 'e-tab-active' : ''}`}>
            <Banknote /> Sổ Chuyển Khoản
          </button>
          <button onClick={() => setActiveTab('cash')} className={`e-tab ${activeTab === 'cash' ? 'e-tab-active' : ''}`}>
            <Coins /> Sổ Tiền Mặt
          </button>
          <button onClick={() => setActiveTab('stats')} className={`e-tab ${activeTab === 'stats' ? 'e-tab-active' : ''}`}>
            <LineChartIcon /> Thống kê dòng tiền
          </button>
        </div>

        {activeTab === 'transfer' && renderTable(transferData)}
        {activeTab === 'cash' && renderTable(cashData)}
        
        {activeTab === 'stats' && (
          <div className="p-4 lg:p-5">
            <div className="min-w-0">
              <h3 className="e-card-title mb-4">Biểu đồ Nhận / Chi theo ngày (Tháng {filterMonth})</h3>
              <div className="h-80 [&_.recharts-cartesian-grid_line]:[stroke-dasharray:0] [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!border-slate-200">
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A3ABAA' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => (val / 1000000) + 'M'} width={45} tick={{ fontSize: 12, fill: '#A3ABAA' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(val) => fmt(val)} cursor={{ fill: '#F3F9F9' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar name="Thu tiền (+)" dataKey="income" fill="#067B7F" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar name="Chi tiền (-)" dataKey="expense" fill="#F4B183" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateSubmit} className="e-modal max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">{editId ? 'Sửa giao dịch Dòng tiền' : 'Ghi nhận Dòng tiền'}</h3>
              <button type="button" onClick={() => { setShowCreateModal(false); setEditId(null); }} title="Đóng" className="e-icon-btn w-8 h-8 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="e-modal-body overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Ngày giao dịch *</label>
                  <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Phân loại *</label>
                  <select required value={form.flow_type} onChange={e => setForm({...form, flow_type: e.target.value})} className="e-input font-semibold cursor-pointer">
                    <option value="in">Thu / Nhận tiền (+)</option>
                    <option value="out">Chi / Trả tiền (-)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Hình thức *</label>
                  <select required value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="e-input cursor-pointer">
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label className="e-label">Số tiền (VNĐ) *</label>
                  <input required type="text" value={form.amount} onChange={e => setForm({...form, amount: formatCurrencyInput(e.target.value)})} className={`e-input font-bold text-[16px] tabular-nums ${form.flow_type === 'in' ? 'text-success-600' : 'text-danger-600'}`} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="e-label">Người bàn giao / Đối tượng</label>
                <input type="text" value={form.handover_person} onChange={e => setForm({...form, handover_person: e.target.value})} className="e-input" placeholder="Nguyễn Văn A..." />
              </div>

              <div>
                <label className="e-label">Ghi chú chi tiết</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="e-textarea h-20 resize-none" placeholder="Lý do thu chi..." />
              </div>
            </div>

            <div className="e-modal-footer shrink-0">
              <button type="button" onClick={() => { setShowCreateModal(false); setEditId(null); }} className="e-btn e-btn-secondary">Hủy</button>
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">{editId ? 'Lưu thay đổi' : 'Ghi nhận'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
