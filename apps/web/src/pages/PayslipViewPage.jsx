import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { decryptPayslip } from '@/lib/payslipCrypto';

// Trang công khai: quét QR -> nhập mã bảo mật -> giải mã chi tiết lương.
// Dữ liệu lương đã mã hoá nằm trong phần hash của URL (#...), không gửi lên server.
const PayslipViewPage = () => {
  const [payload, setPayload] = useState('');
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const h = (window.location.hash || '').replace(/^#/, '');
    setPayload(h);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const obj = await decryptPayslip(payload, code.trim());
      setData(obj);
    } catch {
      setError('Sai mã bảo mật hoặc mã QR không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Không tìm thấy dữ liệu phiếu lương. Vui lòng quét lại mã QR trên phiếu lương.</p>
        </div>
      </div>
    );
  }

  if (data) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold">PHIẾU LƯƠNG</h1>
                <p className="text-emerald-100 text-sm">Tháng {data.m}</p>
              </div>
              <ShieldCheck className="w-6 h-6 text-emerald-100" />
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <div className="font-bold text-slate-800">{data.n}</div>
              <div className="text-sm text-slate-500">{data.r}</div>
              {data.bank && <div className="text-sm text-slate-400 mt-0.5">{data.bank}</div>}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {(data.items || []).map(([label, val], i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-500">{label}</td>
                    <td className="py-2 text-right font-medium text-slate-700 tabular-nums">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
              <span className="font-bold text-slate-700">THỰC NHẬN</span>
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{data.net}</span>
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">Nội dung được mã hoá đầu cuối · PK Dr Tuấn Hùng</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-800 text-center">Phiếu lương bảo mật</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-5">Nhập mã bảo mật để xem chi tiết lương của bạn.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Mã bảo mật"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 outline-none text-center tracking-widest text-lg"
        />
        {error && <p className="text-sm text-rose-500 text-center mt-3 flex items-center justify-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xem phiếu lương'}
        </button>
      </form>
    </div>
  );
};

export default PayslipViewPage;
