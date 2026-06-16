import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const useKPI = () => {
  const [kpiData, setKpiData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAndCalculateKPI = useCallback(async (month, year) => {
    try {
      setLoading(true);

      // Lấy danh sách nhân sự active
      const { data: staffList } = await supabase
        .from('profiles')
        .select('id, full_name, role, position')
        .eq('is_active', true);

      // Lấy doanh thu trong tháng
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const { data: appointments } = await supabase
        .from('customer_appointments')
        .select('telesale_id, sale_offline_id, revenue, upsale_revenue, status')
        .in('status', ['coc', 'phau_thuat'])
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate);

      // Lấy KPI targets đã set
      const { data: existingKPIs } = await supabase
        .from('kpi_targets')
        .select('*')
        .eq('month', month)
        .eq('year', year);

      const processedData = (staffList || []).map(s => {
        const staffRevs = (appointments || []).filter(
          r => r.telesale_id === s.id || r.sale_offline_id === s.id
        );
        const actualKpi = staffRevs.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);

        const existingRecord = (existingKPIs || []).find(k => k.staff_id === s.id);
        const targetKpi = existingRecord?.target_revenue || 0;
        const completion = targetKpi > 0 ? (actualKpi / targetKpi) * 100 : 0;

        return {
          id: existingRecord?.id || null,
          staff_id: s.id,
          staff_name: s.full_name,
          role: s.role,
          position: s.position,
          month,
          year,
          target_kpi: targetKpi,
          actual_kpi: actualKpi,
          completion_percentage: Number(completion.toFixed(2)),
          status: completion >= 100 ? 'achieved' : 'not_achieved',
        };
      });

      setKpiData(processedData);
      return processedData;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTargetKPI = async (staffId, month, year, target, recordId) => {
    if (recordId) {
      const { data, error } = await supabase
        .from('kpi_targets')
        .update({ target_revenue: target })
        .eq('id', recordId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('kpi_targets')
        .insert({ staff_id: staffId, month, year, target_revenue: target })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  };

  return { kpiData, loading, fetchAndCalculateKPI, updateTargetKPI };
};
