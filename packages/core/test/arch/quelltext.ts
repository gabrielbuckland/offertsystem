// Alle Pruefungen arbeiten auf dem KOMMENTARFREIEN Quelltext: Ein Kommentar, der
// `localeCompare` oder einen Faktorbezeichner nennt, ist oft gerade die Begruendung,
// warum die Sache NICHT geschieht — eine Pruefung auf dem Rohtext bestrafte das.
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../src');

export function quelldateien(unterverzeichnis = ''): readonly string[] {
  const wurzel = unterverzeichnis === '' ? SRC : join(SRC, unterverzeichnis);
  const gesammelt: string[] = [];
  const laufe = (verzeichnis: string): void => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      const pfad = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) laufe(pfad);
      else if (pfad.endsWith('.ts')) gesammelt.push(pfad);
    }
  };
  laufe(wurzel);
  return gesammelt.sort();
}

export function ohneKommentare(inhalt: string): string {
  return inhalt
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((zeile) => {
      const start = zeile.indexOf('//');
      if (start === -1) return zeile;
      // Ein `//` innerhalb einer Zeichenkette (etwa in einer URL) ist kein Kommentar.
      const davor = zeile.slice(0, start);
      const anfuehrungen = (davor.match(/'/g) ?? []).length + (davor.match(/"/g) ?? []).length;
      return anfuehrungen % 2 === 1 ? zeile : davor;
    })
    .join('\n');
}

export function lies(pfad: string): string {
  return readFileSync(pfad, 'utf8');
}

export function kurz(pfad: string): string {
  return pfad.slice(pfad.indexOf('packages/core/src'));
}
