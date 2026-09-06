// eq:flaeche (alpha), eq:wohnungspreis (z-Grenzen), eq:normalisierung (min/max),
// eq:honorar_mapping (Stuetzstellen, g). Ebene 2: rein lokale Praedikate.
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import type { RohKonfiguration } from './schema.js';

const istEndlich = (wert: number): boolean => Number.isFinite(wert);
const istGanzzahl = (wert: number): boolean => Number.isInteger(wert);

export function pruefeEbene2(konfiguration: RohKonfiguration): KonfigurationsFehler[] {
  const befunde: KonfigurationsFehler[] = [];

  // I-04 — alpha in [0,1]
  const alpha = konfiguration.flaeche.alpha;
  if (!istEndlich(alpha) || alpha < 0 || alpha > 1) {
    befunde.push(fehler('CFG_ALPHA_RANGE', 'flaeche.alpha', { wert: alpha }));
  }

  // I-06 / I-07 — -1 < zMin <= 0 <= zMax
  const p = konfiguration.preisanpassung;
  if (!istEndlich(p.zMin) || !istEndlich(p.zMax)
      || !(p.zMin > -1 && p.zMin <= 0 && p.zMax >= 0 && p.zMin <= p.zMax)) {
    befunde.push(fehler('CFG_ADJUSTMENT_BOUNDS', 'preisanpassung', {
      zMin: p.zMin,
      zMax: p.zMax,
      bedingung: '-1 < zMin <= 0 <= zMax',
    }));
  }
  if (!istGanzzahl(p.begruendungMinLaenge) || p.begruendungMinLaenge < 1) {
    befunde.push(fehler('CFG_REASON_MIN_LENGTH', 'preisanpassung.begruendungMinLaenge', {
      wert: p.begruendungMinLaenge,
      bedingung: 'Ganzzahl >= 1',
    }));
  }

  // I-12 (Gewichte) und eq:normalisierung (Grenzen) je Faktor
  for (const [name, faktor] of Object.entries(konfiguration.aufwandfaktoren)) {
    if (!istEndlich(faktor.gewicht) || faktor.gewicht < 0 || faktor.gewicht > 1) {
      befunde.push(fehler('CFG_WEIGHT_RANGE', `aufwandfaktoren.${name}.gewicht`, {
        faktor: name,
        wert: faktor.gewicht,
      }));
    }
    // min > max ist KEIN Fehler, sondern die dokumentierte Invertierung.
    // Erzwungen wird nur min !== max, sonst Division durch null in eq:normalisierung.
    if (!istEndlich(faktor.min) || !istEndlich(faktor.max) || faktor.min === faktor.max) {
      befunde.push(fehler('CFG_NORM_BOUNDS', `aufwandfaktoren.${name}`, {
        faktor: name,
        min: faktor.min,
        max: faktor.max,
      }));
    }
  }

  // Preiskette: Stuetzstellen in ganzzahligen Rappen, Honorare > 0
  konfiguration.honorar.stuetzstellen.forEach((stuetzstelle, index) => {
    if (!istGanzzahl(stuetzstelle.v) || stuetzstelle.v < 0) {
      befunde.push(fehler('CFG_TIER_VALUE_RANGE', `honorar.stuetzstellen[${index}].v`, {
        stufe: index, feld: 'v', wert: stuetzstelle.v, bedingung: 'Ganzzahl >= 0 (Rappen)',
      }));
    }
    for (const feld of ['hMin', 'hMax'] as const) {
      const wert = stuetzstelle[feld];
      if (!istGanzzahl(wert) || wert <= 0) {
        befunde.push(fehler('CFG_TIER_VALUE_RANGE', `honorar.stuetzstellen[${index}].${feld}`, {
          stufe: index, feld, wert, bedingung: 'Ganzzahl > 0 (Rappen)',
        }));
      }
    }
  });

  // I-16, Einzelbedingungen (die Ordnung prueft Ebene 3)
  const g = konfiguration.honorar.skalierung;
  if (!istEndlich(g.gMin) || !(g.gMin > 0 && g.gMin <= 1)) {
    befunde.push(fehler('CFG_G_RANGE', 'honorar.skalierung.gMin', {
      gMin: g.gMin, gMax: g.gMax, bedingung: '0 < gMin <= 1',
    }));
  }
  if (!istEndlich(g.gMax) || !(g.gMax >= 1)) {
    befunde.push(fehler('CFG_G_RANGE', 'honorar.skalierung.gMax', {
      gMin: g.gMin, gMax: g.gMax, bedingung: 'gMax >= 1',
    }));
  }

  // Zugriffsschicht: konfigurierbar, nicht kodiert (E-13, NFA-04)
  const a = konfiguration.api;
  const apiPruefungen: ReadonlyArray<readonly [string, number, boolean, string]> = [
    ['api.timeoutMs', a.timeoutMs, istGanzzahl(a.timeoutMs) && a.timeoutMs > 0, 'Ganzzahl > 0'],
    ['api.timeoutValuationMs', a.timeoutValuationMs,
      istGanzzahl(a.timeoutValuationMs) && a.timeoutValuationMs > 0, 'Ganzzahl > 0'],
    ['api.gesamtbudgetMs', a.gesamtbudgetMs,
      istGanzzahl(a.gesamtbudgetMs) && a.gesamtbudgetMs > 0, 'Ganzzahl > 0'],
    ['api.retry.maxVersuche', a.retry.maxVersuche,
      istGanzzahl(a.retry.maxVersuche) && a.retry.maxVersuche >= 1, 'Ganzzahl >= 1'],
    ['api.retry.startBackoffMs', a.retry.startBackoffMs,
      istGanzzahl(a.retry.startBackoffMs) && a.retry.startBackoffMs > 0, 'Ganzzahl > 0'],
    ['api.retry.backoffFaktor', a.retry.backoffFaktor,
      istEndlich(a.retry.backoffFaktor) && a.retry.backoffFaktor >= 1, '>= 1'],
    ['api.retry.maxBackoffMs', a.retry.maxBackoffMs,
      istGanzzahl(a.retry.maxBackoffMs) && a.retry.maxBackoffMs > 0, 'Ganzzahl > 0'],
    ['api.retry.retryAfterMaxSekunden', a.retry.retryAfterMaxSekunden,
      istGanzzahl(a.retry.retryAfterMaxSekunden) && a.retry.retryAfterMaxSekunden > 0, 'Ganzzahl > 0'],
    ['api.tokenGueltigkeitMin', a.tokenGueltigkeitMin,
      istGanzzahl(a.tokenGueltigkeitMin) && a.tokenGueltigkeitMin > 0, 'Ganzzahl > 0'],
    // PE-06: Die Marge ist die Vorlaufzeit, um die ein Token vor Ablauf erneuert
    // wird. Erreicht sie die Gueltigkeitsdauer, waere jedes Token sofort als
    // abgelaufen zu behandeln und die Erneuerung liefe endlos.
    ['api.tokenSicherheitsmargeMin', a.tokenSicherheitsmargeMin,
      istGanzzahl(a.tokenSicherheitsmargeMin)
      && a.tokenSicherheitsmargeMin >= 0
      && a.tokenSicherheitsmargeMin < a.tokenGueltigkeitMin,
      '0 <= marge < tokenGueltigkeitMin'],
  ];
  for (const [pfad, wert, erfuellt, bedingung] of apiPruefungen) {
    if (!erfuellt) befunde.push(fehler('CFG_API_PARAM', pfad, { wert, bedingung }));
  }

  // Vorlagen: Endlichkeit hier, Abgleich gegen [zMin, zMax] erst auf Ebene 3
  konfiguration.anpassungsVorlagen.forEach((vorlage, index) => {
    if (!istEndlich(vorlage.vorgabefaktor)) {
      befunde.push(fehler('CFG_TEMPLATE_BOUNDS', `anpassungsVorlagen[${index}].vorgabefaktor`, {
        bezeichnung: vorlage.bezeichnung,
        wert: String(vorlage.vorgabefaktor),
        bedingung: 'endliche Zahl',
      }));
    }
  });

  return befunde;
}
