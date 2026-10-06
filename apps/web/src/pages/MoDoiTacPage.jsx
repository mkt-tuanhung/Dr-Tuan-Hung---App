import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Handshake, Plus, Edit, Trash2, X, Calendar as CalendarIcon, Stethoscope, Search, CheckCircle, Banknote } from 'lucide-react';
import { PARTNER_BACSI_RATE } from '@/lib/kpiCalc';
import { vnToday } from '@/lib/vnTime';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Number(n || 0));
const fmtM = (n) => fmt(n) + 'đ';
const todayStr = () => vnToday();

const EMPTY = {
  customer_name: '', partner_name: '', service: '', surgery_type: 'Tiểu phẫu',
  surgery_date: todayStr(), surgery_fee: '', material_fee: '', bac_si_id: '',
  phu_mo_1_id: '', phu_mo_2_id: '', phu_mo_3_id: '', notes: '',
};
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;

const MoDoiTacPage = () => {
  const { profile } = useAuth();
  const canWrite = ['admin', 'accountant', 'dieu_duong'].includes(profile?.role) || profile?.role_2 === 'dieu_duong';
  const canSeeDoctorPay = ['admin', 'accountant'].includes(profile?.role); // ẩn công mổ BS với điều dưỡng — tránh lộ cơ chế

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
    surgery_fee: r.surgery_fee ? fmt(r.surgery_fee) : '', material_fee: r.material_fee ? fmt(r.material_fee) : '',
    bac_si_id: r.bac_si_id || '',
    phu_mo_1_id: r.phu_mo_1_id || '', phu_mo_2_id: r.phu_mo_2_id || '', phu_mo_3_id: r.phu_mo_3_id || '', notes: r.notes || '',
  });

  const save = async () => {
    if (!modal.customer_name.trim()) return toast.error('Nhập tên khách');
    const surgeryFee = num(modal.surgery_fee);   // cho phép = 0
    const materialFee = num(modal.material_fee);
    setSaving(true);
    const payload = {
      customer_name: modal.customer_name.trim(), partner_name: modal.partner_name.trim() || null,
      service: modal.service.trim() || null, surgery_type: modal.surgery_type,
      surgery_date: modal.surgery_date || null,
      surgery_fee: surgeryFee, material_fee: materialFee, partner_fee: surgeryFee + materialFee,
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

  // Xác nhận đối tác đã thanh toán -> mới cộng dòng tiền & công mổ bác sĩ
  const togglePaid = async (r) => {
    const paid = !r.partner_paid;
    setRows(list => list.map(x => x.id === r.id ? { ...x, partner_paid: paid } : x)); // phản hồi ngay
    const { error } = await supabase.from('partner_surgeries')
      .update({ partner_paid: paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', r.id);
    if (error) { toast.error(error.message); loadData(); return; }
    toast.success(paid ? 'Đã xác nhận đối tác thanh toán — đã cộng dòng tiền & lương BS' : 'Đã bỏ đánh dấu thanh toán');
  };

  const filtered = search
    ? rows.filter(r => (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) || (r.partner_name || '').toLowerCase().includes(search.toLowerCase()))
    : rows;

  // Tổng thu đối tác của 1 ca = partner_fee (tiền PT + vật tư). Công BS = tổng thu / 2.
  const rowTotal = (r) => Number(r.partner_fee) || (Number(r.surgery_fee || 0) + Number(r.material_fee || 0));
  const totalFee = filtered.reduce((s, r) => s + rowTotal(r), 0);
  const paidTotal = filtered.filter(r => r.partner_paid).reduce((s, r) => s + rowTotal(r), 0);
  const grouped = filtered.reduce((acc, r) => {
    const d = r.surgery_date ? new Date(r.surgery_date).toLocaleDateString('vi-VN') : 'Không rõ';
    (acc[d] = acc[d] || []).push(r); return acc;
  }, {});

  const nameOf = (r, key) => r[key]?.full_name;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="e-page-desc">Khách của đối tác thuê phòng khám mổ · BS nhận 50% tổng thu · phụ mổ tính như khách nội bộ</p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="e-search flex-1 sm:w-60 sm:flex-none">
            <Search />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm khách / đối tác..." className="w-full" />
          </div>
          {canWrite && (
            <button onClick={openCreate} className="e-btn e-btn-primary shrink-0"><Plus className="w-4 h-4" /> Thêm ca</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="e-metric">
          <span className="e-metric-icon"><Handshake /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Số ca</div>
            <div className="e-metric-value">{filtered.length}</div>
          </div>
        </div>
        <div className="e-metric">
          <span className="e-metric-icon bg-success-50 text-success-600"><Banknote /></span>
          <div className="min-w-0">
            <div className="e-metric-label">Tổng thu đối tác</div>
            <div className="e-metric-value">{fmtM(totalFee)}</div>
          </div>
        </div>
        {canSeeDoctorPay && (
          <div className="e-metric">
            <span className="e-metric-icon bg-sky-50 text-sky-600"><Stethoscope /></span>
            <div className="min-w-0">
              <div className="e-metric-label">Công BS (đã TT)</div>
              <div className="e-metric-value">{fmtM(Math.round(paidTotal * PARTNER_BACSI_RATE))}</div>
              {paidTotal < totalFee && <div className="e-metric-hint text-warning-600">Chưa TT: {fmtM(Math.round((totalFee - paidTotal) * PARTNER_BACSI_RATE))}</div>}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="e-card py-14 text-center text-[13px] text-slate-400">Chưa có ca mổ đối tác nào</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, list]) => (
            <section key={date} className="space-y-3">
              {/* Tiêu đề nhóm ngày mổ */}
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 grid place-items-center shrink-0"><CalendarIcon className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0">
                  <div className="e-caption">Ngày mổ</div>
                  <h4 className="text-[15px] font-semibold text-slate-900 tabular-nums leading-tight">{date}</h4>
                </div>
                <span className="flex-1 h-px bg-slate-200" />
                <span className="e-badge e-badge-sm e-tone-brand tabular-nums shrink-0">{list.length} ca</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {list.map(r => (
                  <div key={r.id} className="e-card p-4 flex flex-col gap-3.5 transition hover:border-teal-100 hover:shadow-float">
                    {/* Đầu thẻ: avatar + tên + dịch vụ | thu đối tác */}
                    <div className="flex items-start gap-3">
                      <span className="e-avatar w-11 h-11 text-[15px] before:content-[attr(data-av)]" data-av={(r.customer_name || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase()} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-slate-900 leading-snug truncate">{r.customer_name}</div>
                        <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{r.service || '—'} · {r.surgery_type}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="e-kv-label">Thu đối tác</div>
                        <div className="text-[15px] font-bold text-slate-900 tabular-nums">{fmtM(r.partner_fee)}</div>
                        {Number(r.material_fee || 0) > 0 && <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">PT {fmtM(r.surgery_fee)} · VT {fmtM(r.material_fee)}</div>}
                      </div>
                    </div>

                    {r.partner_name && <div className="e-badge e-badge-sm e-tone-neutral self-start max-w-full overflow-hidden"><Handshake className="w-3.5 h-3.5" /> Đối tác: {r.partner_name}</div>}

                    {/* Ê-kíp */}
                    <div className="e-subtle px-3 py-2.5 text-[12.5px] space-y-1.5 text-slate-600">
                      <div className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-teal-600" /> BS: <b className="font-semibold text-slate-800">{nameOf(r, 'bac_si') || '—'}</b>{canSeeDoctorPay && <span className="ml-auto font-semibold text-teal-700 tabular-nums">{fmtM(Math.round(rowTotal(r) * PARTNER_BACSI_RATE))}</span>}</div>
                      <div className="text-slate-500">Phụ mổ: {[nameOf(r, 'p1'), nameOf(r, 'p2'), nameOf(r, 'p3')].filter(Boolean).join(', ') || '—'}</div>
                    </div>

                    {/* Chân thẻ: thanh toán đối tác (nút chính) + sửa/xoá — bấm mới cộng dòng tiền & lương BS */}
                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {r.partner_paid ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="e-badge e-tone-success"><CheckCircle className="w-3.5 h-3.5" /> Đối tác đã thanh toán</span>
                            {canSeeDoctorPay && <button onClick={() => togglePaid(r)} className="text-[12px] font-medium text-slate-400 hover:text-teal-700 hover:underline underline-offset-2 shrink-0">Bỏ đánh dấu</button>}
                          </div>
                        ) : canSeeDoctorPay ? (
                          <button onClick={() => togglePaid(r)} className="e-btn e-btn-primary e-btn-sm e-btn-block"><CheckCircle className="w-4 h-4" /> Đối tác đã thanh toán</button>
                        ) : (
                          <span className="e-badge e-badge-dot e-tone-warning">Chưa thanh toán</span>
                        )}
                      </div>
                      {canWrite && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => openEdit(r)} className="e-btn e-btn-secondary e-btn-sm px-2.5" title="Sửa"><Edit className="w-3.5 h-3.5" /> Sửa</button>
                          <button onClick={() => remove(r)} className="e-btn e-btn-danger-soft e-btn-sm px-2.5" title="Xoá"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-lg overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title">{modal.id ? 'Sửa ca mổ đối tác' : 'Thêm ca mổ đối tác'}</h3>
              <button onClick={() => setModal(null)} className="e-icon-btn w-8 h-8 border-transparent shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="e-modal-body overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Tên khách *</label>
                  <input value={modal.customer_name} onChange={e => setModal({ ...modal, customer_name: e.target.value })} className="e-input" placeholder="Nguyễn Văn A" />
                </div>
                <div>
                  <label className="e-label">Đối tác thuê mổ</label>
                  <input value={modal.partner_name} onChange={e => setModal({ ...modal, partner_name: e.target.value })} className="e-input" placeholder="Tên phòng khám / đối tác" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Dịch vụ</label>
                  <input value={modal.service} onChange={e => setModal({ ...modal, service: e.target.value })} className="e-input" placeholder="VD: Gọt hàm" />
                </div>
                <div>
                  <label className="e-label">Loại phẫu thuật</label>
                  <select value={modal.surgery_type} onChange={e => setModal({ ...modal, surgery_type: e.target.value })} className="e-input">
                    <option value="Tiểu phẫu">Tiểu phẫu</option>
                    <option value="Đại phẫu">Đại phẫu</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Ngày mổ</label>
                  <input type="date" value={modal.surgery_date} onChange={e => setModal({ ...modal, surgery_date: e.target.value })} className="e-input" />
                </div>
                <div>
                  <label className="e-label">Tiền phẫu thuật (VNĐ)</label>
                  <input inputMode="numeric" value={modal.surgery_fee} onChange={e => setModal({ ...modal, surgery_fee: fmt(e.target.value.replace(/\D/g, '')) })} className="e-input font-semibold tabular-nums" placeholder="15.000.000" />
                  {canSeeDoctorPay && <p className="text-[12px] text-teal-700 mt-1.5">Công BS (50% tổng thu đối tác): {fmtM(Math.round((num(modal.surgery_fee) + num(modal.material_fee)) * PARTNER_BACSI_RATE))}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="e-label">Tiền vật tư (VNĐ)</label>
                  <input inputMode="numeric" value={modal.material_fee} onChange={e => setModal({ ...modal, material_fee: fmt(e.target.value.replace(/\D/g, '')) })} className="e-input font-semibold tabular-nums" placeholder="0" />
                  <p className="text-[12px] text-slate-400 mt-1.5">Đã gộp vào tổng thu đối tác (dùng tính công BS)</p>
                </div>
                <div>
                  <label className="e-label">Tổng thu đối tác</label>
                  <div className="e-subtle h-10 px-3 flex items-center font-bold text-teal-800 tabular-nums">{fmtM(num(modal.surgery_fee) + num(modal.material_fee))}</div>
                </div>
              </div>
              <div>
                <label className="e-label">Bác sĩ mổ</label>
                <select value={modal.bac_si_id} onChange={e => setModal({ ...modal, bac_si_id: e.target.value })} className="e-input">
                  <option value="">-- Trống --</option>
                  {doctors.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['phu_mo_1_id', 'phu_mo_2_id', 'phu_mo_3_id'].map((k, i) => (
                  <div key={k}>
                    <label className="e-label">Phụ mổ {i + 1}</label>
                    <select value={modal[k]} onChange={e => setModal({ ...modal, [k]: e.target.value })} className="e-input">
                      <option value="">-- Trống --</option>
                      {staff.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="e-label">Ghi chú</label>
                <textarea rows={2} value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} className="e-textarea resize-none" />
              </div>
            </div>
            <div className="e-modal-footer shrink-0">
              <button onClick={() => setModal(null)} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={save} disabled={saving} className="e-btn e-btn-primary">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoDoiTacPage;
