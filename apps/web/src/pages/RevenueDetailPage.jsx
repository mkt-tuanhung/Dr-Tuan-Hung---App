import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit2, User, Phone, Calendar, Tag, Target, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const RevenueDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { data, error } = await supabase
          .from('customer_appointments')
          .select(`
            *,
            telesale:telesale_id(full_name),
            sale_offline:sale_offline_id(full_name)
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        setRevenue(data);
      } catch (err) {
        toast.error('Không tìm thấy bản ghi');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-[600px] w-full max-w-4xl mx-auto rounded-xl" />
      </div>
    );
  }

  if (!revenue) return null;

  const STATUS_LABELS = { coc: 'Cọc', phau_thuat: 'Phẫu thuật', bong: 'Bong', scheduled: 'Hẹn' };
  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  return (
    <>
      <Helmet><title>Chi tiết doanh thu - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen bg-background py-10">
        <div className="max-w-4xl mx-auto px-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>

          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="border-b border-border pb-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold mb-2">
                  Mã GD: {revenue.id.substring(0, 8).toUpperCase()}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Calendar className="w-3 h-3 mr-1" /> {new Date(revenue.appointment_date).toLocaleDateString('vi-VN')}
                  </Badge>
                  <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                    <Tag className="w-3 h-3 mr-1" /> {STATUS_LABELS[revenue.status] || revenue.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
              <div className="bg-primary/5 rounded-xl p-6 border border-primary/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tổng doanh thu</p>
                  <p className="text-4xl font-black text-primary">{formatCurrency(revenue.revenue)}</p>
                  {revenue.upsale_revenue > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">Upsale: {formatCurrency(revenue.upsale_revenue)}</p>
                  )}
                </div>
                <Target className="w-12 h-12 text-primary opacity-20" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b border-border pb-2 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" /> Thông tin khách hàng
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-muted-foreground">Họ và tên:</div>
                    <div className="col-span-2 font-medium">{revenue.customer_name}</div>
                    <div className="text-muted-foreground">Điện thoại:</div>
                    <div className="col-span-2 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {revenue.phone || '—'}
                    </div>
                    {revenue.deposit_date && <>
                      <div className="text-muted-foreground">Ngày cọc:</div>
                      <div className="col-span-2 font-medium">{new Date(revenue.deposit_date).toLocaleDateString('vi-VN')}</div>
                    </>}
                    {revenue.surgery_date && <>
                      <div className="text-muted-foreground">Ngày PT:</div>
                      <div className="col-span-2 font-medium">{new Date(revenue.surgery_date).toLocaleDateString('vi-VN')}</div>
                    </>}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b border-border pb-2 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-secondary" /> Dịch vụ & Phụ trách
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-muted-foreground">Dịch vụ:</div>
                    <div className="col-span-2 font-medium">{revenue.service || '—'}</div>
                    <div className="text-muted-foreground">Sale Offline:</div>
                    <div className="col-span-2 font-medium text-secondary">{revenue.sale_offline?.full_name || 'Không có'}</div>
                    <div className="text-muted-foreground">Telesale:</div>
                    <div className="col-span-2 font-medium text-secondary">{revenue.telesale?.full_name || 'Không có'}</div>
                  </div>
                </div>
              </div>

              {revenue.notes && (
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Ghi chú</h4>
                  <p className="text-sm leading-relaxed">{revenue.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default RevenueDetailPage;
