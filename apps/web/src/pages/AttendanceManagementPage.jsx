import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { CalendarCheck, ChevronLeft, ChevronRight, Search, Check, X, Clock, Users, AlertTriangle, Download, ScanFace, ImageDown } from 'lucide-react';
import LeaveManagementPage from './LeaveManagementPage.jsx';
import FaceIdAdminPanel from '@/features/faceid/FaceIdAdminPanel.jsx';

const STATUS_CONFIG = {
  present:  { label: 'Có mặt',    color: 'bg-teal-100 text-teal-700' },
  late:     { label: 'Đi trễ',    color: 'bg-yellow-100 text-yellow-700' },
  absent:   { label: 'Vắng mặt', color: 'bg-red-100 text-red-700' },
  half_day: { label: 'Nửa ngày', color: 'bg-blue-100 text-blue-700' },
  leave:    { label: 'Nghỉ phép', color: 'bg-purple-100 text-purple-700' },
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
      present: ['Có mặt', '#0d9488', '#ccfbf1'], late: ['Đi trễ', '#b45309', '#fef3c7'],
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
        <td style="text-align:center;color:#0d9488;font-weight:700">${ot}</td>
        <td style="text-align:center;color:#b45309;font-weight:700">${le}</td>
        <td style="color:#475569;font-size:11px">${note}</td>
      </tr>`;
    }
    const chip = (label, val, color) => `<div style="flex:1;min-width:90px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px"><div style="font-size:11px;color:#94a3b8">${label}</div><div style="font-size:20px;font-weight:800;color:${color}">${val}</div></div>`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bảng công ${s.full_name} - ${MONTHS[month - 1]} ${year}</title>
      <style>
        *{box-sizing:border-box} body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:28px;color:#0f172a;background:#fff}
        .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #0d9488;padding-bottom:14px;margin-bottom:16px}
        h1{font-size:20px;margin:0} .sub{color:#64748b;font-size:13px;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #e2e8f0;padding:6px 8px}
        thead th{background:#0d9488;color:#fff;font-weight:700;font-size:11px}
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
        ${chip('Tổng công', cnt.cong, '#0d9488')}
        ${chip('Đi trễ', cnt.late, '#b45309')}
        ${chip('Về sớm', cnt.early_leave, '#c2410c')}
        ${chip('Nửa ngày', cnt.half_day, '#1d4ed8')}
        ${chip('Nghỉ phép', cnt.leave, '#7c3aed')}
        ${chip('Vắng', cnt.absent, '#dc2626')}
        ${chip('Đi muộn/về sớm', cnt.le + 'h', '#b45309')}
        ${chip('Tăng ca thực (đã trừ)', Math.max(0, cnt.ot - cnt.le) + 'h', '#0d9488')}
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
        a.date === today.toISOString().split('T')[0];
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
        const { error } = await supabase.from('attendance').insert(inserts);
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
        const { error } = await supabase.from('attendance').insert(data);
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
    <div className="space-y-5">
      {/* Header & Tabs */}
      {!isNested && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Chấm công & Nghỉ phép</h2>
              {activeTab === 'attendance' && <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month-1]} {year}</p>}
            </div>
            {activeTab === 'attendance' && (
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
                <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'attendance' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Bảng chấm công
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'leave' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Duyệt đơn xin phép
            </button>
            <button
              onClick={() => setActiveTab('warnings')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'warnings' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Cảnh báo
              {violations.length > 0 && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">{violations.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('faceid')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'faceid' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <ScanFace className="w-4 h-4" /> Face ID
            </button>
          </div>
        </div>
      )}

      {/* When Nested, we still need the month selector for attendance tab */}
      {isNested && activeTab === 'attendance' && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-600 font-medium">Bảng theo dõi chấm công hàng ngày</p>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'attendance' ? (
        <>
          {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-0.5">Tổng nhân sự</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.present}</div>
          <div className="text-xs text-slate-400 mt-0.5">Có mặt hôm nay</div>
        </div>
      </div>

      {/* Search & Bulk Toggle */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-teal-100 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
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
          className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-bold transition-all border ${isMultiSelect ? 'bg-teal-600 text-white border-teal-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          {isMultiSelect ? 'Hủy chọn nhiều' : 'Tích chọn nhiều ô'}
        </button>
        <button
          onClick={exportViolationsImage}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-bold transition-all border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-2 justify-center disabled:opacity-50"
        >
          <ImageDown className="w-4 h-4" /> Xuất lỗi tháng
        </button>
        {isNested && (
          <button 
            onClick={() => setShowViolationsModal(true)} 
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-bold transition-all border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2 justify-center"
          >
            <AlertTriangle className="w-4 h-4" /> 
            Cảnh báo vi phạm {violations.length > 0 && `(${violations.length})`}
          </button>
        )}
      </div>

      {/* Desktop table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="hidden lg:block bg-white border border-teal-100 rounded-2xl overflow-auto shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-teal-50/50 text-slate-500 border-b border-teal-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium sticky left-0 bg-teal-50/50 min-w-[160px]">Nhân sự</th>
                  {days.map(d => {
                    const date = new Date(year, month-1, d);
                    const isToday = date.toDateString() === today.toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={d} className={`px-2 py-3 font-medium text-center min-w-[36px] ${isToday ? 'text-teal-600' : ''} ${isWeekend ? 'text-slate-300' : ''}`}>
                        <div>{d}</div>
                        <div className="text-[9px] font-normal">{DAYS[date.getDay()]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-teal-50/30 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-teal-500">{s.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-700 text-xs truncate">{s.full_name}</div>
                          <div className="text-[10px] text-slate-400">{s.employee_id}</div>
                        </div>
                        <button onClick={() => openTimesheet(s)} title="Xuất bảng công cá nhân" className="ml-auto shrink-0 w-7 h-7 rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50 flex items-center justify-center"><Download className="w-3.5 h-3.5" /></button>
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
                        <td key={d} className={`px-1 py-2 text-center relative ${isWeekend ? 'bg-slate-50/50' : ''} ${isToday ? 'bg-teal-50/40' : ''} ${isSelected ? 'ring-2 ring-inset ring-teal-500 bg-teal-100/50' : ''}`}>
                          <button
                            onClick={() => handleCellClick(s.id, d)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all hover:scale-110 relative"
                            title={record ? STATUS_CONFIG[record.status]?.label : 'Chưa chấm'}
                          >
                            {record ? (
                              <>
                                {record.status === 'present' ? <Check className="w-3.5 h-3.5 text-teal-500" /> :
                                record.status === 'absent' ? <X className="w-3.5 h-3.5 text-red-400" /> :
                                record.status === 'late' ? <Clock className="w-3.5 h-3.5 text-yellow-500" /> :
                                <span className="text-[9px] font-bold text-purple-500">{record.status === 'leave' ? 'NP' : 'ND'}</span>}
                                {(record.location_status === 'outside' || record.location_status === 'unknown' || (record.ip_address && !OFFICE_IPS.includes(record.ip_address))) && (
                                  <span className="absolute top-0 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" title="Chấm công sai vị trí hoặc sai mạng"></span>
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

          {/* Mobile card list */}
          <div className="lg:hidden space-y-3">
            {filtered.map(s => {
              const todayStr = today.toISOString().split('T')[0];
              const todayRecord = attendance.find(a => a.staff_id === s.id && a.date === todayStr);
              const monthCount = attendance.filter(a => a.staff_id === s.id && a.status === 'present').length;
              return (
                <div key={s.id} className="bg-white border border-teal-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-teal-50 border border-teal-100 flex items-center justify-center">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-teal-500">{s.full_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{s.full_name}</div>
                        <div className="text-xs text-slate-400">{s.employee_id}</div>
                      </div>
                    </div>
                    {todayRecord ? (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_CONFIG[todayRecord.status]?.color}`}>
                        {STATUS_CONFIG[todayRecord.status]?.label}
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-400">Chưa chấm</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Có mặt tháng này: <span className="font-semibold text-slate-700">{monthCount} ngày</span></span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openTimesheet(s)} className="text-xs text-teal-600 font-medium hover:text-teal-700 inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />Bảng công</button>
                      <button onClick={() => openEdit(s.id, today.getDate())} className="text-xs text-teal-600 font-medium hover:text-teal-700">Chấm hôm nay →</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Floating Action Bar for Multi-Select */}
      {isMultiSelect && selectedCells.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-wrap items-center gap-6 z-[60] animate-in slide-in-from-bottom-8">
          <div className="font-semibold text-sm">Đã chọn {selectedCells.size} ô</div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
            <button disabled={saving} onClick={() => handleBulkAction('present')} className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-bold transition-colors">Có mặt</button>
            <button disabled={saving} onClick={() => handleBulkAction('half_day')} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-sm font-bold transition-colors">Nửa ngày</button>
            <button disabled={saving} onClick={() => handleBulkAction('late')} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white rounded-xl text-sm font-bold transition-colors">Đi trễ</button>
            <button disabled={saving} onClick={() => handleBulkAction('absent')} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl text-sm font-bold transition-colors">Vắng mặt</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full font-medium ${v.color}`}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {/* Modal xem/xuất Bảng công cá nhân */}
      {timesheet && (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-3 sm:p-6" onClick={() => setTimesheet(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800">Bảng chấm công cá nhân</h3>
              <div className="flex items-center gap-2">
                <button onClick={printTimesheet} className="px-4 h-9 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 inline-flex items-center gap-1.5"><Download className="w-4 h-4" />In / Lưu PDF</button>
                <button onClick={() => setTimesheet(null)} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 flex items-center justify-center"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <iframe ref={tsRef} title="timesheet" srcDoc={timesheet.html} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-bold text-slate-800 text-lg mb-1">Chấm công</h3>
            <p className="text-sm text-slate-400 mb-5">{editModal.staffName} · {fmtDate(editModal.date)}</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Trạng thái</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setEditModal(m => ({ ...m, status: k }))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                        editModal.status === k
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-slate-100 text-slate-500 hover:border-teal-200'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Giờ vào</label>
                  <input
                    type="time"
                    value={editModal.check_in}
                    onChange={e => setEditModal(m => ({ ...m, check_in: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-teal-100 bg-teal-50/30 text-sm text-slate-700 focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Giờ ra</label>
                  <input
                    type="time"
                    value={editModal.check_out}
                    onChange={e => setEditModal(m => ({ ...m, check_out: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-teal-100 bg-teal-50/30 text-sm text-slate-700 focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Tăng ca (giờ)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={editModal.overtime_hours}
                    onChange={e => setEditModal(m => ({ ...m, overtime_hours: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-teal-100 bg-teal-50/30 text-sm text-slate-700 focus:outline-none focus:border-teal-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Đi muộn / về sớm (giờ)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={editModal.late_early_hours}
                    onChange={e => setEditModal(m => ({ ...m, late_early_hours: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-100 bg-amber-50/40 text-sm text-slate-700 focus:outline-none focus:border-amber-400"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-1">Giờ đi muộn/về sớm sẽ tự trừ vào tổng giờ tăng ca khi tính lương.</p>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Ghi chú</label>
                <textarea
                  value={editModal.note}
                  onChange={e => setEditModal(m => ({ ...m, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-teal-100 bg-teal-50/30 text-sm text-slate-700 focus:outline-none focus:border-teal-400 resize-none"
                  placeholder="Ghi chú thêm..."
                />
              </div>

              {editModal.id && (editModal.check_in_photo || editModal.check_out_photo) && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                  <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                    Ảnh chấm công (Face AI)
                    {(editModal.check_in_method === 'face_ai' || editModal.check_out_method === 'face_ai') && (
                      <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold">Face AI</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {editModal.check_in_photo && (
                      <a href={editModal.check_in_photo} target="_blank" rel="noreferrer" className="flex-1">
                        <img src={editModal.check_in_photo} alt="Ảnh check-in" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <div className="text-[10px] text-center text-slate-500 mt-1">Giờ vào {editModal.check_in ? String(editModal.check_in).slice(0,5) : ''}</div>
                      </a>
                    )}
                    {editModal.check_out_photo && (
                      <a href={editModal.check_out_photo} target="_blank" rel="noreferrer" className="flex-1">
                        <img src={editModal.check_out_photo} alt="Ảnh check-out" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <div className="text-[10px] text-center text-slate-500 mt-1">Giờ ra {editModal.check_out ? String(editModal.check_out).slice(0,5) : ''}</div>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {editModal.id && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">Vị trí GPS:</span>
                    {editModal.location_status === 'in_office' ? (
                      <span className="text-teal-700 font-bold bg-teal-100 px-2 py-0.5 rounded border border-teal-200">Hợp lệ</span>
                    ) : editModal.location_status === 'outside' ? (
                      <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-200">Ngoài VP</span>
                    ) : (
                      <span className="text-slate-400">Không có dữ liệu</span>
                    )}
                  </div>
                  {editModal.latitude && editModal.longitude && (
                    <div className="flex justify-end mt-1">
                      <a href={`https://maps.google.com/?q=${editModal.latitude},${editModal.longitude}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                        Xem bản đồ
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold">IP Wi-Fi:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-slate-700">{editModal.ip_address || 'N/A'}</span>
                      {editModal.ip_address && !OFFICE_IPS.includes(editModal.ip_address) && (
                        <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded text-[10px] border border-red-200">Sai mạng</span>
                      )}
                      {editModal.ip_address && OFFICE_IPS.includes(editModal.ip_address) && (
                        <span className="text-teal-700 font-bold bg-teal-100 px-2 py-0.5 rounded text-[10px] border border-teal-200">Hợp lệ</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      ) : activeTab === 'leave' ? (
        <LeaveManagementPage />
      ) : activeTab === 'faceid' ? (
        <FaceIdAdminPanel />
      ) : (
        <div className="space-y-4">
          {violations.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
              <Check className="w-12 h-12 text-teal-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Không có cảnh báo vi phạm nào trong tháng này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {violations.map(v => {
                const s = staff.find(x => x.id === v.staff_id);
                return (
                  <div key={v.id} className="bg-white border border-red-100 p-4 rounded-2xl shadow-sm hover:shadow transition-all relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          {s?.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-slate-400">{s?.full_name?.charAt(0)}</span>}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{s?.full_name}</div>
                          <div className="text-xs text-slate-500">{fmtDate(v.date)} · Lúc {v.check_in?.slice(0, 5)}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_CONFIG[v.status]?.color}`}>
                        {STATUS_CONFIG[v.status]?.label}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600 bg-red-50/50 p-3 rounded-xl border border-red-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">IP Wi-Fi:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">{v.ip_address || 'N/A'}</span>
                          {v.ip_address && !OFFICE_IPS.includes(v.ip_address) && (
                            <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded text-[10px] border border-red-200">Sai mạng</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Vị trí GPS:</span>
                        {v.location_status === 'outside' ? (
                          <span className="text-red-700 font-medium">Ngoài văn phòng</span>
                        ) : (
                          <span className="text-teal-700 font-medium">Hợp lệ</span>
                        )}
                      </div>
                      {v.latitude && v.longitude && (
                        <div className="flex justify-end mt-1">
                          <a href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Xem vị trí GPS</a>
                        </div>
                      )}
                    </div>
                    <button onClick={() => openEdit(v.staff_id, parseInt(v.date.split('-')[2]))} className="w-full mt-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
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
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                Danh sách vi phạm chấm công
              </h3>
              <button onClick={() => setShowViolationsModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {violations.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <Check className="w-12 h-12 text-teal-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Không có cảnh báo vi phạm nào trong tháng này.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {violations.map(v => {
                    const s = staff.find(x => x.id === v.staff_id);
                    return (
                      <div key={v.id} className="bg-white border border-red-100 p-4 rounded-2xl shadow-sm hover:shadow transition-all relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                              {s?.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-slate-400">{s?.full_name?.charAt(0)}</span>}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{s?.full_name}</div>
                              <div className="text-xs text-slate-500">{fmtDate(v.date)} · {v.check_in?.slice(0, 5)}</div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_CONFIG[v.status]?.color}`}>
                            {STATUS_CONFIG[v.status]?.label}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-xs text-slate-600 bg-red-50/50 p-3 rounded-xl border border-red-100 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">IP Wi-Fi:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-700">{v.ip_address || 'N/A'}</span>
                              {v.ip_address && !OFFICE_IPS.includes(v.ip_address) && (
                                <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded text-[10px] border border-red-200">Sai mạng</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Vị trí GPS:</span>
                            {v.location_status === 'outside' ? (
                              <span className="text-red-700 font-medium">Ngoài văn phòng</span>
                            ) : v.location_status === 'unknown' ? (
                              <span className="text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded border border-orange-100 text-[10px]">Chặn định vị</span>
                            ) : (
                              <span className="text-teal-700 font-medium">Hợp lệ</span>
                            )}
                          </div>
                          {v.latitude && v.longitude && (
                            <div className="flex justify-end mt-1">
                              <a href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Xem vị trí GPS</a>
                            </div>
                          )}
                          {v.note && (
                            <div className="mt-2 text-slate-500 italic break-words">Ghi chú: {v.note}</div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button 
                            onClick={() => { setShowViolationsModal(false); openEdit(v.staff_id, parseInt(v.date.split('-')[2])); }} 
                            className="py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Chi tiết
                          </button>
                          <button 
                            onClick={() => handleClearAnomaly(v)} 
                            disabled={saving}
                            className="py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-sm font-bold text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50"
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
