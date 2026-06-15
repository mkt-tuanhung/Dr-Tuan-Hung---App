
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getUsers } from '@/utils/userStorage.js';
import { saveSurgicalAssignment, getSurgicalAssignmentByAppointmentId } from '@/utils/surgicalCareAssignments.js';
import { toast } from 'sonner';
import { Activity, Moon, HeartPulse, Loader2 } from 'lucide-react';

const NursingAssignmentModal = ({ isOpen, onClose, appointment, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('phu_mo');
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    appointmentId: '',
    customerName: '',
    phone: '',
    serviceName: '',
    surgeryGroup: 'TIỂU PHẪU',
    surgeryDate: '',
    appointmentDate: '',
    saleOfflineEmployeeId: '',
    saleOfflineName: '',
    
    // Scrub
    scrubNurse1EmployeeId: 'none',
    scrubNurse2EmployeeId: 'none',
    scrubNurse3EmployeeId: 'none',
    scrubNote: '',
    
    // Night
    hasNightShift: false,
    nightNurseEmployeeIds: [],
    nightShiftDate: '',
    nightShiftNote: '',
    
    // Post-op
    postOpNurseEmployeeIds: [],
    postOpStatus: 'Đang chăm sóc',
    postOpNote: ''
  });

  const nursingStaff = useMemo(() => {
    const users = getUsers();
    return users.filter(u => {
      const pos = (u.departmentPosition || '').trim().toLowerCase();
      return (pos === 'điều dưỡng' || pos === 'dieu duong' || pos === 'nursing') && u.status !== 'inactive';
    });
  }, []);

  useEffect(() => {
    if (isOpen && appointment) {
      const existing = getSurgicalAssignmentByAppointmentId(appointment.id);
      
      if (existing) {
        setFormData({
          ...existing,
          scrubNurse1EmployeeId: existing.scrubNurse1EmployeeId || 'none',
          scrubNurse2EmployeeId: existing.scrubNurse2EmployeeId || 'none',
          scrubNurse3EmployeeId: existing.scrubNurse3EmployeeId || 'none',
          nightNurseEmployeeIds: existing.nightNurseEmployeeIds || [],
          postOpNurseEmployeeIds: existing.postOpNurseEmployeeIds || [],
          hasNightShift: existing.nightNurseEmployeeIds?.length > 0 || !!existing.nightShiftDate
        });
      } else {
        setFormData({
          id: null,
          appointmentId: appointment.id,
          customerName: appointment.customerName || '',
          phone: appointment.phone || '',
          serviceName: appointment.service || appointment.serviceName || '',
          surgeryGroup: 'TIỂU PHẪU',
          surgeryDate: appointment.appointmentDate || new Date().toISOString().split('T')[0],
          appointmentDate: appointment.appointmentDate || '',
          saleOfflineEmployeeId: appointment.saleOfflineEmployeeId || '',
          saleOfflineName: appointment.saleOfflineName || '',
          
          scrubNurse1EmployeeId: 'none',
          scrubNurse2EmployeeId: 'none',
          scrubNurse3EmployeeId: 'none',
          scrubNote: '',
          
          hasNightShift: false,
          nightNurseEmployeeIds: [],
          nightShiftDate: '',
          nightShiftNote: '',
          
          postOpNurseEmployeeIds: [],
          postOpStatus: 'Đang chăm sóc',
          postOpNote: ''
        });
      }
      setActiveTab('phu_mo');
    }
  }, [isOpen, appointment]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const getStaffName = (empId) => {
        if (!empId || empId === 'none') return '';
        const staff = nursingStaff.find(s => s.employeeId === empId);
        return staff ? staff.fullName : '';
      };

      const nightNurseNames = formData.nightNurseEmployeeIds.map(getStaffName).filter(Boolean);
      const postOpNurseNames = formData.postOpNurseEmployeeIds.map(getStaffName).filter(Boolean);

      const payload = {
        ...formData,
        scrubNurse1EmployeeId: formData.scrubNurse1EmployeeId === 'none' ? '' : formData.scrubNurse1EmployeeId,
        scrubNurse2EmployeeId: formData.scrubNurse2EmployeeId === 'none' ? '' : formData.scrubNurse2EmployeeId,
        scrubNurse3EmployeeId: formData.scrubNurse3EmployeeId === 'none' ? '' : formData.scrubNurse3EmployeeId,
        scrubNurse1Name: getStaffName(formData.scrubNurse1EmployeeId),
        scrubNurse2Name: getStaffName(formData.scrubNurse2EmployeeId),
        scrubNurse3Name: getStaffName(formData.scrubNurse3EmployeeId),
        nightNurseEmployeeIds: formData.hasNightShift ? formData.nightNurseEmployeeIds : [],
        nightNurseNames: formData.hasNightShift ? nightNurseNames : [],
        nightShiftDate: formData.hasNightShift ? formData.nightShiftDate : '',
        postOpNurseNames,
        updatedBy: currentUser?.employeeId || 'system'
      };

      await saveSurgicalAssignment(payload);
      toast.success('Đã lưu phân công Điều dưỡng');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi lưu phân công');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNightNurse = (empId) => {
    setFormData(prev => {
      const current = prev.nightNurseEmployeeIds || [];
      if (current.includes(empId)) {
        return { ...prev, nightNurseEmployeeIds: current.filter(id => id !== empId) };
      } else {
        return { ...prev, nightNurseEmployeeIds: [...current, empId] };
      }
    });
  };

  const togglePostOpNurse = (empId) => {
    setFormData(prev => {
      const current = prev.postOpNurseEmployeeIds || [];
      if (current.includes(empId)) {
        return { ...prev, postOpNurseEmployeeIds: current.filter(id => id !== empId) };
      } else {
        return { ...prev, postOpNurseEmployeeIds: [...current, empId] };
      }
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Phân công Điều dưỡng
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            Khách hàng: <span className="font-semibold text-foreground">{formData.customerName}</span> - {formData.serviceName}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="phu_mo" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Activity className="w-4 h-4 mr-2" /> Phụ mổ
              </TabsTrigger>
              <TabsTrigger value="truc_dem" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Moon className="w-4 h-4 mr-2" /> Trực đêm
              </TabsTrigger>
              <TabsTrigger value="hau_phau" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <HeartPulse className="w-4 h-4 mr-2" /> Hậu phẫu
              </TabsTrigger>
            </TabsList>

            {/* TAB: PHỤ MỔ */}
            <TabsContent value="phu_mo" className="space-y-5 mt-0 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Nhóm phẫu thuật</Label>
                  <Select value={formData.surgeryGroup} onValueChange={v => setFormData({...formData, surgeryGroup: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TIỂU PHẪU">Tiểu phẫu</SelectItem>
                      <SelectItem value="ĐẠI PHẪU">Đại phẫu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ngày phẫu thuật</Label>
                  <Input type="date" value={formData.surgeryDate} onChange={e => setFormData({...formData, surgeryDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                  Ê-kíp Phụ mổ
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Phụ mổ 1 (Chính)</Label>
                    <Select value={formData.scrubNurse1EmployeeId} onValueChange={v => setFormData({...formData, scrubNurse1EmployeeId: v})}>
                      <SelectTrigger><SelectValue placeholder="Chọn ĐD" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Trống --</SelectItem>
                        {nursingStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Phụ mổ 2</Label>
                    <Select value={formData.scrubNurse2EmployeeId} onValueChange={v => setFormData({...formData, scrubNurse2EmployeeId: v})}>
                      <SelectTrigger><SelectValue placeholder="Chọn ĐD" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Trống --</SelectItem>
                        {nursingStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Phụ mổ 3</Label>
                    <Select value={formData.scrubNurse3EmployeeId} onValueChange={v => setFormData({...formData, scrubNurse3EmployeeId: v})}>
                      <SelectTrigger><SelectValue placeholder="Chọn ĐD" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Trống --</SelectItem>
                        {nursingStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú Phụ mổ</Label>
                <Textarea 
                  value={formData.scrubNote} 
                  onChange={e => setFormData({...formData, scrubNote: e.target.value})}
                  placeholder="Ghi chú về ca mổ, dụng cụ đặc biệt..."
                  className="h-20 resize-none"
                />
              </div>
            </TabsContent>

            {/* TAB: TRỰC ĐÊM */}
            <TabsContent value="truc_dem" className="space-y-5 mt-0 animate-in fade-in duration-300">
              <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                <Checkbox 
                  id="hasNightShift" 
                  checked={formData.hasNightShift} 
                  onCheckedChange={(checked) => setFormData({...formData, hasNightShift: checked})} 
                />
                <Label htmlFor="hasNightShift" className="font-medium cursor-pointer">Khách hàng có lưu viện trực đêm</Label>
              </div>

              {formData.surgeryGroup === 'TIỂU PHẪU' && formData.hasNightShift && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Lưu ý: Khách hàng Tiểu phẫu thường không lưu viện trực đêm. Vui lòng xác nhận lại.
                </div>
              )}

              {formData.hasNightShift && (
                <div className="space-y-5 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label>Ngày trực đêm</Label>
                    <Input type="date" value={formData.nightShiftDate} onChange={e => setFormData({...formData, nightShiftDate: e.target.value})} />
                  </div>

                  <div className="space-y-3">
                    <Label>Chọn Điều dưỡng trực đêm</Label>
                    <ScrollArea className="h-[180px] w-full rounded-md border border-border p-4 bg-background">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {nursingStaff.map(staff => (
                          <div key={staff.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`night-${staff.employeeId}`}
                              checked={(formData.nightNurseEmployeeIds || []).includes(staff.employeeId)}
                              onCheckedChange={() => toggleNightNurse(staff.employeeId)}
                            />
                            <Label htmlFor={`night-${staff.employeeId}`} className="text-sm font-normal cursor-pointer">
                              {staff.fullName}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label>Ghi chú Trực đêm</Label>
                    <Textarea 
                      value={formData.nightShiftNote} 
                      onChange={e => setFormData({...formData, nightShiftNote: e.target.value})}
                      placeholder="Tình trạng bệnh nhân, y lệnh cần theo dõi..."
                      className="h-20 resize-none"
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB: HẬU PHẪU */}
            <TabsContent value="hau_phau" className="space-y-5 mt-0 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label>Trạng thái Chăm sóc</Label>
                <Select value={formData.postOpStatus} onValueChange={v => setFormData({...formData, postOpStatus: v})}>
                  <SelectTrigger className={formData.postOpStatus === 'Đã hoàn tất' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Đang chăm sóc">Đang chăm sóc</SelectItem>
                    <SelectItem value="Đã hoàn tất">Đã hoàn tất</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Điều dưỡng phụ trách Hậu phẫu</Label>
                <ScrollArea className="h-[180px] w-full rounded-md border border-border p-4 bg-background">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {nursingStaff.map(staff => (
                      <div key={staff.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`postop-${staff.employeeId}`}
                          checked={(formData.postOpNurseEmployeeIds || []).includes(staff.employeeId)}
                          onCheckedChange={() => togglePostOpNurse(staff.employeeId)}
                        />
                        <Label htmlFor={`postop-${staff.employeeId}`} className="text-sm font-normal cursor-pointer">
                          {staff.fullName}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú Hậu phẫu</Label>
                <Textarea 
                  value={formData.postOpNote} 
                  onChange={e => setFormData({...formData, postOpNote: e.target.value})}
                  placeholder="Lịch cắt chỉ, thay băng, tình trạng vết thương..."
                  className="h-20 resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 sm:justify-between items-center">
          <div className="text-xs text-muted-foreground hidden sm:block">
            Đảm bảo lưu thông tin trước khi đóng
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">Hủy</Button>
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto bg-primary text-primary-foreground">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lưu phân công
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NursingAssignmentModal;
