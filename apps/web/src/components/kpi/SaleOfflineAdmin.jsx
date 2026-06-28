import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { computeSaleOffline, isRecheck } from '@/lib/kpiCalc';

const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const fmtInput = (v) => { const n = String(v || '').replace(/\D/g, ''); return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; };
const PIE_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b']; // Cọc / Phẫu thuật / Bong

const EMPTY = { staff_id: '', target_revenue: '', target_close_rate: '', note: '' };

const SaleOfflineAdmin = ({ month, year }) => {
  const { profile: me } = useAuth();
  const [subTab, setSubTab] = useState('assign'); // assign | progress
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [appts, setAppts] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const loadData = useCallback(async () => {
    setLoading(true);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const { data: staffData } = await supabase.from('profiles')
      .select('id, full_name, employee_id, avatar_url')
      .or('role.eq.sale_offline,role_2.eq.sale_offline').eq('is_active', true).order('full_name');
    const ids = (staffData || []).map(s => s.id);

    const [kpiRes, apptRes, surgRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('month', month).eq('year', year).in('staff_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('customer_appointments')
        .select('id, sale_id, status, service, appointment_date')
        .in('sale_id', ids.length ? ids : ['x'])
        .gte('appointment_date', monthStart).lte('appointment_date', monthEnd),
      supabase.from('customer_appointments')
        .select('id, sale_id, status, service, surgery_date, revenue, upsale_revenue, customer_source')
        .eq('status', 'phau_thuat')
        .in('sale_id', ids.length ? ids : ['x'])
        .gte('surgery_date', monthStart).lte('surgery_date', monthEnd),
    ]);

    setStaff(staffData || []);
    setKpis(kpiRes.data || []);
    setAppts((apptRes.data || []).filter(a => !isRecheck(a)));
    setSurgeries((surgRes.data || []).filter(a => !isRecheck(a)));
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // Gộp số liệu theo từng nhân sự
  const rows = staff.map(s => {
    const a = appts.filter(x => x.sale_id === s.id);
    const surg = surgeries.filter(x => x.sale_id === s.id);
    const m = computeSaleOffline(a, surg);
    const kpi = kpis.find(k => k.staff_id === s.id) || null;
    const revProgress = kpi?.target_revenue > 0 ? Math.round(m.doanhThu / kpi.target_revenue * 100) : null;
    return { staff: s, kpi, ...m, revProgress };
  });

  const handleSave = async () => {
    if (!form.staff_id) { toast.error('Chọn nhân viên Sale Offline'); return; }
    setSaving(true);
    try {
      const payload = {
        staff_id: form.staff_id,
        month, year,
        target_revenue: Number(String(form.target_revenue).replace(/\D/g, '')) || 0,
        target_close_rate: parseFloat(form.target_close_rate) || 0,
        notes: form.note || null,
        created_by: me?.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('kpi_targets').upsert(payload, { onConflict: 'staff_id,month,year' });
      if (error) throw error;
      toast.success('Đã lưu KPI Sale Offline');
      setForm(EMPTY);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const editRow = (r) => setForm({
    staff_id: r.staff.id,
    target_revenue: String(r.kpi?.target_revenue || ''),
    target_close_rate: String(r.kpi?.target_close_rate || ''),
    note: r.kpi?.notes || '',
  });

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;
  }

  // Dữ liệu biểu đồ
  const revChart = rows.map(r => ({ name: r.staff.full_name, 'Thực tế': r.doanhThu, 'KPI': r.kpi?.target_revenue || 0 }));
  const rateChart = rows.map(r => ({ name: r.staff.full_name, 'Tỷ lệ đạt': Number(r.closeRate.toFixed(1)), 'KPI': Number(r.kpi?.target_close_rate || 0) }));
  const hhChart = rows.map(r => ({ name: r.staff.full_name, 'Hoa hồng': r.tongHH }));
  const totalCoc = rows.reduce((s, r) => s + r.cntCoc, 0);
  const totalPT = rows.reduce((s, r) => s + r.cntPT, 0);
  const totalBong = rows.reduce((s, r) => s + r.cntBong, 0);
  const pieData = [
    { name: 'Cọc', value: totalCoc },
    { name: 'Phẫu thuật', value: totalPT },
    { name: 'Bong', value: totalBong },
  ];

  return (
    <div className="space-y-5">
      {/* Sub tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        {[['assign', 'Giao KPI & Danh sách'], ['progress', 'Theo dõi Tiến độ']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === id ? 'bg-white text-teal-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === 'assign' && (
        <>
          {/* Form giao KPI */}
          <div className="bg-white border border-teal-100 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-teal-700 mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Sale Offline</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Nhân viên Sale Offline *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400">
                  <option value="">Chọn nhân sự</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tháng áp dụng</label>
                <input disabled value={`Tháng ${month} / ${year}`}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">KPI doanh thu (VNĐ) *</label>
                <input inputMode="numeric" value={fmtInput(form.target_revenue)}
                  onChange={e => setForm(f => ({ ...f, target_revenue: e.target.value.replace(/\D/g, '') }))}
                  placeholder="VD: 300.000.000"
                  className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">KPI tỷ lệ chốt mục tiêu (%) *</label>
                <input type="number" step="0.1" value={form.target_close_rate}
                  onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))}
                  placeholder="VD: 60"
                  className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>}
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu KPI Sale Offline'}
              </button>
            </div>
          </div>

          {/* Bảng thông số */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="font-bold text-slate-700">Bảng thông số Sale Offline ({year}-{String(month).padStart(2, '0')})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Nhân sự</th>
                    <th className="text-center px-3 py-2.5 font-medium">Tổng hẹn</th>
                    <th className="text-center px-3 py-2.5 font-medium text-red-500">Bong</th>
                    <th className="text-center px-3 py-2.5 font-medium text-blue-500">Cọc</th>
                    <th className="text-center px-3 py-2.5 font-medium text-teal-600">Phẫu thuật</th>
                    <th className="text-center px-3 py-2.5 font-medium">Tỷ lệ chốt</th>
                    <th className="text-right px-4 py-2.5 font-medium">Doanh thu</th>
                    <th className="text-right px-4 py-2.5 font-medium">Upsale</th>
                    <th className="text-right px-4 py-2.5 font-medium">Hoa hồng</th>
                    <th className="text-center px-3 py-2.5 font-medium">KPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">Chưa có nhân sự Sale Offline.</td></tr>
                  ) : rows.map(r => (
                    <tr key={r.staff.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}
                        <div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></td>
                      <td className="text-center px-3 py-2.5 font-semibold">{r.total}</td>
                      <td className="text-center px-3 py-2.5 text-red-500">{r.cntBong}</td>
                      <td className="text-center px-3 py-2.5 text-blue-500">{r.cntCoc}</td>
                      <td className="text-center px-3 py-2.5 text-teal-600 font-semibold">{r.cntPT}</td>
                      <td className="text-center px-3 py-2.5 font-semibold">{r.closeRate.toFixed(1)}%</td>
                      <td className="text-right px-4 py-2.5 text-violet-700 font-semibold">{fmtM(r.doanhThu)}</td>
                      <td className="text-right px-4 py-2.5 text-orange-600">{fmtM(r.upsale)}</td>
                      <td className="text-right px-4 py-2.5 text-teal-700 font-bold">{fmtM(r.tongHH)}</td>
                      <td className="text-center px-3 py-2.5">
                        <button onClick={() => editRow(r)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.kpi ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                          {r.kpi ? 'Sửa' : 'Giao KPI'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {subTab === 'progress' && (
        <>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-teal-700 mb-4">Doanh thu theo Sale Offline</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => fmtM(v)} />
                    <Legend />
                    <Bar dataKey="Thực tế" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="KPI" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-teal-700 mb-4">Tỷ lệ Cọc / Phẫu thuật / Bong</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-teal-700 mb-4">Tỷ lệ chốt theo Sale Offline (%)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rateChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => v + '%'} />
                    <Legend />
                    <Bar dataKey="Tỷ lệ đạt" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="KPI" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-teal-700 mb-4">Tổng hoa hồng (VNĐ)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hhChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => fmtM(v)} />
                    <Bar dataKey="Hoa hồng" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bảng phân tích chi tiết */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="font-bold text-slate-700">Bảng phân tích chi tiết KPI</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Nhân sự</th>
                    <th className="text-center px-3 py-2.5 font-medium">Tổng hẹn</th>
                    <th className="text-center px-3 py-2.5 font-medium">PT</th>
                    <th className="text-center px-3 py-2.5 font-medium">Tỷ lệ chốt</th>
                    <th className="text-center px-3 py-2.5 font-medium">KPI Tỷ lệ</th>
                    <th className="text-right px-4 py-2.5 font-medium">Doanh thu</th>
                    <th className="text-right px-4 py-2.5 font-medium">KPI Doanh thu</th>
                    <th className="text-right px-4 py-2.5 font-medium">Hoa hồng DT</th>
                    <th className="text-right px-4 py-2.5 font-medium">HH Upsale</th>
                    <th className="text-right px-4 py-2.5 font-medium">Tổng HH</th>
                    <th className="text-center px-3 py-2.5 font-medium">Tiến độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(r => (
                    <tr key={r.staff.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}</td>
                      <td className="text-center px-3 py-2.5">{r.total}</td>
                      <td className="text-center px-3 py-2.5 text-teal-600 font-semibold">{r.cntPT}</td>
                      <td className="text-center px-3 py-2.5">{r.closeRate.toFixed(1)}%</td>
                      <td className="text-center px-3 py-2.5 text-slate-400">{r.kpi?.target_close_rate ? r.kpi.target_close_rate + '%' : '—'}</td>
                      <td className="text-right px-4 py-2.5 text-violet-700">{fmtM(r.doanhThu)}</td>
                      <td className="text-right px-4 py-2.5 text-slate-400">{r.kpi?.target_revenue ? fmtM(r.kpi.target_revenue) : '—'}</td>
                      <td className="text-right px-4 py-2.5">{fmtM(r.hhDoanhThu)}</td>
                      <td className="text-right px-4 py-2.5">{fmtM(r.hhUpsale)}</td>
                      <td className="text-right px-4 py-2.5 font-bold text-teal-700">{fmtM(r.tongHH)}</td>
                      <td className="text-center px-3 py-2.5">
                        {r.revProgress === null ? <span className="text-amber-500 text-xs">Chưa giao</span>
                          : <span className={`text-xs font-semibold ${r.revProgress >= 100 ? 'text-teal-600' : r.revProgress >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>{r.revProgress}%</span>}
                      </td>
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

export default SaleOfflineAdmin;
