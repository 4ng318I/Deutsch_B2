// Lädt die Datenbank aus /data und leitet daraus die Aufgaben ab.
// Ein Satz kann bis zu drei Aufgaben liefern: Satzbau, Konnektor, Lückentext.
import { cap } from './dom.js';

export const C = { index: null, bloecke: [], saetze: [], items: [], wortschatz: [], redemittel: [], anrufe: [], grammatik: [], ui: {} };

const j = name => fetch('data/' + name + '.json').then(r => {
  if (!r.ok) throw new Error('data/' + name + '.json: ' + r.status);
  return r.json();
});

export const satzText = (s, order) =>
  cap((order ? [...order].map(d => s.chunks[+d]) : s.chunks).join(' ')) + (s.ende || '.');

export async function loadContent() {
  const [index, ui, wortschatz, redemittel, anrufe, grammatik] =
    await Promise.all(['index', 'ui', 'wortschatz', 'redemittel', 'anrufe', 'grammatik'].map(j));
  Object.assign(C, { index, ui, wortschatz, redemittel, anrufe, grammatik, bloecke: index.bloecke });
  const perBlock = await Promise.all(C.bloecke.map(b => j('saetze-' + b.id)));
  C.saetze = []; C.items = [];
  perBlock.forEach((list, i) => {
    for (const s of list) {
      s.block = C.bloecke[i].id;
      s.gram = s.gram || [];
      if (s.luecke && s.luecke.lemma && !s.gram.includes('g-rektion')) s.gram.push('g-rektion');
      s.de = satzText(s);
      C.saetze.push(s);
      if (s.loesungen) C.items.push({ key: s.id + ':satzbau', typ: 'satzbau', s });
      if (s.konnektor) C.items.push({ key: s.id + ':konnektor', typ: 'konnektor', s });
      if (s.luecke) C.items.push({ key: s.id + ':luecke', typ: 'luecke', s });
    }
  });
}

export const gramById = id => C.grammatik.find(g => g.id === id);
export const blockById = id => C.bloecke.find(b => b.id === id);
