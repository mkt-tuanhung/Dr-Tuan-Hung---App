import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, AlertCircle, Loader2, Clock, Ban } from 'lucide-react';
import { decryptPayslip } from '@/lib/payslipCrypto';
import { supabase } from '@/lib/supabaseClient';
import { getDeviceId, getDeviceLabel } from '@/lib/device';

// Trang công khai: quét QR -> nhập mã bảo mật -> gửi yêu cầu -> chờ Admin duyệt -> xem lương.
// QR mới chỉ chứa 1 id ngắn; blob mã hoá được tải từ máy chủ rồi giải mã tại chỗ.
// (Tương thích ngược: QR cũ chứa trực tiếp blob trong hash URL.)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PayslipViewPage = () => {
  const [payload, setPayload] = useState('');    // blob mã hoá cần giải mã
  const [fetching, setFetching] = useState(true); // đang tải blob theo id
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);       // dữ liệu đã giải mã (chỉ render khi được duyệt)
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('code');    // code | pending | approved | rejected
  const [dup, setDup] = useState(false);         // thiết bị thứ 2
  const reqIdRef = useRef(null);

  useEffect(() => {
    const h = (window.location.hash || '').replace(/^#/, '');
    if (!h) { setFetching(false); return; }
    if (UUID_RE.test(h)) {
      // QR mới: hash là id -> tải blob mã hoá từ máy chủ
      supabase.rpc('get_payslip', { p_id: h }).then(({ data: tok }) => {
        setPayload(tok || '');
        setFetching(false);
      });
    } else {
      setPayload(h); // QR cũ: blob nằm ngay trong hash
      setFetching(false);
    }
  }, []);

  // Poll trạng thái duyệt
  useEffect(() => {
    if (phase !== 'pending' || !reqIdRef.current) return;
    const timer = setInterval(async () => {
      const { data: st } = await supabase.rpc('payslip_view_status', { p_id: reqIdRef.current });
      if (st === 'approved') { clearInterval(timer); setPhase('approved'); }
      else if (st === 'rejected') { clearInterval(timer); setPhase('rejected'); }
    }, 3000);
    return () => clearInterval(timer);
  }, [phase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    let obj;
    try {
      obj = await decryptPayslip(payload, code.trim().toUpperCase());
    } catch {
      setError('Sai mã bảo mật hoặc mã QR không hợp lệ.');
      setLoading(false);
      return;
    }
    setData(obj);
    // Gửi yêu cầu xem lương -> thông báo Admin duyệt (kèm thiết bị)
    try {
      const { data: res, error: rpcErr } = await supabase.rpc('request_payslip_view', {
        p_staff: obj.n || '', p_period: obj.m || '', p_key: obj.k || `${obj.n}:${obj.m}`,
        p_device: getDeviceId(), p_label: getDeviceLabel(),
      });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(res) ? res[0] : res;
      reqIdRef.current = row?.req_id || null;
      setDup(!!row?.is_duplicate);
      setPhase('pending');
    } catch (err) {
      setError('Không gửi được yêu cầu xem: ' + (err.message || 'lỗi kết nối'));
    } finally {
      setLoading(false);
    }
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full text-center">{children}</div>
    </div>
  );

  if (fetching) {
    return (
      <Shell>
        <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto" />
        <p className="text-slate-500 text-sm mt-3">Đang tải phiếu lương…</p>
      </Shell>
    );
  }

  if (!payload) {
    return (
      <Shell>
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-600 text-sm">Không tìm thấy dữ liệu phiếu lương. Vui lòng quét lại mã QR trên phiếu lương.</p>
      </Shell>
    );
  }

  // Chờ Admin duyệt
  if (phase === 'pending') {
    return (
      <Shell>
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4"><Clock className="w-7 h-7" /></div>
        <h1 className="text-lg font-bold text-slate-800">Đang chờ Admin duyệt</h1>
        <p className="text-sm text-slate-500 mt-1">Yêu cầu xem lương đã được gửi. Trang sẽ tự mở khi Admin duyệt.</p>
        <Loader2 className="w-5 h-5 animate-spin text-amber-400 mx-auto mt-4" />
        {dup && (
          <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-3 text-left text-xs text-rose-600 leading-relaxed">
            ⚠️ <b>Cảnh báo:</b> phiếu lương này đã được xem trên một <b>thiết bị khác</b>. Admin đã nhận cảnh báo — nếu không phải bạn, việc xem có thể bị từ chối.
          </div>
        )}
      </Shell>
    );
  }

  // Bị từ chối / chặn
  if (phase === 'rejected') {
    return (
      <Shell>
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4"><Ban className="w-7 h-7" /></div>
        <h1 className="text-lg font-bold text-slate-800">Yêu cầu bị từ chối</h1>
        <p className="text-sm text-slate-500 mt-1">Admin đã từ chối / chặn xem phiếu lương này trên thiết bị của bạn.</p>
      </Shell>
    );
  }

  // Đã duyệt -> hiện lương
  if (phase === 'approved' && data) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold">PHIẾU LƯƠNG</h1>
                <p className="text-teal-100 text-sm">Tháng {data.m}</p>
              </div>
              <ShieldCheck className="w-6 h-6 text-teal-100" />
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
            {Array.isArray(data.hh) && data.hh.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Chi tiết hoa hồng / thưởng ({data.hh.length})</div>
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                  {data.hh.map((c, i) => {
                    const amt = c.a ?? c.hh;
                    const note = c.d ?? [c.rev && `DT ${c.rev}`, c.up && `Upsale ${c.up}`].filter(Boolean).join(' · ');
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-700 truncate">{c.n}</div>
                          {note && <div className="text-[11px] text-slate-400 truncate">{note}</div>}
                        </div>
                        <div className="font-semibold text-teal-700 tabular-nums shrink-0">{amt}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mổ đối tác — mục riêng màu vàng */}
            {Array.isArray(data.pt) && data.pt.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Mổ đối tác ({data.pt.length})</div>
                <div className="divide-y divide-amber-100/70 border border-amber-200 rounded-xl overflow-hidden bg-amber-50/50">
                  {data.pt.map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-700 truncate">{c.n}</div>
                        <div className="text-[11px] text-amber-700/80 truncate">{c.t} · {c.role}</div>
                      </div>
                      <div className="font-semibold text-amber-700 tabular-nums shrink-0">{c.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ngày công & ngày nghỉ */}
            {data.cong && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ngày công · nghỉ</div>
                <div className="border border-slate-100 rounded-xl p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Số ngày công</span>
                    <span className="font-semibold text-slate-700">{data.cong.w}/{data.cong.std}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-500">Số ngày nghỉ</span>
                    <span className="font-semibold text-rose-600">{data.cong.off} ngày</span>
                  </div>
                  {Array.isArray(data.off) && data.off.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-50 flex flex-wrap gap-1.5">
                      {data.off.map((o, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-lg font-medium">{o.d} · {o.s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chi tiết tăng ca theo ngày */}
            {Array.isArray(data.ot) && data.ot.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Chi tiết tăng ca ({data.ot.length} ngày)</div>
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                  {data.ot.map((o, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                      <div className="text-slate-600">{o.d}</div>
                      <div className="text-slate-400 text-[11px]">{o.h}h · {o.r}</div>
                      <div className="font-semibold text-teal-700 tabular-nums shrink-0">{o.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-center justify-between">
              <span className="font-bold text-slate-700">THỰC NHẬN</span>
              <span className="text-2xl font-bold text-teal-700 tabular-nums">{data.net}</span>
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">Nội dung được mã hoá đầu cuối · PK Dr Tuấn Hùng</p>
          </div>
        </div>
      </div>
    );
  }

  // Nhập mã bảo mật
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full">
        <div className="w-14 h-14 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-800 text-center">Phiếu lương bảo mật</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-5">Nhập mã bảo mật, sau đó chờ Admin duyệt để xem lương.</p>
        <input
          type="text"
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Mã bảo mật"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-400 outline-none text-center tracking-[0.3em] text-lg uppercase"
        />
        {error && <p className="text-sm text-rose-500 text-center mt-3 flex items-center justify-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-teal-500 text-white font-semibold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gửi yêu cầu xem lương'}
        </button>
      </form>
    </div>
  );
};

export default PayslipViewPage;
