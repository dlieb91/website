#!/usr/bin/env python3
"""Holt den aktuellen Marktzins (Bundesbank SDMX-API) und schreibt zins.json.

Schreibt nur bei plausiblem Wert (0-15 %), sonst bleibt die alte Datei bestehen.
Reihe per Umgebungsvariable BUNDESBANK_SERIES ueberschreibbar (Format: Flow/Schluessel).
"""
import csv, io, json, os, sys, urllib.request

SERIES = os.environ.get("BUNDESBANK_SERIES", "BBIM1/M.DE.B.A2C.P.R.A.2250.EUR.N")
URL = f"https://api.statistiken.bundesbank.de/rest/data/{SERIES}?lastNObservations=1&format=csv"
OUT = os.path.join(os.path.dirname(__file__), "..", "zins.json")


def fetch():
    req = urllib.request.Request(URL, headers={"Accept": "text/csv"})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text), delimiter=";" if ";" in text.splitlines()[0] else ","))
    # Letzte Zeile mit parsbarem Zahlenwert nehmen (Zeitraum, Wert)
    for row in reversed(rows):
        for i, cell in enumerate(row):
            try:
                v = float(cell.replace(",", "."))
            except ValueError:
                continue
            period = row[i - 1] if i > 0 else ""
            return v, period
    raise ValueError("Kein Zahlenwert in der Antwort gefunden")


def main():
    value, period = fetch()
    if not 0 < value < 15:
        sys.exit(f"Unplausibler Wert {value} - zins.json bleibt unveraendert")
    data = {
        "baseRate": round(value, 2),
        "period": period,
        "source": "Deutsche Bundesbank, Zinsstatistik Wohnungsbaukredite (Neugeschaeft)",
        "series": SERIES,
        "updated": __import__("datetime").date.today().isoformat(),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("zins.json aktualisiert:", data)


if __name__ == "__main__":
    main()
