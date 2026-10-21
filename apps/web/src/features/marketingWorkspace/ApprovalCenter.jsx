// ============================================================
// MARKETING WORKSPACE — TRUNG TÂM DUYỆT (S10)
// Tab: Chờ tôi / Đã gửi / Đã xử lý / Trả lại.
// Người duyệt thấy ĐÚNG snapshot đã gửi (kịch bản, tệp + sha256, caption). Nếu đã có phiên bản mới hơn
// -> cảnh báo; server tự huỷ hiệu lực khi bấm duyệt (không duyệt âm thầm bản đã bị thay).
// Quyền duyệt theo loại người duyệt do Admin cấp — kiểm tra ở RPC mw_review_step.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, CheckCircle2, RotateCcw, XCircle, ChevronLeft, AlertTriangle } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ds';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { vnToday } from '@/lib/vnTime';
import { mwApi } from './mwApi';
import { RUN_STATE, STEP_KIND, CONTENT_TYPES, PLATFORMS, fmtDateTime } from './mwMeta';
import { Tone, Skeleton, attempt, BusyButton } from './mwUi';
import { AssetPreview, StepsTimeline } from './ContentStudio';

const TABS = [
  { id: 'mine', label: 'Chờ tôi' },
  { id: 'sent', label: 'Đã gửi' },
  { id: 'done', label: 'Đã xử lý' },
  { id: 'returned', label: 'Trả lại' },
];

