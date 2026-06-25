import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Token lưu trong nội dung: @[Tên](staff:uuid) hoặc @[Tên](cust:uuid)
export const MENTION_RE = /@\[([^\]]+)\]\((staff|cust):([0-9a-fA-F-]+)\)/g;

export default function MentionInput({ value, onChange, onEnter, placeholder, staff = [], className }) {
  const ref = useRef(null);
  const [drop, setDrop] = useState(null); // { items, start }
  const [active, setActive] = useState(0);

  const detect = async (text, caret) => {
    const before = text.slice(0, caret);
    const m = before.match(/@([^\s@]*)$/);
    if (!m) { setDrop(null); return; }
    const q = m[1];
    const start = caret - m[0].length;
    if (/^\d{3,}$/.test(q)) {
      const { data } = await supabase.from('customer_appointments')
        .select('id, customer_name, phone').ilike('phone', `%${q}%`).limit(6);
      const seen = new Set();
      const items = (data || []).filter(c => { if (seen.has(c.phone)) return false; seen.add(c.phone); return true; })
        .map(c => ({ type: 'cust', id: c.id, name: c.customer_name || c.phone, sub: c.phone }));
      setDrop({ items, start }); setActive(0);
    } else {
      const ql = q.toLowerCase();
      const items = staff.filter(s => s.full_name?.toLowerCase().includes(ql)).slice(0, 6)
        .map(s => ({ type: 'staff', id: s.id, name: s.full_name, sub: s.employee_id || '' }));
      setDrop({ items, start }); setActive(0);
    }
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    detect(e.target.value, e.target.selectionStart);
  };

  const pick = (item) => {
    if (!drop) return;
    const caret = ref.current.selectionStart;
    const token = `@[${item.name}](${item.type}:${item.id}) `;
    onChange(value.slice(0, drop.start) + token + value.slice(caret));
    setDrop(null);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleKey = (e) => {
    if (drop && drop.items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % drop.items.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + drop.items.length) % drop.items.length); return; }
      if (e.key === 'Enter') { e.preventDefault(); pick(drop.items[active]); return; }
      if (e.key === 'Escape') { setDrop(null); return; }
    } else if (e.key === 'Enter' && onEnter) { onEnter(); }
  };

  return (
    <div className="relative flex-1">
      <input ref={ref} value={value} onChange={handleChange} onKeyDown={handleKey} onBlur={() => setTimeout(() => setDrop(null), 150)} placeholder={placeholder} className={className} />
      {drop && drop.items.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
          {drop.items.map((it, i) => (
            <button type="button" key={it.type + it.id} onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${i === active ? 'bg-emerald-50' : ''} hover:bg-emerald-50`}>
              <span className="font-medium text-slate-700">{it.type === 'cust' ? '👤 ' : '@'}{it.name}</span>
              <span className="text-xs text-slate-400">{it.type === 'cust' ? '📞 ' + it.sub : it.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
