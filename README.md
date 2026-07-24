# Immobilien Portfolio

Web-App zur Verwaltung mehrerer Immobilien: Portfolio-Übersicht (Gesamtwert, ausstehende Darlehen, Nettovermögen, Einnahmen/Ausgaben/Cashflow) sowie ein detaillierter Investment-Check je Immobilie (Cashflow, Steuer, AfA, Verkaufsszenarien).

Start: `index.html` im Browser öffnen (Doppelklick oder z. B. mit `python3 -m http.server` lokal servieren).

Ohne weitere Einrichtung funktioniert die App sofort lokal: Immobilien werden im Browser gespeichert (localStorage). Für eine Synchronisation über mehrere Geräte hinweg kann optional eine eigene Google-Tabelle angebunden werden.

## Google Sheets als Datenspeicher einrichten (optional)

Die App kann deine Immobiliendaten direkt in eine Google-Tabelle in deinem eigenen Google Drive schreiben (Google Sign-In im Browser, keine eigene Server-Datenbank nötig). Dafür einmalig ein kostenloses Google-Cloud-Projekt mit OAuth-Client-ID einrichten:

1. **Google-Cloud-Projekt anlegen**: [console.cloud.google.com](https://console.cloud.google.com) öffnen, oben ein neues Projekt erstellen (z. B. "Immobilien Portfolio").
2. **Google Sheets API aktivieren**: Im Menü *APIs & Dienste → Bibliothek* nach "Google Sheets API" suchen und aktivieren.
3. **OAuth-Zustimmungsbildschirm konfigurieren**: *APIs & Dienste → OAuth-Zustimmungsbildschirm*. Nutzertyp "Extern" wählen (reicht für den privaten Gebrauch), App-Namen und deine E-Mail-Adresse eintragen. Unter "Testnutzer" deine eigene Google-Adresse hinzufügen, solange die App nicht veröffentlicht ist.
4. **OAuth-Client-ID erstellen**: *APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID*. Anwendungstyp "Webanwendung" wählen. Unter "Autorisierte JavaScript-Quellen" die URL eintragen, unter der du `index.html` aufrufst (z. B. `http://localhost:8000` beim lokalen Testen, oder die GitHub-Pages-URL, falls die Seite dort gehostet wird).
5. **Client-ID kopieren**: Nach dem Erstellen wird eine Client-ID im Format `xxxxx.apps.googleusercontent.com` angezeigt.
6. **In der App hinterlegen**: In der App oben rechts auf "⚙ Einstellungen" klicken, die Client-ID einfügen und "Client-ID speichern" klicken.
7. **Anmelden**: Auf "Mit Google anmelden" klicken und den Zugriff auf Google Sheets bestätigen. Die App legt automatisch eine neue Tabelle "Immobilien Portfolio" in deinem Google Drive an (Tabellenblätter "Properties" und "Settings") und merkt sich die Spreadsheet-ID im Browser.
8. **Auf einem weiteren Gerät verbinden**: Die Spreadsheet-ID (aus dem Link der Tabelle in Google Drive, der Teil zwischen `/d/` und `/edit`) unter "⚙ Einstellungen" eintragen und mit "Verbinden" bestätigen.

Ohne Google-Verbindung funktioniert die App weiterhin normal, Änderungen bleiben dann nur lokal im jeweiligen Browser gespeichert (Banner-Hinweis "Nicht mit Google verbunden").

Hinweis: Vereinfachte Modellrechnung, keine Steuer-, Rechts- oder Anlageberatung.
