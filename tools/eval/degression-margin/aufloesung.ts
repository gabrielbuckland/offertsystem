/**
 * Analytische Aufloesung von eq:netto_degression nach je einem Parameter.
 *
 * Gesucht ist jeweils der Wert, bei dem M = 1 gilt, also L = R — mit den uebrigen
 * Parametern fest. Ein nicht positiver Nenner bedeutet: Die Verletzung ist ueber diesen
 * Parameter UNERREICHBAR. Das ist ein aussagekraeftiges Ergebnis und wird als solches
 * ausgegeben, nicht als fehlender Wert.
 */
export interface Aufloesung {
  readonly parameter: string;
  readonly istwert: number;
  readonly zielwert: number | null;
  readonly relative_variation: number | null;
  readonly erreichbar: boolean;
  readonly unerreichbar_im_variationsbereich: boolean;
  readonly grund: string | null;
}

/** 6.5 laesst Variationen von +/- 20 Prozent zu. */
export const VARIATIONSBEREICH = 0.20;

function fasse(
  parameter: string, istwert: number, zielwert: number | null, grund: string | null,
): Aufloesung {
  if (zielwert === null || !Number.isFinite(zielwert)) {
    return {
      parameter, istwert, zielwert: null, relative_variation: null,
      erreichbar: false, unerreichbar_im_variationsbereich: true,
      grund: grund ?? 'unerreichbar: keine endliche Loesung',
    };
  }
  const eps = zielwert / istwert - 1;
  return {
    parameter, istwert, zielwert, relative_variation: eps, erreichbar: true,
    unerreichbar_im_variationsbereich: Math.abs(eps) > VARIATIONSBEREICH, grund: null,
  };
}

/** (a) Spanne S = gMax - gMin, gMin fest. */
export function loeseSpanne(e: {
  gMin: number; spanne: number; d1: number; d2: number; r: number;
}): Aufloesung {
  const nenner = e.d2 - e.r * e.d1;
  if (nenner <= 0) {
    return fasse('honorar.skalierung.spanne', e.spanne, null,
      'unerreichbar: D2 - R*D1 ist nicht positiv');
  }
  return fasse('honorar.skalierung.spanne', e.spanne, (e.gMin * (e.r - 1)) / nenner, null);
}

/** (b) Gewicht des Aufwandfaktors Projektumfang, Spanne fest. */
export function loeseUmfangsgewicht(e: {
  gMin: number; spanne: number; w: number; x1: number; x2: number; r: number;
}): Aufloesung {
  const nenner = e.spanne * (e.x2 - e.r * e.x1);
  if (nenner <= 0) {
    return fasse('aufwandfaktor.projektumfang.gewicht', e.w, null,
      'unerreichbar: x2 - R*x1 ist nicht positiv');
  }
  const ziel = (e.gMin * (e.r - 1)) / nenner;
  if (ziel >= 1) {
    return fasse('aufwandfaktor.projektumfang.gewicht', e.w, null,
      'unerreichbar wegen Gewichtssumme: w* >= 1 verletzt Sigma w = 1 (I-12)');
  }
  return fasse('aufwandfaktor.projektumfang.gewicht', e.w, ziel, null);
}

/**
 * (c) einparametrige Stuetzstellenfamilie H_theta(V) = H0 + (1+theta)(H(V) - H0).
 *
 * Der Istwert ist 1, weil u = 1 + theta und theta = 0 die unveraenderte Konfiguration
 * ist; `relative_variation` ist damit unmittelbar theta*.
 *
 * `unerreichbar` heisst hier NICHT «kein Einfluss der Stuetzstellen», sondern: Die
 * Degression wird in dieser Konfiguration nicht allein vom Grundhonorar getragen,
 * sondern auch von den fallenden Grenzsaetzen.
 */
export function loeseStuetzstellen(e: {
  h0: number; a1: number; a2: number; lambda: number; l: number;
}): Aufloesung {
  const nenner = e.lambda * e.a1 - e.l * e.a2;
  if (nenner === 0) {
    return fasse('honorar.stuetzstellen.familie', 1, null,
      'unerreichbar: Nenner der Familienaufloesung ist null');
  }
  const u = (e.h0 * (e.l - e.lambda)) / nenner;
  if (u <= 0) {
    return fasse('honorar.stuetzstellen.familie', 1, null,
      'unerreichbar: die Degression wird nicht allein vom Grundhonorar getragen');
  }
  return fasse('honorar.stuetzstellen.familie', 1, u, null);
}

/** Der betragsmaessig kleinste erreichbare Variationsbedarf. */
export function kritischerParameter(aufloesungen: readonly Aufloesung[]): string | null {
  const erreichbare = aufloesungen.filter(
    (a) => a.erreichbar && a.relative_variation !== null);
  if (erreichbare.length === 0) return null;
  return erreichbare.reduce((best, a) =>
    Math.abs(a.relative_variation!) < Math.abs(best.relative_variation!) ? a : best,
  ).parameter;
}
