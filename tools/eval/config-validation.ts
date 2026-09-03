/**
 * Nachweisartefakt der Konfigurationsvalidierung.
 * Positivlauf (je Ebene, mit Zahlenwerten) und Negativmatrix
 * (Variante -> erwarteter Code -> tatsaechlicher Code -> Pass/Fail).
 *
 * Laufzeit: Type-Stripping mit Aufloesungshaken (PE-09); der Import geht
 * relativ auf die Kernquelle, nicht ueber @offert/core.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  berechneNettoDegression,
  validiereKonfiguration,
} from '../../packages/core/src/index.ts';
import { KONSTRUKTIV_AUSGESCHLOSSEN, NEGATIVMATRIX } from '../gen-config-invalid.ts';

const STANDARD = 'config/company-defaults.json';
const FIXTURES = 'packages/core/test/fixtures/config-invalid';

const standard: unknown = JSON.parse(readFileSync(STANDARD, 'utf8'));
const positiv = validiereKonfiguration(standard);

if (!positiv.ok) {
  console.error('Positivlauf fehlgeschlagen:', JSON.stringify(positiv.fehler, null, 2));
  process.exit(1);
}

const gewichte = Object.entries(positiv.wert.aufwandfaktoren)
  .map(([name, faktor]) => ({ faktor: name, gewicht: faktor.gewicht }));
const degression = berechneNettoDegression(positiv.wert);

const negativ = NEGATIVMATRIX.map((eintrag) => {
  const roh: unknown = JSON.parse(readFileSync(join(FIXTURES, eintrag.datei), 'utf8'));
  const ergebnis = validiereKonfiguration(roh);
  const tatsaechlich = ergebnis.ok ? [] : ergebnis.fehler.map((f) => f.code);
  return {
    datei: eintrag.datei,
    verletzung: eintrag.verletzung,
    erwarteterCode: eintrag.code,
    tatsaechlicheCodes: tatsaechlich,
    ergebnisObjektErzeugt: ergebnis.ok,
    status: !ergebnis.ok && tatsaechlich.includes(eintrag.code) ? 'pass' : 'fail',
  };
});

const zeitstempel = new Date().toISOString().replace(/[:.]/g, '-');
const verzeichnis = join('artifacts', 'config', zeitstempel);
mkdirSync(verzeichnis, { recursive: true });

const artefakt = {
  erzeugtAm: new Date().toISOString(),
  quelle: STANDARD,
  konfigVersion: positiv.wert.meta.konfigVersion,
  positivlauf: {
    ebene1: 'bestanden — Struktur, Pflichtfelder, unbekannte Schluessel, Schemaversion',
    ebene2: 'bestanden — lokale Wertebereiche',
    ebene3: 'bestanden — fachliche Invarianten',
    gewichte,
    gewichtssumme: gewichte.reduce((summe, eintrag) => summe + eintrag.gewicht, 0),
    anzahlStuetzstellen: positiv.wert.honorar.stuetzstellen.length,
    hoechsteStuetzstelleRappen: positiv.wert.honorar.stuetzstellen.at(-1)?.v ?? null,
    skalierung: positiv.wert.honorar.skalierung,
    nettoDegression: degression ?? null,
  },
  negativmatrix: negativ,
  konstruktivAusgeschlossen: KONSTRUKTIV_AUSGESCHLOSSEN.map((eintrag) => ({
    ...eintrag,
    status: 'konstruktiv_ausgeschlossen',
  })),
};

const ziel = join(verzeichnis, 'config-validation.json');
writeFileSync(ziel, `${JSON.stringify(artefakt, null, 2)}\n`, 'utf8');

// Zeiger auf den juengsten Lauf (PE-18).
writeFileSync(
  join('artifacts', 'config', 'latest.json'),
  `${JSON.stringify({
    art: 'config-validation',
    erzeugtAm: artefakt.erzeugtAm,
    verzeichnis: zeitstempel,
    datei: join(zeitstempel, 'config-validation.json'),
  }, null, 2)}\n`,
  'utf8',
);

const fehlgeschlagen = negativ.filter((eintrag) => eintrag.status === 'fail');
console.log(`Positivlauf bestanden; ${negativ.length - fehlgeschlagen.length}/${negativ.length} Negativvarianten korrekt zurueckgewiesen.`);
console.log(`Artefakt: ${ziel}`);

if (fehlgeschlagen.length > 0) {
  for (const eintrag of fehlgeschlagen) {
    console.error(`FAIL ${eintrag.datei}: erwartet ${eintrag.erwarteterCode}, erhalten ${eintrag.tatsaechlicheCodes.join(', ') || '(keiner)'}`);
  }
  process.exit(1);
}
