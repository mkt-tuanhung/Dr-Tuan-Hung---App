
import { useState, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';

export const useKPI = () => {
  const [kpiData, setKpiData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAndCalculateKPI = useCallback(async (month, year) => {
    try {
      setLoading(true);
      const staffList = await pb.collection('staff').getFullList({ filter: 'active = true', $autoCancel: false });
      
      const startDate = new Date(year, month - 1, 1).toISOString().replace('T', ' ');
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString().replace('T', ' ');
      
      // Get revenues to calculate actual KPI
      const revenues = await pb.collection('revenues').getFullList({
        filter: `date >= "${startDate}" && date <= "${endDate}"`,
        $autoCancel: false
      });

      // Get existing KPI targets
      const existingKPIs = await pb.collection('kpi').getFullList({
        filter: `month = ${month} && year = ${year}`,
        $autoCancel: false
      });

      const processedData = staffList.map(staff => {
        const staffRevs = revenues.filter(r => r.sale_staff === staff.id || r.telesale_staff === staff.id);
        const actualKpi = staffRevs.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
        
        const existingRecord = existingKPIs.find(k => k.staff_id === staff.id);
        const targetKpi = existingRecord ? existingRecord.target_kpi : 0;
        
        const completion = targetKpi > 0 ? (actualKpi / targetKpi) * 100 : 0;

        return {
          id: existingRecord?.id || null,
          staff_id: staff.id,
          staff_name: staff.name,
          specialties: staff.specialties || [],
          month,
          year,
          target_kpi: targetKpi,
          actual_kpi: actualKpi,
          completion_percentage: Number(completion.toFixed(2)),
          status: completion >= 100 ? 'achieved' : 'not_achieved'
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
    const data = { staff_id: staffId, month, year, target_kpi: target };
    if (recordId) {
      return await pb.collection('kpi').update(recordId, data, { $autoCancel: false });
    } else {
      return await pb.collection('kpi').create(data, { $autoCancel: false });
    }
  };

  return { kpiData, loading, fetchAndCalculateKPI, updateTargetKPI };
};
