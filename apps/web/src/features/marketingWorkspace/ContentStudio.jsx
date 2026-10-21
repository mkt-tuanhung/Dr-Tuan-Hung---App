// ============================================================
// MARKETING WORKSPACE — CHIẾN DỊCH (S08) + CONTENT STUDIO (S09)
// Nội dung -> phiên bản BẤT BIẾN (kịch bản / tệp media có sha256 / caption) -> gửi duyệt.
// Thêm phiên bản mới sau khi gửi / đã duyệt -> database tự huỷ hiệu lực duyệt cũ + khoá lịch đăng.
// Consent chỉ lưu MÃ hồ sơ + phạm vi + hạn — KHÔNG lưu tên / SĐT / bệnh án khách hàng.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Megaphone, FileText, Upload, ShieldCheck, Send, BadgeCheck, Ban, Clapperboard, ChevronLeft, AlertTriangle } from 'lucide-react';
import { EmptyState, ErrorState, SearchInput } from '@/components/ds';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { uploadViaPresignWithProgress } from '@/lib/r2Client';
import { vnToday } from '@/lib/vnTime';
import { mwApi, sha256OfFile } from './mwApi';
import {
  CONTENT_TYPES, CONTENT_STATUS, EDITABLE_STATUSES, PLATFORMS, VERSION_KIND, CAMPAIGN_STATUS, RUN_STATE, STEP_STATE, STEP_KIND,
  fmtDateTime, fmtDate, MAX_UPLOAD_MB, ALLOWED_MIME,
} from './mwMeta';
import { Modal, Field, Tone, Skeleton, ChipToggle, attempt, BusyButton, Spinner, Sel } from './mwUi';
import { PublicationCard } from './PublishingQueue';

const money = (n) => (n == null ? '—' : `${Number(n).toLocaleString('vi-VN')} đ`);

