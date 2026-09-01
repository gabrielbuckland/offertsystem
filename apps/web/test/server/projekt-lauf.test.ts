/**
 * Der gemeinsame Rechenweg beider Projektrouten. Geprueft wird genau das, was ihn von
 * zwei getrennten Wegen unterscheidet: Er baut die Offerte immer — und legt nie etwas ab.
 */
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { aggregateValuesSchema, priceDerivationSchema } from '@offert/offer';
import { holeLaufzeit } from '../../src/server/laufzeit.js';
import { fuehreProjektlauf } from '../../src/server/projekt-lauf.js';
import { legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

async function verzeichnisse() {
  const projekte = await mkdtemp(join(tmpdir(), 'projekte-'));
  const offerten = await mkdtemp(join(tmpdir(), 'offerten-'));
  process.env['PROJEKTE_VERZEICHNIS'] = projekte;
  process.env['OFFERTEN_VERZEICHNIS'] = offerten;
  return { projekte, offerten };
}

async function vorbereitetesProjekt(projekte: string) {
  const p = await legeProjektAn(ADRESSE, projekte, standardKonfiguration());
  await speichereProjekt({
    ...p,
    referenzobjekte: [{
      id: 'R-1', zimmerzahl: 3.5,
      parametrisierung: {
        flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
        ...BEWERTUNGEN_STANDARD,
        anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
      },
    }],
    anpassungsSpalten: [],
    einheiten: [{
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: 'R-1',
      flaecheInnen: 86, flaecheAussen: 19,
      spaltenwerte: {}, merkmalswerte: {},
    }],
    aufwandfaktoren: { innenausbau_qualitaet: 3 },
  }, projekte);
  return p.id;
}

beforeEach(() => {
  process.env['VALUATION_PROVIDER'] = 'mock';
});

describe('Projektlauf', () => {
  it('liefert bei vollstaendigem Projekt eine Offerte samt Herleitung, ohne zu persistieren',
    async () => {
      const { projekte, offerten } = await verzeichnisse();
      const id = await vorbereitetesProjekt(projekte);
      const laufzeit = holeLaufzeit();
      expect(laufzeit.ok).toBe(true);
      if (!laufzeit.ok) return;
      const lauf = await fuehreProjektlauf(id, laufzeit.wert);
      expect(lauf.art).toBe('offerte');
      if (lauf.art !== 'offerte') return;
      // Dieselbe Struktur wie im Offert-Artefakt — kein zweites Datenbild (Spec §4):
      expect(priceDerivationSchema.safeParse(lauf.offerte.derivation).success).toBe(true);
      expect(aggregateValuesSchema.safeParse(lauf.offerte.aggregates).success).toBe(true);
      // Die Zuordnung Wohnungsnummer -> Einheitenkennung stammt aus dem Projekt; das
      // Offert-Schema kennt nur die Wohnungsnummer.
      expect(lauf.einheitenIds.get('A-01')).toBe('E-1');
      // Nichts abgelegt: das Offertenverzeichnis bleibt leer.
      const dateien = await readdir(offerten).catch(() => []);
      expect(dateien).toHaveLength(0);
    });

  it('meldet unvollstaendig, wenn dem Projekt Einheiten fehlen', async () => {
    const { projekte } = await verzeichnisse();
    const p = await legeProjektAn(ADRESSE, projekte, standardKonfiguration());
    const laufzeit = holeLaufzeit();
    expect(laufzeit.ok).toBe(true);
    if (!laufzeit.ok) return;
    const lauf = await fuehreProjektlauf(p.id, laufzeit.wert);
    expect(lauf.art).toBe('unvollstaendig');
  });

  it('meldet ein unbekanntes Projekt als Fehler mit 404', async () => {
    const { projekte } = await verzeichnisse();
    await vorbereitetesProjekt(projekte);
    const laufzeit = holeLaufzeit();
    expect(laufzeit.ok).toBe(true);
    if (!laufzeit.ok) return;
    const lauf = await fuehreProjektlauf('00000000-0000-4000-8000-000000000000', laufzeit.wert);
    expect(lauf.art).toBe('fehler');
    if (lauf.art !== 'fehler') return;
    expect(lauf.status).toBe(404);
  });
});
