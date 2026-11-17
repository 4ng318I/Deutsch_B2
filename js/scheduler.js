// Auswahl der Aufgaben für eine Runde. Reihenfolge der Priorität:
//  0 = fällig (zuletzt falsch oder Wiedervorlage-Frist abgelaufen), schwächste zuerst
//  1 = neu
//  2 = noch nicht fällig
// Keine Limits, keine Serien: Wer mehr machen will, startet einfach die nächste Runde.
import { C } from './content.js';
import { S, BOX_DAYS } from './store.js';
import { shuffle } from './dom.js';

export function pool({ typ, block, gram } = {}) {
  return C.items.filter(i =>
    (!typ || i.typ === typ) &&
    (!block || i.s.block === block) &&
    (!gram || i.s.gram.includes(gram)));
}

export function pick(filter, n) {
  const now = Date.now();
  const scored = pool(filter).map(i => {
    const p = S.items[i.key];
    let pr = 1, box = 0;
    if (p) {
      box = p.box;
      const days = (now - new Date(p.last + 'T00:00:00').getTime()) / 864e5;
      pr = days >= BOX_DAYS[p.box] ? 0 : 2;
    }
    return { i, pr, box, r: Math.random() };
  });
  scored.sort((a, b) => a.pr - b.pr || (a.pr === 0 ? a.box - b.box : 0) || a.r - b.r);
  const out = [], seen = new Set();
  for (const x of scored) {
    if (seen.has(x.i.s.id)) continue; // derselbe Satz nicht zweimal pro Runde
    seen.add(x.i.s.id);
    out.push(x.i);
    if (out.length >= n) break;
  }
  return shuffle(out);
}
