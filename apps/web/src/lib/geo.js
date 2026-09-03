// Helper vị trí dùng chung cho chấm công GPS/IP và chấm công KHUÔN MẶT.
// (Tách từ AttendancePage.jsx — logic giữ nguyên, không viết lại.)

// Tọa độ văn phòng Dr Tuấn Hùng - 10 ngõ 168 Hào Nam, Hà Nội
export const OFFICE_LAT = 21.025956;
export const OFFICE_LNG = 105.828384;
export const OFFICE_RADIUS_M = 200; // bán kính cho phép 200m

// Thay đổi địa chỉ IP Public của phòng khám ở đây. Để mảng rỗng [] nếu không muốn check IP.
export const OFFICE_IPS = ['42.114.215.104'];

export const calcDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const getLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('Thiết bị không hỗ trợ GPS')); return; }
  navigator.geolocation.getCurrentPosition(
    pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    () => reject(new Error('Không lấy được vị trí. Vui lòng bật GPS.')),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

export const getPublicIP = async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch { return null; }
};
