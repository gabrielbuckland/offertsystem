import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ladeKonfiguration, leereZwischenspeicher } from '../src/server/konfigurations-lader.js';

const STANDARD = resolve(import.meta.dirname, '../../../config/company-defaults.json');
const UNGUELTIG = resolve(
  import.meta.dirname,
  '../../../packages/core/test/fixtures/config-invalid/weights-sum-not-one.json',
);

function arbeitskopie(): string {
  const verzeichnis = mkdtempSync(join(tmpdir(), 'offert-konfig-'));
  const ziel = join(verzeichnis, 'company-defaults.json');
  copyFileSync(STANDARD, ziel);
  return ziel;
}

describe('ladeKonfiguration', () => {
  beforeEach(() => { leereZwischenspeicher(); });

  it('laedt die Standardkonfiguration und bildet einen Fingerabdruck', () => {
    const ergebnis = ladeKonfiguration({ pfad: STANDARD });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.fingerabdruck.konfigVersion).toBe('1.1.0-vorlaeufig');
    expect(ergebnis.fingerabdruck.schemaVersion).toBe(1);
    expect(ergebnis.fingerabdruck.konfigPruefsumme).toMatch(/^[0-9a-f]{64}$/);
    expect(ergebnis.fingerabdruck.ueberschreibungen).toEqual([]);
  });

  it('liefert den Kerntyp und den unveraenderten api-Block mit', () => {
    const ergebnis = ladeKonfiguration({ pfad: STANDARD });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    // Kerntyp aus parseKonfiguration (P2): Faktoren als Map, nicht als Record.
    expect(ergebnis.kern.faktoren.has('projektumfang' as never)).toBe(true);
    expect(ergebnis.kern.faktoren.get('projektumfang' as never)?.strategie).toBe('min-max');
    // PE-17: Der api-Block geht unveraendert an die Zugriffsschicht.
    expect(ergebnis.api.tokenSicherheitsmargeMin).toBe(30);
  });

  it('liefert bei gleichem Inhalt dieselbe Pruefsumme — Determinismus', () => {
    const erst = ladeKonfiguration({ pfad: STANDARD });
    leereZwischenspeicher();
    const zweit = ladeKonfiguration({ pfad: STANDARD });
    expect(erst.ok && zweit.ok).toBe(true);
    if (!erst.ok || !zweit.ok) return;
    expect(erst.fingerabdruck.konfigPruefsumme).toBe(zweit.fingerabdruck.konfigPruefsumme);
  });

  it('aendert die Pruefsumme, sobald Ueberschreibungen wirksam werden', () => {
    const ohne = ladeKonfiguration({ pfad: STANDARD });
    const mit = ladeKonfiguration({
      pfad: STANDARD,
      ueberschreibungen: {
        dossierParameter: {
          typ_3_5: {
            zustandsbewertungen: {
              bathrooms: 'well_maintained', kitchen: 'well_maintained',
              flooring: 'well_maintained', windows: 'well_maintained',
            },
          },
        },
      },
    });
    expect(ohne.ok && mit.ok).toBe(true);
    if (!ohne.ok || !mit.ok) return;
    expect(mit.fingerabdruck.konfigPruefsumme).not.toBe(ohne.fingerabdruck.konfigPruefsumme);
    expect(mit.fingerabdruck.ueberschreibungen).toHaveLength(1);
  });

  it('weist eine verletzende Konfiguration beim Laden mit dem richtigen Code zurueck', () => {
    const ergebnis = ladeKonfiguration({ pfad: UNGUELTIG });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_WEIGHTS_SUM');
    expect(Object.hasOwn(ergebnis, 'konfiguration')).toBe(false);
  });

  it('meldet eine fehlende Datei, ohne zu werfen', () => {
    const ergebnis = ladeKonfiguration({ pfad: resolve(STANDARD, '../gibt-es-nicht.json') });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_TYPE');
    expect(ergebnis.fehler[0]?.pfad).toBe('(datei)');
  });

  it('meldet unlesbares JSON, ohne zu werfen', () => {
    const pfad = arbeitskopie();
    writeFileSync(pfad, '{ das ist kein JSON', 'utf8');
    const ergebnis = ladeKonfiguration({ pfad });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_TYPE');
  });

  it('uebernimmt eine Aenderung der Datei ohne Neustart und ohne Neubau', () => {
    const pfad = arbeitskopie();
    const vorher = ladeKonfiguration({ pfad });
    expect(vorher.ok).toBe(true);

    const inhalt = JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, unknown>;
    (inhalt['meta'] as Record<string, unknown>)['konfigVersion'] = '1.0.1-vorlaeufig';
    writeFileSync(pfad, `${JSON.stringify(inhalt, null, 2)}\n`, 'utf8');

    const nachher = ladeKonfiguration({ pfad });
    expect(nachher.ok).toBe(true);
    if (!nachher.ok || !vorher.ok) return;
    expect(nachher.fingerabdruck.konfigVersion).toBe('1.0.1-vorlaeufig');
    expect(nachher.fingerabdruck.konfigPruefsumme)
      .not.toBe(vorher.fingerabdruck.konfigPruefsumme);
  });

  it('haelt die zuletzt gueltige Konfiguration in Kraft, wenn das Nachladen scheitert', () => {
    const pfad = arbeitskopie();
    const vorher = ladeKonfiguration({ pfad });
    expect(vorher.ok).toBe(true);

    copyFileSync(UNGUELTIG, pfad);
    const abgelehnt = ladeKonfiguration({ pfad });
    expect(abgelehnt.ok).toBe(false);
    if (abgelehnt.ok) return;
    expect(abgelehnt.fehler.map((f) => f.code)).toContain('CFG_WEIGHTS_SUM');

    copyFileSync(STANDARD, pfad);
    const wieder = ladeKonfiguration({ pfad });
    expect(wieder.ok).toBe(true);
    if (!wieder.ok || !vorher.ok) return;
    expect(wieder.fingerabdruck.konfigPruefsumme).toBe(vorher.fingerabdruck.konfigPruefsumme);
  });

  it('laesst eine invariantentreue Uebersteuerung wirksam werden', () => {
    const ergebnis = ladeKonfiguration({
      pfad: STANDARD,
      ueberschreibungen: { honorar: { skalierung: { gMax: 1.2 } } },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    // Der Kerntyp stammt aus der ZUSAMMENGEFUEHRTEN Basis, nicht aus der Datei.
    expect(ergebnis.kern.honorar.skalierung.gMax).toBe(1.2);
    expect(ergebnis.fingerabdruck.ueberschreibungen).toEqual([
      { pfad: 'honorar.skalierung.gMax', defaultwert: 1.15, projektwert: 1.2 },
    ]);
  });

  it('haelt meta und api weiterhin gesperrt', () => {
    const ergebnis = ladeKonfiguration({
      pfad: STANDARD,
      ueberschreibungen: { api: { timeoutMs: 1 } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_MERGE_LOCKED_PATH');
  });

  // US-08: Eine projektbezogene Anpassung, die eine Invariante verletzt, wird
  // zurueckgewiesen statt gerechnet.
  it('weist eine invariantenverletzende Uebersteuerung zurueck statt zu rechnen', () => {
    const ergebnis = ladeKonfiguration({
      pfad: STANDARD,
      // Gewichtssumme kippt von 1.00 auf 1.15.
      ueberschreibungen: { aufwandfaktoren: { lage_gesamt: { gewicht: 0.7 } } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_WEIGHTS_SUM');
    expect(Object.hasOwn(ergebnis, 'konfiguration')).toBe(false);
  });

  // Ueberschreibungen ersetzen Arrays vollstaendig statt sie elementweise
  // zusammenzufuehren, deshalb braucht der Nachweis die volle Stuetzstellenreihe der
  // Standardkonfiguration mit einer einzelnen gekippten Randkurve.
  it('weist eine degressionsverletzende Stuetzstellenreihe zurueck', () => {
    const ergebnis = ladeKonfiguration({
      pfad: STANDARD,
      ueberschreibungen: {
        honorar: {
          stuetzstellen: [
            { v: 0, hMin: 3000000, hMax: 4000000 },
            // hMax faellt hier auf 5000000 statt zu steigen: Der Grenzsatz der
            // naechsten Stufe unterschreitet den eigenen Durchschnittssatz nicht mehr.
            { v: 500000000, hMin: 11250000, hMax: 5000000 },
            { v: 1000000000, hMin: 19500000, hMax: 26000000 },
            { v: 2500000000, hMin: 37500000, hMax: 50000000 },
            { v: 5000000000, hMin: 60000000, hMax: 80000000 },
            { v: 10000000000, hMin: 93750000, hMax: 125000000 },
            { v: 20000000000, hMin: 150000000, hMax: 200000000 },
          ],
        },
      },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_TIER_DEGRESSION');
  });

  it('weist ein null auf einen ganzen Teilbaum in der Nachvalidierung zurueck (W-7)', () => {
    // Der Merge laesst ein null auf einen Teilbaum durch (Skalare ersetzen den Teilbaum
    // als Ganzes); erst die erneute Pruefung der zusammengefuehrten Basis faengt es ab.
    const ergebnis = ladeKonfiguration({ pfad: STANDARD, ueberschreibungen: { honorar: null } });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_SCHEMA_TYPE');
    expect(ergebnis.fehler.some((f) => f.pfad === 'honorar')).toBe(true);
  });

  it('legt projektbezogene Dossier-Voreinstellungen unter die Dossier-Parameter (W-3)', () => {
    // Die Projektebene setzt `zustandsbewertungen.kitchen`, fuehrt daneben aber eigene
    // `dossierParameter` fuer einen Wohnungstyp (ein anderes Feld, `qualitaetsbewertungen`).
    const ergebnis = ladeKonfiguration({
      pfad: STANDARD,
      ueberschreibungen: {
        dossierDefaults: { zustandsbewertungen: { kitchen: 'well_maintained' } },
        dossierParameter: {
          typ_3_5: {
            qualitaetsbewertungen: {
              bathrooms: 'luxury', kitchen: 'luxury', flooring: 'luxury', windows: 'luxury',
            },
          },
        },
      },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.konfiguration.dossierParameter['typ_3_5']?.zustandsbewertungen.kitchen)
      .toBe('well_maintained');
  });
});
