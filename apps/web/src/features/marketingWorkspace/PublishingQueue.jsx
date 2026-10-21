// ============================================================
// MARKETING WORKSPACE — HÀNG ĐỢI XUẤT BẢN (S12)
// CHƯA kết nối API mạng xã hội nào -> mọi bài đăng là THỦ CÔNG:
//   Nháp -> Lên lịch (server kiểm tra gate: duyệt đủ bước, đúng phiên bản caption/tệp đã duyệt, consent hợp lệ)
//   -> người đăng đăng tay rồi nộp LINK bằng chứng -> NGƯỜI KHÁC xác minh -> Đã đăng.
// Không có nút "đăng tự động", không gắn nhãn "đã đăng" khi chưa có link được xác minh.
// Mọi chuyển trạng thái đi qua RPC (database chặn PATCH trực tiếp).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send, Link2, CheckCircle2, XCircle, Ban, CalendarClock, ShieldAlert, ExternalLink, PlugZap } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ds';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { mwApi } from './mwApi';
import { PUB_STATE, PUB_ORDER, PLATFORMS, fmtDateTime, toLocalInput, fromLocalInput, vnDateOf, fmtDate } from './mwMeta';
import { Modal, Field, Tone, Skeleton, attempt, BusyButton } from './mwUi';

