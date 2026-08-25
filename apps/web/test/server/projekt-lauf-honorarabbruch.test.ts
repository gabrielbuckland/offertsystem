/**
 * E-04 end to end: Liegt die Verkaufssumme ausserhalb der konfigurierten Staffel, ist das
 * KEIN Eingabefehler, sondern ein Teilergebnis. Geprueft wird deshalb nicht die
 * Textuebersetzung des Fehlercodes (die war schon abgedeckt und hat den Defekt trotzdem
 * durchgelassen), sondern der Rueckgabetyp von `fuehreProjektlauf` samt Nutzlast:
 * Verkaufssumme, D und JEDE Wohnungsposition muessen vorhanden bleiben.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Konfiguration, Rappen } from '@offert/core';
import { holeLaufzeit, type Laufzeit } from '../../src/server/laufzeit.js';
import { fuehreProjektlauf } from '../../src/server/projekt-lauf.js';
import { legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

/**
 * Staffel, deren oberste Stuetzstelle (CHF 200'000) weit unter der Verkaufssumme des
 * Fixtures liegt. Die uebrigen Konfigurationsteile bleiben unveraendert, damit einzig
 * Stufe 5 scheitert und die Stufen 1–4 gueltig durchlaufen.
 */
function staffelZuTief(basis: Konfiguration): Konfiguration {
  const unterste = basis.honorar.stuetzstellen[0];
  if (unterste === undefined) throw new Error('Standardkonfiguration ohne Stuetzstellen');
  return {
    ...basis,
    honorar: {
      ...basis.honorar,
      stuetzstellen: [
        { ...unterste, v: 10_000_000 as Rappen },
        { ...unterste, v: 20_000_000 as Rappen },
      ],
    },
  };
}

async function vorbereitetesProjekt(projekte: string) {
  const p = await legeProjektAn(ADRESSE, projekte, standardKonfiguration());
  await speichereProjekt({
    ...p,
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
        zustandsbewertungen: {}, qualitaetsbewertungen: {},
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
      },
    }],
    anpassungsSpalten: [],
    einheiten: [
      {
        id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
        flaecheInnen: 86, flaecheAussen: 19, spaltenwerte: {},
      },
      {
        id: 'E-2', wohnungsnummer: 'A-02', referenzobjektId: 'R-1',
        flaecheInnen: 92, flaecheAussen: 12, spaltenwerte: {},
      },
    ],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
  }, projekte);
  return p.id;
}

beforeEach(() => {
  process.env['VALUATION_PROVIDER'] = 'mock';
});

describe('Projektlauf – Honorarabbruch (E-04)', () => {
  it('liefert ein Teilergebnis statt eines Fehlers, wenn die Verkaufssumme die Staffel '
    + 'oben verlaesst', async () => {
    const projekte = await mkdtemp(join(tmpdir(), 'projekte-'));
    const offerten = await mkdtemp(join(tmpdir(), 'offerten-'));
    process.env['PROJEKTE_VERZEICHNIS'] = projekte;
    process.env['OFFERTEN_VERZEICHNIS'] = offerten;
    const id = await vorbereitetesProjekt(projekte);

    const geladen = holeLaufzeit();
    expect(geladen.ok).toBe(true);
    if (!geladen.ok) return;
    const laufzeit: Laufzeit = {
      ...geladen.wert,
      konfiguration: staffelZuTief(geladen.wert.konfiguration),
    };

    const lauf = await fuehreProjektlauf(id, laufzeit);
    expect(lauf.art).toBe('honorarAbbruch');
    if (lauf.art !== 'honorarAbbruch') return;

    expect(lauf.fehler.stufe).toBe(5);
    expect(lauf.fehler.code).toBe('VERKAUFSSUMME_AUSSERHALB');
    // Teilergebnis vollstaendig: Verkaufssumme, D und jede Wohnungsposition.
    expect(lauf.teilergebnis.verkaufssumme).toBeGreaterThan(0);
    expect(lauf.teilergebnis.aufwandindikator).toBeGreaterThan(0);
    expect(lauf.teilergebnis.positionen).toHaveLength(2);
    for (const position of lauf.teilergebnis.positionen) {
      expect(position.wohnungsnummer).not.toBe('');
      expect(position.preis).toBeGreaterThan(0);
    }
  });
});
