
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, MessageSquare, Phone, Coins } from 'lucide-react';

const KPIAdminPageStatsCard = ({ stats }) => {
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <Card className="lg:col-span-2 shadow-sm border-border bg-emerald-50/50">
        <CardContent className="p-5 flex flex-col justify-center h-full">
          <div className="text-sm font-medium text-emerald-800 uppercase tracking-wider mb-1">Tỷ lệ hoàn thành KPI chung</div>
          <div className="text-4xl font-extrabold tabular-nums tracking-tight text-emerald-600">
            {(stats.overallKpiCompletion || 0).toFixed(1)}%
          </div>
          <div className="mt-2 text-xs text-emerald-700/80 font-medium">
            Tổng SĐT: {stats.totalPhones || 0} / KPI được giao: {stats.totalTargetPhones || 0}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 text-center h-full flex flex-col justify-center">
          <div className="text-xl font-bold tabular-nums">{stats.totalMessages || 0}</div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Tổng tin nhắn</div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 text-center h-full flex flex-col justify-center">
          <div className="text-xl font-bold tabular-nums text-primary">{stats.totalPhones || 0}</div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Tổng số điện thoại</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 text-center h-full flex flex-col justify-center">
          <div className="text-xl font-bold tabular-nums">{(stats.averageConversionRate || 0).toFixed(1)}%</div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Tỷ lệ xin số TB</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 text-center h-full flex flex-col justify-center bg-kpi-commission text-kpi-commission-foreground rounded-xl">
          <div className="text-lg font-bold tabular-nums">{formatCurrency(stats.totalCommission)}</div>
          <div className="text-[10px] font-medium uppercase mt-1 opacity-90">Tổng hoa hồng (đ)</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPIAdminPageStatsCard;
