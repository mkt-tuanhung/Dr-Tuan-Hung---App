import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Banknote, TrendingUp, Search, Calendar as CalendarIcon, CheckCircle, Image as ImageIcon, X, ChevronLeft, ChevronRight, Pencil, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const VienPhiPage = ({ isNested = false }) => {
  const { profile } = useAuth();
  const canEdit = ['admin', 'accountant'].includes(profile?.role);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState(null);
  const [search, setSearch] = useState('');
  const [editApp, setEditApp] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', method: 'cash', date: '', proof: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: appsData } = await supabase
        .from('customer_appointments')
        .select('*')
        .not('hospital_fee', 'is', null)
        .order('hospital_fee_date', { ascending: false });
      
      if (appsData) setData(appsData);
      setLoading(false);
    };
    loadData();
  }, []);

  // Lọc theo tháng đang chọn (theo ngày thu viện phí)
  const monthData = data.filter(d => {
    if (!d.hospital_fee_date) return false;
    const dt = new Date(d.hospital_fee_date);
    return dt.getMonth() + 1 === month && dt.getFullYear() === year;
  });

  const filteredData = monthData.filter(d =>
    d.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone && d.phone.includes(search)) ||
    (d.service && d.service.toLowerCase().includes(search.toLowerCase()))
  );

  const totalFee = monthData.reduce((acc, curr) => acc + (curr.hospital_fee || 0), 0);
  const totalCash = monthData.filter(d => d.hospital_fee_method === 'cash').reduce((acc, curr) => acc + (curr.hospital_fee || 0), 0);
  const totalTransfer = monthData.filter(d => d.hospital_fee_method === 'transfer').reduce((acc, curr) => acc + (curr.hospital_fee || 0), 0);

  const pieData = [
    { name: 'Tiền mặt', value: totalCash, color: '#10b981' },
    { name: 'Chuyển khoản', value: totalTransfer, color: '#3b82f6' }
  ];

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  const fmtInput = (v) => { const x = String(v || '').replace(/\D/g, ''); return x ? new Intl.NumberFormat('vi-VN').format(x) : ''; };

  const openEdit = (app) => {
    setEditApp(app);
    setEditForm({
      amount: fmtInput(app.hospital_fee),
      method: app.hospital_fee_method || 'cash',
      date: app.hospital_fee_date ? new Date(app.hospital_fee_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      proof: app.hospital_fee_proof || '',
    });
  };

  const handleEditUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const url = await uploadToR2(file, 'vien-phi'); setEditForm(f => ({ ...f, proof: url })); toast.success('Đã tải ảnh'); }
    catch (err) { toast.error('Lỗi tải ảnh: ' + err.message); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveEdit = async () => {
    const amount = Number(String(editForm.amount).replace(/\D/g, '')) || 0;
    if (!amount) { toast.error('Nhập số tiền'); return; }
    setSaving(true);
    const payload = {
      hospital_fee: amount,
      hospital_fee_method: editForm.method,
      hospital_fee_proof: editForm.proof || null,
      hospital_fee_date: new Date(editForm.date).toISOString(),
    };
    const { error } = await supabase.from('customer_appointments').update(payload).eq('id', editApp.id);
    if (error) { toast.error('Lỗi: ' + error.message); setSaving(false); return; }
    setData(prev => prev.map(d => d.id === editApp.id ? { ...d, ...payload } : d));
    toast.success('Đã cập nhật viện phí');
    setEditApp(null);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {!isNested && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Quản lý Viện phí</h2>
            <p className="text-slate-500 text-sm mt-1">Theo dõi các khoản thu viện phí từ khách hàng phẫu thuật</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-200">
                <div className="flex items-center gap-3 mb-4 opacity-80">
                  <Banknote className="w-6 h-6" />
                  <h3 className="font-semibold">Tổng viện phí đã tạm ứng</h3>
                </div>
                <div className="text-3xl font-bold mb-2">{fmt(totalFee)}</div>
                <div className="text-blue-100 text-sm flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Tháng {month}/{year} · {monthData.length} lượt</div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <h3 className="text-slate-500 text-sm font-semibold mb-1">Tiền mặt</h3>
                  <div className="text-2xl font-bold text-slate-800">{fmt(totalCash)}</div>
                </div>
                <div className="text-emerald-600 text-sm font-semibold mt-2">
                  {totalFee ? ((totalCash / totalFee) * 100).toFixed(1) : 0}%
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-slate-500 text-sm font-semibold mb-1">Chuyển khoản</h3>
                  <div className="text-2xl font-bold text-slate-800">{fmt(totalTransfer)}</div>
                </div>
                <div className="text-blue-600 text-sm font-semibold mt-2">
                  {totalFee ? ((totalTransfer / totalFee) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center">
              <h3 className="text-slate-500 text-sm font-semibold mb-4 w-full text-left">Tỷ trọng phương thức thanh toán</h3>
              <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Banknote className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">Danh sách viện phí tạm ứng</h3>
                  <p className="text-xs text-slate-400">Các khoản viện phí khách đã tạm ứng theo tháng</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm khách hàng..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl px-1 py-0.5 shrink-0">
                  <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs font-bold text-slate-700 px-1 whitespace-nowrap">Th{month}/{year}</span>
                  <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {/* Mobile: thẻ */}
            <div className="md:hidden p-3 space-y-3">
              {filteredData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic text-sm">Không có viện phí trong tháng {month}/{year}.</div>
              ) : filteredData.map(app => (
                <div key={app.id} className="border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800">{app.customer_name}</div>
                      <div className="text-xs text-slate-400">{app.phone || 'Không có SĐT'}</div>
                    </div>
                    <div className="font-bold text-blue-600 text-base shrink-0">{fmt(app.hospital_fee)}</div>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{app.service || 'Chưa rõ'}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${app.hospital_fee_method === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                      <Banknote className="w-3 h-3" /> {app.hospital_fee_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </span>
                    <span className="text-xs text-slate-400">{app.hospital_fee_date ? new Date(app.hospital_fee_date).toLocaleDateString('vi-VN') : '—'}</span>
                    {app.hospital_fee_proof && <button onClick={() => setViewImage(app.hospital_fee_proof)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ImageIcon className="w-4 h-4" /></button>}
                    {canEdit && <button onClick={() => openEdit(app)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg ml-auto"><Pencil className="w-4 h-4" /></button>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: bảng */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[560px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Khách hàng</th>
                    <th className="px-6 py-4 font-semibold">Dịch vụ mổ</th>
                    <th className="px-6 py-4 font-semibold">Viện phí (VNĐ)</th>
                    <th className="px-6 py-4 font-semibold">Hình thức</th>
                    <th className="px-6 py-4 font-semibold">Thời gian thu</th>
                    <th className="px-6 py-4 font-semibold text-center">Hoá đơn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredData.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{app.customer_name}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{app.phone || 'Không có SĐT'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-semibold">{app.service || 'Chưa rõ'}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-600 text-base">
                        {fmt(app.hospital_fee)}
                      </td>
                      <td className="px-6 py-4">
                        {app.hospital_fee_method === 'cash' ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-100">
                            <Banknote className="w-3.5 h-3.5" /> Tiền mặt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-100">
                            <Banknote className="w-3.5 h-3.5" /> Chuyển khoản
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        {app.hospital_fee_date ? new Date(app.hospital_fee_date).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {app.hospital_fee_proof ? (
                            <button onClick={() => setViewImage(app.hospital_fee_proof)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors inline-flex">
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Không có</span>
                          )}
                          {canEdit && (
                            <button onClick={() => openEdit(app)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors inline-flex" title="Sửa"><Pencil className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr><td colSpan="6" className="text-center py-10 text-slate-400 italic">Không tìm thấy dữ liệu.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal sửa viện phí */}
      {editApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50 shrink-0">
              <div>
                <h3 className="font-bold text-blue-800">Sửa viện phí</h3>
                <p className="text-xs text-blue-400">{editApp.customer_name}</p>
              </div>
              <button onClick={() => setEditApp(null)}><X className="w-5 h-5 text-blue-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Số tiền (VNĐ)</label>
                <input type="text" inputMode="numeric" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: fmtInput(e.target.value) }))} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 font-bold text-blue-700 text-lg" placeholder="1.000.000" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Ngày thu</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditForm(f => ({ ...f, method: 'transfer' }))} className={`flex-1 py-2 border rounded-xl font-bold text-sm ${editForm.method === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'text-slate-500 border-slate-200'}`}>Chuyển khoản</button>
                <button type="button" onClick={() => setEditForm(f => ({ ...f, method: 'cash' }))} className={`flex-1 py-2 border rounded-xl font-bold text-sm ${editForm.method === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-slate-500 border-slate-200'}`}>Tiền mặt</button>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-xl text-center text-slate-400 hover:border-blue-400">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (editForm.proof ? <img src={editForm.proof} alt="" className="max-h-20 mx-auto" /> : 'Tải / đổi bill')}
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleEditUpload} />
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={() => setEditApp(null)} className="px-5 py-2 border rounded-xl font-semibold text-slate-600 hover:bg-white">Đóng</button>
              <button onClick={handleSaveEdit} disabled={saving || uploading} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <div className="relative max-w-5xl w-full flex justify-center">
            <button onClick={() => setViewImage(null)} className="absolute -top-12 right-0 md:-right-12 text-white hover:text-slate-300 p-2">
              <X className="w-8 h-8" />
            </button>
            <img src={viewImage} alt="Hoá đơn" className="max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VienPhiPage;
