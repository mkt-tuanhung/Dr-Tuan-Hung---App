import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { PackageOpen, Plus, Search, Archive, ArrowDownLeft, ArrowUpRight, History, X } from 'lucide-react';

export default function InventoryManagementPage({ isNested = false }) {
  const { profile } = useAuth();
  const canWrite = ['admin', 'accountant', 'dieu_duong'].includes(profile?.role);
  
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [customerMap, setCustomerMap] = useState({}); // reference_id -> { name, date }
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'history', 'by_customer'
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [itemForm, setItemForm] = useState({ name: '', unit: '', min_stock: 10, notes: '' });
  const [importForm, setImportForm] = useState({ item_id: '', quantity: '', date: new Date().toISOString().split('T')[0], notes: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    // Load Items
    const { data: itemsData, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    
    if (itemsError) toast.error(itemsError.message);
    else setItems(itemsData || []);

    // Load History
    const { data: transData, error: transError } = await supabase
      .from('inventory_transactions')
      .select('*, inventory_items(name, unit), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (transError) toast.error(transError.message);
    else setTransactions(transData || []);

    // Tên khách cho các phiếu xuất (vật tư dùng trên khách)
    const refIds = [...new Set((transData || []).filter(t => t.type === 'export' && t.reference_id).map(t => t.reference_id))];
    if (refIds.length) {
      const { data: custData } = await supabase.from('customer_appointments').select('id, customer_name, surgery_date').in('id', refIds);
      const map = {};
      (custData || []).forEach(c => { map[c.id] = { name: c.customer_name, date: c.surgery_date }; });
      setCustomerMap(map);
    } else setCustomerMap({});

    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile) loadData();
  }, [loadData, profile]);

  // Handle Add New Item
  const handleItemSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('inventory_items').insert([{
      name: itemForm.name,
      unit: itemForm.unit,
      min_stock: itemForm.min_stock || 0,
      notes: itemForm.notes
    }]);

    if (error) toast.error(error.message);
    else {
      toast.success('Thêm vật tư thành công!');
      setShowItemModal(false);
      setItemForm({ name: '', unit: '', min_stock: 10, notes: '' });
      loadData();
    }
    setSaving(false);
  };

  // Handle Import Transaction
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importForm.item_id || !importForm.quantity) return toast.error('Vui lòng điền đủ thông tin');
    setSaving(true);

    const { error } = await supabase.from('inventory_transactions').insert([{
      item_id: importForm.item_id,
      type: 'import',
      quantity: importForm.quantity,
      date: importForm.date,
      notes: importForm.notes,
      created_by: profile.id
    }]);

    if (error) toast.error(error.message);
    else {
      toast.success('Nhập kho thành công!');
      setShowImportModal(false);
      setImportForm({ item_id: '', quantity: '', date: new Date().toISOString().split('T')[0], notes: '' });
      loadData();
    }
    setSaving(false);
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {!isNested && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Quản lý Kho / Vật tư y tế</h2>
            <p className="text-slate-500 text-sm mt-1">Theo dõi tồn kho và lịch sử nhập xuất tiêu hao</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm flex flex-col">
          <div className="text-indigo-600 font-bold text-sm mb-2 flex items-center gap-2"><Archive className="w-4 h-4"/> Tổng Danh mục Vật tư</div>
          <div className="text-3xl font-black text-slate-800">{items.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm flex flex-col">
          <div className="text-red-600 font-bold text-sm mb-2 flex items-center gap-2"><ArrowUpRight className="w-4 h-4"/> Vật tư sắp hết (Dưới mức tối thiểu)</div>
          <div className="text-3xl font-black text-red-600">{items.filter(i => i.current_stock <= i.min_stock).length}</div>
        </div>
        <div className="bg-emerald-600 p-6 rounded-2xl shadow-md flex flex-col text-white">
          <div className="text-emerald-100 font-bold text-sm mb-2 flex items-center gap-2"><ArrowDownLeft className="w-4 h-4"/> Giao dịch nhập xuất (Gần đây)</div>
          <div className="text-3xl font-black">{transactions.length}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Tabs & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b bg-slate-50 gap-4">
          <div className="flex bg-white rounded-xl border p-1 shadow-sm w-full md:w-auto">
            <button onClick={() => setActiveTab('stock')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>
              <PackageOpen className="w-4 h-4 inline-block mr-2" /> Tồn kho
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>
              <History className="w-4 h-4 inline-block mr-2" /> Lịch sử Nhập / Xuất
            </button>
            <button onClick={() => setActiveTab('by_customer')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'by_customer' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>
              <PackageOpen className="w-4 h-4 inline-block mr-2" /> Vật tư theo khách
            </button>
          </div>

          {activeTab === 'stock' && canWrite && (
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => setShowItemModal(true)} className="flex-1 md:flex-none bg-white border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Danh mục mới
              </button>
              <button onClick={() => setShowImportModal(true)} className="flex-1 md:flex-none bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                <ArrowDownLeft className="w-4 h-4" /> Nhập Kho
              </button>
            </div>
          )}
        </div>

        {/* Tab: Stock */}
        {activeTab === 'stock' && (
          <div className="flex flex-col h-[600px]">
            <div className="p-4 border-b bg-white">
              <div className="relative max-w-md">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" placeholder="Tìm kiếm tên vật tư..." 
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white border rounded-xl outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Tên Vật Tư</th>
                    <th className="px-6 py-4 font-semibold text-center">Đơn vị</th>
                    <th className="px-6 py-4 font-semibold text-right">Tồn kho hiện tại</th>
                    <th className="px-6 py-4 font-semibold text-right">Mức tối thiểu</th>
                    <th className="px-6 py-4 font-semibold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-10 text-slate-400">Chưa có vật tư nào</td></tr>
                  ) : filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{item.name}</td>
                      <td className="px-6 py-4 text-center text-slate-600 font-medium">{item.unit}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-bold ${
                          item.current_stock <= item.min_stock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.current_stock}{item.current_stock <= item.min_stock ? ' ⚠️' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">{item.min_stock}</td>
                      <td className="px-6 py-4 text-slate-500">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: History */}
        {activeTab === 'history' && (
          <div className="flex flex-col h-[600px] overflow-auto">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b">
                    <th className="px-6 py-4 font-semibold">Ngày</th>
                    <th className="px-6 py-4 font-semibold">Vật tư</th>
                    <th className="px-6 py-4 font-semibold">Loại</th>
                    <th className="px-6 py-4 font-semibold text-right">Số lượng</th>
                    <th className="px-6 py-4 font-semibold">Người thực hiện</th>
                    <th className="px-6 py-4 font-semibold">Ghi chú / Ca mổ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-slate-400">Đang tải...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-slate-400">Chưa có giao dịch nào</td></tr>
                  ) : transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-600">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{t.inventory_items?.name}</td>
                      <td className="px-6 py-4">
                        {t.type === 'import' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold"><ArrowDownLeft className="w-3 h-3"/> Nhập kho</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg text-xs font-bold"><ArrowUpRight className="w-3 h-3"/> Xuất tiêu hao</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 font-bold text-right text-base ${t.type === 'import' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'import' ? '+' : '-'}{t.quantity} <span className="text-xs font-normal ml-1">{t.inventory_items?.unit}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{t.profiles?.full_name || 'Hệ thống'}</td>
                      <td className="px-6 py-4 text-slate-500">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}

        {/* Tab: Vật tư theo khách hàng */}
        {activeTab === 'by_customer' && (() => {
          const groups = {};
          transactions.filter(t => t.type === 'export' && t.reference_id).forEach(t => {
            const k = t.reference_id;
            if (!groups[k]) groups[k] = [];
            groups[k].push(t);
          });
          const entries = Object.entries(groups).sort((a, b) => {
            const da = customerMap[a[0]]?.date || '', db = customerMap[b[0]]?.date || '';
            return db.localeCompare(da);
          });
          return (
            <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
              {loading ? (
                <div className="text-center py-10 text-slate-400">Đang tải...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-10 text-slate-400">Chưa có khách nào dùng vật tư.</div>
              ) : entries.map(([ref, list]) => {
                const cust = customerMap[ref];
                return (
                  <div key={ref} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div>
                        <div className="font-bold text-slate-800">{cust?.name || 'Khách (đã xóa)'}</div>
                        <div className="text-xs text-slate-400">{cust?.date ? 'Ngày mổ: ' + new Date(cust.date).toLocaleDateString('vi-VN') : ''}</div>
                      </div>
                      <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">{list.length} loại vật tư</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {list.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{t.inventory_items?.name}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-600">-{t.quantity} <span className="text-xs font-normal text-slate-400 ml-1">{t.inventory_items?.unit}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Modal: Add Item */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleItemSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-800 text-lg">Thêm Danh mục Vật tư</h3>
              <button type="button" onClick={() => setShowItemModal(false)}><X className="w-5 h-5 text-indigo-400 hover:text-indigo-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Tên vật tư *</label>
                <input required type="text" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" placeholder="VD: Bơm tiêm 5ml" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Đơn vị *</label>
                  <input required type="text" value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" placeholder="Cái, Hộp, Vỉ..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Tồn tối thiểu</label>
                  <input type="number" min="0" value={itemForm.min_stock} onChange={e => setItemForm({...itemForm, min_stock: Number(e.target.value)})} className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" placeholder="VD: 10" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Ghi chú</label>
                <textarea value={itemForm.notes} onChange={e => setItemForm({...itemForm, notes: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:border-indigo-500 h-20 resize-none" />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setShowItemModal(false)} className="px-6 py-2.5 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">Lưu danh mục</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Import Stock */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleImportSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-emerald-800 text-lg">Phiếu Nhập Kho</h3>
              <button type="button" onClick={() => setShowImportModal(false)}><X className="w-5 h-5 text-emerald-400 hover:text-emerald-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Chọn vật tư *</label>
                <select required value={importForm.item_id} onChange={e => setImportForm({...importForm, item_id: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 font-semibold text-slate-700">
                  <option value="">-- Chọn vật tư cần nhập --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (Tồn: {i.current_stock})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Số lượng nhập *</label>
                  <input required type="number" min="1" value={importForm.quantity} onChange={e => setImportForm({...importForm, quantity: Number(e.target.value)})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 font-bold text-lg text-emerald-600" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">Ngày nhập</label>
                  <input required type="date" value={importForm.date} onChange={e => setImportForm({...importForm, date: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Ghi chú / Nguồn nhập</label>
                <textarea value={importForm.notes} onChange={e => setImportForm({...importForm, notes: e.target.value})} className="w-full border p-3 rounded-xl outline-none focus:border-emerald-500 h-20 resize-none" placeholder="Nhập từ nhà cung cấp nào..." />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button type="button" onClick={() => setShowImportModal(false)} className="px-6 py-2.5 border rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">Hoàn tất Nhập</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
