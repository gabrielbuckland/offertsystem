import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  score, type BewertungsBuendel, type Lagescores, type LagescoreName, type Referenzbewertung,
  type WohnungstypId,
} from '@offert/core';
import { basispreiseFuerErfassung, rechneBetragInFaktor } from '../../src/server/betragsumrechnung.js';
import type { Beschafft } from '../../src/server/eingang.js';
import type { Erfassung } from '../../src/server/erfassung-schema.js';
import { standardKonfiguration, ZEITSTEMPEL } from '../bau/offerte-bauer.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');

// Minimal fixture; `basispreiseFuerErfassung` doesn't call `beschaffe()`.
function erfassung(wohnungstypId: string): Erfassung {
  return {
    projekt: { projektId: 'A-2026-014' },
    liegenschaft: {
      adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
    },
    wohnungstypen: [{
      id: 'T-3.5',
      zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 82, flaecheAussen: 12, stockwerk: 2, energielabel: 'minergie_a' as const,
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump_air' as const,
      },
    }],
    einheiten: [{
      wohnungsnummer: 'A1.01', wohnungstypId, flaecheInnen: 82, flaecheAussen: 12,
      anpassungen: [],
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 4 },
  } as unknown as Erfassung;
}

function beschafft(bewertungen: ReadonlyMap<WohnungstypId, Referenzbewertung>): Beschafft {
  const buendel: BewertungsBuendel = { vollstaendig: true, bewertungen };
  const lagescores: Lagescores = {
    // 'location' is lage_gesamt's sourceKey; required or stage 1 fails with FAKTOR_FEHLT.
    werte: new Map([['location' as LagescoreName, score(0.72)]]),
    meta: new Map(), abrufdatum: '2026-08-16', anbieter: 'PriceHubble',
  };
  return { buendel, lagescores };
}

function bewertung(marktwert: number): Referenzbewertung {
  return {
    wohnungstypId: 'T-3.5' as WohnungstypId,
    marktwert: marktwert as Referenzbewertung['marktwert'],
    bewertungsdatum: '2026-08-16',
    anbieter: 'PriceHubble',
    parametrisierungsAbdruck: erfassung('T-3.5').wohnungstypen[0]!
      .parametrisierung as Referenzbewertung['parametrisierungsAbdruck'],
    anzeige: {
      konfidenzbereich: {
        von: Math.round(marktwert * 0.94) as Referenzbewertung['marktwert'],
        bis: Math.round(marktwert * 1.06) as Referenzbewertung['marktwert'],
      },
      konfidenzklasse: 'good',
    },
  };
}

describe('Absoluter Betrag -> Faktor (PE-21, Spec 03 §1.4)', () => {
  it('bildet den Faktor aus Betrag und Basispreis der Einheit', () => {
    const ergebnis = rechneBetragInFaktor(4_250_000, 85_000_000);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert).toBeCloseTo(0.05, 12);
  });

  it('bildet einen Abschlag als negativen Faktor ab', () => {
    const ergebnis = rechneBetragInFaktor(-2_550_000, 85_000_000);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert).toBeCloseTo(-0.03, 12);
  });

  it('lehnt einen Abschlag ab, der den Basispreis erreicht (I-06)', () => {
    const ergebnis = rechneBetragInFaktor(-85_000_000, 85_000_000);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldung).toContain('Basispreis');
  });

  it('lehnt die Umrechnung ohne Basispreis ab, statt null anzunehmen', () => {
    expect(rechneBetragInFaktor(1_000, 0).ok).toBe(false);
  });
});

describe('Die Basispreise stammen aus Stufe 2, nicht aus einer zweiten Formel (I-23)', () => {
  it('bildet weder Referenzflaeche noch Quadratmeterpreis selbst', () => {
    const quelle = readFileSync(`${WURZEL}/apps/web/src/server/betragsumrechnung.ts`, 'utf8');
    // Identifiers allowed in comments; search code only.
    const code = quelle
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const verboten of ['referenzflaeche', 'alpha', 'Math.pow', '**']) {
      expect(code, `betragsumrechnung.ts nennt ${verboten}`).not.toContain(verboten);
    }
    expect(code).toContain('berechneVerkaufssumme');
    expect(code).toContain('bereiteEingabeAuf');
  });
});

describe('basispreiseFuerErfassung (PE-21)', () => {
  it('ermittelt den Basispreis je Einheit ueber Stufe 1 und Stufe 2, ohne Anpassungen', () => {
    const ergebnis = basispreiseFuerErfassung(
      erfassung('T-3.5'),
      beschafft(new Map([['T-3.5' as WohnungstypId, bewertung(85_000_000)]])),
      standardKonfiguration(),
      ZEITSTEMPEL,
    );
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    // A_t_ref = 88 = A_j (same parametrization); base price = reference market value unchanged.
    expect(ergebnis.wert.get('A1.01')).toBe(85_000_000);
  });

  it('meldet einen unbekannten Wohnungstyp, statt eine ungueltige Liegenschaft zu bauen', () => {
    const ergebnis = basispreiseFuerErfassung(
      erfassung('T-UNBEKANNT'),
      beschafft(new Map([['T-3.5' as WohnungstypId, bewertung(85_000_000)]])),
      standardKonfiguration(),
      ZEITSTEMPEL,
    );
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldung).toContain('Referenzobjekt');
  });

  it('meldet eine fehlende Referenzbewertung aus Stufe 1, statt mit einem Ersatzwert zu rechnen', () => {
    const ergebnis = basispreiseFuerErfassung(
      erfassung('T-3.5'),
      beschafft(new Map()),
      standardKonfiguration(),
      ZEITSTEMPEL,
    );
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldung).toContain('Referenzbewertung');
  });

  it('meldet eine Referenzflaeche von 0 aus Stufe 2, statt durch 0 zu teilen', () => {
    const ohneFlaeche = erfassung('T-3.5');
    (ohneFlaeche.wohnungstypen[0]!.parametrisierung as { flaecheInnen: number }).flaecheInnen = 0;
    (ohneFlaeche.wohnungstypen[0]!.parametrisierung as { flaecheAussen: number }).flaecheAussen = 0;
    const ergebnis = basispreiseFuerErfassung(
      ohneFlaeche,
      beschafft(new Map([['T-3.5' as WohnungstypId, bewertung(85_000_000)]])),
      standardKonfiguration(),
      ZEITSTEMPEL,
    );
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldung).toContain('Referenzfläche');
  });
});
