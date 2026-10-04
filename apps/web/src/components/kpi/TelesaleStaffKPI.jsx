import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, AlertCircle, Phone, CalendarCheck, Percent, Wallet, CalendarClock, TrendingDown } from 'lucide-react';
import { computeTelesale, fetchTelesalePrior, isRecheck } from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';

const STATUS_LABEL = { phau_thuat: 'Phẫu thuật', coc: 'Cọc', bong: 'Bong', scheduled: 'Đã hẹn', cancelled: 'Huỷ' };
const STATUS_COLOR = { phau_thuat: 'e-tone-success', coc: 'e-tone-info', bong: 'e-tone-danger', scheduled: 'e-tone-neutral', cancelled: 'e-tone-neutral' };

const ACCENTS = { emerald: 'bg-teal-50 text-teal-700', blue: 'bg-info-50 text-info-600', violet: 'bg-lavender-50 text-lavender-600', orange: 'bg-peach-50 text-peach-600', red: 'bg-danger-50 text-danger-600' };
const Card = ({ icon: Icon, label, value, accent = 'emerald' }) => (
<div className="e-metric flex-col lg:flex-row items-start p-3.5 lg:p-4 gap-2.5 lg:gap-3">
    <span className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full grid place-items-center shrink-0 ${ACCENTS[accent]}`}><Icon className="w-5 h-5" /></span>
    <div className="min-w-0 w-full lg:w-auto">
      <div className="e-metric-label whitespace-normal text-[12.5px] lg:text-[13px]">{label}</div>
      <div className="text-[18px] lg:text-[20px] font-bold text-slate-900 leading-tight tabular-nums break-words mt-0.5">{value}</div>
    </div>
  </div>
);

const TelesaleStaffKPI = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [appts, setAppts] = useState([]);
  const [surgRows, setSurgRows] = useState([]);
  const [bongRows, setBongRows] = useState([]);
  const [cocRows, setCocRows] = useState([]);
  const [phones, setPhones] = useState(0);
  const [prior, setPrior] = useState(null);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const id = profile.id;
    const orTele = `telesale_id.eq.${id},telesale_id_2.eq.${id}`;
    const [kpiRes, apptRes, surgRes, bongRes, cocRes, pageRes, priorData] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('staff_id', id).eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('customer_appointments').select('id, customer_name, appointment_date, status, service, notes, telesale_id_2').or(orTele).gte('appointment_date', ms).lte('appointment_date', me).order('appointment_date', { ascending: false }),
      supabase.from('customer_appointments').select('id, customer_name, phone, surgery_date, revenue, service, notes, bong_date, deposit_date, surgery_type, telesale_id_2, customer_source').eq('status', 'phau_thuat').or(orTele).gte('surgery_date', ms).lte('surgery_date', me).order('surgery_date', { ascending: false }),
      supabase.from('customer_appointments').select('id, customer_name, phone, consult_received, telesale_id_2, surgery_type, customer_source').or(orTele).gte('bong_date', ms).lte('bong_date', me),
      supabase.from('customer_appointments').select('id, customer_name, phone, consult_received, telesale_id_2, surgery_type, customer_source').or(orTele).gte('deposit_date', ms).lte('deposit_date', me),
      supabase.from('page_daily_reports').select('total_phones').eq('telesale_id', id).gte('date', ms).lte('date', me),
      fetchTelesalePrior(ms),
    ]);
    if (apptRes.error) toast.error('Lỗi tải lịch hẹn: ' + apptRes.error.message);
    if (surgRes.error) toast.error('Lỗi tải doanh thu (cần chạy add_bong_date.sql?): ' + surgRes.error.message);
    setKpi(kpiRes.data || null);
    setAppts((apptRes.data || []).filter(a => !isRecheck(a)));
    setSurgRows(surgRes.data || []);
    setBongRows(bongRes.data || []);
    setCocRows(cocRes.data || []);
    setPhones((pageRes.data || []).reduce((s, r) => s + Number(r.total_phones || 0), 0));
    setPrior(priorData);
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const r = computeTelesale({ phones, appts, bongRows, cocRows, surgRows, prior });
  const apptTarget = kpi?.target_appointments || 0;
  const revTarget = kpi?.target_revenue || 0;
  const apptProgress = apptTarget > 0 ? Math.min(Math.round(r.tongLichHen / apptTarget * 100), 100) : 0;
  const revProgress = revTarget > 0 ? Math.min(Math.round(r.doanhThu / revTarget * 100), 100) : 0;
  const hasKpi = kpi && (apptTarget || revTarget || kpi.target_close_rate);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-4 lg:block lg:space-y-4">
      <div className="e-toolbar justify-between pl-2.5 lg:pl-4 -order-3">
        <div className="hidden lg:block">
          <h2 className="text-[15px] font-semibold text-slate-900">KPI cá nhân · Telesale</h2>
          <p className="e-page-desc">Theo dõi hiệu suất và hoa hồng của bạn — {MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
          <button onClick={prevMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng trước"><ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <span className="flex flex-col items-center lg:block min-w-[104px] text-center">
            <span className="block text-[15px] lg:text-[13.5px] font-semibold text-slate-800 tabular-nums">{MONTHS[month - 1]} {year}</span>
            <span className="lg:hidden text-[12px] text-slate-500 mt-0.5">KPI Telesale</span>
          </span>
          <button onClick={nextMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng sau"><ChevronRight className="w-5 h-5 lg:w-4 lg:h-4" /></button>
        </div>
      </div>

      {/* KPI tháng được giao (cảnh báo nếu chưa có) */}
      <div className="e-card overflow-hidden -order-2">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="e-card-title">KPI tháng được giao</h3></div>
        <div className="p-4 lg:p-5">
          {!hasKpi ? (
            <div className="e-subtle e-empty">
              <AlertCircle className="w-12 h-12 p-3 rounded-full bg-warning-50 text-warning-600 mb-3" />
              <div className="e-empty-title">Bạn chưa được giao KPI cho tháng này.</div>
            </div>
          ) : (
            <>
              {/* Điện thoại: vòng KPI to (kiểu Ethics M15) */}
              <div className="lg:hidden relative w-[200px] h-[200px] mx-auto mt-1 mb-5 rounded-full"
                style={{ background: `conic-gradient(#3CA7A9 0%, #067B7F ${apptProgress}%, #EAF4F4 ${apptProgress}% 100%)` }}>
                <div className="absolute inset-[22px] rounded-full bg-white grid place-items-center text-center">
                  <div>
                    <div className="text-[44px] font-bold text-slate-900 leading-none tabular-nums">{apptProgress}%</div>
                    <div className="text-[13px] text-slate-500 mt-1.5">KPI lịch hẹn</div>
                  </div>
                </div>
              </div>
              <div className="lg:hidden e-caption mb-2">Mục tiêu tháng</div>
              <div className="grid sm:grid-cols-3 gap-2 lg:gap-3 text-sm">
                <div className="e-subtle p-3 flex items-center justify-between gap-3 lg:block"><div className="text-slate-500 lg:text-slate-400 text-[13px] lg:text-xs">Tổng lịch hẹn</div><div className="font-bold text-slate-800 mt-0.5 tabular-nums">{fmt(apptTarget)}</div></div>
                <div className="e-subtle p-3 flex items-center justify-between gap-3 lg:block"><div className="text-slate-500 lg:text-slate-400 text-[13px] lg:text-xs">Doanh thu</div><div className="font-bold text-slate-800 mt-0.5 tabular-nums">{fmtM(revTarget)}</div></div>
                <div className="e-subtle p-3 flex items-center justify-between gap-3 lg:block"><div className="text-slate-500 lg:text-slate-400 text-[13px] lg:text-xs">Tỉ lệ chốt hẹn</div><div className="font-bold text-slate-800 mt-0.5 tabular-nums">{Number(kpi.target_close_rate || 0).toFixed(1)}%</div></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chỉ số nổi bật */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Phone} label="Số điện thoại nhận" value={fmt(r.phones)} accent="emerald" />
        <Card icon={CalendarCheck} label="Tổng lịch hẹn" value={fmt(r.tongLichHen)} accent="blue" />
        <Card icon={Percent} label="Tỷ lệ chốt hẹn" value={`${r.tyLeChotHen.toFixed(1)}%`} accent="orange" />
        <Card icon={Wallet} label="Doanh thu được gán" value={fmtM(r.doanhThu)} accent="violet" />
        <div className="col-span-2 -order-1 lg:order-none e-card e-card-pad bg-teal-50 border-teal-100 flex flex-col justify-center">
          <div className="e-caption text-teal-700">Hoa hồng tạm tính</div>
          <div className="text-[28px] font-bold text-teal-800 mt-1 tabular-nums">{fmtM(r.tongHH)}</div>
          <div className="text-[12px] text-slate-600 mt-1">Thưởng DT {fmtM(r.thuongDoanhThu)} + Thưởng lịch hẹn {fmtM(r.thuongLichHen)}</div>
        </div>
        <Card icon={CalendarClock} label="Lịch hẹn còn thiếu" value={fmt(Math.max(apptTarget - r.tongLichHen, 0))} accent="blue" />
        <Card icon={TrendingDown} label="Doanh thu còn thiếu" value={fmtM(Math.max(revTarget - r.doanhThu, 0))} accent="red" />
      </div>

      {/* Tiến độ hoàn thành KPI */}
      <div className="e-card e-card-pad space-y-5 -order-1">
        <h3 className="e-card-title">Tiến độ hoàn thành KPI</h3>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="font-semibold text-slate-700 text-sm">Tiến độ KPI lịch hẹn</span><span className="font-bold text-teal-700 lg:text-slate-800 tabular-nums">{apptProgress}%</span></div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9] lg:bg-none lg:bg-teal-500" style={{ width: `${apptProgress}%` }} /></div>
          <div className="flex justify-between text-[12.5px] lg:text-xs text-slate-400 mt-1"><span>Đạt: <b className="text-slate-600">{fmt(r.tongLichHen)}</b></span><span>Mục tiêu: <b className="text-slate-600">{fmt(apptTarget)}</b></span></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="font-semibold text-slate-700 text-sm">Tiến độ KPI doanh thu</span><span className="font-bold text-teal-700 lg:text-slate-800 tabular-nums">{revProgress}%</span></div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9] lg:bg-none lg:bg-teal-700" style={{ width: `${revProgress}%` }} /></div>
          <div className="flex justify-between text-[12.5px] lg:text-xs text-slate-400 mt-1"><span>Đạt: <b className="text-slate-600">{fmtM(r.doanhThu)}</b></span><span>Mục tiêu: <b className="text-slate-600">{fmtM(revTarget)}</b></span></div>
        </div>
      </div>

      {/* Ghi chú hoa hồng */}
      <div className="e-subtle p-4 text-[12.5px] text-slate-500 space-y-1">
        <div className="font-semibold text-slate-600">Cách tính hoa hồng:</div>
        <div>• <b>Thưởng doanh thu</b> = Doanh thu × A% (A: &lt;500tr=0.5% · 500tr–&lt;1 tỷ=1% · ≥1 tỷ=1.5%).</div>
        <div>• <b>Thưởng lịch hẹn</b>: PT trực tiếp 500k · đánh giá bong 200k (PT sau +300k) · đánh giá cọc 300k (PT sau +200k) — chia theo tháng diễn ra.</div>
      </div>

      {/* Lịch hẹn của tôi */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-teal-600" /> Lịch hẹn của tôi</h3></div>
        {/* Điện thoại: danh sách thẻ */}
        <div className="lg:hidden divide-y divide-slate-100">
          {appts.length === 0 ? (<div className="text-center py-8 text-[13px] text-slate-400">Chưa có lịch hẹn.</div>)
            : appts.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 grid place-items-center text-[13px] font-semibold shrink-0 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold text-slate-900 truncate">{a.customer_name}</div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5 truncate"><span className="tabular-nums">{a.appointment_date}</span> · {a.notes || '—'}</div>
                </div>
                <span className={`e-badge e-badge-sm shrink-0 ${STATUS_COLOR[a.status] || 'e-tone-neutral'}`}>{STATUS_LABEL[a.status] || a.status}</span>
              </div>
            ))}
        </div>
        <div className="hidden lg:block overflow-x-auto">
          <table className="e-table">
            <thead><tr>
              <th className="text-left">STT</th><th className="text-left">Ngày hẹn</th>
              <th className="text-left">Khách hàng</th><th className="text-left">Trạng thái</th><th className="text-left">Ghi chú</th>
            </tr></thead>
            <tbody>
              {appts.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có lịch hẹn.</td></tr>)
                : appts.map((a, i) => (
                  <tr key={a.id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="text-slate-600">{a.appointment_date}</td>
                    <td className="font-semibold text-slate-900">{a.customer_name}</td>
                    <td className="align-middle"><span className={`e-badge e-badge-sm ${STATUS_COLOR[a.status] || 'e-tone-neutral'}`}>{STATUS_LABEL[a.status] || a.status}</span></td>
                    <td className="text-slate-400">{a.notes || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doanh thu được gán */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-teal-600" /> Doanh thu được gán</h3></div>
        {/* Điện thoại: danh sách thẻ */}
        <div className="lg:hidden divide-y divide-slate-100">
          {surgRows.length === 0 ? (<div className="text-center py-8 text-[13px] text-slate-400">Chưa có doanh thu được gán.</div>)
            : surgRows.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 grid place-items-center text-[13px] font-semibold shrink-0 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold text-slate-900 truncate">{a.customer_name}</div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5 truncate"><span className="tabular-nums">{a.surgery_date}</span> · {a.service || '—'}</div>
                </div>
                <div className="text-[14.5px] font-bold text-teal-700 tabular-nums shrink-0">{fmtM(a.revenue)}</div>
              </div>
            ))}
        </div>
        <div className="hidden lg:block overflow-x-auto">
          <table className="e-table">
            <thead><tr>
              <th className="text-left">STT</th><th className="text-left">Ngày</th>
              <th className="text-left">Khách hàng</th><th className="text-left">Dịch vụ</th><th className="text-right">Số tiền</th>
            </tr></thead>
            <tbody>
              {surgRows.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có doanh thu được gán.</td></tr>)
                : surgRows.map((a, i) => (
                  <tr key={a.id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="text-slate-600">{a.surgery_date}</td>
                    <td className="font-semibold text-slate-900">{a.customer_name}</td>
                    <td className="text-slate-500">{a.service || '—'}</td>
                    <td className="text-right font-semibold text-teal-700">{fmtM(a.revenue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TelesaleStaffKPI;
