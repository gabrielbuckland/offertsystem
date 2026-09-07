// Keine Modellformel. `oat.json` fuehrt je Parameter mehrere Zeilen (Stufe/Szenario);
// aggregiert wird je Vorzeichen auf den Betragsmaximalwert, Szenario bleibt zur
// Rueckverfolgbarkeit erhalten. Zeilen mit status !== 'ok' werden ausgelassen, sonst
// wuerde eine nicht gerechnete Variante faelschlich als Nullbalken erscheinen.
import type { Element, Farbe, Seite } from '../shared/pdf-writer.ts';

export interface OatZeile {
  readonly dimension: string;
  readonly parameter_id: string;
  readonly szenario_id: string;
  readonly status: string;
  readonly [feld: string]: unknown;
}

export interface Balken {
  readonly parameter_id: string;
  readonly dimension: string;
  readonly negativ_prozent: number | null;
  readonly positiv_prozent: number | null;
  readonly negativ_szenario: string | null;
  readonly positiv_szenario: string | null;
  readonly dominant: boolean;
}

export function baueBalken(
  zeilen: readonly OatZeile[],
  feld: string,
  schwelle: number,
): readonly Balken[] {
  const je = new Map<string, Balken>();
  for (const z of zeilen) {
    if (z.status !== 'ok') continue;
    const wert = z[feld];
    if (typeof wert !== 'number') continue;
    const vorhanden = je.get(z.parameter_id) ?? {
      parameter_id: z.parameter_id, dimension: z.dimension,
      negativ_prozent: null, positiv_prozent: null,
      negativ_szenario: null, positiv_szenario: null, dominant: false,
    };
    const neu = wert < 0
      ? (vorhanden.negativ_prozent === null || wert < vorhanden.negativ_prozent
          ? { ...vorhanden, negativ_prozent: wert, negativ_szenario: z.szenario_id }
          : vorhanden)
      : (vorhanden.positiv_prozent === null || wert > vorhanden.positiv_prozent
          ? { ...vorhanden, positiv_prozent: wert, positiv_szenario: z.szenario_id }
          : vorhanden);
    je.set(z.parameter_id, neu);
  }
  const betrag = (b: Balken): number =>
    Math.max(Math.abs(b.negativ_prozent ?? 0), Math.abs(b.positiv_prozent ?? 0));
  return [...je.values()]
    .map((b) => ({ ...b, dominant: betrag(b) > schwelle }))
    .sort((a, b) => betrag(b) - betrag(a) || a.parameter_id.localeCompare(b.parameter_id));
}

const RAND_LINKS = 150;
const RAND_RECHTS = 30;
const RAND_OBEN = 40;
const RAND_UNTEN = 40;
const BALKEN_HOEHE = 14;
const BALKEN_ABSTAND = 8;
const BREITE = 520;
const FARBE_NEG: Farbe = [0.35, 0.45, 0.70];
const FARBE_POS: Farbe = [0.75, 0.40, 0.25];
const GRAU: Farbe = [0.55, 0.55, 0.55];

export function zeichne(
  balken: readonly Balken[],
  opt: { schwelle: number },
): Seite {
  const spanne = Math.max(
    opt.schwelle * 1.5,
    ...balken.flatMap((b) => [
      Math.abs(b.negativ_prozent ?? 0), Math.abs(b.positiv_prozent ?? 0),
    ]),
  ) * 1.1;
  const zeichenbreite = BREITE - RAND_LINKS - RAND_RECHTS;
  const mitte = RAND_LINKS + zeichenbreite / 2;
  const hoehe = RAND_OBEN + RAND_UNTEN + balken.length * (BALKEN_HOEHE + BALKEN_ABSTAND);
  const xVon = (prozent: number): number => mitte + (prozent / spanne) * (zeichenbreite / 2);

  const elemente: Element[] = [
    { art: 'text', x: mitte - 46, y: RAND_UNTEN - 30, groesse: 8, inhalt: 'relative Änderung in %', farbe: [0, 0, 0] },
    { art: 'linie', x1: mitte, y1: RAND_UNTEN - 6, x2: mitte, y2: hoehe - RAND_OBEN + 6, breite: 0.8, farbe: [0, 0, 0] },
    { art: 'linie', x1: xVon(-opt.schwelle), y1: RAND_UNTEN - 6, x2: xVon(-opt.schwelle), y2: hoehe - RAND_OBEN + 6, breite: 0.5, farbe: GRAU },
    { art: 'linie', x1: xVon(opt.schwelle), y1: RAND_UNTEN - 6, x2: xVon(opt.schwelle), y2: hoehe - RAND_OBEN + 6, breite: 0.5, farbe: GRAU },
    { art: 'text', x: xVon(-opt.schwelle) - 14, y: RAND_UNTEN - 18, groesse: 7, inhalt: `-${opt.schwelle} %`, farbe: GRAU },
    { art: 'text', x: xVon(opt.schwelle) - 8, y: RAND_UNTEN - 18, groesse: 7, inhalt: `+${opt.schwelle} %`, farbe: GRAU },
  ];

  balken.forEach((b, i) => {
    const y = hoehe - RAND_OBEN - (i + 1) * (BALKEN_HOEHE + BALKEN_ABSTAND);
    elemente.push({
      art: 'text', x: 8, y: y + 4, groesse: 8,
      inhalt: `${b.dimension} ${b.parameter_id}`, farbe: [0, 0, 0],
    });
    const neg = b.negativ_prozent ?? 0;
    const pos = b.positiv_prozent ?? 0;
    elemente.push({
      art: 'rechteck', x: xVon(neg), y, breite: Math.max(0.5, mitte - xVon(neg)),
      hoehe: BALKEN_HOEHE, fuellung: FARBE_NEG,
    });
    elemente.push({
      art: 'rechteck', x: mitte, y, breite: Math.max(0.5, xVon(pos) - mitte),
      hoehe: BALKEN_HOEHE, fuellung: FARBE_POS,
    });
  });

  return { breite: BREITE, hoehe, elemente };
}
