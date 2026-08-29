/**
 * Keine Modellformel. Vitest-Reporter: schreibt genau ein Testartefakt je Lauf.
 *
 * Er ist im Wurzelblock der Vitest-Konfiguration eingetragen. Damit faellt aus JEDEM
 * Testlauf ein Artefakt; es gibt keinen Pfad, auf dem ein Testergebnis in den Anhang
 * gelangt, ohne durch `tests.json` gelaufen zu sein.
 *
 * Fehlt eines der fuenf Metadatenfelder, traegt es `null` — der Anhanggenerator setzt
 * dafuer sichtbar «METADATEN FEHLEN» (Spec 06 §8.2), statt still zu schweigen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bildeKopf, leseLatest, repoWurzel, schreibeArtefakt } from '../shared/artefakt.ts';
import { BASIS_KONFIG_DATEI } from '../shared/konfig.ts';

export interface Testfall {
  readonly datei: string;
  readonly suite: string | null;
  readonly name: string;
  readonly zustand: 'pass' | 'fail' | 'skip';
  readonly dauer_ms: number | null;
  readonly vorbedingung: string | null;
  readonly schritte: string | null;
  readonly erwartung: string | null;
  readonly invariante: string | null;
  readonly anforderung: string | null;
  readonly fehlermeldung: string | null;
}

interface RohAufgabe {
  readonly type?: string;
  readonly name?: string;
  readonly mode?: string;
  readonly tasks?: readonly RohAufgabe[];
  readonly meta?: Readonly<Record<string, string | undefined>>;
  readonly result?: {
    readonly state?: string;
    readonly duration?: number;
    readonly errors?: readonly { readonly message?: string }[];
  };
}

interface RohDatei {
  readonly filepath: string;
  readonly tasks?: readonly RohAufgabe[];
}

const ANFORDERUNGEN = JSON.parse(readFileSync(
  join(repoWurzel(), 'tools', 'eval', 'report', 'anforderungen.json'), 'utf8'),
) as readonly { id: string }[];

export function pruefeAnforderungsIds(faelle: readonly Testfall[]): readonly string[] {
  const bekannt = new Set(ANFORDERUNGEN.map((a) => a.id));
  return [...new Set(
    faelle.map((f) => f.anforderung).filter((a): a is string => a !== null && !bekannt.has(a)),
  )].sort();
}

export function faelleAus(dateien: readonly RohDatei[], wurzel: string): readonly Testfall[] {
  const faelle: Testfall[] = [];
  const gehe = (aufgabe: RohAufgabe, datei: string, suite: string | null): void => {
    if (aufgabe.type === 'suite') {
      for (const kind of aufgabe.tasks ?? []) gehe(kind, datei, aufgabe.name ?? suite);
      return;
    }
    const meta = aufgabe.meta ?? {};
    faelle.push({
      datei, suite, name: aufgabe.name ?? '(ohne Namen)',
      zustand: aufgabe.result?.state === 'fail'
        ? 'fail'
        : aufgabe.mode === 'skip' ? 'skip' : 'pass',
      dauer_ms: aufgabe.result?.duration ?? null,
      vorbedingung: meta['vorbedingung'] ?? null,
      schritte: meta['schritte'] ?? null,
      erwartung: meta['erwartung'] ?? null,
      invariante: meta['invariante'] ?? null,
      anforderung: meta['anforderung'] ?? null,
      fehlermeldung: aufgabe.result?.errors?.[0]?.message ?? null,
    });
  };
  for (const d of dateien) {
    const datei = relative(wurzel, d.filepath);
    for (const aufgabe of d.tasks ?? []) gehe(aufgabe, datei, null);
  }
  return faelle;
}

/**
 * Nur ein Lauf mit annotierter Kernalgorithmik darf den latest-Zeiger tragen:
 * Der Anhanggenerator (a5.ts) baut den Nachweis aus dem letzten vollstaendigen
 * Lauf; Teil-Laeufe (Contract-only, Einzeldateien) wuerden ihn sonst mit einer
 * Basis ohne dokumentierte Faelle ueberschreiben und den naechsten
 * `verify`-Lauf grundlos scheitern lassen (F-077).
 */
export function traegtDokumentierteFaelle(faelle: readonly Testfall[]): boolean {
  return faelle.some(
    (f) => f.vorbedingung !== null || f.schritte !== null || f.erwartung !== null,
  );
}

function leseSeed(wurzel: string): number | null {
  try {
    const pfad = join(leseLatest(wurzel, 'property'), 'properties.json');
    if (!existsSync(pfad)) return null;
    return (JSON.parse(readFileSync(pfad, 'utf8')) as { seed?: number }).seed ?? null;
  } catch {
    return null;
  }
}

export default class TestartefaktReporter {
  public onFinished(dateien: readonly RohDatei[] = []): void {
    const wurzel = repoWurzel();
    const faelle = faelleAus(dateien, wurzel);
    const unbekannt = pruefeAnforderungsIds(faelle);
    const kopf = bildeKopf('tests', BASIS_KONFIG_DATEI, 1, wurzel);
    schreibeArtefakt(wurzel, kopf, {
      'tests.json': `${JSON.stringify({
        kopf, seed: leseSeed(wurzel), faelle, unbekannte_anforderungs_ids: unbekannt,
      }, null, 2)}\n`,
    }, traegtDokumentierteFaelle(faelle));
    if (unbekannt.length > 0) {
      throw new Error(`Unbekannte Anforderungs-IDs in Test-Tags: ${unbekannt.join(', ')}`);
    }
  }
}
