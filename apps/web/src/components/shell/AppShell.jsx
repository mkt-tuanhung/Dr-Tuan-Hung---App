// ============================================================
// KHUNG APP DÙNG CHUNG (Admin + Nhân sự) — theo Ethics Business OS
// - Sidebar SÁNG: logo + wordmark, ô tìm chức năng, menu chia nhóm
//   (• KHÁCH HÀNG / • NHÂN SỰ ...), mục đang chọn tô teal đặc chữ trắng,
//   thẻ khẩu hiệu cuối sidebar.
// - Header desktop: tiêu đề trang lớn + tìm kiếm + chuông + thẻ người dùng.
// - Mobile (Ethics M03/M04): Trang chủ có lời chào + chuông; màn khác có nút
//   quay lại + tiêu đề giữa. Thanh dưới có NÚT NỔI giữa (VD: Chấm công) +
//   "Tất cả" mở màn "Tất cả chức năng" (lưới icon theo nhóm).
// Cuộn theo cả trang (window) như trước -> không ảnh hưởng các trang con.
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { X, Search, ChevronDown, ChevronLeft, LayoutGrid, House } from 'lucide-react';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';

// Bỏ dấu tiếng Việt để tìm menu không cần gõ dấu ("lai lo" -> "Lãi / Lỗ")
const deAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

const itemCls = (active) =>
  `w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[14.5px] font-medium transition-all ${
    active
      ? 'bg-gradient-to-br from-[#067B7F] via-[#12A4A5] to-[#3CA7A9] text-white shadow-nav'
      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'
  }`;

