// ============================================================
// KHUNG APP DÙNG CHUNG (Admin + Nhân sự) — theo Ethics Business OS
// - Sidebar SÁNG: logo + wordmark, ô tìm chức năng, menu chia nhóm
//   (• KHÁCH HÀNG / • NHÂN SỰ ...), mục đang chọn tô teal đặc chữ trắng,
//   thẻ khẩu hiệu cuối sidebar.
// - Header desktop: tiêu đề trang lớn + tìm kiếm + chuông + thẻ người dùng.
// - Mobile: header trắng gọn + thanh điều hướng dưới có NÚT NỔI giữa
//   (VD: Chấm công) + "Thêm" mở menu đầy đủ.
// Cuộn theo cả trang (window) như trước -> không ảnh hưởng các trang con.
// ============================================================
import React, { useRef, useState } from 'react';
import { Menu, X, Search, ChevronDown } from 'lucide-react';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';

// Bỏ dấu tiếng Việt để tìm menu không cần gõ dấu ("lai lo" -> "Lãi / Lỗ")
const deAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

const itemCls = (active) =>
  `w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[15px] font-medium transition-all ${
    active
      ? 'bg-gradient-to-br from-[#067B7F] via-[#12A4A5] to-[#3CA7A9] text-white shadow-nav'
      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'
  }`;

