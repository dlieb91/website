/* Übersicht – das Ergebnis der gewählten Abrechnung auf einen Blick:
   was das Haus gekostet hat, was davon die Mieter tragen und wer nachzahlt
   oder Geld zurückbekommt. Solange etwas fehlt, zeigt sie den nächsten
   Schritt statt leerer Zahlen. */

import { el, eur, datum, heuteISO } from '../util.js';
import { state } from '../store.js';
import { abrechnen, tagNr } from '../umlage.js';
import { gewaehlteAbrechnung, mieterWaehlen } from '../ansicht.js';
import { neuAufbauen, abrechnungsLeiste, fehltNoch, rechtshinweis, warnungen, zeitraumText } from './gemeinsam.js';

export const uebersicht = {
  render(container) {
    const inner = el('div.view-inner', { style: 'display:grid;gap:16px' });
    container.append(inner);
    const neu = neuAufbauen(container, this);

    const fehlt = fehltNoch(neu);
    if (fehlt) {
      inner.append(schritte(), fehlt, rechtshinweis());
      return;
    }

    const a = gewaehlteAbrechnung();
    const r = abrechnen(state.daten, a);

    inner.append(abrechnungsLeiste(neu));
    inner.append(kennzahlen(r));
    const w = warnungen(r.warnungen);
    if (w) inner.append(w);
    inner.append(r.positionen.length ? ergebnisTabelle(a, r) : ohneKosten());
    inner.append(rechtshinweis());
  },
};

/* ---------- Die vier Schritte ---------- */

function schritte() {
  const d = state.daten;
  const liste = [
    ['Haus und Wohnungen', 'Anschrift, Wohnungen, Wohnflächen, Absender', '#/haus', d.einheiten.length > 0],
    ['Mieter', 'Ein- und Auszug, Personen, Vorauszahlung', '#/mieter', d.mietverhaeltnisse.length > 0],
    ['Kosten', 'Rechnungen des Jahres mit Umlageschlüssel', '#/kosten', d.abrechnungen.some((a) => a.kosten.some((k) => k.betrag))],
    ['Abrechnung', 'je Mieter ansehen und als PDF drucken', '#/abrechnung', false],
  ];
  return el('div.card', {}, [
    el('div.card-head', {}, [el('div', {}, [
      el('h2', { text: 'In vier Schritten zur Abrechnung' }),
      el('div.sub', { text: 'Haus und Mieter trägst du einmal ein – in den Folgejahren kommen nur die Kosten dazu.' }),
    ])]),
    el('div', {}, [el('table.data', {}, [el('tbody', {}, liste.map(([titel, sub, href, fertig], i) => el('tr', {}, [
      el('td', { style: 'width:36px' }, [el('span.badge' + (fertig ? '.gruen' : '.grau'), { text: fertig ? '✓' : String(i + 1) })]),
      el('td', {}, [el('a', { href, text: titel, style: 'font-weight:600' }), el('div.dim', { text: sub, style: 'font-size:12.5px;margin-top:2px' })]),
    ])))])]),
  ]);
}

/* ---------- Kennzahlen ---------- */

