#!/usr/bin/env python3
"""Erzeugt Szenario-Fixtures (T2) und unabhaengig gerechnete Erwartungswerte: Formeln aus
Kapitel 3.3 (eq:flaeche, eq:qm_preis, eq:wohnungspreis, eq:verkaufssumme, eq:normalisierung,
eq:aufwandindikator, eq:honorar_mapping) auf einem zweiten, von packages/core getrennten
Rechenweg in Python neu implementiert; kein Import aus packages/core.

Rundung: kaufmaennisch, halbe Betraege vom Nullpunkt weg (E-10), am Wohnungspreis (R2) und
in der Honorarkette nach der Multiplikation mit g(D) (R3); q_t, basispreis, basisMin und
basisMax bleiben ungerundet.

Aufruf: python3 tools/referenz/referenzmappe.py
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
CSV_ZIEL = WURZEL / "packages" / "core" / "test" / "fixtures" / "reference"

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
    """Kaufmaennisch, halbe Betraege vom Nullpunkt weg (E-10)."""
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


def schreibe_manifest(eintraege: list[dict[str, str]]) -> None:
    manifest = {
        "erzeuger": "tools/referenz/referenzmappe.py",
        "exportdatum": "2026-08-16",
        "unabhaengigkeit": (
            "Die Referenzwerte entstehen auf einem zweiten, vom Produktivcode getrennten "
            "Rechenweg: Das Erzeugerskript ist Python, importiert nichts aus packages/core "
            "und fuehrt die Formeln aus Kapitel 3.3 eigenstaendig aus."
        ),
        "einschraenkung": (
            "Die Unabhaengigkeit ist ueber den getrennten Rechenweg belegt, nicht ueber die "
            "Versionsgeschichte (kein separates Commit-Paar). Wer die zeitliche "
            "Unabhaengigkeit beweisen will, muss die Erwartungswerte vor der naechsten "
            "Modellaenderung erneut erzeugen und den Commit vor der Aenderung setzen."
        ),
        "commitPaar": None,
        "blaetter": eintraege,
    }
    (CSV_ZIEL / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# Szenarien (T2): Wohnungstypen (Referenzflaechen/-wert), Einheiten als 3-Tupel (erben die
# Referenzflaechen, I-05 beobachtbar) oder 5-Tupel (abweichende Geometrie, S6/F-061),
# Lagescores, Aufwandfaktoren. Erwartungswerte ueber eq:wohnungspreis/eq:verkaufssumme (V),
# eq:normalisierung/eq:aufwandindikator (D), eq:honorar_mapping (Honorarrange).

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
        # In S1-S4b tragen alle Einheiten die Referenzgeometrie ihres Typs, alpha kuerzt
        # sich aus eq:wohnungspreis und D2 zeigt ueberall 0 (F-061). S6 laesst die Geometrie
        # bewusst abweichen, damit die alpha-Wirkung in der Sensitivitaetsanalyse messbar wird.
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
    # 3-Tupel erben die Referenzflaechen ihres Typs (I-05 beobachtbar); 5-Tupel fuehren
    # die Geometrie explizit (S6, F-061).
    if len(eintrag) == 5:
        return eintrag
    unit, typ_id, anpassungen = eintrag
    typ = typen[typ_id]
    return unit, typ_id, anpassungen, typ[2], typ[3]


def szenario_kennzahlen(name: str):
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
        # eq:flaeche der Einheit: erst bei abweichender Geometrie (S6) unterscheidet sich
        # a_j von a_ref und alpha kuerzt sich nicht mehr aus.
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
                # Kein Ergebnis erwartet; Zeile haelt das fest statt zu fehlen (fehlende
                # Datei waere von einem Versehen nicht zu unterscheiden).
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
    schreibe_manifest(schreibe_szenarien())
    print(f"CSV und Manifest: {CSV_ZIEL}")
