// ============================================================
// FACE ATTENDANCE ENGINE — CRM backend là nơi QUYẾT ĐỊNH chấm công.
// Điện thoại chỉ gửi: embedding + liveness + GPS/IP + requestId.
// Server: đối chiếu auth.uid() (không tin employeeId từ client) ->
// so khớp khuôn mặt với template đã mã hóa -> kiểm tra vị trí theo
// face_config -> quyết định đi muộn/trùng lượt -> ghi bảng attendance CŨ
// -> insert notifications (tự bắn Push + Telegram cá nhân qua webhook sẵn có)
// -> gửi Telegram nhóm nếu cấu hình TELEGRAM_ATTENDANCE_CHAT_ID.
// Idempotency: request_id unique trong face_attendance_audit.
// Deploy: supabase functions deploy face-attendance
// Secrets cần: FACE_TEMPLATE_KEY (bắt buộc), TELEGRAM_ATTENDANCE_CHAT_ID (tùy chọn).
// ============================================================
import {
  CORS, json, serviceClient, getAuthedUser,
  normalize, cosine, validEmbedding, decryptTemplate,
  loadFaceConfig, haversineM, vnNow,
} from '../_shared/face.ts';

const fmtHM = (t: string) => t.slice(0, 5);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const db = serviceClient();
  let audit: Record<string, unknown> = {};

  // Ghi audit + trả kết quả (mọi nhánh đều đi qua đây)
  const finish = async (result: 'ACCEPTED' | 'REJECTED' | 'ERROR', payload: Record<string, unknown>, status = 200) => {
    try {
      if (audit.request_id) {
        await db.from('face_attendance_audit').insert({ ...audit, result, error_code: payload.errorCode || null, result_json: payload });
      }
    } catch { /* trùng request_id do race -> bỏ qua, kết quả cũ đã có */ }
    return json(payload, status);
  };

  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ accepted: false, errorCode: 'UNAUTHORIZED' }, 401);

    const body = await req.json();
    const requestId = String(body?.requestId || '');
    const action = body?.action === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN';
    if (!requestId || requestId.length < 8 || requestId.length > 64) {
      return json({ accepted: false, errorCode: 'UNKNOWN', message: 'Thiếu requestId' }, 400);
    }

    // IDEMPOTENCY: app retry do mạng yếu -> trả đúng kết quả cũ, không ghi công 2 lần
    const { data: prev } = await db.from('face_attendance_audit').select('result_json').eq('request_id', requestId).maybeSingle();
    if (prev?.result_json) return json(prev.result_json);

    audit = {
      request_id: requestId,
      user_id: user.id,
      action,
      quality_score: Number(body?.quality) || null,
      liveness_score: Number(body?.liveness?.score) || null,
      liveness_method: body?.liveness?.method || null,
      device_id: body?.device?.deviceId ? String(body.device.deviceId).slice(0, 128) : null,
      model_version: body?.modelVersion ? String(body.modelVersion).slice(0, 64) : null,
    };

    const cfg = await loadFaceConfig(db);
    if (!cfg) return finish('ERROR', { accepted: false, errorCode: 'UNKNOWN', message: 'Chưa chạy face_attendance.sql (thiếu face_config)' }, 500);

    // ---------- 1) FACE PROFILE ----------
    const { data: fp } = await db.from('face_profiles').select('status, template_enc').eq('user_id', user.id).maybeSingle();
    if (!fp || !fp.template_enc || fp.status === 'NEEDS_REENROLLMENT') {
      return finish('REJECTED', { accepted: false, errorCode: 'FACE_NOT_ENROLLED', message: 'Tài khoản chưa đăng ký khuôn mặt' });
    }
    if (fp.status !== 'ACTIVE') {
      return finish('REJECTED', { accepted: false, errorCode: 'CRM_REJECTED', message: 'Face ID của tài khoản đã bị khóa' });
    }

    // ---------- 2) EMBEDDING SAMPLES ----------
    const raw: unknown[] = body?.embeddings || [];
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 6 || !raw.every(validEmbedding)) {
      return finish('REJECTED', { accepted: false, errorCode: 'UNKNOWN', message: 'Dữ liệu khuôn mặt không hợp lệ' }, 400);
    }
    const samples = (raw as number[][]).map(normalize);
    // Chống replay 1 embedding tĩnh: các frame thật luôn có nhiễu tự nhiên
    let identical = true;
    for (let i = 1; i < samples.length && identical; i++) {
      if (cosine(samples[0], samples[i]) < 0.99999) identical = false;
    }
    if (identical) {
      return finish('REJECTED', { accepted: false, errorCode: 'LIVENESS_FAILED', message: 'Không xác minh được người thật' });
    }

    // ---------- 3) LIVENESS + QUALITY ----------
    if (cfg.require_liveness) {
      const lv = body?.liveness;
      if (!lv?.passed || Number(lv.score) < Number(cfg.liveness_threshold)) {
        return finish('REJECTED', { accepted: false, errorCode: 'LIVENESS_FAILED', message: 'Không xác minh được người thật' });
      }
    }
    if (Number(body?.quality || 0) < Number(cfg.min_quality)) {
      return finish('REJECTED', { accepted: false, errorCode: 'FACE_BLURRY', message: 'Chất lượng hình khuôn mặt quá thấp' });
    }

    // ---------- 4) FACE MATCH 1:1 (template không rời server) ----------
    const template = normalize(await decryptTemplate(fp.template_enc));
    if (template.length !== samples[0].length) {
      return finish('REJECTED', { accepted: false, errorCode: 'FACE_NOT_ENROLLED', message: 'Face Profile khác phiên bản model — vui lòng đăng ký lại khuôn mặt' });
    }
    const scores = samples.map((s) => cosine(template, s));
    const matchScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    audit.match_score = Number(matchScore.toFixed(4));
    if (matchScore < Number(cfg.face_match_threshold)) {
      return finish('REJECTED', { accepted: false, errorCode: 'FACE_NOT_MATCHED', matchScore: audit.match_score, message: 'Khuôn mặt không khớp tài khoản' });
    }

    // ---------- 5) GPS / WI-FI (tái sử dụng quy tắc cũ, rule nằm trong config) ----------
    const gps = body?.gps || null;
    let gpsVerified = false, gpsDistance: number | null = null;
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      gpsDistance = Math.round(haversineM(gps.latitude, gps.longitude, Number(cfg.office_lat), Number(cfg.office_lng)));
      gpsVerified = gpsDistance <= Number(cfg.office_radius_m);
    }
    const officeIps: string[] = Array.isArray(cfg.office_ips) ? cfg.office_ips : [];
    const ip = body?.ip ? String(body.ip) : null;
    const wifiVerified = officeIps.length === 0 ? true : (!!ip && officeIps.includes(ip));
    audit.gps_verified = gpsVerified; audit.gps_distance_m = gpsDistance; audit.wifi_verified = wifiVerified;

    let locationWarning: string | null = null;
    if (!gpsVerified && !wifiVerified) locationWarning = `Sai vị trí${gpsDistance != null ? ` (${gpsDistance}m)` : ''} và sai mạng Wi-Fi`;
    else if (!gpsVerified) locationWarning = `Sai vị trí${gpsDistance != null ? ` (${gpsDistance}m so với VP)` : ' (không có GPS)'}`;
    else if (!wifiVerified) locationWarning = 'Sai mạng Wi-Fi';

    if (cfg.location_rule === 'require' && !gpsVerified && !wifiVerified) {
      return finish('REJECTED', {
        accepted: false, errorCode: gps ? 'GPS_NOT_ALLOWED' : 'WIFI_NOT_VERIFIED',
        message: 'Vị trí/mạng không hợp lệ — cần ở văn phòng để chấm công', locationWarning,
      });
    }

    // ---------- 6) ATTENDANCE ENGINE (server quyết định, giờ VN của server) ----------
    const { date, time } = vnNow();
    const { data: row } = await db.from('attendance').select('id, check_in, check_out, status').eq('staff_id', user.id).eq('date', date).maybeSingle();

    const locFields = {
      latitude: gps?.latitude ?? null, longitude: gps?.longitude ?? null,
      ip_address: ip, location_status: gpsVerified ? 'in_office' : 'outside',
    };

    let lateMinutes = 0, statusOut = 'present';

    if (action === 'CHECK_IN') {
      if (row?.check_in) {
        return finish('REJECTED', { accepted: false, errorCode: 'CRM_REJECTED', message: `Bạn đã check-in hôm nay lúc ${fmtHM(row.check_in)}` });
      }
      // Đi muộn: sau work_start + grace (quy tắc trong face_config, không hardcode)
      const [wh, wm] = String(cfg.work_start).split(':').map(Number);
      const [h, m] = time.split(':').map(Number);
      lateMinutes = Math.max(0, h * 60 + m - (wh * 60 + wm + Number(cfg.late_grace_min || 0)));
      statusOut = lateMinutes > 0 ? 'late' : 'present';

      const payload = { check_in: time, status: statusOut, check_in_method: 'face_ai', ...locFields };
      const { error } = row
        ? await db.from('attendance').update(payload).eq('id', row.id)
        : await db.from('attendance').insert({ staff_id: user.id, date, ...payload });
      if (error) throw error;
    } else {
      if (!row?.check_in) {
        return finish('REJECTED', { accepted: false, errorCode: 'CRM_REJECTED', message: 'Bạn chưa check-in hôm nay' });
      }
      if (row.check_out) {
        return finish('REJECTED', { accepted: false, errorCode: 'CRM_REJECTED', message: `Bạn đã check-out lúc ${fmtHM(row.check_out)}` });
      }
      const { error } = await db.from('attendance').update({ check_out: time, check_out_method: 'face_ai' }).eq('id', row.id);
      if (error) throw error;
      statusOut = row.status;
    }

    // ---------- 7) NOTIFICATION (pipeline sẵn có: notifications -> Push + Telegram cá nhân) ----------
    const actLabel = action === 'CHECK_IN' ? 'check-in' : 'check-out';
    const lateTxt = action === 'CHECK_IN' && lateMinutes > 0 ? ` Đi muộn ${lateMinutes} phút.` : '';
    await db.from('notifications').insert({
      user_id: user.id, type: 'attendance',
      title: `Bạn đã ${actLabel} lúc ${fmtHM(time)}.${lateTxt}`,
      body: `Phương thức: Face AI${locationWarning ? ` · ⚠️ ${locationWarning}` : ''}`,
      link: 'attendance',
    });

    // Telegram NHÓM (backend gửi — không bao giờ gửi ảnh khuôn mặt)
    const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const tgChat = Deno.env.get('TELEGRAM_ATTENDANCE_CHAT_ID');
    if (tgToken && tgChat) {
      const { data: prof } = await db.from('profiles').select('full_name').eq('id', user.id).single();
      const name = prof?.full_name || 'Nhân sự';
      const icon = lateMinutes > 0 ? '⚠️' : '✅';
      const text = `${icon} ${name} đã ${actLabel} lúc ${fmtHM(time)}${lateTxt ? ` — đi muộn ${lateMinutes} phút` : ''} (Face AI)${locationWarning ? `\n⚠️ ${locationWarning}` : ''}`;
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text }),
      }).catch(() => {});
    }

    return finish('ACCEPTED', {
      accepted: true, action, date, time, status: statusOut, lateMinutes,
      matchScore: audit.match_score, gpsVerified, wifiVerified, locationWarning,
    });
  } catch (e) {
    return finish('ERROR', { accepted: false, errorCode: 'UNKNOWN', message: (e as Error).message }, 500);
  }
});
