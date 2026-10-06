import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Image as ImageIcon, Send, X, Trash2, MessageCircle, Loader2, Smile, Plus, Users, Bold, Italic, ChevronLeft, ChevronRight, Phone, Clock, Heart } from 'lucide-react';
import MentionInput, { MENTION_RE } from '@/components/MentionInput.jsx';

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Thích' },
  { key: 'love', emoji: '❤️', label: 'Yêu thích' },
  { key: 'haha', emoji: '😆', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Buồn' },
  { key: 'angry', emoji: '😡', label: 'Phẫn nộ' },
];
const EMOJI_OF = Object.fromEntries(REACTIONS.map(r => [r.key, r.emoji]));
const LABEL_OF = Object.fromEntries(REACTIONS.map(r => [r.key, r.label]));
const TEXT_COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#12A4A5', '#3b82f6', '#8b5cf6', '#ec4899'];
const QUICK_COMMENTS = ['Đã xét nghiệm xong', 'Vào phẫu thuật', 'KH phẫu thuật xong', 'Khách hàng về phòng nghỉ ngơi'];

// Nhận diện mốc thời gian: 9h, 9h30, 9:30, 9 giờ 30 phút, ngày 25/06(/2026)
const TIME_SRC = '\\d{1,2}\\s*giờ(?:\\s*\\d{1,2})?(?:\\s*phút)?|\\d{1,2}h\\d{0,2}|\\d{1,2}:\\d{2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?';
// Nối thêm 1 đoạn vào nội dung đang soạn (giữ phần đã gõ, thêm space)
const joinText = (prev, add) => ((prev && prev.trim()) ? prev.replace(/\s*$/, '') + ' ' : '') + add + ' ';

// Nút chọn giờ -> popover giờ/phút (tông teal Ethics), gọi onPick(label) để chèn vào ô soạn
function TimeButton({ onPick, size = 'p-2' }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(() => new Date().getHours());
  const [mi, setMi] = useState(() => new Date().getMinutes());
  const wrapRef = useRef(null);
  const pad = (n) => String(n).padStart(2, '0');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    // cuộn mục đang chọn vào giữa cột (không làm cuộn cả trang)
    setTimeout(() => wrapRef.current?.querySelectorAll('.tb-sel').forEach(el => {
      const p = el.parentElement; if (p) p.scrollTop = el.offsetTop - p.clientHeight / 2 + el.clientHeight / 2;
    }), 0);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const confirm = () => { onPick(mi === 0 ? `${h}h` : `${h}h${pad(mi)}`); setOpen(false); };
  const setNow = () => { const d = new Date(); setH(d.getHours()); setMi(d.getMinutes()); };
  const colCls = 'relative h-44 w-16 overflow-y-auto py-1 rounded-xl bg-slate-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
  const itemCls = (sel) => `block w-full text-center py-1.5 my-0.5 text-sm rounded-lg transition-colors ${sel ? 'tb-sel bg-teal-600 text-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-teal-50'}`;

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button type="button" title="Thêm mốc thời gian" onClick={() => setOpen(o => !o)}
        className={`${size} rounded-full ${open ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-teal-50 hover:text-teal-700'}`}>
        <Clock className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-40 w-60 bg-white rounded-2xl shadow-float border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-slate-500">Chọn mốc thời gian</span>
            <span className="text-[16px] font-bold text-teal-700 tabular-nums">{mi === 0 ? `${h}h` : `${h}h${pad(mi)}`}</span>
          </div>
          <div className="flex gap-2 justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Giờ</span>
              <div className={colCls}>
                {Array.from({ length: 24 }, (_, i) => i).map(v => (
                  <button key={v} type="button" onClick={() => setH(v)} className={itemCls(v === h)}>{pad(v)}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Phút</span>
              <div className={colCls}>
                {Array.from({ length: 60 }, (_, i) => i).map(v => (
                  <button key={v} type="button" onClick={() => setMi(v)} className={itemCls(v === mi)}>{pad(v)}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={setNow} className="e-btn e-btn-secondary e-btn-sm flex-1">Bây giờ</button>
            <button type="button" onClick={confirm} className="e-btn e-btn-primary e-btn-sm flex-1">Chèn</button>
          </div>
        </div>
      )}
    </span>
  );
}

// Làm sạch HTML soạn thảo: chỉ giữ định dạng cơ bản + màu chữ
const sanitizeHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  tmp.querySelectorAll('script, style, iframe, link, meta, object, embed').forEach(e => e.remove());
  tmp.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      if (a.name === 'style') {
        const color = el.style.color; el.removeAttribute('style'); if (color) el.style.color = color;
      } else if (a.name === 'href') {
        // Chỉ cho phép http(s)/mailto/nội bộ — chặn javascript:, data:, ...
        const v = (el.getAttribute('href') || '').trim();
        if (!/^(https?:\/\/|mailto:|\/|#)/i.test(v)) el.removeAttribute('href');
      } else {
        el.removeAttribute(a.name);
      }
    });
  });
  return tmp.innerHTML;
};

