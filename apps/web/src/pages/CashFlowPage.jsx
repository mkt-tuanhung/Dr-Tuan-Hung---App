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
  ArrowDownLeft, ArrowUpRight, Coins, LineChart as LineChartIcon, Banknote, Users, PackageOpen, TrendingUp, Activity, Wallet, Shield,
  Search, ChevronRight, User
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
  // Điện thoại: lọc nhanh Thu/Chi + tìm + bảng chi tiết 1 giao dịch (chỉ hiển thị)
  const [mFlow, setMFlow] = useState('all');
  const [mQ, setMQ] = useState('');
  const [sheet, setSheet] = useState(null);
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
  // Điện thoại: danh sách thẻ gom theo ngày — không phải trượt ngang
  const WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const short = (n) => (n >= 1e9 ? `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Tỷ` : n >= 1e6 ? `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Tr` : fmt(n));
  const dayLabel = (ds) => { const x = new Date(ds); return `${WD[x.getDay()]}, ${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const renderMobile = (list) => {
    const sumIn = list.filter(d => d.flow_type === 'in').reduce((t, d) => t + Number(d.amount || 0), 0);
    const sumOut = list.filter(d => d.flow_type === 'out').reduce((t, d) => t + Number(d.amount || 0), 0);
    const nq = mQ.trim().toLowerCase();
    const shown = list.filter(d => (mFlow === 'all' || d.flow_type === mFlow)
      && (!nq || `${d.notes || ''} ${d.handover_person || ''} ${d.amount || ''}`.toLowerCase().includes(nq)));
    const groups = [];
    shown.forEach(d => { const g = groups[groups.length - 1]; if (g && g.date === d.date) g.items.push(d); else groups.push({ date: d.date, items: [d] }); });
    return (
      <div className="lg:hidden p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'all', label: 'Tất cả', sub: `${list.length} GD` },
            { id: 'in', label: 'Thu', sub: `+${short(sumIn)}` },
            { id: 'out', label: 'Chi', sub: `-${short(sumOut)}` },
          ].map(c => (
            <button key={c.id} onClick={() => setMFlow(c.id)}
              className={`min-w-0 flex flex-col items-start px-3 py-2 rounded-2xl border text-left transition ${mFlow === c.id ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-700 shadow-soft'}`}>
              <span className="text-[13px] font-semibold">{c.label}</span>
              <span className={`max-w-full truncate text-[12px] font-semibold tabular-nums ${mFlow === c.id ? 'text-white/85' : c.id === 'in' ? 'text-success-600' : c.id === 'out' ? 'text-danger-600' : 'text-slate-400'}`}>{c.sub}</span>
            </button>
          ))}
        </div>
        <div className="e-search">
          <Search />
          <input value={mQ} onChange={e => setMQ(e.target.value)} placeholder="Tìm ghi chú, người bàn giao, số tiền…" className="!h-11 !text-[16px]" />
        </div>
        {loading ? (
          <div className="e-empty py-8"><div className="w-7 h-7 mb-3 border-[3px] border-teal-100 border-t-teal-600 rounded-full animate-spin" /><div className="e-empty-desc mt-0">Đang tải...</div></div>
        ) : groups.length === 0 ? (
          <div className="e-empty"><div className="e-empty-icon"><Coins /></div><div className="e-empty-title">{nq || mFlow !== 'all' ? 'Không có giao dịch phù hợp' : 'Không có dữ liệu'}</div></div>
        ) : groups.map(g => {
          const net = g.items.reduce((t, d) => t + (d.flow_type === 'in' ? 1 : -1) * Number(d.amount || 0), 0);
          return (
            <section key={g.date}>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[13px] font-bold text-slate-700">{dayLabel(g.date)}</span>
                <span className={`text-[12.5px] font-semibold tabular-nums ${net >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}</span>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft divide-y divide-slate-100 overflow-hidden">
                {g.items.map(d => (
                  <button key={d.id} onClick={() => setSheet(d)} className="w-full flex items-start gap-3 px-3.5 py-3 text-left active:bg-teal-50/50 transition">
                    <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 mt-0.5 ${d.flow_type === 'in' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
                      {d.flow_type === 'in' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] font-semibold text-slate-900 leading-snug line-clamp-2 break-words">{d.notes || (d.flow_type === 'in' ? 'Thu tiền' : 'Chi tiền')}</span>
                      <span className="block text-[12.5px] text-slate-500 mt-0.5 truncate">{[d.handover_person, d.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`shrink-0 text-[15px] font-bold tabular-nums whitespace-nowrap mt-0.5 ${d.flow_type === 'in' ? 'text-success-600' : 'text-danger-600'}`}>{d.flow_type === 'in' ? '+' : '-'}{fmt(d.amount)}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderTable = (list) => (
    <>
    {renderMobile(list)}
    <div className="e-table-wrap hidden lg:block">
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
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh công cụ: mô tả + kỳ + hành động */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <p className="e-page-desc hidden md:block">Quản lý nhận/chi tiền mặt và chuyển khoản theo ngày</p>
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
          <button onClick={loadData} className="e-btn e-btn-secondary max-lg:w-10 max-lg:px-0" title="Làm mới">
            <RefreshCw className="w-4 h-4" /> <span className="hidden lg:inline">Làm mới</span>
          </button>
          {canWrite && (
            <button onClick={() => { setEditId(null); setForm({ date: vnToday(), flow_type: 'in', amount: '', method: 'transfer', handover_person: '', notes: '' }); setShowCreateModal(true); }}
              className="e-btn e-btn-primary max-lg:fixed max-lg:right-4 max-lg:bottom-[calc(88px+env(safe-area-inset-bottom))] max-lg:z-20 max-lg:h-12 max-lg:px-5 max-lg:rounded-full max-lg:shadow-nav">
              <Plus className="w-4 h-4" /> Tạo giao dịch
            </button>
          )}
        </div>
      </div>

      {/* Chỉ số chính (MetricCard Ethics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
        <div className="e-metric max-lg:flex-col max-lg:items-start max-lg:gap-2 max-lg:p-3.5">
          <span className="e-metric-icon e-tone-success max-lg:w-10 max-lg:h-10"><ArrowDownLeft /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Tổng Nhận (Thu)</div>
            <div className="e-metric-value max-lg:text-[17px]">{fmt(totalIn)}</div>
          </div>
        </div>
        <div className="e-metric max-lg:flex-col max-lg:items-start max-lg:gap-2 max-lg:p-3.5">
          <span className="e-metric-icon e-tone-danger max-lg:w-10 max-lg:h-10"><ArrowUpRight /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Tổng Chi</div>
            <div className="e-metric-value max-lg:text-[17px]">{fmt(totalOut)}</div>
          </div>
        </div>
        <div className="e-metric border-teal-300 col-span-2 md:col-span-1">
          <span className="e-metric-icon"><Coins /></span>
          <div className="min-w-0">
            <div className="e-metric-label">VỐN LƯU ĐỘNG</div>
            <div className="e-metric-value !text-teal-700">{fmt(workingCapital)}</div>
            {riskNet !== 0 && <div className="e-metric-hint">đã trừ trích quỹ rủi ro {fmt(riskNet)}</div>}
          </div>
        </div>
      </div>

      {/* Báo cáo tổng quan tháng — ô bấm để mở màn liên quan */}
      <div className="e-card e-card-pad max-lg:order-last">
        <div className="e-card-header">
          <h3 className="e-card-title">Báo cáo tổng quan Tháng {filterMonth}/{filterYear}</h3>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5 lg:gap-3 [&>div]:max-lg:p-3 [&>div>span:first-child]:max-lg:hidden [&_.text-\[18px\]]:max-lg:text-[15px]">
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
      <div className="e-card overflow-hidden flex flex-col max-lg:bg-transparent max-lg:border-0 max-lg:shadow-none max-lg:overflow-visible">
        <div className="e-tabs px-1 lg:px-3">
          <button onClick={() => setActiveTab('transfer')} className={`e-tab max-lg:flex-1 max-lg:justify-center max-lg:px-1.5 max-lg:text-[13.5px] max-lg:[&>svg]:hidden ${activeTab === 'transfer' ? 'e-tab-active' : ''}`}>
            <Banknote /> <span className="lg:hidden">Chuyển khoản</span><span className="hidden lg:inline">Sổ Chuyển Khoản</span>
          </button>
          <button onClick={() => setActiveTab('cash')} className={`e-tab max-lg:flex-1 max-lg:justify-center max-lg:px-1.5 max-lg:text-[13.5px] max-lg:[&>svg]:hidden ${activeTab === 'cash' ? 'e-tab-active' : ''}`}>
            <Coins /> <span className="lg:hidden">Tiền mặt</span><span className="hidden lg:inline">Sổ Tiền Mặt</span>
          </button>
          <button onClick={() => setActiveTab('stats')} className={`e-tab max-lg:flex-1 max-lg:justify-center max-lg:px-1.5 max-lg:text-[13.5px] max-lg:[&>svg]:hidden ${activeTab === 'stats' ? 'e-tab-active' : ''}`}>
            <LineChartIcon /> <span className="lg:hidden">Thống kê</span><span className="hidden lg:inline">Thống kê dòng tiền</span>
          </button>
        </div>

        {activeTab === 'transfer' && renderTable(transferData)}
        {activeTab === 'cash' && renderTable(cashData)}
        
        {activeTab === 'stats' && (
          <div className="p-4 lg:p-5 max-lg:mt-3 max-lg:rounded-2xl max-lg:bg-white max-lg:border max-lg:border-slate-200/80 max-lg:shadow-soft">
            <div className="min-w-0">
              <h3 className="e-card-title mb-4">Biểu đồ Nhận / Chi theo ngày (Tháng {filterMonth})</h3>
              <div className="h-64 lg:h-80 [&_.recharts-cartesian-grid_line]:[stroke-dasharray:0] [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!border-slate-200">
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

      {/* Điện thoại: chi tiết 1 giao dịch + Sửa / Xoá */}
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="e-modal-backdrop" onClick={() => setSheet(null)} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-float px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto animate-page">
            <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-3" />
            <div className="flex items-center gap-3">
              <span className={`w-12 h-12 rounded-full grid place-items-center shrink-0 ${sheet.flow_type === 'in' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
                {sheet.flow_type === 'in' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-slate-500">{sheet.flow_type === 'in' ? 'Thu tiền' : 'Chi tiền'} · {sheet.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</div>
                <div className={`text-[24px] font-bold tabular-nums leading-tight ${sheet.flow_type === 'in' ? 'text-success-600' : 'text-danger-600'}`}>{sheet.flow_type === 'in' ? '+' : '-'}{fmt(sheet.amount)}</div>
              </div>
              <button onClick={() => setSheet(null)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-subtle mt-4 divide-y divide-slate-100">
              <div className="flex items-center gap-3 px-3.5 py-3"><Calendar className="w-4 h-4 text-teal-600 shrink-0" /><span className="text-[13px] text-slate-500 w-28 shrink-0">Ngày</span><span className="text-[14.5px] font-semibold text-slate-800">{dayLabel(sheet.date)}/{new Date(sheet.date).getFullYear()}</span></div>
              <div className="flex items-center gap-3 px-3.5 py-3"><User className="w-4 h-4 text-teal-600 shrink-0" /><span className="text-[13px] text-slate-500 w-28 shrink-0">Người bàn giao</span><span className="text-[14.5px] font-semibold text-slate-800 break-words min-w-0">{sheet.handover_person || '—'}</span></div>
              <div className="px-3.5 py-3"><div className="text-[13px] text-slate-500 mb-1">Ghi chú</div><div className="text-[14.5px] text-slate-800 whitespace-pre-line break-words">{sheet.notes || '—'}</div></div>
            </div>
            {canWrite && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {canEdit && (
                  <button onClick={() => { const d = sheet; setSheet(null); openEdit(d); }} className="e-btn e-btn-outline h-12"><Pencil className="w-4 h-4" /> Sửa</button>
                )}
                <button onClick={() => { const id = sheet.id; setSheet(null); handleDelete(id); }} className={`e-btn e-btn-danger-soft h-12 ${canEdit ? '' : 'col-span-2'}`}><Trash2 className="w-4 h-4" /> Xoá</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="e-modal-backdrop z-50 flex items-end lg:items-center justify-center lg:p-4">
          <form onSubmit={handleCreateSubmit} className="e-modal max-w-lg max-h-[92vh] overflow-hidden flex flex-col max-lg:max-w-none max-lg:rounded-b-none max-lg:rounded-t-3xl">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2 shrink-0" />
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">{editId ? 'Sửa giao dịch Dòng tiền' : 'Ghi nhận Dòng tiền'}</h3>
              <button type="button" onClick={() => { setShowCreateModal(false); setEditId(null); }} title="Đóng" className="e-icon-btn w-8 h-8 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="e-modal-body overflow-y-auto space-y-4">
              {/* Điện thoại: chọn nhanh Thu/Chi và Hình thức */}
              <div className="lg:hidden space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm({ ...form, flow_type: 'in' })} className={`h-12 rounded-xl border text-[15px] font-bold inline-flex items-center justify-center gap-2 ${form.flow_type === 'in' ? 'bg-success-50 border-success-500 text-success-600' : 'bg-white border-slate-200 text-slate-500'}`}><ArrowDownLeft className="w-5 h-5" />Thu tiền</button>
                  <button type="button" onClick={() => setForm({ ...form, flow_type: 'out' })} className={`h-12 rounded-xl border text-[15px] font-bold inline-flex items-center justify-center gap-2 ${form.flow_type === 'out' ? 'bg-danger-50 border-danger-500 text-danger-600' : 'bg-white border-slate-200 text-slate-500'}`}><ArrowUpRight className="w-5 h-5" />Chi tiền</button>
                </div>
                <div className="e-seg w-full">
                  <button type="button" onClick={() => setForm({ ...form, method: 'transfer' })} className={`e-seg-item flex-1 h-10 ${form.method === 'transfer' ? 'e-seg-active' : ''}`}><Banknote />Chuyển khoản</button>
                  <button type="button" onClick={() => setForm({ ...form, method: 'cash' })} className={`e-seg-item flex-1 h-10 ${form.method === 'cash' ? 'e-seg-active' : ''}`}><Coins />Tiền mặt</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Ngày giao dịch *</label>
                  <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="e-input max-lg:h-12 max-lg:text-[16px]" />
                </div>
                <div className="hidden lg:block">
                  <label className="e-label">Phân loại *</label>
                  <select required value={form.flow_type} onChange={e => setForm({...form, flow_type: e.target.value})} className="e-input font-semibold cursor-pointer">
                    <option value="in">Thu / Nhận tiền (+)</option>
                    <option value="out">Chi / Trả tiền (-)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="hidden lg:block">
                  <label className="e-label">Hình thức *</label>
                  <select required value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="e-input cursor-pointer">
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label className="e-label">Số tiền (VNĐ) *</label>
                  <input required type="text" value={form.amount} onChange={e => setForm({...form, amount: formatCurrencyInput(e.target.value)})} className={`e-input max-lg:h-12 font-bold text-[16px] tabular-nums ${form.flow_type === 'in' ? 'text-success-600' : 'text-danger-600'}`} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="e-label">Người bàn giao / Đối tượng</label>
                <input type="text" value={form.handover_person} onChange={e => setForm({...form, handover_person: e.target.value})} className="e-input max-lg:h-12 max-lg:text-[16px]" placeholder="Nguyễn Văn A..." />
              </div>

              <div>
                <label className="e-label">Ghi chú chi tiết</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="e-textarea h-20 resize-none max-lg:text-[16px]" placeholder="Lý do thu chi..." />
              </div>
            </div>

            <div className="e-modal-footer shrink-0 max-lg:rounded-none max-lg:bg-white max-lg:pb-[calc(16px+env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => { setShowCreateModal(false); setEditId(null); }} className="e-btn e-btn-secondary max-lg:h-12 max-lg:flex-1">Hủy</button>
              <button type="submit" disabled={saving} className="e-btn e-btn-primary max-lg:h-12 max-lg:flex-1">{editId ? 'Lưu thay đổi' : 'Ghi nhận'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
