/* Kosten – die Rechnungen und Bescheide eines Abrechnungsjahres, jede mit
   ihrem Umlageschlüssel, und darunter die Vorauszahlungen der Mieter.
   Hier entsteht die Abrechnung; die Ansicht „Abrechnung" zeigt sie nur noch. */

import { el, eur, num, datum } from '../util.js';
import { datumFeld, anzeigeFeld, felderGitter, hinweis, tabellenText, tabellenZahl, tabellenAuswahl } from '../felder.js';
import { state, aendern, neueKosten, KOSTENARTEN, SCHLUESSEL } from '../store.js';
import { abrechnen, gesamtbetrag } from '../umlage.js';
import { gewaehlteAbrechnung } from '../ansicht.js';
import { neuAufbauen, abrechnungsLeiste, fehltNoch, warnungen } from './gemeinsam.js';

export const kosten = {
  render(container) {
    const inner = el('div.view-inner', { style: 'display:grid;gap:16px' });
    container.append(inner);
    const neu = neuAufbauen(container, this);

    const fehlt = fehltNoch(neu);
    if (fehlt) { inner.append(fehlt); return; }

    const a = gewaehlteAbrechnung();
    const r = abrechnen(state.daten, a);

    inner.append(abrechnungsLeiste(neu));
    inner.append(zeitraumKarte(a, r, neu));
    const w = warnungen(r.warnungen);
    if (w) inner.append(w);
    inner.append(kostenKarte(a, r, neu));
    if (r.parteien.length) inner.append(vorauszahlungen(a, r, neu));
  },
};

/* ---------- Zeitraum ---------- */

function zeitraumKarte(a, r, neu) {
  return el('div.card', {}, [
    el('div.card-head', {}, [el('div', {}, [
      el('h2', { text: 'Abrechnungszeitraum' }),
      el('div.sub', { text: 'meist das Kalenderjahr – höchstens zwölf Monate' }),
    ])]),
    el('div.card-body', {}, [felderGitter([
      datumFeld('Von', a, 'von', { nach: neu, bezug: a.id }),
      datumFeld('Bis', a, 'bis', { nach: neu, bezug: a.id }),
      anzeigeFeld('Tage', num(r.tageZeitraum, 0)),
      anzeigeFeld('Zugang beim Mieter bis', datum(r.frist), { hint: 'danach sind Nachforderungen in der Regel ausgeschlossen' }),
    ], 190)]),
  ]);
}

/* ---------- Kostenpositionen ---------- */

function kostenKarte(a, r, neu) {
  const hinzu = el('select', {
    title: 'Kostenart hinzufügen',
    onchange: (e) => {
      if (!e.target.value) return;
      aendern(() => { a.kosten.push(neueKosten(e.target.value)); });
      neu();
    },
  }, [
    el('option', { value: '' }, ['+ Kostenart hinzufügen …']),
    ...KOSTENARTEN.map((k) => el('option', { value: k.wert }, [k.text])),
  ]);

  const zeilen = [];
  for (const k of a.kosten) {
    const direkt = k.schluessel === 'direkt';
    const mitAnteilen = direkt || k.schluessel === 'verbrauch';
    zeilen.push(el('tr', {}, [
      el('td', {}, [tabellenText(k, 'bezeichnung', { platzhalter: 'Bezeichnung' })]),
      el('td', {}, [tabellenAuswahl(k, 'schluessel', SCHLUESSEL, { nach: neu, title: 'Umlageschlüssel laut Mietvertrag' })]),
      el('td', {}, [direkt
        // Bei „direkt" gibt es keinen Betrag zum Verteilen – die Summe der
        // zugeordneten Beträge darunter ist der Gesamtbetrag.
        ? el('div.readonly', { text: num(gesamtbetrag(k, r.parteien), 2), style: 'text-align:right', title: 'Summe der zugeordneten Beträge' })
        : tabellenZahl(k, 'betrag', { umbauen: neu })]),
      el('td', {}, [tabellenZahl(k, 'lohnanteil', { umbauen: neu, platzhalter: '–' })]),
      el('td', { style: 'text-align:right' }, [el('button.btn.btn-sm.btn-ghost', {
        type: 'button', title: 'Position entfernen',
        onclick: () => { aendern(() => { a.kosten = a.kosten.filter((x) => x !== k); }); neu(); },
      }, ['✕'])]),
    ]));
    if (mitAnteilen) zeilen.push(anteilZeile(k, r, direkt, neu));
  }

  const lohn = r.positionen.reduce((s, p) => s + p.lohnGesamt, 0);

  return el('div.card', {}, [
    el('div.card-head', {}, [
      el('div', {}, [
        el('h2', { text: 'Kostenpositionen' }),
        el('div.sub', { text: 'Jahresbeträge aus Bescheiden und Rechnungen · Zeilen ohne Betrag bleiben außen vor' }),
      ]),
      hinzu,
    ]),
    el('div.card-body', { style: 'padding-bottom:0' }, [hinweis(
      'Umlegen darfst du nur, was der <strong>Mietvertrag</strong> als Betriebskosten vereinbart – und nur nach dem dort genannten Schlüssel. '
      + 'Ohne Vereinbarung gilt die Wohnfläche. Nicht umlagefähig sind Verwaltung, Reparaturen und Rücklagen; '
      + 'Kabelgebühren seit Juli 2024 ebenfalls nicht mehr. '
      + '<strong>Heizung und Warmwasser</strong> übernimmst du je Mieter aus der Abrechnung deines Messdienstes (Schlüssel „Direkt zugeordnet") – '
      + 'die verbrauchsabhängige Aufteilung nach Heizkostenverordnung rechnet diese App nicht selbst.')]),
    el('div', { style: 'overflow-x:auto' }, [el('table.data.kompakt', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Kostenart' }),
        el('th', { style: 'width:190px', text: 'Umlageschlüssel' }),
        el('th', { style: 'text-align:right;width:150px', text: 'Betrag in €' }),
        el('th', { style: 'text-align:right;width:150px', text: 'davon § 35a in €', title: 'Lohn- und Arbeitskosten für haushaltsnahe Dienstleistungen und Handwerker – die Mieter können sie steuerlich ansetzen' }),
        el('th', { style: 'width:50px' }),
      ])]),
      el('tbody', {}, zeilen),
      el('tfoot', {}, [el('tr', {}, [
        el('td', { text: 'Summe', style: 'font-weight:600', colspan: 2 }),
        el('td.num', { style: 'font-weight:600;padding-right:20px', text: eur(r.gesamt) }),
        el('td.num', { style: 'padding-right:20px', text: lohn ? eur(lohn) : '–' }),
        el('td'),
      ])]),
    ])]),
  ]);
}

