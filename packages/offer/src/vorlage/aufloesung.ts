/**
 * Keine Formel. Platzhalter-Auflösung beim Finalisieren.
 *
 * Reine Funktion Dokument+Werte -> Dokument, läuft genau EINMAL beim Finalisieren — das
 * abgelegte Artefakt enthält das Ergebnis, nie die Vorlage (US-13). Deshalb wird hier
 * geworfen statt markiert: Ein unaufgelöster Platzhalter wäre ein halbes Artefakt (I-24).
 * Das Ergebnis wird abschliessend gegen `aufgeloestesDokumentSchema` geprüft.
 */
import {
  aufgeloestesDokumentSchema,
  type AufgeloestesDokument,
  type OffertDokument,
} from './dokument-schema.js';
import { TEXT_PLATZHALTER, type PlatzhalterWerte, type TextPlatzhalterId } from './platzhalter.js';

export class PlatzhalterFehler extends Error {
  // Feldzuweisung statt Parametereigenschaft: `node --experimental-strip-types` (PE-09)
  // uebersetzt nicht, es entfernt nur Typen — eine Parametereigenschaft verlangte eine
  // Codeerzeugung und bricht jeden strip-only-Einstiegspunkt (u.a. `beispiel:offerte`).
  public readonly id: string;
  public readonly grund: 'unbekannt' | 'fehlt';

  constructor(id: string, grund: 'unbekannt' | 'fehlt') {
    super(grund === 'unbekannt'
      ? `Unbekannter Platzhalter «${id}» im Offerttext.`
      : `Für den Platzhalter «${id}» liegt kein Wert vor.`);
    this.id = id;
    this.grund = grund;
    this.name = 'PlatzhalterFehler';
  }
}

const BEKANNT = new Set<string>(TEXT_PLATZHALTER);

function textFuer(id: string, werte: PlatzhalterWerte): string {
  if (!BEKANNT.has(id)) throw new PlatzhalterFehler(id, 'unbekannt');
  const wert = werte.texte[id as TextPlatzhalterId];
  if (wert === undefined) throw new PlatzhalterFehler(id, 'fehlt');
  return wert;
}

function loeseKnoten(knoten: unknown, werte: PlatzhalterWerte): unknown {
  if (Array.isArray(knoten)) return knoten.map((k) => loeseKnoten(k, werte));
  if (typeof knoten !== 'object' || knoten === null) return knoten;
  const k = knoten as Record<string, unknown> & { type?: string };
  if (k.type === 'platzhalter') {
    const id = (k['attrs'] as { id: string }).id;
    return { type: 'text', text: textFuer(id, werte) };
  }
  if (k.type === 'platzhalterTabelle') {
    return { type: 'preistabelle', attrs: { zeilen: werte.preistabelle } };
  }
  if (k['content'] === undefined) return k;
  return { ...k, content: loeseKnoten(k['content'], werte) };
}

export function loeseDokumentAuf(
  dokument: OffertDokument, werte: PlatzhalterWerte,
): AufgeloestesDokument {
  return aufgeloestesDokumentSchema.parse(loeseKnoten(dokument, werte));
}