const Badge = ({ n, active }) => (n > 0 ? (
  <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center ${active ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'}`}>{n}</span>
) : null);

export const Avatar = ({ profile, size = 'w-9 h-9', text = 'text-sm' }) => (
  <div className={`${size} rounded-full overflow-hidden bg-teal-600 text-white ${text} font-bold grid place-items-center shrink-0`}>
    {profile?.avatar_url
      ? <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-full h-full object-cover" />
      : (profile?.full_name?.trim()?.charAt(0) || 'U')}
  </div>
);

export default function AppShell({
  groups,           // [{ title: string|null, items: [{ id, label, shortLabel?, icon, children?, badge? }] }]
  activeTab,
  onSelect,
  profile,
  roleLabel,
  bottomItems = [], // mục trên thanh dưới (mobile) — tối đa 3 nếu có nút nổi, 4 nếu không
  centerAction = null, // { id, label, icon } — nút nổi giữa thanh dưới
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [navQ, setNavQ] = useState('');
  const searchRef = useRef(null);

  const flat = groups.flatMap(g => g.items).flatMap(m => (m.children ? [m, ...m.children] : [m]));
  const navResults = navQ.trim()
    ? flat.filter(m => !m.children && deAccent(m.label).includes(deAccent(navQ)))
    : null;
  const activeMenu = flat.find(m => m.id === activeTab);

  const go = (id) => { onSelect(id); setSidebarOpen(false); setNavQ(''); };
  const focusSearch = () => { setSidebarOpen(true); setTimeout(() => searchRef.current?.focus(), 60); };

  const renderItem = (item) => {
    const Icon = item.icon;
    if (item.children) {
      const childActive = item.children.some(c => c.id === activeTab);
      const open = openGroups[item.id] ?? childActive;
      return (
        <div key={item.id}>
          <button
            onClick={() => setOpenGroups(g => ({ ...g, [item.id]: !(g[item.id] ?? childActive) }))}
            className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[15px] font-medium transition-all ${
              childActive ? 'text-teal-700 bg-teal-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-1 ml-[22px] pl-3 border-l border-slate-200 space-y-0.5">
              {item.children.map(c => {
                const CIcon = c.icon;
                const active = activeTab === c.id;
                return (
                  <button key={c.id} onClick={() => go(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}>
                    <CIcon className="w-4 h-4 shrink-0" />{c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    const active = activeTab === item.id;
    return (
      <button key={item.id} onClick={() => go(item.id)} className={itemCls(active)}>
        <Icon className="w-[18px] h-[18px] shrink-0" />
        <span className="truncate">{item.label}</span>
        <Badge n={item.badge} active={active} />
      </button>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className={`
        fixed top-0 left-0 h-[100dvh] w-[232px] z-40 flex flex-col bg-white border-r border-slate-200
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0 shadow-float' : '-translate-x-full'}
        lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none lg:shrink-0
      `}>
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-slate-900 overflow-hidden p-1.5 shadow-soft shrink-0">
              <img src="/logo.png" alt="Dr Tuấn Hùng" className="w-full h-full object-contain" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold tracking-[0.04em] text-teal-700 text-[16px] truncate">DR TUẤN HÙNG</div>
              <div className="text-[9.5px] font-semibold tracking-[0.2em] text-slate-400 truncate">INTERNAL SYSTEM</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 p-1" aria-label="Đóng menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tìm nhanh chức năng */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              value={navQ}
              onChange={e => setNavQ(e.target.value)}
              placeholder="Tìm chức năng…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-400 focus:bg-white transition"
            />
            {navQ && (
              <button onClick={() => setNavQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5" aria-label="Xoá tìm kiếm">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-4 pb-3 scrollbar-hide">
          {navResults ? (
            <div className="space-y-0.5 pt-1">
              {navResults.length === 0 && <div className="px-3 py-2 text-[13px] text-slate-400">Không tìm thấy chức năng nào</div>}
              {navResults.map(renderItem)}
            </div>
          ) : groups.map((g, gi) => (
            <div key={g.title || `g${gi}`}>
              {g.title && (
                <div className="flex items-center gap-2 px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  {g.title}
                </div>
              )}
              <div className={`space-y-0.5 ${!g.title && gi === 0 ? 'pt-1' : ''}`}>{g.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        {/* Thẻ khẩu hiệu */}
        <div className="px-4 pb-4 pt-2">
          <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-3">
            <div className="text-[12px] text-slate-500 leading-snug">Vận hành hiệu quả</div>
            <div className="text-[12.5px] font-semibold text-teal-800 leading-snug">Kiến tạo giá trị bền vững</div>
          </div>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-clip">

        {/* Header desktop */}
        <header className="hidden lg:flex items-center justify-between gap-6 px-8 pt-6 pb-4 sticky top-0 z-20 bg-background/90 backdrop-blur">
          <h1 className="text-[26px] leading-tight font-bold text-slate-900 tracking-tight truncate">{activeMenu?.label}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={focusSearch} className="w-10 h-10 rounded-full grid place-items-center text-slate-600 hover:bg-white hover:shadow-soft transition" aria-label="Tìm chức năng">
              <Search className="w-5 h-5" />
            </button>
            <NotificationBell />
            <ProfileMenu mobile={false}>
              <div className="flex items-center gap-3 cursor-pointer pl-1.5 pr-3 py-1.5 rounded-full hover:bg-white hover:shadow-soft transition">
                <Avatar profile={profile} size="w-10 h-10" />
                <div className="leading-tight text-left">
                  <div className="text-[14px] font-semibold text-slate-800 max-w-[180px] truncate">{profile?.full_name}</div>
                  {roleLabel && <div className="text-[12px] text-slate-500">{roleLabel}</div>}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </ProfileMenu>
          </div>
        </header>

        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between gap-2 px-3 py-2.5 sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 grid place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Mở menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold text-slate-900 text-[16px] truncate flex-1 text-center">{activeMenu?.label}</div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu mobile={true}>
              <div className="cursor-pointer"><Avatar profile={profile} size="w-9 h-9" text="text-xs" /></div>
            </ProfileMenu>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 pt-4 lg:pt-2 pb-28 lg:pb-8">
          <div key={activeTab} className="animate-page">{children}</div>
        </main>
      </div>

      {/* ===== BOTTOM NAV (mobile) ===== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe">
        <div className="flex items-end justify-around px-1 pt-1.5 pb-1.5">
          {(() => {
            const regular = bottomItems.slice(0, centerAction ? 3 : 4);
            const tab = (item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => go(item.id)} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <span className={`w-12 h-8 rounded-full grid place-items-center transition-colors ${active ? 'bg-teal-50 text-teal-700' : 'text-slate-400'}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className={`text-[10.5px] font-medium leading-tight max-w-full truncate ${active ? 'text-teal-700' : 'text-slate-500'}`}>{item.shortLabel || item.label}</span>
                </button>
              );
            };
            const center = centerAction && (() => {
              const CIcon = centerAction.icon;
              const active = activeTab === centerAction.id;
              return (
                <button key="__center" onClick={() => go(centerAction.id)} className="flex-1 flex flex-col items-center gap-0.5 min-w-0" aria-label={centerAction.label}>
                  <span className={`-mt-7 w-14 h-14 rounded-full grid place-items-center text-white ring-4 ring-white shadow-float active:scale-95 transition ${active ? 'bg-teal-700' : 'bg-teal-600'}`}>
                    <CIcon className="w-6 h-6" />
                  </span>
                  <span className={`text-[10.5px] font-semibold leading-tight ${active ? 'text-teal-700' : 'text-slate-600'}`}>{centerAction.label}</span>
                </button>
              );
            })();
            const more = (
              <button key="__more" onClick={() => setSidebarOpen(true)} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                <span className="w-12 h-8 rounded-full grid place-items-center text-slate-400"><Menu className="w-5 h-5" /></span>
                <span className="text-[10.5px] font-medium leading-tight text-slate-500">Thêm</span>
              </button>
            );
            return centerAction
              ? [...regular.slice(0, 2).map(tab), center, ...regular.slice(2).map(tab), more]
              : [...regular.map(tab), more];
          })()}
        </div>
      </nav>
    </div>
  );
}
