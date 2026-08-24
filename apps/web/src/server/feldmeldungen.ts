/**
 * Keine Formel. Uebersetzung Zod-Befund -> feldverankerte Meldung (US-01, NFA-11, AK-3.5).
 *
 * Jede Meldung nennt Feld und verletzten Wertebereich konkret und haengt an genau einem
 * Feldpfad; eine Sammelliste am Formularkopf gibt es nicht. Rohe Zod-Ausgaben,
 * HTTP-Statuscodes und Stapelverfolgungen erreichen die Oberflaeche nie.
 */
import type { Konfiguration } from '@offert/core';
// Modulpfad statt Paketindex: Der Index re-exportiert die React-Komponenten (.tsx);
// Node leistet fuer JSX kein Type-Stripping (PE-09). Serverseitige Module, die unter
// Node laufen sollen, binden die Formatierer deshalb ueber ihren Modulpfad ein.
import { formatiereProzent, formatiereZimmerzahl } from '@offert/offer/src/format/de-ch.js';
import type { z } from 'zod';
import { erfassungsSchema } from './erfassung-schema.js';

export interface Feldmeldung {
  readonly feldpfad: string;
  readonly text: string;
}

function letztesSegment(feldpfad: string): string {
  const teile = feldpfad.split('.');
  return teile[teile.length - 1] ?? '';
}

/**
 * Feldweise Abbildung der Zod-Ausgaben. Bewusst ueber das letzte Pfadsegment und nicht
 * ueber den Zod-Code: Der Vermarkter liest ein Feld, keinen Befundtyp.
 */
function standardtext(feldpfad: string, issue: z.ZodIssue, k: Konfiguration): string {
  const feld = letztesSegment(feldpfad);
  const erfasst = (issue as { received?: unknown }).received;
  switch (feld) {
    case 'zimmerzahl':
      return `Zimmeranzahl muss zwischen ${formatiereZimmerzahl(1)} und `
        + `${formatiereZimmerzahl(12)} liegen`
        + (typeof erfasst === 'number' ? ` (erfasst: ${formatiereZimmerzahl(erfasst)})` : '')
        + '.';
    case 'flaecheInnen':
      return 'Wohnfläche muss grösser als 0 m² sein.';
    case 'flaecheAussen':
      return 'Aussenfläche darf nicht negativ sein.';
    case 'plz':
      return 'Postleitzahl besteht aus vier Ziffern.';
    case 'begruendung':
      return 'Die Begründung ist Pflicht und muss mindestens '
        + `${k.preisanpassung.begruendungMinLaenge} Zeichen umfassen.`;
    case 'wohnungsnummer':
      return 'Die Wohnungsnummer ist ein Pflichtfeld.';
    case 'strasse':
    case 'hausnummer':
    case 'ort':
    case 'name':
    case 'referenznummer':
      return 'Dieses Feld ist ein Pflichtfeld.';
    default:
      return 'Der erfasste Wert ist an dieser Stelle nicht zulässig.';
  }
}

export function zuFeldmeldungen(
  fehler: z.ZodError, k: Konfiguration,
): readonly Feldmeldung[] {
  return fehler.issues.map((i) => {
    const feldpfad = i.path.join('.');
    const p = ((i as { params?: Record<string, unknown> }).params ?? {});
    const regel = p['regel'];
    if (regel === 'Z_GRENZEN') {
      return {
        feldpfad,
        text: `Die Summe der Anpassungen beträgt ${formatiereProzent(Number(p['z']))} und liegt `
          + 'ausserhalb des zulässigen Bereichs '
          + `[${formatiereProzent(Number(p['min']))}, ${formatiereProzent(Number(p['max']))}].`,
      };
    }
    if (regel === 'NUMMER_DOPPELT') {
      return {
        feldpfad,
        text: `Die Wohnungsnummer «${String(p['nummer'])}» kommt mehrfach vor `
          + `(Einheiten ${(p['indizes'] as number[]).map((n) => n + 1).join(', ')}). `
          + 'Wohnungsnummern müssen innerhalb der Liegenschaft eindeutig sein.',
      };
    }
    if (regel === 'TYP_DOPPELT') {
      return {
        feldpfad,
        text: `Für ${formatiereZimmerzahl(Number(p['zimmerzahl']))} Zimmer ist bereits ein `
          + 'Wohnungstyp definiert. Je vorkommender Zimmerzahl ist genau ein Typ zulässig.',
      };
    }
    return { feldpfad, text: standardtext(feldpfad, i, k) };
  });
}

/** Prueft eine Erfassung und liefert ausschliesslich feldverankerte Meldungen. */
export function pruefeErfassung(eingabe: unknown, k: Konfiguration): readonly Feldmeldung[] {
  const ergebnis = erfassungsSchema(k).safeParse(eingabe);
  return ergebnis.success ? [] : zuFeldmeldungen(ergebnis.error, k);
}
