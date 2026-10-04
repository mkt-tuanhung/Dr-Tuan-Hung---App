import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { computeSaleOffline, isRecheck } from '@/lib/kpiCalc';
import StatCell from '@/components/kpi/StatCell.jsx';

const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const fmtInput = (v) => { const n = String(v || '').replace(/\D/g, ''); return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; };
const PIE_COLORS = ['#3CA7A9', '#067B7F', '#F4B183']; // Cọc / Phẫu thuật / Bong

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
    return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;
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
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="e-seg">
        {[['assign', 'Giao KPI & Danh sách'], ['progress', 'Theo dõi Tiến độ']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`e-seg-item ${subTab === id ? 'e-seg-active' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === 'assign' && (
        <>
          {/* Form giao KPI */}
          <div className="e-card e-card-pad">
            <h3 className="e-card-title mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Sale Offline</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="e-label">Nhân viên Sale Offline *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="e-input">
                  <option value="">Chọn nhân sự</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="e-label">Tháng áp dụng</label>
                <input disabled value={`Tháng ${month} / ${year}`}
                  className="e-input bg-slate-50 text-slate-500" />
              </div>
              <div>
                <label className="e-label">KPI doanh thu (VNĐ) *</label>
                <input inputMode="numeric" value={fmtInput(form.target_revenue)}
                  onChange={e => setForm(f => ({ ...f, target_revenue: e.target.value.replace(/\D/g, '') }))}
                  placeholder="VD: 300.000.000"
                  className="e-input" />
              </div>
              <div>
                <label className="e-label">KPI tỷ lệ chốt mục tiêu (%) *</label>
                <input type="number" step="0.1" value={form.target_close_rate}
                  onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))}
                  placeholder="VD: 60"
                  className="e-input" />
              </div>
              <div className="md:col-span-2">
                <label className="e-label">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="e-textarea resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="e-btn e-btn-secondary">Hủy</button>}
              <button onClick={handleSave} disabled={saving}
                className="e-btn e-btn-primary">
                {saving ? 'Đang lưu...' : 'Lưu KPI Sale Offline'}
              </button>
            </div>
          </div>

          {/* Bảng thông số */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[16px] font-[650] text-slate-900">Bảng thông số Sale Offline ({year}-{String(month).padStart(2, '0')})</h3>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="e-table whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="text-left">Nhân sự</th>
                    <th className="text-center">Tổng hẹn</th>
                    <th className="text-center">Bong</th>
                    <th className="text-center">Cọc</th>
                    <th className="text-center">Phẫu thuật</th>
                    <th className="text-center">Tỷ lệ chốt</th>
                    <th className="text-right">Doanh thu</th>
                    <th className="text-right">Upsale</th>
                    <th className="text-right">Hoa hồng</th>
                    <th className="text-center">KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">Chưa có nhân sự Sale Offline.</td></tr>
                  ) : rows.map(r => (
                    <tr key={r.staff.id}>
                      <td className="font-semibold text-slate-900">{r.staff.full_name}
                        <div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></td>
                      <td className="text-center font-semibold">{r.total}</td>
                      <td className="text-center text-danger-600">{r.cntBong}</td>
                      <td className="text-center text-info-600">{r.cntCoc}</td>
                      <td className="text-center text-teal-600 font-semibold">{r.cntPT}</td>
                      <td className="text-center font-semibold">{r.closeRate.toFixed(1)}%</td>
                      <td className="text-right text-slate-900 font-semibold">{fmtM(r.doanhThu)}</td>
                      <td className="text-right text-peach-600">{fmtM(r.upsale)}</td>
                      <td className="text-right text-teal-700 font-bold">{fmtM(r.tongHH)}</td>
                      <td className="text-center">
                        <button onClick={() => editRow(r)}
                          className={`e-btn e-btn-sm h-8 ${r.kpi ? 'e-btn-ghost' : 'e-btn-outline'}`}>
                          {r.kpi ? 'Sửa' : 'Giao KPI'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {rows.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Chưa có nhân sự Sale Offline.</div>
                : rows.map(r => (
                  <div key={r.staff.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="min-w-0"><div className="font-semibold text-slate-900 truncate">{r.staff.full_name}</div><div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></div>
                      <button onClick={() => editRow(r)} className={`shrink-0 e-btn e-btn-sm h-8 ${r.kpi ? 'e-btn-ghost' : 'e-btn-outline'}`}>{r.kpi ? 'Sửa KPI' : 'Giao KPI'}</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <StatCell label="Tổng hẹn" value={r.total} />
                      <StatCell label="Bong" value={r.cntBong} className="text-danger-600" />
                      <StatCell label="Cọc" value={r.cntCoc} className="text-info-600" />
                      <StatCell label="Phẫu thuật" value={r.cntPT} className="text-teal-600" />
                      <StatCell label="Tỷ lệ chốt" value={`${r.closeRate.toFixed(1)}%`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell label="Doanh thu" value={fmtM(r.doanhThu)} className="text-slate-900" />
                      <StatCell label="Upsale" value={fmtM(r.upsale)} className="text-peach-600" />
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
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="e-card e-card-pad">
              <h3 className="e-card-title mb-4">Doanh thu theo Sale Offline</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => fmtM(v)} />
                    <Legend />
                    <Bar dataKey="Thực tế" fill="#067B7F" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="KPI" fill="#B8C4CC" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="e-card e-card-pad">
              <h3 className="e-card-title mb-4">Tỷ lệ Cọc / Phẫu thuật / Bong</h3>
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
            <div className="e-card e-card-pad">
              <h3 className="e-card-title mb-4">Tỷ lệ chốt theo Sale Offline (%)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rateChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => v + '%'} />
                    <Legend />
                    <Bar dataKey="Tỷ lệ đạt" fill="#3CA7A9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="KPI" fill="#B8C4CC" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="e-card e-card-pad">
              <h3 className="e-card-title mb-4">Tổng hoa hồng (VNĐ)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hhChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => fmtM(v)} />
                    <Bar dataKey="Hoa hồng" fill="#067B7F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bảng phân tích chi tiết */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[16px] font-[650] text-slate-900">Bảng phân tích chi tiết KPI</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="e-table whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="text-left">Nhân sự</th>
                    <th className="text-center">Tổng hẹn</th>
                    <th className="text-center">PT</th>
                    <th className="text-center">Tỷ lệ chốt</th>
                    <th className="text-center">KPI Tỷ lệ</th>
                    <th className="text-right">Doanh thu</th>
                    <th className="text-right">KPI Doanh thu</th>
                    <th className="text-right">Hoa hồng DT</th>
                    <th className="text-right">HH Upsale</th>
                    <th className="text-right">Tổng HH</th>
                    <th className="text-center">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.staff.id}>
                      <td className="font-semibold text-slate-900">{r.staff.full_name}</td>
                      <td className="text-center">{r.total}</td>
                      <td className="text-center text-teal-600 font-semibold">{r.cntPT}</td>
                      <td className="text-center">{r.closeRate.toFixed(1)}%</td>
                      <td className="text-center text-slate-400">{r.kpi?.target_close_rate ? r.kpi.target_close_rate + '%' : '—'}</td>
                      <td className="text-right text-slate-900">{fmtM(r.doanhThu)}</td>
                      <td className="text-right text-slate-400">{r.kpi?.target_revenue ? fmtM(r.kpi.target_revenue) : '—'}</td>
                      <td className="text-right">{fmtM(r.hhDoanhThu)}</td>
                      <td className="text-right">{fmtM(r.hhUpsale)}</td>
                      <td className="text-right font-bold text-teal-700">{fmtM(r.tongHH)}</td>
                      <td className="text-center">
                        {r.revProgress === null ? <span className="e-badge e-badge-sm e-tone-neutral">Chưa giao</span>
                          : <span className={`e-badge e-badge-sm ${r.revProgress >= 100 ? 'e-tone-success' : r.revProgress >= 70 ? 'e-tone-warning' : 'e-tone-danger'}`}>{r.revProgress}%</span>}
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
