
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const KPIAdminPageTargetForm = ({ employees, month, year, onSaveSuccess }) => {
  const [kpiForm, setKpiForm] = useState({
    employeeId: '',
    targetPhones: '',
    targetConversionRate: '10',
    note: ''
  });

  const handleAssignKPI = (e) => {
    e.preventDefault();
    if (!kpiForm.employeeId || !kpiForm.targetPhones) {
      toast.error('Vui lòng chọn nhân viên và nhập chỉ tiêu.');
      return;
    }

    const allTargets = getStorageItem('kpiTargets', []);
    const index = allTargets.findIndex(t => t.employeeId === kpiForm.employeeId && t.month === month && t.year === year);
    
    const now = new Date().toISOString();
    
    if (index >= 0) {
      allTargets[index] = {
        ...allTargets[index],
        targetPhones: Number(kpiForm.targetPhones),
        targetConversionRate: Number(kpiForm.targetConversionRate),
        note: kpiForm.note,
        updatedAt: now
      };
    } else {
      allTargets.push({
        id: crypto.randomUUID(),
        employeeId: kpiForm.employeeId,
        month,
        year,
        targetPhones: Number(kpiForm.targetPhones),
        targetConversionRate: Number(kpiForm.targetConversionRate),
        note: kpiForm.note,
        createdAt: now,
        updatedAt: now
      });
    }
    
    setStorageItem('kpiTargets', allTargets);
    toast.success('Đã lưu KPI mục tiêu.');
    setKpiForm({ employeeId: '', targetPhones: '', targetConversionRate: '10', note: '' });
    if (onSaveSuccess) onSaveSuccess();
  };

  return (
    <Card className="lg:col-span-1 shadow-sm border-border h-fit">
      <CardHeader className="bg-muted/30 border-b border-border/50">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Giao KPI
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleAssignKPI} className="space-y-4">
          <div className="space-y-2">
            <Label>Nhân viên</Label>
            <Select value={kpiForm.employeeId} onValueChange={v => setKpiForm({...kpiForm, employeeId: v})}>
              <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.employeeId} - {e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Chỉ tiêu số điện thoại</Label>
            <Input 
              type="number" 
              min="0"
              placeholder="Vd: 300"
              value={kpiForm.targetPhones}
              onChange={e => setKpiForm({...kpiForm, targetPhones: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>Chỉ tiêu Tỷ lệ xin số (%)</Label>
            <Input 
              type="number" 
              min="0"
              max="100"
              step="0.1"
              value={kpiForm.targetConversionRate}
              onChange={e => setKpiForm({...kpiForm, targetConversionRate: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>Ghi chú / Yêu cầu thêm</Label>
            <Textarea 
              placeholder="Nhập ghi chú..."
              value={kpiForm.note}
              onChange={e => setKpiForm({...kpiForm, note: e.target.value})}
              className="h-20"
            />
          </div>

          <Button type="submit" className="w-full">Lưu KPI</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default KPIAdminPageTargetForm;
