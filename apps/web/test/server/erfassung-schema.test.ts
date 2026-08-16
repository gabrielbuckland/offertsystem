import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Konfiguration } from '@offert/core';
import { pruefeErfassung } from '../../src/server/feldmeldungen.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');
const KONFIG: Konfiguration = standardKonfiguration();

function beispielErfassung() {
  return {
    kunde: {
      name: 'Muster Immobilien AG',
      referenznummer: 'A-2026-014',
      kontakt: { email: 'kontakt@muster.example' },
    },
    liegenschaft: {
      adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
      baujahr: 2027,
      grundstuecksflaeche: 1_250,
    },
    wohnungstypen: [{
      id: 'T-3.5',
      zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 82, flaecheAussen: 12, stockwerk: 2, energielabel: 'A',
        zustandsbewertungen: { bathrooms: 'new' }, qualitaetsbewertungen: { bathrooms: 'normal' },
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'Waermepumpe',
      },
    }],
    einheiten: [
      { wohnungsnummer: 'A1.01', wohnungstypId: 'T-3.5', flaecheInnen: 82, flaecheAussen: 12,
        stockwerk: 1, parkplaetze: 1, anpassungen: [] },
      { wohnungsnummer: 'A2.01', wohnungstypId: 'T-3.5', flaecheInnen: 82, flaecheAussen: 14,
        stockwerk: 2, parkplaetze: 1, anpassungen: [] },
    ],
    aufwandfaktoren: { innenausbau_qualitaet: 4 },
  };
}

describe('Pflichtpruefungen laufen vor dem Bewertungsabruf', () => {
  it('weist Flaechen <= 0 und eine unvollstaendige Adresse zurueck', () => {
    const eingabe = beispielErfassung();
    eingabe.einheiten[0]!.flaecheInnen = 0;
    eingabe.liegenschaft.adresse.plz = '';
    const meldungen = pruefeErfassung(eingabe, KONFIG);
    expect(meldungen.map((m) => m.feldpfad)).toEqual(expect.arrayContaining([
      'einheiten.0.flaecheInnen', 'liegenschaft.adresse.plz',
    ]));
  });

  it('weist eine Zimmeranzahl ausserhalb 1 bis 12 zurueck und nennt den Wertebereich', () => {
    const eingabe = beispielErfassung();
    eingabe.wohnungstypen[0]!.zimmerzahl = 14;
    const [m] = pruefeErfassung(eingabe, KONFIG);
    expect(m!.text).toContain('Zimmeranzahl muss zwischen 1.0 und 12.0 liegen');
    expect(m!.feldpfad).toBe('wohnungstypen.0.zimmerzahl');
  });

  it('meldet eine doppelte Wohnungsnummer an allen kollidierenden Einheiten', () => {
    const eingabe = beispielErfassung();
    eingabe.einheiten[1]!.wohnungsnummer = eingabe.einheiten[0]!.wohnungsnummer;
    const pfade = pruefeErfassung(eingabe, KONFIG).map((m) => m.feldpfad);
    expect(pfade).toContain('einheiten.0.wohnungsnummer');
    expect(pfade).toContain('einheiten.1.wohnungsnummer');
  });
});

describe('Keine Rohfehler, keine Sammelmeldung (NFA-11)', () => {
  it('reicht keine Zod-Rohausgabe durch', () => {
    const eingabe = beispielErfassung();
    eingabe.liegenschaft.grundstuecksflaeche = -1;
    const meldungen = pruefeErfassung(eingabe, KONFIG);
    expect(meldungen.length).toBeGreaterThan(0);
    for (const m of meldungen) {
      expect(m.text).not.toMatch(/invalid_type|too_small|ZodError|Expected/);
      expect(m.feldpfad).not.toBe('');
    }
  });

  it('verankert jede Meldung an genau einem Feldpfad', () => {
    const eingabe = beispielErfassung();
    eingabe.einheiten[0]!.flaecheInnen = 0;
    eingabe.liegenschaft.adresse.plz = 'abc';
    const meldungen = pruefeErfassung(eingabe, KONFIG);
    expect(new Set(meldungen.map((m) => m.feldpfad)).size).toBe(meldungen.length);
  });
});

describe('Grenzen fuer z_j stammen aus der Konfiguration (I-07)', () => {
  it('uebernimmt geaenderte z-Grenzen ohne Codeaenderung', () => {
    const eng: Konfiguration = {
      ...KONFIG,
      preisanpassung: { ...KONFIG.preisanpassung, zMin: -0.05, zMax: 0.05 },
    };
    const eingabe = beispielErfassung();
    eingabe.einheiten[0]!.anpassungen = [
      { faktor: 0.1, erfassungsform: 'relativ', begruendung: 'Seesicht vorhanden' },
    ] as never;
    expect(pruefeErfassung(eingabe, KONFIG)).toHaveLength(0);
    expect(pruefeErfassung(eingabe, eng)).toHaveLength(1);
  });

  it('traegt keinen Grenzwert im Formularcode', () => {
    const quelle = readFileSync(`${WURZEL}/apps/web/src/server/erfassung-schema.ts`, 'utf8');
    expect(quelle).not.toMatch(/-0\.\d|zMin\s*=\s*-/);
  });
});
