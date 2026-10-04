import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Check, X, Clock, ChevronLeft, ChevronRight, Search, FileText, CalendarDays } from 'lucide-react';

const LEAVE_TYPES = {
  late:     { label: 'Đi muộn',       color: 'e-tone-warning' },
  early:    { label: 'Về sớm',         color: 'e-tone-peach' },
  leave:    { label: 'Nghỉ phép',      color: 'e-tone-lavender' },
  half_day: { label: 'Nghỉ nửa ngày', color: 'e-tone-info' },
};

const HALF_DAY = { morning: 'Buổi sáng', afternoon: 'Buổi chiều' };

const LEAVE_STATUS = {
  pending:  { label: 'Chờ duyệt', color: 'e-tone-warning' },
  approved: { label: 'Đã duyệt',  color: 'e-tone-success' },
  rejected: { label: 'Từ chối',   color: 'e-tone-danger' },
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
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    try {
      const [monthRes, pendingRes] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('leave_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      if (monthRes.error) throw monthRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const combined = [...(monthRes.data || []), ...(pendingRes.data || [])];
      
      const uniqueMap = new Map();
      combined.forEach(r => uniqueMap.set(r.id, r));
      const uniqueData = Array.from(uniqueMap.values());

      // Fetch profiles manually to avoid multiple relationship errors
      const staffIds = [...new Set(uniqueData.map(r => r.staff_id).filter(Boolean))];
      let profilesMap = {};
      
      if (staffIds.length > 0) {
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, employee_id, avatar_url, role')
          .in('id', staffIds);
          
        if (!profErr && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      const finalData = uniqueData.map(r => ({
        ...r,
        profiles: profilesMap[r.staff_id] || {}
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setRequests(finalData);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  // Tự tải lại khi có thay đổi (vd duyệt/từ chối qua Telegram)
  useEffect(() => {
    const ch = supabase.channel('leave_mgmt_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

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
    const searchTerm = search.toLowerCase();
    const matchSearch = !searchTerm || 
      (r.profiles?.full_name || '').toLowerCase().includes(searchTerm) ||
      (r.profiles?.employee_id || '').toLowerCase().includes(searchTerm);
    const matchFilter = filter === 'all' || r.status === filter;
    return matchSearch && matchFilter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Thanh lọc: tháng · tìm kiếm · trạng thái (điện thoại: xếp dọc, chip lọc cuộn ngang) */}
      <div className="e-toolbar max-lg:bg-transparent max-lg:border-0 max-lg:shadow-none max-lg:p-0 max-lg:gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-white max-lg:w-full max-lg:justify-between max-lg:h-12 max-lg:rounded-2xl max-lg:shadow-soft">
          <button onClick={prevMonth} className="w-8 h-8 max-lg:w-10 max-lg:h-10 rounded-lg grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng trước">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="inline-flex items-center gap-1.5 text-[13.5px] max-lg:text-[14.5px] font-semibold text-slate-800 min-w-[120px] justify-center tabular-nums"><CalendarDays className="w-4 h-4 text-teal-600" />{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 max-lg:w-10 max-lg:h-10 rounded-lg grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng sau">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="e-search flex-1 min-w-[180px] sm:max-w-xs max-lg:w-full max-lg:max-w-none max-lg:basis-full max-lg:[&>input]:bg-white max-lg:[&>input]:h-11 max-lg:[&>input]:rounded-2xl max-lg:[&>input]:shadow-soft">
          <Search />
          <input
            placeholder="Tìm nhân sự..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Điện thoại: chip lọc trạng thái cuộn ngang */}
        <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 w-[calc(100%+2rem)] [scrollbar-width:none]">
          {[{key:'all',label:'Tất cả'},{key:'pending',label:'Chờ duyệt'},{key:'approved',label:'Đã duyệt'},{key:'rejected',label:'Từ chối'}].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap transition ${filter === f.key ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
              {f.label}
              {f.key === 'pending' && pendingCount > 0 && (
                <span className="inline-grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger-500 text-white text-[11px] font-bold tabular-nums">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        {/* Máy tính: bộ chuyển trạng thái */}
        <div className="e-seg ml-auto overflow-x-auto max-w-full hidden lg:inline-flex">
          {[{key:'all',label:'Tất cả'},{key:'pending',label:'Chờ duyệt'},{key:'approved',label:'Đã duyệt'},{key:'rejected',label:'Từ chối'}].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`e-seg-item ${filter === f.key ? 'e-seg-active' : 'text-slate-500'}`}>
              {f.label}
              {f.key === 'pending' && pendingCount > 0 && (
                <span className="e-badge e-badge-sm e-tone-danger h-[18px] px-1.5 text-[10.5px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chỉ số (bấm để lọc) */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { key: 'pending', label: 'Chờ duyệt', color: 'bg-warning-50 text-warning-600' },
          { key: 'approved', label: 'Đã duyệt', color: 'bg-success-50 text-success-600' },
          { key: 'rejected', label: 'Từ chối', color: 'bg-danger-50 text-danger-600' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`e-metric flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 p-3 lg:p-5 max-lg:shadow-soft transition ${filter === s.key ? 'border-teal-500 ring-2 ring-teal-100' : 'hover:border-teal-200'}`}>
            <span className={`w-9 h-9 lg:w-12 lg:h-12 rounded-full grid place-items-center shrink-0 ${s.color}`}>
              <FileText className="w-[18px] h-[18px] lg:w-5 lg:h-5" />
            </span>
            <span className="min-w-0 flex flex-col-reverse lg:flex-col">
              <span className="e-metric-label block max-lg:text-[12px]">{s.label}</span>
              <span className="e-metric-value block max-lg:text-[22px]">{requests.filter(r => r.status === s.key).length}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Tiêu đề danh sách */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h3 className="e-card-title max-lg:text-[18px] max-lg:font-bold">Danh sách đơn</h3>
          <p className="e-card-sub">{MONTHS[month-1]} {year}</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="e-card e-empty">
          <div className="e-empty-icon"><FileText /></div>
          <div className="e-empty-title">Không có đơn xin phép nào</div>
        </div>
      ) : (
        <>
        {/* Điện thoại: thẻ yêu cầu kiểu Ethics (avatar · loại · thời gian · lý do · Từ chối | Duyệt) */}
        <div className="lg:hidden space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="rounded-2xl bg-white border border-slate-200/80 shadow-soft overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-teal-50 to-teal-100 grid place-items-center shrink-0">
                    {r.profiles?.avatar_url ? (
                      <img src={r.profiles.avatar_url} alt={r.profiles.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[16px] font-bold text-teal-700">{r.profiles?.full_name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 text-[15px] leading-tight truncate">{r.profiles?.full_name}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={`e-badge e-badge-sm ${LEAVE_TYPES[r.type]?.color}`}>
                        {LEAVE_TYPES[r.type]?.label}
                        {r.type === 'half_day' && r.half_day_period && ` · ${HALF_DAY[r.half_day_period]}`}
                      </span>
                      <span className="text-[12px] text-slate-400">{r.profiles?.employee_id}</span>
                    </div>
                  </div>
                  <span className={`e-badge e-badge-sm shrink-0 ${LEAVE_STATUS[r.status]?.color}`}>
                    {LEAVE_STATUS[r.status]?.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[15px] font-bold text-slate-900 tabular-nums">
                  <CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />
                  {new Date(r.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' })}
                </div>
                <div className="mt-1.5 text-[13.5px] leading-[1.45] text-slate-600 whitespace-pre-line break-words">{r.reason}</div>
                <div className="flex items-center gap-1 text-[11.5px] text-slate-400 mt-2 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  Gửi lúc {new Date(r.created_at).toLocaleString('vi-VN')}
                </div>
              </div>

              {r.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
                  <button onClick={() => handleReject(r.id)} disabled={saving === r.id}
                    className="e-btn e-btn-danger-soft h-11 w-full">
                    <X /> Từ chối
                  </button>
                  <button onClick={() => handleApprove(r.id)} disabled={saving === r.id}
                    className="e-btn e-btn-primary h-11 w-full">
                    <Check /> Duyệt
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Máy tính: lưới thẻ (giữ nguyên) */}
        <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
          {filtered.map(r => (
            <div key={r.id} className="e-card overflow-hidden flex flex-col">
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-teal-50 grid place-items-center shrink-0">
                      {r.profiles?.avatar_url ? (
                        <img src={r.profiles.avatar_url} alt={r.profiles.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[15px] font-bold text-teal-700">{r.profiles?.full_name?.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-[14.5px] truncate">{r.profiles?.full_name}</div>
                      <div className="text-[12px] text-slate-500">{r.profiles?.employee_id}</div>
                    </div>
                  </div>
                  <span className={`e-badge e-badge-sm e-badge-dot shrink-0 ${LEAVE_STATUS[r.status]?.color}`}>
                    {LEAVE_STATUS[r.status]?.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="e-subtle px-3 py-2">
                    <div className="e-kv-label">Loại đơn</div>
                    <div className="text-[13px] font-semibold text-slate-800 mt-0.5">
                      {LEAVE_TYPES[r.type]?.label}
                      {r.type === 'half_day' && r.half_day_period && ` · ${HALF_DAY[r.half_day_period]}`}
                    </div>
                  </div>
                  <div className="e-subtle px-3 py-2">
                    <div className="e-kv-label">Ngày</div>
                    <div className="text-[13px] font-semibold text-slate-800 mt-0.5">
                      {new Date(r.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                </div>

                <div className="mt-2 e-subtle px-3 py-2">
                  <div className="e-kv-label">Lý do</div>
                  <div className="text-[13px] text-slate-700 mt-0.5">{r.reason}</div>
                </div>

                <div className="text-[11.5px] text-slate-400 mt-2.5">
                  Gửi lúc {new Date(r.created_at).toLocaleString('vi-VN')}
                </div>
              </div>

              {r.status === 'pending' && (
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                  <button onClick={() => handleReject(r.id)} disabled={saving === r.id}
                    className="e-btn e-btn-secondary e-btn-sm hover:!text-danger-600 hover:!border-danger-200">
                    <X /> Từ chối
                  </button>
                  <button onClick={() => handleApprove(r.id)} disabled={saving === r.id}
                    className="e-btn e-btn-primary e-btn-sm">
                    <Check /> Duyệt
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default LeaveManagementPage;
