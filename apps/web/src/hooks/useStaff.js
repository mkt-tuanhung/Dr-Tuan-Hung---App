import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export const useStaff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setStaff(data || []);
      return data || [];
    } catch (err) {
      setError(err.message);
      toast.error('Lỗi khi tải danh sách nhân sự: ' + err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Admin tạo nhân sự: tạo auth user + profile
  const createStaff = async (data) => {
    try {
      const email = `${data.employee_id.trim().toLowerCase()}@drtuanhung.internal`;

      // 1. Tạo tài khoản auth
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
      });
      if (authErr) throw authErr;

      // 2. Tạo profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          employee_id: data.employee_id.trim(),
          full_name: data.full_name.trim(),
          role: data.role,
          position: data.position,
          base_salary: Number(data.base_salary) || 0,
          allowance: Number(data.allowance) || 0,
          phone: data.phone,
          employment_status: data.is_probation ? 'probation' : 'official',
          probation_started_at: data.is_probation ? new Date().toISOString().split('T')[0] : null,
        })
        .select()
        .single();
      if (profileErr) throw profileErr;

      toast.success('Thêm nhân sự mới thành công');
      fetchStaff();
      return profileData;
    } catch (err) {
      console.error('Create staff error:', err);
      toast.error('Lỗi khi tạo nhân sự: ' + err.message);
      throw err;
    }
  };

  const updateStaff = async (id, data) => {
    try {
      const updates = {};
      if (data.full_name !== undefined) updates.full_name = data.full_name.trim();
      if (data.role !== undefined) updates.role = data.role;
      if (data.position !== undefined) updates.position = data.position;
      if (data.base_salary !== undefined) updates.base_salary = Number(data.base_salary) || 0;
      if (data.allowance !== undefined) updates.allowance = Number(data.allowance) || 0;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.is_active !== undefined) updates.is_active = data.is_active;

      const { data: updated, error: err } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;

      toast.success('Cập nhật hồ sơ nhân sự thành công');
      fetchStaff();
      return updated;
    } catch (err) {
      console.error('Update staff error:', err);
      toast.error('Lỗi khi cập nhật nhân sự: ' + err.message);
      throw err;
    }
  };

  // Soft delete — không xóa thật, chỉ đánh dấu inactive
  const deleteStaff = async (id) => {
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', id);
      if (err) throw err;
      toast.success('Đã xóa nhân sự thành công');
      fetchStaff();
      return true;
    } catch (err) {
      console.error('Delete staff error:', err);
      toast.error('Lỗi khi xóa nhân sự: ' + err.message);
      throw err;
    }
  };

  // Bắt đầu thử việc (85% lương)
  const startTrialPeriod = async (staffId, baseSalary) => {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .update({
          employment_status: 'probation',
          probation_started_at: new Date().toISOString().split('T')[0],
          base_salary: Math.round(Number(baseSalary) * 0.85),
        })
        .eq('id', staffId)
        .select()
        .single();
      if (err) throw err;
      toast.success('Bắt đầu thời gian thử việc thành công');
      fetchStaff();
      return data;
    } catch (err) {
      toast.error('Lỗi khi bắt đầu thử việc: ' + err.message);
      throw err;
    }
  };

  // Kết thúc thử việc → nhân sự chính thức (100% lương gốc)
  const endTrialPeriod = async (staffId, originalBaseSalary) => {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .update({
          employment_status: 'official',
          official_started_at: new Date().toISOString().split('T')[0],
          base_salary: Number(originalBaseSalary),
        })
        .eq('id', staffId)
        .select()
        .single();
      if (err) throw err;
      toast.success('Kết thúc thử việc — nhân sự đã chính thức');
      fetchStaff();
      return data;
    } catch (err) {
      toast.error('Lỗi khi kết thúc thử việc: ' + err.message);
      throw err;
    }
  };

  return {
    staff,
    loading,
    error,
    fetchStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    startTrialPeriod,
    endTrialPeriod,
  };
};
