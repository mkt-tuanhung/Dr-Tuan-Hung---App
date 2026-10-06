import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { PackagePlus, Plus, X, ChevronLeft, ChevronRight, Coins, Boxes, ReceiptText, Loader2, ImageIcon, UserRound } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Number(n || 0));
const fmtM = (n) => fmt(n) + 'đ';
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

const EMPTY = { name: '', unit: '', quantity: '', amount: '', date: vnToday(), supplier: '', notes: '', proof_urls: [] };
const proofsOf = (r) => (r.proof_urls?.length ? r.proof_urls : (r.proof_url ? [r.proof_url] : []));

export default function NhapVatTuMoiPage() {
  const { profile } = useAuth();
  // Tạo danh mục vật tư mới cần quyền admin/kế toán (RLS) — tab này là quản lý chi phí nhập
  const canWrite = ['admin', 'accountant'].includes(profile?.role);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const ms = `${year}-${String(month).padStart(2, '0')}-01`;
    const me = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const [itemsRes, transRes] = await Promise.all([
      supabase.from('inventory_items').select('id, name, unit, current_stock').order('name'),
      supabase.from('inventory_transactions').select('*, inventory_items(name, unit), profiles(full_name)')
        .eq('type', 'import').gte('date', ms).lte('date', me).order('date', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    if (itemsRes.error) toast.error('Lỗi tải danh mục: ' + itemsRes.error.message);
    if (transRes.error) toast.error('Lỗi tải phiếu nhập: ' + transRes.error.message);
    setItems(itemsRes.data || []);
    setRows(transRes.data || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeReload('inventory_transactions,inventory_items', loadData);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  // Khi gõ tên trùng vật tư có sẵn → tự điền đơn vị
  const onNameChange = (v) => {
    const match = items.find(i => i.name.trim().toLowerCase() === v.trim().toLowerCase());
    setModal(m => ({ ...m, name: v, unit: match ? match.unit : m.unit }));
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(f => uploadToR2(f, 'vat-tu')));
      setModal(m => ({ ...m, proof_urls: [...(m.proof_urls || []), ...urls] }));
      toast.success(`Đã tải ${urls.length} ảnh chứng từ`);
    } catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeProof = (url) => setModal(m => ({ ...m, proof_urls: (m.proof_urls || []).filter(u => u !== url) }));

  const save = async () => {
    const name = modal.name.trim();
    if (!name) return toast.error('Nhập tên vật tư');
    const quantity = num(modal.quantity);
    if (!quantity) return toast.error('Nhập số lượng nhập');
    setSaving(true);
    try {
      // 1) Tìm vật tư có sẵn (không phân biệt hoa thường); chưa có thì tạo mới trong kho
      let item = items.find(i => i.name.trim().toLowerCase() === name.toLowerCase());
      if (!item) {
        const { data: created, error: cErr } = await supabase.from('inventory_items')
          .insert({ name, unit: modal.unit.trim() || 'Cái', min_stock: 0, current_stock: 0, notes: 'Tạo tự động khi nhập mới' })
          .select('id, name, unit').single();
        if (cErr) throw cErr;
        item = created;
      }
      // 2) Ghi phiếu nhập (trigger tự cộng tồn kho)
      const { error: tErr } = await supabase.from('inventory_transactions').insert({
        item_id: item.id, type: 'import', quantity,
        amount: num(modal.amount),
        proof_urls: modal.proof_urls || [], proof_url: (modal.proof_urls && modal.proof_urls[0]) || null,
        supplier: modal.supplier.trim() || null,
        date: modal.date, notes: modal.notes.trim() || null, created_by: profile.id,
      });
      if (tErr) throw tErr;
      toast.success(`Đã nhập ${quantity} ${item.unit} "${item.name}" vào kho`);
      setModal(null);
      loadData();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Thanh công cụ: mô tả + chọn tháng + nút chính */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="e-page-desc">Nhập vật tư mới vào kho + theo dõi tiền vật tư nhập trong tháng</p>
        <div className="flex items-center gap-2">
          <div className="e-seg gap-0.5">
            <button onClick={prevMonth} className="w-8 h-8 rounded-[9px] grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-800 transition"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[13px] font-semibold text-slate-700 min-w-[74px] text-center tabular-nums">{MONTHS[month - 1]}/{year}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-[9px] grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-800 transition"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {canWrite && (
            <button onClick={() => setModal({ ...EMPTY })} className="e-btn e-btn-primary"><Plus className="w-4 h-4" /> Nhập vật tư mới</button>
          )}
        </div>
      </div>

      {/* Thẻ chỉ số */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="e-metric">
          <div className="e-metric-icon"><Coins /></div>
          <div className="min-w-0">
            <div className="e-metric-label">Tiền vật tư nhập {MONTHS[month - 1]}</div>
            <div className="e-metric-value">{fmtM(totalAmount)}</div>
          </div>
        </div>
        <div className="e-metric">
          <div className="e-metric-icon e-tone-info"><ReceiptText /></div>
          <div className="min-w-0">
            <div className="e-metric-label">Số phiếu nhập</div>
            <div className="e-metric-value">{rows.length}</div>
          </div>
        </div>
        <div className="e-metric">
          <div className="e-metric-icon e-tone-lavender"><Boxes /></div>
          <div className="min-w-0">
            <div className="e-metric-label">Danh mục trong kho</div>
            <div className="e-metric-value">{items.length}</div>
          </div>
        </div>
      </div>

      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><PackagePlus className="w-5 h-5" /></div>
          <div className="min-w-0">
            <div className="e-card-title">Phiếu nhập tháng {month}/{year}</div>
            <div className="e-card-sub">Vật tư nhập mới và chứng từ đi kèm</div>
          </div>
        </div>
        {/* Mobile: dạng thẻ */}
        <div className="md:hidden p-3 space-y-3 bg-slate-50/60">
          {loading ? (
            <div className="e-empty text-[13px] text-slate-400">Đang tải...</div>
          ) : rows.length === 0 ? (
            <div className="e-empty text-[13px] text-slate-400">Chưa có phiếu nhập nào trong tháng</div>
          ) : rows.map(r => (
            <div key={r.id} className="e-card-flat p-4">
              <div className="flex items-start gap-3">
                <span className="e-avatar w-11 h-11 rounded-xl"><Boxes className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[15px] text-slate-900 truncate">{r.inventory_items?.name || '—'}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5 truncate">{new Date(r.date).toLocaleDateString('vi-VN')} · {r.supplier || r.notes || 'Không rõ NCC'}</div>
                </div>
                <span className="e-badge e-badge-sm e-tone-success tabular-nums shrink-0">+{r.quantity} {r.inventory_items?.unit}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="e-kv-label">Số tiền</div>
                  <div className="text-[17px] font-bold text-slate-900 tabular-nums">{r.amount ? fmtM(r.amount) : '—'}</div>
                </div>
                {proofsOf(r).length ? <a href={proofsOf(r)[0]} target="_blank" rel="noreferrer" className="e-badge e-badge-sm e-tone-brand"><ReceiptText className="w-3.5 h-3.5" /> {proofsOf(r).length} chứng từ</a> : <span className="text-[12px] text-slate-400">Không có chứng từ</span>}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[12px] text-slate-500">
                <UserRound className="w-3.5 h-3.5 text-slate-400" />
                <span>{r.profiles?.full_name || '—'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: bảng */}
        <div className="hidden md:block e-table-wrap">
          <table className="e-table whitespace-nowrap">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Vật tư</th>
                <th className="num">SL nhập</th>
                <th className="num">Số tiền</th>
                <th>Nhà cung cấp</th>
                <th>Người nhập</th>
                <th className="text-center">Chứng từ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center py-10 text-[13px] text-slate-400">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-10 text-[13px] text-slate-400">Chưa có phiếu nhập nào trong tháng</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="transition-colors">
                  <td className="text-slate-600 tabular-nums">{new Date(r.date).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="e-avatar w-9 h-9 rounded-xl"><Boxes className="w-4 h-4" /></span>
                      <span className="font-semibold text-slate-900">{r.inventory_items?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums font-bold text-success-600">+{r.quantity} <span className="text-[12px] font-normal text-slate-400">{r.inventory_items?.unit}</span></td>
                  <td className="text-right tabular-nums font-bold text-slate-900">{r.amount ? fmtM(r.amount) : '—'}</td>
                  <td className="text-slate-500">{r.supplier || r.notes || '—'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="e-avatar w-8 h-8"><UserRound className="w-4 h-4" /></span>
                      <span className="text-slate-700">{r.profiles?.full_name || '—'}</span>
                    </div>
                  </td>
                  <td className="text-center">
                    {proofsOf(r).length ? (
                      <span className="inline-flex items-center gap-1.5">
                        {proofsOf(r).slice(0, 3).map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg border border-slate-200 overflow-hidden inline-block hover:ring-2 hover:ring-teal-300 transition"><img src={u} alt="" className="w-full h-full object-cover" /></a>
                        ))}
                        {proofsOf(r).length > 3 && <span className="text-[12px] font-semibold text-slate-500">+{proofsOf(r).length - 3}</span>}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-lg overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="e-modal-header items-center shrink-0">
              <h3 className="e-modal-title flex items-center gap-2"><PackagePlus className="w-5 h-5 text-teal-600" /> Nhập vật tư mới</h3>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="e-label">Tên vật tư *</label>
                <input list="vattu-list" value={modal.name} onChange={e => onNameChange(e.target.value)} className="e-input" placeholder="Gõ tên — chưa có sẽ tự tạo mới trong kho" />
                <datalist id="vattu-list">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                <p className="text-[12px] text-slate-400 mt-1.5">Nếu tên chưa có trong kho, hệ thống sẽ tự tạo danh mục mới và nhập vào.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="e-label">Số lượng *</label>
                  <input inputMode="numeric" value={modal.quantity} onChange={e => setModal({ ...modal, quantity: e.target.value.replace(/\D/g, '') })} className="e-input font-bold text-slate-900 tabular-nums" placeholder="0" />
                </div>
                <div>
                  <label className="e-label">Đơn vị</label>
                  <input value={modal.unit} onChange={e => setModal({ ...modal, unit: e.target.value })} className="e-input" placeholder="Cái, Hộp..." />
                </div>
                <div>
                  <label className="e-label">Số tiền (VNĐ)</label>
                  <input inputMode="numeric" value={modal.amount ? fmt(modal.amount) : ''} onChange={e => setModal({ ...modal, amount: e.target.value.replace(/\D/g, '') })} className="e-input font-bold text-slate-900 tabular-nums" placeholder="0" />
                </div>
                <div>
                  <label className="e-label">Ngày nhập</label>
                  <input type="date" value={modal.date} onChange={e => setModal({ ...modal, date: e.target.value })} className="e-input" />
                </div>
              </div>
              <div>
                <label className="e-label">Nhà cung cấp</label>
                <input value={modal.supplier} onChange={e => setModal({ ...modal, supplier: e.target.value })} className="e-input" placeholder="Tên NCC" />
              </div>
              <div>
                <label className="e-label">Hoá đơn / Chứng từ / Bill CK <span className="text-slate-400 font-normal">(nhiều ảnh)</span></label>
                {modal.proof_urls?.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                    {modal.proof_urls.map((u, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                        <img src={u} alt={`chứng từ ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeProof(u)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-danger-500 transition"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-slate-200 bg-slate-50 p-4 rounded-xl text-center text-slate-500 font-medium hover:border-teal-400 hover:bg-teal-50/40 transition disabled:opacity-60">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <span className="flex items-center justify-center gap-2 text-sm"><ImageIcon className="w-4 h-4" /> {modal.proof_urls?.length ? 'Thêm ảnh khác' : 'Tải ảnh hoá đơn / bill lên'}</span>}
                </button>
                <input type="file" accept="image/*" multiple className="hidden" ref={fileRef} onChange={handleUpload} />
              </div>
              <div>
                <label className="e-label">Ghi chú</label>
                <textarea rows={2} value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} className="e-textarea resize-none" />
              </div>
            </div>
            <div className="e-modal-footer shrink-0">
              <button onClick={() => setModal(null)} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={save} disabled={saving || uploading} className="e-btn e-btn-primary min-w-[110px]">{saving ? 'Đang lưu...' : 'Nhập kho'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
