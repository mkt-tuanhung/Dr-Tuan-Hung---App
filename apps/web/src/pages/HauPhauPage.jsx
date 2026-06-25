import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Clock, MessageCircle, X, CheckCircle, Calendar, Phone, Image as ImageIcon, Loader2, Search, UserPlus, Plus, ChevronLeft } from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';
import { useAuth } from '@/contexts/AuthContext.jsx';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang theo dõi', label: 'Đang theo dõi' },
  { id: 'Tái khám', label: 'Tái khám' },
  { id: 'Đã ổn định', label: 'Đã ổn định' },
  { id: 'Có biến chứng', label: 'Có biến chứng' }
];

// Màu cho chip trạng thái
const STATUS_STYLE = {
  'Đang theo dõi': 'bg-amber-100 text-amber-700 border-amber-200',
  'Tái khám': 'bg-blue-100 text-blue-700 border-blue-200',
  'Đã ổn định': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Có biến chứng': 'bg-red-100 text-red-700 border-red-200',
};

// Thẻ ghi chú nhanh theo mốc chăm sóc hậu phẫu
const QUICK_NOTES = [
  'Vết thương khô, sạch', 'Đã cắt chỉ', 'Hết sưng nề', 'Ăn ngủ tốt',
  'Còn sưng nhẹ', 'Đã thay băng', 'Uống thuốc đầy đủ', 'Ổn định, bình thường',
  'Hẹn tái khám', 'Có dấu hiệu bất thường',
];

