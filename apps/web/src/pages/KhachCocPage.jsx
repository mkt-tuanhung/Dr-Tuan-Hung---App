import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Calendar, ArrowUpCircle, X, MessageCircle, AlertCircle, Phone, Search, Plus, Upload, Loader2, ChevronLeft, ChevronRight, Users, Wallet, CalendarDays, Clock, Undo2, UserRound } from 'lucide-react';
import ConsultButton from '@/components/ConsultButton.jsx';
import MoneyInput from '@/components/MoneyInput.jsx';
import { phoneFor, isSaleOffline } from '@/lib/phoneMask';
import { vnToday } from '@/lib/vnTime';

const CAN_ADD_ROLES = ['sale_offline', 'telesale', 'admin', 'accountant'];
const fmtInput = (v) => { const n = String(v || '').replace(/\D/g, ''); return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; };
const todayStr = () => vnToday();
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const fmtTy = (n) => n >= 1e9 ? (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' Tỷ' : n >= 1e6 ? Math.round(n / 1e6) + ' Tr' : new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';
const EMPTY_COC = {
  customer_name: '', phone: '', deposit_amount: '', deposit_date: todayStr(),
  expected_surgery_date: '', service: '', telesale_id: '', sale_id: '', notes: '',
};

const CARE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang chăm sóc', label: 'Đang chăm sóc' },
  { id: 'Đã xét nghiệm xong', label: 'Đã xét nghiệm xong' },
  { id: 'Chờ lịch bác sĩ', label: 'Chờ lịch bác sĩ' },
  { id: 'Khách xin hoãn', label: 'Khách xin hoãn' }
];

const STATUS_STYLE = {
  'Đang chăm sóc': 'e-tone-warning',
  'Đã xét nghiệm xong': 'e-tone-success',
  'Chờ lịch bác sĩ': 'e-tone-info',
  'Khách xin hoãn': 'e-tone-rose',
};

const QUICK_NOTES = [
  'Đã gọi nhắc lịch', 'Khách xác nhận đến', 'Khách xin dời lịch', 'Đã tư vấn thêm',
  'Đã đặt lịch bác sĩ', 'Chờ kết quả xét nghiệm', 'Khách phân vân', 'Đã thu thêm cọc',
];

