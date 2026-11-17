// Konnektor: Der Konnektor ist ein eigener Satzteil (chunks[konnektor.i]) und wird zur Lücke.
import { cap } from '../dom.js';
import { choice } from './choice.js';

export function render(box, item, done) {
  const s = item.s, k = s.konnektor, first = k.i === 0;
  const f = x => (first ? cap(x) : x);
  const before = cap(s.chunks.slice(0, k.i).join(' '));
  const after = ' ' + s.chunks.slice(k.i + 1).join(' ') + (s.ende || '.');
  choice(box, {
    before, after,
    right: f(s.chunks[k.i]),
    wrong: k.falsch.map(f),
    explain: k.warum,
    full: s.de
  }, done);
}
