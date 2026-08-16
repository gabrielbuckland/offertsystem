import { describe, expect, it } from 'vitest';
import type { BewertungsBuendel, Lagescores, WohnungstypId } from '@offert/core';
import {
  SCHRITTE,
  reduziere,
  type AblaufZustand,
} from '../../../src/components/schritte/ablauf-zustand.js';
import { standardKonfiguration } from '../../bau/offerte-bauer.js';

const LAGESCORES: Lagescores = {
  werte: new Map(), meta: new Map(), abrufdatum: '2026-08-16', anbieter: 'PriceHubble',
};

const VOLLSTAENDIG: BewertungsBuendel = { vollstaendig: true, bewertungen: new Map() };
const UNVOLLSTAENDIG: BewertungsBuendel = {
  vollstaendig: false,
  bewertungen: new Map(),
  fehlgeschlagenerTyp: 'T-3.5' as WohnungstypId,
};

function basiszustand(): AblaufZustand {
  return {
    aktiverSchritt: 1,
    konfiguration: standardKonfiguration(),
    kunde: { name: 'Muster Immobilien AG', referenznummer: 'A-2026-014', kontakt: {} },
    liegenschaft: {
      adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
      baujahr: 2027,
      grundstuecksflaeche: 1_250,
    },
    wohnungstypen: [{
      id: 'T-3.5', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 82, flaecheAussen: 12, stockwerk: 2, energielabel: 'A',
        zustandsbewertungen: {}, qualitaetsbewertungen: {},
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'Waermepumpe',
      },
    }],
    einheiten: [{
      wohnungsnummer: 'A1.01', wohnungstypId: 'T-3.5', flaecheInnen: 82, flaecheAussen: 12,
      stockwerk: 1, parkplaetze: 1, anpassungen: [],
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 4 },
    meldungen: [],
  };
}

describe('Schrittfolge', () => {
  it('fuehrt die sieben Schritte in der Reihenfolge der Berechnungsabhaengigkeiten', () => {
    expect(SCHRITTE.map((s) => s.titel)).toEqual([
      'Liegenschaftsdaten', 'Wohnungstypen', 'Bewertungsabruf', 'Einheiten',
      'Zu- und Abschläge', 'Aufwandfaktoren', 'Ergebnis',
    ]);
  });

  it('geht bei fehlerfreiem Schritt weiter', () => {
    expect(reduziere(basiszustand(), { art: 'weiter' }).aktiverSchritt).toBe(2);
  });
});

describe('Uebergang blockiert bei Verletzungen und begruendet die Blockade', () => {
  it('blockiert den Uebergang und nennt den Grund', () => {
    const zustand = { ...basiszustand(), liegenschaft: {
      adresse: { strasse: '', hausnummer: '1', plz: '', ort: 'Luzern' },
      baujahr: 2027, grundstuecksflaeche: 1_250,
    } };
    const naechster = reduziere(zustand, { art: 'weiter' });
    expect(naechster.aktiverSchritt).toBe(1);
    expect(naechster.blockade)
      .toBe('Schritt 1 enthält 2 offene Punkte. Bitte die markierten Felder korrigieren.');
  });
});

describe('Ruecksprung und Bewertungsbezug', () => {
  it('verwirft bezogene Bewertungen beim Ruecksprung auf die Typparametrisierung', () => {
    const mitBewertung: AblaufZustand = {
      ...basiszustand(), bewertungen: VOLLSTAENDIG, lagescores: LAGESCORES, aktiverSchritt: 4,
    };
    const zurueck = reduziere(mitBewertung, { art: 'springe', ziel: 2 });
    expect(zurueck.bewertungen).toBeUndefined();
    expect(zurueck.hinweis).toBe(
      'Die Änderung der Parametrisierung entwertet die bezogenen Bewertungen. '
      + 'Der Bewertungsabruf ist zu wiederholen.');
  });

  it('behaelt die Bewertungen bei einem Sprung nach vorn', () => {
    const mitBewertung: AblaufZustand = {
      ...basiszustand(), bewertungen: VOLLSTAENDIG, lagescores: LAGESCORES, aktiverSchritt: 4,
    };
    expect(reduziere(mitBewertung, { art: 'springe', ziel: 5 }).bewertungen).toBe(VOLLSTAENDIG);
  });

  it('bleibt bei unvollstaendigem Buendel in Schritt 3 stehen (PE-23, I-24)', () => {
    const nachher = reduziere(basiszustand(),
      { art: 'bewertungenEingetroffen', buendel: UNVOLLSTAENDIG, lagescores: LAGESCORES });
    expect(nachher.aktiverSchritt).toBe(3);
    expect(nachher.blockade).toContain('keine Bewertung vor');
  });

  it('geht bei vollstaendigem Buendel nach Schritt 4', () => {
    const nachher = reduziere(basiszustand(),
      { art: 'bewertungenEingetroffen', buendel: VOLLSTAENDIG, lagescores: LAGESCORES });
    expect(nachher.aktiverSchritt).toBe(4);
    expect(nachher.blockade).toBeUndefined();
  });
});

describe('Einheitenliste', () => {
  it('ergaenzt und entfernt Einheiten, ohne die uebrigen zu beruehren', () => {
    const mitZweiter = reduziere(basiszustand(), { art: 'einheitHinzu' });
    expect(mitZweiter.einheiten).toHaveLength(2);
    expect(reduziere(mitZweiter, { art: 'einheitEntfernen', index: 1 }).einheiten)
      .toEqual(basiszustand().einheiten);
  });

  it('setzt einen Wert am Pfad und loescht Blockade und Hinweis', () => {
    const blockiert: AblaufZustand = { ...basiszustand(), blockade: 'x', hinweis: 'y' };
    const nachher = reduziere(blockiert, { art: 'setze', pfad: 'liegenschaft.baujahr', wert: 2028 });
    expect(nachher.liegenschaft['baujahr']).toBe(2028);
    expect(nachher.blockade).toBeUndefined();
    expect(nachher.hinweis).toBeUndefined();
  });
});
