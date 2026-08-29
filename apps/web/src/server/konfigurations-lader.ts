/**
 * Konfigurationslader (Spec 02 §6, E-26).
 * Liest die firmenweite Berechnungsbasis vom Dateisystem, laesst sie von
 * `parseKonfiguration` pruefen und auf den Kerntyp abbilden, fuehrt die
 * projektbezogenen Ueberschreibungen zusammen und bildet die SHA-256-Pruefsumme
 * der effektiven Konfiguration.
 *
 * ZUSTAENDIGKEIT (PE-01): Die Abbildung Rohform -> Kerntyp gehoert dem Kern und
 * wird von P2 gebaut; hier wird sie AUFGERUFEN. Dateizugriff und Pruefsumme
 * bleiben hier, weil der Kern weder node:fs noch node:crypto kennen darf (R1).
 *
 * Die Pruefung laeuft beim Laden und weist zurueck, BEVOR gerechnet wird (I-21).
 * Es gibt keinen --force-Pfad, keinen Warnmodus und keine Teiluebernahme.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fehler,
  mergeKonfiguration,
  parseKonfiguration,
  type EffektiveKonfiguration,
  type Konfiguration,
  type KonfigurationsFehler,
  type OffertKonfiguration,
  type RohApiKonfiguration,
  type UeberschreibungsProtokoll,
} from '@offert/core';
import { bildePruefsumme } from './kanonisch.js';

export interface LadeOptionen {
  readonly pfad: string;
  readonly ueberschreibungen?: unknown;
}

/**
 * Kurzausweis des Konfigurationsstands (PE-04). NICHT zu verwechseln mit
 * `konfigurationsAbdruck`: So heisst projektweit die EINGEBETTETE KOPIE der
 * Konfiguration, die E-26 verlangt und aus der US-10 und US-13 den Nachvollzug
 * ziehen. Hier steht nur der Ausweis; die Pruefsumme traegt das eigene Feld
 * `konfigPruefsumme`, gegen das der Evaluationsplan prueft.
 */
export interface KonfigurationsFingerabdruck {
  readonly konfigVersion: string;
  readonly schemaVersion: number;
  readonly konfigPruefsumme: string;
  readonly ueberschreibungen: readonly UeberschreibungsProtokoll[];
}

export type LadeErgebnis =
  | {
      readonly ok: true;
      readonly konfiguration: EffektiveKonfiguration;
      /** Kerntyp aus parseKonfiguration; Eingang der Pipeline. */
      readonly kern: Konfiguration;
      /** Unveraenderter api-Rohblock fuer den Adapter (PE-17). */
      readonly api: RohApiKonfiguration;
      readonly fingerabdruck: KonfigurationsFingerabdruck;
    }
  | { readonly ok: false; readonly fehler: readonly KonfigurationsFehler[] };

interface ZwischenspeicherEintrag {
  readonly mtimeMs: number;
  readonly groesse: number;
  readonly basis: OffertKonfiguration;
  readonly kern: Konfiguration;
}

/**
 * Prozessweiter Zwischenspeicher. Die zuletzt gueltige Konfiguration bleibt in
 * Kraft, wenn ein Nachladen scheitert: Der Eintrag wird nur bei erfolgreicher
 * Validierung ersetzt.
 */
const zwischenspeicher = new Map<string, ZwischenspeicherEintrag>();

export function leereZwischenspeicher(): void {
  zwischenspeicher.clear();
}

function dateifehler(pfad: string, erhalten: string): KonfigurationsFehler[] {
  return [fehler('CFG_SCHEMA_TYPE', '(datei)', {
    pfad,
    erwartet: 'lesbare JSON-Datei mit einem Objekt an der Wurzel',
    erhalten,
  })];
}

