import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Nachweisart = 'contract' | 'integration';

// F-064: feste Kategorienmenge macht «alle vier Kategorien gefahren» am Artefakt pruefbar.
export type Fehlerkategorie =
  | 'Transport/Verfügbarkeit'
  | 'Zugriffs-/Anfragefehler'
  | 'Kontingent'
  | 'Vertragsbruch'
  | 'keine';

export interface KategorieZeile {
  readonly szenario: string;
  readonly kategorie: Fehlerkategorie;
  readonly fall: string;
  readonly erwarteterStatus: string;
  readonly beobachteterStatus: string;
  readonly pipelineZustand: 'nicht gestartet' | 'abgebrochen' | 'abgeschlossen';
}

// PE-18: `wirkung`/`fixtures_herkunft` nur Contract-Artefakt, `kategorien` nur Integration.
export interface Nachweisinhalt {
  readonly systemverhalten: string;
  // Integrations-Artefakt weist den Status je Kategorie in `kategorien` aus statt hier.
  readonly fehlerstatus?: string;
  readonly pipelineZustand?: 'nicht gestartet' | 'abgebrochen' | 'abgeschlossen';
  readonly ergebnis: 'pass' | 'fail';
  readonly anzahlTests: number;
  readonly laufzeitMs: number;
  // Contract-Tests wirken detektiv, nicht praeventiv: melden eine Abweichung, verhindern sie nicht.
  readonly wirkung?: 'detektiv';
  // 'synthetisch' macht eine fehlende Aufzeichnung im Artefakt selbst ablesbar.
  readonly fixtures_herkunft?: 'synthetisch' | 'aufgezeichnet' | 'gemischt';
  readonly kategorien?: readonly KategorieZeile[];
}

/** Schreibt `<wurzel>/<art>/<ts>/<art>.json` und aktualisiert `<wurzel>/<art>/latest.json`. */
export function schreibeNachweisArtefakt(
  wurzel: string,
  art: Nachweisart,
  inhalt: Nachweisinhalt,
): string {
  const zeitstempel = new Date().toISOString().replace(/[:.]/gu, '-');
  const verzeichnis = join(wurzel, art, zeitstempel);
  mkdirSync(verzeichnis, { recursive: true });

  const datei = join(verzeichnis, `${art}.json`);
  writeFileSync(datei, `${JSON.stringify({ art, zeitstempel, ...inhalt }, null, 2)}\n`, 'utf8');
  writeFileSync(
    join(wurzel, art, 'latest.json'),
    `${JSON.stringify({ art, zeitstempel, pfad: datei }, null, 2)}\n`,
    'utf8',
  );
  return datei;
}
