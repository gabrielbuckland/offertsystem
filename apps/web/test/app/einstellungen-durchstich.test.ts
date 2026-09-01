/**
 * Durchstich-Test (Task 12): Die Schreibroute fuer das projektbezogene Einstellungs-Delta
 * (Commit b78c88c) und die Oberflaeche dafuer (Commit 4cea4b9) wurden von verschiedenen
 * Agenten gebaut und nie gegeneinander geprueft. Dieser Test belegt die ganze Kette in
 * einem Durchlauf: Projekt anlegen, Delta ueber die echte Route schreiben, Projekt neu
 * laden und pruefen, dass das Delta im Artefakt steht, und schliesslich pruefen, dass die
 * Berechnung mit dem Delta rechnet (andere Pruefsumme als ein Projekt ohne Delta).
 *
 * Aufbaumuster uebernommen aus projekt-put-route.test.ts (Fixtur-Aufbau) und
 * projekt-einstellungen-route.test.ts (Aufruf der Route als reine Funktion).
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as POST_EINSTELLUNGEN } from '../../src/app/api/projekt/[id]/einstellungen/route.js';
import { POST as POST_BERECHNUNG } from '../../src/app/api/projekt/[id]/berechnung/route.js';
import { ladeProjekt, legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { BEWERTUNGEN_STANDARD } from '../bau/bewertungen.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

function anfrage(rumpf: unknown): Request {
  return new Request('http://test/api', {
    method: 'POST', body: JSON.stringify(rumpf),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Legt ein rechenbereites Projekt an (Referenzobjekt + eine Einheit), damit die
 * Berechnungsroute ohne weitere Fixtur-Arbeit ein Ergebnis liefert.
 */
async function rechenbaresProjektAnlegen(verzeichnis: string) {
  const p = await legeProjektAn(ADRESSE, verzeichnis, standardKonfiguration());
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
  }, verzeichnis);
  return p.id;
}

beforeEach(() => {
  process.env['VALUATION_PROVIDER'] = 'mock';
});

describe('Durchstich: Einstellungs-Schreibroute -> Ablage -> Berechnung', () => {
  it(
    'ein ueber die Route geschriebenes Delta landet im Artefakt und wirkt sich auf die '
    + 'Berechnung aus',
    async () => {
      const v = await mkdtemp(join(tmpdir(), 'projekte-'));
      process.env['PROJEKTE_VERZEICHNIS'] = v;

      // Schritt 1: zwei Projekte im selben Verzeichnis, damit dieselbe Umgebung fuer
      // beide Berechnungsaufrufe gilt.
      const idOhneDelta = await rechenbaresProjektAnlegen(v);
      const idMitDelta = await rechenbaresProjektAnlegen(v);

      // Schritt 2: das Delta wird NICHT direkt ins Artefakt geschrieben, sondern ueber
      // dieselbe Route gesendet, die auch die Oberflaeche (Commit 4cea4b9) verwendet.
      const antwortSchreiben = await POST_EINSTELLUNGEN(
        anfrage({ honorar: { skalierung: { gMax: 1.2 } } }),
        { params: Promise.resolve({ id: idMitDelta }) },
      );
      expect(antwortSchreiben.status).toBe(200);
      const rumpfSchreiben = await antwortSchreiben.json() as { pruefsumme: string };
      expect(rumpfSchreiben.pruefsumme).toMatch(/^[0-9a-f]{64}$/);

      // Schritt 3: das Projekt frisch von der Ablage laden (nicht das In-Memory-Objekt
      // von legeProjektAn) und pruefen, dass das Delta tatsaechlich im Artefakt steht.
      const neuGeladen = await ladeProjekt(idMitDelta, v);
      expect(neuGeladen.einstellungen).toEqual({ honorar: { skalierung: { gMax: 1.2 } } });

      // Schritt 4: die Berechnungsroute fuer beide Projekte aufrufen. Unterscheiden sich
      // die Konfigurations-Pruefsummen, rechnet die Route nachweislich projektbezogen
      // und nicht mit dem unveraenderten Firmenstand.
      const antwortOhne = await POST_BERECHNUNG(
        new Request('http://test', { method: 'POST' }),
        { params: Promise.resolve({ id: idOhneDelta }) },
      );
      const antwortMit = await POST_BERECHNUNG(
        new Request('http://test', { method: 'POST' }),
        { params: Promise.resolve({ id: idMitDelta }) },
      );
      expect(antwortOhne.status).toBe(200);
      expect(antwortMit.status).toBe(200);

      const koerperOhne = await antwortOhne.json() as { metadaten: { konfigPruefsumme: string } };
      const koerperMit = await antwortMit.json() as { metadaten: { konfigPruefsumme: string } };
      expect(koerperMit.metadaten.konfigPruefsumme)
        .not.toBe(koerperOhne.metadaten.konfigPruefsumme);
    },
  );
});
