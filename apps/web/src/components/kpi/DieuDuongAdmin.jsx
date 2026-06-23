import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { computeDieuDuong } from '@/lib/kpiCalc';

const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const EMPTY = { staff_id: '', target_close_rate: '', note: '' };

const DieuDuongAdmin = ({ month, year }) => {
  const { profile: me } = useAuth();
  const [subTab, setSubTab] = useState('assign');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me2 = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const { data: staffData } = await supabase.from('profiles').select('id, full_name, employee_id, position').eq('role', 'dieu_duong').eq('is_active', true).order('full_name');
    const ids = (staffData || []).map(s => s.id);
    const [kpiRes, surgRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('month', month).eq('year', year).in('staff_id', ids.length ? ids : ['x']),
      supabase.from('customer_appointments')
        .select('id, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, hau_phau_id, additional_hau_phau_ids')
        .eq('status', 'phau_thuat').gte('surgery_date', ms).lte('surgery_date', me2),
    ]);
    setStaff(staffData || []);
    setKpis(kpiRes.data || []);
    setSurgeries(surgRes.data || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const rows = staff.map(s => {
    const m = computeDieuDuong(surgeries, s.id);
    const kpi = kpis.find(k => k.staff_id === s.id) || null;
    return { staff: s, kpi, ...m };
  });

  const handleSave = async () => {
    if (!form.staff_id) { toast.error('Chọn điều dưỡng'); return; }
    setSaving(true);
    try {
      const payload = {
        staff_id: form.staff_id, month, year,
        target_close_rate: parseFloat(form.target_close_rate) || 0,
        notes: form.note || null, created_by: me?.id, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('kpi_targets').upsert(payload, { onConflict: 'staff_id,month,year' });
      if (error) throw error;
      toast.success('Đã lưu KPI Điều dưỡng'); setForm(EMPTY); loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const editRow = (r) => setForm({ staff_id: r.staff.id, target_close_rate: String(r.kpi?.target_close_rate || ''), note: r.kpi?.notes || '' });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;

  const hhChart = rows.map(r => ({ name: r.staff.full_name, 'Hoa hồng': r.tongHH }));

  return (
    <div className="space-y-5">
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        {[['assign', 'Giao KPI & Danh sách'], ['progress', 'Theo dõi Tiến độ']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === id ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      {subTab === 'assign' && (
        <>
          <div className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-emerald-700 mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Điều dưỡng</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Điều dưỡng *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400">
                  <option value="">Chọn điều dưỡng</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tháng áp dụng</label>
                <input disabled value={`Tháng ${month} / ${year}`} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tỉ lệ hài lòng hậu phẫu/trực đêm mục tiêu (%)</label>
                <input type="number" step="0.1" value={form.target_close_rate} onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))} placeholder="VD: 95" className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Đánh giá chuyên môn phụ mổ</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="VD: Tốt / Cần cải thiện..." className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>}
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu KPI Điều dưỡng'}</button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Bảng thông số Điều dưỡng ({year}-{String(month).padStart(2, '0')})</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
                  <th className="text-left px-4 py-2.5 font-medium">Nhân sự</th>
                  <th className="text-center px-3 py-2.5 font-medium">Trực đêm</th>
                  <th className="text-center px-3 py-2.5 font-medium">Phụ mổ 1</th>
                  <th className="text-center px-3 py-2.5 font-medium">Phụ mổ 2</th>
                  <th className="text-center px-3 py-2.5 font-medium">Phụ mổ 3</th>
                  <th className="text-center px-3 py-2.5 font-medium">Hậu phẫu</th>
                  <th className="text-right px-4 py-2.5 font-medium">Hoa hồng</th>
                  <th className="text-center px-3 py-2.5 font-medium">KPI</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.length === 0 ? (<tr><td colSpan={8} className="text-center py-8 text-slate-400">Chưa có điều dưỡng.</td></tr>)
                    : rows.map(r => (
                      <tr key={r.staff.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}<div className="text-[11px] text-slate-400">{r.staff.position || r.staff.employee_id}</div></td>
                        <td className="text-center px-3 py-2.5 text-orange-600 font-semibold">{r.trucDem}</td>
                        <td className="text-center px-3 py-2.5">{r.pm1}</td>
                        <td className="text-center px-3 py-2.5">{r.pm2}</td>
                        <td className="text-center px-3 py-2.5">{r.pm3}</td>
                        <td className="text-center px-3 py-2.5 text-pink-600">{r.hauPhau}</td>
                        <td className="text-right px-4 py-2.5 text-emerald-700 font-bold">{fmtM(r.tongHH)}</td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => editRow(r)} className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.kpi ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>{r.kpi ? 'Sửa' : 'Giao KPI'}</button></td>
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
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-emerald-700 mb-4">Tổng hoa hồng theo điều dưỡng (VNĐ)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hhChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => (v / 1000000) + 'tr'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => fmtM(v)} />
                  <Bar dataKey="Hoa hồng" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Bảng phân tích chi tiết</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100"><tr>
                  <th className="text-left px-4 py-2.5 font-medium">Nhân sự</th>
                  <th className="text-center px-3 py-2.5 font-medium">Trực đêm</th>
                  <th className="text-right px-4 py-2.5 font-medium">Thưởng trực đêm</th>
                  <th className="text-center px-3 py-2.5 font-medium">Phụ mổ (1/2/3)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Thưởng phụ mổ</th>
                  <th className="text-center px-3 py-2.5 font-medium">Hậu phẫu</th>
                  <th className="text-right px-4 py-2.5 font-medium">Tổng HH</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(r => (
                    <tr key={r.staff.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.staff.full_name}</td>
                      <td className="text-center px-3 py-2.5">{r.trucDem}</td>
                      <td className="text-right px-4 py-2.5">{fmtM(r.thuongTrucDem)}</td>
                      <td className="text-center px-3 py-2.5">{r.pm1}/{r.pm2}/{r.pm3}</td>
                      <td className="text-right px-4 py-2.5">{fmtM(r.thuongPhuMo)}</td>
                      <td className="text-center px-3 py-2.5">{r.hauPhau}</td>
                      <td className="text-right px-4 py-2.5 font-bold text-emerald-700">{fmtM(r.tongHH)}</td>
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

export default DieuDuongAdmin;
