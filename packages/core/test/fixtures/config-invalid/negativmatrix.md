# Negativmatrix der Konfigurationsvalidierung

Erzeugt mit `node --experimental-strip-types tools/gen-config-invalid.ts` aus `config/company-defaults.json`.
Jede Variante traegt genau eine Mutation.

| Datei | Verletzung | Erwarteter Code |
|---|---|---|
| `alpha-out-of-range.json` | alpha = 1.4 liegt ausserhalb [0, 1] (I-04) | `CFG_ALPHA_RANGE` |
| `weights-sum-not-one.json` | Summe der Gewichte = 0.94 statt 1 (I-12) | `CFG_WEIGHTS_SUM` |
| `weight-negative.json` | ein Gewicht ist negativ (I-12) | `CFG_WEIGHT_RANGE` |
| `g-range-invalid.json` | gMin = 0 verletzt 0 < gMin <= 1 (I-16, deckt zugleich I-15) | `CFG_G_RANGE` |
| `stufen-nicht-aufsteigend.json` | Stuetzstellenliste nicht streng aufsteigend in v (I-20) | `CFG_TIER_ORDER` |
| `degression-stufe-verletzt.json` | Grenzsatz erreicht den Durchschnittssatz in Stufe 1 (I-19) | `CFG_TIER_DEGRESSION` |
| `netto-degression-verletzt.json` | starker Wirkpfad des Projektumfangs bei weitem g-Bildbereich kippt eq:netto_degression (I-18) | `CFG_NET_DEGRESSION` |
| `norm-bounds-equal.json` | min = max fuer einen Faktor; Division durch null in eq:normalisierung (I-10/I-11) | `CFG_NORM_BOUNDS` |
| `zuschlag-bounds-invalid.json` | zMin = -1 verletzt z_j > -1 (I-06/I-07) | `CFG_ADJUSTMENT_BOUNDS` |

## Konstruktiv ausgeschlossen

Fuer diese Faelle darf keine Fixture verlangt werden, weil das Schema sie nicht
ausdruecken kann. Sie werden mit Status `konstruktiv_ausgeschlossen` gefuehrt,
statt zu fehlen.

| Fall | Begruendung |
|---|---|
| Stufenluecke (V_{k+1}^min > V_k^max) | Die Stufen entstehen als Intervalle zwischen aufeinanderfolgenden Stuetzstellen; eine Luecke liesse sich nur bei getrennt konfigurierten Intervallgrenzen ausdruecken. |
| Stufenueberlappung (V_{k+1}^min < V_k^max) | Gleiche Begruendung; die Liste hat je Grenze genau einen Wert. |
| fallendes g | g ist linear mit gMin <= 1 <= gMax; die Ordnung wird bereits auf Ebene 2 (CFG_G_RANGE) und Ebene 3 (CFG_G_ORDER) erzwungen. |