function kennzahlen(r) {
  const kachel = (label, wert, sub, klasse) => el('div.kpi' + (klasse ? '.' + klasse : ''), {}, [
    el('div.kpi-label', { text: label }),
    el('div.kpi-value', { text: wert }),
    sub ? el('div.kpi-sub', { text: sub }) : null,
  ]);

  const nachzahlungen = r.ergebnisse.filter((e) => e.saldo > 0).reduce((s, e) => s + e.saldo, 0);
  const guthaben = r.ergebnisse.filter((e) => e.saldo < 0).reduce((s, e) => s - e.saldo, 0);

  // Die Frist läuft nach dem Kalender, nicht nach dem Abrechnungsjahr:
  // gezählt werden die Tage von heute bis zum letzten zulässigen Zugangstag.
  const rest = r.frist ? tagNr(r.frist) - tagNr(heuteISO()) : null;
  const fristSub = rest == null ? '' : rest < 0 ? `seit ${-rest} Tagen abgelaufen` : rest === 0 ? 'läuft heute ab' : `noch ${rest} Tage`;

  return el('div.grid.grid-kpi', {}, [
    kachel('Betriebskosten gesamt', eur(r.gesamt), `${r.positionen.length} Positionen`),
    kachel('Auf Mieter umgelegt', eur(r.umgelegt), `${r.parteien.length} Mietverhältnisse im Zeitraum`),
    kachel('Bleibt bei dir', eur(r.vermieter), 'Leerstand und Centdifferenzen'),
    kachel('Nachzahlungen', eur(nachzahlungen), guthaben ? `Guthaben der Mieter: ${eur(guthaben)}` : 'keine Guthaben', nachzahlungen > 0 ? 'pos' : ''),
    kachel('Zugang beim Mieter bis', datum(r.frist), fristSub, rest != null && rest < 0 ? 'neg' : ''),
  ]);
}

/* ---------- Ergebnis je Mieter ---------- */

function ohneKosten() {
  return el('div.card', {}, [el('div.empty', {}, [
    el('div.empty-icon', { text: '🧾' }),
    el('h3', { text: 'Noch keine Kosten eingetragen' }),
    el('p', { text: 'Trage die Beträge aus Bescheiden und Rechnungen des Jahres ein. Zeilen ohne Betrag bleiben außen vor.' }),
    el('a.btn.btn-primary', { href: '#/kosten' }, ['Zu den Kosten']),
  ])]);
}

function ergebnisTabelle(a, r) {
  return el('div.card', {}, [
    el('div.card-head', {}, [el('div', {}, [
      el('h2', { text: `Ergebnis ${a.jahr}` }),
      el('div.sub', { text: `${zeitraumText(a)} · Nachzahlung in Grün ist Geld, das du bekommst` }),
    ])]),
    el('div', { style: 'overflow-x:auto' }, [el('table.data', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Mieter' }),
        el('th', { text: 'Wohnung' }),
        el('th', { style: 'text-align:right', text: 'Tage' }),
        el('th', { style: 'text-align:right', text: 'Kostenanteil' }),
        el('th', { style: 'text-align:right', text: 'Vorauszahlungen' }),
        el('th', { style: 'text-align:right', text: 'Ergebnis' }),
        el('th'),
      ])]),
      el('tbody', {}, r.ergebnisse.map((e) => el('tr', {}, [
        el('td', { text: e.mv.name || 'ohne Namen' }),
        el('td', { text: e.einheit.bezeichnung || '–' }),
        el('td.num', { text: `${e.tage} / ${r.tageZeitraum}` }),
        el('td.num', { text: eur(e.summe) }),
        el('td.num', { text: eur(e.voraus) }),
        el('td.num' + (e.saldo > 0 ? '.pos' : e.saldo < 0 ? '.neg' : ''), {
          text: e.saldo > 0 ? `Nachzahlung ${eur(e.saldo)}` : e.saldo < 0 ? `Guthaben ${eur(-e.saldo)}` : 'ausgeglichen',
        }),
        el('td', { style: 'text-align:right' }, [el('a.btn.btn-sm', {
          href: '#/abrechnung', onclick: () => mieterWaehlen(e.mv.id),
        }, ['Abrechnung'])]),
      ]))),
      el('tfoot', {}, [el('tr', {}, [
        el('td', { text: 'Summe', style: 'font-weight:600', colspan: 3 }),
        el('td.num', { style: 'font-weight:600', text: eur(r.umgelegt) }),
        el('td.num', { style: 'font-weight:600', text: eur(r.ergebnisse.reduce((s, e) => s + e.voraus, 0)) }),
        el('td.num', { style: 'font-weight:600', text: eur(r.ergebnisse.reduce((s, e) => s + e.saldo, 0)) }),
        el('td'),
      ])]),
    ])]),
  ]);
}
