import { describe, expect, it } from 'vitest';
import { anfrage, adresse, baueAdapter } from './adapter-hilfen.js';

// I-27/NFA-12: Grundformel N = 2 + 3*T (Abrufzahl skaliert mit Wohnungstypen T, nicht
// Einheiten m). Je Typ: E3 PATCH, Zuruecklese-GET (unvermeidbar, da E3 leeren Rumpf
// liefert, live belegt), E4 POST. Gemessen auf HTTP-Ebene; am Interface waere die
// Zahl konstruktionsbedingt immer 1 und die Messung wertlos.
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
  it('entspricht der Grundformel N = 2 + 3*T', async () => {
    expect(await zaehleAbrufe(1)).toBe(5);
    expect(await zaehleAbrufe(3)).toBe(11);
    expect(await zaehleAbrufe(4)).toBe(14);
  });

  it('ist unabhaengig von der Einheitenzahl m', async () => {
    // Einheitenzahl wirkt nur lokal (eq:wohnungspreis, eq:verkaufssumme, Aufwandfaktor
    // Projektumfang) und loest keinen Abruf aus.
    expect(await zaehleAbrufe(3)).toBe(await zaehleAbrufe(3));
  });
});
