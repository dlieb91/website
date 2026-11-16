/* Haus und Wohnungen – die Stammdaten, die sich selten ändern: Anschrift
   des Hauses, die Wohnungen mit ihrer Fläche und der Absender, der auf
   jeder Abrechnung steht. */

import { el, num, toast, bestaetigen } from '../util.js';
import { textFeld, felderGitter, abschnitt, tabellenText, tabellenZahl } from '../felder.js';
import { state, aendern, neueEinheit } from '../store.js';
import { neuAufbauen } from './gemeinsam.js';

export const haus = {
  render(container) {
    const inner = el('div.view-inner', { style: 'display:grid;gap:16px' });
    container.append(inner);
    const neu = neuAufbauen(container, this);
    const d = state.daten;

    inner.append(abschnitt('Haus', 'Anschrift des abgerechneten Objekts', [
      felderGitter([
        textFeld('Bezeichnung', d.objekt, 'bezeichnung', { platzhalter: 'z. B. Zweifamilienhaus Lindenweg', bezug: 'objekt' }),
        textFeld('Straße und Hausnummer', d.objekt, 'strasse', { bezug: 'objekt' }),
        textFeld('PLZ und Ort', d.objekt, 'plzOrt', { bezug: 'objekt' }),
      ], 230),
    ], 'Ein Ordner steht für <strong>ein Haus</strong>. Für ein zweites Haus legst du über den Startbildschirm einen weiteren Ordner an. '
      + 'Vermietest du eine einzelne Eigentumswohnung, trägst du nur diese eine Wohnung ein und übernimmst deine Anteile aus der Hausgeldabrechnung.'));

    inner.append(wohnungen(d, neu));

    inner.append(abschnitt('Absender', 'steht im Briefkopf jeder Abrechnung', [
      felderGitter([
        textFeld('Name', d.vermieter, 'name', { bezug: 'vermieter' }),
        textFeld('Straße und Hausnummer', d.vermieter, 'strasse', { bezug: 'vermieter' }),
        textFeld('PLZ und Ort', d.vermieter, 'plzOrt', { bezug: 'vermieter' }),
        textFeld('Telefon', d.vermieter, 'telefon', { bezug: 'vermieter' }),
        textFeld('E-Mail', d.vermieter, 'email', { bezug: 'vermieter' }),
      ], 230),
      felderGitter([
        textFeld('Kontoinhaber', d.vermieter, 'kontoinhaber', { bezug: 'vermieter', platzhalter: d.vermieter.name || '', hint: 'leer = wie Name' }),
        textFeld('IBAN', d.vermieter, 'iban', { bezug: 'vermieter', hint: 'für Nachzahlungen' }),
        textFeld('Bank', d.vermieter, 'bank', { bezug: 'vermieter' }),
      ], 230),
    ]));
  },
};

function wohnungen(d, neu) {
  const summe = d.einheiten.reduce((s, e) => s + (e.flaeche || 0), 0);

  const hinzu = el('button.btn.btn-sm.btn-primary', {
    type: 'button',
    onclick: () => { aendern(() => { d.einheiten.push(neueEinheit()); }); neu(); },
  }, ['Wohnung hinzufügen']);

  const kopf = el('div.card-head', {}, [
    el('div', {}, [
      el('h2', { text: 'Wohnungen' }),
      el('div.sub', { text: 'alle Wohnungen des Hauses – auch leerstehende und selbst genutzte' }),
    ]),
    hinzu,
  ]);

  if (!d.einheiten.length) {
    return el('div.card', {}, [kopf, el('div.empty', {}, [
      el('div.empty-icon', { text: '🏠' }),
      el('h3', { text: 'Noch keine Wohnung' }),
      el('p', { text: 'Lege jede Wohnung des Hauses mit ihrer Wohnfläche an. Die Summe der Flächen ist der Nenner des Flächenschlüssels.' }),
    ])]);
  }

  return el('div.card', {}, [
    kopf,
    el('div', { style: 'overflow-x:auto' }, [el('table.data.kompakt', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Bezeichnung' }),
        el('th', { style: 'text-align:right;width:170px', text: 'Wohnfläche in m²' }),
        el('th', { style: 'width:150px', text: 'Mieter' }),
        el('th', { style: 'width:90px' }),
      ])]),
      el('tbody', {}, d.einheiten.map((e) => {
        const belegt = d.mietverhaeltnisse.filter((m) => m.einheitId === e.id).length;
        return el('tr', {}, [
          el('td', {}, [tabellenText(e, 'bezeichnung', { platzhalter: 'z. B. Erdgeschoss links' })]),
          el('td', {}, [tabellenZahl(e, 'flaeche', { umbauen: neu })]),
          el('td.dim', { text: belegt ? `${belegt} erfasst` : 'keine' }),
          el('td', { style: 'text-align:right' }, [el('button.btn.btn-sm.btn-ghost', {
            type: 'button',
            onclick: async () => {
              if (belegt) {
                toast('Zu dieser Wohnung sind Mieter erfasst. Entferne sie zuerst unter „Mieter".', 'err', 6000);
                return;
              }
              if (!(await bestaetigen('Wohnung löschen?', `„${e.bezeichnung || 'Ohne Bezeichnung'}" wird entfernt.`, { okText: 'Löschen', gefahr: true }))) return;
              aendern(() => { d.einheiten = d.einheiten.filter((x) => x !== e); });
              neu();
            },
          }, ['Löschen'])]),
        ]);
      })),
      el('tfoot', {}, [el('tr', {}, [
        el('td', { text: `Gesamt · ${d.einheiten.length} ${d.einheiten.length === 1 ? 'Wohnung' : 'Wohnungen'}`, style: 'font-weight:600' }),
        el('td.num', { style: 'font-weight:600;padding-right:20px', text: num(summe, 2) + ' m²' }),
        el('td'), el('td'),
      ])]),
    ])]),
  ]);
}