// Thẻ 1 bài đăng + thao tác theo trạng thái
export function PublicationCard({ p, content, versions, canPublish, canEdit, profile, staffById, onDone }) {
  const [dlg, setDlg] = useState(null);   // 'schedule' | 'proof' | 'fail'
  const [val, setVal] = useState('');
  const [gate, setGate] = useState(undefined);
  const cap = versions?.find(v => v.id === p.caption_version_id);
  const asset = versions?.find(v => v.id === p.asset_version_id);
  const name = (id) => staffById.get(id)?.full_name || 'Không rõ';
  const check = async () => { const g = await attempt(() => mwApi.publicationGate(p.id)); if (g !== null) setGate(g === true ? null : g); };
  const run = async (fn, ok) => { const r = await attempt(fn); if (r === null) return; if (typeof r === 'string') toast.error(`Bị chặn: ${r}`); else toast.success(ok); setDlg(null); onDone(); };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-3 space-y-2 shadow-soft">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-slate-800 leading-snug">{content?.title || 'Nội dung'}</div>
          <div className="text-[12px] text-slate-500">{PLATFORMS[p.platform]}{cap ? ` · caption v${cap.revision}` : ' · chưa gắn caption'}{asset ? ` · tệp v${asset.revision}` : ''}</div>
        </div>
        <Tone meta={PUB_STATE[p.state]} />
      </div>
      {p.scheduled_at && <div className="text-[12px] text-slate-500"><CalendarClock className="w-3.5 h-3.5 inline -mt-0.5" /> Lịch đăng thủ công: {fmtDateTime(p.scheduled_at)}</div>}
      {p.last_error && <div className="text-[12px] text-danger-600 flex gap-1"><ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />{p.last_error}</div>}
      {p.proof_url && <a href={p.proof_url} target="_blank" rel="noreferrer noopener" className="text-[12px] text-teal-700 hover:underline inline-flex items-center gap-1 break-all"><ExternalLink className="w-3.5 h-3.5 shrink-0" />{p.proof_url}</a>}
      {p.proof_by && <div className="text-[11.5px] text-slate-400">Nộp link: {name(p.proof_by)} · {fmtDateTime(p.proof_at)}{p.verified_by ? ` · Xác minh: ${name(p.verified_by)} · ${fmtDateTime(p.verified_at)}` : ''}</div>}
      {gate !== undefined && <div className={`text-[12px] rounded-lg px-2 py-1 ${gate ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700'}`}>{gate ? `Chưa đủ điều kiện: ${gate}` : 'Đủ điều kiện đăng (duyệt đủ, đúng phiên bản, consent hợp lệ)'}</div>}
      <div className="flex flex-wrap gap-1.5">
        {['draft', 'blocked'].includes(p.state) && <BusyButton className="e-btn e-btn-ghost e-btn-sm" onClick={check}>Kiểm tra điều kiện</BusyButton>}
        {canPublish && ['draft', 'blocked'].includes(p.state) && <button type="button" className="e-btn e-btn-primary e-btn-sm" onClick={() => { setVal(toLocalInput(p.scheduled_at || new Date(Date.now() + 3600000).toISOString())); setDlg('schedule'); }}><CalendarClock /> Lên lịch</button>}
        {canPublish && p.state === 'scheduled' && <button type="button" className="e-btn e-btn-primary e-btn-sm" onClick={() => { setVal(''); setDlg('proof'); }}><Link2 /> Đã đăng — nộp link</button>}
        {canPublish && p.state === 'pending_verification' && p.proof_by !== profile.id && <>
          <BusyButton className="e-btn e-btn-success e-btn-sm" onClick={() => run(() => mwApi.verifyPublication(p.id, true), 'Đã xác minh: bài đã đăng')}><CheckCircle2 /> Xác minh đúng</BusyButton>
          <button type="button" className="e-btn e-btn-danger-soft e-btn-sm" onClick={() => { setVal(''); setDlg('fail'); }}><XCircle /> Không đạt</button>
        </>}
        {p.state === 'pending_verification' && p.proof_by === profile.id && <span className="text-[11.5px] text-slate-400 self-center">Chờ người khác xác minh link</span>}
        {canEdit && !['published', 'cancelled'].includes(p.state) && <BusyButton className="e-btn e-btn-ghost e-btn-sm" onClick={() => run(() => mwApi.cancelPublication(p.id), 'Đã huỷ bài đăng')}><Ban /> Huỷ</BusyButton>}
      </div>
      <Modal open={dlg === 'schedule'} onClose={() => setDlg(null)} title="Lên lịch đăng thủ công" desc="Server kiểm tra lại điều kiện; thiếu điều kiện -> bài chuyển sang Bị chặn kèm lý do." footer={<>
        <button type="button" className="e-btn e-btn-secondary" onClick={() => setDlg(null)}>Huỷ</button>
        <BusyButton disabled={!val} onClick={() => run(() => mwApi.schedulePublication(p.id, fromLocalInput(val)), 'Đã lên lịch — nhắc người đăng thủ công')}>Lên lịch</BusyButton>
      </>}>
        <Field label="Thời gian đăng (giờ Việt Nam)" required><input type="datetime-local" className="e-input" value={val} onChange={e => setVal(e.target.value)} /></Field>
        <p className="text-[12.5px] text-slate-500">Chưa kết nối API {PLATFORMS[p.platform]} — hệ thống KHÔNG tự đăng. Đến giờ, người đăng đăng tay rồi nộp link bằng chứng.</p>
      </Modal>
      <Modal open={dlg === 'proof'} onClose={() => setDlg(null)} title="Nộp link bài đã đăng" footer={<>
        <button type="button" className="e-btn e-btn-secondary" onClick={() => setDlg(null)}>Huỷ</button>
        <BusyButton disabled={!/^https?:\/\/\S+\.\S+/.test(val.trim())} onClick={() => run(() => mwApi.submitProof(p.id, val.trim()), 'Đã nộp link — chờ người khác xác minh')}>Nộp link</BusyButton>
      </>}>
        <Field label={`Link bài trên ${PLATFORMS[p.platform]}`} required hint="Người KHÁC sẽ mở link để xác minh trước khi tính là Đã đăng."><input className="e-input" value={val} onChange={e => setVal(e.target.value)} placeholder="https://…" /></Field>
      </Modal>
      <Modal open={dlg === 'fail'} onClose={() => setDlg(null)} title="Xác minh không đạt" footer={<>
        <button type="button" className="e-btn e-btn-secondary" onClick={() => setDlg(null)}>Huỷ</button>
        <BusyButton className="e-btn e-btn-danger" disabled={!val.trim()} onClick={() => run(() => mwApi.verifyPublication(p.id, false, val.trim()), 'Đã trả về Chờ đăng')}>Trả về</BusyButton>
      </>}>
        <Field label="Lý do" required><textarea className="e-textarea" value={val} onChange={e => setVal(e.target.value)} placeholder="VD: link không mở được / sai caption / sai video" /></Field>
      </Modal>
    </article>
  );
}

