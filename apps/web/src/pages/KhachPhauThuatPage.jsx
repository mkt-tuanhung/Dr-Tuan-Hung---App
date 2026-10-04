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
import MoDoiTacPage from '@/pages/MoDoiTacPage.jsx';
import { Handshake, Stethoscope } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

const KhachPhauThuatPage = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [moduleTab, setModuleTab] = useState('noi_bo'); // 'noi_bo' | 'doi_tac'

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
  const didLoad = React.useRef(false);
  const [saving, setSaving] = useState(false);

  // Modal Vật tư
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [consumedItems, setConsumedItems] = useState([]);
  const [materialForm, setMaterialForm] = useState([]); // [{ item_id, quantity }]

  const [form, setForm] = useState({
    activeTab: 'phu_mo',
    bac_si_id: '',
    phu_mo_1_id: '', phu_mo_2_id: '', phu_mo_3_id: '', surgery_notes: '',
    truc_dem_id: '', truc_dem_id_2: '', truc_dem_notes: '',
    hau_phau_id: '',
    surgery_date: '', surgery_time: ''
  });

  const isAdmin = profile?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    const { data: appsData, error: appsErr } = await supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name), telesale:telesale_id(full_name), sale:sale_id(full_name)')
      .eq('status', 'phau_thuat')
      .order('surgery_date', { ascending: false });

    const { data: nursesData } = await supabase.from('profiles').select('*')
      .or('role.in.(dieu_duong,admin,bac_si),role_2.in.(dieu_duong,admin,bac_si)');

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
    didLoad.current = true;
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments,inventory_transactions,inventory_items', loadData);

  const openModal = (app, initialTab = 'phu_mo') => {
    setSelectedApp(app);
    setForm({
      activeTab: initialTab,
      bac_si_id: app.bac_si_id || '',
      phu_mo_1_id: app.phu_mo_1_id || '',
      phu_mo_2_id: app.phu_mo_2_id || '',
      phu_mo_3_id: app.phu_mo_3_id || '',
      surgery_notes: app.surgery_notes || '',
      truc_dem_id: app.truc_dem_id || '',
      truc_dem_id_2: app.truc_dem_id_2 || '',
      truc_dem_notes: app.truc_dem_notes || '',
      hau_phau_id: app.hau_phau_id || '',
      surgery_date: app.surgery_date ? String(app.surgery_date).slice(0, 10) : '',
      surgery_time: app.surgery_time || ''
    });
    setShowNurseModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      bac_si_id: form.bac_si_id || null,
      phu_mo_1_id: form.phu_mo_1_id || null,
      phu_mo_2_id: form.phu_mo_2_id || null,
      phu_mo_3_id: form.phu_mo_3_id || null,
      surgery_notes: form.surgery_notes,
      truc_dem_id: form.truc_dem_id || null,
      truc_dem_id_2: form.truc_dem_id_2 || null,
      truc_dem_notes: form.truc_dem_notes,
      hau_phau_id: form.hau_phau_id || null
    };
    // Chỉ admin được đổi NGÀY & GIỜ mổ
    if (isAdmin) {
      if (!form.surgery_date) { toast.error('Vui lòng chọn ngày mổ'); setSaving(false); return; }
      payload.surgery_date = form.surgery_date;
      payload.surgery_time = form.surgery_time || null;
    }
    const { error } = await supabase.from('customer_appointments')
      .update(payload).eq('id', selectedApp.id);

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

  const reloadConsumed = async (appId) => {
    const { data } = await supabase.from('inventory_transactions')
      .select('*, inventory_items(name, unit)').eq('reference_id', appId).eq('type', 'export');
    setConsumedItems(data || []);
  };

  const handleDeleteConsumed = async (ids, name) => {
    if (!window.confirm(`Xoá "${name}" khỏi báo cáo? Tồn kho sẽ được hoàn lại.`)) return;
    setConsumedItems(prev => prev.filter(t => !ids.includes(t.id))); // xoá cục bộ, không reload trang
    const { error } = await supabase.from('inventory_transactions').delete().in('id', ids);
    if (error) { toast.error('Lỗi: ' + error.message); reloadConsumed(selectedApp.id); return; }
    toast.success('Đã xoá vật tư khỏi báo cáo');
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

    const today = vnToday();
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
    <div className="space-y-4">
      {/* Tabs module: Khách nội bộ | Mổ đối tác */}
      <div className="e-tabs">
        <button onClick={() => setModuleTab('noi_bo')} className={`e-tab ${moduleTab === 'noi_bo' ? 'e-tab-active' : ''}`}><Stethoscope /> Khách phòng khám</button>
        <button onClick={() => setModuleTab('doi_tac')} className={`e-tab ${moduleTab === 'doi_tac' ? 'e-tab-active' : ''}`}><Handshake /> Mổ Đối Tác</button>
      </div>

      {moduleTab === 'doi_tac' && <MoDoiTacPage />}

      {moduleTab === 'noi_bo' && (<>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="e-page-desc">Quản lý lịch mổ và phân công điều dưỡng, hậu phẫu</p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="e-search w-full sm:w-72 shrink-0">
            <Search />
            <input 
              type="text" 
              placeholder="Tìm tên KH hoặc số điện thoại..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="e-badge e-tone-brand h-10 px-4 rounded-xl tabular-nums hidden sm:inline-flex">
            {filteredCustomers.length} Khách
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : customers.length === 0 ? (
         <div className="e-card py-16 text-center text-[13px] text-slate-400">
            Không có khách phẫu thuật nào
         </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCustomers).map(([date, apps]) => (
            <section key={date} className="space-y-3">
              {/* Tiêu đề nhóm ngày mổ */}
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 grid place-items-center shrink-0"><CalendarIcon className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0">
                  <div className="e-caption">Ngày mổ</div>
                  <h3 className="text-[15px] font-semibold text-slate-900 tabular-nums leading-tight">{date}</h3>
                </div>
                <span className="flex-1 h-px bg-slate-200" />
                <span className="e-badge e-badge-sm e-tone-brand tabular-nums shrink-0">{apps.length} ca</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map(app => {
                  const isAssigned = app.hau_phau_id;
                  return (
                    <div key={app.id} className="e-card p-4 flex flex-col gap-3.5 transition hover:border-teal-100 hover:shadow-float">
                      {/* Đầu thẻ: avatar + tên + dịch vụ | doanh thu */}
                      <div className="flex items-start gap-3">
                        <span className="e-avatar w-11 h-11 text-[15px] before:content-[attr(data-av)]" data-av={(app.customer_name || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase()} />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[15px] font-semibold text-slate-900 leading-snug truncate">{app.customer_name}</h4>
                          <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{app.service}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="e-kv-label">Doanh thu</div>
                          <div className="text-[15px] font-bold text-slate-900 tabular-nums">{Number(app.revenue || 0).toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>

                      {/* Nhãn trạng thái: giờ mổ · phụ mổ · trực đêm */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {app.surgery_time && (
                          <span className="e-badge e-badge-sm e-tone-info tabular-nums">
                            <Clock className="w-3 h-3" /> {app.surgery_time}
                          </span>
                        )}
                        <span className={`e-badge e-badge-sm ${app.phu_mo_1_id ? 'e-tone-success' : 'e-tone-neutral'}`}>
                          Phụ mổ {app.phu_mo_1_id ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-slate-400">-</span>}
                        </span>
                        <span className={`e-badge e-badge-sm ${(app.truc_dem_id || app.truc_dem_id_2) ? 'e-tone-success' : 'e-tone-neutral'}`}>
                          Trực đêm {(app.truc_dem_id || app.truc_dem_id_2) ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-slate-400">-</span>}
                        </span>
                        {isAdmin && (
                          <button onClick={() => openModal(app, 'lich_mo')} title="Sửa ngày & giờ mổ"
                            className="ml-auto inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold text-teal-800 hover:bg-teal-50 transition">
                            <Edit className="w-3 h-3" /> Sửa lịch
                          </button>
                        )}
                      </div>

                      {/* Người phụ trách */}
                      <dl className="e-subtle grid grid-cols-2 gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <dt className="e-kv-label">Telesale</dt>
                          <dd className="text-[13px] font-semibold text-slate-700 truncate">{app.telesale?.full_name || '—'}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="e-kv-label">Sale Offline</dt>
                          <dd className="text-[13px] font-semibold text-slate-700 truncate">{app.sale?.full_name || '—'}</dd>
                        </div>
                      </dl>

                      {/* Hành động: 1 nút chính + các nút phụ */}
                      <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex gap-2 empty:hidden">
                          {isAssigned ? (
                            <>
                              {(profile?.role === 'admin' || (profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận')) && (
                                <button onClick={() => openModal(app)} className="e-btn e-btn-secondary e-btn-sm">
                                  <Edit className="w-3.5 h-3.5" /> Sửa ca
                                </button>
                              )}
                              <button onClick={() => handleGoToHauPhau(app)} className="e-btn e-btn-primary e-btn-sm flex-1">
                                <ClipboardList className="w-3.5 h-3.5" /> Hậu phẫu
                              </button>
                            </>
                          ) : (
                            (profile?.role === 'admin' || (profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận')) && (
                              <button onClick={() => openModal(app)} className="e-btn e-btn-primary e-btn-sm flex-1">
                                <ClipboardList className="w-4 h-4" /> Đăng ký Phân công
                              </button>
                            )
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 empty:hidden">
                          {['admin', 'accountant', 'cskh'].includes(profile?.role) && (<>
                            {app.hospital_fee ? (
                              <span className="e-badge e-tone-success h-[34px] rounded-[10px] justify-center grow basis-[120px]">
                                <CheckCircle className="w-4 h-4" /> Đã nhập viện phí
                              </span>
                            ) : (
                              <button onClick={() => openFeeModal(app)} className="e-btn e-btn-secondary e-btn-sm grow basis-[120px]">
                                <Banknote className="w-4 h-4 text-teal-600" /> Nhập viện phí
                              </button>
                            )}
                          </>)}
                          <ConsultButton app={app} className="e-btn e-btn-secondary e-btn-sm grow basis-[120px]" />
                          {['admin', 'accountant', 'dieu_duong', 'cskh'].includes(profile?.role) && (<>
                            {app.has_materials ? (
                              <button onClick={() => openMaterialModal(app)} className="e-btn e-btn-secondary e-btn-sm grow basis-[120px]">
                                <PackageOpen className="w-4 h-4 text-success-500" /> Vật tư tiêu hao (Đã xuất)
                              </button>
                            ) : (
                              <button onClick={() => openMaterialModal(app)} className="e-btn e-btn-secondary e-btn-sm grow basis-[120px]">
                                <PackageOpen className="w-4 h-4 text-warning-500" /> Báo cáo Vật tư
                              </button>
                            )}
                          </>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      </>)}

      {/* Modal Phân công Điều dưỡng */}
      {showNurseModal && selectedApp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="e-modal max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">Phân công điều dưỡng: {selectedApp.customer_name}</h3>
              <button type="button" onClick={() => setShowNurseModal(false)} className="e-icon-btn w-8 h-8 border-transparent shrink-0"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="e-tabs shrink-0 px-3">
              <button type="button" onClick={() => setForm({...form, activeTab: 'phu_mo'})} className={`e-tab ${form.activeTab === 'phu_mo' ? 'e-tab-active' : ''}`}>Phụ mổ</button>
              <button type="button" onClick={() => setForm({...form, activeTab: 'truc_dem'})} className={`e-tab ${form.activeTab === 'truc_dem' ? 'e-tab-active' : ''}`}>Trực đêm</button>
              <button type="button" onClick={() => setForm({...form, activeTab: 'hau_phau'})} className={`e-tab ${form.activeTab === 'hau_phau' ? 'e-tab-active' : ''}`}>Chăm hậu phẫu</button>
              {isAdmin && (
                <button type="button" onClick={() => setForm({...form, activeTab: 'lich_mo'})} className={`e-tab ${form.activeTab === 'lich_mo' ? 'e-tab-active' : ''}`}>Ngày giờ mổ</button>
              )}
            </div>

            <div className="e-modal-body overflow-y-auto space-y-4 flex-1">
              {form.activeTab === 'phu_mo' && (
                <>
                  <div>
                    <label className="e-label">Loại phẫu thuật</label>
                    <div className="e-subtle h-10 px-3 flex items-center text-[14px] font-medium text-slate-700">
                      {selectedApp?.surgery_type || 'Tiểu phẫu'}
                    </div>
                    <p className="mt-1.5 text-[12px] text-slate-400">Theo lịch hẹn / đánh giá đã chọn — không sửa ở đây</p>
                  </div>
                  <div>
                    <label className="e-label">Bác sĩ mổ</label>
                    <select value={form.bac_si_id} onChange={e => setForm({...form, bac_si_id: e.target.value})} className="e-input">
                      <option value="">-- Trống --</option>
                      {nurses.filter(n => n.role === 'bac_si' || n.role_2 === 'bac_si' || n.role === 'admin').map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="e-label">Phụ mổ 1</label>
                    <select value={form.phu_mo_1_id} onChange={e => setForm({...form, phu_mo_1_id: e.target.value})} className="e-input">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="e-label">Phụ mổ 2</label>
                    <select value={form.phu_mo_2_id} onChange={e => setForm({...form, phu_mo_2_id: e.target.value})} className="e-input">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="e-label">Phụ mổ 3</label>
                    <select value={form.phu_mo_3_id} onChange={e => setForm({...form, phu_mo_3_id: e.target.value})} className="e-input">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {form.activeTab === 'truc_dem' && (
                <div className="space-y-4">
                  <div>
                    <label className="e-label">Người trực đêm 1</label>
                    <select value={form.truc_dem_id} onChange={e => setForm({...form, truc_dem_id: e.target.value})} className="e-input">
                      <option value="">-- Trống --</option>
                      {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="e-label">Người trực đêm 2 <span className="text-slate-400 font-normal">(nếu có)</span></label>
                    <select value={form.truc_dem_id_2} onChange={e => setForm({...form, truc_dem_id_2: e.target.value})} className="e-input">
                      <option value="">-- Trống --</option>
                      {nurses.filter(n => n.id !== form.truc_dem_id).map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {form.activeTab === 'hau_phau' && (
                <div>
                  <label className="e-label">Người chăm sóc hậu phẫu</label>
                  <select value={form.hau_phau_id} onChange={e => setForm({...form, hau_phau_id: e.target.value})} className="e-input">
                    <option value="">-- Trống --</option>
                    {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                  </select>
                </div>
              )}
              {form.activeTab === 'lich_mo' && isAdmin && (
                <div className="space-y-4">
                  <div className="e-subtle flex items-start gap-2 px-3 py-2.5 text-[12.5px] text-slate-600">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-teal-600" />
                    <span>Chỉ quản trị viên được đổi ngày &amp; giờ mổ. Đổi ngày sẽ tự chuyển ca sang nhóm ngày mới.</span>
                  </div>
                  <div>
                    <label className="e-label">Ngày mổ</label>
                    <input type="date" value={form.surgery_date} onChange={e => setForm({...form, surgery_date: e.target.value})} className="e-input" />
                  </div>
                  <div>
                    <label className="e-label">Giờ mổ <span className="text-slate-400 font-normal">(nếu có)</span></label>
                    <input type="time" value={form.surgery_time} onChange={e => setForm({...form, surgery_time: e.target.value})} className="e-input" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="e-modal-footer shrink-0">
              <button type="submit" disabled={saving} className="e-btn e-btn-primary w-full sm:w-auto">
                {saving ? 'Đang lưu...' : 'Lưu phân công'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nhập Viện Phí */}
      {showFeeModal && selectedApp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-sm overflow-hidden flex flex-col">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">Nhập viện phí</h3>
              <button type="button" onClick={() => setShowFeeModal(false)} className="e-icon-btn w-8 h-8 border-transparent shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Số tiền (VNĐ)</label>
                <input type="text" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: formatCurrencyInput(e.target.value)})} className="e-input h-12 text-[18px] font-bold tabular-nums" placeholder="1.000.000" />
              </div>
              <div className="e-seg w-full">
                <button type="button" onClick={() => setFeeForm({...feeForm, method: 'transfer'})} className={`e-seg-item flex-1 ${feeForm.method === 'transfer' ? 'e-seg-active' : ''}`}>Chuyển khoản</button>
                <button type="button" onClick={() => setFeeForm({...feeForm, method: 'cash'})} className={`e-seg-item flex-1 ${feeForm.method === 'cash' ? 'e-seg-active' : ''}`}>Tiền mặt</button>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-xl text-center text-[13px] font-medium text-slate-400 hover:border-teal-300 hover:text-teal-700 transition">
                {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (feeForm.proof ? <img src={feeForm.proof} className="max-h-20 mx-auto rounded-lg" /> : 'Tải bill lên')}
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            </div>
            <div className="e-modal-footer shrink-0">
              <button type="button" onClick={() => setShowFeeModal(false)} className="e-btn e-btn-secondary">Đóng</button>
              <button type="button" onClick={handleSaveFee} disabled={saving || uploadingImage} className="e-btn e-btn-primary">Lưu Viện Phí</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VẬT TƯ TIÊU HAO */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title flex items-center gap-2"><PackageOpen className="w-5 h-5 text-teal-600"/> Báo cáo Vật tư tiêu hao</h3>
              <button onClick={() => setShowMaterialModal(false)} className="e-icon-btn w-8 h-8 border-transparent shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="e-modal-body overflow-y-auto space-y-5">
              <div className="e-subtle px-4 py-3">
                <div className="text-[15px] font-semibold text-slate-900">{selectedApp?.customer_name}</div>
                <div className="text-[12.5px] text-slate-500 mt-0.5">Phẫu thuật: {selectedApp?.surgery_type}</div>
              </div>
              {consumedItems.length > 0 && (
                <div>
                  <h4 className="e-caption mb-2.5">Đã báo cáo</h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-[13.5px]">
                      <thead className="bg-slate-50 text-slate-500 text-[12px]">
                        <tr><th className="px-4 h-10 text-left font-semibold">Tên vật tư</th><th className="px-4 h-10 text-right font-semibold">SL</th><th className="px-2 h-10"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.values(consumedItems.reduce((acc, t) => {
                          const key = t.item_id || t.inventory_items?.name;
                          if (!acc[key]) acc[key] = { name: t.inventory_items?.name, qty: 0, ids: [] };
                          acc[key].qty += Number(t.quantity || 0);
                          acc[key].ids.push(t.id);
                          return acc;
                        }, {})).map((m, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{m.name}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-danger-600 tabular-nums">-{m.qty}</td>
                            <td className="px-2 py-2.5 text-right">
                              <button onClick={() => handleDeleteConsumed(m.ids, m.name)} className="w-8 h-8 inline-grid place-items-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600 transition" title="Xoá khỏi báo cáo"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="e-caption">Nhập thêm</h4>
                  <button onClick={handleAddMaterialRow} className="e-btn e-btn-ghost e-btn-sm"><Plus className="w-3.5 h-3.5" /> Thêm dòng</button>
                </div>
                {materialForm.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center mb-2">
                    <select value={row.item_id} onChange={(e) => handleUpdateMaterialRow(index, 'item_id', e.target.value)} className="e-input flex-1 min-w-0">
                      <option value="">-- Chọn vật tư --</option>
                      {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" min="1" value={row.quantity} onChange={(e) => handleUpdateMaterialRow(index, 'quantity', Number(e.target.value))} className="e-input w-20 text-center font-bold tabular-nums" />
                    <button onClick={() => handleRemoveMaterialRow(index)} className="w-10 h-10 shrink-0 grid place-items-center rounded-xl text-danger-500 hover:bg-danger-50 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="e-modal-footer shrink-0">
              <button onClick={() => setShowMaterialModal(false)} className="e-btn e-btn-secondary">Đóng</button>
              {materialForm.length > 0 && <button onClick={handleSaveMaterials} disabled={saving} className="e-btn e-btn-primary">Lưu Vật Tư</button>}
            </div>
          </div>
        </div>
      )}
      {/* Modal Truy Cập Bị Từ Chối */}
      {accessDeniedInfo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="e-modal max-w-md overflow-hidden scale-in-center">
            <div className="p-7 text-center flex flex-col items-center">
              <div className="w-14 h-14 bg-danger-50 text-danger-600 rounded-full grid place-items-center mb-4">
                <Ban className="w-7 h-7" />
              </div>
              <h3 className="text-[18px] font-bold text-slate-900 mb-2">Truy cập bị từ chối</h3>
              <p className="text-slate-600 mb-6 leading-relaxed text-[14px]">
                Hậu phẫu khách hàng <span className="font-semibold text-slate-900">{accessDeniedInfo.customerName}</span> đang được phân công cho Điều Dưỡng <span className="font-semibold text-teal-700">{accessDeniedInfo.nurseName}</span>.
                <br/><br/>
                Hãy liên hệ trưởng bộ phận để được phân công và xem chi tiết.
              </p>
              <button 
                onClick={() => setAccessDeniedInfo(null)}
                className="e-btn e-btn-primary e-btn-block"
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
