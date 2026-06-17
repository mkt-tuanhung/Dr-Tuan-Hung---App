import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Plus, X, Calendar as CalendarIcon, Phone, User, Activity, Edit, Trash2, CalendarDays, Stethoscope, Wallet, Ban, Link as LinkIcon, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const AppointmentManagementPage = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [appointments, setAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  
  // Forms
  const [saving, setSaving] = useState(false);
  const [viewNoteApp, setViewNoteApp] = useState(null);
  const [createForm, setCreateForm] = useState({
    appointment_type: 'new',
    appointment_date: today.toISOString().split('T')[0], appointment_time: '09:00',
    customer_name: '', phone: '', service: '', test_status: 'Chưa xét nghiệm', 
    expected_bill: '', deposit_amount: '', telesale_id: '', sale_id: '', social_link: '', notes: '',
    service_group: 'Hàm mặt', customer_source: 'Ads', customer_type: 'Mới'
  });

  const [evalApp, setEvalApp] = useState(null);
  const [evalForm, setEvalForm] = useState({
    status: 'phau_thuat',
    expected_surgery_date: today.toISOString().split('T')[0], revenue: '', upsale_revenue: '', service: '',
    deposit_date: today.toISOString().split('T')[0], deposit_amount: '', notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Fetch all appointments
    const { data: appData, error: appErr } = await supabase
      .from('customer_appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true });

    if (appErr) {
      toast.error('Lỗi tải dữ liệu lịch hẹn: ' + appErr.message);
    }

    // Fetch staff for joining names
    const { data: staffData, error: staffErr } = await supabase
      .from('profiles')
      .select('id, full_name, role');
      
    if (staffErr) {
      toast.error('Lỗi tải dữ liệu nhân viên: ' + staffErr.message);
    }

    if (appData && staffData) {
      setStaffList(staffData);
      
      const staffMap = {};
      staffData.forEach(s => staffMap[s.id] = s);
      
      const mappedApps = appData.map(app => ({
        ...app,
        telesale: staffMap[app.telesale_id]?.full_name || 'Không có',
        sale: staffMap[app.sale_id]?.full_name || 'Không có',
      }));
      
      setAppointments(mappedApps);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived state
  const { groupedByDate, recheckAppointments, stats, chartData, pieData } = useMemo(() => {
    const groups = {};
    const rechecks = [];
    const st = { total: 0, pt: 0, coc: 0, bong: 0, expected_bill: 0, total_deposit: 0 };
    const dates = [];

    appointments.forEach(app => {
      if (app.service && app.service.startsWith('[Tái khám]')) {
        rechecks.push(app);
        return;
      }
      st.total++;
      if (app.status === 'phau_thuat') st.pt++;
      if (app.status === 'coc') st.coc++;
      if (app.status === 'bong') st.bong++;
      st.expected_bill += Number(app.expected_bill || 0);
      st.total_deposit += Number(app.deposit_amount || 0);

      const dateStr = app.appointment_date;
      if (!groups[dateStr]) {
        groups[dateStr] = [];
        dates.push(dateStr);
      }
      groups[dateStr].push(app);
    });

    const cd = dates.slice(0, 7).reverse().map(dateStr => {
      const dayApps = groups[dateStr];
      const d = new Date(dateStr);
      return {
        name: `${d.getDate()}/${d.getMonth()+1}`,
        'Tổng lịch': dayApps.length,
        'Phẫu thuật': dayApps.filter(a => a.status === 'phau_thuat').length
      };
    });

    const pd = [
      { name: 'Chờ tư vấn', value: st.total - st.pt - st.coc - st.bong, color: '#f59e0b' },
      { name: 'Cọc', value: st.coc, color: '#3b82f6' },
      { name: 'Phẫu thuật', value: st.pt, color: '#10b981' },
      { name: 'Bong', value: st.bong, color: '#ef4444' }
    ].filter(i => i.value > 0);

    return { groupedByDate: groups, recheckAppointments: rechecks, stats: st, chartData: cd, pieData: pd };
  }, [appointments]);

  // Actions
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.customer_name || !createForm.appointment_date) {
      toast.error('Vui lòng nhập Tên và Ngày hẹn'); return;
    }
    setSaving(true);
    try {
      const isRecheck = createForm.appointment_type === 'recheck';
      const { error } = await supabase.from('customer_appointments').insert({
        customer_name: createForm.customer_name,
        phone: createForm.phone,
        appointment_date: createForm.appointment_date,
        appointment_time: createForm.appointment_time,
        service: isRecheck ? `[Tái khám] ${createForm.service}` : createForm.service,
        test_status: isRecheck ? 'Không cần' : createForm.test_status,
        expected_bill: isRecheck ? 0 : (createForm.expected_bill || 0),
        deposit_amount: isRecheck ? 0 : (createForm.deposit_amount || 0),
        telesale_id: isRecheck ? null : (createForm.telesale_id || null),
        sale_id: createForm.sale_id || null,
        social_link: createForm.social_link,
        notes: createForm.notes,
        service_group: createForm.service_group,
        customer_source: isRecheck ? 'CSKH' : createForm.customer_source,
        customer_type: isRecheck ? 'Cũ' : createForm.customer_type,
        status: 'scheduled',
        created_by: profile.id
      });
      if (error) throw error;
      toast.success('Đã thêm lịch hẹn!');
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEval = (app) => {
    setEvalApp(app);
    setEvalForm({
      status: app.status === 'scheduled' ? 'phau_thuat' : app.status,
      expected_surgery_date: app.expected_surgery_date || app.surgery_date || today.toISOString().split('T')[0],
      revenue: app.revenue || '',
      upsale_revenue: app.upsale_revenue || '',
      service: app.service || '',
      deposit_date: app.deposit_date || today.toISOString().split('T')[0],
      deposit_amount: app.deposit_amount || '',
      notes: app.notes || ''
    });
    setShowEvalModal(true);
  };

  const handleEvalSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let updateData = { status: evalForm.status };
      if (evalForm.status === 'phau_thuat') {
        updateData = { ...updateData, surgery_date: evalForm.expected_surgery_date, expected_surgery_date: evalForm.expected_surgery_date, revenue: evalForm.revenue || 0, upsale_revenue: evalForm.upsale_revenue || 0, service: evalForm.service };
      } else if (evalForm.status === 'coc') {
        updateData = { ...updateData, deposit_date: evalForm.deposit_date, deposit_amount: evalForm.deposit_amount || 0, service: evalForm.service, expected_surgery_date: evalForm.expected_surgery_date };
      } else if (evalForm.status === 'bong') {
        updateData = { ...updateData, notes: evalForm.notes };
      }
      
      const { error } = await supabase.from('customer_appointments').update(updateData).eq('id', evalApp.id);
      if (error) throw error;
      
      toast.success('Đã lưu đánh giá!');
      setShowEvalModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteApp = async (id) => {
    if(!window.confirm('Bạn có chắc muốn xóa lịch hẹn này?')) return;
    const { error } = await supabase.from('customer_appointments').delete().eq('id', id);
    if(error) toast.error('Lỗi xóa: ' + error.message);
    else { toast.success('Đã xóa'); loadData(); }
  };

  const StatusBadge = ({ status }) => {
    switch(status) {
      case 'phau_thuat': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-semibold rounded-full text-xs">Phẫu thuật</span>;
      case 'coc': return <span className="px-3 py-1 bg-blue-100 text-blue-700 font-semibold rounded-full text-xs">Đã cọc</span>;
      case 'bong': return <span className="px-3 py-1 bg-red-100 text-red-700 font-semibold rounded-full text-xs">Khách bong</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-600 font-semibold rounded-full text-xs">Chờ tư vấn</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-teal-800">Lịch Hẹn</h2>
          <p className="text-teal-600 text-sm mt-1">Quản lý và đánh giá khách hàng theo lịch hẹn</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Thêm lịch hẹn mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <CalendarDays className="w-6 h-6 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
              <div className="text-xs text-slate-500 font-medium uppercase mt-1">Tổng lịch hẹn</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <Stethoscope className="w-6 h-6 text-emerald-500 mb-2" />
              <div className="text-2xl font-bold text-slate-800">{stats.pt}</div>
              <div className="text-xs text-slate-500 font-medium uppercase mt-1">Phẫu thuật</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <Wallet className="w-6 h-6 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-slate-800">{stats.coc}</div>
              <div className="text-xs text-slate-500 font-medium uppercase mt-1">Đã cọc</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <Ban className="w-6 h-6 text-red-500 mb-2" />
              <div className="text-2xl font-bold text-slate-800">{stats.bong}</div>
              <div className="text-xs text-slate-500 font-medium uppercase mt-1">Khách bong</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <Activity className="w-6 h-6 text-orange-500 mb-2" />
              <div className="text-xl font-bold text-slate-800">{stats.expected_bill.toLocaleString('vi-VN')}đ</div>
              <div className="text-xs text-slate-500 font-medium uppercase mt-1">Tổng bill dự kiến</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <Activity className="w-6 h-6 text-emerald-500 mb-2" />
              <div className="text-xl font-bold text-slate-800">{stats.total_deposit.toLocaleString('vi-VN')}đ</div>
              <div className="text-xs text-slate-500 font-medium uppercase mt-1">Tổng đã cọc</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-700 font-bold mb-4">Tỷ lệ trạng thái</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-slate-700 font-bold mb-4">Biểu đồ lịch hẹn theo ngày</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Tổng lịch" stroke="#3b82f6" strokeWidth={3} />
                    <Line type="monotone" dataKey="Phẫu thuật" stroke="#10b981" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Lịch Tái Khám */}
          {recheckAppointments.length > 0 && (
            <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden mt-6 mb-8">
              <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
                <Stethoscope className="w-6 h-6 text-orange-600" />
                <h3 className="font-bold text-orange-800 text-lg">Danh sách Lịch Tái Khám</h3>
                <span className="bg-orange-200 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">{recheckAppointments.length} lịch</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-orange-50/50 text-slate-700">
                    <tr>
                      <th className="px-6 py-3">Ngày & Giờ</th>
                      <th className="px-6 py-3">Khách hàng</th>
                      <th className="px-6 py-3">Dịch vụ tái khám</th>
                      <th className="px-6 py-3">Phụ trách</th>
                      <th className="px-6 py-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recheckAppointments.sort((a,b) => new Date(b.appointment_date) - new Date(a.appointment_date)).map(app => (
                      <tr key={app.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-orange-700">
                          {new Date(app.appointment_date).toLocaleDateString('vi-VN')} <br/>
                          <span className="text-xs text-slate-500">{app.appointment_time?.substring(0,5)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{app.customer_name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/> {app.phone}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{app.service?.replace('[Tái khám] ', '')}</td>
                        <td className="px-6 py-4 text-slate-600">{app.sale || 'Không có'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => setViewNoteApp(app)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Xem lịch sử chăm sóc">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteApp(app.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" title="Xóa lịch hẹn">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Groups by Date */}
          <div className="space-y-6">
            {Object.keys(groupedByDate).sort((a,b) => new Date(b) - new Date(a)).map(dateStr => (
              <div key={dateStr} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                  <div className="flex items-center gap-2 text-teal-700 font-bold">
                    <CalendarIcon className="w-5 h-5" />
                    {new Date(dateStr).toLocaleDateString('vi-VN')}
                  </div>
                  <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">{groupedByDate[dateStr].length} lịch</span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groupedByDate[dateStr].map(app => (
                    <div key={app.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-teal-600" />
                          <span className="font-bold text-slate-800 text-base">{app.customer_name}</span>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                      
                      <div className="p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span>{app.appointment_time?.substring(0,5) || '--:--'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-teal-700">{app.service || 'Chưa chọn dịch vụ'}</span>
                        </div>

                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Telesale:</span>
                            <span className="font-semibold text-blue-700">{app.telesale}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Sale Offline:</span>
                            <span className="font-semibold text-purple-700">{app.sale}</span>
                          </div>
                          <div className="border-t border-emerald-100/60 my-1 pt-1" />
                          <div className="flex justify-between">
                            <span className="text-slate-500">Dự kiến:</span>
                            <span className="font-bold text-emerald-700">{Number(app.expected_bill||0).toLocaleString('vi-VN')}đ</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Đã cọc:</span>
                            <span className="font-bold text-emerald-700">{Number(app.deposit_amount||0).toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>
                        
                        {app.social_link && (
                          <a href={app.social_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline">
                            <LinkIcon className="w-3 h-3" /> Xem link tham khảo
                          </a>
                        )}
                      </div>

                      <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center gap-2">
                        {['admin', 'sale_offline'].includes(profile?.role) && (
                          <button onClick={() => openEval(app)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-sm py-2 rounded-xl hover:bg-emerald-100 transition-colors">
                            <Edit className="w-4 h-4" /> Đánh giá
                          </button>
                        )}
                        <button className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteApp(app.id)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Thêm Lịch Hẹn Mới */}
      {showCreateModal && (
         <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-start pt-10 pb-10 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xl">Thêm lịch hẹn mới</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex gap-2">
              <button type="button" onClick={() => setCreateForm({...createForm, appointment_type: 'new'})} className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${createForm.appointment_type === 'new' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>Lịch hẹn mới</button>
              <button type="button" onClick={() => setCreateForm({...createForm, appointment_type: 'recheck'})} className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${createForm.appointment_type === 'recheck' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>Lịch tái khám</button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-8">
              {/* Thông tin Khách hàng */}
              <section>
                <h4 className="text-sm font-bold text-teal-700 uppercase mb-4 tracking-wider border-b pb-2">Thông tin khách hàng</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ngày hẹn <span className="text-red-500">*</span></label>
                    <input required type="date" value={createForm.appointment_date} onChange={e => setCreateForm({...createForm, appointment_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Giờ hẹn <span className="text-red-500">*</span></label>
                    <input required type="time" value={createForm.appointment_time} onChange={e => setCreateForm({...createForm, appointment_time: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                    <input required value={createForm.customer_name} onChange={e => setCreateForm({...createForm, customer_name: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="Nhập tên..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                    <input required value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="Nhập SĐT..." />
                  </div>
                  {createForm.appointment_type === 'new' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nguồn khách <span className="text-red-500">*</span></label>
                        <select value={createForm.customer_source} onChange={e => setCreateForm({...createForm, customer_source: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                          <option value="Ads">Ads</option>
                          <option value="Người quen">Người quen</option>
                          <option value="CTV">CTV</option>
                          <option value="CSKH">CSKH</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tệp khách hàng <span className="text-red-500">*</span></label>
                        <select value={createForm.customer_type} onChange={e => setCreateForm({...createForm, customer_type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                          <option value="Mới">Khách Mới</option>
                          <option value="Cũ">Khách Cũ</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Chi tiết dịch vụ */}
              <section>
                <h4 className="text-sm font-bold text-teal-700 uppercase mb-4 tracking-wider border-b pb-2">{createForm.appointment_type === 'new' ? 'Chi tiết dịch vụ' : 'Dịch vụ tái khám'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{createForm.appointment_type === 'new' ? 'Dịch vụ' : 'Lý do tái khám / Dịch vụ cũ'} <span className="text-red-500">*</span></label>
                    <input required value={createForm.service} onChange={e => setCreateForm({...createForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder={createForm.appointment_type === 'new' ? "Chọn dịch vụ" : "VD: Tái khám cắt chỉ mũi"} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm dịch vụ <span className="text-red-500">*</span></label>
                    <select value={createForm.service_group} onChange={e => setCreateForm({...createForm, service_group: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                      <option value="Hàm mặt">Hàm mặt</option>
                      <option value="Body">Body</option>
                      <option value="Tiểu phẫu">Tiểu phẫu</option>
                    </select>
                  </div>
                  {createForm.appointment_type === 'new' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tình trạng xét nghiệm</label>
                        <select value={createForm.test_status} onChange={e => setCreateForm({...createForm, test_status: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                          <option>Chưa xét nghiệm</option>
                          <option>Đã xét nghiệm</option>
                          <option>Không cần</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Bill dự kiến (VNĐ)</label>
                        <input type="number" value={createForm.expected_bill} onChange={e => setCreateForm({...createForm, expected_bill: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Đã cọc (VNĐ)</label>
                        <input type="number" value={createForm.deposit_amount} onChange={e => setCreateForm({...createForm, deposit_amount: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="0" />
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Phụ trách & Ghi chú */}
              <section>
                <h4 className="text-sm font-bold text-teal-700 uppercase mb-4 tracking-wider border-b pb-2">Phụ trách & Ghi chú</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {createForm.appointment_type === 'new' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telesale phụ trách</label>
                      <select value={createForm.telesale_id} onChange={e => setCreateForm({...createForm, telesale_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                        <option value="">-- Không có --</option>
                        {staffList.filter(s => s.role === 'telesale' || s.role === 'admin').map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{createForm.appointment_type === 'new' ? 'Sale Offline phụ trách' : 'Người phụ trách (Sale/Điều dưỡng)'}</label>
                    <select value={createForm.sale_id} onChange={e => setCreateForm({...createForm, sale_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none bg-white">
                      <option value="">-- Không có --</option>
                      {staffList.filter(s => s.role === 'sale_offline' || s.role === 'admin' || s.role === 'dieu_duong').map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Thông tin tham khảo (Link FB, Zalo...)</label>
                  <input type="text" value={createForm.social_link} onChange={e => setCreateForm({...createForm, social_link: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="Link profile khách hàng..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Note tình trạng khách hàng</label>
                  <textarea rows={3} value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none resize-none" placeholder="Ghi chú chi tiết về tình trạng, mong muốn..." />
                </div>
              </section>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors">
                  {saving ? 'Đang lưu...' : 'Lưu Lịch Hẹn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đánh Giá */}
      {showEvalModal && evalApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white">
              <h3 className="font-bold text-slate-800 text-lg">Đánh giá lịch hẹn: {evalApp.customer_name}</h3>
              <button onClick={() => setShowEvalModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEvalSubmit} className="p-6 space-y-6 bg-slate-50">
              {/* Tabs */}
              <div className="flex rounded-full bg-white border border-slate-200 p-1">
                <button type="button" onClick={() => setEvalForm({...evalForm, status: 'bong'})}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${evalForm.status === 'bong' ? 'bg-orange-400 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Bong
                </button>
                <button type="button" onClick={() => setEvalForm({...evalForm, status: 'coc'})}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${evalForm.status === 'coc' ? 'bg-teal-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Cọc
                </button>
                <button type="button" onClick={() => setEvalForm({...evalForm, status: 'phau_thuat'})}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${evalForm.status === 'phau_thuat' ? 'bg-orange-300 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                  Phẫu thuật
                </button>
              </div>

              {/* Form Nội dung */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                {evalForm.status === 'phau_thuat' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Ngày phẫu thuật <span className="text-red-500">*</span></label>
                        <input type="date" required value={evalForm.expected_surgery_date} onChange={e => setEvalForm({...evalForm, expected_surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Doanh thu (VNĐ) <span className="text-red-500">*</span></label>
                        <input type="number" required value={evalForm.revenue} onChange={e => setEvalForm({...evalForm, revenue: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-teal-600 font-semibold" placeholder="VD: 50,000,000" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Doanh thu Upsale (VNĐ)</label>
                      <input type="number" value={evalForm.upsale_revenue} onChange={e => setEvalForm({...evalForm, upsale_revenue: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-teal-600 font-semibold" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Dịch vụ thực tế làm</label>
                      <input type="text" value={evalForm.service} onChange={e => setEvalForm({...evalForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="VD: Nâng mũi" />
                    </div>
                  </>
                )}

                {evalForm.status === 'coc' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Ngày cọc <span className="text-red-500">*</span></label>
                        <input type="date" required value={evalForm.deposit_date} onChange={e => setEvalForm({...evalForm, deposit_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tiền cọc (VNĐ) <span className="text-red-500">*</span></label>
                        <input type="number" required value={evalForm.deposit_amount} onChange={e => setEvalForm({...evalForm, deposit_amount: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none text-teal-600 font-semibold" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Ngày PT dự kiến</label>
                      <input type="date" value={evalForm.expected_surgery_date} onChange={e => setEvalForm({...evalForm, expected_surgery_date: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Dịch vụ sử dụng</label>
                      <input type="text" value={evalForm.service} onChange={e => setEvalForm({...evalForm, service: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" />
                    </div>
                  </>
                )}

                {evalForm.status === 'bong' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chú / Lý do khách bong</label>
                    <textarea rows={4} value={evalForm.notes} onChange={e => setEvalForm({...evalForm, notes: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-orange-400 outline-none resize-none" placeholder="Khách báo kẹt tiền, khách đổi ý..." />
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-3.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20">
                {saving ? 'Đang lưu...' : `Xác nhận khách ${evalForm.status === 'bong' ? 'Bong' : evalForm.status === 'coc' ? 'Cọc' : 'Phẫu thuật'}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Note (Lịch sử chăm sóc) */}
      {viewNoteApp && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-white shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">Lịch sử chăm sóc: {viewNoteApp.customer_name}</h3>
              <button onClick={() => setViewNoteApp(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 flex-1">
              {viewNoteApp.notes ? (
                viewNoteApp.notes.split(/\[Ảnh đính kèm:\s*(https?:\/\/[^\s\]]+)\]/g).map((part, i) => {
                  if (part.startsWith('http')) {
                    return <a key={i} href={part} target="_blank" rel="noreferrer" className="block mt-2 mb-3"><img src={part} alt="attachment" className="max-h-40 rounded-xl border border-slate-200 shadow-sm" /></a>
                  }
                  return <span key={i}>{part}</span>
                })
              ) : (
                <div className="text-slate-400 italic text-center py-4">Chưa có lịch sử chăm sóc.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagementPage;
