#!/usr/bin/env python3
"""Erzeugt die Referenz-Arbeitsmappe (T1) und ihre CSV-Ausleitung.

UNABHAENGIGKEIT: Dieses Skript wertet die Formeln aus Kapitel 3.3 der Arbeit
(eq:flaeche, eq:qm_preis, eq:wohnungspreis, eq:verkaufssumme, eq:normalisierung,
eq:aufwandindikator, eq:honorar_mapping, eq:netto_degression) auf einem zweiten,
vom Produktivcode getrennten Rechenweg aus. Es importiert nichts aus
`packages/core`; die Formeln stehen hier ein zweites Mal, in einer anderen
Sprache. Genau darin besteht die Aussagekraft des Vergleichs: Ein Fehler muesste
in beiden Fassungen gleich auftreten, um unentdeckt zu bleiben.

Die erzeugte Arbeitsmappe traegt die Rechenschritte als TABELLENFORMEL, nicht als
eingetippten Zahlenwert — sie ist damit in einem Tabellenprogramm nachvollziehbar
und nachrechenbar. Die CSV-Ausleitung traegt die von diesem Skript berechneten
Werte; beide Wege muessen uebereinstimmen.

Rundung: kaufmaennisch, halbe Betraege vom Nullpunkt weg, identisch zu Brief §5.3.
Gerundet wird an genau zwei Stellen der Preisableitung (R1 Referenzwertuebernahme,
R2 Wohnungspreis) sowie in der Honorarkette nach der Multiplikation mit g(D) (R3).
`q_t`, `basispreis`, `basisMin` und `basisMax` bleiben ungerundet.

Aufruf: python3 tools/referenz/referenzmappe.py
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

from openpyxl import Workbook

WURZEL = Path(__file__).resolve().parents[2]
MAPPE = WURZEL / "docs" / "referenz" / "referenzberechnung.xlsx"
CSV_ZIEL = WURZEL / "packages" / "core" / "test" / "fixtures" / "reference"

# --- Modellparameter der Standardkonfiguration (Spec 02 §5) ---------------------
ALPHA = 0.5
G_MIN, G_MAX = 0.85, 1.15
STUETZSTELLEN = [
    (0, 3_000_000, 4_000_000),
    (500_000_000, 11_250_000, 15_000_000),
    (1_000_000_000, 19_500_000, 26_000_000),
    (2_500_000_000, 37_500_000, 50_000_000),
    (5_000_000_000, 60_000_000, 80_000_000),
    (10_000_000_000, 93_750_000, 125_000_000),
    (20_000_000_000, 150_000_000, 200_000_000),
]


def runde_auf_rappen(betrag: float) -> int:
    """Kaufmaennisch, halbe Betraege vom Nullpunkt weg (Brief §5.3, E-10)."""
    vorzeichen = -1 if betrag < 0 else 1
    return vorzeichen * math.floor(abs(betrag) + 0.5)


def flaeche(innen: float, aussen: float, alpha: float) -> float:
    """eq:flaeche"""
    return innen + alpha * aussen


def normalisiere(x: float, xmin: float, xmax: float) -> float:
    """eq:normalisierung, inklusive aeusserer Kappung"""
    return min(1.0, max(0.0, (x - xmin) / (xmax - xmin)))


def g_von(d: float) -> float:
    """g(D), linear ueber [g_min, g_max]"""
    return G_MIN + d * (G_MAX - G_MIN)


def stufe_von(v: int) -> int:
    """Index k mit V_k_min <= V < V_k_max; auf der letzten Stuetzstelle die letzte Stufe."""
    for k in range(len(STUETZSTELLEN) - 1):
        if STUETZSTELLEN[k][0] <= v < STUETZSTELLEN[k + 1][0]:
            return k
    return len(STUETZSTELLEN) - 2


def honorarbasis(v: int, spalte: int) -> tuple[int, float, float]:
    """eq:honorar_mapping — liefert (k, t, H_(V)) ungerundet. spalte: 1 = hMin, 2 = hMax."""
    k = stufe_von(v)
    links, rechts = STUETZSTELLEN[k], STUETZSTELLEN[k + 1]
    t = (v - links[0]) / (rechts[0] - links[0])
    return k, t, links[spalte] + t * (rechts[spalte] - links[spalte])


# --- Blatt 01: eq:flaeche -------------------------------------------------------
BLATT_01 = ["unit_id", "A_innen", "A_aussen", "alpha", "A_gewichtet"]
DATEN_01 = [
    ("U1", 92.5, 12.0, 0.0),
    ("U2", 92.5, 12.0, 0.25),
    ("U3", 92.5, 12.0, 0.5),
    ("U4", 92.5, 12.0, 1.0),
    ("U5", 64.0, 0.0, 0.5),
]

# --- Blatt 02: eq:qm_preis ------------------------------------------------------
BLATT_02 = ["typ_id", "P_ref", "P_ref_rappen", "A_ref_innen", "A_ref_aussen",
            "alpha", "A_ref", "q_t"]
DATEN_02 = [
    ("T1", 850_000.0, 92.5, 0.0, 0.5),
    ("T2", 950_000.0, 92.5, 12.0, 0.5),
    ("T3", 640_000.0, 64.0, 0.0, 0.25),
]

# --- Blatt 03: eq:wohnungspreis -------------------------------------------------
BLATT_03 = ["unit_id", "typ_id", "q_t", "A_gewichtet", "a_1", "a_2", "a_3",
            "begruendung", "z_j", "p_j", "p_j_rappen"]
DATEN_03 = [
    ("A-01", "T1", 0.0, 0.0, 0.0, "ohne Anpassung"),
    ("A-02", "T1", 0.1, -0.05, 0.0, "Attikalage abzueglich Laermexposition"),
    ("A-03", "T1", -0.1, 0.0, 0.0, "Laermexposition Strassenseite"),
    ("A-04", "T1", 0.2, 0.05, -0.1, "Attika, Gartensitzplatz, Nordausrichtung"),
]

# --- Blatt 04: eq:verkaufssumme -------------------------------------------------
BLATT_04 = ["szenario_id", "m", "V", "V_rappen"]
DATEN_04 = [("S-a", 1), ("S-b", 4), ("S-c", 10)]

# --- Blatt 05: eq:normalisierung ------------------------------------------------
BLATT_05 = ["faktor_id", "x_roh", "x_min", "x_max", "x_norm"]
DATEN_05 = [
    ("innen", 2.5, 0.0, 10.0),        # innerhalb
    ("rand_oben", 10.0, 0.0, 10.0),   # auf der oberen Grenze
    ("rand_unten", 0.0, 0.0, 10.0),   # auf der unteren Grenze
    ("unterhalb", -5.0, 0.0, 10.0),   # gekappt nach unten
    ("oberhalb", 15.0, 0.0, 10.0),    # gekappt nach oben
    ("invertiert", 0.8, 1.0, 0.0),    # Umpolung allein ueber vertauschte Grenzen
]

# --- Blatt 06: eq:aufwandindikator ---------------------------------------------
BLATT_06 = ["faktor_id", "w_d", "x_norm", "produkt", "D", "summe_w"]
DATEN_06 = [
    ("lage_gesamt", 0.40, 0.2),
    ("innenausbau_qualitaet", 0.25, 0.4),
    ("preissegment", 0.20, 0.3),
    ("projektumfang", 0.15, 0.5),
]

# --- Blatt 07: eq:honorar_mapping ----------------------------------------------
BLATT_07 = ["V", "V_rappen", "k", "V_k_min", "V_k_max", "H_min_k", "H_min_k1",
            "H_min_V_rappen", "H_max_k", "H_max_k1", "H_max_V_rappen", "D", "g_D",
            "H_min_g_rappen", "H_max_g_rappen"]
DATEN_07 = [
    (750_000_000, 0.5),        # Stufenmitte
    (500_000_000, 0.5),        # auf der unteren Stuetzstelle
    (999_999_999, 0.5),        # unmittelbar unterhalb der oberen
    (20_000_000_000, 0.5),     # exakt auf der letzten Stuetzstelle
    (753_000_001, 0.317),      # krummer Interpolationsanteil
]

# --- Blatt 08: eq:netto_degression ---------------------------------------------
BLATT_08 = ["V1", "V2", "m1", "m2", "D1", "D2",
            "linke_seite", "rechte_seite", "margenquotient"]
DATEN_08 = [
    (4, 8, 0.4, 0.5),
    (4, 20, 0.3, 0.6),
    (10, 30, 0.2, 0.8),
]

EINHEITSPREIS_RAPPEN = 85_000_000


def zeilen_01():
    for unit, innen, aussen, alpha in DATEN_01:
        yield [unit, innen, aussen, alpha, flaeche(innen, aussen, alpha)]


def zeilen_02():
    for typ, p_chf, innen, aussen, alpha in DATEN_02:
        p_rappen = runde_auf_rappen(p_chf * 100)  # R1
        a_ref = flaeche(innen, aussen, alpha)
        yield [typ, p_chf, p_rappen, innen, aussen, alpha, a_ref, p_rappen / a_ref]


def zeilen_03():
    # Alle Einheiten des Typs T1 mit den Referenzflaechen: basispreis = P_ref.
    a_ref = flaeche(92.5, 0.0, ALPHA)
    q_t = EINHEITSPREIS_RAPPEN / a_ref
    for unit, _typ, a1, a2, a3, grund in DATEN_03:
        z = a1 + a2 + a3
        basispreis = q_t * a_ref
        p_rappen = runde_auf_rappen(basispreis * (1 + z))  # R2
        yield [unit, "T1", q_t, a_ref, a1, a2, a3, grund, z, p_rappen / 100, p_rappen]


def zeilen_04():
    for szenario, m in DATEN_04:
        v = m * EINHEITSPREIS_RAPPEN
        yield [szenario, m, v / 100, v]


def zeilen_05():
    for faktor, x, xmin, xmax in DATEN_05:
        yield [faktor, x, xmin, xmax, normalisiere(x, xmin, xmax)]


def zeilen_06():
    summe_w = sum(w for _, w, _ in DATEN_06)
    d = sum(w * x for _, w, x in DATEN_06)
    for faktor, w, x in DATEN_06:
        yield [faktor, w, x, w * x, d, summe_w]


def zeilen_07():
    for v, d in DATEN_07:
        k, _, basis_min = honorarbasis(v, 1)
        _, _, basis_max = honorarbasis(v, 2)
        g = g_von(d)
        yield [v / 100, v, k, STUETZSTELLEN[k][0], STUETZSTELLEN[k + 1][0],
               STUETZSTELLEN[k][1], STUETZSTELLEN[k + 1][1], basis_min,
               STUETZSTELLEN[k][2], STUETZSTELLEN[k + 1][2], basis_max,
               d, g, runde_auf_rappen(basis_min * g), runde_auf_rappen(basis_max * g)]


def zeilen_08():
    for m1, m2, d1, d2 in DATEN_08:
        v1 = m1 * EINHEITSPREIS_RAPPEN
        v2 = m2 * EINHEITSPREIS_RAPPEN
        _, _, h1 = honorarbasis(v1, 1)
        _, _, h2 = honorarbasis(v2, 1)
        links = h2 * g_von(d2) / v2
        rechts = h1 * g_von(d1) / v1
        margenquotient = (v2 / v1) * (h1 / h2)
        yield [v1, v2, m1, m2, d1, d2, links, rechts, margenquotient]


BLAETTER = [
    ("01_flaeche", BLATT_01, list(zeilen_01())),
    ("02_qm_preis", BLATT_02, list(zeilen_02())),
    ("03_wohnungspreis", BLATT_03, list(zeilen_03())),
    ("04_verkaufssumme", BLATT_04, list(zeilen_04())),
    ("05_normalisierung", BLATT_05, list(zeilen_05())),
    ("06_aufwandindikator", BLATT_06, list(zeilen_06())),
    ("07_honorar_mapping", BLATT_07, list(zeilen_07())),
    ("08_degression", BLATT_08, list(zeilen_08())),
]

# Spalten, die in der Arbeitsmappe als FORMEL stehen. Der Schluessel ist der
# Spaltenname, der Wert eine Vorlage mit `{r}` fuer die Zeilennummer.
FORMELN = {
    "01_flaeche": {"A_gewichtet": "=B{r}+D{r}*C{r}"},
    "02_qm_preis": {"A_ref": "=D{r}+F{r}*E{r}", "q_t": "=C{r}/G{r}"},
    "03_wohnungspreis": {"z_j": "=E{r}+F{r}+G{r}", "p_j": "=K{r}/100"},
    "04_verkaufssumme": {"V": "=D{r}/100"},
    "05_normalisierung": {"x_norm": "=MIN(1;MAX(0;(B{r}-C{r})/(D{r}-C{r})))"},
    "06_aufwandindikator": {"produkt": "=B{r}*C{r}"},
    "07_honorar_mapping": {"V": "=B{r}/100", "g_D": "=0.85+L{r}*0.3"},
    "08_degression": {},
}


def schreibe_mappe() -> None:
    mappe = Workbook()
    mappe.remove(mappe.active)
    for name, kopf, zeilen in BLAETTER:
        blatt = mappe.create_sheet(name)
        blatt.append(kopf)
        for i, zeile in enumerate(zeilen, start=2):
            werte = list(zeile)
            for spalte, vorlage in FORMELN[name].items():
                werte[kopf.index(spalte)] = vorlage.format(r=i)
            blatt.append(werte)
    MAPPE.parent.mkdir(parents=True, exist_ok=True)
    mappe.save(MAPPE)


def schreibe_csv() -> list[dict[str, str]]:
    CSV_ZIEL.mkdir(parents=True, exist_ok=True)
    eintraege = []
    for name, kopf, zeilen in BLAETTER:
        pfad = CSV_ZIEL / f"{name}.csv"
        with pfad.open("w", newline="", encoding="utf-8") as datei:
            schreiber = csv.writer(datei, lineterminator="\n")
            schreiber.writerow(kopf)
            for zeile in zeilen:
                schreiber.writerow([
                    # Punkt als Dezimaltrennzeichen, keine Tausendertrennzeichen;
                    # repr() haelt die volle Genauigkeit der Gleitkommazahl.
                    repr(w) if isinstance(w, float) else w
                    for w in zeile
                ])
        eintraege.append({
            "blatt": name,
            "csv": f"{name}.csv",
            "sha256": hashlib.sha256(pfad.read_bytes()).hexdigest(),
        })
    return eintraege


def schreibe_manifest(eintraege: list[dict[str, str]]) -> None:
    manifest = {
        "quellmappe": "docs/referenz/referenzberechnung.xlsx",
        "erzeuger": "tools/referenz/referenzmappe.py",
        "exportdatum": "2026-08-16",
        "unabhaengigkeit": (
            "Die Referenzwerte entstehen auf einem zweiten, vom Produktivcode getrennten "
            "Rechenweg: Das Erzeugerskript ist Python, importiert nichts aus packages/core "
            "und fuehrt die Formeln aus Kapitel 3.3 eigenstaendig. Die Arbeitsmappe traegt "
            "dieselben Schritte als Tabellenformel."
        ),
        "einschraenkung": (
            "Die von Plan P2 Aufgabe 19 geforderte Commit-Reihenfolge (Referenzwerte als "
            "Commit A VOR der Implementierung der Stufen, Commit B danach) ist NICHT "
            "eingehalten. Die Ausfuehrungsreihenfolge in 00-planentscheide.md Abschnitt F "
            "ordnet die Referenzmappe als Schritt 7 nach den Stufen ein (Schritt 5); beide "
            "Vorgaben widersprechen sich, und das uebergeordnete Dokument gewinnt. Die "
            "Unabhaengigkeit ist damit ueber den getrennten Rechenweg belegt, nicht "
            "zusaetzlich ueber die Versionsgeschichte. Wer die zeitliche Unabhaengigkeit "
            "beweisen will, muss die Mappe vor der naechsten Modellaenderung erneut "
            "erzeugen und den Commit vor der Aenderung setzen."
        ),
        "commitPaar": None,
        "blaetter": eintraege,
    }
    (CSV_ZIEL / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")



# =============================================================================
# Szenarien (T2) — Fixtures und unabhaengig gerechnete Erwartungswerte
# =============================================================================
# Aufbau je Szenario: Wohnungstypen (Referenzflaechen und Referenzwert), Einheiten
# (die als 3-Tupel die Referenzflaechen tragen, damit I-05 unmittelbar beobachtbar
# bleibt, oder als 5-Tupel eine explizit abweichende Geometrie fuehren — S6, F-061),
# Lagescores und manuell erfasste Aufwandfaktoren.
#
# Die Erwartungswerte entstehen hier auf demselben getrennten Rechenweg wie die
# Blaetter 01-08: V ueber eq:wohnungspreis und eq:verkaufssumme, D ueber
# eq:normalisierung und eq:aufwandindikator, die Honorarrange ueber
# eq:honorar_mapping. Kein Import aus packages/core.

FAKTOREN = [
    # (id, quelle, quellschluessel, grenzeMin, grenzeMax, gewicht)
    ("lage_gesamt", "lagescore", "location", 1.0, 0.0, 0.40),
    ("innenausbau_qualitaet", "manuell", "innenausbau_qualitaet", 1.0, 6.0, 0.25),
    ("preissegment", "abgeleitet", "mittlererQuadratmeterpreis", 600_000.0, 1_800_000.0, 0.20),
    ("projektumfang", "abgeleitet", "einheitenzahl", 4.0, 36.0, 0.15),
]

SZENARIEN = {
    "S1": {
        "bezeichnung": "Kleines MFH, laendliche Lage, ein Wohnungstyp, ohne Aussenflaechen",
        "lage": {"adresse": "Dorfstrasse 4", "plz": "6015", "ort": "Reussbuehl"},
        "typen": [("T1", 3.5, 92.5, 0.0, 85_000_000)],
        "einheiten": [("A-01", "T1", []), ("A-02", "T1", []),
                      ("A-03", "T1", []), ("A-04", "T1", [])],
        "lagescores": {"location": 0.35},
        "aufwandfaktoren": {"innenausbau_qualitaet": 2},
    },
    "S2": {
        "bezeichnung": "MFH urbane Lage, zwei Typen, alle Einheiten mit Balkon",
        "lage": {"adresse": "Bahnhofstrasse 12", "plz": "6003", "ort": "Luzern"},
        "typen": [("T1", 3.5, 92.5, 12.0, 90_000_000), ("T2", 4.5, 112.0, 16.0, 118_000_000)],
        "einheiten": [("A-01", "T1", []), ("A-02", "T1", []), ("A-03", "T1", []),
                      ("B-01", "T2", []), ("B-02", "T2", []), ("B-03", "T2", [])],
        "lagescores": {"location": 0.78},
        "aufwandfaktoren": {"innenausbau_qualitaet": 4},
    },
    "S3": {
        "bezeichnung": "MFH stark heterogen, vier Typen, Anpassungen nahe der Spannweite",
        "lage": {"adresse": "Seestrasse 88", "plz": "6047", "ort": "Kastanienbaum"},
        "typen": [("T1", 2.5, 61.0, 6.0, 62_000_000), ("T2", 3.5, 92.5, 10.0, 98_000_000),
                  ("T3", 4.5, 118.0, 18.0, 155_000_000), ("T4", 5.5, 146.0, 34.0, 232_000_000)],
        "einheiten": [
            ("A-01", "T1", []),
            ("A-02", "T2", [(0.20, "Attikalage mit privater Dachterrasse"),
                            (0.04, "Unverbaubare Aussicht auf den See")]),
            ("A-03", "T3", [(-0.24, "Laermexposition Hauptverkehrsachse und Nordausrichtung")]),
            ("A-04", "T4", [(0.15, "Freie Seesicht ueber zwei Geschosse"),
                            (-0.16, "Erdgeschoss stark einsehbar zur Strasse")]),
        ],
        "lagescores": {"location": 0.62},
        "aufwandfaktoren": {"innenausbau_qualitaet": 5},
    },
    "S4a": {
        "bezeichnung": "Vergleichsprojekt: drei Typen, zwoelf Einheiten",
        "lage": {"adresse": "Industriestrasse 5", "plz": "6010", "ort": "Kriens"},
        "typen": [("T1", 3.5, 92.5, 0.0, 85_000_000), ("T2", 4.5, 112.0, 0.0, 105_000_000),
                  ("T3", 2.5, 64.0, 0.0, 60_000_000)],
        "einheiten": [(f"{p}-{i:02d}", t, [])
                      for t, p in (("T1", "A"), ("T2", "B"), ("T3", "C"))
                      for i in range(1, 5)],
        "lagescores": {"location": 0.55},
        "aufwandfaktoren": {"innenausbau_qualitaet": 3},
    },
    "S4b": {
        "bezeichnung": "Grosses MFH ueber zwanzig Einheiten, gleiche Typmischung wie S4a",
        "lage": {"adresse": "Industriestrasse 5", "plz": "6010", "ort": "Kriens"},
        "typen": [("T1", 3.5, 92.5, 0.0, 85_000_000), ("T2", 4.5, 112.0, 0.0, 105_000_000),
                  ("T3", 2.5, 64.0, 0.0, 60_000_000)],
        "einheiten": [(f"{p}-{i:02d}", t, [])
                      for t, p in (("T1", "A"), ("T2", "B"), ("T3", "C"))
                      for i in range(1, 9)],
        "lagescores": {"location": 0.55},
        "aufwandfaktoren": {"innenausbau_qualitaet": 3},
    },
    "S5": {
        "bezeichnung": "Randszenario: ein Typ ohne Referenzbewertung, fehlender Aufwandfaktor",
        "lage": {"adresse": "Hinterdorfstrasse 2", "plz": "6289", "ort": "Hohenrain"},
        # T2 traegt bewusst KEINEN Referenzwert: der Abruf lieferte fuer diesen Typ nichts.
        "typen": [("T1", 3.5, 92.5, 0.0, 85_000_000), ("T2", 4.5, 112.0, 0.0, None)],
        "einheiten": [("A-01", "T1", []), ("B-01", "T2", [])],
        "lagescores": {"location": 0.5},
        # `innenausbau_qualitaet` fehlt; zusaetzlich ein Rohwert weit oberhalb der Grenze.
        "aufwandfaktoren": {"f_x": 99},
    },
    "S6": {
        # In S1-S4b tragen alle Einheiten exakt die Referenzgeometrie ihres Typs;
        # dort kuerzt sich alpha aus eq:wohnungspreis (p_j = P_ref) und die
        # OAT-Dimension D2 zeigt ueberall 0 (F-061). S6 laesst die Geometrie
        # bewusst abweichen: Erdgeschoss ohne Balkon (A_aussen = 0), Regelgeschosse
        # auf der Referenz, Attika mit grosser Terrasse deutlich darueber. Erst so
        # wird die alpha-Wirkung in der Sensitivitaetsanalyse messbar.
        "bezeichnung": "MFH mit heterogenen Aussenflaechen, Einheitengeometrie "
                       "weicht vom Referenzobjekt ab",
        "lage": {"adresse": "Gartenstrasse 7", "plz": "6048", "ort": "Horw"},
        "typen": [("T1", 3.5, 92.5, 12.0, 92_000_000), ("T2", 4.5, 118.0, 20.0, 132_000_000)],
        # 5-Tupel (unit_id, typ_id, anpassungen, A_innen, A_aussen).
        "einheiten": [
            ("A-01", "T1", [], 92.5, 0.0),
            ("A-02", "T1", [], 92.5, 12.0),
            ("A-03", "T1", [], 92.5, 12.0),
            ("B-01", "T2", [], 118.0, 20.0),
            ("B-02", "T2", [], 118.0, 64.0),
        ],
        "lagescores": {"location": 0.68},
        "aufwandfaktoren": {"innenausbau_qualitaet": 4},
    },
}


def einheit_mit_flaechen(typen: dict, eintrag: tuple) -> tuple:
    """Normalisiert einen Einheiten-Eintrag auf (unit, typ, anpassungen, innen, aussen).

    3-Tupel erben die Referenzflaechen ihres Typs (I-05 direkt beobachtbar);
    5-Tupel fuehren die Geometrie explizit (S6, F-061).
    """
    if len(eintrag) == 5:
        return eintrag
    unit, typ_id, anpassungen = eintrag
    typ = typen[typ_id]
    return unit, typ_id, anpassungen, typ[2], typ[3]


def szenario_kennzahlen(name: str):
    """Rechnet V, D und die Honorarrange eines Szenarios unabhaengig aus."""
    s = SZENARIEN[name]
    typen = {t[0]: t for t in s["typen"]}

    positionen = []
    for eintrag in s["einheiten"]:
        _unit, typ_id, anpassungen, innen_j, aussen_j = einheit_mit_flaechen(typen, eintrag)
        _, _, innen_ref, aussen_ref, p_ref = typen[typ_id]
        if p_ref is None:
            return None  # ohne Referenzbewertung entsteht kein Ergebnis (I-24)
        a_ref = flaeche(innen_ref, aussen_ref, ALPHA)
        q_t = p_ref / a_ref
        # eq:flaeche der EINHEIT: erst wenn die Geometrie vom Referenzobjekt abweicht
        # (S6), unterscheidet sich a_j von a_ref und alpha kuerzt sich nicht mehr aus.
        a_j = flaeche(innen_j, aussen_j, ALPHA)
        basispreis = q_t * a_j
        z = sum(f for f, _ in anpassungen)
        positionen.append((basispreis, a_j, runde_auf_rappen(basispreis * (1 + z))))

    v = sum(p for _, _, p in positionen)
    m = len(positionen)
    flaechensumme = sum(a for _, a, _ in positionen)
    basissumme = sum(b for b, _, _ in positionen)
    mittlerer_qm = basissumme / flaechensumme

    rohwerte = {
        "lagescore": s["lagescores"],
        "manuell": s["aufwandfaktoren"],
        "abgeleitet": {"einheitenzahl": m, "mittlererQuadratmeterpreis": mittlerer_qm},
    }
    d = 0.0
    for _fid, quelle, schluessel, gmin, gmax, w in FAKTOREN:
        roh = rohwerte[quelle].get(schluessel)
        if roh is None:
            return None  # fehlender Faktor: kein Ergebnis
        d += w * normalisiere(float(roh), gmin, gmax)

    k, _, basis_min = honorarbasis(v, 1)
    _, _, basis_max = honorarbasis(v, 2)
    g = g_von(d)
    return {
        "V_rappen": v, "m": m, "D": d, "g_D": g, "k": k,
        "mittlerer_qm": mittlerer_qm,
        "H_min_g_rappen": runde_auf_rappen(basis_min * g),
        "H_max_g_rappen": runde_auf_rappen(basis_max * g),
    }


BLATT_SZENARIO = ["szenario_id", "m", "V_rappen", "D", "g_D", "k",
                  "mittlerer_qm_preis_rappen", "H_min_g_rappen", "H_max_g_rappen"]


def schreibe_szenarien() -> list[dict[str, str]]:
    """Schreibt Fixture-JSON je Szenario und die Erwartungs-CSV; liefert Manifesteintraege."""
    ziel_fixtures = WURZEL / "packages" / "core" / "test" / "fixtures" / "scenarios"
    ziel_fixtures.mkdir(parents=True, exist_ok=True)
    eintraege = []
    for name, s in SZENARIEN.items():
        fixture = {
            "szenario_id": name,
            "bezeichnung": s["bezeichnung"],
            "lage": s["lage"],
            "wohnungstypen": [
                {"typ_id": t, "zimmer": z, "A_ref_innen": i, "A_ref_aussen": a,
                 **({} if p is None else {"P_ref_rappen": p})}
                for t, z, i, a, p in s["typen"]
            ],
            "einheiten": [
                {"unit_id": u, "typ_id": t, "A_innen": innen, "A_aussen": aussen,
                 "anpassungen": [{"a_i": f, "begruendung": b} for f, b in ang]}
                for u, t, ang, innen, aussen in (
                    einheit_mit_flaechen({x[0]: x for x in s["typen"]}, e)
                    for e in s["einheiten"])
            ],
            "lagescores": s["lagescores"],
            "aufwandfaktoren": s["aufwandfaktoren"],
            "konfig_ref": "config/company-defaults.json",
            "erwartung_ref": f"reference/{name}-erwartung.csv",
            "lagedaten_herkunft": "synthetisch",
            "zeitstempel": "2026-08-16T10:00:00.000Z",
        }
        (ziel_fixtures / f"{name}.json").write_text(
            json.dumps(fixture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        kennzahlen = szenario_kennzahlen(name)
        pfad = CSV_ZIEL / f"{name}-erwartung.csv"
        with pfad.open("w", newline="", encoding="utf-8") as datei:
            schreiber = csv.writer(datei, lineterminator="\n")
            schreiber.writerow(BLATT_SZENARIO)
            if kennzahlen is None:
                # Kein Ergebnis erwartet; die Zeile haelt das ausdruecklich fest, statt
                # zu fehlen — eine fehlende Datei waere von einem Versehen nicht zu
                # unterscheiden.
                schreiber.writerow([name, len(s["einheiten"]), "", "", "", "", "", "", ""])
            else:
                schreiber.writerow([
                    name, kennzahlen["m"], kennzahlen["V_rappen"], repr(kennzahlen["D"]),
                    repr(kennzahlen["g_D"]), kennzahlen["k"],
                    repr(kennzahlen["mittlerer_qm"]),
                    kennzahlen["H_min_g_rappen"], kennzahlen["H_max_g_rappen"],
                ])
        eintraege.append({
            "blatt": f"{name}-erwartung",
            "csv": f"{name}-erwartung.csv",
            "sha256": hashlib.sha256(pfad.read_bytes()).hexdigest(),
        })
    return eintraege


if __name__ == "__main__":
    schreibe_mappe()
    schreibe_manifest(schreibe_csv() + schreibe_szenarien())
    print(f"Arbeitsmappe: {MAPPE}")
    print(f"CSV und Manifest: {CSV_ZIEL}")
