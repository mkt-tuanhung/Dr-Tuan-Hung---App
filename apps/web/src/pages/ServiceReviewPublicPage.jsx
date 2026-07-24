import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getDeviceId } from '@/lib/device';
import {
  QUESTIONS, RATING_LABELS, QUICK_TOPICS, LOW_SCORE_ISSUES,
  CONTACT_OPTIONS, npsGroup, STAFF_ROLE_LABELS,
} from '@/lib/serviceReviewQuestions';
import {
  Heart, ChevronLeft, ChevronRight, Loader2, CheckCircle2, ShieldCheck,
  Star, Send, AlertCircle, Clock, XCircle,
} from 'lucide-react';

// Màu biểu cảm chuyển dần đỏ → xanh theo mức hài lòng
const FACE_COLORS = { 1: '#f43f5e', 2: '#fb923c', 3: '#f59e0b', 4: '#2dd4bf', 5: '#10b981' };
const MOUTHS = {
  1: 'M13 27.5 Q20 20 27 27.5',   // rất buồn
  2: 'M13 26 Q20 22.5 27 26',     // buồn
  3: 'M13 25 L27 25',             // bình thường
  4: 'M13 24 Q20 29 27 24',       // vui
  5: 'M13 23 Q20 31.5 27 23',     // rất vui
};

