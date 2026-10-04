import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { computeTrucPage } from '@/lib/kpiCalc';
import StatCell from '@/components/kpi/StatCell.jsx';

const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const EMPTY = { staff_id: '', target_phones: '', target_close_rate: '', note: '' };

const TrucPageAdmin = ({ month, year }) => {
  const { profile: me } = useAuth();
  const [subTab, setSubTab] = useState('assign');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const loadData = useCallback(async () => {
    setLoading(true);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const { data: staffData } = await supabase.from('profiles')
      .select('id, full_name, employee_id').or('role.eq.truc_page,role_2.eq.truc_page').eq('is_active', true).order('full_name');
    const ids = (staffData || []).map(s => s.id);
    const [kpiRes, repRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('month', month).eq('year', year).in('staff_id', ids.length ? ids : ['x']),
      supabase.from('page_daily_reports').select('*').in('staff_id', ids.length ? ids : ['x']).gte('date', monthStart).lte('date', monthEnd),
    ]);
    setStaff(staffData || []);
    setKpis(kpiRes.data || []);
    setReports(repRes.data || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const rows = staff.map(s => {
    const reps = reports.filter(r => r.staff_id === s.id);
    const m = computeTrucPage(reps);
    const kpi = kpis.find(k => k.staff_id === s.id) || null;
    const phoneProgress = kpi?.target_phones > 0 ? Math.round(m.phones / kpi.target_phones * 100) : null;
    return { staff: s, kpi, ...m, phoneProgress };
  });

  const handleSave = async () => {
    if (!form.staff_id) { toast.error('Chọn nhân viên Trực page'); return; }
    setSaving(true);
    try {
      const payload = {
        staff_id: form.staff_id, month, year,
        target_phones: Number(form.target_phones) || 0,
        target_close_rate: parseFloat(form.target_close_rate) || 0,
        notes: form.note || null, created_by: me?.id, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('kpi_targets').upsert(payload, { onConflict: 'staff_id,month,year' });
      if (error) throw error;
      toast.success('Đã lưu KPI Trực page'); setForm(EMPTY); loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const editRow = (r) => setForm({
    staff_id: r.staff.id, target_phones: String(r.kpi?.target_phones || ''),
    target_close_rate: String(r.kpi?.target_close_rate || ''), note: r.kpi?.notes || '',
  });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;

  const phoneChart = rows.map(r => ({ name: r.staff.full_name, 'Thực tế': r.phones, 'KPI': r.kpi?.target_phones || 0 }));
  const hhChart = rows.map(r => ({ name: r.staff.full_name, 'Hoa hồng': r.hh }));

  return (
    <div className="space-y-4">
      <div className="e-seg">
        {[['assign', 'Giao KPI & Danh sách'], ['progress', 'Theo dõi Tiến độ']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} className={`e-seg-item ${subTab === id ? 'e-seg-active' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {subTab === 'assign' && (
        <>
          <div className="e-card e-card-pad">
            <h3 className="e-card-title mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Trực page</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="e-label">Nhân viên Trực page *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="e-input">
                  <option value="">Chọn nhân sự</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="e-label">Tháng áp dụng</label>
                <input disabled value={`Tháng ${month} / ${year}`} className="e-input bg-slate-50 text-slate-500" />
              </div>
              <div>
                <label className="e-label">Tổng SĐT xin được (mục tiêu) *</label>
                <input type="number" min="0" value={form.target_phones} onChange={e => setForm(f => ({ ...f, target_phones: e.target.value }))}
                  placeholder="VD: 300" className="e-input" />
              </div>
              <div>
                <label className="e-label">Tỉ lệ xin số mục tiêu (%) *</label>
                <input type="number" step="0.1" value={form.target_close_rate} onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))}
                  placeholder="VD: 30" className="e-input" />
              </div>
              <div className="md:col-span-2">
                <label className="e-label">Ghi chú</label>
                <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="e-textarea resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="e-btn e-btn-secondary">Hủy</button>}
              <button onClick={handleSave} disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Lưu KPI Trực page'}</button>
            </div>
          </div>

          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Bảng thông số Trực page ({year}-{String(month).padStart(2, '0')})</h3></div>
            <div className="overflow-x-auto hidden md:block">
              <table className="e-table whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="text-left">Nhân sự</th>
                    <th className="text-center">SĐT xin được</th>
                    <th className="text-center">Quan tâm</th>
                    <th className="text-center">Tin nhắn</th>
                    <th className="text-center">Tỉ lệ xin số</th>
                    <th className="text-right">Hoa hồng</th>
                    <th className="text-center">KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">Chưa có nhân sự Trực page.</td></tr>
                  ) : rows.map(r => (
                    <tr key={r.staff.id}>
                      <td className="font-semibold text-slate-900">{r.staff.full_name}<div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></td>
                      <td className="text-center font-semibold text-teal-700">{fmt(r.phones)}</td>
                      <td className="text-center text-lavender-600">{fmt(r.interested)}</td>
                      <td className="text-center">{fmt(r.messages)}</td>
                      <td className="text-center font-semibold">{r.rate.toFixed(1)}%</td>
                      <td className="text-right text-teal-700 font-bold">{fmtM(r.hh)}</td>
                      <td className="text-center">
                        <button onClick={() => editRow(r)} className={`e-btn e-btn-sm h-8 ${r.kpi ? 'e-btn-ghost' : 'e-btn-outline'}`}>{r.kpi ? 'Sửa' : 'Giao KPI'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {rows.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Chưa có nhân sự Trực page.</div>
                : rows.map(r => (
                  <div key={r.staff.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="min-w-0"><div className="font-semibold text-slate-900 truncate">{r.staff.full_name}</div><div className="text-[11px] text-slate-400">{r.staff.employee_id}</div></div>
                      <button onClick={() => editRow(r)} className={`shrink-0 e-btn e-btn-sm h-8 ${r.kpi ? 'e-btn-ghost' : 'e-btn-outline'}`}>{r.kpi ? 'Sửa KPI' : 'Giao KPI'}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <StatCell label="SĐT xin được" value={fmt(r.phones)} className="text-teal-700" />
                      <StatCell label="Quan tâm" value={fmt(r.interested)} className="text-lavender-600" />
                      <StatCell label="Tin nhắn" value={fmt(r.messages)} />
                      <StatCell label="Tỉ lệ xin số" value={`${r.rate.toFixed(1)}%`} />
                      <StatCell label="Hoa hồng" value={fmtM(r.hh)} className="text-teal-700" />
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
              <h3 className="e-card-title mb-4">SĐT xin được theo nhân sự</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phoneChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip /><Legend />
                    <Bar dataKey="Thực tế" fill="#067B7F" radius={[4, 4, 0, 0]} />
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
                    <Bar dataKey="Hoa hồng" fill="#3CA7A9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Bảng phân tích chi tiết KPI</h3></div>
            <div className="overflow-x-auto">
              <table className="e-table whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="text-left">Nhân sự</th>
                    <th className="text-center">SĐT xin được</th>
                    <th className="text-center">KPI SĐT</th>
                    <th className="text-center">Quan tâm</th>
                    <th className="text-center">Tỉ lệ xin số</th>
                    <th className="text-center">KPI tỉ lệ</th>
                    <th className="text-right">Hoa hồng</th>
                    <th className="text-center">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.staff.id}>
                      <td className="font-semibold text-slate-900">{r.staff.full_name}</td>
                      <td className="text-center text-teal-700 font-semibold">{fmt(r.phones)}</td>
                      <td className="text-center text-slate-400">{r.kpi?.target_phones ? fmt(r.kpi.target_phones) : '—'}</td>
                      <td className="text-center text-lavender-600">{fmt(r.interested)}</td>
                      <td className="text-center">{r.rate.toFixed(1)}%</td>
                      <td className="text-center text-slate-400">{r.kpi?.target_close_rate ? r.kpi.target_close_rate + '%' : '—'}</td>
                      <td className="text-right font-bold text-teal-700">{fmtM(r.hh)}</td>
                      <td className="text-center">
                        {r.phoneProgress === null ? <span className="e-badge e-badge-sm e-tone-neutral">Chưa giao</span>
                          : <span className={`e-badge e-badge-sm ${r.phoneProgress >= 100 ? 'e-tone-success' : r.phoneProgress >= 70 ? 'e-tone-warning' : 'e-tone-danger'}`}>{r.phoneProgress}%</span>}
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

export default TrucPageAdmin;
