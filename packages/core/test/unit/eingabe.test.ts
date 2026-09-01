import { describe, expect, it } from 'vitest';
import { validiereLiegenschaftEingabe } from '../../src/eingabe/validiere.js';
import { BEWERTUNGEN_STANDARD } from '../helper/projekt.js';

const grenzen = { zMin: -0.25, zMax: 0.25, begruendungMinLaenge: 10 };

const parametrisierung = {
  flaecheInnen: 92.5, flaecheAussen: 0, stockwerk: 1, energielabel: 'B',
  ...BEWERTUNGEN_STANDARD, anzahlBadezimmer: 1,
  lift: true, baujahr: 2025, heizungsart: 'heat_pump',
};

function roh(anpassungen: unknown[] = []): unknown {
  return {
    id: 'L-1',
    adresse: { strasse: 'Bahnhofstrasse', hausnummer: '1', plz: '6003', ort: 'Luzern' },
    baujahr: 2025, grundstuecksflaeche: 800,
    wohnungstypen: [{ id: 'T1', zimmerzahl: 3.5, parametrisierung }],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', wohnungstypId: 'T1',
      flaecheInnen: 92.5, flaecheAussen: 0, anpassungen,
    }],
  };
}

function codes(r: ReturnType<typeof validiereLiegenschaftEingabe>): readonly string[] {
  return r.ok ? [] : r.fehler.map((f) => f.code);
}

describe('Eingabevalidierung — einzige Stelle mit Plausibilitaetsgrenzen (I-02)', () => {
  it('nimmt einen vollstaendigen gueltigen Datensatz an', () => {
    expect(validiereLiegenschaftEingabe(roh(), grenzen).ok).toBe(true);
  });

  it('weist z_j = -1 und z_j < -1 zurueck (I-06)', () => {
    const eins = validiereLiegenschaftEingabe(
      roh([{ faktor: -1, begruendung: 'Vollstaendiger Abschlag begruendet', erfassungsform: 'relativ' }]),
      grenzen);
    expect(codes(eins)).toContain('Z_MODELLGRENZE');
    const drunter = validiereLiegenschaftEingabe(
      roh([{ faktor: -1.2, begruendung: 'Weit unter der Modellgrenze', erfassungsform: 'relativ' }]),
      grenzen);
    expect(codes(drunter)).toContain('Z_MODELLGRENZE');
  });

  it('weist z_j ausserhalb der konfigurierten Grenzen zurueck (I-07)', () => {
    const r = validiereLiegenschaftEingabe(
      roh([{ faktor: 0.4, begruendung: 'Aussichtslage mit Seeblick', erfassungsform: 'relativ' }]),
      grenzen);
    expect(codes(r)).toContain('Z_KONFIGURATIONSGRENZE');
  });

  it('prueft auf der Summe, nicht je Einzelanpassung (I-08)', () => {
    const r = validiereLiegenschaftEingabe(
      roh([
        { faktor: 0.2, begruendung: 'Attikalage mit Dachterrasse', erfassungsform: 'relativ' },
        { faktor: -0.1, begruendung: 'Laermexposition Strassenseite', erfassungsform: 'relativ' },
      ]),
      grenzen);
    expect(r.ok).toBe(true); // Summe 0.1 liegt innerhalb [-0.25, 0.25]
  });

  it('weist eine Anpassung ohne oder mit zu kurzer Begruendung zurueck (US-04, I-09)', () => {
    const leer = validiereLiegenschaftEingabe(
      roh([{ faktor: 0.05, begruendung: '', erfassungsform: 'relativ' }]), grenzen);
    expect(codes(leer)).toContain('BEGRUENDUNG_FEHLT');
    const kurz = validiereLiegenschaftEingabe(
      roh([{ faktor: 0.05, begruendung: 'ok', erfassungsform: 'relativ' }]), grenzen);
    expect(codes(kurz)).toContain('BEGRUENDUNG_ZU_KURZ');
  });

  it('benennt Feld und verletzten Wertebereich, keine Sammelmeldung (US-01, NFA-11)', () => {
    const r = validiereLiegenschaftEingabe(
      roh([{ faktor: 0.4, begruendung: 'Aussichtslage mit Seeblick', erfassungsform: 'relativ' }]),
      grenzen);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const f = r.fehler.find((x) => x.code === 'Z_KONFIGURATIONSGRENZE')!;
      expect(f.feld).toBe('einheiten[0].anpassungen');
      expect(f.parameter).toMatchObject({ zSumme: 0.4, min: -0.25, max: 0.25 });
    }
  });

  it('weist eine Zimmerzahl ausserhalb 1..12 und eine unvollstaendige Adresse zurueck (US-01)', () => {
    const basis = roh() as Record<string, unknown>;
    const r = validiereLiegenschaftEingabe(
      { ...basis, wohnungstypen: [{ id: 'T1', zimmerzahl: 13, parametrisierung }],
        adresse: { strasse: '', hausnummer: '1', plz: '6003', ort: 'Luzern' } },
      grenzen);
    expect(r.ok).toBe(false);
  });

  it('rechnet einen absolut erfassten Abschlag in einen relativen Faktor um (US-04)', () => {
    const r = validiereLiegenschaftEingabe(
      roh([{ faktor: -0.0217, begruendung: 'Pauschalabschlag Erstvermarktung',
             erfassungsform: 'absolut', erfassterBetrag: -2_000_000 }]),
      grenzen);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const a = r.wert.einheiten[0]!.anpassungen[0]!;
      expect(a.erfassungsform).toBe('absolut');
      expect(a.erfassterBetrag).toBe(-2_000_000);
      expect(a.faktor).toBeCloseTo(-0.0217, 10);
    }
  });

  it('weist Flaechen <= 0 zurueck, laesst Aussenflaeche 0 zu (US-01)', () => {
    const basis = roh() as Record<string, unknown>;
    const r = validiereLiegenschaftEingabe(
      { ...basis, einheiten: [{ id: 'E-1', wohnungsnummer: 'A-01', wohnungstypId: 'T1',
        flaecheInnen: 0, flaecheAussen: 0, anpassungen: [] }] },
      grenzen);
    expect(r.ok).toBe(false);
  });

  it('weist eine Parametrisierung mit anbieterfremdem Bewertungsschluessel zurueck', () => {
    const eingabe = roh() as Record<string, unknown>;
    const wohnungstypen = eingabe['wohnungstypen'] as Array<{ parametrisierung: Record<string, unknown> }>;
    wohnungstypen[0]!.parametrisierung = {
      ...parametrisierung,
      zustandsbewertungen: { Gesamteindruck: 'gehoben' },
    };
    expect(validiereLiegenschaftEingabe(eingabe, grenzen).ok).toBe(false);
  });
});
