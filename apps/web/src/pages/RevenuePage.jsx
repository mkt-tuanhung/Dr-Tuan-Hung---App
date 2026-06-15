
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, TrendingUp, Plus, Trash2, Pencil } from 'lucide-react';

const RevenuePage = () => {
  const { currentStaff } = useAuth();
  const navigate = useNavigate();
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('Bán hàng');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const fetchRecords = async () => {
    try {
      const today = new Date();
      const res = await pb.collection('revenue').getFullList({
        filter: `staff_id = "${currentStaff.id}" && revenue_date >= "${format(startOfMonth(today), 'yyyy-MM-dd')}"`,
        sort: '-revenue_date',
        $autoCancel: false
      });
      setRecords(res);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu doanh thu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const totalAmount = useMemo(() => records.reduce((sum, r) => sum + r.amount, 0), [records]);
  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const openModal = (record = null) => {
    if (record) {
      setEditingId(record.id);
      setDate(record.revenue_date.split(' ')[0]);
      setCategory(record.category);
      setAmount(record.amount.toString());
      setDescription(record.description || '');
    } else {
      setEditingId(null);
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setCategory('Bán hàng');
      setAmount('');
      setDescription('');
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!date || !category || !amount) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        staff_id: currentStaff.id,
        revenue_date: date + " 00:00:00.000Z",
        category,
        amount: Number(amount),
        description
      };
      
      if (editingId) {
        await pb.collection('revenue').update(editingId, payload, { $autoCancel: false });
        toast.success('Cập nhật thành công');
      } else {
        await pb.collection('revenue').create(payload, { $autoCancel: false });
        toast.success('Thêm doanh thu thành công');
      }
      
      setModalOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error('Lỗi lưu doanh thu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa khoản doanh thu này?')) return;
    try {
      await pb.collection('revenue').delete(id, { $autoCancel: false });
      toast.success('Đã xóa');
      fetchRecords();
    } catch (err) {
      toast.error('Lỗi khi xóa');
    }
  };

  return (
    <>
      <Helmet><title>Doanh thu - HR Portal</title></Helmet>
      
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/staff-dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" /> Quản lý doanh thu
            </h1>
          </div>
          <Button onClick={() => openModal()} className="bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-4 h-4 mr-2" /> Ghi nhận mới
          </Button>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl p-8 text-white shadow-lg flex items-center justify-between">
            <div>
              <p className="opacity-90 font-medium mb-1">Tổng doanh thu (Tháng này)</p>
              <h2 className="text-4xl font-bold">{formatCurrency(totalAmount)}</h2>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                <p>Chưa có khoản doanh thu nào</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead className="hidden md:table-cell">Mô tả</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.revenue_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell><span className="bg-muted px-2 py-1 rounded-md text-xs font-medium">{record.category}</span></TableCell>
                      <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(record.amount)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate">{record.description}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openModal(record)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </main>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Cập nhật doanh thu' : 'Ghi nhận doanh thu'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Ngày</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Danh mục</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bán hàng">Bán hàng</SelectItem>
                    <SelectItem value="Dịch vụ">Dịch vụ</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Số tiền (VNĐ)</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 1500000" />
              </div>
              <div className="space-y-2">
                <Label>Mô tả chi tiết</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Nhập ghi chú..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-white">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Lưu lại
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default RevenuePage;
