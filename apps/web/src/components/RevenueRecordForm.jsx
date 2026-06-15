
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrencyInput, parseCurrencyInput } from '@/utils/currencyFormat.js';
import { saveRevenueRecord, updateRevenueRecord } from '@/utils/userStorage.js';
import { saveRevenueRecordToSupabase, updateRevenueRecordToSupabase } from '@/services/dataService.js';
import { getStaffByPosition } from '@/utils/staffPositionUtils.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Banknote } from 'lucide-react';
import { normalize, matchId } from '@/utils/kpiPayrollHelper.js';

const RevenueRecordForm = ({ editRecord, onSave, onCancel }) => {
  const { user: currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    revenueDate: format(new Date(), 'yyyy-MM-dd'),
    customerName: '',
    customerPhone: '',
    serviceUsed: '',
    serviceGroup: 'HÀM MẶT',
    customerSource: 'ADS',
    customerFileType: 'MỚI',
    revenueAmount: 0,
    upsaleRevenue: 0,
    telesaleEmployeeId: '',
    saleOfflineEmployeeId: '',
    note: ''
  });

  const [revAmtStr, setRevAmtStr] = useState('');
  const [upsaleAmtStr, setUpsaleAmtStr] = useState('');

  const telesaleStaff = getStaffByPosition('telesale');
  const saleOfflineStaff = getStaffByPosition('sale offline');

  useEffect(() => {
    if (editRecord) {
      const resolvedTele = telesaleStaff.find(s => matchId(editRecord.telesaleEmployeeId, s));
      const resolvedSale = saleOfflineStaff.find(s => matchId(editRecord.saleOfflineEmployeeId, s));

      setFormData({
        ...editRecord,
        revenueDate: editRecord.revenueDate || editRecord.date || format(new Date(), 'yyyy-MM-dd'),
        serviceGroup: editRecord.serviceGroup || 'HÀM MẶT',
        customerSource: editRecord.customerSource || 'ADS',
        customerFileType: editRecord.customerFileType || 'MỚI',
        telesaleEmployeeId: resolvedTele?.employeeId || editRecord.telesaleEmployeeId || '',
        saleOfflineEmployeeId: resolvedSale?.employeeId || editRecord.saleOfflineEmployeeId || ''
      });
      const revAmt = Number(editRecord.revenueAmount || editRecord.surgeryRevenue || editRecord.amount || editRecord.revenue) || 0;
      const upAmt = Number(editRecord.upsaleRevenue || editRecord.upsaleAmount) || 0;
      setRevAmtStr(formatCurrencyInput(revAmt));
      setUpsaleAmtStr(formatCurrencyInput(upAmt));
      setFormData(prev => ({...prev, revenueAmount: revAmt, upsaleRevenue: upAmt}));
    } else {
      let initialTele = '';
      let initialSale = '';
      const pos = normalize(currentUser?.departmentPosition);
      if (pos === 'telesale' || pos === 'tele') initialTele = currentUser?.employeeId || currentUser?.id || '';
      if (pos === 'sale offline' || pos === 'sale') initialSale = currentUser?.employeeId || currentUser?.id || '';

      setFormData({
        revenueDate: format(new Date(), 'yyyy-MM-dd'),
        customerName: '', customerPhone: '', serviceUsed: '',
        serviceGroup: 'HÀM MẶT', customerSource: 'ADS', customerFileType: 'MỚI',
        revenueAmount: 0, upsaleRevenue: 0,
        telesaleEmployeeId: initialTele, saleOfflineEmployeeId: initialSale, note: ''
      });
      setRevAmtStr('');
      setUpsaleAmtStr('');
    }
  }, [editRecord, telesaleStaff, saleOfflineStaff, currentUser]);

  const handleCurrencyChange = (field, setStrFn) => (e) => {
    const valStr = e.target.value;
    const parsed = parseCurrencyInput(valStr);
    setStrFn(formatCurrencyInput(parsed));
    setFormData(prev => ({ ...prev, [field]: parsed }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.revenueDate || !formData.customerName || !formData.revenueAmount) {
      return toast.error('Vui lòng điền các trường bắt buộc (Ngày, Tên KH, Doanh thu).');
    }

    const month = formData.revenueDate.substring(0, 7);
    
    const teleStaff = telesaleStaff.find(s => s.employeeId === formData.telesaleEmployeeId);
    const saleStaff = saleOfflineStaff.find(s => s.employeeId === formData.saleOfflineEmployeeId);

    const recordPayload = {
      ...formData,
      month,
      telesaleName: teleStaff ? teleStaff.fullName : formData.telesaleName || '',
      saleOfflineName: saleStaff ? saleStaff.fullName : formData.saleOfflineName || '',
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
        setRevAmtStr('');
        setUpsaleAmtStr('');
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu doanh thu.');
    }
  };

  return (
    <Card className="shadow-sm border-border bg-card">
      <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-600" />
          {editRecord ? 'Chỉnh sửa doanh thu' : 'Nhập doanh thu khách hàng'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Ngày ghi nhận <span className="text-destructive">*</span></Label>
            <Input type="date" value={formData.revenueDate} onChange={e => setFormData({...formData, revenueDate: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Tên khách hàng <span className="text-destructive">*</span></Label>
            <Input value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} required placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-2">
            <Label>Số điện thoại</Label>
            <Input value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} placeholder="090..." />
          </div>

          <div className="space-y-2">
            <Label>Nhóm dịch vụ</Label>
            <Select value={formData.serviceGroup} onValueChange={v => setFormData({...formData, serviceGroup: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HÀM MẶT">Hàm mặt</SelectItem>
                <SelectItem value="BODY">Body</SelectItem>
                <SelectItem value="TIỂU PHẪU">Tiểu phẫu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chi tiết dịch vụ</Label>
            <Input value={formData.serviceUsed} onChange={e => setFormData({...formData, serviceUsed: e.target.value})} placeholder="VD: Khám tổng quát" />
          </div>
          <div className="space-y-2">
            <Label>Nguồn khách</Label>
            <Select value={formData.customerSource} onValueChange={v => setFormData({...formData, customerSource: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MỚI">Khách mới</SelectItem>
                <SelectItem value="CŨ">Khách cũ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Doanh thu (VNĐ) <span className="text-destructive">*</span></Label>
            <Input 
              value={revAmtStr} 
              onChange={handleCurrencyChange('revenueAmount', setRevAmtStr)} 
              placeholder="0" 
              className="font-semibold text-emerald-600"
              required 
            />
          </div>
          <div className="space-y-2">
            <Label>Doanh thu Upsale (VNĐ)</Label>
            <Input 
              value={upsaleAmtStr} 
              onChange={handleCurrencyChange('upsaleRevenue', setUpsaleAmtStr)} 
              placeholder="0" 
              className="font-semibold text-primary"
            />
          </div>

          <div className="space-y-2">
            <Label>Telesale phụ trách</Label>
            <Select value={formData.telesaleEmployeeId || 'none'} onValueChange={v => setFormData({...formData, telesaleEmployeeId: v === 'none' ? '' : v})}>
              <SelectTrigger><SelectValue placeholder="Chọn Telesale" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không có --</SelectItem>
                {telesaleStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sale Offline phụ trách</Label>
            <Select value={formData.saleOfflineEmployeeId || 'none'} onValueChange={v => setFormData({...formData, saleOfflineEmployeeId: v === 'none' ? '' : v})}>
              <SelectTrigger><SelectValue placeholder="Chọn Sale Offline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không có --</SelectItem>
                {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Ghi chú</Label>
            <Input value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Ghi chú thêm..." />
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 mt-4 border-t border-border/50 pt-4">
            {editRecord && <Button type="button" variant="outline" onClick={onCancel}>Hủy chỉnh sửa</Button>}
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 min-w-[150px]">
              {editRecord ? 'Lưu thay đổi' : 'Ghi nhận doanh thu'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RevenueRecordForm;
