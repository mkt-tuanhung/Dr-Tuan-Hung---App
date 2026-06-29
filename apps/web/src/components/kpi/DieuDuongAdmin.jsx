import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { X } from 'lucide-react';
import { computeDieuDuong } from '@/lib/kpiCalc';
import StatCell from '@/components/kpi/StatCell.jsx';

const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const EMPTY = { staff_id: '', target_close_rate: '', note: '' };

// Lọc khách của 1 điều dưỡng theo vai trò
const ROLE_MATCH = {
  truc_dem: (s, id) => s.truc_dem_id === id || s.truc_dem_id_2 === id,
  pm1: (s, id) => s.phu_mo_1_id === id,
  pm2: (s, id) => s.phu_mo_2_id === id,
  pm3: (s, id) => s.phu_mo_3_id === id,
  hau_phau: (s, id) => s.hau_phau_id === id || (s.additional_hau_phau_ids || []).includes(id),
};
const ROLE_LABEL = { truc_dem: 'Trực đêm', pm1: 'Phụ mổ 1', pm2: 'Phụ mổ 2', pm3: 'Phụ mổ 3', hau_phau: 'Hậu phẫu' };

const DieuDuongAdmin = ({ month, year }) => {
  const { profile: me } = useAuth();
  const [subTab, setSubTab] = useState('assign');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null); // { staff, roleKey, items }

  const openDetail = (st, roleKey) => {
    const items = surgeries.filter(s => ROLE_MATCH[roleKey](s, st.id));
    setDetail({ staff: st, roleKey, items });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me2 = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const { data: staffData } = await supabase.from('profiles').select('id, full_name, employee_id, position').or('role.eq.dieu_duong,role_2.eq.dieu_duong').eq('is_active', true).order('full_name');
    const ids = (staffData || []).map(s => s.id);
    const [kpiRes, surgRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('month', month).eq('year', year).in('staff_id', ids.length ? ids : ['x']),
      supabase.from('customer_appointments')
        .select('id, customer_name, surgery_date, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids')
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

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;

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
            <h3 className="font-bold text-teal-700 mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Điều dưỡng</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Điều dưỡng *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400">
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
                <input type="number" step="0.1" value={form.target_close_rate} onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))} placeholder="VD: 95" className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Đánh giá chuyên môn phụ mổ</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="VD: Tốt / Cần cải thiện..." className="w-full px-3 py-2.5 rounded-xl border border-teal-100 bg-teal-50/30 text-sm focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>}
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu KPI Điều dưỡng'}</button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50"><h3 className="font-bold text-slate-700">Bảng thông số Điều dưỡng ({year}-{String(month).padStart(2, '0')})</h3></div>
            <div className="overflow-x-auto hidden md:block">
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
                        <td className="text-center px-3 py-2.5"><button onClick={() => openDetail(r.staff, 'truc_dem')} disabled={!r.trucDem} className="text-orange-600 font-semibold hover:underline disabled:no-underline disabled:text-slate-400">{r.trucDem}</button></td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => openDetail(r.staff, 'pm1')} disabled={!r.pm1} className="text-slate-700 hover:underline hover:text-teal-600 disabled:text-slate-400">{r.pm1}</button></td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => openDetail(r.staff, 'pm2')} disabled={!r.pm2} className="text-slate-700 hover:underline hover:text-teal-600 disabled:text-slate-400">{r.pm2}</button></td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => openDetail(r.staff, 'pm3')} disabled={!r.pm3} className="text-slate-700 hover:underline hover:text-teal-600 disabled:text-slate-400">{r.pm3}</button></td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => openDetail(r.staff, 'hau_phau')} disabled={!r.hauPhau} className="text-pink-600 hover:underline disabled:no-underline disabled:text-slate-400">{r.hauPhau}</button></td>
                        <td className="text-right px-4 py-2.5 text-teal-700 font-bold">{fmtM(r.tongHH)}</td>
                        <td className="text-center px-3 py-2.5"><button onClick={() => editRow(r)} className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.kpi ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>{r.kpi ? 'Sửa' : 'Giao KPI'}</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-50">
              {rows.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Chưa có điều dưỡng.</div>
                : rows.map(r => (
                  <div key={r.staff.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="min-w-0"><div className="font-bold text-slate-800 truncate">{r.staff.full_name}</div><div className="text-[11px] text-slate-400">{r.staff.position || r.staff.employee_id}</div></div>
                      <button onClick={() => editRow(r)} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${r.kpi ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>{r.kpi ? 'Sửa KPI' : 'Giao KPI'}</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <StatCell label="Trực đêm" value={<button onClick={() => openDetail(r.staff, 'truc_dem')} disabled={!r.trucDem} className="text-orange-600 disabled:text-slate-400">{r.trucDem}</button>} />
                      <StatCell label="Phụ mổ 1" value={<button onClick={() => openDetail(r.staff, 'pm1')} disabled={!r.pm1} className="text-slate-700 disabled:text-slate-400">{r.pm1}</button>} />
                      <StatCell label="Phụ mổ 2" value={<button onClick={() => openDetail(r.staff, 'pm2')} disabled={!r.pm2} className="text-slate-700 disabled:text-slate-400">{r.pm2}</button>} />
                      <StatCell label="Phụ mổ 3" value={<button onClick={() => openDetail(r.staff, 'pm3')} disabled={!r.pm3} className="text-slate-700 disabled:text-slate-400">{r.pm3}</button>} />
                      <StatCell label="Hậu phẫu" value={<button onClick={() => openDetail(r.staff, 'hau_phau')} disabled={!r.hauPhau} className="text-pink-600 disabled:text-slate-400">{r.hauPhau}</button>} />
                    </div>
                    <StatCell label="Hoa hồng" value={fmtM(r.tongHH)} className="text-teal-700" />
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {subTab === 'progress' && (
        <>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-teal-700 mb-4">Tổng hoa hồng theo điều dưỡng (VNĐ)</h3>
            <div className="h-72">
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
                      <td className="text-right px-4 py-2.5 font-bold text-teal-700">{fmtM(r.tongHH)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal danh sách khách theo vai trò */}
      {detail && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b bg-teal-50 shrink-0">
              <div>
                <h3 className="font-bold text-teal-800">{ROLE_LABEL[detail.roleKey]} — {detail.staff.full_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{detail.items.length} khách · {MONTHS_SHORT(month)}/{year}</p>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100 sticky top-0"><tr>
                  <th className="text-left px-4 py-2.5 font-medium">STT</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ngày mổ</th>
                  <th className="text-left px-4 py-2.5 font-medium">Khách hàng</th>
                  <th className="text-left px-4 py-2.5 font-medium">Loại PT</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {detail.items.map((s, i) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-600">{s.surgery_date ? new Date(s.surgery_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{s.customer_name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{s.surgery_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MONTHS_SHORT = (m) => `Tháng ${m}`;

export default DieuDuongAdmin;
