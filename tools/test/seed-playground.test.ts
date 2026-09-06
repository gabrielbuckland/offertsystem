import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAYGROUND_ID, seedQuelle, seedePlayground } from '../seed-playground.ts';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('seedePlayground', () => {
  it('legt das Playground-Projekt in eine leere Ablage', () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'seed-'));
    expect(seedePlayground(verzeichnis)).toBe(true);
    const ziel = join(verzeichnis, `${PLAYGROUND_ID}.json`);
    expect(existsSync(ziel)).toBe(true);
    const projekt = JSON.parse(readFileSync(ziel, 'utf8')) as { id: string };
    expect(projekt.id).toBe(PLAYGROUND_ID);
  });

  it('laesst eine Ablage mit bestehendem Projekt unangetastet', () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'seed-'));
    writeFileSync(join(verzeichnis, 'eigenes.json'), '{}');
    expect(seedePlayground(verzeichnis)).toBe(false);
    expect(existsSync(join(verzeichnis, `${PLAYGROUND_ID}.json`))).toBe(false);
  });

  it('legt das Fixture-Projekt unter seiner eigenen Kennung ab', () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'seed-'));
    const quelle = join(WURZEL, 'data', 'seed', 'fixture-projekt.json');
    expect(seedePlayground(verzeichnis, quelle)).toBe(true);
    const id = (JSON.parse(readFileSync(quelle, 'utf8')) as { id: string }).id;
    expect(existsSync(join(verzeichnis, `${id}.json`))).toBe(true);
  });
});

describe('seedQuelle', () => {
  it('waehlt im Fixture-Betrieb das zur Aufzeichnung passende Projekt', () => {
    expect(seedQuelle('fixture')).toMatch(/fixture-projekt\.json$/);
  });

  it('waehlt sonst das Playground-Projekt', () => {
    expect(seedQuelle('mock')).toMatch(/playground-projekt\.json$/);
    expect(seedQuelle(undefined)).toMatch(/playground-projekt\.json$/);
  });
});

// E-31: Jede Abweichung von der Aufzeichnung meldet der Adapter als Vertragsbruch.
describe('Fixture-Seed passt zur Aufzeichnung', () => {
  const projekt = JSON.parse(readFileSync(
    join(WURZEL, 'data', 'seed', 'fixture-projekt.json'), 'utf8',
  )) as {
    baujahr: number;
    adresse: Record<string, string>;
    referenzobjekte: readonly {
      zimmerzahl: number;
      bewertung?: unknown;
      parametrisierung: Record<string, unknown>;
    }[];
  };
  const dossier = JSON.parse(readFileSync(
    join(WURZEL, 'fixtures', 'pricehubble', 'recorded', 'dossier', 'get-dossier.success.json'),
    'utf8',
  )) as { property: Record<string, unknown> & { location: { address: Record<string, string> } } };
  const p = dossier.property;

  it('fuehrt genau ein Referenzobjekt ohne vorbezogene Bewertung', () => {
    expect(projekt.referenzobjekte).toHaveLength(1);
    expect(projekt.referenzobjekte[0]!.bewertung).toBeUndefined();
  });

  it('entspricht in allen dossier-relevanten Feldern dem aufgezeichneten Dossierstand', () => {
    const r = projekt.referenzobjekte[0]!;
    expect(r.parametrisierung['flaecheInnen']).toBe(p['livingArea']);
    expect(r.parametrisierung['flaecheAussen']).toBe(p['balconyArea']);
    expect(r.parametrisierung['stockwerk']).toBe(p['floorNumber']);
    expect(r.parametrisierung['baujahr']).toBe(p['buildingYear']);
    expect(r.parametrisierung['anzahlBadezimmer']).toBe(p['numberOfBathrooms']);
    expect(r.parametrisierung['lift']).toBe(p['hasLift']);
    expect(r.parametrisierung['zustandsbewertungen']).toEqual(p['condition']);
    expect(r.parametrisierung['qualitaetsbewertungen']).toEqual(p['quality']);
    expect(r.zimmerzahl).toBe(p['numberOfRooms']);
    expect(projekt.baujahr).toBe(p['buildingYear']);
    expect(projekt.adresse).toEqual({
      strasse: p.location.address['street'],
      hausnummer: p.location.address['houseNumber'],
      plz: p.location.address['postCode'],
      ort: p.location.address['city'],
    });
  });
});
