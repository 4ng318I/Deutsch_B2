// Diagramme ohne Bibliothek: SVG-Linien, HTML-Balken, ein gemeinsamer Tooltip.
import { h, esc } from './dom.js';

let tip;
function ensureTip() {
  if (tip) return;
  tip = h('div', { id: 'tip', hidden: true });
  document.body.append(tip);
  const show = e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip;
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, e.clientX - w / 2)) + 'px';
    tip.style.top = Math.max(4, e.clientY - 36) + 'px';
  };
  document.addEventListener('pointermove', show);
  document.addEventListener('pointerdown', show);
  window.addEventListener('hashchange', () => { tip.hidden = true; });
}

// days: ["16.11.", …]; series: [{ name, color, vals: [null | { p, n, ok }] }]
export function lineChart({ days, series }) {
  ensureTip();
  const W = 640, H = 230, L = 34, R = 96, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const x = i => L + (days.length === 1 ? iw / 2 : (i * iw) / (days.length - 1));
  const y = p => T + ih - (p / 100) * ih;
  let s = '';
  for (const g of [0, 50, 100]) {
    s += `<line x1="${L}" x2="${L + iw}" y1="${y(g)}" y2="${y(g)}" stroke="var(--${g ? 'grid' : 'axis'})" stroke-width="1"/>`;
    s += `<text x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g} %</text>`;
  }
  const step = Math.max(1, Math.ceil(days.length / 6));
  days.forEach((d, i) => {
    if (i % step === 0 || i === days.length - 1) {
      if (i !== days.length - 1 && days.length - 1 - i < step / 2) return;
      s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(d)}</text>`;
    }
  });
  const ends = [];
  for (const se of series) {
    const pts = se.vals.map((v, i) => (v ? { x: x(i), y: y(v.p), v, d: days[i] } : null)).filter(Boolean);
    if (!pts.length) continue;
    if (pts.length > 1) {
      s += `<path d="M${pts.map(p => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L')}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    for (const p of pts) {
      s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`;
      s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14" fill="transparent" data-tip="${esc(`${se.name} · ${p.d} · ${p.v.p} % (${p.v.ok}/${p.v.n})`)}"/>`;
    }
    const last = pts[pts.length - 1];
    ends.push({ name: se.name, x: last.x, y: last.y });
  }
  // Endbeschriftungen entzerren
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  // nicht unter die Zeichenfläche rutschen lassen: von unten wieder nach oben schieben
  for (let i = ends.length - 1; i >= 0; i--) {
    const max = T + ih - (ends.length - 1 - i) * 14;
    if (ends[i].y > max) ends[i].y = max;
  }
  for (const e of ends) s += `<text class="lab" x="${Math.min(e.x + 10, L + iw + 10)}" y="${e.y + 4}">${esc(e.name)}</text>`;
  return h('div', { class: 'chart', html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trefferquote pro Tag">${s}</svg>` });
}

// rows: [{ label, p, note }] – eine Farbe, Länge = Trefferquote
export function hbars(rows) {
  ensureTip();
  return h('div', {}, rows.map(r =>
    h('div', { class: 'hbar', 'data-tip': `${r.label}: ${r.p} % (${r.note})` },
      h('span', {}, r.label),
      h('span', { class: 'track' }, h('i', { style: `width:${Math.max(r.p, 1)}%` })),
      h('span', { class: 'num' }, `${r.p} % · ${r.note}`))));
}

// parts: [{ n, color, label }] – gestapelter Balken mit 2 px Abstand
export function stack(parts) {
  ensureTip();
  const total = parts.reduce((a, p) => a + p.n, 0);
  return h('div', { class: 'stack' }, parts.filter(p => p.n > 0).map(p =>
    h('i', { style: `flex:${p.n} 1 0;background:${p.color}`, 'data-tip': `${p.label}: ${p.n} von ${total}` })));
}

export const legend = items => h('div', { class: 'legend' },
  items.map(i => h('span', {}, h('i', { class: 'dot', style: `background:${i.color}` }), i.label)));
