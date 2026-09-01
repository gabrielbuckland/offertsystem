import { describe, expect, it } from 'vitest';
import { RohKonfigurationSchema } from '../../src/config/schema.js';

const minimal = {
  meta: { schemaVersion: 1, konfigVersion: '0', gueltigAb: '2026-08-16', beschreibung: '' },
  flaeche: { alpha: 0.5 },
  preisanpassung: { zMin: -0.25, zMax: 0.25, begruendungPflicht: true, begruendungMinLaenge: 10 },
  anpassungsVorlagen: [],
  aufwandfaktoren: {
    lage_gesamt: {
      bezeichnung: 'Lage',
      quelle: 'lagescore',
      quellSchluessel: 'location',
      strategie: 'minmax',
      min: 1,
      max: 0,
      gewicht: 1,
    },
  },
  honorar: {
    stuetzstellen: [{ v: 0, hMin: 1, hMax: 2 }],
    skalierung: { form: 'linear', gMin: 0.85, gMax: 1.15 },
  },
  dossierDefaults: {
    zustandsbewertungen: {
      bathrooms: 'new_or_recently_renovated',
      kitchen: 'new_or_recently_renovated',
      flooring: 'new_or_recently_renovated',
      windows: 'new_or_recently_renovated',
    },
    qualitaetsbewertungen: {
      bathrooms: 'high_quality',
      kitchen: 'high_quality',
      flooring: 'high_quality',
      windows: 'high_quality',
    },
  },
  api: {
    baseUrl: 'https://api.pricehubble.com',
    endpunkte: {
      login: '/auth/login/credentials',
      dossierGet: '/api/v1/dossiers/{dossierId}',
      dossierUpdate: '/api/v1/dossiers/{dossierId}',
      dossierValuation: '/api/v1/dossiers/{dossierId}/valuation',
      locationScores: '/api/v1/location/scores',
    },
    timeoutMs: 10000,
    timeoutValuationMs: 20000,
    gesamtbudgetMs: 45000,
    retry: {
      maxVersuche: 3,
      startBackoffMs: 500,
      backoffFaktor: 2,
      maxBackoffMs: 8000,
      jitter: 'voll',
      retryAfterBeachten: true,
      retryAfterMaxSekunden: 60,
      retryStatuscodes: [429, 500, 502, 503, 504],
    },
    tokenGueltigkeitMin: 720,
    tokenSicherheitsmargeMin: 30,
  },
};

