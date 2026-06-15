
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatVND = (value) => {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value);
};

const PayrollChart = ({ data }) => {
  // Aggregate payroll by staff
  const chartData = data.map(d => ({
    name: d.staff_name.split(' ').pop(), // First name
    salary: d.net_salary
  })).sort((a, b) => b.salary - a.salary).slice(0, 10); // Top 10

  return (
    <Card className="bg-card border-white/5 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Top Thu nhập (Thực lãnh)</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatVND} tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#ffffff05' }}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', borderRadius: '8px' }}
                formatter={(value) => [new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value), 'Thực lãnh']}
              />
              <Bar dataKey="salary" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Không có dữ liệu</div>
        )}
      </CardContent>
    </Card>
  );
};

export default PayrollChart;