const Badge = ({ n, active }) => (n > 0 ? (
  <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center ${active ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'}`}>{n}</span>
) : null);

// Màn "Tất cả chức năng": màu ô icon xoay vòng theo bảng Ethics
const TILE_TONES = [
  'bg-teal-50 text-teal-700',
  'bg-info-50 text-info-600',
  'bg-danger-50 text-danger-600',
  'bg-peach-50 text-peach-600',
  'bg-lavender-50 text-lavender-600',
];
// "KHÁCH HÀNG" -> "Khách hàng"
const sentence = (t) => (t ? t.charAt(0) + t.slice(1).toLocaleLowerCase('vi') : 'Chung');
// Mục con nằm phẳng trong lưới; nhãn chung chung thì ghép tên nhóm cha cho rõ
const flatTiles = (items) => items.flatMap(m => (m.children
  ? m.children.map(c => ({ ...c, icon: c.icon || m.icon, label: c.label === 'Tổng quan' ? `Tổng quan ${m.label}` : c.label }))
  : [m]));

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
  centerAction = null, // { id, label, icon, onPress? } — nút nổi giữa thanh dưới
  homeId = 'overview', // màn Trang chủ (mobile hiện lời chào thay tiêu đề)
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);   // màn "Tất cả chức năng" (mobile)
  const [allQ, setAllQ] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const [navQ, setNavQ] = useState('');
  const searchRef = useRef(null);

  const flat = groups.flatMap(g => g.items).flatMap(m => (m.children ? [m, ...m.children] : [m]));
  const navResults = navQ.trim()
    ? flat.filter(m => !m.children && deAccent(m.label).includes(deAccent(navQ)))
    : null;
  const activeMenu = flat.find(m => m.id === activeTab);

  const go = (id) => { onSelect(id); setSidebarOpen(false); setNavQ(''); setAllOpen(false); setAllQ(''); };

  // Lịch sử màn đã mở -> nút quay lại trên header mobile
  const hist = useRef([]);
  const prevTab = useRef(activeTab);
  const backing = useRef(false);
  useEffect(() => {
    if (prevTab.current === activeTab) return;
    if (!backing.current) hist.current = [...hist.current, prevTab.current].slice(-20);
    backing.current = false;
    prevTab.current = activeTab;
  }, [activeTab]);
  const isHome = activeTab === homeId;
  const goBack = () => {
    const prev = hist.current[hist.current.length - 1];
    hist.current = hist.current.slice(0, -1);
    backing.current = true;
    onSelect(prev && prev !== activeTab ? prev : homeId);
  };
  const now = new Date();
  const todayLabel = `${now.getDay() === 0 ? 'Chủ nhật' : `Thứ ${now.getDay() + 1}`}, ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const allTiles = allQ.trim()
    ? [{ title: 'Kết quả tìm kiếm', tiles: flatTiles(groups.flatMap(g => g.items)).filter(m => deAccent(m.label).includes(deAccent(allQ))) }]
    : groups.map(g => ({ title: sentence(g.title), tiles: flatTiles(g.items) }));
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
            className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[14.5px] font-medium transition-all ${
              childActive ? 'text-teal-800' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'
            }`}
          >
            <Icon className={`w-[18px] h-[18px] shrink-0 ${childActive ? 'text-teal-700' : ''}`} />
            <span className="flex-1 text-left truncate">{item.label}</span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-0.5 mb-1.5 ml-[22px] pl-3 border-l-[1.5px] border-slate-200 space-y-0.5">
              {item.children.map(c => {
                const active = activeTab === c.id;
                return (
                  <button key={c.id} onClick={() => go(c.id)}
                    className={`w-full flex items-center h-9 px-3 rounded-[10px] text-[13.5px] text-left transition-all ${
                      active ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-600 font-medium hover:bg-teal-50 hover:text-teal-800'
                    }`}>
                    <span className="truncate">{c.label}</span>
                    <Badge n={c.badge} active={false} />
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
        fixed top-0 left-0 h-[100dvh] w-[244px] z-40 flex flex-col bg-white border-r border-slate-200
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

        {/* Header mobile (Ethics): Trang chủ = lời chào; màn khác = quay lại + tiêu đề giữa */}
        {isHome ? (
          <header className="lg:hidden flex items-center gap-3.5 px-4 pt-4 pb-3 sticky top-0 z-20 bg-[#F7FBFB]/95 backdrop-blur">
            <ProfileMenu mobile={true}>
              <div className="cursor-pointer rounded-full ring-[3px] ring-white shadow-soft"><Avatar profile={profile} size="w-14 h-14" text="text-lg" /></div>
            </ProfileMenu>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[13.5px] text-slate-500">Xin chào,</div>
              <div className="text-[20px] font-bold text-slate-900 truncate">{profile?.full_name || 'Bạn'}</div>
              <div className="text-[12.5px] text-slate-500 truncate mt-0.5">{todayLabel}{roleLabel ? ` · ${roleLabel}` : ''}</div>
            </div>
            <div className="w-11 h-11 rounded-[14px] bg-white border border-slate-200/80 shadow-soft grid place-items-center text-teal-700 shrink-0"><NotificationBell /></div>
          </header>
        ) : (
          <header className="lg:hidden grid grid-cols-[88px_minmax(0,1fr)_88px] items-center h-14 px-2 sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100">
            <button onClick={goBack} className="w-11 h-11 grid place-items-center rounded-xl text-slate-900 active:bg-teal-50" aria-label="Quay lại">
              <ChevronLeft className="w-[26px] h-[26px]" strokeWidth={2} />
            </button>
            <div className="font-bold text-slate-900 text-[18px] truncate text-center">{activeMenu?.label}</div>
            <div className="flex items-center justify-end gap-0.5">
              <NotificationBell />
              <ProfileMenu mobile={true}>
                <div className="cursor-pointer"><Avatar profile={profile} size="w-8 h-8" text="text-xs" /></div>
              </ProfileMenu>
            </div>
          </header>
        )}

        <main className="flex-1 px-4 lg:px-8 pt-4 lg:pt-2 pb-28 lg:pb-8">
          <div key={activeTab} className="animate-page">{children}</div>
        </main>
      </div>

      {/* ===== TẤT CẢ CHỨC NĂNG (mobile, Ethics) ===== */}
      {allOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex flex-col bg-gradient-to-b from-[#F7FBFB] to-white animate-page">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center h-14 px-2 shrink-0">
            <button onClick={() => { setAllOpen(false); setAllQ(''); }} className="w-11 h-11 grid place-items-center rounded-xl text-slate-900 active:bg-teal-50" aria-label="Đóng">
              <ChevronLeft className="w-[26px] h-[26px]" strokeWidth={2} />
            </button>
            <div className="text-[20px] font-bold text-slate-900 text-center truncate">Tất cả chức năng</div>
            <span />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-28 scrollbar-hide">
            <div className="e-search mt-1">
              <Search />
              <input value={allQ} onChange={e => setAllQ(e.target.value)} placeholder="Tìm chức năng…" className="!bg-white" />
            </div>
            {allTiles.map(sec => sec.tiles.length > 0 && (
              <section key={sec.title} className="mt-5">
                <h2 className="text-[18px] font-bold text-slate-900 mb-3">{sec.title}</h2>
                <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft px-2 py-3 grid grid-cols-4 gap-y-3">
                  {sec.tiles.map((m, i) => {
                    const Icon = m.icon;
                    const active = activeTab === m.id;
                    return (
                      <button key={m.id} onClick={() => go(m.id)} className="flex flex-col items-center gap-2 px-1 min-w-0 active:scale-95 transition">
                        <span className={`relative w-[52px] h-[52px] rounded-2xl grid place-items-center ${TILE_TONES[i % TILE_TONES.length]} ${active ? 'ring-2 ring-teal-400 ring-offset-2' : ''}`}>
                          {Icon && <Icon className="w-6 h-6" strokeWidth={1.8} />}
                          {m.badge > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold grid place-items-center border-2 border-white">{m.badge > 9 ? '9+' : m.badge}</span>}
                        </span>
                        <span className={`text-[12.5px] leading-tight text-center line-clamp-2 ${active ? 'text-teal-700 font-semibold' : 'text-slate-700'}`}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {allTiles.every(sec => sec.tiles.length === 0) && <div className="text-center text-[13px] text-slate-400 py-10">Không tìm thấy chức năng nào</div>}
          </div>
        </div>
      )}

      {/* ===== BOTTOM NAV (mobile) ===== */}
      <nav className={`lg:hidden fixed bottom-0 inset-x-0 ${allOpen ? 'z-40' : 'z-20'} bg-white/95 backdrop-blur border-t border-slate-200/80 pb-safe`}>
        <div className="flex items-end justify-around px-1 pt-1.5 pb-1.5">
          {(() => {
            const regular = bottomItems.slice(0, centerAction ? 3 : 4);
            const tab = (item) => {
              const Icon = item.id === homeId ? House : item.icon;
              const active = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => go(item.id)} className="flex-1 flex flex-col items-center gap-1 min-w-0 min-h-[44px] justify-center">
                  <span className={`relative grid place-items-center transition-colors ${active && !allOpen ? 'text-teal-700' : 'text-slate-400'}`}>
                    <Icon className={`w-[23px] h-[23px] ${active && !allOpen ? 'fill-teal-50' : ''}`} strokeWidth={1.8} />
                    {item.badge > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[9px] font-bold grid place-items-center border-2 border-white">{item.badge > 9 ? '9+' : item.badge}</span>}
                  </span>
                  <span className={`text-[10.5px] leading-tight max-w-full truncate ${active && !allOpen ? 'text-teal-700 font-semibold' : 'text-slate-500 font-medium'}`}>{item.id === homeId ? 'Trang chủ' : (item.shortLabel || item.label)}</span>
                </button>
              );
            };
            const center = centerAction && (() => {
              const CIcon = centerAction.icon;
              const active = activeTab === centerAction.id;
              return (
                <button key="__center" onClick={() => { go(centerAction.id); centerAction.onPress?.(); }}className="flex-1 flex flex-col items-center gap-0.5 min-w-0" aria-label={centerAction.label}>
                  <span className={`-mt-7 w-14 h-14 rounded-full grid place-items-center text-white ring-4 ring-white shadow-nav active:scale-95 transition bg-gradient-to-br ${active ? 'from-[#06686C] to-[#067B7F]' : 'from-[#067B7F] to-[#12A4A5]'}`}>
                    <CIcon className="w-6 h-6" />
                  </span>
                  <span className={`text-[10.5px] font-semibold leading-tight ${active ? 'text-teal-700' : 'text-slate-600'}`}>{centerAction.label}</span>
                </button>
              );
            })();
            const more = (
              <button key="__more" onClick={() => { setAllOpen(o => !o); setAllQ(''); }} className="flex-1 flex flex-col items-center gap-1 min-w-0 min-h-[44px] justify-center">
                <span className={`grid place-items-center ${allOpen ? 'text-teal-700' : 'text-slate-400'}`}><LayoutGrid className={`w-[23px] h-[23px] ${allOpen ? 'fill-teal-50' : ''}`} strokeWidth={1.8} /></span>
                <span className={`text-[10.5px] leading-tight ${allOpen ? 'text-teal-700 font-semibold' : 'text-slate-500 font-medium'}`}>Tất cả</span>
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
