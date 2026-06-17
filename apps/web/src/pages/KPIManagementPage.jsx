import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Search, Plus, Pencil, X, Target, TrendingUp, Users, Phone } from 'lucide-react';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH',
  truc_page: 'Trực Page', media: 'Media', marketing: 'Marketing',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán',
};

const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const fmtM = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—';
const pct = (actual, target) => target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;

const ProgressBar = ({ value, color = 'bg-emerald-500' }) => (
  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
    <div className={`h-1.5 rounded-full transition-all ${color} ${value >= 100 ? 'bg-emerald-500' : value >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
      style={{ width: `${Math.min(value, 100)}%` }} />
  </div>
);

const EMPTY_FORM = {
  staff_id: '', month: '', year: '',
  target_revenue: '', target_customers: '', target_calls: '',
  actual_revenue: '', actual_customers: '', actual_calls: '',
  commission_rate: '', note: '',
};

const fmtInput = (val) => {
  const num = String(val || '').replace(/\D/g, '');
  return num ? new Intl.NumberFormat('vi-VN').format(num) : '';
};

const KPIManagementPage = () => {
  const { profile: me } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [kpiList, setKpiList] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [kpiRes, staffRes] = await Promise.all([
      supabase.from('kpi_targets').select('*, profiles(full_name, employee_id, avatar_url, role)')
        .eq('month', month).eq('year', year).order('created_at'),
      supabase.from('profiles').select('id, full_name, employee_id, role, avatar_url').eq('is_active', true).order('full_name'),
    ]);
    setKpiList(kpiRes.data || []);
    setStaff(staffRes.data || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, month: String(month), year: String(year) });
    setModalOpen(true);
  };

  const openEdit = (kpi) => {
    setEditTarget(kpi);
    setForm({
      staff_id: kpi.staff_id,
      month: String(kpi.month),
      year: String(kpi.year),
      target_revenue: String(kpi.target_revenue || ''),
      target_customers: String(kpi.target_customers || ''),
      target_calls: String(kpi.target_calls || ''),
      actual_revenue: String(kpi.actual_revenue || ''),
      actual_customers: String(kpi.actual_customers || ''),
      actual_calls: String(kpi.actual_calls || ''),
      commission_rate: String(kpi.commission_rate || ''),
      note: kpi.note || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.staff_id) { toast.error('Chọn nhân sự'); return; }
    setSaving(true);
    try {
      const targetRevenue = Number(String(form.target_revenue).replace(/\D/g, '')) || 0;
      const actualRevenue = Number(String(form.actual_revenue).replace(/\D/g, '')) || 0;
      const commissionRate = parseFloat(form.commission_rate) || 0;
      const commissionAmount = Math.round(actualRevenue * commissionRate / 100);

      const data = {
        staff_id: form.staff_id,
        month: Number(form.month),
        year: Number(form.year),
        target_revenue: targetRevenue,
        target_customers: Number(form.target_customers) || 0,
        target_calls: Number(form.target_calls) || 0,
        actual_revenue: actualRevenue,
        actual_customers: Number(form.actual_customers) || 0,
        actual_calls: Number(form.actual_calls) || 0,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        note: form.note || null,
        updated_at: new Date().toISOString(),
      };

      if (editTarget) {
        const { error } = await supabase.from('kpi_targets').update(data).eq('id', editTarget.id);
        if (error) throw error;
        toast.success('Đã cập nhật KPI');
      } else {
        const { error } = await supabase.from('kpi_targets').insert({ ...data, created_by: me?.id });
        if (error) throw error;
        toast.success('Đã tạo KPI');
      }
      setModalOpen(false);
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const filtered = kpiList.filter(k =>
    k.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    k.profiles?.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  // Staff chưa có KPI tháng này
  const staffWithKpi = new Set(kpiList.map(k => k.staff_id));
  const staffWithoutKpi = staff.filter(s => !staffWithKpi.has(s.id));

  const totalRevenue = kpiList.reduce((s, k) => s + (k.actual_revenue || 0), 0);
  const totalTarget = kpiList.reduce((s, k) => s + (k.target_revenue || 0), 0);
  const totalCommission = kpiList.reduce((s, k) => s + (k.commission_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">KPI & Hoa hồng</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-800">{fmtM(totalRevenue)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Doanh thu thực tế</div>
          <ProgressBar value={pct(totalRevenue, totalTarget)} />
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-800">{fmtM(totalTarget)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Mục tiêu tháng</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-lg font-bold text-slate-800">{fmtM(totalCommission)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Tổng hoa hồng</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-emerald-100 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
            placeholder="Tìm nhân sự..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600">
          <Plus className="w-4 h-4" /> Thêm KPI
        </button>
      </div>

      {/* KPI list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm">
          Chưa có KPI nào trong tháng này
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(k => {
            const revPct = pct(k.actual_revenue, k.target_revenue);
            const custPct = pct(k.actual_customers, k.target_customers);
            const callPct = pct(k.actual_calls, k.target_calls);
            return (
              <div key={k.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      {k.profiles?.avatar_url ? (
                        <img src={k.profiles.avatar_url} alt={k.profiles.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-emerald-500">{k.profiles?.full_name?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{k.profiles?.full_name}</div>
                      <div className="text-xs text-slate-400">{ROLE_LABELS[k.profiles?.role] || k.profiles?.role} · {k.profiles?.employee_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${revPct >= 100 ? 'bg-emerald-100 text-emerald-700' : revPct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                      {revPct}%
                    </div>
                    <button onClick={() => openEdit(k)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Doanh thu</div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">{fmtM(k.actual_revenue)}</div>
                    <div className="text-[10px] text-slate-400">/ {fmtM(k.target_revenue)}</div>
                    <ProgressBar value={revPct} />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" /> Khách hàng</div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">{fmt(k.actual_customers)}</div>
                    <div className="text-[10px] text-slate-400">/ {fmt(k.target_customers)}</div>
                    <ProgressBar value={custPct} />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> Cuộc gọi</div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">{fmt(k.actual_calls)}</div>
                    <div className="text-[10px] text-slate-400">/ {fmt(k.target_calls)}</div>
                    <ProgressBar value={callPct} />
                  </div>
                </div>

                {(k.commission_amount > 0) && (
                  <div className="mt-3 flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-emerald-600">Hoa hồng ({k.commission_rate}%)</span>
                    <span className="text-sm font-bold text-emerald-700">{fmtM(k.commission_amount)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Staff without KPI notice */}
      {staffWithoutKpi.length > 0 && !search && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
          <div className="text-xs font-semibold text-yellow-700 mb-2">{staffWithoutKpi.length} nhân sự chưa có KPI tháng này:</div>
          <div className="flex flex-wrap gap-2">
            {staffWithoutKpi.map(s => (
              <button key={s.id} onClick={() => {
                setEditTarget(null);
                setForm({ ...EMPTY_FORM, staff_id: s.id, month: String(month), year: String(year) });
                setModalOpen(true);
              }} className="text-xs bg-white border border-yellow-200 text-yellow-700 px-2.5 py-1 rounded-full hover:bg-yellow-100 transition-colors">
                + {s.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">{editTarget ? 'Cập nhật KPI' : 'Thêm KPI mới'}</h3>
              <button onClick={() => setModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Staff select */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Nhân sự</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  disabled={!!editTarget}
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400">
                  <option value="">-- Chọn nhân sự --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
                </select>
              </div>

              {/* Month/Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Tháng</label>
                  <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400">
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Năm</label>
                  <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                </div>
              </div>

              {/* Targets */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chỉ tiêu</div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Doanh thu mục tiêu (đ)</label>
                  <input type="text" inputMode="numeric"
                    value={fmtInput(form.target_revenue)}
                    onChange={e => setForm(f => ({ ...f, target_revenue: e.target.value.replace(/\D/g,'') }))}
                    placeholder="VD: 50.000.000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Số khách hàng</label>
                    <input type="number" value={form.target_customers}
                      onChange={e => setForm(f => ({ ...f, target_customers: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Số cuộc gọi</label>
                    <input type="number" value={form.target_calls}
                      onChange={e => setForm(f => ({ ...f, target_calls: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Actuals */}
              <div className="bg-emerald-50/40 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Thực tế</div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Doanh thu thực tế (đ)</label>
                  <input type="text" inputMode="numeric"
                    value={fmtInput(form.actual_revenue)}
                    onChange={e => setForm(f => ({ ...f, actual_revenue: e.target.value.replace(/\D/g,'') }))}
                    placeholder="VD: 45.000.000"
                    className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Khách hàng thực tế</label>
                    <input type="number" value={form.actual_customers}
                      onChange={e => setForm(f => ({ ...f, actual_customers: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Cuộc gọi thực tế</label>
                    <input type="number" value={form.actual_calls}
                      onChange={e => setForm(f => ({ ...f, actual_calls: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Commission */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tỷ lệ hoa hồng (%)</label>
                <input type="number" step="0.1" value={form.commission_rate}
                  onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                  placeholder="VD: 5"
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
                {form.commission_rate && form.actual_revenue && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Hoa hồng: {fmtM(Math.round(Number(String(form.actual_revenue).replace(/\D/g,'')) * parseFloat(form.commission_rate) / 100))}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ghi chú</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={2} placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Đang lưu...' : (editTarget ? 'Cập nhật' : 'Tạo KPI')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIManagementPage;
