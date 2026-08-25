# Herleitung der Standardkonfiguration

> **VORLAEUFIG — vom Auftraggeber zu bestaetigen.** Saemtliche Zahlenwerte sind
> eine begruendete Festlegung des Autors, keine Vorgabe der Primus Property AG.
> Die Arbeit laesst diese Werte in den Platzhaltern von 3.3.6 und 5.2.3
> ausdruecklich offen. Sie sind so gewaehlt, dass sie die formalen Invarianten
> nachweislich erfuellen, und dienen beim Auftraggeber-Termin als diskutierbarer
> Vorschlag. Jede Aenderung ist eine reine Konfigurationsaenderung und beruehrt
> keinen Code.

## Einheiten

Betraege stehen durchgaengig in **Rappen**. `honorar.stuetzstellen[].v`,
`hMin` und `hMax` sind ganzzahlige Rappen; `aufwandfaktoren.preissegment.min/max`
stehen in **Rappen je Quadratmeter**.

| Schluessel | Rappen | entspricht |
|---|---|---|
| `preissegment.min` | 600 000 | 6 000 CHF/m² |
| `preissegment.max` | 1 800 000 | 18 000 CHF/m² |
| `stuetzstellen[1].v` | 500 000 000 | 5 Mio. CHF |
| `stuetzstellen[6].v` | 20 000 000 000 | 200 Mio. CHF |

Frankenwerte bei den Preissegment-Grenzen haetten den Rohwert um den Faktor 100
ueber die Obergrenze gehoben; die Kappung haette konstant `x̂ = 1` geliefert und
den Faktor stillgelegt.

## Aufwandfaktoren und Gewichte

| # | Bezeichner | Quelle | min | max | Gewicht | Polung |
|---|---|---|---|---|---|---|
| 1 | `lage_gesamt` | `lagescore` → `location` | 1.0 | 0.0 | 0.40 | invertiert |
| 2 | `innenausbau_qualitaet` | `manuell` | 1 | 6 | 0.25 | direkt |
| 3 | `preissegment` | `abgeleitet` → `mittlererQuadratmeterpreis` | 600 000 | 1 800 000 | 0.20 | direkt |
| 4 | `projektumfang` | `abgeleitet` → `einheitenzahl` | 4 | 36 | 0.15 | direkt |

Faktorschluessel und Quellschluessel sind zu unterscheiden: Der Faktor heisst
`projektumfang`, seine Datenquelle im Kern heisst `einheitenzahl`. Zulaessige
Quellschluessel der Quelle `abgeleitet` sind `einheitenzahl` und
`mittlererQuadratmeterpreis`.

Σw = 0.40 + 0.25 + 0.20 + 0.15 = **1.00**, exakt und ohne Toleranzausschoepfung.

Die vertauschten Grenzen von `lage_gesamt` sind der Richtungsmechanismus
`x̂ = 1 − x`: Ein hoher Lagescore bedeutet gute Lage und damit geringen Aufwand.
Die Berechnungsstufe enthaelt dafuer **keinen** faktorspezifischen Sonderfall —
jede Sonderbehandlung im Code machte jeden neuen Faktor zu einer Codeaenderung.

**Nur der Gesamtlagescore geht als Aufwandfaktor ein, nicht alle neun.** Das
System verdichtet nichts: Alle neun Scores bleiben in Datenmodell und Offerte
getrennt gefuehrt; die Konfiguration waehlt aus, welcher gewichtet wird.

### Skala `innenausbau_qualitaet`

Sechsstufige Ordinalskala: 1 einfacher Standard · 2 Standard · 3 gehoben ·
4 hochwertig · 5 exklusiv · 6 Luxus. Die Stufenbeschriftungen stehen im Feld
`skala` des Faktors und werden von der Erfassungsmaske daraus gelesen (E-24).
Das Feld ist **rein deskriptiv** und geht in keine Formel ein; Rechenwirkung
haben allein `min`, `max`, `strategie` und `gewicht`. Eine Umbenennung oder
Erweiterung der Stufen ist damit eine Konfigurationsaenderung.
Geradzahlig, also **ohne neutrale Mitte** —
eine ungerade Skala verleitet zur Zentraltendenz, und bei nur einem Bewerter je
Projekt waere eine systematische Mittelwahl unmittelbar honorarwirksam.

