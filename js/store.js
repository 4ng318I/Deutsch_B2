// Fortschritt in localStorage.
//
// Zwei getrennte Welten:
//  - items  : objektiv gemessene Aufgaben (Satzbau, Konnektor, Lückentext) → richtig/falsch
//  - anrufe : Selbsteinschätzung pro Gesprächszug (2 = saß, 1 = fast, 0 = noch nicht)
// Sie werden nie zu einer gemeinsamen Quote verrechnet.
//
// Alle Schlüssel tragen das Präfix "deutschb2:", weil sich alle GitHub-Pages-Projekte
// eines Kontos denselben Ursprung (und damit dasselbe localStorage) teilen.
//
// Schema-Versionen: Der gespeicherte Stand trägt "v". Beim Laden und beim Import
// wird er über MIGRATIONS schrittweise auf SCHEMA gehoben. Ein Stand aus einer
// NEUEREN App-Version wird nie überschrieben (siehe "blocked").
import { today } from './dom.js';

export const APP = 'deutschb2';
export const SCHEMA = 1;
const P = APP + ':';
export const KEY = P + 'progress';
const LEGACY_KEYS = ['satzbau-b2']; // Schlüssel ohne Präfix aus der ersten Veröffentlichung
export const BOX_DAYS = [0, 1, 3, 7, 14, 30]; // Leitner: Wiedervorlage nach n Tagen

// MIGRATIONS[n] hebt einen Stand von Schema n auf n + 1 und gibt ihn zurück.
// Beispiel für eine künftige v2:
//   1: s => { s.items = umbenennen(s.items); s.v = 2; return s; }
export const MIGRATIONS = {};

const fresh = () => ({
  v: SCHEMA,
  settings: { spanisch: 2, stimme: '', tempo: 1, theme: 'dark', runde: 10, nurHoeren: false },
  items: {},   // "anf-01:satzbau" → { box, n, ok, last }
  anrufe: {},  // "a-01:3" → { n, last, d }
  tage: {}     // "2026-11-16" → { satzbau:[n,ok], konnektor:[n,ok], luecke:[n,ok], anruf:[nicht,fast,sass] }
});

// Fehlende Felder ergänzen (z. B. neue Einstellungen), ohne Vorhandenes anzutasten.
function complete(s) {
  const f = fresh();
  return {
    ...f, ...s,
    settings: { ...f.settings, ...(s.settings || {}) },
    items: s.items || {}, anrufe: s.anrufe || {}, tage: s.tage || {}
  };
}

export function migrate(raw, steps = MIGRATIONS, target = SCHEMA) {
  if (!raw || typeof raw !== 'object' || typeof raw.v !== 'number') throw new Error('Kein Fortschritt im Format dieser App');
  if (raw.v > target) {
    const e = new Error(`Der Stand stammt aus einer neueren Version der App (Schema ${raw.v}, diese App kennt ${target}). Bitte die Seite neu laden, um die App zu aktualisieren.`);
    e.zukunft = true;
    throw e;
  }
  let s = JSON.parse(JSON.stringify(raw));
  while (s.v < target) {
    const step = steps[s.v];
    if (!step) throw new Error(`Keine Migration von Schema ${s.v} vorhanden`);
    const from = s.v;
    s = step(s);
    if (!s || s.v !== from + 1) throw new Error(`Migration ${from} → ${from + 1} fehlerhaft`);
  }
  return complete(s);
}

// Export-Datei: { app, schema, exportiert, progress }.
// Exporte der ersten Version enthalten nur das progress-Objekt und werden ebenfalls angenommen.
export function unwrap(obj) {
  if (obj && typeof obj === 'object' && 'app' in obj) {
    if (obj.app !== APP) throw new Error(`Die Datei gehört zu einer anderen App („${obj.app}“)`);
    return obj.progress;
  }
  if (obj && typeof obj === 'object' && typeof obj.items === 'object' && 'v' in obj) return obj;
  throw new Error('Unbekanntes Dateiformat');
}

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch { /* egal */ } }
};
// Sicherung vor jedem Eingriff; pro Anlass nur einmal, damit sich nichts ansammelt.
const backupOnce = (name, text) => { if (ls.get(P + name) == null) ls.set(P + name, text); };

let blocked = false; // true: gespeicherter Stand unlesbar oder zu neu → nichts überschreiben
export let status = { state: 'ok', msg: '' };

function load() {
  let text = ls.get(KEY), legacy = null;
  if (text == null) {
    for (const k of LEGACY_KEYS) {
      const t = ls.get(k);
      if (t != null) { text = t; legacy = k; break; }
    }
  }
  if (text == null) return fresh();
  try {
    const raw = JSON.parse(text);
    const s = migrate(raw);
    if (legacy || raw.v !== s.v) {
      backupOnce(`backup-schema-${raw.v}`, text);
      ls.set(KEY, JSON.stringify(s));
      if (legacy) ls.del(legacy);
      status = { state: 'migriert', msg: `Fortschritt von Schema ${raw.v} auf ${s.v} übernommen.` };
    }
    return s;
  } catch (e) {
    blocked = true;
    backupOnce('backup-gesperrt', text);
    status = { state: e.zukunft ? 'zukunft' : 'defekt', msg: e.message };
    return fresh();
  }
}

export let S = load();

export function save() {
  if (blocked) return;
  ls.set(KEY, JSON.stringify(S));
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

export const exportJSON = () =>
  JSON.stringify({ app: APP, schema: SCHEMA, exportiert: new Date().toISOString(), progress: S }, null, 1);

// mode "ersetzen": Datei überschreibt alles. mode "zusammenfuehren": pro Eintrag gewinnt der neuere Stand.
// Ein bewusster Import hebt die Sperre auf (der alte Stand liegt in der Sicherung).
export function importJSON(text, mode) {
  const r = migrate(unwrap(JSON.parse(text)));
  blocked = false;
  status = { state: 'ok', msg: '' };
  if (mode === 'ersetzen') { S = r; save(); return; }
  for (const [k, v] of Object.entries(r.items)) {
    const mine = S.items[k];
    if (!mine || v.last > mine.last || (v.last === mine.last && v.n > mine.n)) S.items[k] = v;
  }
  for (const [k, v] of Object.entries(r.anrufe)) {
    const mine = S.anrufe[k];
    if (!mine || v.d > mine.d || (v.d === mine.d && v.n > mine.n)) S.anrufe[k] = v;
  }
  const sum = t => Object.values(t).flat().reduce((a, b) => a + b, 0);
  for (const [d, v] of Object.entries(r.tage)) {
    if (!S.tage[d] || sum(v) > sum(S.tage[d])) S.tage[d] = v;
  }
  save();
}

export function resetAll() {
  const settings = S.settings;
  S = fresh();
  S.settings = settings;
  blocked = false;
  status = { state: 'ok', msg: '' };
  save();
}
