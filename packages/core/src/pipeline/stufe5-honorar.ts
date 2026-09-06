// eq:honorar_mapping — f(V, D) = [H_min(V)*g(D), H_max(V)*g(D)] mit
// H_(V) = H_^(k) + (V - V_k_min)/(V_k_max - V_k_min) * (H_^(k+1) - H_^(k)).
// V waehlt die Stufe, D skaliert das Niveau innerhalb der Stufe. Rundungsstelle R3 liegt
// NACH der Multiplikation mit g(D), getrennt je Randwert (E-09).
// Sonderfaelle: S-08, S-10. S-09 und S-11 sind Ladezeitfaelle und erreichen
// diese Stufe nicht; die Stufenwahl nimmt die erste passende Stufe der aufsteigenden Liste.
import { rundeAufRappen, type Rappen } from '../domain/geld.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import { skalierung } from '../modell/skalierung.js';
import type { Konfiguration } from '../config/typen.js';
import type { GewichtungErgebnis } from './stufe4-gewichtung.js';
import type { VerkaufssummeErgebnis } from './stufe2-verkaufssumme.js';

export interface HonorarErgebnis {
  readonly verkaufssumme: Rappen; // V
  readonly aufwandindikator: number; // D
  readonly stufenindex: number; // k
  readonly stufe: {
    readonly vMin: Rappen;
    readonly vMax: Rappen;
    readonly hMinK: Rappen;
    readonly hMinK1: Rappen;
    readonly hMaxK: Rappen;
    readonly hMaxK1: Rappen;
  };
  readonly interpolationsanteil: number; // t = (V - V_k_min)/(V_k_max - V_k_min)
  readonly basisMin: number; // H_min(V), UNGERUNDET
  readonly basisMax: number; // H_max(V), UNGERUNDET
  readonly skalierung: number; // g(D)
  readonly honorarMin: Rappen; // gerundet (R3)
  readonly honorarMax: Rappen; // gerundet (R3)
}

export function bildeHonorarrange(
  verkauf: VerkaufssummeErgebnis,
  gewichtung: GewichtungErgebnis,
  konfiguration: Konfiguration,
): Result<HonorarErgebnis, StufenFehler> {
  const stuetzstellen = konfiguration.honorar.stuetzstellen;
  const erste = stuetzstellen[0]!;
  const letzte = stuetzstellen[stuetzstellen.length - 1]!;
  const v = verkauf.verkaufssumme;

  if (v < erste.v || v > letzte.v) {
    return fehlschlag(
      stufenFehler(5, 'VERKAUFSSUMME_AUSSERHALB', {
        verkaufssumme: v,
        bereichVon: erste.v,
        bereichBis: letzte.v,
        richtung: v < erste.v ? 'unterhalb' : 'oberhalb',
      }),
    );
  }

  // Stufenwahl: das eindeutige k mit V_k_min <= V < V_k_max. Liegt V exakt auf der
  // letzten Stuetzstelle, wird die letzte Stufe mit t = 1 gerechnet (E-04);
  // eine Extrapolation findet nicht statt.
  let k = stuetzstellen.findIndex((s, i) => i < stuetzstellen.length - 1
    && v >= s.v && v < stuetzstellen[i + 1]!.v);
  if (k === -1) k = stuetzstellen.length - 2;

  const links = stuetzstellen[k]!;
  const rechts = stuetzstellen[k + 1]!;
  if (rechts.v === links.v) {
    return fehlschlag(
      stufenFehler(5, 'STUFE_ENTARTET', { stufenindex: k, wert: links.v }),
    );
  }

  const t = (v - links.v) / (rechts.v - links.v);
  const basisMin = links.hMin + t * (rechts.hMin - links.hMin);
  const basisMax = links.hMax + t * (rechts.hMax - links.hMax);
  const g = skalierung(gewichtung.aufwandindikator, konfiguration.honorar.skalierung);

  return ok({
    verkaufssumme: v,
    aufwandindikator: gewichtung.aufwandindikator,
    stufenindex: k,
    stufe: {
      vMin: links.v, vMax: rechts.v,
      hMinK: links.hMin, hMinK1: rechts.hMin,
      hMaxK: links.hMax, hMaxK1: rechts.hMax,
    },
    interpolationsanteil: t,
    basisMin,
    basisMax,
    skalierung: g,
    honorarMin: rundeAufRappen(basisMin * g), // R3
    honorarMax: rundeAufRappen(basisMax * g), // R3
  });
}
