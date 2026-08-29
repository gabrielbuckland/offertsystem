import { describe, expect, it } from 'vitest';
import {
  p4Erweiterung,
  p7Marge,
  p7Sensitivitaet,
  type ExtensionArtefakt,
  type OatZeile,
} from './kapitel6.ts';

const oat: { zeilen: readonly OatZeile[] } = {
  zeilen: [
    { dimension: 'D1', parameter_id: 'w:lage_gesamt', variation_prozent: 20, szenario_id: 'S2',
      delta_V_prozent: 0, delta_Hmin_prozent: 3.2, delta_Hmax_prozent: 3.2,
      wirkpfad: 'auch_ueber_D', dominant: false, status: 'ok' },
    { dimension: 'D5', parameter_id: 'honorar.skalierung.spanne', variation_prozent: -20,
      szenario_id: 'S2', delta_V_prozent: 0, delta_Hmin_prozent: -12.5,
      delta_Hmax_prozent: -12.5, wirkpfad: 'auch_ueber_D', dominant: true, status: 'ok' },
    { dimension: 'D2', parameter_id: 'flaeche.alpha', variation_prozent: 20, szenario_id: 'S2',
      delta_V_prozent: null, delta_Hmin_prozent: null, delta_Hmax_prozent: null,
      wirkpfad: null, dominant: false, status: 'unzulaessig' },
  ],
};

describe('p7Sensitivitaet', () => {
  const tex = p7Sensitivitaet(oat);

  it('weist Verkaufssumme und Honorarrange getrennt aus', () => {
    expect(tex).toContain('Verkaufssumme');
    expect(tex).toContain('H_{\\min}');
    expect(tex).toContain('H_{\\max}');
  });

  it('markiert dominante Parameter', () => {
    expect(tex).toContain('dominant');
  });

  it('fuehrt unzulaessige Varianten mit Status statt mit einer Zahl', () => {
    expect(tex).toContain('unzulaessig');
  });
});

describe('p7Marge', () => {
  it('nennt margin_min, die Konstellation und die noetige Variation je Parameter', () => {
    const tex = p7Marge({
      margin_min: 1.82,
      argmin: { randkurve: 'hMax', k: 2, m1: 4, m2: 36 },
      kritischer_parameter: 'honorar.skalierung.spanne',
      benoetigte_variation: [{
        parameter: 'honorar.skalierung.spanne', istwert: 0.30, zielwert: 1.7,
        relative_variation: 4.67, erreichbar: true,
        unerreichbar_im_variationsbereich: true, grund: null,
      }],
    });
    expect(tex).toContain('1.82');
    expect(tex).toContain('honorar');
    expect(tex).toContain('nicht erreichbar');
  });
});

describe('p4Erweiterung', () => {
  const leer = {
    dateien_geaendert: 0, dateien_neu: 0,
    zeilen_hinzugefuegt: 0, zeilen_entfernt: 0, dateiliste: [],
  };

  it('weist Code, Konfiguration und Testdateien getrennt aus', () => {
    const tex = p4Erweiterung({
      regelfall: {
        messung_verweigert: false,
        metrik_1_und_2: leer,
        konfiguration: { dateien_geaendert: 1, dateien_neu: 0, zeilen_hinzugefuegt: 9,
                         zeilen_entfernt: 4, dateiliste: ['config/company-defaults.json'] },
        test: leer,
        kern_unversehrt: true, kernstufen_pipeline_unveraendert: true,
        faktormenge_datengetrieben: true, zeitaufwand_min: 35,
      },
    });
    expect(tex).toContain('Codedateien');
    expect(tex).toContain('Konfigurationsdateien');
    expect(tex).toContain('unversehrt');
    expect(tex).toContain('35');
  });

  it('weist eine verweigerte Messung als solche aus', () => {
    const verweigert: ExtensionArtefakt = {
      regelfall: {
        messung_verweigert: true,
        zuschnitt: { stoerende: [{ hash: 'b2abcdef', betreff: 'Formatierung',
                                   dateien_ausserhalb: ['packages/core/src/a.ts'] }] },
        grund: 'Commits ausserhalb des Erweiterungsscopes',
      },
    };
    const tex = p4Erweiterung(verweigert);
    expect(tex).toContain('Messung verweigert');
    expect(tex).toContain('b2abcdef');
  });
});

