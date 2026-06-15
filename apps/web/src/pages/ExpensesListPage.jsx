
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FilterBar from '@/components/FilterBar.jsx';
import { useExpenses } from '@/hooks/useExpenses';
import { useStaff } from '@/hooks/useStaff';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { format } from 'date-fns';
import { Eye, Edit, Trash2, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { motion } from 'framer-motion';

const ExpensesListPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { expenses, loading, fetchExpenses, deleteExpense } = useExpenses();
  const { staff } = useStaff();
  
  const [filters, setFilters] = useState({
    category: '',
    staffId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchExpenses(filters);
  }, [filters]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      staffId: '',
      startDate: '',
      endDate: ''
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn khoản chi này? Thao tác này không thể hoàn tác.')) {
      try {
        await deleteExpense(id);
        toast.success('Hồ sơ đã được gỡ bỏ.', { className: 'bg-primary text-primary-foreground border-none' });
      } catch (error) {
        toast.error('Lỗi khi xóa. Vui lòng thử lại sau.', { className: 'bg-destructive text-destructive-foreground border-none' });
      }
    }
  };

  const getStaffName = (staffId) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember ? staffMember.name : '-';
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

  return (
    <>
      <Helmet>
        <title>Sổ chi phí - MediFinance</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  <ListOrdered className="h-8 w-8 text-primary" />
                  {isAdmin ? 'Sổ nhật ký chung' : 'Lịch sử giao dịch'}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {isAdmin ? 'Quản lý toàn bộ hóa đơn chứng từ của hệ thống.' : 'Bảng kê các khoản chi phí bạn đã hạch toán.'}
                </p>
              </div>
              <Button 
                onClick={() => navigate('/add-expense')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
              >
                Tạo khoản chi mới
              </Button>
            </div>

            <FilterBar 
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              staff={isAdmin ? staff : []} 
            />

            <div className="rounded-xl border border-white/10 bg-card overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background/50 hover:bg-background/50 border-white/10">
                      <TableHead className="font-bold text-muted-foreground">Ngày ghi nhận</TableHead>
                      <TableHead className="font-bold text-muted-foreground">Giá trị (VNĐ)</TableHead>
                      <TableHead className="font-bold text-muted-foreground">Phân loại</TableHead>
                      {isAdmin && <TableHead className="font-bold text-muted-foreground">Phụ trách</TableHead>}
                      <TableHead className="font-bold text-muted-foreground w-1/3">Diễn giải</TableHead>
                      <TableHead className="text-right font-bold text-muted-foreground">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center text-muted-foreground space-y-3">
                            <ListOrdered className="h-10 w-10 opacity-20" />
                            <p>Chưa có dữ liệu nào khớp với bộ lọc.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((expense) => (
                        <TableRow key={expense.id} className="group border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-medium text-foreground">
                            {format(new Date(expense.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-bold text-primary">
                            {expense.amount.toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-secondary/20 text-secondary border border-secondary/20">
                              {expense.category}
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-foreground font-medium">
                              {getStaffName(expense.staff_id)}
                            </TableCell>
                          )}
                          <TableCell className="max-w-[250px] truncate text-muted-foreground" title={expense.description}>
                            {expense.description || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="bg-background border border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50"
                                onClick={() => navigate(`/expense/${expense.id}`)}
                                title="Xem chi tiết"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="bg-background border border-white/10 hover:bg-secondary/20 hover:text-secondary hover:border-secondary/50"
                                onClick={() => navigate(`/expense/${expense.id}/edit`)}
                                title="Chỉnh sửa"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="bg-background border border-white/10 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
                                onClick={() => handleDelete(expense.id)}
                                title="Gỡ bỏ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ExpensesListPage;
