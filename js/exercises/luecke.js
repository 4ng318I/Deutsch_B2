// Lückentext: ein Wort in chunks[luecke.i] wird zur Lücke (meist die feste Präposition).
// Ohne eigene Distraktoren (luecke.falsch) werden drei andere Präpositionen gezogen.
import { cap, shuffle } from '../dom.js';
import { choice } from './choice.js';

const PREP = ['an', 'auf', 'aus', 'bei', 'für', 'gegen', 'in', 'mit', 'nach', 'über', 'um', 'von', 'vor', 'zu'];
const bare = w => w.replace(/[.,;:!?]/g, '');

export function render(box, item, done) {
  const s = item.s, l = s.luecke;
  const words = s.chunks[l.i].split(' ');
  const wi = words.findIndex(w => bare(w) === l.wort);
  const tail = words[wi].slice(bare(words[wi]).length); // Satzzeichen hinter dem Lückenwort
  const pre = [...s.chunks.slice(0, l.i), ...words.slice(0, wi)].join(' ');
  const post = tail + ' ' + [...words.slice(wi + 1), ...s.chunks.slice(l.i + 1)].join(' ');
  const first = pre === '';
  const f = x => (first ? cap(x) : x);
  const wrong = l.falsch || shuffle(PREP.filter(p => p !== l.wort && !(l.auch || []).includes(p))).slice(0, 3);
  choice(box, {
    before: cap(pre),
    after: post.trimEnd() + (s.ende || '.'),
    right: f(l.wort),
    wrong: wrong.map(f),
    explain: l.lemma || l.hinweis,
    full: s.de
  }, done);
}
