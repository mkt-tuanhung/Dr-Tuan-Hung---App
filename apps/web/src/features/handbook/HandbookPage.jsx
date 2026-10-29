// ============================================================
// SỔ TAY VIDEO (dùng chung) — Sổ Tay CSKH, Sổ Tay Chuyên môn… cho TOÀN BỘ nhân viên
// Mỗi sổ tay = 1 cấu hình (handbookConfigs.js): bảng video + bảng tiến độ riêng, thư mục R2, ảnh thumb.
// - Lưới tập (ảnh thumb dọc 9:16, thời lượng, tiến độ đã xem)
// - Trình phát riêng: video dọc (video ngang 16:9 thì khung tự chuyển ngang), play/pause, tua ±10s, thanh tua, tốc độ, toàn màn hình,
//   xem tiếp từ chỗ dừng, xem >= 90% = hoàn thành, hết tập tự sang tập kế (đếm ngược 5s)
// - Admin: "Quản lý video" — thêm tập mới, sửa tên / mô tả, đổi ảnh thumb, tải video THẲNG lên R2
//   (chọn nhiều file 1 lần, tự khớp tập theo tên file "Tap01_…", "Tap02_…")
// Bảng: xem cfg.videosTable / cfg.progressTable (supabase/so_tay_cskh.sql, supabase/so_tay_chuyen_mon.sql)
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen, Play, Pause, RotateCcw, RotateCw, Maximize, Minimize, CheckCircle2, ChevronLeft,
  Settings2, Upload, ImagePlus, Loader2, Clock, Film, Users, Lock, AlertTriangle, Eye, ChevronDown, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { uploadToR2 } from '@/lib/r2Client';
import { Drawer } from '@/components/ds/Overlay.jsx';
import { CSKH_HANDBOOK } from './handbookConfigs';

const HandbookCfg = createContext(CSKH_HANDBOOK);

const DONE_RATIO = 0.9;          // xem >= 90% thời lượng = hoàn thành tập
const SAVE_EVERY_MS = 10_000;    // đang phát: lưu tiến độ mỗi 10 giây
const SPEEDS = [1, 1.25, 1.5, 2];
const NEXT_COUNTDOWN = 5;

