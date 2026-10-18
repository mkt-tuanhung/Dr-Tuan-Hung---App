// ============================================================
// Tiện ích dùng chung cho module TÀI LIỆU
// - loadPdfjs(): nạp pdf.js khi cần (không làm nặng bundle chính)
// - normText(): chữ thường + bỏ dấu, GIỮ NGUYÊN độ dài -> vị trí tìm thấy trong text_norm
//   trùng vị trí trong text gốc (để cắt đoạn trích + tô sáng)
// - chapterOf(): trang N thuộc chương / mục nào (theo mục lục toc)
// - extractPdf(): đọc số trang, chữ từng trang, mục lục (outline) và ảnh bìa từ 1 file PDF
// ============================================================

let pdfjsPromise = null;
export const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'), // eslint-disable-line import/no-unresolved
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
};

export const CATEGORIES = {
  noi_bo: { label: 'Nội bộ', cls: 'bg-teal-50 text-teal-800' },
  khach_hang: { label: 'Dành cho khách hàng', cls: 'bg-amber-50 text-amber-800' },
  quy_trinh: { label: 'Quy trình', cls: 'bg-indigo-50 text-indigo-700' },
  khac: { label: 'Khác', cls: 'bg-slate-100 text-slate-600' },
};
export const catOf = (c) => CATEGORIES[c] || CATEGORIES.khac;

// Gộp khoảng trắng — làm TRƯỚC normText để 2 chuỗi luôn dài bằng nhau
export const cleanText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Bỏ dấu từng ký tự (mỗi ký tự gốc -> đúng 1 ký tự) để giữ nguyên vị trí
export const normText = (s) => {
  let out = '';
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) {         // theo từng code unit -> dài đúng bằng chuỗi gốc
    const ch = str[i];
    if (ch === 'đ' || ch === 'Đ') { out += 'd'; continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += (base.length === 1 ? base : ch).toLowerCase().slice(0, 1) || ' ';
  }
  return out;
};
export const normQuery = (q) => normText(cleanText(q));

// Đoạn trích quanh chỗ tìm thấy: { before, match, after }
export const snippetOf = (text, textNorm, qn, radius = 70) => {
  const i = (textNorm || normText(text)).indexOf(qn);
  if (i < 0) return { before: String(text || '').slice(0, radius * 2), match: '', after: '' };
  const s = Math.max(0, i - radius);
  const e = Math.min(text.length, i + qn.length + radius);
  return {
    before: (s > 0 ? '…' : '') + text.slice(s, i),
    match: text.slice(i, i + qn.length),
    after: text.slice(i + qn.length, e) + (e < text.length ? '…' : ''),
  };
};

export const chapterOf = (toc, page) => {
  let chap = null;
  let item = null;
  for (const c of toc || []) {
    if (c.page <= page) { chap = c; item = null; }
    for (const it of c.items || []) if (it.page <= page && c.page <= page) item = it;
  }
  return { chap, item };
};
export const chapterLabel = (c) => (c ? `${c.no ? `${c.no} · ` : ''}${c.title}` : '');

// Mục lục từ outline (bookmark) của PDF — dùng khi tài liệu mới chưa có mục lục
const outlineToToc = async (pdf) => {
  const outline = await pdf.getOutline().catch(() => null);
  if (!outline?.length) return [];
  const pageOf = async (dest) => {
    try {
      const d = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
      if (!d) return null;
      return (await pdf.getPageIndex(d[0])) + 1;
    } catch { return null; }
  };
  const toc = [];
  for (const o of outline) {
    const page = await pageOf(o.dest);
    if (!page) continue;
    const items = [];
    for (const k of o.items || []) { const p = await pageOf(k.dest); if (p) items.push({ title: k.title, page: p }); }
    toc.push({ no: '', title: o.title, page, items });
  }
  return toc;
};

// Đọc toàn bộ PDF (File / ArrayBuffer): số trang, chữ từng trang, mục lục, ảnh bìa (Blob JPEG)
export const extractPdf = async (data, { onPage, cover = true } = {}) => {
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({ data: data instanceof ArrayBuffer ? data : await data.arrayBuffer() }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const text = cleanText(tc.items.map(it => (it.str || '') + (it.hasEOL ? ' ' : '')).join(' '));
    pages.push({ page: n, text, text_norm: normText(text) });
    page.cleanup();
    onPage?.(n, pdf.numPages);
  }
  const toc = await outlineToToc(pdf);
  let coverBlob = null;
  if (cover) {
    const p1 = await pdf.getPage(1);
    const vp1 = p1.getViewport({ scale: 1 });
    const vp = p1.getViewport({ scale: 640 / vp1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await p1.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    coverBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.84));
  }
  const numPages = pdf.numPages;
  await pdf.destroy();
  return { numPages, pages, toc, coverBlob };
};

export const fmtMinutes = (sec) => {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m} phút`;
  return `${Math.floor(m / 60)} giờ ${m % 60 ? `${m % 60} phút` : ''}`.trim();
};
