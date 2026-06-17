import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Clock, MessageCircle, X, CheckCircle, Calendar, Phone, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang theo dõi', label: 'Đang theo dõi' },
  { id: 'Tái khám', label: 'Tái khám' },
  { id: 'Đã ổn định', label: 'Đã ổn định' },
  { id: 'Có biến chứng', label: 'Có biến chứng' }
];

const HauPhauPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [saving, setSaving] = useState(false);
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
    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*, hau_phau:profiles!hau_phau_id(full_name)')
      .eq('status', 'phau_thuat')
      .not('hau_phau_id', 'is', null)
      .order('surgery_date', { ascending: false });

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  const filteredCustomers = activeTab === 'all' ? customers : customers.filter(c => (c.post_op_status || 'Đang theo dõi') === activeTab);

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
            <a key={i} href={imgMatch[1]} target="_blank" rel="noreferrer" className="block mt-1.5 mb-2">
              <img src={imgMatch[1]} alt="attachment" className="max-h-28 rounded-lg border border-slate-200 shadow-sm object-cover" />
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      });

      elements.push(<div key={`line-${index}`} className="mb-0.5">{lineContent}</div>);
    });
    
    return elements;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Chăm sóc Hậu phẫu</h2>
          <p className="text-slate-500 text-sm mt-1">Theo dõi sức khỏe và phản hồi khách hàng sau mổ</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold">
          {customers.length} Khách
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
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
                      <div className="text-slate-700 text-right truncate">{app.hau_phau?.full_name || 'N/A'}</div>
                    </div>

                    {/* Note Box */}
                    {app.post_op_notes && (
                      <div className="mt-auto mb-3 text-xs text-slate-600 bg-yellow-50/50 p-3 rounded-lg border border-yellow-200/50 max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {renderNotes(app.post_op_notes)}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-auto pt-2">
                      <button onClick={() => openNote(app)} className="w-full flex justify-center items-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl transition-colors border border-slate-200">
                        <MessageCircle className="w-4 h-4" /> Cập nhật tình trạng & Ghi chú
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
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
    </div>
  );
};

export default HauPhauPage;
