import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Clock, CheckCircle, X, Edit, ClipboardList, Calendar, Banknote, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';

const KhachPhauThuatPage = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const isAdminOrAccountant = ['admin', 'accountant'].includes(profile?.role);

  const [customers, setCustomers] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Phân công
  const [showNurseModal, setShowNurseModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [saving, setSaving] = useState(false);

  // Modal Viện phí
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ amount: '', method: 'cash', proof: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef(null);

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

  const openFeeModal = (app) => {
    setSelectedApp(app);
    setFeeForm({ amount: '', method: 'cash', proof: '' });
    setShowFeeModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadToR2(file, 'vien-phi');
      setFeeForm(prev => ({ ...prev, proof: url }));
      toast.success('Đã tải ảnh lên!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveFee = async (e) => {
    e.preventDefault();
    if (!feeForm.amount) return toast.error('Vui lòng nhập số tiền');
    
    setSaving(true);
    const numericAmount = parseInt(feeForm.amount.replace(/\./g, ''), 10);
    
    const { error } = await supabase.from('customer_appointments')
      .update({
        hospital_fee: numericAmount,
        hospital_fee_method: feeForm.method,
        hospital_fee_proof: feeForm.proof || null,
        hospital_fee_date: new Date().toISOString()
      }).eq('id', selectedApp.id);

    if (error) toast.error(error.message);
    else {
      toast.success('Nhập viện phí thành công!');
      setShowFeeModal(false);
      loadData();
    }
    setSaving(false);
  };

  const formatCurrencyInput = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    return new Intl.NumberFormat('vi-VN').format(numbers);
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
                      <div className="mt-auto flex flex-col gap-2 pt-2">
                        <div className="flex gap-2">
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
                        
                        {/* Nhập viện phí */}
                        {isAdminOrAccountant && (
                          <div className="pt-1">
                            {app.hospital_fee ? (
                              <div className="w-full flex justify-center items-center py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-200">
                                <CheckCircle className="w-4 h-4 mr-1.5" /> Đã nhập viện phí
                              </div>
                            ) : (
                              <button onClick={() => openFeeModal(app)} className="w-full flex justify-center items-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
                                <Banknote className="w-4 h-4" /> Nhập viện phí
                              </button>
                            )}
                          </div>
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
            
            <div className="p-6 bg-slate-50 shrink-0 rounded-b-2xl">
              <button type="submit" disabled={saving} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu phân công'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nhập Viện Phí */}
      {showFeeModal && selectedApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveFee} className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50 shrink-0">
              <h3 className="font-bold text-blue-800">Nhập viện phí</h3>
              <button type="button" onClick={() => setShowFeeModal(false)}><X className="w-5 h-5 text-blue-400" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Số tiền viện phí (VNĐ)</label>
                <input required type="text" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: formatCurrencyInput(e.target.value)})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 font-bold text-blue-700 text-lg" placeholder="1.000.000" />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Hình thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFeeForm({...feeForm, method: 'transfer'})} className={`py-2 border rounded-xl font-bold text-sm ${feeForm.method === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'text-slate-500 border-slate-200'}`}>Chuyển khoản</button>
                  <button type="button" onClick={() => setFeeForm({...feeForm, method: 'cash'})} className={`py-2 border rounded-xl font-bold text-sm ${feeForm.method === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-slate-500 border-slate-200'}`}>Tiền mặt</button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Hoá đơn / Bill</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors border border-blue-100">
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} {feeForm.proof ? 'Đổi ảnh' : 'Tải ảnh lên'}
                  </button>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                </div>
                {feeForm.proof && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200">
                    <img src={feeForm.proof} alt="Bill" className="w-full h-auto object-cover max-h-40" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50 shrink-0 border-t border-slate-100">
              <button type="submit" disabled={saving || uploadingImage} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Xác nhận thu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default KhachPhauThuatPage;
