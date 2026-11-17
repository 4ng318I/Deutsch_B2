import { h, pct, rerender, add } from '../dom.js';
import { C } from '../content.js';
import { S, save } from '../store.js';
import { pool } from '../scheduler.js';
import { L, T, G } from '../i18n.js';

export const TYP_EMOJI = { '': '🎲', satzbau: '🧩', konnektor: '🔗', luecke: '✏️' };

function stats(items) {
  let seen = 0, n = 0, ok = 0;
  for (const i of items) { const p = S.items[i.key]; if (p) { seen++; n += p.n; ok += p.ok; } }
  return { seen, total: items.length, n, ok };
}

const statLine = st => `${st.seen} von ${st.total} gesehen` + (st.n ? ` · ${pct(st.ok, st.n)} % richtig` : '');

export function startView(root) {
  const runde = h('div', { class: 'row' }, h('span', { class: 'muted' }, '⏱️ ' + T('rundenlaenge') + ':'),
    [5, 10, 20].map(n => h('button', { class: 'btn' + (S.settings.runde === n ? ' on' : ''),
      onclick: () => { S.settings.runde = n; save(); rerender(); } }, n + ' ' + T('aufgaben'))));

  const typBtn = (typ, key) => {
    const st = stats(pool({ typ }));
    return h('a', { class: 'card c-' + (typ || 'gemischt'), href: '#/ueben' + (typ ? '?typ=' + typ : ''), style: 'text-decoration:none;color:inherit' },
      h('h3', {}, h('span', { class: 'emo' }, TYP_EMOJI[typ]), L(key)),
      h('div', { class: 'meter' }, h('i', { style: `width:${pct(st.seen, st.total)}%` })),
      h('div', { class: 'muted small' }, statLine(st)));
  };

  add(root,
    h('h1', {}, '👋 ', L('start_titel')),
    runde,
    h('div', { class: 'grid', style: 'margin-top:14px' },
      typBtn('', 'gemischt'), typBtn('satzbau', 'satzbau'), typBtn('konnektor', 'konnektor'), typBtn('luecke', 'luecke')),
    h('h2', {}, '🗂️ ', L('bloecke')),
    h('div', { class: 'grid' }, C.bloecke.map(b => {
      const st = stats(pool({ block: b.id }));
      const calls = C.anrufe.filter(a => a.block === b.id).length;
      return h('div', { class: 'card c-' + b.id },
        h('h3', {}, h('span', { class: 'emo' }, b.emoji), b.titel, S.settings.spanisch === 2 ? h('span', { class: 'gl' }, b.es) : null),
        h('div', { class: 'meter' }, h('i', { style: `width:${pct(st.seen, st.total)}%` })),
        h('div', { class: 'muted small' }, statLine(st)),
        h('div', { class: 'row', style: 'margin-top:10px' },
          h('a', { class: 'btn primary', href: '#/ueben?block=' + b.id }, '▶ ' + T('ueben')),
          calls ? h('a', { class: 'btn', href: '#/anrufe?block=' + b.id }, `📞 ${T('anrufe')} (${calls})`) : null));
    })),
    h('p', { class: 'muted small', style: 'margin-top:24px' }, '🧘 ', T('start_hinweis'), G('start_hinweis')));
}
