# NebenkostenKompass

Die Betriebskostenabrechnung für private Vermieter – lokal, ohne Cloud, ohne Abo.
Teil der Zahlenkompass-Familie.

## Starten

`Start.bat` doppelklicken. Die App öffnet sich in Chrome oder Edge unter
`http://localhost:8975`. Beim ersten Start wählst du einen Ordner; dort liegen
`nebenkosten.json` und die automatischen Sicherungen. Es verlässt nichts deinen Rechner.

**Ein Ordner steht für ein Haus.** Für ein zweites Haus legst du einen weiteren Ordner an.

## Bedienung in vier Schritten

1. **Haus** – Anschrift, alle Wohnungen mit Wohnfläche (auch leerstehende und selbst
   genutzte), dazu dein Absender mit Bankverbindung.
2. **Mieter** – je Mietverhältnis Wohnung, Ein- und Auszug, Personenzahl und monatliche
   Vorauszahlung. Ein Mieterwechsel sind zwei Einträge in derselben Wohnung.
3. **Kosten** – Abrechnung für ein Jahr anlegen, Beträge aus Bescheiden und Rechnungen
   eintragen, je Position den Umlageschlüssel wählen. Darunter die Vorauszahlungen.
4. **Abrechnung** – das fertige Schreiben je Mieter ansehen und drucken. Im Druckdialog
   „Als PDF speichern" wählen, um eine PDF-Datei zu erhalten.

Im Folgejahr übernimmt „Neue Abrechnung" die Kostenpositionen und Schlüssel ohne Beträge.

Gespeichert wird beim Verlassen eines Feldes. Einen Speichern-Knopf gibt es nicht.

## So wird gerechnet

| Schlüssel | Rechnung |
|---|---|
| Wohnfläche | Fläche × Nutzungstage ÷ (Fläche aller Wohnungen × Tage des Zeitraums) |
| Wohneinheiten | Nutzungstage ÷ (Anzahl Wohnungen × Tage des Zeitraums) |
| Personen | Personen × Nutzungstage ÷ Summe aller Personentage |
| Verbrauch | eigener Verbrauch ÷ Gesamtverbrauch einschließlich Leerstand |
| Direkt zugeordnet | fertiger Eurobetrag je Mieter, die Summe ist der Gesamtbetrag |

- Gezählt wird **taggenau**; Ein- und Auszugstag zählen mit.
- **Leerstand trägt der Vermieter.** Bei Fläche und Wohneinheiten bleibt der Anteil der
  leeren Tage bei dir und wird nicht auf die übrigen Mieter verteilt.
- Jeder Anteil wird auf Cent gerundet; Centdifferenzen bleiben ebenfalls bei dir.
- **Vorauszahlungen:** Soll = Monatsbetrag × belegte Monate, angebrochene Monate nach
  Tagen. Ein eingetragener Ist-Betrag ersetzt das Soll.
- **Frist:** Die Abrechnung muss dem Mieter spätestens zwölf Monate nach Ende des
  Zeitraums zugehen. Die Übersicht zeigt das Datum und die verbleibenden Tage.

## Grenzen der Rechnung

- **Keine Rechtsberatung.** Ob eine Kostenart umlagefähig ist und welcher Schlüssel gilt,
  bestimmt der Mietvertrag. Die App prüft das nicht.
- **Heizung und Warmwasser werden nicht verbrauchsabhängig aufgeteilt.** Die Aufteilung
  nach Heizkostenverordnung (Grund- und Verbrauchsanteil) liefert der Messdienst; die App
  übernimmt je Mieter nur den fertigen Betrag.
- **Personenzahl gilt für das ganze Mietverhältnis.** Ändert sie sich im Jahr, lässt sich
  das nur über zwei Einträge mit Aus- und Einzugsdatum abbilden.
- **Leerstand zählt beim Personenschlüssel mit null Personen.** Ob dafür eine fiktive
  Person anzusetzen ist, ist umstritten; die App tut es nicht.
- **Kein Vorwegabzug** für gewerbliche Einheiten und keine getrennten Abrechnungskreise
  (etwa Vorder- und Hinterhaus).
- **Keine Miteigentumsanteile.** Wer eine Eigentumswohnung vermietet, trägt nur diese
  Wohnung ein und übernimmt seine Anteile aus der Hausgeldabrechnung.
- **Keine Umsatzsteuer**, also nicht für umsatzsteuerpflichtige Gewerbevermietung.
- Die Bescheinigung nach § 35a EStG verteilt den eingetragenen Lohnanteil im selben
  Verhältnis wie die Kostenposition; welche Kosten begünstigt sind, entscheidest du.
- Die empfohlene neue Vorauszahlung ist eine Hochrechnung der Kosten dieses Jahres, keine
  Prognose von Preissteigerungen.

## Aufbau

```
js/umlage.js            reine Rechnung, ohne Oberfläche – in Node prüfbar
js/store.js             Datenmodell, Kostenarten, Schlüssel, Migration
js/ansicht.js           gewählte Abrechnung und gewählter Mieter (localStorage)
js/views/uebersicht.js  Kennzahlen und Ergebnis je Mieter
js/views/haus.js        Haus, Wohnungen, Absender
js/views/mieter.js      Mietverhältnisse
js/views/kosten.js      Zeitraum, Kostenpositionen, Vorauszahlungen
js/views/abrechnung.js  Schreiben je Mieter und Druck
js/views/gemeinsam.js   Auswahl der Abrechnung, Leerzustände, Hinweise
```

Alles Übrige (`main.js`, `felder.js`, `util.js`, `storage.js`, `db.js`, `server.js`) ist
das Gerüst der Zahlenkompass-Familie. Keine Fremdbibliotheken, kein Build.
