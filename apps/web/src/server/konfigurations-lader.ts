/**
 * Konfigurationslader (E-26). Liest die firmenweite Berechnungsbasis vom
 * Dateisystem, prueft/bildet sie ueber `parseKonfiguration` auf den Kerntyp ab (PE-01,
 * dieser Lader ruft nur auf), fuehrt projektbezogene Ueberschreibungen zusammen und
 * bildet die SHA-256-Pruefsumme. Dateizugriff/Pruefsumme bleiben hier, weil der Kern
 * weder node:fs noch node:crypto kennen darf (R1). Pruefung weist zurueck BEVOR gerechnet
 * wird (I-21) — kein --force, kein Warnmodus, keine Teiluebernahme.
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
 * `konfigurationsAbdruck` (die eingebettete Kopie der Konfiguration, E-26).
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

/** Prozessweiter Zwischenspeicher; Eintrag wird nur bei erfolgreicher Validierung ersetzt,
 *  scheitert ein Nachladen bleibt die zuletzt gueltige Konfiguration in Kraft. */
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
    // Eine einzige Stelle prueft und bildet ab (PE-01).
    const geparst = parseKonfiguration(roh);
    if (!geparst.ok) {
      // Verletzende Datei wird zurueckgewiesen; ein vorhandener Zwischenspeichereintrag
      // bleibt unangetastet in Kraft.
      return { ok: false, fehler: geparst.fehler };
    }
    basis = geparst.wert.roh;
    kern = geparst.wert.kern;
    zwischenspeicher.set(absolut, { mtimeMs, groesse, basis, kern });
  }

  const zusammengefuehrt = mergeKonfiguration(basis, optionen.ueberschreibungen ?? {});
  if (!zusammengefuehrt.ok) return { ok: false, fehler: zusammengefuehrt.fehler };

  // Nach dem Merge gilt erneut die volle Pruefung (I-21) — eine projektbezogene
  // Uebersteuerung kann eine Invariante verletzen. `parseKonfiguration`
  // statt `validiereKonfiguration`, da es zugleich den Kerntyp der zusammengefuehrten
  // Basis liefert (PE-01). Bewusst UNBEDINGT, nicht nur bei nichtleerem Protokoll.
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
