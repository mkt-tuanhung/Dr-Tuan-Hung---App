import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import os from 'os';
// Chạy từ docs/catalogue-nhan-vien (cần playwright): node tools/measure.mjs
const dir = 'pages', img = path.resolve('img');
const map = JSON.parse(fs.readFileSync('tools/blobmap.json','utf8'));
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.dc.html')).sort()) {
  let h = fs.readFileSync(path.join(dir, f), 'utf8').replace(/<script[^>]*support\.js[^>]*><\/script>/, '');
  h = h.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => 'file://' + img + '/' + (map[id] || 'missing') + '.png');
  const tmp = path.join(os.tmpdir(), '_catalogue_measure.html');
  fs.writeFileSync(tmp, h); await p.goto('file://' + tmp); await p.waitForTimeout(400); await p.evaluate(() => document.fonts.ready); const fl = await p.evaluate(() => document.fonts.check('16px "Be Vietnam Pro"')); if (!fl) console.log('FONT NOT LOADED');
  const r = await p.evaluate(() => { const g = document.querySelector('.pg'); if (!g) return { sh: 0, free: 'n/a' }; const ft = g.querySelector('.ft'); const prev = ft.previousElementSibling;
    window.__h = [...g.children].map(c => c.className + ':' + Math.round(c.getBoundingClientRect().height)).join(' '); return { h: window.__h, sh: g.scrollHeight, free: Math.round(ft.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) }; });
  console.log(f.padEnd(28), r.sh > 1123 ? 'OVERFLOW ' + r.sh : 'ok', 'free=' + r.free, r.sh > 1123 ? r.h : '');
}
await b.close();
