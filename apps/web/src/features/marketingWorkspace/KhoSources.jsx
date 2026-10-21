// ============================================================
// MARKETING WORKSPACE — GẮN SOURCE KHO MEDIA + KỊCH BẢN ORDER THEO CẢNH
// - Chọn source từ Kho Media (media_customers / media_assets) — chỉ lưu LIÊN KẾT (mw_task_sources).
// - Gợi ý thông minh: đúng dịch vụ (đoán từ tiêu đề + nhãn thẻ), tồn lâu chưa dựng, từng ra clip Win / CPA tốt,
//   cảnh báo đang được thẻ khác dùng. Mỗi gợi ý ghi rõ lý do.
// - Kịch bản order: từng cảnh (Hook / Trước / Sau / CTA…) trỏ đúng source + đoạn cắt mm:ss.
// - Thẻ vào cột có cài "cập nhật Kho" -> database tự đổi trạng thái source bên Kho (chỉ tiến).
// Quyền: chỉ người xem được Kho Media (Media / Editor / Marketing / Admin) — database kiểm tra (mw_can_use_kho).
// KHÔNG đọc tên / SĐT khách: chỉ mã source, dịch vụ, ngày quay, loại, trạng thái.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FolderOpen, Sparkles, Plus, Trash2, ChevronUp, ChevronDown, Film, Image as ImageIcon, EyeOff, Trophy, AlertTriangle,
  Clapperboard, ExternalLink, Check,
} from 'lucide-react';
import { SearchInput } from '@/components/ds';
import { mwApi, isMissingSchema } from './mwApi';
import { fmtDate } from './mwMeta';
import { Modal, Skeleton, attempt, BusyButton, Spinner } from './mwUi';

export const KHO_STATUS = {
  chua_dung: { label: 'Chưa dựng', tone: 'e-tone-neutral' },
  dang_dung: { label: 'Đang dựng', tone: 'e-tone-warning' },
  da_dung: { label: 'Đã dựng', tone: 'e-tone-success' },
  loi: { label: 'Source lỗi', tone: 'e-tone-danger' },
  can_bo_sung: { label: 'Cần bổ sung', tone: 'e-tone-peach' },
};
export const KHO_LIST_STATUS = { none: 'Không đổi', dang_dung: 'Đang dựng', da_dung: 'Đã dựng' };
const SERVICES = ['Hàm mặt', 'Body', 'Tiểu phẫu'];
const noDia = (s) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
// Từ khoá -> nhóm dịch vụ (giống cách Kho Media đoán dịch vụ từ tên thư mục)
const SERVICE_KEYWORDS = {
  'Hàm mặt': ['ham mat', 'xuong ham', 'got ham', 'ha go', 'go ma', 'ha ham', 'don cam', 'truot cam', 'vline', 'v-line', 'v line', 'midface', 'ham ho', 'mom', 'cam lem'],
  Body: ['body', 'nang nguc', 'nguc', 'nang mong', 'mong', 'hut mo', 'cay mo', 'thanh bung', 'tao hinh bung', 'eo'],
  'Tiểu phẫu': ['tieu phau', 'cat mi', 'mi mat', 'nang mui', 'sua mui', 'mui', 'moi', 'tham my mat'],
};
export function detectServices(text) {
  const t = ` ${noDia(text)} `;
  return new Set(Object.entries(SERVICE_KEYWORDS).filter(([, ks]) => ks.some(k => t.includes(` ${k} `) || t.includes(` ${k}`))).map(([s]) => s));
}
export const driveThumb = (a) => (a?.drive_id ? `https://drive.google.com/thumbnail?id=${a.drive_id}&sz=w400` : a?.thumb_link || null);
const fmtDur = (ms) => { if (!ms) return ''; const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
const daysSince = (d) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : null);

// Hiệu quả clip của 1 source (từ Video Ads)
export function clipStats(clips) {
  const wins = clips.filter(c => c.win).length;
  const cpas = clips.filter(c => Number(c.fb_purchases) > 0).map(c => Number(c.fb_spend) / Number(c.fb_purchases));
  return { count: clips.length, wins, bestCpa: cpas.length ? Math.min(...cpas) : null, spend: clips.reduce((a, c) => a + (Number(c.fb_spend) || 0), 0) };
}

