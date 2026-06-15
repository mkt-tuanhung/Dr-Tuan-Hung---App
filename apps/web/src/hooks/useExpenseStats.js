
import { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

export const useExpenseStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    transactionCount: 0,
    byCategory: [],
    byStaff: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // PocketBase collection rules automatically filter for 'staff' role
      // Admins receive all, staff receive only their own expenses
      const allExpenses = await pb.collection('expenses').getFullList({ $autoCancel: false });
      
      const total = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const thisMonthExpenses = allExpenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= firstDayOfMonth && expDate <= lastDayOfMonth;
      });
      
      const thisMonth = thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      const categoryMap = {};
      allExpenses.forEach(exp => {
        if (!categoryMap[exp.category]) {
          categoryMap[exp.category] = 0;
        }
        categoryMap[exp.category] += exp.amount;
      });
      
      const byCategory = Object.entries(categoryMap).map(([name, value]) => ({
        name,
        value
      }));
      
      const staffMap = {};
      allExpenses.forEach(exp => {
        if (exp.staff_id) {
          if (!staffMap[exp.staff_id]) {
            staffMap[exp.staff_id] = 0;
          }
          staffMap[exp.staff_id] += exp.amount;
        }
      });
      
      const byStaff = Object.entries(staffMap).map(([staffId, value]) => ({
        staffId,
        value
      }));
      
      setStats({
        total,
        thisMonth,
        transactionCount: allExpenses.length,
        byCategory,
        byStaff
      });
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

  return {
    stats,
    loading,
    error,
    refreshStats: calculateStats
  };
};
