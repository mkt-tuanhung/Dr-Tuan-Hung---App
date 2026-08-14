import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { parseCSV, downloadCsv } from '@/lib/csv';
import QRCode from 'qrcode';
import { Bars, Donut, STATUS_COLORS, OUTCOME_COLORS } from '@/components/report/ReportViz.jsx';
import { maskPhone } from '@/lib/phoneMask';
import { Database, Plus, Upload, Search, X, Trash2, Link2, Download, Users, Flame, CheckCircle2, Headphones, UserX, ChevronLeft, ChevronRight, Phone, MessageCircle, PhoneCall, HeartHandshake, Clock, Copy, CalendarClock, Save, FileText, CalendarDays, Sparkles, UserPlus, SlidersHorizontal, Send } from 'lucide-react';

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
        .order('updated_at', { ascending: false }).range(from, from + 999);
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
  const visible = rows.filter(r =>
    (!q || (r.customer_name || '').toLowerCase().includes(q) || (r.phone || '').includes(q)) &&
    (!fStatus || r.status === fStatus) &&
    (!fTruc || r.truc_page_id === fTruc) &&
    (!fDay || dayKey(arrivedAt(r)) === fDay) && matchTele(r) && matchChip(r));

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
  const totalPages = Math.max(1, Math.ceil(visible.length / 10));
  const curPage = Math.min(page, totalPages);
  const paged = visible.slice((curPage - 1) * 10, curPage * 10);
  const CHIPS = [{ k: 'all', label: 'Tất cả' }, { k: 'can_goi', label: 'Cần gọi' }, { k: 'nong', label: 'Nóng' }, { k: 'mat', label: 'Mất' }, { k: 'da_lam_dv', label: 'Đã làm DV' }, { k: 'cskh', label: 'CSKH' }];
  const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

  // Chip nhắc gọi lại trong danh sách
  const DueBadge = ({ r }) => {
    if (!r.next_call_at) return null;
    const due = isDue(r.next_call_at);
    return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${due ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-600'}`}><CalendarClock className="w-3 h-3" />{due ? 'Cần gọi' : 'Gọi lại'} {fmtDT(r.next_call_at)}</span>;
  };

  const statCards = [
    { icon: Users, color: '#14b8a6', label: 'Tổng khách', value: stat.total },
    { icon: CalendarClock, color: '#ef4444', label: 'Cần gọi hôm nay', value: stat.due },
    { icon: Flame, color: '#f43f5e', label: 'Khách nóng', value: stat.nong },
    { icon: CheckCircle2, color: '#3b82f6', label: 'Đã làm dịch vụ', value: stat.daDV },
    { icon: UserX, color: '#64748b', label: 'Khách mất', value: stat.mat },
  ];
  const activeFilters = [fStatus, fTruc, fDay, (fTele && fTele !== (isTele ? 'mine' : '')) ? fTele : ''].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header — MOBILE */}
      <div className="lg:hidden relative overflow-hidden -mx-4 -mt-4 px-4 pt-4 pb-6 rounded-b-[28px] text-white shadow-lg" style={{ background: 'linear-gradient(160deg,#0b3b34 0%,#0f5148 55%,#136b5e 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <h2 className="text-2xl font-bold text-white">Data khách hàng</h2>
          <p className="text-white/70 text-[13px] mt-0.5">Gọi · cập nhật · nhật ký gọi & chăm sóc</p>
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-white/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm khách hàng, SĐT…" className="w-full pl-10 pr-3 h-12 rounded-2xl bg-white/15 border border-white/20 text-white placeholder-white/60 text-sm outline-none focus:bg-white/20 transition" />
          </div>
        </div>
      </div>

      {/* Header — DESKTOP */}
      <div className="hidden lg:flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Database className="w-6 h-6 text-teal-600" /> Data khách hàng</h2>
          <p className="text-slate-400 text-sm mt-0.5">Telesale gọi · cập nhật thông tin · ghi nhật ký gọi & nhật ký chăm sóc (hợp nhất theo SĐT)</p>
        </div>
        {canWrite && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={buildQueue} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-sm"><PhoneCall className="w-4 h-4" /> Bắt đầu gọi{dueCount > 0 && <span className="bg-white/25 rounded-full px-2 text-xs">{dueCount}</span>}</button>
            <button onClick={() => setReportOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-amber-300 text-amber-700 font-semibold text-sm hover:bg-amber-50"><FileText className="w-4 h-4" /> Báo cáo ngày</button>
            {canAssign && <button onClick={divideTele} disabled={dividing} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-violet-200 text-violet-700 font-semibold text-sm hover:bg-violet-50 disabled:opacity-50"><Users className="w-4 h-4" /> {dividing ? 'Đang chia…' : 'Chia đều'}</button>}
            {roles.includes('admin') && <button onClick={() => setGetflyOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-indigo-200 text-indigo-700 font-semibold text-sm hover:bg-indigo-50"><Download className="w-4 h-4" /> Kéo từ GetFly</button>}
            {['marketing', 'truc_page', 'admin'].some(r => roles.includes(r)) && <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-teal-200 text-teal-700 font-semibold text-sm hover:bg-teal-50"><Upload className="w-4 h-4" /> Import CSV</button>}
            <button onClick={() => setEdit({})} className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700"><Plus className="w-4 h-4" /> Thêm khách</button>
          </div>
        )}
      </div>

      {/* Thẻ số liệu — desktop */}
      <div className="hidden lg:grid lg:grid-cols-5 gap-3">
        {statCards.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: c.color + '1a' }}><c.icon className="w-5 h-5" style={{ color: c.color }} /></span>
            <div className="text-xl font-bold text-slate-800">{c.value.toLocaleString('vi-VN')}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Số liệu — mobile: dải pill cuộn ngang, gọn 1 hàng */}
      <div className="lg:hidden -mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
        {statCards.map((c, i) => (
          <div key={i} className="shrink-0 flex items-center gap-2 bg-white border border-slate-100 shadow-sm rounded-2xl pl-2 pr-3.5 py-2">
            <span className="w-8 h-8 rounded-xl grid place-items-center" style={{ backgroundColor: c.color + '1a' }}><c.icon className="w-4 h-4" style={{ color: c.color }} /></span>
            <div>
              <div className="text-[15px] font-bold text-slate-800 leading-none tabular-nums">{c.value.toLocaleString('vi-VN')}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden lg:flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / SĐT…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-teal-400 outline-none bg-white" />
        </div>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={fTruc} onChange={e => setFTruc(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none">
          <option value="">Mọi trực page</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select value={fTele} onChange={e => setFTele(e.target.value)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none">
          <option value="">Mọi telesale</option>
          <option value="mine">Của tôi</option>
          <option value="none">Chưa phân công</option>
          {teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={fDay} onChange={e => { setFDay(e.target.value); setPage(1); }} title="Lọc theo ngày data về" className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none" />
          <button onClick={() => { setFDay(fDay === todayKey() ? '' : todayKey()); setPage(1); }} className={`px-3 py-2 text-sm font-semibold rounded-xl border ${fDay === todayKey() ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'}`}>Hôm nay</button>
          {fDay && <button onClick={() => setFDay('')} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Mobile: Bắt đầu gọi (chính) · Báo cáo · Bộ lọc */}
      <div className="lg:hidden flex gap-2">
        {canWrite && (
          <button onClick={buildQueue} className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-bold text-[15px] shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 active:scale-[0.99]">
            <PhoneCall className="w-5 h-5" /> Bắt đầu gọi{dueCount > 0 && <span className="bg-white/25 rounded-full px-2.5 py-0.5 text-sm">{dueCount}</span>}
          </button>
        )}
        {canWrite && <button onClick={() => setReportOpen(true)} className="shrink-0 h-12 w-12 rounded-2xl border border-amber-300 text-amber-600 bg-white grid place-items-center active:scale-95"><FileText className="w-5 h-5" /></button>}
        <button onClick={() => setFilterOpen(true)} className="relative shrink-0 h-12 w-12 rounded-2xl border border-slate-200 text-slate-600 bg-white grid place-items-center active:scale-95">
          <SlidersHorizontal className="w-5 h-5" />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold grid place-items-center">{activeFilters}</span>}
        </button>
      </div>

      {/* Chips lọc nhanh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CHIPS.map(c => (
            <button key={c.k} onClick={() => { setChip(c.k); setPage(1); }} className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold border transition ${chip === c.k ? 'bg-teal-600 text-white border-teal-600 shadow' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{c.label}{c.k === 'can_goi' && stat.due > 0 && <span className={`ml-1.5 ${chip === c.k ? 'text-white/90' : 'text-rose-500'}`}>{stat.due}</span>}</button>
          ))}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{visible.length} khách</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Khách hàng</th>
                  <th className="px-4 py-3 font-semibold">SĐT</th>
                  <th className="px-4 py-3 font-semibold">Ngày về</th>
                  <th className="px-4 py-3 font-semibold">Telesale</th>
                  <th className="px-4 py-3 font-semibold">Phụ trách</th>
                  <th className="px-4 py-3 font-semibold">Mô tả</th>
                  <th className="px-4 py-3 font-semibold">Nguồn · Nhóm</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Nhắc gọi lại</th>
                  <th className="px-4 py-3 font-semibold">Trao đổi gần nhất</th>
                  <th className="px-4 py-3 font-semibold">Đã tiếp cận</th>
                  <th className="px-4 py-3 font-semibold">Liên kết</th>
                  {canWrite && <th className="px-4 py-3 font-semibold text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paged.length === 0 ? <tr><td colSpan={canWrite ? 13 : 12} className="text-center py-10 text-slate-400">Chưa có data</td></tr> :
                  paged.map(r => { const appt = apptMap[phoneKey(r.phone)]; const st = APPT_STAGE(appt); return (
                    <tr key={r.id} className="hover:bg-teal-50/40 cursor-pointer" onClick={() => setDetail(r)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white grid place-items-center text-[11px] font-bold shrink-0">{initials(r.customer_name)}</span>
                          <div className="min-w-0"><div className="font-semibold text-slate-800 truncate max-w-[140px]">{r.customer_name || '—'}</div>{r.getfly_code && <div className="text-[10px] text-slate-300 truncate">{r.getfly_code}</div>}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">{r.phone}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-semibold tabular-nums ${dayKey(arrivedAt(r)) === todayKey() ? 'text-emerald-600' : 'text-slate-500'}`} title={arrivedAt(r) ? new Date(arrivedAt(r)).toLocaleString('vi-VN') : ''}>
                          {dayKey(arrivedAt(r)) === todayKey() ? <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Hôm nay</span> : fmtD(arrivedAt(r))}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {canAssign
                          ? <select value={r.telesale_id || ''} onChange={e => assignTele(r, e.target.value)} className="text-xs font-semibold rounded-lg border border-slate-200 px-1.5 py-1 bg-white outline-none max-w-[110px]"><option value="">— Chưa —</option>{teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                          : <span className="text-xs text-slate-500 whitespace-nowrap">{r.telesale?.full_name || '—'}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap max-w-[110px] truncate" title={r.manager_name}>{r.manager_name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate" title={r.description}>{r.description || '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="text-slate-600 font-semibold">{r.source || '—'}</div>
                        {r.customer_group && <div className="text-slate-400 text-[11px]">{r.customer_group}</div>}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {canWrite
                          ? <select value={r.status || 'tiep_can'} onChange={e => quickStatus(r, e.target.value)} className={`text-[11px] font-bold rounded-full px-2 py-1 outline-none border-0 cursor-pointer ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                          : <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{STATUS[r.status]?.label || r.status}</span>}
                      </td>
                      <td className="px-4 py-3"><DueBadge r={r} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={r.last_exchange}>{r.last_exchange || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={r.reached_info}>{r.reached_info || '—'}</td>
                      <td className="px-4 py-3">{st ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${st.cls}`}><Link2 className="w-3 h-3" />{st.label}</span> : <span className="text-[11px] text-slate-300">—</span>}</td>
                      {canWrite && <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}><div className="flex justify-end gap-1.5"><a href={`tel:${r.phone}`} className="px-2 py-1 rounded-lg text-xs font-semibold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 inline-flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5" />Gọi</a><a href={zaloLink(r.phone)} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-lg text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50">Zalo</a><button onClick={() => setDetail(r)} className="px-2 py-1 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50">Mở</button><button onClick={() => del(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div></td>}
                    </tr>); })}
              </tbody>
            </table>
          </div>
          {/* Mobile — thẻ khách: rail màu trạng thái · Gọi/Zalo 1 chạm */}
          <div className="md:hidden divide-y divide-slate-50">
            {paged.map(r => { const st = APPT_STAGE(apptMap[phoneKey(r.phone)]); const isToday = dayKey(arrivedAt(r)) === todayKey(); return (
              <div key={r.id} className="relative flex gap-3 pl-4 pr-3 py-3 active:bg-slate-50" onClick={() => setDetail(r)}>
                <span className="absolute left-1 top-3 bottom-3 w-1 rounded-full" style={{ background: STATUS_COLORS[r.status] || '#cbd5e1' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="font-bold text-slate-800 text-[14.5px] truncate">{r.customer_name || '—'}</div>
                    {isToday && <span className="shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><Sparkles className="w-3 h-3" />Mới</span>}
                  </div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-600 tabular-nums">{r.phone}</span>
                    <span className="text-slate-300">·</span><span>{isToday ? 'Hôm nay' : fmtD(arrivedAt(r))}</span>
                    {r.source && <><span className="text-slate-300">·</span><span className="truncate max-w-[110px]">{r.source}</span></>}
                  </div>
                  {r.last_exchange && <div className="text-[11.5px] text-slate-400 mt-1 line-clamp-1">{r.last_exchange}</div>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS[r.status]?.cls || 'bg-slate-100 text-slate-500'}`}>{STATUS[r.status]?.label || r.status}</span>
                    <DueBadge r={r} />
                    {st && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}
                    {r.telesale?.full_name && <span className="text-[10px] text-slate-400">{r.telesale.full_name}</span>}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <a href={`tel:${r.phone}`} className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center shadow-sm active:scale-95"><PhoneCall style={{ width: 18, height: 18 }} /></a>
                  <a href={zaloLink(r.phone)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 grid place-items-center text-[10.5px] font-bold active:scale-95">Zalo</a>
                </div>
              </div>); })}
          </div>
          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-slate-400 text-xs">Trang {curPage}/{totalPages} · {visible.length} khách</span>
              <div className="flex items-center gap-1">
                <button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {canWrite && !detail && !reportOpen && !filterOpen && !edit && !importOpen && !getflyOpen && (
        <button onClick={() => setEdit({})} title="Thêm khách" className="lg:hidden fixed z-[60] bottom-20 right-5 w-14 h-14 rounded-full bg-teal-600 text-white shadow-2xl shadow-teal-900/40 ring-4 ring-teal-500/20 flex items-center justify-center"><Plus className="w-7 h-7" strokeWidth={2.5} /></button>
      )}

      {detail && <CustomerConsole row={detail} me={me} staff={staff} teleStaff={teleStaff} canWrite={canWrite} canAssign={canAssign} appt={apptOf(detail)}
        queuePos={queue ? { i: queue.pos + 1, n: queue.ids.length } : null} onNext={queue ? queueNext : null}
        onClose={() => { setDetail(null); setQueue(null); }} onChanged={loadData} onDelete={() => { setDetail(null); del(detail); }} />}
      {/* Bottom-sheet BỘ LỌC (mobile) */}
      {filterOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[80] flex items-end justify-center backdrop-blur-sm" onClick={() => setFilterOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="shrink-0 px-5 py-3.5 border-b flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-teal-600" /> Bộ lọc</h3>
              <button onClick={() => setFilterOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              <Field label="Trạng thái">
                <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} className={inp}>
                  <option value="">Mọi trạng thái</option>
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
              <div className="flex gap-2 mt-1">
                <button onClick={() => { setFStatus(''); setFTruc(''); setFDay(''); setFTele(isTele ? 'mine' : ''); setPage(1); }} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-500 font-semibold text-sm">Xoá lọc</button>
                <button onClick={() => setFilterOpen(false)} className="flex-1 h-11 rounded-xl bg-teal-600 text-white font-bold text-sm">Xong · {visible.length.toLocaleString('vi-VN')} khách</button>
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

// ================= Console gọi & chăm sóc 1 khách =================
const CustomerConsole = ({ row, me, staff, teleStaff = [], canWrite, canAssign, appt, queuePos, onNext, onClose, onChanged, onDelete }) => {
  const [tab, setTab] = useState('call');   // 'call' | 'care' | 'info'
  const [acts, setActs] = useState([]);
  const [loadingActs, setLoadingActs] = useState(true);

  const loadActs = useCallback(async () => {
    setLoadingActs(true);
    const { data } = await supabase.from('marketing_activities')
      .select('*, author:profiles!created_by(full_name)').eq('data_id', row.id).order('created_at', { ascending: false });
    setActs(data || []); setLoadingActs(false);
  }, [row.id]);
  useEffect(() => { loadActs(); }, [loadActs]);

  const calls = acts.filter(a => a.type === 'call');
  const cares = acts.filter(a => a.type === 'care');

  // ----- Messenger: hội thoại fanpage khớp với khách này (theo data_id hoặc SĐT) -----
  const [fbMsgs, setFbMsgs] = useState(null);   // null = đang tải
  const loadFb = useCallback(async () => {
    try {
      const ors = [`data_id.eq.${row.id}`];
      if (row.phone) ors.push(`phone.eq.${row.phone}`);
      const { data: convs } = await supabase.from('fb_conversations').select('conv_key').or(ors.join(','));
      if (!convs?.length) { setFbMsgs([]); return; }
      const { data: msgs } = await supabase.from('fb_messages').select('*')
        .in('conv_key', convs.map(c => c.conv_key)).order('created_time', { ascending: true }).limit(500);
      setFbMsgs(msgs || []);
    } catch { setFbMsgs([]); }
  }, [row.id, row.phone]);
  useEffect(() => { loadFb(); }, [loadFb]);
  useRealtimeReload('fb_messages', loadFb);

  // ----- thông tin -----
  const [info, setInfo] = useState({
    customer_name: row.customer_name || '', description: row.description || '',
    reached_info: row.reached_info || '', truc_page_id: row.truc_page_id || '',
    telesale_id: row.telesale_id || '',
  });
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
    toast.success('Đã đổi trạng thái'); onChanged?.();
  };

  // ----- nhật ký gọi -----
  const [call, setCall] = useState({ outcome: 'nghe_may', content: '', next: '', status: row.status || 'tiep_can' });
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

  const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const st = APPT_STAGE(appt);
  const TABS = [{ k: 'call', label: 'Nhật ký gọi', icon: PhoneCall, n: calls.length }, { k: 'fb', label: 'Messenger', icon: MessageCircle, n: fbMsgs?.length ?? 0 }, { k: 'care', label: 'Chăm sóc', icon: HeartHandshake, n: cares.length }, { k: 'info', label: 'Thông tin', icon: Database }];

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[80] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl shadow-xl max-h-[94vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header khách */}
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b flex items-start gap-3 bg-white">
          <span className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white grid place-items-center text-sm font-bold shrink-0">{initials(row.customer_name)}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800 truncate">{row.customer_name || '(Chưa có tên)'}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-slate-500 tabular-nums">{row.phone}</span>
              <button onClick={() => { navigator.clipboard?.writeText(row.phone || ''); toast.success('Đã copy SĐT'); }} className="text-slate-400 hover:text-slate-600"><Copy className="w-3.5 h-3.5" /></button>
              {st && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${st.cls}`}><Link2 className="w-3 h-3" />{st.label}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <select value={row.status} onChange={e => changeStatus(e.target.value)} disabled={!canWrite} className="text-[12px] font-semibold rounded-lg border border-slate-200 px-2 py-1 bg-white outline-none disabled:opacity-60">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {row.next_call_at && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${isDue(row.next_call_at) ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-600'}`}><CalendarClock className="w-3 h-3" />{fmtDT(row.next_call_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {queuePos && <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap hidden sm:inline">{queuePos.i}/{queuePos.n}</span>}
            <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"><PhoneCall className="w-4 h-4" /><span className="hidden sm:inline">Gọi</span></a>
            <a href={zaloLink(row.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 h-9 rounded-xl border border-blue-200 text-blue-600 text-sm font-bold hover:bg-blue-50">Zalo</a>
            {onNext && <button onClick={onNext} className="inline-flex items-center gap-1 px-3 h-9 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 whitespace-nowrap">Tiếp <ChevronRight className="w-4 h-4" /></button>}
            <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 px-3 sm:px-4 pt-2 border-b bg-white">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition ${tab === t.k ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              <t.icon className="w-4 h-4" />{t.label}{t.n != null && <span className={`text-[10px] px-1.5 rounded-full ${tab === t.k ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'}`}>{t.n}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto">
          {/* ---- NHẬT KÝ GỌI ---- */}
          {tab === 'call' && (
            <div className="space-y-4">
              {canWrite && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2.5">
                  <div className="text-[13px] font-bold text-slate-600">Ghi cuộc gọi mới</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Kết quả gọi</label>
                      <select value={call.outcome} onChange={e => setCall({ ...call, outcome: e.target.value })} className={inp}>{Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                    <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Chuyển trạng thái</label>
                      <select value={call.status} onChange={e => setCall({ ...call, status: e.target.value })} className={inp}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  </div>
                  <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Nội dung trao đổi</label>
                    <textarea value={call.content} onChange={e => setCall({ ...call, content: e.target.value })} rows={2} placeholder="Khách quan tâm gì, báo giá, phản hồi…" className={inp} /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Hẹn gọi lại (nếu có)</label>
                    <input type="datetime-local" value={call.next} onChange={e => setCall({ ...call, next: e.target.value })} className={inp} /></div>
                  <button onClick={addCall} disabled={savingCall} className="w-full h-10 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"><Save className="w-4 h-4" />{savingCall ? 'Đang lưu…' : 'Lưu cuộc gọi'}</button>
                </div>
              )}
              <Timeline items={calls} loading={loadingActs} me={me} onDelete={delAct} kind="call" />
            </div>
          )}

          {/* ---- MESSENGER (hội thoại fanpage, realtime) ---- */}
          {tab === 'fb' && (
            <div className="space-y-1.5">
              {fbMsgs === null ? <div className="text-center py-8 text-slate-300 text-sm">Đang tải hội thoại…</div>
                : fbMsgs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-[13px] leading-relaxed">
                    Chưa có hội thoại Messenger nào khớp với khách này.<br />
                    <span className="text-slate-300 text-[12px]">Hệ thống tự ghép khi quét được SĐT khách trong nội dung chat của fanpage.</span>
                  </div>
                ) : (
                  fbMsgs.map(m => (
                    <div key={m.id} className={`flex ${m.is_page ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug break-words ${m.is_page ? 'bg-teal-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-700 rounded-bl-md'}`}>
                        {m.text || <i className="opacity-70">[hình ảnh / đính kèm]</i>}
                        <div className={`text-[9.5px] mt-1 ${m.is_page ? 'text-white/70' : 'text-slate-400'}`}>{m.is_page ? 'Page' : (m.from_name || 'Khách')} · {fmtDT(m.created_time)}</div>
                      </div>
                    </div>
                  ))
                )}
            </div>
          )}

          {/* ---- NHẬT KÝ CHĂM SÓC ---- */}
          {tab === 'care' && (
            <div className="space-y-4">
              {canWrite && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2.5">
                  <div className="text-[13px] font-bold text-slate-600">Ghi chăm sóc mới</div>
                  <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Nội dung chăm sóc</label>
                    <textarea value={care.content} onChange={e => setCare({ ...care, content: e.target.value })} rows={3} placeholder="Nhắn tin hỏi thăm, gửi ưu đãi, tư vấn thêm…" className={inp} /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Hẹn chăm sóc tiếp (nếu có)</label>
                    <input type="datetime-local" value={care.next} onChange={e => setCare({ ...care, next: e.target.value })} className={inp} /></div>
                  <button onClick={addCare} disabled={savingCare} className="w-full h-10 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"><Save className="w-4 h-4" />{savingCare ? 'Đang lưu…' : 'Lưu chăm sóc'}</button>
                </div>
              )}
              <Timeline items={cares} loading={loadingActs} me={me} onDelete={delAct} kind="care" />
            </div>
          )}

          {/* ---- THÔNG TIN ---- */}
          {tab === 'info' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Tên khách hàng"><input value={info.customer_name} onChange={e => setInfo({ ...info, customer_name: e.target.value })} disabled={!canWrite} className={inp} /></Field>
                <Field label="Telesale phụ trách"><select value={info.telesale_id} onChange={e => setInfo({ ...info, telesale_id: e.target.value })} disabled={!canAssign} className={inp}><option value="">— Chưa phân công —</option>{teleStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
                <Field label="Trực page phụ trách"><select value={info.truc_page_id} onChange={e => setInfo({ ...info, truc_page_id: e.target.value })} disabled={!canWrite} className={inp}><option value="">— Chọn —</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
              </div>
              <Field label="Mô tả / nhu cầu"><textarea value={info.description} onChange={e => setInfo({ ...info, description: e.target.value })} disabled={!canWrite} rows={2} className={inp} /></Field>
              <Field label="Thông tin đã tiếp cận"><textarea value={info.reached_info} onChange={e => setInfo({ ...info, reached_info: e.target.value })} disabled={!canWrite} rows={3} className={inp} /></Field>
              {/* Thông tin đồng bộ từ GetFly (chỉ xem) */}
              {(row.getfly_id || row.source || row.customer_group || row.manager_name) && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="text-[12px] font-bold text-indigo-700 mb-2">Thông tin GetFly (tự đồng bộ)</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
                    {row.customer_group && <div><span className="text-slate-400">Nhóm KH:</span> <b className="text-slate-700">{row.customer_group}</b></div>}
                    {row.source && <div><span className="text-slate-400">Nguồn:</span> <b className="text-slate-700">{row.source}</b></div>}
                    {row.manager_name && <div><span className="text-slate-400">Phụ trách:</span> <b className="text-slate-700">{row.manager_name}</b></div>}
                    {row.relation_name && <div><span className="text-slate-400">Mối quan hệ:</span> <b className="text-slate-700">{row.relation_name}</b></div>}
                    {row.email && <div className="col-span-2 truncate"><span className="text-slate-400">Email:</span> <b className="text-slate-700">{row.email}</b></div>}
                    {row.gender && <div><span className="text-slate-400">Giới tính:</span> <b className="text-slate-700">{row.gender}</b></div>}
                    {row.birthday && <div><span className="text-slate-400">Sinh nhật:</span> <b className="text-slate-700">{row.birthday}</b></div>}
                    {row.address && <div className="col-span-2 truncate"><span className="text-slate-400">Địa chỉ:</span> <b className="text-slate-700">{row.address}</b></div>}
                    {row.website && <div className="col-span-2 truncate"><span className="text-slate-400">Website:</span> <b className="text-slate-700">{row.website}</b></div>}
                    {Number(row.total_revenue) > 0 && <div><span className="text-slate-400">Doanh thu:</span> <b className="text-teal-700">{Number(row.total_revenue).toLocaleString('vi-VN')}đ</b></div>}
                    {row.getfly_code && <div><span className="text-slate-400">Mã KH:</span> <b className="text-slate-700">{row.getfly_code}</b></div>}
                    {row.getfly_synced_at && <div className="col-span-2 text-[11px] text-slate-400">Đồng bộ GetFly lúc {fmtDT(row.getfly_synced_at)}</div>}
                  </div>
                </div>
              )}
              {canWrite && (
                <div className="flex justify-between items-center">
                  <button onClick={onDelete} className="text-sm font-semibold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" />Xoá khách</button>
                  <button onClick={saveInfo} disabled={savingInfo} className="px-5 h-10 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 disabled:opacity-60 inline-flex items-center gap-1.5"><Save className="w-4 h-4" />{savingInfo ? 'Đang lưu…' : 'Lưu thông tin'}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
  const bySourceData = Object.entries(srcMap).map(([k, v], i) => ({ label: k, value: v, color: ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'][i % 6] })).sort((a, b) => b.value - a.value);

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
      ['Mới đã gọi', p.stats.new_called, '#0d9488'], ['Mới chưa gọi', p.stats.new_not_called, '#e11d48'],
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

export default MarketingDataPage;
