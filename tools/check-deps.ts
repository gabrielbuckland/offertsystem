/**
 * R4 — Deklarationsdisziplin: prueft die package.json-Deklarationen und die
 * tatsaechlichen Importe gegen die Abhaengigkeitsmatrix.
 *
 * Laufzeit: node --experimental-strip-types (PE-09). Deshalb kein enum, keine
 * namespace-Deklaration und keine Parametereigenschaften — Type-Stripping
 * entfernt Typen, es uebersetzt nicht.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Paketname = '@offert/core' | '@offert/pricehubble' | '@offert/offer' | '@offert/web';

const MATRIX: Readonly<Record<Paketname, readonly Paketname[]>> = {
  '@offert/core': [],
  '@offert/pricehubble': ['@offert/core'],
  '@offert/offer': ['@offert/core'],
  '@offert/web': ['@offert/core', '@offert/pricehubble', '@offert/offer'],
};

const ORTE: Readonly<Record<Paketname, string>> = {
  '@offert/core': 'packages/core',
  '@offert/pricehubble': 'packages/pricehubble',
  '@offert/offer': 'packages/offer',
  '@offert/web': 'apps/web',
};

function quelldateien(verzeichnis: string): string[] {
  let eintraege: string[];
  try {
    eintraege = readdirSync(verzeichnis);
  } catch {
    return [];
  }
  const gesammelt: string[] = [];
  for (const eintrag of eintraege) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) gesammelt.push(...quelldateien(pfad));
    else if (pfad.endsWith('.ts') || pfad.endsWith('.tsx')) gesammelt.push(pfad);
  }
  return gesammelt;
}

const fehler: string[] = [];

for (const [paket, ort] of Object.entries(ORTE) as ReadonlyArray<[Paketname, string]>) {
  const manifest = JSON.parse(readFileSync(join(ort, 'package.json'), 'utf8')) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const deklariert = Object.keys(manifest.dependencies ?? {})
    .filter((name): name is Paketname => name.startsWith('@offert/'));
  const erlaubt = MATRIX[paket];

  for (const abhaengigkeit of deklariert) {
    if (!erlaubt.includes(abhaengigkeit)) {
      fehler.push(`${paket}: Deklaration '${abhaengigkeit}' widerspricht der Abhaengigkeitsmatrix (Spec 01 §2.2).`);
    }
  }

  const benutzt = new Set<Paketname>();
  const dateien = [...quelldateien(join(ort, 'src')), ...quelldateien(join(ort, 'test'))];
  for (const datei of dateien) {
    const inhalt = readFileSync(datei, 'utf8');
    for (const treffer of inhalt.matchAll(/from\s+['"](@offert\/[a-z-]+)['"]/g)) {
      const name = treffer[1];
      if (name !== undefined) benutzt.add(name as Paketname);
    }
  }

  for (const abhaengigkeit of benutzt) {
    if (abhaengigkeit === paket) continue;
    if (!erlaubt.includes(abhaengigkeit)) {
      fehler.push(`${paket}: Import '${abhaengigkeit}' ist nach der Abhaengigkeitsmatrix verboten.`);
    } else if (!deklariert.includes(abhaengigkeit)) {
      fehler.push(`${paket}: Import '${abhaengigkeit}' ist nicht in dependencies deklariert.`);
    }
  }
}

if (fehler.length > 0) {
  for (const zeile of fehler) console.error(zeile);
  process.exit(1);
}

console.log('check:deps ok — Abhaengigkeitsmatrix (Spec 01 §2.2) eingehalten.');
