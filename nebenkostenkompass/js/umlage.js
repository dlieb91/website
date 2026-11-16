/* Umlage der Betriebskosten – reine Rechnung, keine Oberfläche.

   Modell je Abrechnung (ein Haus, ein Abrechnungszeitraum):

     Partei    ein Mietverhältnis, das den Zeitraum mindestens einen Tag
               berührt. Gezählt wird taggenau, Ein- und Auszugstag zählen mit.

     Schlüssel flaeche    Wohnfläche × Nutzungstage gegen die Fläche ALLER
                          Wohnungen × Tage des Zeitraums. Steht eine Wohnung
                          leer, bleibt ihr Anteil beim Vermieter – er darf
                          nicht auf die übrigen Mieter verteilt werden.
               einheiten  jede Wohnung zählt gleich, sonst wie flaeche.
               personen   Personen × Nutzungstage (Personentage) gegen die
                          Summe aller Personentage. Leerstand zählt mit null
                          Personen und trägt hier deshalb nichts.
               verbrauch  abgelesene Mengen je Partei; „leer" steht für den
                          Verbrauch im Leerstand und bleibt beim Vermieter.
               direkt     fertige Eurobeträge je Partei, etwa aus der
                          Heizkostenabrechnung des Messdienstes. Die Summe
                          der Einträge IST der Gesamtbetrag.

     Rundung   jeder Anteil kaufmännisch auf Cent. Was danach zum
               Gesamtbetrag fehlt (Leerstand und Centdifferenzen), trägt der
               Vermieter.

     Vorauszahlung  Soll = Monatsbetrag × belegte Monate; angebrochene Monate
               zählen mit belegten Tagen / Tagen des Monats. Ein eingetragener
               Ist-Betrag ersetzt das Soll.

     Ergebnis  Kostenanteil − Vorauszahlungen. Positiv = Nachzahlung,
               negativ = Guthaben.
*/

/* ---------- Tage ----------
   Gerechnet wird mit Tagesnummern in UTC. Das Datum kommt als reiner
   Kalendertag (YYYY-MM-DD) herein und geht so wieder hinaus – es gibt keine
   Uhrzeit, also kann die Zeitzone hier nichts verschieben. */

const MS_TAG = 86400000;

export function tagNr(iso) {
  if (!iso) return null;
  const [j, m, t] = String(iso).slice(0, 10).split('-').map(Number);
  if (!j || !m || !t) return null;
  return Math.round(Date.UTC(j, m - 1, t) / MS_TAG);
}

export function isoAus(nr) {
  return new Date(nr * MS_TAG).toISOString().slice(0, 10);
}

/** Tage von–bis, beide Tage eingeschlossen. */
export function tageZwischen(von, bis) {
  const a = tagNr(von), b = tagNr(bis);
  if (a == null || b == null || b < a) return 0;
  return b - a + 1;
}

export const runde = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Der Teil eines Mietverhältnisses, der in den Zeitraum fällt.
 * Ohne Einzugsdatum gilt „schon immer", ohne Auszugsdatum „läuft weiter".
 */
export function nutzung(mv, von, bis) {
  const start = Math.max(tagNr(mv.einzug) ?? -Infinity, tagNr(von));
  const ende = Math.min(tagNr(mv.auszug) ?? Infinity, tagNr(bis));
  if (!(ende >= start)) return { tage: 0, von: null, bis: null };
  return { tage: ende - start + 1, von: isoAus(start), bis: isoAus(ende) };
}

/** Belegte Monate als Bruchzahl – angebrochene Monate taggenau. */
export function belegteMonate(von, bis) {
  const a = tagNr(von), b = tagNr(bis);
  if (a == null || b == null || b < a) return 0;
  let monate = 0;
  let [j, m] = von.split('-').map(Number);
  for (;;) {
    const erster = Math.round(Date.UTC(j, m - 1, 1) / MS_TAG);
    const letzter = Math.round(Date.UTC(j, m, 0) / MS_TAG);
    if (erster > b) break;
    const belegt = Math.min(letzter, b) - Math.max(erster, a) + 1;
    monate += belegt / (letzter - erster + 1);
    if (++m > 12) { m = 1; j++; }
  }
  return monate;
}

/**
 * Ende der Abrechnungsfrist: Die Abrechnung muss dem Mieter spätestens zwölf
 * Monate nach Ende des Zeitraums zugehen (§ 556 Abs. 3 BGB).
 */
