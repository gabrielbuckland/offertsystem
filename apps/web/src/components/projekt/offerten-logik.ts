import { formatiereHonorarProzent, berechneHonorarProzent } from '@offert/offer';
import type { ListenEintrag } from '../../server/offerten-ablage.js';

// Dieselbe Kuerzung wie im Dateinamen (dateinameFuer in offerten-ablage.ts).
export function referenzAus(offertId: string): string {
  return offertId.slice(0, 8);
}

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
