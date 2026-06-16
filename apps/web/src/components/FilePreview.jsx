import React from 'react';
import { FileText, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// FilePreview nhận urls trực tiếp (Supabase Storage public URLs)
// props: urls (string[]), onRemove (fn), showRemove (bool)
const FilePreview = ({ urls = [], onRemove, showRemove = false }) => {
  if (!urls || urls.length === 0) return null;

  const handleDownload = (url) => window.open(url, '_blank');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {urls.map((url, index) => {
        const filename = url.split('/').pop();
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
        const isPdf = /\.pdf$/i.test(filename);

        return (
          <div key={index} className="relative group rounded-xl border border-white/10 bg-card overflow-hidden shadow-sm hover:shadow-primary/10 transition-all duration-300">
            {isImage ? (
              <div className="relative aspect-video">
                <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                  <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-primary hover:text-primary-foreground backdrop-blur border-none" onClick={() => handleDownload(url)}>
                    <Download className="h-4 w-4 mr-2" /> Tải về
                  </Button>
                </div>
                {showRemove && onRemove && (
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => onRemove(url)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 h-full">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate" title={filename}>{filename}</p>
                  <p className="text-xs text-primary font-medium mt-0.5">{isPdf ? 'Tài liệu PDF' : 'Tập tin'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="icon" variant="ghost" className="hover:bg-primary/20 hover:text-primary" onClick={() => handleDownload(url)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {showRemove && onRemove && (
                    <Button size="icon" variant="ghost" className="hover:bg-destructive/20 hover:text-destructive" onClick={() => onRemove(url)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FilePreview;
