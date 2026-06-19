import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { CalendarCheck, ChevronLeft, ChevronRight, Search, Check, X, Clock, Users } from 'lucide-react';
import LeaveManagementPage from './LeaveManagementPage.jsx';

const STATUS_CONFIG = {
  present:  { label: 'Có mặt',    color: 'bg-emerald-100 text-emerald-700' },
  late:     { label: 'Đi trễ',    color: 'bg-yellow-100 text-yellow-700' },
  absent:   { label: 'Vắng mặt', color: 'bg-red-100 text-red-700' },
  half_day: { label: 'Nửa ngày', color: 'bg-blue-100 text-blue-700' },
  leave:    { label: 'Nghỉ phép', color: 'bg-purple-100 text-purple-700' },
};

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const fmtTime = (t) => t ? t.slice(0, 5) : '—';
const fmtDate = (d) => {
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
};

const AttendanceManagementPage = ({ isNested = false, defaultTab = 'attendance' }) => {
  const today = new Date();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const [staffRes, attRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, employee_id, role, avatar_url').eq('is_active', true).order('full_name'),
      supabase.from('attendance').select('*').gte('date', startDate).lte('date', endDate),
    ]);

    setStaff(staffRes.data || []);
    setAttendance(attRes.data || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getRecord = (staffId, day) => {
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return attendance.find(a => a.staff_id === staffId && a.date === date);
  };

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: staff.length,
    present: attendance.filter(a => {
      const d = new Date(a.date);
      return a.status === 'present' && d.getMonth()+1 === month && d.getFullYear() === year &&
        a.date === today.toISOString().split('T')[0];
    }).length,
  };

  const openEdit = (staffId, day) => {
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const record = getRecord(staffId, day);
    const s = staff.find(x => x.id === staffId);
    setEditModal({
      staffId, date, staffName: s?.full_name,
      status: record?.status || 'present',
      check_in: record?.check_in || '',
      check_out: record?.check_out || '',
      note: record?.note || '',
      id: record?.id || null,
      latitude: record?.latitude,
      longitude: record?.longitude,
      ip_address: record?.ip_address,
      location_status: record?.location_status,
    });
  };

  const handleCellClick = (staffId, day) => {
    if (isMultiSelect) {
      const key = `${staffId}_${day}`;
      const next = new Set(selectedCells);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelectedCells(next);
    } else {
      openEdit(staffId, day);
    }
  };

  const handleBulkAction = async (status) => {
    setSaving(true);
    try {
      const updates = [];
      const inserts = [];
      
      Array.from(selectedCells).forEach(key => {
        const parts = key.split('_');
        const dayStr = parts.pop();
        const staffId = parts.join('_');
        const day = parseInt(dayStr, 10);
        const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const record = getRecord(staffId, day);
        
        if (record) {
          updates.push({ ...record, status, updated_at: new Date().toISOString() });
        } else {
          inserts.push({
            staff_id: staffId,
            date,
            status,
            check_in: status === 'present' ? '08:50:00' : null,
            updated_at: new Date().toISOString()
          });
        }
      });
      
      if (updates.length > 0) {
        const { error } = await supabase.from('attendance').upsert(updates);
        if (error) throw error;
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('attendance').insert(inserts);
        if (error) throw error;
      }
      
      toast.success(`Đã cập nhật ${selectedCells.size} ô chấm công`);
      setSelectedCells(new Set());
      setIsMultiSelect(false);
      loadData();
    } catch(err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        staff_id: editModal.staffId,
        date: editModal.date,
        status: editModal.status,
        check_in: editModal.check_in || null,
        check_out: editModal.check_out || null,
        note: editModal.note || null,
        updated_at: new Date().toISOString(),
      };
      if (editModal.id) {
        const { error } = await supabase.from('attendance').update(data).eq('id', editModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance').insert(data);
        if (error) throw error;
      }
      toast.success('Đã lưu chấm công');
      setEditModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      {!isNested && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Chấm công & Nghỉ phép</h2>
              {activeTab === 'attendance' && <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month-1]} {year}</p>}
            </div>
            {activeTab === 'attendance' && (
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
                <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'attendance' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Bảng chấm công
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'leave' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Duyệt đơn xin phép
            </button>
          </div>
        </div>
      )}

      {/* When Nested, we still need the month selector for attendance tab */}
      {isNested && activeTab === 'attendance' && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-600 font-medium">Bảng theo dõi chấm công hàng ngày</p>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'attendance' ? (
        <>
          {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-0.5">Tổng nhân sự</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.present}</div>
          <div className="text-xs text-slate-400 mt-0.5">Có mặt hôm nay</div>
        </div>
      </div>

      {/* Search & Bulk Toggle */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-emerald-100 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            placeholder="Tìm nhân sự..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setIsMultiSelect(!isMultiSelect);
            if (isMultiSelect) setSelectedCells(new Set());
          }}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-bold transition-all border ${isMultiSelect ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          {isMultiSelect ? 'Hủy chọn nhiều' : 'Tích chọn nhiều ô'}
        </button>
      </div>

      {/* Desktop table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="hidden lg:block bg-white border border-emerald-100 rounded-2xl overflow-auto shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-emerald-50/50 text-slate-500 border-b border-emerald-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium sticky left-0 bg-emerald-50/50 min-w-[160px]">Nhân sự</th>
                  {days.map(d => {
                    const date = new Date(year, month-1, d);
                    const isToday = date.toDateString() === today.toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={d} className={`px-2 py-3 font-medium text-center min-w-[36px] ${isToday ? 'text-emerald-600' : ''} ${isWeekend ? 'text-slate-300' : ''}`}>
                        <div>{d}</div>
                        <div className="text-[9px] font-normal">{DAYS[date.getDay()]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-500">{s.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-700 text-xs">{s.full_name}</div>
                          <div className="text-[10px] text-slate-400">{s.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const record = getRecord(s.id, d);
                      const date = new Date(year, month-1, d);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = date.toDateString() === today.toDateString();
                      const cellKey = `${s.id}_${d}`;
                      const isSelected = selectedCells.has(cellKey);
                      return (
                        <td key={d} className={`px-1 py-2 text-center relative ${isWeekend ? 'bg-slate-50/50' : ''} ${isToday ? 'bg-emerald-50/40' : ''} ${isSelected ? 'ring-2 ring-inset ring-emerald-500 bg-emerald-100/50' : ''}`}>
                          <button
                            onClick={() => handleCellClick(s.id, d)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all hover:scale-110 relative"
                            title={record ? STATUS_CONFIG[record.status]?.label : 'Chưa chấm'}
                          >
                            {record ? (
                              <>
                                {record.status === 'present' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> :
                                record.status === 'absent' ? <X className="w-3.5 h-3.5 text-red-400" /> :
                                record.status === 'late' ? <Clock className="w-3.5 h-3.5 text-yellow-500" /> :
                                <span className="text-[9px] font-bold text-purple-500">{record.status === 'leave' ? 'NP' : 'ND'}</span>}
                                {record.location_status === 'outside' && (
                                  <span className="absolute top-0 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" title="Chấm công ngoài văn phòng"></span>
                                )}
                              </>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block mx-auto" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden space-y-3">
            {filtered.map(s => {
              const todayStr = today.toISOString().split('T')[0];
              const todayRecord = attendance.find(a => a.staff_id === s.id && a.date === todayStr);
              const monthCount = attendance.filter(a => a.staff_id === s.id && a.status === 'present').length;
              return (
                <div key={s.id} className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-emerald-500">{s.full_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{s.full_name}</div>
                        <div className="text-xs text-slate-400">{s.employee_id}</div>
                      </div>
                    </div>
                    {todayRecord ? (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_CONFIG[todayRecord.status]?.color}`}>
                        {STATUS_CONFIG[todayRecord.status]?.label}
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-400">Chưa chấm</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Có mặt tháng này: <span className="font-semibold text-slate-700">{monthCount} ngày</span></span>
                    <button
                      onClick={() => openEdit(s.id, today.getDate())}
                      className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                    >
                      Chấm hôm nay →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Floating Action Bar for Multi-Select */}
      {isMultiSelect && selectedCells.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-wrap items-center gap-6 z-[60] animate-in slide-in-from-bottom-8">
          <div className="font-semibold text-sm">Đã chọn {selectedCells.size} ô</div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
            <button disabled={saving} onClick={() => handleBulkAction('present')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-bold transition-colors">Có mặt</button>
            <button disabled={saving} onClick={() => handleBulkAction('half_day')} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-sm font-bold transition-colors">Nửa ngày</button>
            <button disabled={saving} onClick={() => handleBulkAction('late')} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white rounded-xl text-sm font-bold transition-colors">Đi trễ</button>
            <button disabled={saving} onClick={() => handleBulkAction('absent')} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl text-sm font-bold transition-colors">Vắng mặt</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full font-medium ${v.color}`}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-bold text-slate-800 text-lg mb-1">Chấm công</h3>
            <p className="text-sm text-slate-400 mb-5">{editModal.staffName} · {fmtDate(editModal.date)}</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Trạng thái</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setEditModal(m => ({ ...m, status: k }))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                        editModal.status === k
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-slate-100 text-slate-500 hover:border-emerald-200'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Giờ vào</label>
                  <input
                    type="time"
                    value={editModal.check_in}
                    onChange={e => setEditModal(m => ({ ...m, check_in: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Giờ ra</label>
                  <input
                    type="time"
                    value={editModal.check_out}
                    onChange={e => setEditModal(m => ({ ...m, check_out: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ghi chú</label>
                <textarea
                  value={editModal.note}
                  onChange={e => setEditModal(m => ({ ...m, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 resize-none"
                  placeholder="Ghi chú thêm..."
                />
              </div>

              {editModal.id && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">Vị trí GPS:</span>
                    {editModal.location_status === 'in_office' ? (
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Hợp lệ</span>
                    ) : editModal.location_status === 'outside' ? (
                      <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-200">Ngoài VP</span>
                    ) : (
                      <span className="text-slate-400">Không có dữ liệu</span>
                    )}
                  </div>
                  {editModal.latitude && editModal.longitude && (
                    <div className="flex justify-end mt-1">
                      <a href={`https://maps.google.com/?q=${editModal.latitude},${editModal.longitude}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                        Xem bản đồ
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold">IP Wi-Fi:</span>
                    <span className="font-mono font-medium text-slate-700">{editModal.ip_address || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      ) : (
        <LeaveManagementPage />
      )}
    </div>
  );
};

export default AttendanceManagementPage;
