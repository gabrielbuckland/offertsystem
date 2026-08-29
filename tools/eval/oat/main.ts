/**
 * Keine eigene Modellformel; der OAT-Lauf ruft ausschliesslich den Kern.
 *
 * Gemessen wird GETRENNT auf Verkaufssumme und Honorarrange, weil nur das zeigt, ueber
 * welchen Pfad ein Parameter wirkt (subsec:sensitivitaet_design). Das Werkzeug markiert
 * den Pfad und wertet ihn nicht; die Einordnung gehoert in den Fliesstext.
 *
 * D2: `auch_ueber_D` ist der ERWARTETE Befund, kein Verstoss gegen I-28 — alpha geht ueber
 * den abgeleiteten Faktor (flaechengewichteter mittlerer Quadratmeterpreis) in D ein. I-28
 * verbietet, Frankenbetraege mit Scores zu VERRECHNEN; die Normalisierung tilgt die
 * Einheit, und erst ihr dimensionsloses Ergebnis geht in die gewichtete Summe ein.
 *
 * `bildeKopf` erhaelt das Instrument `oat`, nicht `eval/oat` — der Artefaktschreiber
 * setzt `artifacts/eval/` bereits selbst davor.
 */
import { alsCsv, bildeKopf, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI, ladeBasis, ladeBasisRoh, validiere } from '../shared/konfig.ts';
import { fuehreAus, type LaufErgebnis } from '../shared/lauf.ts';
import { prozentFuerArtefakt, relativeAenderungProzent } from '../shared/prozent.ts';
import { ladeSzenarien, type Szenario } from '../shared/szenario.ts';
import { baueVarianten, type Variante } from './varianten.ts';
import type { Konfiguration } from '../../../packages/core/src/index.ts';

/** 6.5 formuliert «mehr als 10 %»: echte Ueberschreitung, nicht `>=`. */
export const DOMINANZ_SCHWELLE_PROZENT = 10;

export type Wirkpfad = 'kein_effekt' | 'nur_ueber_V' | 'auch_ueber_D';

export function istDominant(d: {
  v: number | null; hmin: number | null; hmax: number | null;
}): boolean {
  return [d.v, d.hmin, d.hmax].some(
    (x) => x !== null && Math.abs(x) > DOMINANZ_SCHWELLE_PROZENT,
  );
}

export function bestimmeWirkpfad(d: { dV: number; dH: number; dD: number }): Wirkpfad {
  if (d.dD !== 0) return 'auch_ueber_D';
  if (d.dV === 0 && d.dH === 0) return 'kein_effekt';
  return 'nur_ueber_V';
}

export function berechneBasis(
  szenarien: readonly Szenario[],
  konfig: Konfiguration,
): ReadonlyMap<string, LaufErgebnis> {
  return new Map(szenarien.map((s) => [s.szenario_id, fuehreAus(s, konfig)]));
}

export const OAT_SPALTEN = [
  'dimension', 'parameter_id', 'variation_prozent', 'szenario_id',
  'basis_V_rappen', 'neu_V_rappen', 'delta_V_prozent',
  'basis_Hmin_rappen', 'neu_Hmin_rappen', 'delta_Hmin_prozent',
  'basis_Hmax_rappen', 'neu_Hmax_rappen', 'delta_Hmax_prozent',
  'basis_D', 'neu_D', 'gewichte_vor', 'gewichte_nach',
  'wirkpfad', 'd3_projektion', 'positionen_projiziert', 'dominant', 'status', 'grund',
] as const;

export interface OatZeile {
  readonly dimension: string;
  readonly parameter_id: string;
  readonly variation_prozent: number;
  readonly szenario_id: string;
  readonly basis_V_rappen: number | null;
  readonly neu_V_rappen: number | null;
  readonly delta_V_prozent: number | null;
  readonly basis_Hmin_rappen: number | null;
  readonly neu_Hmin_rappen: number | null;
  readonly delta_Hmin_prozent: number | null;
  readonly basis_Hmax_rappen: number | null;
  readonly neu_Hmax_rappen: number | null;
  readonly delta_Hmax_prozent: number | null;
  readonly basis_D: number | null;
  readonly neu_D: number | null;
  readonly gewichte_vor: Readonly<Record<string, number>> | null;
  readonly gewichte_nach: Readonly<Record<string, number>> | null;
  readonly wirkpfad: Wirkpfad | null;
  readonly d3_projektion: 'korridor' | null;
  readonly positionen_projiziert: number | null;
  readonly dominant: boolean;
  readonly status: 'ok' | 'unzulaessig' | 'fehler';
  readonly grund: string | null;
}

