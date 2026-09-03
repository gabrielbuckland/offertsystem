/**
 * Keine Modellformel. Erweiterungsszenario als durchfuehrbare Prozedur.
 *
 * Erwartete Richtung der Margenverschiebung: Der Wirkpfad der Einheitenzahl auf g laeuft
 * ausschliesslich ueber w_umfang; jede Renormalisierung durch Aufnahme eines weiteren
 * Faktors senkt w_umfang und schwaecht damit den Pfad, der der Degression entgegenwirkt —
 * die Marge WAECHST also. Kehrt sich die Richtung um, meldet das Werkzeug es als Befund
 * statt es zu uebergehen.
 *
 * Instrument ist `extension-scenario`, nicht `eval/extension-scenario` — der
 * Artefaktschreiber setzt `artifacts/eval/` davor.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { margeUeberGitter } from '../degression-margin/marge.ts';
import { bildeKopf, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI, ladeBasis, ladeBasisRoh, validiere } from '../shared/konfig.ts';
import { fuehreAus } from '../shared/lauf.ts';
import { ladeSzenarien } from '../shared/szenario.ts';
import { erweitereUmRisikoindex, verletzendeVariante } from './konfig-erweiterung.ts';

export interface Margenvergleich {
  readonly margin_min_vorher: number;
  readonly margin_min_nachher: number;
  readonly w_umfang_vorher: number;
  readonly w_umfang_nachher: number;
  readonly richtung_wie_erwartet: boolean;
  readonly beide_erfuellt: boolean;
}

export function vergleicheMargen(wurzel: string = repoWurzel()): Margenvergleich {
  const vorher = margeUeberGitter(ladeBasis(wurzel));
  const erweitert = validiere(erweitereUmRisikoindex(ladeBasisRoh(wurzel)));
  if (!erweitert.ok) throw new Error('Erweiterte Konfiguration ist ungueltig');
  const nachher = margeUeberGitter(erweitert.wert);
  return {
    margin_min_vorher: vorher.margin_min,
    margin_min_nachher: nachher.margin_min,
    w_umfang_vorher: vorher.w_umfang,
    w_umfang_nachher: nachher.w_umfang,
    richtung_wie_erwartet:
      nachher.w_umfang < vorher.w_umfang && nachher.margin_min >= vorher.margin_min,
    beide_erfuellt: vorher.margin_min >= 1 && nachher.margin_min >= 1,
  };
}

export function hauptlauf(wurzel: string = repoWurzel()): string {
  const basisRoh = ladeBasisRoh(wurzel);
  const erweitertRoh = erweitereUmRisikoindex(basisRoh);
  const verletzendRoh = verletzendeVariante(basisRoh);

  writeFileSync(join(wurzel, 'config', 'company-defaults.erweitert.json'),
    `${JSON.stringify(erweitertRoh, null, 2)}\n`, 'utf8');
  writeFileSync(join(wurzel, 'config', 'company-defaults.verletzend.json'),
    `${JSON.stringify(verletzendRoh, null, 2)}\n`, 'utf8');

  const erweitert = validiere(erweitertRoh);
  const verletzend = validiere(verletzendRoh);
  const margen = vergleicheMargen(wurzel);

  const rechenprobe = erweitert.ok
    ? ladeSzenarien(wurzel).map((s) => {
        const e = fuehreAus(s, erweitert.wert);
        return { szenario_id: s.szenario_id, ok: e.ok, fehlercode: e.fehlercode };
      })
    : [];

  const kopf = bildeKopf('extension-scenario', BASIS_KONFIG_DATEI, 1, wurzel);
  const artefakt = {
    kopf,
    erweiterung: {
      faktor: 'risikoindex',
      quelle: 'manuell',
      gewicht: 0.10,
      renormalisierungsfaktor: 0.90,
      renormalisierung_automatisch: false,
      begruendung_nicht_automatisch:
        'Eine automatische Normierung erfuellte die Summenbedingung trivial und beraubte '
        + 'die dritte Pruefebene ihres Zwecks.',
    },
    validierung_erweitert: { ok: erweitert.ok, fehler: erweitert.ok ? [] : erweitert.fehler },
    validierung_verletzend: {
      ok: verletzend.ok,
      erwartet: 'Zurueckweisung mit CFG_WEIGHTS_SUM (I-12)',
      fehler: verletzend.ok ? [] : verletzend.fehler,
      zurueckgewiesen: !verletzend.ok,
    },
    margen,
    rechenprobe,
    dateien: [
      'config/company-defaults.erweitert.json',
      'config/company-defaults.verletzend.json',
    ],
    prozedur: 'docs/testdoku/erweiterung-risikoindex.md',
  };
  return schreibeArtefakt(wurzel, kopf, {
    'szenario.json': `${JSON.stringify(artefakt, null, 2)}\n`,
  });
}

if (import.meta.filename === process.argv[1]) {
  process.stdout.write(`Erweiterungsszenario-Artefakt geschrieben: ${hauptlauf()}\n`);
}
