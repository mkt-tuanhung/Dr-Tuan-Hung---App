// ============================================================
// MARKETING WORKSPACE — CHAT (S13) + TÀI LIỆU & WIKI (S14)
// Chat: kênh chung của workspace, @nhắc thành viên (thông báo), trả lời, sửa / xoá mềm, TẠO THẺ TỪ TIN NHẮN.
// Wiki: cây trang, soạn Markdown + xem trước, khoá phiên bản (không ghi đè khi người khác vừa sửa),
//   lịch sử phiên bản + khôi phục. Dữ liệu: supabase/marketing_workspace_v3_collab.sql.
// Không tra cứu / không chép dữ liệu khách hàng vào chat / wiki.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send, Reply, Pencil, Trash2, KanbanSquare, X, Plus, FileText, History, Eye, Edit3, Search, RotateCcw, ChevronRight } from 'lucide-react';
import { ErrorState, EmptyState } from '@/components/ds';
import MentionInput, { MENTION_RE } from '@/components/MentionInput';
import { supabase } from '@/lib/supabaseClient';
import { mwApi, isMissingSchema } from './mwApi';
import { bySort, fmtDateTime, timeAgo } from './mwMeta';
import { Avatar, Modal, Field, Skeleton, attempt, BusyButton } from './mwUi';

export const V3_MISSING = 'Chưa cài phần Chat / Tài liệu / Base / Automation — Admin chạy supabase/marketing_workspace_v3_collab.sql trong SQL Editor.';
export const errText = (e) => (isMissingSchema(e) ? V3_MISSING : e?.message);
const plain = (body) => (body || '').replace(MENTION_RE, (m, name) => `@${name}`);

// ---------- Hiển thị văn bản: @nhắc + link (không dùng HTML thô) ----------
function Inline({ text }) {
  const out = [];
  let k = 0;
  // **đậm**, `code`, [chữ](https://...), @[Tên](staff:id), https://...
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|@\[[^\]]+\]\((?:staff|cust):[0-9a-fA-F-]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0; let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<b key={k++}>{t.slice(2, -2)}</b>);
    else if (t.startsWith('`')) out.push(<code key={k++} className="px-1 rounded bg-slate-100 text-[0.92em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) { const mm = t.match(/^\[([^\]]+)\]\((.+)\)$/); out.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer noopener" className="text-teal-700 underline">{mm[1]}</a>); }
    else if (t.startsWith('@[')) out.push(<b key={k++} className="text-teal-700">@{t.match(/^@\[([^\]]+)\]/)[1]}</b>);
    else out.push(<a key={k++} href={t} target="_blank" rel="noreferrer noopener" className="text-teal-700 underline break-all">{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
// Markdown tối giản (tiêu đề, gạch đầu dòng, đánh số, checkbox, trích dẫn) -> phần tử React
export function Markdown({ text }) {
  const lines = (text || '').split('\n');
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  lines.forEach((ln, i) => {
    let m;
    if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      const cls = ['text-[20px] font-bold mt-4 mb-1', 'text-[17px] font-bold mt-3 mb-1', 'text-[15px] font-bold mt-2'][m[1].length - 1];
      blocks.push(<div key={i} className={`${cls} text-slate-900`}><Inline text={m[2]} /></div>);
    } else if ((m = ln.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)$/i))) {
      if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', key: i, items: [] }; }
      list.items.push(<li key={i} className="list-none -ml-4"><input type="checkbox" readOnly checked={m[1].toLowerCase() === 'x'} className="mr-1.5 align-middle" /><Inline text={m[2]} /></li>);
    } else if ((m = ln.match(/^\s*[-*]\s+(.*)$/))) {
      if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', key: i, items: [] }; }
      list.items.push(<li key={i}><Inline text={m[1]} /></li>);
    } else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', key: i, items: [] }; }
      list.items.push(<li key={i}><Inline text={m[1]} /></li>);
    } else if ((m = ln.match(/^>\s?(.*)$/))) {
      flush(); blocks.push(<blockquote key={i} className="border-l-4 border-teal-200 pl-3 text-slate-600 my-1"><Inline text={m[1]} /></blockquote>);
    } else if (!ln.trim()) { flush(); blocks.push(<div key={i} className="h-2" />); }
    else { flush(); blocks.push(<p key={i} className="leading-relaxed"><Inline text={ln} /></p>); }
  });
  flush();
  return (
    <div className="text-[14px] text-slate-700 space-y-0.5">
      {blocks.map(b => (b.type === 'ul' ? <ul key={`l${b.key}`} className="list-disc pl-6 space-y-0.5">{b.items}</ul>
        : b.type === 'ol' ? <ol key={`l${b.key}`} className="list-decimal pl-6 space-y-0.5">{b.items}</ol> : b))}
    </div>
  );
}

