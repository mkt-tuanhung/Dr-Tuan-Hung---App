
import { useState, useEffect } from 'react';
import { parseISO } from 'date-fns';

const REPORTS_KEY = 'pageDailyReports';
const TARGETS_KEY = 'kpiTargets';
const USERS_KEY = 'clinic_users';
const COMMISSION_RATE = 20000;

export const useKPIAdmin = () => {
  const initStorage = () => {
    if (!localStorage.getItem(REPORTS_KEY)) localStorage.setItem(REPORTS_KEY, JSON.stringify([]));
    if (!localStorage.getItem(TARGETS_KEY)) localStorage.setItem(TARGETS_KEY, JSON.stringify([]));
  };

  useEffect(() => {
    initStorage();
  }, []);

  const getPageEmployees = () => {
    const allUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return allUsers.filter(u => u.role === 'Nhân viên' && u.departmentPosition === 'Trực page');
  };

  const getDailyRecords = (employeeId, month, year) => {
    initStorage();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    return allRecords.filter(r => {
      const d = parseISO(r.date);
      return r.employeeId === employeeId && (d.getMonth() + 1) === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const updateDailyRecord = (recordId, data) => {
    initStorage();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    const index = allRecords.findIndex(r => r.id === recordId);
    if (index !== -1) {
      allRecords[index] = { ...allRecords[index], ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(REPORTS_KEY, JSON.stringify(allRecords));
    }
  };

  const deleteDailyRecord = (recordId) => {
    initStorage();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    const filtered = allRecords.filter(r => r.id !== recordId);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(filtered));
  };

  const assignKPI = (employeeId, month, year, targetPhones, targetConversionRate, note) => {
    initStorage();
    const allTargets = JSON.parse(localStorage.getItem(TARGETS_KEY) || '[]');
    const index = allTargets.findIndex(t => t.employeeId === employeeId && t.month === month && t.year === year);
    
    const now = new Date().toISOString();
    
    if (index >= 0) {
      allTargets[index] = {
        ...allTargets[index],
        targetPhones: Number(targetPhones),
        targetConversionRate: Number(targetConversionRate),
        note,
        updatedAt: now
      };
    } else {
      allTargets.push({
        id: crypto.randomUUID(),
        employeeId,
        month,
        year,
        targetPhones: Number(targetPhones),
        targetConversionRate: Number(targetConversionRate),
        note,
        createdAt: now,
        updatedAt: now
      });
    }
    
    localStorage.setItem(TARGETS_KEY, JSON.stringify(allTargets));
  };

  const getEmployeeSummary = (month, year, employeeIdFilter = 'all') => {
    const employees = getPageEmployees();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    const allTargets = JSON.parse(localStorage.getItem(TARGETS_KEY) || '[]');

    const summaries = employees
      .filter(e => employeeIdFilter === 'all' || e.id === employeeIdFilter)
      .map(emp => {
        const empRecords = allRecords.filter(r => {
          const d = parseISO(r.date);
          return r.employeeId === emp.id && (d.getMonth() + 1) === month && d.getFullYear() === year;
        });

        const target = allTargets.find(t => t.employeeId === emp.id && t.month === month && t.year === year) || { targetPhones: 0, targetConversionRate: 0 };

        let totalMessages = 0;
        let totalPhones = 0;

        empRecords.forEach(r => {
          totalMessages += (Number(r.totalMessages) || 0);
          totalPhones += (Number(r.totalPhones) || 0);
        });

        const conversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
        const commissionAmount = totalPhones * COMMISSION_RATE;
        const kpiCompletion = target.targetPhones > 0 ? (totalPhones / target.targetPhones) * 100 : 0;

        return {
          employee: emp,
          totalMessages,
          totalPhones,
          conversionRate,
          commissionAmount,
          targetPhones: target.targetPhones,
          targetConversionRate: target.targetConversionRate,
          kpiCompletion
        };
      });

    return summaries;
  };

  const getOverallMonthlyStats = (month, year) => {
    const summaries = getEmployeeSummary(month, year);
    
    let totalEmployees = summaries.length;
    let totalMessages = 0;
    let totalPhones = 0;
    let totalCommission = 0;
    let totalTargetPhones = 0;

    summaries.forEach(s => {
      totalMessages += s.totalMessages;
      totalPhones += s.totalPhones;
      totalCommission += s.commissionAmount;
      totalTargetPhones += s.targetPhones;
    });

    const averageConversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
    const overallKpiCompletion = totalTargetPhones > 0 ? (totalPhones / totalTargetPhones) * 100 : 0;

    return {
      totalEmployees,
      totalMessages,
      totalPhones,
      totalCommission,
      totalTargetPhones,
      averageConversionRate,
      overallKpiCompletion
    };
  };

  return {
    getPageEmployees,
    getDailyRecords,
    updateDailyRecord,
    deleteDailyRecord,
    assignKPI,
    getEmployeeSummary,
    getOverallMonthlyStats,
    COMMISSION_RATE
  };
};
