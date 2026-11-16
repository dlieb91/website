/* Mieter – wer wann in welcher Wohnung wohnt. Jedes Mietverhältnis ist ein
   eigener Eintrag; ein Mieterwechsel sind zwei Einträge in derselben
   Wohnung. Aus Ein- und Auszugsdatum ergibt sich taggenau, welchen Teil
   eines Jahres jemand trägt. */

import { el, datum, bestaetigen } from '../util.js';
import { textFeld, zahlFeld, datumFeld, auswahlFeld, felderGitter, hinweis } from '../felder.js';
import { state, aendern, neuesMietverhaeltnis, mietverhaeltnisLoeschen, einheitMit } from '../store.js';
import { neuAufbauen, leerKarte } from './gemeinsam.js';

export const mieter = {
  render(container) {
    const inner = el('div.view-inner', { style: 'display:grid;gap:16px' });
    container.append(inner);
    const neu = neuAufbauen(container, this);
    const d = state.daten;

    if (!d.einheiten.length) {
      inner.append(leerKarte('🏠', 'Zuerst das Haus anlegen',
        'Mieter werden einer Wohnung zugeordnet – lege deshalb zuerst die Wohnungen an.',
        el('a.btn.btn-primary', { href: '#/haus' }, ['Zu Haus und Wohnungen'])));
      return;
    }

    const hinzu = () => {
      aendern(() => { d.mietverhaeltnisse.push(neuesMietverhaeltnis(d.einheiten[0].id)); });
      neu();
    };

    inner.append(el('div.toolbar', {}, [
      el('div.dim', { text: `${d.mietverhaeltnisse.length} Mietverhältnisse`, style: 'font-size:13px' }),
      el('div', { style: 'flex:1' }),
      el('button.btn.btn-primary', { type: 'button', onclick: hinzu }, ['Mieter hinzufügen']),
    ]));

    if (!d.mietverhaeltnisse.length) {
      inner.append(leerKarte('👥', 'Noch keine Mieter',
        'Trage ein, wer seit wann in welcher Wohnung wohnt und wie hoch die monatliche Vorauszahlung ist.',
        el('button.btn.btn-primary', { type: 'button', onclick: hinzu }, ['Mieter hinzufügen'])));
      return;
    }

    inner.append(hinweis(
      '<strong>Mieterwechsel:</strong> Trage beim bisherigen Mieter das Auszugsdatum ein und lege den neuen als eigenen Eintrag '
      + 'in derselben Wohnung an. Liegt dazwischen Leerstand, trägst du die Kosten dieser Tage selbst – '
      + 'sie werden nicht auf die anderen Mieter verteilt.'));

    // Reihenfolge wie die Wohnungen im Haus, darin der jüngste Einzug zuerst –
    // so steht der aktuelle Mieter über seinem Vorgänger.
    const sortiert = [...d.mietverhaeltnisse].sort((a, b) =>
      d.einheiten.indexOf(einheitMit(a.einheitId)) - d.einheiten.indexOf(einheitMit(b.einheitId))
      || String(b.einzug || '').localeCompare(String(a.einzug || '')));

    for (const m of sortiert) inner.append(karte(m, d, neu));
  },
};

function karte(m, d, neu) {
  const einheit = einheitMit(m.einheitId);
  const status = m.auszug
    ? el('span.badge.grau', { text: `ausgezogen ${datum(m.auszug)}` })
    : el('span.badge.gruen', { text: 'laufend' });

  return el('div.card', {}, [
    el('div.card-head', {}, [
      el('div', {}, [
        el('h2', { text: m.name || 'Neuer Mieter' }),
        el('div.sub', { text: `${einheit?.bezeichnung || 'Wohnung ohne Bezeichnung'} · ${m.einzug ? 'seit ' + datum(m.einzug) : 'Einzugsdatum fehlt'}` }),
      ]),
      el('div', { style: 'display:flex;gap:10px;align-items:center' }, [
        status,
        el('button.btn.btn-sm.btn-ghost', {
          type: 'button',
          onclick: async () => {
            const ok = await bestaetigen(
              'Mieter löschen?',
              `„${m.name || 'Neuer Mieter'}" verschwindet auch aus allen bisherigen Abrechnungen. Ist der Mieter nur ausgezogen, trage stattdessen das Auszugsdatum ein.`,
              { okText: 'Löschen', gefahr: true }
            );
            if (!ok) return;
            aendern(() => mietverhaeltnisLoeschen(m.id));
            neu();
          },
        }, ['Löschen']),
      ]),
    ]),
    el('div.card-body', {}, [
      felderGitter([
        textFeld('Name', m, 'name', { platzhalter: 'wie im Mietvertrag', nach: neu, hint: 'mehrere Mieter mit „und" verbinden' }),
        auswahlFeld('Wohnung', m, 'einheitId',
          d.einheiten.map((e) => ({ wert: e.id, text: e.bezeichnung || 'Ohne Bezeichnung' })), { nach: neu }),
        datumFeld('Einzug', m, 'einzug', { nach: neu, hint: 'Beginn des Mietverhältnisses' }),
        datumFeld('Auszug', m, 'auszug', { nach: neu, hint: 'leer = läuft weiter' }),
        zahlFeld('Personen', m, 'personen', { nachkomma: 0, hint: 'für den Personenschlüssel' }),
        zahlFeld('Vorauszahlung', m, 'vorauszahlung', { suffix: '€ / Monat', hint: 'Betriebs- und Heizkosten zusammen' }),
      ], 200),
      textFeld('Abweichende Anschrift', m, 'anschrift', {
        platzhalter: 'Straße, PLZ Ort',
        hint: 'nur nötig, wenn die Abrechnung nicht an die Wohnung gehen soll – etwa nach dem Auszug',
      }),
    ]),
  ]);
}
