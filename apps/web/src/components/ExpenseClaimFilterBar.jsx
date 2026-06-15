
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Filter, Calendar, User, Tag, Activity, ArrowRightLeft } from 'lucide-react';

const CATEGORIES = [
  'Mua đồ công ty', 'Văn phòng phẩm', 'Đồ thờ/cúng', 
  'Tiếp khách', 'Vật tư', 'Marketing', 'Đi lại', 'Chi khác', 'Hoàn ứng'
];

const ExpenseClaimFilterBar = ({ filters, setFilters, users, showEmployeeFilter }) => {
  return (
    <div className="bg-card border border-border shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row flex-wrap sm:items-center gap-3">
      {/* Label Row */}
      <div className="flex items-center text-muted-foreground w-full sm:w-auto sm:mr-2">
        <Filter className="w-4 h-4 mr-2" />
        <span className="text-sm font-medium">Bộ lọc:</span>
      </div>

      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 border w-full sm:w-auto h-11 sm:h-8">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input 
          type="month" 
          value={filters.month === 'all' ? '' : filters.month}
          onChange={(e) => setFilters({ ...filters, month: e.target.value || 'all' })}
          className="h-full border-0 bg-transparent shadow-none w-full p-0 focus-visible:ring-0 text-base sm:text-sm"
        />
      </div>

      {showEmployeeFilter && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 border w-full sm:w-[160px] h-11 sm:h-8">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={filters.employeeId} onValueChange={(v) => setFilters({ ...filters, employeeId: v })}>
            <SelectTrigger className="h-full border-0 bg-transparent shadow-none p-0 focus:ring-0 text-base sm:text-sm w-full">
              <SelectValue placeholder="Tất cả nhân sự" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả nhân sự</SelectItem>
              {users?.map(u => (
                <SelectItem key={u.employeeId || u.id} value={u.employeeId || u.id}>{u.fullName || u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 border w-full sm:w-[160px] h-11 sm:h-8">
        <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={filters.transactionType} onValueChange={(v) => setFilters({ ...filters, transactionType: v })}>
          <SelectTrigger className="h-full border-0 bg-transparent shadow-none p-0 focus:ring-0 text-base sm:text-sm w-full">
            <SelectValue placeholder="Loại giao dịch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả giao dịch</SelectItem>
            <SelectItem value="advance_expense">Tạm ứng chi</SelectItem>
            <SelectItem value="reimbursement">Hoàn ứng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 border w-full sm:w-[160px] h-11 sm:h-8">
        <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
          <SelectTrigger className="h-full border-0 bg-transparent shadow-none p-0 focus:ring-0 text-base sm:text-sm w-full">
            <SelectValue placeholder="Tất cả danh mục" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả danh mục</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 border w-full sm:w-[160px] h-11 sm:h-8">
        <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="h-full border-0 bg-transparent shadow-none p-0 focus:ring-0 text-base sm:text-sm w-full">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Đã duyệt</SelectItem>
            <SelectItem value="partially_reimbursed">Đã hoàn một phần</SelectItem>
            <SelectItem value="reimbursed">Đã hoàn ứng đủ</SelectItem>
            <SelectItem value="paid">Đã hoàn ứng</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default ExpenseClaimFilterBar;
