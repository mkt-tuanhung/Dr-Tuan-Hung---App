// Định danh thiết bị lưu trong localStorage (mỗi trình duyệt/thiết bị 1 id riêng)
export const getDeviceId = () => {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = (window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    localStorage.setItem('device_id', id);
  }
  return id;
};

export const getDeviceLabel = () => {
  const ua = navigator.userAgent;
  let os = 'Thiết bị';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iPhone/iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS/.test(ua)) os = 'Mac';
  else if (/Windows/.test(ua)) os = 'Windows';
  let br = '';
  if (/Edg/.test(ua)) br = 'Edge';
  else if (/Chrome/.test(ua)) br = 'Chrome';
  else if (/Firefox/.test(ua)) br = 'Firefox';
  else if (/Safari/.test(ua)) br = 'Safari';
  return [os, br].filter(Boolean).join(' · ');
};
