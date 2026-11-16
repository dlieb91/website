/* Einstieg: Startbildschirm, Ordnerverbindung, Navigation, Router.

   Die Reihenfolge der Seitenleiste ist die Reihenfolge der Arbeit: erst das
   Haus, dann die Mieter, dann die Kosten eines Jahres, am Ende das Schreiben.
*/

import { $, el, leeren, toast, abfragen } from './util.js';
import {
  istUnterstuetzt, ordnerWaehlen, rechtePruefen, ordnerMerken, gemerkterOrdner,
  ordnerUebernehmen, datenLesen, sofortSpeichern, datenquelle, speicher,
} from './storage.js';
import { state, laden, neueDaten, abonnieren } from './store.js';
import { uebersicht } from './views/uebersicht.js';
import { haus } from './views/haus.js';
import { mieter } from './views/mieter.js';
import { kosten } from './views/kosten.js';
import { abrechnung } from './views/abrechnung.js';
import { einstellungen } from './views/einstellungen.js';

/* ---------- Ansichten ---------- */

/* 24x24-Pfade ohne fill; stroke setzt navAufbauen(). */
const ICONS = {
  uebersicht: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  haus: '<path d="M3 12l9-8 9 8M5 10v10h14V10"/>',
  mieter: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.4c2.1.8 3.5 2.8 3.5 5.6"/>',
  kosten: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  abrechnung: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
  einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};

/* Register der Ansichten. Pflicht ist { titel, view }, dazu optional:
     navTitel   kuerzerer Text in der Seitenleiste
     zaehler    (daten) => Zahl, erscheint als Abzeichen
     navKey     hebt einen anderen Nav-Eintrag hervor (fuer Detailrouten)
     versteckt  taucht nicht in der Navigation auf
   titel darf eine Funktion sein, wenn er von den Daten abhaengt. */
const ANSICHTEN = {
  uebersicht: { titel: 'Übersicht', view: uebersicht },
  haus: { titel: 'Haus und Wohnungen', navTitel: 'Haus', view: haus },
  mieter: { titel: 'Mieter', view: mieter, zaehler: (d) => d.mietverhaeltnisse.filter((m) => !m.auszug).length },
  kosten: { titel: 'Kosten', view: kosten },
  abrechnung: { titel: 'Abrechnung', view: abrechnung },
  einstellungen: { titel: 'Einstellungen', view: einstellungen },
};

/* Reihenfolge in der Seitenleiste; 'einstellungen' wird unten abgesetzt. */
const REIHENFOLGE = ['uebersicht', 'haus', 'mieter', 'kosten', 'abrechnung', 'einstellungen'];

/* ---------- Design ---------- */

function themaSetzen(thema) {
  document.documentElement.dataset.theme = thema;
  localStorage.setItem('nebenkostenkompass-theme', thema);
}

