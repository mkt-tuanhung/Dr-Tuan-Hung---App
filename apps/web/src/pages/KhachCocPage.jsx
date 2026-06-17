import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Calendar, FileText, ArrowUpCircle, RotateCcw, X, MessageCircle, AlertCircle, Clock, Phone } from 'lucide-react';

const CARE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang chăm sóc', label: 'Đang chăm sóc' },
  { id: 'Đã xét nghiệm xong', label: 'Đã xét nghiệm xong' },
  { id: 'Chờ lịch bác sĩ', label: 'Chờ lịch bác sĩ' },
  { id: 'Khách xin hoãn', label: 'Khách xin hoãn' }
];

const KhachCocPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Modals state
  const [selectedApp, setSelectedApp] = useState(null);
  const [showCareModal, setShowCareModal] = useState(false);
  const [showBongModal, setShowBongModal] = useState(false);
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [careForm, setCareForm] = useState({ care_status: 'Đang chăm sóc', care_notes: '' });
  const [bongForm, setBongForm] = useState({ notes: '' });
  const [surgeryForm, setSurgeryForm] = useState({ 
    expected_surgery_date: '', revenue: '', upsale_revenue: '', service: '',
    service_group: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới' 
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*, telesale:profiles!telesale_id(full_name), sale:profiles!sale_id(full_name)')
      .eq('status', 'coc')
      .order('expected_surgery_date', { ascending: true });

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  // Handle Move to Bong
  const handleBongSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({ 
        status: 'bong', 
        notes: (selectedApp.notes || '') + `\n[Hủy cọc] ${bongForm.notes}`
      }).eq('id', selectedApp.id);
      
    if (error) toast.error(error.message);
    else { toast.success('Khách đã được chuyển về danh sách Bong!'); setShowBongModal(false); loadData(); }
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
  const openBong = (app) => { setSelectedApp(app); setBongForm({ notes: '' }); setShowBongModal(true); };
  const openSurgery = (app) => { 
    setSelectedApp(app); 
    setSurgeryForm({ 
      expected_surgery_date: app.expected_surgery_date || new Date().toISOString().split('T')[0], 
      revenue: app.deposit_amount || '', upsale_revenue: '', service: app.service || '',
      service_group: app.service_group || 'Tiểu phẫu',
      customer_source: app.customer_source || 'Ads',
      customer_type: app.customer_type || 'Mới'
    }); 
    setShowSurgeryModal(true); 
  };

  const filteredCustomers = activeTab === 'all' ? customers : customers.filter(c => (c.care_status || 'Đang chăm sóc') === activeTab);

  const groupedCustomers = filteredCustomers.reduce((acc, app) => {
    const date = app.expected_surgery_date 
      ? new Date(app.expected_surgery_date).toLocaleDateString('vi-VN') 
      : 'Chưa xếp lịch';
    if (!acc[date]) acc[date] = [];
    acc[date].push(app);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Khách Cọc (Mini-CRM)</h2>
          <p className="text-slate-500 text-sm mt-1">Chăm sóc khách đã cọc chờ ngày phẫu thuật</p>
        </div>
        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold">
          {customers.length} Khách
        </div>
      </div>

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
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : filteredCustomers.length === 0 ? (
         <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Không có khách hàng nào trong mục này
         </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCustomers).map(([date, apps]) => (
            <div key={date} className="bg-white/50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-blue-800 text-lg">{date}</h3>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full ml-auto">{apps.length} khách</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map(app => (
                  <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-blue-300 transition-colors">
                    {/* Header: Name + Status */}
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
                      <div className="text-slate-500 text-xs">Dịch vụ:</div>
                      <div className="font-semibold text-slate-800 text-right truncate">{app.service || 'Chưa chọn'}</div>
                      <div className="text-slate-500 text-xs">Đã cọc:</div>
                      <div className="font-bold text-blue-600 text-right">{Number(app.deposit_amount||0).toLocaleString('vi-VN')}đ</div>
                      <div className="text-slate-500 text-xs">Telesale:</div>
                      <div className="text-slate-700 text-right truncate">{app.telesale?.full_name || 'N/A'}</div>
                      <div className="text-slate-500 text-xs">Sale:</div>
                      <div className="text-slate-700 text-right truncate">{app.sale?.full_name || 'N/A'}</div>
                    </div>

                    {/* Note Box */}
                    {app.care_notes && (
                      <div className="mt-auto mb-3 text-xs text-slate-500 bg-yellow-50/50 p-2.5 rounded-lg border border-yellow-100/50 max-h-20 overflow-y-auto whitespace-pre-wrap">
                        {app.care_notes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                      <button onClick={() => openCare(app)} className="flex flex-col items-center justify-center gap-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Ghi chú</span>
                      </button>
                      <button onClick={() => openSurgery(app)} className="flex flex-col items-center justify-center gap-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors">
                        <ArrowUpCircle className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Lên PT</span>
                      </button>
                      <button onClick={() => openBong(app)} className="flex flex-col items-center justify-center gap-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Hủy cọc</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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

      {/* Modal 2: Hủy Cọc */}
      {showBongModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleBongSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-800">Hủy cọc: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowBongModal(false)}><X className="w-5 h-5 text-red-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Lý do khách hủy cọc / không làm</label>
                <input required type="text" value={bongForm.notes} onChange={e => setBongForm({...bongForm, notes: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-red-500" placeholder="Kẹt tiền, gia đình không cho..." />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700">{saving ? 'Đang lưu...' : 'Xác nhận hủy cọc'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: Lên Phẫu Thuật */}
      {showSurgeryModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSurgerySubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-emerald-800">Lên Phẫu Thuật: {selectedApp?.customer_name}</h3>
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

export default KhachCocPage;
