
import { useState, useEffect } from 'react';
import { parseISO, format } from 'date-fns';

const REPORTS_KEY = 'pageDailyReports';
const TARGETS_KEY = 'kpiTargets';
const COMMISSION_RATE = 20000; // 20k VND per phone

export const useKPIPersonal = () => {
  const initStorage = () => {
    if (!localStorage.getItem(REPORTS_KEY)) localStorage.setItem(REPORTS_KEY, JSON.stringify([]));
    if (!localStorage.getItem(TARGETS_KEY)) localStorage.setItem(TARGETS_KEY, JSON.stringify([]));
  };

  useEffect(() => {
    initStorage();
  }, []);

  const getDailyRecords = (employeeId, month, year) => {
    initStorage();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    return allRecords.filter(r => {
      const d = parseISO(r.date);
      return r.employeeId === employeeId && (d.getMonth() + 1) === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getMonthlyStats = (employeeId, month, year) => {
    const records = getDailyRecords(employeeId, month, year);
    const targets = JSON.parse(localStorage.getItem(TARGETS_KEY) || '[]');
    const target = targets.find(t => t.employeeId === employeeId && t.month === month && t.year === year) || { targetPhones: 0, targetConversionRate: 0 };

    let totalMessages = 0;
    let totalPhones = 0;

    records.forEach(r => {
      totalMessages += (Number(r.totalMessages) || 0);
      totalPhones += (Number(r.totalPhones) || 0);
    });

    const conversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
    const commissionAmount = totalPhones * COMMISSION_RATE;
    const kpiCompletion = target.targetPhones > 0 ? (totalPhones / target.targetPhones) * 100 : 0;

    return {
      totalMessages,
      totalPhones,
      conversionRate,
      commissionAmount,
      targetPhones: target.targetPhones,
      targetConversionRate: target.targetConversionRate,
      kpiCompletion
    };
  };

  const saveDailyRecord = (recordData) => {
    initStorage();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    const existingIndex = allRecords.findIndex(r => r.employeeId === recordData.employeeId && r.date === recordData.date);

    const now = new Date().toISOString();
    
    if (existingIndex >= 0) {
      allRecords[existingIndex] = {
        ...allRecords[existingIndex],
        ...recordData,
        updatedAt: now
      };
    } else {
      allRecords.push({
        id: crypto.randomUUID(),
        ...recordData,
        createdAt: now,
        updatedAt: now
      });
    }

    localStorage.setItem(REPORTS_KEY, JSON.stringify(allRecords));
  };

  const deleteDailyRecord = (recordId) => {
    initStorage();
    const allRecords = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    const filtered = allRecords.filter(r => r.id !== recordId);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(filtered));
  };

  return {
    getDailyRecords,
    getMonthlyStats,
    saveDailyRecord,
    deleteDailyRecord,
    COMMISSION_RATE
  };
};
