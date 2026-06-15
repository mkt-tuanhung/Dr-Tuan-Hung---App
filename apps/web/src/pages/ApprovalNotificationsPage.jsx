
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { 
  getApprovalNotificationsByStatus, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  syncApprovalNotificationsWithSupabase,
  refreshApprovalNotificationsFromSupabase
} from '@/utils/ApprovalNotificationHelper.js';
import { format } from 'date-fns';
import { Bell, CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import { useNavigate } from 'react-router-dom';

const ApprovalNotificationsPage = ({ hideLayout = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [notifications, setNotifications] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = () => {
    if (!user) return;
    const data = getApprovalNotificationsByStatus(activeTab, user.id || user.employeeId, user.role);
    setNotifications(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  };

  useEffect(() => {
    loadData();
    
    const handleSync = (e) => {
      if (!e.detail || e.detail.table === 'approval_notifications') {
        loadData();
      }
    };
    
    window.addEventListener('notificationsUpdated', loadData);
    window.addEventListener('supabase-data-updated', handleSync);
    
    return () => {
      window.removeEventListener('notificationsUpdated', loadData);
      window.removeEventListener('supabase-data-updated', handleSync);
    };
  }, [activeTab, user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const success = await refreshApprovalNotificationsFromSupabase();
    if (success) {
      toast.success('Đã làm mới thông báo từ Supabase');
      loadData();
    } else {
      toast.error('Lỗi khi làm mới thông báo');
    }
    setIsRefreshing(false);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead(user.id || user.employeeId, user.role);
    toast.success('Đã đánh dấu tất cả là đã đọc');
    loadData();
  };

  const handleDelete = (id) => {
    deleteNotification(id);
    toast.success('Đã xóa thông báo');
    loadData();
  };

  const handleNavigateToSource = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    switch (notification.relatedModule) {
      case 'staff_expense_claims':
      case 'expense_claims':
        navigate('/staff-expense-claims');
        break;
      case 'attendance_requests':
      case 'attendance':
        navigate(user.role === 'Admin' ? '/attendance-admin' : '/attendance-employee');
        break;
      default:
        break;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Chờ xử lý</Badge>;
      case 'approved':
      case 'completed':
      case 'processed':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Đã xử lý</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Từ chối</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const content = (
    <div className={`space-y-6 ${hideLayout ? '' : 'container max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Thông báo & Phê duyệt
          </h1>
          <p className="text-muted-foreground mt-1">Quản lý các yêu cầu cần xử lý và thông báo hệ thống</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="flex-1 sm:flex-none">
            {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Làm mới
          </Button>
          <Button variant="outline" onClick={handleMarkAllAsRead} className="flex-1 sm:flex-none">
            Đánh dấu đã đọc
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="pending">Chờ xử lý</TabsTrigger>
          <TabsTrigger value="processed">Đã xử lý</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0 space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl flex flex-col items-center justify-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">Không có thông báo nào</h3>
              <p className="text-muted-foreground">Bạn đã xem hết tất cả thông báo trong mục này.</p>
            </div>
          ) : (
            notifications.map(notification => (
              <Card 
                key={notification.id} 
                className={`overflow-hidden transition-all duration-200 ${!notification.isRead ? 'border-primary/50 shadow-md bg-primary/5' : 'border-border shadow-sm bg-card opacity-80'}`}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    <div className="flex-1 p-4 sm:p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {!notification.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>}
                          <h3 className={`font-semibold text-base ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.title}
                          </h3>
                        </div>
                        <div className="shrink-0 ml-4">
                          {getStatusBadge(notification.status)}
                        </div>
                      </div>
                      
                      <p className="text-sm text-foreground/80 whitespace-pre-line mb-3">
                        {notification.message}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span>Từ: <span className="font-medium text-foreground/70">{notification.senderName || 'Hệ thống'}</span></span>
                        <span>•</span>
                        <span>{format(new Date(notification.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                        {notification.processedBy && (
                          <>
                            <span>•</span>
                            <span>Xử lý bởi: <span className="font-medium text-foreground/70">{notification.processedBy}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 sm:w-40 p-4 flex sm:flex-col items-center justify-end sm:justify-center gap-2 border-t sm:border-t-0 sm:border-l border-border">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full sm:w-auto"
                        onClick={() => handleNavigateToSource(notification)}
                      >
                        Xem chi tiết <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full sm:w-auto text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDelete(notification.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Xóa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  if (hideLayout) return content;

  return (
    <>
      <Helmet><title>Thông báo - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen flex flex-col bg-muted/20">
        <Header />
        <main className="flex-1">{content}</main>
      </div>
    </>
  );
};

export default ApprovalNotificationsPage;
