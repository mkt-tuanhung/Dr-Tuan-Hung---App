
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { saveRevenueRecord, updateRevenueRecord, getUsers } from '@/utils/userStorage.js';
import { saveRevenueRecordToSupabase, updateRevenueRecordToSupabase } from '@/services/dataService.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Banknote } from 'lucide-react';

const resolveEmployeeId = (val, staffList) => {
  if (!val) return '';
  const staff = staffList.find(s => s.employeeId === val || s.id === val);
  return staff ? staff.employeeId : val;
};

const RevenueForm = ({ editRecord, onSave, onCancel }) => {
  const { user: currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    revenueDate: format(new Date(), 'yyyy-MM-dd'),
    customerName: '',
    customerPhone: '',
    saleOfflineEmployeeId: '',
    telesaleEmployeeId: '',
    serviceUsed: '',
    serviceGroup: 'HÀM MẶT',
    customerSource: 'ADS',
    customerFileType: 'MỚI',
    revenueAmount: 0,
    upsaleRevenue: 0,
    note: ''
  });

  const users = useMemo(() => getUsers(), []);
  
  const saleOfflineStaff = useMemo(() => {
    return users.filter(u => u.role === 'Nhân viên' && (u.departmentPosition || '').toLowerCase().trim() === 'sale offline');
  }, [users]);

  const telesaleStaff = useMemo(() => {
    return users.filter(u => u.role === 'Nhân viên' && (u.departmentPosition || '').toLowerCase().trim() === 'telesale');
  }, [users]);

  useEffect(() => {
    if (editRecord) {
      setFormData({
        ...editRecord,
        revenueDate: editRecord.revenueDate || editRecord.date || format(new Date(), 'yyyy-MM-dd'),
        serviceGroup: editRecord.serviceGroup || 'HÀM MẶT',
        customerSource: editRecord.customerSource || 'ADS',
        customerFileType: editRecord.customerFileType || 'MỚI',
        revenueAmount: Number(editRecord.revenueAmount || editRecord.surgeryRevenue || editRecord.amount || editRecord.revenue) || 0,
        upsaleRevenue: Number(editRecord.upsaleRevenue || editRecord.upsaleAmount) || 0,
        telesaleEmployeeId: resolveEmployeeId(editRecord.telesaleEmployeeId, telesaleStaff),
        saleOfflineEmployeeId: resolveEmployeeId(editRecord.saleOfflineEmployeeId, saleOfflineStaff)
      });
    } else {
      setFormData({
        revenueDate: format(new Date(), 'yyyy-MM-dd'),
        customerName: '', customerPhone: '', serviceUsed: '',
        serviceGroup: 'HÀM MẶT', customerSource: 'ADS', customerFileType: 'MỚI',
        revenueAmount: 0, upsaleRevenue: 0,
        telesaleEmployeeId: '', saleOfflineEmployeeId: '', note: ''
      });
    }
  }, [editRecord, telesaleStaff, saleOfflineStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.revenueDate || !formData.customerName || !formData.customerPhone || !formData.revenueAmount) {
      return toast.error('Vui lòng điền các trường bắt buộc.');
    }

    const month = formData.revenueDate.substring(0, 7);
    
    const teleStaff = telesaleStaff.find(s => s.employeeId === formData.telesaleEmployeeId);
    const saleStaff = saleOfflineStaff.find(s => s.employeeId === formData.saleOfflineEmployeeId);

    const recordPayload = {
      ...formData,
      month,
      telesaleName: teleStaff ? teleStaff.fullName : '',
      saleOfflineName: saleStaff ? saleStaff.fullName : '',
      revenueAmount: Number(formData.revenueAmount) || 0,
      upsaleRevenue: Number(formData.upsaleRevenue) || 0,
      updatedBy: currentUser?.employeeId || currentUser?.id
    };

    try {
      if (editRecord && editRecord.id) {
        const updatedRecord = updateRevenueRecord(editRecord.id, recordPayload);
        if (updatedRecord) {
          toast.success('Đã cập nhật doanh thu khách hàng.');
          await updateRevenueRecordToSupabase(updatedRecord);
        }
      } else {
        recordPayload.createdBy = currentUser?.employeeId || currentUser?.id;
        const newRecord = saveRevenueRecord(recordPayload);
        if (newRecord) {
          toast.success('Đã ghi nhận doanh thu khách hàng.');
          await saveRevenueRecordToSupabase(newRecord);
        }
      }

      if (onSave) onSave();
      
      if (!editRecord) {
        setFormData({
          revenueDate: format(new Date(), 'yyyy-MM-dd'),
          customerName: '', customerPhone: '', serviceUsed: '',
          serviceGroup: 'HÀM MẶT', customerSource: 'ADS', customerFileType: 'MỚI',
          revenueAmount: 0, upsaleRevenue: 0,
          telesaleEmployeeId: '', saleOfflineEmployeeId: '', note: ''
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu doanh thu.');
    }
  };

  return (
    <Card className="shadow-lg border-none bg-card w-full rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-border/50 pb-5 pt-6 px-4 md:px-6">
        <CardTitle className="text-lg md:text-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-emerald-600" />
          </div>
          {editRecord ? 'Chỉnh sửa doanh thu' : 'Nhập doanh thu khách hàng'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Thông tin khách hàng</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ngày <span className="text-destructive">*</span></Label>
                <Input type="date" value={formData.revenueDate} onChange={e => setFormData({...formData, revenueDate: e.target.value})} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Họ tên khách hàng <span className="text-destructive">*</span></Label>
                <Input value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} required placeholder="Nguyễn Văn A" className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Số điện thoại <span className="text-destructive">*</span></Label>
                <Input value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} required placeholder="090..." className="w-full" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Thông tin dịch vụ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Dịch vụ sử dụng</Label>
                <Input value={formData.serviceUsed} onChange={e => setFormData({...formData, serviceUsed: e.target.value})} placeholder="VD: Khám tổng quát" className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Nhóm dịch vụ</Label>
                <Select value={formData.serviceGroup} onValueChange={v => setFormData({...formData, serviceGroup: v})}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HÀM MẶT">Hàm mặt</SelectItem>
                    <SelectItem value="BODY">Body</SelectItem>
                    <SelectItem value="TIỂU PHẪU">Tiểu phẫu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nguồn khách</Label>
                <Select value={formData.customerSource} onValueChange={v => setFormData({...formData, customerSource: v})}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADS">Ads</SelectItem>
                    <SelectItem value="NGOÀI ADS">Ngoài Ads</SelectItem>
                    <SelectItem value="CTV">Cộng tác viên</SelectItem>
                    <SelectItem value="NGƯỜI QUEN">Người quen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tệp khách hàng</Label>
                <Select value={formData.customerFileType} onValueChange={v => setFormData({...formData, customerFileType: v})}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MỚI">Khách mới</SelectItem>
                    <SelectItem value="CŨ">Khách cũ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Doanh thu & Phụ trách</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Doanh thu (VNĐ) <span className="text-destructive">*</span></Label>
                <CurrencyInput value={formData.revenueAmount} onChange={val => setFormData({...formData, revenueAmount: val})} className="text-emerald-600 font-bold w-full" required />
              </div>
              <div className="space-y-2">
                <Label>Doanh thu Upsale (VNĐ)</Label>
                <CurrencyInput value={formData.upsaleRevenue} onChange={val => setFormData({...formData, upsaleRevenue: val})} className="text-primary font-bold w-full" />
              </div>
              <div className="space-y-2">
                <Label>Sale Offline phụ trách</Label>
                <Select value={formData.saleOfflineEmployeeId || 'none'} onValueChange={v => setFormData({...formData, saleOfflineEmployeeId: v === 'none' ? '' : v})}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn Sale Offline" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Không có --</SelectItem>
                    {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telesale phụ trách</Label>
                <Select value={formData.telesaleEmployeeId || 'none'} onValueChange={v => setFormData({...formData, telesaleEmployeeId: v === 'none' ? '' : v})}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn Telesale" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Không có --</SelectItem>
                    {telesaleStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label>Ghi chú thêm</Label>
                <Textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Ghi chú chi tiết..." className="min-h-[80px] w-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-6 border-t border-border/50">
            {editRecord && <Button type="button" variant="outline" onClick={onCancel} className="w-full md:w-auto h-12 md:h-10">Hủy chỉnh sửa</Button>}
            <Button type="submit" className="w-full md:w-auto min-w-[200px] h-12 md:h-10 bg-emerald-600 hover:bg-emerald-700 font-bold text-base md:text-sm">
              {editRecord ? 'Lưu thay đổi' : 'Ghi nhận doanh thu'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RevenueForm;
