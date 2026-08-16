import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kurz, lies, quelldateien } from './quelltext.js';

/**
 * Die Formellabels stehen im Berichtsrepository, nicht hier. Der Pfad kommt aus
 * `BA_MAIN` — derselben Variablen, die `.env.example` fuer die Auswertungswerkzeuge
 * fuehrt (PE-24). Ohne sie wird der Standardort neben diesem Repository versucht;
 * ist auch der nicht da, MELDET die Pruefung das und laeuft nicht stillschweigend
 * gruen durch: Eine Zusicherung ueber Formelverweise, die mangels Bericht niemand
 * pruefen kann, waere ein leeres Versprechen.
 */
function berichtsverzeichnis(): string | undefined {
  const kandidaten = [
    process.env['BA_MAIN'],
    resolve(import.meta.dirname, '../../../../../bachelorarbeit'),
  ].filter((k): k is string => k !== undefined);
  return kandidaten.find((k) => existsSync(join(k, 'chapters')));
}

function definierteLabels(wurzel: string): ReadonlySet<string> {
  const labels = new Set<string>();
  const verzeichnis = join(wurzel, 'chapters');
  for (const datei of readdirSync(verzeichnis)) {
    if (!datei.endsWith('.tex')) continue;
    for (const m of readFileSync(join(verzeichnis, datei), 'utf8').matchAll(/\\label\{(eq:[^}]+)\}/g)) {
      labels.add(m[1]!);
    }
  }
  return labels;
}

const wurzel = berichtsverzeichnis();

describe('E-32 / NFA-14 — Formelverweise im Quellcode', () => {
  const dateien = quelldateien().filter((d) => !d.endsWith('index.ts'));

  it('jede Datei traegt im Kopfkommentar einen Formelverweis oder den Vermerk "Keine Formel"', () => {
    for (const d of dateien) {
      const kopf = lies(d).split('\n').slice(0, 20).join('\n');
      const hatVerweis = /eq:[a-z_]+/.test(kopf);
      const hatVermerk = /Keine (eigene )?Formel/i.test(kopf);
      expect(hatVerweis || hatVermerk, `${kurz(d)} ohne Formelverweis`).toBe(true);
    }
  });

  it('das Berichtsrepository ist auffindbar — sonst ist der Verweisnachweis nicht fuehrbar', () => {
    expect(wurzel, 'BA_MAIN zeigt auf kein Verzeichnis mit chapters/').toBeDefined();
  });

  it('jeder verwiesene Bezeichner ist ein im Bericht definiertes Formellabel', () => {
    if (wurzel === undefined) return;
    const labels = definierteLabels(wurzel);
    expect(labels.size).toBeGreaterThan(0);
    for (const d of dateien) {
      for (const m of lies(d).matchAll(/eq:[a-z_]+/g)) {
        expect([...labels], `${kurz(d)} verweist auf ${m[0]}`).toContain(m[0]);
      }
    }
  });

  it('jede der sieben Modellformeln hat mindestens eine Fundstelle im Kern', () => {
    const gesamt = dateien.map((d) => lies(d)).join('\n');
    for (const label of ['eq:flaeche', 'eq:qm_preis', 'eq:wohnungspreis', 'eq:verkaufssumme',
      'eq:normalisierung', 'eq:aufwandindikator', 'eq:honorar_mapping']) {
      expect(gesamt, `${label} kommt im Kern nicht vor`).toContain(label);
    }
  });
});
