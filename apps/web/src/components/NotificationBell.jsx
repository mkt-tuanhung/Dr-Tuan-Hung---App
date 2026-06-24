import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { Bell, Check, MessageCircle, Wallet, UserPlus, Heart } from 'lucide-react';

const ICON_OF = {
  expense_approved: { Icon: Wallet, cls: 'bg-emerald-100 text-emerald-600' },
  expense_paid: { Icon: Wallet, cls: 'bg-emerald-100 text-emerald-600' },
  community_post: { Icon: MessageCircle, cls: 'bg-blue-100 text-blue-600' },
  community_comment: { Icon: MessageCircle, cls: 'bg-indigo-100 text-indigo-600' },
  community_reply: { Icon: MessageCircle, cls: 'bg-indigo-100 text-indigo-600' },
  community_like: { Icon: Heart, cls: 'bg-pink-100 text-pink-600' },
  member_added: { Icon: UserPlus, cls: 'bg-violet-100 text-violet-600' },
};

const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày`;
  return new Date(d).toLocaleDateString('vi-VN');
};

export default function NotificationBell() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  const unread = items.filter(i => !i.is_read).length;

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('notifications')
      .select('*, actor:profiles!actor_id(full_name, avatar_url)')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    setItems(data || []);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: thông báo mới → thêm vào đầu + popup
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase.channel('noti-' + profile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        async (payload) => {
          let actor = null;
          if (payload.new.actor_id) {
            const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', payload.new.actor_id).single();
            actor = data;
          }
          setItems(prev => [{ ...payload.new, actor }, ...prev]);
          toast(payload.new.title, { description: payload.new.body || undefined, icon: '🔔' });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  // Đóng khi click ngoài
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const markAllRead = async () => {
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
  };

  const openItem = async (n) => {
    if (!n.is_read) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i));
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    setOpen(false);
    if (n.link) window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: n.link }));
  };

  const Avatar = ({ n }) => {
    const conf = ICON_OF[n.type] || { Icon: Bell, cls: 'bg-slate-100 text-slate-500' };
    const { Icon } = conf;
    if (n.actor?.avatar_url) {
      return (
        <div className="relative shrink-0">
          <img src={n.actor.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${conf.cls}`}><Icon className="w-3 h-3" /></span>
        </div>
      );
    }
    return <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${conf.cls}`}><Icon className="w-5 h-5" /></div>;
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="relative w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-bold text-slate-800">Thông báo</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">Chưa có thông báo nào</div>
            ) : items.map(n => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${n.is_read ? '' : 'bg-emerald-50/40'}`}>
                <Avatar n={n} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 leading-snug">{n.title}</div>
                  {n.body && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[11px] text-emerald-600 font-medium mt-1">{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
