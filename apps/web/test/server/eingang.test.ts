import { describe, expect, it, vi } from 'vitest';
import type {
  BewertungsBuendel,
  Lagescores,
  ProviderFehler,
  Referenzbewertung,
  ValuationProvider,
  WohnungstypId,
} from '@offert/core';
import { beschaffe, zuEingangsArgumenten } from '../../src/server/eingang.js';
import type { Erfassung } from '../../src/server/erfassung-schema.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const PROVIDER_FEHLER: ProviderFehler = {
  art: 'nicht_erreichbar',
  detail: 'Der Bewertungsdienst ist derzeit nicht erreichbar.',
  diagnose: { endpoint: 'location.scores', versuche: 3, dauerMs: 900 },
};

const BEISPIEL_ERFASSUNG = {
  projekt: { referenznummer: 'A-2026-014' },
  liegenschaft: {
    adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
  },
  wohnungstypen: [{
    id: 'T-3.5',
    zimmerzahl: 3.5,
    parametrisierung: {
      flaecheInnen: 82, flaecheAussen: 12, stockwerk: 2, energielabel: 'A',
      zustandsbewertungen: {}, qualitaetsbewertungen: {},
      anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'Waermepumpe',
    },
  }],
  einheiten: [{
    wohnungsnummer: 'A1.01', wohnungstypId: 'T-3.5', flaecheInnen: 82, flaecheAussen: 12,
    stockwerk: 1, anpassungen: [],
  }],
  aufwandfaktoren: { innenausbau_qualitaet: 4 },
} as unknown as Erfassung;

const BEWERTUNG: Referenzbewertung = {
  wohnungstypId: 'T-3.5' as WohnungstypId,
  marktwert: 85_000_000 as Referenzbewertung['marktwert'],
  bewertungsdatum: '2026-08-16',
  anbieter: 'PriceHubble',
  parametrisierungsAbdruck: BEISPIEL_ERFASSUNG.wohnungstypen[0]!
    .parametrisierung as Referenzbewertung['parametrisierungsAbdruck'],
  anzeige: {
    konfidenzbereich: {
      von: 80_000_000 as Referenzbewertung['marktwert'],
      bis: 90_000_000 as Referenzbewertung['marktwert'],
    },
    konfidenzklasse: 'good',
  },
};

const LAGESCORES: Lagescores = {
  werte: new Map(),
  meta: new Map(),
  abrufdatum: '2026-08-16',
  anbieter: 'PriceHubble',
};

function providerAttrappe(
  optionen: { lagescoresFehler?: ProviderFehler; vollstaendig?: boolean } = {},
) {
  const buendel: BewertungsBuendel = {
    vollstaendig: optionen.vollstaendig ?? true,
    bewertungen: new Map([['T-3.5' as WohnungstypId, BEWERTUNG]]),
  };
  const holeLagescores = vi.fn().mockResolvedValue(
    optionen.lagescoresFehler === undefined
      ? { ok: true, wert: LAGESCORES }
      : { ok: false, fehler: optionen.lagescoresFehler },
  );
  const bewerteWohnungstypen = vi.fn().mockResolvedValue({ ok: true, wert: buendel });
  return { holeLagescores, bewerteWohnungstypen } as unknown as ValuationProvider & {
    holeLagescores: ReturnType<typeof vi.fn>;
    bewerteWohnungstypen: ReturnType<typeof vi.fn>;
  };
}

describe('Beschaffung (PE-22)', () => {
  it('holt die Lagescores genau einmal je Liegenschaft, vor dem Pipeline-Start', async () => {
    const provider = providerAttrappe();
    await beschaffe(BEISPIEL_ERFASSUNG, provider);
    expect(provider.holeLagescores).toHaveBeenCalledTimes(1);
    expect(provider.holeLagescores)
      .toHaveBeenCalledWith(BEISPIEL_ERFASSUNG.liegenschaft.adresse);
    expect(provider.bewerteWohnungstypen).toHaveBeenCalledTimes(1);
  });

  it('bricht ab, wenn die Lagescores fehlen, statt EingangsArgumente unvollstaendig zu bauen', async () => {
    const provider = providerAttrappe({ lagescoresFehler: PROVIDER_FEHLER });
    const ergebnis = await beschaffe(BEISPIEL_ERFASSUNG, provider);
    expect(ergebnis.ok).toBe(false);
    expect(provider.bewerteWohnungstypen).not.toHaveBeenCalled();
  });

  it('reicht vollstaendig aus dem Buendel in die EingangsArgumente durch (PE-23)', async () => {
    const provider = providerAttrappe({ vollstaendig: false });
    const beschafft = await beschaffe(BEISPIEL_ERFASSUNG, provider);
    expect(beschafft.ok).toBe(true);
    if (!beschafft.ok) return;
    const eingang = zuEingangsArgumenten(
      BEISPIEL_ERFASSUNG, beschafft.wert, standardKonfiguration(), '2026-08-16T14:32:00.000Z');
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;
    expect(eingang.wert.bewertungsbuendelVollstaendig).toBe(false);
  });
});

describe('zuEingangsArgumenten (I-02, PE-21)', () => {
  it('konstruiert die Liegenschaft ueber das Aggregat und uebernimmt den Zeitstempel', async () => {
    const beschafft = await beschaffe(BEISPIEL_ERFASSUNG, providerAttrappe());
    expect(beschafft.ok).toBe(true);
    if (!beschafft.ok) return;
    const eingang = zuEingangsArgumenten(
      BEISPIEL_ERFASSUNG, beschafft.wert, standardKonfiguration(), '2026-08-16T14:32:00.000Z');
    expect(eingang.ok).toBe(true);
    if (!eingang.ok) return;
    expect(eingang.wert.zeitstempel).toBe('2026-08-16T14:32:00.000Z');
    expect(eingang.wert.liegenschaft.einheiten).toHaveLength(1);
  });

  it('laesst mit ohneAnpassungen die Zu- und Abschlaege weg (Basispreis, PE-21)', async () => {
    const mitAnpassung = structuredClone(BEISPIEL_ERFASSUNG);
    (mitAnpassung.einheiten[0]!.anpassungen as unknown[]).push({
      faktor: 0.05, erfassungsform: 'relativ', begruendung: 'Seesicht vorhanden',
    });
    const beschafft = await beschaffe(mitAnpassung, providerAttrappe());
    expect(beschafft.ok).toBe(true);
    if (!beschafft.ok) return;
    const ohne = zuEingangsArgumenten(
      mitAnpassung, beschafft.wert, standardKonfiguration(), '2026-08-16T14:32:00.000Z',
      { ohneAnpassungen: true });
    expect(ohne.ok).toBe(true);
    if (!ohne.ok) return;
    expect(ohne.wert.liegenschaft.einheiten[0]!.anpassungen).toEqual([]);
  });
});
