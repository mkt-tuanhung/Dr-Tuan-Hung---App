import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, AlertCircle, Loader2, Clock, Ban, UserRound, Wallet } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-[#F3F9F9] p-4">
      <div className="e-card p-6 sm:p-8 max-w-sm w-full text-center">{children}</div>
    </div>
  );

  if (fetching) {
    return (
      <Shell>
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
        <p className="text-[14px] text-slate-500 mt-3">Đang tải phiếu lương…</p>
      </Shell>
    );
  }

  if (!payload) {
    return (
      <Shell>
        <div className="e-empty-icon mx-auto bg-warning-50 text-warning-600"><AlertCircle /></div>
        <p className="text-[14px] text-slate-600 leading-relaxed">Không tìm thấy dữ liệu phiếu lương. Vui lòng quét lại mã QR trên phiếu lương.</p>
      </Shell>
    );
  }

  // Chờ Admin duyệt
  if (phase === 'pending') {
    return (
      <Shell>
        <div className="w-16 h-16 rounded-full bg-warning-50 text-warning-600 flex items-center justify-center mx-auto mb-4"><Clock className="w-8 h-8" /></div>
        <h1 className="text-[18px] font-bold text-slate-900">Đang chờ Admin duyệt</h1>
        <p className="text-[14px] text-slate-500 mt-1.5 leading-relaxed">Yêu cầu xem lương đã được gửi. Trang sẽ tự mở khi Admin duyệt.</p>
        <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto mt-5" />
        {dup && (
          <div className="mt-5 bg-danger-50 border border-danger-100 rounded-xl px-3.5 py-3 text-left text-[13px] text-danger-600 leading-relaxed">
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
        <div className="w-16 h-16 rounded-full bg-danger-50 text-danger-600 flex items-center justify-center mx-auto mb-4"><Ban className="w-8 h-8" /></div>
        <h1 className="text-[18px] font-bold text-slate-900">Yêu cầu bị từ chối</h1>
        <p className="text-[14px] text-slate-500 mt-1.5 leading-relaxed">Admin đã từ chối / chặn xem phiếu lương này trên thiết bị của bạn.</p>
      </Shell>
    );
  }

  // Đã duyệt -> hiện lương
  if (phase === 'approved' && data) {
    return (
      <div className="min-h-screen bg-[#F3F9F9] py-6 sm:py-10 px-4">
        <div className="max-w-xl mx-auto space-y-3 lg:space-y-4">
          {/* Đầu phiếu */}
          <div className="flex items-center justify-between gap-3 px-1">
            <h1 className="text-[19px] sm:text-[26px] font-bold text-slate-900 leading-tight sm:leading-normal">Phiếu lương <span className="font-semibold text-slate-400 max-sm:block max-sm:text-[14px] max-sm:mt-0.5">· Tháng {data.m}</span></h1>
            <span className="e-badge e-tone-brand shrink-0"><ShieldCheck /> Bảo mật</span>
          </div>

          {/* Thẻ nhân sự */}
          <div className="e-card p-4 sm:p-6">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="e-avatar w-14 h-14 sm:w-20 sm:h-20 ring-4 ring-teal-50"><UserRound className="w-7 h-7 sm:w-10 sm:h-10" /></div>
              <div className="min-w-0">
                <div className="text-[17px] sm:text-[22px] font-bold text-slate-900 leading-tight">{data.n}</div>
                <div className="text-[13px] sm:text-[14px] text-slate-500 mt-1">{data.r}</div>
                {data.bank && <div className="text-[13px] text-slate-400 mt-0.5">{data.bank}</div>}
              </div>
            </div>
          </div>

          {/* Điện thoại: thẻ hero "Thực nhận" ngay dưới thẻ nhân sự (Ethics M13) */}
          <div className="lg:hidden flex items-center gap-3.5 rounded-2xl bg-teal-50 p-4">
            <span className="w-12 h-12 rounded-full bg-white text-teal-700 flex items-center justify-center shrink-0 shadow-soft"><Wallet className="w-6 h-6" /></span>
            <div className="min-w-0">
              <div className="text-[13.5px] text-teal-900/70">Thực nhận · Tháng {data.m}</div>
              <div className="text-[26px] font-bold text-teal-800 leading-tight tabular-nums">{data.net}</div>
            </div>
          </div>

          {/* Các khoản lương */}
          <div className="rounded-2xl border border-slate-200/80 bg-white lg:border-teal-100 lg:bg-gradient-to-b lg:from-teal-50/70 lg:to-white shadow-soft px-4 pt-4 pb-1 lg:px-5 lg:pt-5 lg:pb-3">
            <h2 className="text-[17px] font-bold text-teal-700 mb-1">Thu nhập &amp; khấu trừ</h2>
            <table className="w-full text-[14.5px] lg:text-[14px]">
              <tbody>
                {(data.items || []).map(([label, val], i) => (
                  <tr key={i} className="border-b border-slate-100/80 last:border-0">
                    <td className="py-3.5 lg:py-2.5 pr-2 text-slate-600">{label}</td>
                    <td className="py-3.5 lg:py-2.5 text-right font-semibold lg:font-medium text-slate-800 tabular-nums whitespace-nowrap">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {Array.isArray(data.hh) && data.hh.length > 0 && (
              <div className="e-card e-card-pad">
                <div className="e-caption mb-3">Chi tiết hoa hồng / thưởng ({data.hh.length})</div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {data.hh.map((c, i) => {
                    const amt = c.a ?? c.hh;
                    const note = c.d ?? [c.rev && `DT ${c.rev}`, c.up && `Upsale ${c.up}`].filter(Boolean).join(' · ');
                    return (
                      <div key={i} className={`px-3.5 py-2.5 text-[14px] ${c.half ? 'bg-danger-50/60' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`font-semibold truncate ${c.half ? 'text-danger-600' : 'text-slate-800'}`}>{c.n}</div>
                            {note && <div className="text-[12px] text-slate-400 truncate">{note}</div>}
                            {c.half && <div className="e-badge e-badge-sm e-tone-danger mt-1">Nguồn {c.hsrc || 'Người quen'} · hưởng 50%</div>}
                          </div>
                          <div className={`font-bold tabular-nums shrink-0 ${c.half ? 'text-danger-600' : 'text-teal-700'}`}>{amt}</div>
                        </div>
                        {Array.isArray(c.parts) && c.parts.length > 0 && (
                          <div className="mt-1.5 pl-2.5 border-l-2 border-teal-100 space-y-0.5">
                            {c.parts.map((p, j) => (
                              <div key={j} className="flex items-center justify-between text-[12px] text-slate-500">
                                <span>{p.l}</span>
                                <span className="tabular-nums">{p.v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mổ đối tác — mục riêng màu vàng */}
            {Array.isArray(data.pt) && data.pt.length > 0 && (
              <div className="e-card e-card-pad">
                <div className="e-caption mb-3 !text-peach-600">Mổ đối tác ({data.pt.length})</div>
                <div className="divide-y divide-peach-100 border border-peach-200 rounded-xl overflow-hidden bg-peach-50/50">
                  {data.pt.map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-[14px] gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{c.n}</div>
                        <div className="text-[12px] text-peach-700/80 truncate">{c.t} · {c.role}</div>
                      </div>
                      <div className="font-bold text-peach-700 tabular-nums shrink-0">{c.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ngày công & ngày nghỉ */}
            {data.cong && (
              <div className="e-card e-card-pad">
                <div className="e-caption mb-3">Ngày công · nghỉ</div>
                <div className="e-subtle px-3.5 py-3 text-[14px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Số ngày công</span>
                    <span className="font-bold text-slate-900 tabular-nums">{data.cong.w}/{data.cong.std}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-slate-600">Số ngày nghỉ</span>
                    <span className="font-bold text-danger-600 tabular-nums">{data.cong.off} ngày</span>
                  </div>
                  {Array.isArray(data.off) && data.off.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                      {data.off.map((o, i) => (
                        <span key={i} className="e-badge e-badge-sm e-tone-rose">{o.d} · {o.s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chi tiết tăng ca theo ngày */}
            {Array.isArray(data.ot) && data.ot.length > 0 && (
              <div className="e-card e-card-pad">
                <div className="e-caption mb-3">Chi tiết tăng ca ({data.ot.length} ngày)</div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {data.ot.map((o, i) => (
                    <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-[14px] gap-2">
                      <div className="text-slate-700">{o.d}</div>
                      <div className="text-slate-400 text-[12px]">{o.h}h · {o.r}</div>
                      <div className="font-semibold text-teal-700 tabular-nums shrink-0">{o.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Thực nhận */}
          <div className="hidden lg:flex items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-[#EAF7F7] px-5 py-5 sm:px-6 sm:py-6 shadow-soft">
            <span className="flex items-center gap-2 text-[18px] sm:text-[20px] font-bold text-teal-900"><Wallet className="w-6 h-6 text-teal-700" /> Thực nhận</span>
            <span className="text-[26px] sm:text-[32px] font-bold text-teal-800 tabular-nums">{data.net}</span>
          </div>
          <p className="text-[12px] text-slate-400 text-center">Nội dung được mã hoá đầu cuối · PK Dr Tuấn Hùng</p>
        </div>
      </div>
    );
  }

  // Nhập mã bảo mật
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F9F9] p-4">
      <form onSubmit={handleSubmit} className="e-card p-6 sm:p-8 max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4 ring-8 ring-teal-50/50">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-[20px] font-bold text-slate-900 text-center">Phiếu lương bảo mật</h1>
        <p className="text-[14px] text-slate-500 text-center mt-1.5 mb-6 leading-relaxed">Nhập mã bảo mật, sau đó chờ Admin duyệt để xem lương.</p>
        <input
          type="text"
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Mã bảo mật"
          className="e-input h-12 text-center tracking-[0.3em] text-[18px] font-semibold uppercase"
        />
        {error && <p className="text-[13px] text-danger-600 text-center mt-3 flex items-center justify-center gap-1.5"><AlertCircle className="w-4 h-4" /> {error}</p>}
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="e-btn e-btn-primary e-btn-lg e-btn-block mt-5"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gửi yêu cầu xem lương'}
        </button>
      </form>
    </div>
  );
};

export default PayslipViewPage;
