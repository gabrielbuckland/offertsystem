/**
 * Beantwortet an genau einer Stelle: Welcher Wert gilt fuer diese Spalte an dieser
 * Einheit? Rangfolge ist Uebersteuerung vor Regel. Entscheidend ist die ANWESENHEIT des
 * Spaltenwerts, nicht seine Groesse — sonst waere eine bewusste Uebersteuerung auf 0 nicht
 * von «nichts erfasst» zu unterscheiden.
 *
 * Keine server-seitigen Importe: Diese Datei wird auch aus einer Client-Komponente heraus
 * verwendet (Tabelle zeigt den hergeleiteten Wert), nur `@offert/core` und Typen aus
 * `projekt-schema.ts`.
 */
import { normalisiereBereiche, werteBereichsregelAus } from '@offert/core';
import { leseMerkmalswert } from './eingebaute-merkmale.js';
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

  const merkmalswert = leseMerkmalswert(einheit, spalte.regel.merkmal);
  if (merkmalswert === undefined) {
    // Fehlender Merkmalswert heisst nur: die Regel ist nicht auswertbar — das darf eine
    // bereits erfasste Uebersteuerung nicht schlucken (I-24). Ohne `regel`/`uebersteuert`:
    // es gibt keinen Regelwert, gegen den uebersteuert werden koennte.
    return uebersteuerung === undefined ? undefined : { wert: uebersteuerung };
  }

  // `normalisiereBereiche`, nicht die von Zod inferierte Form direkt: Mit
  // `exactOptionalPropertyTypes` infert Zod `unter?: number | undefined`, der Kern
  // erwartet `unter?: number` (siehe `bereichsregel.ts`).
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
