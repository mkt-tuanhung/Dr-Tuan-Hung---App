
import { useState, useCallback } from 'react';
import { 
  safeParse, 
  calculateMonthlyPayrollAllUsers, 
  saveOrUpdatePayroll
} from '@/utils/PayrollCalculationEngine.js';
import { normalize } from '@/utils/userMatchHelper.js';

export const usePayroll = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);

  const getPayrollByMonth = useCallback((month) => {
    const allPayrolls = safeParse('monthlyPayrolls');
    return allPayrolls.filter(p => p.month === month);
  }, []);

  const getPayrollByEmployeeAndMonth = useCallback((employeeId, month) => {
    const allPayrolls = safeParse('monthlyPayrolls');
    return allPayrolls.find(p => p.month === month && normalize(p.employeeId) === normalize(employeeId)) || null;
  }, []);

  const calculatePayrollForMonth = useCallback((month) => {
    setLoading(true);
    try {
      calculateMonthlyPayrollAllUsers(month);
      const updatedPayrolls = getPayrollByMonth(month);
      setPayrolls(updatedPayrolls);
      return updatedPayrolls;
    } catch (error) {
      console.error('Error calculating payrolls:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getPayrollByMonth]);

  const lockPayroll = useCallback((employeeId, month, lockedByUserId = null) => {
    const allPayrolls = safeParse('monthlyPayrolls');
    const index = allPayrolls.findIndex(p => p.month === month && normalize(p.employeeId) === normalize(employeeId));
    
    if (index >= 0) {
      allPayrolls[index].status = 'locked';
      allPayrolls[index].lockedAt = new Date().toISOString();
      allPayrolls[index].lockedBy = lockedByUserId;
      
      localStorage.setItem('monthlyPayrolls', JSON.stringify(allPayrolls));
      setPayrolls(allPayrolls.filter(p => p.month === month));
      
      return allPayrolls[index];
    }
    return null;
  }, []);

  const unlockPayroll = useCallback((employeeId, month) => {
    const allPayrolls = safeParse('monthlyPayrolls');
    const index = allPayrolls.findIndex(p => p.month === month && normalize(p.employeeId) === normalize(employeeId));
    
    if (index >= 0) {
      allPayrolls[index].status = 'draft';
      allPayrolls[index].lockedAt = null;
      allPayrolls[index].lockedBy = null;
      
      localStorage.setItem('monthlyPayrolls', JSON.stringify(allPayrolls));
      setPayrolls(allPayrolls.filter(p => p.month === month));
      
      return allPayrolls[index];
    }
    return null;
  }, []);

  const saveManualUpdate = useCallback((payrollData) => {
    saveOrUpdatePayroll(payrollData);
    setPayrolls(getPayrollByMonth(payrollData.month));
  }, [getPayrollByMonth]);

  return { 
    payrolls, 
    loading, 
    getPayrollByMonth,
    getPayrollByEmployeeAndMonth,
    calculatePayrollForMonth,
    lockPayroll,
    unlockPayroll,
    saveManualUpdate
  };
};
