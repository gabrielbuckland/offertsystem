import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { berechneNettoDegression, validiereKonfiguration } from '@offert/core';

const PFAD = resolve(import.meta.dirname, '../../../config/company-defaults.json');
const roh: unknown = JSON.parse(readFileSync(PFAD, 'utf8'));

describe('Standardkonfiguration', () => {
  it('besteht alle drei Pruefebenen', () => {
    const ergebnis = validiereKonfiguration(roh);
    if (!ergebnis.ok) {
      throw new Error(`Standardkonfiguration ungueltig: ${JSON.stringify(ergebnis.fehler, null, 2)}`);
    }
    expect(ergebnis.ok).toBe(true);
  });

  it('erfuellt die Summenbedingung exakt, ohne Toleranzausschoepfung', () => {
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const summe = Object.values(ergebnis.wert.aufwandfaktoren)
      .reduce((wert, faktor) => wert + faktor.gewicht, 0);
    expect(summe).toBe(1);
  });

  it('fuehrt sechs Honorarstufen mit abschliessender Stuetzstelle bei 200 Mio. CHF', () => {
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const stuetzstellen = ergebnis.wert.honorar.stuetzstellen;
    expect(stuetzstellen).toHaveLength(7);
    expect(stuetzstellen.at(-1)?.v).toBe(20000000000);
  });

  it('erfuellt die Netto-Degression ohne Reichweitengrenze im konfigurierten Bereich', () => {
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const befund = berechneNettoDegression(ergebnis.wert);
    expect(befund?.verletzendesV).toBeUndefined();
    expect(befund?.kleinsteMarge).toBeGreaterThan(0.4);
  });

  it('fuehrt die Preissegment-Grenzen in Rappen je Quadratmeter', () => {
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const faktor = ergebnis.wert.aufwandfaktoren['preissegment'];
    expect(faktor?.min).toBe(600000);
    expect(faktor?.max).toBe(1800000);
  });

  it('fuehrt den Faktor projektumfang auf den Quellschluessel einheitenzahl', () => {
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const faktor = ergebnis.wert.aufwandfaktoren['projektumfang'];
    expect(faktor?.quellSchluessel).toBe('einheitenzahl');
    expect(faktor?.quelle).toBe('abgeleitet');
  });

  it('haelt die Stufenbeschriftungen des Innenausbaus in der Konfiguration', () => {
    const ergebnis = validiereKonfiguration(roh);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const skala = ergebnis.wert.aufwandfaktoren['innenausbau_qualitaet']?.skala;
    expect(skala?.form).toBe('ordinal');
    expect(skala?.stufen).toHaveLength(6);
    expect(skala?.stufen.at(-1)?.bezeichnung).toBe('Luxus');
  });
});
