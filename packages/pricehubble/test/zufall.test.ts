import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  erzeugeZufallsquelle,
  jitterStromAusLaufSeed,
} from '../src/client/zufall.js';

describe('deterministische Zufallsquelle (E-27, G-5)', () => {
  it('liefert bei gleichem Startwert dieselbe Folge', () => {
    const a = erzeugeZufallsquelle(4242);
    const b = erzeugeZufallsquelle(4242);
    const folgeA = [a(), a(), a(), a(), a()];
    const folgeB = [b(), b(), b(), b(), b()];
    expect(folgeA).toEqual(folgeB);
  });

  it('liefert bei verschiedenen Startwerten verschiedene Folgen', () => {
    const a = erzeugeZufallsquelle(1);
    const b = erzeugeZufallsquelle(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('liefert ausschliesslich Werte in [0, 1)', () => {
    const q = erzeugeZufallsquelle(99);
    for (let i = 0; i < 1000; i += 1) {
      const wert = q();
      expect(wert).toBeGreaterThanOrEqual(0);
      expect(wert).toBeLessThan(1);
    }
  });

  it('leitet den Jitter-Strom als seed XOR 1 aus dem Lauf-Seed ab', () => {
    const ausLauf = jitterStromAusLaufSeed(4242);
    const direkt = erzeugeZufallsquelle(4242 ^ 1);
    expect([ausLauf(), ausLauf(), ausLauf()]).toEqual([direkt(), direkt(), direkt()]);
  });
});

/**
 * Entfernt Zeilen- und Blockkommentare.
 *
 * Ohne diesen Schritt schluege die Pruefung an `zufall.ts` an — dessen Kopfkommentar
 * sagt ausdruecklich, dass der Generator `Math.random` ERSETZT. Eine Pruefung auf dem
 * Rohtext bestrafte damit die Begruendung und setzte einen Anreiz, sie zu loeschen.
 */
function ohneKommentare(inhalt: string): string {
  return inhalt
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((zeile) => {
      const start = zeile.indexOf('//');
      return start === -1 ? zeile : zeile.slice(0, start);
    })
    .join('\n');
}

function alleQuelldateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag);
    return statSync(pfad).isDirectory() ? alleQuelldateien(pfad) : [pfad];
  });
}

describe('Determinismus-Regeln des Pakets (AK-19, AK-15)', () => {
  const wurzel = fileURLToPath(new URL('../src', import.meta.url));

  it('enthaelt kein Math.random', () => {
    const treffer = alleQuelldateien(wurzel).filter((pfad) =>
      ohneKommentare(readFileSync(pfad, 'utf8')).includes('Math.random'),
    );
    expect(treffer).toEqual([]);
  });

  it('enthaelt kein Math.round (Rundung nur ueber rundeAufRappen, E-10)', () => {
    const treffer = alleQuelldateien(wurzel).filter((pfad) =>
      ohneKommentare(readFileSync(pfad, 'utf8')).includes('Math.round'),
    );
    expect(treffer).toEqual([]);
  });
});