function themaInitialisieren() {
  const gespeichert = localStorage.getItem('nebenkostenkompass-theme');
  themaSetzen(gespeichert || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
}

/* ---------- Startbildschirm ---------- */

function startBereich() { return $('#startupBody'); }

function startFehler(titel, html) {
  const body = leeren(startBereich());
  body.append(el('div.startup-err', {}, [el('strong', { text: titel }), el('div', { html, style: 'margin-top:6px' })]));
}

async function starten() {
  themaInitialisieren();

  if (location.protocol === 'file:') {
    startFehler('Bitte über Start.bat öffnen',
      'Die App wurde direkt als Datei geöffnet. In diesem Modus erlaubt der Browser keinen Zugriff auf deinen Ordner.<br><br>'
      + 'Schließe dieses Fenster und starte stattdessen <strong>Start.bat</strong> im selben Ordner.');
    return;
  }

  if (!istUnterstuetzt()) {
    startFehler('Browser nicht unterstützt',
      'Für die Ordner-Speicherung wird <strong>Chrome</strong> oder <strong>Edge</strong> benötigt. '
      + 'Firefox und Safari unterstützen den direkten Ordnerzugriff nicht.<br><br>'
      + 'Öffne <em>Start.bat</em> erneut oder rufe die angezeigte Adresse in Chrome bzw. Edge auf.');
    return;
  }

  datenquelle(() => state.daten);

  let handle = null;
  try { handle = await gemerkterOrdner(); } catch { /* ignorieren */ }
  startAuswahlZeigen(handle);
}

function startAuswahlZeigen(gemerkt) {
  const body = leeren(startBereich());

  if (gemerkt) {
    body.append(el('div.startup-recent', {}, [
      el('div', { style: 'font-size:19px' }, ['📁']),
      el('div', { style: 'min-width:0' }, [
        el('div.rec-name', { text: gemerkt.name }),
        el('div.rec-path', { text: 'zuletzt verwendet' }),
      ]),
    ]));
    body.append(el('button.btn.btn-primary.btn-lg', {
      type: 'button', onclick: () => verbinden(gemerkt, false),
    }, ['Öffnen']));
    body.append(el('button.btn', { type: 'button', onclick: () => oeffnenDialog() }, ['Anderen Ordner öffnen']));
    body.append(el('button.btn.btn-ghost', { type: 'button', onclick: () => anlegenDialog() }, ['Neu anlegen']));
  } else {
    body.append(el('button.btn.btn-primary.btn-lg', { type: 'button', onclick: () => anlegenDialog() }, ['Neu anlegen']));
    body.append(el('button.btn', { type: 'button', onclick: () => oeffnenDialog() }, ['Vorhandenes öffnen']));
    body.append(el('div.startup-hint', {
      text: 'Beim Anlegen wählst du einen Ordner auf deinem Rechner. Dort speichert die App nebenkosten.json '
        + 'und automatische Sicherungen. Es verlässt nichts deinen Rechner.',
    }));
  }
}

async function ordnerDialog() {
  try {
    return await ordnerWaehlen();
  } catch (e) {
    if (e.name !== 'AbortError') toast('Ordner konnte nicht geöffnet werden: ' + e.message, 'err');
    return null;
  }
}

async function anlegenDialog() {
  const handle = await ordnerDialog();
  if (!handle) return;
  await verbinden(handle, true);
}

async function oeffnenDialog() {
  const handle = await ordnerDialog();
  if (!handle) return;
  await verbinden(handle, false);
}

async function verbinden(handle, neuAnlegen) {
  const body = leeren(startBereich());
  body.append(el('div.spinner'));

  try {
    if (!(await rechtePruefen(handle))) {
      startFehler('Zugriff verweigert', 'Ohne Schreibrecht auf den Ordner können die Daten nicht geladen werden.');
      body.append(el('button.btn', { type: 'button', onclick: () => startAuswahlZeigen(handle) }, ['Erneut versuchen']));
      return;
    }

    await ordnerUebernehmen(handle);
    let daten = await datenLesen();

    if (!daten) {
      const name = await abfragen(
        'Neu anlegen',
        `Im Ordner „${handle.name}" wurde noch keine nebenkosten.json gefunden. Es wird neu angelegt.`,
        { label: 'Name', wert: handle.name }
      );
      if (name === null) { startAuswahlZeigen(await gemerkterOrdner()); return; }
      daten = neueDaten(name || handle.name);
      laden(daten);
      await sofortSpeichern();
      toast('Angelegt', 'ok');
    } else {
      laden(daten);
      if (neuAnlegen) toast('Vorhandene Daten geladen', 'info');
    }

    await ordnerMerken(handle);
    appStarten();
  } catch (e) {
    console.error(e);
    startFehler('Daten konnten nicht geladen werden',
      (e.message || String(e)) + '<br><br>Prüfe, ob die Datei nebenkosten.json gültig ist.');
    startBereich().append(el('button.btn', { type: 'button', style: 'margin-top:12px', onclick: () => location.reload() }, ['Neu starten']));
  }
}

/* ---------- App ---------- */

function appStarten() {
  $('#startup').hidden = true;
  $('#app').hidden = false;

  navAufbauen();
  // umschalterAufbauen();   // aktivieren, sobald es Umschalter gibt
  chromeAktualisieren();
  abonnieren(chromeAktualisieren);

  speicher.onStatus = statusAnzeigen;
  statusAnzeigen('idle');

  $('#themeToggle').addEventListener('click', () => {
    themaSetzen(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  $('#btnFolder').addEventListener('click', () => {
    toast(`Ordner: ${speicher.ordnerName} – siehe Einstellungen`, 'info', 5000);
    location.hash = '#/einstellungen';
  });

  window.addEventListener('hashchange', routen);
  window.addEventListener('beforeunload', (e) => {
    if (speicher.status === 'dirty' || speicher.status === 'saving') {
      sofortSpeichern();
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && speicher.status === 'dirty') sofortSpeichern();
  });

  routen();
}

function navAufbauen() {
  const nav = leeren($('#nav'));
  for (const key of REIHENFOLGE) {
    if (key === 'einstellungen') nav.append(el('div', { style: 'flex:1' }));
    const cfg = ANSICHTEN[key];
    nav.append(el('a.nav-item', { href: '#/' + key, dataset: { key } }, [
      el('span', { html: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`, style: 'display:flex' }),
      el('span', { text: cfg.navTitel || cfg.titel }),
      cfg.zaehler ? el('span.nav-badge', { dataset: { badge: key } }) : null,
    ]));
  }
}

/* Muster fuer einen Umschalter in der Kopfzeile. Der Zustand gehoert in ein
   eigenes Modul (Vorbild: ansicht.js im Vorsorgeplaner) und in den
   localStorage, nicht in die Datendatei – er beschreibt die Sicht auf die
   Zahlen, nicht die Zahlen selbst.

function umschalterAufbauen() {
  const box = leeren($('#modusA'));
  for (const [wert, text, titel] of [['a', 'A', 'Erklärung'], ['b', 'B', 'Erklärung']]) {
    box.append(el('button' + (modus() === wert ? '.aktiv' : ''), {
      type: 'button', text, title: titel,
      onclick: () => { if (modus() === wert) return; setModus(wert); umschalterAufbauen(); routen(); },
    }));
  }
}
*/

function chromeAktualisieren() {
  const d = state.daten;
  $('#datenName').textContent = d.meta.name;
  const version = $('#version');
  if (version) version.textContent = `v1.0 · Schema ${d.schemaVersion}`;
  $('#folderName').textContent = speicher.ordnerName || 'Ordner';

  // Der Titel kann von den Daten abhaengen, deshalb hier erneut setzen
  const key = (location.hash.replace(/^#\//, '') || REIHENFOLGE[0]).split('?')[0];
  const cfg = ANSICHTEN[key];
  if (cfg) $('#viewTitle').textContent = typeof cfg.titel === 'function' ? cfg.titel() : cfg.titel;

  document.title = d.meta.name + ' – NebenkostenKompass';
  for (const k of REIHENFOLGE) {
    const c = ANSICHTEN[k];
    if (!c.zaehler) continue;
    const badge = document.querySelector(`[data-badge="${k}"]`);
    if (badge) {
      const n = c.zaehler(d);
      badge.textContent = n > 0 ? String(n) : '';
    }
  }
}

function statusAnzeigen(status, detail) {
  const box = $('#saveStatus');
  if (!box) return;
  box.dataset.state = status;
  const label = box.querySelector('.label');
  const texte = {
    idle: detail instanceof Date ? 'Gespeichert ' + detail.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Gespeichert',
    dirty: 'Nicht gespeichert',
    saving: 'Speichert …',
    error: 'Fehler beim Speichern',
  };
  label.textContent = texte[status] || '';
  if (status === 'error') toast('Speichern fehlgeschlagen. Prüfe die Ordnerrechte.', 'err', 7000);
}

function routen() {
  const key = (location.hash.replace(/^#\//, '') || REIHENFOLGE[0]).split('?')[0];
  const cfg = ANSICHTEN[key] || ANSICHTEN[REIHENFOLGE[0]];

  for (const a of document.querySelectorAll('.nav-item')) {
    a.classList.toggle('active', a.dataset.key === (cfg.navKey || key));
  }
  $('#viewTitle').textContent = typeof cfg.titel === 'function' ? cfg.titel() : cfg.titel;

  const container = leeren($('#view'));
  container.scrollTop = 0;
  cfg.view.render(container);
}

starten();
