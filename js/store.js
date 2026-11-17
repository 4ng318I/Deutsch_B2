// Fortschritt in localStorage. Zwei getrennte Welten:
//  - items  : objektiv gemessene Aufgaben (Satzbau, Konnektor, Lückentext) → richtig/falsch
//  - anrufe : Selbsteinschätzung pro Gesprächszug (2 = saß, 1 = fast, 0 = noch nicht)
// Sie werden nie zu einer gemeinsamen Quote verrechnet.
import { today } from './dom.js';

const KEY = 'satzbau-b2';
export const BOX_DAYS = [0, 1, 3, 7, 14, 30]; // Leitner: Wiedervorlage nach n Tagen

const fresh = () => ({
  v: 1,
  settings: { spanisch: 2, stimme: '', tempo: 1, theme: 'dark', runde: 10, nurHoeren: false },
  items: {},   // "anf-01:satzbau" → { box, n, ok, last }
  anrufe: {},  // "a-01:3" → { n, last, d }
  tage: {}     // "2026-11-16" → { satzbau:[n,ok], konnektor:[n,ok], luecke:[n,ok], anruf:[nicht,fast,sass] }
});

function normalize(r) {
  const f = fresh();
  if (!r || r.v !== 1 || typeof r.items !== 'object') return null;
  return { ...f, ...r, settings: { ...f.settings, ...(r.settings || {}) } };
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))) || fresh(); }
  catch { return fresh(); }
}

export let S = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* Speicher voll oder gesperrt */ }
}

function day() {
  const d = today();
  return S.tage[d] || (S.tage[d] = {});
}

export function record(key, typ, ok) {
  const it = S.items[key] || (S.items[key] = { box: 0, n: 0, ok: 0, last: '' });
  it.n++;
  if (ok) { it.ok++; it.box = Math.min(it.box + 1, BOX_DAYS.length - 1); } else it.box = 0;
  it.last = today();
  const a = day()[typ] || (day()[typ] = [0, 0]);
  a[0]++; if (ok) a[1]++;
  save();
}

export function recordAnruf(id, turn, wert) {
  const k = id + ':' + turn;
  const a = S.anrufe[k] || (S.anrufe[k] = { n: 0, last: 0, d: '' });
  a.n++; a.last = wert; a.d = today();
  const c = day().anruf || (day().anruf = [0, 0, 0]);
  c[wert]++;
  save();
}

export const exportJSON = () => JSON.stringify(S, null, 1);

// mode "ersetzen": Datei überschreibt alles. mode "zusammenfuehren": pro Eintrag gewinnt der neuere Stand.
export function importJSON(text, mode) {
  const r = normalize(JSON.parse(text));
  if (!r) throw new Error('Unbekanntes Format');
  if (mode === 'ersetzen') { S = r; save(); return; }
  for (const [k, v] of Object.entries(r.items)) {
    const mine = S.items[k];
    if (!mine || v.last > mine.last || (v.last === mine.last && v.n > mine.n)) S.items[k] = v;
  }
  for (const [k, v] of Object.entries(r.anrufe || {})) {
    const mine = S.anrufe[k];
    if (!mine || v.d > mine.d || (v.d === mine.d && v.n > mine.n)) S.anrufe[k] = v;
  }
  const sum = t => Object.values(t).flat().reduce((a, b) => a + b, 0);
  for (const [d, v] of Object.entries(r.tage || {})) {
    if (!S.tage[d] || sum(v) > sum(S.tage[d])) S.tage[d] = v;
  }
  save();
}

export function resetAll() {
  const settings = S.settings;
  S = fresh();
  S.settings = settings;
  save();
}
