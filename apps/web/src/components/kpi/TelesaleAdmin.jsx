import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { computeTelesale, isRecheck } from '@/lib/kpiCalc';
import StatCell from '@/components/kpi/StatCell.jsx';

const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const fmtInput = (v) => { const n = String(v || '').replace(/\D/g, ''); return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; };
const EMPTY = { staff_id: '', target_appointments: '', target_revenue: '', target_close_rate: '', note: '' };

const TelesaleAdmin = ({ month, year }) => {
  const { profile: me } = useAuth();
  const [subTab, setSubTab] = useState('assign');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [data, setData] = useState({ kpis: [], appts: [], surg: [], bong: [], coc: [], pages: [] });
  const [form, setForm] = useState(EMPTY);

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me2 = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const { data: staffData } = await supabase.from('profiles').select('id, full_name, employee_id').or('role.eq.telesale,role_2.eq.telesale').eq('is_active', true).order('full_name');
    const ids = (staffData || []).map(s => s.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
    const [kpiRes, apptRes, surgRes, bongRes, cocRes, pageRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('month', month).eq('year', year).in('staff_id', safe),
      supabase.from('customer_appointments').select('id, telesale_id, telesale_id_2, status, service').gte('appointment_date', ms).lte('appointment_date', me2),
      supabase.from('customer_appointments').select('id, telesale_id, telesale_id_2, revenue, bong_date, deposit_date, surgery_type').eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', me2),
      supabase.from('customer_appointments').select('id, telesale_id, telesale_id_2, surgery_type').gte('bong_date', ms).lte('bong_date', me2),
      supabase.from('customer_appointments').select('id, telesale_id, telesale_id_2, surgery_type').gte('deposit_date', ms).lte('deposit_date', me2),
      supabase.from('page_daily_reports').select('telesale_id, total_phones').in('telesale_id', safe).gte('date', ms).lte('date', me2),
    ]);
    setStaff(staffData || []);
    setData({
      kpis: kpiRes.data || [],
      appts: (apptRes.data || []).filter(a => !isRecheck(a)),
      surg: surgRes.data || [], bong: bongRes.data || [], coc: cocRes.data || [], pages: pageRes.data || [],
    });
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const rows = staff.map(s => {
    const phones = data.pages.filter(p => p.telesale_id === s.id).reduce((x, p) => x + Number(p.total_phones || 0), 0);
    const mine = (a) => a.telesale_id === s.id || a.telesale_id_2 === s.id;
    const appts = data.appts.filter(mine);
    const surgRows = data.surg.filter(mine);
    const bongRows = data.bong.filter(mine);
    const cocRows = data.coc.filter(mine);
    const m = computeTelesale({ phones, appts, bongRows, cocRows, surgRows });
    const kpi = data.kpis.find(k => k.staff_id === s.id) || null;
    const revProgress = kpi?.target_revenue > 0 ? Math.round(m.doanhThu / kpi.target_revenue * 100) : null;
    return { staff: s, kpi, ...m, revProgress };
  });

  const handleSave = async () => {
    if (!form.staff_id) { toast.error('Chọn nhân viên Telesale'); return; }
    setSaving(true);
    try {
      const payload = {
        staff_id: form.staff_id, month, year,
        target_appointments: Number(form.target_appointments) || 0,
        target_revenue: Number(String(form.target_revenue).replace(/\D/g, '')) || 0,
        target_close_rate: parseFloat(form.target_close_rate) || 0,
        notes: form.note || null, created_by: me?.id, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('kpi_targets').upsert(payload, { onConflict: 'staff_id,month,year' });
      if (error) throw error;
      toast.success('Đã lưu KPI Telesale'); setForm(EMPTY); loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const editRow = (r) => setForm({
    staff_id: r.staff.id, target_appointments: String(r.kpi?.target_appointments || ''),
    target_revenue: String(r.kpi?.target_revenue || ''), target_close_rate: String(r.kpi?.target_close_rate || ''), note: r.kpi?.notes || '',
  });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;

  const revChart = rows.map(r => ({ name: r.staff.full_name, 'Thực tế': r.doanhThu, 'KPI': r.kpi?.target_revenue || 0 }));
  const apptChart = rows.map(r => ({ name: r.staff.full_name, 'Lịch hẹn': r.tongLichHen, 'KPI': r.kpi?.target_appointments || 0 }));
  const hhChart = rows.map(r => ({ name: r.staff.full_name, 'Hoa hồng': r.tongHH }));

  return (
    <div className="space-y-5">
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        {[['assign', 'Giao KPI & Danh sách'], ['progress', 'Theo dõi Tiến độ']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === id ? 'bg-white text-teal-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      {subTab === 'assign' && (
        <>
          <div className="bg-white border border-teal-100 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-teal-700 mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Telesale</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Nhân viên Telesale *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400">
                  <option value="">Chọn nhân sự</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tháng áp dụng</label>
                <input disabled value={`Tháng ${month} / ${year}`} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tổng lịch hẹn (mục tiêu) *</label>
                <input type="number" min="0" value={form.target_appointments} onChange={e => setForm(f => ({ ...f, target_appointments: e.target.value }))} placeholder="VD: 50" className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tỉ lệ chốt hẹn mục tiêu (%) *</label>
                <input type="number" step="0.1" value={form.target_close_rate} onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))} placeholder="VD: 30" className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">KPI doanh thu (VNĐ) *</label>
                <input inputMode="numeric" value={fmtInput(form.target_revenue)} onChange={e => setForm(f => ({ ...f, target_revenue: e.target.value.replace(/\D/g, '') }))} placeholder="VD: 200.000.000" className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ghi chú</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>}
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu KPI Telesale'}</button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Bảng thông số Telesale ({year}-{String(month).padStart(2, '0')})</h3></div>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
                  <th className="text-left px-4 py-2.5 font-medium">Nhân sự</th>
                  <th className="text-center px-3 py-2.5 font-medium">SĐT nhận</th>
                  <th className="text-center px-3 py-2.5 font-medium">Tổng hẹn</th>
                  <th className="text-center px-3 py-2.5 font-medium">Tỷ lệ chốt</th>
                  <th className="text-right px-4 py-2.5 font-medium">Doanh thu</th>
                  <th className="text-right px-4 py-2.5 font-medium">Hoa hồng</th>
                  <th className="text-center px-3 py-2.5 font-medium">KPI</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.length === 0 ? (<tr><td colSpan={7} className="text-center py-8 text-slate-400">Chưa có nhân sự Telesale.</td></tr>)
                    : rows.map(r => (
                      <tr key={r.staff.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}<div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></td>
                        <td className="text-center px-3 py-2.5">{fmt(r.phones)}</td>
                        <td className="text-center px-3 py-2.5 font-semibold">{fmt(r.tongLichHen)}</td>
                        <td className="text-center px-3 py-2.5 font-semibold">{r.tyLeChotHen.toFixed(1)}%</td>
                        <td className="text-right px-4 py-2.5 text-violet-700 font-semibold">{fmtM(r.doanhThu)}</td>
                        <td className="text-right px-4 py-2.5 text-teal-700 font-bold">{fmtM(r.tongHH)}</td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => editRow(r)} className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.kpi ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>{r.kpi ? 'Sửa' : 'Giao KPI'}</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-50">
              {rows.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Chưa có nhân sự Telesale.</div>
                : rows.map(r => (
                  <div key={r.staff.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="min-w-0"><div className="font-bold text-slate-800 truncate">{r.staff.full_name}</div><div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></div>
                      <button onClick={() => editRow(r)} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${r.kpi ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>{r.kpi ? 'Sửa KPI' : 'Giao KPI'}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell label="SĐT nhận" value={fmt(r.phones)} />
                      <StatCell label="Tổng hẹn" value={fmt(r.tongLichHen)} />
                      <StatCell label="Tỷ lệ chốt" value={`${r.tyLeChotHen.toFixed(1)}%`} />
                      <StatCell label="Doanh thu" value={fmtM(r.doanhThu)} className="text-violet-700" />
                      <StatCell label="Hoa hồng" value={fmtM(r.tongHH)} className="text-teal-700" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {subTab === 'progress' && (
        <>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-teal-700 mb-4">Doanh thu theo Telesale</h3>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={revChart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => fmtM(v)} /><Legend /><Bar dataKey="Thực tế" fill="#14b8a6" radius={[4, 4, 0, 0]} /><Bar dataKey="KPI" fill="#cbd5e1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-teal-700 mb-4">Lịch hẹn theo Telesale</h3>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={apptChart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Legend /><Bar dataKey="Lịch hẹn" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="KPI" fill="#cbd5e1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 lg:col-span-2">
              <h3 className="font-bold text-teal-700 mb-4">Tổng hoa hồng (VNĐ)</h3>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={hhChart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => fmtM(v)} /><Bar dataKey="Hoa hồng" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Bảng phân tích chi tiết KPI</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
                  <th className="text-left px-4 py-2.5 font-medium">Nhân sự</th>
                  <th className="text-center px-3 py-2.5 font-medium">SĐT nhận</th>
                  <th className="text-center px-3 py-2.5 font-medium">Tổng hẹn</th>
                  <th className="text-center px-3 py-2.5 font-medium">Tỷ lệ chốt</th>
                  <th className="text-right px-4 py-2.5 font-medium">Doanh thu</th>
                  <th className="text-right px-4 py-2.5 font-medium">Thưởng DT</th>
                  <th className="text-right px-4 py-2.5 font-medium">Thưởng hẹn</th>
                  <th className="text-right px-4 py-2.5 font-medium">Tổng HH</th>
                  <th className="text-center px-3 py-2.5 font-medium">Tiến độ DT</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(r => (
                    <tr key={r.staff.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}</td>
                      <td className="text-center px-3 py-2.5">{fmt(r.phones)}</td>
                      <td className="text-center px-3 py-2.5">{fmt(r.tongLichHen)}</td>
                      <td className="text-center px-3 py-2.5">{r.tyLeChotHen.toFixed(1)}%</td>
                      <td className="text-right px-4 py-2.5 text-violet-700">{fmtM(r.doanhThu)}</td>
                      <td className="text-right px-4 py-2.5">{fmtM(r.thuongDoanhThu)}</td>
                      <td className="text-right px-4 py-2.5">{fmtM(r.thuongLichHen)}</td>
                      <td className="text-right px-4 py-2.5 font-bold text-teal-700">{fmtM(r.tongHH)}</td>
                      <td className="text-center px-3 py-2.5">{r.revProgress === null ? <span className="text-amber-500 text-xs">Chưa giao</span> : <span className={`text-xs font-semibold ${r.revProgress >= 100 ? 'text-teal-600' : r.revProgress >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>{r.revProgress}%</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TelesaleAdmin;
