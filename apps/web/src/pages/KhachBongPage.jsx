import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Calendar, ArrowUpCircle, RotateCcw, X, MessageCircle, Phone, ChevronLeft } from 'lucide-react';
import ConsultButton from '@/components/ConsultButton.jsx';
import MoneyInput from '@/components/MoneyInput.jsx';

const CARE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang chăm sóc', label: 'Đang chăm sóc' },
  { id: 'Đã quay lại tư vấn', label: 'Đã quay lại tư vấn' },
  { id: 'Đã làm dịch vụ bên khác', label: 'Làm nơi khác' },
  { id: 'Hủy hẳn', label: 'Hủy hẳn' }
];

const STATUS_STYLE = {
  'Đang chăm sóc': 'bg-amber-100 text-amber-700 border-amber-200',
  'Đã quay lại tư vấn': 'bg-blue-100 text-blue-700 border-blue-200',
  'Đã làm dịch vụ bên khác': 'bg-slate-100 text-slate-600 border-slate-200',
  'Hủy hẳn': 'bg-red-100 text-red-700 border-red-200',
};

const QUICK_NOTES = [
  'Đã gọi, không nghe máy', 'Hẹn gọi lại sau', 'Khách đang cân nhắc', 'Khách hẹn qua tư vấn',
  'Đã nhắn Zalo', 'Khách báo bận', 'Chưa đủ tài chính', 'Quan tâm dịch vụ khác',
];

