
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const KPIChart = ({ data }) => {
  const achieved = data.filter(d => d.status === 'achieved').length;
  const notAchieved = data.filter(d => d.status === 'not_achieved').length;

  const pieData = [
    { name: 'Đạt chỉ tiêu', value: achieved, color: 'hsl(var(--status-present))' },
    { name: 'Chưa đạt', value: notAchieved, color: 'hsl(var(--status-warning))' }
  ];

  return (
    <Card className="bg-card border-white/5 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Tỷ lệ hoàn thành KPI</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', borderRadius: '8px' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Không có dữ liệu</div>
        )}
      </CardContent>
    </Card>
  );
};

export default KPIChart;
