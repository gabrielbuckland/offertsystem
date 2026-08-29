/**
 * Keine Formel. Belegt die eine Verdrahtungsstelle (PE-24, PE-17, AK-17).
 *
 * ABWEICHUNG VOM PLAN, bewusst: Der Plan nennt die Fixtures
 * `./test/fixtures/company-defaults.json` und `company-defaults-kaputt.json`. Beide
 * gibt es nicht und beide waeren Kopien: Die gueltige Konfiguration liegt bereits als
 * `config/company-defaults.json` vor, die verletzenden Faelle erzeugt P1s
 * Negativmatrix unter `packages/core/test/fixtures/config-invalid/`. Eine dritte
 * Kopie waere ein zweiter Konfigurationsstand, der beim Nachziehen auseinanderlaeuft.
 * Die Pfade sind ueber `import.meta.dirname` aufgeloest, nicht ueber das
 * Arbeitsverzeichnis — dieselbe Form wie in `konfigurations-lader.test.ts`.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { leereZwischenspeicher } from '../../src/server/konfigurations-lader.js';
import { holeLaufzeit, holeProjektLaufzeit } from '../../src/server/laufzeit.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');
const STANDARD = `${WURZEL}/config/company-defaults.json`;
const KAPUTT = `${WURZEL}/packages/core/test/fixtures/config-invalid/weights-sum-not-one.json`;

const PFADE = {
  COMPANY_DEFAULTS_PATH: STANDARD,
  OFFERTEN_VERZEICHNIS: './tmp/offerten',
} as const;

describe('Verdrahtung von Umgebung, Konfiguration, Adapter und Ablage', () => {
  beforeEach(() => {
    leereZwischenspeicher();
  });

  it('bildet Konfigurationspfad, Ablageort und Providerschalter aus einer Umgebung', () => {
    const laufzeit = holeLaufzeit({ VALUATION_PROVIDER: 'mock', ...PFADE });
    expect(laufzeit.ok).toBe(true);
    if (!laufzeit.ok) return;
    expect(laufzeit.wert.offertenVerzeichnis).toContain('tmp/offerten');
    expect(laufzeit.wert.fingerabdruck.konfigPruefsumme).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof laufzeit.wert.provider.bewerteWohnungstypen).toBe('function');
    expect(typeof laufzeit.wert.provider.holeLagescores).toBe('function');
  });

  it('meldet eine unbrauchbare Umgebung als Text, nicht als Ausnahme', () => {
    const laufzeit = holeLaufzeit({ VALUATION_PROVIDER: 'erfunden' });
    expect(laufzeit.ok).toBe(false);
    if (laufzeit.ok) return;
    expect(laufzeit.meldungen[0]).toContain('VALUATION_PROVIDER');
  });

  it('meldet eine ungueltige Konfiguration mit den Fehlercodes des Laders', () => {
    const laufzeit = holeLaufzeit({ COMPANY_DEFAULTS_PATH: KAPUTT });
    expect(laufzeit.ok).toBe(false);
    if (laufzeit.ok) return;
    expect(laufzeit.meldungen.join(' ')).toMatch(/CFG_/);
  });

  it('traegt keinen Ablagepfad im Code der uebrigen Serverdateien', () => {
    // `umgebung.ts` ist ausgenommen: Es ist der einzige Ort, an dem Umgebungswerte
    // gelesen werden (Spec 01 §7.2), und traegt den Vorgabewert deshalb zu Recht.
    // Genau das ist die Zusage — der Pfad wird durchgereicht, nicht an zweiter
    // Stelle bestimmt (E-14).
    const treffer = execSync(
      'grep -rn "data/offerten" apps/web/src --include=*.ts --include=*.tsx'
      + ' | grep -v "server/umgebung.ts" || true',
      { encoding: 'utf8', cwd: WURZEL },
    ).trim();
    expect(treffer).toBe('');
  });

  it('wechselt den Provider allein ueber VALUATION_PROVIDER', () => {
    const mock = holeLaufzeit({ VALUATION_PROVIDER: 'mock', ...PFADE });
    const fixture = holeLaufzeit({ VALUATION_PROVIDER: 'fixture', ...PFADE });
    expect(mock.ok && fixture.ok).toBe(true);
    if (!mock.ok || !fixture.ok) return;
    expect(mock.wert.provider.constructor.name)
      .not.toBe(fixture.wert.provider.constructor.name);
  });

  it('rechnet ohne Delta identisch zur firmenweiten Laufzeit', () => {
    const firma = holeLaufzeit(PFADE);
    const projekt = holeProjektLaufzeit({}, PFADE);
    expect(firma.ok && projekt.ok).toBe(true);
    if (!firma.ok || !projekt.ok) return;
    expect(projekt.wert.fingerabdruck.konfigPruefsumme)
      .toBe(firma.wert.fingerabdruck.konfigPruefsumme);
  });

  it('laesst das Delta auf Kerntyp und Pruefsumme durchschlagen', () => {
    const firma = holeLaufzeit(PFADE);
    const projekt = holeProjektLaufzeit(
      { einstellungen: { flaeche: { alpha: 0.6 } } }, PFADE);
    expect(firma.ok && projekt.ok).toBe(true);
    if (!firma.ok || !projekt.ok) return;
    expect(projekt.wert.konfiguration.flaeche.alpha).toBe(0.6);
    expect(projekt.wert.fingerabdruck.konfigPruefsumme)
      .not.toBe(firma.wert.fingerabdruck.konfigPruefsumme);
    expect(projekt.wert.fingerabdruck.ueberschreibungen).toHaveLength(1);
  });

  it('meldet ein invariantenverletzendes Delta als Laufzeitfehler', () => {
    const ergebnis = holeProjektLaufzeit(
      { einstellungen: { aufwandfaktoren: { lage_gesamt: { gewicht: 0.7 } } } }, PFADE);
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.meldungen.join(' ')).toContain('CFG_WEIGHTS_SUM');
  });
});