**Methodische Offenlegung:** Die Min-Max-Normalisierung behandelt die
Ordinalskala wie eine Intervallskala (Aequidistanzannahme). Das ist fuer die
gewichtete Summe notwendig und in der Praxis ueblich, aber eine Annahme und
keine Messeigenschaft.

### Ermittlung des Preissegments

Flaechengewichteter mittlerer Quadratmeterpreis ueber alle Wohnungstypen,
gebildet **vor** den Zu-/Abschlaegen. Andernfalls wirkten die vom Vermarkter
gesetzten Anpassungen ueber die Hintertuer auf das Honorar — eine
Interessenkollision.

## Weitere Skalarparameter

| Parameter | Wert | Begruendung |
|---|---|---|
| `flaeche.alpha` | 0.50 | Balkon- und Terrassenflaeche zaehlt haelftig; identisch fuer Referenz- und Einheitenflaeche, sonst bricht die Referenztreue |
| `preisanpassung.zMin` | −0.25 | ein Abschlag von mehr als einem Viertel waere keine Einzelfallanpassung mehr, sondern eine abweichende Bewertung |
| `preisanpassung.zMax` | +0.25 | symmetrisch; haelt die Gesamtabweichung vom Referenzwert erklaerbar |
| `preisanpassung.begruendungMinLaenge` | 10 | verhindert Alibi-Begruendungen. **Festlegung ohne Grundlage in der Arbeit** — dort ist nur ein Pflichtfeld gefordert. Der Wert ist konfigurierbar, die Pflicht dagegen nicht |

## Skalierungsfunktion g

`g(D) = 0.85 + D · 0.30`, Bildbereich `[0.85, 1.15]`.
`0 < 0.85 ≤ 1 ≤ 1.15`; streng monoton steigend; `g(0.5) = 1.00` als neutrales
Aufwandniveau. Bandbreite ±15 %: gross genug, damit die Aufwandbewertung sichtbar
wirkt, klein genug, damit sie die Degression nicht kippen kann.

## Stuetzstellen und Honorarbasen

| k | V [CHF] | hMax [CHF] | hMin [CHF] | Durchschnittssatz hMax/V |
|---|---|---|---|---|
| 0 | 0 | 40 000 | 30 000 | — (Grundhonorar) |
| 1 | 5 000 000 | 150 000 | 112 500 | 3.000 % |
| 2 | 10 000 000 | 260 000 | 195 000 | 2.600 % |
| 3 | 25 000 000 | 500 000 | 375 000 | 2.000 % |
| 4 | 50 000 000 | 800 000 | 600 000 | 1.600 % |
| 5 | 100 000 000 | 1 250 000 | 937 500 | 1.250 % |
| 6 | 200 000 000 | 2 000 000 | 1 500 000 | 1.000 % |

Sechs Stufen. Das Grundhonorar bei `V = 0` bildet den projektunabhaengigen
Fixaufwand ab, der die Degression begruendet, und schliesst zugleich den
undefinierten Bereich unterhalb des Wertebereichs. Die abschliessende
Stuetzstelle bei 200 Mio. CHF schliesst die Definitionsluecke am oberen Rand
**konfigurationsseitig** — mit einer Sicherheitsmarge um den Faktor 2 gegenueber
der von der Arbeit geforderten Groessenordnung von 100 Mio. CHF.

Oberhalb von 200 Mio. CHF bricht der Kern **definiert ab** und meldet, die
Honorarstaffelung sei zu erweitern. Es gibt **keine** Extrapolation und keine
Konstantfortsetzung: Eine Fortschreibung waere eine Modellaussage ueber einen
Bereich, den die Arbeit nicht behandelt. Die Grenze des Modells ist damit eine
sichtbare Konfigurationsgrenze statt einer stillen Annahme, und ihre Erweiterung
ist eine reine Konfigurationsaenderung von zwei Zahlen.

`hMin` und `hMax` sind je Stuetzstelle **unabhaengig** konfiguriert. Das
durchgaengige Verhaeltnis 0.75 ist der Vorgabewert dieser Konfiguration und
**keine Modelleigenschaft**; eine stufenweise veraenderliche Rangebreite ist
zulaessig und wird von der Validierung getragen, weil die Degressionsbedingung
fuer beide Randkurven getrennt geprueft wird.

