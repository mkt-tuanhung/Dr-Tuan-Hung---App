
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Activity, Ban, Wallet, Banknote, Stethoscope } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import AppointmentDetailModal from './AppointmentDetailModal.jsx';

const AppointmentStatsCards = ({ appointments }) => {
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', filterFn: null });

  const stats = useMemo(() => {
    let total = appointments.length;
    let surgery = 0;
    let bong = 0;
    let deposit = 0;
    let expectedBill = 0;
    let totalDeposit = 0;

    appointments.forEach(app => {
      if (app.status === 'surgery') surgery++;
      if (app.status === 'bong') bong++;
      if (app.status === 'deposit') deposit++;
      
      expectedBill += (Number(app.expectedBill) || 0);
      totalDeposit += (Number(app.depositPaid) || 0);
    });

    return { total, surgery, bong, deposit, expectedBill, totalDeposit };
  }, [appointments]);

  const handleCardClick = (title, filterFn) => {
    setModalConfig({ isOpen: true, title, filterFn });
  };

  const filteredModalAppointments = useMemo(() => {
    if (!modalConfig.filterFn) return [];
    return appointments.filter(modalConfig.filterFn);
  }, [appointments, modalConfig.filterFn]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card 
          className="shadow-sm border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => handleCardClick('Tất cả lịch hẹn', () => true)}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <CalendarDays className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Tổng lịch hẹn</p>
          </CardContent>
        </Card>

        <Card 
          className="shadow-sm border-border cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all"
          onClick={() => handleCardClick('Khách hàng Phẫu thuật', app => app.status === 'surgery')}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Stethoscope className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-2xl font-bold text-emerald-600">{stats.surgery}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Phẫu thuật</p>
          </CardContent>
        </Card>

        <Card 
          className="shadow-sm border-border cursor-pointer hover:border-blue-500/50 hover:shadow-md transition-all"
          onClick={() => handleCardClick('Khách hàng Cọc', app => app.status === 'deposit')}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Wallet className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-blue-600">{stats.deposit}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Đã cọc</p>
          </CardContent>
        </Card>

        <Card 
          className="shadow-sm border-border cursor-pointer hover:border-rose-500/50 hover:shadow-md transition-all"
          onClick={() => handleCardClick('Khách hàng Bong', app => app.status === 'bong')}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Ban className="w-5 h-5 text-rose-500 mb-2" />
            <p className="text-2xl font-bold text-rose-600">{stats.bong}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Khách Bong</p>
          </CardContent>
        </Card>

        <Card 
          className="shadow-sm border-border cursor-pointer hover:border-amber-500/50 hover:shadow-md transition-all"
          onClick={() => handleCardClick('Lịch hẹn có Bill dự kiến', app => Number(app.expectedBill) > 0)}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Activity className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-lg font-bold text-amber-600 truncate w-full">{formatVND(stats.expectedBill)}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Tổng Bill dự kiến</p>
          </CardContent>
        </Card>

        <Card 
          className="shadow-sm border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => handleCardClick('Lịch hẹn đã thu cọc', app => Number(app.depositPaid) > 0)}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Banknote className="w-5 h-5 text-primary mb-2" />
            <p className="text-lg font-bold text-primary truncate w-full">{formatVND(stats.totalDeposit)}</p>
            <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Tổng đã cọc</p>
          </CardContent>
        </Card>
      </div>

      <AppointmentDetailModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        appointments={filteredModalAppointments}
      />
    </>
  );
};

export default AppointmentStatsCards;
