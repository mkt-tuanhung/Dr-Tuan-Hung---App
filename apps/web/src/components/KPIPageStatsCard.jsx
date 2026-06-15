
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Phone, Percent, Coins, Target, Info } from 'lucide-react';

const KPIPageStatsCard = ({ stats }) => {
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <Card className="lg:col-span-2 bg-kpi-commission text-kpi-commission-foreground border-none shadow-md overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Coins className="w-16 h-16" /></div>
        <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
          <div className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Hoa hồng tạm tính</div>
          <div className="text-4xl font-extrabold tabular-nums tracking-tight">{formatCurrency(stats.commissionAmount)} đ</div>
          <div className="mt-4 text-xs opacity-80 flex items-center gap-1">
            <Info className="w-3 h-3" /> Hoa hồng = 20.000đ × Số điện thoại
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-5 flex flex-col gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit"><MessageSquare className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.totalMessages || 0}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tổng tin nhắn</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-5 flex flex-col gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit"><Phone className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.totalPhones || 0}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Số điện thoại</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-5 flex flex-col gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg w-fit"><Percent className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{(stats.conversionRate || 0).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tỷ lệ xin số</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-5 flex flex-col gap-2">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg w-fit"><Target className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{(stats.kpiCompletion || 0).toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Hoàn thành ({stats.totalPhones || 0}/{stats.targetPhones || 0})</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPIPageStatsCard;
