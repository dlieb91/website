/* Abrechnung – das fertige Schreiben je Mieter, so wie es gedruckt wird.

   Eine Betriebskostenabrechnung muss vier Dinge enthalten, damit sie formell
   trägt: die Gesamtkosten je Kostenart, den Verteilerschlüssel samt
   Erläuterung, den daraus berechneten Anteil des Mieters und den Abzug
   seiner Vorauszahlungen. Jede Zeile der Tabelle zeigt deshalb alle vier
   Rechenschritte und nicht nur das Ergebnis.

   Gedruckt wird über einen eigenen Druckbogen direkt unter <body>: Die App
   selbst steckt in Containern mit fester Höhe und eigenem Scrollen, aus
   denen der Browser nur die erste Seite drucken würde.
*/

import { el, eur, num, datum, heuteISO, esc } from '../util.js';
import { datumFeld, zahlFeld, felderGitter } from '../felder.js';
import { state, schluesselText } from '../store.js';
import { abrechnen, tagNr, isoAus } from '../umlage.js';
import { gewaehlteAbrechnung, gewaehlterMieter, mieterWaehlen } from '../ansicht.js';
import { neuAufbauen, abrechnungsLeiste, fehltNoch, rechtshinweis, warnungen } from './gemeinsam.js';

export const abrechnung = {
  render(container) {
    const inner = el('div.view-inner', { style: 'display:grid;gap:16px' });
    container.append(inner);
    const neu = neuAufbauen(container, this);

    const fehlt = fehltNoch(neu);
    if (fehlt) { inner.append(fehlt); return; }

    const a = gewaehlteAbrechnung();
    const r = abrechnen(state.daten, a);

    if (!r.positionen.length || !r.ergebnisse.length) {
      inner.append(abrechnungsLeiste(neu));
      inner.append(el('div.card', {}, [el('div.empty', {}, [
        el('div.empty-icon', { text: '🧾' }),
        el('h3', { text: r.positionen.length ? 'Kein Mieter im Zeitraum' : 'Noch keine Kosten eingetragen' }),
        el('p', {
          text: r.positionen.length
            ? 'Im Abrechnungszeitraum gibt es kein Mietverhältnis. Prüfe Ein- und Auszugsdaten.'
            : 'Sobald Beträge eingetragen sind, erscheint hier das Schreiben für jeden Mieter.',
        }),
        el('a.btn.btn-primary', { href: r.positionen.length ? '#/mieter' : '#/kosten' }, [r.positionen.length ? 'Zu den Mietern' : 'Zu den Kosten']),
      ])]));
      return;
    }

    const wahl = gewaehlterMieter();
    const gezeigt = r.ergebnisse.filter((e) => e.mv.id === wahl);
    const liste = gezeigt.length ? gezeigt : r.ergebnisse;
    const blaetter = liste.map((e) => blatt(a, r, e));

    const mieterWahl = el('select', {
      title: 'Mieter wählen',
      onchange: (e) => { mieterWaehlen(e.target.value); neu(); },
    }, [
      el('option', { value: 'alle', selected: !gezeigt.length }, [`Alle Mieter (${r.ergebnisse.length})`]),
      ...r.ergebnisse.map((e) => el('option', { value: e.mv.id, selected: gezeigt[0] === e }, [
        `${e.mv.name || 'ohne Namen'} · ${e.einheit.bezeichnung || 'Wohnung'}`,
      ])),
    ]);

    inner.append(abrechnungsLeiste(neu, [
      mieterWahl,
      el('button.btn.btn-primary', {
        type: 'button', title: 'Im Druckdialog „Als PDF speichern" wählen, um eine PDF-Datei zu erhalten',
        onclick: () => drucken(blaetter),
      }, [liste.length > 1 ? `Alle ${liste.length} drucken / PDF` : 'Drucken / PDF']),
    ]));

    const w = warnungen(r.warnungen);
    if (w) inner.append(w);
    inner.append(schreibenKarte(a, neu));
    for (const b of blaetter) inner.append(b);
    inner.append(rechtshinweis());
  },
};

