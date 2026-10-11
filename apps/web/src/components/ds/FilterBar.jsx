// ============================================================
// THANH LỌC (Ethics .filter-bar — mockup D05/D08):
// thẻ trắng chứa ô tìm + các ô chọn, nút chính dồn sang phải.
//   <FilterBar search={{ value, onChange, placeholder }} actions={<button…/>}>
//     <FilterSelect label="Vị trí" value={…} onChange={…} options={[{ value, label }]} />
//   </FilterBar>
// ============================================================
import React from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export function FilterSelect({ label, value, onChange, options, allLabel, className = '' }) {
  // value '' = tất cả -> hiện nhãn (VD "Vị trí") như placeholder của Ethics
  return (
    <label className={`e-filter-select ${value ? 'e-filter-select-on' : ''} ${className}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{allLabel || label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown aria-hidden />
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Tìm kiếm…', className = '' }) {
  return (
    <div className={`e-search ${className}`}>
      <Search />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="!bg-white !pr-8" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Xoá tìm kiếm"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function FilterBar({ search, children, actions, className = '' }) {
  return (
    <div className={`e-toolbar gap-3 ${className}`}>
      {search && <SearchInput {...search} className={`flex-1 min-w-[200px] sm:max-w-[320px] ${search.className || ''}`} />}
      {children}
      {actions && <div className="ml-auto flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
