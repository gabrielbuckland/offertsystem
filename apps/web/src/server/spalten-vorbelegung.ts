// US-04 AK 5, E-25: Vorbelegung statt Vorgabe — das Projekt darf Spalten ergaenzen,
// umbenennen und entfernen.
//
// `vorgabewert` bleibt bei einer Spalte OHNE Regel neutral bei 0: Truege sie den
// `vorgabefaktor` der Vorlage, erhielte jede neue Einheit auf einen Schlag alle Vorlagen
// zugleich, als vermeintliche Entscheidung des Vermarkters (Automation Bias). Der Faktor
// bleibt der Weg ueber `uebernehmeVorlage`.
//
// Bei einer Spalte MIT Regel gilt das nicht: Die Regel IST die Bedingung, keine
// automatisch getroffene Entscheidung. Deshalb traegt sie Erfassungsform und Regel, aber
// keinen `vorgabewert` (Schema schliesst beide gegenseitig aus).
import type { Konfiguration } from '@offert/core';
import type { Anpassungsvorlage } from './anpassungsvorlagen.js';
import { leseVorlagen } from './anpassungsvorlagen.js';
import type { AnpassungsSpalte } from './projekt-schema.js';

export function spalteAusVorlage(v: Anpassungsvorlage, id: string): AnpassungsSpalte {
  return {
    id,
    bezeichnung: v.bezeichnung,
    erfassungsform: v.erfassungsform,
    // Flach kopiert statt durchgereicht: Kern fuehrt Bereiche als `readonly Bereich[]`,
    // das Projektschema als gewoehnliches Array (Zod-Inferenz).
    ...(v.regel === undefined
      ? { vorgabewert: 0 }
      : { regel: { merkmal: v.regel.merkmal, bereiche: v.regel.bereiche.map((b) => ({ ...b })) } }),
  };
}

export function vorbelegteSpalten(k: Konfiguration): readonly AnpassungsSpalte[] {
  return leseVorlagen(k).map((v, i) => spalteAusVorlage(v, `S-${i + 1}`));
}
