import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoWurzel } from './artefakt.ts';
import { ladeBasis } from './konfig.ts';
import { fuehreAus } from './lauf.ts';
import { ladeSzenarien } from './szenario.ts';

const konfig = ladeBasis();
const szenarien = ladeSzenarien();
const holen = (id: string) => szenarien.find((s) => s.szenario_id === id)!;

describe('fuehreAus', () => {
  it('rechnet S1 durch und liefert Rappenwerte', () => {
    const ergebnis = fuehreAus(holen('S1'), konfig);
    expect(ergebnis.ok).toBe(true);
    expect(Number.isInteger(ergebnis.v_rappen)).toBe(true);
    expect(Number.isInteger(ergebnis.hmin_rappen)).toBe(true);
    expect(ergebnis.d).toBeGreaterThanOrEqual(0);
    expect(ergebnis.d).toBeLessThanOrEqual(1);
  });

  it('liefert bei S5 einen Fehlercode statt eines Ergebnisses (I-24)', () => {
    const ergebnis = fuehreAus(holen('S5'), konfig);
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.fehlercode).not.toBeNull();
    expect(ergebnis.v_rappen).toBeNull();
  });

  it('ist deterministisch (I-14)', () => {
    expect(fuehreAus(holen('S2'), konfig)).toEqual(fuehreAus(holen('S2'), konfig));
  });
});

describe('Abgrenzung der Werkzeugebene (Spec 06 §7)', () => {
  it('tools/eval greift nur auf packages/core und Node-Module zu', () => {
    // PE-09: Der Kern wird relativ eingebunden; auch der Paketname des Kerns ist hier
    // unzulaessig, weil Node fuer node_modules kein Type-Stripping leistet.
    // Die Namen werden zusammengesetzt: Stuenden sie als Literal in dieser Datei,
    // faende die Pruefung sich selbst und waere immer rot.
    const paket = '@offert' + '/';
    const verzeichnis = 'packages' + '/';
    const verbotene = [
      `${paket}core`, `${paket}pricehubble`, `${paket}offer`, `${paket}web`,
      `${verzeichnis}pricehubble`, `${verzeichnis}offer`, `apps${'/'}web`,
      `nex${'t'}`, `reac${'t'}`,
    ];
    const dateien: string[] = [];
    const sammle = (ordner: string): void => {
      for (const eintrag of readdirSync(ordner)) {
        const pfad = join(ordner, eintrag);
        if (statSync(pfad).isDirectory()) sammle(pfad);
        else if (pfad.endsWith('.ts')) dateien.push(pfad);
      }
    };
    sammle(join(repoWurzel(), 'tools', 'eval'));
    expect(dateien.length).toBeGreaterThan(0);
    for (const datei of dateien) {
      const inhalt = readFileSync(datei, 'utf8');
      for (const verboten of verbotene) {
        expect(inhalt.includes(`'${verboten}`), `${datei} importiert ${verboten}`).toBe(false);
      }
    }
  });
});
