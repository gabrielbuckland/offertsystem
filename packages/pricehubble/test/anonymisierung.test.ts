import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TEST_UUID, anonymisiere } from '../src/acl/anonymisierung.js';

describe('Anonymisierung vor der Ablage (Spec 04 §8.2)', () => {
  const roh = {
    id: '64768cc5-d1c7-4980-8885-bbdba6b81bb7',
    dossierId: '64768cc5-d1c7-4980-8885-bbdba6b81bb7',
    createdBy: 't.gruner@pripro.ch',
    modifiedBy: 't.gruner@pripro.ch',
    ownedBy: 't.gruner@pripro.ch',
    title: 'SMH_Hofgarten Safenwil',
    description: 'intern',
    priceStrategyDescription: 'Der Preis fuer diese Immobilie wird auf CHF 971 000 geschaetzt.',
    property: {
      livingArea: 127,
      location: {
        address: {
          street: 'Hofstrasse',
          houseNumber: '4',
          postCode: '5745',
          city: 'Safenwil',
        },
        coordinates: { latitude: 47.3162047, longitude: 7.9715446 },
      },
    },
  };

  it('entfernt personenbezogene Felder', () => {
    const sauber = anonymisiere(roh) as Record<string, unknown>;
    expect('createdBy' in sauber).toBe(false);
    expect('modifiedBy' in sauber).toBe(false);
    expect('ownedBy' in sauber).toBe(false);
  });

  it('ersetzt Kennungen durch die feste Test-UUID', () => {
    const sauber = anonymisiere(roh) as { id: string; dossierId: string };
    expect(sauber.id).toBe(TEST_UUID);
    expect(sauber.dossierId).toBe(TEST_UUID);
  });

  it('ersetzt Adresse und Koordinaten durch die Beispieladresse', () => {
    const sauber = anonymisiere(roh) as {
      property: { location: { address: { city: string }; coordinates: unknown } };
    };
    expect(sauber.property.location.address.city).toBe('Luzern');
    expect(sauber.property.location.coordinates).toEqual({ latitude: 47.05, longitude: 8.3 });
  });

  it('entfernt Freitextfelder', () => {
    const sauber = anonymisiere(roh) as Record<string, unknown>;
    expect('title' in sauber).toBe(false);
    expect('priceStrategyDescription' in sauber).toBe(false);
  });

  it('laesst Berechnungsdaten unveraendert', () => {
    const sauber = anonymisiere(roh) as { property: { livingArea: number } };
    expect(sauber.property.livingArea).toBe(127);
  });

  it('enthaelt in keiner Ausgabe eine E-Mail-Adresse', () => {
    expect(JSON.stringify(anonymisiere(roh))).not.toMatch(/@/);
  });

  it('bindet test:record nicht in den regulaeren Testdurchlauf ein (E-31)', () => {
    const wurzelManifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(wurzelManifest.scripts['test:record']).toBeDefined();
    expect(wurzelManifest.scripts['test']).not.toContain('test:record');
  });
});