const KhachCocPage = ({ isNested = false }) => {
  const { profile } = useAuth();
  const canAdd = CAN_ADD_ROLES.includes(profile?.role);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Thêm khách cọc
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_COC);
  const [creating, setCreating] = useState(false);
  const [telesales, setTelesales] = useState([]);
  const [sales, setSales] = useState([]);
  const [billFile, setBillFile] = useState(null);
  const [noteFiles, setNoteFiles] = useState([]);

  // Trang chăm sóc riêng + modal hành động
  const [careApp, setCareApp] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [showBongModal, setShowBongModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [careForm, setCareForm] = useState({ care_status: 'Đang chăm sóc', care_notes: '' });
  const [bongForm, setBongForm] = useState({ notes: '' });
  const [refundForm, setRefundForm] = useState({ refund_amount: '', refund_date: '', notes: '' });
  const [surgeryForm, setSurgeryForm] = useState({
    expected_surgery_date: '', surgery_time: '', revenue: '', upsale_revenue: '', service: '',
    service_group: 'Tiểu phẫu', surgery_type: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('customer_appointments')
      .select('*, telesale:profiles!telesale_id(full_name), sale:profiles!sale_id(full_name)')
      .eq('status', 'coc');
    // Telesale/Sale chỉ thấy khách MÌNH phụ trách; role giám sát thấy tất cả
    const roles = [profile?.role, profile?.role_2].filter(Boolean);
    const SEE_ALL = ['admin', 'accountant', 'shareholder', 'marketing', 'cskh'];
    if (!roles.some(r => SEE_ALL.includes(r))) {
      const conds = [];
      if (roles.includes('telesale')) conds.push(`telesale_id.eq.${profile.id}`, `telesale_id_2.eq.${profile.id}`);
      if (roles.includes('sale_offline')) conds.push(`sale_id.eq.${profile.id}`);
      query = conds.length ? query.or(conds.join(',')) : query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { data, error } = await query.order('expected_surgery_date', { ascending: true });

    if (error) toast.error('Lỗi tải dữ liệu: ' + error.message);
    else setCustomers(data || []);
    setLoading(false);
  }, [profile?.id, profile?.role, profile?.role_2]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments', loadData);

  useEffect(() => {
    if (!careApp) return;
    const fresh = customers.find(c => c.id === careApp.id);
    if (fresh) setCareApp(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  useEffect(() => {
    if (!canAdd) return;
    supabase.from('profiles').select('id, full_name, role, role_2').eq('is_active', true)
      .or('role.in.(telesale,sale_offline),role_2.in.(telesale,sale_offline)').order('full_name')
      .then(({ data }) => {
        setTelesales((data || []).filter(s => s.role === 'telesale' || s.role_2 === 'telesale'));
        setSales((data || []).filter(s => s.role === 'sale_offline' || s.role_2 === 'sale_offline'));
      });
  }, [canAdd]);

  const openCreate = () => {
    const init = { ...EMPTY_COC };
    if (profile?.role === 'telesale') init.telesale_id = profile.id;
    if (profile?.role === 'sale_offline') init.sale_id = profile.id;
    setCreateForm(init);
    setBillFile(null);
    setNoteFiles([]);
    setShowCreateModal(true);
  };

  const handleCreateCoc = async (e) => {
    e.preventDefault();
    if (!createForm.customer_name || !createForm.phone) { toast.error('Nhập tên và SĐT khách'); return; }
    if (!createForm.deposit_date) { toast.error('Chọn ngày cọc'); return; }
    setCreating(true);
    try {
      let deposit_bill_url = null;
      if (billFile) deposit_bill_url = await uploadToR2(billFile, 'deposit-bills');
      const note_image_urls = [];
      for (const f of noteFiles) note_image_urls.push(await uploadToR2(f, 'coc-notes'));

      const { error } = await supabase.from('customer_appointments').insert({
        customer_name: createForm.customer_name,
        phone: createForm.phone,
        status: 'coc',
        appointment_date: createForm.deposit_date,
        deposit_date: createForm.deposit_date,
        deposit_amount: Number(String(createForm.deposit_amount).replace(/\D/g, '')) || 0,
        expected_surgery_date: createForm.expected_surgery_date || null,
        service: createForm.service || null,
        telesale_id: createForm.telesale_id || null,
        sale_id: createForm.sale_id || null,
        notes: createForm.notes || null,
        deposit_bill_url,
        note_image_urls,
        created_by: profile?.id,
      });
      if (error) throw error;
      toast.success('Đã thêm khách cọc');
      setShowCreateModal(false);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

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

  const handleBongSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({
        status: 'bong',
        bong_date: vnToday(),
        notes: (selectedApp.notes || '') + `\n[Hủy cọc] ${bongForm.notes}`
      }).eq('id', selectedApp.id);

    if (error) toast.error(error.message);
    else { toast.success('Khách đã được chuyển về danh sách Bong!'); setShowBongModal(false); setCareApp(null); loadData(); }
    setSaving(false);
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(String(refundForm.refund_amount).replace(/\D/g, '')) || 0;
    if (!amount) { toast.error('Nhập số tiền hoàn cọc'); return; }
    if (!refundForm.refund_date) { toast.error('Chọn ngày hoàn cọc'); return; }
    setSaving(true);
    const line = `\n[${new Date().toLocaleDateString('vi-VN')}] [Hoàn cọc] ${amount.toLocaleString('vi-VN')}đ (ngày ${new Date(refundForm.refund_date).toLocaleDateString('vi-VN')})` + (refundForm.notes ? ` — ${refundForm.notes}` : '');
    const { error } = await supabase.from('customer_appointments')
      .update({
        status: 'bong',
        bong_date: refundForm.refund_date,
        notes: (selectedApp.notes || '') + line,
      }).eq('id', selectedApp.id);

    if (error) toast.error(error.message);
    else { toast.success('Đã hoàn cọc — khách chuyển sang danh sách Bong!'); setShowRefundModal(false); setCareApp(null); loadData(); }
    setSaving(false);
  };

  const handleSurgerySubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('customer_appointments')
      .update({
        status: 'phau_thuat',
        surgery_date: surgeryForm.expected_surgery_date,
        surgery_time: surgeryForm.surgery_time || null,
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

  const openCare = (app) => { setCareApp(app); setSelectedApp(app); setCareForm({ care_status: app.care_status || 'Đang chăm sóc', care_notes: '' }); };
  const openBong = (app) => { setSelectedApp(app); setBongForm({ notes: '' }); setShowBongModal(true); };
  const openRefund = (app) => {
    setSelectedApp(app);
    setRefundForm({ refund_amount: String(app.deposit_amount || ''), refund_date: vnToday(), notes: '' });
    setShowRefundModal(true);
  };
  const openSurgery = (app) => {
    setSelectedApp(app);
    setSurgeryForm({
      expected_surgery_date: app.expected_surgery_date || vnToday(),
      surgery_time: app.surgery_time || '',
      revenue: app.deposit_amount || '', upsale_revenue: '', service: app.service || '',
      service_group: app.service_group || 'Tiểu phẫu',
      surgery_type: app.surgery_type || 'Tiểu phẫu',
      customer_source: app.customer_source || 'Ads',
      customer_type: app.customer_type || 'Mới'
    });
    setShowSurgeryModal(true);
  };

  let filteredCustomers = activeTab === 'all' ? customers : customers.filter(c => (c.care_status || 'Đang chăm sóc') === activeTab);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredCustomers = filteredCustomers.filter(c =>
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (!isSaleOffline(profile) && c.phone && c.phone.toLowerCase().includes(q))
    );
  }

  const groupedCustomers = filteredCustomers.reduce((acc, app) => {
    const date = app.expected_surgery_date ? new Date(app.expected_surgery_date).toLocaleDateString('vi-VN') : 'Chưa xếp lịch';
    if (!acc[date]) acc[date] = [];
    acc[date].push(app);
    return acc;
  }, {});

  const cocStats = {
    count: customers.length,
    total: customers.reduce((s, c) => s + Number(c.deposit_amount || 0), 0),
    waitDr: customers.filter(c => (c.care_status || 'Đang chăm sóc') === 'Chờ lịch bác sĩ').length,
    postpone: customers.filter(c => (c.care_status || 'Đang chăm sóc') === 'Khách xin hoãn').length,
  };

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
    <div className="space-y-4">
      {careApp ? (
        /* ===== TRANG CHĂM SÓC RIÊNG ===== */
        <form onSubmit={handleCareSubmit} className="max-w-3xl mx-auto space-y-4 pb-10">
          <button type="button" onClick={() => setCareApp(null)} className="e-btn e-btn-ghost e-btn-sm -ml-2">
            <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
          </button>

          <div className="e-card e-card-pad">
            {/* Hồ sơ khách (kiểu Customer 360) */}
            <div className="flex items-center gap-4">
              <span className="e-avatar w-14 h-14 ring-4 ring-teal-50/70"><UserRound className="w-6 h-6" /></span>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
              <div className="e-subtle px-3 py-2.5 col-span-2 sm:col-span-1">
                <div className="e-kv-label">Đã cọc</div>
                <div className="text-[18px] font-bold text-slate-900 tabular-nums">{Number(careApp.deposit_amount || 0).toLocaleString('vi-VN')}đ</div>
              </div>
              <div className="e-subtle px-3 py-2.5 col-span-2 sm:col-span-2 min-w-0">
                <div className="e-kv-label">Dịch vụ</div>
                <div className="e-kv-value truncate">{careApp.service || '—'}</div>
              </div>
              <div className="e-subtle px-3 py-2.5 min-w-0">
                <div className="e-kv-label">PT dự kiến</div>
                <div className="e-kv-value tabular-nums">{careApp.expected_surgery_date ? new Date(careApp.expected_surgery_date).toLocaleDateString('vi-VN') : '—'}</div>
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
              <button type="button" onClick={() => openSurgery(careApp)} className="e-btn e-btn-primary e-btn-sm">
                <ArrowUpCircle className="w-4 h-4" /> Lên phẫu thuật
              </button>
              <button type="button" onClick={() => openRefund(careApp)} className="e-btn e-btn-secondary e-btn-sm">
                <Undo2 className="w-4 h-4" /> Hoàn cọc
              </button>
              <button type="button" onClick={() => openBong(careApp)} className="e-btn e-btn-danger-soft e-btn-sm">
                <AlertCircle className="w-4 h-4" /> Hủy cọc
              </button>
            </div>
          </div>

          <div className="e-card e-card-pad">
            <h3 className="e-card-title mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-teal-600" /> Nhật ký chăm sóc</h3>
            <div className="text-[13.5px] leading-relaxed text-slate-700 max-h-[40dvh] overflow-y-auto pr-1">
              {careApp.care_notes ? renderNotes(careApp.care_notes) : <div className="text-[13px] text-slate-400 text-center py-6">Chưa có ghi chú nào — thêm mốc đầu tiên bên dưới</div>}
            </div>
          </div>

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
        <>
          {!isNested && (
            <div className="flex items-center justify-between">
              <div>
                <p className="e-page-desc">Chăm sóc khách đã cọc chờ ngày phẫu thuật</p>
              </div>
              <div className="e-badge e-tone-brand">{customers.length} Khách</div>
            </div>
          )}

          {/* Thẻ số liệu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
            {[
              { icon: Users, color: '#067B7F', label: 'Khách giữ cọc', value: cocStats.count },
              { icon: Wallet, color: '#3CA7A9', label: 'Tổng tiền cọc', value: fmtTy(cocStats.total) },
              { icon: CalendarDays, color: '#A99BE0', label: 'Chờ lịch bác sĩ', value: cocStats.waitDr },
              { icon: Clock, color: '#F4B183', label: 'Khách xin hoãn', value: cocStats.postpone },
            ].map((c, i) => (
              <div key={i} className="e-metric">
                <span className={`e-metric-icon ${['e-tone-brand', 'e-tone-info', 'e-tone-lavender', 'e-tone-peach'][i]}`}><c.icon /></span>
                <div className="min-w-0">
                  <div className="e-metric-label">{c.label}</div>
                  <div className="e-metric-value">{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="e-toolbar justify-between">
            <div className="flex flex-wrap gap-1.5">
              {CARE_TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`e-chip ${activeTab === tab.id ? 'e-chip-active' : 'bg-white'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="e-search flex-1 sm:w-72 shrink-0">
                <Search className="w-4 h-4" />
                <input type="text" placeholder="Tìm tên KH hoặc số điện thoại..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-w-0 focus:ring-[3px] focus:ring-teal-500/20" />
              </div>
              {canAdd && (
                <button onClick={openCreate} className="e-btn e-btn-primary shrink-0">
                  <Plus className="w-4 h-4" /> Thêm khách cọc
                </button>
              )}
            </div>
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
                    <h3 className="text-[14px] font-semibold text-slate-800 tabular-nums">{date}</h3>
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
                            <span className="e-avatar w-12 h-12 text-[15px]">{initials(app.customer_name)}</span>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h4 className="text-[15px] font-semibold text-slate-900 truncate">{app.customer_name}</h4>
                              <div className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1 truncate"><Phone className="w-3.5 h-3.5 shrink-0" /> {phoneFor(app.phone, profile)}</div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-1" />
                          </div>
                          {/* Dịch vụ */}
                          <p className="text-[13px] text-slate-500 truncate w-full">{app.service || 'Chưa chọn'}</p>
                          {/* Số tiền cọc + trạng thái */}
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-[18px] font-bold text-slate-900 tabular-nums">{Number(app.deposit_amount || 0).toLocaleString('vi-VN')}đ</span>
                            <span className={`e-badge e-badge-sm ${STATUS_STYLE[st]}`}>{st}</span>
                          </div>
                          {/* Chân thẻ */}
                          <div className="flex items-center justify-between gap-2 w-full pt-2 border-t border-dashed border-slate-200 text-[11.5px] text-slate-400">
                            <span>Tiền cọc</span>
                            <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {noteCount} mốc</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Hủy Cọc */}
      {showBongModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleBongSubmit} className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Hủy cọc: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowBongModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Lý do khách hủy cọc / không làm</label>
                <input required type="text" value={bongForm.notes} onChange={e => setBongForm({ ...bongForm, notes: e.target.value })} className="e-input" placeholder="Kẹt tiền, gia đình không cho..." />
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="submit" disabled={saving} className="e-btn e-btn-danger">{saving ? 'Đang lưu...' : 'Xác nhận hủy cọc'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Hoàn Cọc */}
      {showRefundModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRefundSubmit} className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title flex items-center gap-2"><Undo2 className="w-5 h-5 text-teal-600" /> Hoàn cọc: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowRefundModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div className="e-subtle px-4 py-3 flex items-center justify-between text-[13px]">
                <span className="text-slate-500">Đã cọc</span>
                <span className="font-bold text-slate-900 tabular-nums">{Number(selectedApp?.deposit_amount || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Số tiền hoàn (VNĐ)</label>
                  <MoneyInput required value={refundForm.refund_amount} onChange={v => setRefundForm({ ...refundForm, refund_amount: v })} className="e-input" placeholder="0" />
                </div>
                <div>
                  <label className="e-label">Ngày hoàn cọc</label>
                  <input required type="date" value={refundForm.refund_date} onChange={e => setRefundForm({ ...refundForm, refund_date: e.target.value })} className="e-input" />
                </div>
              </div>
              <div>
                <label className="e-label">Lý do hoàn cọc</label>
                <input type="text" value={refundForm.notes} onChange={e => setRefundForm({ ...refundForm, notes: e.target.value })} className="e-input" placeholder="Khách đổi ý, kẹt lịch..." />
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Hoàn cọc & chuyển sang Bong'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Lên Phẫu Thuật */}
      {showSurgeryModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSurgerySubmit} className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Lên Phẫu Thuật: {selectedApp?.customer_name}</h3>
              <button type="button" onClick={() => setShowSurgeryModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4 max-h-[70dvh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Ngày phẫu thuật</label>
                  <input required type="date" value={surgeryForm.expected_surgery_date} onChange={e => setSurgeryForm({ ...surgeryForm, expected_surgery_date: e.target.value })} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Giờ phẫu thuật <span className="text-slate-400 font-normal">(nếu có)</span></label>
                  <input type="time" value={surgeryForm.surgery_time} onChange={e => setSurgeryForm({ ...surgeryForm, surgery_time: e.target.value })} className="e-input" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Modal: Thêm khách cọc */}
      {showCreateModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCoc} className="e-modal max-w-lg overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">Thêm khách cọc</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="e-icon-btn w-9 h-9 shrink-0 border-transparent"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="e-modal-body space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Tên khách hàng *</label>
                  <input value={createForm.customer_name} onChange={e => setCreateForm(f => ({ ...f, customer_name: e.target.value }))} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Số điện thoại *</label>
                  <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Số tiền cọc</label>
                  <input inputMode="numeric" value={fmtInput(createForm.deposit_amount)} onChange={e => setCreateForm(f => ({ ...f, deposit_amount: e.target.value.replace(/\D/g, '') }))} placeholder="VD: 5.000.000" className="e-input" />
                </div>
                <div>
                  <label className="e-label">Ngày cọc *</label>
                  <input type="date" value={createForm.deposit_date} onChange={e => setCreateForm(f => ({ ...f, deposit_date: e.target.value }))} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Lịch hẹn / PT dự kiến</label>
                  <input type="date" value={createForm.expected_surgery_date} onChange={e => setCreateForm(f => ({ ...f, expected_surgery_date: e.target.value }))} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Dịch vụ dự kiến</label>
                  <input value={createForm.service} onChange={e => setCreateForm(f => ({ ...f, service: e.target.value }))} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Telesale phụ trách</label>
                  {profile?.role === 'telesale' ? (
                    <input disabled value={profile.full_name} className="e-input bg-slate-50 text-slate-500" />
                  ) : (
                    <select value={createForm.telesale_id} onChange={e => setCreateForm(f => ({ ...f, telesale_id: e.target.value }))} className="e-input">
                      <option value="">— Chọn telesale —</option>
                      {telesales.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="e-label">Sale Offline phụ trách</label>
                  {profile?.role === 'sale_offline' ? (
                    <input disabled value={profile.full_name} className="e-input bg-slate-50 text-slate-500" />
                  ) : (
                    <select value={createForm.sale_id} onChange={e => setCreateForm(f => ({ ...f, sale_id: e.target.value }))} className="e-input">
                      <option value="">— Chọn sale offline —</option>
                      {sales.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="e-label">Bill / Hoá đơn cọc</label>
                <label className="flex items-center gap-2 h-10 px-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-300 hover:bg-teal-50/40 text-[13px] text-slate-500">
                  <Upload className="w-4 h-4" /> {billFile ? billFile.name : 'Chọn ảnh bill...'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setBillFile(e.target.files[0] || null)} />
                </label>
              </div>

              <div>
                <label className="e-label">Note tình trạng</label>
                <textarea rows={2} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} className="e-textarea resize-none text-[14px] leading-relaxed" />
                <label className="mt-2 flex items-center gap-2 h-10 px-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-300 hover:bg-teal-50/40 text-[13px] text-slate-500">
                  <Upload className="w-4 h-4" /> {noteFiles.length ? `${noteFiles.length} ảnh đã chọn` : 'Thêm ảnh ghi chú...'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => setNoteFiles(Array.from(e.target.files || []))} />
                </label>
              </div>
            </div>
            <div className="e-modal-footer shrink-0">
              <button type="button" onClick={() => setShowCreateModal(false)} className="e-btn e-btn-secondary">Hủy</button>
              <button type="submit" disabled={creating} className="e-btn e-btn-primary">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Lưu khách cọc
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default KhachCocPage;
