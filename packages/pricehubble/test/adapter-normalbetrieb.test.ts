import type { WohnungstypId } from '@offert/core';
import { describe, expect, it } from 'vitest';
import { adresse, anfrage, baueAdapter } from './adapter-hilfen.js';

describe('Normalbetrieb — Szenario 1 auf HTTP-Ebene (Spec 06 §6.1)', () => {
  it('liefert je Wohnungstyp eine Referenzbewertung mit gueltigen Kerntypen', async () => {
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.vollstaendig).toBe(true);
    expect(ergebnis.wert.bewertungen.size).toBe(2);
    const erste = ergebnis.wert.bewertungen.get('t-1' as WohnungstypId);
    expect(erste).toMatchObject({
      marktwert: 97_100_000,
      anbieter: 'pricehubble',
      bewertungsdatum: '2026-03-27',
    });
    expect(erste?.parametrisierungsAbdruck.flaecheInnen).toBe(70);
  });

  it('heftet je Typ den eigenen gesendeten Parameterstand an (AK-20)', async () => {
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    if (!ergebnis.ok) throw new Error('unerwartet');
    expect(
      ergebnis.wert.bewertungen.get('t-2' as WohnungstypId)?.parametrisierungsAbdruck.stockwerk,
    ).toBe(2);
  });

  it('liefert die neun Lagescores ueber holeLagescores', async () => {
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.holeLagescores(adresse);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.werte.size).toBe(9);
    expect(ergebnis.wert.anbieter).toBe('pricehubble');
  });

  it('haelt die Typen-Durchlaeufe streng sequenziell', async () => {
    const { adapter, protokoll } = baueAdapter();
    await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2), anfrage(3)]);
    const folge = protokoll.ereignisse
      .filter((e) => e['art'] === 'versuch')
      .map((e) => e['endpoint'] as string)
      .filter((e) => e === 'dossierUpdate' || e === 'dossierValuation');
    expect(folge).toEqual([
      'dossierUpdate',
      'dossierValuation',
      'dossierUpdate',
      'dossierValuation',
      'dossierUpdate',
      'dossierValuation',
    ]);
  });
});
