import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { 
  Plus, RefreshCw, Trash2, ArrowDownLeft, FileText, Users, BarChart2,
  Calendar, Filter, Search, CheckCircle, XCircle, Clock, Image as ImageIcon,
  MoreVertical, X, UploadCloud, Loader2, Wallet, ChevronDown, HandCoins, UserRound
} from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

const CATEGORIES = {
  'Vat_tu': 'Mua vật tư/Trang thiết bị',
  'Van_phong': 'Văn phòng phẩm',
  'Cong_tac': 'Chi phí công tác',
  'Tiep_khach': 'Tiếp khách',
  'MKT': 'Marketing/Quảng cáo',
  'Tho_cung': 'Đồ thờ/cúng',
  'Khac': 'Khác'
};

const COLORS = ['#067B7F', '#3CA7A9', '#76C2C3', '#F4B183', '#A99BE0'];

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
  // Xổ chi tiết theo nhân sự
  const [expandedStaff, setExpandedStaff] = useState(null);
  // Lịch sử xoá (thùng rác)
  const [showTrash, setShowTrash] = useState(false);
  const [trashData, setTrashData] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const isAdmin = profile?.role === 'admin';

  const [form, setForm] = useState({
    date: vnToday(),
    staff_id: '', category: 'Vat_tu', amount: '', description: '',
    provider: '', method: 'transfer', proofs: []
  });

  const [repayForm, setRepayForm] = useState({
    date: vnToday(), amount: '', method: 'transfer', note: '', proof: ''
  });

  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`;
    const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(new Date(filterYear, filterMonth, 0).getDate()).padStart(2, '0')}`;

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

  // Tải LÊN NHIỀU ảnh chứng từ (nối vào mảng proofs)
  const handleMultiUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImage(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadToR2(f, 'expenses'));
      setForm(prev => ({ ...prev, proofs: [...(prev.proofs || []), ...urls] }));
      toast.success(`Đã tải ${urls.length} ảnh lên!`);
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    }
    setUploadingImage(false);
    e.target.value = '';
  };
  const removeProof = (idx) => setForm(prev => ({ ...prev, proofs: (prev.proofs || []).filter((_, i) => i !== idx) }));

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
      proof_image_urls: form.proofs || [],
      is_advance: true,
      status: 'pending'
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Đã tạo phiếu tạm ứng thành công!');
      setShowCreateModal(false);
      setForm({ ...form, amount: '', description: '', provider: '', proofs: [] });
      loadData();
    }
    setSaving(false);
  };

  // Xoá mềm -> vào Lịch sử xoá (có thể khôi phục)
  const handleSoftDelete = async (exp) => {
    if (!confirm('Chuyển giao dịch tạm ứng này vào Lịch sử xoá? (có thể khôi phục sau)')) return;
    const { data: upd, error } = await supabase.from('expenses')
      .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id }).eq('id', exp.id).select('id');
    if (error) return toast.error(error.message);
    if (!upd || upd.length === 0) return toast.error('Không xoá được — RLS chặn quyền. Chạy SQL phân quyền.');
    toast.success('Đã chuyển vào Lịch sử xoá');
    loadData();
  };
  const loadTrash = async () => {
    setTrashLoading(true);
    let q = supabase.from('expenses').select('*, profiles!expenses_staff_id_fkey(full_name), remover:profiles!expenses_deleted_by_fkey(full_name)')
      .eq('is_advance', true).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (!isAdminOrAccountant) q = q.eq('staff_id', profile.id);
    const { data: t, error } = await q;
    if (error) { // fallback nếu chưa có FK remover
      const { data: t2 } = await supabase.from('expenses').select('*, profiles!expenses_staff_id_fkey(full_name)')
        .eq('is_advance', true).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
      setTrashData(t2 || []);
    } else setTrashData(t || []);
    setTrashLoading(false);
  };
  const handleRestore = async (exp) => {
    const { error } = await supabase.from('expenses').update({ deleted_at: null, deleted_by: null }).eq('id', exp.id);
    if (error) return toast.error(error.message);
    toast.success('Đã khôi phục giao dịch'); loadTrash(); loadData();
  };
  const handlePermanentDelete = async (exp) => {
    if (!confirm('Xoá VĨNH VIỄN giao dịch này? Không thể khôi phục lại.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', exp.id);
    if (error) return toast.error(error.message);
    toast.success('Đã xoá vĩnh viễn'); loadTrash();
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
      date: vnToday(), 
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
    if (d.status === 'pending') return <span className="e-badge e-badge-sm e-tone-warning"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
    if (d.status === 'approved') return <span className="e-badge e-badge-sm e-tone-info"><CheckCircle className="w-3 h-3" /> Đã duyệt</span>;
    if (d.status === 'paid') return <span className="e-badge e-badge-sm e-tone-success"><CheckCircle className="w-3 h-3" /> Đã hoàn ứng</span>;
    if (d.status === 'rejected') return <span className="e-badge e-badge-sm e-tone-danger"><XCircle className="w-3 h-3" /> Từ chối</span>;
    return null;
  };

  return (
    <div className="space-y-4 max-lg:pb-16">
      {/* Thanh công cụ: mô tả + hành động (nút chính bên phải; điện thoại: nút nổi) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <p className="e-page-desc">Nhân sự chi hộ công ty và gửi đề nghị kế toán hoàn tiền</p>
        <div className="flex items-center gap-2 max-lg:w-[calc(100%+2rem)] max-lg:-mx-4 max-lg:px-4 max-lg:overflow-x-auto max-lg:[scrollbar-width:none] lg:flex-wrap">
          <button onClick={loadData} className="e-btn e-btn-secondary shrink-0 max-lg:h-10 max-lg:rounded-full max-lg:bg-white" title="Làm mới">
            <RefreshCw /> Làm mới
          </button>
          {isAdminOrAccountant && (
            <button onClick={openRepayFast} className="e-btn e-btn-outline shrink-0 max-lg:h-10 max-lg:rounded-full max-lg:bg-white">
              <ArrowDownLeft className="w-4 h-4" /> Ghi nhận hoàn ứng
            </button>
          )}
          {isAdminOrAccountant && (
            <button onClick={() => { setShowTrash(true); loadTrash(); }} className="e-btn e-btn-secondary shrink-0 max-lg:h-10 max-lg:rounded-full max-lg:bg-white">
              <Trash2 className="w-4 h-4" /> Lịch sử xoá
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="e-btn e-btn-primary max-lg:fixed max-lg:right-4 max-lg:bottom-[calc(88px+env(safe-area-inset-bottom))] max-lg:z-20 max-lg:h-12 max-lg:px-5 max-lg:rounded-full max-lg:bg-gradient-to-br max-lg:from-[#067B7F] max-lg:to-[#3CA7A9] max-lg:shadow-nav">
            <Plus /> <span className="lg:hidden">Tạo phiếu</span><span className="hidden lg:inline">Tạo phiếu tạm ứng chi</span>
          </button>
        </div>
      </div>

      {/* Thẻ chỉ số (điện thoại: lưới 2 cột gọn) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="e-metric max-lg:flex-col max-lg:items-start max-lg:gap-2 max-lg:p-3.5 max-lg:shadow-soft max-lg:[&:last-child:nth-child(odd)]:col-span-2">
          <div className="e-metric-icon e-tone-peach max-lg:w-10 max-lg:h-10 max-lg:[&>svg]:w-5 max-lg:[&>svg]:h-5"><HandCoins /></div>
          <div className="min-w-0 max-lg:w-full">
            <div className="e-metric-label max-lg:text-[12.5px]">{isAdminOrAccountant ? 'Tổng đã chi' : 'Tổng đã chi của tôi'}</div>
            <div className="e-metric-value max-lg:text-[18px]">{fmt(totalSpent)}</div>
          </div>
        </div>
        <div className="e-metric max-lg:flex-col max-lg:items-start max-lg:gap-2 max-lg:p-3.5 max-lg:shadow-soft max-lg:[&:last-child:nth-child(odd)]:col-span-2">
          <div className="e-metric-icon e-tone-success max-lg:w-10 max-lg:h-10 max-lg:[&>svg]:w-5 max-lg:[&>svg]:h-5"><ArrowDownLeft /></div>
          <div className="min-w-0 max-lg:w-full">
            <div className="e-metric-label max-lg:text-[12.5px]">{isAdminOrAccountant ? 'Tổng đã hoàn ứng' : 'Đã được hoàn ứng'}</div>
            <div className="e-metric-value max-lg:text-[18px]">{fmt(totalRepaid)}</div>
          </div>
        </div>
        <div className="e-metric max-lg:flex-col max-lg:items-start max-lg:gap-2 max-lg:p-3.5 max-lg:shadow-soft max-lg:[&:last-child:nth-child(odd)]:col-span-2">
          <div className="e-metric-icon e-tone-danger max-lg:w-10 max-lg:h-10 max-lg:[&>svg]:w-5 max-lg:[&>svg]:h-5"><Wallet /></div>
          <div className="min-w-0 max-lg:w-full">
            <div className="e-metric-label max-lg:text-[12.5px]">Còn thiếu</div>
            <div className="e-metric-value text-danger-600 max-lg:text-[18px]">{fmt(totalMissing)}</div>
          </div>
        </div>
        {isAdminOrAccountant && (
          <div className="e-metric grid grid-cols-[auto_minmax(0,1fr)] gap-y-0 max-lg:grid-cols-1 max-lg:gap-y-2 max-lg:p-3.5 max-lg:shadow-soft">
            <div className="contents e-metric-label max-lg:text-[12.5px]"><BarChart2 className="row-span-2 max-lg:row-span-1 w-10 h-10 lg:w-14 lg:h-14 p-2.5 lg:p-4 rounded-full bg-info-50 text-info-600" /> Tổng giao dịch hợp lệ</div>
            <div className="e-metric-value max-lg:text-[18px] max-lg:-mt-1">{validTx}</div>
          </div>
        )}
      </div>

      {/* Tab + bộ lọc (điện thoại: bỏ khung thẻ, danh sách thẻ trên nền trang) */}
      <div className="e-card overflow-hidden flex flex-col max-lg:bg-transparent max-lg:border-0 max-lg:shadow-none max-lg:overflow-visible">
        <div className="e-tabs px-2 lg:px-3 max-lg:px-0">
          <button onClick={() => setActiveTab('list')} className={`e-tab shrink-0 ${activeTab === 'list' ? 'e-tab-active' : 'text-slate-500'}`}>
            Danh sách phiếu
          </button>
          {isAdminOrAccountant && (
            <>
              <button onClick={() => setActiveTab('staff')} className={`e-tab shrink-0 ${activeTab === 'staff' ? 'e-tab-active' : 'text-slate-500'}`}>Theo dõi nhân sự</button>
              <button onClick={() => setActiveTab('stats')} className={`e-tab shrink-0 ${activeTab === 'stats' ? 'e-tab-active' : 'text-slate-500'}`}>Thống kê</button>
            </>
          )}
        </div>

        {activeTab === 'list' && (
          <>
            <div className="px-4 lg:px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center max-lg:grid max-lg:grid-cols-2 max-lg:px-0 max-lg:pt-3 max-lg:pb-1 max-lg:border-0">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 mr-1 max-lg:hidden"><Filter className="w-4 h-4" /> Bộ lọc:</div>
              <div className="flex items-center gap-2 h-10 bg-white border border-slate-200 rounded-xl px-3 hover:border-teal-300 focus-within:border-teal-400 transition max-lg:col-span-2 max-lg:h-11 max-lg:rounded-2xl max-lg:shadow-soft">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="bg-transparent text-[13px] font-medium outline-none text-slate-700 cursor-pointer max-lg:flex-1 max-lg:text-[14px] max-lg:font-semibold">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                </select>
                <span className="text-slate-300">/</span>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="bg-transparent text-[13px] font-medium outline-none text-slate-700 cursor-pointer max-lg:flex-1 max-lg:text-[14px] max-lg:font-semibold">
                  {Array.from({ length: 4 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {isAdminOrAccountant && (
                <div className="flex items-center gap-2 h-10 bg-white border border-slate-200 rounded-xl px-3 hover:border-teal-300 focus-within:border-teal-400 transition max-lg:min-w-0 max-lg:h-11 max-lg:rounded-2xl max-lg:shadow-soft">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="bg-transparent text-[13px] font-medium outline-none text-slate-700 cursor-pointer max-lg:flex-1 max-lg:min-w-0 max-lg:w-full">
                    <option value="all">Tất cả nhân sự</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2 h-10 bg-white border border-slate-200 rounded-xl px-3 hover:border-teal-300 focus-within:border-teal-400 transition max-lg:min-w-0 max-lg:h-11 max-lg:rounded-2xl max-lg:shadow-soft">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-transparent text-[13px] font-medium outline-none text-slate-700 cursor-pointer max-lg:flex-1 max-lg:min-w-0 max-lg:w-full">
                  <option value="all">Tất cả danh mục</option>
                  {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 h-10 bg-white border border-slate-200 rounded-xl px-3 hover:border-teal-300 focus-within:border-teal-400 transition max-lg:min-w-0 max-lg:h-11 max-lg:rounded-2xl max-lg:shadow-soft max-lg:[&:nth-child(odd)]:col-span-2">
                <CheckCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent text-[13px] font-medium outline-none text-slate-700 cursor-pointer max-lg:flex-1 max-lg:min-w-0 max-lg:w-full">
                  <option value="all">Tất cả trạng thái</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt (Chờ hoàn)</option>
                  <option value="paid">Đã hoàn ứng</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>
            </div>

            {/* Điện thoại: thẻ yêu cầu kiểu Ethics (avatar · danh mục · số tiền · lý do · Từ chối | Duyệt) */}
            <div className="lg:hidden pt-2 space-y-3">
              {loading ? (
                <div className="e-empty text-[13px] text-slate-400">Đang tải...</div>
              ) : data.length === 0 ? (
                <div className="e-empty text-[13px] text-slate-400">Không có dữ liệu</div>
              ) : data.map(d => (
                <div key={d.id} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="e-avatar w-11 h-11 bg-gradient-to-br from-teal-50 to-teal-100"><UserRound className="w-5 h-5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[15px] leading-tight text-slate-900 truncate">{d.profiles?.full_name}</div>
                        <div className="mt-1 flex items-center gap-1.5 min-w-0">
                          <span className="e-badge e-badge-sm e-tone-brand min-w-0 max-w-full"><span className="truncate">{CATEGORIES[d.category] || d.category}</span></span>
                          <span className="text-[12px] text-slate-400 tabular-nums shrink-0">{new Date(d.date).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                      <div className="shrink-0">{renderStatus(d)}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-[20px] font-bold text-slate-900 tabular-nums leading-tight">{fmt(d.amount)}</div>
                      <div className="flex items-center gap-1.5">
                        {d.proof_image_urls?.length > 0 && <button onClick={() => setViewImage(d.proof_image_urls)} className="e-icon-btn inline-flex items-center justify-center gap-1 w-auto min-w-[40px] h-10 px-2.5 rounded-xl" title="Bill chi"><ImageIcon className="w-4 h-4" />{d.proof_image_urls.length > 1 && <span className="text-[12px] font-semibold">{d.proof_image_urls.length}</span>}</button>}
                        {d.advance_repaid_proof && <button onClick={() => setViewImage(d.advance_repaid_proof)} className="e-icon-btn w-10 h-10 rounded-xl text-success-600" title="Bill hoàn"><CheckCircle className="w-4 h-4" /></button>}
                      </div>
                    </div>
                    {d.description && <div className="text-[13.5px] leading-[1.45] text-slate-600 mt-1.5 whitespace-pre-line break-words">{d.description}</div>}
                    {d.status === 'rejected' && <div className="text-[12.5px] text-danger-600 italic mt-1.5">"{d.reject_reason}"</div>}
                  </div>
                  <div className="px-4 pb-4 flex items-center gap-2.5 empty:hidden">
                    {isAdminOrAccountant && d.status === 'pending' && (
                      <>
                        <button onClick={() => { setSelectedExpense(d); setShowRejectModal(true); }} className="e-btn e-btn-danger-soft h-11 flex-1">Từ chối</button>
                        <button onClick={() => handleApprove(d.id)} className="e-btn e-btn-primary h-11 flex-1">Duyệt</button>
                      </>
                    )}
                    {isAdminOrAccountant && d.status === 'approved' && (
                      <button onClick={() => { setSelectedExpense(d); setRepayForm(prev => ({ ...prev, amount: new Intl.NumberFormat('vi-VN').format(d.amount) })); setShowRepayModal(true); }} className="e-btn e-btn-primary h-11 flex-1">Hoàn ứng</button>
                    )}
                    {isAdminOrAccountant && (
                      <button onClick={() => handleSoftDelete(d)} title="Xoá giao dịch" className="e-icon-btn w-11 h-11 rounded-xl shrink-0 text-slate-400 hover:text-danger-600 hover:border-danger-200 hover:bg-danger-50 ml-auto"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: bảng */}
            <div className="hidden lg:block e-table-wrap">
              <table className="e-table">
                <thead>
                  <tr className="text-left">
                    <th className="text-left">Ngày</th>
                    <th className="text-left">Người YC</th>
                    <th className="text-left">Danh mục</th>
                    <th className="num">Số tiền</th>
                    <th className="text-left">Trạng thái</th>
                    <th className="text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="align-middle">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Đang tải...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Không có dữ liệu</td></tr>
                  ) : data.map(d => (
                    <tr key={d.id} className="transition-colors">
                      <td className="text-slate-600 tabular-nums whitespace-nowrap">
                        {new Date(d.date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <span className="e-avatar w-9 h-9"><UserRound className="w-4 h-4" /></span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{d.profiles?.full_name}</div>
                            <div className="text-[12px] text-slate-400 mt-0.5 max-w-[240px] truncate">{d.description?.substring(0, 30)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap"><span className="e-badge e-badge-sm e-tone-neutral">{CATEGORIES[d.category] || d.category}</span></td>
                      <td className="text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{fmt(d.amount)}</td>
                      <td className="min-w-[150px]">
                        {renderStatus(d)}
                        {d.status === 'rejected' && <div className="text-[12px] text-danger-600 mt-1 italic">"{d.reject_reason}"</div>}
                        {d.status === 'paid' && <div className="text-[12px] text-success-600 mt-1">Đã ck {new Date(d.advance_repaid_at).toLocaleDateString('vi-VN')}</div>}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {d.proof_image_urls?.length > 0 && (
                            <button onClick={() => setViewImage(d.proof_image_urls)} className="e-icon-btn inline-flex items-center justify-center gap-1 w-auto min-w-[34px] h-[34px] px-2 rounded-[10px]" title="Xem bill chi">
                              <ImageIcon className="w-4 h-4" />{d.proof_image_urls.length > 1 && <span className="text-[12px] font-semibold">{d.proof_image_urls.length}</span>}
                            </button>
                          )}
                          {d.advance_repaid_proof && (
                            <button onClick={() => setViewImage(d.advance_repaid_proof)} className="e-icon-btn w-[34px] h-[34px] rounded-[10px] text-success-600" title="Xem bill hoàn">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {isAdminOrAccountant && d.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(d.id)} className="e-btn e-btn-primary e-btn-sm">Duyệt</button>
                              <button onClick={() => { setSelectedExpense(d); setShowRejectModal(true); }} className="e-btn e-btn-danger-soft e-btn-sm">Từ chối</button>
                            </>
                          )}
                          {isAdminOrAccountant && d.status === 'approved' && (
                            <button onClick={() => {
                              setSelectedExpense(d);
                              setRepayForm(prev => ({...prev, amount: new Intl.NumberFormat('vi-VN').format(d.amount)}));
                              setShowRepayModal(true);
                            }} className="e-btn e-btn-primary e-btn-sm">Hoàn ứng</button>
                          )}
                          {isAdminOrAccountant && (
                            <button onClick={() => handleSoftDelete(d)} title="Xoá giao dịch" className="e-icon-btn w-[34px] h-[34px] rounded-[10px] text-slate-400 hover:text-danger-600 hover:border-danger-200 hover:bg-danger-50"><Trash2 className="w-4 h-4" /></button>
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
              if (!staffMap[d.staff_id]) staffMap[d.staff_id] = { staff_id: d.staff_id, name: d.profiles?.full_name, total: 0, repaid: 0, count: 0 };
              staffMap[d.staff_id].count++;
              staffMap[d.staff_id].total += Number(d.amount);
              if (d.status === 'paid') staffMap[d.staff_id].repaid += Number(d.advance_repaid_amount || d.amount);
            }
          });
          const rows = Object.values(staffMap);
          // Chi tiết từng khoản chi của 1 nhân sự
          const StaffDetail = ({ staffId }) => {
            const items = data.filter(d => d.staff_id === staffId && (d.status === 'approved' || d.status === 'paid'));
            return (
              <div className="space-y-2">
                {items.length === 0 ? <div className="text-sm text-slate-400 italic py-2">Không có khoản chi.</div> : items.map(d => (
                  <div key={d.id} className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="e-badge e-badge-sm e-tone-neutral">{CATEGORIES[d.category] || d.category}</span>
                        <span className="text-[12px] text-slate-400 tabular-nums">{new Date(d.date).toLocaleDateString('vi-VN')}</span>
                        <span className={`e-badge e-badge-sm ${d.status === 'paid' ? 'e-tone-success' : 'e-tone-info'}`}>{d.status === 'paid' ? 'Đã hoàn' : 'Đã duyệt'}</span>
                      </div>
                      <div className="text-[13px] text-slate-700 mt-1.5 font-medium">{d.description || <span className="text-slate-400 italic font-normal">(không ghi nội dung)</span>}</div>
                      {d.notes && <div className="text-[12px] text-slate-400 mt-0.5">{d.notes}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 tabular-nums">{fmt(d.amount)}</div>
                      {d.proof_image_urls?.length > 0 && <button onClick={() => setViewImage(d.proof_image_urls)} className="mt-1 text-[12px] font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />{d.proof_image_urls.length} ảnh</button>}
                    </div>
                  </div>
                ))}
              </div>
            );
          };
          return (
            <div className="p-4 lg:p-5 max-lg:px-0">
              <h3 className="e-card-title mb-4">Tổng hợp công nợ theo nhân sự (Tháng {filterMonth})</h3>

              {/* Mobile: thẻ */}
              <div className="lg:hidden space-y-3">
                {rows.length === 0 ? <div className="e-empty text-[13px] text-slate-400">Chưa có dữ liệu</div> : rows.map((s, i) => (
                  <div key={i} className="e-card-flat p-4">
                    <button onClick={() => setExpandedStaff(expandedStaff === s.staff_id ? null : s.staff_id)} className="w-full flex items-center justify-between gap-2 text-left">
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="e-avatar w-10 h-10"><UserRound className="w-5 h-5" /></span>
                        <span className="font-semibold text-[15px] text-slate-900 truncate">{s.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="e-badge e-badge-sm e-tone-neutral">{s.count} phiếu</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedStaff === s.staff_id ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="e-subtle py-2"><div className="text-[11px] text-slate-500">Đã chi</div><div className="font-bold text-slate-900 text-[13px] tabular-nums">{fmt(s.total)}</div></div>
                      <div className="e-subtle py-2"><div className="text-[11px] text-slate-500">Đã hoàn</div><div className="font-bold text-success-600 text-[13px] tabular-nums">{fmt(s.repaid)}</div></div>
                      <div className="e-subtle py-2"><div className="text-[11px] text-slate-500">Còn nợ</div><div className="font-bold text-danger-600 text-[13px] tabular-nums">{fmt(s.total - s.repaid)}</div></div>
                    </div>
                    {expandedStaff === s.staff_id && <div className="mt-3 pt-3 border-t border-slate-100"><StaffDetail staffId={s.staff_id} /></div>}
                  </div>
                ))}
              </div>

              {/* Desktop: bảng */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="e-table">
                  <thead>
                    <tr className="text-left">
                      <th className="text-left">Nhân sự</th>
                      <th className="text-center">Tổng phiếu hợp lệ</th>
                      <th className="num">Đã chi (Tạm ứng)</th>
                      <th className="num">Đã hoàn ứng</th>
                      <th className="num">Còn nợ (Cần hoàn)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s, i) => (
                      <React.Fragment key={i}>
                      <tr onClick={() => setExpandedStaff(expandedStaff === s.staff_id ? null : s.staff_id)} className="cursor-pointer">
                        <td>
                          <span className="inline-flex items-center gap-3">
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedStaff === s.staff_id ? 'rotate-180' : ''}`} />
                            <span className="e-avatar w-9 h-9"><UserRound className="w-4 h-4" /></span>
                            <span className="font-semibold text-slate-900">{s.name}</span>
                          </span>
                        </td>
                        <td className="text-center tabular-nums">{s.count}</td>
                        <td className="text-right font-bold text-slate-900 tabular-nums">{fmt(s.total)}</td>
                        <td className="text-right font-bold text-success-600 tabular-nums">{fmt(s.repaid)}</td>
                        <td className="text-right font-bold text-danger-600 tabular-nums">{fmt(s.total - s.repaid)}</td>
                      </tr>
                      {expandedStaff === s.staff_id && (
                        <tr>
                          <td colSpan={5} className="py-3 bg-slate-50/70">
                            <div className="e-caption mb-2">Chi tiết các khoản chi — {s.name}</div>
                            <StaffDetail staffId={s.staff_id} />
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {isAdminOrAccountant && activeTab === 'stats' && (
          <div className="p-4 lg:p-5 max-lg:px-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="e-card-flat e-card-pad">
              <h3 className="e-card-title mb-4">Tỷ trọng chi tiêu theo danh mục</h3>
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

            <div className="e-card-flat e-card-pad">
              <h3 className="e-card-title mb-4">Thống kê chi tiêu theo nhân sự</h3>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A3ABAA' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => (val / 1000000) + 'M'} width={45} tick={{ fontSize: 12, fill: '#A3ABAA' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(val) => fmt(val)} cursor={{ fill: '#EAF4F4' }} />
                    <Bar dataKey="value" fill="#3CA7A9" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {showTrash && (
        <div className="e-modal-backdrop z-[90] flex items-center justify-center p-4" onClick={() => setShowTrash(false)}>
          <div className="e-modal max-w-2xl max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title flex items-center gap-2"><Trash2 className="w-5 h-5 text-danger-500" /> Lịch sử xoá — {trashData.length} giao dịch</h3>
              <button onClick={() => setShowTrash(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body overflow-y-auto space-y-2">
              {trashLoading ? <div className="e-empty text-[13px] text-slate-400">Đang tải...</div>
                : trashData.length === 0 ? <div className="e-empty text-[13px] text-slate-400">Chưa có giao dịch nào bị xoá.</div>
                  : trashData.map(d => (
                    <div key={d.id} className="rounded-xl border border-slate-200/80 bg-white p-3 flex items-start gap-3">
                      <span className="e-avatar w-10 h-10"><UserRound className="w-5 h-5" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{d.profiles?.full_name}</span>
                          <span className="e-badge e-badge-sm e-tone-neutral">{CATEGORIES[d.category] || d.category}</span>
                          <span className="text-[12px] text-slate-400 tabular-nums">{new Date(d.date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="text-[13px] text-slate-700 mt-1">{d.description || <span className="text-slate-400 italic">(không ghi nội dung)</span>}</div>
                        <div className="text-[12px] text-slate-400 mt-1">Xoá lúc {d.deleted_at ? new Date(d.deleted_at).toLocaleString('vi-VN') : '—'}{d.remover?.full_name ? ` · bởi ${d.remover.full_name}` : ''}</div>
                        {d.proof_image_urls?.length > 0 && <button onClick={() => setViewImage(d.proof_image_urls)} className="mt-1 text-[12px] font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />{d.proof_image_urls.length} ảnh</button>}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <span className="font-bold text-slate-900 tabular-nums">{fmt(d.amount)}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleRestore(d)} className="e-btn e-btn-outline e-btn-sm h-8 px-2.5 text-[12px] gap-1"><RefreshCw className="w-3.5 h-3.5" />Khôi phục</button>
                          {isAdmin && <button onClick={() => handlePermanentDelete(d)} className="e-btn e-btn-danger-soft e-btn-sm h-8 px-2.5 text-[12px] gap-1"><Trash2 className="w-3.5 h-3.5" />Xoá vĩnh viễn</button>}
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}

      {viewImage && (() => { const imgs = Array.isArray(viewImage) ? viewImage : [viewImage]; return (
        <div className="fixed inset-0 bg-slate-900/85 z-[100] flex items-start justify-center p-4 pt-16 overflow-y-auto backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <button onClick={() => setViewImage(null)} className="fixed top-4 right-4 text-white hover:text-slate-300 p-2 z-10"><X className="w-8 h-8" /></button>
          <div className="relative max-w-5xl w-full flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            {imgs.length > 1 && <span className="text-white/80 text-sm font-semibold">{imgs.length} ảnh chứng từ</span>}
            {imgs.map((u, i) => <img key={i} src={u} alt={`Chứng từ ${i + 1}`} className="max-w-full max-h-[85dvh] object-contain rounded-xl shadow-2xl" />)}
          </div>
        </div>
      ); })()}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="e-modal-backdrop z-50 flex items-end lg:items-center justify-center lg:p-4">
          <form onSubmit={handleCreateSubmit} className="e-modal max-w-2xl overflow-hidden flex flex-col max-h-[88dvh] lg:max-h-[90dvh] max-lg:rounded-b-none max-lg:rounded-t-3xl">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2 shrink-0" />
            <div className="e-modal-header items-center shrink-0 max-lg:pt-3 max-lg:px-4">
              <h3 className="e-modal-title">Tạo phiếu tạm ứng chi</h3>
              <button type="button" onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="e-modal-body overflow-y-auto space-y-4 max-lg:px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isAdminOrAccountant && (
                  <div>
                    <label className="e-label">Người yêu cầu *</label>
                    <select required value={form.staff_id} onChange={e => setForm({...form, staff_id: e.target.value})} className="e-input">
                      <option value="">-- Chọn nhân sự --</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="e-label">Ngày chi *</label>
                  <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Danh mục chi *</label>
                  <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="e-input">
                    {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="e-label">Số tiền (VNĐ) *</label>
                  <input required type="text" value={form.amount} onChange={e => setForm({...form, amount: formatCurrencyInput(e.target.value)})} className="e-input font-bold text-[16px] text-slate-900 tabular-nums" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="e-label">Lý do / Mô tả chi tiết *</label>
                <textarea required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="e-textarea h-24 resize-none" placeholder="Nhập chi tiết mục đích chi tiền..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Nơi mua / Nhà cung cấp</label>
                  <input type="text" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})} className="e-input" placeholder="Tên cửa hàng, siêu thị..." />
                </div>
                <div>
                  <label className="e-label">Hình thức thanh toán</label>
                  <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="e-input">
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="e-label">Chứng từ đính kèm (Hóa đơn, bill... — có thể chọn nhiều ảnh)</label>
                <div className="flex flex-wrap gap-2.5">
                  {(form.proofs || []).map((u, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={u} alt="" className="w-full h-full object-cover rounded-xl border border-slate-200" />
                      <button type="button" onClick={() => removeProof(i)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger-500 text-white flex items-center justify-center shadow hover:bg-danger-600"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => !uploadingImage && fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 bg-slate-50 flex flex-col items-center justify-center text-teal-700 gap-1 transition"
                  >
                    {uploadingImage
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><UploadCloud className="w-5 h-5" /><span className="text-[11px] font-semibold">Thêm ảnh</span></>}
                  </button>
                  <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleMultiUpload} />
                </div>
                <p className="text-[12px] text-slate-400 mt-1.5">Có thể chọn nhiều ảnh cùng lúc. JPG, PNG (Max 5MB/ảnh).</p>
              </div>
            </div>

            <div className="e-modal-footer shrink-0 max-lg:rounded-none max-lg:px-4 max-lg:pb-[calc(16px+env(safe-area-inset-bottom))] max-lg:bg-white">
              <button type="button" onClick={() => setShowCreateModal(false)} className="e-btn e-btn-secondary max-lg:h-12 max-lg:flex-1">Hủy</button>
              <button type="submit" disabled={saving || uploadingImage} className="e-btn e-btn-primary max-lg:h-12 max-lg:flex-[2]">Gửi yêu cầu</button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="e-modal-backdrop z-[60] flex items-end lg:items-center justify-center lg:p-4">
          <form onSubmit={handleRejectSubmit} className="e-modal max-w-sm overflow-hidden max-lg:max-w-none max-lg:max-h-[88dvh] max-lg:overflow-y-auto max-lg:rounded-b-none max-lg:rounded-t-3xl">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2" />
            <div className="e-modal-header items-center max-lg:pt-3 max-lg:px-4">
              <h3 className="e-modal-title">Từ chối phiếu tạm ứng</h3>
              <button type="button" onClick={() => setShowRejectModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body space-y-4 max-lg:px-4">
              <p className="text-[13px] text-slate-600">Bạn đang từ chối phiếu trị giá <b>{fmt(selectedExpense?.amount)}</b> của <b>{selectedExpense?.profiles?.full_name}</b>.</p>
              <div>
                <label className="e-label">Lý do từ chối *</label>
                <textarea required value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="e-textarea h-24 resize-none" placeholder="Nhập lý do..." />
              </div>
            </div>
            <div className="e-modal-footer max-lg:rounded-none max-lg:px-4 max-lg:pb-[calc(16px+env(safe-area-inset-bottom))] max-lg:bg-white">
              <button type="button" onClick={() => setShowRejectModal(false)} className="e-btn e-btn-secondary max-lg:h-12 max-lg:flex-1">Huỷ</button>
              <button type="submit" disabled={saving} className="e-btn e-btn-danger max-lg:h-12 max-lg:flex-1">Xác nhận Từ chối</button>
            </div>
          </form>
        </div>
      )}

      {/* Repay Modal */}
      {showRepayModal && (
        <div className="e-modal-backdrop z-[60] flex items-end lg:items-center justify-center lg:p-4">
          <form onSubmit={handleRepaySubmit} className="e-modal max-w-lg overflow-hidden flex flex-col max-lg:max-w-none max-lg:max-h-[88dvh] max-lg:rounded-b-none max-lg:rounded-t-3xl">
            <div className="lg:hidden w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2 shrink-0" />
            <div className="e-modal-header items-center shrink-0 max-lg:pt-3 max-lg:px-4">
              <h3 className="e-modal-title">Ghi nhận hoàn ứng (Thanh toán)</h3>
              <button type="button" onClick={() => setShowRepayModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body space-y-4 overflow-y-auto max-h-[70dvh] max-lg:max-h-none max-lg:flex-1 max-lg:px-4">
              <div>
                <label className="e-label">Chọn phiếu tạm ứng cần hoàn *</label>
                <select 
                  className="e-input font-medium"
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
                  <label className="e-label">Ngày hoàn tiền *</label>
                  <input required type="date" value={repayForm.date} onChange={e => setRepayForm({...repayForm, date: e.target.value})} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Số tiền hoàn (VNĐ) *</label>
                  <input required type="text" value={repayForm.amount} onChange={e => setRepayForm({...repayForm, amount: formatCurrencyInput(e.target.value)})} className="e-input font-bold text-[16px] text-slate-900 tabular-nums" />
                </div>
              </div>
              <div>
                <label className="e-label">Hình thức chuyển</label>
                <select value={repayForm.method} onChange={e => setRepayForm({...repayForm, method: e.target.value})} className="e-input">
                  <option value="transfer">Chuyển khoản</option>
                  <option value="cash">Tiền mặt</option>
                </select>
              </div>
              <div>
                <label className="e-label">Ghi chú</label>
                <textarea value={repayForm.note} onChange={e => setRepayForm({...repayForm, note: e.target.value})} className="e-textarea h-20 resize-none" placeholder="VD: Chuyển khoản Techcombank đợt 1..." />
              </div>
              <div>
                <label className="e-label">Chứng từ (UNC, Phiếu chi...)</label>
                <div onClick={() => !uploadingImage && repayFileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer bg-slate-50 hover:border-teal-400 hover:bg-teal-50/40 transition">
                  <input type="file" accept="image/*" className="hidden" ref={repayFileInputRef} onChange={(e) => handleImageUpload(e, url => setRepayForm({...repayForm, proof: url}))} />
                  {uploadingImage ? <span className="text-teal-600 font-semibold text-sm">Đang tải...</span> : repayForm.proof ? <span className="text-teal-700 font-semibold text-sm flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4"/> Đã tải</span> : <span className="text-teal-600 font-semibold text-sm flex items-center justify-center gap-1"><UploadCloud className="w-4 h-4"/> Click để tải lên</span>}
                </div>
              </div>
            </div>
            <div className="e-modal-footer shrink-0 max-lg:rounded-none max-lg:px-4 max-lg:pb-[calc(16px+env(safe-area-inset-bottom))] max-lg:bg-white">
              <button type="button" onClick={() => setShowRepayModal(false)} className="e-btn e-btn-secondary max-lg:h-12 max-lg:flex-1">Hủy</button>
              <button type="submit" disabled={saving || uploadingImage} className="e-btn e-btn-primary max-lg:h-12 max-lg:flex-[2]">Xác nhận hoàn ứng</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
