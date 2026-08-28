// Keine eigene Formel; verkettet eq:flaeche, eq:qm_preis, eq:wohnungspreis,
// eq:verkaufssumme, eq:normalisierung, eq:aufwandindikator und eq:honorar_mapping.
// Reihenfolge 1 -> 2 -> 4.2a -> 3 -> 4 -> 5; sie ist seit E-06 sachlich erzwungen und
// nicht mehr nur aus Determinismusgruenden fixiert (Richtigstellung zu Spec 03 §4.6).
import type { WohnungstypId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import type { StufenFehler } from '../fehler/stufenfehler.js';
import type { Konfiguration } from '../config/typen.js';
import type { Lagescores, Referenzbewertung } from '../ports/valuation-provider.js';
import { bereiteEingabeAuf, type EingangsArgumente } from './stufe1-eingabe.js';
import { berechneVerkaufssumme, type VerkaufssummeErgebnis } from './stufe2-verkaufssumme.js';
import { ergaenzeAbgeleiteteFaktoren } from './stufe2a-abgeleitete.js';
import { normalisiereFaktoren, type NormalisierungErgebnis } from './stufe3-normalisierung.js';
import { berechneAufwandindikator, type GewichtungErgebnis } from './stufe4-gewichtung.js';
import { bildeHonorarrange, type HonorarErgebnis } from './stufe5-honorar.js';

export interface BerechnungsErgebnis {
  readonly verkaufssumme: VerkaufssummeErgebnis;
  readonly normalisierung: NormalisierungErgebnis;
  readonly gewichtung: GewichtungErgebnis;
  readonly honorar: HonorarErgebnis;
  /** Vollstaendig, einschliesslich `anzeige` — Ausweis, nicht Eingabe (E-19). */
  readonly bewertungen: ReadonlyMap<WohnungstypId, Referenzbewertung>;
  readonly lagescores: Lagescores; // inkl. meta (E-08)
  readonly konfigurationsAbdruck: Konfiguration; // NFA-07
  readonly zeitstempel: string; // hereingereicht (E-29)
}

export function berechne(
  eingang: EingangsArgumente,
): Result<BerechnungsErgebnis, StufenFehler> {
  const stufe1 = bereiteEingabeAuf(eingang);
  if (!stufe1.ok) return fehlschlag(stufe1.fehler);

  const stufe2 = berechneVerkaufssumme(stufe1.wert);
  if (!stufe2.ok) return fehlschlag(stufe2.fehler);

  const geschlossen = ergaenzeAbgeleiteteFaktoren(stufe1.wert, stufe2.wert);
  if (!geschlossen.ok) return fehlschlag(geschlossen.fehler);

  const stufe3 = normalisiereFaktoren(geschlossen.wert);
  if (!stufe3.ok) return fehlschlag(stufe3.fehler);

  const stufe4 = berechneAufwandindikator(
    stufe3.wert, eingang.konfiguration, eingang.aufwandindikatorUebersteuerung);
  if (!stufe4.ok) return fehlschlag(stufe4.fehler);

  const stufe5 = bildeHonorarrange(stufe2.wert, stufe4.wert, eingang.konfiguration);
  if (!stufe5.ok) return fehlschlag(stufe5.fehler);

  return ok({
    verkaufssumme: stufe2.wert,
    normalisierung: stufe3.wert,
    gewichtung: stufe4.wert,
    honorar: stufe5.wert,
    bewertungen: stufe1.wert.bewertungen,
    lagescores: eingang.lagescores,
    konfigurationsAbdruck: eingang.konfiguration,
    zeitstempel: eingang.zeitstempel,
  });
}
