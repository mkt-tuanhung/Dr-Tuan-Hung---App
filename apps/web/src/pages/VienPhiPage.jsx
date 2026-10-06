import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Banknote, TrendingUp, Search, Calendar as CalendarIcon, CheckCircle, Image as ImageIcon, X, ChevronLeft, ChevronRight, Pencil, Loader2, UserRound } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { vnToday } from '@/lib/vnTime';

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
    { name: 'Tiền mặt', value: totalCash, color: '#067B7F' },
    { name: 'Chuyển khoản', value: totalTransfer, color: '#A99BE0' }
  ];

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  const fmtInput = (v) => { const x = String(v || '').replace(/\D/g, ''); return x ? new Intl.NumberFormat('vi-VN').format(x) : ''; };

  const openEdit = (app) => {
    setEditApp(app);
    setEditForm({
      amount: fmtInput(app.hospital_fee),
      method: app.hospital_fee_method || 'cash',
      date: app.hospital_fee_date ? new Date(app.hospital_fee_date).toISOString().split('T')[0] : vnToday(),
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
    <div className="space-y-4">
      {!isNested && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="e-card-title">Quản lý Viện phí</h2>
            <p className="e-page-desc mt-0.5">Theo dõi các khoản thu viện phí từ khách hàng phẫu thuật</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="e-card e-card-pad grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-0.5 content-center min-w-0">
                <div className="contents">
                  <Banknote className="row-span-3 w-12 h-12 lg:w-14 lg:h-14 p-3 lg:p-4 rounded-full bg-teal-50 text-teal-700" />
                  <h3 className="e-metric-label">Tổng viện phí đã tạm ứng</h3>
                </div>
                <div className="e-metric-value">{fmt(totalFee)}</div>
                <div className="e-metric-hint flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-teal-600 shrink-0" /> Tháng {month}/{year} · {monthData.length} lượt</div>
              </div>

              <div className="e-card e-card-pad grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-0.5 content-center min-w-0">
                <div className="contents">
                  <div className="e-metric-icon row-span-3">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <h3 className="e-metric-label">Tiền mặt</h3>
                  <div className="e-metric-value">{fmt(totalCash)}</div>
                </div>
                <div className="text-[12px] font-semibold text-teal-700 tabular-nums">
                  {totalFee ? ((totalCash / totalFee) * 100).toFixed(1) : 0}%
                </div>
              </div>

              <div className="e-card e-card-pad grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-0.5 content-center min-w-0">
                <div className="contents">
                  <div className="e-metric-icon e-tone-lavender row-span-3">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="e-metric-label">Chuyển khoản</h3>
                  <div className="e-metric-value">{fmt(totalTransfer)}</div>
                </div>
                <div className="text-[12px] font-semibold text-lavender-600 tabular-nums">
                  {totalFee ? ((totalTransfer / totalFee) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="e-card e-card-pad flex flex-col items-center justify-center">
              <h3 className="text-[14px] font-semibold text-slate-800 mb-2 w-full text-left">Tỷ trọng phương thức thanh toán</h3>
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
              <div className="flex items-center justify-center gap-4 mt-2 text-[12px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#067B7F]" /> Tiền mặt</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#A99BE0]" /> Chuyển khoản</span>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Banknote className="w-5 h-5" /></div>
                <div>
                  <h3 className="e-card-title">Danh sách viện phí tạm ứng</h3>
                  <p className="e-card-sub">Các khoản viện phí khách đã tạm ứng theo tháng</p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:w-[420px]">
                <div className="e-search flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm khách hàng..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="e-seg gap-0.5 shrink-0">
                  <button onClick={prevMonth} className="w-8 h-8 rounded-[9px] grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-800 transition"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-[13px] font-semibold text-slate-700 px-1.5 whitespace-nowrap tabular-nums">Th{month}/{year}</span>
                  <button onClick={nextMonth} className="w-8 h-8 rounded-[9px] grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-800 transition"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {/* Mobile: thẻ */}
            <div className="md:hidden p-3 space-y-3">
              {filteredData.length === 0 ? (
                <div className="e-empty text-[13px] text-slate-400">Không có viện phí trong tháng {month}/{year}.</div>
              ) : filteredData.map(app => (
                <div key={app.id} className="e-card-flat p-4">
                  <div className="flex items-start gap-3">
                    <span className="e-avatar w-11 h-11"><UserRound className="w-5 h-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] text-slate-900 truncate">{app.customer_name}</div>
                      <div className="text-[12px] text-slate-500">{app.phone || 'Không có SĐT'}</div>
                    </div>
                    <span className={`e-badge e-badge-sm shrink-0 ${app.hospital_fee_method === 'cash' ? 'e-tone-brand' : 'e-tone-lavender'}`}>
                      <Banknote className="w-3 h-3" /> {app.hospital_fee_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="e-kv-label">Dịch vụ mổ</div>
                      <div className="e-kv-value truncate">{app.service || 'Chưa rõ'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="e-kv-label">Viện phí</div>
                      <div className="text-[17px] font-bold text-slate-900 tabular-nums">{fmt(app.hospital_fee)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 tabular-nums"><CalendarIcon className="w-3.5 h-3.5 text-slate-400" />{app.hospital_fee_date ? new Date(app.hospital_fee_date).toLocaleDateString('vi-VN') : '—'}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {app.hospital_fee_proof && <button onClick={() => setViewImage(app.hospital_fee_proof)} className="e-icon-btn w-8 h-8 rounded-lg" title="Xem hoá đơn"><ImageIcon className="w-4 h-4" /></button>}
                      {canEdit && <button onClick={() => openEdit(app)} className="e-icon-btn w-8 h-8 rounded-lg" title="Sửa"><Pencil className="w-4 h-4" /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: bảng */}
            <div className="hidden md:block e-table-wrap">
              <table className="e-table min-w-[560px]">
                <thead>
                  <tr className="text-left">
                    <th className="text-left">Khách hàng</th>
                    <th className="text-left">Dịch vụ mổ</th>
                    <th className="num">Viện phí (VNĐ)</th>
                    <th className="text-left">Hình thức</th>
                    <th className="text-left">Thời gian thu</th>
                    <th className="text-center">Hoá đơn</th>
                  </tr>
                </thead>
                <tbody className="align-middle">
                  {filteredData.map(app => (
                    <tr key={app.id} className="transition-colors">
                      <td className="min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <span className="e-avatar w-9 h-9"><UserRound className="w-4 h-4" /></span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{app.customer_name}</div>
                            <div className="text-slate-500 text-[12px] mt-0.5">{app.phone || 'Không có SĐT'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-[140px]">
                        <span className="e-badge e-badge-sm e-tone-neutral">{app.service || 'Chưa rõ'}</span>
                      </td>
                      <td className="text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {fmt(app.hospital_fee)}
                      </td>
                      <td className="whitespace-nowrap">
                        {app.hospital_fee_method === 'cash' ? (
                          <span className="e-badge e-badge-sm e-tone-brand">
                            <Banknote className="w-3.5 h-3.5" /> Tiền mặt
                          </span>
                        ) : (
                          <span className="e-badge e-badge-sm e-tone-lavender">
                            <Banknote className="w-3.5 h-3.5" /> Chuyển khoản
                          </span>
                        )}
                      </td>
                      <td className="text-slate-500 text-[13px] whitespace-nowrap tabular-nums">
                        <CalendarIcon className="w-4 h-4 text-slate-400 inline-block mr-1.5 -mt-0.5" />
                        {app.hospital_fee_date ? new Date(app.hospital_fee_date).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {app.hospital_fee_proof ? (
                            <button onClick={() => setViewImage(app.hospital_fee_proof)} className="e-icon-btn w-9 h-9" title="Xem hoá đơn">
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-[12px] text-slate-400">Không có</span>
                          )}
                          {canEdit && (
                            <button onClick={() => openEdit(app)} className="e-icon-btn w-9 h-9" title="Sửa"><Pencil className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr><td colSpan="6" className="text-center py-10 text-[13px] text-slate-400">Không tìm thấy dữ liệu.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal sửa viện phí */}
      {editApp && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-sm overflow-hidden flex flex-col">
            <div className="e-modal-header items-center shrink-0">
              <div>
                <h3 className="e-modal-title">Sửa viện phí</h3>
                <p className="e-card-sub">{editApp.customer_name}</p>
              </div>
              <button onClick={() => setEditApp(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="e-modal-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="e-label">Số tiền (VNĐ)</label>
                  <input type="text" inputMode="numeric" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: fmtInput(e.target.value) }))} className="e-input font-bold text-slate-900 text-[16px] tabular-nums" placeholder="1.000.000" />
                </div>
                <div>
                  <label className="e-label">Ngày thu</label>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="e-input" />
                </div>
              </div>
              <div>
                <label className="e-label">Hình thức</label>
                <div className="e-seg w-full">
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, method: 'transfer' }))} className={`e-seg-item flex-1 ${editForm.method === 'transfer' ? 'e-seg-active' : ''}`}>Chuyển khoản</button>
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, method: 'cash' }))} className={`e-seg-item flex-1 ${editForm.method === 'cash' ? 'e-seg-active' : ''}`}>Tiền mặt</button>
                </div>
              </div>
              <div>
                <label className="e-label">Hoá đơn / bill</label>
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 bg-slate-50 p-4 rounded-xl text-center text-[13px] font-medium text-slate-500 hover:border-teal-400 hover:bg-teal-50/40 transition">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (editForm.proof ? <img src={editForm.proof} alt="" className="max-h-20 mx-auto rounded-lg" /> : 'Tải / đổi bill')}
                </button>
                <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleEditUpload} />
              </div>
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setEditApp(null)} className="e-btn e-btn-secondary">Đóng</button>
              <button onClick={handleSaveEdit} disabled={saving || uploading} className="e-btn e-btn-primary min-w-[96px]">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {viewImage && (
        <div className="fixed inset-0 bg-slate-900/85 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <button onClick={() => setViewImage(null)} className="fixed top-4 right-4 z-10 w-11 h-11 grid place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur"><X className="w-6 h-6" /></button>
          <div className="relative max-w-5xl w-full flex justify-center">
            <img src={viewImage} alt="Hoá đơn" className="max-h-[85dvh] max-w-full object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VienPhiPage;