/** Zweite Zeile unter einer Position: Verbrauch bzw. Eurobetrag je Partei. */
function anteilZeile(k, r, direkt, neu) {
  const feld = (id, name, sub) => el('div.anteil', {}, [
    el('label', {}, [name, sub ? el('span.faint', { text: ' · ' + sub }) : null]),
    tabellenZahl(k.anteile, id, { umbauen: neu, platzhalter: direkt ? '0,00' : '0' }),
  ]);

  return el('tr.anteile-zeile', {}, [el('td', { colspan: 5 }, [
    el('div.anteile-titel', {
      text: direkt
        ? 'Betrag je Mieter in € – aus der Einzelabrechnung übernehmen'
        : 'Abgelesener Verbrauch je Mieter – der Betrag wird im Verhältnis der Werte verteilt',
    }),
    el('div.anteile', {}, [
      ...r.parteien.map((p) => feld(p.mv.id, p.mv.name || 'ohne Namen', p.einheit.bezeichnung)),
      feld('leer', 'Leerstand', 'trägst du selbst'),
    ]),
    !r.parteien.length ? el('div.faint', { text: 'Im Abrechnungszeitraum gibt es noch kein Mietverhältnis.', style: 'font-size:12.5px' }) : null,
  ])]);
}

/* ---------- Vorauszahlungen ---------- */

function vorauszahlungen(a, r, neu) {
  return el('div.card', {}, [
    el('div.card-head', {}, [el('div', {}, [
      el('h2', { text: 'Vorauszahlungen' }),
      el('div.sub', { text: 'was die Mieter im Zeitraum schon gezahlt haben' }),
    ])]),
    el('div.card-body', { style: 'padding-bottom:0' }, [hinweis(
      'Das <strong>Soll</strong> ergibt sich aus der monatlichen Vorauszahlung und den belegten Monaten. '
      + 'Hat ein Mieter etwas anderes gezahlt – etwa nach einer Anpassung im Jahr –, trägst du unter „Tatsächlich gezahlt" die Summe ein; '
      + 'ein leeres Feld übernimmt das Soll. Die <strong>Empfehlung</strong> ist der Kostenanteil, auf ein volles Jahr hochgerechnet und durch zwölf geteilt.')]),
    el('div', { style: 'overflow-x:auto' }, [el('table.data.kompakt', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Mieter' }),
        el('th', { style: 'text-align:right', text: 'Kostenanteil' }),
        el('th', { style: 'text-align:right', text: 'Soll' }),
        el('th', { style: 'text-align:right;width:150px', text: 'Tatsächlich gezahlt' }),
        el('th', { style: 'text-align:right', text: 'Ergebnis' }),
        el('th', { style: 'text-align:right', text: 'Empfehlung mtl.' }),
        el('th', { style: 'text-align:right;width:150px', text: 'Neue Vorauszahlung', title: 'Erscheint im Anschreiben. Leer lassen, wenn sich nichts ändern soll.' }),
      ])]),
      el('tbody', {}, r.ergebnisse.map((e) => el('tr', {}, [
        el('td', {}, [e.mv.name || 'ohne Namen', el('div.faint', {
          style: 'font-size:12px', text: `${e.einheit.bezeichnung || 'Wohnung'} · ${datum(e.von)} – ${datum(e.bis)}`,
        })]),
        el('td.num', { text: eur(e.summe) }),
        el('td.num', { text: eur(e.vorausSoll) }),
        el('td', {}, [tabellenZahl(a.gezahlt, e.mv.id, { umbauen: neu, platzhalter: num(e.vorausSoll, 2) })]),
        el('td.num' + (e.saldo > 0 ? '.pos' : e.saldo < 0 ? '.neg' : ''), {
          text: e.saldo > 0 ? `Nachzahlung ${eur(e.saldo)}` : e.saldo < 0 ? `Guthaben ${eur(-e.saldo)}` : 'ausgeglichen',
        }),
        el('td.num', { text: eur(e.empfehlung, 0) }),
        el('td', {}, [tabellenZahl(a.neueVoraus, e.mv.id, { umbauen: neu, platzhalter: 'unverändert' })]),
      ]))),
    ])]),
  ]);
}
