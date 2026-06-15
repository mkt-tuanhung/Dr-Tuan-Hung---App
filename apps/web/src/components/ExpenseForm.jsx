
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStaff } from '@/hooks/useStaff';
import { Loader2, UploadCloud, CheckCircle2 } from 'lucide-react';

const ExpenseForm = ({ initialData, onSubmit, onCancel, isSubmitting }) => {
  const { staff } = useStaff();
  const [formData, setFormData] = useState({
    date: '',
    amount: '',
    category: '',
    description: '',
    staff_id: '',
    invoice_document: null,
    proof_images: []
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date || '',
        amount: initialData.amount || '',
        category: initialData.category || '',
        description: initialData.description || '',
        staff_id: initialData.staff_id || '',
        invoice_document: null,
        proof_images: []
      });
    }
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field, files) => {
    if (field === 'invoice_document') {
      setFormData(prev => ({ ...prev, [field]: files[0] || null }));
    } else if (field === 'proof_images') {
      setFormData(prev => ({ ...prev, [field]: Array.from(files).slice(0, 3) }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const categories = ['MKT', 'Vật tư', 'Văn phòng', 'Nhân công', 'Khác'];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label htmlFor="date" className="text-foreground font-semibold">Ngày thanh toán <span className="text-destructive">*</span></Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            required
            className="bg-background text-foreground border-white/10 focus-visible:ring-primary focus-visible:border-primary transition-all h-12"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="amount" className="text-foreground font-semibold">Số tiền (VNĐ) <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              min="0"
              step="1000"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              required
              placeholder="0"
              className="bg-background text-foreground border-white/10 focus-visible:ring-primary focus-visible:border-primary transition-all h-12 pr-12 font-medium"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">đ</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="category" className="text-foreground font-semibold">Loại chi phí <span className="text-destructive">*</span></Label>
          <Select value={formData.category} onValueChange={(value) => handleChange('category', value)} required>
            <SelectTrigger id="category" className="bg-background text-foreground border-white/10 focus:ring-primary h-12">
              <SelectValue placeholder="Chọn phân loại..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10 text-foreground">
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="focus:bg-primary/20 focus:text-primary cursor-pointer">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label htmlFor="staff_id" className="text-foreground font-semibold">Nhân sự liên quan</Label>
          <Select value={formData.staff_id} onValueChange={(value) => handleChange('staff_id', value)}>
            <SelectTrigger id="staff_id" className="bg-background text-foreground border-white/10 focus:ring-primary h-12">
              <SelectValue placeholder="Không áp dụng" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10 text-foreground">
              {staff.map(s => (
                <SelectItem key={s.id} value={s.id} className="focus:bg-primary/20 focus:text-primary cursor-pointer">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="description" className="text-foreground font-semibold">Mô tả chi tiết</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Nêu rõ lý do và mục đích chi tiêu..."
          rows={4}
          className="bg-background text-foreground placeholder:text-muted-foreground border-white/10 focus-visible:ring-primary resize-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
        <div className="space-y-3">
          <Label htmlFor="invoice_document" className="text-foreground font-semibold flex items-center gap-2">
            Hóa đơn / Chứng từ
            {formData.invoice_document && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </Label>
          <div className="relative group">
            <Input
              id="invoice_document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileChange('invoice_document', e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors ${formData.invoice_document ? 'border-primary bg-primary/5' : 'border-white/10 bg-background group-hover:border-primary/50 group-hover:bg-primary/5'}`}>
              <UploadCloud className={`h-8 w-8 mb-2 ${formData.invoice_document ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium text-foreground text-center">
                {formData.invoice_document ? formData.invoice_document.name : 'Kéo thả hoặc click để tải lên'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 text-center">PDF, JPG, PNG (Tối đa 1 file)</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="proof_images" className="text-foreground font-semibold flex items-center gap-2">
            Hình ảnh minh chứng
            {formData.proof_images.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {formData.proof_images.length}/3
              </span>
            )}
          </Label>
          <div className="relative group">
            <Input
              id="proof_images"
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              multiple
              onChange={(e) => handleFileChange('proof_images', e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors ${formData.proof_images.length > 0 ? 'border-primary bg-primary/5' : 'border-white/10 bg-background group-hover:border-primary/50 group-hover:bg-primary/5'}`}>
              <UploadCloud className={`h-8 w-8 mb-2 ${formData.proof_images.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium text-foreground text-center">
                {formData.proof_images.length > 0 ? `Đã chọn ${formData.proof_images.length} tập tin` : 'Kéo thả hoặc click để tải lên'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 text-center">JPG, PNG, WEBP (Tối đa 3 ảnh)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-6 border-t border-white/5">
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all h-12 text-base font-bold"
        >
          {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {initialData ? 'Lưu thay đổi' : 'Xác nhận tạo khoản chi'}
        </Button>
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            disabled={isSubmitting}
            className="flex-1 border-white/10 hover:bg-white/5 hover:text-foreground h-12 text-base font-medium"
          >
            Hủy thao tác
          </Button>
        )}
      </div>
    </form>
  );
};

export default ExpenseForm;
