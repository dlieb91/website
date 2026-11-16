/* Einstellungen – Speicherort, Sicherungen, Änderungsprotokoll.

   Diese Ansicht ist in jeder Zahlenkompass-App fast gleich und kann so
   uebernommen werden. Fachliches gehoert in eigene Karten darunter.
*/

import { el, leeren, num, datum, toast, bestaetigen, abfragen } from '../util.js';
import { abschnitt, hinweis } from '../felder.js';
import { state, aendern, laden, protokollEintraege } from '../store.js';
import {
  speicher, DATEI, backupsAuflisten, backupLesen, sofortSpeichern, ordnerVergessen,
} from '../storage.js';

export const einstellungen = {
  render(container) {
    const inner = el('div.view-inner', { style: 'display:grid;gap:16px' });
    container.append(inner);

    const neu = () => { leeren(container); this.render(container); };

    inner.append(kopfKarte(neu));
    inner.append(speicherKarte(neu));
    inner.append(protokollKarte());
  },
};

/* ---------- Name und Zeitstempel ---------- */

function kopfKarte(neu) {
  const d = state.daten;
  return abschnitt('Allgemein', 'Name und Zeitstempel', [
    el('div.summen', { style: 'margin-top:0' }, [
      summe('Name', d.meta.name),
      summe('Angelegt', datum(d.meta.erstelltAm)),
      summe('Zuletzt geändert', datum(d.meta.geaendertAm)),
    ]),
    el('div', { style: 'margin-top:16px' }, [
      el('button.btn.btn-sm', {
        type: 'button',
        onclick: async () => {
          const name = await abfragen('Umbenennen', 'Der Name erscheint in der Kopfzeile.',
            { label: 'Name', wert: d.meta.name });
          if (name === null || !name) return;
          aendern(() => { d.meta.name = name; });
          neu();
        },
      }, ['Umbenennen']),
    ]),
  ]);
}

function summe(label, wert) {
  return el('div.summe', {}, [
    el('div.summe-label', { text: label }),
    el('div.summe-wert', { text: wert, style: 'font-size:14px' }),
  ]);
}

/* ---------- Speicherung ---------- */

function speicherKarte(neu) {
  const karte = el('div.card', {}, [
    el('div.card-head', {}, [
      el('div', {}, [
        el('h2', { text: 'Speicherung' }),
        el('div.sub', { text: `Ordner „${speicher.ordnerName}" · Datei ${DATEI}` }),
      ]),
      el('button.btn.btn-sm', {
        type: 'button',
        onclick: async () => { await sofortSpeichern(); toast('Gespeichert', 'ok'); },
      }, ['Jetzt speichern']),
    ]),
  ]);

  // Die Liste kommt asynchron; solange steht ein Platzhalter da.
  const body = el('div.card-body', {}, [
    el('div', { text: 'Sicherungen werden geladen …', style: 'color:var(--text-faint);font-size:13px' }),
  ]);
  karte.append(body);

  backupsAuflisten().then((liste) => {
    leeren(body);
    body.append(hinweis(
      'Alles bleibt auf deinem Rechner. Die App schreibt bei jeder Änderung in '
      + `<strong>${DATEI}</strong> und legt einmal täglich eine Sicherung unter <strong>backups/</strong> ab – `
      + 'die letzten 20 bleiben erhalten. Vor dem Wiederherstellen wird der aktuelle Stand gesichert, '
      + 'der Schritt ist also umkehrbar.'
    ));

    if (!liste.length) {
      body.append(el('div.dim', { style: 'font-size:13px', text: 'Noch keine Sicherung vorhanden.' }));
    } else {
      body.append(el('table.data.kompakt', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Sicherung' }),
          el('th', { style: 'text-align:right', text: 'Größe' }),
          el('th', { text: '' }),
        ])]),
        el('tbody', {}, liste.map((b) => el('tr', {}, [
          el('td', {}, [
            el('div', { text: lesbarerStempel(b.name) }),
            el('div.faint', { style: 'font-size:11.5px', text: b.name }),
          ]),
          el('td.num', { text: num(b.groesse / 1024, 1) + ' kB' }),
          el('td', { style: 'text-align:right' }, [
            el('button.btn.btn-sm', { type: 'button', onclick: () => wiederherstellen(b.name, neu) },
              ['Wiederherstellen']),
          ]),
        ]))),
      ]));
    }

    body.append(el('div', { style: 'margin-top:18px;padding-top:14px;border-top:1px solid var(--border)' }, [
      el('button.btn.btn-danger.btn-sm', {
        type: 'button',
        onclick: async () => {
          const ok = await bestaetigen('Ordner vergessen',
            'Die App merkt sich den Ordner dann nicht mehr und fragt beim nächsten Start erneut danach. '
            + 'Deine Dateien bleiben unangetastet.',
            { okText: 'Vergessen', gefahr: true });
          if (!ok) return;
          await ordnerVergessen();
          toast('Ordner vergessen – beim nächsten Start wird erneut gefragt', 'ok', 5000);
        },
      }, ['Ordner vergessen']),
    ]));
  }).catch((e) => {
    leeren(body);
    body.append(el('div.startup-err', { text: 'Sicherungen konnten nicht gelesen werden: ' + e.message }));
  });

  return karte;
}

