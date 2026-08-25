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
 * Vorbelegt wird der SPALTENSCHNITT samt Erfassungsform und Regel — nicht mehr blind der
 * Wert. Fuer eine Spalte OHNE Regel bleibt `vorgabewert` weiterhin neutral bei 0: Der
 * Vorgabewert einer Spalte wird in jede neu erzeugte Einheit uebernommen
 * (einheiten-generator.ts). Truege er stattdessen den `vorgabefaktor` der Vorlage, erhielte
 * jede Einheit auf einen Schlag alle sieben Anpassungen — «Attikalage» und «Erdgeschoss» und
 * «Laermexposition» zugleich — und die Offerte wiese sie als Entscheidung des Vermarkters
 * aus. Genau das schliesst anpassungsvorlagen.ts fuer regellose Vorlagen weiterhin aus:
 * Vorlagen werden VORGESCHLAGEN, ein automatisch gesetzter Zu-/Abschlag waere ein
 * Herkunftsfehler und die Musterform des Automation Bias. Der Faktor einer regellosen
 * Vorlage bleibt der Weg ueber `uebernehmeVorlage`, also eine Handlung des Vermarkters.
 *
 * Fuer eine Spalte MIT Regel gilt das nicht: Die Regel IST die Bedingung, unter der die
 * Anpassung greift (Task 2/3, `pruefeBereiche`/`werteBereichsregelAus`). Sie zu uebernehmen
 * ist keine automatisch getroffene Entscheidung, sondern die Staffel selbst, die der
 * Vermarkter durch das erfasste Merkmal (z. B. Stockwerk) bereits beeinflusst. Deshalb
 * traegt eine regelbehaftete Spalte deren Erfassungsform und Regel, aber keinen
 * `vorgabewert` (Schema schliesst beide gegenseitig aus, `projekt-schema.ts`).
 */
import type { Konfiguration } from '@offert/core';
import { leseVorlagen } from './anpassungsvorlagen.js';
import type { AnpassungsSpalte } from './projekt-schema.js';

export function vorbelegteSpalten(k: Konfiguration): readonly AnpassungsSpalte[] {
  return leseVorlagen(k).map((v, i) => ({
    id: `S-${i + 1}`,
    bezeichnung: v.bezeichnung,
    erfassungsform: v.erfassungsform,
    // Traegt die Vorlage eine Regel, entscheidet die Regel — ein Vorgabewert waere
    // daneben bedeutungslos und wuerde als Uebersteuerung missverstanden.
    // Ohne Regel bleibt der Vorgabewert neutral bei 0: Eine unbedingte Vorbelegung
    // gaebe jeder neuen Einheit auf einen Schlag alle Vorlagen zugleich.
    //
    // Die Bereiche werden flach kopiert, nicht durchgereicht: Der Kern fuehrt
    // `bereiche` als `readonly Bereich[]` (packages/core), das Projektschema als
    // gewoehnliches Array (Zod-Inferenz) — die Kopie bringt die Kern-Form auf die
    // Schemaform, ohne die Werte selbst zu veraendern.
    ...(v.regel === undefined
      ? { vorgabewert: 0 }
      : { regel: { merkmal: v.regel.merkmal, bereiche: v.regel.bereiche.map((b) => ({ ...b })) } }),
  }));
}
