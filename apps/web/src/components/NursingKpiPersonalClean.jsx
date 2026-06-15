
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Moon, HeartPulse, Calendar, User, Stethoscope } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { getSurgicalAssignmentsByMonth, normalize } from '@/utils/surgicalCareAssignments.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981'];

const NursingKpiPersonalClean = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const currentEmployeeId = normalize(currentUser?.employeeId);

  // Fetch assignments for the month
  const monthlyAssignments = useMemo(() => {
    return getSurgicalAssignmentsByMonth(selectedMonth);
  }, [selectedMonth]);

  // Filter assignments for current user
  const myAssignments = useMemo(() => {
    const scrubCases = [];
    const nightCases = [];
    const postOpCases = [];

    monthlyAssignments.forEach(a => {
      // Check Scrub
      let scrubRole = null;
      if (normalize(a.scrubNurse1EmployeeId) === currentEmployeeId) scrubRole = 'Phụ mổ 1';
      else if (normalize(a.scrubNurse2EmployeeId) === currentEmployeeId) scrubRole = 'Phụ mổ 2';
      else if (normalize(a.scrubNurse3EmployeeId) === currentEmployeeId) scrubRole = 'Phụ mổ 3';
      
      if (scrubRole) {
        scrubCases.push({ ...a, myRole: scrubRole });
      }

      // Check Night
      if (Array.isArray(a.nightNurseEmployeeIds) && a.nightNurseEmployeeIds.some(id => normalize(id) === currentEmployeeId)) {
        nightCases.push(a);
      }

      // Check Post-op
      if (Array.isArray(a.postOpNurseEmployeeIds) && a.postOpNurseEmployeeIds.some(id => normalize(id) === currentEmployeeId)) {
        postOpCases.push(a);
      }
    });

    return { scrubCases, nightCases, postOpCases };
  }, [monthlyAssignments, currentEmployeeId]);

  // Calculate Stats
  const stats = useMemo(() => {
    const { scrubCases, nightCases, postOpCases } = myAssignments;
    
    let scrub1 = 0, scrub2 = 0, scrub3 = 0;
    scrubCases.forEach(c => {
      if (c.myRole === 'Phụ mổ 1') scrub1++;
      if (c.myRole === 'Phụ mổ 2') scrub2++;
      if (c.myRole === 'Phụ mổ 3') scrub3++;
    });

    let postOpInProgress = 0, postOpCompleted = 0;
    postOpCases.forEach(c => {
      if (c.postOpStatus === 'Đã hoàn tất') postOpCompleted++;
      else postOpInProgress++;
    });

    // Unique total cases (a customer might be scrub + night + postop)
    const uniqueIds = new Set([
      ...scrubCases.map(c => c.id),
      ...nightCases.map(c => c.id),
      ...postOpCases.map(c => c.id)
    ]);

    return {
      totalScrub: scrubCases.length,
      scrub1, scrub2, scrub3,
      totalNight: nightCases.length,
      postOpInProgress,
      postOpCompleted,
      totalPostOp: postOpCases.length,
      totalUniqueCases: uniqueIds.size
    };
  }, [myAssignments]);

  const pieChartData = useMemo(() => {
    return [
      { name: 'Phụ mổ 1', value: stats.scrub1 },
      { name: 'Phụ mổ 2', value: stats.scrub2 },
      { name: 'Phụ mổ 3', value: stats.scrub3 },
    ].filter(d => d.value > 0);
  }, [stats]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'dd/MM/yyyy') : dateStr;
  };

  const renderMobileCard = (item, type) => (
    <div key={item.id} className="p-4 bg-card border border-border rounded-xl shadow-sm space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-primary text-base">{item.customerName}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{item.serviceName}</p>
        </div>
        <Badge variant="outline" className={item.surgeryGroup === 'ĐẠI PHẪU' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
          {item.surgeryGroup}
        </Badge>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span className="font-medium text-foreground">{formatDate(type === 'night' ? item.nightShiftDate : item.surgeryDate)}</span>
        </div>
        {type === 'scrub' && (
          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">{item.myRole}</Badge>
        )}
        {type === 'postop' && (
          <Badge variant="outline" className={item.postOpStatus === 'Đã hoàn tất' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
            {item.postOpStatus}
          </Badge>
        )}
      </div>

      {((type === 'scrub' && item.scrubNote) || (type === 'night' && item.nightShiftNote) || (type === 'postop' && item.postOpNote)) && (
        <div className="bg-muted/40 p-2.5 rounded-lg text-sm text-muted-foreground border border-border/50">
          <span className="font-medium text-foreground block mb-1">Ghi chú:</span>
          {type === 'scrub' ? item.scrubNote : type === 'night' ? item.nightShiftNote : item.postOpNote}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-primary" /> 
            Thống kê Công việc Điều dưỡng
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi số lượng ca phụ mổ, trực đêm và chăm sóc hậu phẫu</p>
        </div>
        <div className="flex items-center gap-3 bg-card p-2 rounded-xl shadow-sm border border-border">
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[160px] bg-background"
          />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1 opacity-90">
              <Activity className="w-4 h-4" />
              <p className="text-xs font-semibold uppercase">Tổng ca Phụ mổ</p>
            </div>
            <p className="text-3xl font-bold tabular-nums">{stats.totalScrub}</p>
            <div className="flex gap-3 mt-2 text-xs opacity-80 font-medium">
              <span>Chính: {stats.scrub1}</span>
              <span>Phụ 2: {stats.scrub2}</span>
              <span>Phụ 3: {stats.scrub3}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-slate-50/50">
            <div className="flex items-center gap-2 mb-1">
              <Moon className="w-4 h-4 text-slate-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Ca Trực đêm</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-slate-700">{stats.totalNight}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-emerald-50/50">
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Ca Hậu phẫu</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-emerald-700">{stats.totalPostOp}</p>
            <div className="flex gap-3 mt-2 text-xs text-emerald-600/80 font-medium">
              <span>Đang CS: {stats.postOpInProgress}</span>
              <span>Hoàn tất: {stats.postOpCompleted}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-purple-50/50">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng Khách hàng</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-purple-700">{stats.totalUniqueCases}</p>
            <p className="text-xs text-purple-600/70 mt-2 font-medium">Số lượng KH duy nhất</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Phân bổ Vai trò Phụ mổ</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[280px]">
            {pieChartData.length > 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2">
                  {pieChartData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                      <span>{entry.name}: <span className="font-medium text-foreground">{entry.value}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                Chưa có ca phụ mổ nào
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tổng quan Công việc ({selectedMonth})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Phụ mổ', value: stats.totalScrub, fill: '#3b82f6' },
                { name: 'Trực đêm', value: stats.totalNight, fill: '#64748b' },
                { name: 'Hậu phẫu', value: stats.totalPostOp, fill: '#10b981' }
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {
                    [
                      { name: 'Phụ mổ', value: stats.totalScrub, fill: '#3b82f6' },
                      { name: 'Trực đêm', value: stats.totalNight, fill: '#64748b' },
                      { name: 'Hậu phẫu', value: stats.totalPostOp, fill: '#10b981' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Lists */}
      <Tabs defaultValue="scrub" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="scrub" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Activity className="w-4 h-4 mr-2 hidden sm:block" /> Phụ mổ ({stats.totalScrub})
          </TabsTrigger>
          <TabsTrigger value="night" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Moon className="w-4 h-4 mr-2 hidden sm:block" /> Trực đêm ({stats.totalNight})
          </TabsTrigger>
          <TabsTrigger value="postop" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <HeartPulse className="w-4 h-4 mr-2 hidden sm:block" /> Hậu phẫu ({stats.totalPostOp})
          </TabsTrigger>
        </TabsList>

        {/* SCRUB TAB */}
        <TabsContent value="scrub" className="mt-0">
          <Card className="shadow-sm border-border">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[100px]">Ngày PT</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Dịch vụ</TableHead>
                    <TableHead>Phân loại</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAssignments.scrubCases.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Không có ca phụ mổ nào.</TableCell></TableRow>
                  ) : (
                    myAssignments.scrubCases.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{formatDate(item.surgeryDate)}</TableCell>
                        <TableCell className="font-semibold text-primary">{item.customerName}</TableCell>
                        <TableCell>{item.serviceName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={item.surgeryGroup === 'ĐẠI PHẪU' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                            {item.surgeryGroup}
                          </Badge>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="bg-indigo-50 text-indigo-700">{item.myRole}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={item.scrubNote}>{item.scrubNote || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden flex flex-col gap-3 p-4 bg-muted/10">
              {myAssignments.scrubCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Không có ca phụ mổ nào.</div>
              ) : (
                myAssignments.scrubCases.map(item => renderMobileCard(item, 'scrub'))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* NIGHT TAB */}
        <TabsContent value="night" className="mt-0">
          <Card className="shadow-sm border-border">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[100px]">Ngày Trực</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Dịch vụ</TableHead>
                    <TableHead>Phân loại</TableHead>
                    <TableHead>Ghi chú trực đêm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAssignments.nightCases.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Không có ca trực đêm nào.</TableCell></TableRow>
                  ) : (
                    myAssignments.nightCases.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{formatDate(item.nightShiftDate)}</TableCell>
                        <TableCell className="font-semibold text-primary">{item.customerName}</TableCell>
                        <TableCell>{item.serviceName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={item.surgeryGroup === 'ĐẠI PHẪU' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                            {item.surgeryGroup}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={item.nightShiftNote}>{item.nightShiftNote || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden flex flex-col gap-3 p-4 bg-muted/10">
              {myAssignments.nightCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Không có ca trực đêm nào.</div>
              ) : (
                myAssignments.nightCases.map(item => renderMobileCard(item, 'night'))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* POST-OP TAB */}
        <TabsContent value="postop" className="mt-0">
          <Card className="shadow-sm border-border">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[100px]">Ngày PT</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Dịch vụ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú hậu phẫu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAssignments.postOpCases.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Không có ca hậu phẫu nào.</TableCell></TableRow>
                  ) : (
                    myAssignments.postOpCases.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{formatDate(item.surgeryDate)}</TableCell>
                        <TableCell className="font-semibold text-primary">{item.customerName}</TableCell>
                        <TableCell>{item.serviceName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={item.postOpStatus === 'Đã hoàn tất' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                            {item.postOpStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={item.postOpNote}>{item.postOpNote || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden flex flex-col gap-3 p-4 bg-muted/10">
              {myAssignments.postOpCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Không có ca hậu phẫu nào.</div>
              ) : (
                myAssignments.postOpCases.map(item => renderMobileCard(item, 'postop'))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NursingKpiPersonalClean;
