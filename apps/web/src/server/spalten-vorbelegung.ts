/**
 * Keine Formel. Leitet die Spalten eines neuen Projekts aus den firmenweiten Vorlagen ab.
 *
 * Vorbelegung statt Vorgabe: Die Vorlagen sind ein Vorschlag (US-04 AK 5, E-25). Das
 * Projekt darf Spalten ergaenzen, umbenennen und entfernen; das Excel des Auftraggebers
 * zeigt je Blatt einen anderen Spaltenschnitt.
 *
 * `Anpassungsvorlage` fuehrt zwei Texte (packages/core/src/config/typen.ts): `bezeichnung`
 * ist das kurze Etikett fuer die Spaltenkopfzeile, `begruendungVorschlag` der ausformulierte
 * Satz, der eine Position rechtfertigt. Die Spalte uebernimmt darum `bezeichnung` — der
 * Satz bleibt dort, wofuer er gedacht ist: als `begruendung` der aus der Spalte abgeleiteten
 * Position (projektion.ts).
 *
 * Vorbelegt wird der SPALTENSCHNITT, nicht der Wert: `vorgabewert` startet neutral bei 0.
 * Der Vorgabewert einer Spalte wird in jede neu erzeugte Einheit uebernommen
 * (einheiten-generator.ts). Truege er den `vorgabefaktor` der Vorlage, erhielte jede
 * Einheit auf einen Schlag alle sieben Anpassungen — «Attikalage» und «Erdgeschoss» und
 * «Laermexposition» zugleich — und die Offerte wiese sie als Entscheidung des Vermarkters
 * aus. Genau das schliesst anpassungsvorlagen.ts aus: Vorlagen werden VORGESCHLAGEN, ein
 * automatisch gesetzter Zu-/Abschlag waere ein Herkunftsfehler und die Musterform des
 * Automation Bias. Der Faktor der Vorlage bleibt der Weg ueber `uebernehmeVorlage`, also
 * eine Handlung des Vermarkters.
 */
import type { Konfiguration } from '@offert/core';
import { leseVorlagen } from './anpassungsvorlagen.js';
import type { AnpassungsSpalte } from './projekt-schema.js';

export function vorbelegteSpalten(k: Konfiguration): readonly AnpassungsSpalte[] {
  return leseVorlagen(k).map((v, i) => ({
    id: `S-${i + 1}`,
    bezeichnung: v.bezeichnung,
    erfassungsform: 'relativ' as const,
    vorgabewert: 0,
  }));
}
