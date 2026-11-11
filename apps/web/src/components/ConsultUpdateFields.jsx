// Khung "Cập nhật hồ sơ tư vấn" khi chuyển khách CỌC / BONG -> PHẪU THUẬT:
// khách tư vấn thêm dịch vụ khác -> sale sửa nội dung tư vấn + thêm ảnh hồ sơ mới.
// Ảnh mới được NỐI vào consult_image_urls (không xoá ảnh cũ); schedule-telegram tự gửi ảnh mới
// + "HỒ SƠ TƯ VẤN — CẬP NHẬT" vào nhóm HỒ SƠ.
import React, { useRef } from 'react';
import { ImagePlus, X, FileText } from 'lucide-react';
import { uploadToR2 } from '@/lib/r2Client';

export const uploadConsultFiles = async (files = []) => {
  const out = [];
  for (const f of files) out.push(await uploadToR2(f, 'consult-files'));
  return out;
};

export default function ConsultUpdateFields({ note, onNote, existing = [], files = [], onFiles }) {
  const ref = useRef(null);
  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-2.5">
      <div className="text-[13px] font-bold text-teal-800 inline-flex items-center gap-1.5"><FileText className="w-4 h-4" />Cập nhật hồ sơ tư vấn</div>
      <div>
        <label className="e-label">Nội dung tư vấn <span className="text-slate-400 font-normal">(sửa / bổ sung dịch vụ khách tham khảo thêm)</span></label>
        <textarea rows={4} value={note} onChange={e => onNote(e.target.value)} className="e-input h-auto py-2"
          placeholder="VD: Khách cọc gọt hàm, tham khảo thêm nâng mũi — chốt làm cả 2…" />
      </div>
      <div>
        <label className="e-label">Ảnh hồ sơ tư vấn <span className="text-slate-400 font-normal">({existing.length} ảnh cũ · thêm ảnh mới)</span></label>
        <div className="flex flex-wrap gap-2">
          {existing.map(u => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="h-14 w-14 rounded-lg overflow-hidden border border-slate-200 bg-white block">
              <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
            </a>
          ))}
          {files.map((f, i) => (
            <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border-2 border-teal-400">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onFiles(files.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <button type="button" onClick={() => ref.current?.click()} className="h-14 w-14 rounded-lg border-2 border-dashed border-teal-300 text-teal-600 grid place-items-center hover:bg-teal-50"><ImagePlus className="w-5 h-5" /></button>
        </div>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { const add = [...(e.target.files || [])]; e.target.value = ''; if (add.length) onFiles([...files, ...add]); }} />
      </div>
    </div>
  );
}
