
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const KPIEditModal = ({ isOpen, onClose, record, onSave }) => {
  const [formData, setFormData] = useState({
    date: '',
    totalMessages: '',
    totalPhones: '',
    note: ''
  });

  useEffect(() => {
    if (record && isOpen) {
      setFormData({
        date: record.date || '',
        totalMessages: record.totalMessages || 0,
        totalPhones: record.totalPhones || 0,
        note: record.note || ''
      });
    }
  }, [record, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const messages = Number(formData.totalMessages);
    const phones = Number(formData.totalPhones);

    if (messages < 0 || phones < 0) {
      toast.error('Số liệu không được âm.');
      return;
    }

    if (phones > messages) {
      toast.error('Số điện thoại xin được không được lớn hơn tổng số tin nhắn.');
      return;
    }

    onSave({
      ...formData,
      totalMessages: messages,
      totalPhones: phones
    });
    
    toast.success('Đã cập nhật số liệu KPI Trực page.');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa số liệu ngày</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Ngày</Label>
            <Input 
              type="date" 
              value={formData.date} 
              disabled // Prevent changing date during edit to avoid unique key conflicts easily
              className="bg-muted"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tổng số tin nhắn</Label>
              <Input 
                type="number" 
                min="0"
                value={formData.totalMessages} 
                onChange={(e) => setFormData({...formData, totalMessages: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại xin được</Label>
              <Input 
                type="number" 
                min="0"
                value={formData.totalPhones} 
                onChange={(e) => setFormData({...formData, totalPhones: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea 
              placeholder="Nhập ghi chú (nếu có)..."
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit">Lưu thay đổi</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KPIEditModal;
