// Margen-Rechner (eq:netto_degression), rein analytisch aus Stuetzstellen und
// g-Bildbereich — es wird KEINE Konfiguration gerechnet (Test belegt das).
// Instrument heisst `degression`, nicht `eval/degression`: der Artefaktschreiber
// setzt `artifacts/eval/` bereits selbst davor.
import { bildeKopf, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI, ladeBasis } from '../shared/konfig.ts';
import {
  kritischerParameter,
  loeseSpanne,
  loeseStuetzstellen,
  loeseUmfangsgewicht,
} from './aufloesung.ts';
import { honorarbasis, type Stuetzstelle } from './honorarkurve.ts';
import {
  DELTA_BEREICH,
  LAMBDA_SCHWELLE_GROSS,
  M1_BEREICH,
  margeUeberGitter,
  stichprobeV1,
} from './marge.ts';

export function hauptlauf(wurzel: string = repoWurzel()): string {
  const konfig = ladeBasis(wurzel);
  const befund = margeUeberGitter(konfig);
  const a = befund.argmin;
  if (a === null) throw new Error('Kein auswertbares Projektpaar im Gitter gefunden');

  const stuetz = konfig.honorar.stuetzstellen as readonly Stuetzstelle[];
  const skal = konfig.honorar.skalierung;
  const spanne = skal.gMax - skal.gMin;
  const h0 = stuetz[0]![a.randkurve];
  const h1 = honorarbasis(stuetz, a.randkurve, a.v1_rappen)!;
  const h2 = honorarbasis(stuetz, a.randkurve, a.v2_rappen)!;

  const aufloesungen = [
    loeseSpanne({ gMin: skal.gMin, spanne, d1: a.d1, d2: a.d2, r: a.r }),
    loeseUmfangsgewicht({
      gMin: skal.gMin, spanne, w: befund.w_umfang,
      x1: befund.w_umfang === 0 ? 0 : a.d1 / befund.w_umfang,
      x2: befund.w_umfang === 0 ? 0 : a.d2 / befund.w_umfang,
      r: a.r,
    }),
    loeseStuetzstellen({ h0, a1: h1 - h0, a2: h2 - h0, lambda: a.m2 / a.m1, l: a.l }),
  ];

  const kopf = bildeKopf('degression', BASIS_KONFIG_DATEI, 1, wurzel);
  const artefakt = {
    kopf,
    bedingung: 'eq:netto_degression, erfuellt genau dann, wenn margin_min >= 1',
    margin_min: befund.margin_min,
    margin_min_grosser_sprung: befund.margin_min_grosser_sprung,
    lambda_schwelle_grosser_sprung: LAMBDA_SCHWELLE_GROSS,
    margin_min_je_randkurve: befund.margin_min_je_randkurve,
    argmin: befund.argmin,
    gitter: {
      m1_von: M1_BEREICH.von, m1_bis: M1_BEREICH.bis,
      delta_von: DELTA_BEREICH.von, delta_bis: DELTA_BEREICH.bis,
      v1_punkte: stichprobeV1(stuetz).length,
      konstellationen_geprueft: befund.konstellationen_geprueft,
      konstellationen_verworfen: befund.konstellationen_verworfen,
      verwerfungsgrund:
        'V2 oberhalb der letzten Stuetzstelle; Modell dort nicht definiert (E-04)',
    },
    l_obergrenze_grob: befund.l_obergrenze_grob,
    l_obergrenze_scharf: befund.l_obergrenze_scharf,
    w_umfang: befund.w_umfang,
    kritischer_parameter: kritischerParameter(aufloesungen),
    benoetigte_variation: aufloesungen,
    stuetzstellen_familie:
      'H_theta(V) = H0 + (1+theta)*(H(V) - H0); V_k und H0 bleiben fest',
    hinweis_ausfuehrung:
      'Rein analytisch aus Stuetzstellen und g-Bildbereich; es wurde keine Konfiguration gerechnet.',
  };
  return schreibeArtefakt(wurzel, kopf, {
    'margin.json': `${JSON.stringify(artefakt, null, 2)}\n`,
  });
}

if (import.meta.filename === process.argv[1]) {
  process.stdout.write(`Margen-Artefakt geschrieben: ${hauptlauf()}\n`);
}
