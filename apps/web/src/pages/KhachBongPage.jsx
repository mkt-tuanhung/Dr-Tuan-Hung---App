import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Calendar, ArrowUpCircle, RotateCcw, X, MessageCircle, Phone, ChevronLeft, Wallet, UserX } from 'lucide-react';
import ConsultButton from '@/components/ConsultButton.jsx';
import MoneyInput from '@/components/MoneyInput.jsx';
import { phoneFor } from '@/lib/phoneMask';
import { vnToday } from '@/lib/vnTime';

const CARE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang chăm sóc', label: 'Đang chăm sóc' },
  { id: 'Đã quay lại tư vấn', label: 'Đã quay lại tư vấn' },
  { id: 'Đã làm dịch vụ bên khác', label: 'Làm nơi khác' },
  { id: 'Hủy hẳn', label: 'Hủy hẳn' }
];

const STATUS_STYLE = {
  'Đang chăm sóc': 'e-tone-warning',
  'Đã quay lại tư vấn': 'e-tone-info',
  'Đã làm dịch vụ bên khác': 'e-tone-neutral',
  'Hủy hẳn': 'e-tone-danger',
};

const QUICK_NOTES = [
  'Đã gọi, không nghe máy', 'Hẹn gọi lại sau', 'Khách đang cân nhắc', 'Khách hẹn qua tư vấn',
  'Đã nhắn Zalo', 'Khách báo bận', 'Chưa đủ tài chính', 'Quan tâm dịch vụ khác',
];

