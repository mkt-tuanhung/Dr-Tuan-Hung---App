import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Moon, Scissors, HeartPulse, Smile, Target, Coins } from 'lucide-react';
import { computeDieuDuong } from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';

const ACCENTS = { orange: 'bg-orange-50 text-orange-600', blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600', pink: 'bg-pink-50 text-pink-600' };
const Card = ({ icon: Icon, label, value, sub, accent = 'emerald' }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ACCENTS[accent]}`}><Icon className="w-3.5 h-3.5" /></span>{label}
    </div>
    <div className="text-2xl font-black text-slate-800 mt-2">{value}</div>
    {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
  </div>
);

const ROLE_OF = (s, id, major) => {
  // Trả về [nhãn vai trò, thưởng] của điều dưỡng trong 1 ca
  if (s.truc_dem_id === id || s.truc_dem_id_2 === id) return ['Trực đêm', 500000];
  if (s.phu_mo_1_id === id) return ['Phụ mổ 1', major ? 500000 : 300000];
  if (s.phu_mo_2_id === id) return ['Phụ mổ 2', major ? 250000 : 150000];
  if (s.phu_mo_3_id === id) return ['Phụ mổ 3', major ? 150000 : 100000];
  if (s.hau_phau_id === id || (s.additional_hau_phau_ids || []).includes(id)) return ['Hậu phẫu', 0];
  return ['—', 0];
};

const DieuDuongStaffKPI = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [surgeries, setSurgeries] = useState([]);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const [kpiRes, surgRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('staff_id', profile.id).eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('customer_appointments')
        .select('id, customer_name, surgery_date, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids')
        .eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', me).order('surgery_date', { ascending: false }),
    ]);
    if (surgRes.error) toast.error('Lỗi tải ca phẫu thuật: ' + surgRes.error.message);
    setKpi(kpiRes.data || null);
    setSurgeries(surgRes.data || []);
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const id = profile?.id;
  const r = computeDieuDuong(surgeries, id);
  // Các ca có liên quan tới điều dưỡng này
  const myCases = surgeries.filter(s =>
    s.truc_dem_id === id || s.truc_dem_id_2 === id || s.phu_mo_1_id === id || s.phu_mo_2_id === id || s.phu_mo_3_id === id ||
    s.hau_phau_id === id || (s.additional_hau_phau_ids || []).includes(id));

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">KPI của tôi · Điều dưỡng</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="text-sm font-medium text-slate-700 min-w-[96px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {/* KPI được giao */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-emerald-700 flex items-center gap-2"><Target className="w-4 h-4" /> KPI tháng được giao</h3></div>
        <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-slate-400 text-xs">Tỉ lệ hài lòng mục tiêu</div>
            <div className="font-bold text-slate-800 mt-0.5">{kpi?.target_close_rate ? Number(kpi.target_close_rate).toFixed(1) + '%' : '— (chưa giao)'}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-slate-400 text-xs">Đánh giá chuyên môn phụ mổ</div>
            <div className="font-medium text-slate-700 mt-0.5">{kpi?.notes || '— (chưa có)'}</div>
          </div>
        </div>
      </div>

      {/* Chỉ số */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Moon} label="Ca trực đêm" value={fmt(r.trucDem)} accent="orange" />
        <Card icon={Scissors} label="Phụ mổ 1" value={fmt(r.pm1)} accent="blue" />
        <Card icon={Scissors} label="Phụ mổ 2" value={fmt(r.pm2)} accent="violet" />
        <Card icon={Scissors} label="Phụ mổ 3" value={fmt(r.pm3)} accent="emerald" />
        <Card icon={HeartPulse} label="Ca hậu phẫu" value={fmt(r.hauPhau)} accent="pink" />
        <Card icon={Smile} label="Tỉ lệ hài lòng" value="—" sub="Dữ liệu cập nhật sau" accent="emerald" />
        <div className="col-span-2 bg-gradient-to-br from-rose-500 to-orange-500 text-white rounded-2xl p-4 shadow-md flex flex-col justify-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/90">Tổng hoa hồng ước tính</div>
          <div className="text-3xl font-black mt-1">{fmtM(r.tongHH)}</div>
          <div className="text-xs text-white/80 mt-1">Trực đêm {fmtM(r.thuongTrucDem)} + Phụ mổ {fmtM(r.thuongPhuMo)}</div>
        </div>
      </div>

      {/* Ghi chú cách tính */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-600">Cách tính thưởng:</div>
        <div>• <b>Trực đêm</b>: 500.000đ / khách.</div>
        <div>• <b>Phụ mổ — Đại phẫu</b>: P1 500k · P2 250k · P3 150k / khách.</div>
        <div>• <b>Phụ mổ — Tiểu phẫu</b>: P1 300k · P2 150k · P3 100k / khách.</div>
        <div>• Hậu phẫu: tính số ca (chưa có thưởng riêng).</div>
      </div>

      {/* Bảng ca của tôi */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Ca của tôi trong tháng</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
              <th className="text-left px-4 py-2.5 font-medium">Ngày mổ</th>
              <th className="text-left px-4 py-2.5 font-medium">Khách hàng</th>
              <th className="text-left px-4 py-2.5 font-medium">Loại PT</th>
              <th className="text-left px-4 py-2.5 font-medium">Vai trò</th>
              <th className="text-right px-4 py-2.5 font-medium">Thưởng</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {myCases.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có ca nào trong tháng.</td></tr>)
                : myCases.map(s => {
                  const [role, bonus] = ROLE_OF(s, id, s.surgery_type === 'Đại phẫu');
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-600">{s.surgery_date}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{s.customer_name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{s.surgery_type || '—'}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${role === 'Trực đêm' ? 'bg-violet-100 text-violet-700' : role === 'Hậu phẫu' ? 'bg-pink-100 text-pink-700' : role.startsWith('Phụ mổ') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{role}</span></td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{bonus ? fmtM(bonus) : '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DieuDuongStaffKPI;
