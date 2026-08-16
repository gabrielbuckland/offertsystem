/**
 * Einziger Ort, an dem Umgebungsvariablen gelesen werden (Spec 01 §7.2).
 * Kein Rueckfall auf Ersatzwerte: Fehlen bei VALUATION_PROVIDER=pricehubble die
 * Zugangsdaten, bricht der Start ab. I-24 und NFA-10 verbieten, ohne
 * Referenzbewertung ein Ergebnis zu erzeugen; ein stiller Rueckfall auf Mock-
 * oder Fixture-Daten im Live-Betrieb waere in der Offerte nicht erkennbar.
 */

export type ProviderSchalter = 'mock' | 'fixture' | 'pricehubble';

const SCHALTERWERTE: readonly ProviderSchalter[] = ['mock', 'fixture', 'pricehubble'];

export interface Umgebung {
  readonly valuationProvider: ProviderSchalter;
  readonly companyDefaultsPfad: string;
  readonly offertenVerzeichnis: string;
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
    companyDefaultsPfad: nichtLeer(quelle['COMPANY_DEFAULTS_PATH']) ?? './config/company-defaults.json',
    offertenVerzeichnis: nichtLeer(quelle['OFFERTEN_VERZEICHNIS']) ?? './data/offerten',
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
