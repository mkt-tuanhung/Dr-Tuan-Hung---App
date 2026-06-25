import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { 
  ClipboardList, Edit, CheckCircle, Search, Save, Calendar as CalendarIcon, Phone,
  Clock, Activity, Banknote, UserCheck, ShieldCheck, X, Image as ImageIcon, PackageOpen, Plus, Trash2, Loader2, Ban
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import ConsultButton from '@/components/ConsultButton.jsx';
import { uploadToR2 } from '@/lib/r2Client';

const KhachPhauThuatPage = ({ setActiveTab }) => {
  const { profile } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Phân công
  const [showNurseModal, setShowNurseModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [assignForm, setAssignForm] = useState({ phu_mo_1_id: '', truc_dem_id: '', hau_phau_id: '' });
  const [accessDeniedInfo, setAccessDeniedInfo] = useState(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ amount: '', method: 'cash', proof: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef(null);
  const [saving, setSaving] = useState(false);

  // Modal Vật tư
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [consumedItems, setConsumedItems] = useState([]);
  const [materialForm, setMaterialForm] = useState([]); // [{ item_id, quantity }]

  const [form, setForm] = useState({
    activeTab: 'phu_mo',
    surgery_type: 'Tiểu phẫu',
    phu_mo_1_id: '', phu_mo_2_id: '', phu_mo_3_id: '', surgery_notes: '',
    truc_dem_id: '', truc_dem_id_2: '', truc_dem_notes: '',
    hau_phau_id: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: appsData, error: appsErr } = await supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name), telesale:telesale_id(full_name), sale:sale_id(full_name)')
      .eq('status', 'phau_thuat')
      .order('surgery_date', { ascending: false });

    const { data: nursesData } = await supabase.from('profiles').select('*').in('role', ['dieu_duong', 'admin']);

    const appIds = appsData ? appsData.map(a => a.id) : [];
    let consumedSet = new Set();
    if (appIds.length > 0) {
      const { data: transData } = await supabase
        .from('inventory_transactions')
        .select('reference_id')
        .in('reference_id', appIds)
        .eq('type', 'export');
      if (transData) transData.forEach(t => consumedSet.add(t.reference_id));
    }

    if (appsErr) toast.error('Lỗi tải dữ liệu: ' + appsErr.message);
    else {
      const enhancedApps = (appsData || []).map(a => ({ ...a, has_materials: consumedSet.has(a.id) }));
      setCustomers(enhancedApps);
    }
    
    if (nursesData) setNurses(nursesData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments,inventory_transactions,inventory_items', loadData);

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
      truc_dem_id_2: app.truc_dem_id_2 || '',
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
        truc_dem_id_2: form.truc_dem_id_2 || null,
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

  const handleGoToHauPhau = (app) => {
    const isAdmin = profile?.role === 'admin';
    const isHeadNurse = profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận';
    const isAssignedToMe = app.hau_phau_id === profile?.id || (app.additional_hau_phau_ids && app.additional_hau_phau_ids.includes(profile?.id));
    
    if (isAdmin || isHeadNurse || isAssignedToMe) {
      if (setActiveTab) {
        sessionStorage.setItem('focusHauPhauId', app.id);
        setActiveTab('hau_phau');
      }
    } else {
      const mainNurse = nurses.find(n => n.id === app.hau_phau_id)?.full_name || 'chưa phân công';
      setAccessDeniedInfo({
        customerName: app.customer_name,
        nurseName: mainNurse
      });
    }
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
      toast.error('Có lỗi xảy ra: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- LOGIC VẬT TƯ TIÊU HAO ---
  const openMaterialModal = async (app) => {
    setSelectedApp(app);
    setMaterialForm([]);
    setLoading(true);
    
    // Load inventory catalog
    const { data: itemsData } = await supabase.from('inventory_items').select('*').order('name');
    if (itemsData) setInventoryItems(itemsData);

    // Load consumed items
    const { data: consumedData } = await supabase.from('inventory_transactions')
      .select('*, inventory_items(name, unit)')
      .eq('reference_id', app.id)
      .eq('type', 'export');
    if (consumedData) setConsumedItems(consumedData);
    
    setLoading(false);
    setShowMaterialModal(true);
  };

  const handleAddMaterialRow = () => {
    setMaterialForm([...materialForm, { item_id: '', quantity: 1 }]);
  };

  const handleRemoveMaterialRow = (index) => {
    setMaterialForm(materialForm.filter((_, i) => i !== index));
  };

  const handleUpdateMaterialRow = (index, field, value) => {
    const newForm = [...materialForm];
    newForm[index][field] = value;
    setMaterialForm(newForm);
  };

  const handleSaveMaterials = async () => {
    const validRows = materialForm.filter(r => r.item_id && r.quantity > 0);
    if (validRows.length === 0) return toast.error('Vui lòng nhập vật tư hợp lệ');
    setSaving(true);

    const today = new Date().toISOString().split('T')[0];
    const inserts = validRows.map(r => ({
      item_id: r.item_id,
      type: 'export',
      quantity: r.quantity,
      date: today,
      reference_id: selectedApp.id,
      notes: `Xuất cho KH: ${selectedApp.customer_name}`,
      created_by: profile.id
    }));

    const { error } = await supabase.from('inventory_transactions').insert(inserts);
    if (error) toast.error('Lỗi: ' + error.message);
    else {
      toast.success('Đã lưu vật tư tiêu hao!');
      setShowMaterialModal(false);
      loadData();
    }
    setSaving(false);
  };

  const handleSaveFee = async () => {
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

  let filteredCustomers = customers;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Khách Phẫu Thuật</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý lịch mổ và phân công điều dưỡng, hậu phẫu</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Tìm tên KH hoặc số điện thoại..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
          <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold whitespace-nowrap hidden sm:block">
            {filteredCustomers.length} Khách
          </div>
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
                <CalendarIcon className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-purple-800 text-lg">Ngày mổ: {date}</h3>
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full ml-auto">{apps.length} ca</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map(app => {
                  const isAssigned = app.hau_phau_id;
                  return (
                    <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col hover:border-purple-300 transition-colors">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg">{app.customer_name}</h4>
                          <div className="text-slate-500 text-sm mt-0.5">{app.service}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-0.5">Doanh thu</div>
                          <div className="text-sm font-bold text-purple-600">{Number(app.revenue || 0).toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-3 text-xs bg-slate-50 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Telesale</div>
                          <div className="font-semibold text-blue-700 truncate">{app.telesale?.full_name || '—'}</div>
                        </div>
                        <div className="min-w-0 text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Sale Offline</div>
                          <div className="font-semibold text-violet-700 truncate">{app.sale?.full_name || '—'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                        <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Phụ mổ</span>
                          {app.phu_mo_1_id ? <CheckCircle className="w-4 h-4 text-blue-600" /> : <span className="text-xs text-slate-400">-</span>}
                        </div>
                        <div className="bg-orange-50/50 p-2 rounded-xl border border-orange-100/50 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Trực đêm</span>
                          {(app.truc_dem_id || app.truc_dem_id_2) ? <CheckCircle className="w-4 h-4 text-orange-600" /> : <span className="text-xs text-slate-400">-</span>}
                        </div>
                      </div>

                      <div className="mt-auto flex flex-col gap-2 pt-2">
                        <div className="flex gap-2">
                          {isAssigned ? (
                            <>
                              {(profile?.role === 'admin' || (profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận')) && (
                                <button onClick={() => openModal(app)} className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl transition-colors border border-slate-200">
                                  <Edit className="w-3.5 h-3.5" /> Sửa ca
                                </button>
                              )}
                              <button onClick={() => handleGoToHauPhau(app)} className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl transition-colors border border-emerald-200">
                                <ClipboardList className="w-3.5 h-3.5" /> Hậu phẫu
                              </button>
                            </>
                          ) : (
                            (profile?.role === 'admin' || (profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận')) && (
                              <button onClick={() => openModal(app)} className="w-full flex justify-center items-center gap-1.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-bold rounded-xl transition-colors border border-purple-200 shadow-sm">
                                <ClipboardList className="w-4 h-4" /> Đăng ký Phân công
                              </button>
                            )
                          )}
                        </div>
                        
                        {['admin', 'accountant', 'cskh'].includes(profile?.role) && (
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

                        <div className="pt-1">
                          <ConsultButton app={app} className="w-full flex justify-center items-center gap-1.5 py-2 bg-teal-50 text-teal-700 text-xs font-bold rounded-xl border border-teal-200 hover:bg-teal-100 transition-colors" />
                        </div>

                        {['admin', 'accountant', 'dieu_duong', 'cskh'].includes(profile?.role) && (
                          <div className="pt-1">
                            {app.has_materials ? (
                              <button onClick={() => openMaterialModal(app)} className="w-full flex justify-center items-center gap-1.5 py-2 bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                                <PackageOpen className="w-4 h-4 text-indigo-500" /> Vật tư tiêu hao (Đã xuất)
                              </button>
                            ) : (
                              <button onClick={() => openMaterialModal(app)} className="w-full flex justify-center items-center gap-1.5 py-2 bg-orange-50 text-orange-700 text-xs font-bold rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors shadow-sm">
                                <PackageOpen className="w-4 h-4" /> Báo cáo Vật tư
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
                    <label className="block text-sm font-semibold mb-2">Loại phẫu thuật</label>
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
                    <label className="block text-sm font-semibold mb-2">Phụ mổ 2</label>
                    <select value={form.phu_mo_2_id} onChange={e => setForm({...form, phu_mo_2_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Phụ mổ 3</label>
                    <select value={form.phu_mo_3_id} onChange={e => setForm({...form, phu_mo_3_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {form.activeTab === 'truc_dem' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Người trực đêm 1</label>
                    <select value={form.truc_dem_id} onChange={e => setForm({...form, truc_dem_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Người trực đêm 2 <span className="text-slate-400 font-normal">(nếu có)</span></label>
                    <select value={form.truc_dem_id_2} onChange={e => setForm({...form, truc_dem_id_2: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-purple-500">
                      <option value="">-- Trống --</option>
                      {nurses.filter(n => n.id !== form.truc_dem_id).map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {form.activeTab === 'hau_phau' && (
                <div>
                  <label className="block text-sm font-semibold mb-2">Người chăm sóc hậu phẫu</label>
                  <select value={form.hau_phau_id} onChange={e => setForm({...form, hau_phau_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500">
                    <option value="">-- Trống --</option>
                    {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                  </select>
                </div>
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
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50 shrink-0">
              <h3 className="font-bold text-blue-800">Nhập viện phí</h3>
              <button type="button" onClick={() => setShowFeeModal(false)}><X className="w-5 h-5 text-blue-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Số tiền (VNĐ)</label>
                <input type="text" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: formatCurrencyInput(e.target.value)})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 font-bold text-blue-700 text-lg" placeholder="1.000.000" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFeeForm({...feeForm, method: 'transfer'})} className={`flex-1 py-2 border rounded-xl font-bold text-sm ${feeForm.method === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'text-slate-500 border-slate-200'}`}>Chuyển khoản</button>
                <button type="button" onClick={() => setFeeForm({...feeForm, method: 'cash'})} className={`flex-1 py-2 border rounded-xl font-bold text-sm ${feeForm.method === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-slate-500 border-slate-200'}`}>Tiền mặt</button>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-xl text-center text-slate-400 hover:border-blue-400">
                {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (feeForm.proof ? <img src={feeForm.proof} className="max-h-20 mx-auto" /> : 'Tải bill lên')}
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            </div>
            <div className="p-4 bg-slate-50 shrink-0 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setShowFeeModal(false)} className="px-6 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Đóng</button>
              <button type="button" onClick={handleSaveFee} disabled={saving || uploadingImage} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">Lưu Viện Phí</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VẬT TƯ TIÊU HAO */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 shrink-0">
              <h3 className="font-bold text-indigo-800 flex items-center gap-2"><PackageOpen className="w-5 h-5"/> Báo cáo Vật tư tiêu hao</h3>
              <button onClick={() => setShowMaterialModal(false)}><X className="w-5 h-5 text-indigo-400 hover:text-indigo-600" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="font-bold text-slate-800">{selectedApp?.customer_name}</div>
                <div className="text-sm text-slate-500">Phẫu thuật: {selectedApp?.surgery_type}</div>
              </div>
              {consumedItems.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-slate-700 mb-3 uppercase">Đã báo cáo</h4>
                  <div className="bg-slate-50 border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-500">
                        <tr><th className="px-4 py-2">Tên vật tư</th><th className="px-4 py-2 text-right">SL</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {consumedItems.map(item => (
                          <tr key={item.id}><td className="px-4 py-3 font-semibold">{item.inventory_items?.name}</td><td className="px-4 py-3 text-right font-bold text-red-600">-{item.quantity}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm text-slate-700 uppercase">Nhập thêm</h4>
                  <button onClick={handleAddMaterialRow} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm dòng</button>
                </div>
                {materialForm.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center bg-white border p-2 rounded-xl shadow-sm mb-2">
                    <select value={row.item_id} onChange={(e) => handleUpdateMaterialRow(index, 'item_id', e.target.value)} className="flex-1 text-sm font-semibold outline-none">
                      <option value="">-- Chọn vật tư --</option>
                      {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" min="1" value={row.quantity} onChange={(e) => handleUpdateMaterialRow(index, 'quantity', Number(e.target.value))} className="w-20 text-center font-bold bg-slate-50 rounded-lg p-2 outline-none" />
                    <button onClick={() => handleRemoveMaterialRow(index)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 shrink-0 border-t flex justify-end gap-3">
              <button onClick={() => setShowMaterialModal(false)} className="px-6 py-2 border rounded-xl font-semibold text-slate-600">Đóng</button>
              {materialForm.length > 0 && <button onClick={handleSaveMaterials} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl">Lưu Vật Tư</button>}
            </div>
          </div>
        </div>
      )}
      {/* Modal Truy Cập Bị Từ Chối */}
      {accessDeniedInfo && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-in-center">
            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
                <Ban className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Truy cập bị từ chối</h3>
              <p className="text-slate-600 mb-6 leading-relaxed text-[15px]">
                Hậu phẫu khách hàng <span className="font-bold text-slate-800">{accessDeniedInfo.customerName}</span> đang được phân công cho Điều Dưỡng <span className="font-bold text-red-600">{accessDeniedInfo.nurseName}</span>.
                <br/><br/>
                Hãy liên hệ trưởng bộ phận để được phân công và xem chi tiết.
              </p>
              <button 
                onClick={() => setAccessDeniedInfo(null)}
                className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KhachPhauThuatPage;
