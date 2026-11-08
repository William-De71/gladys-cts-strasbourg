# CTS Strasbourg

## Überblick

Diese Integration bringt die **Trams und Busse von Straßburg** (CTS, Compagnie des Transports Strasbourgeois) in Gladys. Sie liefert die **nächsten Abfahrten in Echtzeit** an den Haltestellen deiner Wahl (drei im Formular, bis zu 7 weitere per Schaltfläche), gefiltert nach Linie und Richtung, und die **Verkehrslage der Linien**, die du verfolgst: normaler Betrieb, gestört, stark gestört, mit den Verkehrsmeldungen der CTS (Störungen, Bauarbeiten, Informationen). Jede Haltestelle und jede Linie wird ein Gerät für das Dashboard und die Szenen.

Die Daten stammen aus der **offiziellen Echtzeit-API der CTS** (SIRI-lite), unter der Licence Ouverte 2.0. Sie braucht ein **persönliches Token**, kostenlos: Die CTS öffnet ihr Open-Data-Portal auf Anfrage. Die Namen und Codes der Haltestellen und Linien stammen aus dem offenen Fahrplan der CTS (GTFS), einmal pro Woche gelesen: Die Suche nach einer Haltestelle verbraucht keine Anfrage.

Jede verfolgte Haltestelle ist eine Anfrage pro Abfrage, standardmäßig jede Minute; die Verkehrslage wird alle 5 Minuten gelesen. Die Integration behält jede Antwort, solange die API sie für gültig erklärt, und pausiert 5 Minuten, wenn die API um weniger Anfragen bittet. Nachts, solange keine Haltestelle in den nächsten 45 Minuten etwas ankündigt, werden die Haltestellen alle 10 Minuten gelesen.

Eine Abfahrt wird **in Echtzeit verfolgt**, wenn die CTS weiß, wo das Fahrzeug ist; sonst ist es der **Fahrplan**, markiert mit „(Fahrplan)“ (ein Stern im Widget). Die API liefert weder Verspätungen noch ausgefallene Fahrten: Die Integration erfindet nie welche.

Dies ist eine **Cloud**-Integration: Sie kontaktiert `api.cts-strasbourg.eu` (mit deinem Token und den Codes deiner Haltestellen) und `opendata.cts-strasbourg.eu` (den offenen Fahrplan). Nichts anderes verlässt dein Netz.

Die Integration wurde nach der veröffentlichten Beschreibung der API (swagger.json) geschrieben; sie wurde noch nicht mit einem echten Token getestet. Deine Rückmeldungen sind willkommen.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein persönliches Token der CTS-API: Frag per E-Mail bei `open-data@cts-strasbourg.fr` den Zugang zum Open-Data-Portal an, mit ein paar Worten zu deiner Nutzung (zum Beispiel „Hausautomation Gladys Assistant“), und kopiere dann das in deinem Open-Data-Konto angezeigte Token.

## Konfiguration

| Feld                     | Was eingeben                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Token                    | Das Token deines Open-Data-Kontos der CTS. Als Geheimnis gespeichert, nie in die Protokolle geschrieben.                           |
| Haltestelle 1, 2, 3      | Der Name der Haltestelle („Homme de Fer“, „Gare Centrale“) oder ihr Code: „275“ für die ganze Haltestelle, „275A“ für einen Steig. |
| Linie                    | Nur diese Linie: „A“, „C1“, „2“ oder ein Verkehrsmittel allein: „tram“, „bus“. Leer: alle Linien der Haltestelle.                  |
| Richtung                 | Nur die Ziele mit diesen Wörtern: „Illkirch“, „Illkirch \| Lixenbuhl“. Leer: beide Richtungen.                                     |
| Verfolgte Linien         | Die Linien, deren Verkehrslage du verfolgst, durch Kommas getrennt: „A, C, 2, C1“ (bis zu 10). Ein Gerät pro Linie.                |
| Abfrage der Haltestellen | Alle 30 Sekunden, jede Minute (Standard), alle 2 Minuten oder alle 5 Minuten.                                                      |
| Sprache der Texte        | Gerätenamen, Zusammenfassungen und Ausgaben der Szenen sowie Sprache der Verkehrsmeldungen (Französisch, Englisch, Deutsch).       |

Die Schaltfläche **Haltestelle suchen** liefert die Haltestellen mit einigen Wörtern, mit ihren Codes: „Homme de Fer [275] (275A, 275B, 275C, 275D)“. Die Zahl steht für die ganze Haltestelle in allen Richtungen; mit Buchstabe nur für einen Steig. **Verbindung testen** liest die Haltestellen und Linien der CTS, jede verfolgte Haltestelle und die Verkehrslage sofort und sagt, was geantwortet hat.

Mehr Haltestellen als die drei des Formulars (Zuhause, Arbeit, Schule…): **Haltestelle hinzufügen** nimmt dieselben drei Felder — Haltestelle, Linie, Richtung — und verfolgt bis zu 7 weitere Haltestellen. **Haltestellen auflisten** zeigt alle verfolgten Haltestellen nummeriert; **Haltestelle entfernen** nimmt diese Nummer (oder den Namen). Die hinzugefügten Haltestellen bleiben in der Konfiguration von Gladys und folgen so ihren Sicherungen.

## Verwendung

### Geräte

Erstelle im Tab **Entdecken** die gewünschten Geräte:

