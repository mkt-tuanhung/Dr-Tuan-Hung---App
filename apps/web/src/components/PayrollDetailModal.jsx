
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { Lock, Unlock, Calculator, WrapText as ReceiptText, Phone, Headphones as Headset, Store, HeartPulse } from 'lucide-react';

const PayrollDetailModal = ({ isOpen, onClose, payroll, onSave, onToggleLock }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (payroll) {
      setFormData({
        otherBonus: payroll.otherBonus || 0,
        unpaidAdvance: payroll.unpaidAdvance || 0,
        otherDeduction: payroll.otherDeduction || 0,
        note: payroll.note || ''
      });
    }
  }, [payroll]);

  if (!payroll) return null;

  const isLocked = payroll.status === 'locked';
  
  const ItemRow = ({ label, value, isHighlight, colorClass = "text-gray-700", isGrayed = false, show = true }) => {
    if (!show) return null;
    if (isGrayed) {
      colorClass = "text-gray-400";
    }
    return (
      <div className={`flex justify-between items-center py-2 ${isHighlight ? 'font-bold border-t border-gray-200 mt-2 pt-3' : 'text-sm'}`}>
        <span className={isHighlight ? 'text-gray-900' : colorClass}>{label}</span>
        <span className={`${isHighlight && !isGrayed ? 'text-[hsl(var(--mint-600))] text-base' : colorClass} tabular-nums font-medium`}>
          {typeof value === 'number' ? formatVNDDisplay(value) : value}
        </span>
      </div>
    );
  };

  const Section = ({ title, colorClass, children, show = true, bgClass = "bg-white" }) => {
    if (!show) return null;
    return (
      <div className={`space-y-1 p-4 rounded-xl border border-gray-200 ${bgClass}`}>
        <h4 className="font-bold flex items-center gap-2 text-[15px] border-b border-gray-100 pb-2 mb-2 text-gray-800">
          <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`}></div> {title}
        </h4>
        <div className="space-y-0.5">
          {children}
        </div>
      </div>
    );
  };

  const hasCommissions = payroll.pageCommission > 0 || 
                         payroll.telesaleAppointmentCommission > 0 || 
                         payroll.telesaleRevenueCommission > 0 || 
                         payroll.saleOfflineCommissionTotal > 0 || 
                         payroll.nursingBonusTotal > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-background max-h-[90vh] flex flex-col rounded-2xl">
        <div className="bg-[hsl(var(--mint-50))] border-b border-[hsl(var(--mint-100))] p-5 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2 text-[hsl(var(--mint-700))]">
                <ReceiptText className="w-5 h-5" /> Phiếu Lương Chi Tiết
              </DialogTitle>
              <p className="text-[hsl(var(--mint-600))] font-medium mt-1 text-sm">Kỳ lương tháng {payroll.month}</p>
            </div>
            <Badge variant="outline" className={isLocked ? 'bg-gray-100 text-gray-700 border-gray-200 shadow-none' : 'bg-white text-[hsl(var(--mint-600))] border-[hsl(var(--mint-200))] shadow-none'}>
              {isLocked ? 'Đã chốt' : 'Bản nháp (Chưa chốt)'}
            </Badge>
          </div>
          
          <div className="mt-4 flex items-center gap-3 bg-white p-3 rounded-xl border border-[hsl(var(--mint-100))] shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--mint-100))] flex items-center justify-center font-bold text-[hsl(var(--mint-600))] text-lg uppercase">
              {payroll.fullName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 leading-tight">{payroll.fullName}</h3>
              <p className="text-sm text-gray-500">{payroll.position || 'Nhân viên'} • ID: {payroll.employeeId}</p>
            </div>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-gray-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
            
            {/* Cột trái: Công & Lương cứng + Chi tiết hoa hồng */}
            <div className="space-y-6">
              <Section title="Công & Lương cứng" colorClass="bg-blue-400">
                <ItemRow label="Lương cơ bản" value={payroll.baseSalary} />
                <ItemRow label={`Ngày công chuẩn`} value={payroll.standardWorkDays} />
                <ItemRow label={`Công thực tế`} value={payroll.paidWorkDays} />
                <ItemRow label={`Số ngày Check-in`} value={payroll.checkInDays || 0} isGrayed={!payroll.checkInDays} />
                <ItemRow label={`Số ngày nghỉ`} value={payroll.leaveDays || 0} isGrayed={!payroll.leaveDays} />
                <ItemRow label={`Đi muộn/Về sớm`} value={`${payroll.lateEarlyCount || 0} lần`} isGrayed={!payroll.lateEarlyCount} />
                <ItemRow label="Lương theo ngày công" value={payroll.salaryByAttendance} />
                <ItemRow label="Phụ cấp" value={payroll.allowance} />
                <ItemRow label="Cộng Cố định" value={payroll.fixedSalary} isHighlight />
              </Section>

              {hasCommissions && (
                <Section title="Chi tiết hoa hồng / thưởng" colorClass="bg-indigo-400">
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    
                    {payroll.pageCommission > 0 && (
                      <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-sm">
                        <div className="font-semibold text-indigo-700 flex items-center gap-2 mb-2"><Phone className="w-4 h-4"/> Trực Page</div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>Số điện thoại:</span> <span className="font-medium">{payroll.pageTotalPhones}</span></div>
                        <div className="flex justify-between border-t border-indigo-100 pt-2 font-bold text-indigo-700 mt-2">
                          <span>Hoa hồng:</span> <span>{formatVNDDisplay(payroll.pageCommission)}</span>
                        </div>
                      </div>
                    )}

                    {(payroll.telesaleAppointmentCommission > 0 || payroll.telesaleRevenueCommission > 0) && (
                      <div className="p-3 bg-teal-50/50 rounded-lg border border-teal-100 text-sm">
                        <div className="font-semibold text-teal-700 flex items-center gap-2 mb-2"><Headset className="w-4 h-4"/> Telesale</div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>Khách PT/Cọc/Bong:</span> <span className="font-medium">{payroll.telesaleSurgeryCount} / {payroll.telesaleDepositCount} / {payroll.telesaleBongCount}</span></div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>Doanh thu:</span> <span className="font-medium">{formatVNDDisplay(payroll.telesaleRevenueAmount)}</span></div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>HH Đặt lịch:</span> <span className="font-medium">{formatVNDDisplay(payroll.telesaleAppointmentCommission)}</span></div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>HH Doanh thu:</span> <span className="font-medium">{formatVNDDisplay(payroll.telesaleRevenueCommission)}</span></div>
                        <div className="flex justify-between border-t border-teal-100 pt-2 font-bold text-teal-700 mt-2">
                          <span>Tổng hoa hồng:</span> <span>{formatVNDDisplay(payroll.telesaleAppointmentCommission + payroll.telesaleRevenueCommission)}</span>
                        </div>
                      </div>
                    )}

                    {(payroll.saleOfflineCommissionTotal > 0) && (
                      <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 text-sm">
                        <div className="font-semibold text-purple-700 flex items-center gap-2 mb-2"><Store className="w-4 h-4"/> Sale Offline</div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>Doanh thu cá nhân:</span> <span className="font-medium">{formatVNDDisplay(payroll.saleOfflineRevenueAmount)}</span></div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>Doanh thu Upsale:</span> <span className="font-medium">{formatVNDDisplay(payroll.saleOfflineUpsaleAmount)}</span></div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>HH Doanh thu:</span> <span className="font-medium">{formatVNDDisplay(payroll.saleOfflineRevenueCommission)}</span></div>
                        <div className="flex justify-between text-gray-600 mb-1"><span>HH Upsale:</span> <span className="font-medium">{formatVNDDisplay(payroll.saleOfflineUpsaleCommission)}</span></div>
                        <div className="flex justify-between border-t border-purple-100 pt-2 font-bold text-purple-700 mt-2">
                          <span>Tổng hoa hồng:</span> <span>{formatVNDDisplay(payroll.saleOfflineCommissionTotal)}</span>
                        </div>
                      </div>
                    )}

                    {(payroll.nursingBonusTotal > 0) && (
                      <div className="p-3 bg-orange-50/50 rounded-lg border border-orange-100 text-sm">
                        <div className="font-semibold text-orange-700 flex items-center gap-2 mb-2"><HeartPulse className="w-4 h-4"/> Điều dưỡng</div>
                        {payroll.nursingScrub1Count > 0 && <div className="flex justify-between text-gray-600 mb-1"><span>Phụ mổ 1 ({payroll.nursingScrub1Count} ca):</span> <span className="font-medium">{formatVNDDisplay(payroll.nursingScrub1Bonus)}</span></div>}
                        {payroll.nursingScrub2Count > 0 && <div className="flex justify-between text-gray-600 mb-1"><span>Phụ mổ 2 ({payroll.nursingScrub2Count} ca):</span> <span className="font-medium">{formatVNDDisplay(payroll.nursingScrub2Bonus)}</span></div>}
                        {payroll.nursingScrub3Count > 0 && <div className="flex justify-between text-gray-600 mb-1"><span>Phụ mổ 3 ({payroll.nursingScrub3Count} ca):</span> <span className="font-medium">{formatVNDDisplay(payroll.nursingScrub3Bonus)}</span></div>}
                        {payroll.nursingNightShiftCount > 0 && <div className="flex justify-between text-gray-600 mb-1"><span>Trực đêm ({payroll.nursingNightShiftCount} ca):</span> <span className="font-medium">{formatVNDDisplay(payroll.nursingNightShiftBonus)}</span></div>}
                        <div className="flex justify-between border-t border-orange-100 pt-2 font-bold text-orange-700 mt-2">
                          <span>Tổng thưởng ca/trực:</span> <span>{formatVNDDisplay(payroll.nursingBonusTotal)}</span>
                        </div>
                      </div>
                    )}

                  </div>
                </Section>
              )}
            </div>

            {/* Cột phải: Tổng Hợp Thu Nhập & Khấu Trừ */}
            <div className="space-y-6">
              <Section title="Tổng Thu Nhập" colorClass="bg-[hsl(var(--mint-500))]" bgClass="bg-[hsl(var(--mint-50))/30] border-[hsl(var(--mint-100))]">
                <ItemRow label="Lương & Phụ cấp" value={payroll.fixedSalary} />
                {payroll.totalCommission > 0 && <ItemRow label="Hoa hồng / Thưởng ca" value={payroll.totalCommission} />}
                
                {!isLocked && onSave ? (
                  <div className="space-y-1.5 mt-3 pt-2 border-t border-gray-100">
                    <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Thưởng thêm (VNĐ)</Label>
                    <CurrencyInput 
                      value={formData.otherBonus} 
                      onChange={v => setFormData({...formData, otherBonus: v})} 
                      className="h-10 text-sm bg-white border-gray-200 focus:ring-[hsl(var(--mint-300))]"
                    />
                  </div>
                ) : (
                  payroll.otherBonus > 0 && <ItemRow label="Thưởng thêm" value={payroll.otherBonus} />
                )}
                
                <ItemRow label="TỔNG THU NHẬP" value={payroll.grossIncome} isHighlight />
              </Section>

              <Section title="Khấu trừ" colorClass="bg-rose-500" show={(!isLocked && onSave) || (isLocked && payroll.totalDeductions > 0)} bgClass="bg-rose-50/30 border-rose-100">
                {!isLocked && onSave ? (
                  <>
                    <div className="space-y-1.5 mb-3">
                      <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Trừ tạm ứng (VNĐ)</Label>
                      <CurrencyInput 
                        value={formData.unpaidAdvance} 
                        onChange={v => setFormData({...formData, unpaidAdvance: v})} 
                        className="h-10 text-sm bg-white border-gray-200"
                      />
                    </div>
                    <div className="space-y-1.5 mt-2">
                      <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Khấu trừ khác (VNĐ)</Label>
                      <CurrencyInput 
                        value={formData.otherDeduction} 
                        onChange={v => setFormData({...formData, otherDeduction: v})} 
                        className="h-10 text-sm bg-white border-gray-200"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {payroll.unpaidAdvance > 0 && <ItemRow label="Trừ tạm ứng" value={payroll.unpaidAdvance} colorClass="text-rose-600" />}
                    {payroll.otherDeduction > 0 && <ItemRow label="Khấu trừ khác" value={payroll.otherDeduction} colorClass="text-rose-600" />}
                  </>
                )}
                
                <div className="flex justify-between items-center py-2 font-bold border-t border-rose-200 mt-2 pt-3">
                  <span className="text-rose-800">TỔNG KHẤU TRỪ</span>
                  <span className="text-rose-600 text-base tabular-nums font-medium">-{formatVNDDisplay(payroll.totalDeductions)}</span>
                </div>
              </Section>
              
              <div className="p-5 bg-gradient-to-r from-[hsl(var(--mint-500))] to-[hsl(var(--mint-600))] rounded-xl border border-[hsl(var(--mint-600))] shadow-md text-white">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-90">Thực lãnh</p>
                <p className="text-3xl font-extrabold tabular-nums break-words">{formatVNDDisplay(payroll.netSalary)}</p>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-sm font-semibold text-gray-700">Ghi chú phiếu lương</Label>
                {!isLocked && onSave ? (
                  <Textarea 
                    value={formData.note} 
                    onChange={e => setFormData({...formData, note: e.target.value})}
                    placeholder="Nhập ghi chú cho nhân viên (nếu có)..."
                    className="min-h-[80px] bg-white border-gray-200"
                  />
                ) : (
                  <div className="p-3 bg-white rounded-lg text-sm min-h-[60px] whitespace-pre-wrap border border-gray-200 text-gray-700 shadow-sm">
                    {payroll.note || <span className="text-gray-400 italic">Không có ghi chú</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
          {onToggleLock && (
            <Button 
              variant={isLocked ? "outline" : "default"} 
              className={isLocked ? "border-gray-200 text-gray-700 hover:bg-gray-50" : "bg-rose-500 hover:bg-rose-600 text-white shadow-sm border-none"}
              onClick={() => onToggleLock(payroll)}
            >
              {isLocked ? <><Unlock className="w-4 h-4 mr-2" /> Mở khóa phiếu lương</> : <><Lock className="w-4 h-4 mr-2" /> Chốt lương ngay</>}
            </Button>
          )}
          
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50" onClick={onClose}>Đóng</Button>
            {!isLocked && onSave && (
              <Button onClick={() => onSave(payroll.id, formData)} className="bg-[hsl(var(--mint-500))] hover:bg-[hsl(var(--mint-600))] text-white shadow-sm">
                <Calculator className="w-4 h-4 mr-2" /> Cập nhật & Lưu
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayrollDetailModal;
