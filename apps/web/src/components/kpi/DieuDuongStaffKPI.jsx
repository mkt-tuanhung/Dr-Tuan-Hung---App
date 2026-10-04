import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Moon, Scissors, HeartPulse, Smile, Target, Coins } from 'lucide-react';
import { computeDieuDuong, computePartner } from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';

const ACCENTS = { orange: 'bg-peach-50 text-peach-600', blue: 'bg-info-50 text-info-600', violet: 'bg-lavender-50 text-lavender-600', emerald: 'bg-teal-50 text-teal-700', pink: 'bg-rose-50 text-rose-600' };
const Card = ({ icon: Icon, label, value, sub, accent = 'emerald' }) => (
<div className="e-metric flex-col lg:flex-row items-start p-3.5 lg:p-4 gap-2.5 lg:gap-3">
    <span className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full grid place-items-center shrink-0 ${ACCENTS[accent]}`}><Icon className="w-5 h-5" /></span>
    <div className="min-w-0 w-full lg:w-auto">
      <div className="e-metric-label whitespace-normal text-[12.5px] lg:text-[13px]">{label}</div>
      <div className="text-[18px] lg:text-[20px] font-bold text-slate-900 leading-tight tabular-nums break-words mt-0.5">{value}</div>
      {sub && <div className="text-[11.5px] text-slate-400 mt-1">{sub}</div>}
    </div>
  </div>
);

const roleBadgeClass = (role) =>
  role === 'Trực đêm' ? 'e-tone-lavender'
  : role === 'Hậu phẫu' ? 'e-tone-rose'
  : role.startsWith('Phụ mổ') ? 'e-tone-brand'
  : 'e-tone-neutral';

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
  const [partner, setPartner] = useState([]);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const [kpiRes, surgRes, partnerRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('staff_id', profile.id).eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('customer_appointments')
        .select('id, customer_name, surgery_date, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids')
        .eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', me).order('surgery_date', { ascending: false }),
      supabase.from('partner_surgeries')
        .select('customer_name, partner_name, surgery_date, surgery_type, partner_fee, bac_si_id, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id')
        .gte('surgery_date', ms).lte('surgery_date', me).order('surgery_date', { ascending: false }),
    ]);
    if (surgRes.error) toast.error('Lỗi tải ca phẫu thuật: ' + surgRes.error.message);
    setKpi(kpiRes.data || null);
    setSurgeries(surgRes.data || []);
    setPartner(partnerRes.data || []);
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const id = profile?.id;
  const r = computeDieuDuong(surgeries, id);
  const partnerR = computePartner(partner, id);       // phụ mổ ca đối tác
  const tongHHAll = r.tongHH + partnerR.phuMoBonus;
  // Các ca có liên quan tới điều dưỡng này
  const myCases = surgeries.filter(s =>
    s.truc_dem_id === id || s.truc_dem_id_2 === id || s.phu_mo_1_id === id || s.phu_mo_2_id === id || s.phu_mo_3_id === id ||
    s.hau_phau_id === id || (s.additional_hau_phau_ids || []).includes(id));
  const myPartnerCases = partner.filter(s => s.phu_mo_1_id === id || s.phu_mo_2_id === id || s.phu_mo_3_id === id);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-4 lg:block lg:space-y-4">
      {/* Header + month nav (điện thoại: chỉ còn bộ chuyển tháng to, dễ bấm) */}
      <div className="e-toolbar justify-between pl-2.5 lg:pl-4 -order-2">
        <div className="hidden lg:block">
          <h2 className="text-[15px] font-semibold text-slate-900">KPI của tôi · Điều dưỡng</h2>
          <p className="e-page-desc">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
          <button onClick={prevMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng trước"><ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <span className="flex flex-col items-center lg:block min-w-[104px] text-center">
            <span className="block text-[15px] lg:text-[13.5px] font-semibold text-slate-800 tabular-nums">{MONTHS[month - 1]} {year}</span>
            <span className="lg:hidden text-[12px] text-slate-500 mt-0.5">KPI Điều dưỡng</span>
          </span>
          <button onClick={nextMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng sau"><ChevronRight className="w-5 h-5 lg:w-4 lg:h-4" /></button>
        </div>
      </div>

      {/* KPI được giao */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><Target className="w-4 h-4 text-teal-700 lg:text-current" /> KPI tháng được giao</h3></div>
        <div className="p-4 lg:p-5 grid sm:grid-cols-2 gap-2 lg:gap-3 text-sm">
          <div className="e-subtle p-3">
            <div className="text-slate-400 text-xs">Tỉ lệ hài lòng mục tiêu</div>
            <div className="font-bold text-slate-800 mt-0.5">{kpi?.target_close_rate ? Number(kpi.target_close_rate).toFixed(1) + '%' : '— (chưa giao)'}</div>
          </div>
          <div className="e-subtle p-3">
            <div className="text-slate-400 text-xs">Đánh giá chuyên môn phụ mổ</div>
            <div className="font-medium text-slate-700 mt-0.5">{kpi?.notes || '— (chưa có)'}</div>
          </div>
        </div>
      </div>

      {/* Chỉ số (điện thoại: đưa lên đầu, thẻ hoa hồng làm thẻ chính) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 -order-1">
        <Card icon={Moon} label="Ca trực đêm" value={fmt(r.trucDem)} accent="orange" />
        <Card icon={Scissors} label="Phụ mổ 1" value={fmt(r.pm1)} accent="blue" />
        <Card icon={Scissors} label="Phụ mổ 2" value={fmt(r.pm2)} accent="violet" />
        <Card icon={Scissors} label="Phụ mổ 3" value={fmt(r.pm3)} accent="emerald" />
        <Card icon={HeartPulse} label="Ca hậu phẫu" value={fmt(r.hauPhau)} accent="pink" />
        <Card icon={Smile} label="Tỉ lệ hài lòng" value="—" sub="Dữ liệu cập nhật sau" accent="emerald" />
        <div className="col-span-2 -order-1 lg:order-none e-card e-card-pad bg-teal-50 border-teal-100 flex flex-col justify-center">
          <div className="e-caption text-teal-700">Tổng hoa hồng ước tính</div>
          <div className="text-[28px] font-bold text-teal-800 mt-1 tabular-nums">{fmtM(tongHHAll)}</div>
          <div className="text-[12px] text-slate-600 mt-1">Trực đêm {fmtM(r.thuongTrucDem)} + Phụ mổ {fmtM(r.thuongPhuMo)}{partnerR.phuMoBonus ? ` + Phụ mổ đối tác ${fmtM(partnerR.phuMoBonus)}` : ''}</div>
        </div>
      </div>

      {/* Ghi chú cách tính */}
      <div className="e-subtle p-4 text-[12.5px] text-slate-500 space-y-1">
        <div className="font-semibold text-slate-600">Cách tính thưởng:</div>
        <div>• <b>Trực đêm</b>: 500.000đ / khách.</div>
        <div>• <b>Phụ mổ — Đại phẫu</b>: P1 500k · P2 250k · P3 150k / khách.</div>
        <div>• <b>Phụ mổ — Tiểu phẫu</b>: P1 300k · P2 150k · P3 100k / khách.</div>
        <div>• Hậu phẫu: tính số ca (chưa có thưởng riêng).</div>
      </div>

      {/* Ca của tôi */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Ca của tôi trong tháng</h3></div>

        {myCases.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Chưa có ca nào trong tháng.</div>
        ) : (
          <>
            {/* Desktop: bảng */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="e-table whitespace-nowrap">
                <thead><tr>
                  <th className="text-left">Ngày mổ</th>
                  <th className="text-left">Khách hàng</th>
                  <th className="text-left">Loại PT</th>
                  <th className="text-left">Vai trò</th>
                  <th className="text-right">Thưởng</th>
                </tr></thead>
                <tbody>
                  {myCases.map(s => {
                    const [role, bonus] = ROLE_OF(s, id, s.surgery_type === 'Đại phẫu');
                    return (
                      <tr key={s.id}>
                        <td className="text-slate-600">{s.surgery_date}</td>
                        <td className="font-semibold text-slate-900">{s.customer_name}</td>
                        <td className="text-slate-500">{s.surgery_type || '—'}</td>
                        <td className="align-middle"><span className={`e-badge e-badge-sm ${roleBadgeClass(role)}`}>{role}</span></td>
                        <td className="text-right font-semibold text-teal-700">{bonus ? fmtM(bonus) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Điện thoại: thẻ */}
            <div className="lg:hidden divide-y divide-slate-100">
              {myCases.map(s => {
                const [role, bonus] = ROLE_OF(s, id, s.surgery_type === 'Đại phẫu');
                return (
                  <div key={s.id} className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 grid place-items-center shrink-0"><Scissors className="w-[18px] h-[18px]" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-semibold text-slate-900 truncate">{s.customer_name}</div>
                        <div className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums">{s.surgery_date} · {s.surgery_type || '—'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`e-badge e-badge-sm ${roleBadgeClass(role)}`}>{role}</span>
                        <div className="text-[14px] font-bold text-teal-700 mt-1 tabular-nums">{bonus ? fmtM(bonus) : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Ca mổ đối tác của tôi (phụ mổ) */}
      {myPartnerCases.length > 0 && (
        <div className="e-card overflow-hidden">
          <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Ca mổ đối tác (phụ mổ)</h3></div>
          <div className="divide-y divide-slate-50">
            {myPartnerCases.map((s, i) => {
              const major = s.surgery_type === 'Đại phẫu';
              const role = s.phu_mo_1_id === id ? ['Phụ mổ 1', major ? 500000 : 300000]
                : s.phu_mo_2_id === id ? ['Phụ mổ 2', major ? 250000 : 150000]
                : ['Phụ mổ 3', major ? 150000 : 100000];
              return (
                <div key={i} className="px-4 py-3.5 lg:p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{s.customer_name}{s.partner_name ? <span className="text-[11px] text-peach-600"> · {s.partner_name}</span> : ''}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.surgery_date} · {s.surgery_type || '—'} · {role[0]}</div>
                  </div>
                  <div className="text-sm font-bold text-teal-700 shrink-0">{fmtM(role[1])}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DieuDuongStaffKPI;
