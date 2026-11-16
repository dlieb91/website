/* Datenmodell, Zustand und Aenderungsverwaltung.

   Ein Ordner steht fuer ein Haus:
     vermieter          Absender der Abrechnung
     objekt             Anschrift des Hauses
     einheiten          Wohnungen mit Wohnflaeche
     mietverhaeltnisse  wer wann in welcher Wohnung wohnt(e), Personenzahl
                        und monatliche Vorauszahlung
     abrechnungen       je Zeitraum die Kostenpositionen, die tatsaechlich
                        geleisteten Vorauszahlungen und die Angaben zum
                        Anschreiben

   Gerechnet wird nicht hier, sondern in umlage.js.
*/

import { uid, zeitstempel } from './util.js';
import { planeSpeichern } from './storage.js';

export const SCHEMA_VERSION = 1;

/* ---------- Vorgabewerte ---------- */

export const STANDARD_EINSTELLUNGEN = {
  zahlungsfristTage: 30,
};

/* Umlageschluessel. `menge` beschriftet die Spalten der Abrechnung. */
export const SCHLUESSEL = [
  { wert: 'flaeche', text: 'Wohnfläche', menge: 'm²' },
  { wert: 'personen', text: 'Personen', menge: 'Personentage' },
  { wert: 'einheiten', text: 'Wohneinheiten', menge: 'Einheiten' },
  { wert: 'verbrauch', text: 'Verbrauch', menge: 'Verbrauch' },
  { wert: 'direkt', text: 'Direkt zugeordnet', menge: '' },
];
export const schluesselText = (wert) => (SCHLUESSEL.find((s) => s.wert === wert) || SCHLUESSEL[0]).text;

/* Die Kostenarten des § 2 Betriebskostenverordnung. `standard` markiert, was
   in einer neuen Abrechnung schon als leere Zeile bereitsteht. Der
   vorgeschlagene Schluessel ist nur ein Vorschlag – massgeblich ist, was im
   Mietvertrag vereinbart wurde. */
export const KOSTENARTEN = [
  { wert: 'grundsteuer', text: 'Grundsteuer', schluessel: 'flaeche', standard: true },
  { wert: 'wasser', text: 'Wasserversorgung', schluessel: 'flaeche', standard: true },
  { wert: 'abwasser', text: 'Entwässerung', schluessel: 'flaeche', standard: true },
  { wert: 'heizung', text: 'Heizung und Warmwasser', schluessel: 'direkt', standard: true },
  { wert: 'aufzug', text: 'Aufzug', schluessel: 'flaeche' },
  { wert: 'strassenreinigung', text: 'Straßenreinigung', schluessel: 'flaeche' },
  { wert: 'muell', text: 'Müllbeseitigung', schluessel: 'flaeche', standard: true },
  { wert: 'gebaeudereinigung', text: 'Gebäudereinigung und Ungezieferbekämpfung', schluessel: 'flaeche' },
  { wert: 'garten', text: 'Gartenpflege', schluessel: 'flaeche' },
  { wert: 'beleuchtung', text: 'Beleuchtung (Allgemeinstrom)', schluessel: 'flaeche', standard: true },
  { wert: 'schornstein', text: 'Schornsteinreinigung', schluessel: 'flaeche' },
  { wert: 'versicherung', text: 'Sach- und Haftpflichtversicherung', schluessel: 'flaeche', standard: true },
  { wert: 'hauswart', text: 'Hauswart', schluessel: 'flaeche' },
  { wert: 'antenne', text: 'Gemeinschaftsantenne / Breitbandnetz', schluessel: 'einheiten' },
  { wert: 'waesche', text: 'Einrichtungen für die Wäschepflege', schluessel: 'einheiten' },
  { wert: 'sonstige', text: 'Sonstige Betriebskosten', schluessel: 'flaeche' },
];
export const kostenart = (wert) => KOSTENARTEN.find((k) => k.wert === wert) || KOSTENARTEN[KOSTENARTEN.length - 1];

