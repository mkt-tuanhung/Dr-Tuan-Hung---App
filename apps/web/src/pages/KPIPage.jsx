
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { useKPI } from '@/hooks/useKPI.js';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat.js';
import KPIChart from '@/components/KPIChart.jsx';
import KPIDetailModal from '@/components/KPIDetailModal.jsx';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Loader2, Target, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const KPIPage = () => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const { kpiData, loading, fetchAndCalculateKPI, updateTargetKPI } = useKPI();
  const { formatCurrency } = useCurrencyFormat();
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [editValue, setEditValue] = useState(0);

  useEffect(() => {
    fetchAndCalculateKPI(month, year);
  }, [month, year, fetchAndCalculateKPI]);

  const handleSaveTarget = async (staffId, recordId, value) => {
    try {
      await updateTargetKPI(staffId, month, year, Number(value), recordId);
      toast.success('Đã cập nhật chỉ tiêu KPI');
      setEditingTarget(null);
      fetchAndCalculateKPI(month, year);
    } catch (err) {
      toast.error('Lỗi khi cập nhật chỉ tiêu');
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const formatVND = (value) => `${formatCurrency(value)} VNĐ`;

  return (
    <>
      <Helmet><title>Đánh giá KPI - MediFinance</title></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-primary" /> Đánh giá KPI
              </h1>
              <p className="text-muted-foreground mt-1">Theo dõi hiệu suất doanh thu của nhân sự Sale/Telesale.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="w-[120px] bg-card">
                  <SelectValue placeholder="Tháng" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-[100px] bg-card">
                  <SelectValue placeholder="Năm" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!loading && kpiData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-1">
                <KPIChart data={kpiData} />
              </div>
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-card border border-white/5 rounded-xl p-6 flex flex-col justify-center shadow-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Target className="w-5 h-5 text-primary" /> <span>Tổng chỉ tiêu toàn team</span>
                  </div>
                  <div className="text-3xl font-bold">{formatVND(kpiData.reduce((sum, d) => sum + d.target_kpi, 0))}</div>
                </div>
                <div className="bg-card border border-white/5 rounded-xl p-6 flex flex-col justify-center shadow-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <TrendingUp className="w-5 h-5 text-status-present" /> <span>Tổng doanh thu thực tế</span>
                  </div>
                  <div className="text-3xl font-bold text-status-present">{formatVND(kpiData.reduce((sum, d) => sum + d.actual_kpi, 0))}</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : kpiData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Chuyên môn</TableHead>
                      <TableHead className="text-right">Chỉ tiêu (Target)</TableHead>
                      <TableHead className="text-right">Thực đạt (Actual)</TableHead>
                      <TableHead className="text-center">% Hoàn thành</TableHead>
                      <TableHead className="text-center">Đánh giá</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpiData.map((record) => (
                      <TableRow key={record.staff_id} className="cursor-pointer hover:bg-white/5" onClick={() => editingTarget?.id !== record.staff_id && setSelectedKPI(record)}>
                        <TableCell className="font-medium">{record.staff_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {record.specialties?.slice(0,2).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {editingTarget?.id === record.staff_id ? (
                            <CurrencyInput 
                              className="w-32 inline-block text-right h-8" 
                              value={editValue}
                              onChange={setEditValue}
                              autoFocus
                              onBlur={() => handleSaveTarget(record.staff_id, record.id, editValue)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveTarget(record.staff_id, record.id, editValue)}
                            />
                          ) : (
                            <span 
                              className="border-b border-dashed border-muted-foreground/50 hover:border-primary cursor-text"
                              onClick={() => {
                                setEditingTarget({ id: record.staff_id });
                                setEditValue(record.target_kpi);
                              }}
                            >
                              {formatVND(record.target_kpi)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">{formatVND(record.actual_kpi)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-bold">{record.completion_percentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {record.status === 'achieved' ? (
                            <Badge className="bg-status-present/20 text-status-present hover:bg-status-present/30 border-status-present/30"><CheckCircle className="w-3 h-3 mr-1"/> Đạt</Badge>
                          ) : (
                            <Badge variant="outline" className="text-status-warning border-status-warning/30 bg-status-warning/10"><XCircle className="w-3 h-3 mr-1"/> Chưa đạt</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                Không có dữ liệu KPI cho kỳ này.
              </div>
            )}
          </div>
        </main>
        
        <Footer />
        <KPIDetailModal isOpen={!!selectedKPI} onClose={() => setSelectedKPI(null)} data={selectedKPI} />
      </div>
    </>
  );
};

export default KPIPage;
