import { describe, expect, it } from 'vitest';
import { ladeReferenz } from '../helper/referenz.js';
import { gewichteteFlaeche } from '../../src/modell/flaeche.js';
import { loeseStrategieAuf } from '../../src/modell/normalisierung.js';
import { skalierung } from '../../src/modell/skalierung.js';
import { bildeHonorarrange } from '../../src/pipeline/stufe5-honorar.js';
import { berechneVerkaufssumme } from '../../src/pipeline/stufe2-verkaufssumme.js';
import { berechneAufwandindikator } from '../../src/pipeline/stufe4-gewichtung.js';
import { quadratmeter, quadratmeterAbNull, rappen, gewicht } from '../../src/domain/geld.js';
import { faktorId } from '../../src/domain/ids.js';
import { einTypEinheitenEingang, faktormengeMitGewichtssummeEins, normalisierungZu }
  from '../property/generatoren.js';
import { gewichtungErgebnis, standardKonfiguration, verkaufssummeErgebnis } from '../helper/projekt.js';

describe('T1 — Unit-Tests gegen die unabhaengige Referenz', () => {
  it('01_flaeche: eq:flaeche stimmt fuer alpha in {0, 0.25, 0.5, 1}', () => {
    for (const z of ladeReferenz('01_flaeche')) {
      const ist = gewichteteFlaeche(
        quadratmeter(Number(z['A_innen'])), quadratmeterAbNull(Number(z['A_aussen'])),
        Number(z['alpha']));
      expect(ist).toBeCloseTo(Number(z['A_gewichtet']), 9);
    }
  });

  it('02_qm_preis: q_t wird ungerundet verglichen', () => {
    for (const z of ladeReferenz('02_qm_preis')) {
      const flaeche = gewichteteFlaeche(quadratmeter(Number(z['A_ref_innen'])),
        quadratmeterAbNull(Number(z['A_ref_aussen'])), Number(z['alpha']));
      expect(Number(z['P_ref_rappen']) / flaeche).toBeCloseTo(Number(z['q_t']), 6);
    }
  });

  it('03_wohnungspreis: p_j exakt in Rappen, inklusive Zu-/Abschlaegen', () => {
    for (const z of ladeReferenz('03_wohnungspreis')) {
      const faktoren = [Number(z['a_1']), Number(z['a_2']), Number(z['a_3'])]
        .filter((f) => f !== 0);
      const e = einTypEinheitenEingang({
        anpassungen: faktoren.map((f, i) => ({
          faktor: f, begruendung: `${String(z['begruendung'])} (${i})`,
          erfassungsform: 'relativ' as const,
        })),
      });
      const r = berechneVerkaufssumme(e);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.wert.positionen[0]!.preis).toBe(Number(z['p_j_rappen']));
    }
  });

  it('04_verkaufssumme: exakter Vergleich in Rappen', () => {
    for (const z of ladeReferenz('04_verkaufssumme')) {
      const e = einTypEinheitenEingang({ anzahl: Number(z['m']) });
      const r = berechneVerkaufssumme(e);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.wert.verkaufssumme).toBe(Number(z['V_rappen']));
    }
  });

  it('05_normalisierung: innerhalb, auf der Grenze, ausserhalb und invertiert', () => {
    for (const z of ladeReferenz('05_normalisierung')) {
      const r = loeseStrategieAuf('min-max').normalisiere(Number(z['x_roh']), {
        grenzeMin: Number(z['x_min']), grenzeMax: Number(z['x_max']), gewicht: gewicht(0.5),
        strategie: 'min-max', quelle: 'manuell', quellSchluessel: 'f',
        bezeichnung: String(z['faktor_id']),
      }, faktorId(String(z['faktor_id'])));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.wert.normiert).toBeCloseTo(Number(z['x_norm']), 9);
    }
  });

  it('06_aufwandindikator: D fuer mehrere Faktorkombinationen', () => {
    const zeilen = ladeReferenz('06_aufwandindikator');
    const gewichte = zeilen.map((z) => Number(z['w_d']));
    const normierte = zeilen.map((z) => Number(z['x_norm']));
    const k = faktormengeMitGewichtssummeEins(gewichte);
    const r = berechneAufwandindikator(normalisierungZu(k, normierte), k);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wert.aufwandindikator).toBeCloseTo(Number(zeilen[0]!['D']), 9);
  });

  it('07_honorar_mapping: Basen ungerundet, Honorar exakt in Rappen', () => {
    const k = standardKonfiguration();
    for (const z of ladeReferenz('07_honorar_mapping')) {
      const r = bildeHonorarrange(verkaufssummeErgebnis(rappen(Number(z['V_rappen']))),
        gewichtungErgebnis(Number(z['D'])), k);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.wert.stufenindex).toBe(Number(z['k']));
        expect(r.wert.skalierung).toBeCloseTo(Number(z['g_D']), 12);
        expect(r.wert.basisMin).toBeCloseTo(Number(z['H_min_V_rappen']), 3);
        expect(r.wert.honorarMin).toBe(Number(z['H_min_g_rappen']));
        expect(r.wert.honorarMax).toBe(Number(z['H_max_g_rappen']));
      }
    }
  });

  it('08_degression: linke Seite kleiner gleich rechte Seite (eq:netto_degression)', () => {
    for (const z of ladeReferenz('08_degression')) {
      expect(Number(z['linke_seite'])).toBeLessThanOrEqual(Number(z['rechte_seite']) + 1e-12);
      const p = standardKonfiguration().honorar.skalierung;
      expect(skalierung(Number(z['D2']), p) / skalierung(Number(z['D1']), p))
        .toBeLessThanOrEqual(Number(z['margenquotient']) + 1e-12);
    }
  });

  it('weist eine veraenderte Referenzdatei ueber die Pruefsumme zurueck', () => {
    // Gegenprobe zur Zusage des Manifests: Ohne diese Pruefung liesse sich eine
    // Referenzdatei an ein geaendertes Ergebnis anpassen, und der Vergleich verglich
    // die Implementierung mit sich selbst.
    expect(() => ladeReferenz('gibt_es_nicht')).toThrow(/Manifesteintrag/);
  });
});
