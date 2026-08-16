import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commitsZwischen, numstat, parseNumstat } from './git.ts';

describe('parseNumstat', () => {
  it('liest Zeilen der Form hinzugefuegt<TAB>entfernt<TAB>pfad', () => {
    const e = parseNumstat(
      '10\t0\tpackages/core/src/a.ts\n3\t2\tconfig/company-defaults.json\n', new Set());
    expect(e).toHaveLength(2);
    expect(e[0]).toEqual({
      pfad: 'packages/core/src/a.ts', hinzugefuegt: 10, entfernt: 0, neu: false,
    });
  });

  it('markiert Dateien aus der Neu-Liste', () => {
    expect(parseNumstat('5\t0\tx.ts\n', new Set(['x.ts']))[0]!.neu).toBe(true);
  });

  it('behandelt Binaerdateien als null Zeilen', () => {
    expect(parseNumstat('-\t-\tbild.png\n', new Set())[0])
      .toEqual({ pfad: 'bild.png', hinzugefuegt: 0, entfernt: 0, neu: false });
  });

  it('loest Umbenennungen auf den Zielpfad auf', () => {
    expect(parseNumstat('2\t1\tpackages/core/src/{alt.ts => neu.ts}\n', new Set())[0]!.pfad)
      .toBe('packages/core/src/neu.ts');
  });
});

describe('Messung gegen ein Wegwerf-Repositorium', () => {
  // Ein Test gegen das echte Repositorium waere von dessen Zustand abhaengig und damit
  // nicht reproduzierbar.
  function baueRepo(): string {
    const w = mkdtempSync(join(tmpdir(), 'ext-'));
    const g = (...a: string[]): void => { execFileSync('git', a, { cwd: w }); };
    g('init', '-q');
    g('config', 'user.email', 'test@example.org');
    g('config', 'user.name', 'Test');
    mkdirSync(join(w, 'config'), { recursive: true });
    mkdirSync(join(w, 'packages', 'core', 'src'), { recursive: true });
    writeFileSync(join(w, 'config', 'company-defaults.json'), '{"a":1}\n');
    writeFileSync(join(w, 'packages', 'core', 'src', 'x.ts'), 'export const a = 1;\n');
    g('add', '-A'); g('commit', '-qm', 'Ausgangsstand'); g('tag', 'eval/ff1b-vorher');
    writeFileSync(join(w, 'config', 'company-defaults.json'), '{"a":1,"b":2}\n');
    g('add', '-A'); g('commit', '-qm', 'Risikoindex konfigurieren'); g('tag', 'eval/ff1b-nachher');
    return w;
  }

  it('misst null Codedateien bei reiner Konfigurationsaenderung', () => {
    const w = baueRepo();
    const e = numstat('eval/ff1b-vorher', 'eval/ff1b-nachher', w);
    expect(e).toHaveLength(1);
    expect(e[0]!.pfad).toBe('config/company-defaults.json');
    expect(commitsZwischen('eval/ff1b-vorher', 'eval/ff1b-nachher', w)).toHaveLength(1);
  });
});
