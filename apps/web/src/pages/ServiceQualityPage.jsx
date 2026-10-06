import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  Star, Smile, TrendingUp, AlertTriangle, ShieldAlert, PhoneCall, Users,
  Search, X, MessageSquare, ChevronRight, Loader2, Award, ThumbsUp,
  Ticket, Clock, CheckCircle2, UserPlus, Send, RefreshCw, Copy, Megaphone, Sparkles,
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
  new: 'bg-danger-50 text-danger-600', in_progress: 'bg-warning-50 text-warning-600', contacting: 'bg-info-50 text-info-600',
  resolved: 'bg-success-50 text-success-600', closed: 'bg-slate-100 text-slate-600', no_contact: 'bg-slate-100 text-slate-500', escalated: 'bg-lavender-50 text-lavender-600',
};
const PRIORITY = {
  urgent: { label: 'Khẩn', c: 'bg-danger-50 text-danger-600' }, high: { label: 'Cao', c: 'bg-peach-50 text-peach-600' },
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
  const [analyzingId, setAnalyzingId] = useState(null);

  // Tóm tắt & phân tích 1 phản hồi bằng AI (Gemini) — chỉ gửi nội dung nhận xét
  const analyzeResponse = async (r) => {
    if (!r?.comment) return;
    setAnalyzingId(r.id);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-review', { body: { text: r.comment, score: r.overall_score } });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Lỗi phân tích');
      const patch = { ai_summary: data.summary || null };
      if (data.sentiment) patch.sentiment = data.sentiment;
      const { error: upErr } = await supabase.from('service_review_responses').update(patch).eq('id', r.id);
      if (upErr) throw upErr;
      setDetail(d => (d && d.id === r.id ? { ...d, ...patch } : d));
      await load();
    } catch (e) { toast.error('Phân tích AI: ' + (e.message || e)); }
    setAnalyzingId(null);
  };

  const load = useCallback(async () => {
    const [{ data: iv }, { data: rp }, { data: tk }, { data: st }] = await Promise.all([
      supabase.from('service_review_invitations').select('id, status, created_at, milestone').order('created_at', { ascending: false }).limit(5000),
      supabase.from('service_review_responses')
        .select('id, overall_score, csat_score, nps_score, staff_ratings, answers, selected_topics, wants_contact, comment, risk_level, fraud_status, fraud_score, verification_level, sentiment, ai_summary, submitted_at, invitation:service_review_invitations(customer_name, service, surgery_date, milestone, ticket_id, is_resurvey)')
        .order('submitted_at', { ascending: false }).limit(5000),
      supabase.from('service_review_tickets')
        .select('*, response:service_review_responses(comment, selected_topics, staff_ratings, answers, invitation:service_review_invitations(service, phone))')
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
    <div className="e-metric gap-3 sm:gap-4 p-3.5 sm:p-4 lg:p-5">
      <span className={`e-metric-icon w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${tone}`}><Icon /></span>
      <div className="min-w-0 flex-1">
        <div className="e-metric-label">{label}</div>
        <div className="e-metric-value">{value}</div>
        {sub && <div className="e-metric-hint">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Đầu màn: mô tả + khoảng thời gian */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="e-page-desc">Giám sát chất lượng nhân sự &amp; dịch vụ từ phản hồi khách hàng</p>
        <div className="e-seg max-w-full overflow-x-auto">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`e-seg-item ${period === p.key ? 'e-seg-active' : ''}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Tabs — gạch chân teal */}
      <div className="e-tabs">
        {[['overview', 'Tổng quan'], ['staff', 'Nhân sự'], ['responses', 'Phản hồi'], ['tickets', 'Xử lý phản hồi']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`e-tab shrink-0 ${tab === k ? 'e-tab-active' : ''}`}>
            {l}
            {k === 'tickets' && openTickets.length > 0 && <span className="e-badge e-badge-sm e-tone-danger min-w-[22px] justify-center px-1.5 tabular-nums">{openTickets.length}</span>}
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <StatCard icon={Smile} label="CSAT (TB 1–5)" value={fmt1(stats.csat)} sub={`${stats.respCount} phản hồi hợp lệ`} tone="bg-teal-50 text-teal-700" />
                <StatCard icon={ThumbsUp} label="NPS" value={stats.nps == null ? '—' : stats.nps} sub="−100 … +100" tone="bg-success-50 text-success-600" />
                <StatCard icon={TrendingUp} label="Tỷ lệ hoàn thành" value={`${stats.completeRate}%`} sub={`${stats.completed}/${stats.total} phiếu`} tone="bg-info-50 text-info-600" />
                <StatCard icon={AlertTriangle} label="Phản hồi tiêu cực" value={stats.negative} sub="điểm tổng thể 1–2" tone="bg-danger-50 text-danger-600" />
                <StatCard icon={Ticket} label="Ticket đang mở" value={openTickets.length} sub="cần xử lý" tone="bg-warning-50 text-warning-600" />
                <StatCard icon={Clock} label="Quá hạn SLA" value={overdueTickets.length} sub="xử lý gấp" tone="bg-danger-50 text-danger-600" />
                <StatCard icon={PhoneCall} label="Yêu cầu liên hệ" value={stats.wantContact} sub="khách muốn hỗ trợ" tone="bg-peach-50 text-peach-600" />
                <StatCard icon={ShieldAlert} label="Nghi ngờ gian lận" value={stats.suspect} sub="đã loại khỏi KPI" tone="bg-lavender-50 text-lavender-600" />
              </div>

              {/* Xu hướng CSAT */}
              <div className="e-card e-card-pad">
                <h3 className="e-card-title mb-3">Xu hướng CSAT theo tuần</h3>
                {trend.length === 0 ? <p className="e-empty text-[13px] text-slate-400">Chưa đủ dữ liệu.</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#EAF4F4" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#A3ABAA' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#A3ABAA' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                      <Line type="monotone" dataKey="csat" stroke="#067B7F" strokeWidth={2.5} dot={{ r: 3, fill: '#067B7F' }} name="CSAT" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Heatmap điểm chạm + Top vấn đề */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="e-card e-card-pad">
                  <h3 className="e-card-title mb-4">Điểm theo từng điểm chạm</h3>
                  <div className="space-y-3">
                    {perQuestion.map(pq => {
                      const pct = pq.avg ? (pq.avg / 5) * 100 : 0;
                      const color = pq.avg >= 4 ? 'bg-success-500' : pq.avg >= 3 ? 'bg-warning-500' : 'bg-danger-500';
                      return (
                        <div key={pq.code}>
                          <div className="flex justify-between gap-3 text-[13px] mb-1.5"><span className="text-slate-600 min-w-0">{pq.title}</span><span className="font-semibold text-slate-900 tabular-nums shrink-0">{fmt1(pq.avg)} <span className="text-slate-400 font-normal text-[12px]">({pq.n})</span></span></div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="e-card e-card-pad">
                  <h3 className="e-card-title mb-4">Chủ đề khách nhắc nhiều</h3>
                  {topTopics.length === 0 ? <p className="e-empty text-[13px] text-slate-400">Chưa có dữ liệu.</p> : (
                    <div className="space-y-1">
                      {topTopics.map(([t, c]) => (
                        <div key={t} className="flex items-center gap-3 min-h-[32px]">
                          <span className="text-[13px] text-slate-600 flex-1 min-w-0">{t}</span>
                          <div className="w-24 sm:w-32 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${(c / topTopics[0][1]) * 100}%` }} /></div>
                          <span className="text-[13px] font-semibold text-slate-900 w-7 text-right tabular-nums">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tiếng nói khách hàng */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="e-card e-card-pad">
                  <div className="flex items-center gap-2 mb-4"><Megaphone className="w-5 h-5 text-teal-600" /><h3 className="e-card-title">Cảm xúc khách hàng</h3></div>
                  <div className="space-y-1">
                    {voc.sentiment.map(({ s, n }) => {
                      const total = voc.sentiment.reduce((x, y) => x + y.n, 0) || 1;
                      return (
                        <div key={s} className="flex items-center gap-3 min-h-[32px]">
                          <span className={`e-badge e-badge-sm w-24 justify-center first-letter:uppercase ${SENTIMENT_STYLE[s]}`}>{s}</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${s.includes('tiêu cực') ? 'bg-danger-400' : s === 'trung lập' ? 'bg-slate-300' : 'bg-success-500'}`} style={{ width: `${(n / total) * 100}%` }} />
                          </div>
                          <span className="text-[13px] font-semibold text-slate-900 w-7 text-right tabular-nums">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="e-card e-card-pad">
                  <div className="flex items-center gap-2 mb-4"><RefreshCw className="w-5 h-5 text-teal-600" /><h3 className="e-card-title">Hiệu quả xử lý phản hồi</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="e-subtle px-4 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{voc.closedCount}</div><div className="text-[12px] text-slate-500 mt-0.5">Ticket đã xử lý</div></div>
                    <div className="e-subtle px-4 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{voc.onTimeRate == null ? '—' : voc.onTimeRate + '%'}</div><div className="text-[12px] text-slate-500 mt-0.5">Đúng hạn SLA</div></div>
                    <div className="e-subtle px-4 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{voc.resolvedRate == null ? '—' : voc.resolvedRate + '%'}</div><div className="text-[12px] text-slate-500 mt-0.5">Khách xác nhận đã giải quyết</div></div>
                    <div className="e-subtle px-4 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{fmt1(voc.satAfter)}</div><div className="text-[12px] text-slate-500 mt-0.5">Hài lòng sau xử lý ({voc.resurveyCount})</div></div>
                  </div>
                  <p className="text-[12px] text-slate-400 mt-3">Số liệu từ phiếu <b>khảo sát lại</b> gửi khách sau khi đóng ticket.</p>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- NHÂN SỰ ---------------- */}
          {tab === 'staff' && (
            <div className="e-card e-card-pad">
              <div className="e-card-header mb-3">
                <div className="min-w-0">
                  <h3 className="e-card-title flex items-center gap-2"><Award className="w-5 h-5 text-teal-600 shrink-0" />Điểm trung bình theo nhân sự</h3>
                  <p className="e-card-sub">Chỉ tính phản hồi hợp lệ. Cần tối thiểu {MIN_SAMPLE} lượt để xếp hạng công bằng (PRD §24).</p>
                </div>
              </div>
              {staffScores.length === 0 ? (
                <div className="e-empty"><div className="e-empty-icon"><Users /></div><div className="e-empty-title">Chưa có dữ liệu đánh giá nhân sự.</div></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {staffScores.map((s, i) => {
                    const enough = s.cnt >= MIN_SAMPLE;
                    const tone = !enough ? 'text-slate-400' : s.avg >= 4 ? 'text-success-600' : s.avg >= 3 ? 'text-warning-600' : 'text-danger-600';
                    return (
                      <div key={s.id} className="flex items-center gap-3 py-3 px-1">
                        <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-[12px] font-bold tabular-nums ${i < 3 && enough ? 'bg-warning-50 text-warning-600' : 'bg-slate-50 text-slate-400'}`}>{i + 1}</span>
                        <div className="e-avatar w-10 h-10 text-[14px]">{(s.name || '?').trim().split(/\s+/).slice(-1)[0][0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-slate-900 truncate">{s.name}</div>
                          <div className="text-[12px] text-slate-500 truncate">{STAFF_ROLE_LABELS[s.role] || s.role} · {s.cnt} lượt {!enough && <span className="text-warning-600 font-medium">· chưa đủ mẫu</span>}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 h-[28px] px-2.5 rounded-full bg-slate-50">
                          <Star className={`w-4 h-4 ${enough ? 'fill-current' : ''} ${tone}`} />
                          <span className={`text-[14px] font-bold tabular-nums ${tone}`}>{fmt1(s.avg)}</span>
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
              <div className="e-toolbar">
                <div className="e-search flex-1 min-w-[200px]">
                  <Search />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên khách / nội dung…" />
                </div>
                <button onClick={() => setOnlyNegative(v => !v)} className={`e-chip ${onlyNegative ? 'e-chip-active' : ''}`}><AlertTriangle className="w-4 h-4" />Chỉ tiêu cực</button>
              </div>
              {listResps.length === 0 ? (
                <div className="e-card e-empty"><div className="e-empty-icon"><MessageSquare /></div><div className="e-empty-title">Chưa có phản hồi phù hợp.</div></div>
              ) : listResps.map(r => (
                <button key={r.id} onClick={() => setDetail(r)} className={`e-card-flat e-card-hover w-full text-left p-4 flex flex-col gap-2.5 ${r.overall_score <= 2 ? 'border-danger-100 ring-1 ring-danger-50' : ''}`}>
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-11 h-11 rounded-full grid place-items-center shrink-0 text-[14px] font-bold tabular-nums ${r.overall_score <= 2 ? 'bg-danger-50 text-danger-600' : r.overall_score === 3 ? 'bg-warning-50 text-warning-600' : 'bg-success-50 text-success-600'}`}>
                      <div className="flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" />{r.overall_score ?? '—'}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-slate-900 truncate">{r.invitation?.customer_name || 'Khách'}</div>
                      <div className="text-[12px] text-slate-500 truncate mt-0.5">{r.invitation?.service || '—'} · {dstr(r.submitted_at)}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                  {r.comment && <p className="text-[14px] text-slate-700 leading-relaxed line-clamp-2">“{r.comment}”</p>}
                  <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-slate-100 w-full empty:hidden">
                    {FRAUD.includes(r.fraud_status) && <span className="e-badge e-badge-sm e-tone-lavender">Nghi ngờ</span>}
                    {r.wants_contact && r.wants_contact !== 'none' && <span className="e-badge e-badge-sm e-tone-warning"><PhoneCall />Cần liên hệ</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ---------------- XỬ LÝ PHẢN HỒI (TICKETS) ---------------- */}
          {tab === 'tickets' && (
            <div className="space-y-3">
              <div className="e-toolbar">
                <div className="e-search flex-1 min-w-[200px]">
                  <Search />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên khách…" />
                </div>
                <div className="e-seg">
                  {[['open', 'Đang mở'], ['all', 'Tất cả']].map(([k, l]) => (
                    <button key={k} onClick={() => setTicketFilter(k)} className={`e-seg-item ${ticketFilter === k ? 'e-seg-active' : ''}`}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="e-subtle px-4 py-3 text-[13px] text-slate-600 flex items-start gap-2.5 leading-relaxed">
                <Ticket className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
                <span>Phản hồi điểm thấp (1–2) hoặc khách yêu cầu liên hệ sẽ <b className="text-slate-800">tự động tạo ticket</b> để giao xử lý. Xử lý xong nhớ ghi nguyên nhân &amp; cách khắc phục rồi đóng ticket.</span>
              </div>

              {listTickets.length === 0 ? (
                <div className="e-card e-empty"><div className="e-empty-icon"><CheckCircle2 /></div><div className="e-empty-title">{ticketFilter === 'open' ? 'Không có ticket nào đang mở. 🎉' : 'Chưa có ticket nào.'}</div></div>
              ) : listTickets.map(t => {
                const overdue = isOverdue(t);
                return (
                  <button key={t.id} onClick={() => setTicketDetail(t)} className={`e-card-flat e-card-hover w-full text-left p-4 flex flex-col gap-2.5 ${overdue ? 'border-danger-200 ring-1 ring-danger-100' : ''}`}>
                    <div className="flex items-center gap-3 w-full">
                      <div className={`w-11 h-11 rounded-full grid place-items-center shrink-0 text-[14px] font-bold tabular-nums ${t.overall_score <= 2 ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-600'}`}>
                        <div className="flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" />{t.overall_score ?? '!'}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-slate-900 truncate">{t.customer_name || 'Khách'}</div>
                        <div className="text-[12px] text-slate-500 truncate mt-0.5">{t.category ? `${t.category} · ` : ''}{t.response?.comment ? `“${t.response.comment}”` : t.response?.invitation?.service || '—'}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-slate-100 w-full">
                      <span className={`e-badge e-badge-sm ${PRIORITY[t.priority]?.c || PRIORITY.normal.c}`}>{PRIORITY[t.priority]?.label || t.priority}</span>
                      <span className={`e-badge e-badge-sm e-badge-dot ${STATUS_STYLE[t.status]}`}>{TICKET_STATUS[t.status] || t.status}</span>
                      {overdue && <span className="e-badge e-badge-sm e-tone-danger"><Clock />Quá hạn</span>}
                      <span className="ml-auto text-[12px] text-slate-500 tabular-nums">
                        {t.assigned_to ? <>Giao: <b className="text-slate-800 font-semibold">{staffMap[t.assigned_to] || '—'}</b> · </> : <span className="text-danger-600 font-semibold">Chưa giao · </span>}
                        Hạn: {t.sla_due_at ? dtstr(t.sla_due_at) : '—'}
                      </span>
                    </div>
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
        <div className="e-modal-backdrop z-[60] flex items-center justify-center p-4" onClick={() => setResurveyQR(null)}>
          <div className="e-modal max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center">
              <div className="flex items-center gap-3 min-w-0">
                <span className="e-metric-icon w-11 h-11 lg:w-11 lg:h-11"><RefreshCw /></span>
                <div className="min-w-0">
                  <h3 className="e-modal-title">Phiếu khảo sát lại</h3>
                  <p className="text-[13px] text-slate-500 truncate">{resurveyQR.name}</p>
                </div>
              </div>
              <button onClick={() => setResurveyQR(null)} aria-label="Đóng" className="e-icon-btn w-9 h-9 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body flex flex-col items-center">
              <div className="e-subtle p-3 bg-white">
                <img src={resurveyQR.dataUrl} alt="QR khảo sát lại" className="w-56 h-56" />
              </div>
              <p className="text-[12.5px] text-slate-500 mt-3 text-center">Gửi khách quét để xác nhận đã hài lòng sau xử lý</p>
            </div>
            <div className="e-modal-footer">
              <div className="flex items-center gap-2 w-full min-w-0">
                <span className="e-input flex items-center text-[12.5px] text-slate-500 bg-white min-w-0 flex-1"><span className="truncate">{resurveyQR.url}</span></span>
                <button onClick={copyResurvey} className="e-btn e-btn-primary e-btn-sm shrink-0"><Copy className="w-4 h-4" /> Sao chép</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chi tiết phản hồi */}
      {detail && (
        <div className="e-modal-backdrop z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDetail(null)}>
          <div className="e-modal max-w-lg rounded-b-none sm:rounded-2xl max-h-[88dvh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center">
              <div className="min-w-0">
                <h3 className="e-modal-title truncate">{detail.invitation?.customer_name || 'Khách'}</h3>
                <p className="text-[12.5px] text-slate-500 mt-0.5">{detail.invitation?.service || '—'} · {dstr(detail.submitted_at)}</p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Đóng" className="e-icon-btn w-9 h-9 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body space-y-5 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="e-subtle px-2 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{detail.overall_score ?? '—'}</div><div className="text-[12px] text-slate-500 mt-0.5">Tổng thể</div></div>
                <div className="e-subtle px-2 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{fmt1(detail.csat_score)}</div><div className="text-[12px] text-slate-500 mt-0.5">CSAT</div></div>
                <div className="e-subtle px-2 py-3"><div className="text-[22px] font-bold text-slate-900 leading-tight tabular-nums">{detail.nps_score ?? '—'}</div><div className="text-[12px] text-slate-500 mt-0.5">NPS</div></div>
              </div>

              {detail.comment && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[14px] text-slate-700 leading-relaxed flex gap-2.5"><MessageSquare className="w-4 h-4 text-teal-600 shrink-0 mt-1" /><span>“{detail.comment}”</span></div>
              )}

              {detail.comment && (
                detail.ai_summary ? (
                  <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 text-[14px] text-slate-700 leading-relaxed">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="e-badge e-badge-sm e-tone-brand"><Sparkles /> Tóm tắt AI</span>
                      <button onClick={() => analyzeResponse(detail)} disabled={analyzingId === detail.id} className="e-btn e-btn-ghost e-btn-sm h-7 px-2 text-[12px]">{analyzingId === detail.id ? 'Đang…' : 'Phân tích lại'}</button>
                    </div>
                    {detail.ai_summary}
                  </div>
                ) : (
                  <button onClick={() => analyzeResponse(detail)} disabled={analyzingId === detail.id}
                    className="e-btn e-btn-outline e-btn-block">
                    {analyzingId === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Tóm tắt & phân tích bằng AI
                  </button>
                )
              )}

              {/* Điểm từng câu */}
              <div>
                <div className="e-caption mb-2">Điểm từng điểm chạm</div>
                <div className="divide-y divide-slate-100">
                {QUESTIONS.filter(qq => qq.type === 'rating5').map(qq => {
                  const v = detail.answers?.[qq.code];
                  if (v == null) return null;
                  return <div key={qq.code} className="flex justify-between gap-3 py-2 text-[13.5px]"><span className="text-slate-500 min-w-0">{qq.title}</span><span className="font-semibold text-slate-900 shrink-0 tabular-nums">{v === 'na' ? 'Không áp dụng' : `${v}/5 · ${RATING_LABELS[v] || ''}`}</span></div>;
                })}
                </div>
              </div>

              {/* Nhân sự */}
              {(detail.staff_ratings || []).length > 0 && (
                <div>
                  <div className="e-caption mb-2">Đánh giá nhân sự</div>
                  <div className="divide-y divide-slate-100">
                    {detail.staff_ratings.map((sr, i) => (
                      <div key={i} className="flex justify-between items-center gap-3 py-2 text-[13.5px]"><span className="text-slate-700 min-w-0">{sr.name} <span className="text-slate-400">({STAFF_ROLE_LABELS[sr.role] || sr.role})</span></span><span className="e-badge e-badge-sm e-tone-brand tabular-nums shrink-0"><Star className="fill-current" />{sr.score}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {(detail.selected_topics || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.selected_topics.map(t => <span key={t} className="e-badge e-badge-sm e-tone-neutral">{t}</span>)}
                </div>
              )}

              {detail.sentiment && (
                <div className="flex items-center gap-2 text-[13px]"><span className="text-slate-500">Cảm xúc:</span><span className={`e-badge e-badge-sm first-letter:uppercase ${SENTIMENT_STYLE[detail.sentiment] || 'bg-slate-100 text-slate-600'}`}>{detail.sentiment}</span></div>
              )}

              {(detail.answers?._attachments || []).length > 0 && (
                <div>
                  <div className="e-caption mb-2">Ảnh / ghi âm đính kèm</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.answers._attachments.map((a, i) => a.type === 'image'
                      ? <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200" /></a>
                      : <audio key={i} src={a.url} controls className="h-9 max-w-[200px]" />)}
                  </div>
                </div>
              )}

              {detail.wants_contact && detail.wants_contact !== 'none' && (
                <div className="rounded-xl bg-warning-50 px-4 py-3 text-[13.5px] text-warning-600 font-medium flex items-center gap-2"><PhoneCall className="w-4 h-4 shrink-0" /> Khách muốn được liên hệ {detail.wants_contact === 'urgent' ? 'sớm nhất' : 'trong giờ hành chính'}</div>
              )}

              <div className="flex items-center gap-2 text-[12px] text-slate-400 pt-3 border-t border-slate-100">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Mức xác thực L{detail.verification_level} · Điểm rủi ro {detail.fraud_score}/100 · {FRAUD.includes(detail.fraud_status) ? <span className="text-lavender-600 font-semibold">nghi ngờ gian lận</span> : 'hợp lệ'}
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
    <div className="e-modal-backdrop z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="e-modal max-w-lg rounded-b-none sm:rounded-2xl max-h-[90dvh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="e-modal-header items-center">
          <div className="min-w-0">
            <h3 className="e-modal-title truncate">{ticket.customer_name || 'Khách'}</h3>
            <p className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums">{resp.invitation?.service || '—'}{resp.invitation?.phone ? ` · ${resp.invitation.phone}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="e-icon-btn w-9 h-9 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="e-modal-body space-y-5 overflow-y-auto">
          {/* Tóm tắt phản hồi */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`e-badge e-badge-sm ${PRIORITY[ticket.priority]?.c || PRIORITY.normal.c}`}>Ưu tiên: {PRIORITY[ticket.priority]?.label}</span>
              <span className="e-badge e-badge-sm e-tone-neutral tabular-nums"><Star className="fill-current" />Điểm: {ticket.overall_score ?? '—'}/5</span>
              {ticket.wants_contact && ticket.wants_contact !== 'none' && <span className="e-badge e-badge-sm e-tone-warning"><PhoneCall />Muốn liên hệ {ticket.wants_contact === 'urgent' ? 'gấp' : 'giờ HC'}</span>}
              <span className={`e-badge e-badge-sm tabular-nums ${overdue ? 'e-tone-danger' : 'e-tone-neutral'}`}><Clock />Hạn: {ticket.sla_due_at ? dtstr(ticket.sla_due_at) : '—'}</span>
            </div>
            {resp.comment && <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[14px] text-slate-700 leading-relaxed flex gap-2.5"><MessageSquare className="w-4 h-4 text-teal-600 shrink-0 mt-1" /><span>“{resp.comment}”</span></div>}
            {(resp.selected_topics || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">{resp.selected_topics.map(t => <span key={t} className="e-badge e-badge-sm e-tone-rose">{t}</span>)}</div>
            )}
            {(resp.answers?._attachments || []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {resp.answers._attachments.map((a, i) => a.type === 'image'
                  ? <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200" /></a>
                  : <audio key={i} src={a.url} controls className="h-9 max-w-[180px]" />)}
              </div>
            )}
          </div>

          {/* Giao việc + trạng thái + ưu tiên */}
          <div className="pt-4 border-t border-slate-100">
            <div className="e-caption mb-3">Phân công &amp; trạng thái</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="e-label">Giao cho</span>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="e-input">
                  <option value="">— Chưa giao —</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="e-label">Trạng thái</span>
                <select value={status} onChange={e => setStatus(e.target.value)} className="e-input">
                  {Object.entries(TICKET_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="block col-span-2">
                <span className="e-label">Độ ưu tiên</span>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="e-input">
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Nguyên nhân & khắc phục */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="e-caption">Nguyên nhân &amp; khắc phục</div>
            <label className="block">
              <span className="e-label">Nguyên nhân gốc</span>
              <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} rows={2} placeholder="Vì sao khách chưa hài lòng?" className="e-textarea resize-none" />
            </label>
            <label className="block">
              <span className="e-label">Cách khắc phục <span className="text-slate-400 font-normal">(bắt buộc khi đóng)</span></span>
              <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2} placeholder="Đã làm gì để khắc phục / hỗ trợ khách?" className="e-textarea resize-none" />
            </label>
          </div>

          {/* Nhật ký xử lý */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            {activities.length > 0 && (
              <div>
                <div className="e-caption mb-2.5">Nhật ký xử lý</div>
                <ol className="relative space-y-3 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-slate-200">
                  {activities.map(a => (
                    <li key={a.id} className="relative text-[13.5px]">
                      <span className="absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full bg-white border-2 border-teal-400" />
                      <div className="text-slate-700 leading-relaxed">{a.content}</div>
                      <div className="text-[12px] text-slate-400 mt-0.5">{staffMap[a.created_by] || 'Hệ thống'} · {dtstr(a.created_at)}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <label className="block">
              <span className="e-label">Ghi chú xử lý (thêm vào nhật ký)</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ví dụ: Đã gọi khách lúc 15h, khách đồng ý tái khám…" className="e-textarea resize-none" />
            </label>
          </div>

          {/* Khảo sát lại sau xử lý (PRD §10) */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1.5"><RefreshCw className="w-4 h-4 text-teal-600" /><span className="text-[14px] font-semibold text-slate-900">Khảo sát lại sau xử lý</span></div>
            {resurveyResp ? (
              <div className="text-[13.5px] text-slate-700 leading-relaxed">
                Khách đã phản hồi: <b className="font-semibold text-slate-900">{resurveyResp.answers?.rs_resolved || '—'}</b> · hài lòng <b className="font-semibold text-slate-900 tabular-nums">{resurveyResp.overall_score ?? '—'}/5</b>
                {resurveyResp.answers?.rs_need === 'Vẫn cần được hỗ trợ' && <span className="text-danger-600 font-semibold"> · vẫn cần hỗ trợ</span>}
                {resurveyResp.comment && <div className="text-[12.5px] text-slate-500 mt-1">“{resurveyResp.comment}”</div>}
              </div>
            ) : (
              <>
                <p className="text-[12.5px] text-slate-500 mb-3 leading-relaxed">Sau khi liên hệ & khắc phục, tạo phiếu ngắn để khách xác nhận đã hài lòng chưa (tránh đóng ticket khi khách còn chưa ưng).</p>
                <button type="button" onClick={onResurvey} className="e-btn e-btn-outline e-btn-sm"><RefreshCw className="w-4 h-4" /> Tạo phiếu khảo sát lại</button>
              </>
            )}
          </div>
        </div>

        <div className="e-modal-footer">
          {ticket.status !== 'closed' && (
            <button onClick={() => save(true)} disabled={saving} className="e-btn e-btn-outline">
              <CheckCircle2 className="w-4 h-4" /> Đóng ticket
            </button>
          )}
          <button onClick={() => save(false)} disabled={saving} className="e-btn e-btn-primary flex-1 sm:flex-none">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Lưu cập nhật
          </button>
        </div>
      </div>
    </div>
  );
}
