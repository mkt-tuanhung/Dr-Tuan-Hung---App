import React, { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { Loader2, Save, Check, Camera, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'telesale', label: 'TELESALE' },
  { value: 'sale_offline', label: 'SALE OFFLINE' },
  { value: 'cskh', label: 'CSKH' },
  { value: 'truc_page', label: 'TRỰC PAGE' },
  { value: 'media', label: 'MEDIA' },
  { value: 'marketing', label: 'MARKETING' },
  { value: 'dieu_duong', label: 'ĐIỀU DƯỠNG' },
  { value: 'accountant', label: 'KẾ TOÁN' },
  { value: 'shareholder', label: 'CỔ ĐÔNG' },
  { value: 'admin', label: 'ADMIN' },
];

const StaffForm = ({ mode = 'create', initialData, onSubmitSuccess, onCancel, onEndTrialClick }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(initialData?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      employee_id: initialData?.employee_id || '',
      full_name: initialData?.full_name || '',
      password: '',
      role: initialData?.role || 'telesale',
      position: initialData?.position || '',
      base_salary: initialData?.base_salary || '',
      allowance: initialData?.allowance || '',
      phone: initialData?.phone || '',
      is_active: initialData?.is_active ?? true,
      is_probation: initialData?.employment_status === 'probation',
    }
  });

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleFormSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      let avatarUrl = initialData?.avatar_url || null;

      // Upload avatar nếu có file mới
      if (avatarFile) {
        const path = `avatars/${data.employee_id}/${Date.now()}_${avatarFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const payload = {
        full_name: data.full_name.trim(),
        role: data.role,
        position: data.position.trim(),
        base_salary: Number(data.base_salary) || 0,
        allowance: Number(data.allowance) || 0,
        phone: data.phone,
        is_active: data.is_active,
        avatar_url: avatarUrl,
        employment_status: data.is_probation ? 'probation' : 'official',
      };

      if (mode === 'create') {
        payload.employee_id = data.employee_id.trim();
        payload.password = data.password;
      }

      if (onSubmitSuccess) {
        await onSubmitSuccess(payload);
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu dữ liệu hồ sơ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProbation = mode === 'edit' && initialData?.employment_status === 'probation';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 mt-2">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors group overflow-hidden bg-muted/50"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="w-6 h-6 text-foreground" />
          </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
        <span className="text-xs text-muted-foreground font-medium">Ảnh đại diện (Tùy chọn)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ID nhân sự */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            ID NHÂN SỰ {mode === 'create' && <span className="text-destructive">*</span>}
          </Label>
          <Input
            className={`h-11 ${mode === 'edit' ? 'bg-muted opacity-70 cursor-not-allowed' : ''} ${errors.employee_id ? 'border-destructive' : ''}`}
            placeholder="Ví dụ: NV001"
            disabled={mode === 'edit'}
            {...register('employee_id', {
              required: mode === 'create' ? 'Vui lòng nhập ID nhân sự' : false,
            })}
          />
          {errors.employee_id && <p className="text-xs text-destructive">{errors.employee_id.message}</p>}
          {mode === 'edit' && <p className="text-xs text-muted-foreground">ID không thể thay đổi sau khi tạo.</p>}
        </div>

        {/* Họ tên */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            HỌ TÊN <span className="text-destructive">*</span>
          </Label>
          <Input
            className={`h-11 ${errors.full_name ? 'border-destructive' : ''}`}
            placeholder="Nhập họ tên"
            {...register('full_name', { required: 'Vui lòng nhập họ tên' })}
          />
          {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
        </div>

        {/* Mật khẩu */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            MẬT KHẨU {mode === 'create' && <span className="text-destructive">*</span>}
          </Label>
          <Input
            type="password"
            className={`h-11 ${errors.password ? 'border-destructive' : ''}`}
            placeholder={mode === 'edit' ? 'Bỏ trống để giữ nguyên' : 'Nhập mật khẩu (tối thiểu 8 ký tự)'}
            {...register('password', {
              required: mode === 'create' ? 'Vui lòng nhập mật khẩu' : false,
              minLength: { value: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' }
            })}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {/* Vai trò */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            VAI TRÒ <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Vị trí */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">VỊ TRÍ / CHỨC VỤ</Label>
          <Input className="h-11" placeholder="Ví dụ: Trưởng nhóm Telesale" {...register('position')} />
        </div>

        {/* SĐT */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">SỐ ĐIỆN THOẠI</Label>
          <Input className="h-11" placeholder="Nhập số điện thoại" {...register('phone')} />
        </div>

        {/* Lương cơ bản */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            LƯƠNG CƠ BẢN <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Controller
                name="base_salary"
                control={control}
                rules={{ required: 'Vui lòng nhập lương cơ bản', validate: v => Number(v) > 0 || 'Lương cơ bản phải lớn hơn 0' }}
                render={({ field: { onChange, value } }) => (
                  <CurrencyInput value={value} onChange={onChange} placeholder="Nhập số tiền" className={`h-11 ${errors.base_salary ? 'border-destructive' : ''}`} />
                )}
              />
              {errors.base_salary && <p className="text-xs text-destructive mt-1">{errors.base_salary.message}</p>}
            </div>
            {isProbation && onEndTrialClick && (
              <Button type="button" onClick={onEndTrialClick} className="h-11 px-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white shrink-0">
                KẾT THÚC THỬ VIỆC
              </Button>
            )}
          </div>
        </div>

        {/* Phụ cấp */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">PHỤ CẤP</Label>
          <Controller
            name="allowance"
            control={control}
            render={({ field: { onChange, value } }) => (
              <CurrencyInput value={value} onChange={onChange} placeholder="Nhập số tiền (tùy chọn)" className="h-11" />
            )}
          />
        </div>

        {/* Thử việc */}
        <div className="md:col-span-2 bg-muted/30 px-4 py-3 rounded-xl border border-border flex items-center gap-3">
          <Controller
            name="is_probation"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Switch id="is_probation" checked={value} onCheckedChange={onChange} />
            )}
          />
          <Label htmlFor="is_probation" className="cursor-pointer font-bold">
            Nhân sự thử việc (lương = 85% lương cơ bản)
          </Label>
        </div>

        {/* Trạng thái */}
        <div className="md:col-span-2 bg-muted/30 px-4 py-3 rounded-xl border border-border flex items-center gap-3">
          <Controller
            name="is_active"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Switch id="is_active" checked={value} onCheckedChange={onChange} />
            )}
          />
          <Label htmlFor="is_active" className="cursor-pointer font-bold">Trạng thái hoạt động</Label>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-border pt-6 gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-11 px-6 rounded-xl">Hủy</Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="h-11 px-6 rounded-xl font-bold">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {mode === 'create' ? 'Tạo nhân sự' : 'Cập nhật'}
        </Button>
      </div>
    </form>
  );
};

export default StaffForm;
