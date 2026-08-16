import { describe, expect, it } from 'vitest';
import { berechneVerkaufssumme } from '../../src/pipeline/stufe2-verkaufssumme.js';
import { ergaenzeAbgeleiteteFaktoren } from '../../src/pipeline/stufe2a-abgeleitete.js';
import { pipelineEingang, standardKonfiguration } from '../helper/projekt.js';
import { faktorId } from '../../src/domain/ids.js';
import { gewicht } from '../../src/domain/geld.js';

describe('Zwischenschritt 4.2a — ergaenzeAbgeleiteteFaktoren (E-06)', () => {
  it('setzt die Rohwerte der abgeleiteten Faktoren und leert offeneFaktoren', () => {
    const e = pipelineEingang();
    const v = berechneVerkaufssumme(e);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const r = ergaenzeAbgeleiteteFaktoren(e, v.wert);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wert.offeneFaktoren).toEqual([]);
      expect(r.wert.rohfaktoren.get(faktorId('projektumfang'))).toBe(4);
      // q_t = 85 000 000 / 92.5; alle Einheiten desselben Typs => q-quer = q_t
      expect(r.wert.rohfaktoren.get(faktorId('preissegment')))
        .toBeCloseTo(85_000_000 / 92.5, 6);
    }
  });

  it('bildet q-quer flaechengewichtet und vor den Zu-/Abschlaegen (Spec 02 §5.3)', () => {
    const e = pipelineEingang({ anpassungenErsteEinheit: [
      { faktor: 0.2, begruendung: 'Attikalage mit Dachterrasse', erfassungsform: 'relativ' }] });
    const v = berechneVerkaufssumme(e);
    if (!v.ok) return;
    const r = ergaenzeAbgeleiteteFaktoren(e, v.wert);
    if (r.ok) {
      // Die Anpassung darf ueber die Hintertuer nicht auf das Honorar wirken.
      expect(r.wert.rohfaktoren.get(faktorId('preissegment')))
        .toBeCloseTo(85_000_000 / 92.5, 6);
    }
  });

  it('meldet S-02 mit phase "rohwert" bei unbekannter Ableitung (Spec 06 §2.4)', () => {
    const basis = standardKonfiguration();
    const faktoren = new Map(basis.faktoren);
    faktoren.set(faktorId('risikoindex'), {
      grenzeMin: 0, grenzeMax: 1, gewicht: gewicht(0), strategie: 'min-max',
      quelle: 'abgeleitet', quellSchluessel: 'unbekannteKennzahl', bezeichnung: 'Risikoindex',
    });
    const e = pipelineEingang({ konfiguration: { ...basis, faktoren } });
    const v = berechneVerkaufssumme(e);
    if (!v.ok) return;
    const r = ergaenzeAbgeleiteteFaktoren(e, v.wert);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fehler.code).toBe('FAKTOR_FEHLT');
      expect(r.fehler.parameter['phase']).toBe('rohwert');
      expect(r.fehler.parameter['quellSchluessel']).toBe('unbekannteKennzahl');
    }
  });

  it('ist die Identitaet, wenn keine abgeleitete Quelle konfiguriert ist (Determinismus)', () => {
    const basis = standardKonfiguration();
    const faktoren = new Map(
      [...basis.faktoren].filter(([, p]) => p.quelle !== 'abgeleitet'),
    );
    const e = pipelineEingang({ konfiguration: { ...basis, faktoren } });
    const v = berechneVerkaufssumme(e);
    if (!v.ok) return;
    const r = ergaenzeAbgeleiteteFaktoren(e, v.wert);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect([...r.wert.rohfaktoren.entries()]).toEqual([...e.rohfaktoren.entries()]);
      expect(r.wert.offeneFaktoren).toEqual([]);
    }
  });

  it('rechnet keine Modellgroesse — nur Kennzahlen aus dem Ergebnis von Stufe 2', () => {
    const e = pipelineEingang();
    const v = berechneVerkaufssumme(e);
    if (!v.ok) return;
    const r = ergaenzeAbgeleiteteFaktoren(e, v.wert);
    if (r.ok) expect(Object.keys(r.wert)).not.toContain('verkaufssumme');
  });
});
