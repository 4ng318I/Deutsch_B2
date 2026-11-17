import { h } from './dom.js';
import { loadContent } from './content.js';
import { S } from './store.js';
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

async function main() {
  document.documentElement.dataset.theme = S.settings.theme;
  try {
    await loadContent();
  } catch (e) {
    root.replaceChildren(h('p', {}, 'Die Daten konnten nicht geladen werden: ' + e.message));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

main();
