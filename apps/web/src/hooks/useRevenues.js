
import { useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';
import { toast } from 'sonner';

export const useRevenues = (filters = {}) => {
  const [revenues, setRevenues] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch staff first for mapping
      const staffRecords = await pb.collection('staff').getFullList({ $autoCancel: false });
      setStaff(staffRecords);

      // Build filter string
      let filterStr = [];
      if (filters.search) {
        filterStr.push(`(customer_name ~ "${filters.search}" || phone ~ "${filters.search}")`);
      }
      if (filters.service_group && filters.service_group !== 'ALL') {
        filterStr.push(`service_group = "${filters.service_group}"`);
      }
      if (filters.customer_source && filters.customer_source !== 'ALL') {
        filterStr.push(`customer_source = "${filters.customer_source}"`);
      }
      if (filters.dateRange?.start && filters.dateRange?.end) {
        // Adjust end date to include the full day
        const end = new Date(filters.dateRange.end);
        end.setDate(end.getDate() + 1);
        filterStr.push(`date >= "${filters.dateRange.start}" && date < "${end.toISOString().split('T')[0]}"`);
      }

      const records = await pb.collection('revenues').getFullList({
        filter: filterStr.join(' && '),
        sort: '-date',
        $autoCancel: false
      });
      
      setRevenues(records);
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
      await pb.collection('revenues').delete(id, { $autoCancel: false });
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