## Parameter der Zugriffsschicht

Sie stehen **in der Konfiguration** und nicht als Konstanten im Code; sonst waere
die Forderung nach extern definierten, zur Laufzeit gebundenen Parametern fuer
die Zugriffsschicht verletzt.

| Schluessel | Wert | Begruendung |
|---|---|---|
| `timeoutMs` | 10 000 | Regelfall: Login, Lesen, Lagescores |
| `timeoutValuationMs` | 20 000 | der Bewertungsabruf rechnet serverseitig und braucht mehr Zeit |
| `gesamtbudgetMs` | 45 000 | harte Obergrenze je Typ-Schritt, damit ein haengender Abruf die Kette nicht blockiert |
| `retry.maxVersuche` | 3 | Erstversuch plus zwei Wiederholungen |
| `retry.startBackoffMs` | 500 | Ausgangswartezeit des exponentiellen Backoffs |
| `retry.backoffFaktor` | 2 | Verdopplung je Versuch |
| `retry.maxBackoffMs` | 8 000 | Deckel der Einzelwartezeit |
| `retry.jitter` | `voll` | Full Jitter gegen gleichzeitiges Wiederanlaufen |
| `retry.retryAfterMaxSekunden` | 60 | daraus ueber kein Warten, sondern sofortiger Fehler. **Festlegung ohne Grundlage in der Arbeit** |
| `retry.retryStatuscodes` | 429, 500, 502, 503, 504 | voruebergehende Fremdzustaende |
| `tokenGueltigkeitMin` | 720 | Login-Token 12 h laut Bruno-Collection |
| `tokenSicherheitsmargeMin` | 30 | Vorlaufzeit, um die vor Ablauf erneuert wird; verhindert, dass ein Abruf mit einem waehrend des Laufs ablaufenden Token startet. Geprueft wird `0 <= marge < tokenGueltigkeitMin` |

**Zugangsdaten stehen bewusst nicht in dieser Datei.** Benutzername, Passwort und
das abgeleitete Token kommen ausschliesslich aus Umgebungsvariablen. Die
Konfigurationsdatei ist damit versionierbar und in der Offerte als Metadatum
zitierbar, ohne Geheimnisse zu fuehren.

## `dossierDefaults`

Die Schluesselmenge folgt der verbindlichen Feldliste der repraesentativen
Parametrisierung und ist **vorlaeufig**, solange kein API-Zugang besteht. Die
Bruno-Collection belegt nur einen Teil der Felder; fuer die uebrigen sind die
exakten PriceHubble-Feldnamen und Wertemengen unbelegt. Das ist eine offene
Nachweisluecke, die erst mit der Fixture-Aufzeichnung schliessbar ist.

`zustandsbewertungen`/`qualitaetsbewertungen` tragen seit der Rueckmeldung des
Auftraggebers einen festen Wert: Da es sich ausschliesslich um Neubauprojekte
handelt, gilt firmenweit `"Neu / kürzlich modernisiert": "3"` (Zustand) sowie
`"Gesamteindruck": "gehoben"` (Qualitaet) — beide Merkmale muessen deshalb nicht
mehr je Referenzobjekt erfasst werden. Schluessel und Wertform sind, wie oben
beschrieben, weiterhin unbelegt gegen die echte PriceHubble-API; die genaue
Schreibweise stammt vom Auftraggeber, nicht aus einer Fixture-Aufzeichnung.

## Offene Punkte fuer den Auftraggeber

1. Saemtliche Zahlenwerte, insbesondere die Zielsaetze 3.0 % → 1.0 %, die
   Rangebreite von 25 %, die Stufengrenzen und die Bandbreite von `g`.
2. Praktikabilitaet der sechsstufigen Skala fuer den Innenausbau.
3. Preissegment-Grenzen fuer das Marktgebiet des Auftraggebers.
4. Gilt firmenweit dieselbe Aussenflaechengewichtung, oder unterscheidet sie sich
   nach Balkon, Terrasse und Gartensitzplatz? Letzteres waere ein Modell- und kein
   Konfigurationsentscheid.
5. Positionen und Vorgabefaktoren der `anpassungsVorlagen`.
6. Sollen weitere Lagescores als Aufwandfaktoren gefuehrt werden?
