/**
 * Keine Modellformel. Erzeugt das Diagramm der Honorarkurve aus der Basiskonfiguration.
 *
 * Rein analytisch: gerechnet wird allein auf den Stuetzstellen, es laeuft keine Pipeline.
 *
 * Instrument ist `honorarkurve`, nicht `eval/honorarkurve` — der Artefaktschreiber setzt
 * `artifacts/eval/` bereits selbst davor.
 */
import { alsCsv, bildeKopf, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI, ladeBasis } from '../shared/konfig.ts';
import { schreibePdf } from '../shared/pdf-writer.ts';
import { margeUeberGitter } from '../degression-margin/marge.ts';
import type { Stuetzstelle } from '../degression-margin/honorarkurve.ts';
import { zahl, zeichne, type Markierung } from './diagramm.ts';
import { abtastpunkte, baueKurve, darstellbareStuetzstellen } from './kurve.ts';

/** Dicht genug, dass die Linienzuege glatt wirken; die Stufengrenzen bleiben exakt. */
export const PUNKTE_JE_STUFE = 48;

const RAPPEN_JE_MILLION = 1e8;

export function hauptlauf(wurzel: string = repoWurzel()): string {
  const konfig = ladeBasis(wurzel);
  const stuetz = konfig.honorar.stuetzstellen as readonly Stuetzstelle[];
  const kurve = baueKurve(stuetz, abtastpunkte(stuetz, PUNKTE_JE_STUFE));
  if (kurve.length < 2) throw new Error('Keine darstellbare Honorarkurve in der Konfiguration');
  const vVon = kurve[0]!.v_rappen;
  const vBis = kurve[kurve.length - 1]!.v_rappen;

  const argmin = margeUeberGitter(konfig).argmin;
  const imBereich = argmin !== null && argmin.v1_rappen >= vVon && argmin.v1_rappen <= vBis;
  const markierung: Markierung | null = argmin !== null && imBereich
    ? {
        v_rappen: argmin.v1_rappen,
        beschriftung: `knappste Degressionsmarge M = ${zahl(argmin.m, 4)}`
          + ` bei V = ${zahl(argmin.v1_rappen / RAPPEN_JE_MILLION, 2)} Mio. CHF`,
      }
    : null;

  const kopf = bildeKopf('honorarkurve', BASIS_KONFIG_DATEI, 1, wurzel);
  const seite = zeichne(kurve, {
    titel: 'Honoraranteil an der Verkaufssumme',
    stuetzstellen: darstellbareStuetzstellen(stuetz),
    markierung,
  });

  const artefakt = {
    kopf,
    groesse: 'phi(V) = H(V)/V in Prozent, je Randkurve; Formelbezug eq:honorar_mapping',
    bereich_rappen: { von: vVon, bis: vBis },
    punkte_je_stufe: PUNKTE_JE_STUFE,
    abtastpunkte: kurve.length,
    stuetzstellen_prozent: darstellbareStuetzstellen(stuetz).map((s) => ({
      v_rappen: s.v,
      hMin_prozent: (s.hMin / s.v) * 100,
      hMax_prozent: (s.hMax / s.v) * 100,
    })),
    markierung,
    hinweis_v_null:
      'Die Stuetzstelle V = 0 traegt ein Grundhonorar > 0; phi ist dort nicht definiert '
      + 'und waechst fuer V gegen 0 ueber jede Schranke. Sie ist deshalb kein Kurvenpunkt.',
    hinweis_skalierung:
      'Dargestellt ist die Honorarbasis ohne g(D); g skaliert beide Randkurven gemeinsam '
      + 'und verschiebt die Kurve, ohne ihre Form zu aendern.',
  };

  return schreibeArtefakt(wurzel, kopf, {
    'honorarkurve.pdf': schreibePdf(seite),
    'honorarkurve.csv': alsCsv(['v_rappen', 'hMin_prozent', 'hMax_prozent'], kurve),
    'honorarkurve.json': `${JSON.stringify(artefakt, null, 2)}\n`,
  });
}

if (import.meta.filename === process.argv[1]) {
  process.stdout.write(`Honorarkurven-Artefakte geschrieben: ${hauptlauf()}\n`);
}
