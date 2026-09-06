import { describe, expect, it } from 'vitest';
import { erzeugeEinheiten } from '../../../src/server/einheiten-generator.js';
import type { Referenzobjekt } from '../../../src/server/projekt-schema.js';
import {
  anzahlWohnungenAusEntwurf, naechsteId, neuesReferenzobjekt, verfuegbareZimmerzahlen,
} from '../../../src/components/projekt/referenzobjekte-logik.js';
import { BEWERTUNGEN_STANDARD } from '../../bau/bewertungen.js';

function referenzobjekt(id: string, zimmerzahl: number): Referenzobjekt {
  return {
    id,
    zimmerzahl,
    parametrisierung: {
      flaecheInnen: 60, flaecheAussen: 0, stockwerk: 0, energielabel: '' as const,
      ...BEWERTUNGEN_STANDARD,
      anzahlBadezimmer: 1, lift: false, baujahr: 0, heizungsart: '' as const,
    },
  };
}

describe('verfuegbareZimmerzahlen', () => {
  it('bietet alle elf Halbschritte 1..6 an, wenn noch nichts erfasst ist', () => {
    expect(verfuegbareZimmerzahlen([])).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
  });

  it('schliesst bereits vergebene Zimmerzahlen aus', () => {
    const vorhandene = [referenzobjekt('R1', 3.5), referenzobjekt('R2', 2)];
    expect(verfuegbareZimmerzahlen(vorhandene)).toEqual([1, 1.5, 2.5, 3, 4, 4.5, 5, 5.5, 6]);
  });

  it('ist leer, wenn alle elf Halbschritte vergeben sind', () => {
    const vorhandene = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]
      .map((z, i) => referenzobjekt(`R${i + 1}`, z));
    expect(verfuegbareZimmerzahlen(vorhandene)).toEqual([]);
  });
});

describe('naechsteId', () => {
  it('liefert R1 fuer eine leere Liste', () => {
    expect(naechsteId([])).toBe('R1');
  });

  it('haengt an die hoechste vorhandene Nummer an, unabhaengig von der Reihenfolge', () => {
    const vorhandene = [referenzobjekt('R3', 2), referenzobjekt('R1', 1)];
    expect(naechsteId(vorhandene)).toBe('R4');
  });

  it('ignoriert IDs, die nicht dem Muster R<Zahl> entsprechen', () => {
    const vorhandene = [referenzobjekt('X9', 1), referenzobjekt('R2', 2)];
    expect(naechsteId(vorhandene)).toBe('R3');
  });
});

describe('neuesReferenzobjekt', () => {
  it('setzt Zimmerzahl, Wohnflaeche, ID und Baujahr wie uebergeben, Stockwerk fest auf 0', () => {
    expect(neuesReferenzobjekt(
      4.5, 72, 'R2', 2027,
      BEWERTUNGEN_STANDARD.zustandsbewertungen, BEWERTUNGEN_STANDARD.qualitaetsbewertungen,
    )).toEqual({
      id: 'R2',
      zimmerzahl: 4.5,
      parametrisierung: {
        flaecheInnen: 72, flaecheAussen: 0, stockwerk: 0, energielabel: '' as const,
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: false, baujahr: 2027, heizungsart: '' as const,
      },
    });
  });

  it('uebernimmt Zustand und Qualitaet aus den firmenweiten Dossier-Voreinstellungen', () => {
    const zustandsbewertungen = {
      bathrooms: 'new_or_recently_renovated', kitchen: 'new_or_recently_renovated',
      flooring: 'new_or_recently_renovated', windows: 'new_or_recently_renovated',
    } as const;
    const qualitaetsbewertungen = {
      bathrooms: 'luxury', kitchen: 'luxury', flooring: 'luxury', windows: 'luxury',
    } as const;
    const neues = neuesReferenzobjekt(3, 65, 'R1', 2027, zustandsbewertungen, qualitaetsbewertungen);
    expect(neues.parametrisierung.zustandsbewertungen).toEqual(zustandsbewertungen);
    expect(neues.parametrisierung.qualitaetsbewertungen).toEqual(qualitaetsbewertungen);
  });
});

describe('anzahlWohnungenAusEntwurf', () => {
  it('liefert 0 fuer ein geleertes Feld — «keine Wohnungen jetzt schon anlegen» ist gueltig', () => {
    expect(anzahlWohnungenAusEntwurf('')).toBe(0);
    expect(anzahlWohnungenAusEntwurf('   ')).toBe(0);
  });

  it('liefert 0 fuer negative, nicht-numerische oder nullwertige Eingaben', () => {
    expect(anzahlWohnungenAusEntwurf('-3')).toBe(0);
    expect(anzahlWohnungenAusEntwurf('abc')).toBe(0);
    expect(anzahlWohnungenAusEntwurf('0')).toBe(0);
  });

  it('rundet eine gebrochene Eingabe ab', () => {
    expect(anzahlWohnungenAusEntwurf('3.9')).toBe(3);
  });

  it('uebernimmt eine gueltige positive ganze Zahl', () => {
    expect(anzahlWohnungenAusEntwurf('4')).toBe(4);
  });
});

/**
 * Die eigentliche Verkettung "neu angelegtes Referenzobjekt + Anzahl Wohnungen ergeben
 * genau so viele neue Einheiten dieses Typs" — reine Funktionen, deshalb hier pruefbar.
 */
describe('neuesReferenzobjekt + erzeugeEinheiten (Anlegen-Dialog mit Anzahl)', () => {
  it('erzeugt genau so viele Einheiten des neuen Typs wie im Dialog angegeben', () => {
    const neues = neuesReferenzobjekt(
      4.5, 72, 'R2', 2027,
      BEWERTUNGEN_STANDARD.zustandsbewertungen, BEWERTUNGEN_STANDARD.qualitaetsbewertungen,
    );
    const alleReferenzobjekte = [referenzobjekt('R1', 3.5), neues];
    const neueEinheiten = erzeugeEinheiten(
      [{ referenzobjektId: neues.id, anzahl: 3 }], alleReferenzobjekte, [], []);
    expect(neueEinheiten).toHaveLength(3);
    expect(neueEinheiten.every((e) => e.referenzobjektId === 'R2')).toBe(true);
  });
});