// Chấm điểm gợi ý + lý do
export function scoreSource(s, { services, usageBy, clipsBy, taskId }) {
  const reasons = [];
  let score = 0;
  if (services.size && SERVICES.some(sv => services.has(sv) && (s.service || '').includes(sv))) { score += 40; reasons.push({ t: `Đúng dịch vụ ${s.service}`, good: true }); }
  const st = s.source_status || 'chua_dung';
  if (st === 'chua_dung') {
    const idle = daysSince(s.shoot_date || s.created_at) ?? 0;
    score += Math.min(idle, 60) / 2 + 5;
    reasons.push({ t: idle >= 7 ? `Tồn ${idle} ngày chưa dựng` : 'Chưa dựng', good: idle >= 7 });
  } else if (st === 'da_dung') { score -= 10; reasons.push({ t: 'Đã dựng — làm góc mới' }); } else if (st === 'dang_dung') { score -= 5; reasons.push({ t: 'Đang dựng' }); } else { score -= 15; reasons.push({ t: KHO_STATUS[st]?.label || st, bad: true }); }
  const cs = clipStats(clipsBy.get(s.id) || []);
  if (cs.wins) { score += 15; reasons.push({ t: `${cs.wins} clip Win`, good: true }); }
  if (cs.bestCpa != null && cs.bestCpa < 800000) { score += 10; reasons.push({ t: `CPA tốt nhất ${money(cs.bestCpa)}`, good: true }); }
  const used = (usageBy.get(s.id) || []).filter(t => t !== taskId).length;
  if (used) { score -= 20; reasons.push({ t: `Đang dùng ở ${used} thẻ khác`, bad: true }); }
  if (s.hide_face) reasons.push({ t: 'Phải che mặt', bad: true });
  return { score, reasons, used, cs };
}

// Ai được dùng Kho trong Marketing Workspace (DB quyết định)
export function useKhoAccess() {
  const [ok, setOk] = useState(null);
  useEffect(() => { let alive = true; mwApi.canUseKho().then(v => { if (alive) setOk(v); }); return () => { alive = false; }; }, []);
  return ok;
}

