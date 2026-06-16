import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const useExpenseStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    transactionCount: 0,
    byCategory: [],
    byStaff: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: allExpenses, error: err } = await supabase
        .from('expenses')
        .select('*')
        .is('deleted_at', null);
      if (err) throw err;

      const total = (allExpenses || []).reduce((sum, exp) => sum + Number(exp.amount), 0);

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const thisMonthExpenses = (allExpenses || []).filter(
        exp => exp.date >= firstDay && exp.date <= lastDay
      );
      const thisMonth = thisMonthExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      const categoryMap = {};
      (allExpenses || []).forEach(exp => {
        categoryMap[exp.category] = (categoryMap[exp.category] || 0) + Number(exp.amount);
      });
      const byCategory = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

      const staffMap = {};
      (allExpenses || []).forEach(exp => {
        if (exp.staff_id) {
          staffMap[exp.staff_id] = (staffMap[exp.staff_id] || 0) + Number(exp.amount);
        }
      });
      const byStaff = Object.entries(staffMap).map(([staffId, value]) => ({ staffId, value }));

      setStats({ total, thisMonth, transactionCount: (allExpenses || []).length, byCategory, byStaff });
    } catch (err) {
      setError(err.message);
      console.error('Error calculating stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateStats();
  }, []);

  return { stats, loading, error, refreshStats: calculateStats };
};