- **CTS \<Haltestelle\>**: die nächste Abfahrt als Text („A → Illkirch Graffenstaden · 3 Min.“), die Wartezeit der nächsten und der folgenden Abfahrt (Minuten) und die Zahl der laufenden Verkehrsmeldungen zu den Linien der Haltestelle (die des gesamten Netzes eingeschlossen). Nachts, ohne Abfahrt, behalten die Wartezeiten ihren letzten Wert.
- **CTS Tram A**, **CTS Linie 2**: die Verkehrslage der Linie als Text („Gestört: Tram C: Unfall an der Esplanade“) und ihre Zahl laufender Verkehrsmeldungen.

### Verkehrslage der Linien

Der Zustand einer Linie ist ihre schwerste laufende Meldung: eine **Störung** macht sie gestört (stark gestört, wenn die CTS sie als dringend markiert), eine **geplante Störung** gestört, **Bauarbeiten** gestört oder stark gestört, wenn sie die Linie umleiten oder unterbrechen, eine **Information** lässt den Betrieb normal. Eine Meldung für das gesamte Netz zählt für jede Linie. Die Texte der CTS gibt es auf Französisch, Englisch und Deutsch.

### Dashboard-Widgets

![Das CTS-Abfahrten-Widget an Homme de Fer und das Verkehrs-Widget (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-cts-strasbourg/main/docs/assets/widgets.de.png)

- **Abfahrten**: die nächsten Abfahrten einer Haltestelle, kompakt. Eine Zeile pro Linie und Ziel, mit ihren nächsten Abfahrten nacheinander („3 · 9 Min.“); ein Stern markiert eine Zeit nur laut Fahrplan. Die Einstellung **Angezeigte Fahrten** legt die Zahl der Zeilen fest. Wähle eine verfolgte Haltestelle oder gib eine beliebige Haltestelle (und eine Linie) in den Widget-Einstellungen ein: Eine solche Haltestelle kostet bei jeder Aktualisierung eine weitere Anfrage, höchstens jede Minute. Mit **Mehrere Haltestellen** zeigt ein Widget mehrere Haltestellen-Geräte.
- **CTS Verkehrslage**: der Zustand der verfolgten Linien (oder der in den Einstellungen eingegebenen Linien, oder der Tramlinien, wenn keine verfolgt wird), dann ihre laufenden und kommenden Meldungen. Tippe auf eine Karte für den vollständigen Text.

### Szenen

Auslöser, einmal pro Änderung (die erste Abfrage dient nur als Referenz):

- **CTS: Abfahrt bald**: eine Tram oder ein Bus an einer verfolgten Haltestelle fährt in 2, 3, 5, 10, 15 oder 20 Minuten.
- **CTS: Linie gestört**: eine verfolgte Linie wird gestört oder stark gestört.
- **CTS: wieder normal**: eine verfolgte Linie, die gestört war, ist wieder normal.
- **CTS: neue Verkehrsmeldung**: eine neue Meldung zu einer verfolgten Linie, den Linien einer verfolgten Haltestelle oder dem gesamten Netz; Filter nach Art (Störung, geplante Störung, Bauarbeiten, Information) und Priorität. Eine Aktualisierung löst erneut aus, wenn die CTS darum bittet.

Jeder liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Linie, Ziel, Zeit, Titel, Text, Zeitraum…). Die Aktionen **CTS: nächste Abfahrten** und **CTS: Verkehrslage einer Linie** liefern dieselbe Art von Werten, für eine Nachricht oder eine Bedingung.

Beispiele:

- Wenn die Tram A Richtung Illkirch in 5 Minuten an Homme de Fer abfährt → die Flurlampe grün schalten.
- Wenn die Tram C gestört ist → die Zusammenfassung vor dem Losgehen an dein Handy schicken.
- Jeden Werktag um 7:30 → die nächsten Abfahrten deiner Haltestelle lesen und vom Küchenlautsprecher ansagen lassen.

### Transport

Nur Cloud: Die Daten kommen aus dem Internet. Nur die verfolgten Haltestellen werden einzeln bei der API abgefragt, und die Verkehrslage des Netzes alle 5 Minuten.

## Fehlerbehebung

- **„Gib das Token ein“**: Das Token fehlt; frag bei `open-data@cts-strasbourg.fr` den Zugang an und füge das Token deines Open-Data-Kontos in die Konfiguration ein.
- **„Die CTS-API lehnt das Token ab“**: Prüfe es (kein Leerzeichen davor oder danach); die Integration fragt nicht erneut, bis die Konfiguration gespeichert wird.
- **„Die CTS-API bittet um weniger Anfragen“**: Die API antwortete 429; die Abfragen laufen nach 5 Minuten weiter. Verfolge weniger Haltestellen oder wähle ein längeres Intervall.
- **„Unbekannt oder mehrdeutig“**: Nutze **Haltestelle suchen** und kopiere dann den genauen Namen oder einen Code.
- **„(Fahrplan)“ hinter einer Abfahrt**: Die CTS verfolgt dieses Fahrzeug nicht in Echtzeit; die Zeit ist die des Fahrplans.
- **Keine Abfahrt**: Nachts schläft das Netz; die Haltestellen werden alle 10 Minuten gelesen.
- **Ein Problem melden**: Drücke **Diagnose** und kopiere dann die Zeilen, die mit „CTS diagnostic“ beginnen, aus dem Tab Protokolle (das Token steht nicht darin) in ein GitHub-Issue oder eine Antwort im Forum, mit den Versionen von Gladys und der Integration.