// ================= CHIẾN DỊCH =================
export function CampaignsSection({ ws, perm, staffById, onOpenContents }) {
  const [st, setSt] = useState({ loading: true });
  const [edit, setEdit] = useState(null);
  const load = useCallback(async () => {
    try {
      const [campaigns, contents] = await Promise.all([mwApi.campaigns([ws.id]), mwApi.contents()]);
      setSt({ loading: false, campaigns, contents: contents.filter(c => c.workspace_id === ws.id) });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id]);
  useEffect(() => { load(); }, [load]);
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={4} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  return (
    <div className="space-y-3">
      {perm.manage && <div className="flex justify-end"><button type="button" className="e-btn e-btn-primary" onClick={() => setEdit({})}><Plus /> Chiến dịch mới</button></div>}
      {!st.campaigns.length ? <div className="e-card"><EmptyState icon={Megaphone} title="Chưa có chiến dịch" description={perm.manage ? 'Tạo chiến dịch để gom nội dung, ngân sách và mục tiêu.' : 'Quản lý workspace chưa tạo chiến dịch.'} /></div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {st.campaigns.map(c => {
            const items = st.contents.filter(x => x.campaign_id === c.id);
            const count = (s) => items.filter(x => x.workflow_status === s).length;
            const pub = count('published');
            const pct = items.length ? Math.round((pub / items.length) * 100) : 0;
            const over = c.budget_plan && c.budget_actual && Number(c.budget_actual) > Number(c.budget_plan);
            return (
              <article key={c.id} className="e-card e-card-pad space-y-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1"><div className="text-[15px] font-bold text-slate-900">{c.name}</div><div className="text-[12px] text-slate-400">{[c.service, c.start_date && `${fmtDate(`${c.start_date}T05:00:00Z`)} → ${c.end_date ? fmtDate(`${c.end_date}T05:00:00Z`) : '?'}`].filter(Boolean).join(' · ')}</div></div>
                  <Tone meta={CAMPAIGN_STATUS[c.status]} />
                </div>
                {c.objective && <p className="text-[13px] text-slate-600 line-clamp-3">{c.objective}</p>}
                <div className="flex flex-wrap gap-1">{c.channels.map(ch => <span key={ch} className="e-badge e-badge-sm e-tone-sky">{PLATFORMS[ch] || ch}</span>)}</div>
                <div>
                  <div className="flex justify-between text-[12px] text-slate-500 mb-1"><span>{items.length} nội dung · {count('in_review')} đang duyệt · {count('approved')} đã duyệt</span><span>{pub} đã đăng</span></div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-500" style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div><div className="e-kv-label">Ngân sách kế hoạch</div><div className="e-kv-value">{money(c.budget_plan)}</div></div>
                  <div><div className="e-kv-label">Đã chi (nhập tay)</div><div className={`e-kv-value ${over ? 'text-danger-600' : ''}`}>{money(c.budget_actual)}</div></div>
                </div>
                {over && <div className="text-[12px] text-danger-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> Vượt ngân sách kế hoạch — hệ thống chỉ cảnh báo, không tự chỉnh quảng cáo.</div>}
                {c.kpi_target && <div className="text-[12.5px]"><span className="e-kv-label">KPI mục tiêu: </span>{c.kpi_target}</div>}
                <div className="text-[11.5px] text-slate-400">Phụ trách: {staffById.get(c.owner_id)?.full_name || '—'} · KPI thực tế: chưa kết nối nguồn số liệu quảng cáo</div>
                <div className="flex gap-2 pt-1">
                  <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={() => onOpenContents(c.id)}>Xem nội dung</button>
                  {perm.manage && <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => setEdit(c)}>Sửa</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <CampaignModal c={edit} ws={ws} staffById={staffById} onClose={() => setEdit(null)} onDone={load} />
    </div>
  );
}

function CampaignModal({ c, ws, staffById, onClose, onDone }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    if (c) setF({ name: c.name || '', service: c.service || '', objective: c.objective || '', channels: c.channels || [], start_date: c.start_date || '', end_date: c.end_date || '',
      budget_plan: c.budget_plan ?? '', budget_actual: c.budget_actual ?? '', kpi_target: c.kpi_target || '', status: c.status || 'planning', owner_id: c.owner_id || '' });
  }, [c]);
  if (!c || !f) return null;
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));
  const save = async () => {
    const row = { name: f.name.trim(), service: f.service.trim() || null, objective: f.objective.trim() || null, channels: f.channels,
      start_date: f.start_date || null, end_date: f.end_date || null, budget_plan: f.budget_plan === '' ? null : Number(f.budget_plan),
      budget_actual: f.budget_actual === '' ? null : Number(f.budget_actual), kpi_target: f.kpi_target.trim() || null, status: f.status, owner_id: f.owner_id || null };
    const ok = c.id ? await attempt(() => mwApi.updateCampaign(c.id, row), 'Đã lưu chiến dịch') : await attempt(() => mwApi.createCampaign({ ...row, workspace_id: ws.id }), 'Đã tạo chiến dịch');
    if (ok) { onClose(); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={c.id ? 'Sửa chiến dịch' : 'Chiến dịch mới'} size="max-w-2xl" footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton disabled={!f.name.trim() || (f.start_date && f.end_date && f.end_date < f.start_date)} onClick={save}>Lưu</BusyButton>
    </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tên chiến dịch" required className="sm:col-span-2"><input className="e-input" value={f.name} maxLength={200} onChange={set('name')} /></Field>
        <Field label="Dịch vụ"><input className="e-input" value={f.service} onChange={set('service')} placeholder="VD: Phẫu thuật hàm mặt" /></Field>
        <Field label="Trạng thái"><select className="e-input" value={f.status} onChange={set('status')}>{Object.entries(CAMPAIGN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Mục tiêu" className="sm:col-span-2"><textarea className="e-textarea" value={f.objective} onChange={set('objective')} /></Field>
        <div className="sm:col-span-2"><span className="e-label">Kênh</span><ChipToggle options={PLATFORMS} value={f.channels} onChange={(v) => setF(x => ({ ...x, channels: v }))} /></div>
        <Field label="Bắt đầu"><input type="date" className="e-input" value={f.start_date} onChange={set('start_date')} /></Field>
        <Field label="Kết thúc"><input type="date" className="e-input" value={f.end_date} min={f.start_date || undefined} onChange={set('end_date')} /></Field>
        <Field label="Ngân sách kế hoạch (đ)"><input type="number" min={0} className="e-input" value={f.budget_plan} onChange={set('budget_plan')} /></Field>
        <Field label="Đã chi (đ)" hint="Nhập tay — chưa đồng bộ từ tài khoản quảng cáo"><input type="number" min={0} className="e-input" value={f.budget_actual} onChange={set('budget_actual')} /></Field>
        <Field label="KPI mục tiêu" className="sm:col-span-2"><input className="e-input" value={f.kpi_target} onChange={set('kpi_target')} placeholder="VD: 120 lead, CPL < 150k" /></Field>
        <Field label="Phụ trách" className="sm:col-span-2"><select className="e-input" value={f.owner_id} onChange={set('owner_id')}><option value="">—</option>{[...staffById.values()].filter(s => s.is_active !== false).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

// ================= CONTENT STUDIO =================
export default function ContentStudio({ ws, perm, myKinds, profile, staffById, focusContentId, campaignFilter, onClearCampaign }) {
  const [st, setSt] = useState({ loading: true });
  const [sel, setSel] = useState(focusContentId || null);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (focusContentId) setSel(focusContentId); }, [focusContentId]);
  const load = useCallback(async () => {
    try {
      const [contents, campaigns] = await Promise.all([mwApi.contents(), mwApi.campaigns([ws.id])]);
      setSt({ loading: false, contents: contents.filter(c => c.workspace_id === ws.id), campaigns });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('mw_contents', load);
  const list = useMemo(() => (st.contents || []).filter(c =>
    (!campaignFilter || c.campaign_id === campaignFilter) && (!fStatus || c.workflow_status === fStatus)
    && (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()))), [st.contents, campaignFilter, fStatus, q]);

  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={5} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const current = st.contents.find(c => c.id === sel);
  const campName = new Map(st.campaigns.map(c => [c.id, c.name]));
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
      <div className={`e-card p-3 space-y-2.5 ${current ? 'hidden lg:block' : ''}`}>
        <div className="flex gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Tìm nội dung…" className="flex-1" />
          {perm.edit && <button type="button" className="e-btn e-btn-primary" onClick={() => setCreating(true)} aria-label="Nội dung mới"><Plus /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Sel wrapClass="!min-w-[150px]" value={fStatus} onChange={e => setFStatus(e.target.value)} aria-label="Lọc trạng thái">
            <option value="">Mọi trạng thái</option>
            {Object.entries(CONTENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Sel>
          {campaignFilter && <button type="button" className="e-chip e-chip-active" onClick={onClearCampaign}>{campName.get(campaignFilter) || 'Chiến dịch'} ✕</button>}
        </div>
        {!list.length ? <EmptyState icon={Clapperboard} title="Chưa có nội dung" description={perm.edit ? 'Bấm + để tạo brief nội dung mới.' : undefined} /> : (
          <ul className="space-y-1 max-h-[70vh] overflow-y-auto -mx-1 px-1">
            {list.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => setSel(c.id)} aria-current={sel === c.id}
                  className={`w-full text-left p-2.5 rounded-xl border transition ${sel === c.id ? 'border-teal-400 bg-teal-50/60' : 'border-transparent hover:bg-slate-50'}`}>
                  <div className="flex items-start gap-2"><span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-800 leading-snug">{c.title}</span><Tone meta={CONTENT_STATUS[c.workflow_status]} /></div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">{CONTENT_TYPES[c.content_type]}{c.campaign_id ? ` · ${campName.get(c.campaign_id) || ''}` : ''}{c.medical_review_required ? ' · cần duyệt y khoa' : ''}{c.consent_required ? ' · cần consent' : ''}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={current ? '' : 'hidden lg:block'}>
        {current ? <ContentDetail key={current.id} c={current} ws={ws} perm={perm} myKinds={myKinds} profile={profile} staffById={staffById} campaigns={st.campaigns} onBack={() => setSel(null)} onChanged={load} />
          : <div className="e-card"><EmptyState icon={FileText} title="Chọn 1 nội dung" description="Kịch bản, tệp media, caption, duyệt, consent và xuất bản của nội dung hiện ở đây." /></div>}
      </div>
      <NewContentModal open={creating} ws={ws} campaigns={st.campaigns} defaultCampaign={campaignFilter} onClose={() => setCreating(false)} onCreated={(id) => { load(); setSel(id); }} />
    </div>
  );
}

function NewContentModal({ open, ws, campaigns, defaultCampaign, onClose, onCreated }) {
  const [f, setF] = useState(null);
  useEffect(() => { if (open) setF({ title: '', content_type: 'short_video', platforms: [], campaign_id: defaultCampaign || '', brief: '', medical_review_required: true, consent_required: false }); }, [open, defaultCampaign]);
  if (!open || !f) return null;
  const save = async () => {
    const r = await attempt(() => mwApi.createContent({ workspace_id: ws.id, title: f.title.trim(), content_type: f.content_type, platforms: f.platforms, campaign_id: f.campaign_id || null,
      brief: f.brief.trim() || null, medical_review_required: f.medical_review_required, consent_required: f.consent_required, workflow_status: 'brief' }), 'Đã tạo nội dung');
    if (r) { onClose(); onCreated(r.id); }
  };
  return (
    <Modal open onClose={onClose} title="Nội dung mới (brief)" size="max-w-2xl" footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton disabled={!f.title.trim()} onClick={save}>Tạo</BusyButton>
    </>}>
      <Field label="Tiêu đề" required><input autoFocus className="e-input" value={f.title} maxLength={300} onChange={e => setF(v => ({ ...v, title: e.target.value }))} placeholder="VD: 5 sự thật về gọt hàm" /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Loại"><select className="e-input" value={f.content_type} onChange={e => setF(v => ({ ...v, content_type: e.target.value }))}>{Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Chiến dịch"><select className="e-input" value={f.campaign_id} onChange={e => setF(v => ({ ...v, campaign_id: e.target.value }))}><option value="">—</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div><span className="e-label">Nền tảng</span><ChipToggle options={PLATFORMS} value={f.platforms} onChange={(v) => setF(x => ({ ...x, platforms: v }))} /></div>
      <Field label="Brief" hint="Mục đích, khán giả, hook, thông điệp chính, độ dài, CTA. KHÔNG ghi tên / SĐT / bệnh án khách hàng."><textarea className="e-textarea min-h-[120px]" value={f.brief} maxLength={20000} onChange={e => setF(v => ({ ...v, brief: e.target.value }))} /></Field>
      <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" className="e-checkbox mt-0.5" checked={f.medical_review_required} onChange={e => setF(v => ({ ...v, medical_review_required: e.target.checked }))} /> <span>Cần bác sĩ duyệt chuyên môn <span className="text-slate-400">(mặc định bật cho nội dung y khoa)</span></span></label>
      <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" className="e-checkbox mt-0.5" checked={f.consent_required} onChange={e => setF(v => ({ ...v, consent_required: e.target.checked }))} /> <span>Có hình ảnh / câu chuyện khách hàng → cần consent đã xác minh</span></label>
    </Modal>
  );
}

const DTABS = [
  { id: 'info', label: 'Thông tin' }, { id: 'versions', label: 'Phiên bản' }, { id: 'approval', label: 'Duyệt' },
  { id: 'consent', label: 'Consent' }, { id: 'publish', label: 'Xuất bản' },
];
function ContentDetail({ c, ws, perm, myKinds, profile, staffById, campaigns, onBack, onChanged }) {
  const [tab, setTab] = useState('info');
  const [st, setSt] = useState({ loading: true });
  const load = useCallback(async () => {
    try {
      const [versions, runs, consents, pubs] = await Promise.all([mwApi.versions([c.id]), mwApi.runs([c.id]), mwApi.consents([c.id]), mwApi.publications()]);
      const steps = await mwApi.steps(runs.map(r => r.id));
      setSt({ loading: false, versions, runs, steps, consents, pubs: pubs.filter(p => p.content_id === c.id) });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [c.id]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('mw_approval_steps,mw_publications', load);
  const after = () => { load(); onChanged(); };
  const latest = (k) => st.versions?.find(v => v.kind === k);   // đã sắp revision giảm dần
  const pendingRun = st.runs?.find(r => r.state === 'pending');
  const protectedStatus = !EDITABLE_STATUSES.includes(c.workflow_status);

  return (
    <div className="e-card">
      <div className="flex items-start gap-2 p-4 border-b border-slate-100">
        <button type="button" className="e-icon-btn w-9 h-9 lg:hidden" onClick={onBack} aria-label="Quay lại danh sách"><ChevronLeft className="w-4 h-4" /></button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-slate-900 leading-snug">{c.title}</h2>
          <div className="text-[12px] text-slate-400">{CONTENT_TYPES[c.content_type]} · tạo bởi {staffById.get(c.created_by)?.full_name || '—'} · cập nhật {fmtDateTime(c.updated_at)}</div>
        </div>
        <Tone meta={CONTENT_STATUS[c.workflow_status]} />
      </div>
      <div className="e-tabs px-2" role="tablist">
        {DTABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`e-tab ${tab === t.id ? 'e-tab-active' : ''}`}>{t.label}
          {t.id === 'publish' && st.pubs?.length > 0 && <span className="e-tab-count">{st.pubs.length}</span>}</button>)}
      </div>
      <div className="p-4">
        {st.loading ? <Skeleton rows={4} /> : st.error ? <ErrorState description={st.error.message} onRetry={load} /> : (
          <>
            {tab === 'info' && <InfoTab c={c} perm={perm} campaigns={campaigns} staffById={staffById} protectedStatus={protectedStatus} onDone={onChanged} />}
            {tab === 'versions' && <VersionsTab c={c} perm={perm} versions={st.versions} staffById={staffById} pendingRun={pendingRun} approved={c.workflow_status === 'approved'} onDone={after} />}
            {tab === 'approval' && <ApprovalTab c={c} perm={perm} runs={st.runs} steps={st.steps} versions={st.versions} staffById={staffById} latest={latest} onDone={after} />}
            {tab === 'consent' && <ConsentTab c={c} perm={perm} myKinds={myKinds} consents={st.consents} staffById={staffById} onDone={after} />}
            {tab === 'publish' && <PublishTab c={c} perm={perm} myKinds={myKinds} profile={profile} pubs={st.pubs} versions={st.versions} staffById={staffById} latest={latest} onDone={after} ws={ws} />}
          </>
        )}
      </div>
    </div>
  );
}

function InfoTab({ c, perm, campaigns, staffById, protectedStatus, onDone }) {
  const [f, setF] = useState(null);
  useEffect(() => { setF({ title: c.title, content_type: c.content_type, platforms: c.platforms, campaign_id: c.campaign_id || '', brief: c.brief || '', owner_id: c.owner_id || '',
    medical_review_required: c.medical_review_required, consent_required: c.consent_required, workflow_status: c.workflow_status }); }, [c]);
  if (!f) return null;
  const ro = !perm.edit;
  const save = async () => {
    const row = { title: f.title.trim(), content_type: f.content_type, platforms: f.platforms, campaign_id: f.campaign_id || null, brief: f.brief.trim() || null, owner_id: f.owner_id || null };
    if (!protectedStatus) Object.assign(row, { medical_review_required: f.medical_review_required, consent_required: f.consent_required, workflow_status: f.workflow_status });
    if (await attempt(() => mwApi.updateContent(c.id, row), 'Đã lưu')) onDone();
  };
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" required><input className="e-input" value={f.title} disabled={ro} maxLength={300} onChange={e => setF(v => ({ ...v, title: e.target.value }))} /></Field>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Loại"><select className="e-input" value={f.content_type} disabled={ro} onChange={e => setF(v => ({ ...v, content_type: e.target.value }))}>{Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Chiến dịch"><select className="e-input" value={f.campaign_id} disabled={ro} onChange={e => setF(v => ({ ...v, campaign_id: e.target.value }))}><option value="">—</option>{campaigns.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Bước sản xuất" hint={protectedStatus ? 'Đang trong quy trình duyệt / đăng — trạng thái do hệ thống đặt' : undefined}>
          <select className="e-input" value={f.workflow_status} disabled={ro || protectedStatus} onChange={e => setF(v => ({ ...v, workflow_status: e.target.value }))}>
            {(protectedStatus ? [c.workflow_status] : EDITABLE_STATUSES).map(s => <option key={s} value={s}>{CONTENT_STATUS[s].label}</option>)}
          </select>
        </Field>
      </div>
      <div><span className="e-label">Nền tảng</span><ChipToggle options={PLATFORMS} value={f.platforms} disabled={ro} onChange={(v) => setF(x => ({ ...x, platforms: v }))} /></div>
      <Field label="Phụ trách"><select className="e-input" value={f.owner_id} disabled={ro} onChange={e => setF(v => ({ ...v, owner_id: e.target.value }))}><option value="">—</option>{[...staffById.values()].filter(s => s.is_active !== false).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
      <Field label="Brief" hint="Không ghi tên / SĐT / bệnh án khách hàng."><textarea className="e-textarea min-h-[140px]" value={f.brief} disabled={ro} maxLength={20000} onChange={e => setF(v => ({ ...v, brief: e.target.value }))} /></Field>
      <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="e-checkbox" disabled={ro || protectedStatus} checked={f.medical_review_required} onChange={e => setF(v => ({ ...v, medical_review_required: e.target.checked }))} /> Cần bác sĩ duyệt chuyên môn</label>
      <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="e-checkbox" disabled={ro || protectedStatus} checked={f.consent_required} onChange={e => setF(v => ({ ...v, consent_required: e.target.checked }))} /> Cần consent khách hàng đã xác minh</label>
      {!ro && <BusyButton disabled={!f.title.trim()} onClick={save}>Lưu thông tin</BusyButton>}
    </div>
  );
}

function VersionsTab({ c, perm, versions, staffById, pendingRun, approved, onDone }) {
  const [kind, setKind] = useState('script');
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(null);
  const warn = pendingRun || approved;
  const addText = async () => {
    if (await attempt(() => mwApi.addVersion({ content_id: c.id, kind, body: body.trim(), note: note.trim() || null }), `Đã lưu ${VERSION_KIND[kind]} mới${warn ? ' — lượt duyệt trước đã mất hiệu lực' : ''}`)) { setBody(''); setNote(''); onDone(); }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1048576) { toast.error(`Tệp tối đa ${MAX_UPLOAD_MB} MB`); return; }
    if (!/^(image|video|audio)\//.test(file.type || '') && !ALLOWED_MIME.test(file.type || '')) { toast.error('Loại tệp không được phép'); return; }
    setProgress(0);
    try {
      const sha = await sha256OfFile(file);
      const url = await uploadViaPresignWithProgress(file, 'mw-content', setProgress);
      await mwApi.addVersion({ content_id: c.id, kind: 'asset', file_url: url, file_name: file.name.slice(0, 300), mime: file.type || null, sha256: sha, note: note.trim() || null });
      toast.success(`Đã lưu tệp mới (sha256 ${sha.slice(0, 10)}…)${warn ? ' — lượt duyệt trước đã mất hiệu lực' : ''}`);
      setNote(''); onDone();
    } catch (err) { toast.error(err.message); }
    setProgress(null);
  };
  return (
    <div className="space-y-4">
      {warn && <div className="e-alert e-alert-warning text-[13px]">Nội dung đang / đã được duyệt. Thêm phiên bản mới sẽ <b>huỷ hiệu lực lượt duyệt</b> và <b>khoá các lịch đăng</b> — cần gửi duyệt lại.</div>}
      {perm.edit && (
        <div className="rounded-2xl border border-slate-200 p-3 space-y-2.5">
          <div className="e-seg">{Object.entries(VERSION_KIND).map(([k, v]) => <button key={k} type="button" className={`e-seg-item ${kind === k ? 'e-seg-active' : ''}`} onClick={() => setKind(k)}>{v}</button>)}</div>
          {kind === 'asset' ? (
            <div className="space-y-2">
              <label className={`e-btn e-btn-secondary cursor-pointer ${progress != null ? 'pointer-events-none opacity-60' : ''}`}><Upload /> Chọn tệp video / ảnh<input type="file" className="sr-only" accept="image/*,video/*,audio/*,application/pdf" onChange={upload} disabled={progress != null} /></label>
              {progress != null && <div className="flex items-center gap-2 text-[12.5px] text-slate-500" role="status"><Spinner /> Đang tính sha256 & tải lên {progress}%<div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-500" style={{ width: `${progress}%` }} /></div></div>}
              <p className="text-[12px] text-slate-400">Tệp được băm sha256 trong trình duyệt; người duyệt duyệt đúng tệp này. Không tải ảnh / video bệnh nhân khi chưa có consent.</p>
            </div>
          ) : (
            <textarea className="e-textarea min-h-[140px]" value={body} maxLength={50000} onChange={e => setBody(e.target.value)}
              placeholder={kind === 'script' ? 'Kịch bản: hook, thân bài, shot list, CTA…' : 'Caption đăng bài…'} />
          )}
          <input className="e-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thay đổi (tuỳ chọn)" maxLength={500} />
          {kind !== 'asset' && <BusyButton disabled={!body.trim()} onClick={addText}><Plus /> Lưu {VERSION_KIND[kind]} v{(versions.find(v => v.kind === kind)?.revision || 0) + 1}</BusyButton>}
        </div>
      )}
      {['script', 'asset', 'caption'].map(k => {
        const vs = versions.filter(v => v.kind === k);
        return (
          <section key={k}>
            <h3 className="text-[13.5px] font-bold text-slate-700 mb-1.5">{VERSION_KIND[k]} <span className="text-slate-400 font-medium">· {vs.length} phiên bản</span></h3>
            {!vs.length ? <p className="text-[12.5px] text-slate-400">Chưa có.</p> : (
              <ul className="space-y-2">
                {vs.map((v, i) => (
                  <li key={v.id} className={`rounded-xl border p-3 ${i === 0 ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 mb-1"><b className="text-slate-800">v{v.revision}</b>{i === 0 && <span className="e-badge e-badge-sm e-tone-brand">Mới nhất</span>}<span>{staffById.get(v.author_id)?.full_name} · {fmtDateTime(v.created_at)}</span></div>
                    {v.kind === 'asset' ? <AssetPreview v={v} /> : <details open={i === 0}><summary className="text-[12px] text-slate-400 cursor-pointer">Nội dung</summary><p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-1">{v.body}</p></details>}
                    {v.note && <div className="text-[12px] text-slate-500 mt-1">Ghi chú: {v.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function AssetPreview({ v }) {
  return (
    <div className="space-y-1">
      {/^video\//.test(v.mime || '') ? <video src={v.file_url} controls preload="metadata" className="w-full max-h-[320px] rounded-lg bg-black" />
        : /^image\//.test(v.mime || '') ? <img src={v.file_url} alt={v.file_name || ''} className="max-h-[320px] rounded-lg" loading="lazy" /> : null}
      <a href={v.file_url} target="_blank" rel="noreferrer noopener" className="text-[12.5px] text-teal-700 hover:underline break-all">{v.file_name || v.file_url}</a>
      <div className="text-[11px] font-mono text-slate-400 break-all">sha256 {v.sha256}</div>
    </div>
  );
}

export function StepsTimeline({ steps, staffById }) {
  return (
    <ol className="space-y-1.5">
      {steps.map(s => (
        <li key={s.id} className="flex items-start gap-2 text-[12.5px]">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 grid place-items-center text-[11px] font-bold shrink-0">{s.seq}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><b className="text-slate-700">{STEP_KIND[s.kind]}</b><Tone meta={STEP_STATE[s.state]} /></div>
            {s.acted_by && <div className="text-slate-400">{staffById.get(s.acted_by)?.full_name} · {fmtDateTime(s.acted_at)}</div>}
            {s.note && <div className="text-slate-600">“{s.note}”</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ApprovalTab({ c, perm, runs, steps, versions, staffById, latest, onDone }) {
  const rev = (id) => versions.find(v => v.id === id);
  const hasCaption = !!latest('caption');
  const hasMain = !!latest('script') || !!latest('asset');
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 p-3 text-[13px] space-y-2">
        <div>Quy trình: {c.medical_review_required ? 'Bác sĩ (chuyên môn) → ' : ''}Marketing / thương hiệu → Pháp lý & consent{c.consent_required ? ' (bắt buộc consent đã xác minh)' : ''}.</div>
        <div className="text-slate-500">Gửi duyệt sẽ khoá đúng phiên bản mới nhất: kịch bản {latest('script') ? `v${latest('script').revision}` : '—'}, tệp {latest('asset') ? `v${latest('asset').revision}` : '—'}, caption {latest('caption') ? `v${latest('caption').revision}` : '—'}.</div>
        {perm.edit && (
          <BusyButton disabled={!hasCaption || !hasMain} title={!hasMain ? 'Cần kịch bản hoặc tệp media' : !hasCaption ? 'Cần caption' : undefined}
            onClick={async () => { if (await attempt(() => mwApi.submitApproval(c.id), 'Đã gửi duyệt — người duyệt bước đầu nhận thông báo')) onDone(); }}><Send /> Gửi duyệt phiên bản hiện tại</BusyButton>
        )}
        {(!hasCaption || !hasMain) && <div className="text-[12px] text-warning-600">Cần ít nhất 1 kịch bản hoặc tệp media, và 1 caption.</div>}
      </div>
      {!runs.length ? <p className="text-[13px] text-slate-400">Chưa gửi duyệt lần nào.</p> : runs.map(r => (
        <section key={r.id} className="rounded-2xl border border-slate-100 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]"><Tone meta={RUN_STATE[r.state]} /><span className="text-slate-500">Gửi {fmtDateTime(r.created_at)} bởi {staffById.get(r.requested_by)?.full_name || '—'}</span>
            {r.close_reason && <span className="text-slate-500">· {r.close_reason}</span>}</div>
          <div className="text-[12px] text-slate-500">Snapshot: kịch bản {rev(r.script_version_id) ? `v${rev(r.script_version_id).revision}` : '—'} · tệp {rev(r.asset_version_id) ? `v${rev(r.asset_version_id).revision}` : '—'} · caption {rev(r.caption_version_id) ? `v${rev(r.caption_version_id).revision}` : '—'} · <span className="font-mono">{r.snapshot_hash.slice(0, 12)}…</span></div>
          <StepsTimeline steps={steps.filter(s => s.run_id === r.id)} staffById={staffById} />
        </section>
      ))}
    </div>
  );
}

function ConsentTab({ c, perm, myKinds, consents, staffById, onDone }) {
  const [f, setF] = useState({ consent_ref: '', scope: '', valid_until: '' });
  const today = vnToday();
  const ok = (x) => x.verified_at && !x.revoked_at && (!x.valid_until || x.valid_until >= today);
  return (
    <div className="space-y-4">
      <div className={`e-alert ${c.consent_required ? (consents.some(ok) ? 'e-alert-success' : 'e-alert-warning') : 'e-alert-info'} text-[13px]`}>
        {c.consent_required ? (consents.some(ok) ? 'Đã có consent hợp lệ (đã xác minh, còn hạn, chưa thu hồi).' : 'Nội dung CẦN consent hợp lệ — bước Pháp lý & consent và lịch đăng sẽ bị chặn cho tới khi có.') : 'Nội dung không đánh dấu cần consent.'}
      </div>
      {perm.edit && (
        <div className="rounded-2xl border border-slate-200 p-3 space-y-2.5">
          <div className="grid sm:grid-cols-3 gap-2">
            <Field label="Mã hồ sơ consent" required hint="Chỉ ghi MÃ (VD: CS-2026-0412) — không ghi tên / SĐT / bệnh án"><input className="e-input" value={f.consent_ref} maxLength={200} onChange={e => setF(v => ({ ...v, consent_ref: e.target.value }))} /></Field>
            <Field label="Phạm vi đồng ý" required><input className="e-input" value={f.scope} maxLength={500} onChange={e => setF(v => ({ ...v, scope: e.target.value }))} placeholder="VD: ảnh trước/sau, che mắt, FB + TikTok" /></Field>
            <Field label="Hiệu lực đến"><input type="date" className="e-input" value={f.valid_until} min={today} onChange={e => setF(v => ({ ...v, valid_until: e.target.value }))} /></Field>
          </div>
          <BusyButton disabled={!f.consent_ref.trim() || !f.scope.trim()} onClick={async () => {
            if (await attempt(() => mwApi.addConsent({ content_id: c.id, consent_ref: f.consent_ref.trim(), scope: f.scope.trim(), valid_until: f.valid_until || null }), 'Đã thêm — chờ Pháp lý & consent xác minh')) { setF({ consent_ref: '', scope: '', valid_until: '' }); onDone(); }
          }}><Plus /> Thêm consent</BusyButton>
        </div>
      )}
      {!consents.length ? <p className="text-[13px] text-slate-400">Chưa có hồ sơ consent.</p> : (
        <ul className="space-y-2">
          {consents.map(x => (
            <li key={x.id} className="rounded-xl border border-slate-100 p-3 text-[13px] space-y-1">
              <div className="flex flex-wrap items-center gap-2"><b className="font-mono">{x.consent_ref}</b>
                {x.revoked_at ? <span className="e-badge e-badge-sm e-tone-danger">Đã thu hồi</span> : x.verified_at ? (ok(x) ? <span className="e-badge e-badge-sm e-tone-success">Hợp lệ</span> : <span className="e-badge e-badge-sm e-tone-warning">Hết hạn</span>) : <span className="e-badge e-badge-sm e-tone-neutral">Chờ xác minh</span>}</div>
              <div className="text-slate-600">Phạm vi: {x.scope}{x.valid_until ? ` · đến ${fmtDate(`${x.valid_until}T05:00:00Z`)}` : ' · không thời hạn'}</div>
              <div className="text-[11.5px] text-slate-400">Thêm bởi {staffById.get(x.created_by)?.full_name || '—'}{x.verified_by ? ` · xác minh: ${staffById.get(x.verified_by)?.full_name} ${fmtDateTime(x.verified_at)}` : ''}{x.revoked_at ? ` · thu hồi ${fmtDateTime(x.revoked_at)}` : ''}</div>
              <div className="flex gap-2 pt-1">
                {!x.verified_at && !x.revoked_at && myKinds.has('compliance') && <BusyButton className="e-btn e-btn-success e-btn-sm" onClick={async () => { if (await attempt(() => mwApi.verifyConsent(x.id), 'Đã xác minh consent')) onDone(); }}><BadgeCheck /> Xác minh</BusyButton>}
                {!x.revoked_at && (perm.manage || myKinds.has('compliance')) && <BusyButton className="e-btn e-btn-danger-soft e-btn-sm" onClick={async () => { if (await attempt(() => mwApi.revokeConsent(x.id), 'Đã thu hồi — các lịch đăng liên quan bị khoá')) onDone(); }}><Ban /> Thu hồi</BusyButton>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PublishTab({ c, perm, myKinds, profile, pubs, versions, staffById, latest, onDone }) {
  const [platform, setPlatform] = useState(c.platforms[0] || 'facebook');
  const cap = latest('caption');
  const asset = latest('asset');
  const canPublish = perm.manage || myKinds.has('publisher');
  return (
    <div className="space-y-3">
      {perm.edit && (
        <div className="rounded-2xl border border-slate-200 p-3 flex flex-wrap items-end gap-2">
          <Field label="Nền tảng"><select className="e-input" value={platform} onChange={e => setPlatform(e.target.value)}>{Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <BusyButton disabled={!cap} title={!cap ? 'Cần caption' : undefined} onClick={async () => {
            if (await attempt(() => mwApi.createPublication({ content_id: c.id, platform, caption_version_id: cap.id, asset_version_id: asset?.id || null }), 'Đã tạo bài đăng nháp')) onDone();
          }}><Plus /> Thêm bài đăng (caption v{cap?.revision || '—'}{asset ? `, tệp v${asset.revision}` : ''})</BusyButton>
          <p className="w-full text-[12px] text-slate-400">Bài đăng gắn đúng caption / tệp mới nhất. Lên lịch chỉ được khi nội dung đã duyệt đủ bước với chính phiên bản này.</p>
        </div>
      )}
      {!pubs.length ? <p className="text-[13px] text-slate-400">Chưa có bài đăng.</p> : (
        <div className="grid gap-2 md:grid-cols-2">
          {pubs.map(p => <PublicationCard key={p.id} p={p} content={c} versions={versions} canPublish={canPublish} canEdit={perm.edit} profile={profile} staffById={staffById} onDone={onDone} />)}
        </div>
      )}
      <p className="text-[12px] text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Không có kết nối API mạng xã hội — chỉ đăng thủ công có bằng chứng.</p>
    </div>
  );
}
