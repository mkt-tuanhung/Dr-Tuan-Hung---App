import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Check, X, Clock, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const LEAVE_TYPES = {
  late:     { label: 'Đi muộn',       color: 'bg-yellow-100 text-yellow-700' },
  early:    { label: 'Về sớm',         color: 'bg-orange-100 text-orange-700' },
  leave:    { label: 'Nghỉ phép',      color: 'bg-purple-100 text-purple-700' },
  half_day: { label: 'Nghỉ nửa ngày', color: 'bg-blue-100 text-blue-700' },
};

const HALF_DAY = { morning: 'Buổi sáng', afternoon: 'Buổi chiều' };

const LEAVE_STATUS = {
  pending:  { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Đã duyệt',  color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Từ chối',   color: 'bg-red-100 text-red-700' },
};

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const LeaveManagementPage = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');
  const [saving, setSaving] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, profiles(full_name, employee_id, avatar_url, role)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('created_at', { ascending: false });

    if (!error) setRequests(data || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id) => {
    setSaving(id);
    const req = requests.find(r => r.id === id);
    if (!req) { setSaving(null); return; }

    const { error } = await supabase.from('leave_requests').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) { toast.error(error.message); setSaving(null); return; }

    let attStatus = 'present';
    if (req.type === 'leave') attStatus = 'leave';
    else if (req.type === 'half_day') attStatus = 'half_day';
    else if (req.type === 'late') attStatus = 'late';
    else if (req.type === 'early') attStatus = 'early_leave'; // using 'early_leave' based on schema

    const { data: existingAtt } = await supabase.from('attendance')
      .select('id').eq('staff_id', req.staff_id).eq('date', req.date).maybeSingle();

    if (existingAtt) {
      await supabase.from('attendance').update({
        status: attStatus,
        leave_type: req.type === 'half_day' ? req.half_day_period : null,
        note: `Đã duyệt đơn: ${req.reason}`
      }).eq('id', existingAtt.id);
    } else {
      await supabase.from('attendance').insert({
        staff_id: req.staff_id,
        date: req.date,
        status: attStatus,
        leave_type: req.type === 'half_day' ? req.half_day_period : null,
        note: `Đã duyệt đơn: ${req.reason}`
      });
    }

    toast.success('Đã duyệt đơn và cập nhật chấm công');
    loadData();
    setSaving(null);
  };

  const handleReject = async (id) => {
    setSaving(id);
    const { error } = await supabase.from('leave_requests').update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); }
    else { toast.success('Đã từ chối đơn'); loadData(); }
    setSaving(null);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const filtered = requests.filter(r => {
    const matchSearch = r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.profiles?.employee_id?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || r.status === filter;
    return matchSearch && matchFilter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mt-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Danh sách đơn</h3>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month-1]} {year}</p>
        </div>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending', label: 'Chờ duyệt', color: 'text-yellow-500' },
          { key: 'approved', label: 'Đã duyệt', color: 'text-emerald-600' },
          { key: 'rejected', label: 'Từ chối', color: 'text-red-400' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`bg-white rounded-2xl p-4 border shadow-sm text-center transition-all ${filter === s.key ? 'border-emerald-300 shadow-md' : 'border-slate-100'}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{requests.filter(r => r.status === s.key).length}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-emerald-100 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
            placeholder="Tìm nhân sự..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
          {[{key:'all',label:'Tất cả'},{key:'pending',label:'Chờ duyệt'},{key:'approved',label:'Đã duyệt'},{key:'rejected',label:'Từ chối'}].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === f.key ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              {f.label}
              {f.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1 bg-red-400 text-white text-[10px] rounded-full px-1">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 text-sm shadow-sm">
          Không có đơn xin phép nào
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      {r.profiles?.avatar_url ? (
                        <img src={r.profiles.avatar_url} alt={r.profiles.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-emerald-500">{r.profiles?.full_name?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{r.profiles?.full_name}</div>
                      <div className="text-xs text-slate-400">{r.profiles?.employee_id}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${LEAVE_STATUS[r.status]?.color}`}>
                    {LEAVE_STATUS[r.status]?.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="text-[10px] text-slate-400">Loại đơn</div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">
                      {LEAVE_TYPES[r.type]?.label}
                      {r.type === 'half_day' && r.half_day_period && ` · ${HALF_DAY[r.half_day_period]}`}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="text-[10px] text-slate-400">Ngày</div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">
                      {new Date(r.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                </div>

                <div className="mt-2 bg-slate-50 rounded-xl px-3 py-2">
                  <div className="text-[10px] text-slate-400">Lý do</div>
                  <div className="text-xs text-slate-700 mt-0.5">{r.reason}</div>
                </div>

                <div className="text-[10px] text-slate-300 mt-2">
                  Gửi lúc {new Date(r.created_at).toLocaleString('vi-VN')}
                </div>
              </div>

              {r.status === 'pending' && (
                <div className="flex border-t border-slate-50">
                  <button onClick={() => handleReject(r.id)} disabled={saving === r.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-red-400 hover:bg-red-50 transition-colors border-r border-slate-50 disabled:opacity-50">
                    <X className="w-4 h-4" /> Từ chối
                  </button>
                  <button onClick={() => handleApprove(r.id)} disabled={saving === r.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                    <Check className="w-4 h-4" /> Duyệt
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaveManagementPage;
