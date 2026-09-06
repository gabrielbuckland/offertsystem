// eq:aufwandindikator — D = Summe_d w_d * x_dach_d, mit Summe w_d = 1 folgt D in [0, 1].
// D misst die Aufwandintensitaet bei gegebener Verkaufssumme, nicht den absoluten Aufwand
// Die Stufe enthaelt keinen faktorspezifischen Zweig (I-13).
// Sonderfall: S-05.
import type { Gewicht, Score } from '../domain/geld.js';
import type { FaktorId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import { toleranzFuer } from '../config/toleranzen.js';
import type { Konfiguration } from '../config/typen.js';
import { sortiereNachSchluessel } from '../util/sortierung.js';
import type { NormalisierungErgebnis } from './stufe3-normalisierung.js';

export interface Faktorbeitrag {
  readonly faktorId: FaktorId;
  readonly normiert: Score; // x_dach_d
  readonly gewicht: Gewicht; // w_d
  readonly beitrag: number; // w_d * x_dach_d
}

export interface GewichtungErgebnis {
  readonly beitraege: readonly Faktorbeitrag[]; // sortiert nach faktorId
  readonly gewichtssumme: number; // Summe w_d, ausgewiesen
  readonly aufwandindikator: number; // D (wirksam; bei Uebersteuerung deren Wert)
  /**
   * Nur gesetzt, wenn der Vermarkter D uebersteuert hat — die ANWESENHEIT entscheidet,
   * nicht die Groesse. `abgeleitet` haelt den weiterhin berechneten Faktorwert fest,
   * damit Ausweis und Vorschlag erhalten bleiben.
   */
  readonly uebersteuerung?: { readonly abgeleitet: number };
}

export function berechneAufwandindikator(
  normalisierung: NormalisierungErgebnis,
  konfiguration: Konfiguration,
  // In [0,1]; die Bereichspruefung liegt beim Aufrufer — der Kern uebernimmt den Wert
  // unveraendert, wie bei den Vermarkter-Faktorwerten auch.
  uebersteuerung?: number,
): Result<GewichtungErgebnis, StufenFehler> {
  const eintraege = sortiereNachSchluessel(konfiguration.faktoren);
  const gewichtssumme = eintraege.reduce((s, [, p]) => s + p.gewicht, 0);

  // Vorbedingung trotz I-21: der Kern ist auch mit programmatisch konstruierter
  // Konfiguration aufrufbar (Tests, Sensitivitaetsanalyse). D in [0,1] darf davon
  // nicht abhaengen. Es wird NICHT normiert (w_d / Summe w_d) — das machte einen
  // Konfigurationsfehler unsichtbar (S-05).
  const toleranz = toleranzFuer('I-12').wert;
  if (Math.abs(gewichtssumme - 1) > toleranz) {
    return fehlschlag(
      stufenFehler(4, 'GEWICHTSSUMME_UNGUELTIG', {
        summe: gewichtssumme,
        faktoren: eintraege.map(([id, p]) => `${id}|${p.bezeichnung}|${p.gewicht}`),
      }),
    );
  }

  const normiertJeFaktor = new Map(normalisierung.faktoren.map((f) => [f.faktorId, f]));
  const beitraege: Faktorbeitrag[] = [];
  let aufwandindikator = 0;
  for (const [id, parameter] of eintraege) {
    const faktor = normiertJeFaktor.get(id);
    if (faktor === undefined) {
      return fehlschlag(
        stufenFehler(4, 'FAKTOR_FEHLT', {
          faktorId: id, bezeichnung: parameter.bezeichnung, quelle: parameter.quelle,
          quellSchluessel: parameter.quellSchluessel, phase: 'rohwert',
        }, { faktor: id }),
      );
    }
    const beitrag = parameter.gewicht * faktor.normiert;
    beitraege.push({ faktorId: id, normiert: faktor.normiert, gewicht: parameter.gewicht, beitrag });
    aufwandindikator += beitrag; // Summationsreihenfolge: aufsteigend nach faktorId
  }

  // Die Faktoren werden auch bei Uebersteuerung vollstaendig berechnet und ausgewiesen:
  // Der abgeleitete Wert bleibt der nachvollziehbare Vorschlag, der wirksame Wert die
  // Entscheidung des Vermarkters — beide gehoeren in die Herleitung (US-13).
  if (uebersteuerung === undefined) {
    return ok({ beitraege, gewichtssumme, aufwandindikator });
  }
  return ok({
    beitraege,
    gewichtssumme,
    aufwandindikator: uebersteuerung,
    uebersteuerung: { abgeleitet: aufwandindikator },
  });
}
