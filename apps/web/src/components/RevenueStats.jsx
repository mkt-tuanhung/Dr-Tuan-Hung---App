
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const RevenueStats = ({ revenues }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let total = 0;
    let thisMonth = 0;
    let lastMonth = 0;
    
    revenues.forEach(rev => {
      total += rev.revenue;
      
      const revDate = new Date(rev.date);
      if (revDate.getFullYear() === currentYear) {
        if (revDate.getMonth() === currentMonth) thisMonth += rev.revenue;
        if (revDate.getMonth() === currentMonth - 1) lastMonth += rev.revenue;
      } else if (currentMonth === 0 && revDate.getFullYear() === currentYear - 1 && revDate.getMonth() === 11) {
        lastMonth += rev.revenue;
      }
    });

    const growth = lastMonth === 0 ? 100 : ((thisMonth - lastMonth) / lastMonth) * 100;
    
    return {
      total,
      thisMonth,
      lastMonth,
      growth: growth.toFixed(1)
    };
  }, [revenues]);

  const cards = [
    {
      title: 'Tổng doanh thu',
      value: stats.total,
      icon: DollarSign,
      color: 'text-primary',
      bg: 'bg-primary/10',
      subtitle: 'Toàn thời gian'
    },
    {
      title: 'Doanh thu tháng này',
      value: stats.thisMonth,
      icon: Target,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      subtitle: 'Tháng hiện tại'
    },
    {
      title: 'Tăng trưởng',
      value: `${stats.growth > 0 ? '+' : ''}${stats.growth}%`,
      icon: TrendingUp,
      color: stats.growth >= 0 ? 'text-primary' : 'text-destructive',
      bg: stats.growth >= 0 ? 'bg-primary/10' : 'bg-destructive/10',
      subtitle: 'So với tháng trước',
      isText: true
    },
    {
      title: 'Tổng số GD',
      value: revenues.length,
      icon: Users,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      subtitle: 'Lượt khách',
      isText: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="bg-card border-white/5 shadow-lg">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg}`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-background px-2 py-1 rounded-md">
                  {card.subtitle}
                </span>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">{card.title}</h3>
              <div className="text-2xl md:text-3xl font-bold text-foreground">
                {card.isText ? card.value : `${card.value.toLocaleString('vi-VN')} đ`}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default RevenueStats;
