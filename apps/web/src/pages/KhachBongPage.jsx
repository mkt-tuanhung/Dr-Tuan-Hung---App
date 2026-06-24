import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Calendar, FileText, Edit3, ArrowUpCircle, RotateCcw, X, MessageCircle, Phone } from 'lucide-react';

const CARE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang chăm sóc', label: 'Đang chăm sóc' },
  { id: 'Đã quay lại tư vấn', label: 'Đã quay lại tư vấn' },
  { id: 'Đã làm dịch vụ bên khác', label: 'Làm nơi khác' },
  { id: 'Hủy hẳn', label: 'Hủy hẳn' }
];

const KhachBongPage = ({ isNested = false }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Modals state
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailApp, setDetailApp] = useState(null);
  const [showCareModal, setShowCareModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [careForm, setCareForm] = useState({ care_status: 'Đang chăm sóc', care_notes: '' });
  const [revertForm, setRevertForm] = useState({ appointment_date: '', appointment_time: '09:00', notes: '' });
  const [surgeryForm, setSurgeryForm] = useState({ 
    expected_surgery_date: '', revenue: '', upsale_revenue: '', service: '',
    service_group: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới' 
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*, telesale:profiles!telesale_id(full_name), sale:profiles!sale_id(full_name)')
      .eq('status', 'bong')
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments', loadData);

  // Handle Care Update
  const handleCareSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const newNote = careForm.care_notes ? `\n[${new Date().toLocaleDateString('vi-VN')}] ${careForm.care_notes}` : '';
    const updatedNotes = (selectedApp.care_notes || '') + newNote;

    const { error } = await supabase.from('customer_appointments')
      .update({ care_status: careForm.care_status, care_notes: updatedNotes })
      .eq('id', selectedApp.id);
      
    if (error) toast.error(error.message);
    else { toast.success('Cập nhật tiến trình thành công!'); setShowCareModal(false); loadData(); }
    setSaving(false);
  };

  // Handle Revert to Scheduled
  const handleRevertSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({ 
        status: 'scheduled', 
        appointment_date: revertForm.appointment_date, 
        appointment_time: revertForm.appointment_time,
        notes: (selectedApp.notes || '') + `\n[Hẹn lại] ${revertForm.notes}`
      }).eq('id', selectedApp.id);
      
    if (error) toast.error(error.message);
    else { toast.success('Khách đã được chuyển về Lịch Hẹn!'); setShowRevertModal(false); loadData(); }
    setSaving(false);
  };

  // Handle Move to Surgery
  const handleSurgerySubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({ 
        status: 'phau_thuat', 
        surgery_date: surgeryForm.expected_surgery_date,
        expected_surgery_date: surgeryForm.expected_surgery_date,
        revenue: surgeryForm.revenue,
        upsale_revenue: surgeryForm.upsale_revenue || 0,
        service: surgeryForm.service,
        service_group: surgeryForm.service_group,
        customer_source: surgeryForm.customer_source,
        customer_type: surgeryForm.customer_type
      }).eq('id', selectedApp.id);
      
    if (error) toast.error(error.message);
    else { toast.success('Khách đã được chuyển sang Phẫu Thuật!'); setShowSurgeryModal(false); loadData(); }
    setSaving(false);
  };

  const openCare = (app) => { setSelectedApp(app); setCareForm({ care_status: app.care_status || 'Đang chăm sóc', care_notes: '' }); setShowCareModal(true); };
  const openRevert = (app) => { setSelectedApp(app); setRevertForm({ appointment_date: new Date().toISOString().split('T')[0], appointment_time: '09:00', notes: '' }); setShowRevertModal(true); };
  const openSurgery = (app) => { 
    setSelectedApp(app); 
    setSurgeryForm({ 
      expected_surgery_date: app.expected_surgery_date || new Date().toISOString().split('T')[0], 
      revenue: app.expected_bill || '', upsale_revenue: '', service: app.service || '',
      service_group: app.service_group || 'Tiểu phẫu',
      customer_source: app.customer_source || 'Ads',
      customer_type: app.customer_type || 'Mới'
    }); 
    setShowSurgeryModal(true); 
  };

  const filteredCustomers = activeTab === 'all' ? customers : customers.filter(c => (c.care_status || 'Đang chăm sóc') === activeTab);

  const groupedCustomers = filteredCustomers.reduce((acc, app) => {
    const date = app.updated_at 
      ? new Date(app.updated_at).toLocaleDateString('vi-VN') 
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
      const match = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4})\]/);
      if (match) {
        const date = match[1];
        if (date !== currentDate) {
          currentDate = date;
          elements.push(
            <div key={`date-${index}`} className="font-extrabold text-teal-700 text-[13px] mt-3 mb-1 uppercase tracking-wide border-b border-teal-100 pb-0.5 inline-block">
              CẬP NHẬT {date} :
            </div>
          );
        }
      }
      
      elements.push(<div key={`line-${index}`} className="mb-0.5">{line}</div>);
    });
    
    return elements;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      <div className="flex-1 min-w-0 space-y-6 w-full">
      {!isNested && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Khách Bong (Mini-CRM)</h2>
            <p className="text-slate-500 text-sm mt-1">Chăm sóc khách hàng rớt và điều hướng trạng thái</p>
          </div>
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold">
            {customers.length} Khách
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {CARE_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" /></div>
      ) : filteredCustomers.length === 0 ? (
         <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Không có khách hàng nào trong mục này
         </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCustomers).map(([date, apps]) => (
            <div key={date} className="bg-white/50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Calendar className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-800 text-lg">Cập nhật: {date}</h3>
                <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full ml-auto">{apps.length} khách</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map(app => (
                  <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-red-300 transition-colors">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{app.customer_name}</h4>
                        <div className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {app.phone}
                        </div>
                      </div>
                      <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg text-xs border border-teal-100 whitespace-nowrap">
                        {app.care_status || 'Đang chăm sóc'}
                      </span>
                    </div>

                    {/* Compact Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm bg-slate-50 p-3 rounded-xl">
                      <div className="text-slate-500 text-xs">Lý do rớt:</div>
                      <div className="font-semibold text-red-600 text-right truncate">{app.notes || 'Không rõ'}</div>
                      <div className="text-slate-500 text-xs">Telesale:</div>
                      <div className="text-slate-700 text-right truncate">{app.telesale?.full_name || 'N/A'}</div>
                      <div className="text-slate-500 text-xs">Sale:</div>
                      <div className="text-slate-700 text-right truncate">{app.sale?.full_name || 'N/A'}</div>
                    </div>

                    {/* Note Box */}
                    {app.care_notes && (
                      <div className="mt-auto mb-4 relative">
                        <div className="text-xs text-slate-600 bg-yellow-50/50 p-3 pb-8 rounded-lg border border-yellow-200/50 max-h-36 overflow-hidden whitespace-pre-wrap relative">
                          {renderNotes(app.care_notes)}
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
                    <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                      <button onClick={() => openCare(app)} className="flex flex-col items-center justify-center gap-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Ghi chú</span>
                      </button>
                      <button onClick={() => openRevert(app)} className="flex flex-col items-center justify-center gap-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors">
                        <RotateCcw className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Quay lại</span>
                      </button>
                      <button onClick={() => openSurgery(app)} className="flex flex-col items-center justify-center gap-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors">
                        <ArrowUpCircle className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Chốt PT</span>
                      </button>
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
                {renderNotes(detailApp.care_notes)}
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
              {renderNotes(detailApp.care_notes)}
            </div>
          </div>
        </>
      )}

      {/* Modal 1: Cập nhật chăm sóc */}
      {showCareModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCareSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Tiến trình CSKH: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowCareModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Trạng thái hiện tại</label>
                <select value={careForm.care_status} onChange={e => setCareForm({...careForm, care_status: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                  {CARE_TABS.filter(t => t.id !== 'all').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Ghi chú cuộc gọi / tin nhắn mới nhất</label>
                <textarea required rows={4} value={careForm.care_notes} onChange={e => setCareForm({...careForm, care_notes: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 resize-none" placeholder="Ví dụ: Khách bảo qua tuần mới lãnh lương..." />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700">{saving ? 'Đang lưu...' : 'Lưu lại'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Chuyển lại Lịch Hẹn */}
      {showRevertModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRevertSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-blue-800">Đặt Lịch Hẹn Mới: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowRevertModal(false)}><X className="w-5 h-5 text-blue-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Ngày hẹn</label>
                  <input required type="date" value={revertForm.appointment_date} onChange={e => setRevertForm({...revertForm, appointment_date: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Giờ hẹn</label>
                  <input required type="time" value={revertForm.appointment_time} onChange={e => setRevertForm({...revertForm, appointment_time: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Ghi chú cho ca hẹn này</label>
                <input required type="text" value={revertForm.notes} onChange={e => setRevertForm({...revertForm, notes: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" placeholder="Khách hẹn tới kiểm tra lại..." />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">{saving ? 'Đang lưu...' : 'Xác nhận tạo lịch'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: Chốt Phẫu Thuật */}
      {showSurgeryModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSurgerySubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-emerald-800">Chốt Phẫu Thuật: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowSurgeryModal(false)}><X className="w-5 h-5 text-emerald-400" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Ngày phẫu thuật</label>
                  <input required type="date" value={surgeryForm.expected_surgery_date} onChange={e => setSurgeryForm({...surgeryForm, expected_surgery_date: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Dịch vụ thực tế làm</label>
                  <input required type="text" value={surgeryForm.service} onChange={e => setSurgeryForm({...surgeryForm, service: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500" placeholder="Nâng mũi..." />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Nhóm dịch vụ</label>
                  <select value={surgeryForm.service_group} onChange={e => setSurgeryForm({...surgeryForm, service_group: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                    <option value="Hàm mặt">Hàm mặt</option>
                    <option value="Body">Body</option>
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nguồn khách</label>
                  <select value={surgeryForm.customer_source} onChange={e => setSurgeryForm({...surgeryForm, customer_source: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                    <option value="Ads">Ads</option>
                    <option value="CTV">CTV</option>
                    <option value="Người quen">Người quen</option>
                    <option value="CSKH">CSKH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tệp khách</label>
                  <select value={surgeryForm.customer_type} onChange={e => setSurgeryForm({...surgeryForm, customer_type: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                    <option value="Mới">Khách Mới</option>
                    <option value="Cũ">Khách Cũ</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Doanh thu (VNĐ)</label>
                  <input required type="number" value={surgeryForm.revenue} onChange={e => setSurgeryForm({...surgeryForm, revenue: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Upsale (VNĐ)</label>
                  <input type="number" value={surgeryForm.upsale_revenue} onChange={e => setSurgeryForm({...surgeryForm, upsale_revenue: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500" placeholder="0" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700">{saving ? 'Đang lưu...' : 'Hoàn tất & Chuyển module'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default KhachBongPage;