const StatusTone = ({ s }) => { const m = KHO_STATUS[s || 'chua_dung'] || { label: s, tone: 'e-tone-neutral' }; return <span className={`e-badge e-badge-sm ${m.tone}`}>{m.label}</span>; };
const Reason = ({ r }) => <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${r.good ? 'bg-success-50 text-success-700' : r.bad ? 'bg-danger-50 text-danger-700' : 'bg-slate-100 text-slate-600'}`}>{r.t}</span>;

// ---------- Hộp chọn source ----------
// context: { taskId, text (tiêu đề + nhãn) }; already: Set media_customer_id đã gắn; onPick(picks) -> picks [{ customerId, assetId, code }]
export function KhoSourcePicker({ open, onClose, context, already = new Set(), onPick }) {
  const [st, setSt] = useState({ loading: true });
  const [q, setQ] = useState('');
  const [svc, setSvc] = useState('');
  const [autoSvc, setAutoSvc] = useState(false);   // dịch vụ do hệ thống tự chọn theo nội dung thẻ -> bỏ khi người dùng gõ tìm
  const [status, setStatus] = useState('');
  const [shown, setShown] = useState(24);
  const [assets, setAssets] = useState(new Map());     // customerId -> assets[]
  const [expanded, setExpanded] = useState(null);
  const [picks, setPicks] = useState([]);              // [{ customerId, assetId|null, code }]

  useEffect(() => {
    if (!open) return;
    setPicks([]); setExpanded(null); setQ(''); setStatus(''); setShown(24);
    let alive = true;
    (async () => {
      try {
        const [sources, usage, clips] = await Promise.all([mwApi.khoSources(), mwApi.sourceUsage().catch(() => []), mwApi.khoClips(null).catch(() => [])]);
        if (!alive) return;
        const usageBy = new Map();
        usage.forEach(u => { if (!usageBy.has(u.media_customer_id)) usageBy.set(u.media_customer_id, []); usageBy.get(u.media_customer_id).push(u.task_id); });
        const clipsBy = new Map();
        clips.forEach(c => { if (!clipsBy.has(c.media_customer_id)) clipsBy.set(c.media_customer_id, []); clipsBy.get(c.media_customer_id).push(c); });
        setSt({ loading: false, sources, usageBy, clipsBy });
        const svcs = detectServices(context?.text || '');
        setSvc(svcs.size === 1 ? [...svcs][0] : ''); setAutoSvc(svcs.size === 1);
      } catch (e) { if (alive) setSt({ loading: false, error: e }); }
    })();
    return () => { alive = false; };
  }, [open, context?.text]);

  // Tìm thêm trên server (nguồn cũ ngoài 600 nguồn gần nhất, tên khách)
  const [found, setFound] = useState([]);
  useEffect(() => {
    const t = q.trim();
    if (!open || t.length < 2) { setFound([]); return undefined; }
    let alive = true;
    const h = setTimeout(() => { mwApi.khoSearch(t).then(r => { if (alive) setFound(r); }).catch(() => {}); }, 300);
    return () => { alive = false; clearTimeout(h); };
  }, [q, open]);
  const allSources = useMemo(() => {
    const base = st.sources || [];
    const ids = new Set(base.map(s => s.id));
    return [...base, ...found.filter(s => !ids.has(s.id))];
  }, [st.sources, found]);
  const services = useMemo(() => detectServices(context?.text || ''), [context?.text]);
  const scored = useMemo(() => allSources.map(s => ({ s, ...scoreSource(s, { services, usageBy: st.usageBy, clipsBy: st.clipsBy, taskId: context?.taskId }) })), [allSources, st.usageBy, st.clipsBy, services, context?.taskId]);
  const suggestions = useMemo(() => scored.filter(x => !x.s.no_image && !already.has(x.s.id)).sort((a, b) => b.score - a.score).slice(0, 6), [scored, already]);
  const filtered = useMemo(() => {
    const t = noDia(q.trim());
    const serverHit = new Set(found.map(s => s.id));
    return scored.filter(({ s }) =>
      (!svc || (s.service || '').includes(svc)) && (!status || (s.source_status || 'chua_dung') === status)
      && (!t || serverHit.has(s.id) || noDia([s.source_id, s.service, s.source_type, ...(s.tags || []),
        s.shoot_date && fmtDate(`${s.shoot_date}T05:00:00Z`), s.shoot_date].filter(Boolean).join(' ')).includes(t)))
      .sort((a, b) => b.score - a.score);
  }, [scored, svc, status, q, found]);
  const visible = filtered.slice(0, shown);

  // ảnh thu nhỏ: tải file của các source đang hiện (theo lô nhỏ)
  const needIds = useMemo(() => [...new Set([...suggestions.map(x => x.s.id), ...visible.map(x => x.s.id), expanded].filter(id => id && !assets.has(id)))], [suggestions, visible, expanded, assets]);
  useEffect(() => {
    if (!open || !needIds.length) return;
    let alive = true;
    mwApi.khoAssets(needIds.slice(0, 40)).then(rows => {
      if (!alive) return;
      setAssets(prev => { const m = new Map(prev); needIds.slice(0, 40).forEach(id => m.set(id, [])); rows.forEach(r => m.get(r.media_customer_id)?.push(r)); return m; });
    }).catch(() => {});
    return () => { alive = false; };
  }, [open, needIds]);

  const isPicked = (cid, aid = null) => picks.some(p => p.customerId === cid && p.assetId === aid);
  const toggle = (s, aid = null) => {
    if (s.no_image) return;
    setPicks(p => (isPicked(s.id, aid) ? p.filter(x => !(x.customerId === s.id && x.assetId === aid)) : [...p, { customerId: s.id, assetId: aid, code: s.source_id }]));
  };

  const SourceRow = ({ x, compact }) => {
    const { s, reasons, cs } = x;
    const files = assets.get(s.id) || [];
    const thumb = driveThumb(files.find(f => f.kind === 'image' || f.kind === 'video'));
    const disabled = s.no_image || already.has(s.id);
    return (
      <div className={`rounded-xl border p-2.5 ${isPicked(s.id) ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200'} ${disabled ? 'opacity-60' : ''}`}>
        <div className="flex gap-2.5">
          <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 grid place-items-center">
            {thumb ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <FolderOpen className="w-5 h-5 text-slate-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <b className="text-[13px] text-slate-800 font-mono">{s.source_id || 'Chưa có mã'}</b>
              <StatusTone s={s.source_status} />
              {s.hide_face && <span className="e-badge e-badge-sm e-tone-warning"><EyeOff className="w-3 h-3" /> Che mặt</span>}
              {s.no_image && <span className="e-badge e-badge-sm e-tone-danger">Không được dùng hình</span>}
            </div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">{[s.service, s.source_type, s.shoot_date && `quay ${fmtDate(`${s.shoot_date}T05:00:00Z`)}`, `${s.source_video_count || 0} video · ${s.source_image_count || 0} ảnh`].filter(Boolean).join(' · ')}</div>
            {!compact && cs.count > 0 && <div className="text-[11.5px] text-slate-500"><Trophy className="w-3 h-3 inline -mt-0.5" /> {cs.count} clip{cs.wins ? ` · ${cs.wins} Win` : ''}{cs.bestCpa != null ? ` · CPA tốt nhất ${money(cs.bestCpa)}` : ''}</div>}
            <div className="flex flex-wrap gap-1 mt-1">{reasons.slice(0, 4).map((r, i) => <Reason key={i} r={r} />)}</div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {already.has(s.id) ? <span className="text-[11.5px] text-teal-700 font-semibold">Đã gắn</span> : (
              <button type="button" disabled={s.no_image} onClick={() => toggle(s)} aria-pressed={isPicked(s.id)}
                className={`e-btn e-btn-sm ${isPicked(s.id) ? 'e-btn-primary' : 'e-btn-secondary'}`}>{isPicked(s.id) ? <><Check /> Cả nguồn</> : 'Cả nguồn'}</button>
            )}
            {!s.no_image && <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>{expanded === s.id ? 'Ẩn file' : 'Chọn file'}</button>}
          </div>
        </div>
        {expanded === s.id && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
            {!assets.has(s.id) && <div className="col-span-full"><Spinner /></div>}
            {assets.has(s.id) && files.length === 0 && <div className="col-span-full text-[12px] text-slate-400">Chưa quét file của nguồn này (Kho Media › Quét file).</div>}
            {files.map(f => (
              <button key={f.id} type="button" onClick={() => toggle(s, f.id)} aria-pressed={isPicked(s.id, f.id)} title={f.name}
                className={`relative rounded-lg overflow-hidden border-2 text-left ${isPicked(s.id, f.id) ? 'border-teal-500' : 'border-transparent'}`}>
                <div className="aspect-square bg-slate-100">{driveThumb(f) && <img src={driveThumb(f)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}</div>
                <div className="absolute top-1 left-1 text-[10px] px-1 rounded bg-black/60 text-white">{f.kind === 'video' ? <><Film className="w-3 h-3 inline" /> {fmtDur(f.duration_ms)}</> : <ImageIcon className="w-3 h-3 inline" />}</div>
                {isPicked(s.id, f.id) && <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-teal-500 text-white grid place-items-center"><Check className="w-3 h-3" /></div>}
                <div className="text-[10.5px] text-slate-600 truncate px-1 py-0.5">{f.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="Gắn source từ Kho Media" size="max-w-3xl"
      desc="Chỉ lưu liên kết tới Kho Media. Nguồn “không được dùng hình” không gắn được; nguồn “che mặt” sẽ hiện cảnh báo trong kịch bản."
      footer={<>
        <span className="text-[12.5px] text-slate-500 mr-auto">{picks.length ? `Đã chọn ${picks.length} mục` : 'Chọn cả nguồn hoặc từng file'}</span>
        <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
        <BusyButton disabled={!picks.length} onClick={async () => { await onPick(picks); onClose(); }}><Plus /> Gắn vào thẻ</BusyButton>
      </>}>
      {st.loading ? <Skeleton rows={4} />
        : st.error ? <div className="e-alert e-alert-danger text-[13px]">{isMissingSchema(st.error) ? 'Chưa cài phần gắn source — Admin chạy supabase/marketing_workspace_v2_sources.sql.' : st.error.message}</div>
          : (
            <div className="space-y-4">
              <div className="sticky -top-4 z-10 -mx-1 px-1 pt-1 pb-2 bg-white space-y-2 border-b border-slate-100">
                <SearchInput value={q} onChange={(v) => { setQ(v); if (v.trim() && autoSvc) { setSvc(''); setAutoSvc(false); } }} placeholder="Tìm mã source, tên khách, dịch vụ, ngày quay (30/07), nhãn…" className="w-full" />
                <div className="flex flex-wrap items-center gap-1.5">
                  {SERVICES.map(sv => <button key={sv} type="button" className={`e-chip ${svc === sv ? 'e-chip-active' : ''}`} onClick={() => { setSvc(svc === sv ? '' : sv); setAutoSvc(false); }}>{sv}</button>)}
                  <select className="e-input h-9 w-auto text-[13px]" value={status} onChange={e => setStatus(e.target.value)} aria-label="Lọc trạng thái Kho">
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(KHO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {!q.trim() && suggestions.length > 0 && (
                <section>
                  <h3 className="text-[13.5px] font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> Gợi ý cho thẻ này{services.size ? ` · ${[...services].join(', ')}` : ''}</h3>
                  <div className="grid gap-2">{suggestions.map(x => <SourceRow key={`sg-${x.s.id}`} x={x} compact />)}</div>
                </section>
              )}
              <section className="space-y-2">
                <div className="text-[12px] text-slate-400">{q.trim() ? `${filtered.length} kết quả cho “${q.trim()}”` : `${filtered.length} nguồn`} · xếp theo mức phù hợp</div>
                {q.trim() && !filtered.length && <p className="text-[13px] text-slate-500">Không thấy source nào. Thử mã khác, tên khách hoặc bỏ bớt bộ lọc.</p>}
                <div className="grid gap-2">{visible.map(x => <SourceRow key={x.s.id} x={x} />)}</div>
                {filtered.length > shown && <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={() => setShown(n => n + 24)}>Xem thêm</button>}
              </section>
            </div>
          )}
    </Modal>
  );
}

// ---------- Mẫu kịch bản order ----------
const SCENE_TEMPLATES = {
  hoi_dap: { label: 'Hỏi – đáp', rows: [['Hook 3s', 'Câu hỏi khách hay hỏi'], ['Bác sĩ giải đáp', ''], ['Hình ảnh minh hoạ', ''], ['Kết quả khách', ''], ['CTA', 'Đặt lịch tư vấn']] },
  truoc_sau: { label: 'Trước – sau', rows: [['Hook kết quả', ''], ['Trước', ''], ['Quá trình', ''], ['Sau', ''], ['CTA', 'Đặt lịch tư vấn']] },
  hanh_trinh: { label: 'Hành trình', rows: [['Hook', ''], ['Tư vấn', ''], ['Ngày mổ', ''], ['Hậu phẫu', ''], ['Kết quả', ''], ['Feedback', ''], ['CTA', '']] },
  feedback: { label: 'Feedback', rows: [['Hook câu nói của khách', ''], ['Feedback', ''], ['Trước – sau', ''], ['CTA', '']] },
};
const TIME_RE = /^[0-9]{1,2}:[0-5][0-9](:[0-5][0-9])?$/;

// ---------- Panel trong thẻ: source đã gắn + kịch bản order ----------
export function TaskSourcesPanel({ task, ws, perm, labelNames = [], onChanged, onOpenContent }) {
  const kho = useKhoAccess();
  const [st, setSt] = useState({ loading: true });
  const [picker, setPicker] = useState(false);
  const load = useCallback(async () => {
    try {
      const scenes = await mwApi.scenes(task.id);
      let links = []; let sources = []; let assets = []; let clips = [];
      if (kho) {
        links = await mwApi.taskSources([task.id]);
        const ids = [...new Set(links.map(l => l.media_customer_id))];
        [sources, assets, clips] = await Promise.all([mwApi.khoSourcesByIds(ids), mwApi.khoAssets(ids), mwApi.khoClips(ids).catch(() => [])]);
      }
      setSt({ loading: false, scenes, links, sources: new Map(sources.map(s => [s.id, s])), assets: new Map(assets.map(a => [a.id, a])), assetsBy: assets, clips });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [task.id, kho]);
  useEffect(() => { if (kho !== null) load(); }, [load, kho]);

  if (kho === null || st.loading) return <Skeleton rows={3} />;
  if (st.error) return <div className="e-alert e-alert-danger text-[13px]">{isMissingSchema(st.error) ? 'Chưa cài phần gắn source / kịch bản order — Admin chạy supabase/marketing_workspace_v2_sources.sql trong SQL Editor.' : st.error.message}</div>;
  const canEditSrc = perm.edit && kho;
  const already = new Set(st.links.map(l => l.media_customer_id));
  const linkLabel = (l) => {
    const s = st.sources.get(l.media_customer_id);
    const a = l.media_asset_id ? st.assets.get(l.media_asset_id) : null;
    return `${s?.source_id || 'Nguồn'}${a ? ` · ${a.name}` : ' · cả nguồn'}`;
  };
  const hideFace = st.links.some(l => st.sources.get(l.media_customer_id)?.hide_face);
  const stats = clipStats(st.clips || []);

  const pick = async (picks) => {
    let n = 0;
    for (const p of picks) { if (await attempt(() => mwApi.addTaskSource(task.id, p.customerId, p.assetId))) n += 1; }
    if (n) toast.success(`Đã gắn ${n} source`);
    load(); onChanged?.();
  };
  const addScenes = async (rows) => {
    const base = (st.scenes.at(-1)?.sort_index ? Number(st.scenes.at(-1).sort_index) : 0);
    for (let i = 0; i < rows.length; i += 1) {
      await attempt(() => mwApi.addScene({ task_id: task.id, sort_index: base + (i + 1) * 1024, scene: rows[i][0], content: rows[i][1] || null }));
    }
    load();
  };
  const move = async (i, dir) => {
    const a = st.scenes[i]; const b = st.scenes[i + dir];
    if (!a || !b) return;
    await attempt(() => mwApi.updateScene(a.id, { sort_index: b.sort_index }));
    await attempt(() => mwApi.updateScene(b.id, { sort_index: a.sort_index }));
    load();
  };
  const scriptText = () => st.scenes.map((sc, i) => {
    const l = st.links.find(x => x.id === sc.source_ref);
    return `${i + 1}. [${sc.scene || 'Cảnh'}] ${sc.content || ''}${l ? `\n   Source: ${linkLabel(l)}${sc.clip_from ? ` (${sc.clip_from}${sc.clip_to ? `–${sc.clip_to}` : ''})` : ''}` : ''}`;
  }).join('\n');
  const createContent = async () => {
    const c = await attempt(() => mwApi.createContent({ workspace_id: ws.id, task_id: task.id, title: task.title.slice(0, 300), workflow_status: 'scripting', medical_review_required: true }));
    if (!c) return;
    if (st.scenes.length) await attempt(() => mwApi.addVersion({ content_id: c.id, kind: 'script', body: scriptText().slice(0, 50000), note: 'Tạo từ kịch bản order của thẻ' }));
    toast.success(already.size ? 'Đã tạo nội dung (tự bật cần consent vì dùng hình khách)' : 'Đã tạo nội dung trong Content Studio');
    onOpenContent?.(c.id);
  };

  return (
    <div className="space-y-5">
      {/* Source */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-slate-800 flex-1">Source từ Kho Media</h3>
          {canEditSrc && <button type="button" className="e-btn e-btn-primary e-btn-sm" onClick={() => setPicker(true)}><FolderOpen /> Gắn source</button>}
        </div>
        {!kho && <p className="text-[12.5px] text-slate-400">Bạn không có quyền Kho Media nên không xem được source của thẻ (chỉ xem kịch bản).</p>}
        {kho && st.links.length === 0 && <p className="text-[12.5px] text-slate-400">Chưa gắn source. Bấm “Gắn source” — hệ thống gợi ý source hợp với thẻ.</p>}
        {hideFace && <div className="e-alert e-alert-warning text-[12.5px] flex gap-1.5"><EyeOff className="w-4 h-4 shrink-0" /> Có source đánh dấu <b>CHE MẶT</b> — editor phải che mặt khách khi dựng.</div>}
        <ul className="space-y-1.5">
          {st.links.map(l => {
            const s = st.sources.get(l.media_customer_id);
            const a = l.media_asset_id ? st.assets.get(l.media_asset_id) : st.assetsBy.find(x => x.media_customer_id === l.media_customer_id);
            return (
              <li key={l.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">{driveThumb(a) && <img src={driveThumb(a)} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-800 truncate">{linkLabel(l)}</div>
                  <div className="flex flex-wrap items-center gap-1 text-[11.5px] text-slate-500">{s?.service}{s && <StatusTone s={s.source_status} />}{s?.hide_face && <span className="e-badge e-badge-sm e-tone-warning">Che mặt</span>}</div>
                </div>
                {a?.web_link && <a href={a.web_link} target="_blank" rel="noreferrer noopener" className="e-icon-btn w-8 h-8" aria-label="Mở trên Drive"><ExternalLink className="w-4 h-4" /></a>}
                {canEditSrc && <BusyButton className="e-icon-btn w-8 h-8" title="Gỡ source" onClick={async () => { if (await attempt(() => mwApi.removeTaskSource(l.id))) { load(); onChanged?.(); } }}><Trash2 className="w-4 h-4" /></BusyButton>}
              </li>
            );
          })}
        </ul>
        {kho && stats.count > 0 && <div className="text-[12px] text-slate-500"><Trophy className="w-3.5 h-3.5 inline -mt-0.5 text-amber-500" /> Clip đã dựng từ các source này: {stats.count}{stats.wins ? ` · ${stats.wins} Win` : ''}{stats.bestCpa != null ? ` · CPA tốt nhất ${money(stats.bestCpa)}` : ''} · đã chi {money(stats.spend)}</div>}
      </section>

      {/* Kịch bản order */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[14px] font-bold text-slate-800 flex-1">Kịch bản order theo cảnh</h3>
          {perm.edit && st.scenes.length === 0 && Object.entries(SCENE_TEMPLATES).map(([k, t]) => (
            <BusyButton key={k} className="e-btn e-btn-secondary e-btn-sm" onClick={() => addScenes(t.rows)}>{t.label}</BusyButton>
          ))}
        </div>
        {st.scenes.length === 0 && <p className="text-[12.5px] text-slate-400">Chọn 1 mẫu ở trên hoặc thêm cảnh. Mỗi cảnh ghi nội dung + source + đoạn cắt để editor dựng đúng.</p>}
        <ol className="space-y-2">
          {st.scenes.map((sc, i) => <SceneRow key={sc.id} sc={sc} i={i} n={st.scenes.length} links={st.links} linkLabel={linkLabel} disabled={!perm.edit} onMove={move} onDone={load} />)}
        </ol>
        {perm.edit && <BusyButton className="e-btn e-btn-ghost e-btn-sm" onClick={() => addScenes([['Cảnh mới', '']])}><Plus /> Thêm cảnh</BusyButton>}
      </section>

      {perm.edit && (
        <div className="rounded-xl bg-slate-50 p-3 flex flex-wrap items-center gap-2">
          <Clapperboard className="w-4 h-4 text-teal-700" />
          <span className="text-[12.5px] text-slate-600 flex-1 min-w-[200px]">Dựng xong → tạo nội dung trong Content Studio (kèm kịch bản) để gửi duyệt y khoa / consent và xuất bản.</span>
          <BusyButton className="e-btn e-btn-primary e-btn-sm" onClick={createContent}>Tạo nội dung từ thẻ</BusyButton>
        </div>
      )}
      <KhoSourcePicker open={picker} onClose={() => setPicker(false)} context={{ taskId: task.id, text: [task.title, task.description, ...labelNames].join(' ') }} already={already} onPick={pick} />
    </div>
  );
}

function SceneRow({ sc, i, n, links, linkLabel, disabled, onMove, onDone }) {
  const [f, setF] = useState({ scene: sc.scene || '', content: sc.content || '', clip_from: sc.clip_from || '', clip_to: sc.clip_to || '' });
  // chỉ khởi tạo khi đổi sang cảnh khác — không ghi đè ô đang gõ khi danh sách tải lại sau mỗi lần lưu
  useEffect(() => { setF({ scene: sc.scene || '', content: sc.content || '', clip_from: sc.clip_from || '', clip_to: sc.clip_to || '' }); }, [sc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (patch) => {
    for (const k of ['clip_from', 'clip_to']) if (k in patch && patch[k] && !TIME_RE.test(patch[k])) { toast.error('Đoạn cắt dạng phút:giây, VD 0:12'); return; }
    if (await attempt(() => mwApi.updateScene(sc.id, patch))) onDone();
  };
  const blur = (k) => () => { const v = f[k].trim(); if (v !== (sc[k] || '')) save({ [k]: v || null }); };
  return (
    <li className="rounded-xl border border-slate-200 p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-[12px] font-bold grid place-items-center shrink-0">{i + 1}</span>
        <input className="e-input h-8 text-[13px] font-semibold flex-1" value={f.scene} disabled={disabled} maxLength={60} aria-label="Tên cảnh" onChange={e => setF(v => ({ ...v, scene: e.target.value }))} onBlur={blur('scene')} />
        {!disabled && <>
          <button type="button" className="e-icon-btn w-7 h-7" aria-label="Lên" disabled={i === 0} onClick={() => onMove(i, -1)}><ChevronUp className="w-4 h-4" /></button>
          <button type="button" className="e-icon-btn w-7 h-7" aria-label="Xuống" disabled={i === n - 1} onClick={() => onMove(i, 1)}><ChevronDown className="w-4 h-4" /></button>
          <button type="button" className="e-icon-btn w-7 h-7" aria-label="Xoá cảnh" onClick={async () => { if (await attempt(() => mwApi.deleteScene(sc.id))) onDone(); }}><Trash2 className="w-3.5 h-3.5" /></button>
        </>}
      </div>
      <textarea className="e-textarea min-h-[52px] text-[13px]" value={f.content} disabled={disabled} maxLength={2000} placeholder="Nội dung / lời thoại / ghi chú dựng" aria-label="Nội dung cảnh"
        onChange={e => setF(v => ({ ...v, content: e.target.value }))} onBlur={blur('content')} />
      <div className="grid grid-cols-[1fr_76px_76px] gap-1.5">
        <select className="e-input h-8 text-[12.5px]" value={sc.source_ref || ''} disabled={disabled || !links.length} aria-label="Source của cảnh" onChange={e => save({ source_ref: e.target.value || null })}>
          <option value="">{links.length ? '— Source —' : 'Chưa gắn source'}</option>
          {links.map(l => <option key={l.id} value={l.id}>{linkLabel(l)}</option>)}
        </select>
        <input className="e-input h-8 text-[12.5px]" value={f.clip_from} disabled={disabled} placeholder="từ 0:12" aria-label="Cắt từ" onChange={e => setF(v => ({ ...v, clip_from: e.target.value }))} onBlur={blur('clip_from')} />
        <input className="e-input h-8 text-[12.5px]" value={f.clip_to} disabled={disabled} placeholder="đến 0:15" aria-label="Cắt đến" onChange={e => setF(v => ({ ...v, clip_to: e.target.value }))} onBlur={blur('clip_to')} />
      </div>
      {sc.source_ref && !links.some(l => l.id === sc.source_ref) && <div className="text-[11.5px] text-warning-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Source của cảnh đã bị gỡ</div>}
    </li>
  );
}
