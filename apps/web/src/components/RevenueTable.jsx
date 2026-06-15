
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Edit, Trash2, Search, Filter } from 'lucide-react';

const RevenueTable = ({ revenues, staff, loading, onSearch, onDelete }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');

  const getStaffName = (id) => {
    if (!id || id === 'none') return '-';
    const s = staff.find(x => x.id === id);
    return s ? s.name : '-';
  };

  const applyFilters = () => {
    onSearch({
      search: searchTerm,
      customer_source: sourceFilter,
      service_group: groupFilter
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-white/5 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm tên KH hoặc SĐT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Nguồn KH" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả nguồn</SelectItem>
              <SelectItem value="ADS">ADS</SelectItem>
              <SelectItem value="NGOÀI ADS">NGOÀI ADS</SelectItem>
              <SelectItem value="CTV">CTV</SelectItem>
              <SelectItem value="NGƯỜI QUEN">NGƯỜI QUEN</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Nhóm Dịch Vụ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả nhóm</SelectItem>
              <SelectItem value="BODY">BODY</SelectItem>
              <SelectItem value="HÀM MẶT">HÀM MẶT</SelectItem>
              <SelectItem value="TIỂU PHẪU">TIỂU PHẪU</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={applyFilters} variant="secondary">
            <Filter className="h-4 w-4 mr-2" /> Lọc
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Ngày</TableHead>
                <TableHead>Khách Hàng</TableHead>
                <TableHead>Dịch Vụ</TableHead>
                <TableHead>Phân Loại</TableHead>
                <TableHead>Nhân Sự</TableHead>
                <TableHead className="text-right">Doanh Thu</TableHead>
                <TableHead className="w-[100px] text-right">Thao Tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24 mt-2" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : revenues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Không tìm thấy dữ liệu phù hợp
                  </TableCell>
                </TableRow>
              ) : (
                revenues.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{item.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{item.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[150px]" title={item.service}>{item.service}</div>
                      <div className="text-xs text-primary">{item.service_group}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary/10 text-secondary">
                        {item.customer_source}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs"><span className="text-muted-foreground">S:</span> {getStaffName(item.sale_staff)}</div>
                      <div className="text-xs mt-1"><span className="text-muted-foreground">T:</span> {getStaffName(item.telesale_staff)}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                      {item.revenue.toLocaleString('vi-VN')} đ
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/revenue/${item.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                            if(window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
                              onDelete(item.id);
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default RevenueTable;
