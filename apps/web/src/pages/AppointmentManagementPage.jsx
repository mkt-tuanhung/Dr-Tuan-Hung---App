import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Plus, X, Calendar as CalendarIcon, Phone, User, Activity, Edit, Trash2, CalendarDays, Stethoscope, Wallet, Ban, Link as LinkIcon, FileText, ImagePlus, Loader2, Search, MessageCircle, UserCheck, QrCode, Copy, Printer, Star, Share2 } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import QRCode from 'qrcode';
import MoneyInput from '@/components/MoneyInput.jsx';

const AppointmentManagementPage = () => {
  const { profile } = useAuth();
  
  const isHeadNurse = profile?.role === 'dieu_duong' && profile?.position === 'Trưởng bộ phận';
  const isAdmin = profile?.role === 'admin';
  const isNurse = profile?.role === 'dieu_duong';

  const today = new Date();
  const [appointments, setAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  
  // Forms
  const [saving, setSaving] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState('appointments');
  const [viewNoteApp, setViewNoteApp] = useState(null);
  const [careHistoryApp, setCareHistoryApp] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [custEdit, setCustEdit] = useState(null);                 // khách đang sửa tên/SĐT
  const [custForm, setCustForm] = useState({ customer_name: '', phone: '', telesale_id: '', telesale_id_2: '', sale_id: '' });
  const [createForm, setCreateForm] = useState({
    appointment_type: 'new',
    appointment_date: today.toISOString().split('T')[0], appointment_time: '09:00',
    customer_name: '', phone: '', service: '', test_status: 'Chưa xét nghiệm',
    expected_bill: '', deposit_amount: '', telesale_id: '', telesale_id_2: '', sale_id: '', social_link: '', notes: '',
    service_group: 'Hàm mặt', surgery_type: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới',
    used_service: '', surgery_date: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);   // { app, url, dataUrl }
  const [creatingReview, setCreatingReview] = useState(null); // app.id đang tạo

  // Tạo (hoặc lấy lại) phiếu đánh giá dịch vụ → hiện QR để gửi khách
  const createReview = async (app) => {
    setCreatingReview(app.id);
    try {
      const staffMap = {};
      staffList.forEach(s => { staffMap[s.id] = s; });
      const nm = (id) => (id && staffMap[id] ? { id, name: staffMap[id].full_name } : null);
      const nurseIds = [app.phu_mo_1_id, app.phu_mo_2_id, app.phu_mo_3_id, app.hau_phau_id, app.truc_dem_id, app.truc_dem_id_2]
        .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      const consultantIds = [app.telesale_id, app.sale_id].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      const staff_snapshot = {
        doctor: nm(app.bac_si_id) || null,
        nurses: nurseIds.map(nm).filter(Boolean),
        consultants: consultantIds.map(nm).filter(Boolean),
      };

      // Dùng lại phiếu chưa hoàn thành nếu có; nếu không, tạo mới
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
    setCreatingReview(null);
  };

  const copyReviewLink = () => {
    if (!reviewModal) return;
    navigator.clipboard?.writeText(reviewModal.url).then(() => toast.success('Đã sao chép link!'), () => {});
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
  const shareReview = async () => {
    if (!reviewModal || !navigator.share) { copyReviewLink(); return; }
    try {
      await navigator.share({ title: 'Đánh giá dịch vụ', text: `Kính mời ${reviewModal.app.customer_name || 'quý khách'} đánh giá dịch vụ:`, url: reviewModal.url });
    } catch { /* user cancelled */ }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadToR2(file, 'tu-van');
      setCreateForm(prev => ({ ...prev, notes: prev.notes + (prev.notes ? '\n' : '') + `[Ảnh đính kèm: ${url}]` }));
      toast.success('Đã tải ảnh lên!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    }
    setUploadingImage(false);
    e.target.value = '';
  };

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
            <div key={`date-${index}`} className="font-extrabold text-teal-700 text-[13px] mt-4 mb-1.5 uppercase tracking-wide border-b border-teal-100 pb-0.5 inline-block">
              NGÀY {date} :
            </div>
          );
        }
      }
      
      const parts = line.split(/(\[Ảnh đính kèm:\s*https?:\/\/[^\s\]]+\])/g);
      const lineContent = parts.map((part, i) => {
        const imgMatch = part.match(/\[Ảnh đính kèm:\s*(https?:\/\/[^\s\]]+)\]/);
        if (imgMatch) {
          return (
            <div key={i} onClick={() => setViewImage(imgMatch[1])} className="inline-block mt-1.5 mb-2 cursor-pointer">
              <img src={imgMatch[1]} alt="attachment" className="max-h-28 rounded-lg border border-slate-200 shadow-sm object-cover hover:opacity-90 transition-opacity" />
            </div>
          );
        }
        return <span key={i}>{part}</span>;
      });

      elements.push(<div key={`line-${index}`} className="mb-0.5">{lineContent}</div>);
    });
    
    return elements;
  };

  const [evalApp, setEvalApp] = useState(null);
  const [consultFiles, setConsultFiles] = useState([]);
  const [consultView, setConsultView] = useState(null);
  const [evalForm, setEvalForm] = useState({
    status: 'phau_thuat', surgery_type: 'Tiểu phẫu',
    expected_surgery_date: today.toISOString().split('T')[0], revenue: '', upsale_revenue: '', service: '',
    deposit_date: today.toISOString().split('T')[0], deposit_amount: '', notes: '', consult_note: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Fetch all appointments
    const { data: appData, error: appErr } = await supabase
      .from('customer_appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true });

    if (appErr) {
      toast.error('Lỗi tải dữ liệu lịch hẹn: ' + appErr.message);
    }

    // Fetch staff for joining names
    const { data: staffData, error: staffErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, role_2');
      
    if (staffErr) {
      toast.error('Lỗi tải dữ liệu nhân viên: ' + staffErr.message);
    }

    if (appData && staffData) {
      setStaffList(staffData);
      
      const staffMap = {};
      staffData.forEach(s => staffMap[s.id] = s);
      
      const mappedApps = appData.map(app => ({
        ...app,
        telesale: staffMap[app.telesale_id]?.full_name || 'Không có',
        sale: staffMap[app.sale_id]?.full_name || 'Không có',
      }));
      
      setAppointments(mappedApps);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('customer_appointments', loadData);

  // Derived state
  const { groupedByDate, recheckAppointments, stats, chartData, pieData, trends } = useMemo(() => {
    const groups = {};
    const rechecks = [];
    const st = { total: 0, pt: 0, coc: 0, bong: 0, expected_bill: 0, total_deposit: 0 };
    const dates = [];

    let filteredApps = appointments;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredApps = filteredApps.filter(c => 
        (c.customer_name && c.customer_name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    filteredApps.forEach(app => {
      if (app.service && app.service.startsWith('[Tái khám]')) {
        rechecks.push(app);
        return;
      }
      st.total++;
      if (app.status === 'phau_thuat') st.pt++;
      if (app.status === 'coc') st.coc++;
      if (app.status === 'bong') st.bong++;
      st.expected_bill += Number(app.expected_bill || 0);
      if (app.status === 'coc') st.total_deposit += Number(app.deposit_amount || 0);

      const dateStr = app.appointment_date;
      if (!groups[dateStr]) {
        groups[dateStr] = [];
        dates.push(dateStr);
      }
      groups[dateStr].push(app);
    });

    const cd = dates.slice(0, 7).reverse().map(dateStr => {
      const dayApps = groups[dateStr];
      const d = new Date(dateStr);
      return {
        name: `${d.getDate()}/${d.getMonth()+1}`,
        'Tổng lịch': dayApps.length,
        'Phẫu thuật': dayApps.filter(a => a.status === 'phau_thuat').length
      };
    });

    const pd = [
      { name: 'Phẫu thuật', value: st.pt, color: '#14b8a6' },
      { name: 'Cọc', value: st.coc, color: '#3b82f6' },
      { name: 'Chờ tư vấn', value: st.total - st.pt - st.coc - st.bong, color: '#f59e0b' },
      { name: 'Bong', value: st.bong, color: '#ef4444' }
    ].filter(i => i.value > 0);

    // Xu hướng so với tháng trước
    const _now = new Date();
    const ymKey = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
    const _pm = new Date(_now.getFullYear(), _now.getMonth() - 1, 1);
    const pmKey = `${_pm.getFullYear()}-${String(_pm.getMonth() + 1).padStart(2, '0')}`;
    const cur = { total: 0, pt: 0, coc: 0, bong: 0, bill: 0, deposit: 0 };
    const prev = { total: 0, pt: 0, coc: 0, bong: 0, bill: 0, deposit: 0 };
    filteredApps.forEach(app => {
      if (app.service && app.service.startsWith('[Tái khám]')) return;
      const mk = (app.appointment_date || '').slice(0, 7);
      const b = mk === ymKey ? cur : mk === pmKey ? prev : null;
      if (!b) return;
      b.total++;
      if (app.status === 'phau_thuat') b.pt++;
      if (app.status === 'coc') { b.coc++; b.deposit += Number(app.deposit_amount || 0); }
      if (app.status === 'bong') b.bong++;
      b.bill += Number(app.expected_bill || 0);
    });
    const _pct = (c, p) => p > 0 ? Math.round((c - p) / p * 1000) / 10 : null;
    const tr = { total: _pct(cur.total, prev.total), pt: _pct(cur.pt, prev.pt), coc: _pct(cur.coc, prev.coc), bong: _pct(cur.bong, prev.bong), bill: _pct(cur.bill, prev.bill), deposit: _pct(cur.deposit, prev.deposit) };

    return { groupedByDate: groups, recheckAppointments: rechecks, stats: st, chartData: cd, pieData: pd, trends: tr };
  }, [appointments, searchQuery]);

  // Actions
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.customer_name || !createForm.appointment_date) {
      toast.error('Vui lòng nhập Tên và Ngày hẹn'); return;
    }
    setSaving(true);
    try {
      const isRecheck = createForm.appointment_type === 'recheck';
      const payload = {
        customer_name: createForm.customer_name,
        phone: createForm.phone,
        appointment_date: createForm.appointment_date,
        appointment_time: createForm.appointment_time,
        service: isRecheck ? `[Tái khám] ${createForm.service.replace('[Tái khám] ', '')}` : createForm.service,
        test_status: isRecheck ? 'Không cần' : createForm.test_status,
        expected_bill: isRecheck ? 0 : (createForm.expected_bill || 0),
        deposit_amount: isRecheck ? 0 : (createForm.deposit_amount || 0),
        telesale_id: isRecheck ? null : (createForm.telesale_id || null),
        telesale_id_2: isRecheck ? null : (createForm.telesale_id_2 || null),
        sale_id: createForm.sale_id || null,
        social_link: createForm.social_link,
        notes: createForm.notes,
        service_group: createForm.service_group,
        surgery_type: createForm.surgery_type,
        customer_source: isRecheck ? 'CSKH' : createForm.customer_source,
        customer_type: isRecheck ? 'Cũ' : createForm.customer_type,
        ...(isRecheck ? { used_service: createForm.used_service || null, surgery_date: createForm.surgery_date || null } : {}),
      };

      if (createForm.id) {
        const { error } = await supabase.from('customer_appointments').update(payload).eq('id', createForm.id);
        if (error) throw error;
        toast.success('Đã cập nhật lịch hẹn!');
      } else {
        payload.status = 'scheduled';
        payload.created_by = profile.id;
        const { error } = await supabase.from('customer_appointments').insert(payload);
        if (error) throw error;
        toast.success('Đã thêm lịch hẹn!');
      }
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (app) => {
    // Admin được sửa đầy đủ mọi thông tin ở bất kỳ trạng thái nào
    // (cập nhật chỉ đổi các trường như tạo mới, giữ nguyên trạng thái/doanh thu/viện phí).
    if (app.status !== 'scheduled' && profile?.role !== 'admin') {
      toast.error('Lịch hẹn đã đánh giá, không thể chỉnh sửa!');
      return;
    }
    setCreateForm({
      id: app.id,
      appointment_type: app.service?.startsWith('[Tái khám]') ? 'recheck' : 'new',
      appointment_date: app.appointment_date || '',
      appointment_time: app.appointment_time || '',
      customer_name: app.customer_name || '',
      phone: app.phone || '',
      service: app.service?.replace('[Tái khám] ', '') || '',
      test_status: app.test_status || 'Chưa xét nghiệm', 
      expected_bill: app.expected_bill || '',
      deposit_amount: app.deposit_amount || '',
      telesale_id: app.telesale_id || '',
      telesale_id_2: app.telesale_id_2 || '',
      sale_id: app.sale_id || '',
      social_link: app.social_link || '',
      notes: app.notes || '',
      service_group: app.service_group || 'Hàm mặt',
      surgery_type: app.surgery_type || 'Tiểu phẫu',
      customer_source: app.customer_source || 'Ads',
      customer_type: app.customer_type || 'Mới',
      used_service: app.used_service || '',
      surgery_date: app.surgery_date || ''
    });
    setShowCreateModal(true);
  };

  // Sửa nhanh Tên + SĐT khách — cho phép cả khi đã tiếp nhận/đánh giá (Admin, Telesale)
  const canEditCustomer = ['admin', 'telesale'].includes(profile?.role);
  const openCustEdit = (app) => {
    setCustForm({
      customer_name: app.customer_name || '', phone: app.phone || '',
      telesale_id: app.telesale_id || '', telesale_id_2: app.telesale_id_2 || '', sale_id: app.sale_id || '',
    });
    setCustEdit(app);
  };
  const saveCustEdit = async () => {
    if (!custForm.customer_name.trim()) { toast.error('Vui lòng nhập tên khách'); return; }
    setSaving(true);
    const payload = { customer_name: custForm.customer_name.trim(), phone: custForm.phone.trim() };
    // Chỉ Admin mới được đổi nhân sự phụ trách (ảnh hưởng ghi nhận hoa hồng)
    if (isAdmin) {
      payload.telesale_id = custForm.telesale_id || null;
      payload.telesale_id_2 = custForm.telesale_id_2 || null;
      payload.sale_id = custForm.sale_id || null;
    }
    const { error } = await supabase.from('customer_appointments')
      .update(payload)
      .eq('id', custEdit.id);
    setSaving(false);
    if (error) { toast.error('Lỗi cập nhật: ' + error.message); return; }
    toast.success('Đã cập nhật thông tin khách');
    setCustEdit(null);
    loadData();
  };

  const openEval = (app) => {
    setEvalApp(app);
    setEvalForm({
      status: app.status === 'scheduled' ? 'phau_thuat' : app.status,
      surgery_type: app.surgery_type || 'Tiểu phẫu',
      expected_surgery_date: app.expected_surgery_date || app.surgery_date || today.toISOString().split('T')[0],
      revenue: app.revenue || '',
      upsale_revenue: app.upsale_revenue || '',
      service: app.service || '',
      deposit_date: app.deposit_date || today.toISOString().split('T')[0],
      deposit_amount: app.deposit_amount || '',
      notes: app.notes || '',
      consult_note: app.consult_note || ''
    });
    setConsultFiles([]);
    setShowEvalModal(true);
  };

  const receiveConsult = async (app) => {
    const { error } = await supabase.from('customer_appointments').update({ consult_received: true }).eq('id', app.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã tiếp nhận tư vấn — khách vào module “Khách tư vấn”');
    loadData();
  };

  const handleEvalSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let updateData = { status: evalForm.status, surgery_type: evalForm.surgery_type };
      if (evalForm.status === 'phau_thuat') {
        // Lên phẫu thuật: ghi doanh thu/ngày mổ, xoá dấu bong cũ (nếu có)
        updateData = { ...updateData, surgery_date: evalForm.expected_surgery_date, expected_surgery_date: evalForm.expected_surgery_date, revenue: evalForm.revenue || 0, upsale_revenue: evalForm.upsale_revenue || 0, service: evalForm.service, bong_date: null };
      } else if (evalForm.status === 'coc') {
        // Cọc: chưa mổ → xoá doanh thu/ngày mổ và dấu bong cũ
        updateData = { ...updateData, deposit_date: evalForm.deposit_date, deposit_amount: evalForm.deposit_amount || 0, service: evalForm.service, expected_surgery_date: evalForm.expected_surgery_date, revenue: 0, upsale_revenue: 0, surgery_date: null, bong_date: null };
      } else if (evalForm.status === 'bong') {
        // Bong: huỷ → xoá doanh thu/ngày mổ để không lọt vào thống kê
        updateData = { ...updateData, notes: evalForm.notes, bong_date: new Date().toISOString().split('T')[0], revenue: 0, upsale_revenue: 0, surgery_date: null };
      }

      // Hồ sơ tư vấn: upload ảnh mới + giữ ảnh cũ + ghi chú
      const consultUrls = [...(evalApp.consult_image_urls || [])];
      for (const f of consultFiles) consultUrls.push(await uploadToR2(f, 'consult-files'));
      updateData.consult_note = evalForm.consult_note || null;
      updateData.consult_image_urls = consultUrls;

      const { data: updated, error } = await supabase.from('customer_appointments').update(updateData).eq('id', evalApp.id).select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('Cập nhật bị từ chối (quyền RLS). Cần chạy SQL phân quyền — báo admin.');

      toast.success('Đã lưu đánh giá!');
      setShowEvalModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteApp = async (id) => {
    if(!window.confirm('Bạn có chắc muốn xóa lịch hẹn này?')) return;
    const { error } = await supabase.from('customer_appointments').delete().eq('id', id);
    if(error) toast.error('Lỗi xóa: ' + error.message);
    else { toast.success('Đã xóa'); loadData(); }
  };

  const StatusBadge = ({ status }) => {
    switch(status) {
      case 'phau_thuat': return <span className="px-3 py-1 bg-teal-100 text-teal-700 font-semibold rounded-full text-xs">Phẫu thuật</span>;
      case 'coc': return <span className="px-3 py-1 bg-blue-100 text-blue-700 font-semibold rounded-full text-xs">Đã cọc</span>;
      case 'bong': return <span className="px-3 py-1 bg-red-100 text-red-700 font-semibold rounded-full text-xs">Khách bong</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-600 font-semibold rounded-full text-xs">Chờ tư vấn</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header — MOBILE (xanh tối, tràn viền) */}
      <div className="lg:hidden relative overflow-hidden -mx-4 -mt-4 px-4 pt-4 pb-6 rounded-b-[28px] text-white shadow-lg" style={{ background: 'linear-gradient(160deg,#0b3b34 0%,#0f5148 55%,#136b5e 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <h2 className="text-2xl font-bold text-white">Lịch hẹn</h2>
          <p className="text-white/70 text-sm mt-0.5">Quản lý và đánh giá khách hàng theo lịch hẹn</p>
        </div>
      </div>

      {/* Header — DESKTOP */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Lịch hẹn</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý và đánh giá khách hàng theo lịch hẹn</p>
        </div>
        <div className="flex gap-2">
          {['telesale', 'sale_offline', 'admin'].includes(profile?.role) && (
            <button onClick={() => {
              setCreateForm({
                appointment_type: 'new',
                appointment_date: today.toISOString().split('T')[0], appointment_time: '09:00',
                customer_name: '', phone: '', service: '', test_status: 'Chưa xét nghiệm', 
                expected_bill: '', deposit_amount: '', telesale_id: '', sale_id: '', social_link: '', notes: '',
                service_group: 'Hàm mặt', surgery_type: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới'
              });
              setShowCreateModal(true);
            }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Thêm lịch Tư vấn / PT
            </button>
          )}
          {['dieu_duong', 'admin'].includes(profile?.role) && (
            <button onClick={() => {
              setCreateForm({
                appointment_type: 'recheck',
                appointment_date: today.toISOString().split('T')[0], appointment_time: '09:00',
                customer_name: '', phone: '', service: '', test_status: 'Không cần', 
                expected_bill: 0, deposit_amount: 0, telesale_id: null, sale_id: '', social_link: '', notes: '',
                service_group: 'Hàm mặt', surgery_type: 'Tiểu phẫu', customer_source: 'CSKH', customer_type: 'Cũ'
              });
              setShowCreateModal(true);
            }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Thêm lịch Tái khám
            </button>
          )}
        </div>
      </div>

      {['telesale', 'sale_offline', 'admin'].includes(profile?.role) && (
        <button onClick={() => { setCreateForm({ appointment_type: 'new', appointment_date: today.toISOString().split('T')[0], appointment_time: '09:00', customer_name: '', phone: '', service: '', test_status: 'Chưa xét nghiệm', expected_bill: '', deposit_amount: '', telesale_id: '', sale_id: '', social_link: '', notes: '', service_group: 'Hàm mặt', surgery_type: 'Tiểu phẫu', customer_source: 'Ads', customer_type: 'Mới' }); setShowCreateModal(true); }} title="Thêm lịch" className="lg:hidden fixed z-[60] bottom-20 right-5 w-14 h-14 rounded-full bg-teal-600 text-white shadow-2xl shadow-teal-900/40 ring-4 ring-teal-500/20 flex items-center justify-center hover:bg-teal-700 active:scale-95 transition">
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: CalendarDays, color: '#3b82f6', label: 'Tổng lịch hẹn', value: stats.total, trend: trends.total },
              { icon: Stethoscope, color: '#14b8a6', label: 'Phẫu thuật', value: stats.pt, trend: trends.pt },
              { icon: Wallet, color: '#3b82f6', label: 'Đã cọc', value: stats.coc, trend: trends.coc },
              { icon: Ban, color: '#ef4444', label: 'Khách bong', value: stats.bong, trend: trends.bong },
              { icon: Activity, color: '#f59e0b', label: 'Tổng bill dự kiến', value: stats.expected_bill.toLocaleString('vi-VN') + 'đ', trend: trends.bill },
              { icon: Activity, color: '#14b8a6', label: 'Tổng đã cọc', value: stats.total_deposit.toLocaleString('vi-VN') + 'đ', trend: trends.deposit },
            ].map((c, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: c.color + '1a' }}><c.icon className="w-5 h-5" style={{ color: c.color }} /></span>
                <div className="text-xl font-bold text-slate-800">{c.value}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{c.label}</div>
                {c.trend != null
                  ? <div className={`text-[11px] font-semibold mt-2 ${c.trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{c.trend >= 0 ? '↑' : '↓'} {Math.abs(c.trend)}% <span className="text-slate-400 font-normal">so với tháng trước</span></div>
                  : <div className="text-[11px] text-slate-300 mt-2">— so với tháng trước</div>}
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-700 font-bold mb-3">Tỷ lệ trạng thái</h3>
              {pieData.length === 0 ? <div className="text-sm text-slate-400 py-12 text-center">Chưa có dữ liệu</div> : (
              <div className="flex items-center gap-4">
                <div className="relative w-[150px] h-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={54} outerRadius={74} paddingAngle={3} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-2xl font-bold text-slate-800">{stats.total}</div><div className="text-[10px] text-slate-400">Tổng lịch hẹn</div></div>
                </div>
                <div className="flex-1 min-w-0 space-y-2.5">
                  {pieData.map((e, i) => { const tot = pieData.reduce((s, x) => s + x.value, 0); const p = tot ? Math.round(e.value / tot * 1000) / 10 : 0; return (
                    <div key={i} className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} /><span className="flex-1 min-w-0 text-slate-600">{e.name}</span><span className="font-bold text-slate-700">{e.value}</span><span className="text-slate-400 text-xs">({p}%)</span></div>
                  ); })}
                </div>
              </div>)}
            </div>
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3"><h3 className="text-slate-700 font-bold">Biểu đồ lịch hẹn theo ngày</h3><span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1">7 ngày qua</span></div>
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                    <Legend />
                    <Line type="monotone" dataKey="Tổng lịch" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Phẫu thuật" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* View Tabs & Search */}
          <div className="mt-8 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 inline-flex shadow-sm">
              <button 
                onClick={() => setActiveViewTab('appointments')}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeViewTab === 'appointments' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <CalendarIcon className="w-4 h-4" /> Lịch hẹn tư vấn / phẫu thuật ({stats.total - recheckAppointments.length})
              </button>
              <button 
                onClick={() => setActiveViewTab('rechecks')}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeViewTab === 'rechecks' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <Stethoscope className="w-4 h-4" /> Lịch tái khám ({recheckAppointments.length})
              </button>
            </div>
            
            <div className="relative w-full sm:w-80 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Tìm tên KH hoặc số điện thoại..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Tab Content */}
          {activeViewTab === 'rechecks' ? (
            recheckAppointments.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(
                  recheckAppointments.reduce((acc, app) => {
                    if (!acc[app.appointment_date]) acc[app.appointment_date] = [];
                    acc[app.appointment_date].push(app);
                    return acc;
                  }, {})
                ).sort(([a], [b]) => new Date(b) - new Date(a)).map(([dateStr, apps]) => (
                  <div key={dateStr} className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
                      <div className="flex items-center gap-2 text-orange-800 font-bold">
                        <Stethoscope className="w-5 h-5" />
                        {new Date(dateStr).toLocaleDateString('vi-VN')}
                      </div>
                      <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">{apps.length} lịch</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {apps.map(app => (
                        <div key={app.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <User className="w-5 h-5 text-orange-600" />
                              <span className="font-bold text-slate-800 text-base">{app.customer_name}</span>
                            </div>
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 font-semibold rounded-full text-xs">Tái khám</span>
                          </div>
                          
                          <div className="p-4 space-y-4 flex-1">
                            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span>{app.appointment_time?.substring(0,5) || '--:--'}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-orange-700">{app.service?.replace('[Tái khám] ', '') || 'Chưa chọn dịch vụ'}</span>
                            </div>

                            <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 space-y-2 text-sm">
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500 shrink-0">Lý do tái khám:</span>
                                <span className="font-medium text-slate-700 text-right">{app.service?.replace('[Tái khám] ', '') || '—'}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500 shrink-0">Dịch vụ sử dụng:</span>
                                <span className="font-medium text-slate-700 text-right">{app.used_service || '—'}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500 shrink-0">Ngày phẫu thuật:</span>
                                <span className="font-medium text-slate-700 text-right">{app.surgery_date ? new Date(app.surgery_date).toLocaleDateString('vi-VN') : '—'}</span>
                              </div>
                              <div className="flex justify-between gap-2 border-t border-orange-100 pt-2">
                                <span className="text-slate-500 shrink-0">Phụ trách:</span>
                                <span className="font-semibold text-orange-700 text-right">{app.sale || 'Không có'}</span>
                              </div>
                            </div>
                            
                            {app.social_link && (
                              <a href={app.social_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline">
                                <LinkIcon className="w-3 h-3" /> Xem link tham khảo
                              </a>
                            )}
                          </div>

                          <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center gap-2 mt-auto">
                            {(isAdmin || isNurse) && (
                              <button onClick={() => setViewNoteApp(app)} className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 font-bold text-sm py-2 rounded-xl hover:bg-blue-100 transition-colors">
                                <FileText className="w-4 h-4" /> Lịch sử chăm sóc
                              </button>
                            )}
                            {(isAdmin || isNurse) && (
                              <button onClick={() => openEditModal(app)} className="w-10 h-10 flex shrink-0 items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors" title="Sửa lịch tái khám">
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {(isAdmin || isHeadNurse) && (
                              <button onClick={() => deleteApp(app.id)} className="w-10 h-10 flex shrink-0 items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium">
                Chưa có lịch tái khám nào.
              </div>
            )
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedByDate).sort((a,b) => new Date(b) - new Date(a)).map(dateStr => (
                <div key={dateStr} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-teal-700 font-bold">
                      <CalendarIcon className="w-5 h-5" />
                      {new Date(dateStr).toLocaleDateString('vi-VN')}
                    </div>
                    <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">{groupedByDate[dateStr].length} lịch</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupedByDate[dateStr].map(app => (
                      <div key={app.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                          <div className="flex items-start gap-2 min-w-0">
                            <User className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-base truncate">{app.customer_name}</div>
                              {app.phone && <a href={`tel:${app.phone}`} className="text-sm text-blue-600 flex items-center gap-1 mt-0.5"><Phone className="w-3.5 h-3.5" /> {app.phone}</a>}
                            </div>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                        
                        <div className="p-4 space-y-4 flex-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{app.appointment_time?.substring(0,5) || '--:--'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-teal-700">{app.service || 'Chưa chọn dịch vụ'}</span>
                          </div>

                          <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-3 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Telesale:</span>
                              <span className="font-semibold text-blue-700">{app.telesale}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Sale Offline:</span>
                              <span className="font-semibold text-purple-700">{app.sale}</span>
                            </div>
                            <div className="border-t border-teal-100/60 my-1 pt-1" />
                            <div className="flex justify-between">
                              <span className="text-slate-500">Dự kiến:</span>
                              <span className="font-bold text-teal-700">{Number(app.expected_bill||0).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Đã cọc:</span>
                              <span className="font-bold text-teal-700">{Number(app.deposit_amount||0).toLocaleString('vi-VN')}đ</span>
                            </div>
                          </div>
                          
                          {app.social_link && (
                            <a href={app.social_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline">
                              <LinkIcon className="w-3 h-3" /> Xem link tham khảo
                            </a>
                          )}
                        </div>

                        <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex flex-col gap-2 mt-auto">
                          {app.notes && (isAdmin || ['telesale', 'sale_offline'].includes(profile?.role)) && (
                            <button onClick={() => setViewNoteApp(app)} className="w-full py-2 bg-teal-50 text-teal-700 border border-teal-200 font-bold text-sm rounded-xl hover:bg-teal-100 transition-colors flex items-center justify-center gap-2">
                              <FileText className="w-4 h-4" /> Tình trạng KH
                            </button>
                          )}
                          {app.care_notes && (
                            <button onClick={() => setCareHistoryApp(app)} className="w-full py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                              <MessageCircle className="w-4 h-4" /> Lịch sử tư vấn
                            </button>
                          )}
                          {profile?.role !== 'sale_offline' && ((app.consult_image_urls || []).length > 0 || app.consult_note) && (
                            <button onClick={() => setConsultView(app)} className="w-full py-2 bg-teal-50 text-teal-700 border border-teal-200 font-bold text-sm rounded-xl hover:bg-teal-100 transition-colors flex items-center justify-center gap-2">
                              <ImagePlus className="w-4 h-4" /> Hồ sơ tư vấn
                            </button>
                          )}
                          {app.status === 'scheduled' && !app.consult_received && ['admin', 'sale_offline', 'telesale'].includes(profile?.role) && (
                            <button onClick={() => receiveConsult(app)} className="w-full py-2 bg-teal-600 text-white font-bold text-sm rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2">
                              <UserCheck className="w-4 h-4" /> Tiếp nhận tư vấn
                            </button>
                          )}
                          {app.consult_received && app.status === 'scheduled' && (
                            <div className="w-full py-1.5 text-center text-xs font-semibold text-teal-600 bg-teal-50 rounded-lg">✓ Đã tiếp nhận tư vấn</div>
                          )}
                          {app.status === 'phau_thuat' && (isAdmin || ['accountant', 'telesale', 'sale_offline', 'cskh', 'dieu_duong'].includes(profile?.role)) && (
                            <button onClick={() => createReview(app)} disabled={creatingReview === app.id}
                              className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold text-sm rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                              {creatingReview === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Tạo phiếu đánh giá
                            </button>
                          )}
                          <div className="flex items-center gap-2 w-full">
                            {profile?.role === 'admin' && (
                              <button onClick={() => openEval(app)} className="flex-1 flex items-center justify-center gap-2 bg-teal-50 text-teal-700 border border-teal-200 font-bold text-sm py-2 rounded-xl hover:bg-teal-100 transition-colors">
                                <Edit className="w-4 h-4" /> Đánh giá
                              </button>
                            )}
                            {(profile?.role === 'admin' || (['telesale', 'sale_offline'].includes(profile?.role) && app.status === 'scheduled')) && (
                              <button onClick={() => openEditModal(app)} className="w-10 h-10 flex shrink-0 items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" title="Sửa đầy đủ thông tin">
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canEditCustomer && (
                              <button onClick={() => openCustEdit(app)} className="w-10 h-10 flex shrink-0 items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors" title="Sửa tên & SĐT khách">
                                <User className="w-4 h-4" />
                              </button>
                            )}
                            {(isAdmin || ['telesale', 'sale_offline'].includes(profile?.role)) && (
                              <button onClick={() => deleteApp(app.id)} className="w-10 h-10 flex shrink-0 items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Thêm Lịch Hẹn Mới */}
      {showCreateModal && (
         <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-start pt-10 pb-10 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-xl">{createForm.id ? 'Cập nhật lịch hẹn' : (createForm.appointment_type === 'new' ? 'Thêm lịch Tư vấn / PT' : 'Thêm lịch Tái khám')}</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-8">
              {/* Thông tin Khách hàng */}
              <section>
                <h4 className="text-sm font-bold text-teal-700 uppercase mb-4 tracking-wider border-b pb-2">Thông tin khách hàng</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ngày hẹn <span className="text-red-500">*</span></label>
                    <input required type="date" value={createForm.appointment_date} onChange={e => setCreateForm({...createForm, appointment_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Giờ hẹn <span className="text-red-500">*</span></label>
                    <input required type="time" value={createForm.appointment_time} onChange={e => setCreateForm({...createForm, appointment_time: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                    <input required value={createForm.customer_name} onChange={e => setCreateForm({...createForm, customer_name: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="Nhập tên..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                    <input required value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="Nhập SĐT..." />
                  </div>
                  {createForm.appointment_type === 'new' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nguồn khách <span className="text-red-500">*</span></label>
                        <select value={createForm.customer_source} onChange={e => setCreateForm({...createForm, customer_source: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                          <option value="Ads">Ads</option>
                          <option value="Seeding">Seeding</option>
                          <option value="Người quen">Người quen</option>
                          <option value="CTV">CTV</option>
                          <option value="CSKH">CSKH</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tệp khách hàng <span className="text-red-500">*</span></label>
                        <select value={createForm.customer_type} onChange={e => setCreateForm({...createForm, customer_type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                          <option value="Mới">Khách Mới</option>
                          <option value="Cũ">Khách Cũ</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Chi tiết dịch vụ */}
              <section>
                <h4 className="text-sm font-bold text-teal-700 uppercase mb-4 tracking-wider border-b pb-2">{createForm.appointment_type === 'new' ? 'Chi tiết dịch vụ' : 'Dịch vụ tái khám'}</h4>
                <div className={`grid grid-cols-1 gap-4 ${createForm.appointment_type === 'new' ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{createForm.appointment_type === 'new' ? 'Dịch vụ' : 'Lý do tái khám / Dịch vụ cũ'} <span className="text-red-500">*</span></label>
                    <input required value={createForm.service} onChange={e => setCreateForm({...createForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder={createForm.appointment_type === 'new' ? "Chọn dịch vụ" : "VD: Tái khám cắt chỉ mũi"} />
                  </div>
                  {createForm.appointment_type === 'recheck' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ sử dụng</label>
                      <input value={createForm.used_service} onChange={e => setCreateForm({...createForm, used_service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="VD: Cắt mí trên, nâng mũi" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm dịch vụ <span className="text-red-500">*</span></label>
                    <select value={createForm.service_group} onChange={e => setCreateForm({...createForm, service_group: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                      <option value="Hàm mặt">Hàm mặt</option>
                      <option value="Body">Body</option>
                      <option value="Tiểu phẫu">Tiểu phẫu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Loại phẫu thuật <span className="text-red-500">*</span></label>
                    <select value={createForm.surgery_type} onChange={e => setCreateForm({...createForm, surgery_type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                      <option value="Tiểu phẫu">Tiểu phẫu</option>
                      <option value="Đại phẫu">Đại phẫu</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-400">Quyết định thưởng hẹn telesale: Tiểu phẫu 300k · Đại phẫu 500k / khách</p>
                  </div>
                  {createForm.appointment_type === 'recheck' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ngày phẫu thuật</label>
                      <input type="date" value={createForm.surgery_date} onChange={e => setCreateForm({...createForm, surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                    </div>
                  )}
                  {createForm.appointment_type === 'new' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tình trạng xét nghiệm</label>
                        <select value={createForm.test_status} onChange={e => setCreateForm({...createForm, test_status: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                          <option>Chưa xét nghiệm</option>
                          <option>Đã xét nghiệm</option>
                          <option>Không cần</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Bill dự kiến (VNĐ)</label>
                        <MoneyInput value={createForm.expected_bill} onChange={v => setCreateForm({...createForm, expected_bill: v})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Đã cọc (VNĐ)</label>
                        <MoneyInput value={createForm.deposit_amount} onChange={v => setCreateForm({...createForm, deposit_amount: v})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="0" />
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Phụ trách & Ghi chú */}
              <section>
                <h4 className="text-sm font-bold text-teal-700 uppercase mb-4 tracking-wider border-b pb-2">Phụ trách & Ghi chú</h4>
                <div className={`grid grid-cols-1 gap-4 mb-4 ${createForm.appointment_type === 'new' ? 'md:grid-cols-2' : ''}`}>
                  {createForm.appointment_type === 'new' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telesale phụ trách</label>
                      <select value={createForm.telesale_id} onChange={e => setCreateForm({...createForm, telesale_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                        <option value="">-- Không có --</option>
                        {staffList.filter(s => s.role === 'telesale' || s.role_2 === 'telesale').map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {createForm.appointment_type === 'new' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telesale phụ trách 2 <span className="text-slate-400 font-normal">(nếu có — chia đôi hoa hồng)</span></label>
                      <select value={createForm.telesale_id_2} onChange={e => setCreateForm({...createForm, telesale_id_2: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                        <option value="">-- Không có --</option>
                        {staffList.filter(s => (s.role === 'telesale' || s.role_2 === 'telesale') && s.id !== createForm.telesale_id).map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{createForm.appointment_type === 'new' ? 'Sale Offline phụ trách' : 'Người phụ trách (Sale/Điều dưỡng)'}</label>
                    <select value={createForm.sale_id} onChange={e => setCreateForm({...createForm, sale_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                      <option value="">-- Không có --</option>
                      {staffList.filter(s => {
                        const r = [s.role, s.role_2];
                        if (createForm.appointment_type === 'new') return r.includes('sale_offline');
                        return r.includes('sale_offline') || r.includes('dieu_duong');
                      }).map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Thông tin tham khảo (Link FB, Zalo...)</label>
                  <input type="text" value={createForm.social_link} onChange={e => setCreateForm({...createForm, social_link: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="Link profile khách hàng..." />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-sm font-medium text-slate-700">Note tình trạng khách hàng</label>
                    <label className="cursor-pointer inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-bold transition-colors">
                      {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      {uploadingImage ? 'Đang tải...' : 'Đính kèm ảnh'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  </div>
                  <textarea rows={3} value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none resize-none" placeholder="Ghi chú chi tiết về tình trạng, mong muốn..." />
                </div>
              </section>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors">
                  {saving ? 'Đang lưu...' : 'Lưu Lịch Hẹn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đánh Giá */}
      {showEvalModal && evalApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">Đánh giá lịch hẹn: {evalApp.customer_name}</h3>
              <button onClick={() => setShowEvalModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEvalSubmit} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 space-y-6 bg-slate-50 overflow-y-auto flex-1">
              {/* Tabs */}
              <div className="flex rounded-full bg-white border border-slate-200 p-1">
                <button type="button" onClick={() => setEvalForm({...evalForm, status: 'bong'})}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${evalForm.status === 'bong' ? 'bg-orange-400 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Bong
                </button>
                <button type="button" onClick={() => setEvalForm({...evalForm, status: 'coc'})}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${evalForm.status === 'coc' ? 'bg-teal-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Cọc
                </button>
                <button type="button" onClick={() => setEvalForm({...evalForm, status: 'phau_thuat'})}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${evalForm.status === 'phau_thuat' ? 'bg-orange-300 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Phẫu thuật
                </button>
              </div>

              {/* Loại phẫu thuật — quyết định mức thưởng hẹn telesale (Tiểu 300k / Đại 500k) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <label className="block text-sm font-bold text-slate-700 mb-2">Loại phẫu thuật <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {['Tiểu phẫu', 'Đại phẫu'].map(t => (
                    <button key={t} type="button" onClick={() => setEvalForm({...evalForm, surgery_type: t})}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors ${evalForm.surgery_type === t ? 'bg-purple-500 text-white border-purple-500 shadow' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">Thưởng hẹn telesale: Tiểu phẫu 300k · Đại phẫu 500k / khách</p>
              </div>

              {/* Form Nội dung */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                {evalForm.status === 'phau_thuat' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Ngày phẫu thuật <span className="text-red-500">*</span></label>
                        <input type="date" required value={evalForm.expected_surgery_date} onChange={e => setEvalForm({...evalForm, expected_surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Doanh thu (VNĐ) <span className="text-red-500">*</span></label>
                        <MoneyInput required value={evalForm.revenue} onChange={v => setEvalForm({...evalForm, revenue: v})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-teal-600 font-semibold" placeholder="VD: 50.000.000" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Doanh thu Upsale (VNĐ)</label>
                      <MoneyInput value={evalForm.upsale_revenue} onChange={v => setEvalForm({...evalForm, upsale_revenue: v})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-teal-600 font-semibold" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Dịch vụ thực tế làm</label>
                      <input type="text" value={evalForm.service} onChange={e => setEvalForm({...evalForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="VD: Nâng mũi" />
                    </div>
                  </>
                )}

                {evalForm.status === 'coc' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Ngày cọc <span className="text-red-500">*</span></label>
                        <input type="date" required value={evalForm.deposit_date} onChange={e => setEvalForm({...evalForm, deposit_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tiền cọc (VNĐ) <span className="text-red-500">*</span></label>
                        <MoneyInput required value={evalForm.deposit_amount} onChange={v => setEvalForm({...evalForm, deposit_amount: v})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-teal-600 font-semibold" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Ngày PT dự kiến</label>
                      <input type="date" value={evalForm.expected_surgery_date} onChange={e => setEvalForm({...evalForm, expected_surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Dịch vụ sử dụng</label>
                      <input type="text" value={evalForm.service} onChange={e => setEvalForm({...evalForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                    </div>
                  </>
                )}

                {evalForm.status === 'bong' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chú / Lý do khách bong</label>
                    <textarea rows={4} value={evalForm.notes} onChange={e => setEvalForm({...evalForm, notes: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-orange-400 outline-none resize-none" placeholder="Khách báo kẹt tiền, khách đổi ý..." />
                  </div>
                )}

                {/* Hồ sơ tư vấn (ghi chú + ảnh) — áp dụng mọi trạng thái */}
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Hồ sơ tư vấn</label>
                  <textarea rows={2} value={evalForm.consult_note} onChange={e => setEvalForm({ ...evalForm, consult_note: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none resize-none text-sm" placeholder="Ghi chú hồ sơ tư vấn..." />
                  {((evalApp.consult_image_urls || []).length > 0 || consultFiles.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(evalApp.consult_image_urls || []).map((u, i) => (
                        <img key={'old' + i} src={u} alt="" onClick={() => setViewImage(u)} className="w-16 h-16 rounded-lg object-cover border border-slate-200 cursor-pointer" />
                      ))}
                      {consultFiles.map((f, i) => (
                        <div key={'new' + i} className="relative w-16 h-16">
                          <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-lg object-cover border border-teal-300" />
                          <button type="button" onClick={() => setConsultFiles(fs => fs.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 border border-dashed border-teal-300 rounded-xl cursor-pointer hover:bg-teal-50 text-teal-700 text-sm font-semibold">
                    <ImagePlus className="w-4 h-4" /> Thêm ảnh hồ sơ tư vấn
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => setConsultFiles(fs => [...fs, ...Array.from(e.target.files || [])])} />
                  </label>
                </div>
              </div>
              </div>

              <div className="p-4 bg-white border-t shrink-0">
              <button type="submit" disabled={saving}
                className="w-full py-3.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 disabled:opacity-50">
                {saving ? 'Đang lưu...' : `Xác nhận khách ${evalForm.status === 'bong' ? 'Bong' : evalForm.status === 'coc' ? 'Cọc' : 'Phẫu thuật'}`}
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Note (Lịch sử chăm sóc) */}
      {viewNoteApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">Lịch sử chăm sóc: {viewNoteApp.customer_name}</h3>
              <button onClick={() => setViewNoteApp(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 flex-1">
              {viewNoteApp.notes ? (
                renderNotes(viewNoteApp.notes)
              ) : (
                <div className="text-slate-400 italic text-center py-4">Chưa có lịch sử chăm sóc.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Lịch sử tư vấn (care_notes từ Khách Cọc/Bong) */}
      {careHistoryApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 shrink-0">
              <div>
                <h3 className="font-bold text-indigo-800 text-lg">Lịch sử tư vấn</h3>
                <p className="text-xs text-indigo-400 mt-0.5">{careHistoryApp.customer_name} · {careHistoryApp.phone}</p>
              </div>
              <button onClick={() => setCareHistoryApp(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 flex-1">
              {careHistoryApp.care_notes ? renderNotes(careHistoryApp.care_notes) : (
                <div className="text-slate-400 italic text-center py-4">Chưa có lịch sử tư vấn.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Hồ sơ tư vấn (ảnh + ghi chú) */}
      {consultView && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-teal-50 shrink-0">
              <div>
                <h3 className="font-bold text-teal-800 text-lg">Hồ sơ tư vấn</h3>
                <p className="text-xs text-teal-500 mt-0.5">{consultView.customer_name} · {consultView.phone}</p>
              </div>
              <button onClick={() => setConsultView(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {consultView.consult_note && (
                <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap">{consultView.consult_note}</div>
              )}
              {(consultView.consult_image_urls || []).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {consultView.consult_image_urls.map((u, i) => (
                    <img key={i} src={u} alt="" onClick={() => setViewImage(u)} className="w-full h-28 rounded-xl object-cover border border-slate-200 cursor-zoom-in hover:opacity-90" />
                  ))}
                </div>
              ) : (!consultView.consult_note && <div className="text-slate-400 italic text-center py-4">Chưa có hồ sơ tư vấn.</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
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

      {/* Sửa nhanh Tên + SĐT khách (Admin / Telesale) — dùng được ở mọi trạng thái */}
      {custEdit && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
              <h3 className="font-bold text-amber-800 flex items-center gap-2"><User className="w-4 h-4" /> Sửa thông tin khách</h3>
              <button onClick={() => setCustEdit(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách <span className="text-red-500">*</span></label>
                <input value={custForm.customer_name} onChange={e => setCustForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 outline-none" placeholder="Tên khách hàng" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                <input value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))}
                  inputMode="tel" className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 outline-none" placeholder="SĐT khách" />
              </div>
              {isAdmin && (
                <>
                  <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nhân sự phụ trách (ảnh hưởng hoa hồng)</div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telesale phụ trách</label>
                    <select value={custForm.telesale_id} onChange={e => setCustForm(f => ({ ...f, telesale_id: e.target.value, telesale_id_2: e.target.value === f.telesale_id_2 ? '' : f.telesale_id_2 }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 outline-none bg-white">
                      <option value="">— Không có —</option>
                      {staffList.filter(s => s.role === 'telesale' || s.role_2 === 'telesale').map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telesale phụ trách 2 <span className="text-slate-400 font-normal">(chia đôi hoa hồng)</span></label>
                    <select value={custForm.telesale_id_2} onChange={e => setCustForm(f => ({ ...f, telesale_id_2: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 outline-none bg-white">
                      <option value="">— Không có —</option>
                      {staffList.filter(s => (s.role === 'telesale' || s.role_2 === 'telesale') && s.id !== custForm.telesale_id).map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sale Offline phụ trách</label>
                    <select value={custForm.sale_id} onChange={e => setCustForm(f => ({ ...f, sale_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-400 outline-none bg-white">
                      <option value="">— Không có —</option>
                      {staffList.filter(s => s.role === 'sale_offline' || s.role_2 === 'sale_offline').map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
              <button onClick={() => setCustEdit(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Hủy</button>
              <button onClick={saveCustEdit} disabled={saving} className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagementPage;
