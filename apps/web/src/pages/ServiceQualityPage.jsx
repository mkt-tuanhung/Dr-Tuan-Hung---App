import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  Star, Smile, TrendingUp, AlertTriangle, ShieldAlert, PhoneCall, Users,
  Search, X, MessageSquare, ChevronRight, Loader2, Award, ThumbsUp,
  Ticket, Clock, CheckCircle2, UserPlus, Send, RefreshCw, Copy, Megaphone,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { QUESTIONS, STAFF_ROLE_LABELS, RATING_LABELS, npsGroup, SENTIMENT_STYLE } from '@/lib/serviceReviewQuestions';

const SENTIMENTS = ['rất tích cực', 'tích cực', 'trung lập', 'tiêu cực', 'rất tiêu cực'];

const PERIODS = [
  { key: '30', label: '30 ngày', days: 30 },
  { key: '90', label: '90 ngày', days: 90 },
  { key: '365', label: '12 tháng', days: 365 },
  { key: 'all', label: 'Tất cả', days: null },
];
const FRAUD = ['suspect', 'high'];
const MIN_SAMPLE = 3;   // số mẫu tối thiểu để xếp hạng nhân sự (PRD §24)
const fmt1 = (n) => (n == null ? '—' : Number(n).toFixed(1));
const dstr = (d) => new Date(d).toLocaleDateString('vi-VN');
const dtstr = (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Vòng xử lý phản hồi (PRD §9)
const TICKET_STATUS = {
  new: 'Mới tiếp nhận', in_progress: 'Đang xử lý', contacting: 'Đang liên hệ',
  resolved: 'Đã xử lý', closed: 'Hoàn thành', no_contact: 'Không liên hệ được', escalated: 'Chuyển cấp quản lý',
};
const OPEN_STATUSES = ['new', 'in_progress', 'contacting', 'escalated'];
const STATUS_STYLE = {
  new: 'bg-rose-100 text-rose-700', in_progress: 'bg-amber-100 text-amber-700', contacting: 'bg-blue-100 text-blue-700',
  resolved: 'bg-teal-100 text-teal-700', closed: 'bg-slate-200 text-slate-600', no_contact: 'bg-slate-100 text-slate-500', escalated: 'bg-purple-100 text-purple-700',
};
const PRIORITY = {
  urgent: { label: 'Khẩn', c: 'bg-rose-500 text-white' }, high: { label: 'Cao', c: 'bg-orange-100 text-orange-700' },
  normal: { label: 'Thường', c: 'bg-slate-100 text-slate-600' }, low: { label: 'Thấp', c: 'bg-slate-100 text-slate-500' },
};
const isOverdue = (t) => OPEN_STATUSES.includes(t.status) && t.sla_due_at && new Date(t.sla_due_at) < new Date();

export default function ServiceQualityPage() {
  const { profile } = useAuth();
  const [invs, setInvs] = useState([]);
  const [resps, setResps] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('90');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('overview'); // overview | staff | responses | tickets
  const [detail, setDetail] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [onlyNegative, setOnlyNegative] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('open'); // open | all
  const [resurveyQR, setResurveyQR] = useState(null); // { url, dataUrl, name }

  const load = useCallback(async () => {
    const [{ data: iv }, { data: rp }, { data: tk }, { data: st }] = await Promise.all([
      supabase.from('service_review_invitations').select('id, status, created_at, milestone').order('created_at', { ascending: false }).limit(5000),
      supabase.from('service_review_responses')
        .select('id, overall_score, csat_score, nps_score, staff_ratings, answers, selected_topics, wants_contact, comment, risk_level, fraud_status, fraud_score, verification_level, sentiment, submitted_at, invitation:service_review_invitations(customer_name, service, surgery_date, milestone, ticket_id, is_resurvey)')
        .order('submitted_at', { ascending: false }).limit(5000),
      supabase.from('service_review_tickets')
        .select('*, response:service_review_responses(comment, selected_topics, staff_ratings, invitation:service_review_invitations(service, phone))')
        .order('created_at', { ascending: false }).limit(3000),
      supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    ]);
    setInvs(iv || []); setResps(rp || []); setTickets(tk || []); setStaffList(st || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('service_review_responses', load);
  useRealtimeReload('service_review_tickets', load);

  const staffMap = useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s.full_name])), [staffList]);

  // Cập nhật ticket + ghi nhật ký
  const updateTicket = async (id, patch, note) => {
    const body = { ...patch, updated_at: new Date().toISOString() };
    if (patch.status === 'resolved') body.resolved_at = new Date().toISOString();
    if (patch.status === 'closed') body.closed_at = new Date().toISOString();
    const { error } = await supabase.from('service_review_tickets').update(body).eq('id', id);
    if (error) { toast.error('Lỗi cập nhật: ' + error.message); return false; }
    if (note && note.trim()) {
      await supabase.from('service_review_ticket_activities').insert({ ticket_id: id, activity_type: 'note', content: note.trim(), created_by: profile?.id || null });
    }
    await load();
    return true;
  };

  // Tạo phiếu khảo sát lại sau khi xử lý (PRD §10) → QR gửi khách
  const createResurveyQR = async (ticket) => {
    const { data: tk, error } = await supabase.rpc('create_resurvey', { p_ticket_id: ticket.id, p_created_by: profile?.id || null });
    if (error || !tk) { toast.error('Lỗi tạo phiếu khảo sát lại: ' + (error?.message || '')); return; }
    const url = `${window.location.origin}/danh-gia/${tk}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
    setResurveyQR({ url, dataUrl, name: ticket.customer_name });
  };
  const copyResurvey = () => { if (resurveyQR) navigator.clipboard?.writeText(resurveyQR.url).then(() => toast.success('Đã sao chép link!'), () => {}); };

  const since = useMemo(() => {
    const p = PERIODS.find(x => x.key === period);
    if (!p?.days) return null;
    const d = new Date(); d.setDate(d.getDate() - p.days); return d;
  }, [period]);

  const inPeriod = (t) => !since || new Date(t) >= since;
  const periodResps = useMemo(() => resps.filter(r => inPeriod(r.submitted_at)), [resps, since]);
  const periodInvs = useMemo(() => invs.filter(i => inPeriod(i.created_at)), [invs, since]);
  const periodTickets = useMemo(() => tickets.filter(t => inPeriod(t.created_at)), [tickets, since]);
  const openTickets = useMemo(() => periodTickets.filter(t => OPEN_STATUSES.includes(t.status)), [periodTickets]);
  const overdueTickets = useMemo(() => periodTickets.filter(isOverdue), [periodTickets]);
  // KPI chính thức: loại phản hồi nghi ngờ gian lận (PRD §13, §24) + loại phiếu khảo sát lại
  const valid = useMemo(() => periodResps.filter(r => !FRAUD.includes(r.fraud_status) && !r.invitation?.is_resurvey), [periodResps]);
  // Phản hồi khảo sát lại (đo hiệu quả xử lý — PRD §10)
  const resurveyResps = useMemo(() => periodResps.filter(r => r.invitation?.is_resurvey), [periodResps]);

  // ---- Chỉ số tổng ----
  const stats = useMemo(() => {
    const csv = valid.filter(r => r.csat_score != null);
    const csat = csv.length ? csv.reduce((s, r) => s + Number(r.csat_score), 0) / csv.length : null;
    const npsRows = valid.filter(r => r.nps_score != null);
    let prom = 0, det = 0;
    npsRows.forEach(r => { const g = npsGroup(r.nps_score); if (g === 'promoter') prom++; else if (g === 'detractor') det++; });
    const nps = npsRows.length ? Math.round(((prom - det) / npsRows.length) * 100) : null;
    const negative = valid.filter(r => r.overall_score != null && r.overall_score <= 2).length;
    const wantContact = periodResps.filter(r => r.wants_contact && r.wants_contact !== 'none').length;
    const suspect = periodResps.filter(r => FRAUD.includes(r.fraud_status)).length;
    const completed = periodInvs.filter(i => i.status === 'completed').length;
    const completeRate = periodInvs.length ? Math.round((completed / periodInvs.length) * 100) : 0;
    return { csat, nps, negative, wantContact, suspect, completed, completeRate, total: periodInvs.length, respCount: valid.length };
  }, [valid, periodResps, periodInvs]);

  // ---- Tiếng nói khách hàng (Voice of Customer) ----
  const voc = useMemo(() => {
    const sentiment = SENTIMENTS.map(s => ({ s, n: valid.filter(r => r.sentiment === s).length }));
    const closed = periodTickets.filter(t => ['resolved', 'closed'].includes(t.status));
    const onTime = closed.filter(t => t.closed_at && t.sla_due_at && new Date(t.closed_at) <= new Date(t.sla_due_at)).length;
    const onTimeRate = closed.length ? Math.round((onTime / closed.length) * 100) : null;
    const rc = resurveyResps.length;
    const sat = rc ? resurveyResps.reduce((s, r) => s + Number(r.overall_score || 0), 0) / rc : null;
    const resolved = resurveyResps.filter(r => (r.answers?.rs_resolved || '') === 'Đã giải quyết').length;
    const resolvedRate = rc ? Math.round((resolved / rc) * 100) : null;
    return { sentiment, closedCount: closed.length, onTimeRate, resurveyCount: rc, satAfter: sat, resolvedRate };
  }, [valid, periodTickets, resurveyResps]);

  // ---- Điểm trung bình từng nhân sự (giám sát) ----
  const staffScores = useMemo(() => {
    const map = new Map();
    valid.forEach(r => (r.staff_ratings || []).forEach(sr => {
      if (!sr.staff_id) return;
      const cur = map.get(sr.staff_id) || { id: sr.staff_id, name: sr.name, role: sr.role, sum: 0, cnt: 0 };
      cur.sum += Number(sr.score || 0); cur.cnt += 1; cur.name = sr.name || cur.name;
      map.set(sr.staff_id, cur);
    }));
    return [...map.values()].map(s => ({ ...s, avg: s.cnt ? s.sum / s.cnt : 0 }))
      .sort((a, b) => (b.cnt >= MIN_SAMPLE ? b.avg : -1) - (a.cnt >= MIN_SAMPLE ? a.avg : -1));
  }, [valid]);

  // ---- Điểm theo từng câu (heatmap điểm chạm) ----
  const perQuestion = useMemo(() => {
    return QUESTIONS.filter(qq => qq.type === 'rating5').map(qq => {
      const vals = valid.map(r => Number(r.answers?.[qq.code])).filter(v => v >= 1 && v <= 5);
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      return { code: qq.code, title: qq.title, avg, n: vals.length };
    });
  }, [valid]);

  // ---- Top chủ đề / vấn đề ----
  const topTopics = useMemo(() => {
    const m = {};
    valid.forEach(r => (r.selected_topics || []).forEach(t => { m[t] = (m[t] || 0) + 1; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [valid]);

  // ---- Xu hướng CSAT theo tuần ----
  const trend = useMemo(() => {
    const buckets = {};
    valid.forEach(r => {
      if (r.csat_score == null) return;
      const d = new Date(r.submitted_at); const day = d.getDay(); const monday = new Date(d); monday.setDate(d.getDate() - ((day + 6) % 7));
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      (buckets[key] = buckets[key] || []).push(Number(r.csat_score));
    });
    return Object.entries(buckets).sort().slice(-12).map(([k, arr]) => ({
      week: k.slice(5), csat: Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)),
    }));
  }, [valid]);

  const ql = q.trim().toLowerCase();
  const listResps = useMemo(() => periodResps.filter(r =>
    (!onlyNegative || (r.overall_score != null && r.overall_score <= 2)) &&
    (!ql || (r.invitation?.customer_name || '').toLowerCase().includes(ql) || (r.comment || '').toLowerCase().includes(ql))
  ), [periodResps, ql, onlyNegative]);

  // Danh sách ticket: ưu tiên quá hạn → độ ưu tiên → hạn SLA
  const listTickets = useMemo(() => {
    const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
    return periodTickets
      .filter(t => ticketFilter === 'all' || OPEN_STATUSES.includes(t.status))
      .filter(t => !ql || (t.customer_name || '').toLowerCase().includes(ql))
      .slice()
      .sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ap = rank[a.priority] ?? 2, bp = rank[b.priority] ?? 2;
        if (ap !== bp) return ap - bp;
        return new Date(a.sla_due_at || a.created_at) - new Date(b.sla_due_at || b.created_at);
      });
  }, [periodTickets, ticketFilter, ql]);

  const StatCard = ({ icon: Icon, label, value, sub, tone }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`w-8 h-8 rounded-lg grid place-items-center ${tone}`}><Icon className="w-4 h-4" /></span>
      </div>
      <div className="text-2xl font-bold text-slate-800 mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-600 grid place-items-center shrink-0"><Smile className="w-6 h-6" /></span>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Đánh giá dịch vụ</h2>
            <p className="text-slate-400 text-sm">Giám sát chất lượng nhân sự &amp; dịch vụ từ phản hồi khách hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${period === p.key ? 'bg-teal-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['overview', 'Tổng quan'], ['staff', 'Nhân sự'], ['responses', 'Phản hồi'], ['tickets', 'Xử lý phản hồi']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition relative ${tab === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            {l}
            {k === 'tickets' && openTickets.length > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold align-middle">{openTickets.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center"><Loader2 className="w-7 h-7 text-teal-500 animate-spin" /></div>
      ) : (
        <>
          {/* ---------------- TỔNG QUAN ---------------- */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Smile} label="CSAT (TB 1–5)" value={fmt1(stats.csat)} sub={`${stats.respCount} phản hồi hợp lệ`} tone="bg-teal-50 text-teal-600" />
                <StatCard icon={ThumbsUp} label="NPS" value={stats.nps == null ? '—' : stats.nps} sub="−100 … +100" tone="bg-emerald-50 text-emerald-600" />
                <StatCard icon={TrendingUp} label="Tỷ lệ hoàn thành" value={`${stats.completeRate}%`} sub={`${stats.completed}/${stats.total} phiếu`} tone="bg-blue-50 text-blue-600" />
                <StatCard icon={AlertTriangle} label="Phản hồi tiêu cực" value={stats.negative} sub="điểm tổng thể 1–2" tone="bg-rose-50 text-rose-600" />
                <StatCard icon={Ticket} label="Ticket đang mở" value={openTickets.length} sub="cần xử lý" tone="bg-indigo-50 text-indigo-600" />
                <StatCard icon={Clock} label="Quá hạn SLA" value={overdueTickets.length} sub="xử lý gấp" tone="bg-rose-50 text-rose-600" />
                <StatCard icon={PhoneCall} label="Yêu cầu liên hệ" value={stats.wantContact} sub="khách muốn hỗ trợ" tone="bg-amber-50 text-amber-600" />
                <StatCard icon={ShieldAlert} label="Nghi ngờ gian lận" value={stats.suspect} sub="đã loại khỏi KPI" tone="bg-purple-50 text-purple-600" />
              </div>

              {/* Xu hướng CSAT */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 mb-1">Xu hướng CSAT theo tuần</h3>
                {trend.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Chưa đủ dữ liệu.</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      <Line type="monotone" dataKey="csat" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3, fill: '#14b8a6' }} name="CSAT" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Heatmap điểm chạm + Top vấn đề */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="font-bold text-slate-800 mb-3">Điểm theo từng điểm chạm</h3>
                  <div className="space-y-2.5">
                    {perQuestion.map(pq => {
                      const pct = pq.avg ? (pq.avg / 5) * 100 : 0;
                      const color = pq.avg >= 4 ? 'bg-emerald-500' : pq.avg >= 3 ? 'bg-amber-500' : 'bg-rose-500';
                      return (
                        <div key={pq.code}>
                          <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{pq.title}</span><span className="font-bold text-slate-700 tabular-nums">{fmt1(pq.avg)} <span className="text-slate-300 font-normal">({pq.n})</span></span></div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="font-bold text-slate-800 mb-3">Chủ đề khách nhắc nhiều</h3>
                  {topTopics.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Chưa có dữ liệu.</p> : (
                    <div className="space-y-2">
                      {topTopics.map(([t, c]) => (
                        <div key={t} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 flex-1">{t}</span>
                          <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-400 rounded-full" style={{ width: `${(c / topTopics[0][1]) * 100}%` }} /></div>
                          <span className="text-xs font-bold text-slate-500 w-6 text-right tabular-nums">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tiếng nói khách hàng */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3"><Megaphone className="w-5 h-5 text-violet-500" /><h3 className="font-bold text-slate-800">Cảm xúc khách hàng</h3></div>
                  <div className="space-y-2">
                    {voc.sentiment.map(({ s, n }) => {
                      const total = voc.sentiment.reduce((x, y) => x + y.n, 0) || 1;
                      return (
                        <div key={s} className="flex items-center gap-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-24 text-center ${SENTIMENT_STYLE[s]}`}>{s}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${s.includes('tiêu cực') ? 'bg-rose-400' : s === 'trung lập' ? 'bg-slate-300' : 'bg-emerald-400'}`} style={{ width: `${(n / total) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-500 w-6 text-right tabular-nums">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3"><RefreshCw className="w-5 h-5 text-teal-500" /><h3 className="font-bold text-slate-800">Hiệu quả xử lý phản hồi</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{voc.closedCount}</div><div className="text-[11px] text-slate-400">Ticket đã xử lý</div></div>
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{voc.onTimeRate == null ? '—' : voc.onTimeRate + '%'}</div><div className="text-[11px] text-slate-400">Đúng hạn SLA</div></div>
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{voc.resolvedRate == null ? '—' : voc.resolvedRate + '%'}</div><div className="text-[11px] text-slate-400">Khách xác nhận đã giải quyết</div></div>
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{fmt1(voc.satAfter)}</div><div className="text-[11px] text-slate-400">Hài lòng sau xử lý ({voc.resurveyCount})</div></div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3">Số liệu từ phiếu <b>khảo sát lại</b> gửi khách sau khi đóng ticket.</p>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- NHÂN SỰ ---------------- */}
          {tab === 'staff' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1"><Award className="w-5 h-5 text-amber-500" /><h3 className="font-bold text-slate-800">Điểm trung bình theo nhân sự</h3></div>
              <p className="text-xs text-slate-400 mb-4">Chỉ tính phản hồi hợp lệ. Cần tối thiểu {MIN_SAMPLE} lượt để xếp hạng công bằng (PRD §24).</p>
              {staffScores.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Chưa có dữ liệu đánh giá nhân sự.</p> : (
                <div className="space-y-2">
                  {staffScores.map((s, i) => {
                    const enough = s.cnt >= MIN_SAMPLE;
                    const tone = !enough ? 'text-slate-400' : s.avg >= 4 ? 'text-emerald-600' : s.avg >= 3 ? 'text-amber-600' : 'text-rose-600';
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50">
                        <span className={`w-7 text-center font-bold ${i < 3 && enough ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white grid place-items-center text-xs font-bold shrink-0">{(s.name || '?').trim().split(/\s+/).slice(-1)[0][0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-700 text-sm truncate">{s.name}</div>
                          <div className="text-xs text-slate-400">{STAFF_ROLE_LABELS[s.role] || s.role} · {s.cnt} lượt {!enough && <span className="text-amber-500">· chưa đủ mẫu</span>}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className={`w-4 h-4 ${enough ? 'fill-current' : ''} ${tone}`} />
                          <span className={`font-bold tabular-nums ${tone}`}>{fmt1(s.avg)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- PHẢN HỒI ---------------- */}
          {tab === 'responses' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên khách / nội dung…" className="w-full pl-10 pr-3 h-11 rounded-2xl bg-white border border-slate-200 text-sm outline-none focus:border-teal-400" />
                </div>
                <button onClick={() => setOnlyNegative(v => !v)} className={`px-4 h-11 rounded-2xl text-sm font-semibold border transition ${onlyNegative ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200'}`}>Chỉ tiêu cực</button>
              </div>
              {listResps.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">Chưa có phản hồi phù hợp.</div>
              ) : listResps.map(r => (
                <button key={r.id} onClick={() => setDetail(r)} className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 hover:border-teal-300 transition">
                  <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 font-bold ${r.overall_score <= 2 ? 'bg-rose-50 text-rose-600' : r.overall_score === 3 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <div className="flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" />{r.overall_score ?? '—'}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 truncate">{r.invitation?.customer_name || 'Khách'}</span>
                      {FRAUD.includes(r.fraud_status) && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">nghi ngờ</span>}
                      {r.wants_contact && r.wants_contact !== 'none' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">cần liên hệ</span>}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{r.invitation?.service || '—'} · {dstr(r.submitted_at)}</div>
                    {r.comment && <div className="text-xs text-slate-500 truncate mt-0.5 italic">“{r.comment}”</div>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ---------------- XỬ LÝ PHẢN HỒI (TICKETS) ---------------- */}
          {tab === 'tickets' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên khách…" className="w-full pl-10 pr-3 h-11 rounded-2xl bg-white border border-slate-200 text-sm outline-none focus:border-teal-400" />
                </div>
                <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
                  {[['open', 'Đang mở'], ['all', 'Tất cả']].map(([k, l]) => (
                    <button key={k} onClick={() => setTicketFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${ticketFilter === k ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-xs text-teal-700 flex items-start gap-2">
                <Ticket className="w-4 h-4 shrink-0 mt-0.5" /> Phản hồi điểm thấp (1–2) hoặc khách yêu cầu liên hệ sẽ <b>tự động tạo ticket</b> để giao xử lý. Xử lý xong nhớ ghi nguyên nhân & cách khắc phục rồi đóng ticket.
              </div>

              {listTickets.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">{ticketFilter === 'open' ? 'Không có ticket nào đang mở. 🎉' : 'Chưa có ticket nào.'}</div>
              ) : listTickets.map(t => {
                const overdue = isOverdue(t);
                return (
                  <button key={t.id} onClick={() => setTicketDetail(t)} className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 transition hover:border-teal-300 ${overdue ? 'border-rose-300' : 'border-slate-200'}`}>
                    <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 font-bold ${t.overall_score <= 2 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                      <div className="flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" />{t.overall_score ?? '!'}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 truncate">{t.customer_name || 'Khách'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${PRIORITY[t.priority]?.c || PRIORITY.normal.c}`}>{PRIORITY[t.priority]?.label || t.priority}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLE[t.status]}`}>{TICKET_STATUS[t.status] || t.status}</span>
                        {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-rose-500 text-white">Quá hạn</span>}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{t.category ? `${t.category} · ` : ''}{t.response?.comment ? `“${t.response.comment}”` : t.response?.invitation?.service || '—'}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {t.assigned_to ? <>Giao: <b className="text-slate-600">{staffMap[t.assigned_to] || '—'}</b> · </> : <span className="text-rose-500 font-semibold">Chưa giao · </span>}
                        Hạn: {t.sla_due_at ? dtstr(t.sla_due_at) : '—'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Chi tiết & xử lý ticket */}
      {ticketDetail && (
        <TicketDetailModal ticket={ticketDetail} staffList={staffList} onClose={() => setTicketDetail(null)} onSave={updateTicket}
          onResurvey={() => createResurveyQR(ticketDetail)}
          resurveyResp={resurveyResps.find(r => r.invitation?.ticket_id === ticketDetail.id)} />
      )}

      {/* QR phiếu khảo sát lại */}
      {resurveyQR && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setResurveyQR(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-teal-500 to-emerald-500 px-6 pt-6 pb-8 text-center relative">
              <button onClick={() => setResurveyQR(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:bg-white/20"><X className="w-4 h-4" /></button>
              <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center mx-auto mb-2"><RefreshCw className="w-6 h-6 text-white" /></div>
              <h3 className="font-bold text-white text-lg">Phiếu khảo sát lại</h3>
              <p className="text-teal-50 text-sm mt-0.5">{resurveyQR.name}</p>
            </div>
            <div className="px-6 -mt-5">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 flex flex-col items-center">
                <img src={resurveyQR.dataUrl} alt="QR khảo sát lại" className="w-56 h-56" />
                <p className="text-xs text-slate-400 mt-2 text-center">Gửi khách quét để xác nhận đã hài lòng sau xử lý</p>
              </div>
            </div>
            <div className="p-6 pt-4">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <span className="text-xs text-slate-500 truncate flex-1">{resurveyQR.url}</span>
                <button onClick={copyResurvey} className="shrink-0 text-teal-600 hover:text-teal-700 flex items-center gap-1 text-sm font-semibold"><Copy className="w-4 h-4" /> Sao chép</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chi tiết phản hồi */}
      {detail && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">{detail.invitation?.customer_name || 'Khách'}</h3>
                <p className="text-xs text-slate-400">{detail.invitation?.service || '—'} · {dstr(detail.submitted_at)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{detail.overall_score ?? '—'}</div><div className="text-[11px] text-slate-400">Tổng thể</div></div>
                <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{fmt1(detail.csat_score)}</div><div className="text-[11px] text-slate-400">CSAT</div></div>
                <div className="bg-slate-50 rounded-xl p-3"><div className="text-2xl font-bold text-slate-800">{detail.nps_score ?? '—'}</div><div className="text-[11px] text-slate-400">NPS</div></div>
              </div>

              {/* Điểm từng câu */}
              <div className="space-y-1.5">
                {QUESTIONS.filter(qq => qq.type === 'rating5').map(qq => {
                  const v = detail.answers?.[qq.code];
                  if (v == null) return null;
                  return <div key={qq.code} className="flex justify-between text-sm"><span className="text-slate-500">{qq.title}</span><span className="font-semibold text-slate-700">{v === 'na' ? 'Không áp dụng' : `${v}/5 · ${RATING_LABELS[v] || ''}`}</span></div>;
                })}
              </div>

              {/* Nhân sự */}
              {(detail.staff_ratings || []).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1.5">Đánh giá nhân sự</div>
                  <div className="space-y-1">
                    {detail.staff_ratings.map((sr, i) => (
                      <div key={i} className="flex justify-between text-sm"><span className="text-slate-600">{sr.name} <span className="text-slate-400">({STAFF_ROLE_LABELS[sr.role] || sr.role})</span></span><span className="font-bold text-teal-600 flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" />{sr.score}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {(detail.selected_topics || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.selected_topics.map(t => <span key={t} className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full">{t}</span>)}
                </div>
              )}

              {detail.sentiment && (
                <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">Cảm xúc:</span><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SENTIMENT_STYLE[detail.sentiment] || 'bg-slate-100 text-slate-600'}`}>{detail.sentiment}</span></div>
              )}

              {detail.comment && (
                <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-700 flex gap-2"><MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /><span className="italic">{detail.comment}</span></div>
              )}

              {detail.wants_contact && detail.wants_contact !== 'none' && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 font-medium flex items-center gap-2"><PhoneCall className="w-4 h-4" /> Khách muốn được liên hệ {detail.wants_contact === 'urgent' ? 'sớm nhất' : 'trong giờ hành chính'}</div>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t">
                <ShieldAlert className="w-3.5 h-3.5" /> Mức xác thực L{detail.verification_level} · Điểm rủi ro {detail.fraud_score}/100 · {FRAUD.includes(detail.fraud_status) ? <span className="text-purple-600 font-semibold">nghi ngờ gian lận</span> : 'hợp lệ'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Chi tiết & xử lý một ticket phản hồi ============
function TicketDetailModal({ ticket, staffList, onClose, onSave, onResurvey, resurveyResp }) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || '');
  const [rootCause, setRootCause] = useState(ticket.root_cause || '');
  const [resolution, setResolution] = useState(ticket.resolution || '');
  const [note, setNote] = useState('');
  const [activities, setActivities] = useState([]);
  const [saving, setSaving] = useState(false);
  const staffMap = useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s.full_name])), [staffList]);
  const resp = ticket.response || {};
  const overdue = isOverdue(ticket);

  useEffect(() => {
    supabase.from('service_review_ticket_activities').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true })
      .then(({ data }) => setActivities(data || []));
  }, [ticket.id]);

  const save = async (closing) => {
    if (closing && !resolution.trim()) { toast.error('Nhập cách khắc phục trước khi đóng ticket.'); return; }
    setSaving(true);
    const patch = {
      status: closing ? 'closed' : status,
      priority,
      assigned_to: assignedTo || null,
      root_cause: rootCause || null,
      resolution: resolution || null,
    };
    const ok = await onSave(ticket.id, patch, note);
    setSaving(false);
    if (ok) { toast.success(closing ? 'Đã đóng ticket.' : 'Đã cập nhật.'); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 truncate">{ticket.customer_name || 'Khách'}</h3>
            <p className="text-xs text-slate-400">{resp.invitation?.service || '—'}{resp.invitation?.phone ? ` · ${resp.invitation.phone}` : ''}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Tóm tắt phản hồi */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${PRIORITY[ticket.priority]?.c || PRIORITY.normal.c}`}>Ưu tiên: {PRIORITY[ticket.priority]?.label}</span>
            <span className="text-xs px-2 py-1 rounded-full font-semibold bg-slate-100 text-slate-600">Điểm: {ticket.overall_score ?? '—'}/5</span>
            {ticket.wants_contact && ticket.wants_contact !== 'none' && <span className="text-xs px-2 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">Muốn liên hệ {ticket.wants_contact === 'urgent' ? 'gấp' : 'giờ HC'}</span>}
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${overdue ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`}>Hạn: {ticket.sla_due_at ? dtstr(ticket.sla_due_at) : '—'}</span>
          </div>
          {resp.comment && <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-700 italic flex gap-2"><MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />“{resp.comment}”</div>}
          {(resp.selected_topics || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">{resp.selected_topics.map(t => <span key={t} className="text-xs bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full">{t}</span>)}</div>
          )}

          {/* Giao việc + trạng thái + ưu tiên */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-xs font-semibold text-slate-500">Giao cho</span>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="mt-1 w-full h-10 px-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-400">
                <option value="">— Chưa giao —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-slate-500">Trạng thái</span>
              <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full h-10 px-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-400">
                {Object.entries(TICKET_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm col-span-2">
              <span className="text-xs font-semibold text-slate-500">Độ ưu tiên</span>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="mt-1 w-full h-10 px-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-400">
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          </div>

          {/* Nguyên nhân & khắc phục */}
          <label className="block text-sm">
            <span className="text-xs font-semibold text-slate-500">Nguyên nhân gốc</span>
            <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} rows={2} placeholder="Vì sao khách chưa hài lòng?" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-teal-400 resize-none" />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold text-slate-500">Cách khắc phục <span className="text-slate-300">(bắt buộc khi đóng)</span></span>
            <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2} placeholder="Đã làm gì để khắc phục / hỗ trợ khách?" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-teal-400 resize-none" />
          </label>

          {/* Nhật ký xử lý */}
          {activities.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase mb-1.5">Nhật ký xử lý</div>
              <div className="space-y-2">
                {activities.map(a => (
                  <div key={a.id} className="text-sm bg-slate-50 rounded-xl p-2.5">
                    <div className="text-slate-700">{a.content}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{staffMap[a.created_by] || 'Hệ thống'} · {dtstr(a.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <label className="block text-sm">
            <span className="text-xs font-semibold text-slate-500">Ghi chú xử lý (thêm vào nhật ký)</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ví dụ: Đã gọi khách lúc 15h, khách đồng ý tái khám…" className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-teal-400 resize-none" />
          </label>

          {/* Khảo sát lại sau xử lý (PRD §10) */}
          <div className="border border-teal-100 bg-teal-50/50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1"><RefreshCw className="w-4 h-4 text-teal-600" /><span className="text-sm font-bold text-teal-700">Khảo sát lại sau xử lý</span></div>
            {resurveyResp ? (
              <div className="text-sm text-slate-700">
                Khách đã phản hồi: <b>{resurveyResp.answers?.rs_resolved || '—'}</b> · hài lòng <b>{resurveyResp.overall_score ?? '—'}/5</b>
                {resurveyResp.answers?.rs_need === 'Vẫn cần được hỗ trợ' && <span className="text-rose-600 font-semibold"> · vẫn cần hỗ trợ</span>}
                {resurveyResp.comment && <div className="text-xs text-slate-500 italic mt-1">“{resurveyResp.comment}”</div>}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-2">Sau khi liên hệ & khắc phục, tạo phiếu ngắn để khách xác nhận đã hài lòng chưa (tránh đóng ticket khi khách còn chưa ưng).</p>
                <button type="button" onClick={onResurvey} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 px-3.5 py-1.5 rounded-lg"><RefreshCw className="w-4 h-4" /> Tạo phiếu khảo sát lại</button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex items-center gap-2">
          <button onClick={() => save(false)} disabled={saving} className="flex-1 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Lưu cập nhật
          </button>
          {ticket.status !== 'closed' && (
            <button onClick={() => save(true)} disabled={saving} className="py-2.5 px-4 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Đóng ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
