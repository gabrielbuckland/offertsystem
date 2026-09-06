/**
 * Erzeugt die Beispiel-Offerte fuer Anhang A5 ueber denselben Route Handler wie im Betrieb
 * (POST /api/offerte) — eine eigene Erzeugungsstrecke koennte abweichen und die Offerte
 * belegte dann nicht mehr, was das System tut. Provider: fixture (E-31) — die Offerte
 * entsteht aus den aufgezeichneten Antworten der produktiven API; die Parametrisierung
 * entspricht deshalb exakt dem aufgezeichneten Dossierstand (PATCH-Rueckvergleich).
 * Laufzeit: node --experimental-strip-types --import ./tools/ts-aufloeser.mjs (PE-09).
 */
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POST } from '../apps/web/src/app/api/offerte/route.ts';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ABLAGE = join(WURZEL, 'data', 'offerten');

process.env['VALUATION_PROVIDER'] ??= 'fixture';
process.env['COMPANY_DEFAULTS_PATH'] ??= join(WURZEL, 'config', 'company-defaults.json');
process.env['OFFERTEN_VERZEICHNIS'] ??= ABLAGE;

// Aufgezeichneter Dossierstand (fixtures/pricehubble/recorded); Adresse = anonymisierte
// Fixture-Adresse. Jede Abweichung liesse den PATCH-Rueckvergleich des Adapters scheitern.
const parametrisierung = {
  flaecheInnen: 82, flaecheAussen: 0, stockwerk: 2, energielabel: '',
  zustandsbewertungen: {
    bathrooms: 'new_or_recently_renovated', kitchen: 'new_or_recently_renovated',
    flooring: 'new_or_recently_renovated', windows: 'new_or_recently_renovated',
  },
  qualitaetsbewertungen: {
    bathrooms: 'high_quality', kitchen: 'high_quality',
    flooring: 'high_quality', windows: 'high_quality',
  },
  anzahlBadezimmer: 1, lift: false, baujahr: 1934, heizungsart: '',
};

const erfassung = {
  // Feste UUID (erfassungsSchema verlangt echte UUID), damit das Beispiel reproduzierbar bleibt (US-13).
  projekt: { projektId: '00000000-0000-4000-8000-00000000a5a5' },
  liegenschaft: {
    adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
  },
  wohnungstypen: [{ id: 'T1', zimmerzahl: 3.5, parametrisierung }],
  einheiten: Array.from({ length: 8 }, (_, i) => ({
    wohnungsnummer: `A-${String(i + 1).padStart(2, '0')}`,
    wohnungstypId: 'T1',
    flaecheInnen: 82,
    flaecheAussen: 0,
    anpassungen: i === 0
      ? [{ faktor: 0.05, erfassungsform: 'relativ',
           begruendung: 'Attikalage mit Dachterrasse.' }]
      : [],
  })),
  aufwandfaktoren: { innenausbau_qualitaet: 3 },
};

const antwort = await POST(new Request('http://localhost/api/offerte', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(erfassung),
}));

const koerper = (await antwort.json()) as Record<string, unknown>;
if (antwort.status !== 201) {
  process.stderr.write(`Beispiel-Offerte nicht erzeugt (${antwort.status}): `
    + `${JSON.stringify(koerper, null, 2)}\n`);
  process.exit(1);
}

const dateien = readdirSync(ABLAGE).filter((n) => n.endsWith('.json'));
process.stdout.write(
  `Beispiel-Offerte erzeugt: ${String(koerper['offertId'])}\n`
  + `Ablage: ${ABLAGE} (${dateien.length} Artefakt(e))\n`);
