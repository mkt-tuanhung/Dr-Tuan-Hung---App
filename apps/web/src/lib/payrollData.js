import { supabase } from '@/lib/supabaseClient';
import { computePayrollRow } from '@/lib/kpiCalc';

// Tải dữ liệu nguồn + tính lương 1 nhân sự cho 1 tháng.
// Tháng đã CHỐT -> lấy số đã lưu (chính thức); chưa chốt -> tính LIVE.
// RLS tự giới hạn: nhân sự chỉ lấy được dữ liệu của chính mình; quản lý lấy được mọi người.
export async function loadPayrollDetail(staffId, month, year) {
  const tid = staffId;
  const ms = `${year}-${String(month).padStart(2, '0')}-01`;
  const meDay = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const meNext = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const orTele = `telesale_id.eq.${tid},telesale_id_2.eq.${tid}`;
  const orSale = `telesale_id.eq.${tid},telesale_id_2.eq.${tid},sale_id.eq.${tid}`;
  const orSurg = `${orSale},phu_mo_1_id.eq.${tid},phu_mo_2_id.eq.${tid},phu_mo_3_id.eq.${tid},truc_dem_id.eq.${tid},truc_dem_id_2.eq.${tid},hau_phau_id.eq.${tid}`;

  const [profRes, payRes, attRes, apptRes, surgRes, bongRes, cocRes, pageRes, advRes, salRes, winRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, employee_id, role, role_2, base_salary, allowance, employment_status, bank_name, bank_account').eq('id', tid).maybeSingle(),
    supabase.from('payroll').select('*').eq('staff_id', tid),
    supabase.from('attendance').select('staff_id, status, date, overtime_hours').eq('staff_id', tid).gte('date', ms).lte('date', meDay),
    supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, status, service').or(orSale).gte('appointment_date', ms).lte('appointment_date', meDay),
    supabase.from('customer_appointments').select('sale_id, telesale_id, telesale_id_2, revenue, upsale_revenue, customer_source, bong_date, deposit_date, surgery_type, phu_mo_1_id, phu_mo_2_id, phu_mo_3_id, truc_dem_id, truc_dem_id_2, hau_phau_id, additional_hau_phau_ids').eq('status', 'phau_thuat').or(orSurg).gte('surgery_date', ms).lte('surgery_date', meDay),
    supabase.from('customer_appointments').select('telesale_id, telesale_id_2, surgery_type').or(orTele).gte('bong_date', ms).lte('bong_date', meDay),
    supabase.from('customer_appointments').select('telesale_id, telesale_id_2, surgery_type').or(orTele).gte('deposit_date', ms).lte('deposit_date', meDay),
    supabase.from('page_daily_reports').select('staff_id, telesale_id, total_phones, total_interested_phones, total_messages, total_spam_messages').or(`staff_id.eq.${tid},telesale_id.eq.${tid}`).gte('date', ms).lte('date', meDay),
    supabase.from('expenses').select('staff_id, amount').eq('staff_id', tid).eq('is_advance', true).eq('status', 'approved'),
    supabase.from('salary_advances').select('staff_id, amount').eq('staff_id', tid).eq('status', 'approved').eq('month', month).eq('year', year),
    supabase.from('content_tasks').select('editor_id, win_amount').eq('editor_id', tid).eq('win', true).gte('evaluated_at', ms).lt('evaluated_at', meNext),
  ]);

  const profile = profRes.data;
  const savedRows = payRes.data || [];
  const savedThisMonth = savedRows.find(r => r.month === month && r.year === year);
  const live = profile ? computePayrollRow({
    staff: profile,
    att: attRes.data || [], appts: apptRes.data || [], surg: surgRes.data || [],
    bong: bongRes.data || [], coc: cocRes.data || [], pages: pageRes.data || [],
    adv: advRes.data || [], salAdv: salRes.data || [], contentWins: winRes.data || [],
    saved: savedThisMonth,
  }) : null;
  const detail = savedThisMonth?.status === 'locked'
    ? { ...savedThisMonth, status: 'locked' }
    : (live ? { ...live, status: 'draft' } : null);

  return { profile, savedRows, detail };
}
