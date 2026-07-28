import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { uploadToR2 } from '@/lib/r2Client';
import { toast } from 'sonner';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import {
  Folder, FolderPlus, Upload, Loader2, Trash2, X, ChevronRight, Home, Download, Image as ImageLucide,
} from 'lucide-react';

const fmtSize = (n) => {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
};

export default function ImageLibrary({ me, canWrite }) {
  const [folders, setFolders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [cwd, setCwd] = useState(null);   // thư mục hiện tại; null = gốc
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [uploading, setUploading] = useState(0);   // số file đang lên
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const [{ data: f }, { data: a }] = await Promise.all([
      supabase.from('image_folders').select('*').order('name'),
      supabase.from('image_assets').select('*').order('created_at', { ascending: false }),
    ]);
    setFolders(f || []); setAssets(a || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('image_folders,image_assets', load);

  const byId = useMemo(() => Object.fromEntries(folders.map(f => [f.id, f])), [folders]);
  const subFolders = useMemo(() => folders.filter(f => (f.parent_id || null) === cwd), [folders, cwd]);
  const files = useMemo(() => assets.filter(a => (a.folder_id || null) === cwd), [assets, cwd]);
  const breadcrumb = useMemo(() => {
    const path = []; let cur = cwd;
    while (cur && byId[cur]) { path.unshift(byId[cur]); cur = byId[cur].parent_id; }
    return path;
  }, [cwd, byId]);

  const createFolder = async () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const { error } = await supabase.from('image_folders').insert({ name, parent_id: cwd, created_by: me?.id || null });
    if (error) { toast.error('Lỗi tạo thư mục: ' + error.message); return; }
    setNewName(''); setCreating(false); load();
  };

  const doUpload = async (fileList) => {
    const arr = [...fileList].filter(f => f.type.startsWith('image/'));
    if (!arr.length) { toast.error('Chỉ nhận file ảnh'); return; }
    setUploading(arr.length);
    let ok = 0;
    for (const f of arr) {
      try {
        const url = await uploadToR2(f, 'design-images');
        const { error } = await supabase.from('image_assets').insert({ folder_id: cwd, name: f.name, url, size: f.size, created_by: me?.id || null });
        if (!error) ok++;
      } catch (e) { console.error(e); }
      setUploading(u => u - 1);
    }
    toast.success(`Đã tải lên ${ok}/${arr.length} ảnh`);
    load();
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (!canWrite) return;
    if (e.dataTransfer?.files?.length) doUpload(e.dataTransfer.files);
  };

  const delFolder = async (f) => {
    if (!window.confirm(`Xoá thư mục "${f.name}" và toàn bộ ảnh bên trong?`)) return;
    const { error } = await supabase.from('image_folders').delete().eq('id', f.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã xoá thư mục'); load();
  };
  const delAsset = async (a) => {
    if (!window.confirm('Xoá ảnh này?')) return;
    const { error } = await supabase.from('image_assets').delete().eq('id', a.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) return <div className="flex justify-center h-40 items-center"><Loader2 className="w-7 h-7 text-teal-500 animate-spin" /></div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"
      onDragOver={e => { if (canWrite) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {/* Breadcrumb + hành động */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button onClick={() => setCwd(null)} className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-lg ${cwd === null ? 'text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}><Home className="w-4 h-4" />Thư viện ảnh</button>
        {breadcrumb.map(f => (
          <span key={f.id} className="inline-flex items-center gap-1">
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <button onClick={() => setCwd(f.id)} className="text-sm font-semibold text-slate-600 hover:bg-slate-50 px-2 py-1 rounded-lg truncate max-w-[160px]">{f.name}</button>
          </span>
        ))}
        {canWrite && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { setCreating(true); setNewName(''); }} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><FolderPlus className="w-4 h-4" />Tạo thư mục</button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-700"><Upload className="w-4 h-4" />Tải ảnh lên</button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) doUpload(e.target.files); e.target.value = ''; }} />
          </div>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 mb-4">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="Tên thư mục…" className="flex-1 max-w-xs px-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-fuchsia-400 outline-none" />
          <button onClick={createFolder} className="px-3 py-2 text-sm font-semibold rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-700">Tạo</button>
          <button onClick={() => setCreating(false)} className="px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-500">Huỷ</button>
        </div>
      )}

      {uploading > 0 && <div className="mb-3 text-sm text-fuchsia-600 font-semibold inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Đang tải {uploading} ảnh…</div>}

      {/* Vùng nội dung */}
      <div className={`rounded-2xl transition ${dragOver ? 'ring-2 ring-fuchsia-400 bg-fuchsia-50/40' : ''} ${subFolders.length === 0 && files.length === 0 ? 'border-2 border-dashed border-slate-200 py-16' : ''}`}>
        {subFolders.length === 0 && files.length === 0 ? (
          <div className="text-center text-slate-400">
            <ImageLucide className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Thư mục trống.{canWrite ? ' Kéo-thả ảnh vào đây hoặc bấm “Tải ảnh lên”.' : ''}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Thư mục con */}
            {subFolders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {subFolders.map(f => {
                  const count = assets.filter(a => a.folder_id === f.id).length + folders.filter(x => x.parent_id === f.id).length;
                  return (
                    <div key={f.id} className="group relative">
                      <button onClick={() => setCwd(f.id)} className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-fuchsia-300 hover:bg-fuchsia-50/40 text-left">
                        <Folder className="w-8 h-8 text-fuchsia-500 shrink-0 fill-fuchsia-100" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-700 truncate">{f.name}</div>
                          <div className="text-[11px] text-slate-400">{count} mục</div>
                        </div>
                      </button>
                      {canWrite && <button onClick={() => delFolder(f)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-white/90 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 grid place-items-center shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Ảnh */}
            {files.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
                {files.map(a => (
                  <div key={a.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                    <button onClick={() => setLightbox(a)} className="w-full h-full">
                      <img src={a.url} alt={a.name || ''} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                    {canWrite && <button onClick={() => delAsset(a)} className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-black/50 text-white hover:bg-rose-600 opacity-0 group-hover:opacity-100 grid place-items-center"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Xem lớn */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-7 h-7" /></button>
          <a href={lightbox.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="absolute top-4 left-4 text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"><Download className="w-5 h-5" />Tải/mở gốc</a>
          <img src={lightbox.url} alt={lightbox.name || ''} className="max-w-full max-h-[88vh] rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
