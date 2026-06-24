import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { Image as ImageIcon, Send, X, Trash2, MessageCircle, Loader2, Smile } from 'lucide-react';

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Thích' },
  { key: 'love', emoji: '❤️', label: 'Yêu thích' },
  { key: 'haha', emoji: '😆', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Buồn' },
  { key: 'angry', emoji: '😡', label: 'Phẫn nộ' },
];
const EMOJI_OF = Object.fromEntries(REACTIONS.map(r => [r.key, r.emoji]));

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

const CommunityPage = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);

  // Composer
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);

  // UI state
  const [pickerFor, setPickerFor] = useState(null);
  const [openComments, setOpenComments] = useState({});
  const [commentText, setCommentText] = useState({});

  const loadFeed = useCallback(async () => {
    setLoading(true);
    const { data: postData, error } = await supabase
      .from('community_posts')
      .select('*, author:profiles!author_id(full_name, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) { toast.error('Lỗi tải bảng tin: ' + error.message); setLoading(false); return; }
    const ids = (postData || []).map(p => p.id);
    const safe = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
    const [likeRes, cmtRes] = await Promise.all([
      supabase.from('community_likes').select('post_id, user_id, reaction').in('post_id', safe),
      supabase.from('community_comments').select('*, author:profiles!author_id(full_name, avatar_url)').in('post_id', safe).is('deleted_at', null).order('created_at', { ascending: true }),
    ]);
    setPosts(postData || []);
    setLikes(likeRes.data || []);
    setComments(cmtRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handlePost = async () => {
    if (!content.trim() && files.length === 0) { toast.error('Nhập nội dung hoặc thêm ảnh'); return; }
    setPosting(true);
    try {
      const image_urls = [];
      for (const f of files) image_urls.push(await uploadToR2(f, 'community'));
      const { error } = await supabase.from('community_posts').insert({
        author_id: profile.id, content: content.trim() || null, image_urls,
      });
      if (error) throw error;
      setContent(''); setFiles([]);
      loadFeed();
    } catch (err) { toast.error(err.message); }
    finally { setPosting(false); }
  };

  const myReactionOf = (postId) => likes.find(l => l.post_id === postId && l.user_id === profile?.id)?.reaction || null;

  const react = async (postId, key) => {
    setPickerFor(null);
    const current = myReactionOf(postId);
    try {
      if (current === key) {
        await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', profile.id);
      } else {
        await supabase.from('community_likes').upsert({ post_id: postId, user_id: profile.id, reaction: key }, { onConflict: 'post_id,user_id' });
      }
      loadFeed();
    } catch (err) { toast.error(err.message); }
  };

  const addComment = async (postId) => {
    const text = (commentText[postId] || '').trim();
    if (!text) return;
    const { error } = await supabase.from('community_comments').insert({ post_id: postId, author_id: profile.id, content: text });
    if (error) { toast.error(error.message); return; }
    setCommentText(c => ({ ...c, [postId]: '' }));
    loadFeed();
  };

  const deletePost = async (id) => {
    if (!window.confirm('Xóa bài viết này?')) return;
    const { error } = await supabase.from('community_posts').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    loadFeed();
  };

  const deleteComment = async (id) => {
    const { error } = await supabase.from('community_comments').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    loadFeed();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-2xl font-bold text-slate-800">Cộng đồng</h2>

      {/* Composer */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <div className="flex gap-3">
          <Avatar url={profile?.avatar_url} name={profile?.full_name} />
          <textarea
            value={content} onChange={e => setContent(e.target.value)}
            placeholder={`${profile?.full_name || 'Bạn'} ơi, chia sẻ gì đó với cả nhà...`}
            rows={2}
            className="flex-1 resize-none bg-slate-50 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 border border-transparent focus:border-emerald-300"
          />
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pl-13">
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
          <button onClick={handlePost} disabled={posting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-md disabled:opacity-50">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Đăng
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 shadow-sm">Chưa có bài viết nào. Hãy là người đầu tiên!</div>
      ) : posts.map(post => {
        const postLikes = likes.filter(l => l.post_id === post.id);
        const postComments = comments.filter(c => c.post_id === post.id);
        const myReaction = myReactionOf(post.id);
        // Tổng hợp các loại reaction xuất hiện
        const reactionSet = [...new Set(postLikes.map(l => l.reaction))];
        return (
          <div key={post.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm">
            {/* Header */}
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

            {/* Content */}
            {post.content && <div className="px-4 pb-3 text-slate-700 whitespace-pre-wrap text-[15px]">{post.content}</div>}
            {post.image_urls?.length > 0 && (
              <div className={`grid gap-0.5 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.image_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
                    <img src={u} alt="" className="w-full max-h-96 object-cover" />
                  </a>
                ))}
              </div>
            )}

            {/* Reaction summary */}
            {(postLikes.length > 0 || postComments.length > 0) && (
              <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  {reactionSet.slice(0, 3).map(r => <span key={r}>{EMOJI_OF[r] || '👍'}</span>)}
                  {postLikes.length > 0 && <span className="ml-1">{postLikes.length}</span>}
                </div>
                {postComments.length > 0 && <span>{postComments.length} bình luận</span>}
              </div>
            )}

            {/* Actions */}
            <div className="flex border-t border-slate-50 relative">
              <button onClick={() => setPickerFor(pickerFor === post.id ? null : post.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold hover:bg-slate-50 ${myReaction ? 'text-emerald-600' : 'text-slate-500'}`}>
                {myReaction ? <span>{EMOJI_OF[myReaction]}</span> : <Smile className="w-4 h-4" />}
                {myReaction ? REACTIONS.find(r => r.key === myReaction)?.label : 'Cảm xúc'}
              </button>
              <button onClick={() => setOpenComments(o => ({ ...o, [post.id]: !o[post.id] }))}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                <MessageCircle className="w-4 h-4" /> Bình luận
              </button>

              {pickerFor === post.id && (
                <div className="absolute bottom-12 left-2 bg-white border border-slate-200 rounded-full shadow-lg px-2 py-1.5 flex gap-1 z-10">
                  {REACTIONS.map(r => (
                    <button key={r.key} onClick={() => react(post.id, r.key)} title={r.label}
                      className="text-2xl hover:scale-125 transition-transform">{r.emoji}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            {openComments[post.id] && (
              <div className="border-t border-slate-50 p-4 space-y-3 bg-slate-50/30">
                {postComments.map(c => (
                  <div key={c.id} className="flex gap-2 group">
                    <Avatar url={c.author?.avatar_url} name={c.author?.full_name} size="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="bg-white rounded-2xl px-3 py-2 inline-block max-w-full">
                        <div className="text-xs font-semibold text-slate-700">{c.author?.full_name || 'Nhân sự'}</div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{c.content}</div>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 ml-2 flex items-center gap-2">
                        {timeAgo(c.created_at)}
                        {(c.author_id === profile?.id || isAdmin) && (
                          <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500">Xóa</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 items-center">
                  <Avatar url={profile?.avatar_url} name={profile?.full_name} size="w-8 h-8" />
                  <input
                    value={commentText[post.id] || ''}
                    onChange={e => setCommentText(c => ({ ...c, [post.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addComment(post.id); }}
                    placeholder="Viết bình luận..."
                    className="flex-1 bg-white rounded-full px-4 py-2 text-sm border border-slate-200 focus:outline-none focus:border-emerald-400"
                  />
                  <button onClick={() => addComment(post.id)} className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CommunityPage;