const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${pad2(Math.floor(s % 60))}`;
};
const thumbOf = (v, cfg) => v.thumbnail_url || cfg.thumb(v.episode);
const deviceLabel = () => {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Máy tính Windows';
  if (/Macintosh/i.test(ua)) return 'Máy Mac';
  return 'Khác';
};
const isAdminOf = (p) => [p?.role, p?.role_2].includes('admin');
const canSeeTeamOf = (p) => [p?.role, p?.role_2].some(r => ['admin', 'accountant', 'shareholder'].includes(r));
const pctOf = (v, pr) => {
  if (pr?.completed) return 100;
  const d = v.duration_sec || 0;
  return d > 0 && pr ? Math.min(99, Math.round((Number(pr.max_sec) || 0) / d * 100)) : 0;
};

// PUT file thẳng lên R2 qua link ký sẵn (r2-presign) — có % tiến độ (fetch không báo được)
const uploadVideo = async (file, folder, onProgress) => {
  const { data, error } = await supabase.functions.invoke('r2-presign', { body: { folder, filename: file.name } });
  if (error) throw new Error('Không lấy được link tải lên: ' + error.message);
  if (data?.error) throw new Error(data.error);
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Tải lên R2 thất bại (HTTP ' + xhr.status + ')')));
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải lên'));
    xhr.send(file);
  });
  return data.publicUrl;
};

// Đọc thời lượng video ngay trên máy (không cần tải lên trước)
const readDuration = (file) => new Promise((resolve) => {
  const v = document.createElement('video');
  const url = URL.createObjectURL(file);
  const done = (d) => { URL.revokeObjectURL(url); resolve(d); };
  v.preload = 'metadata';
  v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? Math.round(v.duration) : null);
  v.onerror = () => done(null);
  v.src = url;
});

const episodeFromName = (name) => {
  const m = String(name).match(/(?:t[aậ]p|b[aà]i|qt)\s*[_\-\s]?0*(\d{1,2})/i) || String(name).match(/^0*(\d{1,2})\D/);
  return m ? Number(m[1]) : null;
};

export default function HandbookPage({ config = CSKH_HANDBOOK }) {
  return <HandbookCfg.Provider value={config}><HandbookHome key={config.key} /></HandbookCfg.Provider>;
}

function HandbookHome() {
  const cfg = useContext(HandbookCfg);
  const { profile } = useAuth();
  const meId = profile?.id;
  const isAdmin = isAdminOf(profile);
  const canSeeTeam = canSeeTeamOf(profile);
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState({});   // episode -> dòng tiến độ của tôi
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);  // chưa chạy file SQL của sổ tay
  const [current, setCurrent] = useState(null);   // episode đang xem
  const [manageOpen, setManageOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [topic, setTopic] = useState('all');      // lọc theo nhóm dịch vụ (nếu sổ tay có cột topic)

  const load = useCallback(async () => {
    const [{ data: vs, error }, { data: ps }] = await Promise.all([
      supabase.from(cfg.videosTable).select('*').eq('active', true).order('episode'),
      meId ? supabase.from(cfg.progressTable).select('*').eq('user_id', meId) : Promise.resolve({ data: [] }),
    ]);
    if (error) { setMissing(/relation|does not exist|schema cache/i.test(error.message)); setLoading(false); return; }
    setVideos(vs || []);
    setProgress(Object.fromEntries((ps || []).map(p => [p.episode, p])));
    setLoading(false);
  }, [meId, cfg]);
  useEffect(() => { load(); }, [load]);

  const onProgressSaved = useCallback((row) => setProgress(p => ({ ...p, [row.episode]: { ...p[row.episode], ...row } })), []);

  const doneCount = videos.filter(v => progress[v.episode]?.completed).length;
  const resumeEp = useMemo(() => {
    const started = videos.find(v => !progress[v.episode]?.completed && Number(progress[v.episode]?.position_sec) > 5);
    return (started || videos.find(v => !progress[v.episode]?.completed) || videos[0])?.episode;
  }, [videos, progress]);
  const totalMin = Math.round(videos.reduce((s, v) => s + (v.duration_sec || 0), 0) / 60);
  const topics = useMemo(() => [...new Set(videos.map(v => v.topic).filter(Boolean))], [videos]);
  const sections = useMemo(() => {
    if (!topics.length) return [{ topic: null, items: videos }];
    return topics.filter(t => topic === 'all' || t === topic).map(t => ({ topic: t, items: videos.filter(v => v.topic === t) }));
  }, [videos, topics, topic]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>;
  if (missing) {
    return (
      <div className="e-card e-card-pad text-[14px] text-slate-600">
        <b>Chưa bật {cfg.name}.</b> {isAdmin ? <>Chạy file <code className="px-1 rounded bg-slate-100">{cfg.sqlFile}</code> trong Supabase SQL Editor.</> : 'Nhờ Admin bật tính năng này.'}
      </div>
    );
  }

  const cur = videos.find(v => v.episode === current);
  if (cur) {
    return (
      <WatchView
        key={cur.episode}
        video={cur}
        videos={videos}
        progress={progress}
        meId={meId}
        onSaved={onProgressSaved}
        onPick={setCurrent}
        onBack={() => setCurrent(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl text-white px-5 py-5 lg:px-7 lg:py-6" style={{ background: 'linear-gradient(135deg,#0B2522 0%,#123B36 55%,#0E2E2A 100%)' }}>
        <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full opacity-[0.10]" style={{ background: '#D9B77A' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div className="min-w-0">
            <div className="text-[11.5px] tracking-[0.18em] font-semibold" style={{ color: '#D9B77A' }}>DR TUẤN HÙNG · NỘI BỘ</div>
            <h2 className="mt-1 text-[22px] lg:text-[26px] font-bold leading-tight text-white">{cfg.name}</h2>
            <p className="mt-1 text-[13.5px] text-white/75 max-w-xl">{videos.length} {cfg.unitLower} {cfg.blurb} · khoảng {totalMin} phút. Xem lần lượt từng {cfg.unitLower}, app tự nhớ chỗ bạn đang xem.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[12px] text-white/60">Đã xem xong</div>
              <div className="text-[20px] font-bold tabular-nums">{doneCount}<span className="text-white/50 text-[15px]">/{videos.length}</span></div>
            </div>
            {resumeEp && (
              <button type="button" onClick={() => setCurrent(resumeEp)} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl font-semibold text-[14px] text-[#0B2522] shadow-nav" style={{ background: '#D9B77A' }}>
                <Play className="w-4 h-4 fill-current" />{doneCount === 0 && !Number(progress[resumeEp]?.position_sec) ? 'Bắt đầu xem' : `Xem tiếp ${cfg.unit} ${pad2(resumeEp)}`}
              </button>
            )}
          </div>
        </div>
        {videos.length > 0 && (
          <div className="relative mt-4 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${doneCount / videos.length * 100}%`, background: '#D9B77A' }} />
          </div>
        )}
      </div>

      {(isAdmin || canSeeTeam || topics.length > 1) && (
        <div className="flex items-center gap-2 flex-wrap">
          {topics.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
              {[['all', 'Tất cả', videos.length], ...topics.map(t => [t, t, videos.filter(v => v.topic === t).length])].map(([id, label, n]) => (
                <button key={id} type="button" onClick={() => setTopic(id)}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-medium border transition ${topic === id ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
                  {label} <span className={topic === id ? 'text-white/70' : 'text-slate-400'}>{n}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {canSeeTeam && <button type="button" onClick={() => setTeamOpen(true)} className="e-btn e-btn-secondary e-btn-sm"><Users />Tiến độ nhân viên</button>}
            {isAdmin && <button type="button" onClick={() => setManageOpen(true)} className="e-btn e-btn-outline e-btn-sm"><Settings2 />Quản lý video</button>}
          </div>
        </div>
      )}

      {/* Lưới tập / bài — có nhóm chủ đề thì chia theo từng nhóm */}
      {sections.map(sec => (
        <section key={sec.topic || 'all'} className="space-y-2.5">
          {sec.topic && (
            <div className="flex items-baseline gap-2">
              <h3 className="text-[15px] font-bold text-slate-900">{sec.topic}</h3>
              <span className="text-[12.5px] text-slate-500">{sec.items.length} {cfg.unitLower} · đã xem {sec.items.filter(v => progress[v.episode]?.completed).length}</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
            {sec.items.map(v => {
              const pr = progress[v.episode];
              const pct = pctOf(v, pr);
              return (
                <button key={v.episode} type="button" onClick={() => setCurrent(v.episode)} className="group self-start text-left min-w-0 focus:outline-none">
                  <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 shadow-card ring-1 ring-black/5 group-focus-visible:ring-2 group-focus-visible:ring-teal-500">
                    <img src={thumbOf(v, cfg)} alt={v.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                      <span className="w-12 h-12 rounded-full bg-white/90 grid place-items-center shadow-float"><Play className="w-5 h-5 text-slate-900 fill-current ml-0.5" /></span>
                    </span>
                    {pr?.completed && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[11px] font-semibold px-2 py-0.5"><CheckCircle2 className="w-3.5 h-3.5" />Đã xem</span>
                    )}
                    {!v.video_url && <span className="absolute top-2 left-2 rounded-full bg-black/55 text-white text-[11px] px-2 py-0.5">Sắp có</span>}
                    {v.duration_sec > 0 && <span className="absolute bottom-2.5 right-2 rounded-md bg-black/60 text-white text-[11px] font-medium tabular-nums px-1.5 py-0.5">{fmtTime(v.duration_sec)}</span>}
                    {pct > 0 && (
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25"><div className="h-full" style={{ width: `${pct}%`, background: pr?.completed ? '#10b981' : '#D9B77A' }} /></div>
                    )}
                  </div>
                  <div className="mt-2 px-0.5">
                    <div className="text-[11.5px] font-semibold text-teal-700">{cfg.unit} {pad2(v.episode)}</div>
                    <div className="text-[14px] font-semibold text-slate-900 leading-snug line-clamp-2">{v.title}</div>
                    {v.subtitle && <div className="text-[12px] text-slate-500 leading-snug line-clamp-2 mt-0.5">{v.subtitle}</div>}
                    {pr?.views > 0 && <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-slate-500"><Eye className="w-3 h-3" />Đã xem {pr.views} lần</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {isAdmin && <ManageDrawer open={manageOpen} onClose={() => setManageOpen(false)} videos={videos} meId={meId} onChanged={load} />}
      {canSeeTeam && <TeamProgressDrawer open={teamOpen} onClose={() => setTeamOpen(false)} videos={videos} />}
    </div>
  );
}

// ---------------- Màn xem 1 tập ----------------
function WatchView({ video, videos, progress, meId, onSaved, onPick, onBack }) {
  const cfg = useContext(HandbookCfg);
  const idx = videos.findIndex(v => v.episode === video.episode);
  const next = videos[idx + 1];
  const pr = progress[video.episode];

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="e-btn e-btn-ghost e-btn-sm -ml-2"><ChevronLeft />Tất cả các {cfg.unitLower}</button>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 items-start">
        <div className="min-w-0">
          {video.video_url ? (
            <VideoPlayer video={video} startAt={pr?.completed ? 0 : Number(pr?.position_sec) || 0} prevMax={Number(pr?.max_sec) || 0}
              wasDone={!!pr?.completed} meId={meId} onSaved={onSaved} onViews={(n) => onSaved({ episode: video.episode, views: n })}
              next={next} onNext={() => next && onPick(next.episode)} />
          ) : (
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[min(100%,calc((100dvh-190px)*9/16))] rounded-2xl overflow-hidden bg-slate-900">
              <img src={thumbOf(video, cfg)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
                <div><Film className="w-8 h-8 mx-auto mb-2 opacity-80" /><div className="font-semibold">Video đang được cập nhật</div><div className="text-[13px] text-white/70 mt-1">Admin sẽ tải video {cfg.unitLower} này lên sớm.</div></div>
              </div>
            </div>
          )}
          <div className="mt-3 lg:hidden">
            <EpisodeHeading video={video} done={!!pr?.completed} views={pr?.views || 0} hasVideo={!!video.video_url} />
          </div>
        </div>

        <aside className="min-w-0 space-y-3">
          <div className="hidden lg:block e-card e-card-pad"><EpisodeHeading video={video} done={!!pr?.completed} views={pr?.views || 0} hasVideo={!!video.video_url} /></div>
          <div className="e-card overflow-hidden">
            <div className="px-4 pt-3.5 pb-2 text-[13px] font-semibold text-slate-700 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-600" />Danh sách {cfg.unitLower}</div>
            <ul className="pb-1.5">
              {videos.map(v => {
                const p = progress[v.episode];
                const pct = pctOf(v, p);
                const active = v.episode === video.episode;
                return (
                  <li key={v.episode}>
                    <button type="button" onClick={() => onPick(v.episode)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${active ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                      <span className="relative w-11 aspect-[9/16] shrink-0 rounded-lg overflow-hidden bg-slate-200">
                        <img src={thumbOf(v, cfg)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                        {active && <span className="absolute inset-0 bg-black/35 grid place-items-center"><Play className="w-3.5 h-3.5 text-white fill-current" /></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[11px] font-semibold ${active ? 'text-teal-700' : 'text-slate-400'}`}>{cfg.unit} {pad2(v.episode)}{v.duration_sec ? ` · ${fmtTime(v.duration_sec)}` : ''}</span>
                        <span className={`block text-[13.5px] leading-snug line-clamp-2 ${active ? 'font-semibold text-teal-900' : 'font-medium text-slate-800'}`}>{v.title}</span>
                        {pct > 0 && !p?.completed && <span className="mt-1 block h-1 rounded-full bg-slate-200 overflow-hidden"><span className="block h-full bg-amber-400" style={{ width: `${pct}%` }} /></span>}
                      </span>
                      {p?.completed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EpisodeHeading({ video, done, views = 0, hasVideo = false }) {
  const cfg = useContext(HandbookCfg);
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] font-semibold text-teal-700">
        {cfg.name} · {cfg.unit} {pad2(video.episode)}
        {video.topic && <span className="text-slate-400 font-medium">· {video.topic}</span>}
        {done && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />Đã xem xong</span>}
      </div>
      <h2 className="mt-0.5 text-[18px] lg:text-[20px] font-bold text-slate-900 leading-snug">{video.title}</h2>
      {video.subtitle && <p className="mt-1 text-[13.5px] text-slate-600 leading-relaxed">{video.subtitle}</p>}
      <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px] text-slate-500">
        {video.duration_sec > 0 && <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{fmtTime(video.duration_sec)} phút</span>}
        {views > 0 && <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Bạn đã xem {views} lần</span>}
      </div>
      {hasVideo && !done && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-50 text-amber-800 px-3 py-2 text-[12.5px] leading-snug">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Lần xem đầu: xem trọn vẹn ở tốc độ 1x, không tua nhanh. Cố tình tua sẽ bị ghi nhận. Xem xong được tua thoải mái.</span>
        </div>
      )}
    </div>
  );
}

// ---------------- Trình phát video ----------------
function VideoPlayer({ video, startAt, prevMax, wasDone, meId, onSaved, onViews, next, onNext }) {
  const cfg = useContext(HandbookCfg);
  const wrapRef = useRef(null);
  const vRef = useRef(null);
  const hideTimer = useRef(null);
  const st = useRef({ max: prevMax, done: wasDone, lastSave: 0, dirty: false, resumed: false, tickAt: 0, guard: false, viewCounted: false, lastWarn: {} });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(video.duration_sec || 0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showUi, setShowUi] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [landscape, setLandscape] = useState(false); // video ngang (16:9) -> khung ngang
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [scrub, setScrub] = useState(null);       // đang kéo thanh tua -> giá trị tạm
  const [locked, setLocked] = useState(!wasDone); // LẦN XEM ĐẦU: không tua vượt đoạn đã xem, không tăng tốc
  const [warn, setWarn] = useState(null);         // popup cảnh báo vi phạm

  // Ghi vi phạm (tua / tăng tốc ở lần xem đầu) + hiện cảnh báo. Cùng loại trong 4 giây chỉ ghi 1 lần.
  const violate = useCallback((kind, extra = {}) => {
    const v = vRef.current;
    const s = st.current;
    const now = Date.now();
    if (now - (s.lastWarn[kind] || 0) < 4000) return;
    s.lastWarn[kind] = now;
    v?.pause();
    setWarn({ kind, ...extra });
    if (!meId) return;
    supabase.from('training_violations').insert({
      user_id: meId, module: cfg.key, ref: String(video.episode), kind,
      detail: {
        episode: video.episode, title: video.title,
        at_sec: Math.floor(s.max), at: fmtTime(s.max),
        ...(extra.to != null ? { to_sec: Math.floor(extra.to), to: fmtTime(extra.to) } : {}),
        ...(extra.rate ? { rate: extra.rate } : {}),
        duration: Math.round(v?.duration || dur), device: deviceLabel(),
      },
    }).then(() => {});
  }, [meId, cfg.key, video.episode, video.title, dur]);

  // Lưu tiến độ (upsert dòng của chính mình)
  const save = useCallback(async (force = false) => {
    const v = vRef.current;
    if (!meId || !v) return;
    const s = st.current;
    if (!s.resumed || !s.played) return;       // chưa bấm xem / chưa nhảy tới chỗ xem dở -> không ghi đè tiến độ cũ
    const now = Date.now();
    if (!force && (!s.dirty || now - s.lastSave < SAVE_EVERY_MS)) return;
    const d = v.duration || dur;
    const pos = v.currentTime || 0;
    s.max = Math.max(s.max, pos);
    const becameDone = !s.done && d > 0 && s.max >= d * DONE_RATIO;
    if (becameDone) s.done = true;
    s.lastSave = now; s.dirty = false;
    const row = {
      user_id: meId, episode: video.episode,
      position_sec: Math.round(pos * 10) / 10, max_sec: Math.round(s.max * 10) / 10,
      completed: s.done, updated_at: new Date().toISOString(),
      ...(becameDone ? { completed_at: new Date().toISOString() } : {}),
    };
    s.lastPos = pos;
    onSaved(row);
    const { error } = await supabase.from(cfg.progressTable).upsert(row, { onConflict: 'user_id,episode' });
    if (error) { s.dirty = true; return; }
    if (becameDone) { setLocked(false); toast.success(`Đã hoàn thành ${cfg.unit} ${pad2(video.episode)} — từ giờ có thể tua / xem nhanh`); }
  }, [meId, video.episode, dur, onSaved, cfg]);

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  // Rời trang / ẩn app -> lưu ngay
  useEffect(() => {
    const flush = () => saveRef.current(true);
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    const s = st.current;
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', flush); if (s.dirty) flush(); };
  }, []);

  const poke = useCallback(() => {
    setShowUi(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (vRef.current && !vRef.current.paused) setShowUi(false); }, 2600);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const toggle = useCallback(() => {
    const v = vRef.current;
    if (!v) return;
    setCountdown(null);
    if (v.paused || v.ended) { if (v.ended) v.currentTime = 0; v.play().catch(() => {}); } else v.pause();
    poke();
  }, [poke]);
  const seekBy = (d) => { const v = vRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min((v.duration || dur) - 0.2, v.currentTime + d)); poke(); };
  const cycleSpeed = () => {
    if (locked) { violate('speed', { rate: 'nút tốc độ' }); return; }
    const nx = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(nx); if (vRef.current) vRef.current.playbackRate = nx; poke();
  };
  const toggleFs = async () => {
    const el = wrapRef.current; const v = vRef.current;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      } else if (el?.requestFullscreen) {
        await el.requestFullscreen();
        if (landscape) screen.orientation?.lock?.('landscape').catch(() => {});   // điện thoại: tự xoay ngang
      }
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();     // iPhone: chỉ video được toàn màn hình
    } catch { v?.webkitEnterFullscreen?.(); }
  };
  useEffect(() => {
    const on = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
  }, []);

  // Phím tắt trên máy tính: Space / K = phát-dừng, ← → = tua 10s, F = toàn màn hình
  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea|select/i.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(10); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-10); }
      else if (e.key === 'f') toggleFs();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Hết tập -> đếm ngược sang tập kế
  useEffect(() => {
    if (countdown == null) return undefined;
    if (countdown <= 0) { setCountdown(null); onNext(); return undefined; }
    const t = setTimeout(() => setCountdown(c => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, onNext]);

  const onLoaded = () => {
    const v = vRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration)) setDur(v.duration);
    setLandscape(v.videoWidth > v.videoHeight);
    v.playbackRate = speed;
    if (!st.current.resumed) {
      st.current.resumed = true;
      if (startAt > 5 && startAt < (v.duration || 0) - 10) {
        v.currentTime = startAt;
        toast(`Xem tiếp từ ${fmtTime(startAt)}`, { action: { label: 'Xem từ đầu', onClick: () => { if (vRef.current) vRef.current.currentTime = 0; } } });
      }
    }
  };
  // Chặn tua tới (kể cả thanh tua của trình phát gốc trên iPhone) — chỉ ở lần xem đầu
  const onSeeking = () => {
    const v = vRef.current;
    const s = st.current;
    if (!v || s.guard) { s.guard = false; return; }
    if (!locked || !s.resumed) return;
    if (v.currentTime > s.max + 1.5) {
      const to = v.currentTime;
      s.guard = true;
      v.currentTime = s.max;
      violate('seek', { to });
    }
  };
  const onRate = () => {
    const v = vRef.current;
    if (!v || !locked || v.playbackRate <= 1) return;
    const rate = v.playbackRate;
    v.playbackRate = 1; setSpeed(1);
    violate('speed', { rate: `${rate}x` });
  };
  const onTime = () => {
    const v = vRef.current;
    if (!v) return;
    setTime(v.currentTime);
    if (!st.current.resumed) return;
    // "Đã xem tới" chỉ tăng theo phát liên tục (không tính các bước nhảy do tua)
    const s0 = st.current;
    const now = Date.now();
    const allow = Math.max(2.5, ((now - (s0.tickAt || now)) / 1000) * (v.playbackRate || 1) * 1.2 + 1);
    s0.tickAt = now;
    if (!v.paused && v.currentTime <= s0.max + allow) s0.max = Math.max(s0.max, v.currentTime);
    if (Math.abs(v.currentTime - (st.current.lastPos ?? -1)) > 0.5) { st.current.dirty = true; st.current.lastPos = v.currentTime; }
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    save(false);
  };

  const shown = scrub ?? time;
  const pct = dur > 0 ? (shown / dur) * 100 : 0;
  const bufPct = dur > 0 ? Math.min(100, (buffered / dur) * 100) : 0;
  const maxPct = dur > 0 ? Math.min(100, (st.current.max / dur) * 100) : 0;   // đoạn đã xem (được phép tua trong đoạn này)
  const uiVisible = showUi || !playing || ended;

  return (
    <div
      ref={wrapRef}
      onMouseMove={poke}
      className={`relative mx-auto bg-black overflow-hidden select-none ${isFs ? 'w-full h-full grid place-items-center' : `${landscape ? 'aspect-video max-w-[min(100%,calc((100dvh-190px)*16/9))]' : 'aspect-[9/16] max-w-[min(100%,calc((100dvh-190px)*9/16))]'} w-full rounded-2xl shadow-float`}`}
    >
      {/* video ngang: ảnh bìa dọc phủ mờ hai bên lúc chưa phát, khỏi trống đen */}
      {landscape && !isFs && <img src={thumbOf(video, cfg)} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60" />}
      <video
        ref={vRef}
        src={video.video_url}
        poster={thumbOf(video, cfg)}
        playsInline
        preload="metadata"
        className={isFs ? 'max-w-full max-h-full' : 'absolute inset-0 w-full h-full object-contain'}
        onClick={toggle}
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTime}
        onSeeking={onSeeking}
        onRateChange={onRate}
        onPlay={() => {
          const s = st.current;
          s.played = true; s.tickAt = Date.now();
          if (!s.viewCounted && meId) {   // mỗi lần bấm xem / xem lại = +1 lượt xem
            s.viewCounted = true;
            supabase.rpc('bump_handbook_view', { p_book: cfg.key, p_episode: video.episode }).then(({ data }) => { if (typeof data === 'number') onViews?.(data); });
          }
          setPlaying(true); setEnded(false); poke();
        }}
        onPause={() => { setPlaying(false); setShowUi(true); save(true); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onEnded={() => {
          setPlaying(false); setEnded(true); setShowUi(true);
          st.current.viewCounted = false;
          if (!locked || st.current.max >= (vRef.current?.duration || 0) - 3) st.current.max = Math.max(st.current.max, vRef.current?.duration || 0);
          st.current.dirty = true; save(true);
          if (next?.video_url) setCountdown(NEXT_COUNTDOWN);
        }}
      />

      {/* Nút giữa */}
      {waiting && playing && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none"><Loader2 className="w-10 h-10 text-white/90 animate-spin" /></div>
      )}
      {!playing && !ended && (
        <button type="button" onClick={toggle} aria-label="Phát" className="absolute inset-0 grid place-items-center">
          <span className="w-16 h-16 rounded-full bg-white/90 grid place-items-center shadow-float"><Play className="w-7 h-7 text-slate-900 fill-current ml-1" /></span>
        </button>
      )}

      {/* Hết tập */}
      {ended && (
        <div className="absolute inset-0 bg-black/70 grid place-items-center p-5 text-center text-white">
          <div className="w-full max-w-[260px]">
            <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-400" />
            <div className="mt-2 font-semibold">Đã xem xong {cfg.unit} {pad2(video.episode)}</div>
            {next ? (
              <>
                <div className="mt-4 text-[12px] text-white/60">{cfg.unit} tiếp theo</div>
                <div className="mt-1 flex items-center gap-3 text-left rounded-xl bg-white/10 p-2">
                  <img src={thumbOf(next, cfg)} alt="" className="w-10 aspect-[9/16] object-cover rounded-md shrink-0" />
                  <div className="min-w-0 text-[13px] font-semibold leading-snug line-clamp-3">{cfg.unit} {pad2(next.episode)} · {next.title}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { setCountdown(null); onNext(); }} className="flex-1 h-10 rounded-xl font-semibold text-[14px] text-[#0B2522]" style={{ background: '#D9B77A' }}>
                    {countdown != null ? `Xem ngay (${countdown})` : `Xem ${cfg.unitLower} tiếp`}
                  </button>
                  {countdown != null && <button type="button" onClick={() => setCountdown(null)} className="h-10 px-3 rounded-xl bg-white/15 text-[13px]">Huỷ</button>}
                </div>
              </>
            ) : <div className="mt-2 text-[13px] text-white/70">Bạn đã xem hết {cfg.name} 🎉</div>}
            <button type="button" onClick={toggle} className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-white/75 hover:text-white"><RotateCcw className="w-4 h-4" />Xem lại</button>
          </div>
        </div>
      )}

      {/* Cảnh báo vi phạm */}
      {warn && (
        <div className="absolute inset-0 z-20 bg-black/75 grid place-items-center p-5 text-center text-white">
          <div className="w-full max-w-[290px] rounded-2xl bg-[#14302C] border border-[#D9B77A]/40 p-5 shadow-float">
            <span className="mx-auto w-12 h-12 rounded-full bg-amber-400/15 grid place-items-center"><AlertTriangle className="w-6 h-6 text-amber-300" /></span>
            <div className="mt-3 text-[15.5px] font-bold">{warn.kind === 'speed' ? 'Không được tăng tốc ở lần xem đầu' : 'Không được tua video ở lần xem đầu'}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/75">
              Bạn cần xem trọn {cfg.unit} {pad2(video.episode)} một lần ở tốc độ 1x. Xem xong rồi có thể tua, xem nhanh thoải mái.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-amber-200/90">Hành động này đã được ghi nhận vào tiến độ của bạn.</p>
            <button type="button" onClick={() => { setWarn(null); vRef.current?.play().catch(() => {}); }}
              className="mt-4 w-full h-10 rounded-xl font-semibold text-[14px] text-[#0B2522]" style={{ background: '#D9B77A' }}>
              Tôi đã hiểu, xem tiếp
            </button>
          </div>
        </div>
      )}

      {/* Thanh điều khiển */}
      <div className={`absolute inset-x-0 bottom-0 pt-10 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white transition-opacity duration-300 ${uiVisible && !ended ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="relative h-5 flex items-center group/seek">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufPct}%` }} />
            {locked && <div className="absolute inset-y-0 left-0 bg-[#D9B77A]/45" style={{ width: `${maxPct}%` }} />}
            <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: '#D9B77A' }} />
          </div>
          <span className="absolute w-3.5 h-3.5 -ml-[7px] rounded-full shadow pointer-events-none" style={{ left: `${pct}%`, background: '#D9B77A' }} />
          <input
            type="range" min={0} max={dur || 0} step={0.1} value={shown} aria-label="Tua video"
            onChange={(e) => { setScrub(Number(e.target.value)); poke(); }}
            onPointerUp={(e) => { const v = vRef.current; if (v) v.currentTime = Number(e.currentTarget.value); setScrub(null); }}
            onKeyUp={(e) => { const v = vRef.current; if (v) v.currentTime = Number(e.currentTarget.value); setScrub(null); }}
            onTouchEnd={(e) => { const v = vRef.current; if (v) v.currentTime = Number(e.currentTarget.value); setScrub(null); }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label={playing ? 'Tạm dừng' : 'Phát'} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10">
            {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
          <button type="button" onClick={() => seekBy(-10)} aria-label="Lùi 10 giây" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"><RotateCcw className="w-[18px] h-[18px]" /></button>
          <button type="button" onClick={() => seekBy(10)} aria-label="Tới 10 giây" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"><RotateCw className="w-[18px] h-[18px]" /></button>
          <span className="ml-1 text-[12px] tabular-nums text-white/85 whitespace-nowrap">{fmtTime(shown)} / {fmtTime(dur)}</span>
          <span className="flex-1" />
          <button type="button" onClick={cycleSpeed} aria-label="Tốc độ phát" title={locked ? 'Lần xem đầu chỉ xem tốc độ 1x' : 'Tốc độ phát'}
            className={`h-8 min-w-[44px] px-2 rounded-lg text-[12.5px] font-semibold hover:bg-white/10 tabular-nums inline-flex items-center gap-1 ${locked ? 'text-white/60' : ''}`}>
            {locked && <Lock className="w-3 h-3" />}{speed}x
          </button>
          <button type="button" onClick={toggleFs} aria-label="Toàn màn hình" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10">
            {isFs ? <Minimize className="w-[18px] h-[18px]" /> : <Maximize className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Admin: quản lý video ----------------
function ManageDrawer({ open, onClose, videos, meId, onChanged }) {
  const cfg = useContext(HandbookCfg);
  const [drafts, setDrafts] = useState({});    // episode -> {title, subtitle}
  const [up, setUp] = useState({});            // episode -> {pct, name, error}
  const [savingEp, setSavingEp] = useState(null);
  const [adding, setAdding] = useState(false);
  const bulkRef = useRef(null);

  useEffect(() => {
    if (open) setDrafts(Object.fromEntries(videos.map(v => [v.episode, { title: v.title || '', subtitle: v.subtitle || '' }])));
  }, [open, videos]);

  const busy = Object.values(up).some(u => u.pct != null && u.pct < 100 && !u.error);
  const patch = async (episode, values) => {
    const { error } = await supabase.from(cfg.videosTable)
      .update({ ...values, updated_by: meId, updated_at: new Date().toISOString() }).eq('episode', episode);
    if (error) throw new Error(error.message);
  };

  const uploadOne = async (episode, file) => {
    setUp(u => ({ ...u, [episode]: { pct: 0, name: file.name } }));
    try {
      const duration = await readDuration(file);
      const url = await uploadVideo(file, cfg.folder, (pct) => setUp(u => ({ ...u, [episode]: { ...u[episode], pct: Math.min(pct, 99) } })));
      await patch(episode, { video_url: url, ...(duration ? { duration_sec: duration } : {}) });
      setUp(u => ({ ...u, [episode]: { ...u[episode], pct: 100 } }));
      return true;
    } catch (e) {
      setUp(u => ({ ...u, [episode]: { ...u[episode], error: e.message } }));
      return false;
    }
  };

  const onBulk = async (fileList) => {
    const files = [...(fileList || [])].filter(f => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    const known = new Set(videos.map(v => v.episode));
    const matched = files.map(f => ({ f, ep: episodeFromName(f.name) })).filter(x => known.has(x.ep));
    const skipped = files.length - matched.length;
    if (!matched.length) { toast.error(`Không khớp được ${cfg.unitLower} nào — đặt tên file bắt đầu bằng "${cfg.filePrefix}01", "${cfg.filePrefix}02"…`); return; }
    if (skipped) toast.warning(`${skipped} file không khớp ${cfg.unitLower} nào (tên file cần bắt đầu bằng "${cfg.filePrefix}01", "${cfg.filePrefix}02"…)`);
    let ok = 0;
    // Tải lần lượt 2 file 1 lúc — đỡ nghẽn mạng, vẫn nhanh
    const queue = [...matched];
    const worker = async () => { while (queue.length) { const { f, ep } = queue.shift(); if (await uploadOne(ep, f)) ok += 1; } };
    await Promise.all([worker(), worker()]);
    toast.success(`Đã tải lên ${ok}/${matched.length} video`);
    onChanged();
  };

  const onSingle = async (episode, file) => { if (file && await uploadOne(episode, file)) { toast.success(`Đã tải video ${cfg.unit} ${pad2(episode)}`); onChanged(); } };

  const onThumb = async (episode, file) => {
    if (!file) return;
    try {
      const url = await uploadToR2(file, cfg.folder);
      await patch(episode, { thumbnail_url: url });
      toast.success(`Đã đổi ảnh ${cfg.unit} ${pad2(episode)}`);
      onChanged();
    } catch (e) { toast.error(e.message); }
  };
  const resetThumb = async (episode) => { try { await patch(episode, { thumbnail_url: null }); onChanged(); } catch (e) { toast.error(e.message); } };

  // Thêm tập kế tiếp (số lớn nhất + 1) — sau đó sửa tên / mô tả, tải video như các tập khác
  const addEpisode = async () => {
    const episode = Math.max(0, ...videos.map(v => v.episode)) + 1;
    setAdding(true);
    const { error } = await supabase.from(cfg.videosTable).insert({ episode, title: `${cfg.unit} ${pad2(episode)}`, updated_by: meId });
    setAdding(false);
    if (error) { toast.error(/duplicate|unique/i.test(error.message) ? `${cfg.unit} ${pad2(episode)} đã có nhưng đang ẩn — bật lại trong database` : error.message); return; }
    toast.success(`Đã thêm ${cfg.unit} ${pad2(episode)} — đặt tên và tải video lên`);
    onChanged();
  };

  const saveText = async (v) => {
    const d = drafts[v.episode];
    if (!d?.title.trim()) { toast.error(`Tên ${cfg.unitLower} không được trống`); return; }
    setSavingEp(v.episode);
    try { await patch(v.episode, { title: d.title.trim(), subtitle: d.subtitle.trim() || null }); toast.success('Đã lưu'); onChanged(); }
    catch (e) { toast.error(e.message); }
    setSavingEp(null);
  };

  return (
    <Drawer open={open} onClose={() => !busy && onClose()} size="lg" title={`Quản lý video ${cfg.name}`}
      description="Video tải thẳng lên kho lưu trữ R2. Giữ màn hình này mở tới khi tải xong.">
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/50 p-4 text-center">
          <Upload className="w-6 h-6 mx-auto text-teal-600" />
          <div className="mt-1.5 text-[14px] font-semibold text-slate-800">Tải lên nhiều video cùng lúc</div>
          <div className="text-[12.5px] text-slate-500 mt-0.5">Chọn các file "{cfg.filePrefix}01_…mp4", "{cfg.filePrefix}02_…mp4"… (nhiều file 1 lần), app tự khớp đúng {cfg.unitLower}.</div>
          <button type="button" disabled={busy} onClick={() => bulkRef.current?.click()} className="e-btn e-btn-primary e-btn-sm mt-3"><Upload />Chọn video</button>
          <input ref={bulkRef} type="file" accept="video/*" multiple hidden onChange={(e) => { onBulk(e.target.files); e.target.value = ''; }} />
        </div>

        {videos.map(v => {
          const d = drafts[v.episode] || { title: '', subtitle: '' };
          const u = up[v.episode];
          const changed = d.title !== (v.title || '') || d.subtitle !== (v.subtitle || '');
          return (
            <div key={v.episode} className="e-card p-3 flex gap-3">
              <div className="w-[72px] shrink-0">
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-200">
                  <img src={thumbOf(v, cfg)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <label className="mt-1.5 flex items-center justify-center gap-1 text-[11.5px] font-medium text-teal-700 cursor-pointer hover:underline">
                  <ImagePlus className="w-3.5 h-3.5" />Đổi ảnh
                  <input type="file" accept="image/*" hidden onChange={(e) => { onThumb(v.episode, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {v.thumbnail_url && <button type="button" onClick={() => resetThumb(v.episode)} className="block w-full text-center text-[11px] text-slate-400 hover:text-slate-600">Ảnh gốc</button>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-teal-700">{cfg.unit} {pad2(v.episode)}{v.duration_sec ? ` · ${fmtTime(v.duration_sec)}` : ''}</span>
                  {v.video_url
                    ? <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />Đã có video</span>
                    : <span className="text-[11.5px] font-medium text-amber-600">Chưa có video</span>}
                </div>
                <input className="e-input h-9 text-[13.5px]" value={d.title} placeholder={`Tên ${cfg.unitLower}`}
                  onChange={(e) => setDrafts(s => ({ ...s, [v.episode]: { ...d, title: e.target.value } }))} />
                <textarea className="e-input h-auto py-2 text-[13px] resize-none" rows={2} value={d.subtitle} placeholder="Mô tả ngắn"
                  onChange={(e) => setDrafts(s => ({ ...s, [v.episode]: { ...d, subtitle: e.target.value } }))} />
                {u && (
                  <div className="text-[12px]">
                    {u.error
                      ? <span className="text-danger-600">Lỗi: {u.error}</span>
                      : (
                        <div>
                          <div className="flex justify-between text-slate-500"><span className="truncate min-w-0">{u.name}</span><span className="tabular-nums shrink-0 ml-2">{u.pct >= 100 ? 'Xong' : `${u.pct}%`}</span></div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full transition-all ${u.pct >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${u.pct}%` }} /></div>
                        </div>
                      )}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className={`e-btn e-btn-secondary e-btn-sm cursor-pointer ${busy ? 'opacity-55 pointer-events-none' : ''}`}>
                    <Film />{v.video_url ? 'Thay video' : 'Chọn video'}
                    <input type="file" accept="video/*" hidden onChange={(e) => { onSingle(v.episode, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {changed && (
                    <button type="button" disabled={savingEp === v.episode} onClick={() => saveText(v)} className="e-btn e-btn-primary e-btn-sm">
                      {savingEp === v.episode && <Loader2 className="animate-spin" />}Lưu
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <button type="button" disabled={adding || busy} onClick={addEpisode} className="e-btn e-btn-outline e-btn-sm w-full">
          {adding ? <Loader2 className="animate-spin" /> : <Plus />}Thêm {cfg.unitLower} mới ({cfg.unit} {pad2(Math.max(0, ...videos.map(v => v.episode)) + 1)})
        </button>
      </div>
    </Drawer>
  );
}

// ---------------- Admin / Kế toán / Cổ đông: tiến độ nhân viên ----------------
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');
const violationText = (x, cfg) => {
  const d = x.detail || {};
  const ep = `${cfg.unit} ${pad2(d.episode || x.ref)}`;
  if (x.kind === 'speed') return `${ep} · cố tăng tốc độ${d.rate ? ` (${d.rate})` : ''} lúc ${d.at || '?'}`;
  return `${ep} · cố tua từ ${d.at || '?'} tới ${d.to || '?'}${d.duration ? ` / ${fmtTime(d.duration)}` : ''}`;
};

function TeamProgressDrawer({ open, onClose, videos }) {
  const cfg = useContext(HandbookCfg);
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setOpenId(null);
    (async () => {
      const [{ data: staff }, { data: prog }, { data: vio }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_url').eq('is_active', true).order('full_name'),
        supabase.from(cfg.progressTable).select('*'),
        supabase.from('training_violations').select('id, user_id, ref, kind, detail, created_at').eq('module', cfg.key).order('created_at', { ascending: false }).limit(2000),
      ]);
      if (!alive) return;
      const by = {};
      (prog || []).forEach(p => { (by[p.user_id] ||= []).push(p); });
      const vby = {};
      (vio || []).forEach(x => { (vby[x.user_id] ||= []).push(x); });
      setRows((staff || []).map(s => {
        const ps = by[s.id] || [];
        const done = new Set(ps.filter(p => p.completed).map(p => p.episode));
        const views = ps.reduce((n, p) => n + (p.views || 0), 0);
        return { ...s, done, started: ps.length, views, prog: Object.fromEntries(ps.map(p => [p.episode, p])), vio: vby[s.id] || [] };
      }).sort((a, b) => b.done.size - a.done.size || b.started - a.started || (a.full_name || '').localeCompare(b.full_name || '', 'vi')));
    })();
    return () => { alive = false; };
  }, [open, cfg.progressTable, cfg.key]);

  const total = videos.length;
  const finished = rows?.filter(r => r.done.size >= total && total > 0).length || 0;
  const vioPeople = rows?.filter(r => r.vio.length).length || 0;

  return (
    <Drawer open={open} onClose={onClose} size="lg" title={`Tiến độ xem ${cfg.name}`}
      description={rows ? `${finished}/${rows.length} nhân viên đã xem hết ${total} ${cfg.unitLower}${vioPeople ? ` · ${vioPeople} người có vi phạm tua` : ''}` : 'Đang tải…'}>
      {!rows ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>
      ) : (
        <ul className="divide-y divide-slate-100 -mx-1">
          {rows.map(r => {
            const isOpen = openId === r.id;
            return (
              <li key={r.id} className="px-1 py-2.5">
                <button type="button" onClick={() => setOpenId(isOpen ? null : r.id)} className="w-full flex items-center gap-3 text-left">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-teal-50 text-teal-700 grid place-items-center overflow-hidden text-[13px] font-semibold">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.full_name || '?').trim().split(/\s+/).pop()?.[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-slate-800 truncate">{r.full_name || '—'}</span>
                      {r.vio.length > 0 && <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-0.5"><AlertTriangle className="w-3 h-3" />{r.vio.length} vi phạm</span>}
                    </div>
                    <div className="mt-1 flex gap-1">
                      {videos.map(v => (
                        <span key={v.episode} title={`${cfg.unit} ${pad2(v.episode)}`} className={`h-1.5 flex-1 rounded-full ${r.done.has(v.episode) ? 'bg-emerald-500' : r.prog[v.episode] ? 'bg-amber-300' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <div className="mt-1 text-[11.5px] text-slate-500">{r.views ? `${r.views} lượt xem` : 'Chưa xem'}</div>
                  </div>
                  <span className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${r.done.size >= total ? 'text-emerald-600' : r.done.size ? 'text-slate-700' : 'text-slate-400'}`}>{r.done.size}/{total}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="mt-2.5 ml-12 space-y-3">
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      {videos.map(v => {
                        const p = r.prog[v.episode];
                        const pct = p?.completed ? 100 : (v.duration_sec ? Math.min(99, Math.round((Number(p?.max_sec) || 0) / v.duration_sec * 100)) : 0);
                        return (
                          <div key={v.episode} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] odd:bg-slate-50/60">
                            <span className="w-12 shrink-0 font-semibold text-slate-500 tabular-nums">{cfg.unit} {pad2(v.episode)}</span>
                            <span className="flex-1 min-w-0 truncate text-slate-700">{v.title}</span>
                            <span className={`w-16 shrink-0 text-right tabular-nums ${p?.completed ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>{p?.completed ? '✓ xong' : p ? `${pct}%` : '—'}</span>
                            <span className="w-16 shrink-0 text-right tabular-nums text-slate-500">{p?.views ? `${p.views} lần` : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                    {r.vio.length > 0 ? (
                      <div>
                        <div className="text-[12.5px] font-semibold text-amber-700 mb-1">Nhật ký vi phạm ({r.vio.length})</div>
                        <ul className="space-y-1">
                          {r.vio.map(x => (
                            <li key={x.id} className="flex gap-2 text-[12.5px] text-slate-700">
                              <span className="shrink-0 text-slate-400 tabular-nums">{fmtDT(x.created_at)}</span>
                              <span className="min-w-0">{violationText(x, cfg)}{x.detail?.device ? <span className="text-slate-400"> · {x.detail.device}</span> : null}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : <div className="text-[12.5px] text-slate-400">Không có vi phạm tua / tăng tốc.</div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
