
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getUsers } from '@/utils/userStorage.js';
import { Search, RotateCcw, Filter } from 'lucide-react';

const RevenueFilterBar = ({ filters, setFilters }) => {
  const users = useMemo(() => getUsers(), []);
  const telesaleStaff = useMemo(() => users.filter(u => u.role === 'Nhân viên' && (u.departmentPosition || '').toLowerCase().trim() === 'telesale'), [users]);
  const saleOfflineStaff = useMemo(() => users.filter(u => u.role === 'Nhân viên' && (u.departmentPosition || '').toLowerCase().trim() === 'sale offline'), [users]);

  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      monthYear: '', dateFrom: '', dateTo: '', 
      saleOfflineId: 'all', telesaleId: 'all',
      serviceGroup: 'all', customerSource: 'all',
      customerFileType: 'all', search: ''
    });
  };

  return (
    <Card className="shadow-sm border-border bg-card mb-6">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Bộ lọc doanh thu</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tháng / Năm (YYYY-MM)</Label>
            <Input type="month" value={filters.monthYear} onChange={e => handleChange('monthYear', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Từ ngày</Label>
            <Input type="date" value={filters.dateFrom} onChange={e => handleChange('dateFrom', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Đến ngày</Label>
            <Input type="date" value={filters.dateTo} onChange={e => handleChange('dateTo', e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tìm kiếm Khách hàng</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Tên hoặc SĐT..." 
                className="pl-9"
                value={filters.search}
                onChange={e => handleChange('search', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sale Offline</Label>
            <Select value={filters.saleOfflineId} onValueChange={v => handleChange('saleOfflineId', v)}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName} - {s.employeeId}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telesale</Label>
            <Select value={filters.telesaleId} onValueChange={v => handleChange('telesaleId', v)}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {telesaleStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName} - {s.employeeId}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nhóm dịch vụ</Label>
            <Select value={filters.serviceGroup} onValueChange={v => handleChange('serviceGroup', v)}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="HÀM MẶT">Hàm mặt</SelectItem>
                <SelectItem value="BODY">Body</SelectItem>
                <SelectItem value="TIỂU PHẪU">Tiểu phẫu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nguồn khách</Label>
            <Select value={filters.customerSource} onValueChange={v => handleChange('customerSource', v)}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="ADS">Ads</SelectItem>
                <SelectItem value="NGOÀI ADS">Ngoài Ads</SelectItem>
                <SelectItem value="CTV">Cộng tác viên</SelectItem>
                <SelectItem value="NGƯỜI QUEN">Người quen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tệp khách</Label>
            <Select value={filters.customerFileType} onValueChange={v => handleChange('customerFileType', v)}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="CŨ">Khách cũ</SelectItem>
                <SelectItem value="MỚI">Khách mới</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end lg:col-start-4">
            <Button variant="outline" onClick={handleReset} className="w-full flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Đặt lại bộ lọc
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueFilterBar;
