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
    const abweichendeZustandsbewertungen = {
      bathrooms: 'renovation_needed', kitchen: 'well_maintained',
      flooring: 'well_maintained', windows: 'well_maintained',
    };
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: { typ_3_5: { zustandsbewertungen: abweichendeZustandsbewertungen } },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const parameter = ergebnis.wert.dossierParameter['typ_3_5'];
    expect(parameter?.zustandsbewertungen).toEqual(abweichendeZustandsbewertungen);
    expect(parameter?.qualitaetsbewertungen).toEqual(basis.dossierDefaults.qualitaetsbewertungen);
    expect(ergebnis.wert.ueberschreibungen).toEqual([
      {
        pfad: 'dossierParameter.typ_3_5.zustandsbewertungen',
        defaultwert: basis.dossierDefaults.zustandsbewertungen,
        projektwert: abweichendeZustandsbewertungen,
      },
    ]);
  });

  it('protokolliert eine woertliche Wiederholung des Firmenstandards nicht als Ueberschreibung', () => {
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: {
        typ_3_5: { zustandsbewertungen: { ...basis.dossierDefaults.zustandsbewertungen } },
      },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.ueberschreibungen).toEqual([]);
    expect(ergebnis.wert.dossierParameter['typ_3_5']?.zustandsbewertungen)
      .toEqual(basis.dossierDefaults.zustandsbewertungen);
  });

  it('weist ein unvollstaendiges Dossier-Parameter-Blatt zurueck, statt es als vollstaendig zu typisieren', () => {
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: { typ_3_5: { zustandsbewertungen: { kitchen: 'kaputt' } } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler.map((f) => f.code)).toContain('CFG_SCHEMA_TYPE');
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

  it('uebersteuert einen Skalarwert der Basis und protokolliert ihn', () => {
    const ergebnis = mergeKonfiguration(basis, { flaeche: { alpha: 0.8 } });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.basis.flaeche.alpha).toBe(0.8);
    // Die Firmenbasis selbst bleibt unangetastet — der Merge kopiert.
    expect(basis.flaeche.alpha).toBe(0.5);
    expect(ergebnis.wert.ueberschreibungen).toEqual([
      { pfad: 'flaeche.alpha', defaultwert: 0.5, projektwert: 0.8 },
    ]);
  });

  it('uebersteuert ein Gewicht tief im Baum, ohne Geschwister zu verlieren', () => {
    const ergebnis = mergeKonfiguration(basis, {
      aufwandfaktoren: { lage_gesamt: { gewicht: 0.45 } },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const faktor = ergebnis.wert.basis.aufwandfaktoren['lage_gesamt'];
    expect(faktor?.gewicht).toBe(0.45);
    // Nicht genannte Geschwisterfelder ueberleben die Zusammenfuehrung.
    expect(faktor?.quellSchluessel).toBe('location');
    expect(faktor?.min).toBe(1);
    expect(ergebnis.wert.basis.aufwandfaktoren['preissegment']?.gewicht).toBe(0.2);
    expect(ergebnis.wert.ueberschreibungen).toEqual([
      { pfad: 'aufwandfaktoren.lage_gesamt.gewicht', defaultwert: 0.4, projektwert: 0.45 },
    ]);
  });

  it('ersetzt ein Array vollstaendig statt elementweise', () => {
    const ergebnis = mergeKonfiguration(basis, { anpassungsVorlagen: [] });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    // Vollstaendige Ersetzung: Eine geloeschte Vorlage darf nicht wiederkehren.
    expect(ergebnis.wert.basis.anpassungsVorlagen).toEqual([]);
    expect(ergebnis.wert.ueberschreibungen[0]?.pfad).toBe('anpassungsVorlagen');
  });

  it('haelt meta und api weiterhin gesperrt', () => {
    for (const pfad of ['meta', 'api']) {
      const ergebnis = mergeKonfiguration(basis, { [pfad]: {} });
      expect(ergebnis.ok).toBe(false);
      if (ergebnis.ok) return;
      expect(ergebnis.fehler[0]?.code).toBe('CFG_MERGE_LOCKED_PATH');
      expect(ergebnis.fehler[0]?.pfad).toBe(pfad);
    }
  });

  it('protokolliert einen unveraenderten Wert nicht als Ueberschreibung', () => {
    const ergebnis = mergeKonfiguration(basis, { flaeche: { alpha: 0.5 } });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.ueberschreibungen).toEqual([]);
  });

  it('weist unbekannte Schluessel als Fehler zurueck, nicht als Warnung', () => {
    const ergebnis = mergeKonfiguration(basis, { dossierParamter: {} });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_UNKNOWN_KEY');
  });

  it('weist einen unbekannten Blattschluessel der Dossier-Parameter zurueck', () => {
    // Verschriebener Name eines EXISTIERENDEN Schluessels: Genau so entsteht der Fehler
    // im Betrieb, und nur so belegt der Test, dass die Schluesselmenge geprueft wird und
    // nicht bloss ein laengst entfallenes Feld nicht mehr vorkommt.
    const ergebnis = mergeKonfiguration(basis, {
      dossierParameter: { typ_3_5: { zustandsbewertunge: basis.dossierDefaults.zustandsbewertungen } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_UNKNOWN_KEY');
    expect(ergebnis.fehler[0]?.pfad).toBe('dossierParameter.typ_3_5.zustandsbewertunge');
  });

  it('setzt Dossier-Parameter auf die ZUSAMMENGEFUEHRTEN Voreinstellungen auf (W-3)', () => {
    // Solange `dossierDefaults` gesperrt war, war der Unterschied folgenlos. Seit die
    // Wurzel uebersteuerbar ist, wuerde eine ungemergte Basis die projektbezogene
    // Voreinstellung genau fuer die Wohnungstypen verschlucken, fuer die das Projekt
    // zusaetzlich eigene Dossier-Parameter fuehrt — lautlos.
    const projektweiteQualitaet = {
      bathrooms: 'luxury', kitchen: 'luxury', flooring: 'luxury', windows: 'luxury',
    };
    const abweichendeZustandsbewertungen = {
      bathrooms: 'renovation_needed', kitchen: 'renovation_needed',
      flooring: 'renovation_needed', windows: 'renovation_needed',
    };
    const ergebnis = mergeKonfiguration(basis, {
      dossierDefaults: { qualitaetsbewertungen: projektweiteQualitaet },
      dossierParameter: { typ_3_5: { zustandsbewertungen: abweichendeZustandsbewertungen } },
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.dossierParameter['typ_3_5']?.qualitaetsbewertungen).toEqual(projektweiteQualitaet);
    expect(ergebnis.wert.dossierParameter['typ_3_5']?.zustandsbewertungen).toEqual(abweichendeZustandsbewertungen);
  });

  it('weist einen unbekannten Schluessel auch in der TIEFE zurueck (W-7)', () => {
    // Der zweite Ast der Merge-Zusage: Ein Tippfehler verschwendet die Uebersteuerung
    // nicht lautlos, sondern faellt mit vollqualifiziertem Pfad auf — auch unterhalb der
    // Wurzel, wo eine eigene Pruefstelle in `verschmelzeTeilbaum` greift.
    const ergebnis = mergeKonfiguration(basis, {
      honorar: { skalierung: { tippfehler: 1 } },
    });
    expect(ergebnis.ok).toBe(false);
    if (ergebnis.ok) return;
    expect(ergebnis.fehler[0]?.code).toBe('CFG_SCHEMA_UNKNOWN_KEY');
    expect(ergebnis.fehler[0]?.pfad).toBe('honorar.skalierung.tippfehler');
  });

  it('ersetzt einen Teilbaum durch null, statt den Schluessel zu uebergehen (W-7)', () => {
    // `null` auf einen Teilbaum ist kein Objekt und wird deshalb als Ganzes eingesetzt
    // und protokolliert. Der Merge laesst das durch — zurueckgewiesen wird es erst in der
    // Nachvalidierung des Ladepfads (`konfigurations-lader.test.ts`), und genau diese
    // Arbeitsteilung haelt der Test fest.
    const ergebnis = mergeKonfiguration(basis, { honorar: null });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect((ergebnis.wert.basis as unknown as Record<string, unknown>)['honorar']).toBeNull();
    expect(ergebnis.wert.ueberschreibungen.map((u) => u.pfad)).toEqual(['honorar']);
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
