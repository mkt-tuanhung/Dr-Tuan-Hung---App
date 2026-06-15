
import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import pb from '@/lib/pocketbaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { Loader2, Save, Check, Camera, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

const SPECIALTIES_OPTIONS = [
  { id: 'Điều dưỡng', label: 'ĐIỀU DƯỠNG' },
  { id: 'Bác sĩ', label: 'BÁC SĨ' },
  { id: 'Content', label: 'MARKETING' },
  { id: 'Media', label: 'MEDIA' },
  { id: 'Sale Offline', label: 'SALE OFFLINE' },
  { id: 'Telesale', label: 'TELESALE' },
  { id: 'Chăm sóc khách hàng', label: 'CSKH' },
  { id: 'Trực page', label: 'TRỰC PAGE' },
  { id: 'Designer', label: 'DESIGNER' }
];

const StaffForm = ({ mode = 'create', initialData, onSubmitSuccess, onCancel, onEndTrialClick }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      username: initialData?.username || '',
      name: initialData?.name || '',
      password: '',
      position: initialData?.position || '',
      specialties: initialData?.specialties || [],
      active: initialData?.active ?? true,
      basic_salary: initialData?.basic_salary || '',
      allowance_amount: initialData?.allowances?.[0]?.amount || '',
      avatarFile: null
    }
  });

  useEffect(() => {
    if (initialData?.avatar) {
      setAvatarPreview(pb.files.getUrl(initialData, initialData.avatar));
    }
  }, [initialData]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('avatarFile', file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleFormSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const basicSalary = data.basic_salary !== '' ? Number(data.basic_salary) : 0;
      const allowanceAmount = data.allowance_amount !== '' ? Number(data.allowance_amount) : 0;

      const payload = {
        name: data.name,
        position: data.position,
        specialties: data.specialties,
        active: data.active,
        basic_salary: basicSalary,
        allowances: [{ name: 'Phụ cấp', amount: allowanceAmount }],
        avatarFile: data.avatarFile
      };

      if (data.username !== undefined) {
        payload.username = data.username;
      } else if (mode === 'edit' && initialData?.username) {
        payload.username = initialData.username;
      }

      if (data.password) {
        payload.password = data.password;
      }

      if (onSubmitSuccess) {
        await onSubmitSuccess(payload);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi lưu dữ liệu hồ sơ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldShowEndTrialButton = mode === 'edit' && initialData?.trial_status === 'on_trial';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 mt-2">
      <div className="flex flex-col items-center gap-3">
        <div 
          className="relative w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors group overflow-hidden bg-muted/50"
          onClick={handleAvatarClick}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="w-6 h-6 text-foreground" />
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleAvatarChange} 
        />
        <span className="text-xs text-muted-foreground font-medium">Ảnh đại diện (Tùy chọn)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            MÃ NHÂN SỰ (STAFF ID) <span className="text-destructive">*</span>
          </Label>
          <Input 
            className={`h-11 ${mode === 'edit' ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : ''} ${errors.username ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            placeholder="Ví dụ: NV001" 
            disabled={mode === 'edit'}
            {...register('username', { 
              required: 'Vui lòng nhập mã nhân sự',
              validate: async (value) => {
                if (mode === 'edit' || !value) return true;
                try {
                  const result = await pb.collection('staff').getList(1, 1, {
                    filter: `username="${value.trim()}"`,
                    $autoCancel: false
                  });
                  if (result.items.length > 0) {
                    return 'Mã nhân sự này đã tồn tại';
                  }
                  return true;
                } catch (e) {
                  return true; 
                }
              }
            })} 
          />
          {errors.username && <p className="text-xs text-destructive font-medium">{errors.username.message}</p>}
          {mode === 'edit' && <p className="text-xs text-muted-foreground">Mã nhân sự không thể thay đổi sau khi tạo.</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            HỌ TÊN <span className="text-destructive">*</span>
          </Label>
          <Input 
            className={`h-11 ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            placeholder="Nhập họ tên" 
            {...register('name', { required: 'Vui lòng nhập họ tên' })} 
          />
          {errors.name && <p className="text-xs text-destructive font-medium">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            MẬT KHẨU ĐĂNG NHẬP {mode === 'create' && <span className="text-destructive">*</span>}
          </Label>
          <Input 
            type="password"
            className={`h-11 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            placeholder={mode === 'edit' ? 'Bỏ trống để giữ nguyên mật khẩu cũ' : 'Nhập mật khẩu (tối thiểu 6 ký tự)'} 
            {...register('password', { 
              required: mode === 'create' ? 'Vui lòng nhập mật khẩu' : false,
              minLength: { value: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
            })} 
          />
          {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            CHỨC VỤ <span className="text-destructive">*</span>
          </Label>
          <Input 
            className={`h-11 ${errors.position ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            placeholder="Ví dụ: Quản lý, Nhân viên" 
            {...register('position', { required: 'Vui lòng nhập chức vụ' })} 
          />
          {errors.position && <p className="text-xs text-destructive font-medium">{errors.position.message}</p>}
        </div>

        <div className="space-y-3 md:col-span-2 bg-muted/30 p-4 rounded-xl border border-border">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            VỊ TRÍ CHUYÊN MÔN (1-2 VỊ TRÍ) <span className="text-destructive">*</span>
          </Label>
          <Controller
            name="specialties"
            control={control}
            rules={{ 
              validate: (val) => (val && val.length > 0 && val.length <= 2) || 'Vui lòng chọn từ 1 đến 2 chuyên môn' 
            }}
            render={({ field }) => {
              const toggleOption = (id) => {
                const current = field.value || [];
                if (current.includes(id)) {
                  field.onChange(current.filter(x => x !== id));
                } else {
                  if (current.length < 2) {
                    field.onChange([...current, id]);
                  } else {
                    toast.error('Chỉ được chọn tối đa 2 vị trí chuyên môn');
                  }
                }
              };

              return (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SPECIALTIES_OPTIONS.map((option) => {
                    const isSelected = (field.value || []).includes(option.id);
                    return (
                      <Badge
                        key={option.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className={`cursor-pointer px-3 py-1.5 text-sm transition-all select-none flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                            : 'bg-background hover:bg-muted text-muted-foreground'
                        }`}
                        onClick={() => toggleOption(option.id)}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        {option.label}
                      </Badge>
                    );
                  })}
                </div>
              );
            }}
          />
          {errors.specialties && <p className="text-xs text-destructive font-medium">{errors.specialties.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            LƯƠNG CƠ BẢN <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Controller
                name="basic_salary"
                control={control}
                rules={{ 
                  required: 'Vui lòng nhập lương cơ bản',
                  validate: (val) => Number(val) > 0 || 'Lương cơ bản phải lớn hơn 0'
                }}
                render={({ field: { onChange, value } }) => (
                  <CurrencyInput
                    value={value}
                    onChange={onChange}
                    placeholder="Nhập số tiền"
                    className={`h-11 ${errors.basic_salary ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                )}
              />
              {errors.basic_salary && <p className="text-xs text-destructive font-medium">{errors.basic_salary.message}</p>}
            </div>
            
            {shouldShowEndTrialButton && (
              <Button
                type="button"
                onClick={onEndTrialClick}
                className="h-11 px-4 rounded-xl font-bold shadow-md shrink-0 transition-all active:scale-[0.98] bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                KẾT THÚC THỬ VIỆC
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            PHỤ CẤP
          </Label>
          <Controller
            name="allowance_amount"
            control={control}
            rules={{ 
              validate: (val) => val === '' || Number(val) >= 0 || 'Phụ cấp không hợp lệ'
            }}
            render={({ field: { onChange, value } }) => (
              <CurrencyInput
                value={value}
                onChange={onChange}
                placeholder="Nhập số tiền (tùy chọn)"
                className={`h-11 ${errors.allowance_amount ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
            )}
          />
          {errors.allowance_amount && <p className="text-xs text-destructive font-medium">{errors.allowance_amount.message}</p>}
        </div>

        <div className="space-y-3 md:col-span-2 pt-2">
          <div className="flex items-center space-x-3 bg-muted/40 px-4 py-3 rounded-xl border border-border">
            <Controller
              name="active"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Switch id="active-status" checked={value} onCheckedChange={onChange} />
              )}
            />
            <Label htmlFor="active-status" className="cursor-pointer font-bold text-foreground">
              Trạng thái hoạt động
            </Label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-border pt-6 gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-11 px-6 rounded-xl font-medium">
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {mode === 'create' ? 'Tạo nhân sự' : 'Cập nhật'}
        </Button>
      </div>
    </form>
  );
};

export default StaffForm;
