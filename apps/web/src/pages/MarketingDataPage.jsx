import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { parseCSV, downloadCsv } from '@/lib/csv';
import QRCode from 'qrcode';
import { Bars, Donut, STATUS_COLORS, OUTCOME_COLORS } from '@/components/report/ReportViz.jsx';
import { maskPhone, phoneView } from '@/lib/phoneMask';
import { Database, Plus, Upload, Search, X, Trash2, Link2, Download, Users, Flame, CheckCircle2, Headphones, UserX, ChevronLeft, ChevronRight, Phone, PhoneCall, HeartHandshake, Clock, Copy, CalendarClock, Save, FileText, CalendarDays, Sparkles, UserPlus, SlidersHorizontal, Send, MoreHorizontal, ArrowLeft, Mail, MapPin, Cake, Tag, Wallet, Receipt, Stethoscope, Activity, Lightbulb, Gauge, AlertTriangle, MessageSquare, Pencil, Gem, Hash, UserCheck } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

const STATUS = {
  tiep_can: { label: 'Tiếp cận', cls: 'bg-slate-100 text-slate-600' },
  nong: { label: 'Nóng', cls: 'bg-rose-100 text-rose-700' },
  tiem_nang: { label: 'Tiềm năng', cls: 'bg-amber-100 text-amber-700' },
  da_hen_lich: { label: 'Đã hẹn lịch', cls: 'bg-blue-100 text-blue-700' },
  coc: { label: 'Cọc', cls: 'bg-violet-100 text-violet-700' },
  da_lam_dv: { label: 'Đã làm dịch vụ', cls: 'bg-teal-100 text-teal-700' },
  sai_gon: { label: 'Sài Gòn', cls: 'bg-cyan-100 text-cyan-700' },
  chot_fail: { label: 'Chốt Fail', cls: 'bg-orange-100 text-orange-700' },
  mat: { label: 'Mất', cls: 'bg-slate-200 text-slate-500' },
};
// Kết quả cuộc gọi (nhật ký gọi)
const OUTCOMES = {
  nghe_may: { label: 'Nghe máy', cls: 'bg-emerald-100 text-emerald-700' },
  khong_nghe: { label: 'Không nghe máy', cls: 'bg-slate-100 text-slate-500' },
  may_ban: { label: 'Máy bận', cls: 'bg-amber-100 text-amber-700' },
  hen_goi_lai: { label: 'Hẹn gọi lại', cls: 'bg-blue-100 text-blue-700' },
  can_nhac: { label: 'Đang cân nhắc', cls: 'bg-violet-100 text-violet-700' },
  tu_choi: { label: 'Từ chối', cls: 'bg-rose-100 text-rose-700' },
  sai_so: { label: 'Sai số / không liên lạc', cls: 'bg-slate-200 text-slate-500' },
};
const LABEL_TO_CODE = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [v.label.toLowerCase(), k]));
const phoneKey = (p) => { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('84')) d = '0' + d.slice(2); return d.slice(-9); };
const APPT_STAGE = (a) => {
  if (!a) return null;
  if (a.post_op_status) return { label: 'Hậu phẫu / CSKH', cls: 'bg-teal-100 text-teal-700' };
  return ({ scheduled: { label: 'Lịch hẹn', cls: 'bg-blue-100 text-blue-700' }, coc: { label: 'Cọc', cls: 'bg-violet-100 text-violet-700' }, bong: { label: 'Bong', cls: 'bg-rose-100 text-rose-700' }, phau_thuat: { label: 'Phẫu thuật', cls: 'bg-teal-100 text-teal-700' }, cancelled: { label: 'Đã huỷ', cls: 'bg-slate-100 text-slate-400' } })[a.status] || { label: a.status, cls: 'bg-slate-100 text-slate-500' };
};
const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none';
// "19:30 - 01/08"
const fmtDT = (s) => { if (!s) return ''; const d = new Date(s); return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`; };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
const isDue = (iso) => !!iso && new Date(iso) <= endOfToday();
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
// Link Zalo theo SĐT (0xxx -> 84xxx)
const zaloLink = (p) => { const d = String(p || '').replace(/\D/g, ''); return d ? `https://zalo.me/${d.startsWith('0') ? '84' + d.slice(1) : d}` : '#'; };
// Ngày data VỀ (ưu tiên ngày tạo bên GetFly)
const arrivedAt = (r) => r.getfly_created_at || r.created_at;
const dayKey = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const todayKey = () => dayKey(new Date().toISOString());
const fmtD = (iso) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); };
// Độ ưu tiên gọi: tới hạn gọi lại -> nóng -> tiềm năng -> chưa gọi lần nào -> còn lại.
const callPriority = (r) => {
  if (isDue(r.next_call_at)) return 0;
  if (r.status === 'nong') return 1;
  if (r.status === 'tiem_nang') return 2;
  if (!r.last_contact_at) return 3;
  return 4;
};

