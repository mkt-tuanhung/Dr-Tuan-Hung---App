
import { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const useExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  const fetchExpenses = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      let filterString = '';
      const filterParts = [];
      
      if (filters.category) {
        filterParts.push(`category = "${filters.category}"`);
      }
      
      if (filters.staffId) {
        filterParts.push(`staff_id = "${filters.staffId}"`);
      }
      
      if (filters.startDate && filters.endDate) {
        filterParts.push(`date >= "${filters.startDate}" && date <= "${filters.endDate}"`);
      }
      
      if (filterParts.length > 0) {
        filterString = filterParts.join(' && ');
      }
      
      const records = await pb.collection('expenses').getFullList({
        sort: '-date',
        filter: filterString,
        $autoCancel: false
      });
      
      setExpenses(records);
      return records;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching expenses:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createExpense = async (data) => {
    try {
      setError(null);
      const formData = new FormData();
      
      formData.append('date', data.date);
      formData.append('amount', data.amount);
      formData.append('category', data.category);
      formData.append('description', data.description || '');
      formData.append('staff_id', data.staff_id || '');
      
      // Auto assign current user as creator
      formData.append('created_by', currentUser?.id || '');
      
      if (data.invoice_document) {
        formData.append('invoice_document', data.invoice_document);
      }
      
      if (data.proof_images && data.proof_images.length > 0) {
        for (let i = 0; i < data.proof_images.length; i++) {
          formData.append('proof_images', data.proof_images[i]);
        }
      }
      
      const record = await pb.collection('expenses').create(formData, { $autoCancel: false });
      await fetchExpenses();
      return record;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateExpense = async (id, data) => {
    try {
      setError(null);
      const formData = new FormData();
      
      formData.append('date', data.date);
      formData.append('amount', data.amount);
      formData.append('category', data.category);
      formData.append('description', data.description || '');
      formData.append('staff_id', data.staff_id || '');
      
      if (data.invoice_document) {
        formData.append('invoice_document', data.invoice_document);
      }
      
      if (data.proof_images && data.proof_images.length > 0) {
        for (let i = 0; i < data.proof_images.length; i++) {
          formData.append('proof_images', data.proof_images[i]);
        }
      }
      
      const record = await pb.collection('expenses').update(id, formData, { $autoCancel: false });
      await fetchExpenses();
      return record;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteExpense = async (id) => {
    try {
      setError(null);
      await pb.collection('expenses').delete(id, { $autoCancel: false });
      await fetchExpenses();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getExpenseById = async (id) => {
    try {
      setError(null);
      const record = await pb.collection('expenses').getOne(id, { $autoCancel: false });
      return record;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseById
  };
};