/* ---------- Zustand ---------- */

export const state = {
  daten: null,
};

const listener = new Set();

export function abonnieren(fn) {
  listener.add(fn);
  return () => listener.delete(fn);
}

function benachrichtigen() {
  for (const fn of listener) fn(state.daten);
}

/**
 * Zaehler, der bei jeder Datenaenderung hochzaehlt – Schluessel fuer alle
 * Zwischenspeicher der App.
 *
 * Bewusst kein Zeitstempel: `geaendertAm` hat Millisekundenaufloesung, und
 * zwei aendern()-Aufrufe im selben Tick sind normal (ein Feld schreibt, der
 * nachgelagerte Handler schreibt gleich noch einmal). Ein gleich gebliebener
 * Stempel wuerde einen veralteten Cache stehen lassen – ein Fehler, der sich
 * spaeter kaum reproduzieren laesst.
 *
 *   let meinRevision = -1; const cache = new Map();
 *   if (datenRevision() !== meinRevision) { cache.clear(); meinRevision = datenRevision(); }
 */
let revision = 0;
export const datenRevision = () => revision;

/** Nach jeder Datenaenderung aufrufen: rendert neu und stoesst Autosave an. */
export function aendern(fn) {
  if (typeof fn === 'function') fn(state.daten);
  state.daten.meta.geaendertAm = zeitstempel();
  revision++;
  benachrichtigen();
  planeSpeichern();
}

/* ---------- Neuanlage & Migration ---------- */

export function neueDaten(name) {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name: name || 'Ohne Namen',
      erstelltAm: zeitstempel(),
      geaendertAm: zeitstempel(),
      letztesBackup: null,
    },
    einstellungen: { ...STANDARD_EINSTELLUNGEN },
    vermieter: { name: '', strasse: '', plzOrt: '', telefon: '', email: '', kontoinhaber: '', iban: '', bank: '' },
    objekt: { bezeichnung: '', strasse: '', plzOrt: '' },
    einheiten: [],
    mietverhaeltnisse: [],
    abrechnungen: [],
    protokoll: [],
  };
}

/**
 * Fuellt fehlende Felder auf und hebt aeltere Dateien auf die aktuelle
 * Version. Neue Migrationsschritte werden unten angehaengt, nie eingefuegt –
 * die Reihenfolge ist der Vertrag mit allen bereits gespeicherten Dateien.
 */
export function migrieren(daten) {
  if (!daten || typeof daten !== 'object') throw new Error('Ungültige Datei');

  const v = daten.schemaVersion ?? 0;
  if (v > SCHEMA_VERSION) {
    throw new Error(
      `Diese Datei wurde mit einer neueren App-Version erstellt (Schema ${v}). Bitte die App aktualisieren.`
    );
  }

  // if (v < 2) { … ; daten.schemaVersion = 2; }

  const basis = neueDaten(daten.meta?.name);
  const zusammen = {
    ...basis,
    ...daten,
    meta: { ...basis.meta, ...(daten.meta || {}) },
    einstellungen: { ...STANDARD_EINSTELLUNGEN, ...(daten.einstellungen || {}) },
    vermieter: { ...basis.vermieter, ...(daten.vermieter || {}) },
    objekt: { ...basis.objekt, ...(daten.objekt || {}) },
  };
  for (const key of ['protokoll', 'einheiten', 'mietverhaeltnisse', 'abrechnungen']) {
    if (!Array.isArray(zusammen[key])) zusammen[key] = [];
  }
  zusammen.schemaVersion = SCHEMA_VERSION;
  return zusammen;
}

export function laden(daten) {
  state.daten = migrieren(daten);
  revision++;          // ausgetauschte Daten machen jeden Zwischenspeicher ungueltig
  benachrichtigen();
  return state.daten;
}

/* ---------- Vorlagen fuer Entitaeten ---------- */