const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(d).toLocaleDateString('vi-VN');
};

const Avatar = ({ url, name, size = 'w-10 h-10' }) => (
  <div className={`${size} e-avatar overflow-hidden`}>
    {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : (name?.charAt(0) || 'U')}
  </div>
);

// Thanh chọn cảm xúc (popover)
const ReactionBar = ({ onPick }) => (
  <div className="absolute bottom-9 left-0 bg-white border border-slate-200 rounded-full shadow-float px-2 py-1.5 flex gap-1 z-20">
    {REACTIONS.map(r => (
      <button key={r.key} onClick={() => onPick(r.key)} title={r.label} className="text-2xl hover:scale-125 transition-transform">{r.emoji}</button>
    ))}
  </div>
);

const CommunityPage = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const editorRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [likes, setLikes] = useState([]);          // post reactions + user profile
  const [comments, setComments] = useState([]);
  const [cLikes, setCLikes] = useState([]);         // comment reactions

  const [title, setTitle] = useState('');
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' | 'list'

  const [pickerFor, setPickerFor] = useState(null);      // post id
  const [cPickerFor, setCPickerFor] = useState(null);    // comment id
  const [openComments, setOpenComments] = useState({});
  const [commentText, setCommentText] = useState({});    // postId -> text (top-level)
  const [replyFor, setReplyFor] = useState(null);        // comment id
  const [replyText, setReplyText] = useState('');
  const [mentionStaff, setMentionStaff] = useState([]);
  const [customerView, setCustomerView] = useState(null);
  const [editorMention, setEditorMention] = useState(null); // { items, node, start, end, rect }
  const [emActive, setEmActive] = useState(0);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, employee_id').eq('is_active', true).order('full_name')
      .then(({ data }) => setMentionStaff(data || []));
  }, []);

  // Render nội dung có tag: @nhân sự (xanh) / @khách (link mở thông tin)
  // Bôi đỏ mốc thời gian trong 1 đoạn text thường -> mảng node
  const pushTimes = (out, str, keyBase) => {
    if (!str) return;
    let last = 0; let t; const tre = new RegExp(TIME_SRC, 'gi');
    while ((t = tre.exec(str)) !== null) {
      if (t.index > last) out.push(str.slice(last, t.index));
      out.push(<span key={`${keyBase}-t${t.index}`} className="text-rose-600 font-semibold bg-rose-50 rounded px-1">{t[0]}</span>);
      last = t.index + t[0].length;
      if (t.index === tre.lastIndex) tre.lastIndex++;
    }
    if (last < str.length) out.push(str.slice(last));
  };

  const renderMentions = (text) => {
    if (!text) return null;
    const out = []; let last = 0; let m; const re = new RegExp(MENTION_RE);
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) pushTimes(out, text.slice(last, m.index), `m${m.index}`);
      const [full, name, type, id] = m;
      if (type === 'cust') {
        out.push(<button key={m.index} type="button" onClick={() => openCustomer(id)} className="inline-flex items-center gap-1 align-middle mx-0.5 px-2 py-0.5 rounded-full bg-info-50 text-info-600 text-[13px] font-semibold hover:bg-info-100 transition-colors">👤 {name}</button>);
      } else {
        out.push(<span key={m.index} className="inline-flex items-center align-middle mx-0.5 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[13px] font-semibold">@{name}</span>);
      }
      last = m.index + full.length;
    }
    if (last < text.length) pushTimes(out, text.slice(last), 'mEnd');
    return out;
  };

  const openCustomer = async (id) => {
    const { data, error } = await supabase.rpc('get_customer_card', { p_id: id });
    if (error || !data) { toast.error('Không tìm thấy khách hàng'); return; }
    if (data.denied) { toast.warning('Bạn bị giới hạn quyền truy cập khách hàng này'); return; }
    setCustomerView(data);
  };

  // ----- Tag @ trong trình soạn thảo bài viết (contentEditable) -----
  const detectEditorMention = async () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) { setEditorMention(null); return; }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== 3) { setEditorMention(null); return; }
    const before = node.textContent.slice(0, range.startOffset);
    const mCust = before.match(/#(\d*)$/);
    const mStaff = before.match(/@([^\s@#]*)$/);
    let items, m;
    if (mCust) {
      if (mCust[1].length < 2) { setEditorMention(null); return; }
      m = mCust;
      const { data } = await supabase.rpc('search_customer_by_phone', { q: mCust[1] });
      items = (data || []).map(c => ({ type: 'cust', id: c.id, name: c.customer_name || c.phone, sub: c.phone }));
    } else if (mStaff) {
      m = mStaff;
      const ql = mStaff[1].toLowerCase();
      items = mentionStaff.filter(s => s.full_name?.toLowerCase().includes(ql)).slice(0, 6)
        .map(s => ({ type: 'staff', id: s.id, name: s.full_name, sub: s.employee_id || '' }));
    } else { setEditorMention(null); return; }
    const rect = range.getBoundingClientRect();
    setEmActive(0);
    setEditorMention({ items, node, start: range.startOffset - m[0].length, end: range.startOffset, rect });
  };

  const pickEditorMention = (item) => {
    if (!editorMention) return;
    const { node, start, end } = editorMention;
    const token = `@[${item.name}](${item.type}:${item.id}) `;
    const r = document.createRange();
    try { r.setStart(node, start); r.setEnd(node, end); } catch { setEditorMention(null); return; }
    r.deleteContents();
    const tn = document.createTextNode(token);
    r.insertNode(tn);
    const sel = window.getSelection();
    sel.removeAllRanges();
    const nr = document.createRange();
    nr.setStartAfter(tn); nr.collapse(true);
    sel.addRange(nr);
    editorRef.current?.focus();
    setEditorMention(null);
  };

  const handleEditorKeyDown = (e) => {
    if (!editorMention || !editorMention.items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setEmActive(a => (a + 1) % editorMention.items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setEmActive(a => (a - 1 + editorMention.items.length) % editorMention.items.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pickEditorMention(editorMention.items[emActive]); }
    else if (e.key === 'Escape') { setEditorMention(null); }
  };

  // Đổi token trong HTML bài viết thành chip nhân sự / link khách + bôi đỏ mốc thời gian
  const renderPostHtml = (html) => {
    // Sanitize ở ĐẦU RA: nội dung có thể được chèn thẳng qua API (bỏ qua sanitize lúc soạn)
    const withChips = sanitizeHtml(html || '')
      .replace(/@\[([^\]]+)\]\(staff:[0-9a-fA-F-]+\)/g, '<span style="display:inline-flex;align-items:center;background:#ccfbf1;color:#06686C;border-radius:9999px;padding:1px 8px;font-weight:600;font-size:13px;margin:0 2px">@$1</span>')
      .replace(/@\[([^\]]+)\]\(cust:([0-9a-fA-F-]+)\)/g, '<button type="button" data-cust="$2" style="display:inline-flex;align-items:center;gap:3px;background:#dbeafe;color:#1d4ed8;border:none;border-radius:9999px;padding:1px 8px;font-weight:600;font-size:13px;cursor:pointer;margin:0 2px;font-family:inherit">👤 $1</button>');
    // Chỉ tô màu phần text (bỏ qua bên trong các thẻ <...>)
    return withChips.split(/(<[^>]+>)/).map(seg =>
      seg.startsWith('<') ? seg
        : seg.replace(new RegExp(TIME_SRC, 'gi'), '<span style="color:#e11d48;font-weight:600;background:#fff1f2;border-radius:4px;padding:0 3px">$&</span>')
    ).join('');
  };

  const handlePostContentClick = (e) => {
    const id = e.target?.dataset?.cust;
    if (id) { e.preventDefault(); openCustomer(id); }
  };
  const [reactWho, setReactWho] = useState(null);        // { post, list }
  const [lightbox, setLightbox] = useState(null);        // { urls, index }
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [allStaff, setAllStaff] = useState([]);

  const selectedGroup = groups.find(g => g.id === groupId);
  const canManageGroup = isAdmin || selectedGroup?.created_by === profile?.id;

  const loadGroups = useCallback(async () => {
    const { data } = await supabase.from('community_groups').select('*').order('created_at');
    setGroups(data || []);
    setGroupId(prev => prev || (data && data[0]?.id) || null);
  }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const createGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Nhập tên group'); return; }
    const { data, error } = await supabase.from('community_groups')
      .insert({ name: groupForm.name.trim(), description: groupForm.description.trim() || null, created_by: profile.id })
      .select().single();
    if (error) { toast.error(error.message); return; }
    // Tự thêm người tạo làm thành viên
    if (data) await supabase.from('community_group_members').insert({ group_id: data.id, user_id: profile.id, added_by: profile.id });
    toast.success('Đã tạo group');
    setShowGroupModal(false); setGroupForm({ name: '', description: '' });
    await loadGroups(); if (data) setGroupId(data.id);
  };

  const loadMembers = async (gid) => {
    const { data } = await supabase.from('community_group_members')
      .select('user_id, user:profiles!user_id(full_name, avatar_url, role)').eq('group_id', gid);
    setMembers(data || []);
  };
  const openMembers = async () => {
    if (!groupId) return;
    const { data: staffData } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('is_active', true).order('full_name');
    setAllStaff(staffData || []);
    await loadMembers(groupId);
    setShowMembers(true);
  };
  const addMember = async (uid) => {
    const { error } = await supabase.from('community_group_members').insert({ group_id: groupId, user_id: uid, added_by: profile.id });
    if (error) { toast.error(error.message); return; }
    loadMembers(groupId);
  };
  const removeMember = async (uid) => {
    const { error } = await supabase.from('community_group_members').delete().eq('group_id', groupId).eq('user_id', uid);
    if (error) { toast.error(error.message); return; }
    loadMembers(groupId);
  };

  const loadFeed = useCallback(async () => {
    if (!groupId) { setPosts([]); setLoading(false); return; }
    setLoading(true);
    const { data: postData, error } = await supabase
      .from('community_posts').select('*, author:profiles!author_id(full_name, avatar_url)')
      .eq('group_id', groupId).is('deleted_at', null).order('created_at', { ascending: false }).limit(80);
    if (error) { toast.error('Lỗi tải bảng tin: ' + error.message); setLoading(false); return; }
    const ids = (postData || []).map(p => p.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
    const cmtRes = await supabase.from('community_comments')
      .select('*, author:profiles!author_id(full_name, avatar_url)').in('post_id', safe).is('deleted_at', null).order('created_at', { ascending: true });
    const cmtIds = (cmtRes.data || []).map(c => c.id);
    const [likeRes, cLikeRes] = await Promise.all([
      supabase.from('community_likes').select('post_id, user_id, reaction, user:profiles!user_id(full_name, avatar_url)').in('post_id', safe),
      supabase.from('community_comment_likes').select('comment_id, user_id, reaction').in('comment_id', cmtIds.length ? cmtIds : ['x']),
    ]);
    setPosts(postData || []);
    setComments(cmtRes.data || []);
    setLikes(likeRes.data || []);
    setCLikes(cLikeRes.data || []);
    setLoading(false);
  }, [groupId]);
  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handlePost = async () => {
    const raw = editorRef.current?.innerHTML || '';
    const html = sanitizeHtml(raw);
    const plain = (editorRef.current?.innerText || '').trim();
    if (!title.trim()) { toast.error('Nhập tiêu đề bài viết'); return; }
    if (!plain && files.length === 0) { toast.error('Nhập nội dung hoặc thêm ảnh'); return; }
    setPosting(true);
    try {
      const image_urls = [];
      for (const f of files) image_urls.push(await uploadToR2(f, 'community'));
      const { data, error } = await supabase.from('community_posts').insert({
        group_id: groupId, author_id: profile.id, title: title.trim(), content: plain ? html : null, image_urls,
      }).select('*').single();
      if (error) throw error;
      if (editorRef.current) editorRef.current.innerHTML = '';
      setTitle(''); setFiles([]);
      setPosts(prev => [{ ...data, author: { full_name: profile.full_name, avatar_url: profile.avatar_url } }, ...prev]);
    } catch (err) { toast.error(err.message); }
    finally { setPosting(false); }
  };

  const meUser = { full_name: profile?.full_name, avatar_url: profile?.avatar_url };

  // ----- Post reactions (cập nhật cục bộ, không reload) -----
  const myPostReaction = (postId) => likes.find(l => l.post_id === postId && l.user_id === profile?.id)?.reaction || null;
  const reactPost = async (postId, key) => {
    setPickerFor(null);
    const cur = myPostReaction(postId);
    setLikes(prev => {
      const others = prev.filter(l => !(l.post_id === postId && l.user_id === profile.id));
      return cur === key ? others : [...others, { post_id: postId, user_id: profile.id, reaction: key, user: meUser }];
    });
    const { error } = cur === key
      ? await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', profile.id)
      : await supabase.from('community_likes').upsert({ post_id: postId, user_id: profile.id, reaction: key }, { onConflict: 'post_id,user_id' });
    if (error) { toast.error('Lỗi lưu cảm xúc: ' + error.message); loadFeed(); }
  };

  // ----- Comment reactions -----
  const myCmtReaction = (cid) => cLikes.find(l => l.comment_id === cid && l.user_id === profile?.id)?.reaction || null;
  const reactComment = async (cid, key) => {
    setCPickerFor(null);
    const cur = myCmtReaction(cid);
    setCLikes(prev => {
      const others = prev.filter(l => !(l.comment_id === cid && l.user_id === profile.id));
      return cur === key ? others : [...others, { comment_id: cid, user_id: profile.id, reaction: key }];
    });
    const { error } = cur === key
      ? await supabase.from('community_comment_likes').delete().eq('comment_id', cid).eq('user_id', profile.id)
      : await supabase.from('community_comment_likes').upsert({ comment_id: cid, user_id: profile.id, reaction: key }, { onConflict: 'comment_id,user_id' });
    if (error) { toast.error('Lỗi lưu cảm xúc: ' + error.message); loadFeed(); }
  };

  const addComment = async (postId, parentId, text) => {
    const t = (text || '').trim();
    if (!t) return;
    if (parentId) { setReplyFor(null); setReplyText(''); }
    else setCommentText(c => ({ ...c, [postId]: '' }));
    const { data, error } = await supabase.from('community_comments')
      .insert({ post_id: postId, author_id: profile.id, content: t, parent_id: parentId || null }).select('*').single();
    if (error) { toast.error(error.message); return; }
    setComments(prev => [...prev, { ...data, author: meUser }]);
  };

  const deletePost = async (id) => {
    if (!window.confirm('Xóa bài viết này?')) return;
    setPosts(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('community_posts').delete().eq('id', id);
    if (error) { toast.error(error.message); loadFeed(); }
  };
  const deleteComment = async (id) => {
    setComments(prev => prev.filter(c => c.id !== id && c.parent_id !== id));
    const { error } = await supabase.from('community_comments').delete().eq('id', id);
    if (error) { toast.error(error.message); loadFeed(); }
  };

  // Render 1 comment (kèm reaction + reply)
  const renderComment = (c, isReply = false) => {
    const cl = cLikes.filter(l => l.comment_id === c.id);
    const mine = myCmtReaction(c.id);
    return (
      <div key={c.id} className={`flex gap-2 group ${isReply ? 'ml-10' : ''}`}>
        <Avatar url={c.author?.avatar_url} name={c.author?.full_name} size="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2 inline-block max-w-full relative">
            <div className="text-[12.5px] font-semibold text-slate-800">{c.author?.full_name || 'Nhân sự'}</div>
            <div className="text-[14px] text-slate-700 whitespace-pre-wrap break-words">{renderMentions(c.content)}</div>
            {cl.length > 0 && (
              <div className="absolute -bottom-2 right-1 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 text-[11px] shadow-soft flex items-center gap-0.5">
                {[...new Set(cl.map(l => l.reaction))].slice(0, 3).map(r => <span key={r}>{EMOJI_OF[r]}</span>)} {cl.length}
              </div>
            )}
          </div>
          <div className="text-[12px] text-slate-400 mt-1 ml-2 flex items-center gap-3 relative">
            <span>{timeAgo(c.created_at)}</span>
            <button onClick={() => setCPickerFor(cPickerFor === c.id ? null : c.id)} className={`font-semibold ${mine ? 'text-teal-700' : 'hover:text-teal-700'}`}>
              {mine ? `${EMOJI_OF[mine]} ${LABEL_OF[mine]}` : 'Thích'}
            </button>
            {!isReply && <button onClick={() => { setReplyFor(c.id); setReplyText(''); }} className="font-semibold hover:text-teal-700">Trả lời</button>}
            {(c.author_id === profile?.id || isAdmin) && <button onClick={() => deleteComment(c.id)} className="text-danger-500 hover:text-danger-600 font-semibold">Xóa</button>}
            {cPickerFor === c.id && <ReactionBar onPick={(k) => reactComment(c.id, k)} />}
          </div>

          {/* Reply composer */}
          {replyFor === c.id && (
            <div className="flex gap-2 items-center mt-2">
              <Avatar url={profile?.avatar_url} name={profile?.full_name} size="w-7 h-7" />
              <MentionInput value={replyText} onChange={setReplyText} staff={mentionStaff}
                onEnter={() => addComment(c.post_id, c.id, replyText)}
                placeholder={`Trả lời ${c.author?.full_name || ''}... (@ tag nhân sự · # SĐT tag khách)`}
                className="w-full h-9 bg-white rounded-full px-3.5 text-[14px] border border-slate-200 focus:outline-none focus:border-teal-400" />
              <TimeButton size="p-1.5" onPick={(label) => setReplyText(t => joinText(t, label))} />
              <button onClick={() => addComment(c.post_id, c.id, replyText)} className="p-1.5 rounded-full text-teal-700 hover:bg-teal-50"><Send className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Tab group (kiểu e-tabs Ethics) + nút tạo group */}
      <div className="flex items-end gap-3">
      {groups.length > 0 && (
        <div className="e-tabs flex-1 min-w-0">
          {groups.map(g => (
            <button key={g.id} onClick={() => setGroupId(g.id)}
              className={`e-tab ${groupId === g.id ? 'e-tab-active' : ''}`}>
              <Users className="w-3.5 h-3.5" /> {g.name}
            </button>
          ))}
        </div>
      )}
      {isAdmin && (
        <div className="shrink-0 pb-1.5">
          <button onClick={() => setShowGroupModal(true)} className="e-btn e-btn-outline e-btn-sm">
            <Plus className="w-4 h-4" /> Tạo group
          </button>
        </div>
      )}
      </div>

      {/* Thanh thông tin group + quản lý thành viên */}
      {selectedGroup && (
        <div className="e-card-flat flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 text-[14px]">
            <span className="font-semibold text-slate-900">{selectedGroup.name}</span>
            {selectedGroup.description && <span className="ml-2 text-slate-500">{selectedGroup.description}</span>}
          </div>
          {canManageGroup && (
            <button onClick={openMembers} className="e-btn e-btn-ghost e-btn-sm shrink-0">
              <Users className="w-4 h-4" /> Thành viên
            </button>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="e-card e-empty py-12 text-[14px] text-slate-500">
          Chưa có group nào.{isAdmin ? ' Bấm "Tạo group" để bắt đầu.' : ' Liên hệ admin để tạo group.'}
        </div>
      ) : (
      <>
      {/* Composer với trình soạn thảo */}
      <div className="e-card e-card-pad">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề bài viết *"
          className="w-full mb-2 px-1 text-[16px] font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none" />
        <div className="flex items-center gap-1 mb-2 border-b border-slate-100 pb-2">
          <button onMouseDown={e => { e.preventDefault(); document.execCommand('bold'); }} className="w-8 h-8 rounded-lg hover:bg-teal-50 hover:text-teal-700 flex items-center justify-center text-slate-600"><Bold className="w-4 h-4" /></button>
          <button onMouseDown={e => { e.preventDefault(); document.execCommand('italic'); }} className="w-8 h-8 rounded-lg hover:bg-teal-50 hover:text-teal-700 flex items-center justify-center text-slate-600"><Italic className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          {TEXT_COLORS.map(col => (
            <button key={col} onMouseDown={e => { e.preventDefault(); document.execCommand('foreColor', false, col); }}
              className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: col }} title="Màu chữ" />
          ))}
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={detectEditorMention} onKeyDown={handleEditorKeyDown} onBlur={() => setTimeout(() => setEditorMention(null), 200)}
          data-ph="Chia sẻ gì đó với cả nhà... (@ tag nhân sự · # SĐT tag khách)"
          className="community-editor min-h-[60px] text-[15px] text-slate-700 focus:outline-none px-1" />
        {editorMention && editorMention.items.length > 0 && (
          <div className="fixed w-72 bg-white border border-slate-200 rounded-xl shadow-float z-[60] overflow-hidden"
            style={{ top: editorMention.rect.bottom + 4, left: editorMention.rect.left }}>
            {editorMention.items.map((it, i) => (
              <button key={it.type + it.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickEditorMention(it); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${i === emActive ? 'bg-teal-50' : ''} hover:bg-teal-50`}>
                <span className="font-medium text-slate-700">{it.type === 'cust' ? '👤 ' : '@'}{it.name}</span>
                <span className="text-[12px] text-slate-400">{it.type === 'cust' ? '📞 ' + it.sub : it.sub}</span>
              </button>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {files.map((f, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <label className="e-btn e-btn-ghost e-btn-sm cursor-pointer">
            <ImageIcon className="w-5 h-5" /> Ảnh
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => setFiles(fs => [...fs, ...Array.from(e.target.files || [])])} />
          </label>
          <button onClick={handlePost} disabled={posting} className="e-btn e-btn-primary">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Đăng
          </button>
        </div>
      </div>

      {/* Toggle Bảng tin / Danh sách */}
      <div className="e-seg">
        {[['feed', 'Bảng tin'], ['list', 'Danh sách bài viết']].map(([id, label]) => (
          <button key={id} onClick={() => setViewMode(id)} className={`e-seg-item ${viewMode === id ? 'e-seg-active' : ''}`}>{label}</button>
        ))}
      </div>

      {/* Danh sách bài viết */}
      {viewMode === 'list' && !loading && (
        <div className="e-card overflow-hidden">
          {posts.length === 0 ? (
            <div className="e-empty text-[14px] text-slate-400">Chưa có bài viết nào.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {posts.map(p => {
                const cmt = comments.filter(c => c.post_id === p.id).length;
                const rea = likes.filter(l => l.post_id === p.id).length;
                const excerpt = (p.content || '').replace(MENTION_RE, '@$1').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                return (
                  <button key={p.id} onClick={() => { setViewMode('feed'); setTimeout(() => document.getElementById(`post-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                    className="w-full text-left px-4 lg:px-5 py-3.5 hover:bg-teal-50/30 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{p.title || '(Không tiêu đề)'}</div>
                      {excerpt && <div className="text-[13px] text-slate-500 mt-0.5 line-clamp-1">{excerpt}</div>}
                      <div className="text-[12px] text-slate-400 mt-1">{p.author?.full_name} · {new Date(p.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="text-[12px] text-slate-500 shrink-0 pt-0.5 flex items-center gap-2.5 tabular-nums"><span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> {rea}</span><span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-teal-600" /> {cmt}</span></div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {viewMode === 'feed' && (loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
      ) : posts.length === 0 ? (
        <div className="e-card e-empty py-12 text-[14px] text-slate-500">Chưa có bài viết nào trong group này.</div>
      ) : posts.map(post => {
        const postLikes = likes.filter(l => l.post_id === post.id);
        const topComments = comments.filter(c => c.post_id === post.id && !c.parent_id);
        const repliesOf = (cid) => comments.filter(c => c.parent_id === cid);
        const totalComments = comments.filter(c => c.post_id === post.id).length;
        const myReaction = myPostReaction(post.id);
        const reactionSet = [...new Set(postLikes.map(l => l.reaction))];
        return (
          <div key={post.id} id={`post-${post.id}`} className="e-card overflow-hidden scroll-mt-20">
            <div className="flex items-start justify-between px-4 lg:px-5 pt-4 lg:pt-5 pb-2">
              <div className="flex items-center gap-3">
                <Avatar url={post.author?.avatar_url} name={post.author?.full_name} size="w-11 h-11" />
                <div>
                  <div className="text-[15px] font-semibold text-slate-900">{post.author?.full_name || 'Nhân sự'}</div>
                  <div className="text-[12px] text-slate-400">{timeAgo(post.created_at)}</div>
                </div>
              </div>
              {(post.author_id === profile?.id || isAdmin) && (
                <button onClick={() => deletePost(post.id)} className="e-icon-btn w-8 h-8 rounded-[10px] border-transparent text-slate-400 hover:!text-danger-600 hover:bg-danger-50 hover:!border-transparent"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>

            {post.title && <div className="px-4 lg:px-5 pb-1 font-bold text-slate-900 text-[16px]">{post.title}</div>}
            {post.content && <div className="px-4 lg:px-5 pb-3 text-slate-700 text-[15px] leading-relaxed break-words" onClick={handlePostContentClick} dangerouslySetInnerHTML={{ __html: renderPostHtml(post.content) }} />}
            {post.image_urls?.length > 0 && (
              <div className={`grid gap-0.5 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.image_urls.map((u, i) => (
                  <button key={i} type="button" onClick={() => setLightbox({ urls: post.image_urls, index: i })} className="block overflow-hidden">
                    <img src={u} alt="" className="w-full max-h-96 object-cover cursor-zoom-in hover:opacity-95 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {(postLikes.length > 0 || totalComments > 0) && (
              <div className="flex items-center justify-between px-4 lg:px-5 py-2 text-[13px] text-slate-500">
                <button onClick={() => postLikes.length && setReactWho({ post, list: postLikes })} className="flex items-center gap-1 hover:underline" disabled={!postLikes.length}>
                  {reactionSet.slice(0, 3).map(r => <span key={r}>{EMOJI_OF[r] || '👍'}</span>)}
                  {postLikes.length > 0 && <span className="ml-1">{postLikes.length}</span>}
                </button>
                {totalComments > 0 && <span>{totalComments} bình luận</span>}
              </div>
            )}

            <div className="flex border-t border-slate-100 relative px-2 py-1">
              <button onClick={() => setPickerFor(pickerFor === post.id ? null : post.id)}
                className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[14px] font-semibold hover:bg-teal-50/60 ${myReaction ? 'text-teal-700' : 'text-slate-500'}`}>
                {myReaction ? <span>{EMOJI_OF[myReaction]}</span> : <Smile className="w-4 h-4" />}
                {myReaction ? LABEL_OF[myReaction] : 'Cảm xúc'}
              </button>
              <button onClick={() => setOpenComments(o => ({ ...o, [post.id]: !o[post.id] }))}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[14px] font-semibold text-slate-500 hover:bg-teal-50/60">
                <MessageCircle className="w-4 h-4" /> Bình luận
              </button>
              {pickerFor === post.id && <ReactionBar onPick={(k) => reactPost(post.id, k)} />}
            </div>

            {openComments[post.id] && (
              <div className="border-t border-slate-100 px-4 lg:px-5 py-4 space-y-3">
                {topComments.map(c => (
                  <div key={c.id} className="space-y-3">
                    {renderComment(c)}
                    {repliesOf(c.id).map(r => renderComment(r, true))}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {QUICK_COMMENTS.map(q => (
                    <button key={q} onClick={() => setCommentText(c => ({ ...c, [post.id]: joinText(c[post.id], q) }))}
                      className="e-chip h-8 px-3 text-[12px]">
                      + {q}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <Avatar url={profile?.avatar_url} name={profile?.full_name} size="w-8 h-8" />
                  <MentionInput value={commentText[post.id] || ''} onChange={(v) => setCommentText(c => ({ ...c, [post.id]: v }))} staff={mentionStaff}
                    onEnter={() => addComment(post.id, null, commentText[post.id])}
                    placeholder="Viết bình luận... (@ tag nhân sự · # SĐT tag khách)"
                    className="w-full h-10 bg-slate-50 rounded-full px-4 text-[14px] border border-slate-200 focus:outline-none focus:bg-white focus:border-teal-400" />
                  <TimeButton onPick={(label) => setCommentText(c => ({ ...c, [post.id]: joinText(c[post.id], label) }))} />
                  <button onClick={() => addComment(post.id, null, commentText[post.id])} className="e-icon-btn w-10 h-10 rounded-full text-teal-700 shrink-0"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        );
      }))}
      </>
      )}

      {/* Modal quản lý thành viên */}
      {showMembers && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4" onClick={() => setShowMembers(false)}>
          <div className="e-modal max-w-md overflow-hidden flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Thành viên · {selectedGroup?.name}</h3>
              <button onClick={() => setShowMembers(false)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              <div>
                <div className="e-caption mb-2">Đang trong group ({members.length})</div>
                <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.user_id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-teal-50/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar url={m.user?.avatar_url} name={m.user?.full_name} size="w-8 h-8" />
                        <span className="text-[14px] font-medium text-slate-800 truncate">{m.user?.full_name}</span>
                      </div>
                      {m.user_id !== selectedGroup?.created_by && (
                        <button onClick={() => removeMember(m.user_id)} className="e-btn e-btn-danger-soft e-btn-sm shrink-0">Xóa</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="e-caption mb-2">Thêm thành viên</div>
                <div className="space-y-1">
                  {allStaff.filter(s => !members.some(m => m.user_id === s.id)).map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-teal-50/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar url={s.avatar_url} name={s.full_name} size="w-8 h-8" />
                        <span className="text-[14px] text-slate-700 truncate">{s.full_name}</span>
                      </div>
                      <button onClick={() => addMember(s.id)} className="e-btn e-btn-outline e-btn-sm shrink-0"><Plus className="w-3.5 h-3.5" /> Thêm</button>
                    </div>
                  ))}
                  {allStaff.filter(s => !members.some(m => m.user_id === s.id)).length === 0 && (
                    <div className="text-[13px] text-slate-400 text-center py-3">Tất cả nhân sự đã trong group.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thông tin khách hàng (khi bấm tag khách) */}
      {customerView && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4" onClick={() => setCustomerView(null)}>
          <div className="e-modal max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Thông tin khách hàng</h3>
              <button onClick={() => setCustomerView(null)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body space-y-3">
              <div>
                <div className="text-[18px] font-bold text-slate-900">{customerView.customer_name}</div>
                <a href={`tel:${customerView.phone}`} className="text-[14px] font-medium text-teal-700 flex items-center gap-1.5 mt-1"><Phone className="w-3.5 h-3.5" /> {customerView.phone}</a>
              </div>
              <div className="e-subtle grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px] p-3.5">
                <div className="e-kv-label">Dịch vụ</div><div className="text-right font-medium text-slate-700">{customerView.service || '—'}</div>
                <div className="e-kv-label">Trạng thái</div><div className="text-right text-slate-700">{customerView.status}</div>
                <div className="e-kv-label">Telesale</div><div className="text-right text-slate-700">{customerView.telesale || '—'}</div>
                <div className="e-kv-label">Sale</div><div className="text-right text-slate-700">{customerView.sale || '—'}</div>
                {customerView.surgery_date && (<><div className="e-kv-label">Ngày mổ</div><div className="text-right text-slate-700">{new Date(customerView.surgery_date).toLocaleDateString('vi-VN')}</div></>)}
              </div>
              {customerView.notes && <div className="text-[13px] text-slate-600 bg-warning-50/60 border border-warning-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">{customerView.notes}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox xem ảnh */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
          {lightbox.urls.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, index: (l.index - 1 + l.urls.length) % l.urls.length })); }}
                className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>
              <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, index: (l.index + 1) % l.urls.length })); }}
                className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"><ChevronRight className="w-6 h-6" /></button>
            </>
          )}
          <img src={lightbox.urls[lightbox.index]} alt="" onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[88dvh] rounded-2xl shadow-2xl object-contain" />
          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/15 text-white text-sm px-3 py-1 rounded-full">
              {lightbox.index + 1} / {lightbox.urls.length}
            </div>
          )}
        </div>
      )}

      {/* Modal: ai đã thả cảm xúc */}
      {reactWho && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4" onClick={() => setReactWho(null)}>
          <div className="e-modal max-w-sm overflow-hidden max-h-[80dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Cảm xúc ({reactWho.list.length})</h3>
              <button onClick={() => setReactWho(null)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {reactWho.list.map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-teal-50/40">
                  <div className="relative">
                    <Avatar url={l.user?.avatar_url} name={l.user?.full_name} size="w-9 h-9" />
                    <span className="absolute -bottom-1 -right-1 text-sm">{EMOJI_OF[l.reaction]}</span>
                  </div>
                  <span className="text-[14px] font-medium text-slate-800">{l.user?.full_name || 'Nhân sự'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo group */}
      {showGroupModal && (
        <div className="e-modal-backdrop z-50 flex items-center justify-center p-4">
          <div className="e-modal max-w-md overflow-hidden">
            <div className="e-modal-header items-center">
              <h3 className="e-modal-title">Tạo group mới</h3>
              <button onClick={() => setShowGroupModal(false)} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <div className="e-modal-body space-y-3">
              <div>
                <label className="e-label">Tên group *</label>
                <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Hành trình khách hàng"
                  className="e-input" />
              </div>
              <div>
                <label className="e-label">Mô tả</label>
                <textarea rows={2} value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                  className="e-textarea resize-none" />
              </div>
            </div>
            <div className="e-modal-footer">
              <button onClick={() => setShowGroupModal(false)} className="e-btn e-btn-secondary">Hủy</button>
              <button onClick={createGroup} className="e-btn e-btn-primary">Tạo group</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.community-editor:empty:before{content:attr(data-ph);color:#94a3b8;pointer-events:none;}`}</style>
    </div>
  );
};

export default CommunityPage;
