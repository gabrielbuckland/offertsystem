/**
 * Keine Formel. Beantwortet eine einzige Frage an genau einer Stelle: Welcher Wert gilt
 * fuer diese Spalte an dieser Einheit?
 *
 * Die Rangfolge ist Uebersteuerung vor Regel. Entscheidend ist die ANWESENHEIT des
 * Spaltenwerts, nicht seine Groesse — sonst waere eine bewusste Uebersteuerung auf 0
 * nicht von «nichts erfasst» zu unterscheiden. Ob aus dem wirksamen Wert eine Position
 * wird, entscheidet der Aufrufer (`projektion.ts`): Ein wirksamer Wert 0 ist kein
 * Zu-/Abschlag und wird nicht ausgewiesen.
 *
 * Keine server-seitigen Importe: Diese Datei liegt zwar unter `src/server/`, wird aber
 * spaeter auch aus einer Client-Komponente heraus verwendet, damit die Tabelle den
 * hergeleiteten Wert anzeigen kann. Nur `@offert/core` und Typen aus `projekt-schema.ts`.
 */
import { normalisiereBereiche, werteBereichsregelAus } from '@offert/core';
import type { AnpassungsSpalte, ProjektEinheit } from './projekt-schema.js';

export interface Regelspur {
  readonly merkmal: string;
  readonly merkmalswert: number;
  readonly bereich: number;
  readonly regelwert: number;
}

export interface WirksamerWert {
  readonly wert: number;
  readonly regel?: Regelspur;
  readonly uebersteuert?: boolean;
}

export function ermittleWirksamenWert(
  spalte: AnpassungsSpalte,
  einheit: ProjektEinheit,
): WirksamerWert | undefined {
  const uebersteuerung = einheit.spaltenwerte[spalte.id];

  if (spalte.regel === undefined) {
    return uebersteuerung === undefined ? undefined : { wert: uebersteuerung };
  }

  const merkmalswert = einheit.merkmalswerte[spalte.regel.merkmal];
  if (merkmalswert === undefined) return undefined;

  // `normalisiereBereiche`, nicht die von Zod inferierte Form direkt: Mit
  // `exactOptionalPropertyTypes` infert `z.number().optional()` `unter?: number |
  // undefined`, waehrend `Bereich.unter` im Kern als blosses `unter?: number` gilt.
  // Einzige Transformstelle bleibt der Kern selbst (siehe `bereichsregel.ts`).
  const treffer = werteBereichsregelAus(
    { merkmal: spalte.regel.merkmal, bereiche: normalisiereBereiche(spalte.regel.bereiche) },
    merkmalswert,
  );
  const spur: Regelspur = {
    merkmal: spalte.regel.merkmal,
    merkmalswert,
    bereich: treffer.bereich,
    regelwert: treffer.wert,
  };

  return uebersteuerung === undefined
    ? { wert: treffer.wert, regel: spur }
    : { wert: uebersteuerung, regel: spur, uebersteuert: true };
}
