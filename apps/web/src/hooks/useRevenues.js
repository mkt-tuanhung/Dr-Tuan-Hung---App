import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export const useRevenues = (filters = {}) => {
  const [revenues, setRevenues] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch staff
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, full_name, role, position')
        .eq('is_active', true);
      setStaff(staffData || []);

      // Build query
      let query = supabase
        .from('customer_appointments')
        .select('*, telesale:telesale_id(full_name), sale_offline:sale_offline_id(full_name)')
        .in('status', ['coc', 'phau_thuat'])
        .order('appointment_date', { ascending: false });

      if (filters.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }
      if (filters.dateRange?.start && filters.dateRange?.end) {
        query = query
          .gte('appointment_date', filters.dateRange.start)
          .lte('appointment_date', filters.dateRange.end);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setRevenues(data || []);
    } catch (err) {
      console.error(err);
      setError(err);
      toast.error('Không thể tải dữ liệu doanh thu.');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deleteRevenue = async (id) => {
    try {
      const { error: err } = await supabase
        .from('customer_appointments')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setRevenues(prev => prev.filter(r => r.id !== id));
      toast.success('Đã xóa bản ghi doanh thu.');
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Xóa thất bại.');
      return false;
    }
  };

  return { revenues, staff, loading, error, refetch: fetchData, deleteRevenue };
};
