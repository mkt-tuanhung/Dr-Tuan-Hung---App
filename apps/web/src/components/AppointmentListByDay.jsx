
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { markAppointmentAsDeleted } from '@/utils/appointmentStorage.js';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { Calendar, Trash2, Edit, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import ResponsiveAppointmentCard from '@/components/ResponsiveAppointmentCard.jsx';

const STATUS_COLORS = {
  'pending': '#64748b', 'chờ tư vấn': '#64748b',
  'surgery': '#10b981', 'phẫu thuật': '#10b981',
  'deposit': '#3b82f6', 'cọc': '#3b82f6',
  'bong': '#f97316', 'bóng': '#f97316'
};

const getStatusColor = (s) => STATUS_COLORS[(s || '').toLowerCase()] || '#94a3b8';
const getStatusLabel = (s) => {
  const v = (s || '').toLowerCase();
  if (['surgery', 'phẫu thuật'].includes(v)) return 'Phẫu thuật';
  if (['deposit', 'cọc'].includes(v)) return 'Đã cọc';
  if (['bong', 'bóng'].includes(v)) return 'Bong';
  if (['pending', 'chờ tư vấn'].includes(v)) return 'Chờ tư vấn';
  return s || 'Khác';
};

const AppointmentListByDay = ({ 
  appointments, 
  onEdit, 
  onEvaluate, 
  onRefresh, 
  canEditAppointment, 
  canEvaluateAppointment, 
  canDeleteAppointment 
}) => {
  const isMobile = useIsMobile();

  const grouped = useMemo(() => {
    const map = {};
    appointments.forEach(app => {
      const date = app.appointmentDate || 'Chưa có ngày';
      if (!map[date]) map[date] = [];
      map[date].push(app);
    });
    
    return Object.keys(map).sort((a, b) => new Date(b) - new Date(a)).map(date => ({
      date,
      items: map[date].sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''))
    }));
  }, [appointments]);

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa lịch hẹn này?')) {
      await markAppointmentAsDeleted(id);
      toast.success('Đã xóa lịch hẹn.');
      if (onRefresh) onRefresh();
    }
  };

  if (grouped.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-sm">
        <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-lg">Không tìm thấy lịch hẹn nào phù hợp.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-6 pb-safe-nav">
        {grouped.map(group => (
          <div key={group.date} className="space-y-3">
            <div className="sticky top-[60px] z-10 bg-background/95 backdrop-blur-md py-2 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {group.date === 'Chưa có ngày' ? group.date : new Date(group.date).toLocaleDateString('vi-VN')}
              </h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{group.items.length} lịch</Badge>
            </div>
            <div className="space-y-3">
              {group.items.map(app => (
                <ResponsiveAppointmentCard
                  key={app.id}
                  app={app}
                  onEdit={onEdit}
                  onEvaluate={onEvaluate}
                  onDelete={handleDelete}
                  canEvaluate={canEvaluateAppointment && canEvaluateAppointment(app)}
                  canEdit={canEditAppointment && canEditAppointment(app)}
                  canDelete={canDeleteAppointment && canDeleteAppointment(app)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(group => (
        <Card key={group.date} className="shadow-sm border-border overflow-hidden rounded-2xl">
          <CardHeader className="bg-primary/5 border-b border-border/50 py-3">
            <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 
              {group.date === 'Chưa có ngày' ? group.date : new Date(group.date).toLocaleDateString('vi-VN')}
              <Badge variant="outline" className="ml-2 bg-background">{group.items.length} lịch</Badge>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[100px]">Giờ</TableHead>
                  <TableHead className="w-[200px]">Khách hàng</TableHead>
                  <TableHead>Dịch vụ</TableHead>
                  <TableHead>Phụ trách</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                  <TableHead className="text-right w-[150px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map(app => (
                  <TableRow key={app.id}>
                    <TableCell className="font-semibold">{app.appointmentTime || '--:--'}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{app.customerName}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={app.referenceInfo}>{app.referenceInfo || 'Không có link'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-medium bg-secondary text-secondary-foreground">{app.service}</Badge>
                      {(app.expectedBill > 0 || app.depositPaid > 0) && (
                        <div className="text-xs mt-1 text-muted-foreground">
                          Bill: {formatVNDDisplay(app.expectedBill)} | Cọc: {formatVNDDisplay(app.depositPaid)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div><span className="text-muted-foreground">Tele:</span> {app.telesaleName || '-'}</div>
                        <div><span className="text-muted-foreground">Sale:</span> {app.saleOfflineName || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        style={{ backgroundColor: getStatusColor(app.evaluationStatus || app.status), color: '#fff' }} 
                        className="border-transparent font-medium"
                      >
                        {getStatusLabel(app.evaluationStatus || app.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEvaluateAppointment && canEvaluateAppointment(app) && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 font-medium"
                          onClick={() => onEvaluate(app)}
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Đánh giá
                        </Button>
                      )}
                      
                      {canEditAppointment && canEditAppointment(app) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => onEdit(app)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {canDeleteAppointment && canDeleteAppointment(app) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDelete(app.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AppointmentListByDay;