export default function PublishingQueue({ ws, perm, myKinds, profile, staffById }) {
  const [st, setSt] = useState({ loading: true });
  const load = useCallback(async () => {
    try {
      const [contents, pubs] = await Promise.all([mwApi.contents(), mwApi.publications()]);
      const mine = contents.filter(c => c.workspace_id === ws.id);
      const ids = new Set(mine.map(c => c.id));
      const list = pubs.filter(p => ids.has(p.content_id));
      const versions = await mwApi.versions([...new Set(list.map(p => p.content_id))]);
      setSt({ loading: false, contents: new Map(mine.map(c => [c.id, c])), pubs: list, versions });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('mw_publications', load);
  const [view, setView] = useState('board');
  const canPublish = perm.manage || myKinds.has('publisher');
  const byDate = useMemo(() => {
    if (!st.pubs) return [];
    const m = new Map();
    st.pubs.filter(p => p.scheduled_at && p.state !== 'cancelled').forEach(p => { const d = vnDateOf(p.scheduled_at); if (!m.has(d)) m.set(d, []); m.get(d).push(p); });
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [st.pubs]);

  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={5} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const card = (p) => <PublicationCard key={p.id} p={p} content={st.contents.get(p.content_id)} versions={st.versions.filter(v => v.content_id === p.content_id)}
    canPublish={canPublish} canEdit={perm.edit} profile={profile} staffById={staffById} onDone={load} />;
  return (
    <div className="space-y-3">
      <div className="e-alert e-alert-info flex items-start gap-2">
        <PlugZap className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="text-[13px]"><b>Chưa kết nối API mạng xã hội</b> (Facebook / Instagram / TikTok / YouTube / Zalo cần OAuth chính thức). Mọi bài là <b>đăng thủ công có bằng chứng</b>: lên lịch → đăng tay → nộp link → người khác xác minh. Tạo bài đăng ở Content Studio › tab Xuất bản.</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="e-seg">
          <button type="button" className={`e-seg-item ${view === 'board' ? 'e-seg-active' : ''}`} onClick={() => setView('board')}>Theo trạng thái</button>
          <button type="button" className={`e-seg-item ${view === 'agenda' ? 'e-seg-active' : ''}`} onClick={() => setView('agenda')}>Lịch đăng</button>
        </div>
        {!canPublish && <span className="text-[12px] text-slate-400">Bạn chỉ xem — lên lịch / nộp link cần quyền Quản lý hoặc Người đăng bài.</span>}
      </div>
      {!st.pubs.length ? <div className="e-card"><EmptyState icon={Send} title="Chưa có bài đăng" description="Mở Content Studio, chọn nội dung đã duyệt, tab Xuất bản -> Thêm bài đăng theo nền tảng." /></div>
        : view === 'board' ? (
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2">
            <div className="flex gap-3 items-start min-w-max">
              {PUB_ORDER.map(s => {
                const items = st.pubs.filter(p => p.state === s);
                return (
                  <section key={s} className="w-[290px] shrink-0 rounded-2xl p-2.5 bg-slate-50/80 border border-slate-100">
                    <header className="flex items-center gap-2 px-2 py-1.5 mb-2"><Tone meta={PUB_STATE[s]} /><span className="text-[12px] text-slate-400 ml-auto">{items.length}</span></header>
                    <div className="space-y-2">{items.map(card)}{!items.length && <p className="text-[12px] text-slate-300 px-2 pb-2">Trống</p>}</div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {byDate.length === 0 && <div className="e-card"><EmptyState title="Chưa có lịch đăng" /></div>}
            {byDate.map(([d, items]) => (
              <section key={d} className="e-card e-card-pad">
                <h3 className="text-[14px] font-bold text-slate-800 mb-2">{fmtDate(`${d}T05:00:00Z`)}</h3>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).map(card)}</div>
              </section>
            ))}
          </div>
        )}
    </div>
  );
}