const KhachBongPage = ({ isNested = false }) => {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Trang chăm sóc riêng + modal hành động
  const [careApp, setCareApp] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [careForm, setCareForm] = useState({ care_status: 'Đang chăm sóc', care_notes: '' });
  const [revertForm, setRevertForm] = useState({ appointment_date: '', appointment_time: '09:00', notes: '' });
  const [depositForm, setDepositForm] = useState({ deposit_amount: '', deposit_date: '', expected_surgery_date: '', surgery_time: '', service: '', notes: '' });
  const [surgeryForm, setSurgeryForm] = useState({
    expected_surgery_date: '', revenue: '', upsale_revenue: '', service: '',
    service_group: 'Tiểu phẫu', surgery_type: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('customer_appointments')
      .select('*, telesale:profiles!telesale_id(full_name), sale:profiles!sale_id(full_name)')
      .eq('status', 'bong');
    // Telesale/Sale chỉ thấy khách MÌNH phụ trách; role giám sát thấy tất cả
    const roles = [profile?.role, profile?.role_2].filter(Boolean);
    const SEE_ALL = ['admin', 'accountant', 'shareholder', 'marketing', 'cskh'];
    if (!roles.some(r => SEE_ALL.includes(r))) {
      const conds = [];
      if (roles.includes('telesale')) conds.push(`telesale_id.eq.${profile.id}`, `telesale_id_2.eq.${profile.id}`);
      if (roles.includes('sale_offline')) conds.push(`sale_id.eq.${profile.id}`);
      query = conds.length ? query.or(conds.join(',')) : query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) toast.error('Lỗi tải dữ liệu: ' + error.message);
    else setCustomers(data || []);
    setLoading(false);
  }, [profile?.id, profile?.role, profile?.role_2]);

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
        surgery_type: surgeryForm.surgery_type,
        customer_source: surgeryForm.customer_source,
        customer_type: surgeryForm.customer_type
      }).eq('id', selectedApp.id);

    if (error) toast.error(error.message);
    else { toast.success('Khách đã được chuyển sang Phẫu Thuật!'); setShowSurgeryModal(false); setCareApp(null); loadData(); }
    setSaving(false);
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(String(depositForm.deposit_amount).replace(/\D/g, '')) || 0;
    if (!amount) { toast.error('Nhập số tiền cọc'); return; }
    if (!depositForm.deposit_date) { toast.error('Chọn ngày cọc'); return; }
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({
        status: 'coc',
        deposit_amount: amount,
        deposit_date: depositForm.deposit_date,
        appointment_date: depositForm.deposit_date,
        expected_surgery_date: depositForm.expected_surgery_date || null,
        surgery_time: depositForm.surgery_time || null,
        service: depositForm.service || selectedApp.service || null,
        notes: (selectedApp.notes || '') + `\n[${new Date().toLocaleDateString('vi-VN')}] [Chốt cọc] ${amount.toLocaleString('vi-VN')}đ` + (depositForm.notes ? ` — ${depositForm.notes}` : ''),
      }).eq('id', selectedApp.id);

    if (error) toast.error(error.message);
    else { toast.success('Đã chốt cọc — khách chuyển sang mục Khách cọc!'); setShowDepositModal(false); setCareApp(null); loadData(); }
    setSaving(false);
  };

  const openCare = (app) => { setCareApp(app); setSelectedApp(app); setCareForm({ care_status: app.care_status || 'Đang chăm sóc', care_notes: '' }); };
  const openDeposit = (app) => {
    setSelectedApp(app);
    setDepositForm({
      deposit_amount: '', deposit_date: vnToday(),
      expected_surgery_date: app.expected_surgery_date || '', surgery_time: app.surgery_time || '', service: app.service || '', notes: '',
    });
    setShowDepositModal(true);
  };
  const openRevert = (app) => { setSelectedApp(app); setRevertForm({ appointment_date: vnToday(), appointment_time: '09:00', notes: '' }); setShowRevertModal(true); };
  const openSurgery = (app) => {
    setSelectedApp(app);
    setSurgeryForm({
      expected_surgery_date: app.expected_surgery_date || vnToday(),
      revenue: app.expected_bill || '', upsale_revenue: '', service: app.service || '',
      service_group: app.service_group || 'Tiểu phẫu',
      surgery_type: app.surgery_type || 'Tiểu phẫu',
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
            <div key={`date-${index}`} className="e-caption text-teal-700 mt-4 mb-1.5 first:mt-0">
              CẬP NHẬT {date} :
            </div>
          );
        }
      }
      elements.push(<div key={`line-${index}`} className="pl-3 ml-[3px] border-l-2 border-teal-100 py-0.5">{line}</div>);
    });
    return elements;
  };

  return (
    <div className="w-full">
      {careApp ? (
        /* ===== TRANG CHĂM SÓC RIÊNG ===== */
        <form onSubmit={handleCareSubmit} className="max-w-3xl mx-auto space-y-4 pb-10">
          <button type="button" onClick={() => setCareApp(null)} className="e-btn e-btn-ghost e-btn-sm -ml-2">
            <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
          </button>

          <div className="e-card e-card-pad">
            <div className="flex items-center gap-4">
              <span className="e-avatar w-14 h-14 ring-4 ring-teal-50/70"><UserX className="w-6 h-6" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[20px] font-bold text-slate-900 leading-tight truncate">{careApp.customer_name}</h2>
                  <span className={`e-badge e-badge-sm ${STATUS_STYLE[careApp.care_status || 'Đang chăm sóc']}`}>
                    {careApp.care_status || 'Đang chăm sóc'}
                  </span>
                </div>
                <div className="text-[13px] text-slate-500 flex items-center gap-1.5 mt-1"><Phone className="w-4 h-4" /> {phoneFor(careApp.phone, profile)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="e-subtle px-3 py-2.5 col-span-2">
                <div className="e-kv-label">Lý do rớt</div>
                <div className="e-kv-value whitespace-pre-line">{careApp.notes || '—'}</div>
              </div>
              <div className="e-subtle px-3 py-2.5 min-w-0">
                <div className="e-kv-label">Telesale</div>
                <div className="e-kv-value truncate">{careApp.telesale?.full_name || 'N/A'}</div>
              </div>
              <div className="e-subtle px-3 py-2.5 min-w-0">
                <div className="e-kv-label">Sale</div>
                <div className="e-kv-value truncate">{careApp.sale?.full_name || 'N/A'}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <ConsultButton app={careApp} />
              <button type="button" onClick={() => openRevert(careApp)} className="e-btn e-btn-secondary e-btn-sm">
                <RotateCcw className="w-4 h-4" /> Quay lại lịch hẹn
              </button>
              <button type="button" onClick={() => openDeposit(careApp)} className="e-btn e-btn-outline e-btn-sm">
                <Wallet className="w-4 h-4" /> Chốt cọc
              </button>
              <button type="button" onClick={() => openSurgery(careApp)} className="e-btn e-btn-primary e-btn-sm">
                <ArrowUpCircle className="w-4 h-4" /> Chốt phẫu thuật
              </button>
            </div>
          </div>

          {/* Nhật ký CSKH */}
          <div className="e-card e-card-pad">
            <h3 className="e-card-title mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-teal-600" /> Nhật ký chăm sóc</h3>
            <div className="text-[13.5px] leading-relaxed text-slate-700 max-h-[40dvh] overflow-y-auto pr-1">
              {careApp.care_notes ? renderNotes(careApp.care_notes) : <div className="text-[13px] text-slate-400 text-center py-6">Chưa có ghi chú nào — thêm mốc đầu tiên bên dưới</div>}
            </div>
          </div>

          {/* Thêm mốc */}
          <div className="e-card e-card-pad space-y-4">
            <h3 className="e-card-title">Thêm mốc chăm sóc</h3>
            <div>
              <label className="e-label">Cập nhật trạng thái</label>
              <div className="flex flex-wrap gap-1.5">
                {CARE_TABS.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} type="button" onClick={() => setCareForm({ ...careForm, care_status: t.id })}
                    className={`inline-flex items-center h-9 px-3.5 rounded-full border text-[13px] font-medium transition ${careForm.care_status === t.id ? STATUS_STYLE[t.id] + ' border-current font-semibold' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-800'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTES.map(q => (
                <button key={q} type="button" onClick={() => addQuickNote(q)}
                  className="e-chip h-8 px-3 text-[12.5px]">
                  + {q}
                </button>
              ))}
            </div>
            <textarea rows={3} value={careForm.care_notes} onChange={e => setCareForm({ ...careForm, care_notes: e.target.value })} className="e-textarea resize-none text-[14px] leading-relaxed" placeholder="Gõ ghi chú hoặc chạm thẻ nhanh phía trên..." />
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Lưu mốc'}</button>
            </div>
          </div>
        </form>
      ) : (
        /* ===== DANH SÁCH ===== */
        <div className="space-y-4 w-full">
          {!isNested && (
            <div className="flex items-center justify-between">
              <div>
                <p className="e-page-desc">Chăm sóc khách hàng rớt và điều hướng trạng thái</p>
              </div>
              <div className="e-badge e-tone-danger">{customers.length} Khách</div>
            </div>
          )}

          <div className="e-toolbar">
            {CARE_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`e-chip ${activeTab === tab.id ? 'e-chip-active' : 'bg-white'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>
          ) : filteredCustomers.length === 0 ? (
            <div className="e-card e-empty py-16 text-[13px] font-medium text-slate-400">Không có khách hàng nào trong mục này</div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedCustomers).map(([date, apps]) => (
                <section key={date}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                    <h3 className="text-[14px] font-semibold text-slate-800 tabular-nums">Cập nhật: {date}</h3>
                    <span className="e-badge e-badge-sm e-tone-neutral">{apps.length} khách</span>
                    <span className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
                    {apps.map(app => {
                      const st = app.care_status || 'Đang chăm sóc';
                      const noteCount = app.care_notes ? app.care_notes.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
                      return (
                        <button key={app.id} type="button" onClick={() => openCare(app)}
                          className="w-full text-left rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 flex flex-col gap-2.5 transition hover:border-teal-100 hover:shadow-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal-500/25">
                          {/* Đầu thẻ: avatar + tên + SĐT */}
                          <div className="flex items-start gap-3 w-full">
                            <span className="e-avatar w-12 h-12 bg-danger-50 text-danger-600"><UserX className="w-5 h-5" /></span>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h4 className="text-[15px] font-semibold text-slate-900 truncate">{app.customer_name}</h4>
                              <div className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1 truncate"><Phone className="w-3.5 h-3.5 shrink-0" /> {phoneFor(app.phone, profile)}</div>
                            </div>
                            <span className={`e-badge e-badge-sm shrink-0 ${STATUS_STYLE[st]}`}>{st}</span>
                          </div>
                          {/* Lý do rớt */}
                          <div className="e-subtle px-3 py-2 w-full min-w-0">
                            <div className="e-kv-label">Lý do rớt:</div>
                            <div className="text-[13px] font-medium text-slate-700 truncate">{app.notes || 'Không rõ'}</div>
                          </div>
                          {/* Chân thẻ */}
                          <div className="mt-auto flex items-center justify-between gap-2 w-full pt-2 border-t border-dashed border-slate-200 text-[11.5px] text-slate-400">
                            <span className="truncate"><span className="text-slate-400">Telesale:</span> <span className="text-slate-600 font-medium">{app.telesale?.full_name || 'N/A'}</span></span>
                            <span className="flex items-center gap-1 whitespace-nowrap"><MessageCircle className="w-3 h-3" /> {noteCount} mốc</span>
                          </div>
                          <span className="text-[12.5px] text-teal-700 font-semibold">Mở nhật ký →</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Chuyển lại Lịch Hẹn */}
      {showRevertModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRevertSubmit} className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Đặt Lịch Hẹn Mới: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowRevertModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Ngày hẹn</label>
                  <input required type="date" value={revertForm.appointment_date} onChange={e => setRevertForm({ ...revertForm, appointment_date: e.target.value })} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Giờ hẹn</label>
                  <input required type="time" value={revertForm.appointment_time} onChange={e => setRevertForm({ ...revertForm, appointment_time: e.target.value })} className="e-input" />
                </div>
              </div>
              <div>
                <label className="e-label">Ghi chú cho ca hẹn này</label>
                <input required type="text" value={revertForm.notes} onChange={e => setRevertForm({ ...revertForm, notes: e.target.value })} className="e-input" placeholder="Khách hẹn tới kiểm tra lại..." />
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Xác nhận tạo lịch'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Chốt Phẫu Thuật */}
      {showSurgeryModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSurgerySubmit} className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Chốt Phẫu Thuật: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowSurgeryModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4 max-h-[70dvh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Ngày phẫu thuật</label>
                  <input required type="date" value={surgeryForm.expected_surgery_date} onChange={e => setSurgeryForm({ ...surgeryForm, expected_surgery_date: e.target.value })} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Dịch vụ thực tế làm</label>
                  <input required type="text" value={surgeryForm.service} onChange={e => setSurgeryForm({ ...surgeryForm, service: e.target.value })} className="e-input" placeholder="Nâng mũi..." />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Nhóm dịch vụ</label>
                  <select value={surgeryForm.service_group} onChange={e => setSurgeryForm({ ...surgeryForm, service_group: e.target.value })} className="e-input">
                    <option value="Hàm mặt">Hàm mặt</option>
                    <option value="Body">Body</option>
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                  </select>
                </div>
                <div>
                  <label className="e-label">Loại phẫu thuật</label>
                  <select value={surgeryForm.surgery_type} onChange={e => setSurgeryForm({ ...surgeryForm, surgery_type: e.target.value })} className="e-input">
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                    <option value="Đại phẫu">Đại phẫu</option>
                  </select>
                </div>
                <div>
                  <label className="e-label">Nguồn khách</label>
                  <select value={surgeryForm.customer_source} onChange={e => setSurgeryForm({ ...surgeryForm, customer_source: e.target.value })} className="e-input">
                    <option value="Ads">Ads</option>
                    <option value="Seeding">Seeding</option>
                    <option value="CTV">CTV</option>
                    <option value="Người quen">Người quen</option>
                    <option value="CSKH">CSKH</option>
                  </select>
                </div>
                <div>
                  <label className="e-label">Tệp khách</label>
                  <select value={surgeryForm.customer_type} onChange={e => setSurgeryForm({ ...surgeryForm, customer_type: e.target.value })} className="e-input">
                    <option value="Mới">Khách Mới</option>
                    <option value="Cũ">Khách Cũ</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Doanh thu (VNĐ)</label>
                  <MoneyInput required value={surgeryForm.revenue} onChange={v => setSurgeryForm({ ...surgeryForm, revenue: v })} className="e-input" placeholder="0" />
                </div>
                <div>
                  <label className="e-label">Upsale (VNĐ)</label>
                  <MoneyInput value={surgeryForm.upsale_revenue} onChange={v => setSurgeryForm({ ...surgeryForm, upsale_revenue: v })} className="e-input" placeholder="0" />
                </div>
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Hoàn tất & Chuyển module'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Chốt Cọc */}
      {showDepositModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDepositSubmit} className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title flex items-center gap-2"><Wallet className="w-5 h-5 text-teal-600" /> Chốt cọc: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowDepositModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4 max-h-[70dvh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Số tiền cọc (VNĐ)</label>
                  <MoneyInput required value={depositForm.deposit_amount} onChange={v => setDepositForm({ ...depositForm, deposit_amount: v })} className="e-input" placeholder="VD: 5.000.000" />
                </div>
                <div>
                  <label className="e-label">Ngày cọc</label>
                  <input required type="date" value={depositForm.deposit_date} onChange={e => setDepositForm({ ...depositForm, deposit_date: e.target.value })} className="e-input" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Dịch vụ dự kiến</label>
                  <input type="text" value={depositForm.service} onChange={e => setDepositForm({ ...depositForm, service: e.target.value })} className="e-input" placeholder="Nâng mũi..." />
                </div>
                <div>
                  <label className="e-label">Ngày dự kiến PT (tuỳ chọn)</label>
                  <input type="date" value={depositForm.expected_surgery_date} onChange={e => setDepositForm({ ...depositForm, expected_surgery_date: e.target.value })} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Giờ dự kiến PT (tuỳ chọn)</label>
                  <input type="time" value={depositForm.surgery_time} onChange={e => setDepositForm({ ...depositForm, surgery_time: e.target.value })} className="e-input" />
                </div>
              </div>
              <div>
                <label className="e-label">Ghi chú (tuỳ chọn)</label>
                <input type="text" value={depositForm.notes} onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })} className="e-input" placeholder="VD: cọc giữ suất tuần sau làm" />
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Chốt cọc & chuyển sang Khách cọc'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default KhachBongPage;