// ================= CHAT =================
export function ChatSection({ ws, perm, profile, staffById, memberStaff, boards, openTask }) {
  const [st, setSt] = useState({ loading: true, msgs: [] });
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toTask, setToTask] = useState(null);
  const endRef = useRef(null);
  const load = useCallback(async () => {
    try {
      const rows = await mwApi.messages(ws.id);
      setSt(s => ({ loading: false, error: null, msgs: rows.reverse(), more: rows.length === 100 }));
    } catch (e) { setSt({ loading: false, error: e, msgs: [] }); }
  }, [ws.id]);
  useEffect(() => { setSt({ loading: true, msgs: [] }); load(); }, [load]);
  // Realtime riêng cho kênh chat (nhanh hơn hook gom 20 s)
  useEffect(() => {
    const ch = supabase.channel(`mw_chat_${ws.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mw_messages', filter: `workspace_id=eq.${ws.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ws.id, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [st.msgs.length]);

  const byId = useMemo(() => new Map(st.msgs.map(m => [m.id, m])), [st.msgs]);
  const older = async () => {
    const rows = await attempt(() => mwApi.messages(ws.id, st.msgs[0]?.created_at));
    if (rows && rows !== true) setSt(s => ({ ...s, msgs: [...rows.reverse(), ...s.msgs], more: rows.length === 100 }));
  };
  const send = async () => {
    const v = text.trim();
    if (!v) return;
    if (editing) {
      if (await attempt(() => mwApi.updateMessage(editing.id, { body: v.slice(0, 4000) }))) { setEditing(null); setText(''); load(); }
      return;
    }
    if (await attempt(() => mwApi.sendMessage(ws.id, v.slice(0, 4000), reply?.id))) { setText(''); setReply(null); load(); }
  };
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={6} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={errText(st.error)} onRetry={load} /></div>;
  const name = (id) => staffById.get(id)?.full_name || 'Không rõ';

  return (
    <div className="e-card flex flex-col h-[calc(100vh-260px)] min-h-[420px]">
      <div className="px-4 py-2.5 border-b border-slate-100 text-[13px] text-slate-500"># {ws.name} · {memberStaff.length} thành viên · gõ @ để nhắc người, bấm <KanbanSquare className="w-3.5 h-3.5 inline -mt-0.5" /> để biến tin thành thẻ việc</div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {st.more && <button type="button" className="e-btn e-btn-ghost e-btn-sm mx-auto block" onClick={older}>Tải tin cũ hơn</button>}
        {st.msgs.length === 0 && <EmptyState title="Chưa có tin nhắn" description="Bắt đầu trao đổi với team — nhắc tên bằng @." />}
        {st.msgs.map(m => {
          const mine = m.author_id === profile.id;
          const parent = m.reply_to ? byId.get(m.reply_to) : null;
          return (
            <div key={m.id} className="group flex gap-2.5">
              <Avatar person={staffById.get(m.author_id)} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2"><b className="text-[13.5px] text-slate-800">{name(m.author_id)}</b><span className="text-[11.5px] text-slate-400" title={fmtDateTime(m.created_at)}>{timeAgo(m.created_at)}{m.edited_at && ' · đã sửa'}</span></div>
                {parent && <div className="text-[12px] text-slate-500 border-l-2 border-slate-200 pl-2 my-0.5 truncate">↪ {name(parent.author_id)}: {parent.deleted_at ? 'tin đã xoá' : plain(parent.body)}</div>}
                {m.deleted_at ? <p className="text-[13px] italic text-slate-400">Tin nhắn đã xoá</p>
                  : <div className="text-[13.5px] text-slate-700 whitespace-pre-wrap break-words"><Inline text={m.body} /></div>}
                {m.task_id && <button type="button" onClick={() => openTask(m.task_id)} className="mt-1 inline-flex items-center gap-1 text-[12px] px-2 h-6 rounded-full bg-teal-50 text-teal-800"><KanbanSquare className="w-3.5 h-3.5" /> Đã tạo thẻ việc — mở</button>}
                {!m.deleted_at && (
                  <div className="flex gap-1 mt-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    <button type="button" className="e-icon-btn w-7 h-7" aria-label="Trả lời" onClick={() => { setReply(m); setEditing(null); }}><Reply className="w-3.5 h-3.5" /></button>
                    {perm.edit && !m.task_id && <button type="button" className="e-icon-btn w-7 h-7" aria-label="Tạo thẻ từ tin nhắn" title="Tạo thẻ việc từ tin nhắn" onClick={() => setToTask(m)}><KanbanSquare className="w-3.5 h-3.5" /></button>}
                    {mine && <button type="button" className="e-icon-btn w-7 h-7" aria-label="Sửa tin" onClick={() => { setEditing(m); setReply(null); setText(m.body); }}><Pencil className="w-3.5 h-3.5" /></button>}
                    {(mine || perm.manage) && <button type="button" className="e-icon-btn w-7 h-7" aria-label="Xoá tin" onClick={async () => { if (await attempt(() => mwApi.updateMessage(m.id, { deleted_at: new Date().toISOString() }))) load(); }}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-100 p-3 space-y-1.5">
        {(reply || editing) && (
          <div className="flex items-center gap-2 text-[12px] text-slate-500 bg-slate-50 rounded-lg px-2 py-1">
            {reply ? <>↪ Trả lời {name(reply.author_id)}: <span className="truncate">{plain(reply.body)}</span></> : <>Đang sửa tin nhắn</>}
            <button type="button" className="ml-auto" aria-label="Huỷ" onClick={() => { setReply(null); if (editing) { setEditing(null); setText(''); } }}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MentionInput value={text} onChange={setText} onEnter={send} staff={memberStaff} allowCustomer={false}
            placeholder="Nhắn cho team… gõ @ để nhắc người" className="e-input w-full" />
          <button type="button" className="e-btn e-btn-primary" onClick={send} disabled={!text.trim()} aria-label="Gửi"><Send /></button>
        </div>
      </div>
      <MessageToTask msg={toTask} boards={boards} staffById={staffById} onClose={() => setToTask(null)} onDone={(taskId) => { setToTask(null); load(); toast.success('Đã tạo thẻ việc từ tin nhắn'); openTask(taskId); }} />
    </div>
  );
}

function MessageToTask({ msg, boards, staffById, onClose, onDone }) {
  const active = boards.filter(b => !b.archived_at);
  const [boardId, setBoardId] = useState('');
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState('');
  const [title, setTitle] = useState('');
  useEffect(() => { if (msg) { setBoardId(active[0]?.id || ''); setTitle(plain(msg.body).slice(0, 120)); } }, [msg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!boardId) return;
    mwApi.lists([boardId]).then(ls => { const a = ls.filter(l => !l.archived_at).sort(bySort); setLists(a); setListId(a[0]?.id || ''); }).catch(e => toast.error(e.message));
  }, [boardId]);
  if (!msg) return null;
  const save = async () => {
    const desc = `${plain(msg.body)}\n\n— Tạo từ chat (${staffById.get(msg.author_id)?.full_name || ''}, ${fmtDateTime(msg.created_at)})`;
    const t = await attempt(() => mwApi.createTask(boardId, listId, title.trim(), { description: desc.slice(0, 20000) }));
    if (!t) return;
    await attempt(() => mwApi.updateMessage(msg.id, { task_id: t.id }));
    onDone(t.id);
  };
  return (
    <Modal open onClose={onClose} title="Tạo thẻ việc từ tin nhắn" footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton disabled={!title.trim() || !listId} onClick={save}>Tạo thẻ</BusyButton>
    </>}>
      {!active.length ? <p className="text-[13px] text-slate-500">Workspace chưa có board.</p> : <>
        <Field label="Tên thẻ" required><input className="e-input" value={title} maxLength={300} onChange={e => setTitle(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Board"><select className="e-input" aria-label="Board" value={boardId} onChange={e => setBoardId(e.target.value)}>{active.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Cột"><select className="e-input" aria-label="Cột" value={listId} onChange={e => setListId(e.target.value)}>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        </div>
        <p className="text-[12px] text-slate-400">Nội dung tin nhắn được chép vào mô tả thẻ; tin nhắn có nút mở thẻ.</p>
      </>}
    </Modal>
  );
}

// ================= TÀI LIỆU & WIKI =================
export function DocsSection({ ws, perm, staffById }) {
  const [st, setSt] = useState({ loading: true, docs: [] });
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  const load = useCallback(async () => {
    try { setSt({ loading: false, docs: await mwApi.docs(ws.id) }); } catch (e) { setSt({ loading: false, error: e, docs: [] }); }
  }, [ws.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setHits(null); return undefined; }
    const h = setTimeout(() => { mwApi.searchDocs(ws.id, t).then(setHits).catch(() => setHits([])); }, 300);
    return () => clearTimeout(h);
  }, [q, ws.id]);
  const create = async (parentId) => {
    const siblings = st.docs.filter(d => (d.parent_id || null) === (parentId || null));
    const d = await attempt(() => mwApi.createDoc({ workspace_id: ws.id, parent_id: parentId || null, title: 'Trang mới', body: '', sort_index: (siblings.length + 1) * 1024 }));
    if (d && d !== true) { await load(); setSel(d.id); }
  };
  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={6} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={errText(st.error)} onRetry={load} /></div>;
  const live = st.docs.filter(d => !d.archived_at);
  const kids = (pid) => live.filter(d => (d.parent_id || null) === pid).sort(bySort);
  const Tree = ({ pid, depth }) => kids(pid).map(d => (
    <div key={d.id}>
      <button type="button" onClick={() => setSel(d.id)} aria-current={sel === d.id}
        className={`w-full text-left flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-[13.5px] ${sel === d.id ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
        style={{ paddingLeft: 8 + depth * 14 }}>
        {kids(d.id).length ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}<span className="truncate">{d.title}</span>
      </button>
      <Tree pid={d.id} depth={depth + 1} />
    </div>
  ));
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
      <aside className={`e-card p-2.5 space-y-2 ${sel ? 'hidden lg:block' : ''}`}>
        <div className="flex gap-2">
          <div className="e-search flex-1"><Search /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm trong tài liệu…" className="!bg-white" /></div>
          {perm.edit && <button type="button" className="e-btn e-btn-primary" aria-label="Trang mới" onClick={() => create(null)}><Plus /></button>}
        </div>
        {hits ? (
          <div className="space-y-0.5">
            {hits.length === 0 && <p className="text-[12.5px] text-slate-400 px-2">Không thấy.</p>}
            {hits.map(h => <button key={h.id} type="button" onClick={() => { setSel(h.id); setQ(''); }} className="w-full text-left px-2 py-1.5 rounded-lg text-[13.5px] hover:bg-slate-50 truncate">{h.title}</button>)}
          </div>
        ) : live.length ? <div><Tree pid={null} depth={0} /></div> : <EmptyState icon={FileText} title="Chưa có tài liệu" description={perm.edit ? 'Bấm + để tạo trang: quy chuẩn kịch bản, brand guideline, checklist quay…' : undefined} />}
      </aside>
      <div className={sel ? '' : 'hidden lg:block'}>
        {sel ? <DocEditor key={sel} id={sel} ws={ws} perm={perm} docs={live} staffById={staffById} onBack={() => setSel(null)} onChanged={load} onCreateChild={create} />
          : <div className="e-card"><EmptyState icon={FileText} title="Chọn 1 trang" description="Tài liệu dùng chung của workspace — có lịch sử phiên bản." /></div>}
      </div>
    </div>
  );
}

function DocEditor({ id, perm, docs, staffById, onBack, onChanged, onCreateChild }) {
  const [doc, setDoc] = useState(null);
  const [f, setF] = useState({ title: '', body: '' });
  const [mode, setMode] = useState('view');
  const [hist, setHist] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(async () => {
    try { const d = await mwApi.doc(id); setDoc(d); setF({ title: d?.title || '', body: d?.body || '' }); setErr(null); } catch (e) { setErr(e); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (err) return <div className="e-card"><ErrorState description={errText(err)} onRetry={load} /></div>;
  if (!doc) return <div className="e-card e-card-pad"><Skeleton rows={5} /></div>;
  const dirty = f.title !== doc.title || f.body !== doc.body;
  const save = async () => {
    try {
      const d = await mwApi.updateDoc(doc.id, { title: f.title.trim() || 'Không tiêu đề', body: f.body }, doc.version);
      setDoc(d); toast.success(`Đã lưu (phiên bản ${d.version})`); setMode('view'); onChanged();
    } catch (e) { toast.error(e.message); if (e.conflict) load(); }
  };
  const showHist = async () => { const v = await attempt(() => mwApi.docVersions(doc.id)); if (v && v !== true) setHist(v); };
  const descendants = (pid) => docs.filter(d => d.parent_id === pid).flatMap(d => [d.id, ...descendants(d.id)]);
  const banned = new Set([doc.id, ...descendants(doc.id)]);
  return (
    <div className="e-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button type="button" className="e-btn e-btn-ghost e-btn-sm lg:hidden" onClick={onBack}>‹ Danh sách</button>
        <span className="text-[12px] text-slate-400">v{doc.version} · {staffById.get(doc.updated_by)?.full_name || '—'} · {fmtDateTime(doc.updated_at)}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {perm.edit && <div className="e-seg">
            <button type="button" className={`e-seg-item ${mode === 'view' ? 'e-seg-active' : ''}`} onClick={() => setMode('view')}><Eye /> Xem</button>
            <button type="button" className={`e-seg-item ${mode === 'edit' ? 'e-seg-active' : ''}`} onClick={() => setMode('edit')}><Edit3 /> Sửa</button>
          </div>}
          <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={showHist}><History /> Lịch sử</button>
          {perm.edit && <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => onCreateChild(doc.id)}><Plus /> Trang con</button>}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {mode === 'edit' ? (
          <>
            <input className="e-input text-[18px] font-bold h-11" value={f.title} maxLength={200} onChange={e => setF(v => ({ ...v, title: e.target.value }))} aria-label="Tiêu đề trang" />
            <div className="grid lg:grid-cols-2 gap-3">
              <textarea className="e-textarea min-h-[420px] font-mono text-[13px]" value={f.body} maxLength={200000} onChange={e => setF(v => ({ ...v, body: e.target.value }))} aria-label="Nội dung (Markdown)"
                placeholder={'# Tiêu đề\n- gạch đầu dòng\n- [ ] việc cần làm\n**đậm**, [link](https://...)'} />
              <div className="hidden lg:block rounded-xl border border-slate-100 p-3 overflow-y-auto max-h-[420px]"><Markdown text={f.body} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BusyButton disabled={!dirty} onClick={save}>Lưu phiên bản mới</BusyButton>
              <button type="button" className="e-btn e-btn-ghost" disabled={!dirty} onClick={() => setF({ title: doc.title, body: doc.body })}>Huỷ thay đổi</button>
              <label className="ml-auto flex items-center gap-1.5 text-[12.5px] text-slate-500">Trang cha
                <select className="e-input h-8 w-auto text-[12.5px]" value={doc.parent_id || ''} aria-label="Trang cha"
                  onChange={async e => { try { const d = await mwApi.updateDoc(doc.id, { parent_id: e.target.value || null }, doc.version); setDoc(d); onChanged(); } catch (er) { toast.error(er.message); } }}>
                  <option value="">— (gốc)</option>
                  {docs.filter(d => !banned.has(d.id)).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </label>
              {perm.manage && <BusyButton className="e-btn e-btn-danger-soft e-btn-sm" onClick={async () => { try { await mwApi.updateDoc(doc.id, { archived_at: new Date().toISOString() }, doc.version); toast.success('Đã ẩn trang'); onChanged(); onBack(); } catch (er) { toast.error(er.message); } }}><Trash2 /> Ẩn trang</BusyButton>}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-bold text-slate-900">{doc.title}</h2>
            {doc.body ? <Markdown text={doc.body} /> : <p className="text-[13px] text-slate-400">Trang trống{perm.edit ? ' — bấm Sửa để viết.' : '.'}</p>}
          </>
        )}
      </div>
      <Modal open={!!hist} onClose={() => setHist(null)} title="Lịch sử phiên bản" size="max-w-2xl">
        {hist?.length === 0 && <p className="text-[13px] text-slate-400">Chưa có phiên bản cũ.</p>}
        <ul className="space-y-2">
          {(hist || []).map(v => (
            <li key={v.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-2 text-[12.5px] text-slate-500"><b className="text-slate-800">v{v.version}</b> {v.title} · {staffById.get(v.author_id)?.full_name || '—'} · {fmtDateTime(v.created_at)}
                {perm.edit && <BusyButton className="e-btn e-btn-ghost e-btn-sm ml-auto" onClick={async () => { try { const d = await mwApi.updateDoc(doc.id, { title: v.title, body: v.body }, doc.version); setDoc(d); setF({ title: d.title, body: d.body }); setHist(null); toast.success(`Đã khôi phục nội dung v${v.version} (lưu thành v${d.version})`); onChanged(); } catch (e) { toast.error(e.message); } }}><RotateCcw /> Khôi phục</BusyButton>}
              </div>
              <details><summary className="text-[12px] text-slate-400 cursor-pointer">Xem nội dung</summary><div className="mt-2"><Markdown text={v.body} /></div></details>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
