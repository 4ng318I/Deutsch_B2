import { h, add, put } from '../dom.js';
import { gramById, blockById } from '../content.js';
import { S, record } from '../store.js';
import { pick } from '../scheduler.js';
import { T, cue } from '../i18n.js';
import { TYP_EMOJI } from './start.js';
import * as satzbau from '../exercises/satzbau.js';
import * as konnektor from '../exercises/konnektor.js';
import * as luecke from '../exercises/luecke.js';

const EX = { satzbau, konnektor, luecke };
const AUFGABE = { satzbau: 'aufgabe_satzbau', konnektor: 'aufgabe_konnektor', luecke: 'aufgabe_luecke' };

function ruleBox(s, open) {
  const rules = s.gram.map(gramById).filter(Boolean);
  if (!rules.length) return null;
  return h('div', { class: 'rule' }, rules.map((g, i) =>
    h('details', { open: open && i === 0 },
      h('summary', {}, 'Regel: ' + g.titel),
      h('p', { class: 'muster' }, g.muster),
      h('p', { class: 'small' }, g.erklaerung_es))));
}

export function sessionView(root, _arg, params) {
  const filter = { typ: params.typ || '', block: params.block || '', gram: params.gram || '' };
  const items = pick(filter, S.settings.runde);
  if (!items.length) {
    add(root, h('p', {}, 'Für diese Auswahl gibt es keine Aufgaben.'), h('a', { class: 'btn', href: '#/' }, 'Zur Übersicht'));
    return;
  }
  const results = [];
  let idx = 0;

  function show() {
    if (idx >= items.length) return end();
    const it = items[idx];
    const box = h('div', { class: 'ex' });
    const after = h('div', {});
    const next = h('button', { class: 'btn primary next', hidden: true, onclick: () => { idx++; show(); } },
      idx === items.length - 1 ? 'Auswertung' : 'Weiter');
    const b = blockById(it.s.block);
    root.className = 'c-' + it.typ;
    put(root,
      h('div', { class: 'sess-head' },
        h('span', { class: 'muted small' }, `${idx + 1} / ${items.length} `, h('span', { class: 'tag c-' + b.id }, b.emoji + ' ' + b.titel)),
        h('a', { href: '#/', class: 'small' }, 'Beenden')),
      h('div', { class: 'meter prog' }, h('i', { style: `width:${(idx / items.length) * 100}%` })),
      h('h2', { style: 'margin-top:.8em' }, TYP_EMOJI[it.typ] + ' ', T(AUFGABE[it.typ])),
      cue(it.s.es), box, after, next);
    EX[it.typ].render(box, it, ok => {
      record(it.key, it.typ, ok);
      results.push({ it, ok });
      const r = ruleBox(it.s, !ok);
      if (r) add(after, r);
      next.hidden = false;
      next.focus({ preventScroll: true });
    });
    window.scrollTo(0, 0);
  }

  function end() {
    const ok = results.filter(r => r.ok).length;
    const wrong = results.filter(r => !r.ok);
    const q = ok / results.length;
    root.className = '';
    put(root,
      h('div', { class: 'result-emo' }, q >= 0.9 ? '🏆' : q >= 0.6 ? '💪' : '🔁'),
      h('h1', {}, `${ok} von ${results.length} richtig`),
      wrong.length
        ? [h('h2', {}, 'Noch einmal ansehen'),
           h('ul', { class: 'plain fehler' }, wrong.map(r => h('li', {}, r.it.s.de,
             h('div', { class: 'muted small' }, T(r.it.typ) + (r.it.s.es ? ' · ' + r.it.s.es : ''))))),
           h('p', { class: 'muted small' }, 'Diese Aufgaben kommen in der nächsten Runde zuerst wieder.')]
        : h('p', {}, '🎉 Alles richtig.'),
      h('div', { class: 'row', style: 'margin-top:16px' },
        h('button', { class: 'btn primary', onclick: () => { put(root); sessionView(root, null, params); } }, 'Noch eine Runde'),
        h('a', { class: 'btn', href: '#/' }, 'Zur Übersicht'),
        h('a', { class: 'btn', href: '#/fortschritt' }, 'Fortschritt')));
    window.scrollTo(0, 0);
  }

  show();
}
