/**
 * Einziger Ort, an dem Umgebungsvariablen gelesen werden (Spec 01 §7.2).
 * Kein Rueckfall auf Ersatzwerte: Fehlen bei VALUATION_PROVIDER=pricehubble die
 * Zugangsdaten, bricht der Start ab. I-24 und NFA-10 verbieten, ohne
 * Referenzbewertung ein Ergebnis zu erzeugen; ein stiller Rueckfall auf Mock-
 * oder Fixture-Daten im Live-Betrieb waere in der Offerte nicht erkennbar.
 *
 * Die Vorgabepfade werden gegen die Wurzel des Arbeitsbereichs aufgeloest, nicht
 * gegen `process.cwd()`. Grund: `next dev` laeuft mit `apps/web` als
 * Arbeitsverzeichnis. Relative Vorgaben zeigten dadurch auf
 * `apps/web/config/company-defaults.json` und `apps/web/data/offerten` -- die
 * Erfassung brach mit CFG_SCHEMA_TYPE ab, und Offerten waeren im Paket der
 * Zugriffsschicht statt in der Ablage des Arbeitsbereichs gelandet. Die
 * Werkzeuge unter `tools/` leiten ihre Wurzel seit jeher aus `import.meta.url`
 * ab; die Zugriffsschicht tut es damit genauso.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sucht aufwaerts nach der Wurzel des Arbeitsbereichs. Kennzeichen ist eine
 * `package.json`, die `workspaces` deklariert -- dieselbe Datei, die npm als
 * Wurzel behandelt. Gesucht wird ab dem Ort dieses Moduls; unter dem gebauten
 * Next-Server liegt das innerhalb von `apps/web`, sodass der Aufstieg dieselbe
 * Wurzel findet.
 */
function findeArbeitsbereichsWurzel(start: string): string | undefined {
  let verzeichnis = start;
  for (;;) {
    const manifest = join(verzeichnis, 'package.json');
    if (existsSync(manifest)) {
      try {
        const roh = JSON.parse(readFileSync(manifest, 'utf8')) as { workspaces?: unknown };
        if (roh.workspaces !== undefined) return verzeichnis;
      } catch {
        // Unlesbares Manifest ist kein Grund abzubrechen; der Aufstieg geht weiter.
      }
    }
    const oben = dirname(verzeichnis);
    if (oben === verzeichnis) return undefined;
    verzeichnis = oben;
  }
}

const WURZEL =
  findeArbeitsbereichsWurzel(dirname(fileURLToPath(import.meta.url)))
  ?? findeArbeitsbereichsWurzel(process.cwd())
  ?? process.cwd();

/**
 * Absolute Pfade bleiben unveraendert. Relative Angaben -- die Vorgaben ebenso
 * wie eine relativ gesetzte Umgebungsvariable -- werden gegen die Wurzel des
 * Arbeitsbereichs aufgeloest, damit derselbe Wert unabhaengig davon gilt, aus
 * welchem Verzeichnis der Prozess gestartet wurde.
 */
function anWurzel(pfad: string): string {
  return isAbsolute(pfad) ? pfad : resolve(WURZEL, pfad);
}

export type ProviderSchalter = 'mock' | 'fixture' | 'pricehubble';

const SCHALTERWERTE: readonly ProviderSchalter[] = ['mock', 'fixture', 'pricehubble'];

export interface Umgebung {
  readonly valuationProvider: ProviderSchalter;
  readonly companyDefaultsPfad: string;
  readonly offertenVerzeichnis: string;
  readonly projekteVerzeichnis: string;
  readonly phBaseUrl: string | undefined;
  readonly phUsername: string | undefined;
  readonly phPassword: string | undefined;
  readonly phDossierId: string | undefined;
}

export type UmgebungsErgebnis =
  | { readonly ok: true; readonly wert: Umgebung }
  | { readonly ok: false; readonly meldungen: readonly string[] };

function istSchalter(wert: string): wert is ProviderSchalter {
  return (SCHALTERWERTE as readonly string[]).includes(wert);
}

function nichtLeer(wert: string | undefined): string | undefined {
  return wert !== undefined && wert.trim() !== '' ? wert : undefined;
}

export function leseUmgebung(
  quelle: Readonly<Record<string, string | undefined>>,
): UmgebungsErgebnis {
  const meldungen: string[] = [];
  const rohSchalter = nichtLeer(quelle['VALUATION_PROVIDER']) ?? 'mock';

  if (!istSchalter(rohSchalter)) {
    return {
      ok: false,
      meldungen: [
        `VALUATION_PROVIDER='${rohSchalter}' ist unbekannt. Zulaessig: ${SCHALTERWERTE.join(', ')}.`,
      ],
    };
  }

  const umgebung: Umgebung = {
    valuationProvider: rohSchalter,
    companyDefaultsPfad: anWurzel(
      nichtLeer(quelle['COMPANY_DEFAULTS_PATH']) ?? 'config/company-defaults.json',
    ),
    offertenVerzeichnis: anWurzel(nichtLeer(quelle['OFFERTEN_VERZEICHNIS']) ?? 'data/offerten'),
    projekteVerzeichnis: anWurzel(nichtLeer(quelle['PROJEKTE_VERZEICHNIS']) ?? 'data/projekte'),
    phBaseUrl: nichtLeer(quelle['PH_BASE_URL']),
    phUsername: nichtLeer(quelle['PH_USERNAME']),
    phPassword: nichtLeer(quelle['PH_PASSWORD']),
    phDossierId: nichtLeer(quelle['PH_DOSSIER_ID']),
  };

  if (umgebung.valuationProvider === 'pricehubble') {
    const pflicht: ReadonlyArray<readonly [string, string | undefined]> = [
      ['PH_BASE_URL', umgebung.phBaseUrl],
      ['PH_USERNAME', umgebung.phUsername],
      ['PH_PASSWORD', umgebung.phPassword],
      ['PH_DOSSIER_ID', umgebung.phDossierId],
    ];
    for (const [name, wert] of pflicht) {
      if (wert === undefined) {
        meldungen.push(
          `${name} fehlt, wird aber bei VALUATION_PROVIDER=pricehubble benoetigt. `
          + 'Es gibt keinen Rueckfall auf Mock- oder Fixture-Daten (I-24, NFA-10).',
        );
      }
    }
  }

  return meldungen.length > 0 ? { ok: false, meldungen } : { ok: true, wert: umgebung };
}