const HauPhauPage = () => {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [mainTab, setMainTab] = useState('hau_phau'); // 'hau_phau' (<1 tháng) | 'cskh' (≥1 tháng)
  const [searchQuery, setSearchQuery] = useState('');

  const isHeadNurse = profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận';
  const isAdmin = profile?.role === 'admin';
  const isCskh = profile?.role === 'cskh' || profile?.role_2 === 'cskh';
  const canSeeAll = isAdmin || isHeadNurse || isCskh;

  // Trang chăm sóc riêng (full-page) + modal phân công
  const [careApp, setCareApp] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ id: null, additional_hau_phau_ids: [] });
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [form, setForm] = useState({ post_op_status: 'Đang theo dõi', post_op_notes: '', recheck_date: new Date().toISOString().split('T')[0], recheck_time: '09:00' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadToR2(file, 'hau-phau');
      setForm(prev => ({ ...prev, post_op_notes: prev.post_op_notes + (prev.post_op_notes ? '\n' : '') + `[Ảnh đính kèm: ${url}]` }));
      toast.success('Đã tải ảnh lên!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [appointmentsRes, nursesRes] = await Promise.all([
      supabase
        .from('customer_appointments')
        .select('*, hau_phau:profiles!hau_phau_id(full_name)')
        .eq('status', 'phau_thuat')
        .order('surgery_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['dieu_duong', 'admin'])
    ]);

    if (appointmentsRes.error) {
      toast.error('Lỗi tải dữ liệu: ' + appointmentsRes.error.message);
    } else {
      let data = appointmentsRes.data || [];
      // Chỉ đẩy sang Hậu phẫu/CSKH khi đã phân công điều dưỡng trực hậu phẫu
      data = data.filter(d => d.hau_phau_id);
      // Điều dưỡng thường chỉ thấy ca được phân công; admin/trưởng bp/CSKH thấy tất cả
      if (!canSeeAll && profile?.id) {
         data = data.filter(d => d.hau_phau_id === profile.id || (d.additional_hau_phau_ids && d.additional_hau_phau_ids.includes(profile.id)));
      }
      setCustomers(data);
    }

    if (nursesRes.data) {
      setNurses(nursesRes.data);
    }
    setLoading(false);
  }, [profile, canSeeAll]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments', loadData);

  const openCare = (app) => {
    setSelectedApp(app);
    setCareApp(app);
    setForm({
      post_op_status: app.post_op_status || 'Đang theo dõi',
      post_op_notes: '',
      recheck_date: new Date().toISOString().split('T')[0],
      recheck_time: '09:00'
    });
  };

  useEffect(() => {
    const focusId = sessionStorage.getItem('focusHauPhauId');
    if (focusId && customers.length > 0) {
      const app = customers.find(c => c.id === focusId);
      if (app) {
        openCare(app);
        sessionStorage.removeItem('focusHauPhauId');
      }
    }
  }, [customers]);

  // Đồng bộ trang chăm sóc với dữ liệu mới (khi loadData/realtime cập nhật)
  useEffect(() => {
    if (!careApp) return;
    const fresh = customers.find(c => c.id === careApp.id);
    if (fresh) setCareApp(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const addQuickNote = (text) => setForm(f => ({ ...f, post_op_notes: f.post_op_notes + (f.post_op_notes ? '\n' : '') + text }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const newNote = form.post_op_notes ? `\n[${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}] ${form.post_op_notes}` : '';
    const updatedNotes = (selectedApp.post_op_notes || '') + newNote;

    const { error } = await supabase.from('customer_appointments')
      .update({ post_op_status: form.post_op_status, post_op_notes: updatedNotes })
      .eq('id', selectedApp.id);
      
    if (error) toast.error(error.message);
    else { 
      if (form.post_op_status === 'Tái khám') {
        const { error: insertError } = await supabase.from('customer_appointments').insert({
          customer_name: selectedApp.customer_name,
          phone: selectedApp.phone,
          appointment_date: form.recheck_date,
          appointment_time: form.recheck_time,
          service: `[Tái khám] ${selectedApp.service || 'Hậu phẫu'}`,
          test_status: 'Không cần',
          expected_bill: 0,
          deposit_amount: 0,
          telesale_id: null,
          sale_id: selectedApp.sale_id || selectedApp.hau_phau_id || null,
          surgery_date: selectedApp.surgery_date,
          customer_source: 'CSKH',
          customer_type: 'Cũ',
          status: 'scheduled',
          notes: `[Lịch sử chăm sóc Hậu Phẫu]${updatedNotes}`,
        });
        if (insertError) {
          toast.error('Lỗi khi tạo lịch hẹn tái khám: ' + insertError.message);
        } else {
          toast.success('Đã tự động tạo Lịch Tái Khám!');
        }
      }
      toast.success('Đã lưu mốc chăm sóc!');
      setCareApp(prev => prev ? { ...prev, post_op_status: form.post_op_status, post_op_notes: updatedNotes } : prev);
      setForm(f => ({ ...f, post_op_notes: '' }));
      loadData();
    }
    setSaving(false);
  };

  const handleAssignMoreSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNurseId) {
      toast.error('Vui lòng chọn nhân sự!');
      return;
    }
    
    if (assignForm.additional_hau_phau_ids.includes(selectedNurseId)) {
      toast.error('Nhân sự này đã được phân công từ trước!');
      return;
    }

    setSaving(true);
    try {
      const newIds = [...assignForm.additional_hau_phau_ids, selectedNurseId];
      const { error } = await supabase
        .from('customer_appointments')
        .update({ additional_hau_phau_ids: newIds })
        .eq('id', assignForm.id);

      if (error) throw error;
      toast.success('Phân công thêm thành công!');
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      toast.error('Lỗi phân công: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Phân loại theo tuổi ca mổ: <1 tháng = Hậu phẫu, ≥1 tháng = CSKH
  const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const isOldCase = (c) => c.surgery_date && new Date(c.surgery_date) < oneMonthAgo;
  const mainTabCustomers = customers.filter(c => mainTab === 'cskh' ? isOldCase(c) : !isOldCase(c));
  const hauPhauCount = customers.filter(c => !isOldCase(c)).length;
  const cskhCount = customers.filter(c => isOldCase(c)).length;

  let filteredCustomers = activeTab === 'all' ? mainTabCustomers : mainTabCustomers.filter(c => (c.post_op_status || 'Đang theo dõi') === activeTab);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredCustomers = filteredCustomers.filter(c => 
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) || 
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }

  const groupedCustomers = filteredCustomers.reduce((acc, app) => {
    const date = app.surgery_date 
      ? new Date(app.surgery_date).toLocaleDateString('vi-VN') 
      : 'Không rõ';
    if (!acc[date]) acc[date] = [];
    acc[date].push(app);
    return acc;
  }, {});

  const renderNotes = (notesString) => {
    if (!notesString) return null;
    const lines = notesString.split('\n').filter(l => l.trim() !== '');
    let currentDate = null;
    const elements = [];
    
    lines.forEach((line, index) => {
      const match = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\]/);
      if (match) {
        const date = match[1];
        if (date !== currentDate) {
          currentDate = date;
          elements.push(
            <div key={`date-${index}`} className="font-extrabold text-teal-700 text-[13px] mt-3 mb-1 uppercase tracking-wide border-b border-teal-100 pb-0.5 inline-block">
              NGÀY {date} :
            </div>
          );
        }
      }
      
      const parts = line.split(/(\[Ảnh đính kèm:\s*https?:\/\/[^\s\]]+\])/g);
      const lineContent = parts.map((part, i) => {
        const imgMatch = part.match(/\[Ảnh đính kèm:\s*(https?:\/\/[^\s\]]+)\]/);
        if (imgMatch) {
          return (
            <div key={i} onClick={() => setViewImage(imgMatch[1])} className="inline-block mt-1.5 mb-2 cursor-pointer">
              <img src={imgMatch[1]} alt="attachment" className="max-h-28 rounded-lg border border-slate-200 shadow-sm object-cover hover:opacity-90 transition-opacity" />
            </div>
          );
        }
        return <span key={i}>{part}</span>;
      });

      elements.push(<div key={`line-${index}`} className="mb-0.5">{lineContent}</div>);
    });
    
    return elements;
  };

  // ===== TRANG CHĂM SÓC RIÊNG (full-page) =====
  if (careApp) {
    const st = form.post_op_status;
    const addNurses = (careApp.additional_hau_phau_ids || []).map(id => nurses.find(n => n.id === id)?.full_name || id);
    return (
      <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-4 pb-32">
        <button type="button" onClick={() => setCareApp(null)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold">
          <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
        </button>

        {/* Thông tin khách */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-800">{careApp.customer_name}</h2>
              <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Phone className="w-4 h-4" /> {careApp.phone}</div>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${STATUS_STYLE[careApp.post_op_status || 'Đang theo dõi']}`}>
              {careApp.post_op_status || 'Đang theo dõi'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm bg-slate-50 p-3 rounded-xl">
            <div className="text-slate-500 text-xs">Dịch vụ</div>
            <div className="font-semibold text-slate-800 text-right">{careApp.service || '—'}</div>
            <div className="text-slate-500 text-xs">Ngày mổ</div>
            <div className="text-slate-700 text-right">{careApp.surgery_date ? new Date(careApp.surgery_date).toLocaleDateString('vi-VN') : '—'}</div>
            <div className="text-slate-500 text-xs">Phụ trách</div>
            <div className="text-slate-700 text-right">{careApp.hau_phau?.full_name || 'N/A'}{addNurses.length > 0 && <span className="text-xs text-slate-400"> + {addNurses.join(', ')}</span>}</div>
          </div>
          {canSeeAll && (
            <button type="button" onClick={() => { setAssignForm({ id: careApp.id, additional_hau_phau_ids: careApp.additional_hau_phau_ids || [] }); setSelectedNurseId(''); setShowAssignModal(true); }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              <UserPlus className="w-4 h-4" /> Phân công thêm điều dưỡng
            </button>
          )}
        </div>

        {/* Nhật ký theo dõi (thread) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-600" /> Nhật ký theo dõi</h3>
          <div className="text-sm text-slate-700 max-h-[40vh] overflow-y-auto pr-1">
            {careApp.post_op_notes ? renderNotes(careApp.post_op_notes) : <div className="text-slate-400 text-center py-6">Chưa có ghi chú nào — thêm mốc đầu tiên bên dưới</div>}
          </div>
        </div>

        {/* Thêm mốc mới */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-slate-800">Thêm mốc chăm sóc</h3>
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-600">Cập nhật trạng thái</label>
            <div className="flex flex-wrap gap-2">
              {TABS.filter(t => t.id !== 'all').map(t => (
                <button key={t.id} type="button" onClick={() => setForm({ ...form, post_op_status: t.id })}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${st === t.id ? STATUS_STYLE[t.id] + ' ring-2 ring-offset-1 ring-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {st === 'Tái khám' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100">
              <div>
                <label className="block text-xs font-semibold mb-1 text-blue-800">Ngày tái khám</label>
                <input type="date" required value={form.recheck_date} onChange={e => setForm({ ...form, recheck_date: e.target.value })} className="w-full border border-blue-200 p-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-blue-800">Giờ hẹn</label>
                <input type="time" required value={form.recheck_time} onChange={e => setForm({ ...form, recheck_time: e.target.value })} className="w-full border border-blue-200 p-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {QUICK_NOTES.map(q => (
              <button key={q} type="button" onClick={() => addQuickNote(q)}
                className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100 hover:bg-emerald-100">
                + {q}
              </button>
            ))}
          </div>
          <textarea rows={3} value={form.post_op_notes} onChange={e => setForm({ ...form, post_op_notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 resize-none text-sm" placeholder="Gõ ghi chú hoặc chạm thẻ nhanh phía trên..." />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border border-emerald-100">
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Thêm ảnh
            </button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700">{saving ? 'Đang lưu...' : 'Lưu mốc'}</button>
          </div>
        </div>

        {/* Modal phân công + xem ảnh dùng chung (render dưới) */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Phân công thêm Điều dưỡng</h3>
                <button type="button" onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-semibold mb-2">Chọn nhân sự Điều dưỡng</label>
                <select value={selectedNurseId} onChange={e => setSelectedNurseId(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                  <option value="">-- Chọn Điều dưỡng --</option>
                  {nurses.filter(n => n.role === 'dieu_duong' && !assignForm.additional_hau_phau_ids.includes(n.id)).map(n => (
                    <option key={n.id} value={n.id}>{n.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button type="button" onClick={handleAssignMoreSubmit} disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">{saving ? 'Đang lưu...' : 'Lưu phân công'}</button>
              </div>
            </div>
          </div>
        )}
        {viewImage && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
            <img src={viewImage} alt="" className="max-w-full max-h-[88vh] rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      <div className="flex-1 min-w-0 space-y-6 w-full">
        <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{mainTab === 'cskh' ? 'Chăm sóc khách hàng (CSKH)' : 'Chăm sóc Hậu phẫu'}</h2>
          <p className="text-slate-500 text-sm mt-1">{mainTab === 'cskh' ? 'Khách đã mổ trên 1 tháng — CSKH tiếp quản chăm sóc' : 'Khách mổ trong vòng 1 tháng — theo dõi sau mổ'}</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold">
          {mainTabCustomers.length} Khách
        </div>
      </div>

      {/* Main tabs: Hậu phẫu / CSKH */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-fit">
        <button onClick={() => { setMainTab('hau_phau'); setActiveTab('all'); }}
          className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mainTab === 'hau_phau' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
          Hậu phẫu (&lt;1 tháng) · {hauPhauCount}
        </button>
        <button onClick={() => { setMainTab('cskh'); setActiveTab('all'); }}
          className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mainTab === 'cskh' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
          CSKH (≥1 tháng) · {cskhCount}
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Tìm tên KH hoặc số điện thoại..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : filteredCustomers.length === 0 ? (
         <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Không có khách hàng hậu phẫu nào trong mục này
         </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCustomers).map(([date, apps]) => (
            <div key={date} className="bg-white/50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-emerald-800 text-lg">Mổ ngày: {date}</h3>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full ml-auto">{apps.length} khách</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map(app => {
                  const st = app.post_op_status || 'Đang theo dõi';
                  const noteCount = app.post_op_notes ? app.post_op_notes.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
                  return (
                  <button key={app.id} type="button" onClick={() => openCare(app)}
                    className="text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-emerald-400 hover:shadow-md transition-all">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-lg truncate">{app.customer_name}</h4>
                        <div className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {app.phone}
                        </div>
                      </div>
                      <span className={`font-semibold px-2 py-1 rounded-lg text-xs border whitespace-nowrap shrink-0 ${STATUS_STYLE[st] || STATUS_STYLE['Đang theo dõi']}`}>
                        {st}
                      </span>
                    </div>

                    {/* Compact Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm bg-slate-50 p-3 rounded-xl">
                      <div className="text-slate-500 text-xs">Dịch vụ:</div>
                      <div className="font-semibold text-slate-800 text-right truncate">{app.service || 'Chưa rõ'}</div>
                      <div className="text-slate-500 text-xs">Phụ trách:</div>
                      <div className="text-slate-700 text-right truncate">{app.hau_phau?.full_name || 'N/A'}</div>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-1 text-sm">
                      <span className="text-slate-400 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> {noteCount} mốc ghi chú</span>
                      <span className="text-emerald-600 font-semibold">Mở nhật ký →</span>
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </div> {/* End main content */}


      {/* Modal Phân công thêm */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAssignMoreSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 text-lg">Phân công thêm Điều dưỡng</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold mb-2">Chọn nhân sự Điều dưỡng</label>
              <select required value={selectedNurseId} onChange={e => setSelectedNurseId(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                <option value="">-- Chọn Điều dưỡng --</option>
                {nurses.filter(n => n.role === 'dieu_duong' && !assignForm.additional_hau_phau_ids.includes(n.id)).map(n => (
                  <option key={n.id} value={n.id}>{n.full_name}</option>
                ))}
              </select>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">{saving ? 'Đang lưu...' : 'Lưu phân công'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <div className="relative max-w-5xl w-full flex justify-center">
            <button onClick={() => setViewImage(null)} className="absolute -top-12 right-0 md:-right-12 text-white hover:text-slate-300 p-2">
              <X className="w-8 h-8" />
            </button>
            <img src={viewImage} alt="Phóng to" className="max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HauPhauPage;
