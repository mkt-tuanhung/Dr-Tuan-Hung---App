
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import ExpenseForm from '@/components/ExpenseForm.jsx';
import { useExpenses } from '@/hooks/useExpenses';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { motion } from 'framer-motion';
import { FilePlus } from 'lucide-react';

const AddExpensePage = () => {
  const navigate = useNavigate();
  const { createExpense } = useExpenses();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      await createExpense(formData);
      toast.success('Đã thêm hồ sơ chi phí thành công', {
        className: 'bg-primary text-primary-foreground border-none',
      });
      navigate('/expenses');
    } catch (error) {
      toast.error('Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin.', {
        className: 'bg-destructive text-destructive-foreground border-none',
      });
      console.error('Error creating expense:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Khởi tạo khoản chi - MediFinance</title>
        <meta name="description" content="Thêm chi phí mới vào hệ thống" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background relative">
        {/* Ambient background glow */}
        <div className="absolute top-[-10%] right-[-5%] w-1/2 h-1/2 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <div className="mb-8 text-center md:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/20 text-primary mb-4 md:hidden">
                <FilePlus className="w-6 h-6" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <FilePlus className="w-8 h-8 text-primary hidden md:block" />
                Khởi tạo hồ sơ chi tiêu
              </h1>
              <p className="text-muted-foreground mt-3 text-lg">
                Điền thông tin chuẩn xác để đẩy nhanh quá trình hạch toán và phê duyệt.
              </p>
            </div>

            <Card className="bg-card/80 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-primary to-secondary w-full" />
              <CardContent className="p-6 md:p-10">
                <ExpenseForm 
                  onSubmit={handleSubmit}
                  onCancel={() => navigate('/expenses')}
                  isSubmitting={isSubmitting}
                />
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default AddExpensePage;
