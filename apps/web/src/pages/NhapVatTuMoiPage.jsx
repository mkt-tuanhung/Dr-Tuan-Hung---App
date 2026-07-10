import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { PackagePlus, Plus, X, ChevronLeft, ChevronRight, Coins, Boxes, ReceiptText, Loader2, ImageIcon } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Number(n || 0));
const fmtM = (n) => fmt(n) + 'đ';
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

const EMPTY = { name: '', unit: '', quantity: '', amount: '', date: new Date().toISOString().split('T')[0], supplier: '', notes: '', proof_url: '' };

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
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToR2(file, 'vat-tu');
      setModal(m => ({ ...m, proof_url: url }));
      toast.success('Đã tải chứng từ lên');
    } catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

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
        amount: num(modal.amount), proof_url: modal.proof_url || null, supplier: modal.supplier.trim() || null,
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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PackagePlus className="w-5 h-5 text-teal-600" /> Vật tư nhập mới</h3>
          <p className="text-slate-500 text-sm mt-0.5">Nhập vật tư mới vào kho + theo dõi tiền vật tư nhập trong tháng</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <span className="text-sm font-semibold text-slate-700 min-w-[74px] text-center">{MONTHS[month - 1]}/{year}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          </div>
          {canWrite && (
            <button onClick={() => setModal({ ...EMPTY })} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm shadow-sm flex items-center gap-2 whitespace-nowrap"><Plus className="w-4 h-4" /> Nhập vật tư mới</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-2xl p-4 shadow-md col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/90 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Tiền vật tư nhập {MONTHS[month - 1]}</div>
          <div className="text-2xl font-black mt-1">{fmtM(totalAmount)}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase">Số phiếu nhập</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{rows.length}</div>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase">Danh mục trong kho</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">{items.length}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-slate-700 flex items-center gap-2"><Boxes className="w-4 h-4 text-teal-600" /> Phiếu nhập tháng {month}/{year}</div>
        {/* Mobile: dạng thẻ */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Đang tải...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Chưa có phiếu nhập nào trong tháng</div>
          ) : rows.map(r => (
            <div key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{r.inventory_items?.name || '—'}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{new Date(r.date).toLocaleDateString('vi-VN')} · {r.supplier || r.notes || 'Không rõ NCC'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-800">{r.amount ? fmtM(r.amount) : '—'}</div>
                  <div className="text-xs font-semibold text-teal-600">+{r.quantity} {r.inventory_items?.unit}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-slate-400">{r.profiles?.full_name || '—'}</span>
                {r.proof_url ? <a href={r.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-semibold"><ReceiptText className="w-3.5 h-3.5" /> Chứng từ</a> : <span className="text-slate-300">Không có chứng từ</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: bảng */}
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Ngày</th>
                <th className="text-left px-4 py-3 font-semibold">Vật tư</th>
                <th className="text-right px-4 py-3 font-semibold">SL nhập</th>
                <th className="text-right px-4 py-3 font-semibold">Số tiền</th>
                <th className="text-left px-4 py-3 font-semibold">Nhà cung cấp</th>
                <th className="text-left px-4 py-3 font-semibold">Người nhập</th>
                <th className="text-center px-4 py-3 font-semibold">Chứng từ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-10 text-slate-400">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-10 text-slate-400">Chưa có phiếu nhập nào trong tháng</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-600">{new Date(r.date).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{r.inventory_items?.name || '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-teal-600">+{r.quantity} <span className="text-xs font-normal text-slate-400">{r.inventory_items?.unit}</span></td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{r.amount ? fmtM(r.amount) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.supplier || r.notes || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.profiles?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.proof_url ? <a href={r.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold"><ReceiptText className="w-3.5 h-3.5" /> Xem</a> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-teal-50 shrink-0">
              <h3 className="font-bold text-teal-800 flex items-center gap-2"><PackagePlus className="w-5 h-5" /> Nhập vật tư mới</h3>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-teal-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Tên vật tư *</label>
                <input list="vattu-list" value={modal.name} onChange={e => onNameChange(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="Gõ tên — chưa có sẽ tự tạo mới trong kho" />
                <datalist id="vattu-list">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
                <p className="text-xs text-slate-400 mt-1">Nếu tên chưa có trong kho, hệ thống sẽ tự tạo danh mục mới và nhập vào.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Đơn vị</label>
                  <input value={modal.unit} onChange={e => setModal({ ...modal, unit: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="Cái, Hộp..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Số lượng *</label>
                  <input inputMode="numeric" value={modal.quantity} onChange={e => setModal({ ...modal, quantity: e.target.value.replace(/\D/g, '') })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 font-bold text-teal-700" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Ngày nhập</label>
                  <input type="date" value={modal.date} onChange={e => setModal({ ...modal, date: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Số tiền (VNĐ)</label>
                  <input inputMode="numeric" value={modal.amount ? fmt(modal.amount) : ''} onChange={e => setModal({ ...modal, amount: e.target.value.replace(/\D/g, '') })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 font-bold text-slate-800" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Nhà cung cấp</label>
                  <input value={modal.supplier} onChange={e => setModal({ ...modal, supplier: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500" placeholder="Tên NCC" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Hoá đơn / Chứng từ / Bill CK</label>
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-xl text-center text-slate-400 hover:border-teal-400 transition-colors">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : modal.proof_url ? <img src={modal.proof_url} alt="chứng từ" className="max-h-28 mx-auto rounded-lg" /> : <span className="flex items-center justify-center gap-2 text-sm"><ImageIcon className="w-4 h-4" /> Tải ảnh hoá đơn / bill lên</span>}
                </button>
                <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleUpload} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Ghi chú</label>
                <textarea rows={2} value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} className="w-full border p-2.5 rounded-xl outline-none focus:border-teal-500 resize-none" />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Hủy</button>
              <button onClick={save} disabled={saving || uploading} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl disabled:opacity-50">{saving ? 'Đang lưu...' : 'Nhập kho'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