/* ---------- Angaben zum Schreiben ---------- */

function schreibenKarte(a, neu) {
  return el('div.card', {}, [
    el('div.card-head', {}, [el('div', {}, [
      el('h2', { text: 'Angaben zum Schreiben' }),
      el('div.sub', { text: 'gelten für alle Mieter dieser Abrechnung' }),
    ])]),
    el('div.card-body', {}, [felderGitter([
      datumFeld('Datum des Schreibens', a, 'briefDatum', { nach: neu, bezug: a.id, hint: 'leer = heute' }),
      zahlFeld('Zahlungsfrist', state.daten.einstellungen, 'zahlungsfristTage', {
        suffix: 'Tage', nachkomma: 0, nach: neu, hint: 'für Nachzahlungen, ab Datum des Schreibens',
      }),
      datumFeld('Neue Vorauszahlung gilt ab', a, 'anpassungAb', {
        nach: neu, bezug: a.id, hint: 'nur wichtig, wenn unter „Kosten" eine neue Vorauszahlung eingetragen ist',
      }),
    ], 220)]),
  ]);
}

/* ---------- Das Schreiben ---------- */

/** Menge und Anteil einer Position in Worten – der nachvollziehbare Rechenweg. */
function rechenweg(pos, e, r) {
  const an = pos.anteile[e.mv.id];
  const anteilig = e.tage < r.tageZeitraum ? ` × ${e.tage}/${r.tageZeitraum} Tage` : '';
  switch (pos.schluessel) {
    case 'einheiten':
      return [`${r.anzahlEinheiten} ${r.anzahlEinheiten === 1 ? 'Einheit' : 'Einheiten'}`, '1 Einheit' + anteilig];
    case 'personen':
      return [`${num(pos.gesamtMenge, 0)} Personentage`, `${num(an.menge, 0)} (${num(e.mv.personen || 0, 0)} Pers. × ${e.tage} Tage)`];
    case 'verbrauch':
      return [num(pos.gesamtMenge, 2), num(an.menge, 2)];
    case 'direkt':
      return ['–', 'laut Einzelabrechnung'];
    default:
      return [`${num(r.gesamtFlaeche, 2)} m²`, `${num(e.einheit.flaeche || 0, 2)} m²` + anteilig];
  }
}

const ERLAEUTERUNG = {
  flaeche: 'Verteilung im Verhältnis der Wohnfläche Ihrer Wohnung zur gesamten Wohnfläche des Hauses.',
  einheiten: 'Verteilung zu gleichen Teilen auf alle Wohneinheiten des Hauses.',
  personen: 'Verteilung nach Personentagen: Zahl der Personen eines Haushalts mal Tage der Nutzung, im Verhältnis zur Summe aller Personentage im Haus.',
  verbrauch: 'Verteilung im Verhältnis des für Ihre Wohnung abgelesenen Verbrauchs zum Gesamtverbrauch.',
  direkt: 'Der Betrag stammt aus einer gesonderten Einzelabrechnung für Ihre Wohnung (zum Beispiel der Heizkostenabrechnung des Messdienstes), die diesem Schreiben beiliegt.',
};