const KhachBongPage = ({ isNested = false }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Trang chăm sóc riêng + modal hành động
  const [careApp, setCareApp] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
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

    if (error) toast.error('Lỗi tải dữ liệu: ' + error.message);
    else setCustomers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments', loadData);

  // Đồng bộ trang chăm sóc với dữ liệu mới
  useEffect(() => {
    if (!careApp) return;
    const fresh = customers.find(c => c.id === careApp.id);
    if (fresh) setCareApp(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const addQuickNote = (text) => setCareForm(f => ({ ...f, care_notes: f.care_notes + (f.care_notes ? '\n' : '') + text }));

  const handleCareSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const newNote = careForm.care_notes ? `\n[${new Date().toLocaleDateString('vi-VN')}] ${careForm.care_notes}` : '';
    const updatedNotes = (careApp.care_notes || '') + newNote;

    const { error } = await supabase.from('customer_appointments')
      .update({ care_status: careForm.care_status, care_notes: updatedNotes })
      .eq('id', careApp.id);

    if (error) toast.error(error.message);
    else {
      toast.success('Đã lưu mốc chăm sóc!');
      setCareApp(prev => prev ? { ...prev, care_status: careForm.care_status, care_notes: updatedNotes } : prev);
      setCareForm(f => ({ ...f, care_notes: '' }));
      loadData();
    }
    setSaving(false);
  };

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
    else { toast.success('Khách đã được chuyển về Lịch Hẹn!'); setShowRevertModal(false); setCareApp(null); loadData(); }
    setSaving(false);
  };

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
    else { toast.success('Khách đã được chuyển sang Phẫu Thuật!'); setShowSurgeryModal(false); setCareApp(null); loadData(); }
    setSaving(false);
  };

  const openCare = (app) => { setCareApp(app); setSelectedApp(app); setCareForm({ care_status: app.care_status || 'Đang chăm sóc', care_notes: '' }); };
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
    const date = app.updated_at ? new Date(app.updated_at).toLocaleDateString('vi-VN') : 'Không rõ';
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
    <div className="w-full">
      {careApp ? (
        /* ===== TRANG CHĂM SÓC RIÊNG ===== */
        <form onSubmit={handleCareSubmit} className="max-w-3xl mx-auto space-y-4 pb-10">
          <button type="button" onClick={() => setCareApp(null)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold">
            <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
          </button>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-800">{careApp.customer_name}</h2>
                <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Phone className="w-4 h-4" /> {careApp.phone}</div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${STATUS_STYLE[careApp.care_status || 'Đang chăm sóc']}`}>
                {careApp.care_status || 'Đang chăm sóc'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm bg-slate-50 p-3 rounded-xl">
              <div className="text-slate-500 text-xs">Lý do rớt</div>
              <div className="font-semibold text-red-600 text-right">{careApp.notes || '—'}</div>
              <div className="text-slate-500 text-xs">Telesale</div>
              <div className="text-slate-700 text-right">{careApp.telesale?.full_name || 'N/A'}</div>
              <div className="text-slate-500 text-xs">Sale</div>
              <div className="text-slate-700 text-right">{careApp.sale?.full_name || 'N/A'}</div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <ConsultButton app={careApp} />
              <button type="button" onClick={() => openRevert(careApp)} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <RotateCcw className="w-4 h-4" /> Quay lại lịch hẹn
              </button>
              <button type="button" onClick={() => openSurgery(careApp)} className="flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
                <ArrowUpCircle className="w-4 h-4" /> Chốt phẫu thuật
              </button>
            </div>
          </div>

          {/* Nhật ký CSKH */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-teal-600" /> Nhật ký chăm sóc</h3>
            <div className="text-sm text-slate-700 max-h-[40vh] overflow-y-auto pr-1">
              {careApp.care_notes ? renderNotes(careApp.care_notes) : <div className="text-slate-400 text-center py-6">Chưa có ghi chú nào — thêm mốc đầu tiên bên dưới</div>}
            </div>
          </div>

          {/* Thêm mốc */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-slate-800">Thêm mốc chăm sóc</h3>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-600">Cập nhật trạng thái</label>
              <div className="flex flex-wrap gap-2">
                {CARE_TABS.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} type="button" onClick={() => setCareForm({ ...careForm, care_status: t.id })}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${careForm.care_status === t.id ? STATUS_STYLE[t.id] + ' ring-2 ring-offset-1 ring-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_NOTES.map(q => (
                <button key={q} type="button" onClick={() => addQuickNote(q)}
                  className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-100 hover:bg-teal-100">
                  + {q}
                </button>
              ))}
            </div>
            <textarea rows={3} value={careForm.care_notes} onChange={e => setCareForm({ ...careForm, care_notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 resize-none text-sm" placeholder="Gõ ghi chú hoặc chạm thẻ nhanh phía trên..." />
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700">{saving ? 'Đang lưu...' : 'Lưu mốc'}</button>
            </div>
          </div>
        </form>
      ) : (
        /* ===== DANH SÁCH ===== */
        <div className="space-y-6 w-full">
          {!isNested && (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Khách Bong (Mini-CRM)</h2>
                <p className="text-slate-500 text-sm mt-1">Chăm sóc khách hàng rớt và điều hướng trạng thái</p>
              </div>
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold">{customers.length} Khách</div>
            </div>
          )}

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
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">Không có khách hàng nào trong mục này</div>
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
                    {apps.map(app => {
                      const st = app.care_status || 'Đang chăm sóc';
                      const noteCount = app.care_notes ? app.care_notes.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
                      return (
                        <button key={app.id} type="button" onClick={() => openCare(app)}
                          className="text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-red-400 hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 text-lg truncate">{app.customer_name}</h4>
                              <div className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {app.phone}</div>
                            </div>
                            <span className={`font-semibold px-2 py-1 rounded-lg text-xs border whitespace-nowrap shrink-0 ${STATUS_STYLE[st]}`}>{st}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm bg-slate-50 p-3 rounded-xl">
                            <div className="text-slate-500 text-xs">Lý do rớt:</div>
                            <div className="font-semibold text-red-600 text-right truncate">{app.notes || 'Không rõ'}</div>
                            <div className="text-slate-500 text-xs">Telesale:</div>
                            <div className="text-slate-700 text-right truncate">{app.telesale?.full_name || 'N/A'}</div>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-1 text-sm">
                            <span className="text-slate-400 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> {noteCount} mốc</span>
                            <span className="text-red-600 font-semibold">Mở nhật ký →</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Chuyển lại Lịch Hẹn */}
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
                  <input required type="date" value={revertForm.appointment_date} onChange={e => setRevertForm({ ...revertForm, appointment_date: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Giờ hẹn</label>
                  <input required type="time" value={revertForm.appointment_time} onChange={e => setRevertForm({ ...revertForm, appointment_time: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Ghi chú cho ca hẹn này</label>
                <input required type="text" value={revertForm.notes} onChange={e => setRevertForm({ ...revertForm, notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" placeholder="Khách hẹn tới kiểm tra lại..." />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">{saving ? 'Đang lưu...' : 'Xác nhận tạo lịch'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Chốt Phẫu Thuật */}
      {showSurgeryModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSurgerySubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-teal-50">
              <h3 className="font-bold text-teal-800">Chốt Phẫu Thuật: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowSurgeryModal(false)}><X className="w-5 h-5 text-teal-400" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Ngày phẫu thuật</label>
                  <input required type="date" value={surgeryForm.expected_surgery_date} onChange={e => setSurgeryForm({ ...surgeryForm, expected_surgery_date: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Dịch vụ thực tế làm</label>
                  <input required type="text" value={surgeryForm.service} onChange={e => setSurgeryForm({ ...surgeryForm, service: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="Nâng mũi..." />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Nhóm dịch vụ</label>
                  <select value={surgeryForm.service_group} onChange={e => setSurgeryForm({ ...surgeryForm, service_group: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                    <option value="Hàm mặt">Hàm mặt</option>
                    <option value="Body">Body</option>
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nguồn khách</label>
                  <select value={surgeryForm.customer_source} onChange={e => setSurgeryForm({ ...surgeryForm, customer_source: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                    <option value="Ads">Ads</option>
                    <option value="CTV">CTV</option>
                    <option value="Người quen">Người quen</option>
                    <option value="CSKH">CSKH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tệp khách</label>
                  <select value={surgeryForm.customer_type} onChange={e => setSurgeryForm({ ...surgeryForm, customer_type: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                    <option value="Mới">Khách Mới</option>
                    <option value="Cũ">Khách Cũ</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Doanh thu (VNĐ)</label>
                  <MoneyInput required value={surgeryForm.revenue} onChange={v => setSurgeryForm({ ...surgeryForm, revenue: v })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Upsale (VNĐ)</label>
                  <MoneyInput value={surgeryForm.upsale_revenue} onChange={v => setSurgeryForm({ ...surgeryForm, upsale_revenue: v })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="0" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700">{saving ? 'Đang lưu...' : 'Hoàn tất & Chuyển module'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default KhachBongPage;
