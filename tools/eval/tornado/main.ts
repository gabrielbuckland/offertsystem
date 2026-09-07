// Keine Modellformel. Instrument ist 'tornado', nicht 'eval/tornado' — der
// Artefaktschreiber setzt 'artifacts/eval/' bereits selbst davor.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alsCsv, bildeKopf, leseLatest, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI } from '../shared/konfig.ts';
import { schreibePdf } from '../shared/pdf-writer.ts';
import { baueBalken, zeichne, type Balken, type OatZeile } from './diagramm.ts';

const GROESSEN = [
  { schluessel: 'V', feld: 'delta_V_prozent' },
  { schluessel: 'Hmin', feld: 'delta_Hmin_prozent' },
  { schluessel: 'Hmax', feld: 'delta_Hmax_prozent' },
] as const;

export const SCHWELLE_PROZENT = 10;

export function hauptlauf(wurzel: string = repoWurzel()): string {
  const quelle = leseLatest(wurzel, 'eval/oat');
  const oat = JSON.parse(readFileSync(join(quelle, 'oat.json'), 'utf8')) as {
    zeilen: readonly OatZeile[];
  };
  const kopf = bildeKopf('tornado', BASIS_KONFIG_DATEI, 1, wurzel);
  const dateien: Record<string, string> = {};
  const zusammenfassung: Record<string, readonly Balken[]> = {};

  for (const g of GROESSEN) {
    const balken = baueBalken(oat.zeilen, g.feld, SCHWELLE_PROZENT);
    zusammenfassung[g.schluessel] = balken;
    dateien[`tornado-${g.schluessel}.csv`] = alsCsv(
      ['parameter_id', 'dimension', 'negativ_prozent', 'positiv_prozent',
       'negativ_szenario', 'positiv_szenario', 'dominant'],
      balken,
    );
    dateien[`tornado-${g.schluessel}.pdf`] =
      schreibePdf(zeichne(balken, { schwelle: SCHWELLE_PROZENT }));
  }

  dateien['tornado.json'] = `${JSON.stringify(
    { kopf, quelle, schwelle_prozent: SCHWELLE_PROZENT, groessen: zusammenfassung }, null, 2)}\n`;
  return schreibeArtefakt(wurzel, kopf, dateien);
}

if (import.meta.filename === process.argv[1]) {
  process.stdout.write(`Tornado-Artefakte geschrieben: ${hauptlauf()}\n`);
}