function blatt(a, r, e) {
  const d = state.daten;
  const v = d.vermieter;
  const zeile = (text, klasse) => (text ? el('div' + (klasse ? '.' + klasse : ''), { text }) : null);

  const briefDatum = a.briefDatum || heuteISO();
  const fristTage = d.einstellungen.zahlungsfristTage;
  const zahlbarBis = isoAus(tagNr(briefDatum) + (Number.isFinite(fristTage) && fristTage > 0 ? fristTage : 30));

  // Nach dem Auszug geht das Schreiben an die neue Anschrift, sonst an die Wohnung.
  const anschrift = (e.mv.anschrift || '').trim()
    ? e.mv.anschrift.split(',').map((s) => s.trim()).filter(Boolean)
    : [d.objekt.strasse, d.objekt.plzOrt];

  const meine = r.positionen.filter((p) => p.anteile[e.mv.id].betrag !== 0 || p.schluessel !== 'direkt');
  const benutzt = [...new Set(meine.map((p) => p.schluessel))];
  const lohnZeilen = meine.filter((p) => p.anteile[e.mv.id].lohn > 0);
  const neueVoraus = a.neueVoraus?.[e.mv.id];

  const tabelle = el('table.bl-tabelle', {}, [
    el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Kostenart' }),
      el('th.zahl', { text: 'Gesamtkosten' }),
      el('th', { text: 'Umlageschlüssel' }),
      el('th.zahl', { text: 'Gesamt' }),
      el('th.zahl', { text: 'Ihr Anteil' }),
      el('th.zahl', { text: 'Ihr Betrag' }),
    ])]),
    el('tbody', {}, meine.map((p) => {
      const [gesamtText, anteilText] = rechenweg(p, e, r);
      return el('tr', {}, [
        el('td', { text: p.kosten.bezeichnung || 'Betriebskosten' }),
        el('td.zahl', { text: eur(p.gesamt) }),
        el('td', { text: schluesselText(p.schluessel) }),
        el('td.zahl.weich', { text: gesamtText }),
        el('td.zahl.weich', { text: anteilText }),
        el('td.zahl', { text: eur(p.anteile[e.mv.id].betrag) }),
      ]);
    })),
    el('tfoot', {}, [el('tr', {}, [
      el('td', { text: 'Summe' }),
      el('td.zahl', { text: eur(meine.reduce((s, p) => s + p.gesamt, 0)) }),
      el('td', { colspan: 3 }),
      el('td.zahl', { text: eur(e.summe) }),
    ])]),
  ]);

  const ergebnis = el('table.bl-ergebnis', {}, [el('tbody', {}, [
    el('tr', {}, [el('td', { text: 'Ihr Anteil an den Betriebskosten' }), el('td.zahl', { text: eur(e.summe) })]),
    el('tr', {}, [el('td', { text: 'abzüglich Ihrer Vorauszahlungen' }), el('td.zahl', { text: eur(-e.voraus) })]),
    el('tr.bl-saldo', {}, [
      el('td', { text: e.saldo > 0 ? 'Nachzahlung zu Ihren Lasten' : e.saldo < 0 ? 'Guthaben zu Ihren Gunsten' : 'Ergebnis' }),
      el('td.zahl', { text: eur(Math.abs(e.saldo)) }),
    ]),
  ])]);

  const konto = [
    v.kontoinhaber || v.name ? `Kontoinhaber: ${esc(v.kontoinhaber || v.name)}` : null,
    v.iban ? `IBAN: ${esc(v.iban)}` : null,
    v.bank ? `Bank: ${esc(v.bank)}` : null,
  ].filter(Boolean).join(' · ');

  const zahlung = e.saldo > 0
    ? `Bitte überweisen Sie den Betrag von <strong>${eur(e.saldo)}</strong> bis zum <strong>${datum(zahlbarBis)}</strong>`
      + (konto ? ` auf folgendes Konto:<br>${konto}` : '.')
    : e.saldo < 0
      ? `Das Guthaben von <strong>${eur(-e.saldo)}</strong> überweise ich auf Ihr Konto. Bitte geben Sie mir Bescheid, falls sich Ihre Bankverbindung geändert hat.`
      : 'Ihre Vorauszahlungen decken die Kosten genau – es ist nichts nachzuzahlen und nichts zu erstatten.';

  const anpassung = typeof neueVoraus === 'number'
    ? `Auf Grundlage dieser Abrechnung passe ich die monatliche Vorauszahlung nach § 560 Abs. 4 BGB an: `
      + `Sie beträgt ${a.anpassungAb ? 'ab dem ' + datum(a.anpassungAb) : 'ab der nächsten fälligen Miete'} `
      + `<strong>${eur(neueVoraus)}</strong>${typeof e.mv.vorauszahlung === 'number' ? ' statt bisher ' + eur(e.mv.vorauszahlung) : ''}.`
    : null;

  return el('div.blatt', {}, [
    el('div.bl-absender', { text: [v.name, v.strasse, v.plzOrt].filter(Boolean).join(' · ') || 'Absender unter „Haus" eintragen' }),
    el('div.bl-kopf', {}, [
      el('div.bl-empfaenger', {}, [zeile(e.mv.name || 'Mieter'), ...anschrift.map((s) => zeile(s))]),
      el('div.bl-rechts', {}, [
        zeile(v.telefon ? 'Telefon ' + v.telefon : ''), zeile(v.email),
        el('div', { text: datum(briefDatum), style: 'margin-top:6px' }),
      ]),
    ]),

    el('h2', { text: `Betriebskostenabrechnung ${a.jahr}` }),
    el('table.bl-eckdaten', {}, [el('tbody', {}, [
      ['Objekt', [d.objekt.strasse, d.objekt.plzOrt].filter(Boolean).join(', ') || d.objekt.bezeichnung || '–'],
      ['Wohnung', `${e.einheit.bezeichnung || '–'}${e.einheit.flaeche ? ` · ${num(e.einheit.flaeche, 2)} m²` : ''}`],
      ['Abrechnungszeitraum', `${datum(a.von)} – ${datum(a.bis)} (${r.tageZeitraum} Tage)`],
      ['Ihr Nutzungszeitraum', `${datum(e.von)} – ${datum(e.bis)} (${e.tage} Tage)`],
    ].map(([k, w]) => el('tr', {}, [el('td', { text: k }), el('td', { text: w })])))]),

    el('p', { text: `Guten Tag ${e.mv.name || ''},`.replace(' ,', ',') }),
    el('p', { text: 'für den oben genannten Zeitraum rechne ich die Betriebskosten wie folgt ab:' }),

    tabelle,
    ergebnis,
    el('p', { html: zahlung }),
    anpassung ? el('p', { html: anpassung }) : null,

    el('h3', { text: 'Erläuterung der Umlageschlüssel' }),
    el('ul', {}, [
      ...benutzt.map((s) => el('li', {}, [el('strong', { text: schluesselText(s) + ': ' }), ERLAEUTERUNG[s]])),
      e.tage < r.tageZeitraum ? el('li', {}, [
        el('strong', { text: 'Zeitanteil: ' }),
        `Sie haben die Wohnung an ${e.tage} von ${r.tageZeitraum} Tagen des Abrechnungszeitraums genutzt. Zeitabhängige Anteile sind taggenau auf diesen Zeitraum gekürzt.`,
      ]) : null,
    ]),

    lohnZeilen.length ? el('h3', { text: 'Bescheinigung nach § 35a EStG' }) : null,
    lohnZeilen.length ? el('p', {
      text: `In Ihrem Kostenanteil sind ${eur(e.lohn)} für haushaltsnahe Dienstleistungen und Handwerkerleistungen enthalten `
        + `(${lohnZeilen.map((p) => `${p.kosten.bezeichnung}: ${eur(p.anteile[e.mv.id].lohn)}`).join(', ')}). `
        + 'Sie können diesen Betrag in Ihrer Einkommensteuererklärung angeben.',
    }) : null,

    el('p', { text: 'Die Belege zu dieser Abrechnung können Sie nach Terminabsprache bei mir einsehen.' }),
    el('p', { text: 'Mit freundlichen Grüßen' }),
    el('p.bl-unterschrift', { text: v.name || '' }),
  ]);
}

/* ---------- Drucken ---------- */

function drucken(blaetter) {
  document.getElementById('druckbogen')?.remove();
  const bogen = el('div', { id: 'druckbogen' }, blaetter.map((b) => b.cloneNode(true)));
  document.body.append(bogen);
  document.body.classList.add('druck-bericht');
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('druck-bericht');
    bogen.remove();
  }, { once: true });
  window.print();
}
