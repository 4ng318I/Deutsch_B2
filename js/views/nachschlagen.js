import { h, add, put } from '../dom.js';
import { C, blockById } from '../content.js';
import { speakBtn } from '../speech.js';
import { S } from '../store.js';
import { L, T } from '../i18n.js';

const TABS = [['wortschatz', 'wortschatz'], ['redemittel', 'redemittel'], ['grammatik', 'grammatik']];
const flag = e => (e.revisar ? h('span', { class: 'flag' }, 'prüfen lassen') : null);

function wortschatz(box) {
  const list = h('div', {});
  const q = h('input', { type: 'search', placeholder: 'Suchen (Deutsch oder Spanisch) …', 'aria-label': 'Suchen' });
  const selB = h('select', { 'aria-label': 'Block' }, h('option', { value: '' }, 'Alle Blöcke'),
    C.bloecke.map(b => h('option', { value: b.id }, b.titel)));
  const abts = [...new Set(C.wortschatz.map(w => w.abt))].sort();
  const selA = h('select', { 'aria-label': 'Abteilung' }, h('option', { value: '' }, 'Alle Abteilungen'),
    abts.map(a => h('option', { value: a }, a)));
  function draw() {
    const s = q.value.trim().toLowerCase();
    const hits = C.wortschatz.filter(w =>
      (!selB.value || w.block === selB.value) && (!selA.value || w.abt === selA.value) &&
      (!s || w.de.toLowerCase().includes(s) || w.es.toLowerCase().includes(s)));
    put(list, h('p', { class: 'muted small' }, hits.length + ' Einträge'),
      ...hits.map(w => h('div', { class: 'entry' }, speakBtn(w.bsp),
        h('div', {},
          h('div', {}, h('span', { class: 'w' }, (w.art ? w.art + ' ' : '') + w.de),
            w.pl && w.pl !== '-' ? h('span', { class: 'muted' }, ', Pl. ' + w.pl) : null,
            ' – ', w.es, ' ', flag(w)),
          h('div', { class: 'bsp' }, w.bsp),
          h('div', {}, h('span', { class: 'tag' }, blockById(w.block).titel), h('span', { class: 'tag' }, w.abt))))));
  }
  q.addEventListener('input', draw); selB.addEventListener('change', draw); selA.addEventListener('change', draw);
  add(box, h('div', { class: 'row' }, q, selB, selA), list);
  draw();
}

function redemittel(box) {
  const groups = {};
  for (const r of C.redemittel) (groups[r.f] = groups[r.f] || []).push(r);
  for (const f of C.index.funktionen) {
    const g = groups[f.id] || [];
    add(box, h('details', {},
      h('summary', {}, `${f.titel} (${g.length})`, S.settings.spanisch === 2 ? h('span', { class: 'gl' }, f.es) : null),
      g.map(r => h('div', { class: 'entry' }, speakBtn(r.de.replace(/…/g, '')),
        h('div', {},
          h('div', { class: 'w' }, r.de, ' ', flag(r)),
          S.settings.spanisch > 0 ? h('div', { class: 'bsp' }, r.es) : null,
          h('div', {}, h('span', { class: 'tag' }, r.kanal), h('span', { class: 'tag' }, r.reg)))))));
  }
}

function grammatik(box) {
  for (const g of C.grammatik) {
    const n = C.items.filter(i => i.s.gram.includes(g.id)).length;
    add(box, h('details', {},
      h('summary', {}, g.titel),
      h('p', { class: 'muster' }, g.muster),
      h('p', {}, g.erklaerung_es),
      h('h3', {}, 'Beispiele'),
      h('ul', {}, g.beispiele.map(b => h('li', {}, b))),
      h('h3', {}, 'Typische Fehler'),
      h('ul', {}, g.fehler.map(f => h('li', {}, h('s', { class: 'muted' }, f.falsch), ' → ', h('strong', {}, f.richtig),
        f.warum ? h('div', { class: 'small muted' }, f.warum) : null))),
      n ? h('a', { class: 'btn primary', href: '#/ueben?gram=' + g.id }, `${T('ueben')} (${n} Aufgaben)`) : null));
  }
}

const RENDER = { wortschatz, redemittel, grammatik };

export function nachschlagenView(root, arg) {
  const tab = RENDER[arg] ? arg : 'wortschatz';
  const box = h('div', {});
  add(root, 
    h('h1', {}, L('nachschlagen')),
    h('div', { class: 'tabs' }, TABS.map(([id, key]) =>
      h('a', { class: 'btn' + (id === tab ? ' on' : ''), href: '#/nachschlagen/' + id }, T(key)))),
    box);
  RENDER[tab](box);
}
