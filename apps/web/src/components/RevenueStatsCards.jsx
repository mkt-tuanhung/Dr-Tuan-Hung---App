
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Banknote, TrendingUp, Users, Target } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';

const RevenueStatsCards = ({ data }) => {
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalUpsale = 0;
    const uniqueCustomers = new Set();
    let adsCustomers = 0;

    data.forEach(record => {
      totalRevenue += Number(record.revenueAmount) || 0;
      totalUpsale += Number(record.upsaleRevenue) || 0;
      if (record.customerPhone) uniqueCustomers.add(record.customerPhone);
      if (record.customerSource === 'ADS') adsCustomers++;
    });

    return {
      totalRevenue,
      totalUpsale,
      customersCount: uniqueCustomers.size,
      adsCustomers
    };
  }, [data]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <Card className="shadow-sm border-border bg-emerald-50/50">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 md:p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Banknote className="w-4 h-4" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Tổng doanh thu</p>
          </div>
          <p className="text-lg md:text-2xl font-bold tabular-nums text-emerald-700">{formatVND(stats.totalRevenue)}</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm border-border bg-blue-50/50">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 md:p-2 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Doanh thu Upsale</p>
          </div>
          <p className="text-lg md:text-2xl font-bold tabular-nums text-blue-700">{formatVND(stats.totalUpsale)}</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Khách hàng</p>
          </div>
          <p className="text-lg md:text-2xl font-bold tabular-nums text-indigo-700">{stats.customersCount}</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 md:p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Target className="w-4 h-4" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Khách từ Ads</p>
          </div>
          <p className="text-lg md:text-2xl font-bold tabular-nums text-purple-700">{stats.adsCustomers}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueStatsCards;
