// Gemeinsame Basis für Konnektor und Lückentext: Satz mit einer Lücke, vier Optionen.
import { h, shuffle, add } from '../dom.js';
import { speakBtn } from '../speech.js';

// before / after: Text vor und nach der Lücke; right: Lösung; wrong: falsche Optionen;
// explain: Erklärung nach der Antwort; full: vollständiger Satz zum Anhören
export function choice(box, { before, after, right, wrong, explain, full }, done) {
  const gap = h('span', { class: 'gap' }, ' ');
  const fb = h('div', { class: 'fb' });
  const opts = h('div', { class: 'opts' });
  let locked = false;
  for (const o of shuffle([right, ...wrong])) {
    const b = h('button', { class: 'btn', onclick: () => {
      if (locked) return;
      locked = true;
      const ok = o === right;
      gap.textContent = right;
      gap.classList.add(ok ? 'ok' : 'bad');
      for (const x of opts.children) {
        x.disabled = true;
        if (x.textContent === right) x.classList.add('right');
      }
      if (!ok) b.classList.add('wrong');
      add(fb, 
        h('div', { class: 'verdict ' + (ok ? 'ok' : 'bad') }, ok ? 'Richtig.' : `Nicht ganz – richtig ist „${right}“.`),
        h('div', { class: 'sol' }, speakBtn(full), explain ? h('span', { class: 'small' }, explain) : null));
      done(ok);
    } }, o);
    add(opts, b);
  }
  add(box, h('p', { class: 'satz' }, before, before ? ' ' : '', gap, after), opts, fb);
}
