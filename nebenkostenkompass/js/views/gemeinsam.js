/* Bausteine, die mehrere Ansichten teilen: die Auswahl der Abrechnung,
   Leerzustände, der Rechtshinweis und das Neuaufbauen mit Fokus. */

import { el, leeren, datum, abfragen, bestaetigen, toast } from '../util.js';
import { hinweis } from '../felder.js';
import { state, aendern, neueAbrechnung, abrechnungenSortiert } from '../store.js';
import { gewaehlteAbrechnung, abrechnungWaehlen } from '../ansicht.js';

/**
 * Baut die Ansicht neu auf und setzt den Cursor wieder in das Feld, in dem
 * er stand.
 *
 * Wer eine Spalte Beträge mit der Tabulatortaste durchgeht, landet nach
 * jeder Eingabe im nächsten Feld – das der Neuaufbau gleich wieder
 * wegwirft. Deshalb wird erst nach dem Fokuswechsel umgebaut (setTimeout)
 * und das Feld an derselben Stelle der neuen Ansicht wieder angesteuert.
 */
export function neuAufbauen(container, view) {
  return () => setTimeout(() => {
    const felder = () => Array.from(container.querySelectorAll('input, select, textarea'));
    const stelle = felder().indexOf(document.activeElement);
    const scroll = container.scrollTop;
    leeren(container);
    view.render(container);
    container.scrollTop = scroll;
    const ziel = stelle >= 0 ? felder()[stelle] : null;
    if (ziel) {
      ziel.focus();
      if (ziel.select && ziel.type === 'text') ziel.select();
    }
  }, 0);
}

export const zeitraumText = (a) => `${datum(a.von)} – ${datum(a.bis)}`;

/* ---------- Auswahl der Abrechnung ---------- */

export async function abrechnungAnlegen(neu) {
  const d = state.daten;
  const letzte = abrechnungenSortiert()[0];
  // Abgerechnet wird im Nachhinein: ohne Vorgänger ist das Vorjahr gemeint.
  const vorschlag = letzte ? Number(letzte.jahr) + 1 : new Date().getFullYear() - 1;
  const eingabe = await abfragen(
    'Neue Abrechnung',
    letzte
      ? 'Für welches Jahr? Die Kostenpositionen und Schlüssel der letzten Abrechnung werden ohne Beträge übernommen.'
      : 'Für welches Jahr? Der Zeitraum lässt sich danach noch anpassen.',
    { label: 'Abrechnungsjahr', wert: String(vorschlag) }
  );
  if (eingabe === null) return;
  const jahr = Number(eingabe);
  if (!Number.isInteger(jahr) || jahr < 1990 || jahr > 2200) {
    toast('Bitte eine Jahreszahl eingeben, zum Beispiel 2025.', 'err');
    return;
  }
  const a = neueAbrechnung(jahr, letzte);
  aendern(() => { d.abrechnungen.push(a); });
  abrechnungWaehlen(a.id);
  neu();
}

/** Leiste mit der Auswahl der Abrechnung; rechts Platz für Knöpfe der Ansicht. */
export function abrechnungsLeiste(neu, rechts = []) {
  const a = gewaehlteAbrechnung();
  const auswahl = el('select', {
    title: 'Abrechnung wählen',
    onchange: (e) => { abrechnungWaehlen(e.target.value); neu(); },
  }, abrechnungenSortiert().map((x) => el('option', { value: x.id, selected: x === a }, [
    `Abrechnung ${x.jahr} · ${zeitraumText(x)}`,
  ])));

  return el('div.toolbar', {}, [
    auswahl,
    el('button.btn.btn-sm', { type: 'button', onclick: () => abrechnungAnlegen(neu) }, ['Neue Abrechnung']),
    el('button.btn.btn-sm.btn-ghost', {
      type: 'button', title: 'Diese Abrechnung löschen',
      onclick: async () => {
        const ok = await bestaetigen(
          `Abrechnung ${a.jahr} löschen?`,
          'Alle Kostenpositionen und Vorauszahlungen dieser Abrechnung werden entfernt. Haus, Wohnungen und Mieter bleiben erhalten. Die Tagessicherung enthält den Stand von vorher.',
          { okText: 'Löschen', gefahr: true }
        );
        if (!ok) return;
        aendern((d) => { d.abrechnungen = d.abrechnungen.filter((x) => x !== a); });
        neu();
      },
    }, ['Löschen']),
    el('div', { style: 'flex:1' }),
    ...rechts,
  ]);
}

/* ---------- Leerzustände ---------- */

export function leerKarte(icon, titel, text, knopf) {
  return el('div.card', {}, [el('div.empty', {}, [
    el('div.empty-icon', { text: icon }),
    el('h3', { text: titel }),
    el('p', { text }),
    knopf,
  ])]);
}

/**
 * Was fehlt noch, bevor abgerechnet werden kann? Liefert die passende
 * Leerkarte oder null, wenn alles da ist.
 */
export function fehltNoch(neu) {
  const d = state.daten;
  if (!d.einheiten.length) {
    return leerKarte('🏠', 'Zuerst das Haus anlegen',
      'Trage die Wohnungen mit ihrer Wohnfläche ein. Sie sind die Grundlage für die Umlage.',
      el('a.btn.btn-primary', { href: '#/haus' }, ['Zu Haus und Wohnungen']));
  }
  if (!d.mietverhaeltnisse.length) {
    return leerKarte('👥', 'Noch keine Mieter erfasst',
      'Trage ein, wer seit wann in welcher Wohnung wohnt und was monatlich vorausgezahlt wird.',
      el('a.btn.btn-primary', { href: '#/mieter' }, ['Zu den Mietern']));
  }
  if (!d.abrechnungen.length) {
    return leerKarte('🧾', 'Noch keine Abrechnung angelegt',
      'Eine Abrechnung fasst die Kosten eines Jahres zusammen. Die üblichen Kostenarten stehen schon als leere Zeilen bereit.',
      el('button.btn.btn-primary', { type: 'button', onclick: () => abrechnungAnlegen(neu) }, ['Abrechnung anlegen']));
  }
  return null;
}

/* ---------- Hinweise ---------- */

export function rechtshinweis() {
  return hinweis(
    '<strong>Rechenwerkzeug, keine Rechtsberatung.</strong> Welche Kosten umlagefähig sind und welcher Schlüssel gilt, '
    + 'bestimmt dein Mietvertrag. Prüfe jede Abrechnung vor dem Versand – im Zweifel hilft ein Vermieterverein oder '
    + 'eine Anwältin bzw. ein Anwalt für Mietrecht.');
}

export function warnungen(liste) {
  if (!liste.length) return null;
  return hinweis(liste.map((w) => w.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))).join('<br>'), 'warn');
}
