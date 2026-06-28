import React, { useState } from 'react';
import { BarChart2, Clapperboard } from 'lucide-react';
import AdsReportPage from '@/pages/AdsReportPage.jsx';
import ContentProductionPage from '@/pages/ContentProductionPage.jsx';

const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${active ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const MarketingHubPage = () => {
  const [tab, setTab] = useState(() => localStorage.getItem('mkt_hub_tab') || 'ads_cost');
  const go = (t) => { setTab(t); localStorage.setItem('mkt_hub_tab', t); };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabBtn active={tab === 'ads_cost'} onClick={() => go('ads_cost')} icon={BarChart2} label="Chi phí Ads" />
        <TabBtn active={tab === 'production'} onClick={() => go('production')} icon={Clapperboard} label="Sản xuất Ads" />
      </div>
      {tab === 'ads_cost' ? <AdsReportPage /> : <ContentProductionPage />}
    </div>
  );
};

export default MarketingHubPage;
