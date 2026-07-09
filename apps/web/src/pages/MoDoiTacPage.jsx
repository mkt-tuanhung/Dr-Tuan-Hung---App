import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Handshake, Plus, Edit, Trash2, X, Calendar as CalendarIcon, Stethoscope, Search } from 'lucide-react';
import { PARTNER_BACSI_RATE } from '@/lib/kpiCalc';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Number(n || 0));
const fmtM = (n) => fmt(n) + 'đ';
const todayStr = () => new Date().toISOString().split('T')[0];

const EMPTY = {
  customer_name: '', partner_name: '', service: '', surgery_type: 'Tiểu phẫu',
  surgery_date: todayStr(), partner_fee: '', bac_si_id: '',
  phu_mo_1_id: '', phu_mo_2_id: '', phu_mo_3_id: '', notes: '',
};

const MoDoiTacPage = () => {
  const { profile } = useAuth();
  const canWrite = ['admin', 'accountant', 'dieu_duong'].includes(profile?.role) || profile?.role_2 === 'dieu_duong';

  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | {id?, ...form}
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [rowsRes, staffRes] = await Promise.all([
      supabase.from('partner_surgeries').select('*, bac_si:bac_si_id(full_name), p1:phu_mo_1_id(full_name), p2:phu_mo_2_id(full_name), p3:phu_mo_3_id(full_name)').order('surgery_date', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role, role_2').or('role.in.(dieu_duong,admin,bac_si),role_2.in.(dieu_duong,bac_si)').eq('is_active', true).order('full_name'),
    ]);
    if (rowsRes.error) toast.error('Lỗi tải dữ liệu: ' + rowsRes.error.message);
    setRows(rowsRes.data || []);
    setStaff(staffRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('partner_surgeries', loadData);

  const doctors = staff.filter(n => n.role === 'bac_si' || n.role_2 === 'bac_si' || n.role === 'admin');

  const openCreate = () => setModal({ ...EMPTY });
  const openEdit = (r) => setModal({
    id: r.id, customer_name: r.customer_name || '', partner_name: r.partner_name || '', service: r.service || '',
    surgery_type: r.surgery_type || 'Tiểu phẫu', surgery_date: r.surgery_date || todayStr(),
    partner_fee: r.partner_fee ? fmt(r.partner_fee) : '', bac_si_id: r.bac_si_id || '',
    phu_mo_1_id: r.phu_mo_1_id || '', phu_mo_2_id: r.phu_mo_2_id || '', phu_mo_3_id: r.phu_mo_3_id || '', notes: r.notes || '',
  });

  const save = async () => {
    if (!modal.customer_name.trim()) return toast.error('Nhập tên khách');
    const fee = Number(String(modal.partner_fee).replace(/\D/g, '')) || 0;
    if (!fee) return toast.error('Nhập tiền nhận từ đối tác');
    setSaving(true);
    const payload = {
      customer_name: modal.customer_name.trim(), partner_name: modal.partner_name.trim() || null,
      service: modal.service.trim() || null, surgery_type: modal.surgery_type,
      surgery_date: modal.surgery_date || null, partner_fee: fee,
      bac_si_id: modal.bac_si_id || null,
      phu_mo_1_id: modal.phu_mo_1_id || null, phu_mo_2_id: modal.phu_mo_2_id || null, phu_mo_3_id: modal.phu_mo_3_id || null,
      notes: modal.notes.trim() || null,
    };
    let error;
    if (modal.id) {
      ({ error } = await supabase.from('partner_surgeries').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.id));
    } else {
      ({ error } = await supabase.from('partner_surgeries').insert({ ...payload, created_by: profile.id }));
    }
    if (error) toast.error('Lỗi: ' + error.message);
    else { toast.success(modal.id ? 'Đã cập nhật' : 'Đã thêm ca mổ đối tác'); setModal(null); loadData(); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá ca mổ đối tác của "${r.customer_name}"?`)) return;
    const { error } = await supabase.from('partner_surgeries').delete().eq('id', r.id);
    if (error) toast.error(error.message);
    else { toast.success('Đã xoá'); loadData(); }
  };

  const filtered = search
    ? rows.filter(r => (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) || (r.partner_name || '').toLowerCase().includes(search.toLowerCase()))
    : rows;

  const totalFee = filtered.reduce((s, r) => s + Number(r.partner_fee || 0), 0);
  const grouped = filtered.reduce((acc, r) => {
    const d = r.surgery_date ? new Date(r.surgery_date).toLocaleDateString('vi-VN') : 'Không rõ';
    (acc[d] = acc[d] || []).push(r); return acc;
  }, {});

  const nameOf = (r, key) => r[key]?.full_name;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Handshake className="w-5 h-5 text-amber-600" /> Mổ Đối Tác</h3>
          <p className="text-slate-500 text-sm mt-0.5">Khách của đối tác thuê phòng khám mổ · BS nhận 50% · phụ mổ tính như khách nội bộ</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm khách / đối tác..." className="bg-white border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-sm outline-none focus:border-amber-500 w-52" />
          </div>
          {canWrite && (
            <button onClick={openCreate} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm shadow-sm flex items-center gap-2 whitespace-nowrap"><Plus className="w-4 h-4" /> Thêm ca</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase">Số ca</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{filtered.length}</div>
        </div>
        <div className="bg-white border border-teal-100 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase">Tổng thu đối tác</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{fmtM(totalFee)}</div>
        </div>
        <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase">Công BS (50%)</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{fmtM(Math.round(totalFee * PARTNER_BACSI_RATE))}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">Chưa có ca mổ đối tác nào</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, list]) => (
            <div key={date} className="bg-white/50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <CalendarIcon className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-amber-800">Ngày mổ: {date}</h4>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full ml-auto">{list.length} ca</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {list.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-50">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{r.customer_name}</div>
                        <div className="text-xs text-slate-500 truncate">{r.service || '—'} · {r.surgery_type}</div>
                        {r.partner_name && <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Đối tác: {r.partner_name}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Thu đối tác</div>
                        <div className="text-sm font-bold text-teal-600">{fmtM(r.partner_fee)}</div>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 text-slate-600">
                      <div className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-blue-500" /> BS: <b className="text-slate-800">{nameOf(r, 'bac_si') || '—'}</b> <span className="text-blue-600 ml-auto font-semibold">{fmtM(Math.round(Number(r.partner_fee || 0) * PARTNER_BACSI_RATE))}</span></div>
                      <div className="text-slate-500">Phụ mổ: {[nameOf(r, 'p1'), nameOf(r, 'p2'), nameOf(r, 'p3')].filter(Boolean).join(', ') || '—'}</div>
                    </div>
                    {canWrite && (
                      <div className="flex gap-2 mt-3 pt-2 border-t border-slate-50">
                        <button onClick={() => openEdit(r)} className="flex-1 flex justify-center items-center gap-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200"><Edit className="w-3.5 h-3.5" /> Sửa</button>
                        <button onClick={() => remove(r)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-amber-50 shrink-0">
              <h3 className="font-bold text-amber-800">{modal.id ? 'Sửa ca mổ đối tác' : 'Thêm ca mổ đối tác'}</h3>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-amber-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Tên khách *</label>
                  <input value={modal.customer_name} onChange={e => setModal({ ...modal, customer_name: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" placeholder="Nguyễn Văn A" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Đối tác thuê mổ</label>
                  <input value={modal.partner_name} onChange={e => setModal({ ...modal, partner_name: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" placeholder="Tên phòng khám / đối tác" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Dịch vụ</label>
                  <input value={modal.service} onChange={e => setModal({ ...modal, service: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" placeholder="VD: Gọt hàm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Loại phẫu thuật</label>
                  <select value={modal.surgery_type} onChange={e => setModal({ ...modal, surgery_type: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500">
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                    <option value="Đại phẫu">Đại phẫu</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Ngày mổ</label>
                  <input type="date" value={modal.surgery_date} onChange={e => setModal({ ...modal, surgery_date: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Tiền nhận từ đối tác (VNĐ) *</label>
                  <input inputMode="numeric" value={modal.partner_fee} onChange={e => setModal({ ...modal, partner_fee: fmt(e.target.value.replace(/\D/g, '')) })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500 font-bold text-teal-700" placeholder="15.000.000" />
                  {modal.partner_fee && <p className="text-xs text-blue-500 mt-1">Công BS (50%): {fmtM(Math.round((Number(String(modal.partner_fee).replace(/\D/g, '')) || 0) * PARTNER_BACSI_RATE))}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Bác sĩ mổ (nhận 50% tiền đối tác)</label>
                <select value={modal.bac_si_id} onChange={e => setModal({ ...modal, bac_si_id: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500">
                  <option value="">-- Trống --</option>
                  {doctors.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['phu_mo_1_id', 'phu_mo_2_id', 'phu_mo_3_id'].map((k, i) => (
                  <div key={k}>
                    <label className="block text-sm font-semibold mb-1.5 text-slate-700">Phụ mổ {i + 1}</label>
                    <select value={modal[k]} onChange={e => setModal({ ...modal, [k]: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500">
                      <option value="">-- Trống --</option>
                      {staff.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Ghi chú</label>
                <textarea rows={2} value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500 resize-none" />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Hủy</button>
              <button onClick={save} disabled={saving} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoDoiTacPage;
