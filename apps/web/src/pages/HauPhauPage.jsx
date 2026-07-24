import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Clock, MessageCircle, X, CheckCircle, Calendar, Phone, Image as ImageIcon, Loader2, Search, UserPlus, Plus, ChevronLeft, ChevronDown, ChevronUp, Upload, Download, QrCode, Copy, Printer, Star, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { uploadToR2, R2_PUBLIC_URL } from '@/lib/r2Client';
import { parseCSV, downloadCsv } from '@/lib/csv';
import { useAuth } from '@/contexts/AuthContext.jsx';
import MediaCustomerButton from '@/components/MediaCustomerButton.jsx';

const IMPORT_HEADERS = ['ngay_mo', 'ten_khach_hang', 'so_dien_thoai', 'dich_vu', 'ma_dieu_duong', 'ghi_chu'];
const IMPORT_TEMPLATE = IMPORT_HEADERS.join(',') + '\n' +
  '2026-05-10,Nguyễn Thị A,0901234567,Nâng mũi,NV010,Khách cũ chăm sóc lại\n' +
  '2026-04-22,Trần Văn B,0907654321,Gọt hàm,NV010,\n';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Đang theo dõi', label: 'Đang theo dõi' },
  { id: 'Tái khám', label: 'Tái khám' },
  { id: 'Đã ổn định', label: 'Đã ổn định' },
  { id: 'Có biến chứng', label: 'Có biến chứng' }
];

// Màu cho chip trạng thái
const STATUS_STYLE = {
  'Đang theo dõi': 'bg-amber-100 text-amber-700 border-amber-200',
  'Tái khám': 'bg-blue-100 text-blue-700 border-blue-200',
  'Đã ổn định': 'bg-teal-100 text-teal-700 border-teal-200',
  'Có biến chứng': 'bg-red-100 text-red-700 border-red-200',
};

// Thẻ ghi chú nhanh theo mốc chăm sóc hậu phẫu
const QUICK_NOTES = [
  'Vết thương khô, sạch', 'Đã cắt chỉ', 'Hết sưng nề', 'Ăn ngủ tốt',
  'Còn sưng nhẹ', 'Đã thay băng', 'Uống thuốc đầy đủ', 'Ổn định, bình thường',
  'Hẹn tái khám', 'Có dấu hiệu bất thường',
];

// CSKH: phân loại khách hàng
const CSKH_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Hài lòng', label: 'Hài lòng' },
  { id: 'Không hài lòng', label: 'Không hài lòng' },
  { id: 'Bình thường', label: 'Bình thường' },
  { id: 'Tiềm năng', label: 'Tiềm năng' },
  { id: 'Gặp vấn đề', label: 'Gặp vấn đề' },
];
const CSKH_STATUS_STYLE = {
  'Hài lòng': 'bg-teal-100 text-teal-700 border-teal-200',
  'Không hài lòng': 'bg-red-100 text-red-700 border-red-200',
  'Bình thường': 'bg-slate-100 text-slate-600 border-slate-200',
  'Tiềm năng': 'bg-violet-100 text-violet-700 border-violet-200',
  'Gặp vấn đề': 'bg-amber-100 text-amber-700 border-amber-200',
};
const CSKH_QUICK_NOTES = [
  'Đã gọi hỏi thăm', 'Khách hài lòng kết quả', 'Nhắc lịch tái khám',
  'Tư vấn dịch vụ mới', 'Khách phản hồi tốt', 'Cần theo dõi thêm',
  'Đã gửi ưu đãi', 'Khách hẹn quay lại',
];

