import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { Clock, MessageCircle, X, CheckCircle, Calendar, Phone, Image as ImageIcon, Loader2, Search, UserPlus, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Upload, Download, QrCode, Copy, Printer, Star, Share2, Users, CalendarClock, ShieldCheck, Heart, Activity, AlertTriangle, ClipboardList, CircleDot, Check, Headset, SlidersHorizontal, List, LayoutGrid } from 'lucide-react';
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

// Các mốc hồi phục sau phẫu thuật
const MILESTONE_DEFS = [
  { key: 'd0', label: 'Ngày phẫu thuật', off: 0, desc: 'Phẫu thuật, theo dõi sinh hiệu' },
  { key: 'd1', label: 'Ngày 1', off: 1, desc: 'Theo dõi đau, chảy máu' },
  { key: 'd2', label: 'Ngày 2', off: 2, desc: 'Thay băng, vệ sinh vết mổ' },
  { key: 'd7', label: 'Ngày 7', off: 7, desc: 'Cắt chỉ, đánh giá tổng quan' },
  { key: 'd14', label: 'Ngày 14', off: 14, desc: 'Tái khám, đánh giá hồi phục' },
  { key: 'd30', label: 'Ngày 30', off: 30, desc: 'Đánh giá kết quả & lưu hồ sơ' },
];

// Dấu hiệu cần lưu ý (tick nhiều → nguy cơ cao)
const WARNING_SIGNS = ['Sốt ≥ 38°C', 'Chảy máu kéo dài', 'Sưng đau tăng dần', 'Chảy dịch/mủ', 'Tê bì kéo dài'];

const RISK_STYLE = {
  'Thấp': { c: 'text-emerald-600', bg: 'bg-emerald-50', ring: '#10b981', dot: 'bg-emerald-500' },
  'Trung bình': { c: 'text-amber-600', bg: 'bg-amber-50', ring: '#f59e0b', dot: 'bg-amber-500' },
  'Cao': { c: 'text-rose-600', bg: 'bg-rose-50', ring: '#f43f5e', dot: 'bg-rose-500' },
};

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const initialsOf = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

// Dựng danh sách mốc (kết hợp mốc đã lưu + tính ngày theo ngày mổ)
const buildMilestones = (app) => {
  const saved = Array.isArray(app?.care_milestones) ? app.care_milestones : [];
  const savedMap = {}; saved.forEach(m => { if (m?.key) savedMap[m.key] = m; });
  const surg = app?.surgery_date ? startOfDay(app.surgery_date) : null;
  const today = startOfDay(new Date());
  return MILESTONE_DEFS.map(def => {
    const s = savedMap[def.key] || {};
    const date = surg ? new Date(surg.getTime() + def.off * 86400000) : null;
    let status = 'pending';
    if (s.done) status = 'done';
    else if (date && startOfDay(date) <= today) status = 'active'; // đến hạn / đang tới
    return { ...def, date, status, done: !!s.done, nurse_id: s.nurse_id || null, note: s.note || '', done_at: s.done_at || null };
  });
};

// Chỉ số tự tính từ mốc + dấu hiệu + đánh giá
const computeMetrics = (app, ms, satisfaction) => {
  const total = ms.length;
  const reached = ms.filter(m => m.status !== 'pending');
  const done = ms.filter(m => m.done);
  const progress = total ? Math.round((reached.length / total) * 100) : 0;
  const careScore = reached.length ? Math.round((done.length / reached.length) * 100) : 0;
  const signs = Array.isArray(app?.warning_signs) ? app.warning_signs.length : 0;
  let risk = 'Thấp';
  if (app?.post_op_status === 'Có biến chứng' || signs >= 3) risk = 'Cao';
  else if (signs >= 1) risk = 'Trung bình';
  return { progress, careScore, risk, reached: reached.length, total, satisfaction };
};

