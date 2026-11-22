// ============================================================
// GALA — tải dữ liệu chương trình + thao tác (mọi quyền kiểm ở DB qua RLS/RPC)
// Làm mới mỗi 12 giây và khi quay lại tab (không cần bật Realtime).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { isMissingSchema, readError } from './galaUtil';

const POLL_MS = 12000;

export function useGala({ userId, isAdmin }) {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [performances, setPerformances] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [judges, setJudges] = useState([]);
  const [scores, setScores] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [working, setWorking] = useState(false);

  const selectedEvent = events.find((e) => e.id === eventId) || null;
  const published = !!selectedEvent?.published;

  const loadEvents = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase.from('gala_events').select('*').order('created_at', { ascending: false });
    if (error) {
      if (isMissingSchema(error)) setMissing(true);
      else toast.error(readError(error));
      setLoading(false);
      return;
    }
    setMissing(false);
    setEvents(data || []);
    setEventId((prev) => ((data || []).some((e) => e.id === prev) ? prev : data?.[0]?.id || null));
    setLoading(false);
  }, [userId]);

  // Chống ghi đè: chỉ nhận kết quả của lần tải mới nhất
  const reqRef = useRef(0);
  const loadDetails = useCallback(async () => {
    if (!eventId) {
      setPerformances([]); setCriteria([]); setJudges([]); setScores([]); setRanking([]);
      return;
    }
    const req = ++reqRef.current;
    const [p, c, j, s] = await Promise.all([
      supabase.from('gala_performances').select('*').eq('event_id', eventId).order('order_no').order('created_at'),
      supabase.from('gala_criteria').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('gala_judges').select('*').eq('event_id', eventId).order('assigned_at'),
      supabase.from('gala_scores').select('*').eq('event_id', eventId),
    ]);
    let r = { data: [] };
    if (isAdmin || published) r = await supabase.rpc('gala_rankings', { p_event_id: eventId });
    if (req !== reqRef.current) return;
    const err = p.error || c.error || j.error || s.error || r.error;
    if (err) { toast.error(readError(err)); return; }
    setPerformances(p.data || []);
    setCriteria(c.data || []);
    setJudges(j.data || []);
    setScores(s.data || []);
    setRanking(r.data || []);
  }, [eventId, isAdmin, published]);

  const refresh = useCallback(async () => { await loadEvents(); await loadDetails(); }, [loadEvents, loadDetails]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadDetails(); }, [loadDetails]);
  useEffect(() => {
    if (missing) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [refresh, missing]);

  // Chạy 1 thao tác: khoá nút, báo lỗi bằng toast, tải lại dữ liệu
  const run = useCallback(async (fn, okMsg) => {
    setWorking(true);
    try {
      const out = await fn();
      if (okMsg) toast.success(typeof okMsg === 'function' ? okMsg(out) : okMsg);
      await refresh();
      return true;
    } catch (e) {
      toast.error(readError(e));
      return false;
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const must = (res) => { if (res?.error) throw res.error; return res?.data; };

  const activeJudges = useMemo(() => judges.filter((j) => j.active), [judges]);
  const activeIds = useMemo(() => new Set(activeJudges.map((j) => j.user_id)), [activeJudges]);
  const expectedCount = activeJudges.length * performances.length;
  const receivedCount = scores.filter((s) => activeIds.has(s.judge_id)).length;

  const actions = {
    createEvent: (title) => run(async () => {
      const t = title.trim();
      if (t.length < 3) throw new Error('Tên chương trình cần ít nhất 3 ký tự.');
      const row = must(await supabase.from('gala_events').insert({ title: t, created_by: userId }).select('id').single());
      setEventId(row.id);
    }, 'Đã tạo chương trình + bộ tiêu chí 100 điểm.'),

    addPerformance: (f) => run(async () => {
      if (!f.title.trim() || !f.team_name.trim()) throw new Error('Nhập tên tiết mục và đội biểu diễn.');
      const nextOrder = performances.reduce((m, p) => Math.max(m, p.order_no || 0), 0) + 1;
      must(await supabase.from('gala_performances').insert({
        event_id: eventId,
        title: f.title.trim(),
        team_name: f.team_name.trim(),
        description: f.description.trim(),
        duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
        order_no: nextOrder,
      }));
    }, 'Đã thêm tiết mục.'),

    updatePerformance: (f) => run(async () => {
      if (!f.title?.trim() || !f.team_name?.trim()) throw new Error('Tên tiết mục / đội không được trống.');
      must(await supabase.from('gala_performances').update({
        title: f.title.trim(),
        team_name: f.team_name.trim(),
        description: (f.description || '').trim(),
        order_no: Number(f.order_no) || 1,
        duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
      }).eq('id', f.id).eq('event_id', eventId));
    }, 'Đã cập nhật tiết mục.'),

    deletePerformance: (id) => run(async () => {
      must(await supabase.from('gala_performances').delete().eq('id', id).eq('event_id', eventId));
    }, 'Đã xoá tiết mục.'),

    setJudge: (userIdToSet, active, name) => run(async () => {
      must(await supabase.rpc('gala_set_judge', { p_event_id: eventId, p_user_id: userIdToSet, p_active: active }));
    }, active ? `Đã cấp quyền giám khảo cho ${name || 'nhân sự'}.` : `Đã thu hồi quyền giám khảo của ${name || 'nhân sự'}.`),

    eventAction: (name, force = false) => run(async () => {
      must(await supabase.rpc('gala_event_action', { p_event_id: eventId, p_action: name, p_force: force }));
    }, {
      open: 'Đã mở chấm điểm.', pause: 'Đã tạm dừng chấm.', close: 'Đã khoá chấm.',
      publish: 'Đã công bố kết quả.', unpublish: 'Đã ẩn kết quả để rà soát.',
    }[name]),

    submitScore: (performanceId, values, note) => run(async () => {
      return must(await supabase.rpc('gala_submit_score', {
        p_event_id: eventId, p_performance_id: performanceId, p_values: values, p_note: note || '',
      }));
    }, (total) => `Đã gửi phiếu: ${Number(total).toLocaleString('vi-VN')}/100 điểm.`),
  };

  return {
    events, eventId, setEventId, selectedEvent,
    performances, criteria, judges, activeJudges, scores, ranking,
    expectedCount, receivedCount,
    loading, missing, working, refresh, actions,
  };
}
