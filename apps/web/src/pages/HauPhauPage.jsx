import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Clock, MessageCircle, X, CheckCircle } from 'lucide-react';

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
  const [form, setForm] = useState({ post_op_status: 'Đang theo dõi', post_op_notes: '' });

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
      post_op_notes: ''
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
      toast.success('Cập nhật chăm sóc hậu phẫu thành công!'); 
      setShowNoteModal(false); 
      loadData(); 
    }
    setSaving(false);
  };

  const filteredCustomers = activeTab === 'all' ? customers : customers.filter(c => (c.post_op_status || 'Đang theo dõi') === activeTab);

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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-6 py-3.5 font-medium w-64">Khách hàng</th>
                <th className="px-6 py-3.5 font-medium">Chi tiết phẫu thuật</th>
                <th className="px-6 py-3.5 font-medium">Tiến trình phục hồi</th>
                <th className="px-6 py-3.5 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.map(app => (
                <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{app.customer_name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{app.phone}</div>
                    <div className="text-xs text-slate-400 mt-1">Phụ trách: {app.hau_phau?.full_name || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-purple-700 bg-purple-50 inline-block px-2 py-0.5 rounded-lg mb-1">{app.service || 'Chưa rõ'}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Mổ: {app.surgery_date ? new Date(app.surgery_date).toLocaleDateString('vi-VN') : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-xs border border-emerald-100">
                      {app.post_op_status || 'Đang theo dõi'}
                    </span>
                    <div className="mt-2 text-xs text-slate-500 max-h-20 overflow-y-auto whitespace-pre-wrap p-2 bg-slate-50 rounded border">
                      {app.post_op_notes || 'Chưa có ghi chú'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openNote(app)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-200 transition-colors border border-slate-200">
                      <MessageCircle className="w-3.5 h-3.5" /> Ghi chú chăm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <div>
                <label className="block text-sm font-semibold mb-2">Ghi chú theo dõi</label>
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