export default function ApprovalCenter({ profile, myKinds, staffById, focusRunId }) {
  const [st, setSt] = useState({ loading: true });
  const [tab, setTab] = useState('mine');
  const [sel, setSel] = useState(focusRunId || null);
  useEffect(() => { if (focusRunId) setSel(focusRunId); }, [focusRunId]);
  const load = useCallback(async () => {
    try {
      const runs = await mwApi.allRuns();
      const cIds = [...new Set(runs.map(r => r.content_id))];
      const [steps, contents, versions, consents] = await Promise.all([
        mwApi.steps(runs.map(r => r.id)), mwApi.contents(), mwApi.versions(cIds), mwApi.consents(cIds),
      ]);
      setSt({ loading: false, runs, steps, contents: new Map(contents.map(c => [c.id, c])), versions, consents });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('mw_approval_steps', load);

  const groups = useMemo(() => {
    if (!st.runs) return {};
    const pendingStep = (r) => st.steps.find(s => s.run_id === r.id && s.state === 'pending');
    return {
      mine: st.runs.filter(r => r.state === 'pending' && myKinds.has(pendingStep(r)?.kind)),
      sent: st.runs.filter(r => r.requested_by === profile.id),
      done: st.runs.filter(r => st.steps.some(s => s.run_id === r.id && s.acted_by === profile.id)),
      returned: st.runs.filter(r => ['revision_requested', 'rejected', 'invalidated'].includes(r.state)),
    };
  }, [st, myKinds, profile.id]);

  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={5} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const list = groups[tab] || [];
  const current = st.runs.find(r => r.id === sel);

  return (
    <div className="space-y-3">
      {!myKinds.size && <div className="e-alert e-alert-info text-[13px]">Bạn chưa được Admin cấp quyền duyệt — chỉ xem được các lượt duyệt của workspace mình tham gia.</div>}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
        <div className={`e-card ${current ? 'hidden lg:block' : ''}`}>
          <div className="e-tabs px-2" role="tablist">
            {TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`e-tab ${tab === t.id ? 'e-tab-active' : ''}`}>{t.label}<span className="e-tab-count">{groups[t.id]?.length || 0}</span></button>)}
          </div>
          {!list.length ? <EmptyState icon={ShieldCheck} title="Không có mục nào" /> : (
            <ul className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
              {list.map(r => {
                const c = st.contents.get(r.content_id);
                const ps = st.steps.find(s => s.run_id === r.id && s.state === 'pending');
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSel(r.id)} aria-current={sel === r.id}
                      className={`w-full text-left p-2.5 rounded-xl border transition ${sel === r.id ? 'border-teal-400 bg-teal-50/60' : 'border-transparent hover:bg-slate-50'}`}>
                      <div className="flex items-start gap-2"><span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-800">{c?.title || 'Nội dung'}</span><Tone meta={RUN_STATE[r.state]} /></div>
                      <div className="text-[11.5px] text-slate-400">{ps ? `Chờ: ${STEP_KIND[ps.kind]}` : ''}{ps ? ' · ' : ''}gửi {fmtDateTime(r.created_at)} · {staffById.get(r.requested_by)?.full_name || '—'}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className={current ? '' : 'hidden lg:block'}>
          {current ? <RunDetail key={current.id} run={current} st={st} myKinds={myKinds} staffById={staffById} onBack={() => setSel(null)} onDone={load} />
            : <div className="e-card"><EmptyState icon={ShieldCheck} title="Chọn 1 yêu cầu duyệt" /></div>}
        </div>
      </div>
    </div>
  );
}

function RunDetail({ run, st, myKinds, staffById, onBack, onDone }) {
  const [note, setNote] = useState('');
  const c = st.contents.get(run.content_id);
  const steps = st.steps.filter(s => s.run_id === run.id);
  const versions = st.versions.filter(v => v.content_id === run.content_id);
  const v = (id) => versions.find(x => x.id === id);
  const latest = (k) => versions.find(x => x.kind === k)?.id || null;    // revision giảm dần
  const stale = run.state === 'pending' && (latest('script') !== (run.script_version_id || null) || latest('asset') !== (run.asset_version_id || null) || latest('caption') !== (run.caption_version_id || null));
  const myStep = steps.find(s => s.state === 'pending' && myKinds.has(s.kind));
  const today = vnToday();
  const consents = st.consents.filter(x => x.content_id === run.content_id);
  const consentOk = consents.some(x => x.verified_at && !x.revoked_at && (!x.valid_until || x.valid_until >= today));
  const act = async (decision) => {
    const r = await attempt(() => mwApi.reviewStep(myStep.id, decision, note.trim()));
    if (!r) return;
    if (r === 'invalidated') toast.error('Snapshot đã cũ — lượt duyệt bị huỷ hiệu lực, cần gửi duyệt lại');
    else toast.success(decision === 'approve' ? 'Đã duyệt bước này' : decision === 'revision' ? 'Đã yêu cầu sửa' : 'Đã từ chối');
    setNote(''); onDone();
  };
  const script = v(run.script_version_id);
  const asset = v(run.asset_version_id);
  const caption = v(run.caption_version_id);
  return (
    <div className="e-card pb-24 lg:pb-0">
      <div className="flex items-start gap-2 p-4 border-b border-slate-100">
        <button type="button" className="e-icon-btn w-9 h-9 lg:hidden" onClick={onBack} aria-label="Quay lại"><ChevronLeft className="w-4 h-4" /></button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-slate-900">{c?.title || 'Nội dung'}</h2>
          <div className="text-[12px] text-slate-400">{c ? `${CONTENT_TYPES[c.content_type]} · ${c.platforms.map(p => PLATFORMS[p]).join(', ') || 'chưa chọn nền tảng'}` : ''} · snapshot <span className="font-mono">{run.snapshot_hash.slice(0, 16)}…</span></div>
        </div>
        <Tone meta={RUN_STATE[run.state]} />
      </div>
      <div className="p-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {stale && <div className="e-alert e-alert-warning text-[13px] flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />Đã có phiên bản mới hơn snapshot này. Bấm duyệt sẽ bị hệ thống huỷ hiệu lực — người làm cần gửi duyệt lại.</div>}
          {c?.brief && <section><h3 className="text-[13px] font-bold text-slate-700 mb-1">Brief</h3><p className="text-[13px] text-slate-600 whitespace-pre-wrap">{c.brief}</p></section>}
          <section><h3 className="text-[13px] font-bold text-slate-700 mb-1">Tệp media {asset ? `v${asset.revision}` : ''}</h3>{asset ? <AssetPreview v={asset} /> : <p className="text-[12.5px] text-slate-400">Không có tệp.</p>}</section>
          <section><h3 className="text-[13px] font-bold text-slate-700 mb-1">Kịch bản {script ? `v${script.revision}` : ''}</h3>{script ? <p className="text-[13px] text-slate-700 whitespace-pre-wrap rounded-xl bg-slate-50 p-3">{script.body}</p> : <p className="text-[12.5px] text-slate-400">Không có kịch bản.</p>}</section>
          <section><h3 className="text-[13px] font-bold text-slate-700 mb-1">Caption {caption ? `v${caption.revision}` : ''}</h3>{caption && <p className="text-[13px] text-slate-700 whitespace-pre-wrap rounded-xl bg-slate-50 p-3">{caption.body}</p>}</section>
        </div>
        <aside className="space-y-4">
          <section><h3 className="text-[13px] font-bold text-slate-700 mb-1.5">Các bước duyệt</h3><StepsTimeline steps={steps} staffById={staffById} /></section>
          {c?.consent_required && (
            <section className={`rounded-xl p-3 text-[12.5px] ${consentOk ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
              {consentOk ? 'Consent hợp lệ (đã xác minh, còn hạn).' : 'CHƯA có consent hợp lệ — bước Pháp lý & consent không duyệt được.'}
              {consents.map(x => (
                <div key={x.id} className="mt-1.5 text-slate-700">
                  <div><b className="font-mono">{x.consent_ref}</b>{x.revoked_at ? ' (thu hồi)' : x.verified_at ? ' ✓' : ' (chờ xác minh)'}{x.valid_until ? ` · đến ${x.valid_until.split('-').reverse().join('/')}` : ''}</div>
                  <div className="text-slate-500">Phạm vi: {x.scope}</div>
                  {!x.verified_at && !x.revoked_at && myKinds.has('compliance') && (
                    <BusyButton className="e-btn e-btn-success e-btn-sm mt-1" onClick={async () => { if (await attempt(() => mwApi.verifyConsent(x.id), 'Đã xác minh consent')) onDone(); }}>Xác minh consent</BusyButton>
                  )}
                </div>
              ))}
            </section>
          )}
          {run.close_reason && <div className="text-[12.5px] text-slate-500">Lý do đóng: {run.close_reason}</div>}
          {myStep && (
            <section className="fixed lg:static inset-x-0 bottom-0 z-30 bg-white lg:bg-transparent border-t lg:border-0 border-slate-200 p-3 lg:p-0 space-y-2 shadow-float lg:shadow-none">
              <div className="text-[12.5px] font-semibold text-slate-700">Bạn duyệt bước: {STEP_KIND[myStep.kind]}</div>
              <textarea className="e-textarea min-h-[64px]" value={note} onChange={e => setNote(e.target.value)} placeholder="Nhận xét (bắt buộc khi yêu cầu sửa / từ chối)" maxLength={2000} />
              <div className="grid grid-cols-3 gap-1.5">
                <BusyButton className="e-btn e-btn-success e-btn-sm" onClick={() => act('approve')}><CheckCircle2 /> Duyệt</BusyButton>
                <BusyButton className="e-btn e-btn-secondary e-btn-sm" disabled={!note.trim()} onClick={() => act('revision')}><RotateCcw /> Yêu cầu sửa</BusyButton>
                <BusyButton className="e-btn e-btn-danger-soft e-btn-sm" disabled={!note.trim()} onClick={() => act('reject')}><XCircle /> Từ chối</BusyButton>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
