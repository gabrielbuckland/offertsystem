import { describe, expect, it } from 'vitest';
import { mergeKonfiguration } from '../../src/config/merge.js';
import { validiereKonfiguration } from '../../src/config/validieren.js';
import { BASIS_KONFIGURATION } from '../konfigurations-bauer.js';

const geprueft = validiereKonfiguration(BASIS_KONFIGURATION);
if (!geprueft.ok) throw new Error('Testbasis ist ungueltig');
const basis = geprueft.wert;

describe('mergeKonfiguration', () => {
  it('liefert ohne Ueberschreibungen die unveraenderte Basis', () => {
    const ergebnis = mergeKonfiguration(basis, {});
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.basis).toEqual(basis);
    expect(ergebnis.wert.ueberschreibungen).toEqual([]);
  });

  it('ersetzt Dossier-Parameter blattweise und behaelt nicht genannte Schluessel', () => {
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: { typ_3_5: { flaecheInnen: 92, stockwerk: 2 } },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const parameter = ergebnis.wert.dossierParameter['typ_3_5'];
    expect(parameter?.flaecheInnen).toBe(92);
    expect(parameter?.stockwerk).toBe(2);
    expect(parameter?.flaecheAussen).toBeNull();
    expect(ergebnis.wert.ueberschreibungen).toEqual([
      { pfad: 'dossierParameter.typ_3_5.flaecheInnen', defaultwert: null, projektwert: 92 },
      { pfad: 'dossierParameter.typ_3_5.stockwerk', defaultwert: null, projektwert: 2 },
    ]);
  });

  it('unterscheidet ein ausdrueckliches null von einem fehlenden Schluessel', () => {
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: { typ_3_5: { energielabel: null } },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.ueberschreibungen).toHaveLength(0);
    expect(ergebnis.wert.dossierParameter['typ_3_5']?.energielabel).toBeNull();
  });

  it('ersetzt Preisanpassungen vollstaendig und protokolliert sie', () => {
    const ergebnis = mergeKonfiguration(basis, {
      preisanpassungen: {
        '3.1': [
          { faktor: 0.1, begruendung: 'Attikalage mit Dachterrasse.', vorlageId: 'attikalage' },
          { faktor: -0.05, begruendung: 'Laermexposition Strassenseite.' },
        ],
      },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.preisanpassungen['3.1']).toHaveLength(2);
    expect(ergebnis.wert.preisanpassungen['3.1']?.[0]?.vorlageId).toBe('attikalage');
    expect(ergebnis.wert.ueberschreibungen[0]?.pfad).toBe('preisanpassungen.3.1');
  });

  it('weist einen gesperrten Pfad mit Pfadangabe zurueck', () => {
    const ergebnis = mergeKonfiguration(basis, { flaeche: { alpha: 0.8 } });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_MERGE_LOCKED_PATH');
    expect(ergebnis.fehler[0]?.pfad).toBe('flaeche');
  });

  it('weist auch die Anpassungsvorlagen als gesperrt zurueck', () => {
    const ergebnis = mergeKonfiguration(basis, { anpassungsVorlagen: [] });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_MERGE_LOCKED_PATH');
  });

  it('weist unbekannte Schluessel als Fehler zurueck, nicht als Warnung', () => {
    const ergebnis = mergeKonfiguration(basis, { dossierParamter: {} });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_UNKNOWN_KEY');
  });

  it('weist einen unbekannten Blattschluessel der Dossier-Parameter zurueck', () => {
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: { typ_3_5: { flaecheInnnen: 92 } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_UNKNOWN_KEY');
    expect(ergebnis.fehler[0]?.pfad).toBe('dossierParameter.typ_3_5.flaecheInnnen');
  });

  it('weist eine strukturell fehlerhafte Preisanpassung zurueck', () => {
    const ergebnis = mergeKonfiguration(basis, {
      preisanpassungen: { '3.1': [{ faktor: 0.1 }] },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_MISSING');
  });
});
