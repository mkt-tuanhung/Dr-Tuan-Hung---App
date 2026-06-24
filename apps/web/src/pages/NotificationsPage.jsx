import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Bell, Check, MessageCircle, Wallet, UserPlus, Heart, Loader2 } from 'lucide-react';

const ICON_OF = {
  expense_approved: { Icon: Wallet, cls: 'bg-emerald-100 text-emerald-600' },
  expense_paid: { Icon: Wallet, cls: 'bg-emerald-100 text-emerald-600' },
  community_post: { Icon: MessageCircle, cls: 'bg-blue-100 text-blue-600' },
  community_comment: { Icon: MessageCircle, cls: 'bg-indigo-100 text-indigo-600' },
  community_reply: { Icon: MessageCircle, cls: 'bg-indigo-100 text-indigo-600' },
  community_like: { Icon: Heart, cls: 'bg-pink-100 text-pink-600' },
  member_added: { Icon: UserPlus, cls: 'bg-violet-100 text-violet-600' },
};

const fullTime = (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase.from('notifications')
      .select('*, actor:profiles!actor_id(full_name, avatar_url)')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(200);
    setItems(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const unread = items.filter(i => !i.is_read).length;

  const markAllRead = async () => {
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
  };

  const openItem = async (n) => {
    if (!n.is_read) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i));
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    if (n.link) window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: n.link }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Thông báo</h2>
          <p className="text-sm text-slate-400">{unread > 0 ? `${unread} thông báo chưa đọc` : 'Đã đọc tất cả'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50">
            <Check className="w-4 h-4" /> Đánh dấu đã đọc hết
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            Chưa có thông báo nào
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map(n => {
              const conf = ICON_OF[n.type] || { Icon: Bell, cls: 'bg-slate-100 text-slate-500' };
              const { Icon } = conf;
              return (
                <button key={n.id} onClick={() => openItem(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors ${n.is_read ? '' : 'bg-emerald-50/40'}`}>
                  {n.actor?.avatar_url ? (
                    <div className="relative shrink-0">
                      <img src={n.actor.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                      <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${conf.cls}`}><Icon className="w-3 h-3" /></span>
                    </div>
                  ) : (
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${conf.cls}`}><Icon className="w-5 h-5" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-800 leading-snug">{n.title}</div>
                    {n.body && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{fullTime(n.created_at)}</div>
                  </div>
                  {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
