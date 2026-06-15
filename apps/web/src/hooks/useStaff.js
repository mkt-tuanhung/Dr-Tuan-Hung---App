import { useState, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';
import { toast } from 'sonner';

export const useStaff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const records = await pb.collection('staff').getFullList({
        sort: '-created',
        $autoCancel: false
      });
      setStaff(records);
      return records;
    } catch (err) {
      setError(err.message);
      toast.error('Lỗi khi tải danh sách nhân sự: ' + err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const buildFormData = (data, isCreate = false) => {
    const formData = new FormData();
    
    if (data.username !== undefined) formData.append('username', data.username.trim());
    if (data.name !== undefined) formData.append('name', data.name.trim());
    if (data.position !== undefined) formData.append('position', data.position.trim());
    if (data.active !== undefined) formData.append('active', data.active);
    
    if (data.password) {
      formData.append('password', data.password);
      formData.append('passwordConfirm', data.password); // In case staff becomes an auth collection
    }

    if (Array.isArray(data.specialties)) {
      if (data.specialties.length === 0) {
        formData.append('specialties', ''); 
      } else {
        data.specialties.forEach(spec => formData.append('specialties', spec));
      }
    }

    if (data.avatarFile instanceof File) {
      formData.append('avatar', data.avatarFile);
    }

    if (data.basic_salary !== undefined && data.basic_salary !== '') {
      formData.append('basic_salary', Number(data.basic_salary) || 0);
    } else if (isCreate) {
      formData.append('basic_salary', 0);
    }
    
    if (data.allowances) {
      formData.append('allowances', JSON.stringify(data.allowances));
    }

    return formData;
  };

  const extractPocketBaseError = (err) => {
    if (err?.response?.data) {
      const details = Object.entries(err.response.data)
        .map(([key, value]) => `${key}: ${value.message}`)
        .join(', ');
      return details || err.message;
    }
    return err.message || 'Lỗi không xác định';
  };

  const createStaff = async (data) => {
    try {
      const formData = buildFormData(data, true);
      const record = await pb.collection('staff').create(formData, { $autoCancel: false });
      toast.success('Thêm nhân sự mới thành công');
      fetchStaff();
      return record;
    } catch (err) {
      console.error('Create staff error:', err);
      const errMsg = extractPocketBaseError(err);
      throw new Error(errMsg);
    }
  };

  const updateStaff = async (id, data) => {
    try {
      const formData = buildFormData(data, false);
      const record = await pb.collection('staff').update(id, formData, { $autoCancel: false });
      toast.success('Cập nhật hồ sơ nhân sự thành công');
      fetchStaff();
      return record;
    } catch (err) {
      console.error('Update staff error:', err);
      const errMsg = extractPocketBaseError(err);
      throw new Error(errMsg);
    }
  };

  const deleteStaff = async (id) => {
    try {
      await pb.collection('staff').delete(id, { $autoCancel: false });
      toast.success('Đã xóa nhân sự thành công');
      fetchStaff();
      return true;
    } catch (err) {
      console.error('Delete staff error:', err);
      toast.error('Lỗi khi xóa nhân sự: ' + err.message);
      throw err;
    }
  };

  const startTrialPeriod = async (staffId, basicSalary) => {
    try {
      const trialSalary = Number(basicSalary) * 0.85;
      const trialStartDate = new Date().toISOString();

      const record = await pb.collection('staff').update(staffId, {
        trial_status: 'on_trial',
        trial_salary: trialSalary,
        trial_start_date: trialStartDate
      }, { $autoCancel: false });

      toast.success('Bắt đầu thời gian thử việc thành công');
      fetchStaff();
      return record;
    } catch (err) {
      console.error('Start trial period error:', err);
      const errMsg = extractPocketBaseError(err);
      toast.error('Lỗi khi bắt đầu thử việc: ' + errMsg);
      throw new Error(errMsg);
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
    startTrialPeriod
  };
};