// ============================================================
// BẢNG DỮ LIỆU DÙNG CHUNG (theo Ethics ds/components/DataTable.tsx)
// - Bấm tiêu đề cột để sắp xếp (tăng -> giảm -> bỏ), cột có sortValue mới sắp được
// - Phân trang phía máy + chân bảng "Hiển thị x–y / n"
// - Ô tick chọn dòng (đầu hoặc cuối dòng — mockup D05 đặt ở cuối)
// - Trạng thái đang tải (khung xương) / trống / lỗi có sẵn
// - Bấm dòng (onRowClick) để mở ngăn chi tiết
//
// columns: [{ key, header, cell(row), sortValue?(row), align?: 'left'|'right'|'center', width?, className? }]
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState } from './States.jsx';

const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

// 1 … 4 5 6 … 12
const pageList = (page, count) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(count - 1, page + 1);
  if (from > 2) out.push('…');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < count - 1) out.push('…');
  out.push(count);
  return out;
};

export function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="e-pagination" aria-label="Phân trang">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Trang trước"><ChevronLeft /></button>
      {pageList(page, pageCount).map((p, i) => (p === '…'
        ? <span key={`e${i}`} aria-hidden className="px-1 text-slate-400">…</span>
        : <button key={p} type="button" aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>))}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Trang sau"><ChevronRight /></button>
    </nav>
  );
}

export function Checkbox({ checked, indeterminate = false, onChange, ...rest }) {
  return (
    <input
      type="checkbox"
      className="e-checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onChange={onChange}
      {...rest}
    />
  );
}

export default function DataTable({
  columns, rows, getRowId = (r) => r.id,
  loading = false, error = null, onRetry,
  empty, onRowClick,
  selectable = false, selected, onSelectedChange, selectPosition = 'start',
  pageSize = 10, initialSort = null, footerStart,
  rowClassName, minWidth, caption, bare = false,
}) {
  const atEnd = selectPosition === 'end';
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = sort && columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const mult = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va ?? ''), String(vb ?? ''))) * mult;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Bộ lọc đổi làm danh sách ngắn lại -> quay về trang hợp lệ
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleIds = visible.map(getRowId);
  const allChecked = selectable && visibleIds.length > 0 && visibleIds.every(id => selected?.has(id));
  const someChecked = selectable && visibleIds.some(id => selected?.has(id));

  const toggleSort = (key) => setSort(s => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
  const toggleRow = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedChange?.(next);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) visibleIds.forEach(id => next.delete(id)); else visibleIds.forEach(id => next.add(id));
    onSelectedChange?.(next);
  };

  const colCount = columns.length + (selectable ? 1 : 0);
  const alignCls = (c) => (c.align === 'right' ? 'num' : c.align === 'center' ? 'text-center' : '');

  let body;
  if (error) {
    body = <tr><td colSpan={colCount} className="!h-auto"><ErrorState onRetry={onRetry} /></td></tr>;
  } else if (loading) {
    body = Array.from({ length: Math.min(pageSize, 6) }, (_, i) => (
      <tr key={i} aria-hidden>
        {selectable && !atEnd && <td className="e-col-check"><div className="w-[18px] h-[18px] rounded bg-slate-100 animate-pulse mx-auto" /></td>}
        {columns.map(c => (
          <td key={c.key}><div className={`h-3.5 rounded bg-slate-100 animate-pulse ${c.align === 'right' ? 'w-20 ml-auto' : 'w-[70%]'}`} /></td>
        ))}
        {selectable && atEnd && <td className="e-col-check"><div className="w-[18px] h-[18px] rounded bg-slate-100 animate-pulse mx-auto" /></td>}
      </tr>
    ));
  } else if (visible.length === 0) {
    body = (
      <tr><td colSpan={colCount} className="!h-auto">
        <EmptyState title={empty?.title ?? 'Không có dữ liệu'} description={empty?.description} action={empty?.action} icon={empty?.icon} />
      </td></tr>
    );
  } else {
    body = visible.map(row => {
      const id = getRowId(row);
      const checkCell = (
        <td className="e-col-check" onClick={e => e.stopPropagation()}>
          <Checkbox checked={!!selected?.has(id)} onChange={() => toggleRow(id)} aria-label="Chọn dòng" />
        </td>
      );
      return (
        <tr
          key={id}
          data-clickable={!!onRowClick}
          data-selected={selected?.has(id) || undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row); } : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          className={rowClassName?.(row)}
        >
          {selectable && !atEnd && checkCell}
          {columns.map(c => <td key={c.key} className={`${alignCls(c)} ${c.className || ''}`}>{c.cell(row)}</td>)}
          {selectable && atEnd && checkCell}
        </tr>
      );
    });
  }

  const headCheck = (
    <th className="e-col-check">
      <Checkbox checked={!!allChecked} indeterminate={!allChecked && !!someChecked} onChange={toggleAll} aria-label="Chọn tất cả" />
    </th>
  );

  const table = (
    <>
      <div className="e-table-wrap">
        <table className="e-table" style={minWidth ? { minWidth } : undefined} aria-busy={loading || undefined}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {selectable && !atEnd && headCheck}
              {columns.map(c => {
                const active = sort?.key === c.key;
                const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} className={alignCls(c)} style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortValue ? (
                      <button type="button" className="e-sort" data-active={active} onClick={() => toggleSort(c.key)}>
                        {c.header}<SortIcon aria-hidden />
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
              {selectable && atEnd && headCheck}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
      {(pageCount > 1 || footerStart) && !loading && !error && sorted.length > 0 && (
        <div className="e-table-footer">
          <span>{footerStart ?? `Hiển thị ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} / ${sorted.length}`}</span>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </>
  );

  return bare ? table : <div className="e-card overflow-hidden">{table}</div>;
}
