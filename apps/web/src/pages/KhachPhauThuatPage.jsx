import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Clock, CheckCircle, X, Edit, ClipboardList } from 'lucide-react';

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
  };

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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-6 py-3.5 font-medium">Khách hàng</th>
                <th className="px-6 py-3.5 font-medium">Ngày PT</th>
                <th className="px-6 py-3.5 font-medium">Dịch vụ</th>
                <th className="px-6 py-3.5 font-medium">Phân công điều dưỡng</th>
                <th className="px-6 py-3.5 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers.map(app => {
                const isAssigned = app.hau_phau_id;
                return (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{app.customer_name}</td>
                    <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {app.surgery_date ? new Date(app.surgery_date).toLocaleDateString('vi-VN') : ''}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">{app.service}</div>
                      <div className="text-xs text-purple-600 font-semibold">{Number(app.revenue || 0).toLocaleString('vi-VN')} đ</div>
                    </td>
                    <td className="px-6 py-4">
                       {app.phu_mo_1_id ? <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded mr-1">Đã xếp phụ mổ</span> : null}
                       {app.truc_dem_id ? <span className="inline-block px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded mr-1">Đã xếp trực đêm</span> : null}
                       {!app.phu_mo_1_id && !app.truc_dem_id && <span className="text-slate-400 text-xs">Chưa phân công</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAssigned ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setActiveTab && setActiveTab('hau_phau')} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200 w-32">
                            <ClipboardList className="w-3.5 h-3.5" /> Xem hậu phẫu
                          </button>
                          <button onClick={() => openModal(app)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => openModal(app)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 font-semibold text-xs rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 ml-auto w-36">
                          <CheckCircle className="w-3.5 h-3.5" /> Đăng ký điều dưỡng
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