describe('Ebene 1 — Struktur', () => {
  it('nimmt eine strukturell vollstaendige Konfiguration an', () => {
    expect(RohKonfigurationSchema.safeParse(minimal).success).toBe(true);
  });

  it('meldet ein fehlendes Pflichtfeld', () => {
    const ohneGMin = structuredClone(minimal);
    delete (ohneGMin.honorar.skalierung as { gMin?: number }).gMin;
    const ergebnis = RohKonfigurationSchema.safeParse(ohneGMin);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(ergebnis.error.issues[0]?.path.join('.')).toBe('honorar.skalierung.gMin');
  });

  it('weist einen unbekannten Schluessel zurueck statt ihn zu ignorieren', () => {
    const mitTippfehler = structuredClone(minimal);
    (mitTippfehler.aufwandfaktoren['lage_gesamt'] as unknown as Record<string, unknown>)['weight'] = 0.4;
    const ergebnis = RohKonfigurationSchema.safeParse(mitTippfehler);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(ergebnis.error.issues[0]?.code).toBe('unrecognized_keys');
  });

  it('weist eine nicht unterstuetzte Schemaversion zurueck', () => {
    const zukunft = structuredClone(minimal);
    zukunft.meta.schemaVersion = 2;
    const ergebnis = RohKonfigurationSchema.safeParse(zukunft);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(ergebnis.error.issues[0]?.code).toBe('invalid_literal');
  });

  it('weist eine unbekannte Normalisierungsstrategie zurueck', () => {
    const fremd = structuredClone(minimal);
    (fremd.aufwandfaktoren['lage_gesamt'] as unknown as Record<string, unknown>)['strategie'] = 'robust';
    const ergebnis = RohKonfigurationSchema.safeParse(fremd);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(ergebnis.error.issues[0]?.code).toBe('invalid_enum_value');
  });

  it('nimmt einen beliebigen neuen Faktorschluessel an, ohne dass eine Union zu ergaenzen waere', () => {
    const erweitert = structuredClone(minimal);
    // Der Zugriff ist bewusst ueber einen Indexzugriff getypt: `minimal` ist ein
    // Literal, und genau die Erweiterbarkeit um einen dort unbekannten Schluessel
    // ist der Gegenstand dieses Tests (I-13).
    (erweitert.aufwandfaktoren as Record<string, unknown>)['risikoindex'] = {
      bezeichnung: 'Risikoindex',
      quelle: 'manuell',
      quellSchluessel: 'risikoindex',
      strategie: 'minmax',
      min: 1,
      max: 6,
      gewicht: 0,
    };
    expect(RohKonfigurationSchema.safeParse(erweitert).success).toBe(true);
  });

  it('nimmt das deskriptive Feld skala an, statt es als unbekannten Schluessel abzuweisen', () => {
    const mitSkala = structuredClone(minimal);
    (mitSkala.aufwandfaktoren['lage_gesamt'] as unknown as Record<string, unknown>)['skala'] = {
      form: 'ordinal',
      stufen: [
        { wert: 1, bezeichnung: 'einfacher Standard' },
        { wert: 6, bezeichnung: 'Luxus' },
      ],
    };
    expect(RohKonfigurationSchema.safeParse(mitSkala).success).toBe(true);
  });

  it('weist eine unbekannte Skalenform zurueck', () => {
    const fremdeSkala = structuredClone(minimal);
    (fremdeSkala.aufwandfaktoren['lage_gesamt'] as unknown as Record<string, unknown>)['skala'] = {
      form: 'metrisch',
      stufen: [],
    };
    expect(RohKonfigurationSchema.safeParse(fremdeSkala).success).toBe(false);
  });

  it('verlangt die Token-Sicherheitsmarge als Pflichtfeld des api-Blocks', () => {
    const ohneMarge = structuredClone(minimal);
    delete (ohneMarge.api as { tokenSicherheitsmargeMin?: number }).tokenSicherheitsmargeMin;
    const ergebnis = RohKonfigurationSchema.safeParse(ohneMarge);
    expect(ergebnis.success).toBe(false);
    if (ergebnis.success) return;
    expect(ergebnis.error.issues[0]?.path.join('.')).toBe('api.tokenSicherheitsmargeMin');
  });

  it('belegt merkmale und erfassungsform vor, wenn sie in einer gespeicherten Konfiguration fehlen', () => {
    // Belegt das Kompatibilitaetsversprechen: Ein Artefakt aus `data/`, das vor dieser
    // Erweiterung geschrieben wurde, hat weder `merkmale` noch `erfassungsform` und muss
    // ohne Nachbearbeitung gueltig bleiben (E-07 der Anforderung, hier: Vorgabewerte).
    const ohneMerkmaleUndErfassungsform = structuredClone(minimal) as Record<string, unknown>;
    delete ohneMerkmaleUndErfassungsform['merkmale'];
    (ohneMerkmaleUndErfassungsform['anpassungsVorlagen'] as unknown[]).push({
      id: 'seesicht',
      bezeichnung: 'Seesicht',
      vorgabefaktor: 0.05,
      begruendungVorschlag: 'Ungehinderte Seesicht ab dem zweiten Obergeschoss.',
    });
    const ergebnis = RohKonfigurationSchema.safeParse(ohneMerkmaleUndErfassungsform);
    expect(ergebnis.success).toBe(true);
    if (!ergebnis.success) return;
    expect(ergebnis.data.merkmale).toEqual([]);
    expect(ergebnis.data.anpassungsVorlagen[0]?.erfassungsform).toBe('relativ');
  });
});

describe('dossierDefaults — feste PriceHubble-Feldmenge', () => {
  const gueltig = {
    zustandsbewertungen: {
      bathrooms: 'well_maintained', kitchen: 'well_maintained',
      flooring: 'new_or_recently_renovated', windows: 'renovation_needed',
    },
    qualitaetsbewertungen: {
      bathrooms: 'normal', kitchen: 'high_quality',
      flooring: 'simple', windows: 'luxury',
    },
  };

  it('nimmt die vier Felder mit gueltigen Aufzaehlungswerten an', () => {
    const k = { ...minimal, dossierDefaults: gueltig };
    expect(RohKonfigurationSchema.safeParse(k).success).toBe(true);
  });

  it('weist einen anbieterfremden Schluessel zurueck', () => {
    const k = {
      ...minimal,
      dossierDefaults: {
        ...gueltig,
        zustandsbewertungen: { ...gueltig.zustandsbewertungen, Gesamteindruck: 'gehoben' },
      },
    };
    expect(RohKonfigurationSchema.safeParse(k).success).toBe(false);
  });

  it('weist einen Wert ausserhalb der Aufzaehlung zurueck', () => {
    const k = {
      ...minimal,
      dossierDefaults: {
        ...gueltig,
        qualitaetsbewertungen: { ...gueltig.qualitaetsbewertungen, kitchen: 'gehoben' },
      },
    };
    expect(RohKonfigurationSchema.safeParse(k).success).toBe(false);
  });

  it('weist ein fehlendes Feld zurueck — die Firmenvorgabe ist vollstaendig', () => {
    const { windows: _weg, ...unvollstaendig } = gueltig.zustandsbewertungen;
    const k = {
      ...minimal,
      dossierDefaults: { ...gueltig, zustandsbewertungen: unvollstaendig },
    };
    expect(RohKonfigurationSchema.safeParse(k).success).toBe(false);
  });

  it('fuehrt die vier Skalarfelder nicht mehr', () => {
    const k = {
      ...minimal,
      dossierDefaults: { ...gueltig, flaecheInnen: 80 },
    };
    expect(RohKonfigurationSchema.safeParse(k).success).toBe(false);
  });
});
