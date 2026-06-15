
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2, Edit, Trash2, Plus } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { motion } from 'framer-motion';
import { useStaff } from '@/hooks/useStaff.js';
import StaffFormModal from '@/components/StaffFormModal.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const StaffPage = () => {
  const { staff, loading, fetchStaff, deleteStaff } = useStaff();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedStaff, setSelectedStaff] = useState(null);

  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedStaff(null);
    setIsModalOpen(true);
  };

  const openEditModal = (staffRecord) => {
    setModalMode('edit');
    setSelectedStaff(staffRecord);
    setIsModalOpen(true);
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteStaff(deleteId);
    } catch (err) {
      // handled in hook
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Hồ sơ nhân sự - Thẩm mỹ Dr Tuấn Hùng</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-6xl mx-auto">
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 tracking-tight">
                  <Users className="h-8 w-8 text-primary" />
                  HỒ SƠ NHÂN SỰ
                </h1>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  Quản lý danh sách nhân viên, vị trí chuyên môn và phòng ban.
                </p>
              </div>
              <Button onClick={openCreateModal} className="h-11 px-6 rounded-xl shadow-md bg-primary hover:bg-primary/90">
                <Plus className="w-5 h-5 mr-2" />
                Thêm nhân viên
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <h2 className="font-bold text-foreground">Danh sách nhân viên</h2>
              </div>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary/50 animate-spin" />
                </div>
              ) : staff.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
                  <Users className="h-16 w-16 opacity-20 mb-4" />
                  <p className="text-lg">Chưa có nhân viên nào.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead className="font-bold text-muted-foreground uppercase text-xs tracking-wider">Staff ID</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase text-xs tracking-wider">Họ và tên</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase text-xs tracking-wider">Chức vụ</TableHead>
                        <TableHead className="font-bold text-muted-foreground uppercase text-xs tracking-wider">Trạng thái</TableHead>
                        <TableHead className="text-right font-bold text-muted-foreground uppercase text-xs tracking-wider">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.map((record) => (
                        <TableRow key={record.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium font-mono text-foreground">
                            {record.username || '-'}
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            {record.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {record.position || '-'}
                          </TableCell>
                          <TableCell>
                            {record.active !== false ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold uppercase text-[10px] tracking-wider rounded-md">Đang làm việc</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-border font-bold uppercase text-[10px] tracking-wider rounded-md">Đã nghỉ việc</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="icon" 
                                variant="default" 
                                onClick={() => openEditModal(record)} 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg w-8 h-8 shadow-sm"
                                title="Sửa thông tin"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => confirmDelete(record.id)} 
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg w-8 h-8"
                                title="Xóa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

          </motion.div>
        </main>

        <Footer />
      </div>

      <StaffFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        staffData={selectedStaff}
        onClose={() => setIsModalOpen(false)}
        onSave={() => fetchStaff()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hồ sơ nhân sự?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa vĩnh viễn dữ liệu của nhân sự này khỏi hệ thống. Bạn có chắc chắn muốn tiếp tục?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-10">Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-10"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Xóa dữ liệu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StaffPage;
