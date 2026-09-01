// Einmalwerkzeug: bringt die Referenzobjekte abgelegter Projekte auf die feste
// PriceHubble-Bewertungsmenge. Nach dem Lauf nicht Teil der Pruefkette.
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
// Relativ mit `.ts`-Endung wie `tools/beispiel-offerte.ts`: Die Werkzeuglaufzeit
// (`node --experimental-strip-types --import ./tools/ts-aufloeser.mjs`) loest die
// `@offert/*`-Aliase NICHT auf — der Haken bildet nur `.js` auf `.ts` unter packages/
// und apps/ ab, die Paketnamen zeigten auf ein womoeglich veraltetes `dist/`.
import { BEWERTUNGSFELDER } from '../packages/core/src/config/bewertungen.ts';

const ZUSTAND_STANDARD = 'well_maintained';
const QUALITAET_STANDARD = 'normal';

// Die einzigen Werte, die die bisherige Konfiguration je gefuehrt hat.
const ZUSTAND_AUS_ALT: Readonly<Record<string, string>> = {
  '3': 'new_or_recently_renovated',
  'Neu / kürzlich modernisiert': 'new_or_recently_renovated',
};
const QUALITAET_AUS_ALT: Readonly<Record<string, string>> = { gehoben: 'high_quality' };

function belege(
  alt: unknown, abbildung: Readonly<Record<string, string>>, standard: string,
): Record<string, string> {
  const werte = typeof alt === 'object' && alt !== null ? Object.entries(alt) : [];
  // Ein einziger Altwert galt fuer das ganze Objekt; er wird auf alle vier Felder gelegt.
  const treffer = werte
    .map(([k, v]) => abbildung[String(v)] ?? abbildung[k])
    .find((w) => w !== undefined);
  return Object.fromEntries(BEWERTUNGSFELDER.map((f) => [f, treffer ?? standard]));
}

export function migriereParametrisierung(
  roh: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...roh,
    zustandsbewertungen: belege(roh['zustandsbewertungen'], ZUSTAND_AUS_ALT, ZUSTAND_STANDARD),
    qualitaetsbewertungen: belege(
      roh['qualitaetsbewertungen'], QUALITAET_AUS_ALT, QUALITAET_STANDARD,
    ),
  };
}

async function main(): Promise<void> {
  const verzeichnis = join(process.cwd(), 'data', 'projekte');
  const dateien = (await fs.readdir(verzeichnis)).filter((d) => d.endsWith('.json'));
  for (const datei of dateien) {
    const pfad = join(verzeichnis, datei);
    const projekt = JSON.parse(await fs.readFile(pfad, 'utf8')) as Record<string, unknown>;
    const referenzobjekte = projekt['referenzobjekte'];
    if (!Array.isArray(referenzobjekte)) continue;
    projekt['referenzobjekte'] = referenzobjekte.map((r: Record<string, unknown>) => ({
      ...r,
      parametrisierung: migriereParametrisierung(
        r['parametrisierung'] as Record<string, unknown>,
      ),
    }));
    await fs.writeFile(pfad, `${JSON.stringify(projekt, null, 2)}\n`, 'utf8');
    process.stdout.write(`migriert: ${datei}\n`);
  }
}

if (process.argv[1]?.endsWith('migriere-bewertungen.ts') === true) await main();
