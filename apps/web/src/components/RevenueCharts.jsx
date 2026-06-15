
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatVND } from '@/utils/currencyFormat.js';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

const CustomTooltip = ({ active, payload, label, isCurrency = true }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border shadow-lg p-3 rounded-lg text-sm z-50">
        <p className="font-semibold mb-2">{label || payload[0].name}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4 font-medium">
            <span>{entry.name}:</span>
            <span>{isCurrency ? formatVND(entry.value) : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const RevenueCharts = ({ data }) => {
  const serviceGroupData = useMemo(() => {
    const groups = data.reduce((acc, curr) => {
      const group = curr.serviceGroup || 'Khác';
      if (!acc[group]) acc[group] = { name: group, value: 0 };
      acc[group].value += (Number(curr.revenueAmount) || 0);
      return acc;
    }, {});
    return Object.values(groups).filter(i => i.value > 0);
  }, [data]);

  const sourceData = useMemo(() => {
    const sources = data.reduce((acc, curr) => {
      const source = curr.customerSource || 'Khác';
      if (!acc[source]) acc[source] = { name: source, value: 0 };
      acc[source].value += (Number(curr.revenueAmount) || 0);
      return acc;
    }, {});
    return Object.values(sources).filter(i => i.value > 0).sort((a,b) => b.value - a.value);
  }, [data]);

  const monthlyData = useMemo(() => {
    const months = data.reduce((acc, curr) => {
      const m = curr.month || curr.revenueDate?.substring(0, 7) || 'Khác';
      if (!acc[m]) acc[m] = { name: m, revenue: 0, upsale: 0 };
      acc[m].revenue += (Number(curr.revenueAmount) || 0);
      acc[m].upsale += (Number(curr.upsaleRevenue) || 0);
      return acc;
    }, {});
    return Object.values(months).sort((a, b) => a.name.localeCompare(b.name)).map(i => ({...i, displayName: i.name.substring(5)}));
  }, [data]);

  if (data.length === 0) return <div className="empty-state-mobile">Chưa có dữ liệu biểu đồ.</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Nhóm dịch vụ</CardTitle></CardHeader>
        <CardContent className="chart-mobile">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={serviceGroupData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {serviceGroupData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Nguồn khách</CardTitle></CardHeader>
        <CardContent className="chart-mobile">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                {sourceData.map((e, i) => <Cell key={i} fill={COLORS[(i+2) % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border xl:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Doanh thu theo tháng</CardTitle></CardHeader>
        <CardContent className="chart-mobile">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayName" tick={{fontSize: 10}} axisLine={false} tickLine={false} dy={10} />
              <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#10b981" radius={[4,4,0,0]} maxBarSize={40} />
              <Bar dataKey="upsale" name="Upsale" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueCharts;
