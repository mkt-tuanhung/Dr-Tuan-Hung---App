
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getUsers, 
  savePageDailyReport, 
  updatePageDailyReport, 
  getPagePhoneAssignments, 
  savePagePhoneAssignment, 
  updatePagePhoneAssignment 
} from '@/utils/userStorage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const KPIPageDailyReportForm = ({ initialData, onSaved, onCancel }) => {
  const { user } = useAuth();
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(initialData?.date || defaultDate);
  const [totalMessages, setTotalMessages] = useState(initialData?.totalMessages || initialData?.messagesCount || '');
  const [totalPhones, setTotalPhones] = useState(initialData?.totalPhones || initialData?.phonesReceived || '');
  const [telesaleEmployeeId, setTelesaleEmployeeId] = useState(initialData?.telesaleEmployeeId || '');
  const [note, setNote] = useState(initialData?.note || '');

  const users = getUsers();
  const telesales = users.filter(u => u.departmentPosition?.trim().toLowerCase() === 'telesale');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!date || totalMessages === '' || totalPhones === '') {
      toast.error("Vui lòng điền đầy đủ ngày, số tin nhắn và số điện thoại.");
      return;
    }

    const month = date.substring(0, 7);
    const selectedTelesale = telesales.find(t => t.employeeId === telesaleEmployeeId);

    const reportData = {
      date,
      month,
      employeeId: user?.employeeId || user?.id || '',
      totalMessages: Number(totalMessages),
      totalPhones: Number(totalPhones),
      telesaleEmployeeId: selectedTelesale?.employeeId || '',
      telesaleName: selectedTelesale?.fullName || '',
      note
    };

    let reportId = initialData?.id;

    if (initialData?.id) {
      updatePageDailyReport(initialData.id, reportData);
    } else {
      reportId = crypto.randomUUID();
      savePageDailyReport({ id: reportId, ...reportData });
    }

    // Sync to pagePhoneAssignments
    if (selectedTelesale && Number(totalPhones) > 0) {
      const assignments = getPagePhoneAssignments();
      const existingAssignment = assignments.find(a => a.sourceReportId === reportId);
      
      const assignmentData = {
        sourceReportId: reportId,
        date,
        month,
        pageEmployeeId: user?.employeeId || '',
        pageName: user?.fullName || '',
        telesaleEmployeeId: selectedTelesale.employeeId,
        telesaleName: selectedTelesale.fullName,
        phoneCount: Number(totalPhones),
        note
      };

      if (existingAssignment) {
        updatePagePhoneAssignment(existingAssignment.id, assignmentData);
      } else {
        savePagePhoneAssignment(assignmentData);
      }
    }

    toast.success(initialData ? "Cập nhật báo cáo thành công" : "Đã lưu báo cáo ngày");
    if (onSaved) onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ngày báo cáo</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Telesale nhận số</Label>
          <Select value={telesaleEmployeeId} onValueChange={setTelesaleEmployeeId}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Chọn Telesale..." />
            </SelectTrigger>
            <SelectContent>
              {telesales.length === 0 ? (
                <SelectItem value="none" disabled>Không có nhân viên Telesale</SelectItem>
              ) : (
                telesales.map(t => (
                  <SelectItem key={t.employeeId} value={t.employeeId}>
                    {t.fullName} ({t.employeeId})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tổng TN/Comment</Label>
          <Input type="number" min="0" value={totalMessages} onChange={e => setTotalMessages(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>SĐT thu về</Label>
          <Input type="number" min="0" value={totalPhones} onChange={e => setTotalPhones(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Ghi chú</Label>
        <Textarea 
          value={note} 
          onChange={e => setNote(e.target.value)} 
          placeholder="Nhập ghi chú nếu có..." 
          rows={3} 
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Hủy</Button>
        )}
        <Button type="submit" className="bg-primary text-primary-foreground">
          {initialData ? 'Cập nhật' : 'Lưu báo cáo'}
        </Button>
      </div>
    </form>
  );
};

export default KPIPageDailyReportForm;
