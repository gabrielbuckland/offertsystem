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
      ueberschreibungen: { dossierParameter: { typ_3_5: { flaecheInnen: 92 } } },
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

  it('weist gesperrte Ueberschreibungspfade zurueck', () => {
    const ergebnis = ladeKonfiguration({
      pfad: STANDARD,
      ueberschreibungen: { honorar: { skalierung: { gMax: 2 } } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_MERGE_LOCKED_PATH');
  });
});
