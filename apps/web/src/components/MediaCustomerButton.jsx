import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Clapperboard, Plus, ExternalLink, X, Film, Scissors, Image as ImageIcon } from 'lucide-react';

const parseLinks = (t) => (t || '').split('\n').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));

// Nút gắn/xem KHO MEDIA cho 1 khách (dùng ở Hậu phẫu, hồ sơ khách...).
// appointment: { id, customer_name, phone }
export default function MediaCustomerButton({ appointment, me, canAdd = true }) {
  const [store, setStore] = useState(undefined); // undefined=loading | null=chưa có | object
  const [clips, setClips] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [links, setLinks] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!appointment?.id) return;
    const { data } = await supabase.from('media_customers').select('*').eq('appointment_id', appointment.id).order('created_at').limit(1);
    const s = (data && data[0]) || null;
    setStore(s);
    if (s) {
      const { data: cl } = await supabase.from('media_clips').select('clip_links, thumb_links').eq('media_customer_id', s.id);
      setClips(cl || []);
    } else setClips([]);
  }, [appointment?.id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setSaving(true);
    const { error } = await supabase.from('media_customers').insert({
      appointment_id: appointment.id, customer_name: appointment.customer_name, customer_phone: appointment.phone,
      media_id: me?.id, source_links: parseLinks(links),
    });
    setSaving(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success('Đã gắn vào kho media'); setAddOpen(false); setLinks(''); load();
  };

  if (store === undefined) return null;
  const hasMedia = !!store;
  const sourceLinks = store?.source_links || [];
  const clipLinks = clips.flatMap(c => c.clip_links || []);
  const thumbLinks = clips.flatMap(c => c.thumb_links || []);

  return (
    <>
      {hasMedia ? (
        <button type="button" onClick={() => setViewOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <Clapperboard className="w-4 h-4" /> Đã có media
        </button>
      ) : canAdd ? (
        <button type="button" onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
          <Plus className="w-4 h-4" /> Thêm kho media
        </button>
      ) : null}

      {addOpen && (
        <Modal title="Thêm vào kho media" onClose={() => setAddOpen(false)}>
          <p className="text-sm text-slate-500 mb-3">Khách: <b>{appointment.customer_name}</b> · {appointment.phone}</p>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Link nguồn Google Drive (mỗi dòng 1 link · có thể để trống, Media bổ sung sau)</label>
          <textarea autoFocus value={links} onChange={e => setLinks(e.target.value)} rows={3} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-400 outline-none mb-4" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-50 text-sm">Hủy</button>
            <button onClick={add} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-sm">{saving ? 'Đang lưu…' : 'Gắn media'}</button>
          </div>
        </Modal>
      )}

      {viewOpen && (
        <Modal title="Media của khách" onClose={() => setViewOpen(false)}>
          <p className="text-sm text-slate-500 mb-3">Khách: <b>{appointment.customer_name}</b></p>
          <Section icon={Film} label="Nguồn (Media)" links={sourceLinks} />
          <Section icon={Scissors} label="Clip đã dựng" links={clipLinks} />
          <Section icon={ImageIcon} label="Thumbnail" links={thumbLinks} />
          {sourceLinks.length + clipLinks.length + thumbLinks.length === 0 && <p className="text-sm text-slate-400">Chưa có link nào. Media sẽ bổ sung trong “Sản xuất Ads”.</p>}
        </Modal>
      )}
    </>
  );
}

const Section = ({ icon: Icon, label, links }) => (
  (links || []).length === 0 ? null : (
    <div className="mb-3">
      <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="flex flex-col gap-1">
        {links.map((l, i) => (
          <a key={i} href={l} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> {label} {i + 1}</a>
        ))}
      </div>
    </div>
  )
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="px-5 py-3.5 border-b flex justify-between items-center">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
