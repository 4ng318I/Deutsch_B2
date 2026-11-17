// Telefonate: Liste und Simulation. Der Partner spricht (Text + Sprachausgabe),
// du antwortest schriftlich oder laut und vergleichst mit dem Modell.
// Es gibt KEINE automatische Korrektur: die Bewertung ist deine eigene Einschätzung.
import { h, rerender, add, put } from '../dom.js';
import { C, blockById } from '../content.js';
import { S, save, recordAnruf } from '../store.js';
import { speak, speakBtn, hasTTS } from '../speech.js';
import { L, T } from '../i18n.js';

const RATE = [[2, '✅ Saß'], [1, '🤏 Fast'], [0, '🔁 Noch nicht']];

export function anrufeView(root, _arg, params) {
  const list = C.anrufe.filter(a => !params.block || a.block === params.block);
  add(root, 
    h('h1', {}, '📞 ', L('anrufe_titel')),
    h('p', { class: 'note' }, T('anrufe_hinweis')),
    params.block ? h('p', {}, h('a', { href: '#/anrufe' }, 'Alle Anrufe zeigen')) : null,
    h('div', { class: 'grid', style: 'margin-top:14px' }, list.map(a => {
      const mine = a.turns.map((t, i) => (t.wer === 'ich' ? S.anrufe[a.id + ':' + i] : null)).filter(Boolean);
      const times = mine.length ? Math.max(...mine.map(m => m.n)) : 0;
      const b = blockById(a.block);
      return h('a', { class: 'card c-' + a.block, href: '#/anruf/' + a.id, style: 'text-decoration:none;color:inherit' },
        h('span', { class: 'tag c-' + a.block }, b.emoji + ' ' + b.titel),
        h('h3', { style: 'margin-top:6px' }, a.titel),
        h('div', { class: 'small muted' }, a.situation_es),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, times ? `🔁 ${times}× geübt` : '🆕 Noch nicht geübt'));
    })));
}

export function anrufView(root, id) {
  const a = C.anrufe.find(x => x.id === id);
  if (!a) { add(root, h('p', {}, 'Anruf nicht gefunden.'), h('a', { href: '#/anrufe' }, 'Zur Liste')); return; }
  const log = h('div', { class: 'chat' });
  root.className = 'c-' + a.block;
  let i = 0;

  add(root, 
    h('a', { href: '#/anrufe', class: 'back' }, '← Anrufe'),
    h('h1', {}, blockById(a.block).emoji + ' ', a.titel),
    h('p', {}, a.situation_es),
    h('p', { class: 'muted small' }, '☎️ Am Telefon: ' + a.partner),
    hasTTS
      ? h('label', { class: 'row small' },
          h('input', { type: 'checkbox', checked: S.settings.nurHoeren,
            onchange: e => { S.settings.nurHoeren = e.target.checked; save(); rerender(); } }),
          'Nur hören: Text des Partners erst auf Antippen zeigen')
      : h('p', { class: 'note' }, 'Dieses Gerät bietet keine Sprachausgabe. Der Anruf läuft nur als Text.'),
    log);

  function step() {
    if (i >= a.turns.length) {
      add(log, h('div', { class: 'card' }, h('strong', {}, '🎉 Gespräch beendet.'),
        h('div', { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'btn primary', onclick: rerender }, 'Noch einmal'),
          h('a', { class: 'btn', href: '#/anrufe' }, 'Anderer Anruf'))));
      return;
    }
    const t = a.turns[i];
    if (t.wer === 'p') {
      const txt = h('span', { class: S.settings.nurHoeren && hasTTS ? 'veil' : '' }, t.de);
      txt.addEventListener('click', () => txt.classList.remove('veil'));
      const b = h('div', { class: 'bubble p' }, speakBtn(t.de), txt);
      add(log, b);
      speak(t.de);
      i++;
      step();
      return;
    }
    const turnIdx = i;
    const input = h('textarea', { placeholder: 'Antwort schreiben – oder laut sagen und dann vergleichen', 'aria-label': 'Deine Antwort' });
    const card = h('div', { class: 'card turn' }, h('div', { class: 'task' }, t.aufgabe), input);
    const reveal = h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => {
      const mine = input.value.trim();
      input.remove(); reveal.remove();
      if (mine) add(card, h('div', { class: 'mine' }, mine));
      add(card, 
        h('div', { class: 'muted small' }, t.modelle.length > 1 ? 'Mögliche Antworten:' : 'Mögliche Antwort:'),
        t.modelle.map(m => h('div', { class: 'model' }, speakBtn(m), h('span', {}, m))),
        t.hinweis ? h('div', { class: 'hint' }, t.hinweis) : null,
        t.revisar ? h('span', { class: 'flag' }, 'von Muttersprachler prüfen lassen') : null,
        h('div', { class: 'rate' },
          h('div', { class: 'muted small' }, 'Eigene Einschätzung – stimmte dein Satzbau?'),
          h('div', { class: 'row', style: 'margin-top:6px' }, RATE.map(([val, label]) =>
            h('button', { class: 'btn r' + val, onclick: e => {
              recordAnruf(a.id, turnIdx, val);
              put(e.target.parentElement, h('span', { class: 'muted small' }, 'Einschätzung: ' + label));
              i++;
              step();
            } }, label)))));
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } }, 'Mit Modell vergleichen');
    add(card, reveal);
    add(log, card);
    if (turnIdx > 1) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  step();
}
