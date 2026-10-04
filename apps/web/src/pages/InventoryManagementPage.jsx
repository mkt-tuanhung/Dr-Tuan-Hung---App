import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { PackageOpen, Plus, Search, Archive, ArrowDownLeft, ArrowUpRight, History, X, Trash2, AlertTriangle, Users, UserRound } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

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
  const [stockModal, setStockModal] = useState(null);     // { item } khi sửa tồn kho hiện tại
  const [stockValue, setStockValue] = useState('');

  // Forms
  const [itemForm, setItemForm] = useState({ id: null, name: '', unit: '', min_stock: 10, notes: '' });
  const [importForm, setImportForm] = useState({ item_id: '', quantity: '', date: vnToday(), notes: '' });

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

  // Thêm / Sửa vật tư
  const handleItemSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: itemForm.name,
      unit: itemForm.unit,
      min_stock: itemForm.min_stock || 0,
      notes: itemForm.notes,
    };
    const { error } = itemForm.id
      ? await supabase.from('inventory_items').update(payload).eq('id', itemForm.id)
      : await supabase.from('inventory_items').insert([payload]);

    if (error) toast.error(error.message);
    else {
      toast.success(itemForm.id ? 'Đã cập nhật vật tư!' : 'Thêm vật tư thành công!');
      setShowItemModal(false);
      setItemForm({ id: null, name: '', unit: '', min_stock: 10, notes: '' });
      loadData();
    }
    setSaving(false);
  };

  const openEditItem = (item) => {
    setItemForm({ id: item.id, name: item.name, unit: item.unit, min_stock: item.min_stock || 0, notes: item.notes || '' });
    setShowItemModal(true);
  };

  const openStock = (item) => { setStockModal(item); setStockValue(String(item.current_stock ?? 0)); };
  const saveStock = async () => {
    const qty = Number(String(stockValue).replace(/[^\d.-]/g, ''));
    if (Number.isNaN(qty)) { toast.error('Nhập số lượng hợp lệ'); return; }
    setSaving(true);
    const { error } = await supabase.from('inventory_items').update({ current_stock: qty }).eq('id', stockModal.id);
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã cập nhật tồn kho'); setStockModal(null); loadData();
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Xoá vật tư "${item.name}"? Hành động này không thể hoàn tác.`)) return;
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (error) toast.error('Không xoá được (có thể vật tư đã phát sinh giao dịch): ' + error.message);
    else { toast.success('Đã xoá vật tư'); loadData(); }
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
      setImportForm({ item_id: '', quantity: '', date: vnToday(), notes: '' });
      loadData();
    }
    setSaving(false);
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4">
      {!isNested && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="e-card-title">Quản lý Kho / Vật tư y tế</h2>
            <p className="e-page-desc mt-0.5">Theo dõi tồn kho và lịch sử nhập xuất tiêu hao</p>
          </div>
        </div>
      )}

      {/* Thẻ chỉ số */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="e-metric">
          <div className="e-metric-icon"><Archive /></div>
          <div className="min-w-0">
            <div className="e-metric-label">Tổng Danh mục Vật tư</div>
            <div className="e-metric-value">{items.length}</div>
          </div>
        </div>
        <div className="e-metric">
          <div className="e-metric-icon e-tone-danger"><AlertTriangle /></div>
          <div className="min-w-0">
            <div className="e-metric-label">Vật tư sắp hết (Dưới mức tối thiểu)</div>
            <div className="e-metric-value text-danger-600">{items.filter(i => i.current_stock <= i.min_stock).length}</div>
          </div>
        </div>
        <div className="e-metric">
          <div className="e-metric-icon e-tone-info"><ArrowDownLeft /></div>
          <div className="min-w-0">
            <div className="e-metric-label">Giao dịch nhập xuất (Gần đây)</div>
            <div className="e-metric-value">{transactions.length}</div>
          </div>
        </div>
      </div>

      {/* Nội dung chính */}
      <div className="e-card overflow-hidden flex flex-col">
        {/* Tab + hành động */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-2 lg:px-3 border-b border-slate-200">
          <div className="e-tabs border-b-0 w-full md:w-auto">
            <button onClick={() => setActiveTab('stock')} className={`e-tab ${activeTab === 'stock' ? 'e-tab-active' : ''}`}>
              <PackageOpen /> Tồn kho
            </button>
            <button onClick={() => setActiveTab('history')} className={`e-tab ${activeTab === 'history' ? 'e-tab-active' : ''}`}>
              <History /> Lịch sử Nhập / Xuất
            </button>
            <button onClick={() => setActiveTab('by_customer')} className={`e-tab ${activeTab === 'by_customer' ? 'e-tab-active' : ''}`}>
              <Users /> Vật tư theo khách
            </button>
          </div>

          {activeTab === 'stock' && canWrite && (
            <div className="flex gap-2 w-full md:w-auto pb-3 md:pb-0 px-2 md:px-0">
              <button onClick={() => { setItemForm({ id: null, name: '', unit: '', min_stock: 10, notes: '' }); setShowItemModal(true); }} className="e-btn e-btn-secondary e-btn-sm flex-1 md:flex-none">
                <Plus className="w-4 h-4" /> Danh mục mới
              </button>
              <button onClick={() => setShowImportModal(true)} className="e-btn e-btn-primary e-btn-sm flex-1 md:flex-none">
                <ArrowDownLeft className="w-4 h-4" /> Nhập Kho
              </button>
            </div>
          )}
        </div>

        {/* Tab: Stock */}
        {activeTab === 'stock' && (
          <div className="flex flex-col h-[600px]">
            <div className="px-4 lg:px-5 py-3 border-b border-slate-100">
              <div className="e-search max-w-md">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" placeholder="Tìm kiếm tên vật tư..." 
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            {/* Mobile: dạng thẻ */}
            <div className="md:hidden overflow-auto flex-1 p-3 space-y-3 bg-slate-50/60">
              {loading ? (
                <div className="e-empty text-[13px] text-slate-400">Đang tải...</div>
              ) : filteredItems.length === 0 ? (
                <div className="e-empty text-[13px] text-slate-400">Chưa có vật tư nào</div>
              ) : filteredItems.map((item) => (
                <div key={item.id} className="e-card-flat p-4">
                  <div className="flex items-start gap-3">
                    <span className="e-avatar w-11 h-11 rounded-xl"><PackageOpen className="w-5 h-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] text-slate-900">{item.name}</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">{item.unit} · Tối thiểu {item.min_stock}{item.notes ? ' · ' + item.notes : ''}</div>
                    </div>
                    <span className={`e-badge tabular-nums shrink-0 ${item.current_stock <= item.min_stock ? 'e-tone-danger' : 'e-tone-success'}`}>
                      {item.current_stock}{item.current_stock <= item.min_stock ? ' ⚠️' : ''}
                    </span>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button onClick={() => openEditItem(item)} title="Cập nhật mức tối thiểu" className="e-btn e-btn-secondary e-btn-sm flex-1">Cập nhật</button>
                      <button onClick={() => openStock(item)} title="Sửa tồn kho" className="e-btn e-btn-outline e-btn-sm flex-1">Sửa</button>
                      <button onClick={() => deleteItem(item)} className="e-icon-btn w-[34px] h-[34px] rounded-[10px] text-slate-400 hover:text-danger-600 hover:border-danger-200 hover:bg-danger-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: bảng */}
            <div className="hidden md:block overflow-auto flex-1">
              <table className="e-table">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="text-left">Tên Vật Tư</th>
                    <th className="text-center">Đơn vị</th>
                    <th className="num">Tồn kho hiện tại</th>
                    <th className="num">Mức tối thiểu</th>
                    <th className="text-left">Ghi chú</th>
                    {canWrite && <th className="text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="align-middle">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Đang tải...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Chưa có vật tư nào</td></tr>
                  ) : filteredItems.map((item) => (
                    <tr key={item.id} className="transition-colors">
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="e-avatar w-9 h-9 rounded-xl"><PackageOpen className="w-4 h-4" /></span>
                          <span className="font-semibold text-slate-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="text-center text-slate-600">{item.unit}</td>
                      <td className="text-right">
                        <span className={`e-badge tabular-nums ${
                          item.current_stock <= item.min_stock ? 'e-tone-danger' : 'e-tone-success'
                        }`}>
                          {item.current_stock}{item.current_stock <= item.min_stock ? ' ⚠️' : ''}
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-slate-500">{item.min_stock}</td>
                      <td className="text-slate-500">{item.notes}</td>
                      {canWrite && (
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEditItem(item)} title="Cập nhật mức tối thiểu" className="e-btn e-btn-secondary e-btn-sm">Cập nhật</button>
                            <button onClick={() => openStock(item)} title="Sửa số lượng tồn kho" className="e-btn e-btn-outline e-btn-sm">Sửa</button>
                            <button onClick={() => deleteItem(item)} className="e-icon-btn w-[34px] h-[34px] rounded-[10px] text-slate-400 hover:text-danger-600 hover:border-danger-200 hover:bg-danger-50" title="Xoá"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      )}
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
             <table className="e-table">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="text-left">Ngày</th>
                    <th className="text-left">Vật tư</th>
                    <th className="text-left">Loại</th>
                    <th className="num">Số lượng</th>
                    <th className="text-left">Người thực hiện</th>
                    <th className="text-left">Ghi chú / Ca mổ</th>
                  </tr>
                </thead>
                <tbody className="align-middle">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Đang tải...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Chưa có giao dịch nào</td></tr>
                  ) : transactions.map((t) => (
                    <tr key={t.id} className="transition-colors">
                      <td className="text-slate-600 tabular-nums whitespace-nowrap">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="e-avatar w-9 h-9 rounded-xl"><PackageOpen className="w-4 h-4" /></span>
                          <span className="font-semibold text-slate-900">{t.inventory_items?.name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {t.type === 'import' ? (
                          <span className="e-badge e-badge-sm e-tone-success"><ArrowDownLeft className="w-3 h-3"/> Nhập kho</span>
                        ) : (
                          <span className="e-badge e-badge-sm e-tone-warning"><ArrowUpRight className="w-3 h-3"/> Xuất tiêu hao</span>
                        )}
                      </td>
                      <td className={`font-bold text-right tabular-nums whitespace-nowrap ${t.type === 'import' ? 'text-success-600' : 'text-danger-600'}`}>
                        {t.type === 'import' ? '+' : '-'}{t.quantity} <span className="text-[12px] font-normal text-slate-400 ml-1">{t.inventory_items?.unit}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="e-avatar w-8 h-8"><UserRound className="w-4 h-4" /></span>
                          <span className="text-slate-700">{t.profiles?.full_name || 'Hệ thống'}</span>
                        </div>
                      </td>
                      <td className="text-slate-500">{t.notes}</td>
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
            <div className="p-4 lg:p-5 space-y-3 max-h-[600px] overflow-auto bg-slate-50/60">
              {loading ? (
                <div className="e-empty text-[13px] text-slate-400">Đang tải...</div>
              ) : entries.length === 0 ? (
                <div className="e-empty text-[13px] text-slate-400">Chưa có khách nào dùng vật tư.</div>
              ) : entries.map(([ref, list]) => {
                const cust = customerMap[ref];
                // Gộp cùng 1 loại vật tư (cộng dồn qua các lần báo cáo)
                const merged = Object.values(list.reduce((acc, t) => {
                  const key = t.item_id || t.inventory_items?.name;
                  if (!acc[key]) acc[key] = { name: t.inventory_items?.name, unit: t.inventory_items?.unit, qty: 0 };
                  acc[key].qty += Number(t.quantity || 0);
                  return acc;
                }, {}));
                return (
                  <div key={ref} className="e-card-flat overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="e-avatar w-10 h-10"><UserRound className="w-5 h-5" /></span>
                        <div className="min-w-0">
                        <div className="font-semibold text-[15px] text-slate-900 truncate">{cust?.name || 'Khách (đã xóa)'}</div>
                        <div className="text-[12px] text-slate-500">{cust?.date ? 'Ngày mổ: ' + new Date(cust.date).toLocaleDateString('vi-VN') : ''}</div>
                        </div>
                      </div>
                      <span className="e-badge e-badge-sm e-tone-lavender shrink-0">{merged.length} loại vật tư</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {merged.map((m, i) => (
                          <tr key={i} className="hover:bg-teal-50/30">
                            <td className="px-4 py-3 font-medium text-slate-700">{m.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-danger-600 tabular-nums">-{m.qty} <span className="text-[12px] font-normal text-slate-400 ml-1">{m.unit}</span></td>
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
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleItemSubmit} className="e-modal max-w-md overflow-hidden flex flex-col">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">{itemForm.id ? 'Sửa Danh mục Vật tư' : 'Thêm Danh mục Vật tư'}</h3>
              <button type="button" onClick={() => setShowItemModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Tên vật tư *</label>
                <input required type="text" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="e-input" placeholder="VD: Bơm tiêm 5ml" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="e-label">Đơn vị *</label>
                  <input required type="text" value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} className="e-input" placeholder="Cái, Hộp, Vỉ..." />
                </div>
                <div>
                  <label className="e-label">Tồn tối thiểu</label>
                  <input type="number" min="0" value={itemForm.min_stock} onChange={e => setItemForm({...itemForm, min_stock: Number(e.target.value)})} className="e-input" placeholder="VD: 10" />
                </div>
              </div>
              <div>
                <label className="e-label">Ghi chú</label>
                <textarea value={itemForm.notes} onChange={e => setItemForm({...itemForm, notes: e.target.value})} className="e-textarea h-20 resize-none" />
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="button" onClick={() => setShowItemModal(false)} className="e-btn e-btn-secondary">Hủy</button>
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">Lưu danh mục</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Import Stock */}
      {showImportModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <form onSubmit={handleImportSubmit} className="e-modal max-w-md overflow-hidden flex flex-col">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Phiếu Nhập Kho</h3>
              <button type="button" onClick={() => setShowImportModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div>
                <label className="e-label">Chọn vật tư *</label>
                <select required value={importForm.item_id} onChange={e => setImportForm({...importForm, item_id: e.target.value})} className="e-input font-medium">
                  <option value="">-- Chọn vật tư cần nhập --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (Tồn: {i.current_stock})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="e-label">Số lượng nhập *</label>
                  <input required type="number" min="1" value={importForm.quantity} onChange={e => setImportForm({...importForm, quantity: Number(e.target.value)})} className="e-input font-bold text-[16px] text-slate-900 tabular-nums" placeholder="0" />
                </div>
                <div>
                  <label className="e-label">Ngày nhập</label>
                  <input required type="date" value={importForm.date} onChange={e => setImportForm({...importForm, date: e.target.value})} className="e-input" />
                </div>
              </div>
              <div>
                <label className="e-label">Ghi chú / Nguồn nhập</label>
                <textarea value={importForm.notes} onChange={e => setImportForm({...importForm, notes: e.target.value})} className="e-textarea h-20 resize-none" placeholder="Nhập từ nhà cung cấp nào..." />
              </div>
            </div>
            <div className="e-modal-footer">
              <button type="button" onClick={() => setShowImportModal(false)} className="e-btn e-btn-secondary">Hủy</button>
              <button type="submit" disabled={saving} className="e-btn e-btn-primary">Hoàn tất Nhập</button>
            </div>
          </form>
        </div>
      )}

      {stockModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4" onClick={() => setStockModal(null)}>
          <div className="e-modal max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Sửa tồn kho</h3>
              <button type="button" onClick={() => setStockModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body">
              <p className="text-[13px] text-slate-500 mb-3"><b className="text-slate-900">{stockModal.name}</b> · đơn vị {stockModal.unit}</p>
              <label className="e-label">Số lượng tồn kho hiện tại</label>
              <input type="number" autoFocus value={stockValue} onChange={e => setStockValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveStock(); }}
                className="e-input h-12 font-bold text-[18px] text-slate-900 text-center tabular-nums" placeholder="0" />
              <p className="text-[12px] text-slate-400 mt-2">Chỉnh số tồn thực tế (kiểm kê). Nhập/xuất sau đó vẫn cộng/trừ bình thường.</p>
            </div>
            <div className="e-modal-footer">
              <button type="button" onClick={() => setStockModal(null)} className="e-btn e-btn-secondary">Hủy</button>
              <button type="button" onClick={saveStock} disabled={saving} className="e-btn e-btn-primary min-w-[96px]">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
