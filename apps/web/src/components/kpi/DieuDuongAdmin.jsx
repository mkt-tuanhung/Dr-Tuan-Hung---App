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

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>;

  const hhChart = rows.map(r => ({ name: r.staff.full_name, 'Hoa hồng': r.tongHH }));

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
            <h3 className="e-card-title mb-4">{form.staff_id ? 'Cập nhật' : 'Tạo mới'} KPI Điều dưỡng</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="e-label">Điều dưỡng *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} className="e-input">
                  <option value="">Chọn điều dưỡng</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="e-label">Tháng áp dụng</label>
                <input disabled value={`Tháng ${month} / ${year}`} className="e-input bg-slate-50 text-slate-500" />
              </div>
              <div>
                <label className="e-label">Tỉ lệ hài lòng hậu phẫu/trực đêm mục tiêu (%)</label>
                <input type="number" step="0.1" value={form.target_close_rate} onChange={e => setForm(f => ({ ...f, target_close_rate: e.target.value }))} placeholder="VD: 95" className="e-input" />
              </div>
              <div>
                <label className="e-label">Đánh giá chuyên môn phụ mổ</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="VD: Tốt / Cần cải thiện..." className="e-input" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
              {form.staff_id && <button onClick={() => setForm(EMPTY)} className="e-btn e-btn-secondary">Hủy</button>}
              <button onClick={handleSave} disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Lưu KPI Điều dưỡng'}</button>
            </div>
          </div>

          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Bảng thông số Điều dưỡng ({year}-{String(month).padStart(2, '0')})</h3></div>
            <div className="overflow-x-auto hidden md:block">
              <table className="e-table whitespace-nowrap">
                <thead><tr>
                  <th className="text-left">Nhân sự</th>
                  <th className="text-center">Trực đêm</th>
                  <th className="text-center">Phụ mổ 1</th>
                  <th className="text-center">Phụ mổ 2</th>
                  <th className="text-center">Phụ mổ 3</th>
                  <th className="text-center">Hậu phẫu</th>
                  <th className="text-right">Hoa hồng</th>
                  <th className="text-center">KPI</th>
                </tr></thead>
                <tbody>
                  {rows.length === 0 ? (<tr><td colSpan={8} className="text-center py-8 text-slate-400">Chưa có điều dưỡng.</td></tr>)
                    : rows.map(r => (
                      <tr key={r.staff.id}>
                        <td className="font-semibold text-slate-900">{r.staff.full_name}<div className="text-[11px] text-slate-400">{r.staff.position || r.staff.employee_id}</div></td>
                        <td className="text-center"><button onClick={() => openDetail(r.staff, 'truc_dem')} disabled={!r.trucDem} className="text-peach-600 font-semibold hover:underline disabled:no-underline disabled:text-slate-400">{r.trucDem}</button></td>
                        <td className="text-center"><button onClick={() => openDetail(r.staff, 'pm1')} disabled={!r.pm1} className="text-slate-700 hover:underline hover:text-teal-700 disabled:text-slate-400">{r.pm1}</button></td>
                        <td className="text-center"><button onClick={() => openDetail(r.staff, 'pm2')} disabled={!r.pm2} className="text-slate-700 hover:underline hover:text-teal-700 disabled:text-slate-400">{r.pm2}</button></td>
                        <td className="text-center"><button onClick={() => openDetail(r.staff, 'pm3')} disabled={!r.pm3} className="text-slate-700 hover:underline hover:text-teal-700 disabled:text-slate-400">{r.pm3}</button></td>
                        <td className="text-center"><button onClick={() => openDetail(r.staff, 'hau_phau')} disabled={!r.hauPhau} className="text-rose-600 hover:underline disabled:no-underline disabled:text-slate-400">{r.hauPhau}</button></td>
                        <td className="text-right text-teal-700 font-bold">{fmtM(r.tongHH)}</td>
                        <td className="text-center"><button onClick={() => editRow(r)} className={`e-btn e-btn-sm h-8 ${r.kpi ? 'e-btn-ghost' : 'e-btn-outline'}`}>{r.kpi ? 'Sửa' : 'Giao KPI'}</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {rows.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">Chưa có điều dưỡng.</div>
                : rows.map(r => (
                  <div key={r.staff.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="min-w-0"><div className="font-semibold text-slate-900 truncate">{r.staff.full_name}</div><div className="text-[11px] text-slate-400">{r.staff.position || r.staff.employee_id}</div></div>
                      <button onClick={() => editRow(r)} className={`shrink-0 e-btn e-btn-sm h-8 ${r.kpi ? 'e-btn-ghost' : 'e-btn-outline'}`}>{r.kpi ? 'Sửa KPI' : 'Giao KPI'}</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <StatCell label="Trực đêm" value={<button onClick={() => openDetail(r.staff, 'truc_dem')} disabled={!r.trucDem} className="text-peach-600 disabled:text-slate-400">{r.trucDem}</button>} />
                      <StatCell label="Phụ mổ 1" value={<button onClick={() => openDetail(r.staff, 'pm1')} disabled={!r.pm1} className="text-slate-700 disabled:text-slate-400">{r.pm1}</button>} />
                      <StatCell label="Phụ mổ 2" value={<button onClick={() => openDetail(r.staff, 'pm2')} disabled={!r.pm2} className="text-slate-700 disabled:text-slate-400">{r.pm2}</button>} />
                      <StatCell label="Phụ mổ 3" value={<button onClick={() => openDetail(r.staff, 'pm3')} disabled={!r.pm3} className="text-slate-700 disabled:text-slate-400">{r.pm3}</button>} />
                      <StatCell label="Hậu phẫu" value={<button onClick={() => openDetail(r.staff, 'hau_phau')} disabled={!r.hauPhau} className="text-rose-600 disabled:text-slate-400">{r.hauPhau}</button>} />
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
          <div className="e-card e-card-pad">
            <h3 className="e-card-title mb-4">Tổng hoa hồng theo điều dưỡng (VNĐ)</h3>
            <div className="h-72">
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

          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100"><h3 className="text-[16px] font-[650] text-slate-900">Bảng phân tích chi tiết</h3></div>
            <div className="overflow-x-auto">
              <table className="e-table whitespace-nowrap">
                <thead><tr>
                  <th className="text-left">Nhân sự</th>
                  <th className="text-center">Trực đêm</th>
                  <th className="text-right">Thưởng trực đêm</th>
                  <th className="text-center">Phụ mổ (1/2/3)</th>
                  <th className="text-right">Thưởng phụ mổ</th>
                  <th className="text-center">Hậu phẫu</th>
                  <th className="text-right">Tổng HH</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.staff.id}>
                      <td className="font-semibold text-slate-900">{r.staff.full_name}</td>
                      <td className="text-center">{r.trucDem}</td>
                      <td className="text-right">{fmtM(r.thuongTrucDem)}</td>
                      <td className="text-center">{r.pm1}/{r.pm2}/{r.pm3}</td>
                      <td className="text-right">{fmtM(r.thuongPhuMo)}</td>
                      <td className="text-center">{r.hauPhau}</td>
                      <td className="text-right font-bold text-teal-700">{fmtM(r.tongHH)}</td>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="e-modal max-w-lg overflow-hidden flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="e-modal-title">{ROLE_LABEL[detail.roleKey]} — {detail.staff.full_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{detail.items.length} khách · {MONTHS_SHORT(month)}/{year}</p>
              </div>
              <button onClick={() => setDetail(null)} className="e-icon-btn w-8 h-8 rounded-full shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto">
              <table className="e-table">
                <thead className="sticky top-0 z-10"><tr>
                  <th className="text-left">STT</th>
                  <th className="text-left">Ngày mổ</th>
                  <th className="text-left">Khách hàng</th>
                  <th className="text-left">Loại PT</th>
                </tr></thead>
                <tbody>
                  {detail.items.map((s, i) => (
                    <tr key={s.id}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="text-slate-600">{s.surgery_date ? new Date(s.surgery_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td className="font-semibold text-slate-900">{s.customer_name}</td>
                      <td className="text-slate-500">{s.surgery_type || '—'}</td>
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
