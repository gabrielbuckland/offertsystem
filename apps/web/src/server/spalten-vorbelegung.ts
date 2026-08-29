// US-04 AK 5, E-25: Leitet die Spalten eines neuen Projekts aus den firmenweiten Vorlagen
// ab. Vorbelegung statt Vorgabe — das Projekt darf Spalten ergaenzen, umbenennen und
// entfernen.
//
// Fuer eine Spalte OHNE Regel bleibt `vorgabewert` neutral bei 0: Truege sie den
// `vorgabefaktor` der Vorlage, erhielte jede neue Einheit auf einen Schlag alle Vorlagen
// zugleich, und die Offerte wiese das als Entscheidung des Vermarkters aus (Automation
// Bias). Der Faktor bleibt der Weg ueber `uebernehmeVorlage`.
//
// Fuer eine Spalte MIT Regel gilt das nicht: Die Regel IST die Bedingung, unter der die
// Anpassung greift, keine automatisch getroffene Entscheidung. Deshalb traegt eine
// regelbehaftete Spalte Erfassungsform und Regel, aber keinen `vorgabewert` (Schema
// schliesst beide gegenseitig aus).
import type { Konfiguration } from '@offert/core';
import { leseVorlagen } from './anpassungsvorlagen.js';
import type { AnpassungsSpalte } from './projekt-schema.js';

export function vorbelegteSpalten(k: Konfiguration): readonly AnpassungsSpalte[] {
  return leseVorlagen(k).map((v, i) => ({
    id: `S-${i + 1}`,
    bezeichnung: v.bezeichnung,
    erfassungsform: v.erfassungsform,
    // Bereiche flach kopiert, nicht durchgereicht: Kern fuehrt sie als `readonly Bereich[]`,
    // das Projektschema als gewoehnliches Array (Zod-Inferenz).
    ...(v.regel === undefined
      ? { vorgabewert: 0 }
      : { regel: { merkmal: v.regel.merkmal, bereiche: v.regel.bereiche.map((b) => ({ ...b })) } }),
  }));
}
