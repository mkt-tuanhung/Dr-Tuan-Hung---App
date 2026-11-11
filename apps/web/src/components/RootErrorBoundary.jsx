// Lớp bắt lỗi gốc: thay vì MÀN HÌNH TRẮNG khi có lỗi hiển thị / lỗi tải file code,
// hiện màn "Đang cập nhật / Tải lại". Lỗi do file code cũ (app vừa có bản mới) -> tự tải lại 1 lần.
import React from 'react';
import { safeReload, isChunkError } from '@/lib/safeReload';

export default class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) {
    console.error('[app] lỗi hiển thị', err);
    if (isChunkError(err)) safeReload('chunk error (boundary)');
  }
  render() {
    if (!this.state.err) return this.props.children;
    const chunk = isChunkError(this.state.err);
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F3F9F9', fontFamily: '-apple-system, system-ui, sans-serif', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <img src="/logo.png?v=2" alt="" style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a', marginBottom: 6 }}>{chunk ? 'App vừa có bản cập nhật mới' : 'Có lỗi khi hiển thị'}</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 18 }}>{chunk ? 'Đang tải bản mới…' : 'Bấm tải lại để tiếp tục làm việc.'}</div>
          <button onClick={() => { try { sessionStorage.removeItem('app_reload_at'); } catch { /* */ } safeReload('manual'); }}
            style={{ height: 44, padding: '0 22px', borderRadius: 14, border: 0, background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 15 }}>Tải lại</button>
        </div>
      </div>
    );
  }
}
