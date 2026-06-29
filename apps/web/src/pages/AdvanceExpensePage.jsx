import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { 
  Plus, RefreshCw, Trash2, ArrowDownLeft, FileText, Users, BarChart2,
  Calendar, Filter, Search, CheckCircle, XCircle, Clock, Image as ImageIcon,
  MoreVertical, X, UploadCloud, Loader2, Wallet
} from 'lucide-react';

const CATEGORIES = {
  'Vat_tu': 'Mua vật tư/Trang thiết bị',
  'Van_phong': 'Văn phòng phẩm',
  'Cong_tac': 'Chi phí công tác',
  'Tiep_khach': 'Tiếp khách',
  'MKT': 'Marketing/Quảng cáo',
  'Tho_cung': 'Đồ thờ/cúng',
  'Khac': 'Khác'
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AdvanceExpensePage() {
  const { profile } = useAuth();
  const isAdminOrAccountant = ['admin', 'accountant'].includes(profile?.role);

  const [activeTab, setActiveTab] = useState('list');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStaff, setFilterStaff] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const repayFileInputRef = useRef(null);

  // View Image Modal
  const [viewImage, setViewImage] = useState(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    staff_id: '', category: 'Vat_tu', amount: '', description: '',
    provider: '', method: 'transfer', proof: ''
  });

  const [repayForm, setRepayForm] = useState({
    date: new Date().toISOString().split('T')[0], amount: '', method: 'transfer', note: '', proof: ''
  });

  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`;
    const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0];

    let query = supabase
      .from('expenses')
      .select('*, profiles!expenses_staff_id_fkey(full_name)')
      .eq('is_advance', true)
      .is('deleted_at', null)
      .gte('date', startDate)
      .lte('date', endDate);

    if (!isAdminOrAccountant) {
      query = query.eq('staff_id', profile.id);
    } else {
      if (filterStaff !== 'all') query = query.eq('staff_id', filterStaff);
    }
    
    if (filterCategory !== 'all') query = query.eq('category', filterCategory);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);

    const { data: expensesData, error } = await query.order('created_at', { ascending: false });

    if (error) toast.error(error.message);
    else setData(expensesData || []);

    if (isAdminOrAccountant && staffList.length === 0) {
      const { data: sData } = await supabase.from('profiles').select('id, full_name').eq('is_active', true);
      if (sData) setStaffList(sData);
    }
    
    setLoading(false);
  }, [filterMonth, filterYear, filterStaff, filterCategory, filterStatus, isAdminOrAccountant, profile, staffList.length]);

  useEffect(() => {
    if (profile) loadData();
  }, [loadData, profile]);

  // Tự tải lại khi có thay đổi (vd duyệt/từ chối qua Telegram)
  useEffect(() => {
    const ch = supabase.channel('expenses_mgmt_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';

  // Stats calculation
  let totalSpent = 0, totalRepaid = 0, validTx = 0;
  data.forEach(d => {
    if (d.status === 'approved' || d.status === 'paid') {
      totalSpent += Number(d.amount);
      validTx++;
    }
    if (d.status === 'paid') {
      totalRepaid += Number(d.advance_repaid_amount || d.amount);
    }
  });
  const totalMissing = totalSpent - totalRepaid;

  const handleImageUpload = async (e, setProofFn) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadToR2(file, 'expenses');
      setProofFn(url);
      toast.success('Đã tải ảnh lên!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    }
    setUploadingImage(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) return toast.error('Vui lòng nhập số tiền');
    setSaving(true);
    
    const numericAmount = parseInt(form.amount.replace(/\./g, ''), 10);
    const staffId = isAdminOrAccountant ? (form.staff_id || profile.id) : profile.id;

    const { error } = await supabase.from('expenses').insert({
      staff_id: staffId,
      date: form.date,
      category: form.category,
      amount: numericAmount,
      description: form.description,
      notes: form.provider + ' | ' + form.method, // Lưu tạm vào notes
      proof_image_urls: form.proof ? [form.proof] : [],
      is_advance: true,
      status: 'pending'
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Đã tạo phiếu tạm ứng thành công!');
      setShowCreateModal(false);
      setForm({ ...form, amount: '', description: '', provider: '', proof: '' });
      loadData();
    }
    setSaving(false);
  };

  const handleApprove = async (id) => {
    if (!confirm('Bạn chắc chắn muốn DUYỆT phiếu này?')) return;
    const { error } = await supabase.from('expenses').update({ 
      status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() 
    }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Đã duyệt phiếu'); loadData(); }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return toast.error('Vui lòng nhập lý do');
    setSaving(true);
    const { error } = await supabase.from('expenses').update({ 
      status: 'rejected', reject_reason: rejectReason 
    }).eq('id', selectedExpense.id);
    if (error) toast.error(error.message);
    else { toast.success('Đã từ chối phiếu'); setShowRejectModal(false); loadData(); }
    setSaving(false);
  };

  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    if (!repayForm.amount) return toast.error('Vui lòng nhập số tiền hoàn');
    setSaving(true);
    const numericAmount = parseInt(repayForm.amount.replace(/\./g, ''), 10);
    const { error } = await supabase.from('expenses').update({ 
      status: 'paid', 
      paid_at: repayForm.date,
      advance_repaid_amount: numericAmount,
      advance_repaid_method: repayForm.method,
      advance_repaid_proof: repayForm.proof,
      advance_repaid_at: new Date().toISOString()
    }).eq('id', selectedExpense.id);
    if (error) toast.error(error.message);
    else { toast.success('Đã hoàn ứng thành công'); setShowRepayModal(false); loadData(); }
    setSaving(false);
  };

  const openRepayFast = () => {
    const approvedList = data.filter(d => d.status === 'approved');
    if (approvedList.length === 0) return toast.info('Không có phiếu nào đang chờ hoàn ứng trong tháng này.');
    // Mở modal hoàn ứng nhưng cho chọn phiếu
    setSelectedExpense(approvedList[0]);
    setRepayForm({
      date: new Date().toISOString().split('T')[0], 
      amount: new Intl.NumberFormat('vi-VN').format(approvedList[0].amount), 
      method: 'transfer', note: '', proof: ''
    });
    setShowRepayModal(true);
  };

  const formatCurrencyInput = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers ? new Intl.NumberFormat('vi-VN').format(numbers) : '';
  };

  const renderStatus = (d) => {
    if (d.status === 'pending') return <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg text-xs font-bold"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
    if (d.status === 'approved') return <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-xs font-bold"><CheckCircle className="w-3 h-3" /> Đã duyệt</span>;
    if (d.status === 'paid') return <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold"><CheckCircle className="w-3 h-3" /> Đã hoàn ứng</span>;
    if (d.status === 'rejected') return <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg text-xs font-bold"><XCircle className="w-3 h-3" /> Từ chối</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạm ứng chi</h2>
          <p className="text-slate-500 text-sm mt-1">Nhân sự chi hộ công ty và gửi đề nghị kế toán hoàn tiền</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadData} className="px-4 py-2 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition-colors">
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
          {isAdminOrAccountant && (
            <button onClick={openRepayFast} className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition-colors">
              <ArrowDownLeft className="w-4 h-4" /> Ghi nhận hoàn ứng
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 font-bold rounded-xl text-sm shadow-md flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Tạo phiếu tạm ứng chi
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
          <div className="text-amber-600 text-sm font-bold flex items-center gap-2 mb-2"><ArrowDownLeft className="w-4 h-4" /> {isAdminOrAccountant ? 'Tổng đã chi' : 'Tổng đã chi của tôi'}</div>
          <div className="text-2xl font-black text-amber-700">{fmt(totalSpent)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-emerald-600 text-sm font-bold flex items-center gap-2 mb-2"><ArrowDownLeft className="w-4 h-4" /> {isAdminOrAccountant ? 'Tổng đã hoàn ứng' : 'Đã được hoàn ứng'}</div>
          <div className="text-2xl font-black text-emerald-700">{fmt(totalRepaid)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm">
          <div className="text-red-600 text-sm font-bold flex items-center gap-2 mb-2"><Wallet className="w-4 h-4" /> Còn thiếu</div>
          <div className="text-2xl font-black text-red-700">{fmt(totalMissing)}</div>
        </div>
        {isAdminOrAccountant && (
          <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm">
            <div className="text-blue-600 text-sm font-bold flex items-center gap-2 mb-2"><BarChart2 className="w-4 h-4" /> Tổng giao dịch hợp lệ</div>
            <div className="text-2xl font-black text-blue-700">{validTx}</div>
          </div>
        )}
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex bg-slate-50 border-b overflow-x-auto">
          <button onClick={() => setActiveTab('list')} className={`px-6 py-4 font-semibold text-sm transition-colors shrink-0 ${activeTab === 'list' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            Danh sách phiếu
          </button>
          {isAdminOrAccountant && (
            <>
              <button onClick={() => setActiveTab('staff')} className={`px-6 py-4 font-semibold text-sm transition-colors shrink-0 ${activeTab === 'staff' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Theo dõi nhân sự</button>
              <button onClick={() => setActiveTab('stats')} className={`px-6 py-4 font-semibold text-sm transition-colors shrink-0 ${activeTab === 'stats' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Thống kê</button>
            </>
          )}
        </div>

        {activeTab === 'list' && (
          <>
            <div className="p-4 border-b flex flex-wrap gap-4 items-center bg-white">
              <div className="flex items-center gap-2 text-slate-500"><Filter className="w-4 h-4" /> Bộ lọc:</div>
              <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                </select>
                <span className="text-slate-300">/</span>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
                  {Array.from({ length: 4 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {isAdminOrAccountant && (
                <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
                    <option value="all">Tất cả nhân sự</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-1.5">
                <Filter className="w-4 h-4 text-slate-400" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
                  <option value="all">Tất cả danh mục</option>
                  {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-1.5">
                <CheckCircle className="w-4 h-4 text-slate-400" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent text-sm font-semibold outline-none text-slate-700">
                  <option value="all">Tất cả trạng thái</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt (Chờ hoàn)</option>
                  <option value="paid">Đã hoàn ứng</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>
            </div>

            {/* Mobile: dạng thẻ */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading ? (
                <div className="text-center py-10 text-slate-400 text-sm">Đang tải...</div>
              ) : data.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Không có dữ liệu</div>
              ) : data.map(d => (
                <div key={d.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800">{d.profiles?.full_name}</div>
                      <div className="text-xs text-slate-400">{new Date(d.date).toLocaleDateString('vi-VN')} · {CATEGORIES[d.category] || d.category}</div>
                    </div>
                    <div className="font-bold text-slate-800 text-base shrink-0">{fmt(d.amount)}</div>
                  </div>
                  {d.description && <div className="text-sm text-slate-500 mt-1">{d.description}</div>}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {renderStatus(d)}
                    {d.status === 'rejected' && <span className="text-xs text-red-500 italic">"{d.reject_reason}"</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {d.proof_image_urls?.[0] && <button onClick={() => setViewImage(d.proof_image_urls[0])} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg" title="Bill chi"><ImageIcon className="w-4 h-4" /></button>}
                    {d.advance_repaid_proof && <button onClick={() => setViewImage(d.advance_repaid_proof)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg" title="Bill hoàn"><CheckCircle className="w-4 h-4" /></button>}
                    {isAdminOrAccountant && d.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(d.id)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold text-xs">Duyệt</button>
                        <button onClick={() => { setSelectedExpense(d); setShowRejectModal(true); }} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg font-semibold text-xs">Từ chối</button>
                      </>
                    )}
                    {isAdminOrAccountant && d.status === 'approved' && (
                      <button onClick={() => { setSelectedExpense(d); setRepayForm(prev => ({ ...prev, amount: new Intl.NumberFormat('vi-VN').format(d.amount) })); setShowRepayModal(true); }} className="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg font-semibold text-xs">Hoàn ứng</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: bảng */}
            <div className="hidden md:block overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b">
                    <th className="px-6 py-4 font-semibold">Ngày</th>
                    <th className="px-6 py-4 font-semibold">Người YC</th>
                    <th className="px-6 py-4 font-semibold">Danh mục</th>
                    <th className="px-6 py-4 font-semibold">Số tiền</th>
                    <th className="px-6 py-4 font-semibold">Trạng thái</th>
                    <th className="px-6 py-4 font-semibold text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-slate-400">Không có dữ liệu</td></tr>
                  ) : data.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {new Date(d.date).toLocaleDateString('vi-VN')}
                        <div className="text-xs text-slate-400 mt-0.5">{d.description?.substring(0, 30)}...</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{d.profiles?.full_name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-100 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600">{CATEGORIES[d.category] || d.category}</span></td>
                      <td className="px-6 py-4 font-bold text-slate-800 text-base">{fmt(d.amount)}</td>
                      <td className="px-6 py-4">
                        {renderStatus(d)}
                        {d.status === 'rejected' && <div className="text-xs text-red-500 mt-1 italic">"{d.reject_reason}"</div>}
                        {d.status === 'paid' && <div className="text-xs text-emerald-500 mt-1">Đã ck {new Date(d.advance_repaid_at).toLocaleDateString('vi-VN')}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {d.proof_image_urls?.[0] && (
                            <button onClick={() => setViewImage(d.proof_image_urls[0])} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Xem bill chi">
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          )}
                          {d.advance_repaid_proof && (
                            <button onClick={() => setViewImage(d.advance_repaid_proof)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Xem bill hoàn">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {isAdminOrAccountant && d.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(d.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition-colors">Duyệt</button>
                              <button onClick={() => { setSelectedExpense(d); setShowRejectModal(true); }} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold text-xs transition-colors">Từ chối</button>
                            </>
                          )}
                          {isAdminOrAccountant && d.status === 'approved' && (
                            <button onClick={() => { 
                              setSelectedExpense(d); 
                              setRepayForm(prev => ({...prev, amount: new Intl.NumberFormat('vi-VN').format(d.amount)}));
                              setShowRepayModal(true); 
                            }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-xs shadow-sm transition-colors">Hoàn ứng</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isAdminOrAccountant && activeTab === 'staff' && (() => {
          const staffMap = {};
          data.forEach(d => {
            if (d.status === 'approved' || d.status === 'paid') {
              if (!staffMap[d.staff_id]) staffMap[d.staff_id] = { name: d.profiles?.full_name, total: 0, repaid: 0, count: 0 };
              staffMap[d.staff_id].count++;
              staffMap[d.staff_id].total += Number(d.amount);
              if (d.status === 'paid') staffMap[d.staff_id].repaid += Number(d.advance_repaid_amount || d.amount);
            }
          });
          const rows = Object.values(staffMap);
          return (
            <div className="p-4 sm:p-6 bg-white">
              <h3 className="font-bold text-slate-800 mb-4">Tổng hợp công nợ theo nhân sự (Tháng {filterMonth})</h3>

              {/* Mobile: thẻ */}
              <div className="md:hidden space-y-3">
                {rows.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Chưa có dữ liệu</div> : rows.map((s, i) => (
                  <div key={i} className="border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{s.count} phiếu</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="bg-amber-50 rounded-lg py-2"><div className="text-[10px] text-amber-500 uppercase">Đã chi</div><div className="font-bold text-amber-600 text-sm">{fmt(s.total)}</div></div>
                      <div className="bg-emerald-50 rounded-lg py-2"><div className="text-[10px] text-emerald-500 uppercase">Đã hoàn</div><div className="font-bold text-emerald-600 text-sm">{fmt(s.repaid)}</div></div>
                      <div className="bg-red-50 rounded-lg py-2"><div className="text-[10px] text-red-500 uppercase">Còn nợ</div><div className="font-bold text-red-600 text-sm">{fmt(s.total - s.repaid)}</div></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: bảng */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-sm">
                      <th className="p-3 border">Nhân sự</th>
                      <th className="p-3 border">Tổng phiếu hợp lệ</th>
                      <th className="p-3 border">Đã chi (Tạm ứng)</th>
                      <th className="p-3 border">Đã hoàn ứng</th>
                      <th className="p-3 border">Còn nợ (Cần hoàn)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 border font-semibold text-slate-800">{s.name}</td>
                        <td className="p-3 border text-center">{s.count}</td>
                        <td className="p-3 border font-bold text-amber-600">{fmt(s.total)}</td>
                        <td className="p-3 border font-bold text-emerald-600">{fmt(s.repaid)}</td>
                        <td className="p-3 border font-bold text-red-600">{fmt(s.total - s.repaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {isAdminOrAccountant && activeTab === 'stats' && (
          <div className="p-6 bg-white grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 text-center">Tỷ trọng chi tiêu theo danh mục</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={(() => {
                      const catMap = {};
                      data.forEach(d => {
                        if (d.status === 'approved' || d.status === 'paid') {
                          catMap[d.category] = (catMap[d.category] || 0) + Number(d.amount);
                        }
                      });
                      return Object.keys(catMap).map((k, i) => ({ name: CATEGORIES[k] || k, value: catMap[k], color: COLORS[i % COLORS.length] }));
                    })()} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 text-center">Thống kê chi tiêu theo nhân sự</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    const staffMap = {};
                    data.forEach(d => {
                      if (d.status === 'approved' || d.status === 'paid') {
                        if (!staffMap[d.staff_id]) staffMap[d.staff_id] = { name: d.profiles?.full_name?.split(' ').pop() || 'Khác', value: 0 };
                        staffMap[d.staff_id].value += Number(d.amount);
                      }
                    });
                    return Object.values(staffMap).sort((a,b) => b.value - a.value);
                  })()} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => (val / 1000000) + 'M'} width={45} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(val) => fmt(val)} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <div className="relative max-w-5xl w-full flex justify-center">
            <button onClick={() => setViewImage(null)} className="absolute -top-12 right-0 md:-right-12 text-white hover:text-slate-300 p-2">
              <X className="w-8 h-8" />
            </button>
            <img src={viewImage} alt="Chứng từ" className="max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateSubmit} className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">Tạo phiếu tạm ứng chi</h3>
              <button type="button" onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {isAdminOrAccountant && (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-700">Người yêu cầu *</label>
                    <select required value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                      <option value="">-- Chọn nhân sự --</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Ngày chi *</label>
                  <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Danh mục chi *</label>
                  <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                    {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Số tiền (VNĐ) *</label>
                  <input required type="text" value={form.amount} onChange={e => setForm({...form, amount: formatCurrencyInput(e.target.value)})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 font-bold text-teal-700 text-lg" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Lý do / Mô tả chi tiết *</label>
                <textarea required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:border-teal-500 h-24 resize-none" placeholder="Nhập chi tiết mục đích chi tiền..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Nơi mua / Nhà cung cấp</label>
                  <input type="text" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="Tên cửa hàng, siêu thị..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Hình thức thanh toán</label>
                  <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Chứng từ đính kèm (Hóa đơn, bill...)</label>
                <div 
                  onClick={() => !uploadingImage && fileInputRef.current?.click()} 
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${form.proof ? 'border-teal-500 bg-teal-50' : 'border-slate-300 hover:border-teal-400 bg-slate-50'}`}
                >
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleImageUpload(e, url => setForm({...form, proof: url}))} />
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2 text-teal-600"><Loader2 className="w-6 h-6 animate-spin" /><span className="font-semibold text-sm">Đang tải...</span></div>
                  ) : form.proof ? (
                    <div className="flex flex-col items-center gap-2 text-teal-700"><CheckCircle className="w-6 h-6" /><span className="font-semibold text-sm">Đã tải ảnh thành công</span></div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500"><UploadCloud className="w-6 h-6 text-teal-500" /><span className="font-semibold text-sm text-teal-600">Click để tải lên</span><span className="text-xs">Hỗ trợ JPG, PNG (Max 5MB)</span></div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 shrink-0 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
              <button type="submit" disabled={saving || uploadingImage} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">Gửi yêu cầu</button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleRejectSubmit} className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-800">Từ chối phiếu tạm ứng</h3>
              <button type="button" onClick={() => setShowRejectModal(false)}><X className="w-5 h-5 text-red-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Bạn đang từ chối phiếu trị giá <b>{fmt(selectedExpense?.amount)}</b> của <b>{selectedExpense?.profiles?.full_name}</b>.</p>
              <div>
                <label className="block text-sm font-semibold mb-2">Lý do từ chối *</label>
                <textarea required value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full border p-3 rounded-xl outline-none focus:border-red-500 h-24" placeholder="Nhập lý do..." />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl">Xác nhận Từ chối</button>
            </div>
          </form>
        </div>
      )}

      {/* Repay Modal */}
      {showRepayModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleRepaySubmit} className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-emerald-800">Ghi nhận hoàn ứng (Thanh toán)</h3>
              <button type="button" onClick={() => setShowRepayModal(false)}><X className="w-5 h-5 text-emerald-400" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-semibold mb-2">Chọn phiếu tạm ứng cần hoàn *</label>
                <select 
                  className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-white text-slate-700 font-semibold"
                  value={selectedExpense?.id || ''}
                  onChange={(e) => {
                    const exp = data.find(d => d.id === e.target.value);
                    if (exp) {
                      setSelectedExpense(exp);
                      setRepayForm(prev => ({...prev, amount: new Intl.NumberFormat('vi-VN').format(exp.amount)}));
                    }
                  }}
                >
                  {data.filter(d => d.status === 'approved').map(exp => (
                    <option key={exp.id} value={exp.id}>
                      {exp.profiles?.full_name} - {fmt(exp.amount)} ({CATEGORIES[exp.category] || exp.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Ngày hoàn tiền *</label>
                  <input required type="date" value={repayForm.date} onChange={e => setRepayForm({...repayForm, date: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Số tiền hoàn (VNĐ) *</label>
                  <input required type="text" value={repayForm.amount} onChange={e => setRepayForm({...repayForm, amount: formatCurrencyInput(e.target.value)})} className="w-full border p-2.5 rounded-xl outline-none font-bold text-emerald-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Hình thức chuyển</label>
                <select value={repayForm.method} onChange={e => setRepayForm({...repayForm, method: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none">
                  <option value="transfer">Chuyển khoản</option>
                  <option value="cash">Tiền mặt</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Ghi chú</label>
                <textarea value={repayForm.note} onChange={e => setRepayForm({...repayForm, note: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none h-20 resize-none" placeholder="VD: Chuyển khoản Techcombank đợt 1..." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Chứng từ (UNC, Phiếu chi...)</label>
                <div onClick={() => !uploadingImage && repayFileInputRef.current?.click()} className="border border-dashed border-emerald-300 rounded-xl p-6 text-center cursor-pointer bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                  <input type="file" accept="image/*" className="hidden" ref={repayFileInputRef} onChange={(e) => handleImageUpload(e, url => setRepayForm({...repayForm, proof: url}))} />
                  {uploadingImage ? <span className="text-emerald-600 font-semibold text-sm">Đang tải...</span> : repayForm.proof ? <span className="text-emerald-700 font-semibold text-sm flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4"/> Đã tải</span> : <span className="text-emerald-600 font-semibold text-sm flex items-center justify-center gap-1"><UploadCloud className="w-4 h-4"/> Click để tải lên</span>}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowRepayModal(false)} className="px-6 py-2.5 border rounded-xl font-semibold">Hủy</button>
              <button type="submit" disabled={saving || uploadingImage} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl">Xác nhận hoàn ứng</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
