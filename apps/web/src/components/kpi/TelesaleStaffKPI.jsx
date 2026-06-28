import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, AlertCircle, Phone, CalendarCheck, Percent, Wallet, CalendarClock, TrendingDown } from 'lucide-react';
import { computeTelesale, isRecheck } from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';

const STATUS_LABEL = { phau_thuat: 'Phẫu thuật', coc: 'Cọc', bong: 'Bong', scheduled: 'Đã hẹn', cancelled: 'Huỷ' };
const STATUS_COLOR = { phau_thuat: 'bg-teal-100 text-teal-700', coc: 'bg-blue-100 text-blue-700', bong: 'bg-red-100 text-red-600', scheduled: 'bg-slate-100 text-slate-600', cancelled: 'bg-slate-100 text-slate-400' };

const ACCENTS = { emerald: 'bg-teal-50 text-teal-600', blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', orange: 'bg-orange-50 text-orange-600', red: 'bg-red-50 text-red-500' };
const Card = ({ icon: Icon, label, value, accent = 'emerald' }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ACCENTS[accent]}`}><Icon className="w-3.5 h-3.5" /></span>{label}
    </div>
    <div className="text-2xl font-black text-slate-800 mt-2">{value}</div>
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

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const id = profile.id;
    const orTele = `telesale_id.eq.${id},telesale_id_2.eq.${id}`;
    const [kpiRes, apptRes, surgRes, bongRes, cocRes, pageRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('staff_id', id).eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('customer_appointments').select('id, customer_name, appointment_date, status, service, notes, telesale_id_2').or(orTele).gte('appointment_date', ms).lte('appointment_date', me).order('appointment_date', { ascending: false }),
      supabase.from('customer_appointments').select('id, customer_name, surgery_date, revenue, service, notes, bong_date, deposit_date, surgery_type, telesale_id_2').eq('status', 'phau_thuat').or(orTele).gte('surgery_date', ms).lte('surgery_date', me).order('surgery_date', { ascending: false }),
      supabase.from('customer_appointments').select('id, telesale_id_2, surgery_type').or(orTele).gte('bong_date', ms).lte('bong_date', me),
      supabase.from('customer_appointments').select('id, telesale_id_2, surgery_type').or(orTele).gte('deposit_date', ms).lte('deposit_date', me),
      supabase.from('page_daily_reports').select('total_phones').eq('telesale_id', id).gte('date', ms).lte('date', me),
    ]);
    if (apptRes.error) toast.error('Lỗi tải lịch hẹn: ' + apptRes.error.message);
    if (surgRes.error) toast.error('Lỗi tải doanh thu (cần chạy add_bong_date.sql?): ' + surgRes.error.message);
    setKpi(kpiRes.data || null);
    setAppts((apptRes.data || []).filter(a => !isRecheck(a)));
    setSurgRows(surgRes.data || []);
    setBongRows(bongRes.data || []);
    setCocRows(cocRes.data || []);
    setPhones((pageRes.data || []).reduce((s, r) => s + Number(r.total_phones || 0), 0));
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const r = computeTelesale({ phones, appts, bongRows, cocRows, surgRows });
  const apptTarget = kpi?.target_appointments || 0;
  const revTarget = kpi?.target_revenue || 0;
  const apptProgress = apptTarget > 0 ? Math.min(Math.round(r.tongLichHen / apptTarget * 100), 100) : 0;
  const revProgress = revTarget > 0 ? Math.min(Math.round(r.doanhThu / revTarget * 100), 100) : 0;
  const hasKpi = kpi && (apptTarget || revTarget || kpi.target_close_rate);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">KPI cá nhân · Telesale</h2>
          <p className="text-slate-400 text-sm mt-0.5">Theo dõi hiệu suất và hoa hồng của bạn — {MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="text-sm font-medium text-slate-700 min-w-[96px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {/* KPI tháng được giao (cảnh báo nếu chưa có) */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-teal-700">KPI tháng được giao</h3></div>
        <div className="p-5">
          {!hasKpi ? (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl py-8 flex flex-col items-center text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
              <div className="font-semibold text-amber-700">Bạn chưa được giao KPI cho tháng này.</div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Tổng lịch hẹn</div><div className="font-bold text-slate-800 mt-0.5">{fmt(apptTarget)}</div></div>
              <div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Doanh thu</div><div className="font-bold text-slate-800 mt-0.5">{fmtM(revTarget)}</div></div>
              <div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Tỉ lệ chốt hẹn</div><div className="font-bold text-slate-800 mt-0.5">{Number(kpi.target_close_rate || 0).toFixed(1)}%</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Chỉ số nổi bật */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Phone} label="Số điện thoại nhận" value={fmt(r.phones)} accent="emerald" />
        <Card icon={CalendarCheck} label="Tổng lịch hẹn" value={fmt(r.tongLichHen)} accent="blue" />
        <Card icon={Percent} label="Tỷ lệ chốt hẹn" value={`${r.tyLeChotHen.toFixed(1)}%`} accent="orange" />
        <Card icon={Wallet} label="Doanh thu được gán" value={fmtM(r.doanhThu)} accent="violet" />
        <div className="col-span-2 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl p-4 shadow-md flex flex-col justify-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/90">Hoa hồng tạm tính</div>
          <div className="text-3xl font-black mt-1">{fmtM(r.tongHH)}</div>
          <div className="text-xs text-white/80 mt-1">Thưởng DT {fmtM(r.thuongDoanhThu)} + Thưởng lịch hẹn {fmtM(r.thuongLichHen)}</div>
        </div>
        <Card icon={CalendarClock} label="Lịch hẹn còn thiếu" value={fmt(Math.max(apptTarget - r.tongLichHen, 0))} accent="blue" />
        <Card icon={TrendingDown} label="Doanh thu còn thiếu" value={fmtM(Math.max(revTarget - r.doanhThu, 0))} accent="red" />
      </div>

      {/* Tiến độ hoàn thành KPI */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-5">
        <h3 className="font-bold text-teal-700">Tiến độ hoàn thành KPI</h3>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="font-semibold text-slate-700 text-sm">Tiến độ KPI lịch hẹn</span><span className="font-bold text-slate-800">{apptProgress}%</span></div>
          <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full bg-teal-500" style={{ width: `${apptProgress}%` }} /></div>
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Đạt: <b className="text-slate-600">{fmt(r.tongLichHen)}</b></span><span>Mục tiêu: <b className="text-slate-600">{fmt(apptTarget)}</b></span></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="font-semibold text-slate-700 text-sm">Tiến độ KPI doanh thu</span><span className="font-bold text-slate-800">{revProgress}%</span></div>
          <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full bg-violet-500" style={{ width: `${revProgress}%` }} /></div>
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Đạt: <b className="text-slate-600">{fmtM(r.doanhThu)}</b></span><span>Mục tiêu: <b className="text-slate-600">{fmtM(revTarget)}</b></span></div>
        </div>
      </div>

      {/* Ghi chú hoa hồng */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-600">Cách tính hoa hồng:</div>
        <div>• <b>Thưởng doanh thu</b> = Doanh thu × A% (A: &lt;500tr=0.5% · 500tr–&lt;1 tỷ=1% · ≥1 tỷ=1.5%).</div>
        <div>• <b>Thưởng lịch hẹn</b>: PT trực tiếp 500k · đánh giá bong 200k (PT sau +300k) · đánh giá cọc 300k (PT sau +200k) — chia theo tháng diễn ra.</div>
      </div>

      {/* Lịch hẹn của tôi */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700 flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-teal-500" /> Lịch hẹn của tôi</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
              <th className="text-left px-4 py-2.5 font-medium">STT</th><th className="text-left px-4 py-2.5 font-medium">Ngày hẹn</th>
              <th className="text-left px-4 py-2.5 font-medium">Khách hàng</th><th className="text-left px-4 py-2.5 font-medium">Trạng thái</th><th className="text-left px-4 py-2.5 font-medium">Ghi chú</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {appts.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có lịch hẹn.</td></tr>)
                : appts.map((a, i) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.appointment_date}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{a.customer_name}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[a.status] || a.status}</span></td>
                    <td className="px-4 py-2.5 text-slate-400">{a.notes || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doanh thu được gán */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Wallet className="w-4 h-4 text-violet-500" /> Doanh thu được gán</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
              <th className="text-left px-4 py-2.5 font-medium">STT</th><th className="text-left px-4 py-2.5 font-medium">Ngày</th>
              <th className="text-left px-4 py-2.5 font-medium">Khách hàng</th><th className="text-left px-4 py-2.5 font-medium">Dịch vụ</th><th className="text-right px-4 py-2.5 font-medium">Số tiền</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {surgRows.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có doanh thu được gán.</td></tr>)
                : surgRows.map((a, i) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.surgery_date}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{a.customer_name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a.service || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-teal-700">{fmtM(a.revenue)}</td>
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