// Mặt biểu cảm tự vẽ bằng SVG — sắc nét & đồng nhất trên mọi thiết bị
function FaceIcon({ level, active, className }) {
  const stroke = active ? '#ffffff' : '#94a3b8';
  const face = active ? FACE_COLORS[level] : '#e2e8f0';
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill={face} />
      {level === 5 ? (
        <>
          <path d="M11 18 Q14.5 14.5 18 18" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M22 18 Q25.5 14.5 29 18" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="14.5" cy="17" r="1.9" fill={stroke} />
          <circle cx="25.5" cy="17" r="1.9" fill={stroke} />
        </>
      )}
      {level <= 2 && (
        <>
          <path d={level === 1 ? 'M10.5 12.5 L17 14.2' : 'M11.5 13.2 L16.5 14.2'} stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d={level === 1 ? 'M29.5 12.5 L23 14.2' : 'M28.5 13.2 L23.5 14.2'} stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      <path d={MOUTHS[level]} stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const sha256hex = async (s) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return s; }
};

// Gom nhân sự trong ca thành các nhóm vai trò thực sự tham gia
const buildStaffGroups = (staff) => {
  const groups = [];
  if (staff?.doctor?.id) groups.push({ role: 'doctor', members: [staff.doctor] });
  if (Array.isArray(staff?.nurses) && staff.nurses.length) groups.push({ role: 'nurse', members: staff.nurses });
  if (Array.isArray(staff?.consultants) && staff.consultants.length) groups.push({ role: 'consultant', members: staff.consultants });
  if (Array.isArray(staff?.cskh) && staff.cskh.length) groups.push({ role: 'cskh', members: staff.cskh });
  return groups;
};

export default function ServiceReviewPublicPage() {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading|error|welcome|otp|survey|done
  const [errCode, setErrCode] = useState('');
  const [inv, setInv] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [issues, setIssues] = useState([]);
  const [contact, setContact] = useState('');
  const [comment, setComment] = useState('');
  const [topics, setTopics] = useState([]);
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef(Date.now());
  const lsKey = `sr_draft_${token}`;

  // Nạp phiếu
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_review_invitation', { p_token: token });
      if (!alive) return;
      if (error || !data?.ok) {
        setErrCode(data?.error || 'not_found');
        setPhase('error');
        return;
      }
      setInv(data);
      // Khôi phục bản nháp
      try {
        const saved = JSON.parse(localStorage.getItem(lsKey) || 'null');
        if (saved) {
          setAnswers(saved.answers || {});
          setIssues(saved.issues || []);
          setContact(saved.contact || '');
          setComment(saved.comment || '');
          setTopics(saved.topics || []);
        }
      } catch { /* ignore */ }
      setPhase('welcome');
    })();
    return () => { alive = false; };
  }, [token]);

  // Tự lưu nháp
  useEffect(() => {
    if (phase !== 'survey') return;
    localStorage.setItem(lsKey, JSON.stringify({ answers, issues, contact, comment, topics }));
  }, [answers, issues, contact, comment, topics, phase]);

  const staffGroups = useMemo(() => buildStaffGroups(inv?.staff), [inv]);

  // Xây danh sách bước động theo câu trả lời (rẽ nhánh)
  const flow = useMemo(() => {
    const s = [];
    for (const q of QUESTIONS) {
      if (q.code === 'q3' && staffGroups.length === 0) continue; // không có nhân sự → bỏ câu 3
      if (q.code === 'q10') {
        const overall = Number(answers.q1);
        if (overall && overall <= 2) { s.push({ id: 'issues' }); s.push({ id: 'contact' }); }
        s.push({ id: 'q10' });
      } else {
        s.push({ id: q.code });
      }
    }
    return s;
  }, [answers.q1, staffGroups.length]);

  const cur = flow[step];
  const progress = Math.round(((step) / Math.max(flow.length, 1)) * 100);

  const setAns = (code, val) => setAnswers(a => ({ ...a, [code]: val }));

  const canNext = () => {
    if (!cur) return false;
    if (cur.id === 'issues' || cur.id === 'contact') return true;
    const q = QUESTIONS.find(x => x.code === cur.id);
    if (!q) return true;
    if (!q.required) return true;
    if (q.type === 'staff') {
      const v = answers.q3 || {};
      return staffGroups.every(g => v[g.role]);
    }
    return answers[q.code] !== undefined && answers[q.code] !== '';
  };

  const next = () => {
    if (step < flow.length - 1) setStep(step + 1);
    else submit();
  };
  const back = () => { if (step > 0) setStep(step - 1); };

  const startSurvey = () => { startRef.current = Date.now(); setPhase('survey'); };

  const sendOtp = async () => {
    setOtpMsg('Đang gửi mã...');
    const { data } = await supabase.rpc('request_review_otp', { p_token: token });
    setOtpMsg(data?.ok ? 'Đã gửi mã OTP về số điện thoại của bạn.' : 'Không gửi được mã, thử lại sau.');
  };
  const verifyOtp = async () => {
    const { data } = await supabase.rpc('verify_review_otp', { p_token: token, p_code: otp.trim() });
    if (data?.ok) startSurvey();
    else setOtpMsg(data?.error === 'otp_expired' ? 'Mã đã hết hạn, gửi lại nhé.' : 'Mã OTP chưa đúng.');
  };

  const submit = useCallback(async () => {
    setSubmitting(true);
    // Build staff_ratings từ điểm câu 3 áp cho từng nhân sự trong nhóm
    const q3 = answers.q3 || {};
    const staffRatings = [];
    for (const g of staffGroups) {
      const score = q3[g.role];
      if (!score) continue;
      for (const m of g.members) staffRatings.push({ staff_id: m.id, name: m.name, role: g.role, score });
    }
    const deviceHash = await sha256hex(getDeviceId() + '|' + navigator.userAgent);
    const duration = Math.round((Date.now() - startRef.current) / 1000);
    // answers gửi lên: các câu rating/nps ở dạng số; q3 lấy điểm trung bình nhóm cho tiện thống kê
    const flat = { ...answers };
    if (flat.q3 && typeof flat.q3 === 'object') {
      const vals = Object.values(flat.q3).filter(Boolean).map(Number);
      flat.q3 = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined;
    }
    const { data, error } = await supabase.rpc('submit_review', {
      p_token: token,
      p_answers: flat,
      p_staff: staffRatings,
      p_topics: topics,
      p_wants: contact || null,
      p_comment: comment || null,
      p_device_hash: deviceHash,
      p_duration: duration,
    });
    setSubmitting(false);
    if (error || !data?.ok) {
      setErrCode(data?.error || 'submit_failed');
      if (['completed', 'expired'].includes(data?.error)) setPhase('error');
      else alert('Gửi đánh giá chưa thành công, vui lòng thử lại.');
      return;
    }
    localStorage.removeItem(lsKey);
    setPhase('done');
  }, [answers, staffGroups, topics, contact, comment, token]);

  // ---------------- Render trạng thái đặc biệt ----------------
  if (phase === 'loading') {
    return <Shell><div className="flex flex-col items-center gap-3 py-20 text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /><p>Đang tải phiếu đánh giá…</p></div></Shell>;
  }

  if (phase === 'error') {
    const map = {
      completed: { icon: CheckCircle2, c: 'text-teal-500', t: 'Phiếu đã hoàn thành', d: 'Cảm ơn anh/chị, phiếu này đã được đánh giá. Mỗi phiếu chỉ đánh giá một lần.' },
      expired: { icon: Clock, c: 'text-amber-500', t: 'Phiếu đã hết hạn', d: 'Rất tiếc, phiếu đánh giá này đã hết hạn sử dụng.' },
      cancelled: { icon: XCircle, c: 'text-rose-500', t: 'Phiếu đã bị hủy', d: 'Phiếu đánh giá này không còn hiệu lực.' },
      not_found: { icon: AlertCircle, c: 'text-slate-400', t: 'Không tìm thấy phiếu', d: 'Đường dẫn không hợp lệ. Vui lòng kiểm tra lại mã QR.' },
    };
    const m = map[errCode] || map.not_found;
    return <Shell><div className="flex flex-col items-center gap-3 py-16 text-center px-6"><m.icon className={`w-16 h-16 ${m.c}`} /><h2 className="text-xl font-bold text-slate-800">{m.t}</h2><p className="text-slate-500 max-w-xs">{m.d}</p></div></Shell>;
  }

  if (phase === 'done') {
    const overall = Number(answers.q1);
    return <Shell><div className="flex flex-col items-center gap-4 py-16 text-center px-6">
      <div className="w-20 h-20 rounded-full bg-teal-100 grid place-items-center"><Heart className="w-10 h-10 text-teal-500" /></div>
      <h2 className="text-2xl font-bold text-slate-800">Cảm ơn anh/chị! 💚</h2>
      <p className="text-slate-500 max-w-xs">Ý kiến của anh/chị giúp chúng tôi phục vụ tốt hơn mỗi ngày.</p>
      {overall <= 2 && contact && contact !== 'none' && (
        <p className="text-sm bg-amber-50 text-amber-700 border border-amber-100 rounded-xl px-4 py-3 max-w-xs">Bộ phận chăm sóc sẽ liên hệ với anh/chị {contact === 'urgent' ? 'trong thời gian sớm nhất' : 'trong giờ hành chính'}.</p>
      )}
    </div></Shell>;
  }

  if (phase === 'welcome') {
    return <Shell>
      <div className="flex flex-col items-center text-center gap-4 pt-10 pb-6 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 grid place-items-center shadow-lg shadow-teal-500/30"><Heart className="w-8 h-8 text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-800">Đánh giá dịch vụ</h1>
        <p className="text-slate-500">Kính chào {inv?.customer_name ? <b className="text-slate-700">{inv.customer_name}</b> : 'anh/chị'}, cảm ơn anh/chị đã tin tưởng lựa chọn dịch vụ của chúng tôi.</p>
        {inv?.service && <div className="text-sm bg-teal-50 text-teal-700 rounded-xl px-4 py-2 font-medium">{inv.service}</div>}
        <p className="text-slate-400 text-sm">Phiếu chỉ mất chưa tới 2 phút. Đánh giá của anh/chị được bảo mật.</p>
      </div>
      <div className="px-6 pb-8 mt-auto">
        <button onClick={() => (inv?.otp_required ? setPhase('otp') : startSurvey())}
          className="w-full py-4 bg-teal-600 text-white font-bold rounded-2xl shadow-lg shadow-teal-600/25 hover:bg-teal-700 active:scale-[0.99] transition flex items-center justify-center gap-2">
          Bắt đầu đánh giá <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-center text-[11px] text-slate-400 mt-3 flex items-center justify-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Không cần đăng nhập · Không thu thập dữ liệu bệnh án</p>
      </div>
    </Shell>;
  }

  if (phase === 'otp') {
    return <Shell>
      <div className="flex flex-col items-center text-center gap-4 pt-12 px-6">
        <ShieldCheck className="w-14 h-14 text-teal-500" />
        <h2 className="text-xl font-bold text-slate-800">Xác thực số điện thoại</h2>
        <p className="text-slate-500">Chúng tôi gửi mã OTP tới số {inv?.phone_masked || 'điện thoại của anh/chị'} để đảm bảo chính anh/chị đánh giá.</p>
        <button onClick={sendOtp} className="text-teal-600 font-semibold underline">Gửi mã OTP</button>
        <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Nhập mã 6 số"
          className="w-48 text-center text-2xl tracking-[0.4em] font-bold py-3 rounded-2xl border-2 border-slate-200 focus:border-teal-400 outline-none" />
        {otpMsg && <p className="text-sm text-slate-500">{otpMsg}</p>}
      </div>
      <div className="px-6 pb-8 mt-auto">
        <button onClick={verifyOtp} disabled={otp.length < 6} className="w-full py-4 bg-teal-600 text-white font-bold rounded-2xl disabled:opacity-40 hover:bg-teal-700 transition">Xác nhận</button>
      </div>
    </Shell>;
  }

  // ---------------- Khảo sát ----------------
  const q = QUESTIONS.find(x => x.code === cur?.id);
  const overall = Number(answers.q1);

  return <Shell>
    {/* Thanh tiến độ */}
    <div className="px-5 pt-5">
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-[11px] text-slate-400 mt-1.5 text-right">Bước {step + 1}/{flow.length}</div>
    </div>

    <div className="flex-1 px-5 py-4 overflow-y-auto">
      {/* Câu rating 1..8 */}
      {q && q.type === 'rating5' && (
        <QuestionBlock q={q}>
          <div className="flex justify-between gap-1.5 mt-6">
            {[1, 2, 3, 4, 5].map(n => {
              const sel = answers[q.code] === n;
              return (
                <button key={n} onClick={() => setAns(q.code, n)}
                  style={sel ? { borderColor: FACE_COLORS[n], backgroundColor: FACE_COLORS[n] + '14' } : undefined}
                  className={`flex-1 aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 ${sel ? 'scale-105 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5'}`}>
                  <FaceIcon level={n} active={sel} className="w-9 h-9" />
                  <span className="text-xs font-bold" style={{ color: sel ? FACE_COLORS[n] : '#94a3b8' }}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="text-center mt-4 h-5 text-sm font-semibold" style={{ color: answers[q.code] && answers[q.code] !== 'na' ? FACE_COLORS[answers[q.code]] : '#14b8a6' }}>{answers[q.code] && answers[q.code] !== 'na' ? RATING_LABELS[answers[q.code]] : ''}</div>
          {q.na && (
            <button onClick={() => setAns(q.code, 'na')} className={`mt-2 w-full py-2.5 rounded-xl text-sm font-medium border transition ${answers[q.code] === 'na' ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{q.naLabel}</button>
          )}
        </QuestionBlock>
      )}

      {/* Câu 3 — theo từng nhân sự */}
      {q && q.type === 'staff' && (
        <QuestionBlock q={q}>
          <div className="space-y-4 mt-5">
            {staffGroups.map(g => (
              <div key={g.role} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs text-slate-400">{STAFF_ROLE_LABELS[g.role]}</div>
                    <div className="font-semibold text-slate-700 text-sm">{g.members.map(m => m.name).join(', ')}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => {
                    const sel = (answers.q3 || {})[g.role] === n;
                    return (
                      <button key={n} onClick={() => setAns('q3', { ...(answers.q3 || {}), [g.role]: n })}
                        className={`flex-1 py-2 rounded-xl border-2 flex flex-col items-center transition ${sel ? 'border-teal-500 bg-teal-50' : 'border-transparent bg-white'}`}>
                        <Star className={`w-4 h-4 ${sel ? 'text-teal-500 fill-teal-500' : 'text-slate-300'}`} />
                        <span className={`text-[11px] font-bold ${sel ? 'text-teal-600' : 'text-slate-400'}`}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </QuestionBlock>
      )}

      {/* Câu 9 — NPS */}
      {q && q.type === 'nps' && (
        <QuestionBlock q={q}>
          <div className="grid grid-cols-6 gap-2 mt-6">
            {Array.from({ length: 11 }, (_, n) => {
              const sel = answers.q9 === n;
              const grp = npsGroup(n);
              const on = grp === 'promoter' ? 'border-emerald-500 bg-emerald-50 text-emerald-600 scale-105'
                : grp === 'passive' ? 'border-amber-500 bg-amber-50 text-amber-600 scale-105'
                : 'border-rose-500 bg-rose-50 text-rose-600 scale-105';
              return (
                <button key={n} onClick={() => setAns('q9', n)}
                  className={`aspect-square rounded-xl border-2 font-bold text-sm transition ${sel ? on : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{n}</button>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-1"><span>Không giới thiệu</span><span>Chắc chắn giới thiệu</span></div>
        </QuestionBlock>
      )}

      {/* Rẽ nhánh điểm thấp — vấn đề */}
      {cur?.id === 'issues' && (
        <QuestionBlock q={{ title: 'Điều gì khiến anh/chị chưa hài lòng?', text: 'Anh/chị có thể chọn nhiều mục để chúng tôi khắc phục.' }}>
          <div className="flex flex-wrap gap-2 mt-5">
            {LOW_SCORE_ISSUES.map(it => {
              const on = issues.includes(it);
              return <button key={it} onClick={() => setIssues(on ? issues.filter(x => x !== it) : [...issues, it])}
                className={`px-3.5 py-2 rounded-full text-sm font-medium border transition ${on ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200'}`}>{it}</button>;
            })}
          </div>
        </QuestionBlock>
      )}

      {/* Rẽ nhánh điểm thấp — liên hệ */}
      {cur?.id === 'contact' && (
        <QuestionBlock q={{ title: 'Anh/chị có muốn được hỗ trợ không?', text: 'Chúng tôi rất mong được lắng nghe và khắc phục cho anh/chị.' }}>
          <div className="space-y-2.5 mt-5">
            {CONTACT_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setContact(o.value)}
                className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 font-medium transition ${contact === o.value ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600'}`}>{o.label}</button>
            ))}
          </div>
        </QuestionBlock>
      )}

      {/* Câu 10 — ý kiến mở (prompt thích ứng) */}
      {cur?.id === 'q10' && (
        <QuestionBlock q={{
          title: 'Ý kiến của anh/chị',
          text: overall >= 4 ? 'Điều gì khiến anh/chị hài lòng nhất?' : overall === 3 ? 'Điều gì chúng tôi cần cải thiện để phục vụ anh/chị tốt hơn?' : 'Anh/chị muốn chia sẻ thêm điều gì?',
        }}>
          <div className="flex flex-wrap gap-2 mt-4 mb-3">
            {QUICK_TOPICS.map(t => {
              const on = topics.includes(t);
              return <button key={t} onClick={() => setTopics(on ? topics.filter(x => x !== t) : [...topics, t])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-slate-500 border-slate-200'}`}>{t}</button>;
            })}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Nhập ý kiến của anh/chị (không bắt buộc)…"
            className="w-full rounded-2xl border border-slate-200 p-3.5 text-sm outline-none focus:border-teal-400 resize-none" />
        </QuestionBlock>
      )}
    </div>

    {/* Điều hướng */}
    <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3 bg-white">
      {step > 0 && (
        <button onClick={back} className="w-12 h-12 shrink-0 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
      )}
      <button onClick={next} disabled={!canNext() || submitting}
        className="flex-1 py-3.5 bg-teal-600 text-white font-bold rounded-2xl disabled:opacity-40 hover:bg-teal-700 transition flex items-center justify-center gap-2">
        {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang gửi…</>
          : step === flow.length - 1 ? <>Gửi đánh giá <Send className="w-4 h-4" /></>
          : <>Tiếp tục <ChevronRight className="w-5 h-5" /></>}
      </button>
    </div>
  </Shell>;
}

// Khung điện thoại (mobile-first, căn giữa trên desktop)
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-stretch sm:items-center justify-center sm:py-6">
      <div className="w-full sm:max-w-md bg-white sm:rounded-[32px] sm:shadow-2xl min-h-screen sm:min-h-[85vh] sm:max-h-[900px] flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function QuestionBlock({ q, children }) {
  return (
    <div>
      {q.title && <div className="text-xs font-bold text-teal-500 uppercase tracking-wide">{q.title}</div>}
      <h2 className="text-lg font-bold text-slate-800 mt-1.5 leading-snug">{q.text}</h2>
      {children}
    </div>
  );
}
