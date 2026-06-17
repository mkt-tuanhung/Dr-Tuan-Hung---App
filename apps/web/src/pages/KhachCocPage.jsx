import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Calendar, User, Phone, CheckCircle, Clock } from 'lucide-react';

const KhachCocPage = () => {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_appointments')
      .select('*, profiles!customer_appointments_created_by_fkey(full_name)')
      .eq('status', 'coc')
      .order('deposit_date', { ascending: false });

    if (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateToSurgery = async (id) => {
    // In a full implementation, you might want a modal to enter revenue details here too
    const { error } = await supabase.from('customer_appointments').update({ status: 'phau_thuat', surgery_date: new Date().toISOString().split('T')[0] }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Đã chuyển khách sang Phẫu Thuật'); loadData(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Khách Cọc</h2>
          <p className="text-slate-500 text-sm mt-1">Danh sách khách hàng đã cọc, chờ phẫu thuật</p>
        </div>
        <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl font-bold">
          {customers.length} Khách
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-yellow-200 border-t-yellow-500 rounded-full animate-spin" /></div>
      ) : customers.length === 0 ? (
         <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
            Không có khách cọc nào
         </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-6 py-3.5 font-medium">Khách hàng</th>
                <th className="px-6 py-3.5 font-medium">Số điện thoại</th>
                <th className="px-6 py-3.5 font-medium">Ngày cọc</th>
                <th className="px-6 py-3.5 font-medium">Tiền cọc</th>
                <th className="px-6 py-3.5 font-medium">Dịch vụ</th>
                <th className="px-6 py-3.5 font-medium">Ngày PT dự kiến</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers.map(app => (
                <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-700">{app.customer_name}</td>
                  <td className="px-6 py-4 text-slate-600">{app.phone}</td>
                  <td className="px-6 py-4 text-slate-600">{app.deposit_date ? new Date(app.deposit_date).toLocaleDateString('vi-VN') : ''}</td>
                  <td className="px-6 py-4 font-semibold text-yellow-600">{Number(app.deposit_amount).toLocaleString('vi-VN')} đ</td>
                  <td className="px-6 py-4 text-slate-600">{app.service}</td>
                  <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {app.expected_surgery_date ? new Date(app.expected_surgery_date).toLocaleDateString('vi-VN') : 'Chưa xếp'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default KhachCocPage;
