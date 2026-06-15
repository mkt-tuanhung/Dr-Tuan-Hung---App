
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Download, ExternalLink, X, History, Trash2 } from 'lucide-react';
import { getReimbursementsForClaim, calculateRemainingAmount } from '@/utils/staffExpenseClaimsStorage.js';

const STATUS_MAP = {
  pending: { label: 'Chờ duyệt', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Đã duyệt', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  partially_reimbursed: { label: 'Đã hoàn một phần', class: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  reimbursed: { label: 'Đã hoàn ứng đủ', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  paid: { label: 'Đã hoàn ứng', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Từ chối', class: 'bg-rose-100 text-rose-800 border-rose-200' }
};

// Safe date formatting helper functions
const safeFormatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'dd/MM/yyyy');
};

const safeFormatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'dd/MM/yyyy HH:mm');
};

const ExpenseClaimDetailModal = ({ isOpen, onClose, claim, currentUser, onDelete, onApproveReject, onRecordReimbursement }) => {
  const [previewImage, setPreviewImage] = useState(null);
  const [reimbursements, setReimbursements] = useState([]);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    if (isOpen && claim) {
      if (claim.transactionType === 'advance_expense') {
        setReimbursements(getReimbursementsForClaim(claim.id));
        setRemainingAmount(calculateRemainingAmount(claim.id));
      } else {
        setReimbursements([]);
        setRemainingAmount(0);
      }
      setShowDeleteConfirm(false);
      setDeleteReason('');
    }
  }, [isOpen, claim]);

  if (!claim) return null;

  const statusInfo = STATUS_MAP[claim.status] || STATUS_MAP.pending;
  const isAdmin = currentUser.role === 'Admin';
  const isAccountant = currentUser.role === 'Kế toán';
  
  const canApproveReject = claim.status === 'pending' && isAdmin;
  const isAdvance = claim.transactionType === 'advance_expense';
  
  const canRecordReimbursement = (isAdmin || isAccountant) && isAdvance && claim.status !== 'rejected' && remainingAmount > 0 && !claim.isDeleted;
  const canSoftDelete = (isAdmin || isAccountant) && !claim.isDeleted;

  const handleDeleteConfirm = () => {
    onDelete(claim.id, deleteReason);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Chi tiết {isAdvance ? 'Tạm ứng chi' : 'Hoàn ứng'}</span>
              <div className="flex items-center gap-2">
                {claim.isDeleted && <Badge variant="destructive">Đã xóa</Badge>}
                <Badge variant="outline" className={statusInfo.class}>{statusInfo.label}</Badge>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {showDeleteConfirm ? (
            <div className="space-y-4 py-4">
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800">
                <h4 className="font-semibold mb-2">Bạn chắc chắn muốn xóa giao dịch này?</h4>
                <p className="text-sm">Giao dịch sẽ không còn được tính vào thống kê.</p>
              </div>
              <div className="space-y-2">
                <Label>Lý do xóa (không bắt buộc)</Label>
                <Textarea 
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Nhập lý do xóa..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Hủy</Button>
                <Button variant="destructive" onClick={handleDeleteConfirm}>Xác nhận xóa</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-6 py-4 text-sm">
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Người yêu cầu</p>
                    <p className="font-semibold text-base">{claim.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{claim.departmentPosition || 'Nhân viên'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Ngày giao dịch</p>
                    <p className="font-medium text-base">{safeFormatDate(claim.expenseDate)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Loại giao dịch:</span>
                    <Badge variant="secondary">{isAdvance ? 'Tạm ứng chi' : 'Hoàn ứng'}</Badge>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Danh mục:</span>
                    <span className="font-medium">{claim.category}</span>
                  </div>
                  
                  {isAdvance ? (
                    <>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Số tiền đã chi:</span>
                        <span className="font-bold text-lg text-amber-600">
                          {claim.amount?.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Đã hoàn ứng:</span>
                        <span className="font-medium text-emerald-600">
                          {(claim.amount - remainingAmount).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Còn thiếu:</span>
                        <span className="font-bold text-rose-600">
                          {remainingAmount.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Số tiền hoàn:</span>
                      <span className="font-bold text-lg text-emerald-600">
                        {claim.amount?.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Hình thức:</span>
                    <span>{claim.paymentMethod}</span>
                  </div>
                  {claim.supplierName && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Nơi mua/NCC:</span>
                      <span>{claim.supplierName}</span>
                    </div>
                  )}
                </div>

                {claim.description && (
                  <div>
                    <p className="text-muted-foreground mb-2 font-medium">Lý do / Mô tả:</p>
                    <p className="bg-muted/30 p-3 rounded-lg whitespace-pre-wrap border">{claim.description}</p>
                  </div>
                )}

                {claim.note && (
                  <div>
                    <p className="text-muted-foreground mb-2 font-medium">Ghi chú thêm:</p>
                    <p className="bg-muted/30 p-3 rounded-lg border">{claim.note}</p>
                  </div>
                )}

                {claim.attachments && claim.attachments.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-2 font-medium">Chứng từ đính kèm ({claim.attachments.length}):</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {claim.attachments.map((file) => (
                        <div 
                          key={file.id} 
                          className="image-preview-container group cursor-pointer"
                          onClick={() => setPreviewImage(file.dataUrl)}
                        >
                          <img src={file.dataUrl} alt={file.name} />
                          <div className="image-preview-overlay">
                            <ExternalLink className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isAdvance && reimbursements.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold flex items-center gap-2 mb-3 text-foreground">
                      <History className="w-4 h-4" /> Lịch sử hoàn ứng
                    </h4>
                    <div className="space-y-3">
                      {reimbursements.map(r => (
                        <div key={r.id} className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-emerald-700">{r.amount.toLocaleString('vi-VN')} đ</span>
                            <span className="text-xs text-muted-foreground">{safeFormatDate(r.expenseDate)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Bởi: {r.paidBy}</span>
                            <span>{r.paymentMethod}</span>
                          </div>
                          {r.note && <p className="text-xs mt-2 text-emerald-800/80 bg-emerald-100/50 p-2 rounded-md">{r.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {claim.status === 'rejected' && claim.rejectReason && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                    <p className="text-rose-800 font-semibold mb-1">Lý do từ chối:</p>
                    <p className="text-rose-700">{claim.rejectReason}</p>
                  </div>
                )}

                {(claim.approvedBy || claim.paidBy || claim.deletedBy) && (
                  <div className="bg-slate-50 border p-4 rounded-xl space-y-2 text-xs">
                    {claim.approvedBy && (
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">Duyệt bởi:</span>
                        <span className="font-medium">{claim.approvedBy} <span className="text-muted-foreground font-normal">({safeFormatDateTime(claim.approvedAt)})</span></span>
                      </p>
                    )}
                    {claim.paidBy && (
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">Chi/Nhận bởi:</span>
                        <span className="font-medium">{claim.paidBy} <span className="text-muted-foreground font-normal">({safeFormatDateTime(claim.paidAt)})</span></span>
                      </p>
                    )}
                    {claim.isDeleted && claim.deletedBy && (
                      <p className="flex justify-between text-rose-600">
                        <span className="text-rose-600/70">Xóa bởi:</span>
                        <span className="font-medium">{claim.deletedBy} <span className="text-rose-600/70 font-normal">({safeFormatDateTime(claim.deletedAt)})</span></span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  {canSoftDelete && (
                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Xóa giao dịch
                    </Button>
                  )}
                  {canApproveReject && (
                    <Button onClick={() => { onClose(); onApproveReject(claim); }} className="bg-blue-600 hover:bg-blue-700 text-white">Duyệt / Từ chối</Button>
                  )}
                  {canRecordReimbursement && (
                    <Button onClick={() => { onClose(); onRecordReimbursement(claim); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">Ghi nhận hoàn ứng</Button>
                  )}
                  {isAdvance && claim.status !== 'rejected' && remainingAmount <= 0 && !claim.isDeleted && (
                    <span className="text-sm text-emerald-600 font-medium flex items-center px-3">
                      Phiếu này đã được hoàn ứng đủ
                    </span>
                  )}
                </div>
                <Button variant="outline" onClick={onClose}>Đóng</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-6 h-6" />
          </Button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
          <Button 
            className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
            onClick={(e) => {
              e.stopPropagation();
              const a = document.createElement('a');
              a.href = previewImage;
              a.download = `attachment-${Date.now()}.jpg`;
              a.click();
            }}
          >
            <Download className="w-4 h-4 mr-2" /> Tải xuống
          </Button>
        </div>
      )}
    </>
  );
};

export default ExpenseClaimDetailModal;
