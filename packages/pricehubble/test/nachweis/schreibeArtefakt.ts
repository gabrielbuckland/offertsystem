import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Nachweisart = 'contract' | 'integration';

/**
 * Schema der Nachweisartefakte (PE-18). Die ersten sechs Felder sind fuer beide Arten
 * verbindlich; `wirkung` und `fixtures_herkunft` fuehrt nur das Contract-Artefakt.
 */
export interface Nachweisinhalt {
  /** Was das System im gemessenen Lauf getan hat (Freitext, eine Zeile). */
  readonly systemverhalten: string;
  /** Beobachteter Fehlerstatus: 'keiner' oder die ProviderFehler-Art bzw. HTTP-Status. */
  readonly fehlerstatus: string;
  /** Zustand der Berechnungspipeline: 'nicht gestartet' | 'abgebrochen' | 'abgeschlossen'. */
  readonly pipelineZustand: 'nicht gestartet' | 'abgebrochen' | 'abgeschlossen';
  readonly ergebnis: 'pass' | 'fail';
  readonly anzahlTests: number;
  readonly laufzeitMs: number;
  /**
   * Nur Contract-Artefakt: Die Contract-Tests wirken **detektiv**, nicht praeventiv —
   * sie melden eine Vertragsabweichung, sie verhindern sie nicht.
   */
  readonly wirkung?: 'detektiv';
  /**
   * Nur Contract-Artefakt: Herkunft der geprueften Fixtures. Solange Aufgabe 18
   * blockiert ist, steht hier 'synthetisch' — damit ist die Nachweisluecke aus G-2
   * im Artefakt selbst ablesbar und nicht nur im Fliesstext behauptet.
   */
  readonly fixtures_herkunft?: 'synthetisch' | 'aufgezeichnet' | 'gemischt';
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
