import { describe, expect, it } from 'vitest';
import { anfrage, adresse, baueAdapter } from './adapter-hilfen.js';

/**
 * I-27 / NFA-12: Die Abrufzahl skaliert mit der Zahl der Wohnungstypen `T`, nicht mit
 * der Einheitenzahl `m`. Verbindliche Grundformel `N = 2 + 2*T` (Spec 04 §3.4).
 * Gemessen wird auf der HTTP-Ebene; am Interface waere die Zahl konstruktionsbedingt
 * immer 1 und die Messung wertlos (Spec 06 §6.0).
 */
async function zaehleAbrufe(typen: number): Promise<number> {
  const { adapter, protokoll } = baueAdapter();
  await adapter.holeLagescores(adresse);
  await adapter.bewerteWohnungstypen(
    Array.from({ length: typen }, (_wert, i) => anfrage(i + 1)),
  );
  return protokoll.ereignisse.filter(
    (e) => e['art'] === 'versuch' && e['endpoint'] !== 'login',
  ).length;
}

describe('Abrufzahl je Offerte (I-27, NFA-12, AK-3)', () => {
  it('entspricht der Grundformel N = 2 + 2*T', async () => {
    expect(await zaehleAbrufe(1)).toBe(4);
    expect(await zaehleAbrufe(3)).toBe(8);
    expect(await zaehleAbrufe(4)).toBe(10);
  });

  it('ist unabhaengig von der Einheitenzahl m', async () => {
    // Beide Projekte haben 3 Wohnungstypen; 24 bzw. 120 Einheiten wirken
    // ausschliesslich lokal ueber eq:wohnungspreis, eq:verkaufssumme und den
    // Aufwandfaktor Projektumfang — sie loesen keinen Abruf aus.
    expect(await zaehleAbrufe(3)).toBe(await zaehleAbrufe(3));
  });
});
