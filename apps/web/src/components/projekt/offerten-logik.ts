// Reine Logik von `ProjektOfferten.tsx`, getrennt von der Darstellung, damit sie ohne
// Rendering testbar ist.
import { formatiereHonorarProzent } from '@offert/offer/src/format/de-ch.js';
import { berechneHonorarProzent } from '@offert/offer/src/model/honorar-eingabe.js';
import type { ListenEintrag } from '../../server/offerten-ablage.js';

// Dieselbe Kuerzung wie im Dateinamen (`dateinameFuer` in `offerten-ablage.ts`, Spec 05
// §2/§8): die Kennung dient nur der Unterscheidung mehrerer Offerten desselben Tages.
export function referenzAus(offertId: string): string {
  return offertId.slice(0, 8);
}

/**
 * Honorar-Spalte als Prozentsatz der Verkaufssumme (Spec 2026-08-29), analog dem
 * Offertdokument: gewaehlter Betrag statt Range, wenn vorhanden (siehe
 * `offerten-ablage.ts`); sonst die Range der Herleitung. `–`, wenn die Verkaufssumme im
 * Listeneintrag fehlt oder keine sinnvolle Bezugsgroesse ist (Division durch null).
 */
export function honorarProzentZelle(
  e: Pick<ListenEintrag, 'honorar' | 'honorarMin' | 'honorarMax' | 'verkaufssumme'>,
): string {
  const prozent = (betragRappen: number): string => {
    if (e.verkaufssumme === undefined) return '–';
    const anteil = berechneHonorarProzent(betragRappen, e.verkaufssumme);
    return anteil === null ? '–' : formatiereHonorarProzent(anteil);
  };
  if (e.honorar !== undefined) return prozent(e.honorar);
  if (e.honorarMin === undefined || e.honorarMax === undefined) return '—';
  return `${prozent(e.honorarMin)} – ${prozent(e.honorarMax)}`;
}
