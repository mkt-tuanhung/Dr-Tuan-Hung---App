// Tiêu đề trang do chính trang đặt (Ethics usePageMeta): AppShell hiện tiêu đề này
// trên header thay cho nhãn menu, VD menu "Quản lý Nhân sự" -> "HRM - Quản lý nhân sự".
import React, { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext({ title: null, setTitle: () => {} });

export function PageTitleProvider({ children }) {
  const [title, setTitle] = useState(null);
  return <Ctx.Provider value={{ title, setTitle }}>{children}</Ctx.Provider>;
}

export const usePageTitleValue = () => useContext(Ctx).title;

export function usePageTitle(title) {
  const { setTitle } = useContext(Ctx);
  useEffect(() => {
    setTitle(title || null);
    return () => setTitle(null);
  }, [title, setTitle]);
}
