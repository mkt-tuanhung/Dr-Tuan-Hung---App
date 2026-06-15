
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

const REQUEST_TYPES = [
  { value: 'leave_full', label: 'Nghỉ cả ngày' },
  { value: 'leave_morning', label: 'Nghỉ sáng' },
  { value: 'leave_afternoon', label: 'Nghỉ chiều' },
  { value: 'late', label: 'Xin đi muộn' },
  { value: 'early_leave', label: 'Xin về sớm' }
];

const AttendanceRequestForm = ({ date, employeeId, onSubmitSuccess, existingRequests }) => {
  const [formData, setFormData] = useState({
    requestType: '',
    requestedTime: '',
    reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsTime = formData.requestType === 'late' || formData.requestType === 'early_leave';

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.requestType) {
      toast.error('Vui lòng chọn loại yêu cầu');
      return;
    }
    if (needsTime && !formData.requestedTime) {
      toast.error('Vui lòng nhập thời gian xin phép');
      return;
    }
    if (!formData.reason.trim()) {
      toast.error('Vui lòng nhập lý do');
      return;
    }

    // Check duplicate pending requests
    const isDuplicate = existingRequests.some(r => 
      r.date === date && 
      r.employeeId === employeeId && 
      r.requestType === formData.requestType &&
      r.status === 'pending'
    );

    if (isDuplicate) {
      toast.error('Bạn đã có yêu cầu tương tự đang chờ duyệt trong ngày này.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      onSubmitSuccess({
        employeeId,
        date,
        requestType: formData.requestType,
        requestedTime: needsTime ? formData.requestedTime : null,
        reason: formData.reason.trim()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Loại yêu cầu</Label>
        <Select 
          value={formData.requestType} 
          onValueChange={(val) => setFormData({...formData, requestType: val, requestedTime: ''})}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn loại yêu cầu" />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsTime && (
        <div className="space-y-2">
          <Label>Thời gian dự kiến (Giờ:Phút)</Label>
          <Input 
            type="time" 
            value={formData.requestedTime}
            onChange={(e) => setFormData({...formData, requestedTime: e.target.value})}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Lý do</Label>
        <Textarea 
          placeholder="Nhập lý do chi tiết..." 
          value={formData.reason}
          onChange={(e) => setFormData({...formData, reason: e.target.value})}
          className="min-h-[80px]"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Gửi yêu cầu
      </Button>
    </form>
  );
};

export default AttendanceRequestForm;