const HauPhauPage = () => {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [mainTab, setMainTab] = useState('hau_phau'); // 'hau_phau' (<1 tháng) | 'cskh' (≥1 tháng)
  const [searchQuery, setSearchQuery] = useState('');

  const isHeadNurse = profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận';
  const isAdmin = profile?.role === 'admin';
  const isCskh = profile?.role === 'cskh' || profile?.role_2 === 'cskh';
  const isDieuDuong = profile?.role === 'dieu_duong' || profile?.role_2 === 'dieu_duong';
  const canSeeAll = isAdmin || isHeadNurse || isCskh;
  const canEditHauPhau = isAdmin || isDieuDuong;   // ghi nhật ký Hậu phẫu
  const canEditCskh = isAdmin || isCskh;            // ghi nhật ký CSKH

  // Trang chăm sóc riêng (full-page) + modal phân công
  const [careApp, setCareApp] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ id: null, additional_hau_phau_ids: [] });
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [reviewModal, setReviewModal] = useState(null);      // { app, url, dataUrl }
  const [creatingReview, setCreatingReview] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [form, setForm] = useState({ post_op_status: 'Đang theo dõi', post_op_notes: '', recheck_date: new Date().toISOString().split('T')[0], recheck_time: '09:00' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef(null);
  // Nhật ký CSKH (riêng của bộ phận CSKH)
  const [cskhForm, setCskhForm] = useState({ cskh_status: 'Bình thường', cskh_notes: '' });
  const [savingCskh, setSavingCskh] = useState(false);
  const [uploadingCskhImage, setUploadingCskhImage] = useState(false);
  const cskhFileRef = React.useRef(null);
  // CSKH: mặc định ẩn Nhật ký Hậu phẫu, bấm để hiện
  const [showHauPhauLog, setShowHauPhauLog] = useState(!isCskh);
  // Bổ sung / sửa số điện thoại ngay trong chi tiết chăm sóc
  const [phoneEdit, setPhoneEdit] = useState(false);
  const [phoneVal, setPhoneVal] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const savePhone = async () => {
    if (!careApp) return;
    const val = phoneVal.trim();
    setSavingPhone(true);
    const { error } = await supabase.from('customer_appointments').update({ phone: val || null }).eq('id', careApp.id);
    setSavingPhone(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã cập nhật số điện thoại');
    setCareApp(prev => prev ? { ...prev, phone: val || null } : prev);
    setPhoneEdit(false);
    loadData();
  };

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

  const handleCskhImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCskhImage(true);
    try {
      const url = await uploadToR2(file, 'cskh');
      setCskhForm(prev => ({ ...prev, cskh_notes: prev.cskh_notes + (prev.cskh_notes ? '\n' : '') + `[Ảnh đính kèm: ${url}]` }));
      toast.success('Đã tải ảnh lên!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    }
    setUploadingCskhImage(false);
    if (cskhFileRef.current) cskhFileRef.current.value = '';
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [appointmentsRes, nursesRes] = await Promise.all([
      supabase
        .from('customer_appointments')
        .select('*, hau_phau:profiles!hau_phau_id(full_name)')
        .eq('status', 'phau_thuat')
        .order('surgery_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, role')
    ]);

    if (appointmentsRes.error) {
      toast.error('Lỗi tải dữ liệu: ' + appointmentsRes.error.message);
    } else {
      let data = appointmentsRes.data || [];
      // Chỉ đẩy sang Hậu phẫu/CSKH khi đã phân công điều dưỡng trực hậu phẫu
      data = data.filter(d => d.hau_phau_id);
      // Điều dưỡng thường chỉ thấy ca được phân công; admin/trưởng bp/CSKH thấy tất cả
      if (!canSeeAll && profile?.id) {
         data = data.filter(d => d.hau_phau_id === profile.id || (d.additional_hau_phau_ids && d.additional_hau_phau_ids.includes(profile.id)));
      }
      setCustomers(data);
    }

    if (nursesRes.data) {
      setNurses(nursesRes.data);
    }
    setLoading(false);
  }, [profile, canSeeAll]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments', loadData);

  // Tạo (hoặc lấy lại) phiếu đánh giá dịch vụ → QR gửi khách.
  // Ở bước hậu phẫu mới đủ TOÀN BỘ nhân sự đã chăm khách (bác sĩ, phụ mổ,
  // trực đêm, điều dưỡng hậu phẫu, telesale/sale tiếp đón).
  const createReview = async (app) => {
    setCreatingReview(true);
    try {
      const staffMap = {};
      nurses.forEach(s => { staffMap[s.id] = s; });
      const nm = (id) => (id && staffMap[id] ? { id, name: staffMap[id].full_name } : null);
      const uniq = (arr) => arr.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      const nurseIds = uniq([
        app.phu_mo_1_id, app.phu_mo_2_id, app.phu_mo_3_id,
        app.hau_phau_id, ...(app.additional_hau_phau_ids || []),
        app.truc_dem_id, app.truc_dem_id_2,
      ]);
      const consultantIds = uniq([app.telesale_id, app.telesale_id_2, app.sale_id]);
      const staff_snapshot = {
        doctor: nm(app.bac_si_id) || null,
        nurses: nurseIds.map(nm).filter(Boolean),
        consultants: consultantIds.map(nm).filter(Boolean),
      };

      let token;
      const { data: existing } = await supabase.from('service_review_invitations')
        .select('token').eq('appointment_id', app.id).in('status', ['pending', 'opened'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing?.token) {
        token = existing.token;
      } else {
        const { data: created, error } = await supabase.from('service_review_invitations')
          .insert({
            appointment_id: app.id,
            customer_name: app.customer_name,
            phone: app.phone || null,
            service: app.service || null,
            surgery_date: app.surgery_date || null,
            staff_snapshot,
            milestone: 'D14_30',
            channel: 'qr',
            created_by: profile?.id || null,
          })
          .select('token').single();
        if (error) throw error;
        token = created.token;
      }
      const url = `${window.location.origin}/danh-gia/${token}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
      setReviewModal({ app, url, dataUrl });
    } catch (err) {
      toast.error('Lỗi tạo phiếu đánh giá: ' + (err.message || err));
    }
    setCreatingReview(false);
  };

  const copyReviewLink = () => {
    if (!reviewModal) return;
    navigator.clipboard?.writeText(reviewModal.url).then(() => toast.success('Đã sao chép link!'), () => {});
  };
  const shareReview = async () => {
    if (!reviewModal || !navigator.share) { copyReviewLink(); return; }
    try {
      await navigator.share({ title: 'Đánh giá dịch vụ', text: `Kính mời ${reviewModal.app.customer_name || 'quý khách'} đánh giá dịch vụ:`, url: reviewModal.url });
    } catch { /* user cancelled */ }
  };
  const printReview = () => {
    if (!reviewModal) return;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Trình duyệt chặn cửa sổ in.'); return; }
    w.document.write(`<html><head><title>Phiếu đánh giá</title></head><body style="font-family:sans-serif;text-align:center;padding:32px">
      <h2 style="margin:0 0 4px">Đánh giá dịch vụ</h2>
      <p style="color:#555;margin:0 0 4px">${reviewModal.app.customer_name || ''}</p>
      <p style="color:#888;margin:0 0 16px;font-size:13px">${reviewModal.app.service || ''}</p>
      <img src="${reviewModal.dataUrl}" style="width:300px;height:300px" />
      <p style="margin-top:16px;font-size:14px">Quét mã QR để đánh giá dịch vụ</p>
      <p style="color:#0d9488;font-size:12px;word-break:break-all">${reviewModal.url}</p>
    </body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const openCare = (app) => {
    setSelectedApp(app);
    setCareApp(app);
    setPhoneEdit(false);
    setForm({
      post_op_status: app.post_op_status || 'Đang theo dõi',
      post_op_notes: '',
      recheck_date: new Date().toISOString().split('T')[0],
      recheck_time: '09:00'
    });
    setCskhForm({ cskh_status: app.cskh_status || 'Bình thường', cskh_notes: '' });
  };

  useEffect(() => {
    const focusId = sessionStorage.getItem('focusHauPhauId');
    if (focusId && customers.length > 0) {
      const app = customers.find(c => c.id === focusId);
      if (app) {
        openCare(app);
        sessionStorage.removeItem('focusHauPhauId');
      }
    }
  }, [customers]);

  // Đồng bộ trang chăm sóc với dữ liệu mới (khi loadData/realtime cập nhật)
  useEffect(() => {
    if (!careApp) return;
    const fresh = customers.find(c => c.id === careApp.id);
    if (fresh) setCareApp(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const addQuickNote = (text) => setForm(f => ({ ...f, post_op_notes: f.post_op_notes + (f.post_op_notes ? '\n' : '') + text }));
  const addCskhQuickNote = (text) => setCskhForm(f => ({ ...f, cskh_notes: f.cskh_notes + (f.cskh_notes ? '\n' : '') + text }));

  // Lưu nhật ký CSKH (phân loại + ghi chú + ảnh) — riêng bộ phận CSKH
  const handleSaveCskh = async () => {
    if (!careApp) return;
    setSavingCskh(true);
    const newNote = cskhForm.cskh_notes ? `\n[${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}] ${cskhForm.cskh_notes}` : '';
    const updatedNotes = (careApp.cskh_notes || '') + newNote;
    const { error } = await supabase.from('customer_appointments')
      .update({ cskh_status: cskhForm.cskh_status || null, cskh_notes: updatedNotes })
      .eq('id', careApp.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Đã lưu nhật ký CSKH!');
      setCareApp(prev => prev ? { ...prev, cskh_status: cskhForm.cskh_status || null, cskh_notes: updatedNotes } : prev);
      setCskhForm(f => ({ ...f, cskh_notes: '' }));
      loadData();
    }
    setSavingCskh(false);
  };

  // ----- Import khách hàng chăm sóc -----
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportPreview(null);
    const rows = parseCSV(await file.text());
    if (rows.length < 2) { toast.error('File trống hoặc thiếu dữ liệu'); e.target.value = ''; return; }

    const { data: profs } = await supabase.from('profiles').select('id, employee_id');
    const empMap = {};
    (profs || []).forEach(p => { if (p.employee_id) empMap[p.employee_id.trim().toUpperCase()] = p.id; });

    const valid = [], errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (idx) => (r[idx] || '').trim();
      const lineNo = i + 1;
      const date = get(0), name = get(1), nurseCode = get(4).toUpperCase();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Dòng ${lineNo}: ngày mổ sai định dạng (YYYY-MM-DD)`); continue; }
      if (!name) { errors.push(`Dòng ${lineNo}: thiếu tên khách hàng`); continue; }
      if (!nurseCode) { errors.push(`Dòng ${lineNo}: thiếu mã điều dưỡng phụ trách`); continue; }
      if (!empMap[nurseCode]) { errors.push(`Dòng ${lineNo}: không tìm thấy mã điều dưỡng "${nurseCode}"`); continue; }
      const ghichu = get(5);
      valid.push({
        customer_name: name, phone: get(2),
        appointment_date: date, surgery_date: date,
        service: get(3) || null,
        hau_phau_id: empMap[nurseCode],
        status: 'phau_thuat', post_op_status: 'Đang theo dõi',
        post_op_notes: ghichu ? `[${new Date().toLocaleDateString('vi-VN')}] ${ghichu}` : null,
        customer_source: 'CSKH', customer_type: 'Cũ',
      });
    }
    setImportPreview({ valid, errors });
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importPreview?.valid?.length) { toast.error('Không có dòng hợp lệ'); return; }
    setImporting(true);
    try {
      const { error } = await supabase.from('customer_appointments').insert(importPreview.valid);
      if (error) throw error;
      toast.success(`Đã import ${importPreview.valid.length} khách`);
      setShowImportModal(false); setImportPreview(null);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEditHauPhau) return; // CSKH chỉ xem nhật ký hậu phẫu, không ghi
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
      toast.success('Đã lưu mốc chăm sóc!');
      setCareApp(prev => prev ? { ...prev, post_op_status: form.post_op_status, post_op_notes: updatedNotes } : prev);
      setForm(f => ({ ...f, post_op_notes: '' }));
      loadData();
    }
    setSaving(false);
  };

  const handleAssignMoreSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNurseId) {
      toast.error('Vui lòng chọn nhân sự!');
      return;
    }
    
    if (assignForm.additional_hau_phau_ids.includes(selectedNurseId)) {
      toast.error('Nhân sự này đã được phân công từ trước!');
      return;
    }

    setSaving(true);
    try {
      const newIds = [...assignForm.additional_hau_phau_ids, selectedNurseId];
      const { error } = await supabase
        .from('customer_appointments')
        .update({ additional_hau_phau_ids: newIds })
        .eq('id', assignForm.id);

      if (error) throw error;
      toast.success('Phân công thêm thành công!');
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      toast.error('Lỗi phân công: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Phân loại theo tuổi ca mổ: <1 tháng = Hậu phẫu, ≥1 tháng = CSKH
  const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const isOldCase = (c) => c.surgery_date && new Date(c.surgery_date) < oneMonthAgo;
  const mainTabCustomers = customers.filter(c => mainTab === 'cskh' ? isOldCase(c) : !isOldCase(c));
  const hauPhauCount = customers.filter(c => !isOldCase(c)).length;
  const cskhCount = customers.filter(c => isOldCase(c)).length;

  // Tab lọc: Hậu phẫu theo trạng thái hậu phẫu; CSKH theo phân loại khách
  const isCskhTab = mainTab === 'cskh';
  const FILTER_TABS = isCskhTab ? CSKH_TABS : TABS;
  const statusOf = (c) => isCskhTab ? (c.cskh_status || '') : (c.post_op_status || 'Đang theo dõi');
  const statusCountOf = (id) => id === 'all' ? mainTabCustomers.length : mainTabCustomers.filter(c => statusOf(c) === id).length;

  let filteredCustomers = activeTab === 'all' ? mainTabCustomers : mainTabCustomers.filter(c => statusOf(c) === activeTab);

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
          const url = imgMatch[1];
          // Chỉ hiển thị ảnh từ domain R2 (tránh auto-load URL ngoài lạ)
          if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
            return <a key={i} href={url} target="_blank" rel="noreferrer noopener" className="text-xs text-slate-400 underline mx-1">[ảnh ngoài]</a>;
          }
          return (
            <div key={i} onClick={() => setViewImage(url)} className="inline-block mt-1.5 mb-2 cursor-pointer">
              <img src={url} alt="attachment" className="max-h-28 rounded-lg border border-slate-200 shadow-sm object-cover hover:opacity-90 transition-opacity" />
            </div>
          );
        }
        return <span key={i}>{part}</span>;
      });

      elements.push(<div key={`line-${index}`} className="mb-0.5">{lineContent}</div>);
    });
    
    return elements;
  };

  // ===== TRANG CHĂM SÓC RIÊNG (full-page) =====
  if (careApp) {
    const st = form.post_op_status;
    const addNurses = (careApp.additional_hau_phau_ids || []).map(id => nurses.find(n => n.id === id)?.full_name || id);
    return (
      <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-4 pb-32">
        <button type="button" onClick={() => setCareApp(null)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold">
          <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
        </button>

        {/* Thông tin khách */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-800">{careApp.customer_name}</h2>
              {phoneEdit ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <input value={phoneVal} onChange={e => setPhoneVal(e.target.value)} inputMode="tel" autoFocus placeholder="Nhập số điện thoại"
                    className="text-sm border rounded-lg px-2 py-1 outline-none focus:border-teal-500 w-40" />
                  <button type="button" onClick={savePhone} disabled={savingPhone} className="text-xs font-semibold text-white bg-teal-600 px-2.5 py-1 rounded-lg disabled:opacity-50">{savingPhone ? '...' : 'Lưu'}</button>
                  <button type="button" onClick={() => setPhoneEdit(false)} className="text-xs text-slate-400 px-1">Huỷ</button>
                </div>
              ) : (
                <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  <Phone className="w-4 h-4 shrink-0" />
                  {careApp.phone ? <a href={`tel:${careApp.phone}`} className="text-teal-700 font-medium">{careApp.phone}</a> : <span className="text-slate-400 italic">Chưa có SĐT</span>}
                  <button type="button" onClick={() => { setPhoneVal(careApp.phone || ''); setPhoneEdit(true); }} className="text-xs font-semibold text-teal-600 hover:underline ml-1">{careApp.phone ? 'Sửa' : '+ Thêm'}</button>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${STATUS_STYLE[careApp.post_op_status || 'Đang theo dõi']}`}>
                {careApp.post_op_status || 'Đang theo dõi'}
              </span>
              {careApp.cskh_status && <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${CSKH_STATUS_STYLE[careApp.cskh_status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>CSKH: {careApp.cskh_status}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm bg-slate-50 p-3 rounded-xl">
            <div className="text-slate-500 text-xs">Dịch vụ</div>
            <div className="font-semibold text-slate-800 text-right">{careApp.service || '—'}</div>
            <div className="text-slate-500 text-xs">Ngày mổ</div>
            <div className="text-slate-700 text-right">{careApp.surgery_date ? new Date(careApp.surgery_date).toLocaleDateString('vi-VN') : '—'}</div>
            <div className="text-slate-500 text-xs">Phụ trách</div>
            <div className="text-slate-700 text-right">{careApp.hau_phau?.full_name || 'N/A'}{addNurses.length > 0 && <span className="text-xs text-slate-400"> + {addNurses.join(', ')}</span>}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canSeeAll && (
              <button type="button" onClick={() => { setAssignForm({ id: careApp.id, additional_hau_phau_ids: careApp.additional_hau_phau_ids || [] }); setSelectedNurseId(''); setShowAssignModal(true); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <UserPlus className="w-4 h-4" /> Phân công thêm điều dưỡng
              </button>
            )}
            <MediaCustomerButton appointment={careApp} me={profile}
              canAdd={['media', 'dieu_duong', 'cskh', 'marketing', 'admin'].some(r => [profile?.role, profile?.role_2].includes(r))} />
            <button type="button" onClick={() => createReview(careApp)} disabled={creatingReview}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 px-3.5 py-1.5 rounded-lg shadow-sm disabled:opacity-60">
              {creatingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Tạo phiếu đánh giá
            </button>
          </div>
        </div>

        {/* Nhật ký Hậu phẫu (thread) — CSKH mặc định ẩn, bấm để hiện */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-teal-600" /> Nhật ký Hậu phẫu</h3>
            <button type="button" onClick={() => setShowHauPhauLog(v => !v)} className="shrink-0 text-xs font-semibold text-teal-600 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 inline-flex items-center gap-1">
              {showHauPhauLog ? <><ChevronUp className="w-3.5 h-3.5" /> Ẩn</> : <><ChevronDown className="w-3.5 h-3.5" /> Hiện</>}
            </button>
          </div>
          {showHauPhauLog && (
            <div className="text-sm text-slate-700 max-h-[40vh] overflow-y-auto pr-1 mt-3">
              {careApp.post_op_notes ? renderNotes(careApp.post_op_notes) : <div className="text-slate-400 text-center py-6">Chưa có ghi chú nào</div>}
            </div>
          )}
        </div>

        {/* Thêm mốc Hậu phẫu — chỉ điều dưỡng / admin (CSKH chỉ xem) */}
        {canEditHauPhau && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-slate-800">Thêm mốc chăm sóc</h3>
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-600">Cập nhật trạng thái</label>
            <div className="flex flex-wrap gap-2">
              {TABS.filter(t => t.id !== 'all').map(t => (
                <button key={t.id} type="button" onClick={() => setForm({ ...form, post_op_status: t.id })}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${st === t.id ? STATUS_STYLE[t.id] + ' ring-2 ring-offset-1 ring-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {st === 'Tái khám' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100">
              <div>
                <label className="block text-xs font-semibold mb-1 text-blue-800">Ngày tái khám</label>
                <input type="date" required value={form.recheck_date} onChange={e => setForm({ ...form, recheck_date: e.target.value })} className="w-full border border-blue-200 p-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-blue-800">Giờ hẹn</label>
                <input type="time" required value={form.recheck_time} onChange={e => setForm({ ...form, recheck_time: e.target.value })} className="w-full border border-blue-200 p-2 rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {QUICK_NOTES.map(q => (
              <button key={q} type="button" onClick={() => addQuickNote(q)}
                className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-100 hover:bg-teal-100">
                + {q}
              </button>
            ))}
          </div>
          <textarea rows={3} value={form.post_op_notes} onChange={e => setForm({ ...form, post_op_notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 resize-none text-sm" placeholder="Gõ ghi chú hoặc chạm thẻ nhanh phía trên..." />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="text-teal-600 hover:bg-teal-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border border-teal-100">
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Thêm ảnh
            </button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700">{saving ? 'Đang lưu...' : 'Lưu mốc'}</button>
          </div>
        </div>
        )}

        {/* Nhật ký CSKH (thread) — mọi người xem được */}
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
          <h3 className="font-bold text-violet-800 mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-violet-600" /> Nhật ký CSKH</h3>
          <div className="text-sm text-slate-700 max-h-[40vh] overflow-y-auto pr-1">
            {careApp.cskh_notes ? renderNotes(careApp.cskh_notes) : <div className="text-slate-400 text-center py-6">Chưa có ghi chú CSKH nào</div>}
          </div>
        </div>

        {/* Thêm mốc CSKH — chỉ CSKH / admin */}
        {canEditCskh && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-slate-800">Thêm mốc CSKH</h3>
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-600">Phân loại khách hàng</label>
            <div className="flex flex-wrap gap-2">
              {CSKH_TABS.filter(t => t.id !== 'all').map(t => (
                <button key={t.id} type="button" onClick={() => setCskhForm({ ...cskhForm, cskh_status: t.id })}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${cskhForm.cskh_status === t.id ? CSKH_STATUS_STYLE[t.id] + ' ring-2 ring-offset-1 ring-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CSKH_QUICK_NOTES.map(q => (
              <button key={q} type="button" onClick={() => addCskhQuickNote(q)}
                className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium border border-violet-100 hover:bg-violet-100">
                + {q}
              </button>
            ))}
          </div>
          <textarea rows={3} value={cskhForm.cskh_notes} onChange={e => setCskhForm({ ...cskhForm, cskh_notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-violet-500 resize-none text-sm" placeholder="Ghi chú chăm sóc CSKH, phản hồi của khách…" />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => cskhFileRef.current?.click()} disabled={uploadingCskhImage} className="text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border border-violet-100">
              {uploadingCskhImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Thêm ảnh
            </button>
            <input type="file" accept="image/*" className="hidden" ref={cskhFileRef} onChange={handleCskhImageUpload} />
            <button type="button" onClick={handleSaveCskh} disabled={savingCskh} className="px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700">{savingCskh ? 'Đang lưu...' : 'Lưu mốc CSKH'}</button>
          </div>
        </div>
        )}

        {/* Modal phân công + xem ảnh dùng chung (render dưới) */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Phân công thêm Điều dưỡng</h3>
                <button type="button" onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-semibold mb-2">Chọn nhân sự Điều dưỡng</label>
                <select value={selectedNurseId} onChange={e => setSelectedNurseId(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                  <option value="">-- Chọn Điều dưỡng --</option>
                  {nurses.filter(n => n.role === 'dieu_duong' && !assignForm.additional_hau_phau_ids.includes(n.id)).map(n => (
                    <option key={n.id} value={n.id}>{n.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button type="button" onClick={handleAssignMoreSubmit} disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">{saving ? 'Đang lưu...' : 'Lưu phân công'}</button>
              </div>
            </div>
          </div>
        )}
        {viewImage && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
            <img src={viewImage} alt="" className="max-w-full max-h-[88vh] rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      <div className="flex-1 min-w-0 space-y-4 w-full">
        {/* Header gọn: tiêu đề + nút Import nhỏ */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{mainTab === 'cskh' ? 'Chăm sóc khách hàng' : 'Chăm sóc Hậu phẫu'}</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate">{mainTab === 'cskh' ? 'Khách đã mổ trên 1 tháng' : 'Khách mổ trong vòng 1 tháng — theo dõi sau mổ'}</p>
          </div>
          {canSeeAll && (
            <button onClick={() => { setImportPreview(null); setShowImportModal(true); }} className="shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-teal-600 text-white text-sm font-semibold shadow-sm shadow-teal-600/20 hover:bg-teal-700 active:scale-95 transition">
              <Upload className="w-4 h-4" /> Import
            </button>
          )}
        </div>

        {/* Segmented Hậu phẫu / CSKH — 2 dòng, có đếm */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl">
          {[
            { id: 'hau_phau', label: 'Hậu phẫu', sub: `<1 tháng · ${hauPhauCount}` },
            { id: 'cskh', label: 'CSKH', sub: `≥1 tháng · ${cskhCount}` },
          ].map(t => (
            <button key={t.id} onClick={() => { setMainTab(t.id); setActiveTab('all'); }}
              className={`py-2 rounded-xl text-center transition-all ${mainTab === t.id ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500'}`}>
              <div className="text-sm font-bold">{t.label}</div>
              <div className={`text-[11px] ${mainTab === t.id ? 'text-teal-500' : 'text-slate-400'}`}>{t.sub}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Tìm tên KH hoặc số điện thoại…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-10 pr-4 h-11 rounded-2xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 transition-all" />
        </div>

        {/* Filter chips — 1 hàng cuộn ngang, có đếm */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {FILTER_TABS.map(tab => {
            const active = activeTab === tab.id;
            const n = statusCountOf(tab.id);
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all inline-flex items-center gap-1.5 ${active ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 active:bg-slate-50'}`}>
                {tab.label}
                <span className={`text-[11px] font-bold px-1.5 rounded-full ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Không có khách hàng nào trong mục này
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedCustomers).map(([date, apps]) => (
              <div key={date} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-4 h-4 text-teal-500" />
                  <h3 className="text-[13px] font-bold text-slate-500">Mổ ngày {date}</h3>
                  <span className="text-xs font-semibold text-slate-300">· {apps.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {apps.map(app => {
                    const st = isCskhTab ? (app.cskh_status || 'Chưa phân loại') : (app.post_op_status || 'Đang theo dõi');
                    const stCls = isCskhTab
                      ? (CSKH_STATUS_STYLE[app.cskh_status] || 'bg-slate-100 text-slate-500 border-slate-200')
                      : (STATUS_STYLE[st] || STATUS_STYLE['Đang theo dõi']);
                    const notesSrc = isCskhTab ? app.cskh_notes : app.post_op_notes;
                    const noteCount = notesSrc ? notesSrc.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
                    return (
                    <button key={app.id} type="button" onClick={() => openCare(app)}
                      className="text-left bg-white rounded-2xl border border-slate-100 p-4 shadow-sm active:scale-[0.99] hover:border-teal-300 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 truncate leading-tight">{app.customer_name}</h4>
                          <div className="text-slate-400 text-xs mt-1 flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone || <span className="italic text-slate-300">Chưa có SĐT</span>}</div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${stCls}`}>{st}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs min-w-0">
                        <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 font-medium truncate max-w-[58%]">{app.service || 'Chưa rõ DV'}</span>
                        <span className="text-slate-300 shrink-0">·</span>
                        <span className="text-slate-500 truncate min-w-0">{app.hau_phau?.full_name || 'Chưa phân công'}</span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> {noteCount} ghi chú</span>
                        <span className="text-teal-600 font-bold inline-flex items-center gap-1">Mở nhật ký <span className="inline-block w-[7px] h-[7px] border-t-2 border-r-2 border-current rotate-45 -ml-0.5" /></span>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div> {/* End main content */}


      {/* Modal Phân công thêm */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAssignMoreSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 text-lg">Phân công thêm Điều dưỡng</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold mb-2">Chọn nhân sự Điều dưỡng</label>
              <select required value={selectedNurseId} onChange={e => setSelectedNurseId(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500">
                <option value="">-- Chọn Điều dưỡng --</option>
                {nurses.filter(n => n.role === 'dieu_duong' && !assignForm.additional_hau_phau_ids.includes(n.id)).map(n => (
                  <option key={n.id} value={n.id}>{n.full_name}</option>
                ))}
              </select>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">{saving ? 'Đang lưu...' : 'Lưu phân công'}</button>
            </div>
          </form>
        </div>
      )}

      {/* QR phiếu đánh giá dịch vụ */}
      {reviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setReviewModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-teal-500 to-emerald-500 px-6 pt-6 pb-8 text-center relative">
              <button onClick={() => setReviewModal(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:bg-white/20"><X className="w-4 h-4" /></button>
              <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center mx-auto mb-2"><Star className="w-6 h-6 text-white" /></div>
              <h3 className="font-bold text-white text-lg">Phiếu đánh giá dịch vụ</h3>
              <p className="text-teal-50 text-sm mt-0.5">{reviewModal.app.customer_name}</p>
            </div>
            <div className="px-6 -mt-5">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 flex flex-col items-center">
                <img src={reviewModal.dataUrl} alt="QR đánh giá" className="w-56 h-56" />
                <p className="text-xs text-slate-400 mt-2 text-center">Cho khách quét mã QR để đánh giá dịch vụ</p>
              </div>
            </div>
            <div className="p-6 pt-4 space-y-2">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <span className="text-xs text-slate-500 truncate flex-1">{reviewModal.url}</span>
                <button onClick={copyReviewLink} className="shrink-0 text-teal-600 hover:text-teal-700"><Copy className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={copyReviewLink} className="py-2.5 rounded-xl bg-teal-50 text-teal-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-teal-100"><Copy className="w-4 h-4" /> Sao chép</button>
                <button onClick={shareReview} className="py-2.5 rounded-xl bg-blue-50 text-blue-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-blue-100"><Share2 className="w-4 h-4" /> Chia sẻ</button>
                <button onClick={printReview} className="py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-slate-200"><Printer className="w-4 h-4" /> In</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <div className="relative max-w-5xl w-full flex justify-center">
            <button onClick={() => setViewImage(null)} className="absolute -top-12 right-0 md:-right-12 text-white hover:text-slate-300 p-2">
              <X className="w-8 h-8" />
            </button>
            <img src={viewImage} alt="Phóng to" className="max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Modal Import khách hàng chăm sóc */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-teal-50 shrink-0">
              <h3 className="font-bold text-teal-800">Import khách hàng chăm sóc</h3>
              <button onClick={() => { setShowImportModal(false); setImportPreview(null); }} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-600 space-y-2">
                <div className="font-semibold text-blue-700">Các cột BẮT BUỘC đúng thứ tự (dòng đầu là tiêu đề):</div>
                <ol className="list-decimal ml-5 space-y-0.5 text-xs">
                  <li><b>ngay_mo</b> — định dạng <code>YYYY-MM-DD</code> (khách mổ ≥1 tháng sẽ vào tab CSKH)</li>
                  <li><b>ten_khach_hang</b></li>
                  <li><b>so_dien_thoai</b></li>
                  <li><b>dich_vu</b></li>
                  <li><b>ma_dieu_duong</b> — mã NV điều dưỡng phụ trách (vd NV010) <b>bắt buộc</b></li>
                  <li><b>ghi_chu</b> — ghi chú đầu tiên (tùy chọn)</li>
                </ol>
                <button onClick={() => downloadCsv('mau_import_khach_cham_soc.csv', IMPORT_TEMPLATE)} className="mt-1 inline-flex items-center gap-1.5 text-teal-700 font-semibold hover:underline">
                  <Download className="w-4 h-4" /> Tải file mẫu (.csv)
                </button>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-teal-300 rounded-xl cursor-pointer hover:bg-teal-50 text-teal-700 font-semibold">
                <Upload className="w-5 h-5" /> Chọn file CSV để tải lên
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </label>

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-700 font-semibold">{importPreview.valid.length} dòng hợp lệ</span>
                    {importPreview.errors.length > 0 && <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 font-semibold">{importPreview.errors.length} dòng lỗi</span>}
                  </div>
                  {importPreview.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5">
                      {importPreview.errors.map((er, i) => <div key={i}>• {er}</div>)}
                    </div>
                  )}
                  {importPreview.valid.length > 0 && (
                    <div className="border border-slate-100 rounded-xl max-h-48 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr>
                          <th className="text-left px-3 py-2">Ngày mổ</th><th className="text-left px-3 py-2">Khách</th><th className="text-left px-3 py-2">Dịch vụ</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {importPreview.valid.slice(0, 50).map((v, i) => (
                            <tr key={i}><td className="px-3 py-1.5">{v.surgery_date}</td><td className="px-3 py-1.5">{v.customer_name}</td><td className="px-3 py-1.5">{v.service || '—'}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => { setShowImportModal(false); setImportPreview(null); }} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-white">Hủy</button>
              <button onClick={handleImport} disabled={importing || !importPreview?.valid?.length} className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-xl text-sm hover:bg-teal-700 disabled:opacity-50">
                {importing ? 'Đang import...' : `Import ${importPreview?.valid?.length || 0} khách`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HauPhauPage;
