import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { CalendarCheck, ChevronLeft, ChevronRight, Search, Check, X, Clock, Users, AlertTriangle, Download, ScanFace, ImageDown } from 'lucide-react';
import LeaveManagementPage from './LeaveManagementPage.jsx';
import FaceIdAdminPanel from '@/features/faceid/FaceIdAdminPanel.jsx';
import { vnToday } from '@/lib/vnTime';

const STATUS_CONFIG = {
  present:  { label: 'Có mặt',    color: 'e-tone-success' },
  late:     { label: 'Đi trễ',    color: 'e-tone-danger' },
  absent:   { label: 'Vắng mặt', color: 'e-tone-rose' },
  half_day: { label: 'Nửa ngày', color: 'e-tone-info' },
  leave:    { label: 'Nghỉ phép', color: 'e-tone-lavender' },
};

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const OFFICE_IPS = ['42.114.215.104'];

const fmtTime = (t) => t ? t.slice(0, 5) : '—';
const fmtDate = (d) => {
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
};

const AttendanceManagementPage = ({ isNested = false, defaultTab = 'attendance' }) => {
  const today = new Date();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [timesheet, setTimesheet] = useState(null); // { html, name }
  const tsRef = React.useRef(null);
  const [saving, setSaving] = useState(false);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const [staffRes, attRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, employee_id, role, avatar_url, fixed_salary').eq('is_active', true).order('full_name'),
      supabase.from('attendance').select('*').gte('date', startDate).lte('date', endDate),
    ]);

    setStaff(staffRes.data || []);
    setAttendance(attRes.data || []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getRecord = (staffId, day) => {
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return attendance.find(a => a.staff_id === staffId && a.date === date);
  };

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  // ---------- Xuất BẢNG CÔNG cá nhân (cửa sổ in đẹp — lưu PDF được) ----------
  const openTimesheet = (s) => {
    const STL = {
      present: ['Có mặt', '#067B7F', '#ccfbf1'], late: ['Đi trễ', '#b45309', '#fef3c7'],
      early_leave: ['Về sớm', '#c2410c', '#ffedd5'], half_day: ['Nửa ngày', '#1d4ed8', '#dbeafe'],
      leave: ['Nghỉ phép', '#7c3aed', '#ede9fe'], absent: ['Vắng mặt', '#dc2626', '#fee2e2'],
    };
    const recs = {};
    attendance.filter(a => a.staff_id === s.id).forEach(a => { recs[new Date(a.date).getDate()] = a; });
    const cnt = { cong: 0, present: 0, late: 0, early_leave: 0, half_day: 0, leave: 0, absent: 0, ot: 0, le: 0 };
    let rowsHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      const weekend = dow === 0 || dow === 6;
      const r = recs[d];
      const st = r?.status;
      if (st) {
        if (['present', 'late', 'early_leave'].includes(st)) cnt.cong += 1;
        else if (st === 'half_day') cnt.cong += 0.5;
        if (cnt[st] !== undefined) cnt[st] += 1;
        cnt.ot += Number(r.overtime_hours || 0);
      }
      cnt.le += Number(r?.late_early_hours || 0);
      const cfg = st ? STL[st] : null;
      const badge = cfg ? `<span style="background:${cfg[2]};color:${cfg[1]};padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;white-space:nowrap">${cfg[0]}</span>` : '<span style="color:#cbd5e1">—</span>';
      const ci = r?.check_in ? String(r.check_in).slice(0, 5) : '—';
      const co = r?.check_out ? String(r.check_out).slice(0, 5) : '—';
      const ot = Number(r?.overtime_hours || 0) > 0 ? `${r.overtime_hours}h` : '';
      const le = Number(r?.late_early_hours || 0) > 0 ? `${r.late_early_hours}h` : '';
      const note = (r?.note || '').replace(/</g, '&lt;');
      rowsHtml += `<tr style="${weekend ? 'background:#f8fafc' : ''}">
        <td style="text-align:center;font-weight:700;color:${weekend ? '#94a3b8' : '#334155'}">${d}</td>
        <td style="text-align:center;color:${weekend ? '#cbd5e1' : '#64748b'}">${DAYS[dow]}</td>
        <td style="text-align:center">${badge}</td>
        <td style="text-align:center;font-variant-numeric:tabular-nums">${ci}</td>
        <td style="text-align:center;font-variant-numeric:tabular-nums">${co}</td>
        <td style="text-align:center;color:#067B7F;font-weight:700">${ot}</td>
        <td style="text-align:center;color:#b45309;font-weight:700">${le}</td>
        <td style="color:#475569;font-size:11px">${note}</td>
      </tr>`;
    }
    const chip = (label, val, color) => `<div style="flex:1;min-width:90px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px"><div style="font-size:11px;color:#94a3b8">${label}</div><div style="font-size:20px;font-weight:800;color:${color}">${val}</div></div>`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bảng công ${s.full_name} - ${MONTHS[month - 1]} ${year}</title>
      <style>
        *{box-sizing:border-box} body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:28px;color:#0f172a;background:#fff}
        .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #067B7F;padding-bottom:14px;margin-bottom:16px}
        h1{font-size:20px;margin:0} .sub{color:#64748b;font-size:13px;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #e2e8f0;padding:6px 8px}
        thead th{background:#067B7F;color:#fff;font-weight:700;font-size:11px}
        .sum{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
        .foot{margin-top:22px;display:flex;justify-content:space-between;color:#64748b;font-size:12px}
        @media print{ .noprint{display:none} body{padding:12px} }
      </style></head><body>
      <div class="head">
        <div>
          <h1>BẢNG CHẤM CÔNG CÁ NHÂN</h1>
          <div class="sub">${MONTHS[month - 1]} năm ${year}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;font-size:16px">${s.full_name}</div>
          <div class="sub">Mã NV: ${s.employee_id || '—'}${s.role ? ' · ' + s.role : ''}</div>
        </div>
      </div>
      <div class="sum">
        ${chip('Tổng công', cnt.cong, '#067B7F')}
        ${chip('Đi trễ', cnt.late, '#b45309')}
        ${chip('Về sớm', cnt.early_leave, '#c2410c')}
        ${chip('Nửa ngày', cnt.half_day, '#1d4ed8')}
        ${chip('Nghỉ phép', cnt.leave, '#7c3aed')}
        ${chip('Vắng', cnt.absent, '#dc2626')}
        ${chip('Đi muộn/về sớm', cnt.le + 'h', '#b45309')}
        ${chip('Tăng ca thực (đã trừ)', Math.max(0, cnt.ot - cnt.le) + 'h', '#067B7F')}
      </div>
      <table>
        <thead><tr><th>Ngày</th><th>Thứ</th><th>Trạng thái</th><th>Giờ vào</th><th>Giờ ra</th><th>Tăng ca</th><th>Muộn/sớm</th><th>Ghi chú</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="foot">
        <div>Xuất lúc ${new Date().toLocaleString('vi-VN')}</div>
        <div style="text-align:center">Người lập bảng<br/><br/><br/>………………………</div>
        <div style="text-align:center">Xác nhận<br/><br/><br/>………………………</div>
      </div>
      </body></html>`;
    setTimesheet({ html, name: `Bang-cong_${(s.employee_id || s.full_name || '').replace(/\s+/g, '')}_${month}-${year}` });
  };
  const printTimesheet = () => { try { tsRef.current?.contentWindow?.focus(); tsRef.current?.contentWindow?.print(); } catch { toast.error('Không in được — thử lại'); } };

  // ---------- Xuất ẢNH tổng hợp LỖI CHẤM CÔNG cả tháng (toàn bộ nhân sự) ----------
  // Lỗi đi muộn: bản ghi status 'late' (kèm giờ vào). Lỗi check in/out: ngày làm việc
  // (trừ Chủ nhật, chỉ tính ngày ĐÃ QUA) không có bản ghi nào = "không chấm công";
  // có bản ghi đi làm nhưng thiếu giờ vào/ra = "thiếu check-in/check-out".
  // Nhân sự lương cố định (không phải chấm công) không bị tính lỗi "không chấm công".
  const exportViolationsImage = () => {
    if (!staff.length) { toast.error('Chưa có dữ liệu'); return; }
    const pad2 = (x) => String(x).padStart(2, '0');
    const isCurMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    const lastDoneDay = isCurMonth ? Math.min(daysInMonth, today.getDate() - 1) : (new Date(year, month - 1, 1) > today ? 0 : daysInMonth);

    const byStaffDate = {};
    attendance.forEach(a => { byStaffDate[a.staff_id + '|' + a.date] = a; });

    const rows = staff.map((s, idx) => {
      const lateRecs = attendance
        .filter(a => a.staff_id === s.id && a.status === 'late')
        .sort((x, y) => (x.date < y.date ? -1 : 1));
      const lateDetails = lateRecs.map(a => `${pad2(new Date(a.date).getDate())}/${pad2(month)}${a.check_in ? ` (vào ${fmtTime(a.check_in)})` : ''}`);
      const miss = [];
      for (let d = 1; d <= lastDoneDay; d++) {
        if (new Date(year, month - 1, d).getDay() === 0) continue; // Chủ nhật nghỉ
        const rec = byStaffDate[s.id + '|' + `${year}-${pad2(month)}-${pad2(d)}`];
        if (!rec) { if (!s.fixed_salary) miss.push(`${pad2(d)}/${pad2(month)} không chấm công`); }
        else if (['present', 'late', 'early_leave'].includes(rec.status)) {
          if (!rec.check_in) miss.push(`${pad2(d)}/${pad2(month)} thiếu check-in`);
          else if (!rec.check_out) miss.push(`${pad2(d)}/${pad2(month)} thiếu check-out`);
        }
      }
      return { idx: idx + 1, s, lateCount: lateRecs.length, lateDetails, miss };
    });

    const F = (bold, size) => `${bold ? '700' : '400'} ${size}px Arial, "Helvetica Neue", sans-serif`;
    const mc = document.createElement('canvas').getContext('2d');
    const wrap = (text, maxW, bold, size) => {
      mc.font = F(bold, size);
      const out = []; let line = '';
      String(text).split(' ').forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (mc.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      if (line) out.push(line);
      return out;
    };

    const PAD = 12, LH = 18;
    const W_STT = 46, W_NAME = 190, W_LATE = 330, W_MISS = 330;
    const W = W_STT + W_NAME + W_LATE + W_MISS;
    const prepared = rows.map(r => {
      const nameLines = wrap(r.s.full_name, W_NAME - PAD * 2, true, 13.5);
      const lateLines = r.lateCount
        ? [`${r.lateCount} lỗi đi muộn`, ...wrap(r.lateDetails.join(', '), W_LATE - PAD * 2, false, 12)]
        : ['—'];
      const missLines = r.miss.length
        ? [`${r.miss.length} lỗi`, ...wrap(r.miss.join(', '), W_MISS - PAD * 2, false, 12)]
        : ['—'];
      const h = Math.max(nameLines.length + 1, lateLines.length, missLines.length) * LH + 16;
      return { ...r, nameLines, lateLines, missLines, h: Math.max(h, 42) };
    });

    const titleH = 92, headH = 42, footH = 34;
    const totalLate = prepared.reduce((s, r) => s + r.lateCount, 0);
    const totalMiss = prepared.reduce((s, r) => s + r.miss.length, 0);
    const H = titleH + headH + prepared.reduce((s, r) => s + r.h, 0) + footH;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textBaseline = 'middle';

    // Tiêu đề
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#b45309'; ctx.fillRect(0, 0, W, titleH);
    ctx.fillStyle = '#fff'; ctx.font = F(true, 21); ctx.textAlign = 'left';
    ctx.fillText(`BÁO CÁO LỖI CHẤM CÔNG — ${MONTHS[month - 1].toUpperCase()}/${year}`, 20, 34);
    ctx.font = F(false, 13); ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`PK Dr Tuấn Hùng · ${staff.length} nhân sự · ${totalLate} lỗi đi muộn · ${totalMiss} lỗi không check in/out (tính đến hết ${lastDoneDay ? pad2(lastDoneDay) + '/' + pad2(month) : '—'}, trừ Chủ nhật)`, 20, 62);

    // Header cột
    let y = titleH;
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, y, W, headH);
    ctx.fillStyle = '#475569'; ctx.font = F(true, 12.5);
    ctx.textAlign = 'center'; ctx.fillText('STT', W_STT / 2, y + headH / 2);
    ctx.textAlign = 'left';
    ctx.fillText('HỌ TÊN', W_STT + PAD, y + headH / 2);
    ctx.fillText('LỖI ĐI MUỘN — THỜI GIAN CHI TIẾT', W_STT + W_NAME + PAD, y + headH / 2);
    ctx.fillText('LỖI KHÔNG CHECK IN / CHECK OUT', W_STT + W_NAME + W_LATE + PAD, y + headH / 2);
    y += headH;

    // Từng nhân sự
    prepared.forEach((r, ri) => {
      if (ri % 2 === 1) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, y, W, r.h); }
      ctx.textAlign = 'center'; ctx.font = F(true, 13); ctx.fillStyle = '#64748b';
      ctx.fillText(String(r.idx), W_STT / 2, y + 22);
      ctx.textAlign = 'left';
      let ty = y + 16;
      r.nameLines.forEach(l => { ctx.font = F(true, 13.5); ctx.fillStyle = '#0f172a'; ctx.fillText(l, W_STT + PAD, ty); ty += LH; });
      ctx.font = F(false, 11); ctx.fillStyle = '#94a3b8';
      ctx.fillText(r.s.role || '', W_STT + PAD, ty);
      ty = y + 16;
      r.lateLines.forEach((l, i) => {
        ctx.font = F(i === 0 && r.lateCount ? true : false, 12);
        ctx.fillStyle = r.lateCount ? (i === 0 ? '#b45309' : '#78716c') : '#94a3b8';
        ctx.fillText(l, W_STT + W_NAME + PAD, ty); ty += LH;
      });
      ty = y + 16;
      r.missLines.forEach((l, i) => {
        ctx.font = F(i === 0 && r.miss.length ? true : false, 12);
        ctx.fillStyle = r.miss.length ? (i === 0 ? '#dc2626' : '#78716c') : '#94a3b8';
        ctx.fillText(l, W_STT + W_NAME + W_LATE + PAD, ty); ty += LH;
      });
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + r.h - 0.5); ctx.lineTo(W, y + r.h - 0.5); ctx.stroke();
      y += r.h;
    });
    // Kẻ dọc giữa các cột
    ctx.strokeStyle = '#e2e8f0';
    [W_STT, W_STT + W_NAME, W_STT + W_NAME + W_LATE].forEach(vx => {
      ctx.beginPath(); ctx.moveTo(vx + 0.5, titleH); ctx.lineTo(vx + 0.5, y); ctx.stroke();
    });
    ctx.font = F(false, 11); ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText(`Xuất từ hệ thống lúc ${new Date().toLocaleString('vi-VN')} — Lưu hành nội bộ`, PAD, y + footH / 2);

    canvas.toBlob((blob) => {
      if (!blob) { toast.error('Không tạo được ảnh'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Loi-cham-cong-thang-${month}-${year}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast.success(`Đã xuất ảnh lỗi chấm công ${MONTHS[month - 1]}/${year}`);
    }, 'image/png');
  };

  const stats = {
    total: staff.length,
    present: attendance.filter(a => {
      const d = new Date(a.date);
      return a.status === 'present' && d.getMonth()+1 === month && d.getFullYear() === year &&
        a.date === vnToday();
    }).length,
  };

  const violations = attendance.filter(a => 
    a.location_status === 'outside' || a.location_status === 'unknown' || (a.ip_address && !OFFICE_IPS.includes(a.ip_address))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const openEdit = (staffId, day) => {
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const record = getRecord(staffId, day);
    const s = staff.find(x => x.id === staffId);
    setEditModal({
      staffId, date, staffName: s?.full_name,
      status: record?.status || 'present',
      check_in: record?.check_in || '',
      check_out: record?.check_out || '',
      overtime_hours: record?.overtime_hours ?? '',
      late_early_hours: record?.late_early_hours ?? '',
      note: record?.note || '',
      id: record?.id || null,
      latitude: record?.latitude,
      longitude: record?.longitude,
      ip_address: record?.ip_address,
      location_status: record?.location_status,
      check_in_method: record?.check_in_method,
      check_out_method: record?.check_out_method,
      check_in_photo: record?.check_in_photo,
      check_out_photo: record?.check_out_photo,
    });
  };

  const handleCellClick = (staffId, day) => {
    if (isMultiSelect) {
      const key = `${staffId}_${day}`;
      const next = new Set(selectedCells);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelectedCells(next);
    } else {
      openEdit(staffId, day);
    }
  };

  const handleBulkAction = async (status) => {
    setSaving(true);
    try {
      const updates = [];
      const inserts = [];
      
      Array.from(selectedCells).forEach(key => {
        const parts = key.split('_');
        const dayStr = parts.pop();
        const staffId = parts.join('_');
        const day = parseInt(dayStr, 10);
        const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const record = getRecord(staffId, day);
        
        if (record) {
          updates.push({ ...record, status, updated_at: new Date().toISOString() });
        } else {
          inserts.push({
            staff_id: staffId,
            date,
            status,
            check_in: status === 'present' ? '08:50:00' : null,
            updated_at: new Date().toISOString()
          });
        }
      });
      
      if (updates.length > 0) {
        const { error } = await supabase.from('attendance').upsert(updates);
        if (error) throw error;
      }
      if (inserts.length > 0) {
        // Upsert theo (staff_id, date) để không lỗi trùng khóa khi ô chưa nạp kịp
        // bản ghi đã tồn tại (VD nhân sự vừa tự check-in).
        const { error } = await supabase.from('attendance').upsert(inserts, { onConflict: 'staff_id,date' });
        if (error) throw error;
      }
      
      toast.success(`Đã cập nhật ${selectedCells.size} ô chấm công`);
      setSelectedCells(new Set());
      setIsMultiSelect(false);
      loadData();
    } catch(err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        staff_id: editModal.staffId,
        date: editModal.date,
        status: editModal.status,
        check_in: editModal.check_in || null,
        check_out: editModal.check_out || null,
        overtime_hours: Number(editModal.overtime_hours) || 0,
        late_early_hours: Number(editModal.late_early_hours) || 0,
        note: editModal.note || null,
        updated_at: new Date().toISOString(),
      };
      if (editModal.id) {
        const { error } = await supabase.from('attendance').update(data).eq('id', editModal.id);
        if (error) throw error;
      } else {
        // Upsert theo (staff_id, date): nếu nhân sự đã có bản ghi hôm nay (VD tự
        // check-in Face) mà state trên trang chưa nạp kịp -> tránh lỗi trùng khóa
        // "duplicate key" khiến không chấm công được; sẽ cập nhật đúng bản ghi đó.
        const { error } = await supabase.from('attendance')
          .upsert(data, { onConflict: 'staff_id,date' });
        if (error) throw error;
      }
      toast.success('Đã lưu chấm công');
      setEditModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAnomaly = async (record) => {
    if (!confirm('Bạn có chắc chắn muốn xác nhận ca chấm công này là hợp lệ (xóa cảnh báo sai phạm)?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('attendance').update({
        location_status: 'in_office',
        ip_address: OFFICE_IPS[0] || '127.0.0.1',
        note: (record.note ? record.note + ' \n' : '') + '[Admin đã duyệt hợp lệ]',
        updated_at: new Date().toISOString()
      }).eq('id', record.id);
      if (error) throw error;
      toast.success('Đã duyệt hợp lệ');
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4 items-start">
      {/* Header & Tabs */}
      {!isNested && (
        <div className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="sr-only">Chấm công & Nghỉ phép</h2>
              {activeTab === 'attendance' && <p className="e-page-desc">{MONTHS[month-1]} {year}</p>}
            </div>
            {activeTab === 'attendance' && (
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="e-icon-btn w-9 h-9">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[14px] font-semibold text-slate-800 min-w-[110px] text-center tabular-nums">{MONTHS[month-1]} {year}</span>
                <button onClick={nextMonth} className="e-icon-btn w-9 h-9">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <div className="e-tabs">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`e-tab ${activeTab === 'attendance' ? 'e-tab-active' : 'text-slate-500'}`}
            >
              Bảng chấm công
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              className={`e-tab ${activeTab === 'leave' ? 'e-tab-active' : 'text-slate-500'}`}
            >
              Duyệt đơn xin phép
            </button>
            <button
              onClick={() => setActiveTab('warnings')}
              className={`e-tab ${activeTab === 'warnings' ? 'e-tab-active' : 'text-slate-500'}`}
            >
              Cảnh báo
              {violations.length > 0 && <span className="e-badge e-badge-sm e-tone-danger">{violations.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('faceid')}
              className={`e-tab ${activeTab === 'faceid' ? 'e-tab-active' : 'text-slate-500'}`}
            >
              <ScanFace className="w-4 h-4" /> Face ID
            </button>
          </div>
        </div>
      )}

      {/* When Nested, we still need the month selector for attendance tab */}
      {isNested && activeTab === 'attendance' && (
        <div className="e-toolbar justify-between pl-4 xl:col-span-2">
          <p className="text-[14px] font-semibold text-slate-800">Bảng theo dõi chấm công hàng ngày</p>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="e-icon-btn w-9 h-9">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[14px] font-semibold text-slate-800 min-w-[110px] text-center tabular-nums">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="e-icon-btn w-9 h-9">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'attendance' ? (
        <>
      {/* Chấm công hôm nay (mockup 06): donut lớn "x/y Đang có mặt" */}
      <div className="e-card e-card-pad xl:order-1">
        <div className="e-card-header">
          <div>
            <div className="e-card-title">Chấm công hôm nay</div>
            <div className="e-card-sub">Tỷ lệ nhân sự đã chấm công “Có mặt” trong ngày</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center">
          <div className="flex flex-col gap-3 order-2 sm:order-1">
            <div className="e-card-flat flex items-center gap-3 p-3.5">
              <span className="w-11 h-11 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0">
                <Users className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-slate-900">Tổng nhân sự</div>
                <div className="text-[12px] text-slate-500">Đang hoạt động trong hệ thống</div>
              </div>
              <div className="text-[22px] font-bold text-slate-900 tabular-nums">{stats.total}</div>
            </div>
            <div className="e-card-flat flex items-center gap-3 p-3.5">
              <span className="w-11 h-11 rounded-full bg-success-50 text-success-600 grid place-items-center shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-slate-900">Có mặt hôm nay</div>
                <div className="text-[12px] text-slate-500">Phần màu teal trên vòng tròn</div>
              </div>
              <span className="w-3 h-3 rounded-full bg-teal-600 shrink-0" />
            </div>
          </div>
          <div className="order-1 sm:order-2 grid place-items-center">
            <div
              className="relative w-[200px] h-[200px] lg:w-[220px] lg:h-[220px] rounded-full shadow-soft"
              style={{ background: `conic-gradient(#067B7F 0%, #3CA7A9 ${stats.total ? Math.min(100, (stats.present / stats.total) * 100) : 0}%, #EAF4F4 0)` }}
            >
              <div className="absolute inset-[24px] rounded-full bg-white grid place-content-center text-center">
                <div className="text-[34px] lg:text-[38px] font-bold text-slate-900 leading-none tabular-nums">{stats.present}<span className="text-slate-400 after:content-[attr(data-total)]" data-total={`/${stats.total}`} /></div>
                <div className="text-[13px] text-slate-500 mt-1.5">Đang có mặt</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Bulk Toggle */}
      <div className="e-toolbar xl:col-span-2 xl:order-3">
        <div className="e-search w-full sm:w-auto sm:max-w-xs flex-1 min-w-[180px]">
          <Search className="text-slate-400" />
          <input
            className="text-slate-700 placeholder:text-slate-400"
            placeholder="Tìm nhân sự..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setIsMultiSelect(!isMultiSelect);
            if (isMultiSelect) setSelectedCells(new Set());
          }}
          className={`e-btn w-full sm:w-auto sm:ml-auto ${isMultiSelect ? 'e-btn-primary' : 'e-btn-secondary'}`}
        >
          {isMultiSelect ? 'Hủy chọn nhiều' : 'Tích chọn nhiều ô'}
        </button>
        <button
          onClick={exportViolationsImage}
          disabled={loading}
          className="e-btn e-btn-secondary w-full sm:w-auto"
        >
          <ImageDown className="w-4 h-4" /> Xuất lỗi tháng
        </button>
        {isNested && (
          <button 
            onClick={() => setShowViolationsModal(true)} 
            className="e-btn e-btn-danger-soft w-full sm:w-auto"
          >
            <AlertTriangle className="w-4 h-4" /> 
            Cảnh báo vi phạm {violations.length > 0 && `(${violations.length})`}
          </button>
        )}
      </div>

      {/* Desktop table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 xl:col-span-2 xl:order-3">
          <div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="hidden lg:block e-card overflow-auto xl:col-span-2 xl:order-3">
            <table className="w-full text-[12.5px] border-separate border-spacing-0">
              <thead className="text-slate-500">
                <tr className="bg-slate-50">
                  <th className="text-left pl-5 pr-3 h-12 text-[12px] font-semibold sticky left-0 z-10 bg-slate-50 border-b border-slate-200 min-w-[220px]">Nhân sự</th>
                  {days.map(d => {
                    const date = new Date(year, month-1, d);
                    const isToday = date.toDateString() === today.toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={d} className={`px-1 h-12 text-[12px] font-semibold text-center min-w-[38px] border-b border-slate-200 ${isToday ? 'text-teal-700 bg-teal-50' : ''} ${isWeekend ? 'text-slate-300' : ''}`}>
                        <div>{d}</div>
                        <div className="text-[10.5px] font-medium opacity-70">{DAYS[date.getDay()]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="align-middle">
                {filtered.map(s => (
                  <tr key={s.id} className="group">
                    <td className="pl-5 pr-3 py-2.5 sticky left-0 z-10 bg-white group-hover:bg-teal-50 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-teal-50 grid place-items-center shrink-0">
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[13px] font-bold text-teal-700">{s.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-[13px] truncate">{s.full_name}</div>
                          <div className="text-[11.5px] text-slate-500">{s.employee_id}</div>
                        </div>
                        <button onClick={() => openTimesheet(s)} title="Xuất bảng công cá nhân" className="ml-auto shrink-0 e-icon-btn w-8 h-8 rounded-lg"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    {days.map(d => {
                      const record = getRecord(s.id, d);
                      const date = new Date(year, month-1, d);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = date.toDateString() === today.toDateString();
                      const cellKey = `${s.id}_${d}`;
                      const isSelected = selectedCells.has(cellKey);
                      return (
                        <td key={d} className={`px-0.5 py-2 text-center relative border-b border-slate-100 ${isWeekend ? 'bg-slate-50/70' : ''} ${isToday ? 'bg-teal-50/60' : ''} ${isSelected ? 'ring-2 ring-inset ring-teal-500 bg-teal-50' : ''}`}>
                          <button
                            onClick={() => handleCellClick(s.id, d)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition hover:bg-teal-50 relative"
                            title={record ? STATUS_CONFIG[record.status]?.label : 'Chưa chấm'}
                          >
                            {record ? (
                              <>
                                {record.status === 'present' ? <Check className="w-4 h-4 text-success-500" strokeWidth={2.5} /> :
                                record.status === 'absent' ? <X className="w-4 h-4 text-danger-500" strokeWidth={2.5} /> :
                                record.status === 'late' ? <Clock className="w-4 h-4 text-warning-500" strokeWidth={2.5} /> :
                                <span className="text-[10px] font-bold text-lavender-600">{record.status === 'leave' ? 'NP' : 'ND'}</span>}
                                {(record.location_status === 'outside' || record.location_status === 'unknown' || (record.ip_address && !OFFICE_IPS.includes(record.ip_address))) && (
                                  <span className="absolute top-0 -right-1 w-2 h-2 bg-danger-500 rounded-full border border-white" title="Chấm công sai vị trí hoặc sai mạng"></span>
                                )}
                              </>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block mx-auto" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nhân viên hôm nay (mockup 06) — hiển thị ở mọi kích thước màn hình */}
          <div className="e-card e-card-pad xl:order-2">
            <div className="e-card-header">
              <div>
                <div className="e-card-title">Nhân viên hôm nay</div>
                <div className="e-card-sub">Trạng thái chấm công hôm nay · số ngày có mặt trong tháng</div>
              </div>
            </div>
            <ul className="xl:max-h-[330px] overflow-y-auto -mx-1 px-1">
            {filtered.map(s => {
              const todayStr = vnToday();
              const todayRecord = attendance.find(a => a.staff_id === s.id && a.date === todayStr);
              const monthCount = attendance.filter(a => a.staff_id === s.id && a.status === 'present').length;
              return (
                <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 border-b border-slate-100 last:border-b-0">
                  <div className="row-span-2 self-start w-10 h-10 rounded-full overflow-hidden bg-teal-50 grid place-items-center shrink-0">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[14px] font-bold text-teal-700">{s.full_name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-[14px] truncate">{s.full_name}</div>
                    <div className="text-[12px] text-slate-500 truncate">{s.employee_id} · Có mặt tháng này: <span className="font-semibold text-slate-700 tabular-nums">{monthCount} ngày</span></div>
                  </div>
                  {todayRecord ? (
                    <span className={`e-badge e-badge-sm ${STATUS_CONFIG[todayRecord.status]?.color}`}>
                      {STATUS_CONFIG[todayRecord.status]?.label}
                    </span>
                  ) : (
                    <span className="e-badge e-badge-sm e-tone-neutral">Chưa chấm</span>
                  )}
                  <div className="col-start-2 col-span-2 flex flex-wrap items-center gap-1.5">
                    <button onClick={() => openTimesheet(s)} className="e-btn e-btn-ghost e-btn-sm h-8 px-2.5"><Download className="w-3.5 h-3.5" />Bảng công</button>
                    <button onClick={() => openEdit(s.id, today.getDate())} className="e-btn e-btn-outline e-btn-sm h-8 px-2.5">Chấm hôm nay →</button>
                  </div>
                </li>
              );
            })}
            </ul>
          </div>
        </>
      )}

      {/* Floating Action Bar for Multi-Select */}
      {isMultiSelect && selectedCells.size > 0 && (
        <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] sm:w-auto bg-white border border-teal-100 text-slate-800 px-4 py-3 rounded-2xl shadow-float flex flex-wrap items-center gap-3 z-[60] animate-in slide-in-from-bottom-8">
          <div className="font-semibold text-[14px] text-teal-800">Đã chọn {selectedCells.size} ô</div>
          <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-3">
            <button disabled={saving} onClick={() => handleBulkAction('present')} className="e-btn e-btn-sm e-btn-primary">Có mặt</button>
            <button disabled={saving} onClick={() => handleBulkAction('half_day')} className="e-btn e-btn-sm e-tone-info">Nửa ngày</button>
            <button disabled={saving} onClick={() => handleBulkAction('late')} className="e-btn e-btn-sm e-tone-warning">Đi trễ</button>
            <button disabled={saving} onClick={() => handleBulkAction('absent')} className="e-btn e-btn-sm e-btn-danger-soft">Vắng mặt</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 xl:col-span-2 xl:order-3">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`e-badge e-badge-sm e-badge-dot ${v.color}`}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {/* Modal xem/xuất Bảng công cá nhân */}
      {timesheet && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[70] flex items-center justify-center p-3 sm:p-6" onClick={() => setTimesheet(null)}>
          <div className="e-modal max-w-3xl h-[90dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 shrink-0">
              <h3 className="e-modal-title">Bảng chấm công cá nhân</h3>
              <div className="flex items-center gap-2">
                <button onClick={printTimesheet} className="e-btn e-btn-primary e-btn-sm"><Download className="w-4 h-4" />In / Lưu PDF</button>
                <button onClick={() => setTimesheet(null)} className="e-icon-btn w-9 h-9"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <iframe ref={tsRef} title="timesheet" srcDoc={timesheet.html} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[100] flex items-center justify-center p-4">
          <div className="e-modal max-w-sm p-5 max-h-[92dvh] overflow-y-auto">
            <h3 className="e-modal-title">Chấm công</h3>
            <p className="text-[13px] text-slate-500 mt-0.5 mb-4 pb-3 border-b border-slate-100">{editModal.staffName} · {fmtDate(editModal.date)}</p>

            <div className="space-y-4">
              <div>
                <label className="e-label">Trạng thái</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setEditModal(m => ({ ...m, status: k }))}
                      className={`h-9 rounded-xl text-[13px] font-medium border transition ${
                        editModal.status === k
                          ? 'border-teal-500 bg-teal-50 text-teal-800 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="e-label">Giờ vào</label>
                  <input
                    type="time"
                    value={editModal.check_in}
                    onChange={e => setEditModal(m => ({ ...m, check_in: e.target.value }))}
                    className="e-input tabular-nums"
                  />
                </div>
                <div>
                  <label className="e-label">Giờ ra</label>
                  <input
                    type="time"
                    value={editModal.check_out}
                    onChange={e => setEditModal(m => ({ ...m, check_out: e.target.value }))}
                    className="e-input tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="e-label">Tăng ca (giờ)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={editModal.overtime_hours}
                    onChange={e => setEditModal(m => ({ ...m, overtime_hours: e.target.value }))}
                    className="e-input tabular-nums"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="e-label">Đi muộn / về sớm (giờ)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={editModal.late_early_hours}
                    onChange={e => setEditModal(m => ({ ...m, late_early_hours: e.target.value }))}
                    className="e-input tabular-nums"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-[12px] text-slate-400 -mt-1">Giờ đi muộn/về sớm sẽ tự trừ vào tổng giờ tăng ca khi tính lương.</p>

              <div>
                <label className="e-label">Ghi chú</label>
                <textarea
                  value={editModal.note}
                  onChange={e => setEditModal(m => ({ ...m, note: e.target.value }))}
                  rows={2}
                  className="e-textarea resize-none"
                  placeholder="Ghi chú thêm..."
                />
              </div>

              {editModal.id && (editModal.check_in_photo || editModal.check_out_photo) && (
                <div className="e-subtle p-3">
                  <div className="text-[12.5px] font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    Ảnh chấm công (Face AI)
                    {(editModal.check_in_method === 'face_ai' || editModal.check_out_method === 'face_ai') && (
                      <span className="e-badge e-badge-sm e-tone-brand">Face AI</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {editModal.check_in_photo && (
                      <a href={editModal.check_in_photo} target="_blank" rel="noreferrer" className="flex-1">
                        <img src={editModal.check_in_photo} alt="Ảnh check-in" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <div className="text-[11.5px] text-center text-slate-500 mt-1 tabular-nums">Giờ vào {editModal.check_in ? String(editModal.check_in).slice(0,5) : ''}</div>
                      </a>
                    )}
                    {editModal.check_out_photo && (
                      <a href={editModal.check_out_photo} target="_blank" rel="noreferrer" className="flex-1">
                        <img src={editModal.check_out_photo} alt="Ảnh check-out" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <div className="text-[11.5px] text-center text-slate-500 mt-1 tabular-nums">Giờ ra {editModal.check_out ? String(editModal.check_out).slice(0,5) : ''}</div>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {editModal.id && (
                <div className="e-subtle p-3 text-[12.5px] text-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">Vị trí GPS:</span>
                    {editModal.location_status === 'in_office' ? (
                      <span className="e-badge e-badge-sm e-tone-success">Hợp lệ</span>
                    ) : editModal.location_status === 'outside' ? (
                      <span className="e-badge e-badge-sm e-tone-danger">Ngoài VP</span>
                    ) : (
                      <span className="text-slate-400">Không có dữ liệu</span>
                    )}
                  </div>
                  {editModal.latitude && editModal.longitude && (
                    <div className="flex justify-end mt-1">
                      <a href={`https://maps.google.com/?q=${editModal.latitude},${editModal.longitude}`} target="_blank" rel="noreferrer" className="e-btn e-btn-ghost e-btn-sm h-8">
                        Xem bản đồ
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold">IP Wi-Fi:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-slate-700">{editModal.ip_address || 'N/A'}</span>
                      {editModal.ip_address && !OFFICE_IPS.includes(editModal.ip_address) && (
                        <span className="e-badge e-badge-sm e-tone-danger">Sai mạng</span>
                      )}
                      {editModal.ip_address && OFFICE_IPS.includes(editModal.ip_address) && (
                        <span className="e-badge e-badge-sm e-tone-success">Hợp lệ</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditModal(null)}
                className="e-btn e-btn-secondary flex-1"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="e-btn e-btn-primary flex-1"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      ) : activeTab === 'leave' ? (
        <div className="xl:col-span-2"><LeaveManagementPage /></div>
      ) : activeTab === 'faceid' ? (
        <div className="xl:col-span-2"><FaceIdAdminPanel /></div>
      ) : (
        <div className="space-y-4 xl:col-span-2">
          {violations.length === 0 ? (
            <div className="e-card e-empty">
              <Check className="w-12 h-12 p-3 rounded-full bg-teal-50 text-teal-600 mb-3" />
              <p className="e-empty-title">Không có cảnh báo vi phạm nào trong tháng này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {violations.map(v => {
                const s = staff.find(x => x.id === v.staff_id);
                return (
                  <div key={v.id} className="e-card p-4 relative overflow-hidden">
                    <div className="hidden"></div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-teal-50 overflow-hidden grid place-items-center shrink-0">
                          {s?.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-teal-700">{s?.full_name?.charAt(0)}</span>}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-[14.5px]">{s?.full_name}</div>
                          <div className="text-[12px] text-slate-500 tabular-nums">{fmtDate(v.date)} · Lúc {v.check_in?.slice(0, 5)}</div>
                        </div>
                      </div>
                      <span className={`e-badge e-badge-sm ${STATUS_CONFIG[v.status]?.color}`}>
                        {STATUS_CONFIG[v.status]?.label}
                      </span>
                    </div>
                    <div className="space-y-2 text-[12.5px] text-slate-600 e-subtle p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">IP Wi-Fi:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">{v.ip_address || 'N/A'}</span>
                          {v.ip_address && !OFFICE_IPS.includes(v.ip_address) && (
                            <span className="e-badge e-badge-sm e-tone-danger">Sai mạng</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Vị trí GPS:</span>
                        {v.location_status === 'outside' ? (
                          <span className="e-badge e-badge-sm e-tone-danger">Ngoài văn phòng</span>
                        ) : (
                          <span className="e-badge e-badge-sm e-tone-success">Hợp lệ</span>
                        )}
                      </div>
                      {v.latitude && v.longitude && (
                        <div className="flex justify-end mt-1">
                          <a href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="text-teal-700 font-semibold hover:underline">Xem vị trí GPS</a>
                        </div>
                      )}
                    </div>
                    <button onClick={() => openEdit(v.staff_id, parseInt(v.date.split('-')[2]))} className="e-btn e-btn-secondary e-btn-sm w-full mt-3">
                      Xử lý vi phạm
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Cảnh báo vi phạm */}
      {showViolationsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[100] flex items-center justify-center p-4">
          <div className="e-modal max-w-5xl max-h-[90dvh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h3 className="e-modal-title flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-danger-500" />
                Danh sách vi phạm chấm công
              </h3>
              <button onClick={() => setShowViolationsModal(false)} className="e-icon-btn w-9 h-9">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 bg-slate-50/70 rounded-b-2xl">
              {violations.length === 0 ? (
                <div className="e-card e-empty">
                  <Check className="w-12 h-12 p-3 rounded-full bg-teal-50 text-teal-600 mb-3" />
                  <p className="e-empty-title">Không có cảnh báo vi phạm nào trong tháng này.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {violations.map(v => {
                    const s = staff.find(x => x.id === v.staff_id);
                    return (
                      <div key={v.id} className="e-card p-4 relative overflow-hidden flex flex-col">
                        <div className="hidden"></div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-teal-50 overflow-hidden grid place-items-center shrink-0">
                              {s?.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-teal-700">{s?.full_name?.charAt(0)}</span>}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-[14.5px]">{s?.full_name}</div>
                              <div className="text-[12px] text-slate-500 tabular-nums">{fmtDate(v.date)} · {v.check_in?.slice(0, 5)}</div>
                            </div>
                          </div>
                          <span className={`e-badge e-badge-sm ${STATUS_CONFIG[v.status]?.color}`}>
                            {STATUS_CONFIG[v.status]?.label}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-[12.5px] text-slate-600 e-subtle p-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">IP Wi-Fi:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-700">{v.ip_address || 'N/A'}</span>
                              {v.ip_address && !OFFICE_IPS.includes(v.ip_address) && (
                                <span className="e-badge e-badge-sm e-tone-danger">Sai mạng</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Vị trí GPS:</span>
                            {v.location_status === 'outside' ? (
                              <span className="e-badge e-badge-sm e-tone-danger">Ngoài văn phòng</span>
                            ) : v.location_status === 'unknown' ? (
                              <span className="e-badge e-badge-sm e-tone-warning">Chặn định vị</span>
                            ) : (
                              <span className="e-badge e-badge-sm e-tone-success">Hợp lệ</span>
                            )}
                          </div>
                          {v.latitude && v.longitude && (
                            <div className="flex justify-end mt-1">
                              <a href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="text-teal-700 font-semibold hover:underline">Xem vị trí GPS</a>
                            </div>
                          )}
                          {v.note && (
                            <div className="mt-2 text-slate-500 italic break-words">Ghi chú: {v.note}</div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button 
                            onClick={() => { setShowViolationsModal(false); openEdit(v.staff_id, parseInt(v.date.split('-')[2])); }} 
                            className="e-btn e-btn-secondary e-btn-sm"
                          >
                            Chi tiết
                          </button>
                          <button 
                            onClick={() => handleClearAnomaly(v)} 
                            disabled={saving}
                            className="e-btn e-btn-outline e-btn-sm"
                          >
                            Bỏ qua sai phạm
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagementPage;
