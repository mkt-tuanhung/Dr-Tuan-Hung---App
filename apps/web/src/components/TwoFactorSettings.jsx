import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, Loader2, Copy } from 'lucide-react';

export default function TwoFactorSettings() {
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState(null);       // factor totp đã verified
  const [enrolling, setEnrolling] = useState(null); // { id, qr, secret } khi đang đăng ký
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find(f => f.status === 'verified');
    setFactor(verified || null);
    setLoading(false);
  };

  useEffect(() => { loadFactors(); }, []);

  const startEnroll = async () => {
    setBusy(true);
    try {
      // Dọn factor chưa verified còn sót (nếu có) để tránh lỗi trùng
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of (list?.totp || [])) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const confirmEnroll = async () => {
    if (!code.trim()) { toast.error('Nhập mã 6 số'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
      if (error) throw new Error('Mã không đúng, thử lại');
      toast.success('Đã bật xác thực 2 lớp (2FA)');
      setEnrolling(null);
      loadFactors();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const cancelEnroll = async () => {
    if (enrolling?.id) { try { await supabase.auth.mfa.unenroll({ factorId: enrolling.id }); } catch { /* ignore */ } }
    setEnrolling(null); setCode('');
  };

  const disable2fa = async () => {
    if (!factor) return;
    if (!window.confirm('Tắt xác thực 2 lớp? Tài khoản sẽ kém an toàn hơn.')) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      toast.success('Đã tắt 2FA');
      loadFactors();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;
  }

  // Đang đăng ký: hiện QR + nhập mã
  if (enrolling) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="font-bold text-slate-800">Quét mã QR</h3>
          <p className="text-sm text-slate-500 mt-0.5">Dùng Google Authenticator / Authy quét mã dưới đây</p>
        </div>
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <img src={enrolling.qr} alt="QR 2FA" className="w-44 h-44" />
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400">Hoặc nhập tay mã bí mật:</div>
            <div className="font-mono text-xs text-slate-700 break-all">{enrolling.secret}</div>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(enrolling.secret); toast.success('Đã copy'); }}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-slate-200"><Copy className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 block mb-1.5">Nhập mã 6 số để xác nhận</label>
          <input type="text" inputMode="numeric" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="w-full h-12 rounded-xl border border-emerald-100 bg-emerald-50/40 text-center text-2xl tracking-[0.4em] font-bold focus:outline-none focus:border-emerald-400" />
        </div>
        <div className="flex gap-2">
          <button onClick={cancelEnroll} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Hủy</button>
          <button onClick={confirmEnroll} disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? 'Đang xác nhận...' : 'Xác nhận bật 2FA'}
          </button>
        </div>
      </div>
    );
  }

  // Đã bật / chưa bật
  return (
    <div className="space-y-4">
      {factor ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-emerald-700">Đã bật xác thực 2 lớp</div>
            <div className="text-sm text-emerald-600/80 mt-0.5">Mỗi lần đăng nhập sẽ cần mã 6 số từ ứng dụng Authenticator.</div>
            <button onClick={disable2fa} disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600">
              <ShieldOff className="w-4 h-4" /> Tắt 2FA
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
            <ShieldOff className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-slate-700">Chưa bật 2FA</div>
            <div className="text-sm text-slate-500 mt-0.5">Tăng bảo mật: yêu cầu mã từ điện thoại khi đăng nhập, kể cả khi lộ mật khẩu.</div>
            <button onClick={startEnroll} disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Bật 2FA ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