export function baueZeilen(
  varianten: readonly Variante[],
  szenarien: readonly Szenario[],
  basis: ReadonlyMap<string, LaufErgebnis>,
): readonly OatZeile[] {
  const zeilen: OatZeile[] = [];
  for (const v of varianten) {
    const konfig = v.status === 'unzulaessig' ? null : validiere(v.konfigRoh);
    for (const s of szenarien) {
      const b = basis.get(s.szenario_id)!;
      const gemeinsam = {
        dimension: v.dimension,
        parameter_id: v.parameter_id,
        variation_prozent: v.variation_prozent,
        szenario_id: s.szenario_id,
        basis_V_rappen: b.v_rappen,
        basis_Hmin_rappen: b.hmin_rappen,
        basis_Hmax_rappen: b.hmax_rappen,
        basis_D: b.d,
        gewichte_vor: v.gewichte_vor,
        gewichte_nach: v.gewichte_nach,
        d3_projektion: v.dimension === 'D3' ? ('korridor' as const) : null,
      };
      const leer = {
        neu_V_rappen: null, delta_V_prozent: null,
        neu_Hmin_rappen: null, delta_Hmin_prozent: null,
        neu_Hmax_rappen: null, delta_Hmax_prozent: null, neu_D: null,
        wirkpfad: null, dominant: false,
      };
      if (konfig === null || !konfig.ok) {
        zeilen.push({
          ...gemeinsam, ...leer, positionen_projiziert: null,
          status: 'unzulaessig', grund: v.grund,
        });
        continue;
      }
      const umbau = v.szenarioUmbau !== null
        ? v.szenarioUmbau(s)
        : { szenario: s, projiziert: 0 };
      const lauf = fuehreAus(umbau.szenario, konfig.wert);
      if (!lauf.ok || !b.ok) {
        zeilen.push({
          ...gemeinsam, ...leer, positionen_projiziert: umbau.projiziert,
          status: 'fehler', grund: lauf.fehlercode ?? b.fehlercode,
        });
        continue;
      }
      const dV = prozentFuerArtefakt(relativeAenderungProzent(b.v_rappen!, lauf.v_rappen!));
      const dHmin = prozentFuerArtefakt(
        relativeAenderungProzent(b.hmin_rappen!, lauf.hmin_rappen!));
      const dHmax = prozentFuerArtefakt(
        relativeAenderungProzent(b.hmax_rappen!, lauf.hmax_rappen!));
      zeilen.push({
        ...gemeinsam,
        neu_V_rappen: lauf.v_rappen, delta_V_prozent: dV,
        neu_Hmin_rappen: lauf.hmin_rappen, delta_Hmin_prozent: dHmin,
        neu_Hmax_rappen: lauf.hmax_rappen, delta_Hmax_prozent: dHmax,
        neu_D: lauf.d,
        positionen_projiziert: v.dimension === 'D3' ? umbau.projiziert : null,
        wirkpfad: bestimmeWirkpfad({ dV: dV ?? 0, dH: dHmax ?? 0, dD: lauf.d! - b.d! }),
        dominant: istDominant({ v: dV, hmin: dHmin, hmax: dHmax }),
        status: 'ok', grund: null,
      });
    }
  }
  return zeilen;
}

function vektorAlsText(v: Readonly<Record<string, number>> | null): string {
  return v === null ? '' : Object.keys(v).sort().map((k) => `${k}=${v[k]}`).join('|');
}

export function hauptlauf(wurzel: string = repoWurzel()): string {
  const basisRoh = ladeBasisRoh(wurzel);
  const konfig = ladeBasis(wurzel);
  const szenarien = ladeSzenarien(wurzel);
  const basis = berechneBasis(szenarien, konfig);
  const zeilen = baueZeilen(baueVarianten(basisRoh), szenarien, basis);
  const kopf = bildeKopf('oat', BASIS_KONFIG_DATEI, 1, wurzel);
  const csvZeilen = zeilen.map((z) => ({
    ...z,
    gewichte_vor: vektorAlsText(z.gewichte_vor),
    gewichte_nach: vektorAlsText(z.gewichte_nach),
  }));
  return schreibeArtefakt(wurzel, kopf, {
    'oat.json': `${JSON.stringify({ kopf, basis: [...basis.values()], zeilen }, null, 2)}\n`,
    'oat.csv': alsCsv([...OAT_SPALTEN], csvZeilen),
  });
}

if (import.meta.filename === process.argv[1]) {
  process.stdout.write(`OAT-Artefakt geschrieben: ${hauptlauf()}\n`);
}
