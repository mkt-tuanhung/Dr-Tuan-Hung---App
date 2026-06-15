
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrencyInput, parseCurrencyInput } from '@/utils/currencyFormat.js';
import { saveKpiTarget, updateKpiTarget, getUsers } from '@/utils/userStorage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { Target } from 'lucide-react';

const KpiTargetForm = ({ editRecord, onSave, onCancel }) => {
  const { user: currentUser } = useAuth();
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    employeeId: '',
    month: currentMonthStr,
    targetType: 'telesale',
    targetValue: 0,
    note: ''
  });

  const [targetAmtStr, setTargetAmtStr] = useState('');

  const staffList = getUsers().filter(u => u.role === 'Nhân viên');

  useEffect(() => {
    if (editRecord) {
      setFormData({ ...editRecord });
      setTargetAmtStr(formatCurrencyInput(editRecord.targetValue || 0));
    } else {
      setFormData({
        employeeId: '', month: currentMonthStr, targetType: 'telesale', targetValue: 0, note: ''
      });
      setTargetAmtStr('');
    }
  }, [editRecord, currentMonthStr]);

  const handleCurrencyChange = (e) => {
    const valStr = e.target.value;
    const parsed = parseCurrencyInput(valStr);
    setTargetAmtStr(formatCurrencyInput(parsed));
    setFormData(prev => ({ ...prev, targetValue: parsed }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.month || !formData.targetValue) {
      return toast.error('Vui lòng điền nhân sự, tháng và mức KPI.');
    }

    const emp = staffList.find(s => s.id === formData.employeeId);
    
    const payload = {
      ...formData,
      employeeName: emp ? emp.fullName : '',
      departmentPosition: emp ? emp.departmentPosition : '',
      updatedBy: currentUser?.id
    };

    if (editRecord && editRecord.id) {
      updateKpiTarget(editRecord.id, payload);
      toast.success('Đã cập nhật KPI.');
    } else {
      payload.createdBy = currentUser?.id;
      saveKpiTarget(payload);
      toast.success('Đã giao KPI thành công.');
    }

    if (onSave) onSave();
    
    if (!editRecord) {
      setFormData({ employeeId: '', month: currentMonthStr, targetType: 'telesale', targetValue: 0, note: '' });
      setTargetAmtStr('');
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          {editRecord ? 'Chỉnh sửa KPI' : 'Giao KPI mới'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tháng (YYYY-MM) <span className="text-destructive">*</span></Label>
            <Input type="month" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Nhân sự <span className="text-destructive">*</span></Label>
            <Select value={formData.employeeId} onValueChange={v => setFormData({...formData, employeeId: v})} disabled={!!editRecord}>
              <SelectTrigger><SelectValue placeholder="Chọn nhân sự" /></SelectTrigger>
              <SelectContent>
                {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName} - {s.departmentPosition || 'NV'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Loại KPI <span className="text-destructive">*</span></Label>
            <Select value={formData.targetType} onValueChange={v => setFormData({...formData, targetType: v})} disabled={!!editRecord}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="telesale">Telesale</SelectItem>
                <SelectItem value="sale_offline">Sale Offline</SelectItem>
                <SelectItem value="direct_page">Trực Page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mức KPI (VNĐ) <span className="text-destructive">*</span></Label>
            <Input 
              value={targetAmtStr} 
              onChange={handleCurrencyChange} 
              placeholder="0" 
              className="font-medium text-primary"
              required 
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} rows={2} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 mt-2">
            {editRecord && <Button type="button" variant="outline" onClick={onCancel}>Hủy</Button>}
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              {editRecord ? 'Lưu thay đổi' : 'Lưu KPI'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default KpiTargetForm;
