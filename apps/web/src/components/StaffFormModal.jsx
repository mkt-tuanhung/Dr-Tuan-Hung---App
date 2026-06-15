
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getUsers, saveUsers } from '@/utils/userStorage.js';

const ROLES = ['Admin', 'Nhân viên', 'Kế toán', 'Cổ đông'];
const POSITIONS = ['TELESALE', 'Điều dưỡng', 'Marketing', 'Media', 'Sale Offline', 'CSKH', 'Trực page'];

const StaffFormModal = ({ isOpen, onClose, editingUser, onSaveSuccess }) => {
  const [formData, setFormData] = useState({
    employeeId: '',
    password: '',
    fullName: '',
    role: 'Nhân viên',
    departmentPosition: '',
    baseSalary: 0,
    probationStatus: false,
    allowance: 0,
    phone: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          ...editingUser,
          password: '' // Don't populate password on edit
        });
      } else {
        setFormData({
          employeeId: '',
          password: '',
          fullName: '',
          role: 'Nhân viên',
          departmentPosition: '',
          baseSalary: 0,
          probationStatus: false,
          allowance: 0,
          phone: '',
          status: 'active'
        });
      }
      setErrors({});
    }
  }, [isOpen, editingUser]);

  const validate = () => {
    const newErrors = {};
    const users = getUsers();
    
    const cleanEmployeeId = formData.employeeId.trim().toLowerCase();
    
    if (!cleanEmployeeId) {
      newErrors.employeeId = 'ID nhân sự là bắt buộc';
    } else {
      const existing = users.find(u => u.employeeId.toLowerCase() === cleanEmployeeId && u.id !== editingUser?.id);
      if (existing) {
        newErrors.employeeId = 'ID nhân sự đã tồn tại';
      }
    }

    if (!editingUser && (!formData.password || formData.password.length < 8)) {
      newErrors.password = 'Mật khẩu bắt buộc và phải có ít nhất 8 ký tự';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Họ và tên là bắt buộc';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const users = getUsers();
    const now = new Date().toISOString();
    
    const cleanData = {
      ...formData,
      employeeId: formData.employeeId.trim().toLowerCase(),
      fullName: formData.fullName.trim(),
      baseSalary: Number(formData.baseSalary) || 0,
      allowance: Number(formData.allowance) || 0,
      departmentPosition: formData.role === 'Nhân viên' ? formData.departmentPosition : '',
      updatedAt: now
    };

    if (editingUser) {
      // Edit mode
      const updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          // Preserve original password if not changing it here (password change is handled in ResetPasswordModal)
          const { password, ...restCleanData } = cleanData;
          return { ...u, ...restCleanData };
        }
        return u;
      });
      saveUsers(updatedUsers);
    } else {
      // Add mode
      const newUser = {
        ...cleanData,
        id: crypto.randomUUID(),
        createdAt: now
      };
      saveUsers([...users, newUser]);
    }

    toast.success('Lưu thành công');
    if (onSaveSuccess) onSaveSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingUser ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="employeeId">ID nhân sự <span className="text-destructive">*</span></Label>
            <Input
              id="employeeId"
              value={formData.employeeId}
              onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
              placeholder="VD: nv01"
              disabled={!!editingUser}
            />
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId}</p>}
          </div>

          {!editingUser && (
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu <span className="text-destructive">*</span></Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Ít nhất 8 ký tự"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="fullName">Họ và tên <span className="text-destructive">*</span></Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              placeholder="Nhập họ và tên"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label>Vai trò</Label>
            <Select 
              value={formData.role} 
              onValueChange={(val) => setFormData({...formData, role: val, departmentPosition: ''})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'Nhân viên' && (
            <div className="space-y-2">
              <Label>Vị trí chuyên môn</Label>
              <Select 
                value={formData.departmentPosition} 
                onValueChange={(val) => setFormData({...formData, departmentPosition: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vị trí" />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="baseSalary">Lương cơ bản (VNĐ)</Label>
            <Input
              id="baseSalary"
              type="number"
              min="0"
              value={formData.baseSalary}
              onChange={(e) => setFormData({...formData, baseSalary: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowance">Phụ cấp (VNĐ)</Label>
            <Input
              id="allowance"
              type="number"
              min="0"
              value={formData.allowance}
              onChange={(e) => setFormData({...formData, allowance: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="Nhập số điện thoại"
            />
          </div>

          <div className="space-y-2 flex flex-col justify-center">
            <Label className="mb-3">Trạng thái thử việc</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.probationStatus}
                onCheckedChange={(checked) => setFormData({...formData, probationStatus: checked})}
              />
              <span className="text-sm text-muted-foreground">
                {formData.probationStatus ? 'Đang thử việc' : 'Chính thức'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2 flex flex-col justify-center">
            <Label className="mb-3">Trạng thái hoạt động</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({...formData, status: checked ? 'active' : 'inactive'})}
              />
              <span className="text-sm text-muted-foreground">
                {formData.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
              </span>
            </div>
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave}>Lưu thông tin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffFormModal;
