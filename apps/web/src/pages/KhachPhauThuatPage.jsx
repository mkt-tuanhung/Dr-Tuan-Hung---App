import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Clock, CheckCircle, X, Edit, ClipboardList, Calendar } from 'lucide-react';

const KhachPhauThuatPage = ({ setActiveTab }) => {
  const [customers, setCustomers] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showNurseModal, setShowNurseModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    activeTab: 'phu_mo',
    surgery_type: 'Tiểu phẫu',
    phu_mo_1_id: '', phu_mo_2_id: '', phu_mo_3_id: '', surgery_notes: '',
    truc_dem_id: '', truc_dem_notes: '',
    hau_phau_id: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    // Fetch apps
    const { data: appsData, error: appsErr } = await supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name)')
      .eq('status', 'phau_thuat')
      .order('surgery_date', { ascending: false });

    // Fetch nurses
    const { data: nursesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'dieu_duong');

    if (appsErr) toast.error('Lỗi tải dữ liệu: ' + appsErr.message);
    else setCustomers(appsData || []);
    
    if (nursesData) setNurses(nursesData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openModal = (app) => {
    setSelectedApp(app);
    setForm({
      activeTab: 'phu_mo',
      surgery_type: app.surgery_type || 'Tiểu phẫu',
      phu_mo_1_id: app.phu_mo_1_id || '',
      phu_mo_2_id: app.phu_mo_2_id || '',
      phu_mo_3_id: app.phu_mo_3_id || '',
      surgery_notes: app.surgery_notes || '',
      truc_dem_id: app.truc_dem_id || '',
      truc_dem_notes: app.truc_dem_notes || '',
      hau_phau_id: app.hau_phau_id || ''
    });
    setShowNurseModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({
        surgery_type: form.surgery_type,
        phu_mo_1_id: form.phu_mo_1_id || null,
        phu_mo_2_id: form.phu_mo_2_id || null,
        phu_mo_3_id: form.phu_mo_3_id || null,
        surgery_notes: form.surgery_notes,
        truc_dem_id: form.truc_dem_id || null,
        truc_dem_notes: form.truc_dem_notes,
        hau_phau_id: form.hau_phau_id || null
      }).eq('id', selectedApp.id);

    if (error) toast.error(error.message);
    else {
      toast.success('Lưu thông tin thành công!');
      setShowNurseModal(false);
      loadData();
    }
    setSaving(false);
    setSaving(false);
  };

  const groupedCustomers = customers.reduce((acc, app) => {
    const date = app.surgery_date 
      ? new Date(app.surgery_date).toLocaleDateString('vi-VN') 
      : 'Không rõ';
    if (!acc[date]) acc[date] = [];
    acc[date].push(app);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Khách Phẫu Thuật</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý lịch mổ và phân công điều dưỡng, hậu phẫu</p>
        </div>
        <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold">
          {customers.length} Khách
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : customers.length === 0 ? (
         <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Không có khách phẫu thuật nào
         </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCustomers).map(([date, apps]) => (
            <div key={date} className="bg-white/50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-purple-800 text-lg">Ngày mổ: {date}</h3>
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full ml-auto">{apps.length} ca</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map(app => {
                  const isAssigned = app.hau_phau_id;
                  return (
                    <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-purple-300 transition-colors">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg">{app.customer_name}</h4>
                          <div className="text-slate-500 text-sm mt-0.5">
                            {app.service}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-0.5">Doanh thu</div>
                          <div className="text-sm font-bold text-purple-600">{Number(app.revenue || 0).toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>

                      {/* Phân công */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Phụ mổ</span>
                          {app.phu_mo_1_id ? <CheckCircle className="w-4 h-4 text-blue-600" /> : <span className="text-xs text-slate-400">-</span>}
                        </div>
                        <div className="bg-orange-50/50 p-2 rounded-xl border border-orange-100/50 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Trực đêm</span>
                          {app.truc_dem_id ? <CheckCircle className="w-4 h-4 text-orange-600" /> : <span className="text-xs text-slate-400">-</span>}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-auto flex gap-2 pt-2">
                        {isAssigned ? (
                          <>
                            <button onClick={() => openModal(app)} className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl transition-colors border border-slate-200">
                              <Edit className="w-3.5 h-3.5" /> Sửa ca
                            </button>
                            <button onClick={() => setActiveTab && setActiveTab('hau_phau')} className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl transition-colors border border-emerald-200">
                              <ClipboardList className="w-3.5 h-3.5" /> Hậu phẫu
                            </button>
                          </>
                        ) : (
                          <button onClick={() => openModal(app)} className="w-full flex justify-center items-center gap-1.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-bold rounded-xl transition-colors border border-purple-200 shadow-sm">
                            <ClipboardList className="w-4 h-4" /> Đăng ký Phân công
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Phân công Điều dưỡng */}
      {showNurseModal && selectedApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800">Phân công điều dưỡng: {selectedApp.customer_name}</h3>
              <button type="button" onClick={() => setShowNurseModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            
            <div className="flex bg-white border-b shrink-0 px-6 pt-2">
              <button type="button" onClick={() => setForm({...form, activeTab: 'phu_mo'})} className={`px-4 py-3 font-semibold text-sm border-b-2 ${form.activeTab === 'phu_mo' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Phụ mổ</button>
              <button type="button" onClick={() => setForm({...form, activeTab: 'truc_dem'})} className={`px-4 py-3 font-semibold text-sm border-b-2 ${form.activeTab === 'truc_dem' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Trực đêm</button>
              <button type="button" onClick={() => setForm({...form, activeTab: 'hau_phau'})} className={`px-4 py-3 font-semibold text-sm border-b-2 ${form.activeTab === 'hau_phau' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Chăm hậu phẫu</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {form.activeTab === 'phu_mo' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Loại phẫu thuật (Dùng tính lương)</label>
                    <select value={form.surgery_type} onChange={e => setForm({...form, surgery_type: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option>Tiểu phẫu</option>
                      <option>Đại phẫu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Phụ mổ 1</label>
                    <select value={form.phu_mo_1_id} onChange={e => setForm({...form, phu_mo_1_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Phụ mổ 2 (Nếu có)</label>
                    <select value={form.phu_mo_2_id} onChange={e => setForm({...form, phu_mo_2_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Phụ mổ 3 (Nếu có)</label>
                    <select value={form.phu_mo_3_id} onChange={e => setForm({...form, phu_mo_3_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Ghi chú phụ mổ</label>
                    <textarea rows={2} value={form.surgery_notes} onChange={e => setForm({...form, surgery_notes: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500 resize-none" placeholder="Ghi chú thêm..." />
                  </div>
                </>
              )}

              {form.activeTab === 'truc_dem' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Người trực đêm</label>
                    <select value={form.truc_dem_id} onChange={e => setForm({...form, truc_dem_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Ghi chú trực đêm</label>
                    <textarea rows={3} value={form.truc_dem_notes} onChange={e => setForm({...form, truc_dem_notes: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500 resize-none" placeholder="Yêu cầu theo dõi huyết áp..." />
                  </div>
                </>
              )}

              {form.activeTab === 'hau_phau' && (
                <>
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800 text-sm mb-4">
                     Khách hàng sẽ được chuyển vào <strong>Module Hậu phẫu</strong> sau khi bạn gán nhân sự phụ trách tại đây.
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Người chăm sóc hậu phẫu</label>
                    <select value={form.hau_phau_id} onChange={e => setForm({...form, hau_phau_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700">{saving ? 'Đang lưu...' : 'Lưu Phân Công'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default KhachPhauThuatPage;
