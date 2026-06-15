
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FilePreview from '@/components/FilePreview.jsx';
import { useExpenses } from '@/hooks/useExpenses';
import { useStaff } from '@/hooks/useStaff';
import { format } from 'date-fns';
import { Calendar, DollarSign, User, FileText, Edit, Trash2, ArrowLeft, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { motion } from 'framer-motion';

const ExpenseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getExpenseById, deleteExpense } = useExpenses();
  const { staff } = useStaff();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const data = await getExpenseById(id);
        setExpense(data);
      } catch (error) {
        toast.error('Hồ sơ không tồn tại hoặc bạn không có quyền xem', { className: 'bg-destructive text-destructive-foreground border-none' });
        navigate('/expenses');
      } finally {
        setLoading(false);
      }
    };

    fetchExpense();
  }, [id, navigate, getExpenseById]);

  const handleDelete = async () => {
    if (window.confirm('Cảnh báo: Bạn đang xóa vĩnh viễn chứng từ này. Bạn có chắc chắn?')) {
      try {
        await deleteExpense(id);
        toast.success('Hồ sơ đã được xóa', { className: 'bg-primary text-primary-foreground border-none' });
        navigate('/expenses');
      } catch (error) {
        toast.error('Xóa thất bại', { className: 'bg-destructive text-destructive-foreground border-none' });
      }
    }
  };

  const getStaffName = (staffId) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember ? staffMember.name : 'Không xác định';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!expense) return null;

  return (
    <>
      <Helmet>
        <title>Chi tiết hồ sơ - MediFinance</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                onClick={() => navigate('/expenses')}
                className="text-muted-foreground hover:text-foreground hover:bg-white/5 pl-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Về danh sách
              </Button>
              
              <div className="flex items-center gap-3">
                <Button variant="outline" className="bg-card border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50" onClick={() => navigate(`/expense/${id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Chỉnh sửa
                </Button>
                <Button variant="destructive" className="shadow-lg shadow-destructive/20" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa
                </Button>
              </div>
            </div>

            <Card className="bg-card border-white/10 shadow-2xl overflow-hidden">
              <div className="p-8 md:p-10 border-b border-white/10 bg-background/50">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground mb-3 leading-snug">
                      {expense.description || 'Chi phí chưa đặt tên'}
                    </h1>
                    <Badge className="bg-secondary/20 text-secondary hover:bg-secondary/30 border-secondary/30 px-3 py-1 text-sm">
                      {expense.category}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Thành tiền</p>
                    <p className="text-4xl font-black text-primary">
                      {expense.amount.toLocaleString('vi-VN')} <span className="text-2xl text-muted-foreground font-medium">đ</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-white/5">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ngày ghi nhận</p>
                      <p className="font-bold text-foreground text-lg">{format(new Date(expense.date), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-white/5">
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Người phụ trách</p>
                      <p className="font-bold text-foreground text-lg">{getStaffName(expense.staff_id)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-8 md:p-10 space-y-10">
                {expense.description && (
                  <section>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-primary" /> Diễn giải chi tiết
                    </h3>
                    <div className="bg-background rounded-xl p-6 border border-white/5 text-muted-foreground text-base leading-relaxed">
                      {expense.description}
                    </div>
                  </section>
                )}

                <div className="h-px bg-white/5 w-full" />

                <section>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
                    <Bookmark className="h-5 w-5 text-primary" /> Tài liệu đính kèm
                  </h3>
                  
                  <div className="space-y-8">
                    {expense.invoice_document && (
                      <div>
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Hóa đơn chính</h4>
                        <FilePreview record={expense} fieldName="invoice_document" />
                      </div>
                    )}

                    {expense.proof_images && expense.proof_images.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Hình ảnh minh chứng</h4>
                        <FilePreview record={expense} fieldName="proof_images" />
                      </div>
                    )}
                    
                    {!expense.invoice_document && (!expense.proof_images || expense.proof_images.length === 0) && (
                      <div className="bg-background/50 border border-dashed border-white/10 rounded-xl p-8 text-center text-muted-foreground">
                        Không có tài liệu nào được đính kèm.
                      </div>
                    )}
                  </div>
                </section>
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ExpenseDetailPage;