const HauPhauPage = () => {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [mainTab, setMainTab] = useState('hau_phau'); // 'hau_phau' (<1 tháng) | 'cskh' (≥1 tháng)
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('hp_view_mode') || 'list'); // 'list' | 'card'
  useEffect(() => { localStorage.setItem('hp_view_mode', viewMode); }, [viewMode]);

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
  const [form, setForm] = useState({ post_op_status: 'Đang theo dõi', post_op_notes: '', recheck_date: new Date().toISOString().split('T')[0], recheck_time: '09:00', warning_signs: [], next_recheck: '' });
  const [milestoneEdit, setMilestoneEdit] = useState(null); // { key, label, ... } đang sửa
  const [savingMilestone, setSavingMilestone] = useState(false);
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

  // Ảnh CHỜ GỬI: up vào khay xem trước (không chèn link vào ô ghi chú), lưu mới ghép vào nhật ký
  const [pendingImgs, setPendingImgs] = useState([]);
  const [pendingCskhImgs, setPendingCskhImgs] = useState([]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImage(true);
    let ok = 0;
    for (const file of files) {
      try { const url = await uploadToR2(file, 'hau-phau'); setPendingImgs(prev => [...prev, url]); ok++; }
      catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    }
    if (ok) toast.success(`Đã tải ${ok} ảnh — bấm "Lưu cập nhật" để ghi vào nhật ký`);
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCskhImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingCskhImage(true);
    let ok = 0;
    for (const file of files) {
      try { const url = await uploadToR2(file, 'cskh'); setPendingCskhImgs(prev => [...prev, url]); ok++; }
      catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    }
    if (ok) toast.success(`Đã tải ${ok} ảnh — bấm "Lưu mốc CSKH" để ghi vào nhật ký`);
    setUploadingCskhImage(false);
    if (cskhFileRef.current) cskhFileRef.current.value = '';
  };

  // Khay ảnh chờ gửi (dùng chung 2 form)
  const PendingStrip = ({ imgs, onRemove }) => imgs.length === 0 ? null : (
    <div className="flex flex-wrap gap-2 mt-2">
      {imgs.map((u, i) => (
        <div key={u + i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img src={u} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onRemove(i)} className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );

  const [satByAppt, setSatByAppt] = useState({}); // appointment_id -> điểm hài lòng (1-5)

  const loadData = useCallback(async () => {
    setLoading(true);
    const [appointmentsRes, nursesRes, reviewRes] = await Promise.all([
      supabase
        .from('customer_appointments')
        .select('*, hau_phau:profiles!hau_phau_id(full_name)')
        .eq('status', 'phau_thuat')
        .order('surgery_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, role'),
      supabase
        .from('service_review_responses')
        .select('overall_score, invitation:service_review_invitations(appointment_id, is_resurvey)')
        .limit(5000),
    ]);

    // Điểm hài lòng theo ca (lấy phản hồi mới nhất, bỏ khảo sát lại)
    const sat = {};
    (reviewRes?.data || []).forEach(r => {
      const aid = r.invitation?.appointment_id;
      if (!aid || r.invitation?.is_resurvey || r.overall_score == null) return;
      if (sat[aid] == null) sat[aid] = Number(r.overall_score);
    });
    setSatByAppt(sat);

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
      // Điều dưỡng chăm khách = điều dưỡng TRỰC ĐÊM (chỉ đánh giá đúng người này)
      const nurseIds = uniq([app.truc_dem_id, app.truc_dem_id_2]);
      // Tách rõ Telesale (gọi điện) và Sale Offline (tiếp đón trực tiếp) — 2 bộ phận khác nhau
      const telesaleIds = uniq([app.telesale_id, app.telesale_id_2]);
      const saleIds = uniq([app.sale_id]);
      // Trực page: chỉ có 1 nhân viên phụ trách 100% khách → tự động đưa vào mọi phiếu
      const trucPage = nurses.filter(s => s.role === 'truc_page').map(s => ({ id: s.id, name: s.full_name }));
      const staff_snapshot = {
        truc_page: trucPage,
        telesale: telesaleIds.map(nm).filter(Boolean),
        sale_offline: saleIds.map(nm).filter(Boolean),
        doctor: nm(app.bac_si_id) || null,
        nurses: nurseIds.map(nm).filter(Boolean),
      };

      // Tạo phiếu qua RPC SECURITY DEFINER (bỏ qua RLS an toàn)
      const { data: token, error } = await supabase.rpc('create_review_invitation', {
        p_appointment_id: app.id,
        p_customer_name: app.customer_name || null,
        p_phone: app.phone || null,
        p_service: app.service || null,
        p_surgery_date: app.surgery_date || null,
        p_staff: staff_snapshot,
        p_created_by: profile?.id || null,
      });
      if (error) throw error;
      if (!token) throw new Error('Không tạo được mã phiếu.');
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
      <p style="color:#0d9488;font-size:14px;font-weight:700;margin-top:8px">HOTLINE CSKH: 0886 222 678</p>
    </body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  // Tạo ảnh "phiếu đánh giá" đẹp để tải về & gửi khách (Zalo/Messenger…)
  const downloadReview = async () => {
    if (!reviewModal) return;
    try {
      const W = 720, H = 1040;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

      // Nền
      ctx.fillStyle = '#ecfdf5'; ctx.fillRect(0, 0, W, H);
      // Header gradient
      const g = ctx.createLinearGradient(0, 0, W, 260);
      g.addColorStop(0, '#0d9488'); g.addColorStop(1, '#10b981');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillText('THẨM MỸ DR TUẤN HÙNG', W / 2, 84);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 40px system-ui, sans-serif';
      ctx.fillText('PHIẾU ĐÁNH GIÁ DỊCH VỤ', W / 2, 140);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '400 20px system-ui, sans-serif';
      ctx.fillText('Ý kiến của quý khách giúp chúng tôi phục vụ tốt hơn', W / 2, 182);

      // Tên khách + dịch vụ
      let y = 322;
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 34px system-ui, sans-serif';
      ctx.fillText(reviewModal.app.customer_name || 'Quý khách', W / 2, y);
      if (reviewModal.app.service) {
        y += 40;
        ctx.fillStyle = '#0d9488';
        ctx.font = '600 22px system-ui, sans-serif';
        // cắt bớt nếu quá dài
        let sv = reviewModal.app.service;
        if (sv.length > 46) sv = sv.slice(0, 44) + '…';
        ctx.fillText(sv, W / 2, y);
      }

      // Khung QR trắng
      const qrBox = 380, bx = (W - qrBox) / 2, by = y + 40;
      ctx.save();
      ctx.shadowColor = 'rgba(15,23,42,0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#ffffff'; rr(bx, by, qrBox, qrBox, 28); ctx.fill();
      ctx.restore();

      const qrImg = new Image();
      await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; qrImg.src = reviewModal.dataUrl; });
      const pad = 34;
      ctx.drawImage(qrImg, bx + pad, by + pad, qrBox - pad * 2, qrBox - pad * 2);

      // Hướng dẫn + hotline CSKH
      let ty = by + qrBox + 62;
      ctx.fillStyle = '#334155';
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillText('Quét mã QR để đánh giá dịch vụ', W / 2, ty);
      ty += 50;
      // hotline pill
      const hotline = 'HOTLINE CSKH: 0886 222 678';
      ctx.font = '700 21px system-ui, sans-serif';
      const hw = ctx.measureText(hotline).width + 56;
      ctx.fillStyle = '#f0fdfa'; rr((W - hw) / 2, ty - 29, hw, 46, 23); ctx.fill();
      ctx.fillStyle = '#0f766e'; ctx.fillText(hotline, W / 2, ty);

      // footer
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '400 16px system-ui, sans-serif';
      ctx.fillText('Chỉ mất chưa tới 2 phút · Ý kiến được bảo mật', W / 2, H - 34);

      const safe = (reviewModal.app.customer_name || 'khach').replace(/[^\p{L}\p{N}]+/gu, '_');
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `phieu-danh-gia-${safe}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Đã tải phiếu đánh giá — gửi cho khách nhé!');
    } catch (err) {
      toast.error('Không tạo được ảnh phiếu: ' + (err.message || err));
    }
  };

  const openCare = (app) => {
    setSelectedApp(app);
    setCareApp(app);
    setPhoneEdit(false);
    setForm({
      post_op_status: app.post_op_status || 'Đang theo dõi',
      post_op_notes: '',
      recheck_date: new Date().toISOString().split('T')[0],
      recheck_time: '09:00',
      warning_signs: Array.isArray(app.warning_signs) ? app.warning_signs : [],
      next_recheck: app.next_recheck_at ? new Date(app.next_recheck_at).toISOString().slice(0, 16) : '',
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
    const cskhImgTags = pendingCskhImgs.map(u => `[Ảnh đính kèm: ${u}]`).join('\n');
    const cskhContent = [cskhForm.cskh_notes.trim(), cskhImgTags].filter(Boolean).join('\n');
    const newNote = cskhContent ? `\n[${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}] ${cskhContent}` : '';
    // Lấy nhật ký CSKH mới nhất từ DB làm nền (tránh ghi đè mất mốc đã lưu)
    const { data: freshCskh } = await supabase.from('customer_appointments').select('cskh_notes').eq('id', careApp.id).maybeSingle();
    const updatedNotes = ((freshCskh ? freshCskh.cskh_notes : careApp.cskh_notes) || '') + newNote;
    const { data: updCskh, error } = await supabase.from('customer_appointments')
      .update({ cskh_status: cskhForm.cskh_status || null, cskh_notes: updatedNotes })
      .eq('id', careApp.id)
      .select('id');
    if (error) toast.error(error.message);
    else if (!updCskh?.length) { toast.error('Không lưu được — tài khoản của bạn không có quyền cập nhật ca này.'); setSavingCskh(false); return; }
    else {
      toast.success('Đã lưu nhật ký CSKH!');
      setCareApp(prev => prev ? { ...prev, cskh_status: cskhForm.cskh_status || null, cskh_notes: updatedNotes } : prev);
      setCskhForm(f => ({ ...f, cskh_notes: '' }));
      setPendingCskhImgs([]);
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
    // Ghép ghi chú + ảnh chờ gửi thành 1 mốc nhật ký
    const imgTags = pendingImgs.map(u => `[Ảnh đính kèm: ${u}]`).join('\n');
    const content = [form.post_op_notes.trim(), imgTags].filter(Boolean).join('\n');
    const newNote = content ? `\n[${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}] ${content}` : '';
    // LẤY NHẬT KÝ MỚI NHẤT TỪ DB làm nền (selectedApp có thể là bản cũ lúc mở trang —
    // nếu cộng vào bản cũ, lần lưu sau sẽ GHI ĐÈ MẤT mốc vừa lưu trước đó)
    const { data: freshRow } = await supabase.from('customer_appointments').select('post_op_notes').eq('id', selectedApp.id).maybeSingle();
    const updatedNotes = ((freshRow ? freshRow.post_op_notes : selectedApp.post_op_notes) || '') + newNote;

    const { data: updRows, error } = await supabase.from('customer_appointments')
      .update({
        post_op_status: form.post_op_status,
        post_op_notes: updatedNotes,
        warning_signs: form.warning_signs || [],
        next_recheck_at: form.next_recheck ? new Date(form.next_recheck).toISOString() : null,
      })
      .eq('id', selectedApp.id)
      .select('id');

    if (error) toast.error(error.message);
    else if (!updRows?.length) { toast.error('Không lưu được — tài khoản của bạn không có quyền cập nhật ca này.'); setSaving(false); return; }
    else { 
      if (form.post_op_status === 'Tái khám') {
        if (!form.recheck_date) {
          toast.error('Vui lòng chọn ngày tái khám.');
        } else {
          // RPC SECURITY DEFINER: điều dưỡng được phân công tạo được lịch tái khám
          // (INSERT trực tiếp bị RLS chặn với điều dưỡng thường).
          const { error: insertError } = await supabase.rpc('create_recheck_appointment', {
            p_parent_id: selectedApp.id,
            p_recheck_date: form.recheck_date,
            p_recheck_time: form.recheck_time || null,
            p_notes: `[Lịch sử chăm sóc Hậu Phẫu]${updatedNotes}`,
          });
          if (insertError) {
            toast.error('Lỗi khi tạo lịch hẹn tái khám: ' + insertError.message);
          } else {
            toast.success('Đã tự động tạo Lịch Tái Khám!');
          }
        }
      }
      toast.success('Đã lưu mốc chăm sóc!');
      setCareApp(prev => prev ? { ...prev, post_op_status: form.post_op_status, post_op_notes: updatedNotes } : prev);
      setSelectedApp(prev => prev ? { ...prev, post_op_status: form.post_op_status, post_op_notes: updatedNotes } : prev);
      setForm(f => ({ ...f, post_op_notes: '' }));
      setPendingImgs([]);
      loadData();
    }
    setSaving(false);
  };

  // Lưu 1 mốc hồi phục (hoàn thành / điều dưỡng / ghi chú) vào care_milestones
  const saveMilestone = async (key, patch) => {
    if (!careApp) return;
    setSavingMilestone(true);
    const existing = Array.isArray(careApp.care_milestones) ? careApp.care_milestones : [];
    const map = {}; existing.forEach(m => { if (m?.key) map[m.key] = m; });
    map[key] = { ...(map[key] || {}), key, ...patch };
    if (patch.done && !map[key].done_at) map[key].done_at = new Date().toISOString();
    if (patch.done === false) map[key].done_at = null;
    const arr = MILESTONE_DEFS.map(d => map[d.key]).filter(Boolean);
    const { error } = await supabase.from('customer_appointments').update({ care_milestones: arr }).eq('id', careApp.id);
    setSavingMilestone(false);
    if (error) { toast.error(error.message); return; }
    setCareApp(prev => prev ? { ...prev, care_milestones: arr } : prev);
    setMilestoneEdit(null);
    loadData();
  };

  const toggleWarning = (sign) => setForm(f => ({
    ...f, warning_signs: f.warning_signs.includes(sign) ? f.warning_signs.filter(s => s !== sign) : [...f.warning_signs, sign],
  }));

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

  // Nhật ký dạng TIMELINE: gom từng mốc [ngày giờ] thành thẻ — giờ + chữ + LƯỚI ẢNH,
  // mốc MỚI NHẤT trên cùng. (Dữ liệu vẫn lưu dạng text cũ nên tương thích ngược.)
  const renderNotes = (notesString) => {
    if (!notesString) return null;
    const lines = notesString.split('\n').filter(l => l.trim() !== '');
    const entries = [];
    let cur = null;
    const IMG_RE = /\[Ảnh đính kèm:\s*(https?:\/\/[^\s\]]+)\]/g;
    lines.forEach(line => {
      const m = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(.*)$/);
      let rest = line;
      if (m) { cur = { date: m[1], time: (m[2] || '').slice(0, 5), texts: [], imgs: [] }; entries.push(cur); rest = m[3] || ''; }
      else if (!cur) { cur = { date: null, time: '', texts: [], imgs: [] }; entries.push(cur); }
      let im; IMG_RE.lastIndex = 0;
      while ((im = IMG_RE.exec(rest))) cur.imgs.push(im[1]);
      const text = rest.replace(IMG_RE, '').trim();
      if (text) cur.texts.push(text);
    });
    entries.reverse();   // mới nhất lên đầu

    let lastDate = null;
    return entries.map((en, i) => {
      const showDate = en.date !== lastDate;
      lastDate = en.date;
      return (
        <div key={i}>
          {showDate && (
            <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
              <span className="text-[11px] font-black tracking-wide text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-3 py-1">{en.date ? `NGÀY ${en.date}` : 'GHI CHÚ CŨ'}</span>
              <span className="flex-1 h-px bg-slate-100" />
            </div>
          )}
          <div className="relative pl-4 pb-3">
            <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-teal-400" />
            <span className="absolute left-[3.5px] top-4 bottom-0 w-px bg-slate-100" />
            <div className="bg-slate-50/70 border border-slate-100 rounded-2xl px-3 py-2.5">
              {en.time && <div className="text-[10.5px] font-black text-slate-400 tabular-nums mb-1">{en.time}</div>}
              {en.texts.map((t, j) => <div key={j} className="text-[13px] text-slate-700 leading-relaxed">{t}</div>)}
              {en.imgs.length > 0 && (
                <div className={`grid gap-1.5 mt-2 ${en.imgs.length === 1 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {en.imgs.map((url, j) => (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL))
                    ? <a key={j} href={url} target="_blank" rel="noreferrer noopener" className="text-xs text-slate-400 underline">[ảnh ngoài]</a>
                    : <button key={j} type="button" onClick={() => setViewImage(url)} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:opacity-90 active:scale-95 transition">
                        <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </button>)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  // ===== TRANG CHĂM SÓC RIÊNG (full-page) =====
  if (careApp) {
    const st = form.post_op_status;
    const addNurses = (careApp.additional_hau_phau_ids || []).map(id => nurses.find(n => n.id === id)?.full_name || id);
    const ms = buildMilestones(careApp);
    const metrics = computeMetrics(careApp, ms, satByAppt[careApp.id]);
    const rk = RISK_STYLE[metrics.risk];
    const surgStr = careApp.surgery_date ? new Date(careApp.surgery_date).toLocaleDateString('vi-VN') : '—';
    const nextRecheckM = ms.find(m => !m.done && m.date && startOfDay(m.date) >= startOfDay(new Date())) || ms.find(m => !m.done);
    const nurseName = (id) => nurses.find(n => n.id === id)?.full_name || null;
    const PhoneLine = phoneEdit ? (
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
    );
    const actionBtns = (
      <>
        {canSeeAll && (
          <button type="button" onClick={() => { setAssignForm({ id: careApp.id, additional_hau_phau_ids: careApp.additional_hau_phau_ids || [] }); setSelectedNurseId(''); setShowAssignModal(true); }}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200">
            <UserPlus className="w-4 h-4" /> Phân công điều dưỡng
          </button>
        )}
        <MediaCustomerButton appointment={careApp} me={profile}
          canAdd={['media', 'dieu_duong', 'cskh', 'marketing', 'admin'].some(r => [profile?.role, profile?.role_2].includes(r))} />
        {profile?.role === 'admin' && (
          <button type="button" onClick={() => createReview(careApp)} disabled={creatingReview}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 px-3.5 py-2 rounded-xl shadow-sm disabled:opacity-60">
            {creatingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Tạo phiếu đánh giá
          </button>
        )}
      </>
    );
    return (
      <form onSubmit={handleSave} className="space-y-4 lg:space-y-5 pb-36">
        {/* Header mobile — full-bleed xanh đậm */}
        <div className="lg:hidden -mx-4 -mt-4 px-4 pt-4 pb-16 bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 rounded-b-[28px] text-white">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setCareApp(null)} className="w-10 h-10 rounded-full bg-white/15 grid place-items-center hover:bg-white/25"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-center min-w-0 px-2">
              <div className="font-bold text-lg text-white truncate">{careApp.customer_name}</div>
              <div className="inline-flex items-center gap-1.5 text-xs text-white/90 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> {careApp.post_op_status || 'Đang theo dõi'}</div>
            </div>
            <span className="w-10 h-10 rounded-full bg-white/15 grid place-items-center shrink-0"><Heart className="w-5 h-5" /></span>
          </div>
        </div>

        {/* Back desktop */}
        <button type="button" onClick={() => setCareApp(null)} className="hidden lg:flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold">
          <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
        </button>

        {/* Thẻ thông tin khách */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 -mt-14 lg:mt-0 relative">
          <div className="flex items-start gap-4 flex-wrap">
            <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-200 to-violet-300 text-violet-700 grid place-items-center text-xl font-bold shrink-0">{initialsOf(careApp.customer_name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800">{careApp.customer_name}</h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[careApp.post_op_status || 'Đang theo dõi']}`}>{careApp.post_op_status || 'Đang theo dõi'}</span>
                {careApp.cskh_status && <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${CSKH_STATUS_STYLE[careApp.cskh_status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>CSKH: {careApp.cskh_status}</span>}
              </div>
              {PhoneLine}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-sm">
                <div><div className="text-xs text-slate-400">Dịch vụ</div><div className="font-semibold text-slate-700">{careApp.service || '—'}</div></div>
                <div><div className="text-xs text-slate-400">Ngày phẫu thuật</div><div className="font-semibold text-slate-700">{surgStr}</div></div>
                <div><div className="text-xs text-slate-400">Điều dưỡng phụ trách</div><div className="font-semibold text-slate-700 truncate">{careApp.hau_phau?.full_name || '—'}{addNurses.length > 0 && <span className="text-slate-400"> +{addNurses.length}</span>}</div></div>
              </div>
            </div>
            <div className="hidden lg:flex flex-col gap-2 shrink-0 w-52">{actionBtns}</div>
          </div>
        </div>

        {/* Chỉ số — desktop */}
        <div className="hidden lg:grid grid-cols-5 gap-3">
          <div className="rounded-2xl border border-teal-100 shadow-sm p-4 flex flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-white">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#d1fae5" strokeWidth="4" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#14b8a6" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${metrics.progress * 0.974} 100`} />
              </svg>
              <div className="absolute inset-0 grid place-items-center"><span className="text-xl font-extrabold text-teal-600">{metrics.progress}%</span></div>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1">Tiến độ hồi phục</div>
          </div>
          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pl-5 overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-400" />
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Tái khám tiếp theo</span><span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 grid place-items-center"><CalendarClock className="w-4 h-4" /></span></div>
            <div className="text-lg font-bold text-slate-800 mt-2">{careApp.next_recheck_at ? new Date(careApp.next_recheck_at).toLocaleDateString('vi-VN') : (nextRecheckM?.date ? nextRecheckM.date.toLocaleDateString('vi-VN') : '—')}</div>
            <div className="text-xs text-slate-400 mt-0.5">{careApp.next_recheck_at ? new Date(careApp.next_recheck_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (nextRecheckM?.label || '')}</div>
          </div>
          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pl-5 overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Hoàn thành chăm sóc</span><span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center"><ShieldCheck className="w-4 h-4" /></span></div>
            <div className="text-[26px] leading-none font-extrabold text-slate-800 mt-2.5 tabular-nums">{metrics.careScore}<span className="text-sm text-slate-400 font-bold">/100</span></div>
            <div className="text-xs text-emerald-600 mt-1.5 font-semibold">{metrics.careScore >= 80 ? 'Tốt' : metrics.careScore >= 50 ? 'Khá' : 'Cần cải thiện'}</div>
          </div>
          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pl-5 overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: rk.ring }} />
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Nguy cơ biến chứng</span><span className={`w-9 h-9 rounded-xl grid place-items-center ${rk.bg} ${rk.c}`}><AlertTriangle className="w-4 h-4" /></span></div>
            <div className={`text-[22px] leading-none font-extrabold mt-2.5 ${rk.c}`}>{metrics.risk}</div>
            <div className="h-1.5 rounded-full bg-slate-100 mt-2.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: metrics.risk === 'Cao' ? '100%' : metrics.risk === 'Trung bình' ? '55%' : '20%', backgroundColor: rk.ring }} /></div>
          </div>
          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pl-5 overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-violet-400" />
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Mức độ hài lòng</span><span className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 grid place-items-center"><Heart className="w-4 h-4" /></span></div>
            <div className="text-[26px] leading-none font-extrabold text-slate-800 mt-2.5 tabular-nums">{metrics.satisfaction != null ? metrics.satisfaction.toFixed(1) : '—'}<span className="text-sm text-slate-400 font-bold">/5</span></div>
            <div className="text-xs text-slate-400 mt-1.5">{metrics.satisfaction != null ? (metrics.satisfaction >= 4 ? 'Rất hài lòng' : metrics.satisfaction >= 3 ? 'Bình thường' : 'Chưa hài lòng') : 'Chưa đánh giá'}</div>
          </div>
        </div>

        {/* Chỉ số — mobile (3 chip) */}
        <div className="lg:hidden grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
            <div className="text-xl font-bold text-teal-600 tabular-nums">{metrics.progress}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hồi phục</div>
          </div>
          <div className={`rounded-2xl border shadow-sm p-3 text-center ${rk.bg} border-transparent`}>
            <div className={`text-base font-bold ${rk.c} flex items-center justify-center gap-1`}><AlertTriangle className="w-4 h-4" /> {metrics.risk}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Rủi ro</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
            <div className="text-xl font-bold text-slate-800 tabular-nums">{metrics.satisfaction != null ? metrics.satisfaction.toFixed(1) : '—'}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hài lòng</div>
          </div>
        </div>

        {/* Hành động — mobile (3 thẻ) */}
        <div className="lg:hidden grid grid-cols-1 gap-2">{actionBtns}</div>

        {/* Hành trình hồi phục + Cập nhật chăm sóc */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Hành trình hồi phục (mốc) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Activity className="w-5 h-5 text-teal-600" /> Hành trình hồi phục</h3>
            <div>
              {ms.map((m, i) => {
                const done = m.status === 'done';
                const active = m.status === 'active';
                return (
                  <div key={m.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-teal-100 text-teal-600 ring-2 ring-teal-400' : 'bg-slate-100 text-slate-400'}`}>
                        {done ? <Check className="w-4 h-4" /> : <span className="text-[11px] font-bold">{i === 0 ? 'PT' : m.off}</span>}
                      </span>
                      {i < ms.length - 1 && <span className={`w-0.5 flex-1 my-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                    </div>
                    <button type="button" onClick={() => canEditHauPhau && setMilestoneEdit(m)} className={`text-left flex-1 mb-3 rounded-xl px-3 py-2 transition ${active ? 'bg-teal-50 border border-teal-200' : done ? 'bg-emerald-50/40' : 'hover:bg-slate-50'} ${canEditHauPhau ? 'cursor-pointer' : 'cursor-default'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 text-sm">{m.label}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{done ? '✓ Hoàn thành' : active ? 'Đến hạn' : 'Chưa tới'}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{m.date ? m.date.toLocaleDateString('vi-VN') : '—'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.note || m.desc}</div>
                      {m.nurse_id && <div className="text-[11px] font-semibold text-teal-600 mt-1 inline-flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-[8px] font-bold">{initialsOf(nurseName(m.nurse_id))}</span> {nurseName(m.nurse_id) || '—'}</div>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cập nhật chăm sóc hậu phẫu */}
          {canEditHauPhau ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-teal-600" /> Cập nhật chăm sóc hậu phẫu</h3>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-600">Trạng thái hiện tại</label>
              <div className="flex flex-wrap gap-2">
                {TABS.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} type="button" onClick={() => setForm({ ...form, post_op_status: t.id })}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${st === t.id ? STATUS_STYLE[t.id] + ' ring-2 ring-offset-1 ring-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{t.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-600">Thẻ chăm sóc nhanh</label>
              <div className="flex flex-wrap gap-2">
                {QUICK_NOTES.map(q => (
                  <button key={q} type="button" onClick={() => addQuickNote(q)} className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-100 hover:bg-teal-100">+ {q}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-600">Dấu hiệu cần lưu ý</label>
              <div className="flex flex-wrap gap-2">
                {WARNING_SIGNS.map(w => {
                  const on = form.warning_signs.includes(w);
                  return <button key={w} type="button" onClick={() => toggleWarning(w)} className={`px-3 py-1.5 rounded-full text-xs font-medium border inline-flex items-center gap-1 transition ${on ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}><AlertTriangle className="w-3 h-3" /> {w}</button>;
                })}
              </div>
            </div>
            {/* Lịch tái khám — thẻ riêng, KHÔNG chen giữa ghi chú và khay ảnh */}
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 p-3.5 overflow-hidden">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 grid place-items-center shrink-0"><CalendarClock className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-blue-900 leading-tight">Lịch tái khám tiếp theo</div>
                  <div className="text-[11px] text-blue-500">Bỏ trống nếu chưa hẹn</div>
                </div>
                {form.next_recheck && <button type="button" onClick={() => setForm({ ...form, next_recheck: '' })} className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-blue-400 hover:bg-blue-100"><X className="w-4 h-4" /></button>}
              </div>
              <input type="datetime-local" value={form.next_recheck} onChange={e => setForm({ ...form, next_recheck: e.target.value })} style={{ maxWidth: '100%' }} className="mt-2.5 block w-full min-w-0 appearance-none box-border border border-blue-200 bg-white p-2.5 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm" />
              {st === 'Tái khám' && (
                <div className="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-blue-100">
                  <div className="min-w-0"><label className="block text-xs font-semibold mb-1 text-blue-800">Ngày tái khám (tạo lịch)</label><input type="date" value={form.recheck_date} onChange={e => setForm({ ...form, recheck_date: e.target.value })} style={{ maxWidth: '100%' }} className="block w-full min-w-0 appearance-none box-border border border-blue-200 bg-white p-2 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
                  <div className="min-w-0"><label className="block text-xs font-semibold mb-1 text-blue-800">Giờ hẹn</label><input type="time" value={form.recheck_time} onChange={e => setForm({ ...form, recheck_time: e.target.value })} style={{ maxWidth: '100%' }} className="block w-full min-w-0 appearance-none box-border border border-blue-200 bg-white p-2 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
                </div>
              )}
            </div>
            {/* Ghi chú + khay ảnh + nút: liền một mạch */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-600">Ghi chú cập nhật</label>
              <textarea rows={3} value={form.post_op_notes} onChange={e => setForm({ ...form, post_op_notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 resize-none text-sm" placeholder="Gõ ghi chú hoặc chạm thẻ nhanh phía trên..." />
            </div>
            <PendingStrip imgs={pendingImgs} onRemove={(i) => setPendingImgs(l => l.filter((_, j) => j !== i))} />
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="text-teal-600 hover:bg-teal-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border border-teal-100">
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Thêm ảnh{pendingImgs.length > 0 ? ` (${pendingImgs.length})` : ''}
              </button>
              <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700">{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</button>
            </div>
          </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-400 grid place-items-center min-h-[120px]">Bạn chỉ có quyền xem hồ sơ hậu phẫu.</div>
          )}
        </div>

        {/* Nhật ký chăm sóc hậu phẫu (thread) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-teal-600" /> Nhật ký chăm sóc hậu phẫu</h3>
            <button type="button" onClick={() => setShowHauPhauLog(v => !v)} className="shrink-0 text-xs font-semibold text-teal-600 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 inline-flex items-center gap-1">
              {showHauPhauLog ? <><ChevronUp className="w-3.5 h-3.5" /> Ẩn</> : <><ChevronDown className="w-3.5 h-3.5" /> Hiện</>}
            </button>
          </div>
          {showHauPhauLog && (
            <div className="text-sm text-slate-700 max-h-[40vh] overflow-y-auto pr-1">
              {careApp.post_op_notes ? renderNotes(careApp.post_op_notes) : <div className="text-slate-400 text-center py-6">Chưa có ghi chú nào</div>}
            </div>
          )}
        </div>

        {/* Nhật ký CSKH — chỉ hiện ở chế độ CSKH (Hậu phẫu không cần) */}
        {isCskhTab && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
          <h3 className="font-bold text-violet-800 mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-violet-600" /> Nhật ký CSKH</h3>
          <div className="text-sm text-slate-700 max-h-[40vh] overflow-y-auto pr-1">
            {careApp.cskh_notes ? renderNotes(careApp.cskh_notes) : <div className="text-slate-400 text-center py-6">Chưa có ghi chú CSKH nào</div>}
          </div>
        </div>
        )}

        {/* Thêm mốc CSKH — chỉ chế độ CSKH + có quyền */}
        {isCskhTab && canEditCskh && (
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
          <PendingStrip imgs={pendingCskhImgs} onRemove={(i) => setPendingCskhImgs(l => l.filter((_, j) => j !== i))} />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => cskhFileRef.current?.click()} disabled={uploadingCskhImage} className="text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border border-violet-100">
              {uploadingCskhImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Thêm ảnh{pendingCskhImgs.length > 0 ? ` (${pendingCskhImgs.length})` : ''}
            </button>
            <input type="file" accept="image/*" multiple className="hidden" ref={cskhFileRef} onChange={handleCskhImageUpload} />
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
          <div className="fixed inset-0 bg-black/85 z-[95] flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
            <button onClick={() => setViewImage(null)} className="fixed top-4 right-4 z-10 w-11 h-11 grid place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur"><X className="w-6 h-6" /></button>
            <img src={viewImage} alt="" className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[12px]">Chạm để đóng</div>
          </div>
        )}
        {reviewModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setReviewModal(null)}>
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-teal-500 to-emerald-500 px-6 pt-6 pb-8 text-center relative">
                <button type="button" onClick={() => setReviewModal(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:bg-white/20"><X className="w-4 h-4" /></button>
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
                  <button type="button" onClick={copyReviewLink} className="shrink-0 text-teal-600 hover:text-teal-700"><Copy className="w-4 h-4" /></button>
                </div>
                <button type="button" onClick={downloadReview} className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-700 shadow-sm shadow-teal-600/25 active:scale-[0.99] transition">
                  <Download className="w-4 h-4" /> Tải phiếu đánh giá (gửi khách)
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={copyReviewLink} className="py-2.5 rounded-xl bg-teal-50 text-teal-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-teal-100"><Copy className="w-4 h-4" /> Sao chép</button>
                  <button type="button" onClick={shareReview} className="py-2.5 rounded-xl bg-blue-50 text-blue-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-blue-100"><Share2 className="w-4 h-4" /> Chia sẻ</button>
                  <button type="button" onClick={printReview} className="py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-slate-200"><Printer className="w-4 h-4" /> In</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sửa 1 mốc hồi phục */}
        {milestoneEdit && (
          <div className="fixed inset-0 bg-slate-900/50 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" onClick={() => setMilestoneEdit(null)}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{milestoneEdit.label}</h3>
                  <p className="text-xs text-slate-400">{milestoneEdit.date ? milestoneEdit.date.toLocaleDateString('vi-VN') : ''} · {milestoneEdit.desc}</p>
                </div>
                <button type="button" onClick={() => setMilestoneEdit(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Điều dưỡng phụ trách mốc</label>
                  <select value={milestoneEdit.nurse_id || ''} onChange={e => setMilestoneEdit(m => ({ ...m, nurse_id: e.target.value || null }))} className="w-full h-10 px-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-400">
                    <option value="">— Chọn điều dưỡng —</option>
                    {nurses.filter(n => n.role === 'dieu_duong' || n.role === 'admin').map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Ghi chú mốc</label>
                  <textarea rows={3} value={milestoneEdit.note || ''} onChange={e => setMilestoneEdit(m => ({ ...m, note: e.target.value }))} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-teal-400 resize-none" placeholder="Ví dụ: Đã cắt chỉ, vết mổ khô…" />
                </div>
              </div>
              <div className="px-6 py-4 border-t flex items-center gap-2">
                <button type="button" onClick={() => saveMilestone(milestoneEdit.key, { done: !milestoneEdit.done, nurse_id: milestoneEdit.nurse_id || null, note: milestoneEdit.note || '' })} disabled={savingMilestone}
                  className={`flex-1 py-2.5 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 ${milestoneEdit.done ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                  {savingMilestone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {milestoneEdit.done ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                </button>
                <button type="button" onClick={() => saveMilestone(milestoneEdit.key, { done: milestoneEdit.done, nurse_id: milestoneEdit.nurse_id || null, note: milestoneEdit.note || '' })} disabled={savingMilestone}
                  className="py-2.5 px-4 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50">Lưu</button>
              </div>
            </div>
          </div>
        )}
      </form>
    );
  }

  // ---- Số liệu tổng quan cho danh sách ----
  const nowTs = new Date();
  const riskOf = (c) => {
    const s = Array.isArray(c.warning_signs) ? c.warning_signs.length : 0;
    if (c.post_op_status === 'Có biến chứng' || s >= 3) return 'Cao';
    if (s >= 1) return 'Trung bình';
    return 'Thấp';
  };
  const isToday = (d) => d && startOfDay(d).getTime() === startOfDay(nowTs).getTime();
  const listStats = (() => {
    const arr = mainTabCustomers;
    const need = arr.filter(c => c.next_recheck_at && isToday(new Date(c.next_recheck_at))).length;
    const overdue = arr.filter(c => c.next_recheck_at && new Date(c.next_recheck_at) < nowTs && c.post_op_status !== 'Đã ổn định').length;
    const stable = arr.filter(c => c.post_op_status === 'Đã ổn định').length;
    const following = arr.filter(c => (c.post_op_status || 'Đang theo dõi') === 'Đang theo dõi').length;
    const recheck = arr.filter(c => c.post_op_status === 'Tái khám').length;
    const complication = arr.filter(c => c.post_op_status === 'Có biến chứng').length;
    const sats = arr.map(c => satByAppt[c.id]).filter(v => v != null);
    const satScore = sats.length ? Math.round((sats.reduce((s, v) => s + v, 0) / sats.length) / 5 * 100) : null;
    return { total: arr.length, need, overdue, stable, following, recheck, complication, satScore };
  })();
  const fmtCountdown = (dt) => {
    const diff = new Date(dt) - nowTs;
    if (diff < 0) { const d = Math.max(1, Math.ceil(-diff / 86400000)); return { txt: `Quá hạn ${d} ngày`, over: true }; }
    const h = Math.floor(diff / 3600000);
    if (h < 24) return { txt: `Hẹn trong ${Math.max(1, h)}h`, over: false, soon: true };
    return { txt: `${Math.round(h / 24)} ngày nữa`, over: false };
  };
  const priority = mainTabCustomers
    .map(c => {
      const t = c.next_recheck_at ? new Date(c.next_recheck_at) : null;
      const cd = t ? fmtCountdown(t) : null;
      const risk = riskOf(c);
      const urgent = risk === 'Cao' || (cd && (cd.over || cd.soon)) || (t && (t - nowTs) < 3 * 86400000);
      return { c, t, cd, risk, urgent };
    })
    .filter(p => p.urgent)
    .sort((a, b) => {
      const rank = (p) => (p.cd?.over ? 0 : p.risk === 'Cao' ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return (a.t ? a.t.getTime() : Infinity) - (b.t ? b.t.getTime() : Infinity);
    })
    .slice(0, 8);
  const lastNoteOf = (c) => {
    const src = isCskhTab ? c.cskh_notes : c.post_op_notes;
    if (!src) return null;
    const lines = src.split('\n').filter(l => /^\[\d/.test(l.trim()));
    const m = lines.length ? lines[lines.length - 1].match(/^\[(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})/) : null;
    return m ? `${m[1]} ${m[2]}` : null;
  };
  const StatCard = ({ icon: Icon, label, value, sub, tone, bar }) => (
    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pl-5 overflow-hidden hover:shadow-md transition-shadow">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${bar}`} />
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-slate-500 pt-1.5">{label}</span>
        <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
      </div>
      <div className="text-[26px] leading-none font-extrabold text-slate-800 mt-2.5 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1.5">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-4 lg:space-y-5 w-full">
      {/* ======= MOBILE: header xanh + tab nổi bật ======= */}
      <div className="lg:hidden -mx-4 -mt-4 px-4 pt-5 pb-4 bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 rounded-b-[26px] text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight">Chăm sóc hậu phẫu</h2>
            <p className="text-teal-50/90 text-xs mt-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Theo dõi &amp; chăm sóc khách sau phẫu thuật</p>
          </div>
          {canSeeAll && (
            <button onClick={() => { setImportPreview(null); setShowImportModal(true); }} className="shrink-0 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center"><Plus className="w-5 h-5" /></button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white/15 p-1.5 rounded-2xl mt-4">
          {[
            { id: 'hau_phau', label: 'Hậu phẫu', icon: Users, sub: hauPhauCount },
            { id: 'cskh', label: 'CSKH', icon: Headset, sub: cskhCount },
          ].map(t => {
            const on = mainTab === t.id;
            return (
              <button key={t.id} onClick={() => { setMainTab(t.id); setActiveTab('all'); }}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-sm transition-all ${on ? 'bg-white text-teal-700 shadow-md' : 'text-white/85'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
                <span className={`text-[11px] px-1.5 rounded-full ${on ? 'bg-teal-100 text-teal-700' : 'bg-white/20 text-white'}`}>{t.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======= DESKTOP: header + tab ======= */}
      <div className="hidden lg:flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            {mainTab === 'cskh' ? 'Chăm sóc khách hàng' : 'Chăm sóc Hậu phẫu'}
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3" /> Trung tâm chăm sóc sau phẫu thuật</span>
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">Theo dõi &amp; chăm sóc khách sau phẫu thuật để đảm bảo phục hồi tốt và trải nghiệm hài lòng.</p>
        </div>
        {canSeeAll && (
          <button onClick={() => { setImportPreview(null); setShowImportModal(true); }} className="shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-teal-600 text-white text-sm font-semibold shadow-sm shadow-teal-600/20 hover:bg-teal-700 active:scale-95 transition">
            <Upload className="w-4 h-4" /> Import
          </button>
        )}
      </div>
      <div className="hidden lg:grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl max-w-md">
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

      {/* Thẻ chỉ số — MOBILE (5 ô gọn) */}
      {!isCskhTab && (
        <div className="lg:hidden bg-white rounded-2xl border border-slate-100 shadow-sm px-1.5 py-3 grid grid-cols-5 divide-x divide-slate-100">
          {[
            { icon: Users, label: 'Tổng ca', value: listStats.total, color: 'text-teal-600' },
            { icon: Activity, label: 'Theo dõi', value: listStats.following, color: 'text-blue-600' },
            { icon: CalendarClock, label: 'Tái khám', value: listStats.recheck, color: 'text-amber-600' },
            { icon: ShieldCheck, label: 'Ổn định', value: listStats.stable, color: 'text-emerald-600' },
            { icon: AlertTriangle, label: 'Biến chứng', value: listStats.complication, color: 'text-rose-600' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center px-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <div className="text-lg font-extrabold text-slate-800 mt-1 tabular-nums leading-none">{s.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Thẻ chỉ số — DESKTOP (6 thẻ) */}
      {!isCskhTab && (
        <div className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Tổng bệnh nhân" value={listStats.total} sub="đang được theo dõi" tone="bg-teal-100 text-teal-600" bar="bg-teal-400" />
          <StatCard icon={CalendarClock} label="Cần theo dõi hôm nay" value={listStats.need} sub="có hẹn tái khám" tone="bg-amber-100 text-amber-600" bar="bg-amber-400" />
          <StatCard icon={Clock} label="Quá hạn follow-up" value={listStats.overdue} sub="cần liên hệ lại" tone="bg-rose-100 text-rose-600" bar="bg-rose-400" />
          <StatCard icon={ShieldCheck} label="Ổn định tốt" value={listStats.stable} sub={`${listStats.total ? Math.round(listStats.stable / listStats.total * 100) : 0}% tổng BN`} tone="bg-emerald-100 text-emerald-600" bar="bg-emerald-400" />
          <StatCard icon={AlertTriangle} label="Nguy cơ biến chứng" value={listStats.complication} sub="cần theo dõi sát" tone="bg-orange-100 text-orange-600" bar="bg-orange-400" />
          <StatCard icon={Heart} label="Hài lòng (Đánh giá)" value={listStats.satScore == null ? '—' : listStats.satScore} sub="điểm trung bình /100" tone="bg-violet-100 text-violet-600" bar="bg-violet-400" />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input type="text" placeholder="Tìm tên KH hoặc số điện thoại…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 pl-10 pr-4 h-11 rounded-2xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15 transition-all" />
      </div>

      {/* Filter chips + chọn chế độ xem */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
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
        {/* Toggle Danh sách / Thẻ — chỉ desktop */}
        <div className="hidden lg:flex shrink-0 items-center gap-0.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'list', label: 'Danh sách', icon: List },
            { id: 'card', label: 'Thẻ', icon: LayoutGrid },
          ].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} title={v.label}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold transition-all ${viewMode === v.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <v.icon className="w-4 h-4" /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cần ưu tiên theo dõi */}
      {priority.length > 0 && (
        <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-rose-700">Cần ưu tiên theo dõi</h3>
            <span className="text-xs font-semibold text-rose-400">{priority.length}</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {priority.map(({ c, cd, risk }) => (
              <button key={c.id} type="button" onClick={() => openCare(c)} className="shrink-0 w-60 text-left bg-white rounded-xl border border-slate-100 shadow-sm p-3 hover:border-rose-300 transition">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-200 to-violet-300 text-violet-700 grid place-items-center text-xs font-bold shrink-0">{initialsOf(c.customer_name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-sm truncate">{c.customer_name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{c.phone || '—'}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${risk === 'Cao' ? 'bg-rose-500 text-white' : risk === 'Trung bình' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{risk}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500 truncate">{c.service || '—'}</span>
                  <span className={`font-semibold shrink-0 ${cd ? (cd.over ? 'text-rose-600' : 'text-amber-600') : 'text-rose-500'}`}>{cd ? cd.txt : 'Nguy cơ cao'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">Không có khách hàng nào trong mục này</div>
      ) : (
        <>
          {/* Bảng — desktop (chế độ Danh sách) */}
          <div className={`${viewMode === 'list' ? 'hidden lg:block' : 'hidden'} bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
                  <th className="font-semibold px-4 py-3">Bệnh nhân</th>
                  <th className="font-semibold px-3 py-3">Dịch vụ</th>
                  <th className="font-semibold px-3 py-3">Điều dưỡng</th>
                  <th className="font-semibold px-3 py-3">Liên hệ gần nhất</th>
                  <th className="font-semibold px-3 py-3">Tái khám tiếp theo</th>
                  <th className="font-semibold px-3 py-3">Nguy cơ</th>
                  <th className="font-semibold px-3 py-3 text-center">Ghi chú</th>
                  <th className="font-semibold px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(app => {
                  const st = isCskhTab ? (app.cskh_status || 'Chưa phân loại') : (app.post_op_status || 'Đang theo dõi');
                  const stCls = isCskhTab ? (CSKH_STATUS_STYLE[app.cskh_status] || 'bg-slate-100 text-slate-500 border-slate-200') : (STATUS_STYLE[st] || STATUS_STYLE['Đang theo dõi']);
                  const notesSrc = isCskhTab ? app.cskh_notes : app.post_op_notes;
                  const noteCount = notesSrc ? notesSrc.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
                  const risk = riskOf(app);
                  const nextR = app.next_recheck_at ? new Date(app.next_recheck_at) : null;
                  return (
                    <tr key={app.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openCare(app)} className="flex items-center gap-2.5 text-left">
                          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-200 to-violet-300 text-violet-700 grid place-items-center text-xs font-bold shrink-0">{initialsOf(app.customer_name)}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{app.customer_name}</div>
                            <div className="text-xs text-slate-400 mb-1">{app.phone || '—'}</div>
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${stCls}`}>{st}</span>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{app.service || '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{app.hau_phau?.full_name || <span className="text-slate-300">Chưa phân công</span>}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{lastNoteOf(app) || '—'}</td>
                      <td className="px-3 py-3">
                        {nextR ? <div><div className="font-semibold text-slate-700 text-xs">{nextR.toLocaleDateString('vi-VN')} {nextR.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div><div className={`text-[11px] ${fmtCountdown(nextR).over ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>{fmtCountdown(nextR).txt}</div></div> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${risk === 'Cao' ? 'bg-rose-100 text-rose-700' : risk === 'Trung bình' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{risk}</span></td>
                      <td className="px-3 py-3 text-center text-slate-400 text-xs"><span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{noteCount}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {app.phone && <a href={`tel:${app.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg"><Phone className="w-3.5 h-3.5" /> Gọi</a>}
                          <button type="button" onClick={() => openCare(app)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg">Mở nhật ký</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lưới thẻ — desktop (chế độ Thẻ) */}
          <div className={`${viewMode === 'card' ? 'hidden lg:grid' : 'hidden'} grid-cols-2 xl:grid-cols-3 gap-3`}>
            {filteredCustomers.map(app => {
              const st = isCskhTab ? (app.cskh_status || 'Chưa phân loại') : (app.post_op_status || 'Đang theo dõi');
              const stCls = isCskhTab ? (CSKH_STATUS_STYLE[app.cskh_status] || 'bg-slate-100 text-slate-500 border-slate-200') : (STATUS_STYLE[st] || STATUS_STYLE['Đang theo dõi']);
              const notesSrc = isCskhTab ? app.cskh_notes : app.post_op_notes;
              const noteCount = notesSrc ? notesSrc.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
              const risk = riskOf(app);
              const nextR = app.next_recheck_at ? new Date(app.next_recheck_at) : null;
              const riskCls = risk === 'Cao' ? 'bg-rose-100 text-rose-700' : risk === 'Trung bình' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
              return (
                <div key={app.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:border-teal-300 hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => openCare(app)} className="flex items-center gap-3 text-left min-w-0 flex-1">
                      <span className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-200 to-violet-300 text-violet-700 grid place-items-center text-sm font-bold shrink-0">{initialsOf(app.customer_name)}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{app.customer_name}</div>
                        <div className="text-xs text-slate-400 truncate">{app.phone || '—'}</div>
                      </div>
                    </button>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${riskCls}`}>{risk}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${stCls}`}>{st}</span>
                    {app.service && <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full truncate max-w-full">{app.service}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="text-slate-400 text-[10.5px]">Điều dưỡng</div>
                      <div className="text-slate-600 font-medium truncate">{app.hau_phau?.full_name || <span className="text-slate-300">Chưa phân công</span>}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-400 text-[10.5px]">Tái khám tiếp theo</div>
                      {nextR ? <div className={`font-medium truncate ${fmtCountdown(nextR).over ? 'text-rose-600' : 'text-slate-600'}`}>{nextR.toLocaleDateString('vi-VN')} · {fmtCountdown(nextR).txt}</div> : <div className="text-slate-300">—</div>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><MessageCircle className="w-3.5 h-3.5" />{noteCount} ghi chú</span>
                    <div className="flex items-center gap-1.5">
                      {app.phone && <a href={`tel:${app.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg"><Phone className="w-3.5 h-3.5" /> Gọi</a>}
                      <button type="button" onClick={() => openCare(app)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 px-2.5 py-1.5 rounded-lg">Mở nhật ký</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Thẻ — mobile, gom theo ngày mổ */}
          <div className="lg:hidden space-y-5">
            {Object.entries(groupedCustomers).map(([date, apps]) => (
              <div key={date} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-4 h-4 text-teal-500" />
                  <h3 className="text-[13px] font-bold text-slate-500">Mổ ngày {date}</h3>
                  <span className="text-xs font-semibold text-slate-300">· {apps.length}</span>
                </div>
                <div className="space-y-3">
                  {apps.map(app => {
                    const st = isCskhTab ? (app.cskh_status || 'Chưa phân loại') : (app.post_op_status || 'Đang theo dõi');
                    const stCls = isCskhTab ? (CSKH_STATUS_STYLE[app.cskh_status] || 'bg-slate-100 text-slate-500 border-slate-200') : (STATUS_STYLE[st] || STATUS_STYLE['Đang theo dõi']);
                    const notesSrc = isCskhTab ? app.cskh_notes : app.post_op_notes;
                    const noteCount = notesSrc ? notesSrc.split('\n').filter(l => /^\[\d/.test(l.trim())).length : 0;
                    return (
                      <div key={app.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-200 to-violet-300 text-violet-700 grid place-items-center text-sm font-bold shrink-0">{initialsOf(app.customer_name)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-800 truncate leading-tight">{app.customer_name}</h4>
                                <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone || <span className="italic text-slate-300">Chưa có SĐT</span>}</div>
                              </div>
                              <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${stCls}`}>{st}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs min-w-0">
                              <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 font-medium truncate max-w-[55%]">{app.service || 'Chưa rõ DV'}</span>
                              <span className="text-slate-300 shrink-0">·</span>
                              <span className="text-slate-500 truncate min-w-0">{app.hau_phau?.full_name || 'Chưa phân công'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> {noteCount} ghi chú</span>
                          <div className="flex items-center gap-2">
                            {app.phone && <a href={`tel:${app.phone}`} className="inline-flex items-center gap-1 text-teal-700 font-semibold bg-teal-50 px-2.5 py-1.5 rounded-lg"><Phone className="w-3.5 h-3.5" /> Gọi</a>}
                            <button type="button" onClick={() => openCare(app)} className="text-teal-600 font-bold inline-flex items-center gap-1">Mở nhật ký <ChevronRight className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}


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

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <button onClick={() => setViewImage(null)} className="fixed top-4 right-4 z-10 w-11 h-11 grid place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur"><X className="w-6 h-6" /></button>
          <img src={viewImage} alt="Phóng to" className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl" />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[12px]">Chạm để đóng</div>
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
