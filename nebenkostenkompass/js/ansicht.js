/* Sicht auf die Daten: welche Abrechnung und welcher Mieter gerade gezeigt
   werden. Das gehört in den localStorage und nicht in die Datendatei – es
   beschreibt, was der Nutzer ansieht, nicht was er erfasst hat. */

import { state, abrechnungMit, abrechnungenSortiert } from './store.js';

const PRAEFIX = 'nebenkostenkompass-';

/** Die gewählte Abrechnung; ohne gültige Wahl die neueste, ohne Abrechnungen null. */
export function gewaehlteAbrechnung() {
  if (!state.daten.abrechnungen.length) return null;
  return abrechnungMit(localStorage.getItem(PRAEFIX + 'abrechnung')) || abrechnungenSortiert()[0];
}

export function abrechnungWaehlen(id) {
  localStorage.setItem(PRAEFIX + 'abrechnung', id);
}

/** ID des Mietverhältnisses, dessen Abrechnung gezeigt wird, oder 'alle'. */
export function gewaehlterMieter() {
  return localStorage.getItem(PRAEFIX + 'mieter') || 'alle';
}

export function mieterWaehlen(id) {
  localStorage.setItem(PRAEFIX + 'mieter', id);
}
