
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';
import { getUsers } from '@/utils/userStorage.js';

const AppointmentFilterBar = ({ filters, setFilters }) => {
  const users = useMemo(() => getUsers(), []);
  
  const telesaleStaff = useMemo(() => 
    users.filter(u => u.role === 'Nhân viên' && (u.departmentPosition || '').toLowerCase().trim() === 'telesale'),
  [users]);

  const saleOfflineStaff = useMemo(() => 
    users.filter(u => u.role === 'Nhân viên' && (u.departmentPosition || '').toLowerCase().trim() === 'sale offline'),
  [users]);

  const handleReset = () => {
    setFilters({
      date: '',
      month: new Date().toISOString().slice(0, 7),
      status: 'all',
      telesaleId: 'all',
      saleOfflineId: 'all',
      search: ''
    });
  };

  return (
    <Card className="shadow-sm border-border bg-card">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tìm kiếm khách hàng</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Tên khách hàng..." 
                className="pl-9"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tháng</Label>
            <Input 
              type="month" 
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value, date: '' })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ngày cụ thể</Label>
            <Input 
              type="date" 
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value, month: '' })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trạng thái</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Chờ tư vấn</SelectItem>
                <SelectItem value="bong">Bong</SelectItem>
                <SelectItem value="deposit">Cọc</SelectItem>
                <SelectItem value="surgery">Phẫu thuật</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telesale</Label>
            <Select value={filters.telesaleId} onValueChange={(v) => setFilters({ ...filters, telesaleId: v })}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả Telesale</SelectItem>
                {telesaleStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Sale Offline</Label>
              <Select value={filters.saleOfflineId} onValueChange={(v) => setFilters({ ...filters, saleOfflineId: v })}>
                <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Sale Offline</SelectItem>
                  {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" className="mb-[1px] shrink-0" onClick={handleReset} title="Đặt lại bộ lọc">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentFilterBar;
