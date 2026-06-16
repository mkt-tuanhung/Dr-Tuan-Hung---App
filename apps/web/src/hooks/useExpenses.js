import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const useExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { profile } = useAuth();

  const fetchExpenses = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('expenses')
        .select('*, staff:staff_id(full_name)')
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (filters.category) query = query.eq('category', filters.category);
      if (filters.staffId) query = query.eq('staff_id', filters.staffId);
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);

      const { data, error: err } = await query;
      if (err) throw err;
      setExpenses(data || []);
      return data || [];
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

      // Upload ảnh lên Supabase Storage nếu có
      let proofImageUrls = [];
      if (data.proof_images?.length > 0) {
        for (const file of data.proof_images) {
          const path = `expenses/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('attachments')
            .upload(path, file);
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
          proofImageUrls.push(urlData.publicUrl);
        }
      }

      const { data: record, error: err } = await supabase
        .from('expenses')
        .insert({
          date: data.date,
          amount: Number(data.amount),
          category: data.category,
          description: data.description || '',
          staff_id: data.staff_id || profile?.id,
          is_advance: data.is_advance || false,
          proof_image_urls: proofImageUrls,
          notes: data.notes || '',
        })
        .select()
        .single();
      if (err) throw err;

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
      const updates = {
        date: data.date,
        amount: Number(data.amount),
        category: data.category,
        description: data.description || '',
        staff_id: data.staff_id,
        notes: data.notes || '',
      };

      const { data: record, error: err } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;

      await fetchExpenses();
      return record;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Soft delete
  const deleteExpense = async (id) => {
    try {
      setError(null);
      const { error: err } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      await fetchExpenses();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getExpenseById = async (id) => {
    try {
      const { data, error: err } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();
      if (err) throw err;
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return { expenses, loading, error, fetchExpenses, createExpense, updateExpense, deleteExpense, getExpenseById };
};
