
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import RevenueForm from '@/components/RevenueForm.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit2, User, Phone, Calendar, Tag, Target, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const RevenueDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  
  const [revenue, setRevenue] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const record = await pb.collection('revenues').getOne(id, { $autoCancel: false });
        
        // Fetch staff names if they exist
        if (record.sale_staff && record.sale_staff !== 'none') {
          try { 
            const s = await pb.collection('staff').getOne(record.sale_staff, { $autoCancel: false }); 
            record.sale_staff_name = s.name; 
          } catch(e){}
        }
        if (record.telesale_staff && record.telesale_staff !== 'none') {
          try { 
            const t = await pb.collection('staff').getOne(record.telesale_staff, { $autoCancel: false }); 
            record.telesale_staff_name = t.name; 
          } catch(e){}
        }
        
        setRevenue(record);
      } catch (err) {
        console.error(err);
        toast.error('Không tìm thấy bản ghi');
        navigate('/revenue');
      } finally {
        setLoading(false);
      }
    };
    
    if (!isEditing) {
      fetchDetail();
    }
  }, [id, navigate, isEditing]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12"><Skeleton className="h-[600px] w-full max-w-4xl mx-auto rounded-xl" /></main>
        <Footer />
      </div>
    );
  }

  if (isEditing && isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto mb-4 flex justify-between">
            <Button variant="ghost" onClick={() => setIsEditing(false)}><ArrowLeft className="mr-2 h-4 w-4"/> Quay lại chi tiết</Button>
          </div>
          <RevenueForm initialData={revenue} isEdit={true} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Chi tiết Doanh thu - MediFinance</title></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <Button variant="ghost" onClick={() => navigate('/revenue')} className="mb-6 hover:bg-white/5">
              <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách
            </Button>

            <Card className="bg-card border-white/5 shadow-xl">
              <CardHeader className="border-b border-border/50 pb-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-foreground mb-2">Mã GD: {revenue.id.substring(0,8).toUpperCase()}</CardTitle>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20"><Calendar className="w-3 h-3 mr-1"/> {new Date(revenue.date).toLocaleDateString('vi-VN')}</Badge>
                    <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20"><Tag className="w-3 h-3 mr-1"/> {revenue.service_group}</Badge>
                  </div>
                </div>
                {isAdmin && (
                  <Button onClick={() => setIsEditing(true)} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                    <Edit2 className="w-4 h-4 mr-2" /> Chỉnh sửa
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                
                {/* Highlight Stats */}
                <div className="bg-primary/5 rounded-xl p-6 border border-primary/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Tổng doanh thu</p>
                    <p className="text-4xl font-black text-primary">{revenue.revenue.toLocaleString('vi-VN')} <span className="text-2xl font-semibold">VND</span></p>
                  </div>
                  <Target className="w-12 h-12 text-primary opacity-20" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Customer Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" /> Thông tin Khách hàng
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-muted-foreground text-sm">Họ và tên:</div>
                      <div className="col-span-2 font-medium">{revenue.customer_name}</div>
                      
                      <div className="text-muted-foreground text-sm">Điện thoại:</div>
                      <div className="col-span-2 font-medium flex items-center gap-2">
                        <Phone className="w-3 h-3" /> {revenue.phone}
                      </div>
                      
                      <div className="text-muted-foreground text-sm">Loại khách:</div>
                      <div className="col-span-2 font-medium">{revenue.customer_type}</div>
                      
                      <div className="text-muted-foreground text-sm">Nguồn:</div>
                      <div className="col-span-2 font-medium">{revenue.customer_source}</div>
                    </div>
                  </div>

                  {/* Service & Staff Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-secondary" /> Dịch vụ & Phụ trách
                    </h3>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-muted-foreground text-sm">Dịch vụ:</div>
                      <div className="col-span-2 font-medium">{revenue.service}</div>
                      
                      <div className="text-muted-foreground text-sm">Nhóm DV:</div>
                      <div className="col-span-2 font-medium">{revenue.service_group}</div>
                      
                      <div className="text-muted-foreground text-sm">Sale:</div>
                      <div className="col-span-2 font-medium flex items-center gap-2">
                        <span className="text-secondary">{revenue.sale_staff_name || 'Không có'}</span>
                        {revenue.sale_staff_name && (
                          <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20 text-[10px] py-0">Sale Offline</Badge>
                        )}
                      </div>
                      
                      <div className="text-muted-foreground text-sm">Telesale:</div>
                      <div className="col-span-2 font-medium flex items-center gap-2">
                        <span className="text-secondary">{revenue.telesale_staff_name || 'Không có'}</span>
                        {revenue.telesale_staff_name && (
                          <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20 text-[10px] py-0">Telesale</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {revenue.notes && (
                  <div className="bg-muted/30 p-4 rounded-lg border border-border mt-6">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Ghi chú</h4>
                    <p className="text-sm leading-relaxed">{revenue.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default RevenueDetailPage;
