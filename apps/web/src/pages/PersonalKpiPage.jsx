
import React from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Target } from 'lucide-react';
import KpiPersonalPageModule from '@/components/KPIPersonalPageModule.jsx';
import TelesaleKpiPersonalClean from '@/components/TelesaleKpiPersonalClean.jsx';
import SaleOfflineKpiPersonalClean from '@/components/SaleOfflineKpiPersonalClean.jsx';
import MediaKpiPersonalClean from '@/components/MediaKpiPersonalClean.jsx';
import CskhKpiPersonalClean from '@/components/CskhKpiPersonalClean.jsx';
import MarketingKpiPersonalClean from '@/components/MarketingKpiPersonalClean.jsx';
import NursingKpiPersonalClean from '@/components/NursingKpiPersonalClean.jsx';

const PersonalKpiPage = () => {
  const { user } = useAuth();
  const position = user?.departmentPosition?.toLowerCase().trim() || '';

  const renderContent = () => {
    if (position === 'trực page') {
      return <KpiPersonalPageModule currentUser={user} />;
    }
    
    if (position === 'telesale') {
      return <TelesaleKpiPersonalClean currentUser={user} />;
    }
    
    if (position === 'sale offline') {
      return <SaleOfflineKpiPersonalClean currentUser={user} />;
    }
    
    if (position === 'media') {
      return <MediaKpiPersonalClean currentUser={user} />;
    }

    if (position === 'cskh' || position === 'chăm sóc khách hàng') {
      return <CskhKpiPersonalClean currentUser={user} />;
    }

    if (position === 'marketing' || position === 'mkt') {
      return <MarketingKpiPersonalClean currentUser={user} />;
    }

    if (position === 'điều dưỡng' || position === 'dieu duong' || position === 'nursing') {
      return <NursingKpiPersonalClean currentUser={user} />;
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card border rounded-xl border-dashed">
        <Target className="w-12 h-12 text-muted-foreground opacity-30 mb-4" />
        <h2 className="text-xl font-semibold text-foreground">KPI cá nhân</h2>
        <p className="text-muted-foreground mt-1">
          Module KPI cho vị trí của bạn đang được xây dựng.
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KPI Cá nhân</h1>
        <p className="text-muted-foreground mt-1">Theo dõi chỉ tiêu và hiệu suất công việc của bạn</p>
      </div>

      <div className="mt-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default PersonalKpiPage;
