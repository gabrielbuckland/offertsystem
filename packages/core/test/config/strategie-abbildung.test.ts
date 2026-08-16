import { describe, expect, it } from 'vitest';
// Pfad nach PE-25: `src/config/`, nicht `src/konfig/`. Zugriff auf den Kerntyp ueber
// `wert.kern`, weil parseKonfiguration Kernform und Rohform gemeinsam traegt (PE-01).
import { parseKonfiguration } from '../../src/config/abbildung.js';
import { BASIS_KONFIGURATION, baueKonfiguration } from '../konfigurations-bauer.js';

/** Die vom JSON-Schema zugelassenen Bezeichner — vollstaendig aufgezaehlt. */
const SCHEMA_BEZEICHNER = ['minmax', 'zscore'] as const;

/** Die vom Kern gefuehrten Bezeichner — vollstaendig aufgezaehlt. */
const KERN_BEZEICHNER = ['min-max', 'z-score'] as const;

describe('Abbildung der Strategiebezeichner (PE-02)', () => {
  it.each(SCHEMA_BEZEICHNER)('bildet %s auf einen Wert der Kernunion ab', (bezeichner) => {
    const konfiguration = baueKonfiguration((k) => {
      const faktor = k.aufwandfaktoren['innenausbau_qualitaet']!;
      faktor.strategie = bezeichner;
      if (bezeichner === 'zscore') {
        faktor.referenzverteilung = { mittelwert: 3.5, standardabweichung: 1.2, kappungSigma: 2 };
      }
    });
    const ergebnis = parseKonfiguration(konfiguration);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const abgebildet = ergebnis.wert.kern.faktoren.get('innenausbau_qualitaet' as never)?.strategie;
    expect(KERN_BEZEICHNER).toContain(abgebildet);
  });

  it('ist injektiv — verschiedene Schemabezeichner werden nicht zusammengelegt', () => {
    const abgebildet = SCHEMA_BEZEICHNER.map((bezeichner) => {
      const konfiguration = baueKonfiguration((k) => {
        const faktor = k.aufwandfaktoren['innenausbau_qualitaet']!;
        faktor.strategie = bezeichner;
        if (bezeichner === 'zscore') {
          faktor.referenzverteilung = { mittelwert: 3.5, standardabweichung: 1.2, kappungSigma: 2 };
        }
      });
      const ergebnis = parseKonfiguration(konfiguration);
      return ergebnis.ok
        ? ergebnis.wert.kern.faktoren.get('innenausbau_qualitaet' as never)?.strategie
        : undefined;
    });
    expect(new Set(abgebildet).size).toBe(SCHEMA_BEZEICHNER.length);
  });

  it('bildet jeden Faktor der Standardkonfiguration ab, ohne einen zu verlieren', () => {
    const ergebnis = parseKonfiguration(BASIS_KONFIGURATION);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const erwartet = Object.keys(BASIS_KONFIGURATION.aufwandfaktoren);
    expect(ergebnis.wert.kern.faktoren.size).toBe(erwartet.length);
    for (const name of erwartet) {
      const faktor = ergebnis.wert.kern.faktoren.get(name as never);
      expect(faktor).toBeDefined();
      expect(KERN_BEZEICHNER).toContain(faktor?.strategie);
      // min/max heissen im Kern grenzeMin/grenzeMax und bleiben wertgleich.
      expect(faktor?.grenzeMin).toBe(BASIS_KONFIGURATION.aufwandfaktoren[name]!.min);
      expect(faktor?.grenzeMax).toBe(BASIS_KONFIGURATION.aufwandfaktoren[name]!.max);
    }
  });

  it('weist einen nicht abbildbaren Bezeichner zurueck, statt still zu ersetzen', () => {
    const fremd = structuredClone(BASIS_KONFIGURATION);
    (fremd.aufwandfaktoren['lage_gesamt'] as unknown as Record<string, unknown>)['strategie'] = 'robust';
    const ergebnis = parseKonfiguration(fremd);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_STRATEGY_UNKNOWN');
  });
});
