
import React from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import KPIAdminPageModule from '@/components/KPIAdminPageModule.jsx';

const KPIAdminPage = () => {
  const { user } = useAuth();

  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg font-medium text-destructive">Bạn không có quyền truy cập chức năng này.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Quản lý KPI - Dr Tuấn Hùng</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-muted/30 pb-12">
        <Header />
        
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
          <KPIAdminPageModule />
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default KPIAdminPage;
