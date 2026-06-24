import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Image as ImageIcon, Send, X, Trash2, MessageCircle, Loader2, Smile, Plus, Users, Bold, Italic, Reply } from 'lucide-react';

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
const TEXT_COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

// Làm sạch HTML soạn thảo: chỉ giữ định dạng cơ bản + màu chữ
const sanitizeHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  tmp.querySelectorAll('script, style, iframe, link, meta, object, embed').forEach(e => e.remove());
  tmp.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      if (a.name === 'style') {
        const color = el.style.color; el.removeAttribute('style'); if (color) el.style.color = color;
      } else if (a.name !== 'href') {
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
  <div className={`${size} rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white font-bold shrink-0`}>
    {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : (name?.charAt(0) || 'U')}
  </div>
);

// Thanh chọn cảm xúc (popover)
const ReactionBar = ({ onPick }) => (
  <div className="absolute bottom-9 left-0 bg-white border border-slate-200 rounded-full shadow-lg px-2 py-1.5 flex gap-1 z-20">
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

  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);

  const [pickerFor, setPickerFor] = useState(null);      // post id
  const [cPickerFor, setCPickerFor] = useState(null);    // comment id
  const [openComments, setOpenComments] = useState({});
  const [commentText, setCommentText] = useState({});    // postId -> text (top-level)
  const [replyFor, setReplyFor] = useState(null);        // comment id
  const [replyText, setReplyText] = useState('');
  const [reactWho, setReactWho] = useState(null);        // { post, list }

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
    toast.success('Đã tạo group');
    setShowGroupModal(false); setGroupForm({ name: '', description: '' });
    await loadGroups(); if (data) setGroupId(data.id);
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
    if (!plain && files.length === 0) { toast.error('Nhập nội dung hoặc thêm ảnh'); return; }
    setPosting(true);
    try {
      const image_urls = [];
      for (const f of files) image_urls.push(await uploadToR2(f, 'community'));
      const { error } = await supabase.from('community_posts').insert({
        group_id: groupId, author_id: profile.id, content: plain ? html : null, image_urls,
      });
      if (error) throw error;
      if (editorRef.current) editorRef.current.innerHTML = '';
      setFiles([]); loadFeed();
    } catch (err) { toast.error(err.message); }
    finally { setPosting(false); }
  };

  // ----- Post reactions -----
  const myPostReaction = (postId) => likes.find(l => l.post_id === postId && l.user_id === profile?.id)?.reaction || null;
  const reactPost = async (postId, key) => {
    setPickerFor(null);
    const cur = myPostReaction(postId);
    if (cur === key) await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', profile.id);
    else await supabase.from('community_likes').upsert({ post_id: postId, user_id: profile.id, reaction: key }, { onConflict: 'post_id,user_id' });
    loadFeed();
  };

  // ----- Comment reactions -----
  const myCmtReaction = (cid) => cLikes.find(l => l.comment_id === cid && l.user_id === profile?.id)?.reaction || null;
  const reactComment = async (cid, key) => {
    setCPickerFor(null);
    const cur = myCmtReaction(cid);
    if (cur === key) await supabase.from('community_comment_likes').delete().eq('comment_id', cid).eq('user_id', profile.id);
    else await supabase.from('community_comment_likes').upsert({ comment_id: cid, user_id: profile.id, reaction: key }, { onConflict: 'comment_id,user_id' });
    loadFeed();
  };

  const addComment = async (postId, parentId, text) => {
    const t = (text || '').trim();
    if (!t) return;
    const { error } = await supabase.from('community_comments').insert({ post_id: postId, author_id: profile.id, content: t, parent_id: parentId || null });
    if (error) { toast.error(error.message); return; }
    if (parentId) { setReplyFor(null); setReplyText(''); }
    else setCommentText(c => ({ ...c, [postId]: '' }));
    loadFeed();
  };

  const deletePost = async (id) => { if (!window.confirm('Xóa bài viết này?')) return; const { error } = await supabase.from('community_posts').delete().eq('id', id); if (error) toast.error(error.message); else loadFeed(); };
  const deleteComment = async (id) => { const { error } = await supabase.from('community_comments').delete().eq('id', id); if (error) toast.error(error.message); else loadFeed(); };

  // Render 1 comment (kèm reaction + reply)
  const renderComment = (c, isReply = false) => {
    const cl = cLikes.filter(l => l.comment_id === c.id);
    const mine = myCmtReaction(c.id);
    return (
      <div key={c.id} className={`flex gap-2 group ${isReply ? 'ml-10' : ''}`}>
        <Avatar url={c.author?.avatar_url} name={c.author?.full_name} size="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl px-3 py-2 inline-block max-w-full relative">
            <div className="text-xs font-semibold text-slate-700">{c.author?.full_name || 'Nhân sự'}</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{c.content}</div>
            {cl.length > 0 && (
              <div className="absolute -bottom-2 right-1 bg-white border border-slate-100 rounded-full px-1.5 py-0.5 text-[11px] shadow-sm flex items-center gap-0.5">
                {[...new Set(cl.map(l => l.reaction))].slice(0, 3).map(r => <span key={r}>{EMOJI_OF[r]}</span>)} {cl.length}
              </div>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 ml-2 flex items-center gap-3 relative">
            <span>{timeAgo(c.created_at)}</span>
            <button onClick={() => setCPickerFor(cPickerFor === c.id ? null : c.id)} className={`font-semibold ${mine ? 'text-emerald-600' : 'hover:text-slate-600'}`}>
              {mine ? `${EMOJI_OF[mine]} ${LABEL_OF[mine]}` : 'Thích'}
            </button>
            {!isReply && <button onClick={() => { setReplyFor(c.id); setReplyText(''); }} className="font-semibold hover:text-slate-600">Trả lời</button>}
            {(c.author_id === profile?.id || isAdmin) && <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500">Xóa</button>}
            {cPickerFor === c.id && <ReactionBar onPick={(k) => reactComment(c.id, k)} />}
          </div>

          {/* Reply composer */}
          {replyFor === c.id && (
            <div className="flex gap-2 items-center mt-2">
              <Avatar url={profile?.avatar_url} name={profile?.full_name} size="w-7 h-7" />
              <input autoFocus value={replyText} onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addComment(c.post_id, c.id, replyText); }}
                placeholder={`Trả lời ${c.author?.full_name || ''}...`}
                className="flex-1 bg-white rounded-full px-3 py-1.5 text-sm border border-slate-200 focus:outline-none focus:border-emerald-400" />
              <button onClick={() => addComment(c.post_id, c.id, replyText)} className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50"><Send className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Cộng đồng</h2>
        {isAdmin && (
          <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50">
            <Plus className="w-4 h-4" /> Tạo group
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {groups.map(g => (
            <button key={g.id} onClick={() => setGroupId(g.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${groupId === g.id ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800'}`}>
              <Users className="w-3.5 h-3.5" /> {g.name}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 shadow-sm">
          Chưa có group nào.{isAdmin ? ' Bấm "Tạo group" để bắt đầu.' : ' Liên hệ admin để tạo group.'}
        </div>
      ) : (
      <>
      {/* Composer với trình soạn thảo */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-1 mb-2 border-b border-slate-50 pb-2">
          <button onMouseDown={e => { e.preventDefault(); document.execCommand('bold'); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"><Bold className="w-4 h-4" /></button>
          <button onMouseDown={e => { e.preventDefault(); document.execCommand('italic'); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"><Italic className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          {TEXT_COLORS.map(col => (
            <button key={col} onMouseDown={e => { e.preventDefault(); document.execCommand('foreColor', false, col); }}
              className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: col }} title="Màu chữ" />
          ))}
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          data-ph="Chia sẻ gì đó với cả nhà..."
          className="community-editor min-h-[60px] text-[15px] text-slate-700 focus:outline-none px-1" />
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
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-emerald-600">
            <ImageIcon className="w-5 h-5 text-emerald-500" /> Ảnh
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => setFiles(fs => [...fs, ...Array.from(e.target.files || [])])} />
          </label>
          <button onClick={handlePost} disabled={posting} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Đăng
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 shadow-sm">Chưa có bài viết nào trong group này.</div>
      ) : posts.map(post => {
        const postLikes = likes.filter(l => l.post_id === post.id);
        const topComments = comments.filter(c => c.post_id === post.id && !c.parent_id);
        const repliesOf = (cid) => comments.filter(c => c.parent_id === cid);
        const totalComments = comments.filter(c => c.post_id === post.id).length;
        const myReaction = myPostReaction(post.id);
        const reactionSet = [...new Set(postLikes.map(l => l.reaction))];
        return (
          <div key={post.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between p-4 pb-2">
              <div className="flex items-center gap-3">
                <Avatar url={post.author?.avatar_url} name={post.author?.full_name} />
                <div>
                  <div className="font-semibold text-slate-800">{post.author?.full_name || 'Nhân sự'}</div>
                  <div className="text-xs text-slate-400">{timeAgo(post.created_at)}</div>
                </div>
              </div>
              {(post.author_id === profile?.id || isAdmin) && (
                <button onClick={() => deletePost(post.id)} className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>

            {post.content && <div className="px-4 pb-3 text-slate-700 text-[15px] break-words" dangerouslySetInnerHTML={{ __html: post.content }} />}
            {post.image_urls?.length > 0 && (
              <div className={`grid gap-0.5 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.image_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="block"><img src={u} alt="" className="w-full max-h-96 object-cover" /></a>
                ))}
              </div>
            )}

            {(postLikes.length > 0 || totalComments > 0) && (
              <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-500">
                <button onClick={() => postLikes.length && setReactWho({ post, list: postLikes })} className="flex items-center gap-1 hover:underline" disabled={!postLikes.length}>
                  {reactionSet.slice(0, 3).map(r => <span key={r}>{EMOJI_OF[r] || '👍'}</span>)}
                  {postLikes.length > 0 && <span className="ml-1">{postLikes.length}</span>}
                </button>
                {totalComments > 0 && <span>{totalComments} bình luận</span>}
              </div>
            )}

            <div className="flex border-t border-slate-50 relative">
              <button onClick={() => setPickerFor(pickerFor === post.id ? null : post.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold hover:bg-slate-50 ${myReaction ? 'text-emerald-600' : 'text-slate-500'}`}>
                {myReaction ? <span>{EMOJI_OF[myReaction]}</span> : <Smile className="w-4 h-4" />}
                {myReaction ? LABEL_OF[myReaction] : 'Cảm xúc'}
              </button>
              <button onClick={() => setOpenComments(o => ({ ...o, [post.id]: !o[post.id] }))}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                <MessageCircle className="w-4 h-4" /> Bình luận
              </button>
              {pickerFor === post.id && <ReactionBar onPick={(k) => reactPost(post.id, k)} />}
            </div>

            {openComments[post.id] && (
              <div className="border-t border-slate-50 p-4 space-y-3 bg-slate-50/30">
                {topComments.map(c => (
                  <div key={c.id} className="space-y-3">
                    {renderComment(c)}
                    {repliesOf(c.id).map(r => renderComment(r, true))}
                  </div>
                ))}
                <div className="flex gap-2 items-center">
                  <Avatar url={profile?.avatar_url} name={profile?.full_name} size="w-8 h-8" />
                  <input value={commentText[post.id] || ''} onChange={e => setCommentText(c => ({ ...c, [post.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addComment(post.id, null, commentText[post.id]); }}
                    placeholder="Viết bình luận..."
                    className="flex-1 bg-white rounded-full px-4 py-2 text-sm border border-slate-200 focus:outline-none focus:border-emerald-400" />
                  <button onClick={() => addComment(post.id, null, commentText[post.id])} className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </>
      )}

      {/* Modal: ai đã thả cảm xúc */}
      {reactWho && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setReactWho(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-slate-800">Cảm xúc ({reactWho.list.length})</h3>
              <button onClick={() => setReactWho(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {reactWho.list.map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50">
                  <div className="relative">
                    <Avatar url={l.user?.avatar_url} name={l.user?.full_name} size="w-9 h-9" />
                    <span className="absolute -bottom-1 -right-1 text-sm">{EMOJI_OF[l.reaction]}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700">{l.user?.full_name || 'Nhân sự'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo group */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-emerald-50">
              <h3 className="font-bold text-emerald-800">Tạo group mới</h3>
              <button onClick={() => setShowGroupModal(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Tên group *</label>
                <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Hành trình khách hàng"
                  className="w-full px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Mô tả</label>
                <textarea rows={2} value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-100 bg-emerald-50/30 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>
              <button onClick={createGroup} className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md">Tạo group</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.community-editor:empty:before{content:attr(data-ph);color:#94a3b8;pointer-events:none;}`}</style>
    </div>
  );
};

export default CommunityPage;
