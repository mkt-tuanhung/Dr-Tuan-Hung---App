
import { useState, useEffect } from 'react';
import { parseISO, format } from 'date-fns';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const REPORTS_KEY = 'pageDailyReports';
const TARGETS_KEY = 'kpiTargets';
const COMMISSION_RATE = 20000; // 20k VND per phone

export const useKPIPersonal = () => {
  const initStorage = () => {
    if (!getStorageItem(REPORTS_KEY)) setStorageItem(REPORTS_KEY, []);
    if (!getStorageItem(TARGETS_KEY)) setStorageItem(TARGETS_KEY, []);
  };

  useEffect(() => {
    initStorage();
  }, []);

  const getDailyRecords = (employeeId, month, year) => {
    initStorage();
    const allRecords = getStorageItem(REPORTS_KEY, []);
    return allRecords.filter(r => {
      const d = parseISO(r.date);
      return r.employeeId === employeeId && (d.getMonth() + 1) === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getMonthlyStats = (employeeId, month, year) => {
    const records = getDailyRecords(employeeId, month, year);
    const targets = getStorageItem(TARGETS_KEY, []);
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
    const allRecords = getStorageItem(REPORTS_KEY, []);
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

    setStorageItem(REPORTS_KEY, allRecords);
  };

  const deleteDailyRecord = (recordId) => {
    initStorage();
    const allRecords = getStorageItem(REPORTS_KEY, []);
    const filtered = allRecords.filter(r => r.id !== recordId);
    setStorageItem(REPORTS_KEY, filtered);
  };

  return {
    getDailyRecords,
    getMonthlyStats,
    saveDailyRecord,
    deleteDailyRecord,
    COMMISSION_RATE
  };
};
