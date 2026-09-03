import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Nachweisart = 'contract' | 'integration';

/**
 * Eine Zeile je gefahrenem Fall (nur Integrations-Artefakt). Erwarteter und
 * beobachteter Status stehen getrennt, damit die Tabelle in Kapitel 6 den Nachweis
 * «jede Fehlerkategorie endet in einem benannten Fehlerstatus» je Fall ablesbar
 * macht, statt ihn ueber eine Zusammenfassung zu behaupten.
 *
 * `kategorie` traegt eine der vier kanonischen Fehlerkategorien aus
 * tab:fehler_abbildung des Berichts (Transport/Verfuegbarkeit,
 * Zugriffs-/Anfragefehler, Kontingent, Vertragsbruch) oder «keine» fuer Erfolgs-
 * und Toleranzfaelle; `fall` benennt die konkrete Auspraegung. Die feste
 * Kategorienmenge macht die Vollstaendigkeitsaussage «alle vier Kategorien
 * gefahren» am Artefakt pruefbar (F-064).
 */
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

/**
 * Schema der Nachweisartefakte (PE-18). Die ersten sechs Felder sind fuer beide Arten
 * verbindlich; `wirkung` und `fixtures_herkunft` fuehrt nur das Contract-Artefakt,
 * `kategorien` nur das Integrations-Artefakt.
 */
export interface Nachweisinhalt {
  /** Was das System im gemessenen Lauf getan hat (Freitext, eine Zeile). */
  readonly systemverhalten: string;
  /**
   * Beobachteter Fehlerstatus: 'keiner' oder die ProviderFehler-Art bzw. HTTP-Status.
   * Das Integrations-Artefakt weist den Status je Kategorie in `kategorien` aus und
   * laesst dieses Summenfeld weg.
   */
  readonly fehlerstatus?: string;
  /** Zustand der Berechnungspipeline; im Integrations-Artefakt je Kategorie gefuehrt. */
  readonly pipelineZustand?: 'nicht gestartet' | 'abgebrochen' | 'abgeschlossen';
  readonly ergebnis: 'pass' | 'fail';
  readonly anzahlTests: number;
  readonly laufzeitMs: number;
  /**
   * Nur Contract-Artefakt: Die Contract-Tests wirken **detektiv**, nicht praeventiv —
   * sie melden eine Vertragsabweichung, sie verhindern sie nicht.
   */
  readonly wirkung?: 'detektiv';
  /**
   * Nur Contract-Artefakt: Herkunft der geprueften Fixtures. Solange es keine
   * aufgezeichneten Antworten gibt, steht hier 'synthetisch' — damit ist die
   * Nachweisluecke im Artefakt selbst ablesbar und nicht nur im Fliesstext behauptet.
   */
  readonly fixtures_herkunft?: 'synthetisch' | 'aufgezeichnet' | 'gemischt';
  /** Nur Integrations-Artefakt: eine Zeile je gefahrener Fehlerkategorie. */
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
