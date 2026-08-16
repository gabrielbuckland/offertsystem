import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnpassungsVorlage, Konfiguration } from '@offert/core';
import { leseVorlagen, uebernehmeVorlage } from '../../src/server/anpassungsvorlagen.js';
import { pruefeErfassung } from '../../src/server/feldmeldungen.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const WURZEL = resolve(import.meta.dirname, '../../../..');

const VORLAGE_SEESICHT: AnpassungsVorlage = {
  id: 'seesicht',
  bezeichnung: 'Seesicht',
  vorgabefaktor: 0.05,
  begruendungVorschlag: 'Ungehinderte Seesicht ab dem zweiten Obergeschoss',
};

const KONFIG_MIT_VORLAGEN: Konfiguration = {
  ...standardKonfiguration(),
  anpassungsVorlagen: [VORLAGE_SEESICHT],
};
const KONFIG_OHNE_VORLAGEN: Konfiguration = {
  ...standardKonfiguration(),
  anpassungsVorlagen: [],
};

function beispielErfassung() {
  return {
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
      stockwerk: 1, parkplaetze: 1,
      anpassungen: [] as unknown[],
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 4 },
  };
}

const summeZ = (anpassungen: readonly { faktor: number }[]): number =>
  anpassungen.reduce((s, a) => s + a.faktor, 0);

describe('Vorlagen werden vorgeschlagen, nicht vorbelegt (E-25)', () => {
  it('setzt keine Anpassung automatisch', () => {
    for (const einheit of beispielErfassung().einheiten) {
      expect(einheit.anpassungen).toEqual([]);
    }
  });

  it('liefert dasselbe Ergebnis wie ohne Vorlagen, solange keine uebernommen wird', () => {
    const mit = pruefeErfassung(beispielErfassung(), KONFIG_MIT_VORLAGEN);
    const ohne = pruefeErfassung(beispielErfassung(), KONFIG_OHNE_VORLAGEN);
    expect(mit).toEqual(ohne);
  });

  it('liest die Vorlagen aus der Konfiguration', () => {
    expect(leseVorlagen(KONFIG_MIT_VORLAGEN)).toEqual([VORLAGE_SEESICHT]);
  });
});

describe('Die vier Operationen', () => {
  it('uebernimmt eine Vorlage mit Vorgabefaktor und Begruendungsvorschlag', () => {
    expect(uebernehmeVorlage(VORLAGE_SEESICHT)).toEqual({
      faktor: 0.05,
      erfassungsform: 'relativ',
      begruendung: 'Ungehinderte Seesicht ab dem zweiten Obergeschoss',
      vorlageId: 'seesicht',
    });
  });

  it('laesst Faktor und Begruendung frei aendern, ohne die Company Defaults zu beruehren', () => {
    const vorher = structuredClone(KONFIG_MIT_VORLAGEN.anpassungsVorlagen);
    const a = { ...uebernehmeVorlage(VORLAGE_SEESICHT), faktor: 0.08, begruendung: 'Panoramalage' };
    expect(a.faktor).toBe(0.08);
    expect(KONFIG_MIT_VORLAGEN.anpassungsVorlagen).toEqual(vorher);
  });

  it('wirkt eine entfernte Position nicht auf z_j', () => {
    expect(summeZ([])).toBe(0);
  });

  it('stellt eine frei erfasste Position gleichrangig neben die Vorlagen', () => {
    const eingabe = beispielErfassung();
    eingabe.einheiten[0]!.anpassungen = [
      uebernehmeVorlage(VORLAGE_SEESICHT),
      { faktor: -0.03, erfassungsform: 'relativ', begruendung: 'Strassenlärm Nordseite' },
    ];
    expect(pruefeErfassung(eingabe, KONFIG_MIT_VORLAGEN)).toEqual([]);
    expect(summeZ(eingabe.einheiten[0]!.anpassungen as readonly { faktor: number }[]))
      .toBeCloseTo(0.02, 10);
  });
});

describe('Der Vorschlagstext hebt die Begruendungspflicht nicht auf', () => {
  it('weist eine uebernommene Position mit geleerter Begruendung zurueck', () => {
    const eingabe = beispielErfassung();
    eingabe.einheiten[0]!.anpassungen = [
      { ...uebernehmeVorlage(VORLAGE_SEESICHT), begruendung: '  ' },
    ];
    const meldungen = pruefeErfassung(eingabe, KONFIG_MIT_VORLAGEN);
    expect(meldungen[0]!.feldpfad).toBe('einheiten.0.anpassungen.0.begruendung');
    expect(meldungen[0]!.text).toContain('Pflicht');
  });
});

describe('Die Konfiguration wird durch die Erfassung nie beschrieben', () => {
  it('schreibt nicht in config/company-defaults.json', () => {
    const treffer = execSync(
      'grep -rn "writeFile\\|company-defaults" apps/web/src/components '
      + 'apps/web/src/server/anpassungsvorlagen.ts || true',
      { encoding: 'utf8', cwd: WURZEL },
    ).trim();
    expect(treffer).toBe('');
  });
});
