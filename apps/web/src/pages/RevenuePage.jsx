import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
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
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('Dich_vu');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const fetchRecords = async () => {
    try {
      const today = new Date();
      const { data, error } = await supabase
        .from('customer_appointments')
        .select('*')
        .or(`telesale_id.eq.${profile.id},sale_offline_id.eq.${profile.id}`)
        .gte('appointment_date', format(startOfMonth(today), 'yyyy-MM-dd'))
        .lte('appointment_date', format(endOfMonth(today), 'yyyy-MM-dd'))
        .in('status', ['coc', 'phau_thuat'])
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu doanh thu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const totalRevenue = useMemo(() => records.reduce((sum, r) => sum + Number(r.revenue || 0), 0), [records]);
  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const STATUS_LABELS = { coc: 'Cọc', phau_thuat: 'Phẫu thuật', bong: 'Bong', scheduled: 'Hẹn' };
  const STATUS_COLORS = { coc: 'bg-blue-100 text-blue-700', phau_thuat: 'bg-green-100 text-green-700', bong: 'bg-red-100 text-red-700' };

  return (
    <>
      <Helmet><title>Doanh thu - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/staff-dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" /> Doanh thu của tôi
            </h1>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl p-8 text-white shadow-lg flex items-center justify-between">
            <div>
              <p className="opacity-90 font-medium mb-1">Tổng doanh thu (Tháng này)</p>
              <h2 className="text-4xl font-bold">{formatCurrency(totalRevenue)}</h2>
              <p className="opacity-80 text-sm mt-1">{records.length} giao dịch</p>
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
                <p>Chưa có doanh thu tháng này</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Doanh thu</TableHead>
                    <TableHead className="hidden md:table-cell">Upsale</TableHead>
                    <TableHead className="hidden md:table-cell">Dịch vụ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.appointment_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{record.customer_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[record.status] || 'bg-muted'}`}>
                          {STATUS_LABELS[record.status] || record.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">{formatCurrency(record.revenue)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{formatCurrency(record.upsale_revenue)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm truncate max-w-[150px]">{record.service}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default RevenuePage;
