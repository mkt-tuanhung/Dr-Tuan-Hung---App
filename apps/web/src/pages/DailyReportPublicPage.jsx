import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { PhoneCall, UserPlus, HeartHandshake, CalendarClock, Users, TrendingUp, Clock } from 'lucide-react';
import { Bars, Donut } from '@/components/report/ReportViz.jsx';

// Trang BÁO CÁO NGÀY công khai — sếp quét QR / mở link là xem, không cần đăng nhập.
// Tối ưu mobile: 1 cột, chữ to vừa, cuộn dọc.
const fmtT = (iso) => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

const DailyReportPublicPage = () => {
  const { slug } = useParams();
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_daily_report', { p_slug: slug });
      if (error || !data) setErr('Không tìm thấy báo cáo — link sai hoặc đã bị xoá.');
      else setRep(data);
    })();
  }, [slug]);

  if (err) return <div className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center text-slate-500">{err}</div>;
  if (!rep) return <div className="min-h-screen grid place-items-center bg-slate-50"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;

  const p = rep.payload || {};
  const st = p.stats || {};
  const callsNew = p.calls_new ?? (p.calls || []).filter(c => c.is_new);
  const callsOld = p.calls_old ?? (p.calls || []).filter(c => !c.is_new);
  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
      <div className="text-[13px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">{Icon && <Icon className="w-4 h-4 text-teal-600" />}{title}</div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="text-white px-4 pt-6 pb-8 rounded-b-[28px] shadow-lg" style={{ background: 'linear-gradient(160deg,#0b3b34 0%,#0f5148 55%,#136b5e 100%)' }}>
        <div className="max-w-xl mx-auto">
          <div className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Dr Tuấn Hùng · Telesale</div>
          <h1 className="text-2xl font-bold mt-1">Báo cáo ngày</h1>
          <div className="text-white/80 text-sm mt-1 capitalize">{fmtDate(p.day || rep.day)}</div>
          <div className="flex items-center gap-2 mt-2 text-[12px] text-white/70 flex-wrap">
            <span className="bg-white/15 rounded-full px-2.5 py-1 font-semibold">{p.whoName || 'Tất cả telesale'}</span>
            {rep.created_at && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Xuất lúc {fmtT(rep.created_at)}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-4">
        {/* 4 thẻ tổng quan */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {[
            { label: 'Cuộc gọi trong ngày', value: st.calls ?? 0, icon: PhoneCall, cls: 'text-emerald-600 bg-emerald-50' },
            { label: 'Số mới tiếp nhận', value: st.new_count ?? 0, icon: UserPlus, cls: 'text-blue-600 bg-blue-50' },
            { label: 'Mới đã gọi', value: st.new_called ?? 0, icon: TrendingUp, cls: 'text-teal-600 bg-teal-50' },
            { label: 'Mới chưa gọi', value: st.new_not_called ?? 0, icon: CalendarClock, cls: 'text-rose-600 bg-rose-50' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
              <span className={`w-9 h-9 rounded-xl grid place-items-center mb-1.5 ${c.cls}`}><c.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /></span>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{c.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Khách cũ / khách mới */}
        <Section title="Cuộc gọi: khách cũ · khách mới" icon={Users}>
          {(() => {
            const oldC = st.old_calls ?? 0, newC = st.new_calls ?? 0, tot = oldC + newC || 1;
            return (
              <>
                <div className="flex h-5 rounded-full overflow-hidden bg-slate-100 mb-2">
                  <div className="bg-slate-400" style={{ width: `${(oldC / tot) * 100}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${(newC / tot) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[12px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Khách cũ: <b>{oldC}</b></span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Khách mới: <b>{newC}</b></span>
                </div>
              </>
            );
          })()}
        </Section>

        {/* Tệp khách theo trạng thái */}
        {(p.by_status || []).length > 0 && (
          <Section title="Khách trong ngày theo trạng thái" icon={Users}>
            <Donut data={p.by_status} centerLabel="khách/ngày" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(p.by_status || []).map((d, i) => <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: d.color }}>{d.label}: {d.value}</span>)}
            </div>
          </Section>
        )}

        {/* Kết quả gọi */}
        {(p.by_outcome || []).length > 0 && (
          <Section title="Kết quả cuộc gọi" icon={PhoneCall}>
            <Bars data={p.by_outcome} />
          </Section>
        )}

        {/* Nguồn số mới */}
        {(p.by_source || []).length > 0 && (
          <Section title="Số mới theo nguồn" icon={UserPlus}>
            <Bars data={p.by_source} />
          </Section>
        )}

        {/* Cuộc gọi tách KHÁCH MỚI / KHÁCH CŨ */}
        {[{ title: 'Cuộc gọi KHÁCH MỚI', items: callsNew, cls: 'text-emerald-700', badge: 'bg-emerald-600' },
          { title: 'Cuộc gọi KHÁCH CŨ', items: callsOld, cls: 'text-slate-700', badge: 'bg-slate-500' }].map((g, gi) => (
          <div key={gi} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
            <div className={`text-[13px] font-bold mb-2.5 flex items-center gap-1.5 ${g.cls}`}>
              <PhoneCall className="w-4 h-4" /> {g.title}
              <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${g.badge}`}>{g.items.length}</span>
            </div>
            <div className="divide-y divide-slate-50 -mx-1">
              {g.items.length === 0 ? <div className="text-center text-slate-300 text-sm py-4">Không có</div> :
                g.items.map((c, i) => (
                  <div key={i} className="px-1 py-2 text-[12.5px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-slate-800">{c.name}</b>
                      <span className="text-slate-500 tabular-nums">{c.phone}</span>
                      <span className="text-slate-400">· {fmtT(c.time)}</span>
                      {c.status_label && <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: c.status_color || '#94a3b8' }}>{c.status_label}</span>}
                      {c.author && <span className="text-slate-400">· {c.author}</span>}
                    </div>
                    {c.content && <div className="text-slate-500 mt-0.5 leading-snug">{c.content}</div>}
                  </div>
                ))}
            </div>
          </div>
        ))}

        {/* Số mới tiếp nhận */}
        <Section title={`Số mới tiếp nhận (${(p.news || []).length})`} icon={UserPlus}>
          <div className="divide-y divide-slate-50 -mx-1">
            {(p.news || []).length === 0 ? <div className="text-center text-slate-300 text-sm py-4">Không có số mới</div> :
              (p.news || []).map((r, i) => (
                <div key={i} className="px-1 py-2 text-[12.5px] flex items-center gap-2 flex-wrap">
                  <b className="text-slate-800">{r.name || '—'}</b>
                  <span className="text-slate-500 tabular-nums">{r.phone}</span>
                  {r.source && <span className="text-slate-400">· {r.source}</span>}
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${r.called ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{r.called ? 'Đã gọi' : 'Chưa gọi'}</span>
                </div>
              ))}
          </div>
        </Section>

        <div className="text-center text-[11px] text-slate-300 mt-4">Dr Tuấn Hùng — Internal System</div>
      </div>
    </div>
  );
};

export default DailyReportPublicPage;
