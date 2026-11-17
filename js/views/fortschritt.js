// Fortschritt. Zwei strikt getrennte Teile:
//  1. Gemessen  – Satzbau, Konnektoren, Lückentext (richtig/falsch, von der App geprüft)
//  2. Selbst eingeschätzt – Anrufe (deine eigene Bewertung, fließt in keine Quote ein)
import { h, pct, add } from '../dom.js';
import { C, gramById, blockById } from '../content.js';
import { S } from '../store.js';
import { lineChart, hbars, stack, legend } from '../charts.js';
import { L, T } from '../i18n.js';

const TYPEN = [['satzbau', 'var(--s1)'], ['konnektor', 'var(--s2)'], ['luecke', 'var(--s3)']];
const SELBST = [
  { val: 2, label: '✓ Saß', color: 'var(--good)' },
  { val: 1, label: '~ Fast', color: 'var(--warn)' },
  { val: 0, label: '✗ Noch nicht', color: 'var(--crit)' }
];
const MIN = 3; // Mindestversuche, bevor ein Thema als Schwachstelle gewertet wird

function aggregate() {
  const typ = {}, gram = {}, konn = {}, rek = {}, block = {};
  for (const [t] of TYPEN) typ[t] = { n: 0, ok: 0, seen: 0, total: 0 };
  const add = (map, key, p) => { const a = map[key] || (map[key] = { n: 0, ok: 0 }); a.n += p.n; a.ok += p.ok; };
  for (const it of C.items) {
    typ[it.typ].total++;
    const p = S.items[it.key];
    if (!p) continue;
    typ[it.typ].seen++; typ[it.typ].n += p.n; typ[it.typ].ok += p.ok;
    add(block, it.s.block, p);
    if (it.typ === 'konnektor') add(konn, it.s.chunks[it.s.konnektor.i].toLowerCase(), p);
    else if (it.typ === 'luecke') { if (it.s.luecke.lemma) add(rek, it.s.luecke.lemma, p); }
    // Satzbau zählt für alle Grammatikthemen des Satzes; Konnektor/Lücke ebenso
    for (const g of it.s.gram) add(gram, g, p);
  }
  return { typ, gram, konn, rek, block };
}

function weakest(map, labelOf, limit = 8) {
  return Object.entries(map).filter(([, a]) => a.n >= MIN)
    .map(([k, a]) => ({ label: labelOf(k), p: pct(a.ok, a.n), note: `${a.ok}/${a.n}` }))
    .sort((a, b) => a.p - b.p).slice(0, limit);
}

const few = () => h('p', { class: 'muted small' }, `Noch zu wenig Daten (mindestens ${MIN} Versuche pro Thema).`);

export function fortschrittView(root) {
  const A = aggregate();
  add(root, h('h1', {}, L('fortschritt')));

  // ---------- 1. Gemessen ----------
  add(root, h('h2', {}, L('gemessen')),
    h('p', { class: 'muted small' }, T('gemessen_hinweis')),
    h('div', { class: 'tiles' }, TYPEN.map(([t, color]) => {
      const a = A.typ[t];
      return h('div', { class: 'card tile' },
        h('div', { class: 'lab' }, h('i', { class: 'dot', style: 'background:' + color }), T(t)),
        h('div', { class: 'big' }, a.n ? pct(a.ok, a.n) + ' %' : '–'),
        h('div', { class: 'muted small' }, `${a.ok} von ${a.n} Versuchen richtig`),
        h('div', { class: 'muted small' }, `${a.seen} von ${a.total} Aufgaben gesehen`));
    })));

  const dates = Object.keys(S.tage).filter(d => TYPEN.some(([t]) => S.tage[d][t])).sort().slice(-30);
  add(root, h('h3', {}, 'Trefferquote pro Übungstag'));
  if (dates.length === 1) {
    add(root, h('p', { class: 'muted small' }, 'Ab dem zweiten Übungstag erscheint hier der Verlauf.'));
  } else if (dates.length) {
    const lab = d => d.slice(8) + '.' + d.slice(5, 7) + '.';
    const series = TYPEN.map(([t, color]) => ({
      name: T(t), color,
      vals: dates.map(d => { const v = S.tage[d][t]; return v ? { n: v[0], ok: v[1], p: pct(v[1], v[0]) } : null; })
    }));
    add(root, h('div', { class: 'card' },
      legend(series.map(s => ({ label: s.name, color: s.color }))),
      lineChart({ days: dates.map(lab), series }),
      h('details', {}, h('summary', { class: 'small' }, 'Als Tabelle'),
        h('table', { class: 't' },
          h('tr', {}, h('th', {}, 'Tag'), TYPEN.map(([t]) => h('th', {}, T(t)))),
          dates.map(d => h('tr', {}, h('td', {}, lab(d)),
            TYPEN.map(([t]) => { const v = S.tage[d][t]; return h('td', {}, v ? `${v[1]}/${v[0]}` : '–'); })))))));
  } else add(root, h('p', { class: 'muted small' }, 'Noch keine Übungstage.'));

  add(root, h('h2', {}, L('schwachstellen')));
  const sections = [
    ['Nach Grammatikthema', weakest(A.gram, k => (gramById(k) || { titel: k }).titel)],
    ['Nach Konnektor', weakest(A.konn, k => k)],
    ['Nach Verb + Präposition', weakest(A.rek, k => k)],
    ['Nach Block', weakest(A.block, k => blockById(k).titel)]
  ];
  for (const [title, rows] of sections) {
    add(root, h('h3', {}, title), rows.length ? h('div', { class: 'card' }, hbars(rows)) : few());
  }
  add(root, h('p', { class: 'muted small' }, 'Sortiert von schwach nach stark. Gezeigt werden höchstens acht Einträge pro Liste.'));

  // ---------- 2. Selbst eingeschätzt ----------
  add(root, h('h2', {}, L('selbst')),
    h('p', { class: 'note' }, T('selbst_hinweis')));
  const all = Object.values(S.anrufe);
  if (!all.length) { add(root, h('p', { class: 'muted small' }, 'Noch kein Anruf geübt.')); return; }
  const count = val => all.filter(a => a.last === val).length;
  add(root, 
    h('div', { class: 'card' },
      h('div', { class: 'small' }, `Letzte Einschätzung über ${all.length} geübte Gesprächszüge`),
      legend(SELBST.map(s => ({ label: `${s.label}: ${count(s.val)}`, color: s.color }))),
      stack(SELBST.map(s => ({ n: count(s.val), color: s.color, label: s.label })))),
    h('h3', {}, 'Pro Anruf'),
    h('div', { class: 'card' }, C.anrufe.map(a => {
      const mine = a.turns.map((t, i) => (t.wer === 'ich' ? (S.anrufe[a.id + ':' + i] || null) : undefined)).filter(x => x !== undefined);
      const done = mine.filter(Boolean);
      const parts = SELBST.map(s => ({ n: done.filter(m => m.last === s.val).length, color: s.color, label: s.label }));
      parts.push({ n: mine.length - done.length, color: 'var(--surface-2)', label: 'Noch nicht geübt' });
      return h('div', { style: 'padding:8px 0' },
        h('div', { class: 'small', style: 'display:flex;justify-content:space-between;gap:8px' },
          h('a', { href: '#/anruf/' + a.id }, a.titel),
          h('span', { class: 'muted' }, parts.slice(0, 3).map(p => p.n).join(' / ') + ` von ${mine.length}`)),
        stack(parts));
    }),
    h('div', { class: 'muted small' }, 'Zahlen: Saß / Fast / Noch nicht')));
}
