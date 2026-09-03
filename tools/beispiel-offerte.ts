/**
 * Erzeugt die Beispiel-Offerte, die Anhang A5 referenziert.
 *
 * Sie entsteht ueber DENSELBEN Route Handler wie im Betrieb (POST /api/offerte) — nicht
 * ueber einen eigenen Zusammenbau. Eine zweite Erzeugungsstrecke koennte abweichen, und
 * die Beispiel-Offerte belegte dann nicht mehr, was das System tut.
 *
 * Der Provider ist der Mock; ein realer Abruf ist an einen spaeteren Ausbauschritt
 * gebunden (E-31).
 *
 * Laufzeit: node --experimental-strip-types --import ./tools/ts-aufloeser.mjs (PE-09).
 */
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POST } from '../apps/web/src/app/api/offerte/route.ts';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ABLAGE = join(WURZEL, 'data', 'offerten');

process.env['VALUATION_PROVIDER'] ??= 'mock';
process.env['COMPANY_DEFAULTS_PATH'] ??= join(WURZEL, 'config', 'company-defaults.json');
process.env['OFFERTEN_VERZEICHNIS'] ??= ABLAGE;

// Lokal statt aus apps/web/test importiert: tools/ steht ausserhalb der Abhaengigkeitsmatrix,
// soll aber nicht in den Testbaum einer App greifen.
const BEWERTUNGEN_STANDARD = {
  zustandsbewertungen: {
    bathrooms: 'well_maintained', kitchen: 'well_maintained',
    flooring: 'well_maintained', windows: 'well_maintained',
  },
  qualitaetsbewertungen: {
    bathrooms: 'normal', kitchen: 'normal', flooring: 'normal', windows: 'normal',
  },
} as const;

const parametrisierung = {
  flaecheInnen: 92.5, flaecheAussen: 0, stockwerk: 2, energielabel: 'minergie_eco',
  ...BEWERTUNGEN_STANDARD,
  anzahlBadezimmer: 1, lift: false, baujahr: 2025, heizungsart: 'heat_pump_air',
};

const erfassung = {
  // Feste UUID statt einer erfundenen Referenznummer: `erfassungsSchema` verlangt eine
  // echte UUID; fest statt erzeugt, damit das Beispiel reproduzierbar bleibt (US-13).
  projekt: { projektId: '00000000-0000-4000-8000-00000000a5a5' },
  liegenschaft: {
    adresse: { strasse: 'Dorfstrasse', hausnummer: '4', plz: '6015', ort: 'Reussbuehl' },
  },
  wohnungstypen: [{ id: 'T1', zimmerzahl: 3.5, parametrisierung }],
  einheiten: Array.from({ length: 8 }, (_, i) => ({
    wohnungsnummer: `A-${String(i + 1).padStart(2, '0')}`,
    wohnungstypId: 'T1',
    flaecheInnen: 92.5,
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
