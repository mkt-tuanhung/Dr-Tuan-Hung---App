
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import KpiPersonalPageModule from '@/components/KPIPersonalPageModule.jsx';
import TelesaleKpiPersonalClean from '@/components/TelesaleKpiPersonalClean.jsx';
import SaleOfflineKpiPersonalClean from '@/components/SaleOfflineKpiPersonalClean.jsx';
import { mergeSurgicalAssignmentsWithSupabase } from '@/utils/surgicalCareAssignments.js';
import { mergePagePhoneAssignmentsWithSupabase } from '@/utils/userStorage.js';
import { Loader2 } from 'lucide-react';

const KPIPersonalPage = () => {
  const { user: currentUser } = useAuth();
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const initSync = async () => {
      try {
        await Promise.all([
          mergeSurgicalAssignmentsWithSupabase(),
          mergePagePhoneAssignmentsWithSupabase()
        ]);
      } catch (error) {
        toast.warning('Hoạt động ngoại tuyến. Dữ liệu chưa được đồng bộ mới nhất.');
      } finally {
        setIsSyncing(false);
      }
    };
    initSync();
  }, []);
  
  const renderContent = () => {
    if (isSyncing) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-card rounded-2xl border border-dashed border-border mt-8">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50 mb-4" />
          <p className="text-muted-foreground font-medium">Đang tải dữ liệu và đồng bộ...</p>
        </div>
      );
    }

    const position = currentUser?.departmentPosition?.trim().toLowerCase();

    if (position === "trực page") {
      return <KpiPersonalPageModule />;
    }

    if (position === "telesale") {
      return <TelesaleKpiPersonalClean currentUser={currentUser} />;
    }

    if (position === "sale offline") {
      return <SaleOfflineKpiPersonalClean currentUser={currentUser} />;
    }

    return (
      <div className="p-6 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed mt-8">
        KPI cho vị trí của bạn sẽ được xây dựng ở bước sau.
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>KPI cá nhân - Dr Tuấn Hùng</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-muted/30">
        <Header />
        
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
          {renderContent()}
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default KPIPersonalPage;