export function neueEinheit() {
  return { id: uid('whg'), bezeichnung: '', flaeche: null };
}

export function neuesMietverhaeltnis(einheitId) {
  return {
    id: uid('mv'), einheitId: einheitId ?? null, name: '',
    einzug: null, auszug: null, personen: 1, vorauszahlung: null,
    // Nur noetig, wenn die Abrechnung nicht an die Wohnung gehen soll,
    // etwa nach dem Auszug.
    anschrift: '',
  };
}

export function neueKosten(art) {
  const k = kostenart(art);
  return {
    id: uid('kst'), art: k.wert, bezeichnung: k.text, betrag: null,
    schluessel: k.schluessel, lohnanteil: null,
    anteile: {},      // je Mietverhaeltnis-ID (und 'leer'): Verbrauch bzw. Eurobetrag
  };
}

/**
 * Neue Abrechnung fuer ein Kalenderjahr. Gibt es schon eine, werden deren
 * Positionen ohne Betraege uebernommen – Kostenarten und Schluessel aendern
 * sich von Jahr zu Jahr kaum, die Betraege immer.
 */
export function neueAbrechnung(jahr, vorlage) {
  const kosten = vorlage
    ? vorlage.kosten.map((k) => ({ ...neueKosten(k.art), bezeichnung: k.bezeichnung, schluessel: k.schluessel }))
    : KOSTENARTEN.filter((k) => k.standard).map((k) => neueKosten(k.wert));
  return {
    id: uid('abr'), jahr,
    von: `${jahr}-01-01`, bis: `${jahr}-12-31`,
    kosten,
    gezahlt: {},          // je Mietverhaeltnis-ID: tatsaechlich geleistete Vorauszahlungen
    neueVoraus: {},       // je Mietverhaeltnis-ID: kuenftige monatliche Vorauszahlung
    briefDatum: null,
    anpassungAb: null,
  };
}

/* ---------- Zugriffshelfer ---------- */

export const einheitMit = (id) => state.daten.einheiten.find((e) => e.id === id);
export const mietverhaeltnisMit = (id) => state.daten.mietverhaeltnisse.find((m) => m.id === id);
export const abrechnungMit = (id) => state.daten.abrechnungen.find((a) => a.id === id);

/** Entfernt ein Mietverhältnis samt seiner Einträge in allen Abrechnungen. */
export function mietverhaeltnisLoeschen(id) {
  const d = state.daten;
  d.mietverhaeltnisse = d.mietverhaeltnisse.filter((m) => m.id !== id);
  for (const a of d.abrechnungen) {
    delete a.gezahlt[id];
    delete a.neueVoraus[id];
    for (const k of a.kosten) delete k.anteile[id];
  }
}

/** Abrechnungen, neueste zuerst. */
export const abrechnungenSortiert = () =>
  [...state.daten.abrechnungen].sort((a, b) => String(b.von).localeCompare(String(a.von)));

/* ---------- Aenderungsprotokoll ----------
   felder.js ruft protokollieren() bei jeder Feldaenderung auf. */

export function protokollieren(bezugId, was, alt, neu) {
  state.daten.protokoll.push({
    id: uid('log'),
    zeit: zeitstempel(),
    bezugId,
    was,
    alt: alt ?? null,
    neu: neu ?? null,
  });
  if (state.daten.protokoll.length > 2000) state.daten.protokoll.splice(0, 500);
}

/**
 * Protokolleintraege zu einem Bezug, neueste zuerst.
 * Vor dem Sortieren wird umgedreht, damit bei gleichem Zeitstempel der
 * zuletzt eingefuegte Eintrag oben steht – Array.sort ist stabil.
 */
export function protokollEintraege(bezugId) {
  return state.daten.protokoll
    .filter((p) => !bezugId || p.bezugId === bezugId)
    .reverse()
    .sort((a, b) => String(b.zeit).localeCompare(String(a.zeit)));
}
