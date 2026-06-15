
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, Moon, HeartPulse, Stethoscope } from 'lucide-react';
import { getUsers } from '@/utils/userStorage.js';
import { getSurgicalAssignmentsByMonth, normalize } from '@/utils/surgicalCareAssignments.js';

const KpiNursingAdminProgressModule = ({ selectedMonth }) => {
  
  const nursingStaff = useMemo(() => {
    const users = getUsers();
    return users.filter(u => {
      const pos = (u.departmentPosition || '').trim().toLowerCase();
      return (pos === 'điều dưỡng' || pos === 'dieu duong' || pos === 'nursing') && u.status !== 'inactive';
    });
  }, []);

  const monthlyAssignments = useMemo(() => {
    return getSurgicalAssignmentsByMonth(selectedMonth);
  }, [selectedMonth]);

  const staffStats = useMemo(() => {
    return nursingStaff.map(staff => {
      const empId = normalize(staff.employeeId);
      
      let scrub1 = 0, scrub2 = 0, scrub3 = 0;
      let nightCount = 0;
      let postOpInProgress = 0, postOpCompleted = 0;
      const uniqueCases = new Set();

      monthlyAssignments.forEach(a => {
        let involved = false;

        // Scrub
        if (normalize(a.scrubNurse1EmployeeId) === empId) { scrub1++; involved = true; }
        if (normalize(a.scrubNurse2EmployeeId) === empId) { scrub2++; involved = true; }
        if (normalize(a.scrubNurse3EmployeeId) === empId) { scrub3++; involved = true; }

        // Night
        if (Array.isArray(a.nightNurseEmployeeIds) && a.nightNurseEmployeeIds.some(id => normalize(id) === empId)) {
          nightCount++;
          involved = true;
        }

        // Post-op
        if (Array.isArray(a.postOpNurseEmployeeIds) && a.postOpNurseEmployeeIds.some(id => normalize(id) === empId)) {
          if (a.postOpStatus === 'Đã hoàn tất') postOpCompleted++;
          else postOpInProgress++;
          involved = true;
        }

        if (involved) uniqueCases.add(a.id);
      });

      return {
        ...staff,
        scrub1, scrub2, scrub3,
        totalScrub: scrub1 + scrub2 + scrub3,
        nightCount,
        postOpInProgress, postOpCompleted,
        totalPostOp: postOpInProgress + postOpCompleted,
        totalUniqueCases: uniqueCases.size
      };
    }).sort((a, b) => b.totalUniqueCases - a.totalUniqueCases);
  }, [nursingStaff, monthlyAssignments]);

  const totals = useMemo(() => {
    return staffStats.reduce((acc, s) => ({
      scrub: acc.scrub + s.totalScrub,
      night: acc.night + s.nightCount,
      postOp: acc.postOp + s.totalPostOp,
      unique: acc.unique + s.totalUniqueCases
    }), { scrub: 0, night: 0, postOp: 0, unique: 0 });
  }, [staffStats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Nhân sự ĐD</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{nursingStaff.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-indigo-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Lượt Phụ mổ</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-indigo-600">{totals.scrub}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Moon className="w-4 h-4 text-slate-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Lượt Trực đêm</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-700">{totals.night}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Lượt Hậu phẫu</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">{totals.postOp}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            Thống kê Khối lượng công việc Điều dưỡng ({selectedMonth})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[50px] text-center">STT</TableHead>
                  <TableHead>Nhân sự</TableHead>
                  <TableHead className="text-center">Tổng KH</TableHead>
                  <TableHead className="text-center">Tổng Phụ mổ</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Phụ 1</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Phụ 2</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Phụ 3</TableHead>
                  <TableHead className="text-center">Trực đêm</TableHead>
                  <TableHead className="text-center">Hậu phẫu</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Đang CS</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Hoàn tất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffStats.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Không có nhân sự Điều dưỡng.</TableCell></TableRow>
                ) : (
                  staffStats.map((staff, idx) => (
                    <TableRow key={staff.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-primary">{staff.fullName}</div>
                        <div className="text-xs text-muted-foreground">{staff.employeeId}</div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-purple-700">{staff.totalUniqueCases}</TableCell>
                      <TableCell className="text-center font-semibold text-indigo-600">{staff.totalScrub}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{staff.scrub1}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{staff.scrub2}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{staff.scrub3}</TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">{staff.nightCount}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">{staff.totalPostOp}</TableCell>
                      <TableCell className="text-center text-amber-600">{staff.postOpInProgress}</TableCell>
                      <TableCell className="text-center text-emerald-600">{staff.postOpCompleted}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden flex flex-col divide-y divide-border">
            {staffStats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Không có nhân sự Điều dưỡng.</div>
            ) : (
              staffStats.map((staff, idx) => (
                <div key={staff.id} className="p-4 space-y-3 bg-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-primary text-base">{staff.fullName}</h3>
                      <p className="text-xs text-muted-foreground">{staff.employeeId}</p>
                    </div>
                    <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                      {staff.totalUniqueCases} Khách
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                      <span className="text-xs text-muted-foreground block mb-1">Phụ mổ</span>
                      <span className="font-bold text-indigo-700 text-lg">{staff.totalScrub}</span>
                      <div className="text-[10px] text-muted-foreground mt-1 flex justify-center gap-1">
                        <span>C:{staff.scrub1}</span>
                        <span>P2:{staff.scrub2}</span>
                        <span>P3:{staff.scrub3}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-200">
                      <span className="text-xs text-muted-foreground block mb-1">Trực đêm</span>
                      <span className="font-bold text-slate-700 text-lg">{staff.nightCount}</span>
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                      <span className="text-xs text-muted-foreground block mb-1">Hậu phẫu</span>
                      <span className="font-bold text-emerald-700 text-lg">{staff.totalPostOp}</span>
                      <div className="text-[10px] text-muted-foreground mt-1 flex justify-center gap-1">
                        <span className="text-amber-600">Đang:{staff.postOpInProgress}</span>
                        <span className="text-emerald-600">Xong:{staff.postOpCompleted}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KpiNursingAdminProgressModule;
