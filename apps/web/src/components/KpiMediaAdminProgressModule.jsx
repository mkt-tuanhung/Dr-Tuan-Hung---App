
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Users, CheckCircle, AlertTriangle, TrendingUp, Video, PenTool, FileText, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const normalize = (val) => String(val || '').trim().toLowerCase();
const getRecordMonth = (record) => record.month || String(record.date || record.createdAt || '').substring(0, 7);

const getStatus = (progress) => {
  if (progress < 50) return { label: 'Chưa đạt', className: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (progress < 80) return { label: 'Đang tiến triển', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (progress < 100) return { label: 'Gần đạt', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (progress < 120) return { label: 'Đạt KPI', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return { label: 'Vượt KPI', className: 'bg-purple-100 text-purple-700 border-purple-200' };
};

const CustomBar = (props) => {
  const { x, y, width, height, payload } = props;
  const progress = payload?.avgProgress || 0;
  const color = progress >= 120 ? '#a855f7' : progress >= 100 ? '#10b981' : progress >= 80 ? '#3b82f6' : progress >= 50 ? '#f59e0b' : '#ef4444';
  
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(4, width / 2, height);
  
  return (
    <path 
      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
      fill={color} 
    />
  );
};

const MetricCell = ({ actual, target }) => {
  const progress = target > 0 ? Math.min((actual / target) * 100, 100) : (actual > 0 ? 100 : 0);
  return (
    <div className="flex flex-col gap-1.5 w-full min-w-[80px]">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-foreground">{actual.toLocaleString()}</span>
        <span className="text-muted-foreground text-[10px]">/ {target.toLocaleString()}</span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
};

const KpiMediaAdminProgressModule = ({ selectedMonth }) => {
  const data = useMemo(() => {
    const kpiTargets = getStorageItem('kpiTargets', []);
    const mediaDailyReports = getStorageItem('mediaDailyReports', []);

    const targets = kpiTargets.filter(t => t.targetType === 'media' && t.month === selectedMonth);

    return targets.map(target => {
      const empId = target.employeeId;
      
      const empReports = mediaDailyReports.filter(r => normalize(r.employeeId) === normalize(empId) && getRecordMonth(r) === selectedMonth);
      
      const totalVideos = empReports.reduce((sum, r) => sum + (Number(r.videoCount) || 0), 0);
      const totalDesigns = empReports.reduce((sum, r) => sum + (Number(r.designCount) || 0), 0);
      const totalPosts = empReports.reduce((sum, r) => sum + (Number(r.postCount) || 0), 0);
      const totalApproved = empReports.reduce((sum, r) => sum + (Number(r.approvedCount) || 0), 0);
      const totalViews = empReports.reduce((sum, r) => sum + (Number(r.viewCount) || 0), 0);

      const targetVideo = Number(target.targetVideoCount) || 0;
      const targetDesign = Number(target.targetDesignCount) || 0;
      const targetPost = Number(target.targetPostCount) || 0;
      const targetApproved = Number(target.targetApprovedCount) || 0;
      const targetView = Number(target.targetViewCount) || 0;

      const videoProgress = targetVideo > 0 ? (totalVideos / targetVideo) * 100 : null;
      const designProgress = targetDesign > 0 ? (totalDesigns / targetDesign) * 100 : null;
      const postProgress = targetPost > 0 ? (totalPosts / targetPost) * 100 : null;
      const approvedProgress = targetApproved > 0 ? (totalApproved / targetApproved) * 100 : null;
      const viewProgress = targetView > 0 ? (totalViews / targetView) * 100 : null;

      const progressList = [videoProgress, designProgress, postProgress, approvedProgress, viewProgress].filter(p => p !== null);
      const avgProgress = progressList.length > 0 ? progressList.reduce((a, b) => a + b, 0) / progressList.length : 0;

      return {
        ...target,
        totalVideos, totalDesigns, totalPosts, totalApproved, totalViews,
        targetVideo, targetDesign, targetPost, targetApproved, targetView,
        avgProgress
      };
    });
  }, [selectedMonth]);

  const stats = useMemo(() => {
    let achieved = 0;
    let notAchieved = 0;
    let sumProgress = 0;
    let sumVideos = 0;
    let sumDesigns = 0;
    let sumPosts = 0;
    let sumViews = 0;

    data.forEach(d => {
      if (d.avgProgress >= 100) achieved++;
      else notAchieved++;
      sumProgress += d.avgProgress;
      sumVideos += d.totalVideos;
      sumDesigns += d.totalDesigns;
      sumPosts += d.totalPosts;
      sumViews += d.totalViews;
    });

    return {
      total: data.length,
      achieved,
      notAchieved,
      avgOverall: data.length > 0 ? sumProgress / data.length : 0,
      sumVideos,
      sumDesigns,
      sumPosts,
      sumViews
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name.includes('Hoàn thành') ? `${entry.value.toFixed(1)}%` : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Nhân sự KPI</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Đã đạt</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.achieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Chưa đạt</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-rose-600">{stats.notAchieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-purple-50/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-purple-700/70 font-semibold uppercase">Hoàn thành TB</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-purple-700">{stats.avgOverall.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Video className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Videos</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumVideos.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <PenTool className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Designs</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumDesigns.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Bài viết</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumPosts.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Lượt xem</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumViews.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Chi tiết Tiến độ KPI Media</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[50px] text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="w-[120px]">Video</TableHead>
                <TableHead className="w-[120px]">Design</TableHead>
                <TableHead className="w-[120px]">Bài viết</TableHead>
                <TableHead className="w-[120px]">Duyệt</TableHead>
                <TableHead className="w-[140px]">Views</TableHead>
                <TableHead className="text-center w-[100px]">Tỷ lệ HT</TableHead>
                <TableHead className="text-center w-[120px]">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Không có dữ liệu tiến độ tháng này.</TableCell></TableRow>
              ) : (
                data.map((d, idx) => {
                  const status = getStatus(d.avgProgress);
                  return (
                    <TableRow key={d.id} className="hover:bg-muted/50 transition-colors duration-200">
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-primary">{d.fullName}</div>
                        <div className="text-xs text-muted-foreground">{d.employeeId}</div>
                      </TableCell>
                      <TableCell><MetricCell actual={d.totalVideos} target={d.targetVideo} /></TableCell>
                      <TableCell><MetricCell actual={d.totalDesigns} target={d.targetDesign} /></TableCell>
                      <TableCell><MetricCell actual={d.totalPosts} target={d.targetPost} /></TableCell>
                      <TableCell><MetricCell actual={d.totalApproved} target={d.targetApproved} /></TableCell>
                      <TableCell><MetricCell actual={d.totalViews} target={d.targetView} /></TableCell>
                      <TableCell className="text-center font-bold tabular-nums">{d.avgProgress.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${status.className} font-medium`}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tỷ lệ hoàn thành theo nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Không có dữ liệu tiến độ tháng này.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgProgress" name="Hoàn thành (%)" shape={<CustomBar />} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Sản lượng Videos / Designs / Bài viết</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Không có dữ liệu tiến độ tháng này.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalVideos" name="Video" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="totalDesigns" name="Design" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="totalPosts" name="Bài viết" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiMediaAdminProgressModule;
