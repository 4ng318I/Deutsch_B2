import { h } from './dom.js';
import { loadContent } from './content.js';
import { S, status } from './store.js';
import { T } from './i18n.js';
import { stopSpeaking } from './speech.js';
import { startView } from './views/start.js';
import { sessionView } from './views/session.js';
import { anrufeView, anrufView } from './views/anrufe.js';
import { nachschlagenView } from './views/nachschlagen.js';
import { fortschrittView } from './views/fortschritt.js';
import { einstellungenView } from './views/einstellungen.js';

const VIEWS = {
  '': startView, ueben: sessionView, anrufe: anrufeView, anruf: anrufView,
  nachschlagen: nachschlagenView, fortschritt: fortschrittView, einstellungen: einstellungenView
};
const NAV = [['', 'ueben', '🎯'], ['anrufe', 'anrufe', '📞'], ['nachschlagen', 'nachschlagen', '📚'], ['fortschritt', 'fortschritt', '📈'], ['einstellungen', 'einstellungen', '⚙️']];
const NAV_OF = { ueben: '', anruf: 'anrufe' };

const root = document.getElementById('view');
const nav = document.getElementById('nav');

function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, arg] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  const view = VIEWS[name] || startView;
  document.documentElement.dataset.theme = S.settings.theme;
  document.querySelector('meta[name=theme-color]').content = S.settings.theme === 'light' ? '#f9f9f7' : '#0d0d0d';
  stopSpeaking();
  const active = name in NAV_OF ? NAV_OF[name] : (VIEWS[name] ? name : '');
  nav.replaceChildren(...NAV.map(([id, key, emo]) =>
    h('a', { href: '#/' + id, class: id === active ? 'on' : '' }, emo + ' ' + T(key))));
  root.replaceChildren();
  root.className = '';
  view(root, arg, params);
  window.scrollTo(0, 0);
}

// Hinweis, wenn der gespeicherte Fortschritt nicht gelesen werden konnte.
// Er wird dann nicht überschrieben; eine Kopie liegt unter "deutschb2:backup-gesperrt".
function storeNotice() {
  if (status.state !== 'zukunft' && status.state !== 'defekt') return;
  const box = document.getElementById('notice');
  box.hidden = false;
  box.replaceChildren(h('div', { class: 'note' }, '⚠️ ', status.msg,
    ' Dein gespeicherter Fortschritt bleibt unverändert; bis dahin wird nichts gespeichert.'));
}

// „Neue Version verfügbar“: erscheint, wenn ein neuer Service Worker installiert ist
// und wartet. Erst der Knopf aktiviert ihn und lädt die Seite neu.
function updateToast(worker) {
  if (document.querySelector('.toast')) return;
  const t = h('div', { class: 'toast', role: 'status' },
    h('span', {}, '✨ Neue Version verfügbar'),
    h('button', { class: 'btn primary', onclick: () => { reloadWanted = true; worker.postMessage('SKIP_WAITING'); } }, 'Neu laden'),
    h('button', { class: 'icon', 'aria-label': 'Später', title: 'Später', onclick: () => t.remove() }, '×'));
  document.body.append(t);
}
let reloadWanted = false;

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) updateToast(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) updateToast(w);
      });
    });
    // Nur neu laden, wenn der Nutzer es wollte (beim ersten Besuch übernimmt der Worker sonst auch die Kontrolle).
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadWanted) { reloadWanted = false; location.reload(); } });
    // Installierte App bleibt oft lange offen: beim Zurückkehren nach Updates schauen.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  } catch { /* ohne Service Worker läuft die App trotzdem, nur nicht offline */ }
}

async function main() {
  document.documentElement.dataset.theme = S.settings.theme;
  storeNotice();
  try {
    await loadContent();
  } catch (e) {
    root.replaceChildren(h('p', {}, 'Die Daten konnten nicht geladen werden: ' + e.message));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

window.addEventListener('load', registerSW);

main();