const MarketingDataPage = () => {
  const { profile: me } = useAuth();
  const roles = [me?.role, me?.role_2].filter(Boolean);
  const canWrite = ['marketing', 'truc_page', 'telesale', 'admin'].some(r => roles.includes(r));
  const isTele = roles.includes('telesale') && !roles.includes('admin');
  const canAssign = ['marketing', 'admin'].some(r => roles.includes(r));

  const [rows, setRows] = useState([]);
  const [apptMap, setApptMap] = useState({});
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fTruc, setFTruc] = useState('');
  const [edit, setEdit] = useState(null);       // thêm khách mới ({})
  const [detail, setDetail] = useState(null);    // khách đang mở console gọi/chăm sóc
  const [importOpen, setImportOpen] = useState(false);
  const [getflyOpen, setGetflyOpen] = useState(false);
  const [chip, setChip] = useState('all');
  const [page, setPage] = useState(1);
  const [teleStaff, setTeleStaff] = useState([]);       // danh sách telesale để phân công
  const [fTele, setFTele] = useState(isTele ? 'mine' : ''); // lọc theo telesale ('mine' = của tôi)
  const [queue, setQueue] = useState(null);             // hàng đợi gọi: mảng id + vị trí
  const [fDay, setFDay] = useState('');                 // lọc theo NGÀY data về (YYYY-MM-DD)
  const [reportOpen, setReportOpen] = useState(false);  // Báo cáo ngày
  const [filterOpen, setFilterOpen] = useState(false);  // bottom-sheet bộ lọc (mobile)

  const loadData = useCallback(async () => {
    if (!didLoad.current) setLoading(true);
    // Supabase giới hạn 1.000 dòng/truy vấn -> tải theo LÔ tới khi hết sạch (tối đa 50.000).
    const list = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase.from('marketing_data')
        .select('*, truc_page:profiles!truc_page_id(full_name), telesale:profiles!telesale_id(full_name)')
        // Mới nhất -> cũ nhất theo LẦN TƯƠNG TÁC GẦN NHẤT trên GetFly (null xuống cuối); id làm mốc phụ để phân lô ổn định
        .order('getfly_updated_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(from, from + 999);
      if (error || !data?.length) break;
      list.push(...data);
      if (data.length < 1000) break;
    }
    setRows(list);
    // Đối chiếu lịch hẹn theo SĐT — chia lô 400 SĐT/truy vấn (tránh URL quá dài)
    const phones = [...new Set(list.map(r => r.phone).filter(Boolean))];
    const map = {};
    for (let i = 0; i < phones.length; i += 400) {
      const { data: appts } = await supabase.from('customer_appointments')
        .select('id, phone, status, surgery_date, post_op_status').in('phone', phones.slice(i, i + 400));
      (appts || []).forEach(a => { const k = phoneKey(a.phone); if (!map[k]) map[k] = a; });
    }
    setApptMap(map);
    didLoad.current = true; setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('marketing_data', loadData);
  useEffect(() => { supabase.from('profiles').select('id, full_name').eq('is_active', true).or('role.eq.truc_page,role_2.eq.truc_page').order('full_name').then(({ data }) => setStaff(data || [])); }, []);
  useEffect(() => { supabase.from('profiles').select('id, full_name').eq('is_active', true).or('role.eq.telesale,role_2.eq.telesale').order('full_name').then(({ data }) => setTeleStaff(data || [])); }, []);

  // giữ khách đang mở đồng bộ với list sau khi ghi nhật ký
  useEffect(() => {
    if (detail?.id) { const fresh = rows.find(r => r.id === detail.id); if (fresh && fresh !== detail) setDetail(fresh); }
  }, [rows]); // eslint-disable-line

  const del = async (r) => {
    if (!confirm('Xoá data khách này?')) return;
    setRows(p => p.filter(x => x.id !== r.id));
    await supabase.from('marketing_data').delete().eq('id', r.id);
  };

  const q = search.trim().toLowerCase();
  const apptOf = (r) => apptMap[phoneKey(r.phone)];
  const matchChip = (r) => {
    const a = apptOf(r);
    switch (chip) {
      case 'can_goi': return isDue(r.next_call_at);
      case 'nong': return r.status === 'nong';
      case 'mat': return r.status === 'mat';
      case 'da_lam_dv': return r.status === 'da_lam_dv' || a?.status === 'phau_thuat';
      case 'cskh': return !!a?.post_op_status;
      default: return true;
    }
  };
  const matchTele = (r) => {
    if (!fTele) return true;
    if (fTele === 'mine') return r.telesale_id === me?.id;
    if (fTele === 'none') return !r.telesale_id;
    return r.telesale_id === fTele;
  };
  // Lọc theo mọi điều kiện TRỪ trạng thái -> dùng để đếm số khách ở từng giai đoạn (kiểu Getfly)
  const baseVisible = rows.filter(r =>
    (!q || (r.customer_name || '').toLowerCase().includes(q) || (r.phone || '').includes(q)) &&
    (!fTruc || r.truc_page_id === fTruc) &&
    (!fDay || dayKey(arrivedAt(r)) === fDay) && matchTele(r) && matchChip(r));
  const visible = baseVisible.filter(r => !fStatus || r.status === fStatus);
  const stageCount = baseVisible.reduce((m, r) => { const k = r.status || 'tiep_can'; m[k] = (m[k] || 0) + 1; return m; }, {});

  // Đổi trạng thái nhanh ngay trên dòng
  const quickStatus = async (r, status) => {
    setRows(list => list.map(x => x.id === r.id ? { ...x, status } : x));
    const { error } = await supabase.from('marketing_data').update({ status }).eq('id', r.id);
    if (error) { toast.error('Lỗi: ' + error.message); loadData(); }
  };
  // Gán telesale cho 1 khách
  const assignTele = async (r, telesale_id) => {
    setRows(list => list.map(x => x.id === r.id ? { ...x, telesale_id: telesale_id || null, telesale: teleStaff.find(t => t.id === telesale_id) || null } : x));
    const { error } = await supabase.from('marketing_data').update({ telesale_id: telesale_id || null }).eq('id', r.id);
    if (error) { toast.error('Lỗi: ' + error.message); loadData(); }
  };
  // CHIA ĐỀU khách chưa có telesale cho toàn bộ telesale đang hoạt động
  const [dividing, setDividing] = useState(false);
  const divideTele = async () => {
    if (!teleStaff.length) { toast.error('Chưa có nhân sự telesale nào'); return; }
    const unassigned = rows.filter(r => !r.telesale_id);
    if (!unassigned.length) { toast.error('Không còn khách nào chưa được phân công'); return; }
    if (!confirm(`Chia đều ${unassigned.length} khách chưa phân công cho ${teleStaff.length} telesale?`)) return;
    setDividing(true);
    const buckets = {};
    unassigned.forEach((r, i) => { const t = teleStaff[i % teleStaff.length].id; (buckets[t] = buckets[t] || []).push(r.id); });
    let ok = 0;
    for (const [tid, ids] of Object.entries(buckets)) {
      const { error } = await supabase.from('marketing_data').update({ telesale_id: tid }).in('id', ids);
      if (!error) ok += ids.length;
    }
    setDividing(false);
    toast.success(`Đã chia ${ok}/${unassigned.length} khách cho ${teleStaff.length} telesale`);
    loadData();
  };
  // HÀNG ĐỢI GỌI: sắp theo độ ưu tiên rồi mở lần lượt từng khách
  const buildQueue = () => {
    const mine = rows.filter(r => (isTele ? r.telesale_id === me?.id : matchTele(r)) && !['mat', 'da_lam_dv'].includes(r.status));
    const ordered = [...mine].sort((a, b) => callPriority(a) - callPriority(b) || new Date(a.next_call_at || a.last_contact_at || 0) - new Date(b.next_call_at || b.last_contact_at || 0));
    if (!ordered.length) { toast.error(isTele ? 'Bạn chưa được phân công khách nào cần gọi' : 'Không có khách nào cần gọi'); return; }
    setQueue({ ids: ordered.map(r => r.id), pos: 0 });
    setDetail(ordered[0]);
  };
  const queueNext = () => {
    if (!queue) return;
    const nextPos = queue.pos + 1;
    if (nextPos >= queue.ids.length) { toast.success('Đã gọi hết danh sách!'); setQueue(null); setDetail(null); return; }
    const nxt = rows.find(r => r.id === queue.ids[nextPos]);
    setQueue({ ...queue, pos: nextPos });
    if (nxt) setDetail(nxt); else queueNext();
  };
  const dueCount = rows.filter(r => (isTele ? r.telesale_id === me?.id : true) && isDue(r.next_call_at)).length;
  const stat = {
    total: rows.length,
    nong: rows.filter(r => r.status === 'nong').length,
    due: rows.filter(r => isDue(r.next_call_at)).length,
    daDV: rows.filter(r => r.status === 'da_lam_dv' || apptOf(r)?.status === 'phau_thuat' || apptOf(r)?.post_op_status).length,
    mat: rows.filter(r => r.status === 'mat').length,
  };
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const paged = visible.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const CHIPS = [{ k: 'all', label: 'Tất cả' }, { k: 'can_goi', label: 'Cần gọi' }, { k: 'nong', label: 'Nóng' }, { k: 'mat', label: 'Mất' }, { k: 'da_lam_dv', label: 'Đã làm DV' }, { k: 'cskh', label: 'CSKH' }];
  const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

  // Chip nhắc gọi lại trong danh sách
  const DueBadge = ({ r }) => {
    if (!r.next_call_at) return null;
    const due = isDue(r.next_call_at);
    return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${due ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-600'}`}><CalendarClock className="w-3 h-3" />{due ? 'Cần gọi' : 'Gọi lại'} {fmtDT(r.next_call_at)}</span>;
  };

  const statCards = [
    { icon: Users, color: '#529c96', label: 'Tổng khách', value: stat.total },
    { icon: CalendarClock, color: '#ef4444', label: 'Cần gọi hôm nay', value: stat.due },
    { icon: Flame, color: '#f43f5e', label: 'Khách nóng', value: stat.nong },
    { icon: CheckCircle2, color: '#3b82f6', label: 'Đã làm dịch vụ', value: stat.daDV },
    { icon: UserX, color: '#64748b', label: 'Khách mất', value: stat.mat },
  ];
  const activeFilters = [fStatus, fTruc, fDay, (fTele && fTele !== (isTele ? 'mine' : '')) ? fTele : ''].filter(Boolean).length;

  // Mở hồ sơ khách -> hiện TRANG hồ sơ 360° (kiểu Getfly) thay cho danh sách
  if (detail) {
    return (
      <CustomerProfile row={detail} me={me} staff={staff} teleStaff={teleStaff} canWrite={canWrite} canAssign={canAssign}
        queuePos={queue ? { i: queue.pos + 1, n: queue.ids.length } : null} onNext={queue ? queueNext : null}
        onClose={() => { setDetail(null); setQueue(null); }} onChanged={loadData} onDelete={() => { setDetail(null); del(detail); }} />
    );
  }

  const kpiCards = [
    { icon: Users, tone: 'bg-teal-50 text-teal-700', label: 'Tổng khách hàng', value: stat.total, onClick: () => { setChip('all'); setFStatus(''); setPage(1); }, active: chip === 'all' && !fStatus },
    { icon: CalendarClock, tone: 'bg-rose-50 text-rose-600', label: 'Cần gọi hôm nay', value: stat.due, onClick: () => { setChip('can_goi'); setFStatus(''); setPage(1); }, active: chip === 'can_goi' },
    { icon: Flame, tone: 'bg-orange-50 text-orange-600', label: 'Khách nóng', value: stat.nong, onClick: () => { setChip('all'); setFStatus('nong'); setPage(1); }, active: fStatus === 'nong' },
    { icon: CheckCircle2, tone: 'bg-sky-50 text-sky-600', label: 'Đã làm dịch vụ', value: stat.daDV, onClick: () => { setChip('da_lam_dv'); setFStatus(''); setPage(1); }, active: chip === 'da_lam_dv' },
    { icon: UserX, tone: 'bg-slate-100 text-slate-500', label: 'Khách mất', value: stat.mat, onClick: () => { setChip('all'); setFStatus('mat'); setPage(1); }, active: fStatus === 'mat' },
  ];
  const moreActions = [
    { show: canWrite, label: 'Báo cáo ngày', icon: FileText, run: () => setReportOpen(true) },
    { show: canAssign, label: dividing ? 'Đang chia…' : 'Chia đều cho telesale', icon: Users, run: divideTele },
    { show: roles.includes('admin'), label: 'Kéo từ GetFly', icon: Download, run: () => setGetflyOpen(true) },
    { show: ['marketing', 'truc_page', 'admin'].some(r => roles.includes(r)), label: 'Import CSV', icon: Upload, run: () => setImportOpen(true) },
  ].filter(x => x.show);

  return (
    <div className="space-y-4">
      {/* ===== Chỉ số (bấm để lọc nhanh) ===== */}
      <div className="flex lg:grid lg:grid-cols-5 gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
        {kpiCards.map((c, i) => (
          <button key={i} onClick={c.onClick}
            className={`text-left rounded-2xl bg-white p-4 shadow-card transition-all border ${c.active ? 'border-teal-500 ring-2 ring-teal-100' : 'border-transparent hover:border-slate-200'} shrink-0 min-w-[148px] lg:min-w-0`}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-500 font-medium">{c.label}</span>
              <span className={`w-9 h-9 rounded-xl grid place-items-center ${c.tone}`}><c.icon className="w-[18px] h-[18px]" /></span>
            </div>
            <div className="text-[22px] lg:text-[26px] font-bold text-slate-900 mt-1 tabular-nums leading-tight">{c.value.toLocaleString('vi-VN')}</div>
          </button>
        ))}
      </div>

      {/* ===== Giai đoạn khách hàng (kiểu Getfly) ===== */}
      <div className="rounded-2xl bg-white shadow-soft border border-slate-200 p-1.5 flex gap-1 overflow-x-auto scrollbar-hide">
        {[{ k: '', label: 'Tất cả', n: baseVisible.length }, ...Object.entries(STATUS).map(([k, v]) => ({ k, label: v.label, n: stageCount[k] || 0 }))].map(t => (
          <button key={t.k || 'all'} onClick={() => { setFStatus(t.k); setPage(1); }}
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 h-9 rounded-xl text-[13.5px] font-semibold transition-colors ${
              fStatus === t.k ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {t.k && <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[t.k] || '#cbd5e1' }} />}
            {t.label}
            <span className={`text-[11.5px] tabular-nums px-1.5 rounded-full ${fStatus === t.k ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.n.toLocaleString('vi-VN')}</span>
          </button>
        ))}
      </div>

      {/* ===== Thanh công cụ ===== */}
      <div className="rounded-2xl bg-white shadow-soft border border-slate-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm tên khách hàng, số điện thoại…"
            className="w-full pl-10 pr-3 h-10 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-400 outline-none transition" />
        </div>
        {/* Bộ lọc — mobile */}
        <button onClick={() => setFilterOpen(true)} className="lg:hidden relative h-10 w-10 rounded-xl border border-slate-200 text-slate-600 bg-white grid place-items-center">
          <SlidersHorizontal className="w-[18px] h-[18px]" />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold grid place-items-center">{activeFilters}</span>}
        </button>
        {/* Thao tác */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canWrite && (
            <button onClick={buildQueue} className="inline-flex items-center gap-1.5 px-3 sm:px-4 h-10 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-sm whitespace-nowrap">
              <PhoneCall className="w-4 h-4" /><span className="hidden sm:inline">Bắt đầu gọi</span>{dueCount > 0 && <span className="bg-white/25 rounded-full px-1.5 text-xs">{dueCount}</span>}
            </button>
          )}
          {canWrite && (
            <button onClick={() => setEdit({})} className="hidden sm:inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Thêm khách
            </button>
          )}
          {moreActions.length > 0 && <MoreMenu actions={moreActions} />}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
        {/* Lọc nhanh */}
        <div className="flex items-center gap-1.5">
          {[{ k: 'can_goi', label: 'Cần gọi', n: stat.due }, { k: 'cskh', label: 'CSKH' }].map(c => (
            <button key={c.k} onClick={() => { setChip(chip === c.k ? 'all' : c.k); setPage(1); }}
              className={`px-3 h-10 rounded-xl text-[13px] font-semibold border transition ${chip === c.k ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {c.label}{c.n > 0 && <span className="ml-1 text-rose-500">{c.n}</span>}
            </button>
          ))}
        </div>
        {/* Bộ lọc chi tiết — desktop */}
        <div className="hidden lg:flex items-center gap-1.5">
          <select value={fTele} onChange={e => { setFTele(e.target.value); setPage(1); }} className="h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white outline-none">
            <option value="">Mọi telesale</option>
            <option value="mine">Của tôi</option>
            <option value="none">Chưa phân công</option>
            {teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <select value={fTruc} onChange={e => { setFTruc(e.target.value); setPage(1); }} className="h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white outline-none">
            <option value="">Mọi trực page</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <input type="date" value={fDay} onChange={e => { setFDay(e.target.value); setPage(1); }} title="Lọc theo ngày data về" className="h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white outline-none" />
          <button onClick={() => { setFDay(fDay === todayKey() ? '' : todayKey()); setPage(1); }} className={`h-10 px-3 text-sm font-semibold rounded-xl border ${fDay === todayKey() ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50 bg-white'}`}>Về hôm nay</button>
          {activeFilters > 0 && <button onClick={() => { setFStatus(''); setFTruc(''); setFDay(''); setFTele(isTele ? 'mine' : ''); setPage(1); }} className="h-10 px-3 text-sm font-semibold text-rose-500 hover:bg-rose-50 rounded-xl">Xoá lọc</button>}
        </div>
        </div>
      </div>

      {/* ===== Danh sách ===== */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="text-[14px] font-bold text-slate-800">{fStatus ? STATUS[fStatus]?.label : 'Tất cả khách hàng'}</div>
            <div className="text-[12.5px] text-slate-500 tabular-nums">{visible.length.toLocaleString('vi-VN')} khách</div>
          </div>
          {/* Desktop — bảng gọn */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 text-slate-500 text-[12px]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Khách hàng</th>
                  <th className="px-4 py-3 font-semibold">Liên hệ</th>
                  <th className="px-4 py-3 font-semibold">Giai đoạn</th>
                  <th className="px-4 py-3 font-semibold">Telesale</th>
                  <th className="px-4 py-3 font-semibold">Nguồn</th>
                  <th className="px-4 py-3 font-semibold">Tương tác gần nhất</th>
                  <th className="px-4 py-3 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400">Không có khách hàng phù hợp</td></tr> :
                  paged.map(r => {
                    const st = APPT_STAGE(apptMap[phoneKey(r.phone)]);
                    const isToday = dayKey(arrivedAt(r)) === todayKey();
                    return (
                      <tr key={r.id} className="cursor-pointer hover:bg-teal-50/40 transition-colors" onClick={() => setDetail(r)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-teal-600 text-white grid place-items-center text-[12px] font-bold shrink-0">{initials(r.customer_name)}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate max-w-[200px]">{r.customer_name || '(Chưa có tên)'}</div>
                              <div className="text-[11.5px] text-slate-400 flex items-center gap-1.5">
                                {isToday ? <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold whitespace-nowrap"><Sparkles className="w-3 h-3" />Mới hôm nay</span> : <span className="whitespace-nowrap">Về {fmtD(arrivedAt(r))}</span>}
                                {r.getfly_code && <><span>·</span><span className="truncate max-w-[90px]">{r.getfly_code}</span></>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700 tabular-nums whitespace-nowrap">{phoneView(r.phone, me)}</span>
                            <a href={`tel:${r.phone}`} title="Gọi" className="w-7 h-7 rounded-lg grid place-items-center text-emerald-600 hover:bg-emerald-50"><PhoneCall className="w-3.5 h-3.5" /></a>
                            <a href={zaloLink(r.phone)} target="_blank" rel="noopener noreferrer" title="Zalo" className="px-1.5 h-7 rounded-lg grid place-items-center text-[11px] font-bold text-blue-600 hover:bg-blue-50">Zalo</a>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {canWrite
                            ? <select value={r.status || 'tiep_can'} onChange={e => quickStatus(r, e.target.value)} className={`text-[11.5px] font-bold rounded-full px-2.5 py-1 outline-none border-0 cursor-pointer ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                            : <span className={`text-[11.5px] font-bold px-2.5 py-1 rounded-full ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{STATUS[r.status]?.label || r.status}</span>}
                          {st && <div className="mt-1"><span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap ${st.cls}`} title="Hành trình theo lịch hẹn"><Link2 className="w-3 h-3" />{st.label}</span></div>}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {canAssign
                            ? <select value={r.telesale_id || ''} onChange={e => assignTele(r, e.target.value)} className="text-[12.5px] font-medium rounded-lg border border-slate-200 px-2 py-1 bg-white outline-none max-w-[130px]"><option value="">— Chưa —</option>{teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                            : <span className="text-[13px] text-slate-600 whitespace-nowrap">{r.telesale?.full_name || '—'}</span>}
                        </td>
                        <td className="px-4 py-3 text-[12.5px] whitespace-nowrap">
                          <div className="text-slate-700 font-medium">{r.source || '—'}</div>
                          {r.customer_group && <div className="text-slate-400 text-[11.5px]">{r.customer_group}</div>}
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <div className="text-[12.5px] text-slate-600 truncate" title={r.last_exchange}>{r.last_exchange || <span className="text-slate-300">Chưa liên hệ</span>}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            {r.last_contact_at && <span className="text-[11px] text-slate-400">{fmtDT(r.last_contact_at)}</span>}
                            <DueBadge r={r} />
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right"><ChevronRight className="w-4 h-4 text-slate-300 inline" /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {/* Mobile — thẻ gọn */}
          <div className="md:hidden divide-y divide-slate-100">
            {paged.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Không có khách hàng phù hợp</div>}
            {paged.map(r => { const st = APPT_STAGE(apptMap[phoneKey(r.phone)]); const isToday = dayKey(arrivedAt(r)) === todayKey(); return (
              <div key={r.id} className="flex gap-3 px-4 py-3 active:bg-slate-50" onClick={() => setDetail(r)}>
                <span className="w-11 h-11 rounded-full bg-teal-600 text-white grid place-items-center text-[12px] font-bold shrink-0">{initials(r.customer_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="font-bold text-slate-900 text-[14.5px] truncate">{r.customer_name || '(Chưa có tên)'}</div>
                    {isToday && <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><Sparkles className="w-3 h-3" />Mới</span>}
                  </div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600 tabular-nums">{phoneView(r.phone, me)}</span>
                    {r.source && <><span className="text-slate-300">·</span><span className="truncate">{r.source}</span></>}
                  </div>
                  {r.last_exchange && <div className="text-[12px] text-slate-400 mt-1 line-clamp-1">{r.last_exchange}</div>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{STATUS[r.status]?.label || r.status}</span>
                    {st && <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}
                    <DueBadge r={r} />
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                  <a href={`tel:${r.phone}`} className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center shadow-sm active:scale-95"><PhoneCall className="w-[18px] h-[18px]" /></a>
                  <a href={zaloLink(r.phone)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 grid place-items-center text-[10.5px] font-bold active:scale-95">Zalo</a>
                </div>
              </div>); })}
          </div>
          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-slate-500 text-[12.5px]">Trang {curPage}/{totalPages}</span>
              <div className="flex items-center gap-1">
                <button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-600 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - curPage) <= 1).map((n, i, arr) => (
                  <React.Fragment key={n}>
                    {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-slate-300">…</span>}
                    <button onClick={() => setPage(n)} className={`min-w-9 h-9 px-2 rounded-xl text-sm font-semibold tabular-nums ${n === curPage ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{n}</button>
                  </React.Fragment>
                ))}
                <button disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-600 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {canWrite && !reportOpen && !filterOpen && !edit && !importOpen && !getflyOpen && (
        <button onClick={() => setEdit({})} title="Thêm khách" className="sm:hidden fixed z-[25] bottom-24 right-5 w-14 h-14 rounded-full bg-teal-600 text-white shadow-float ring-4 ring-white flex items-center justify-center"><UserPlus className="w-6 h-6" /></button>
      )}

      {/* Bottom-sheet BỘ LỌC (mobile) */}
      {filterOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[80] flex items-end justify-center backdrop-blur-[2px]" onClick={() => setFilterOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="pt-2.5 pb-1 grid place-items-center"><span className="w-10 h-1.5 rounded-full bg-slate-200" /></div>
            <div className="shrink-0 px-5 py-3 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-teal-600" /> Bộ lọc</h3>
              <button onClick={() => setFilterOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              <Field label="Giai đoạn">
                <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} className={inp}>
                  <option value="">Tất cả giai đoạn</option>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="Telesale">
                <select value={fTele} onChange={e => { setFTele(e.target.value); setPage(1); }} className={inp}>
                  <option value="">Mọi telesale</option>
                  <option value="mine">Của tôi</option>
                  <option value="none">Chưa phân công</option>
                  {teleStaff.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </Field>
              <Field label="Trực page">
                <select value={fTruc} onChange={e => { setFTruc(e.target.value); setPage(1); }} className={inp}>
                  <option value="">Mọi trực page</option>
                  {staff.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </Field>
              <Field label="Ngày data về">
                <div className="flex gap-2">
                  <input type="date" value={fDay} onChange={e => { setFDay(e.target.value); setPage(1); }} className={inp} />
                  <button onClick={() => { setFDay(fDay === todayKey() ? '' : todayKey()); setPage(1); }} className={`shrink-0 px-4 rounded-xl text-sm font-semibold border ${fDay === todayKey() ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-500 bg-white'}`}>Hôm nay</button>
                </div>
              </Field>
              {moreActions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                  {moreActions.map(a => (
                    <button key={a.label} onClick={() => { setFilterOpen(false); a.run(); }} className="h-11 rounded-xl border border-slate-200 text-slate-700 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><a.icon className="w-4 h-4 text-teal-600" />{a.label}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setFStatus(''); setFTruc(''); setFDay(''); setFTele(isTele ? 'mine' : ''); setPage(1); }} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-500 font-semibold text-sm">Xoá lọc</button>
                <button onClick={() => setFilterOpen(false)} className="flex-1 h-11 rounded-xl bg-teal-600 text-white font-bold text-sm">Xem {visible.length.toLocaleString('vi-VN')} khách</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportOpen && <DailyReportModal me={me} teleStaff={teleStaff} isTele={isTele} rows={rows} onClose={() => setReportOpen(false)} />}
      {edit && <EditModal row={edit} me={me} staff={staff} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); loadData(); }} />}
      {importOpen && <ImportModal me={me} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); loadData(); }} />}
      {getflyOpen && <GetflyModal onClose={() => setGetflyOpen(false)} onDone={loadData} />}
    </div>
  );
};

// Menu "⋯" gom các thao tác phụ (Báo cáo ngày, Chia đều, Kéo GetFly, Import)
const MoreMenu = ({ actions, always = false, small = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className={`relative ${always ? '' : 'hidden lg:block'}`}>
      <button onClick={() => setOpen(o => !o)} className={`${small ? 'h-9 w-9' : 'h-10 w-10'} rounded-xl border border-slate-200 bg-white text-slate-600 grid place-items-center hover:bg-slate-50`} aria-label="Thao tác khác">
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <div className={`absolute right-0 ${small ? 'top-11' : 'top-12'} z-30 w-56 rounded-2xl bg-white border border-slate-200 shadow-float p-1.5`}>
          {actions.map(a => (
            <button key={a.label} onClick={() => { setOpen(false); a.run(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-slate-700 hover:bg-slate-50 text-left">
              <a.icon className="w-4 h-4 text-teal-600" />{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ================= HỒ SƠ KHÁCH HÀNG 360° (kiểu Getfly / Ethics BOS) =================
// Gom MỌI thông tin của 1 khách theo SĐT: data marketing + nhật ký gọi/chăm sóc +
// toàn bộ lịch hẹn (tư vấn, cọc, phẫu thuật, tái khám, hậu phẫu).
// Thông minh: điểm tiềm năng, gợi ý việc cần làm tiếp, đồng bộ giai đoạn theo lịch hẹn.
const JOURNEY_STEPS = ['Tiếp cận', 'Hẹn tư vấn', 'Đặt cọc', 'Phẫu thuật', 'Hậu phẫu'];
const journeyIndex = (row, appts) => {
  if (appts.some(a => a.post_op_status)) return 4;
  if (appts.some(a => a.status === 'phau_thuat') || row.status === 'da_lam_dv') return 3;
  if (appts.some(a => a.status === 'coc') || row.status === 'coc') return 2;
  if (appts.length || row.status === 'da_hen_lich') return 1;
  return 0;
};
const STATUS_BASE_SCORE = { tiep_can: 25, nong: 70, tiem_nang: 55, da_hen_lich: 75, coc: 85, da_lam_dv: 95, sai_gon: 30, chot_fail: 15, mat: 5 };
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const fmtMoney = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
const fmtDay = (s) => (s ? new Date(String(s).length <= 10 ? `${s}T00:00:00` : s).toLocaleDateString('vi-VN') : '—');
const isRecheckAppt = (a) => String(a?.service || '').startsWith('[Tái khám]');
const APPT_PILL = {
  scheduled: { label: 'Chờ tư vấn', cls: 'bg-amber-50 text-amber-700' },
  coc: { label: 'Đã cọc', cls: 'bg-blue-50 text-blue-700' },
  phau_thuat: { label: 'Phẫu thuật', cls: 'bg-teal-50 text-teal-700' },
  bong: { label: 'Khách bong', cls: 'bg-rose-50 text-rose-700' },
  cancelled: { label: 'Đã huỷ', cls: 'bg-slate-100 text-slate-500' },
};

const ScoreRing = ({ value, size = 76 }) => {
  const r = (size - 9) / 2; const c = 2 * Math.PI * r;
  const color = value >= 75 ? '#468A86' : value >= 50 ? '#E5A13C' : value >= 25 ? '#5B8DD6' : '#97A4A5';
  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F2" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center"><span className="text-[20px] font-bold text-slate-900 tabular-nums">{value}</span></div>
    </div>
  );
};

const InfoLine = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2">
    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
    <div className="min-w-0">
      <div className="text-[11.5px] text-slate-400">{label}</div>
      <div className="text-[13.5px] text-slate-800 font-medium break-words">{value || '—'}</div>
    </div>
  </div>
);

// Khung nội dung dùng trong hồ sơ khách (khai báo ngoài component để ô nhập không bị dựng lại)
const PCard = ({ title, sub, action, children, className = '' }) => (
  <div className={`rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 lg:p-5 min-w-0 ${className}`}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-2 mb-3">
        <div><div className="text-[14.5px] font-bold text-slate-900">{title}</div>{sub && <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>}</div>
        {action}
      </div>
    )}
    {children}
  </div>
);
const PEmpty = ({ icon: Icon = FileText, title, sub }) => (
  <div className="flex flex-col items-center text-center py-7">
    <span className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 grid place-items-center"><Icon className="w-5 h-5" /></span>
    <div className="text-[13.5px] font-semibold text-slate-700 mt-3">{title}</div>
    {sub && <div className="text-[12px] text-slate-400 mt-1 max-w-[260px]">{sub}</div>}
  </div>
);
const Meta = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 min-w-0 text-[13px] text-slate-600"><Icon className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{children}</span></div>
);
const PField = ({ label, value }) => (
  <div className="py-2"><div className="text-[11.5px] text-slate-400">{label}</div><div className="text-[13.5px] font-semibold text-slate-800 mt-0.5 break-words">{value || '—'}</div></div>
);

const CustomerProfile = ({ row, me, staff, teleStaff = [], canWrite, canAssign, queuePos, onNext, onClose, onChanged, onDelete }) => {
  const [tab, setTab] = useState('activity'); // activity | call | care | appts | info
  const [acts, setActs] = useState([]);
  const [loadingActs, setLoadingActs] = useState(true);
  const [appts, setAppts] = useState([]);
  const [apptOpen, setApptOpen] = useState(false);

  const loadActs = useCallback(async () => {
    setLoadingActs(true);
    const { data } = await supabase.from('marketing_activities')
      .select('*, author:profiles!created_by(full_name)').eq('data_id', row.id).order('created_at', { ascending: false });
    setActs(data || []); setLoadingActs(false);
  }, [row.id]);
  // Toàn bộ lịch hẹn của khách — khớp theo 9 số cuối SĐT (bỏ qua +84/84/0)
  const loadAppts = useCallback(async () => {
    const key = phoneKey(row.phone);
    if (!key || key.length < 8) { setAppts([]); return; }
    const { data } = await supabase.from('customer_appointments')
      .select('*, telesale:telesale_id(full_name), sale:sale_id(full_name)')
      .like('phone', `%${key}`).order('appointment_date', { ascending: false });
    setAppts((data || []).filter(a => phoneKey(a.phone) === key));
  }, [row.phone]);
  useEffect(() => { loadActs(); loadAppts(); }, [loadActs, loadAppts]);
  useEffect(() => { setTab('activity'); }, [row.id]);

  const calls = acts.filter(a => a.type === 'call');
  const cares = acts.filter(a => a.type === 'care');

  // Gom "Nhật ký tư vấn" -> điền sẵn ô tình trạng khách khi tạo lịch hẹn
  const consultSummary = (() => {
    const lines = [];
    if (row.description) lines.push(row.description.trim());
    acts.forEach(a => {
      if (a.type !== 'call' && a.type !== 'care') return;
      const d = a.created_at ? new Date(a.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
      const label = a.type === 'call' ? (OUTCOMES[a.outcome]?.label || 'Gọi') : 'Chăm sóc';
      lines.push(`• [${d}] ${label}${a.content ? ': ' + a.content.trim() : ''}`);
    });
    return lines.join('\n');
  })();

  // ----- thông tin -----
  const [info, setInfo] = useState({
    customer_name: row.customer_name || '', description: row.description || '',
    reached_info: row.reached_info || '', truc_page_id: row.truc_page_id || '',
    telesale_id: row.telesale_id || '',
  });
  useEffect(() => {
    setInfo({ customer_name: row.customer_name || '', description: row.description || '', reached_info: row.reached_info || '', truc_page_id: row.truc_page_id || '', telesale_id: row.telesale_id || '' });
  }, [row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [savingInfo, setSavingInfo] = useState(false);
  const saveInfo = async () => {
    setSavingInfo(true);
    const { error } = await supabase.from('marketing_data').update({ ...info, truc_page_id: info.truc_page_id || null, telesale_id: info.telesale_id || null }).eq('id', row.id);
    setSavingInfo(false);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success('Đã lưu thông tin'); onChanged?.();
  };
  const changeStatus = async (status) => {
    const { error } = await supabase.from('marketing_data').update({ status }).eq('id', row.id);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success(`Đã chuyển giai đoạn: ${STATUS[status]?.label || status}`); onChanged?.();
  };

  // ----- nhật ký gọi -----
  const [call, setCall] = useState({ outcome: 'nghe_may', content: '', next: '', status: row.status || 'tiep_can' });
  useEffect(() => { setCall(c => ({ ...c, status: row.status || 'tiep_can' })); }, [row.status]);
  const [savingCall, setSavingCall] = useState(false);
  const addCall = async () => {
    if (!canWrite) return;
    setSavingCall(true);
    const nextIso = fromLocalInput(call.next);
    const { error } = await supabase.from('marketing_activities').insert({
      data_id: row.id, phone: row.phone, type: 'call', outcome: call.outcome,
      content: call.content.trim() || null, next_at: nextIso, created_by: me.id,
    });
    if (!error) {
      await supabase.from('marketing_data').update({
        status: call.status, last_contact_at: new Date().toISOString(),
        next_call_at: nextIso, last_exchange: `${OUTCOMES[call.outcome]?.label}${call.content ? ' · ' + call.content.trim() : ''}`,
      }).eq('id', row.id);
    }
    setSavingCall(false);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success('Đã lưu cuộc gọi');
    setCall({ outcome: 'nghe_may', content: '', next: '', status: call.status });
    loadActs(); onChanged?.();
  };

  // ----- nhật ký chăm sóc -----
  const [care, setCare] = useState({ content: '', next: '' });
  const [savingCare, setSavingCare] = useState(false);
  const addCare = async () => {
    if (!canWrite) return;
    if (!care.content.trim()) return toast.error('Nhập nội dung chăm sóc');
    setSavingCare(true);
    const nextIso = fromLocalInput(care.next);
    const { error } = await supabase.from('marketing_activities').insert({
      data_id: row.id, phone: row.phone, type: 'care', content: care.content.trim(), next_at: nextIso, created_by: me.id,
    });
    if (!error) {
      const upd = { last_contact_at: new Date().toISOString() };
      if (nextIso) upd.next_call_at = nextIso;
      await supabase.from('marketing_data').update(upd).eq('id', row.id);
    }
    setSavingCare(false);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success('Đã lưu chăm sóc');
    setCare({ content: '', next: '' }); loadActs(); onChanged?.();
  };

  const delAct = async (a) => {
    if (!confirm('Xoá mục nhật ký này?')) return;
    setActs(list => list.filter(x => x.id !== a.id));
    await supabase.from('marketing_activities').delete().eq('id', a.id);
  };

  // ===== Chỉ số 360° =====
  const mainAppts = appts.filter(a => !isRecheckAppt(a));
  const revenue = appts.filter(a => a.status === 'phau_thuat').reduce((s, a) => s + Number(a.revenue || 0) + Number(a.upsale_revenue || 0), 0);
  const deposit = appts.filter(a => ['coc', 'phau_thuat'].includes(a.status)).reduce((s, a) => s + Number(a.deposit_amount || 0), 0);
  const surgeries = appts.filter(a => a.status === 'phau_thuat').length;
  const contactDays = daysSince(row.last_contact_at);
  const jIdx = journeyIndex(row, appts);
  const lost = ['mat', 'chot_fail'].includes(row.status) || (appts.length > 0 && appts.every(a => a.status === 'bong'));

  // Điểm tiềm năng (0–100): giai đoạn + độ "nóng" liên hệ + mức tương tác
  const score = (() => {
    let sc = STATUS_BASE_SCORE[row.status] ?? 25;
    if (contactDays != null) { if (contactDays <= 3) sc += 10; else if (contactDays > 30) sc -= 20; else if (contactDays > 14) sc -= 10; }
    sc += Math.min(15, calls.filter(c => ['nghe_may', 'can_nhac', 'hen_goi_lai'].includes(c.outcome)).length * 3);
    if (mainAppts.length) sc += 8;
    return Math.max(0, Math.min(100, Math.round(sc)));
  })();
  const scoreLabel = score >= 75 ? 'Rất tiềm năng' : score >= 50 ? 'Tiềm năng' : score >= 25 ? 'Cần nuôi dưỡng' : 'Lạnh';

  // Gợi ý việc cần làm tiếp (thông minh)
  const todayStr = vnToday();
  const suggestions = (() => {
    const out = [];
    if (isDue(row.next_call_at)) out.push({ tone: 'rose', icon: PhoneCall, text: `Đã tới hạn gọi lại (${fmtDT(row.next_call_at)})`, cta: 'Ghi cuộc gọi', run: () => setTab('call') });
    else if (row.next_call_at) out.push({ tone: 'blue', icon: CalendarClock, text: `Hẹn gọi lại lúc ${fmtDT(row.next_call_at)}` });
    if (!row.last_contact_at && !['mat', 'da_lam_dv'].includes(row.status)) out.push({ tone: 'amber', icon: AlertTriangle, text: 'Khách chưa được liên hệ lần nào', cta: 'Gọi ngay', href: `tel:${row.phone}` });
    else if (contactDays != null && contactDays > 7 && ['tiep_can', 'nong', 'tiem_nang', 'da_hen_lich', 'coc'].includes(row.status)) out.push({ tone: 'amber', icon: Clock, text: `${contactDays} ngày chưa liên hệ — nên chăm sóc lại`, cta: 'Ghi chăm sóc', run: () => setTab('care') });
    if (['nong', 'tiem_nang'].includes(row.status) && !mainAppts.some(a => a.status === 'scheduled' && a.appointment_date >= todayStr) && canWrite)
      out.push({ tone: 'teal', icon: CalendarDays, text: 'Khách đang quan tâm nhưng chưa có lịch hẹn sắp tới', cta: 'Tạo lịch hẹn', run: () => setApptOpen(true) });
    const upcoming = mainAppts.filter(a => a.status === 'scheduled' && a.appointment_date >= todayStr).sort((x, y) => x.appointment_date.localeCompare(y.appointment_date))[0];
    if (upcoming) out.push({ tone: 'blue', icon: CalendarDays, text: `Lịch tư vấn ${fmtDay(upcoming.appointment_date)} ${String(upcoming.appointment_time || '').slice(0, 5)}${upcoming.sale?.full_name ? ' với ' + upcoming.sale.full_name : ''} — nhắc khách trước 1 ngày` });
    const cocAppt = appts.find(a => a.status === 'coc');
    if (cocAppt) out.push({ tone: 'blue', icon: Wallet, text: `Đã cọc ${fmtMoney(cocAppt.deposit_amount)}${cocAppt.expected_surgery_date ? ` — mổ dự kiến ${fmtDay(cocAppt.expected_surgery_date)}` : ' — chưa chốt ngày mổ'}` });
    const ptNoCare = appts.find(a => a.status === 'phau_thuat' && !a.post_op_status);
    if (ptNoCare) out.push({ tone: 'teal', icon: Stethoscope, text: `Đã phẫu thuật ${fmtDay(ptNoCare.surgery_date)} — theo dõi hậu phẫu & xin đánh giá` });
    // Đồng bộ giai đoạn theo lịch hẹn thực tế
    if (canWrite) {
      if (appts.some(a => a.status === 'phau_thuat') && row.status !== 'da_lam_dv') out.push({ tone: 'teal', icon: CheckCircle2, text: 'Khách đã phẫu thuật nhưng giai đoạn chưa cập nhật', cta: 'Chuyển "Đã làm DV"', run: () => changeStatus('da_lam_dv') });
      else if (appts.some(a => a.status === 'coc') && !['coc', 'da_lam_dv'].includes(row.status)) out.push({ tone: 'teal', icon: CheckCircle2, text: 'Khách đã cọc nhưng giai đoạn chưa cập nhật', cta: 'Chuyển "Cọc"', run: () => changeStatus('coc') });
      else if (mainAppts.length && ['tiep_can', 'nong', 'tiem_nang'].includes(row.status)) out.push({ tone: 'teal', icon: CheckCircle2, text: 'Khách đã có lịch hẹn nhưng giai đoạn chưa cập nhật', cta: 'Chuyển "Đã hẹn lịch"', run: () => changeStatus('da_hen_lich') });
    }
    const bong = appts.find(a => a.status === 'bong');
    if (bong && !appts.some(a => ['coc', 'phau_thuat'].includes(a.status))) out.push({ tone: 'rose', icon: AlertTriangle, text: `Khách bong lịch${bong.bong_date ? ' ngày ' + fmtDay(bong.bong_date) : ''} — chăm sóc lại để hẹn lịch mới`, cta: 'Ghi chăm sóc', run: () => setTab('care') });
    return out.slice(0, 5);
  })();
  const TONE = {
    rose: 'bg-rose-50 text-rose-700 border-rose-100', amber: 'bg-amber-50 text-amber-800 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100', teal: 'bg-teal-50 text-teal-800 border-teal-100',
  };

  // Dòng thời gian hợp nhất mọi tương tác
  const events = (() => {
    const ev = [];
    const arr = arrivedAt(row);
    if (arr) ev.push({ at: arr, icon: Sparkles, color: '#3FA7A2', title: 'Khách về hệ thống', desc: [row.source, row.customer_group].filter(Boolean).join(' · ') });
    acts.forEach(a => ev.push({
      at: a.created_at, icon: a.type === 'call' ? PhoneCall : HeartHandshake, color: a.type === 'call' ? '#5BAE7B' : '#8B7BD8',
      title: a.type === 'call' ? `Cuộc gọi · ${OUTCOMES[a.outcome]?.label || 'Gọi'}` : 'Chăm sóc', desc: a.content, by: a.author?.full_name, next: a.next_at,
    }));
    appts.forEach(a => {
      const re = isRecheckAppt(a);
      ev.push({ at: `${a.appointment_date}T${String(a.appointment_time || '09:00').slice(0, 5)}:00`, icon: re ? Stethoscope : CalendarDays, color: re ? '#8B7BD8' : '#5B8DD6',
        title: re ? 'Lịch tái khám' : 'Lịch hẹn tư vấn', desc: [String(a.service || '').replace('[Tái khám] ', ''), a.sale?.full_name && `Sale: ${a.sale.full_name}`].filter(Boolean).join(' · '), pill: APPT_PILL[a.status] });
      if (a.deposit_date && Number(a.deposit_amount) > 0) ev.push({ at: `${a.deposit_date}T12:00:00`, icon: Wallet, color: '#5B8DD6', title: `Đặt cọc ${fmtMoney(a.deposit_amount)}`, desc: a.service });
      if (a.status === 'phau_thuat' && a.surgery_date) ev.push({ at: `${a.surgery_date}T12:00:00`, icon: Activity, color: '#468A86', title: 'Phẫu thuật', desc: [a.service, Number(a.revenue) > 0 && `Doanh thu ${fmtMoney(Number(a.revenue) + Number(a.upsale_revenue || 0))}`].filter(Boolean).join(' · ') });
      if (a.post_op_status) ev.push({ at: `${a.surgery_date || a.appointment_date}T13:00:00`, icon: HeartHandshake, color: '#3FA7A2', title: 'Hậu phẫu / CSKH', desc: a.post_op_status });
      if (a.bong_date) ev.push({ at: `${a.bong_date}T12:00:00`, icon: UserX, color: '#D9635C', title: 'Khách bong lịch', desc: a.service });
    });
    return ev.filter(e => e.at).sort((x, y) => new Date(y.at) - new Date(x.at));
  })();

  const initialsOf = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const st = APPT_STAGE(appts[0]);
  const services = appts.filter(a => a.status === 'phau_thuat');
  const payments = appts.filter(a => Number(a.deposit_amount) > 0 || Number(a.revenue) > 0 || Number(a.upsale_revenue) > 0);
  const relTime = (iso) => {
    if (!iso) return '';
    const diff = new Date(iso).getTime() - Date.now(); const abs = Math.abs(diff);
    const unit = abs >= 86400000 ? `${Math.round(abs / 86400000)} ngày` : abs >= 3600000 ? `${Math.round(abs / 3600000)} giờ` : `${Math.max(1, Math.round(abs / 60000))} phút`;
    return diff < 0 ? `${unit} trước` : `còn ${unit}`;
  };
  // Đặt lịch chăm sóc tiếp theo (follow-up) nhanh
  const [fuOpen, setFuOpen] = useState(false);
  const setFollowUp = async (d) => {
    const iso = d ? d.toISOString() : null;
    const { error } = await supabase.from('marketing_data').update({ next_call_at: iso }).eq('id', row.id);
    if (error) return toast.error('Lỗi: ' + error.message);
    toast.success(iso ? `Đã hẹn chăm sóc ${fmtDT(iso)}` : 'Đã xoá lịch hẹn gọi'); setFuOpen(false); onChanged?.();
  };
  const fuPreset = (days, hour) => { const t = new Date(); t.setDate(t.getDate() + days); t.setHours(hour, 0, 0, 0); return t; };

  const TABS = [
    { k: 'activity', label: 'Lịch sử' },
    { k: 'appts', label: 'Lịch hẹn', n: appts.length },
    { k: 'payment', label: 'Thanh toán', n: payments.length },
    { k: 'call', label: 'Cuộc gọi', n: calls.length },
    { k: 'care', label: 'Ghi chú', n: cares.length },
    { k: 'info', label: 'Thông tin' },
  ];
  const btn = 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition whitespace-nowrap';
  const moreActions = [
    { label: 'Gọi điện', icon: PhoneCall, run: () => { window.location.href = `tel:${row.phone}`; } },
    { label: 'Nhắn Zalo', icon: MessageSquare, run: () => window.open(zaloLink(row.phone), '_blank', 'noopener') },
    { label: 'Copy số điện thoại', icon: Copy, run: () => { navigator.clipboard?.writeText(phoneView(row.phone, me) || ''); toast.success('Đã copy SĐT'); } },
    ...(canWrite ? [{ label: 'Xoá khách hàng', icon: Trash2, run: onDelete }] : []),
  ];
  const genderTxt = row.gender ? String(row.gender) : null;
  const evStyle = (color) => ({ background: color + '1a', color });

  return (
    <div className="space-y-4">
      {/* Điều hướng */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13.5px] font-semibold text-slate-600 hover:bg-white hover:shadow-soft transition">
          <ArrowLeft className="w-4 h-4" /> Danh sách khách hàng
        </button>
        {queuePos && (
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-slate-500 tabular-nums">Đang gọi {queuePos.i}/{queuePos.n}</span>
            {onNext && <button onClick={onNext} className="inline-flex items-center gap-1 px-4 h-9 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">Khách tiếp <ChevronRight className="w-4 h-4" /></button>}
          </div>
        )}
      </div>

      {/* ===== Thẻ thông tin khách ===== */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-card p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex items-start gap-4 lg:gap-6 flex-1 min-w-0">
            <span className="w-[72px] h-[72px] lg:w-[92px] lg:h-[92px] rounded-full bg-teal-50 text-teal-700 ring-[6px] ring-teal-100/70 grid place-items-center text-[26px] lg:text-[32px] font-bold shrink-0">{initialsOf(row.customer_name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[20px] lg:text-[22px] font-bold text-slate-900 leading-tight">{row.customer_name || '(Chưa có tên)'}</h2>
                <select value={row.status || 'tiep_can'} onChange={e => changeStatus(e.target.value)} disabled={!canWrite} title="Giai đoạn khách hàng"
                  className={`text-[11.5px] font-bold rounded-full px-2.5 py-1 outline-none border-0 cursor-pointer disabled:cursor-default ${STATUS[row.status]?.cls || 'bg-slate-100 text-slate-500'}`}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {st && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${st.cls}`}><Link2 className="w-3 h-3" />{st.label}</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-3">
                <div className="flex items-center gap-2 min-w-0 text-[13px] text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" /><span className="tabular-nums">{phoneView(row.phone, me)}</span>
                  <button onClick={() => { navigator.clipboard?.writeText(phoneView(row.phone, me) || ''); toast.success('Đã copy SĐT'); }} className="text-slate-300 hover:text-slate-600" title="Copy SĐT"><Copy className="w-3.5 h-3.5" /></button>
                </div>
                <Meta icon={Hash}>{row.getfly_code || `KH${String(row.id).padStart(6, '0')}`}</Meta>
                <Meta icon={Mail}>{row.email || 'Chưa có email'}</Meta>
                <Meta icon={Sparkles}>Nguồn: {[row.source, row.customer_group].filter(Boolean).join(' · ') || '—'}</Meta>
                <Meta icon={UserCheck}>Nhân viên phụ trách: {row.telesale?.full_name || 'Chưa phân công'}</Meta>
                <Meta icon={Headphones}>Trực page: {row.truc_page?.full_name || '—'}</Meta>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap xl:flex-nowrap gap-2 lg:justify-end lg:items-start lg:max-w-[560px] shrink-0">
            {canWrite && <button onClick={() => setTab('call')} className={btn}><PhoneCall className="w-4 h-4 text-teal-600" />Ghi nhận cuộc gọi</button>}
            {canWrite && <button onClick={() => setApptOpen(true)} className={btn}><CalendarDays className="w-4 h-4 text-teal-600" />Tạo lịch hẹn</button>}
            <button onClick={() => setTab('info')} className={btn}>Thông tin thêm</button>
            <MoreMenu actions={moreActions} always small />
          </div>
        </div>
      </div>

      {/* ===== 4 chỉ số ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Receipt, label: 'Tổng chi tiêu', value: fmtMoney(revenue || row.total_revenue), tone: 'bg-teal-50 text-teal-600' },
          { icon: Stethoscope, label: 'Số lần dịch vụ', value: services.length, tone: 'bg-teal-50 text-teal-600' },
          { icon: HeartHandshake, label: 'Ngày khách hàng', value: fmtDay(arrivedAt(row)), tone: 'bg-teal-50 text-teal-600' },
          { icon: Gem, label: 'Điểm tiềm năng', value: `${score} điểm`, tone: 'bg-orange-50 text-orange-500', valueCls: score >= 75 ? 'text-orange-500' : 'text-slate-900', sub: scoreLabel },
        ].map(k => (
          <div key={k.label} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 flex items-center gap-3 min-w-0">
            <span className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${k.tone}`}><k.icon className="w-5 h-5" /></span>
            <div className="min-w-0">
              <div className="text-[11.5px] text-slate-500 truncate">{k.label}</div>
              <div className={`text-[17px] lg:text-[18px] font-bold tabular-nums truncate ${k.valueCls || 'text-slate-900'}`}>{typeof k.value === 'number' ? k.value.toLocaleString('vi-VN') : k.value}</div>
              {k.sub && <div className="text-[11px] text-slate-400 truncate">{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Thanh tab ===== */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft px-2 flex gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`relative shrink-0 px-3.5 h-12 text-[13.5px] font-semibold transition ${tab === t.k ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'}`}>
            {t.label}{t.n != null && <span className="ml-1 text-slate-400 font-medium">({t.n})</span>}
            {tab === t.k && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-teal-600" />}
          </button>
        ))}
      </div>

      {/* ===== LỊCH SỬ: 3 cột ===== */}
      {tab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_300px] gap-4 items-start">
          {/* Cột trái — thông tin cá nhân */}
          <PCard title="Thông tin cá nhân">
            <div className="-mt-1 divide-y divide-slate-100">
              <PField label="Giới tính" value={genderTxt} />
              <PField label="SĐT" value={phoneView(row.phone, me)} />
              <PField label="Email" value={row.email} />
              <PField label="Ngày sinh" value={row.birthday ? fmtDay(row.birthday) : null} />
              <PField label="Địa chỉ" value={row.address} />
              <PField label="Nhu cầu / mô tả" value={row.description} />
              <div className="py-2">
                <div className="text-[11.5px] text-slate-400">Tags</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[row.customer_group, row.source, STATUS[row.status]?.label].filter(Boolean).map(t => <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{t}</span>)}
                </div>
              </div>
            </div>
          </PCard>

          {/* Cột giữa — dịch vụ + dòng thời gian */}
          <div className="space-y-4 min-w-0">
            <PCard title="Lịch sử dịch vụ" action={services.length > 0 && <span className="text-[12px] font-semibold text-slate-500">{services.length} dịch vụ</span>}>
              {services.length === 0 ? <PEmpty icon={Stethoscope} title="Chưa sử dụng dịch vụ" sub="Ca phẫu thuật và doanh thu sẽ hiển thị tại đây." /> : (
                <div className="divide-y divide-slate-100">
                  {services.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-9 h-9 rounded-full bg-teal-50 text-teal-600 grid place-items-center shrink-0"><Activity className="w-4 h-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-slate-900 truncate">{a.service || 'Dịch vụ'}</div>
                        <div className="text-[12px] text-slate-500 truncate">{fmtDay(a.surgery_date || a.appointment_date)}{a.sale?.full_name ? ` · ${a.sale.full_name}` : ''}{a.post_op_status ? ` · Hậu phẫu: ${a.post_op_status}` : ''}</div>
                      </div>
                      <span className="text-[13px] font-bold text-slate-900 tabular-nums shrink-0">{fmtMoney(Number(a.revenue || 0) + Number(a.upsale_revenue || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </PCard>
            <PCard title="Dòng thời gian hợp nhất" sub="Cuộc gọi · ghi chú · lịch hẹn · đặt cọc · phẫu thuật · hậu phẫu">
              {loadingActs ? <div className="py-8 grid place-items-center"><div className="w-6 h-6 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div> : events.length === 0 ? <PEmpty icon={Activity} title="Chưa có hoạt động" sub="Mọi cuộc gọi, ghi chú và lịch hẹn sẽ hiện ở đây." /> : (
                <ol className="relative">
                  {events.map((e, i) => (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < events.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-slate-100" />}
                      <span className="w-7 h-7 rounded-full grid place-items-center shrink-0 relative" style={evStyle(e.color)}><e.icon className="w-3.5 h-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[13px] font-semibold text-slate-900">{e.title}</span>
                            {e.pill && <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full align-middle ${e.pill.cls}`}>{e.pill.label}</span>}
                          </div>
                          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{new Date(e.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {(e.desc || e.by) && <div className="text-[12px] text-slate-500 mt-0.5 break-words line-clamp-3">{[e.desc, e.by].filter(Boolean).join(' · ')}</div>}
                        {e.next && <span className="mt-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />Hẹn: {fmtDT(e.next)}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </PCard>
          </div>

          {/* Cột phải — ghi chú, gợi ý, chăm sóc tiếp theo */}
          <div className="space-y-4 min-w-0 lg:col-span-2 xl:col-span-1 grid lg:grid-cols-2 xl:grid-cols-1 gap-4 lg:space-y-0">
            <PCard title="Ghi chú">
              {cares.length === 0 ? <div className="text-[12px] text-slate-400 -mt-1 mb-2">Chưa có ghi chú.</div> : (
                <div className="space-y-2 mb-3 -mt-1">
                  {cares.slice(0, 3).map(c => (
                    <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-[12.5px] text-slate-700 whitespace-pre-wrap break-words line-clamp-3">{c.content}</div>
                      <div className="text-[10.5px] text-slate-400 mt-1">{c.author?.full_name || ''}{c.created_at ? ` · ${fmtDT(c.created_at)}` : ''}</div>
                    </div>
                  ))}
                  {cares.length > 3 && <button onClick={() => setTab('care')} className="text-[12px] font-semibold text-teal-700 hover:underline">Xem tất cả {cares.length} ghi chú</button>}
                </div>
              )}
              {canWrite && (
                <>
                  <textarea value={care.content} onChange={e => setCare({ ...care, content: e.target.value })} rows={3} placeholder="Thêm ghi chú về khách hàng…"
                    className="w-full px-3 py-2 text-[13px] rounded-xl border border-slate-200 focus:border-teal-400 outline-none resize-y" />
                  <div className="flex justify-end mt-2">
                    <button onClick={addCare} disabled={savingCare || !care.content.trim()} className="h-8 px-4 rounded-lg bg-teal-600 text-white text-[12.5px] font-bold hover:bg-teal-700 disabled:opacity-40">{savingCare ? 'Đang lưu…' : 'Lưu ghi chú'}</button>
                  </div>
                </>
              )}
            </PCard>

            <PCard title={<span className="inline-flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-500" />Gợi ý việc cần làm</span>}>
              {suggestions.length === 0 ? <div className="text-[12.5px] text-slate-400 -mt-1">Mọi thứ đều ổn — chưa có việc cần làm ngay.</div> : (
                <div className="space-y-2 -mt-1">
                  {suggestions.map((sg, i) => (
                    <div key={i} className={`rounded-xl border px-3 py-2 ${TONE[sg.tone]}`}>
                      <div className="flex items-start gap-2 text-[12.5px] leading-snug"><sg.icon className="w-4 h-4 mt-0.5 shrink-0" /><span>{sg.text}</span></div>
                      {sg.cta && (sg.href
                        ? <a href={sg.href} className="mt-1 ml-6 inline-flex items-center gap-0.5 text-[12px] font-bold underline-offset-2 hover:underline">{sg.cta} <ChevronRight className="w-3.5 h-3.5" /></a>
                        : <button onClick={sg.run} className="mt-1 ml-6 inline-flex items-center gap-0.5 text-[12px] font-bold underline-offset-2 hover:underline">{sg.cta} <ChevronRight className="w-3.5 h-3.5" /></button>)}
                    </div>
                  ))}
                </div>
              )}
            </PCard>

            <PCard title="Chăm sóc tiếp theo">
              <div className="-mt-1 text-[13px] text-slate-600">
                {row.next_call_at
                  ? <>Hẹn gọi lại <b className="text-slate-900">{fmtDT(row.next_call_at)}</b> <span className={isDue(row.next_call_at) ? 'text-rose-500 font-semibold' : 'text-slate-400'}>({relTime(row.next_call_at)})</span></>
                  : <span className="text-slate-400">Chưa có lịch chăm sóc tiếp theo.</span>}
              </div>
              {canWrite && (fuOpen ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[['Chiều nay', 0, 15], ['Sáng mai', 1, 9], ['3 ngày nữa', 3, 9], ['1 tuần nữa', 7, 9]].map(([lb, d, h]) => (
                      <button key={lb} onClick={() => setFollowUp(fuPreset(d, h))} className="h-8 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-teal-400 hover:text-teal-700">{lb}</button>
                    ))}
                  </div>
                  <input type="datetime-local" onChange={e => e.target.value && setFollowUp(new Date(e.target.value))} className="w-full h-9 px-3 text-[13px] rounded-lg border border-slate-200 outline-none focus:border-teal-400" />
                  <div className="flex justify-between">
                    {row.next_call_at ? <button onClick={() => setFollowUp(null)} className="text-[12px] font-semibold text-rose-500 hover:underline">Xoá lịch hẹn gọi</button> : <span />}
                    <button onClick={() => setFuOpen(false)} className="text-[12px] font-semibold text-slate-500 hover:underline">Đóng</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setFuOpen(true)} className="mt-3 w-full h-9 rounded-xl border border-teal-500 text-teal-700 text-[13px] font-semibold hover:bg-teal-50">Tạo việc follow-up</button>
              ))}
            </PCard>
          </div>
        </div>
      )}

      {/* ===== THANH TOÁN ===== */}
      {tab === 'payment' && (
        <PCard title="Thanh toán" sub="Tiền cọc, doanh thu và upsale theo từng lịch hẹn">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[['Đã cọc', deposit], ['Doanh thu', revenue], ['Bill dự kiến', appts.reduce((t, a) => t + Number(a.expected_bill || 0), 0)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-[11.5px] text-slate-400">{k}</div><div className="text-[15px] font-bold text-slate-900 tabular-nums">{fmtMoney(v)}</div></div>
            ))}
          </div>
          {payments.length === 0 ? <PEmpty icon={Wallet} title="Chưa có giao dịch" sub="Khoản cọc và doanh thu phẫu thuật sẽ hiển thị tại đây." /> : (
            <div className="divide-y divide-slate-100">
              {payments.map(a => (
                <div key={a.id} className="py-3 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 grid place-items-center shrink-0"><Wallet className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-900 truncate">{String(a.service || 'Dịch vụ').replace('[Tái khám] ', '')}</div>
                    <div className="text-[12px] text-slate-500">{Number(a.deposit_amount) > 0 && `Cọc ${fmtMoney(a.deposit_amount)}${a.deposit_date ? ' ngày ' + fmtDay(a.deposit_date) : ''}`}{Number(a.revenue) > 0 && ` · Doanh thu ${fmtMoney(a.revenue)}`}{Number(a.upsale_revenue) > 0 && ` · Upsale ${fmtMoney(a.upsale_revenue)}`}</div>
                  </div>
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${(APPT_PILL[a.status] || APPT_PILL.scheduled).cls}`}>{(APPT_PILL[a.status] || APPT_PILL.scheduled).label}</span>
                </div>
              ))}
            </div>
          )}
        </PCard>
      )}

      {/* ===== Các tab nhập liệu ===== */}
      {['call', 'care', 'appts', 'info'].includes(tab) && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4 lg:p-5">
            {/* ---- GỌI ĐIỆN ---- */}
            {tab === 'call' && (
              <div className="space-y-4">
                {canWrite && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
                    <div className="text-[13.5px] font-bold text-slate-700">Ghi cuộc gọi mới</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><label className="block text-[11.5px] font-semibold text-slate-500 mb-1">Kết quả gọi</label>
                        <select value={call.outcome} onChange={e => setCall({ ...call, outcome: e.target.value })} className={inp}>{Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                      <div><label className="block text-[11.5px] font-semibold text-slate-500 mb-1">Chuyển giai đoạn</label>
                        <select value={call.status} onChange={e => setCall({ ...call, status: e.target.value })} className={inp}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                    </div>
                    <div><label className="block text-[11.5px] font-semibold text-slate-500 mb-1">Nội dung trao đổi</label>
                      <textarea value={call.content} onChange={e => setCall({ ...call, content: e.target.value })} rows={3} placeholder="Khách quan tâm gì, báo giá, phản hồi…" className={inp} /></div>
                    <div><label className="block text-[11.5px] font-semibold text-slate-500 mb-1">Hẹn gọi lại (nếu có)</label>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {[['Chiều nay', 0, 15], ['Sáng mai', 1, 9], ['3 ngày nữa', 3, 9], ['1 tuần nữa', 7, 9]].map(([lb, d, h]) => (
                          <button key={lb} type="button" onClick={() => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); setCall({ ...call, next: toLocalInput(t.toISOString()) }); }}
                            className="px-2.5 h-7 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:border-teal-400 hover:text-teal-700">{lb}</button>
                        ))}
                      </div>
                      <input type="datetime-local" value={call.next} onChange={e => setCall({ ...call, next: e.target.value })} className={inp} /></div>
                    <button onClick={addCall} disabled={savingCall} className="w-full h-10 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"><Save className="w-4 h-4" />{savingCall ? 'Đang lưu…' : 'Lưu cuộc gọi'}</button>
                  </div>
                )}
                <Timeline items={calls} loading={loadingActs} me={me} onDelete={delAct} kind="call" />
              </div>
            )}

            {/* ---- CHĂM SÓC ---- */}
            {tab === 'care' && (
              <div className="space-y-4">
                {canWrite && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
                    <div className="text-[13.5px] font-bold text-slate-700">Ghi chăm sóc mới</div>
                    <div><label className="block text-[11.5px] font-semibold text-slate-500 mb-1">Nội dung chăm sóc</label>
                      <textarea value={care.content} onChange={e => setCare({ ...care, content: e.target.value })} rows={3} placeholder="Nhắn tin hỏi thăm, gửi ưu đãi, tư vấn thêm…" className={inp} /></div>
                    <div><label className="block text-[11.5px] font-semibold text-slate-500 mb-1">Hẹn chăm sóc tiếp (nếu có)</label>
                      <input type="datetime-local" value={care.next} onChange={e => setCare({ ...care, next: e.target.value })} className={inp} /></div>
                    <button onClick={addCare} disabled={savingCare} className="w-full h-10 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"><Save className="w-4 h-4" />{savingCare ? 'Đang lưu…' : 'Lưu chăm sóc'}</button>
                  </div>
                )}
                <Timeline items={cares} loading={loadingActs} me={me} onDelete={delAct} kind="care" />
              </div>
            )}

            {/* ---- LỊCH HẸN ---- */}
            {tab === 'appts' && (
              <div className="space-y-3">
                {canWrite && <button onClick={() => setApptOpen(true)} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"><Plus className="w-4 h-4" />Tạo lịch hẹn</button>}
                {appts.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Khách chưa có lịch hẹn nào</div>}
                {appts.map(a => {
                  const pill = isRecheckAppt(a) ? { label: 'Tái khám', cls: 'bg-violet-50 text-violet-700' } : (APPT_PILL[a.status] || APPT_PILL.scheduled);
                  return (
                    <div key={a.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{String(a.service || 'Chưa chọn dịch vụ').replace('[Tái khám] ', '')}</div>
                          <div className="text-[12.5px] text-slate-500 mt-0.5">{fmtDay(a.appointment_date)} · {String(a.appointment_time || '').slice(0, 5) || '--:--'}{a.sale?.full_name ? ` · Sale: ${a.sale.full_name}` : ''}{a.telesale?.full_name ? ` · Tele: ${a.telesale.full_name}` : ''}</div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${pill.cls}`}>{pill.label}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        {[['Bill dự kiến', fmtMoney(a.expected_bill)], ['Đã cọc', fmtMoney(a.deposit_amount)], ['Doanh thu', fmtMoney(Number(a.revenue || 0) + Number(a.upsale_revenue || 0))], ['Ngày mổ', fmtDay(a.surgery_date || a.expected_surgery_date)]].map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">{k}</div><div className="text-[13px] font-semibold text-slate-800 tabular-nums">{v}</div></div>
                        ))}
                      </div>
                      {a.post_op_status && <div className="mt-2 text-[12.5px] font-semibold text-teal-700 bg-teal-50 rounded-lg px-3 py-1.5">Hậu phẫu: {a.post_op_status}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ---- THÔNG TIN (sửa) ---- */}
            {tab === 'info' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                  <Field label="Tên khách hàng"><input value={info.customer_name} onChange={e => setInfo({ ...info, customer_name: e.target.value })} disabled={!canWrite} className={inp} /></Field>
                  <Field label="Telesale phụ trách"><select value={info.telesale_id} onChange={e => setInfo({ ...info, telesale_id: e.target.value })} disabled={!canAssign} className={inp}><option value="">— Chưa phân công —</option>{teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
                  <Field label="Trực page phụ trách"><select value={info.truc_page_id} onChange={e => setInfo({ ...info, truc_page_id: e.target.value })} disabled={!canWrite} className={inp}><option value="">— Chọn —</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
                </div>
                <Field label="Mô tả / nhu cầu"><textarea value={info.description} onChange={e => setInfo({ ...info, description: e.target.value })} disabled={!canWrite} rows={2} className={inp} /></Field>
                <Field label="Thông tin đã tiếp cận"><textarea value={info.reached_info} onChange={e => setInfo({ ...info, reached_info: e.target.value })} disabled={!canWrite} rows={3} className={inp} /></Field>
                {(row.getfly_id || row.website || row.getfly_synced_at) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-[12.5px] text-slate-600 space-y-1">
                    <div className="font-bold text-slate-700">Đồng bộ GetFly</div>
                    {row.website && <div className="truncate">Website: <b>{row.website}</b></div>}
                    {row.getfly_synced_at && <div className="text-slate-400">Cập nhật lúc {fmtDT(row.getfly_synced_at)}</div>}
                  </div>
                )}
                {canWrite && (
                  <div className="flex justify-between items-center pt-1">
                    <button onClick={onDelete} className="text-sm font-semibold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" />Xoá khách</button>
                    <button onClick={saveInfo} disabled={savingInfo} className="px-5 h-10 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 disabled:opacity-60 inline-flex items-center gap-1.5"><Save className="w-4 h-4" />{savingInfo ? 'Đang lưu…' : 'Lưu thông tin'}</button>
                  </div>
                )}
              </div>
            )}
        </div>
      )}

      {apptOpen && <CreateApptModal row={row} me={me} teleStaff={teleStaff} defaultNotes={consultSummary} onClose={() => { setApptOpen(false); loadAppts(); }} />}
    </div>
  );
};


// Dòng thời gian nhật ký (gọi / chăm sóc)
const Timeline = ({ items, loading, me, onDelete, kind }) => {
  if (loading) return <div className="text-center py-8 text-slate-300 text-sm">Đang tải…</div>;
  if (!items.length) return <div className="text-center py-8 text-slate-300 text-sm">{kind === 'call' ? 'Chưa có cuộc gọi nào' : 'Chưa có lần chăm sóc nào'}</div>;
  return (
    <div className="space-y-2">
      {items.map(a => (
        <div key={a.id} className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {kind === 'call' && a.outcome && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${OUTCOMES[a.outcome]?.cls || 'bg-slate-100 text-slate-500'}`}>{OUTCOMES[a.outcome]?.label || a.outcome}</span>}
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDT(a.created_at)}</span>
            </div>
            {(a.created_by === me?.id || me?.role === 'admin') && <button onClick={() => onDelete(a)} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
          {a.content && <div className="text-[13px] text-slate-700 mt-1.5 whitespace-pre-wrap break-words">{a.content}</div>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">{a.author?.full_name || 'Nhân viên'}</span>
            {a.next_at && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />Hẹn: {fmtDT(a.next_at)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- BÁO CÁO NGÀY — trực quan (biểu đồ) + tải file + link/QR cho sếp ----------
const DailyReportModal = ({ me, teleStaff, isTele, rows, onClose }) => {
  const [day, setDay] = useState(todayKey());
  const [who, setWho] = useState(isTele ? me.id : 'all');
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);      // {url, qr}
  const [busyShare, setBusyShare] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setShare(null);
      const from = new Date(day + 'T00:00:00').toISOString();
      const to = new Date(day + 'T23:59:59.999').toISOString();
      let q = supabase.from('marketing_activities')
        .select('*, author:profiles!created_by(full_name), khach:marketing_data!data_id(customer_name, phone)')
        .gte('created_at', from).lte('created_at', to).order('created_at', { ascending: true });
      if (who !== 'all') q = q.eq('created_by', who);
      const { data } = await q;
      setActs(data || []); setLoading(false);
    })();
  }, [day, who]);

  const whoName = who === 'all' ? '' : (who === me?.id ? (me?.full_name || '') : (teleStaff.find(t => t.id === who)?.full_name || ''));
  const ofWho = (r) => who === 'all' ? true : (r.telesale_id === who || (r.manager_name && whoName && r.manager_name.trim().toLowerCase() === whoName.trim().toLowerCase()));

  const rowById = new Map(rows.map(r => [r.id, r]));
  const isNewRow = (r) => r && dayKey(arrivedAt(r)) === day;

  // CUỘC GỌI = note GetFly trong ngày + nhật ký gọi trong app
  const inAppCalls = acts.filter(a => a.type === 'call');
  const inAppIds = new Set(inAppCalls.map(a => a.data_id));
  const gfCalls = rows.filter(r => ofWho(r) && r.last_exchange && dayKey(r.getfly_updated_at) === day && !inAppIds.has(r.id));
  const callRows = [
    ...inAppCalls.map(a => ({ time: a.created_at, name: a.khach?.customer_name || '—', phone: a.khach?.phone || a.phone || '', content: `${OUTCOMES[a.outcome]?.label || 'Gọi'}${a.content ? ' — ' + a.content : ''}`, author: a.author?.full_name, isNew: isNewRow(rowById.get(a.data_id)), st: rowById.get(a.data_id)?.status || null })),
    ...gfCalls.map(r => ({ time: r.getfly_updated_at, name: r.customer_name || '—', phone: r.phone, content: r.last_exchange, author: r.manager_name, gf: true, isNew: isNewRow(r), st: r.status || null })),
  ].sort((a, b) => new Date(a.time) - new Date(b.time));
  const newCallCnt = callRows.filter(c => c.isNew).length;
  const oldCallCnt = callRows.length - newCallCnt;

  // SỐ MỚI + tệp khách + nguồn
  const newRows = rows.filter(r => ofWho(r) && dayKey(arrivedAt(r)) === day);
  const isCalled = (r) => inAppIds.has(r.id) || (r.last_exchange && dayKey(r.getfly_updated_at) === day);
  const newCalled = newRows.filter(isCalled);
  const cares = acts.filter(a => a.type === 'care');
  const nextCnt = acts.filter(a => a.next_at).length;
  // KHÁCH TRONG NGÀY = có cuộc gọi trong ngày HOẶC là số mới về trong ngày
  const dayCustomerRows = rows.filter(r => ofWho(r) && (isCalled(r) || dayKey(arrivedAt(r)) === day));
  const byStatusData = Object.entries(STATUS).map(([k, v]) => ({ label: v.label, value: dayCustomerRows.filter(r => r.status === k).length, color: STATUS_COLORS[k] })).filter(d => d.value > 0);
  const callsNew = callRows.filter(c => c.isNew);
  const callsOld = callRows.filter(c => !c.isNew);
  const byOutcome = {}; inAppCalls.forEach(c => { byOutcome[c.outcome] = (byOutcome[c.outcome] || 0) + 1; });
  const byOutcomeData = Object.entries(byOutcome).map(([k, v]) => ({ label: OUTCOMES[k]?.label || k, value: v, color: OUTCOME_COLORS[k] || '#64748b' }));
  const srcMap = {}; newRows.forEach(r => { const raw = String(r.source || '').trim(); const s = !raw ? 'Khác' : (/^\d+$/.test(raw) ? 'Nguồn #' + raw : raw); srcMap[s] = (srcMap[s] || 0) + 1; });
  const bySourceData = Object.entries(srcMap).map(([k, v], i) => ({ label: k, value: v, color: ['#529c96', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'][i % 6] })).sort((a, b) => b.value - a.value);

  const buildPayload = () => ({
    day, whoName: whoName || 'Tất cả telesale', generated_at: new Date().toISOString(),
    stats: {
      calls: callRows.length, new_count: newRows.length, new_called: newCalled.length,
      new_not_called: newRows.length - newCalled.length, cares: cares.length, next_cnt: nextCnt,
      old_calls: oldCallCnt, new_calls: newCallCnt,
    },
    by_outcome: byOutcomeData, by_status: byStatusData, by_source: bySourceData,
    calls_new: callsNew.slice(0, 200).map(c => ({ name: c.name, phone: maskPhone(c.phone), time: c.time, content: String(c.content || '').slice(0, 300), author: c.author || null, is_new: true, status_label: STATUS[c.st]?.label || null, status_color: STATUS_COLORS[c.st] || null })),
    calls_old: callsOld.slice(0, 200).map(c => ({ name: c.name, phone: maskPhone(c.phone), time: c.time, content: String(c.content || '').slice(0, 300), author: c.author || null, is_new: false, status_label: STATUS[c.st]?.label || null, status_color: STATUS_COLORS[c.st] || null })),
    news: newRows.slice(0, 300).map(r => ({ name: r.customer_name, phone: maskPhone(r.phone), source: r.source || null, called: isCalled(r), status: STATUS[r.status]?.label || r.status })),
  });

  // ẢNH POSTER QR: in kèm chữ "BÁO CÁO TELESALE NGÀY ... — DR TUẤN HÙNG"
  const buildQrPoster = async (url) => {
    const qrData = await QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: '#0f2140' } });
    const W = 640, H = 860;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // dải header xanh
    ctx.fillStyle = '#0b3b34'; ctx.fillRect(0, 0, W, 156);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = `800 36px ${FONT}`;
    ctx.fillText('BÁO CÁO TELESALE', W / 2, 66);
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(`NGÀY ${new Date(day + 'T12:00:00').toLocaleDateString('vi-VN')}`, W / 2, 114);
    // QR giữa
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = qrData; });
    ctx.drawImage(img, (W - 520) / 2, 190, 520, 520);
    // chân chữ
    ctx.fillStyle = '#0f2140'; ctx.font = `800 32px ${FONT}`;
    ctx.fillText('DR TUẤN HÙNG', W / 2, 776);
    ctx.fillStyle = '#64748b'; ctx.font = `600 21px ${FONT}`;
    ctx.fillText(whoName || 'Tất cả telesale', W / 2, 812);
    ctx.font = `500 16px ${FONT}`; ctx.fillStyle = '#94a3b8';
    ctx.fillText('Quét mã để xem báo cáo chi tiết', W / 2, 842);
    return canvas.toDataURL('image/png');
  };
  // Tạo LINK CÔNG KHAI + poster QR — sếp quét là vào /bao-cao/<mã>, không cần đăng nhập
  const makeShare = async () => {
    setBusyShare(true);
    try {
      const slug = Array.from(crypto.getRandomValues(new Uint8Array(14))).map(b => (b % 36).toString(36)).join('');
      const title = `Báo cáo telesale ${new Date(day + 'T12:00:00').toLocaleDateString('vi-VN')}${whoName ? ' — ' + whoName : ''}`;
      const { error } = await supabase.from('daily_reports').insert({ slug, day, title, payload: buildPayload(), created_by: me.id });
      if (error) throw error;
      const url = `${window.location.origin}/bao-cao/${slug}`;
      const qr = await buildQrPoster(url);
      setShare({ url, qr });
      toast.success('Đã tạo báo cáo — tải ảnh QR hoặc bấm Gửi Zalo');
    } catch (e) { toast.error('Lỗi tạo link: ' + e.message + ' (đã chạy daily_reports.sql chưa?)'); }
    setBusyShare(false);
  };
  // Tải ảnh QR về máy
  const downloadQr = () => {
    if (!share) return;
    const a = document.createElement('a');
    a.href = share.qr;
    a.download = `QR-bao-cao-telesale-${day}.png`;
    a.click();
    toast.success('Đã tải ảnh QR — gửi ảnh này qua Zalo cho sếp');
  };
  // Gửi Zalo: mở khay chia sẻ hệ thống (điện thoại) kèm ảnh QR + link; máy tính -> copy link
  const shareZalo = async () => {
    if (!share) return;
    const d = new Date(day + 'T12:00:00').toLocaleDateString('vi-VN');
    const text = `BÁO CÁO TELESALE NGÀY ${d} — DR TUẤN HÙNG${whoName ? ' (' + whoName + ')' : ''}\nXem chi tiết: ${share.url}`;
    try {
      const [meta, b64] = share.qr.split(',');
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], `bao-cao-${day}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Báo cáo telesale', text });
        return;
      }
      if (navigator.share) { await navigator.share({ title: 'Báo cáo telesale', text, url: share.url }); return; }
      throw new Error('no-share');
    } catch (e) {
      if (e?.name === 'AbortError') return;   // người dùng tự đóng khay chia sẻ
      navigator.clipboard?.writeText(text);
      toast.success('Máy này không có khay chia sẻ — đã copy nội dung + link, mở Zalo dán gửi sếp');
    }
  };

  // Tải file HTML báo cáo (mở được trên mọi máy, gửi Zalo dạng file)
  const downloadHtml = () => {
    const p = buildPayload();
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const bars = (data) => data.map(d => {
      const max = Math.max(...data.map(x => x.value), 1);
      return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12px"><span style="width:96px;color:#64748b">${esc(d.label)}</span><div style="flex:1;height:14px;background:#f1f5f9;border-radius:99px;overflow:hidden"><div style="height:100%;width:${(d.value / max) * 100}%;background:${d.color};border-radius:99px"></div></div><b style="width:32px;text-align:right">${d.value}</b></div>`;
    }).join('');
    const donut = (data) => {
      const total = data.reduce((s, d) => s + d.value, 0) || 1; let acc = 0;
      const stops = data.map(d => { const f = acc / total * 360; acc += d.value; return `${d.color} ${f}deg ${acc / total * 360}deg`; }).join(',');
      const legend = data.map(d => `<div style="font-size:11px;color:#475569;margin:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:${d.color};margin-right:6px"></span>${esc(d.label)}: <b>${d.value}</b></div>`).join('');
      return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="width:120px;height:120px;border-radius:99px;background:conic-gradient(${stops});display:grid;place-items:center"><div style="width:86px;height:86px;border-radius:99px;background:#fff;display:grid;place-items:center;font-weight:700;font-size:18px">${total}</div></div><div>${legend}</div></div>`;
    };
    const tiles = [
      ['Cuộc gọi', p.stats.calls, '#059669'], ['Số mới', p.stats.new_count, '#2563eb'],
      ['Mới đã gọi', p.stats.new_called, '#468a86'], ['Mới chưa gọi', p.stats.new_not_called, '#e11d48'],
    ].map(([l, v, c]) => `<div style="background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:14px"><div style="font-size:26px;font-weight:800;color:${c}">${v}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${l}</div></div>`).join('');
    const callItem = (c) => `<div style="padding:8px 0;border-bottom:1px solid #f8fafc;font-size:12.5px"><b>${esc(c.name)}</b> · <span style="color:#64748b">${esc(c.phone)}</span> · ${new Date(c.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}${c.status_label ? ` <span style="background:${c.status_color || '#94a3b8'};color:#fff;font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:99px">${esc(c.status_label)}</span>` : ''}${c.author ? ' · ' + esc(c.author) : ''}<div style="color:#64748b;margin-top:2px">${esc(c.content)}</div></div>`;
    const newList = p.news.map(r => `<div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #f8fafc;font-size:12.5px"><b>${esc(r.name || '—')}</b><span style="color:#64748b">${esc(r.phone)}</span>${r.source ? `<span style="color:#94a3b8">· ${esc(r.source)}</span>` : ''}<span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${r.called ? '#d1fae5' : '#ffe4e6'};color:${r.called ? '#047857' : '#be123c'}">${r.called ? 'Đã gọi' : 'Chưa gọi'}</span></div>`).join('');
    const sec = (t, inner) => `<div style="background:#fff;border:1px solid #f1f5f9;border-radius:16px;padding:16px;margin-bottom:12px"><div style="font-weight:700;font-size:13px;margin-bottom:10px">${t}</div>${inner}</div>`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p.whoName)} — Báo cáo ${new Date(p.day + 'T12:00:00').toLocaleDateString('vi-VN')}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc">
<div style="background:linear-gradient(160deg,#0b3b34,#136b5e);color:#fff;padding:24px 16px 32px;border-radius:0 0 28px 28px"><div style="max-width:640px;margin:0 auto"><div style="font-size:10px;letter-spacing:2px;opacity:.6;font-weight:700">DR TUẤN HÙNG · TELESALE</div><div style="font-size:24px;font-weight:800;margin-top:4px">Báo cáo ngày</div><div style="opacity:.85;font-size:13px;margin-top:4px">${new Date(p.day + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · ${esc(p.whoName)}</div></div></div>
<div style="max-width:640px;margin:-16px auto 0;padding:0 14px 40px">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">${tiles}</div>
${sec('Cuộc gọi: khách cũ ' + p.stats.old_calls + ' · khách mới ' + p.stats.new_calls, `<div style="display:flex;height:18px;border-radius:99px;overflow:hidden;background:#f1f5f9"><div style="background:#94a3b8;width:${(p.stats.old_calls / ((p.stats.old_calls + p.stats.new_calls) || 1)) * 100}%"></div><div style="background:#10b981;width:${(p.stats.new_calls / ((p.stats.old_calls + p.stats.new_calls) || 1)) * 100}%"></div></div>`)}
${p.by_status.length ? sec('Khách trong ngày theo trạng thái', donut(p.by_status)) : ''}
${p.by_outcome.length ? sec('Kết quả cuộc gọi', bars(p.by_outcome)) : ''}
${p.by_source.length ? sec('Số mới theo nguồn', bars(p.by_source)) : ''}
${sec('Cuộc gọi KHÁCH MỚI (' + p.calls_new.length + ')', p.calls_new.map(callItem).join('') || '<div style="color:#cbd5e1;text-align:center;padding:12px">Không có</div>')}
${sec('Cuộc gọi KHÁCH CŨ (' + p.calls_old.length + ')', p.calls_old.map(callItem).join('') || '<div style="color:#cbd5e1;text-align:center;padding:12px">Không có</div>')}
${sec('Số mới tiếp nhận (' + p.news.length + ')', newList || '<div style="color:#cbd5e1;text-align:center;padding:12px">Không có</div>')}
<div style="text-align:center;color:#cbd5e1;font-size:11px">Dr Tuấn Hùng — Internal System</div>
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-telesale-${day}${whoName ? '-' + whoName.replace(/\s+/g, '') : ''}.html`;
    a.click(); URL.revokeObjectURL(a.href);
    toast.success('Đã tải file báo cáo — gửi file này qua Zalo cũng được');
  };

  const copyReport = () => {
    const d = new Date(day + 'T12:00:00').toLocaleDateString('vi-VN');
    const lines = [`BÁO CÁO TELESALE NGÀY ${d}${whoName ? ' — ' + whoName : ''}`];
    lines.push(`• Cuộc gọi trong ngày: ${callRows.length} (khách cũ ${oldCallCnt} · khách mới ${newCallCnt})`);
    lines.push(`• Số mới tiếp nhận: ${newRows.length} (đã gọi ${newCalled.length} · chưa gọi ${newRows.length - newCalled.length})`);
    if (cares.length) lines.push(`• Chăm sóc: ${cares.length}`);
    if (nextCnt) lines.push(`• Hẹn liên hệ lại: ${nextCnt}`);
    if (share?.url) lines.push(`• Xem chi tiết: ${share.url}`);
    if (callsNew.length) { lines.push('', `—— CUỘC GỌI KHÁCH MỚI (${callsNew.length}) ——`); callsNew.slice(0, 100).forEach((c, i) => lines.push(`${i + 1}. ${c.name} · ${maskPhone(c.phone)}${STATUS[c.st] ? ' [' + STATUS[c.st].label + ']' : ''} · ${new Date(c.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${String(c.content || '').slice(0, 120)}`)); }
    if (callsOld.length) { lines.push('', `—— CUỘC GỌI KHÁCH CŨ (${callsOld.length}) ——`); callsOld.slice(0, 100).forEach((c, i) => lines.push(`${i + 1}. ${c.name} · ${maskPhone(c.phone)}${STATUS[c.st] ? ' [' + STATUS[c.st].label + ']' : ''} · ${new Date(c.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${String(c.content || '').slice(0, 120)}`)); }
    navigator.clipboard?.writeText(lines.join('\n'));
    toast.success('Đã copy báo cáo tóm tắt');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[80] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl shadow-xl max-h-[94vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b flex justify-between items-center bg-white">
          <h3 className="font-bold text-slate-800">Báo cáo ngày — Telesale</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto">
          <div className="flex gap-2 mb-3 flex-wrap">
            <input type="date" value={day} onChange={e => setDay(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none" />
            {!isTele && (
              <select value={who} onChange={e => setWho(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none flex-1 min-w-[130px]">
                <option value="all">Tất cả telesale</option>
                {teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            )}
          </div>
          {/* Hàng nút: Link+QR cho sếp · Tải file · Copy */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button onClick={makeShare} disabled={busyShare || loading} className="h-10 rounded-xl bg-teal-600 text-white font-bold text-[12.5px] hover:bg-teal-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"><Link2 className="w-4 h-4" />{busyShare ? 'Đang tạo…' : 'Link + QR'}</button>
            <button onClick={downloadHtml} disabled={loading} className="h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-[12.5px] hover:bg-slate-50 disabled:opacity-50 inline-flex items-center justify-center gap-1"><Download className="w-4 h-4" />Tải file</button>
            <button onClick={copyReport} disabled={loading} className="h-10 rounded-xl border border-amber-300 text-amber-700 font-bold text-[12.5px] hover:bg-amber-50 disabled:opacity-50 inline-flex items-center justify-center gap-1"><Copy className="w-4 h-4" />Copy</button>
          </div>

          {/* Khối chia sẻ: QR + link */}
          {share && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 mb-4 text-center">
              <div className="text-[13px] font-bold text-teal-800 mb-2">Sếp quét QR hoặc mở link là xem được (không cần đăng nhập)</div>
              <img src={share.qr} alt="QR báo cáo" className="w-56 mx-auto rounded-xl border border-teal-100 bg-white shadow-sm" />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={shareZalo} className="h-11 rounded-xl bg-blue-600 text-white text-[13px] font-bold hover:bg-blue-700 inline-flex items-center justify-center gap-1.5"><Send className="w-4 h-4" /> Gửi Zalo</button>
                <button onClick={downloadQr} className="h-11 rounded-xl bg-teal-600 text-white text-[13px] font-bold hover:bg-teal-700 inline-flex items-center justify-center gap-1.5"><Download className="w-4 h-4" /> Tải ảnh QR</button>
              </div>
              <div className="flex gap-2 mt-2">
                <input readOnly value={share.url} className="flex-1 min-w-0 px-3 py-2 text-[12px] rounded-lg border border-teal-200 bg-white text-slate-600 outline-none" onFocus={e => e.target.select()} />
                <button onClick={() => { navigator.clipboard?.writeText(share.url); toast.success('Đã copy link'); }} className="shrink-0 px-3 py-2 rounded-lg border border-teal-300 text-teal-700 text-[12px] font-bold hover:bg-teal-50">Copy link</button>
                <a href={share.url} target="_blank" rel="noopener noreferrer" className="shrink-0 px-3 py-2 rounded-lg border border-teal-300 text-teal-700 text-[12px] font-bold hover:bg-teal-50">Mở</a>
              </div>
            </div>
          )}

          {loading ? <div className="text-center py-8 text-slate-300 text-sm">Đang tải…</div> : (
            <>
              {/* 4 thẻ tổng quan */}
              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                {[
                  { label: 'Cuộc gọi', value: callRows.length, cls: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Số mới', value: newRows.length, cls: 'bg-blue-50 text-blue-700' },
                  { label: 'Mới đã gọi', value: newCalled.length, cls: 'bg-teal-50 text-teal-700' },
                  { label: 'Mới chưa gọi', value: newRows.length - newCalled.length, cls: 'bg-rose-50 text-rose-700' },
                ].map((c, i) => <div key={i} className={`rounded-xl py-2.5 ${c.cls}`}><div className="text-xl font-bold">{c.value}</div><div className="text-[10px] font-semibold">{c.label}</div></div>)}
              </div>

              {/* Khách cũ / mới */}
              <div className="rounded-2xl border border-slate-100 p-3.5 mb-3">
                <div className="text-[12.5px] font-bold text-slate-700 mb-2">Cuộc gọi: khách cũ · khách mới</div>
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-100 mb-1.5">
                  <div className="bg-slate-400" style={{ width: `${(oldCallCnt / (callRows.length || 1)) * 100}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${(newCallCnt / (callRows.length || 1)) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[11.5px] text-slate-600">
                  <span>Khách cũ: <b>{oldCallCnt}</b></span><span>Khách mới: <b>{newCallCnt}</b></span>
                </div>
              </div>

              {/* Tệp khách + kết quả gọi + nguồn */}
              {byStatusData.length > 0 && <div className="rounded-2xl border border-slate-100 p-3.5 mb-3"><div className="text-[12.5px] font-bold text-slate-700 mb-2.5">Khách trong ngày theo trạng thái</div><Donut data={byStatusData} centerLabel="khách/ngày" /><div className="flex flex-wrap gap-1.5 mt-2.5">{byStatusData.map((d, i) => <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: d.color }}>{d.label}: {d.value}</span>)}</div></div>}
              {byOutcomeData.length > 0 && <div className="rounded-2xl border border-slate-100 p-3.5 mb-3"><div className="text-[12.5px] font-bold text-slate-700 mb-2.5">Kết quả cuộc gọi</div><Bars data={byOutcomeData} /></div>}
              {bySourceData.length > 0 && <div className="rounded-2xl border border-slate-100 p-3.5 mb-3"><div className="text-[12.5px] font-bold text-slate-700 mb-2.5">Số mới theo nguồn</div><Bars data={bySourceData} /></div>}

              {/* Chi tiết cuộc gọi — TÁCH RÕ KHÁCH MỚI / KHÁCH CŨ */}
              {[{ title: 'Cuộc gọi KHÁCH MỚI', items: callsNew, tone: 'text-emerald-700', ring: 'border-emerald-200', badge: 'bg-emerald-600' },
                { title: 'Cuộc gọi KHÁCH CŨ', items: callsOld, tone: 'text-slate-700', ring: 'border-slate-200', badge: 'bg-slate-500' }].map((g, gi) => (
                <div key={gi} className="mb-4">
                  <div className={`text-[13px] font-bold mb-1.5 flex items-center gap-1.5 ${g.tone}`}>
                    <PhoneCall className="w-4 h-4" /> {g.title}
                    <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${g.badge}`}>{g.items.length}</span>
                  </div>
                  <div className={`max-h-52 overflow-y-auto rounded-xl border ${g.ring} divide-y divide-slate-50`}>
                    {g.items.length === 0 ? <div className="text-center py-5 text-slate-300 text-sm">Không có</div> :
                      g.items.map((c, i) => (
                        <div key={i} className="px-3 py-2 text-[12px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <b className="text-slate-800">{c.name}</b>
                            <span className="text-slate-500 tabular-nums">{maskPhone(c.phone)}</span>
                            <span className="text-slate-400">· {new Date(c.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            {c.st && STATUS[c.st] && <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: STATUS_COLORS[c.st] || '#94a3b8' }}>{STATUS[c.st].label}</span>}
                            {c.gf && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">GetFly</span>}
                            {who === 'all' && c.author && <span className="text-slate-400">· {c.author}</span>}
                          </div>
                          {c.content && <div className="text-slate-500 mt-0.5 line-clamp-2">{c.content}</div>}
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {/* Số mới */}
              <div className="text-[13px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-blue-600" /> Số mới tiếp nhận ({newRows.length})</div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50 mb-2">
                {newRows.length === 0 ? <div className="text-center py-6 text-slate-300 text-sm">Không có số mới trong ngày</div> :
                  newRows.map(r => (
                    <div key={r.id} className="px-3 py-2 text-[12px] flex items-center gap-2 flex-wrap">
                      <b className="text-slate-800">{r.customer_name || '—'}</b>
                      <span className="text-slate-500 tabular-nums">{maskPhone(r.phone)}</span>
                      {r.source && <span className="text-slate-400">· {r.source}</span>}
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isCalled(r) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{isCalled(r) ? <span className="inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Đã gọi</span> : 'Chưa gọi'}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- Thêm khách mới ----------
const EditModal = ({ row, me, staff, onClose, onSaved }) => {
  const [f, setF] = useState({
    customer_name: row.customer_name || '', phone: row.phone || '', truc_page_id: row.truc_page_id || '',
    description: row.description || '', status: row.status || 'tiep_can',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.phone.trim()) { toast.error('Nhập số điện thoại'); return; }
    setSaving(true);
    const payload = { ...f, truc_page_id: f.truc_page_id || null, phone: f.phone.trim() };
    const { error } = row.id
      ? await supabase.from('marketing_data').update(payload).eq('id', row.id)
      : await supabase.from('marketing_data').upsert({ ...payload, created_by: me.id }, { onConflict: 'phone' });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã lưu'); onSaved();
  };
  return (
    <Modal title={row.id ? 'Sửa data khách' : 'Thêm data khách'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tên khách hàng"><input value={f.customer_name} onChange={e => setF({ ...f, customer_name: e.target.value })} className={inp} /></Field>
        <Field label="Số điện thoại *"><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={inp} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Trực page phụ trách"><select value={f.truc_page_id} onChange={e => setF({ ...f, truc_page_id: e.target.value })} className={inp}><option value="">— Chọn —</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
        <Field label="Trạng thái"><select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className={inp}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Mô tả / nhu cầu"><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} className={inp} /></Field>
      <ModalActions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
};

// ---------- Import CSV ----------
const ImportModal = ({ me, onClose, onDone }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const findIdx = (head, keys) => head.findIndex(h => keys.some(k => h.includes(k)));
  const parse = (raw) => {
    const rowsCsv = parseCSV(raw);
    if (rowsCsv.length < 2) { setPreview([]); return; }
    const head = rowsCsv[0].map(h => h.toLowerCase().trim());
    const iName = findIdx(head, ['tên', 'ten', 'name', 'khách']);
    const iPhone = findIdx(head, ['sđt', 'sdt', 'phone', 'điện thoại', 'dien thoai']);
    const iDesc = findIdx(head, ['mô tả', 'mo ta', 'desc']);
    const iStatus = findIdx(head, ['trạng thái', 'trang thai', 'status']);
    const iLast = findIdx(head, ['trao đổi', 'trao doi', 'last']);
    const iReach = findIdx(head, ['tiếp cận', 'tiep can', 'reach']);
    const out = [];
    for (let i = 1; i < rowsCsv.length; i++) {
      const r = rowsCsv[i];
      const phone = (iPhone >= 0 ? r[iPhone] : '').trim();
      if (!phone) continue;
      const stRaw = (iStatus >= 0 ? r[iStatus] : '').toLowerCase().trim();
      out.push({
        customer_name: iName >= 0 ? (r[iName] || '').trim() : '',
        phone,
        description: iDesc >= 0 ? (r[iDesc] || '').trim() : null,
        status: LABEL_TO_CODE[stRaw] || 'tiep_can',
        last_exchange: iLast >= 0 ? (r[iLast] || '').trim() : null,
        reached_info: iReach >= 0 ? (r[iReach] || '').trim() : null,
      });
    }
    const byPhone = {}; out.forEach(o => { byPhone[phoneKey(o.phone)] = o; });
    setPreview(Object.values(byPhone));
  };

  const onFile = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; const t = await file.text(); setText(t); parse(t); };

  const downloadSample = () => {
    const rows = [
      ['Tên khách hàng', 'SĐT', 'Mô tả', 'Trạng thái', 'Trao đổi gần nhất', 'Thông tin đã tiếp cận'],
      ['Nguyễn Văn A', '0901234567', 'Quan tâm nâng mũi', 'Tiếp cận', 'Đã nhắn tư vấn báo giá', 'Khách hỏi giá nâng mũi cấu trúc'],
      ['Trần Thị B', '0912345678', 'Hỏi cắt mí', 'Nóng', 'Hẹn gọi lại chiều nay', 'Đã gửi hình before/after'],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCsv('mau-data-khach-hang.csv', csv);
  };

  const doImport = async () => {
    if (preview.length === 0) { toast.error('Chưa có dữ liệu hợp lệ (cần cột SĐT)'); return; }
    setSaving(true);
    const tid = me?.role === 'truc_page' || me?.role_2 === 'truc_page' ? me.id : null;
    const payload = preview.map(p => ({ ...p, truc_page_id: tid, created_by: me.id }));
    const { error } = await supabase.from('marketing_data').upsert(payload, { onConflict: 'phone' });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success(`Đã import ${preview.length} khách (hợp nhất theo SĐT)`); onDone();
  };

  return (
    <Modal title="Import Data khách (CSV)" onClose={onClose}>
      <p className="text-[12px] text-slate-500 mb-2">Cột nhận dạng tự động theo tiêu đề: <b>Tên</b>, <b>SĐT</b>, Mô tả, Trạng thái, Trao đổi gần nhất, Thông tin đã tiếp cận. Bắt buộc có cột <b>SĐT</b>. Trùng SĐT sẽ hợp nhất.</p>
      <div className="flex gap-2 mb-2 flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-200 text-teal-700 text-sm font-semibold hover:bg-teal-50"><Upload className="w-4 h-4" /> Chọn file CSV</button>
        <button type="button" onClick={downloadSample} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"><Download className="w-4 h-4" /> Tải file mẫu</button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <textarea value={text} onChange={e => { setText(e.target.value); parse(e.target.value); }} rows={5} placeholder="Hoặc dán nội dung CSV vào đây (dòng đầu là tiêu đề)…" className={inp + ' font-mono text-xs'} />
      {preview.length > 0 && <div className="mt-2 text-sm text-teal-700 font-semibold">Nhận diện {preview.length} khách hợp lệ.</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
        <button onClick={doImport} disabled={saving || preview.length === 0} className="px-5 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50 text-sm">{saving ? 'Đang import…' : `Import ${preview.length || ''}`}</button>
      </div>
    </Modal>
  );
};

// ---------- chung ----------
const Field = ({ label, children }) => (<div className="mb-3"><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>{children}</div>);
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="px-5 py-3.5 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl"><h3 className="font-bold text-slate-800">{title}</h3><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
const ModalActions = ({ onClose, onSave, saving }) => (
  <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button><button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50 text-sm">{saving ? 'Đang lưu…' : 'Lưu'}</button></div>
);

// ---------- Kéo dữ liệu từ GetFly CRM ----------
const GetflyModal = ({ onClose, onDone }) => {
  const [busy, setBusy] = useState('');
  const [probe, setProbe] = useState(null);
  const [result, setResult] = useState(null);
  const [diag, setDiag] = useState(null);   // danh sách route đã thử (khi dò không ra)

  const doProbe = async () => {
    setBusy('probe'); setProbe(null); setResult(null); setDiag(null);
    try {
      const { data, error } = await supabase.functions.invoke('getfly-sync', { body: { probe: true } });
      if (error) throw new Error(error.message);
      if (!data?.ok) { setDiag(data?.tries || null); throw new Error(data?.error || 'Lỗi GetFly'); }
      setProbe(data);
      toast.success(`Kết nối OK · route ${data.path} · trang 1 có ${data.count_page1} khách`);
    } catch (e) { toast.error('GetFly: ' + e.message, { duration: 9000 }); }
    setBusy('');
  };
  const doSync = async () => {
    if (!confirm('Kéo TOÀN BỘ khách từ GetFly về Data khách hàng? Trùng SĐT sẽ cập nhật tên/mô tả, giữ nguyên trạng thái & người phụ trách.')) return;
    setBusy('sync'); setResult(null);
    try {
      // Kéo tới khi HẾT SẠCH: function trả next_page thì gọi tiếp từ trang đó.
      let startPage = 1, total = 0, pages = 0, skipped = 0, round = 0;
      for (;;) {
        round++;
        toast.loading(`Đang kéo GetFly — đợt ${round} (từ trang ${startPage})…`, { id: 'gf-sync' });
        const { data, error } = await supabase.functions.invoke('getfly-sync', { body: { start_page: startPage } });
        if (error) throw new Error(error.message);
        if (!data?.ok) throw new Error(data?.error || 'Lỗi GetFly');
        total += data.upserted || 0; pages += data.pages || 0; skipped += data.skipped_no_phone || 0;
        setResult({ ...data, upserted: total, pages, skipped_no_phone: skipped });
        if (!data.next_page) break;      // done = hết sạch dữ liệu
        startPage = data.next_page;
      }
      toast.success(`Đã kéo HẾT: ${total.toLocaleString('vi-VN')} khách (${pages} trang)${skipped ? ` · bỏ ${skipped} khách thiếu SĐT` : ''}`, { id: 'gf-sync', duration: 10000 });
      onDone?.();
    } catch (e) { toast.error('GetFly: ' + e.message, { id: 'gf-sync', duration: 8000 }); }
    setBusy('');
  };

  return (
    <Modal title="Kéo dữ liệu từ GetFly" onClose={onClose}>
      <p className="text-[12px] text-slate-500 mb-3">Kéo danh sách khách từ GetFly CRM về module này, hợp nhất theo <b>số điện thoại</b>. Khách đã có sẽ được cập nhật tên/mô tả nhưng <b>giữ nguyên trạng thái & người phụ trách</b>. Nên bấm <b>Kiểm tra kết nối</b> trước để soi dữ liệu.</p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={doProbe} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{busy === 'probe' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
        <button type="button" onClick={doSync} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"><Download className="w-4 h-4" /> {busy === 'sync' ? 'Đang kéo…' : 'Kéo về'}</button>
      </div>

      {probe && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-600 mb-1.5">Xem trước map ({probe.count_page1} khách/trang · {probe.total_page} trang):</div>
          {(probe.sample || []).map((s, i) => (
            <div key={i} className="text-[12px] text-slate-600 border-b border-slate-100 py-1 last:border-0">
              <b className="text-slate-800">{s.customer_name || '(không tên)'}</b> · SĐT: {s.phone || <span className="text-rose-500">không đọc được</span>} {s.description && <span className="text-slate-400">· {s.description}</span>}
            </div>
          ))}
          {probe.sample?.some(s => !s.phone) && <div className="text-[11px] text-amber-600 mt-1.5">Có khách chưa đọc được SĐT — gửi ảnh này cho kỹ thuật để chỉnh map. Các trường thô: {(probe.sample?.[0]?._raw_keys || []).join(', ')}</div>}
        </div>
      )}
      {result && (
        <div className="mt-3 text-sm text-teal-700 font-semibold">Đã quét {result.scanned} · cập nhật {result.upserted} · bỏ {result.skipped_no_phone} thiếu SĐT{result.failed ? ` · lỗi ${result.failed}` : ''}.</div>
      )}
      {diag && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-bold text-amber-700 mb-1.5">Không tìm được route API đúng — GetFly trả về cho từng route đã thử (chụp gửi kỹ thuật):</div>
          {diag.map((t, i) => (
            <div key={i} className="text-[11px] text-slate-600 font-mono border-b border-amber-100 py-1 last:border-0 break-all">
              {t.path} → HTTP {t.status ?? '—'}{t.error ? ` · ${t.error}` : ''}{t.msg ? ` · ${String(t.msg).slice(0, 80)}` : ''}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-4"><button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Đóng</button></div>
    </Modal>
  );
};

// ================= Tạo lịch hẹn từ 1 khách (đẩy sang Module lịch hẹn) =================
const CreateApptModal = ({ row, me, defaultNotes = '', onClose }) => {
  const today = vnToday();
  const [f, setF] = useState({
    appointment_date: today, appointment_time: '09:00',
    customer_name: row.customer_name || '', phone: row.phone || '',
    service: '', service_group: 'Hàm mặt', surgery_type: 'Tiểu phẫu',
    test_status: 'Chưa xét nghiệm', expected_bill: '', deposit_amount: '',
    customer_source: 'Ads', customer_type: 'Mới',
    telesale_id: row.telesale_id || '', telesale_id_2: '', sale_id: '',
    social_link: '', notes: defaultNotes || '',
  });
  const [staffList, setStaffList] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role, role_2').eq('is_active', true).order('full_name')
      .then(({ data }) => setStaffList(data || []));
  }, []);
  const telesales = staffList.filter(s => s.role === 'telesale' || s.role_2 === 'telesale');
  const sales = staffList.filter(s => s.role === 'sale_offline' || s.role_2 === 'sale_offline');

  const save = async () => {
    if (!f.customer_name.trim() || !f.appointment_date) return toast.error('Cần Tên khách và Ngày hẹn');
    setSaving(true);
    const { error } = await supabase.from('customer_appointments').insert({
      customer_name: f.customer_name.trim(), phone: f.phone.trim() || null,
      appointment_date: f.appointment_date, appointment_time: f.appointment_time,
      service: f.service || null, service_group: f.service_group, surgery_type: f.surgery_type,
      test_status: f.test_status,
      expected_bill: Number(f.expected_bill) || 0, deposit_amount: Number(f.deposit_amount) || 0,
      telesale_id: f.telesale_id || null, telesale_id_2: f.telesale_id_2 || null, sale_id: f.sale_id || null,
      social_link: f.social_link || '', notes: f.notes || null,
      customer_source: f.customer_source, customer_type: f.customer_type,
      status: 'scheduled', created_by: me.id,
    });
    setSaving(false);
    if (error) return toast.error('Lỗi tạo lịch: ' + error.message);
    toast.success('Đã tạo lịch hẹn — xem ở Module lịch hẹn');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-5 py-3.5 border-b flex items-center justify-between bg-white">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-violet-600" /> Tạo lịch hẹn</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider border-b pb-1.5 mb-3">Thông tin khách hàng</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày hẹn *"><input type="date" value={f.appointment_date} onChange={e => set('appointment_date', e.target.value)} className={inp} /></Field>
            <Field label="Giờ hẹn *"><input type="time" value={f.appointment_time} onChange={e => set('appointment_time', e.target.value)} className={inp} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tên khách hàng *"><input value={f.customer_name} onChange={e => set('customer_name', e.target.value)} className={inp} /></Field>
            <Field label="Số điện thoại">
              {phoneView(row.phone, me) !== String(row.phone ?? '')
                ? <input value={phoneView(row.phone, me)} readOnly title="Đã ẩn theo phân quyền" className={`${inp} bg-slate-50 text-slate-400`} />
                : <input value={f.phone} onChange={e => set('phone', e.target.value)} className={inp} />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nguồn khách">
              <select value={f.customer_source} onChange={e => set('customer_source', e.target.value)} className={inp}>
                <option>Ads</option><option>CSKH</option><option>Referral</option><option>Khác</option>
              </select>
            </Field>
            <Field label="Tệp khách">
              <select value={f.customer_type} onChange={e => set('customer_type', e.target.value)} className={inp}>
                <option>Mới</option><option>Cũ</option>
              </select>
            </Field>
          </div>

          <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider border-b pb-1.5 mb-3 mt-2">Chi tiết dịch vụ</div>
          <Field label="Dịch vụ"><input value={f.service} onChange={e => set('service', e.target.value)} placeholder="VD: Gọt hàm, nâng mũi…" className={inp} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nhóm dịch vụ">
              <select value={f.service_group} onChange={e => set('service_group', e.target.value)} className={inp}>
                <option>Hàm mặt</option><option>Body</option><option>Tiểu phẫu</option>
              </select>
            </Field>
            <Field label="Loại phẫu thuật">
              <select value={f.surgery_type} onChange={e => set('surgery_type', e.target.value)} className={inp}>
                <option>Tiểu phẫu</option><option>Đại phẫu</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tình trạng xét nghiệm">
              <select value={f.test_status} onChange={e => set('test_status', e.target.value)} className={inp}>
                <option>Chưa xét nghiệm</option><option>Đã xét nghiệm</option><option>Không cần</option>
              </select>
            </Field>
            <div />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bill dự kiến (VNĐ)"><input type="number" inputMode="numeric" value={f.expected_bill} onChange={e => set('expected_bill', e.target.value)} placeholder="0" className={inp} /></Field>
            <Field label="Đã cọc (VNĐ)"><input type="number" inputMode="numeric" value={f.deposit_amount} onChange={e => set('deposit_amount', e.target.value)} placeholder="0" className={inp} /></Field>
          </div>

          <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider border-b pb-1.5 mb-3 mt-2">Phụ trách & Ghi chú</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telesale phụ trách">
              <select value={f.telesale_id} onChange={e => set('telesale_id', e.target.value)} className={inp}>
                <option value="">— Không có —</option>
                {telesales.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
            <Field label="Telesale phụ trách 2">
              <select value={f.telesale_id_2} onChange={e => set('telesale_id_2', e.target.value)} className={inp}>
                <option value="">— Không có —</option>
                {telesales.filter(t => t.id !== f.telesale_id).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Sale Offline phụ trách">
            <select value={f.sale_id} onChange={e => set('sale_id', e.target.value)} className={inp}>
              <option value="">— Không có —</option>
              {sales.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Thông tin tham khảo (Link FB, Zalo…)"><input value={f.social_link} onChange={e => set('social_link', e.target.value)} placeholder="Link profile khách hàng…" className={inp} /></Field>
          <Field label="Tình trạng khách hàng (tự gom từ nhật ký tư vấn)">
            <textarea rows={6} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Tổng hợp nội dung tư vấn, mong muốn của khách…" className={`${inp} resize-none leading-relaxed`} />
          </Field>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-5 py-3 border-t bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-60 text-sm inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{saving ? 'Đang tạo…' : 'Tạo lịch hẹn'}</button>
        </div>
      </div>
    </div>
  );
};

export default MarketingDataPage;
