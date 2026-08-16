/**
 * Keine Modellformel. Zugriff auf die Versionsgeschichte ueber das git-Binaerprogramm.
 *
 * `execFileSync` statt einer Git-Bibliothek: Der Zugriff beschraenkt sich auf drei
 * Unterbefehle, und eine Bibliothek braechte eine Abhaengigkeit mit eigener
 * Interpretation der Ausgabe.
 */
import { execFileSync } from 'node:child_process';
import { repoWurzel } from '../shared/artefakt.ts';
import type { DiffEintrag } from './klassifikation.ts';

function git(wurzel: string, ...argumente: readonly string[]): string {
  return execFileSync('git', [...argumente], {
    cwd: wurzel, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
}

export function tagVorhanden(tag: string, wurzel: string = repoWurzel()): boolean {
  try {
    git(wurzel, 'rev-parse', '--verify', `refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
}

export function aufloesen(ref: string, wurzel: string = repoWurzel()): string {
  return git(wurzel, 'rev-parse', ref).trim();
}

/** Loest Umbenennungsschreibweisen wie a/{alt => neu}.ts auf den Zielpfad auf. */
export function loeseUmbenennung(pfad: string): string {
  const treffer = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(pfad);
  if (treffer === null) return pfad;
  return `${treffer[1] ?? ''}${treffer[3] ?? ''}${treffer[4] ?? ''}`.replace(/\/{2,}/g, '/');
}

export function parseNumstat(
  ausgabe: string, neue: ReadonlySet<string>,
): readonly DiffEintrag[] {
  return ausgabe.split('\n').filter((z) => z.trim() !== '').map((zeile) => {
    const [a, e, ...rest] = zeile.split('\t');
    const pfad = loeseUmbenennung(rest.join('\t'));
    return {
      pfad,
      // Binaerdateien meldet git mit '-'; sie zaehlen als null Zeilen.
      hinzugefuegt: a === '-' || a === undefined ? 0 : Number.parseInt(a, 10),
      entfernt: e === '-' || e === undefined ? 0 : Number.parseInt(e, 10),
      neu: neue.has(pfad),
    };
  });
}

export function numstat(
  vorher: string, nachher: string, wurzel: string = repoWurzel(),
): readonly DiffEintrag[] {
  const status = git(wurzel, 'diff', '--name-status', '-M', `${vorher}..${nachher}`);
  const neue = new Set(
    status.split('\n')
      .filter((z) => z.startsWith('A\t'))
      .map((z) => z.split('\t')[1] ?? ''),
  );
  return parseNumstat(git(wurzel, 'diff', '--numstat', '-M', `${vorher}..${nachher}`), neue);
}

export interface Commit {
  readonly hash: string;
  readonly betreff: string;
  readonly dateien: readonly string[];
}

export function commitsZwischen(
  vorher: string, nachher: string, wurzel: string = repoWurzel(),
): readonly Commit[] {
  const hashes = git(wurzel, 'rev-list', '--reverse', `${vorher}..${nachher}`)
    .split('\n').filter((h) => h !== '');
  return hashes.map((hash) => ({
    hash,
    betreff: git(wurzel, 'log', '-1', '--format=%s', hash).trim(),
    dateien: git(wurzel, 'show', '--name-only', '--format=', hash)
      .split('\n').filter((d) => d !== ''),
  }));
}
