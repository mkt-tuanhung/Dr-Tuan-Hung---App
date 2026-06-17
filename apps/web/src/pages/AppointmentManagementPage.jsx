import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Plus, X, Calendar as CalendarIcon, Phone, User, Activity, CheckCircle, ChevronLeft, ChevronRight, BarChart2, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const AppointmentManagementPage = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [appointments, setAppointments] = useState([]);
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    customer_name: '', phone: '', appointment_date: today.toISOString().split('T')[0], service: '', notes: ''
  });

  // Eval Modal State
  const [evalApp, setEvalApp] = useState(null);
  const [evalSaving, setEvalSaving] = useState(false);
  const [evalForm, setEvalForm] = useState({
    status: 'coc',
    deposit_date: today.toISOString().split('T')[0], deposit_amount: '', expected_surgery_date: '', service: '',
    revenue: '', upsale_revenue: '', notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name)')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date', { ascending: true });

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      setAppointments(data || []);
      
      // Calculate Stats
      const counts = { scheduled: 0, coc: 0, phau_thuat: 0, bong: 0 };
      (data || []).forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
      
      setStatsData([
        { name: 'Lịch mới', value: counts.scheduled, color: '#3b82f6' },
        { name: 'Khách cọc', value: counts.coc, color: '#eab308' },
        { name: 'Phẫu thuật', value: counts.phau_thuat, color: '#a855f7' },
        { name: 'Khách bong', value: counts.bong, color: '#ef4444' }
      ]);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.customer_name || !createForm.appointment_date) {
      toast.error('Vui lòng nhập đủ tên và ngày hẹn'); return;
    }
    setSavingCreate(true);
    try {
      const { error } = await supabase.from('customer_appointments').insert({
        customer_name: createForm.customer_name,
        phone: createForm.phone,
        appointment_date: createForm.appointment_date,
        service: createForm.service,
        notes: createForm.notes,
        status: 'scheduled',
        created_by: profile.id
      });
      if (error) throw error;
      toast.success('Đã thêm lịch hẹn!');
      setShowCreateModal(false);
      setCreateForm({ customer_name: '', phone: '', appointment_date: today.toISOString().split('T')[0], service: '', notes: '' });
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCreate(false);
    }
  };

  const openEvalModal = (app) => {
    setEvalApp(app);
    setEvalForm({
      status: 'coc',
      deposit_date: today.toISOString().split('T')[0],
      deposit_amount: app.deposit_amount || '',
      expected_surgery_date: app.expected_surgery_date || '',
      service: app.service || '',
      revenue: app.revenue || '',
      upsale_revenue: app.upsale_revenue || '',
      notes: app.notes || ''
    });
  };

  const handleEvalSubmit = async (e) => {
    e.preventDefault();
    setEvalSaving(true);
    try {
      let updateData = { status: evalForm.status };
      if (evalForm.status === 'coc') {
        updateData = { ...updateData, deposit_date: evalForm.deposit_date, deposit_amount: evalForm.deposit_amount || 0, service: evalForm.service, expected_surgery_date: evalForm.expected_surgery_date || null };
      } else if (evalForm.status === 'phau_thuat') {
        updateData = { ...updateData, surgery_date: evalForm.expected_surgery_date || null, revenue: evalForm.revenue || 0, upsale_revenue: evalForm.upsale_revenue || 0, service: evalForm.service };
      } else if (evalForm.status === 'bong') {
        updateData = { ...updateData, notes: evalForm.notes };
      }
      
      const { error } = await supabase.from('customer_appointments').update(updateData).eq('id', evalApp.id);
      if (error) throw error;
      
      toast.success('Đã cập nhật đánh giá!');
      setEvalApp(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEvalSaving(false);
    }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const scheduledAppointments = appointments.filter(a => a.status === 'scheduled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tiếp nhận & Đánh giá Lịch hẹn</h2>
          <p className="text-slate-500 text-sm mt-1">Danh sách khách hàng chờ Sale Offline tư vấn</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2 bg-white rounded-xl border border-slate-200 p-1">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Thêm Lịch Hẹn
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Stats & Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsData.map(stat => (
                <div key={stat.name} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.name}</p>
                  <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pending Appointments List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Danh sách Khách hàng chờ đánh giá
              </h3>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{scheduledAppointments.length} khách</span>
            </div>
            
            {scheduledAppointments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                Không có lịch hẹn mới nào cần đánh giá
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5 font-medium">Khách hàng</th>
                    <th className="px-6 py-3.5 font-medium">Số điện thoại</th>
                    <th className="px-6 py-3.5 font-medium">Ngày hẹn</th>
                    <th className="px-6 py-3.5 font-medium">Dịch vụ</th>
                    <th className="px-6 py-3.5 font-medium">Người tạo</th>
                    <th className="px-6 py-3.5 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {scheduledAppointments.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-slate-700">{app.customer_name}</td>
                      <td className="px-6 py-4 text-slate-600">{app.phone}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(app.appointment_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{app.service}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{app.profiles?.full_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openEvalModal(app)} 
                          className="px-4 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-semibold hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 shadow-sm text-xs">
                          Đánh giá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modal Đánh Giá */}
      {evalApp && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Đánh giá khách hàng</h3>
              <button onClick={() => setEvalApp(null)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEvalSubmit} className="p-6 flex-1 overflow-y-auto space-y-5">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Thông tin khách hàng</p>
                <p className="font-bold text-slate-800 text-lg">{evalApp.customer_name} <span className="text-sm font-normal text-slate-500 ml-2">{evalApp.phone}</span></p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Kết quả tư vấn</label>
                <div className="grid grid-cols-3 gap-3">
                  <div onClick={() => setEvalForm({...evalForm, status: 'coc'})}
                    className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all ${evalForm.status === 'coc' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <div className="font-bold text-sm">KHÁCH CỌC</div>
                  </div>
                  <div onClick={() => setEvalForm({...evalForm, status: 'phau_thuat'})}
                    className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all ${evalForm.status === 'phau_thuat' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <div className="font-bold text-sm">PHẪU THUẬT</div>
                  </div>
                  <div onClick={() => setEvalForm({...evalForm, status: 'bong'})}
                    className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all ${evalForm.status === 'bong' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <div className="font-bold text-sm">KHÁCH BONG</div>
                  </div>
                </div>
              </div>

              {/* Form CỌC */}
              {evalForm.status === 'coc' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ngày cọc</label>
                      <input type="date" required value={evalForm.deposit_date} onChange={e => setEvalForm({...evalForm, deposit_date: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-yellow-400 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tiền cọc (VNĐ)</label>
                      <input type="number" required value={evalForm.deposit_amount} onChange={e => setEvalForm({...evalForm, deposit_amount: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-yellow-400 outline-none text-sm" placeholder="VD: 5000000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ sử dụng</label>
                    <input type="text" value={evalForm.service} onChange={e => setEvalForm({...evalForm, service: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-yellow-400 outline-none text-sm" placeholder="VD: Cắt mí..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ngày PT dự kiến</label>
                    <input type="date" value={evalForm.expected_surgery_date} onChange={e => setEvalForm({...evalForm, expected_surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-yellow-400 outline-none text-sm" />
                  </div>
                </div>
              )}

              {/* Form PHẪU THUẬT */}
              {evalForm.status === 'phau_thuat' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ngày phẫu thuật</label>
                      <input type="date" required value={evalForm.expected_surgery_date} onChange={e => setEvalForm({...evalForm, expected_surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-purple-400 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ</label>
                      <input type="text" value={evalForm.service} onChange={e => setEvalForm({...evalForm, service: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-purple-400 outline-none text-sm" placeholder="VD: Nâng mũi..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Doanh thu (VNĐ)</label>
                      <input type="number" required value={evalForm.revenue} onChange={e => setEvalForm({...evalForm, revenue: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-purple-400 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Doanh thu Upsale</label>
                      <input type="number" value={evalForm.upsale_revenue} onChange={e => setEvalForm({...evalForm, upsale_revenue: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-purple-400 outline-none text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Form BONG */}
              {evalForm.status === 'bong' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú / Lý do rớt</label>
                    <textarea rows={3} value={evalForm.notes} onChange={e => setEvalForm({...evalForm, notes: e.target.value})} className="w-full px-3 py-2 rounded-lg border focus:border-red-400 outline-none text-sm resize-none" placeholder="Nhập lý do khách bong..." />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t mt-6">
                <button type="submit" disabled={evalSaving}
                  className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {evalSaving ? 'Đang lưu...' : 'Lưu Đánh Giá & Chuyển Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Lịch Hẹn */}
      {showCreateModal && (
         <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 text-lg">Thêm Lịch Hẹn</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                <input required value={createForm.customer_name} onChange={e => setCreateForm({...createForm, customer_name: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border focus:border-emerald-400 outline-none text-sm" placeholder="Nhập tên KH..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                  <input value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border focus:border-emerald-400 outline-none text-sm" placeholder="09xxxx..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày hẹn <span className="text-red-500">*</span></label>
                  <input required type="date" value={createForm.appointment_date} onChange={e => setCreateForm({...createForm, appointment_date: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border focus:border-emerald-400 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ</label>
                <input value={createForm.service} onChange={e => setCreateForm({...createForm, service: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border focus:border-emerald-400 outline-none text-sm" placeholder="Ví dụ: Cắt mí..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                <textarea rows={2} value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border focus:border-emerald-400 outline-none text-sm resize-none" placeholder="Ghi chú thêm..." />
              </div>
              <button type="submit" disabled={savingCreate} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors mt-4">
                {savingCreate ? 'Đang lưu...' : 'Lưu lịch hẹn'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagementPage;