export function ladeKonfiguration(optionen: LadeOptionen): LadeErgebnis {
  const absolut = resolve(optionen.pfad);

  let mtimeMs: number;
  let groesse: number;
  try {
    const merkmale = statSync(absolut);
    mtimeMs = merkmale.mtimeMs;
    groesse = merkmale.size;
  } catch {
    return { ok: false, fehler: dateifehler(absolut, 'Datei nicht vorhanden oder nicht lesbar') };
  }

  const gemerkt = zwischenspeicher.get(absolut);
  const gueltig =
    gemerkt !== undefined && gemerkt.mtimeMs === mtimeMs && gemerkt.groesse === groesse
      ? gemerkt
      : undefined;

  let basis: OffertKonfiguration;
  let kern: Konfiguration;

  if (gueltig !== undefined) {
    basis = gueltig.basis;
    kern = gueltig.kern;
  } else {
    let roh: unknown;
    try {
      roh = JSON.parse(readFileSync(absolut, 'utf8'));
    } catch {
      return { ok: false, fehler: dateifehler(absolut, 'kein gueltiges JSON') };
    }
    // Eine einzige Stelle prueft und bildet ab (PE-01). Der Lader baut die
    // Abbildung nicht nach; taete er es, gaebe es zwei Wahrheiten darueber,
    // was 'minmax' im Kern bedeutet.
    const geparst = parseKonfiguration(roh);
    if (!geparst.ok) {
      // Die verletzende Datei wird zurueckgewiesen und wird nicht aktiv; ein
      // vorhandener Zwischenspeichereintrag bleibt unangetastet in Kraft.
      return { ok: false, fehler: geparst.fehler };
    }
    // `parseKonfiguration` liefert beides in einem Traeger (KonfigurationsAbbildung);
    // der Plan notierte hier noch `geparst.roh`/`geparst.wert` einer aelteren Fassung.
    basis = geparst.wert.roh;
    kern = geparst.wert.kern;
    zwischenspeicher.set(absolut, { mtimeMs, groesse, basis, kern });
  }

  const zusammengefuehrt = mergeKonfiguration(basis, optionen.ueberschreibungen ?? {});
  if (!zusammengefuehrt.ok) return { ok: false, fehler: zusammengefuehrt.fehler };

  // Regel 5 aus Spec 02 §2.3: Nach dem Merge gilt erneut die volle Pruefung — und seit
  // die Sperrliste nur noch meta/api umfasst, ist sie TRAGEND statt zieren: Eine
  // projektbezogene Uebersteuerung kann eine Invariante verletzen, und genau hier wird
  // sie zurueckgewiesen, bevor gerechnet wird (I-21).
  //
  // `parseKonfiguration` statt `validiereKonfiguration`: Es prueft dieselben drei Ebenen
  // UND liefert den Kerntyp der zusammengefuehrten Basis. Zwei getrennte Aufrufe haetten
  // zwei Wahrheiten darueber ergeben, was der Kern aus der effektiven Konfiguration
  // liest (PE-01). Bewusst UNBEDINGT und nicht nur bei nichtleerem Protokoll: Ein
  // bedingtes Ueberspringen waere genau der stille Pfad, den I-21 ausschliesst.
  const nachgeparst = parseKonfiguration(zusammengefuehrt.wert.basis);
  if (!nachgeparst.ok) return { ok: false, fehler: nachgeparst.fehler };

  const effektiv = zusammengefuehrt.wert;
  const fingerabdruck: KonfigurationsFingerabdruck = {
    konfigVersion: effektiv.basis.meta.konfigVersion,
    schemaVersion: effektiv.basis.meta.schemaVersion,
    konfigPruefsumme: bildePruefsumme({
      basis: effektiv.basis,
      dossierParameter: effektiv.dossierParameter,
      preisanpassungen: effektiv.preisanpassungen,
    }),
    ueberschreibungen: effektiv.ueberschreibungen,
  };

  return {
    ok: true,
    konfiguration: effektiv,
    kern: nachgeparst.wert.kern,
    // PE-17: Der Rohblock geht unveraendert an die Zugriffsschicht weiter, die
    // ihn beim Erzeugen des Adapters uebergibt. Der Kern kennt ihn nicht.
    api: effektiv.basis.api,
    fingerabdruck,
  };
}
