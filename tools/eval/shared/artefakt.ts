/**
 * Keine Modellformel. Laufkopf, Artefaktschreiber und Zeiger der Evaluationswerkzeuge.
 *
 * Jedes Artefakt traegt einen Laufkopf mit acht Pflichtfeldern: Er macht jede Zahl im
 * Bericht auf Commit, Konfigurationsdatei und Pruefsumme zurueckfuehrbar — sonst waere
 * ein Artefakt nur eine Behauptung.
 *
 * `latest.json` ist bewusst eine Datei und kein Symlink, damit die Laufauswahl nicht
 * implizit ueber Verzeichnissortierung geschieht.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Laufkopf {
  readonly instrument: string;
  readonly zeitstempel: string;
  readonly git_commit: string;
  readonly git_dirty: boolean;
  readonly node_version: string;
  readonly konfig_datei: string;
  readonly konfig_sha256: string;
  readonly werkzeug_version: number;
}

/** Repositoriumswurzel: drei Ebenen ueber dieser Datei (tools/eval/shared/x.ts). */
export function repoWurzel(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function git(...argumente: readonly string[]): string {
  return execFileSync('git', [...argumente], { cwd: repoWurzel(), encoding: 'utf8' }).trim();
}

export function zeitstempel(jetzt: Date = new Date()): string {
  return jetzt.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
}

export function sha256Datei(pfad: string): string {
  return createHash('sha256').update(readFileSync(pfad)).digest('hex');
}

export function bildeKopf(
  instrument: string,
  konfigDatei: string,
  werkzeugVersion: number,
  wurzel: string = repoWurzel(),
): Laufkopf {
  return {
    instrument,
    zeitstempel: zeitstempel(),
    git_commit: git('rev-parse', 'HEAD'),
    git_dirty: git('status', '--porcelain') !== '',
    node_version: process.version,
    konfig_datei: konfigDatei,
    konfig_sha256: sha256Datei(join(wurzel, konfigDatei)),
    werkzeug_version: werkzeugVersion,
  };
}

export function schreibeArtefakt(
  wurzel: string,
  kopf: Laufkopf,
  dateien: Readonly<Record<string, string>>,
  aktualisiereZeiger = true,
): string {
  // `tests` liegt NICHT unter eval/: dort nur Ausgaben der Evaluationswerkzeuge.
  const ablage = kopf.instrument === 'tests'
    ? join(wurzel, 'artifacts', 'tests')
    : join(wurzel, 'artifacts', 'eval', kopf.instrument);
  const verzeichnis = join(ablage, kopf.zeitstempel);
  mkdirSync(verzeichnis, { recursive: true });
  // Sortierte Reihenfolge: gleicher Inhalt erzeugt dieselbe Abfolge von Schreibvorgaengen (I-14).
  for (const name of Object.keys(dateien).sort()) {
    // PDF in latin1: Der PDF-Schreiber berechnet Byteversaetze der Kreuzreferenztabelle
    // in latin1; unter utf8 belegen Umlaute zwei Bytes und die Versaetze zeigen ins Leere.
    const kodierung: BufferEncoding = name.endsWith('.pdf') ? 'latin1' : 'utf8';
    writeFileSync(join(verzeichnis, name), dateien[name] ?? '', kodierung);
  }
  if (aktualisiereZeiger) {
    writeFileSync(
      join(ablage, 'latest.json'),
      `${JSON.stringify({ verzeichnis, zeitstempel: kopf.zeitstempel }, null, 2)}\n`,
      'utf8',
    );
  }
  return verzeichnis;
}

/**
 * Liest den latest-Zeiger einer Ablage. `ablage` ist der Pfad unterhalb von
 * artifacts/, also 'eval/oat' fuer eigene Artefakte und 'contract', 'integration',
 * 'property', 'scenarios', 'config' fuer die Artefakte aus P1, P2 und P3 (PE-18).
 */
export function leseLatest(wurzel: string, ablage: string): string {
  const pfad = join(wurzel, 'artifacts', ...ablage.split('/'), 'latest.json');
  const zeiger = JSON.parse(readFileSync(pfad, 'utf8')) as {
    verzeichnis?: string; pfad?: string;
  };
  // Zeigerformen sind nicht einheitlich: `verzeichnis` teils repositoriumsrelativ, teils
  // nur der Zeitstempel; teils `pfad` auf die Datei. Statt die Erzeuger zu vereinheitlichen,
  // loest der Leser alle drei Formen auf (einzige Stelle, die den Zeiger liest).
  const roh = zeiger.verzeichnis ?? (zeiger.pfad === undefined ? undefined : dirname(zeiger.pfad));
  if (roh === undefined) {
    throw new Error(`Zeiger ${pfad} nennt weder 'verzeichnis' noch 'pfad'.`);
  }
  if (isAbsolute(roh)) return roh;
  const alsRepoPfad = join(wurzel, roh);
  if (existsSync(alsRepoPfad)) return alsRepoPfad;
  return join(wurzel, 'artifacts', ...ablage.split('/'), roh);
}

/** Stabile Iterationsreihenfolge fuer alle Werkzeuge. */
export function sortiereNachSchluessel<T>(
  abbildung: Readonly<Record<string, T>>,
): readonly (readonly [string, T])[] {
  return Object.keys(abbildung).sort().map((k) => [k, abbildung[k] as T] as const);
}

/**
 * Trennzeichen ist das Semikolon, weil die Zahlen mit Punkt als Dezimaltrennzeichen
 * geschrieben werden und eine Tabellenkalkulation in der Schweizer Gebietseinstellung
 * sonst Spalten und Dezimalstellen verwechselt.
 */
export function alsCsv(
  spalten: readonly string[],
  zeilen: readonly Readonly<Record<string, unknown>>[] | readonly object[],
): string {
  const feld = (wert: unknown): string => {
    const s = wert === null || wert === undefined ? '' : String(wert);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kopf = spalten.map(feld).join(';');
  const koerper = zeilen.map((z) =>
    spalten.map((s) => feld((z as Record<string, unknown>)[s])).join(';'));
  return `${[kopf, ...koerper].join('\n')}\n`;
}
