import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Bell, Check, Loader2 } from 'lucide-react';
import { NOTIF_ICON, NOTIF_FALLBACK, resolveNotifLink } from '@/lib/notif';

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
    const dest = resolveNotifLink(n.link, n.type);
    if (dest) window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: dest }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 group/nf nf-root">
      <div className="e-toolbar justify-between pl-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="e-metric-icon w-9 h-9 lg:w-9 lg:h-9"><Bell className="!w-[18px] !h-[18px]" /></span>
          <p className="text-[14px] font-semibold text-slate-700 truncate">{unread > 0 ? `${unread} thông báo chưa đọc` : 'Đã đọc tất cả'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="e-btn e-btn-outline e-btn-sm shrink-0">
            <Check className="w-4 h-4" /> Đánh dấu đã đọc hết
          </button>
        )}
      </div>

      {/* Điện thoại: bộ lọc "Tất cả / Chưa đọc" (Ethics M14) — chỉ lọc hiển thị bằng CSS trên danh sách đang có, không gọi server */}
      <div className="lg:hidden grid grid-cols-2 p-1 rounded-xl bg-white border border-slate-200 shadow-soft" role="radiogroup" aria-label="Lọc thông báo">
        <label className="h-10 rounded-[9px] grid place-items-center text-[14px] font-medium text-slate-500 cursor-pointer select-none transition has-[:checked]:bg-teal-50 has-[:checked]:text-teal-800 has-[:checked]:font-semibold">
          <input type="radio" name="notif-filter" defaultChecked className="sr-only" />Tất cả
        </label>
        <label className="h-10 rounded-[9px] grid place-items-center text-[14px] font-medium text-slate-500 cursor-pointer select-none transition has-[:checked]:bg-teal-50 has-[:checked]:text-teal-800 has-[:checked]:font-semibold">
          <input type="radio" name="notif-filter" className="sr-only nf-unread" /><span>Chưa đọc ({unread})</span>
        </label>
      </div>

      <div className="e-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
        ) : items.length === 0 ? (
          <div className="e-empty py-16 text-[14px] font-semibold text-slate-700">
            <Bell className="w-12 h-12 p-3 rounded-full bg-teal-50 text-teal-600 mb-3" />
            Chưa có thông báo nào
          </div>
        ) : (
          <div className="divide-y divide-slate-100 p-1.5 sm:p-2">
            {items.map(n => {
              const conf = NOTIF_ICON[n.type] || NOTIF_FALLBACK;
              const { Icon } = conf;
              return (
                <button key={n.id} onClick={() => openItem(n)}
                  className={`w-full text-left flex items-start gap-3.5 px-3 sm:px-4 py-3.5 rounded-xl hover:bg-teal-50/40 transition-colors ${n.is_read ? 'max-lg:group-has-[.nf-unread:checked]/nf:hidden' : 'bg-teal-50/50 nf-u'}`}>
                  {n.actor?.avatar_url ? (
                    <div className="relative shrink-0">
                      <img src={n.actor.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-soft" />
                      <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white ${conf.cls}`}><Icon className="w-3 h-3" /></span>
                    </div>
                  ) : (
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${conf.cls}`}><Icon className="w-5 h-5" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`text-[14px] leading-snug ${n.is_read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</div>
                    {n.body && <div className="text-[13px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[12px] text-slate-400 mt-1 tabular-nums">{fullTime(n.created_at)}</div>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0 mt-2" />}
                </button>
              );
            })}
            <div className="hidden max-lg:[.nf-root:has(.nf-unread:checked):not(:has(.nf-u))_&]:block py-12 text-center text-[14px] font-medium text-slate-400">Không có thông báo chưa đọc</div>
          </div>
        )}
      </div>
    </div>
  );
}
