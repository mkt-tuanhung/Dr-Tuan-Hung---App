
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, Key, Lock, Unlock, Trash2, CheckCircle, MoreVertical } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';

const ResponsiveStaffCard = ({ u, onEdit, onResetPassword, openConfirmModal }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-3 relative">
      <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--mint-100))] text-[hsl(var(--mint-700))] flex items-center justify-center font-bold text-lg uppercase shrink-0">
            {u.fullName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight text-foreground pr-6">{u.fullName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{u.employeeId} • {u.role}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{u.departmentPosition || 'Chưa có vị trí'}</p>
          </div>
        </div>
        
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4 text-gray-500" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit(u)} className="py-3"><Edit className="mr-2 h-4 w-4" /> Sửa</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResetPassword(u)} className="py-3"><Key className="mr-2 h-4 w-4" /> Đổi mật khẩu</DropdownMenuItem>
              {u.probationStatus && (
                <DropdownMenuItem onClick={() => openConfirmModal('endProbation', u)} className="py-3"><CheckCircle className="mr-2 h-4 w-4" /> Kết thúc thử việc</DropdownMenuItem>
              )}
              {u.status === 'active' ? (
                <DropdownMenuItem onClick={() => openConfirmModal('lock', u)} className="text-amber-600 py-3"><Lock className="mr-2 h-4 w-4" /> Khóa</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => openConfirmModal('unlock', u)} className="text-emerald-600 py-3"><Unlock className="mr-2 h-4 w-4" /> Mở khóa</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openConfirmModal('delete', u)} className="text-destructive py-3"><Trash2 className="mr-2 h-4 w-4" /> Xóa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {u.status === 'active' ? <Badge className="bg-emerald-500 text-white font-semibold border-none shadow-none text-[10px] px-1.5 py-0">Đang hoạt động</Badge> : <Badge variant="destructive" className="font-semibold text-[10px] px-1.5 py-0">Đã khóa</Badge>}
        {u.status === 'active' && (
          u.probationStatus ? <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-medium text-[10px] px-1.5 py-0 shadow-none">Thử việc</Badge> : <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 font-medium text-[10px] px-1.5 py-0 shadow-none">Chính thức</Badge>
        )}
      </div>
      
      <div className="space-y-2 text-sm bg-gray-50/50 rounded-xl p-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-xs">Lương cơ bản:</span>
          <span className="font-semibold text-foreground">{formatVND(u.baseSalary)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-xs">Phụ cấp:</span>
          <span className="font-semibold text-foreground">{formatVND(u.allowance)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
          <span className="text-muted-foreground text-xs">Số điện thoại:</span>
          <span className="font-medium text-foreground">{u.phone || 'Chưa cập nhật'}</span>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveStaffCard;