export function fristEnde(bis) {
  if (tagNr(bis) == null) return null;
  // Tag nach dem Zeitraumende, ein Jahr weiter, wieder einen Tag zurück –
  // so wird aus dem 31.12. der 31.12. und aus dem 28.02. vor einem
  // Schaltjahr der 29.02.
  const [j, m, t] = isoAus(tagNr(bis) + 1).split('-').map(Number);
  return isoAus(Math.round(Date.UTC(j + 1, m - 1, t) / MS_TAG) - 1);
}

/* ---------- Verteilung einer Kostenposition ---------- */

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Einträge einer Position, die in dieser Abrechnung zählen: die der Parteien
 * und „leer". Werte früherer Mieter können noch im Objekt stehen, wenn ein
 * Datum nachträglich geändert wurde – sie dürfen nicht unsichtbar mitrechnen.
 */
function gueltigeWerte(k, parteien) {
  return Object.entries(k.anteile || {})
    .filter(([id]) => id === 'leer' || parteien.some((p) => p.mv.id === id))
    .map(([, v]) => zahl(v));
}

/** Gesamtbetrag einer Position; bei „direkt" die Summe der Einträge. */
export function gesamtbetrag(k, parteien) {
  if (k.schluessel === 'direkt') return runde(gueltigeWerte(k, parteien).reduce((s, v) => s + v, 0));
  return zahl(k.betrag);
}

function verteilen(k, kontext) {
  const { parteien, tageZeitraum, gesamtFlaeche, anzahlEinheiten, personentage } = kontext;
  const gesamt = gesamtbetrag(k, parteien);
  const lohnGesamt = Math.min(zahl(k.lohnanteil), Math.max(gesamt, 0));
  const werte = k.anteile || {};

  let gesamtMenge = 0;
  let mengeVon;
  switch (k.schluessel) {
    case 'einheiten':
      gesamtMenge = anzahlEinheiten * tageZeitraum;
      mengeVon = (p) => p.tage;
      break;
    case 'personen':
      gesamtMenge = personentage;
      mengeVon = (p) => zahl(p.mv.personen) * p.tage;
      break;
    case 'verbrauch':
      gesamtMenge = gueltigeWerte(k, parteien).reduce((s, v) => s + v, 0);
      mengeVon = (p) => zahl(werte[p.mv.id]);
      break;
    case 'direkt':
      gesamtMenge = gesamt;
      mengeVon = (p) => zahl(werte[p.mv.id]);
      break;
    default: // flaeche
      gesamtMenge = gesamtFlaeche * tageZeitraum;
      mengeVon = (p) => zahl(p.einheit.flaeche) * p.tage;
  }

  const anteile = {};
  let umgelegt = 0;
  for (const p of parteien) {
    const menge = mengeVon(p);
    const quote = gesamtMenge > 0 ? menge / gesamtMenge : 0;
    const betrag = k.schluessel === 'direkt' ? runde(menge) : runde(gesamt * quote);
    anteile[p.mv.id] = { menge, quote, betrag, lohn: runde(lohnGesamt * quote) };
    umgelegt += betrag;
  }

  return {
    kosten: k, schluessel: k.schluessel || 'flaeche',
    gesamt, lohnGesamt, gesamtMenge, anteile,
    umgelegt: runde(umgelegt),
    vermieter: runde(gesamt - umgelegt),
  };
}

/* ---------- Ganze Abrechnung ---------- */

/**
 * @param daten  { einheiten, mietverhaeltnisse }
 * @param a      Abrechnung { von, bis, kosten[], gezahlt{} }
 */
