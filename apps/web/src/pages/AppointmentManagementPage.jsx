import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Plus, X, Calendar as CalendarIcon, Phone, User, Stethoscope, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';

const STATUS_COLUMNS = [
  { id: 'scheduled', label: 'Lịch mới', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'coc', label: 'Khách cọc', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { id: 'phau_thuat', label: 'Đã phẫu thuật', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'bong', label: 'Đã bong', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const AppointmentManagementPage = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', phone: '', appointment_date: today.toISOString().split('T')[0],
    service: '', notes: '', is_recheck: false
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
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.appointment_date) {
      toast.error('Vui lòng nhập đủ tên và ngày hẹn');
      return;
    }
    setSaving(true);
    try {
      const notesToSave = form.is_recheck ? `[RECHECK] ${form.notes}` : form.notes;
      const { error } = await supabase.from('customer_appointments').insert({
        customer_name: form.customer_name,
        phone: form.phone,
        appointment_date: form.appointment_date,
        service: form.service,
        notes: notesToSave,
        status: 'scheduled',
        created_by: profile.id
      });
      if (error) throw error;
      toast.success('Đã thêm lịch hẹn!');
      setShowModal(false);
      setForm({ customer_name: '', phone: '', appointment_date: today.toISOString().split('T')[0], service: '', notes: '', is_recheck: false });
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase.from('customer_appointments').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('Lỗi cập nhật: ' + error.message);
    else loadData();
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('appId', id);
  };

  const handleDrop = (e, statusId) => {
    const appId = e.dataTransfer.getData('appId');
    if (appId) updateStatus(appId, statusId);
  };

  const handleDragOver = (e) => e.preventDefault();

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const mainAppointments = appointments.filter(a => !(a.notes || '').startsWith('[RECHECK]'));
  const recheckAppointments = appointments.filter(a => (a.notes || '').startsWith('[RECHECK]'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản lý Lịch hẹn</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Tạo lịch hẹn
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Kanban Board */}
          <div className="grid grid-cols-4 gap-4">
            {STATUS_COLUMNS.map(col => {
              const colApps = mainAppointments.filter(a => a.status === col.id);
              return (
                <div key={col.id} className="bg-slate-50 rounded-2xl p-3 flex flex-col h-[500px]"
                  onDrop={(e) => handleDrop(e, col.id)}
                  onDragOver={handleDragOver}
                >
                  <div className={`px-3 py-2 rounded-xl border mb-3 flex items-center justify-between shadow-sm ${col.color}`}>
                    <span className="font-semibold text-sm">{col.label}</span>
                    <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full font-bold">{colApps.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
                    {colApps.map(app => (
                      <div key={app.id} draggable onDragStart={(e) => handleDragStart(e, app.id)}
                        className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:border-emerald-200 transition-colors group">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            {app.customer_name}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {app.phone && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Phone className="w-3.5 h-3.5" /> {app.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <CalendarIcon className="w-3.5 h-3.5" /> {new Date(app.appointment_date).toLocaleDateString('vi-VN')}
                          </div>
                          {app.service && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Stethoscope className="w-3.5 h-3.5" /> {app.service}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lịch tái khám */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Lịch Tái Khám</h3>
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{recheckAppointments.length} lịch</span>
            </div>
            
            {recheckAppointments.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
                Không có lịch tái khám nào trong tháng này
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Khách hàng</th>
                      <th className="px-5 py-3 font-medium">Số điện thoại</th>
                      <th className="px-5 py-3 font-medium">Ngày tái khám</th>
                      <th className="px-5 py-3 font-medium">Dịch vụ quan tâm / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recheckAppointments.map(app => (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-700 flex items-center gap-2">
                          <User className="w-4 h-4 text-emerald-500" /> {app.customer_name}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{app.phone}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {new Date(app.appointment_date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          <div className="font-medium">{app.service}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{app.notes?.replace('[RECHECK] ', '')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Tạo Lịch */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 text-lg">Tạo Lịch Hẹn</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button type="button" onClick={() => setForm({...form, is_recheck: false})}
                  className={`py-2 rounded-xl text-sm font-medium border transition-colors ${!form.is_recheck ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                  Lịch hẹn mới
                </button>
                <button type="button" onClick={() => setForm({...form, is_recheck: true})}
                  className={`py-2 rounded-xl text-sm font-medium border transition-colors ${form.is_recheck ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                  Lịch tái khám
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                <input required value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-400 text-sm" placeholder="Nhập tên KH..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-400 text-sm" placeholder="09xxxx..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày hẹn <span className="text-red-500">*</span></label>
                  <input required type="date" value={form.appointment_date} onChange={e => setForm({...form, appointment_date: e.target.value})}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-400 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{form.is_recheck ? 'Dịch vụ quan tâm' : 'Dịch vụ'}</label>
                <input value={form.service} onChange={e => setForm({...form, service: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-400 text-sm" placeholder="Ví dụ: Cắt mí, Làm mũi..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-400 text-sm resize-none" placeholder="Ghi chú thêm..." />
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50 mt-4">
                {saving ? 'Đang lưu...' : 'Lưu lịch hẹn'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagementPage;
