// Satzbau: Satzteile antippen und in die richtige Reihenfolge bringen.
// Akzeptiert wird JEDE Reihenfolge aus s.loesungen, nicht nur die erste.
import { h, shuffle, cap, add, put } from '../dom.js';
import { satzText } from '../content.js';
import { speakBtn } from '../speech.js';

export function render(box, item, done) {
  const s = item.s;
  const sols = s.loesungen.map(l => [...l].map(d => s.chunks[+d]));
  const solKeys = new Set(sols.map(a => a.join('|')));
  let pool, tries = 0;
  do { pool = shuffle(s.chunks); } while (s.chunks.length > 1 && solKeys.has(pool.join('|')) && ++tries < 20);
  let ans = [], locked = false;

  const line = h('div', { class: 'answer', 'aria-label': 'Dein Satz' });
  const bank = h('div', { class: 'bank' });
  const fb = h('div', { class: 'fb' });
  const check = h('button', { class: 'btn primary', disabled: true, onclick: verify }, 'Prüfen');

  function draw() {
    put(line, ...ans.map((c, k) =>
      h('button', { class: 'chunk', onclick: () => { if (locked) return; ans.splice(k, 1); pool.push(c); draw(); } }, k === 0 ? cap(c) : c)));
    if (!ans.length) add(line, h('span', { class: 'ph' }, 'Satzteile antippen …'));
    else if (!pool.length) add(line, h('span', { class: 'ende' }, s.ende || '.'));
    put(bank, ...pool.map((c, k) =>
      h('button', { class: 'chunk', onclick: () => { if (locked) return; pool.splice(k, 1); ans.push(c); draw(); } }, c)));
    check.disabled = pool.length > 0;
  }

  function verify() {
    locked = true;
    check.remove();
    const mine = ans.join('|');
    const ok = solKeys.has(mine);
    line.classList.add(ok ? 'ok' : 'bad');
    const others = s.loesungen.filter(l => [...l].map(d => s.chunks[+d]).join('|') !== mine);
    add(fb, h('div', { class: 'verdict ' + (ok ? 'ok' : 'bad') }, ok ? 'Richtig.' : 'Nicht ganz.'));
    if (!ok) {
      const first = others.shift();
      add(fb, h('div', { class: 'sol' }, speakBtn(satzText(s, first)), h('span', {}, satzText(s, first))));
    } else {
      add(fb, h('div', { class: 'sol' }, speakBtn(satzText(s, s.loesungen.find(l => !others.includes(l))))));
    }
    if (others.length) {
      add(fb, h('div', { class: 'muted small' }, 'Auch möglich:'),
        others.map(l => h('div', { class: 'small' }, satzText(s, l))));
    }
    done(ok);
  }

  add(box, line, bank, check, fb);
  draw();
}