export function abrechnen(daten, a) {
  const einheiten = daten.einheiten || [];
  const tageZeitraum = tageZwischen(a.von, a.bis);
  const warnungen = [];

  const parteien = [];
  if (tageZeitraum > 0) {
    for (const mv of daten.mietverhaeltnisse || []) {
      const einheit = einheiten.find((e) => e.id === mv.einheitId);
      if (!einheit) continue;
      const n = nutzung(mv, a.von, a.bis);
      if (n.tage > 0) parteien.push({ mv, einheit, tage: n.tage, von: n.von, bis: n.bis });
    }
  }
  // Reihenfolge wie die Wohnungen im Haus, innerhalb einer Wohnung zeitlich
  parteien.sort((x, y) =>
    einheiten.indexOf(x.einheit) - einheiten.indexOf(y.einheit) || tagNr(x.von) - tagNr(y.von));

  const kontext = {
    parteien, tageZeitraum,
    gesamtFlaeche: einheiten.reduce((s, e) => s + zahl(e.flaeche), 0),
    anzahlEinheiten: einheiten.length,
    personentage: parteien.reduce((s, p) => s + zahl(p.mv.personen) * p.tage, 0),
  };

  // Positionen ohne Betrag sind vorbereitete Zeilen und rechnen nicht mit
  const positionen = (a.kosten || [])
    .filter((k) => gesamtbetrag(k, parteien) !== 0)
    .map((k) => verteilen(k, kontext));

  const ergebnisse = parteien.map((p) => {
    const summe = runde(positionen.reduce((s, pos) => s + pos.anteile[p.mv.id].betrag, 0));
    const lohn = runde(positionen.reduce((s, pos) => s + pos.anteile[p.mv.id].lohn, 0));
    const vorausSoll = runde(zahl(p.mv.vorauszahlung) * belegteMonate(p.von, p.bis));
    const ist = a.gezahlt?.[p.mv.id];
    const voraus = typeof ist === 'number' ? ist : vorausSoll;
    return {
      ...p, summe, lohn, vorausSoll, voraus,
      saldo: runde(summe - voraus),
      // Auf ein volles Jahr hochgerechnet und durch zwölf – als Anhaltspunkt
      // für die künftige Vorauszahlung, auf ganze Euro gerundet.
      empfehlung: p.tage > 0 ? Math.round(summe / p.tage * 365 / 12) : null,
    };
  });

  /* ---------- Plausibilität ---------- */

  if (tageZeitraum === 0) warnungen.push('Der Abrechnungszeitraum ist unvollständig oder endet vor seinem Beginn.');
  if (tageZeitraum > 366) {
    warnungen.push('Der Abrechnungszeitraum ist länger als zwölf Monate. Zulässig ist höchstens ein Jahr (§ 556 Abs. 3 BGB).');
  }
  if (tageZeitraum > 0 && !parteien.length) {
    warnungen.push('In diesem Zeitraum gibt es kein Mietverhältnis. Prüfe Ein- und Auszugsdaten.');
  }
  for (let i = 0; i < parteien.length; i++) {
    for (let j = i + 1; j < parteien.length; j++) {
      const x = parteien[i], y = parteien[j];
      if (x.einheit !== y.einheit) continue;
      if (tagNr(x.von) <= tagNr(y.bis) && tagNr(y.von) <= tagNr(x.bis)) {
        warnungen.push(`„${x.einheit.bezeichnung || 'Wohnung'}" ist zeitweise doppelt belegt (${x.mv.name || 'ohne Namen'} und ${y.mv.name || 'ohne Namen'}). Prüfe Auszugs- und Einzugsdatum.`);
      }
    }
  }
  const nutzt = (s) => positionen.some((p) => p.schluessel === s);
  if (nutzt('flaeche') && einheiten.some((e) => !(zahl(e.flaeche) > 0))) {
    warnungen.push('Mindestens eine Wohnung hat keine Wohnfläche. Der Flächenschlüssel rechnet dann mit einer zu kleinen Gesamtfläche.');
  }
  if (nutzt('personen') && kontext.personentage === 0) {
    warnungen.push('Es wird nach Personen umgelegt, aber bei keinem Mieter ist eine Personenzahl eingetragen.');
  }
  for (const pos of positionen) {
    if (pos.schluessel === 'verbrauch' && pos.gesamtMenge === 0) {
      warnungen.push(`Für „${pos.kosten.bezeichnung || 'eine Position'}" fehlen die Verbrauchswerte – der Betrag bleibt vollständig beim Vermieter.`);
    }
  }

  const gesamt = runde(positionen.reduce((s, p) => s + p.gesamt, 0));
  const umgelegt = runde(ergebnisse.reduce((s, e) => s + e.summe, 0));

  return {
    tageZeitraum, parteien, positionen, ergebnisse, warnungen,
    gesamtFlaeche: kontext.gesamtFlaeche,
    anzahlEinheiten: kontext.anzahlEinheiten,
    personentage: kontext.personentage,
    gesamt, umgelegt,
    vermieter: runde(gesamt - umgelegt),
    frist: fristEnde(a.bis),
  };
}
