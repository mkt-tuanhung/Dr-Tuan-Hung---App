import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Clock, MessageCircle, X, CheckCircle, Calendar, Phone, Image as ImageIcon, Loader2, Search, UserPlus, Plus } from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';
import { useAuth } from '@/contexts/AuthContext.jsx';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang theo dõi', label: 'Đang theo dõi' },
  { id: 'Tái khám', label: 'Tái khám' },
  { id: 'Đã ổn định', label: 'Đã ổn định' },
  { id: 'Có biến chứng', label: 'Có biến chứng' }
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

  // Modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ id: null, additional_hau_phau_ids: [] });
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailApp, setDetailApp] = useState(null);
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

  const openNote = (app) => {
    setSelectedApp(app);
    setForm({
      post_op_status: app.post_op_status || 'Đang theo dõi',
      post_op_notes: '',
      recheck_date: new Date().toISOString().split('T')[0],
      recheck_time: '09:00'
    });
    setShowNoteModal(true);
  };

  useEffect(() => {
    const focusId = sessionStorage.getItem('focusHauPhauId');
    if (focusId && customers.length > 0) {
      const app = customers.find(c => c.id === focusId);
      if (app) {
        setDetailApp(app);
        setActiveTab('all');
        sessionStorage.removeItem('focusHauPhauId');
      }
    }
  }, [customers]);

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
      toast.success('Cập nhật chăm sóc hậu phẫu thành công!'); 
      setShowNoteModal(false); 
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
                {apps.map(app => (
                  <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-emerald-300 transition-colors">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{app.customer_name}</h4>
                        <div className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {app.phone}
                        </div>
                      </div>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-xs border border-emerald-100 whitespace-nowrap">
                        {app.post_op_status || 'Đang theo dõi'}
                      </span>
                    </div>

                    {/* Compact Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm bg-slate-50 p-3 rounded-xl">
                      <div className="text-slate-500 text-xs">Dịch vụ:</div>
                      <div className="font-semibold text-slate-800 text-right truncate">{app.service || 'Chưa rõ'}</div>
                      <div className="text-slate-500 text-xs">Phụ trách hậu phẫu:</div>
                      <div className="text-slate-700 text-right">
                        <div>{app.hau_phau?.full_name || 'N/A'}</div>
                        {app.additional_hau_phau_ids && app.additional_hau_phau_ids.length > 0 && (
                           <div className="text-xs text-slate-500 mt-1">
                             + {app.additional_hau_phau_ids.map(id => nurses.find(n => n.id === id)?.full_name || id).join(', ')}
                           </div>
                        )}
                      </div>
                    </div>

                    {/* Note Box */}
                    {app.post_op_notes && (
                      <div className="mt-auto mb-4 relative">
                        <div className="text-xs text-slate-600 bg-yellow-50/50 p-3 pb-8 rounded-lg border border-yellow-200/50 max-h-36 overflow-hidden whitespace-pre-wrap relative">
                          {renderNotes(app.post_op_notes)}
                          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#fefce8] to-transparent pointer-events-none rounded-b-lg"></div>
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                          <button onClick={() => setDetailApp(app)} className="text-blue-600 text-[11px] font-bold bg-white px-4 py-1.5 rounded-full shadow-md hover:bg-slate-50 transition-colors border border-slate-100 flex items-center gap-1 z-10">
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-auto pt-2 flex gap-2">
                      <button onClick={() => openNote(app)} className="flex-1 flex justify-center items-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl transition-colors border border-slate-200">
                        <MessageCircle className="w-4 h-4" /> Ghi chú
                      </button>
                      {canSeeAll && (
                        <button onClick={() => {
                          setAssignForm({ id: app.id, additional_hau_phau_ids: app.additional_hau_phau_ids || [] });
                          setSelectedNurseId('');
                          setShowAssignModal(true);
                        }} className="w-10 h-10 flex shrink-0 justify-center items-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors border border-blue-200" title="Phân công thêm">
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </div> {/* End main content */}

      {/* Panel Xem Chi tiết Ghi chú (Desktop + Mobile) */}
      {detailApp && (
        <>
          {/* Mobile Modal */}
          <div className="lg:hidden fixed inset-0 bg-slate-900/50 z-[60] flex items-end p-4 backdrop-blur-sm transition-opacity" onClick={() => setDetailApp(null)}>
            <div className="bg-white w-full rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 truncate pr-2">Chi tiết Ghi chú - {detailApp.customer_name}</h3>
                <button onClick={() => setDetailApp(null)} className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 bg-yellow-50/30">
                {renderNotes(detailApp.post_op_notes)}
              </div>
            </div>
          </div>

          {/* Desktop Panel */}
          <div className="hidden lg:flex flex-col lg:w-[320px] xl:w-[380px] shrink-0 sticky top-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 3rem)' }}>
            <div className="px-4 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 truncate pr-2" title={detailApp.customer_name}>
                Ghi chú: {detailApp.customer_name}
              </h3>
              <button onClick={() => setDetailApp(null)} className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 bg-yellow-50/30">
              {renderNotes(detailApp.post_op_notes)}
            </div>
          </div>
        </>
      )}

      {/* Modal Cập nhật (Ghi chú mới) */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800">Cập nhật hậu phẫu: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowNoteModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Tình trạng hiện tại</label>
                <select value={form.post_op_status} onChange={e => setForm({...form, post_op_status: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                  {TABS.filter(t => t.id !== 'all').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>

              {form.post_op_status === 'Tái khám' && (
                <div className="grid grid-cols-2 gap-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-emerald-800">Ngày hẹn tái khám</label>
                    <input type="date" required value={form.recheck_date} onChange={e => setForm({...form, recheck_date: e.target.value})} className="w-full border border-emerald-200 p-2.5 rounded-xl outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-emerald-800">Giờ hẹn</label>
                    <input type="time" required value={form.recheck_time} onChange={e => setForm({...form, recheck_time: e.target.value})} className="w-full border border-emerald-200 p-2.5 rounded-xl outline-none focus:border-emerald-500" />
                  </div>
                </div>
              )}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-semibold">Ghi chú theo dõi</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors border border-emerald-100">
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Thêm ảnh
                  </button>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                </div>
                <textarea required rows={4} value={form.post_op_notes} onChange={e => setForm({...form, post_op_notes: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 resize-none" placeholder="Vết thương khô, đã cắt chỉ..." />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700">{saving ? 'Đang lưu...' : 'Lưu lại'}</button>
            </div>
          </form>
        </div>
      )}

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