/** Aus „name-2026-07-31-14-05.json" ein lesbares Datum machen. */
function lesbarerStempel(name) {
  const t = name.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (!t) return name;
  return `${t[3]}.${t[2]}.${t[1]}, ${t[4]}:${t[5]} Uhr`;
}

async function wiederherstellen(name, neu) {
  const ok = await bestaetigen('Sicherung wiederherstellen',
    `Der aktuelle Stand wird zuvor gesichert. Danach gilt der Stand aus „${lesbarerStempel(name)}".`,
    { okText: 'Wiederherstellen' });
  if (!ok) return;

  try {
    // letztesBackup zuruecksetzen erzwingt eine Sicherung des Ist-Standes
    aendern(() => { state.daten.meta.letztesBackup = null; });
    await sofortSpeichern();

    laden(await backupLesen(name));
    aendern(() => { state.daten.meta.letztesBackup = null; });
    await sofortSpeichern();
    toast('Sicherung wiederhergestellt', 'ok');
    neu();
  } catch (e) {
    toast('Wiederherstellen fehlgeschlagen: ' + e.message, 'err', 6000);
  }
}

/* ---------- Protokoll ---------- */

function protokollKarte() {
  const eintraege = protokollEintraege().slice(0, 200);

  return el('div.card', {}, [
    el('div.card-head', {}, [
      el('div', {}, [
        el('h2', { text: 'Änderungsprotokoll' }),
        el('div.sub', { text: `${state.daten.protokoll.length} Einträge, die letzten 200 werden gezeigt` }),
      ]),
    ]),
    eintraege.length
      ? el('div.plan-scroll', {}, [
          el('table.data.kompakt', {}, [
            el('thead', {}, [el('tr', {}, [
              el('th', { text: 'Zeitpunkt' }),
              el('th', { text: 'Feld' }),
              el('th', { text: 'vorher' }),
              el('th', { text: 'nachher' }),
            ])]),
            el('tbody', {}, eintraege.map((p) => el('tr', {}, [
              el('td.faint', { text: new Date(p.zeit).toLocaleString('de-DE') }),
              el('td', { text: p.was }),
              el('td.faint', { text: wertText(p.alt) }),
              el('td', { text: wertText(p.neu) }),
            ]))),
          ]),
        ])
      : el('div.card-body', {}, [
          el('div.dim', { style: 'font-size:13px', text: 'Noch keine Änderungen protokolliert.' }),
        ]),
  ]);
}

function wertText(v) {
  if (v == null || v === '') return '–';
  if (typeof v === 'boolean') return v ? 'ja' : 'nein';
  if (typeof v === 'number') return num(v, 2);
  return String(v);
}
