/**
 * Keine Modellformel. Minimaler Vektor-PDF-Schreiber fuer das Tornado-Diagramm.
 *
 * Warum kein Diagrammpaket: Der Bericht verlangt eine Vektorgrafik ohne externe
 * Abhaengigkeiten zur Laufzeit. Ein Tornado-Diagramm besteht aus gefuellten
 * Rechtecken, Linien und Text; eine Bibliothek braechte einen Rendering-Pfad mit, der im
 * Bericht nicht nachvollziehbar waere.
 *
 * Der Inhaltsstrom bleibt UNKOMPRIMIERT, damit die Datei diffbar und lesbar ist.
 *
 * KOPPLUNG, wichtig: Die Datei ist mit `latin1` zu schreiben. Die Byteversaetze der
 * Kreuzreferenztabelle werden hier ueber `Buffer.byteLength(..., 'latin1')` berechnet;
 * bei UTF-8 belegten Umlaute zwei Bytes und die Versaetze zeigten ins Leere.
 */
export type Farbe = readonly [number, number, number];

export type Element =
  | { art: 'rechteck'; x: number; y: number; breite: number; hoehe: number; fuellung: Farbe }
  | { art: 'linie'; x1: number; y1: number; x2: number; y2: number; breite: number; farbe: Farbe }
  | { art: 'text'; x: number; y: number; groesse: number; inhalt: string; farbe: Farbe };

export interface Seite {
  readonly breite: number;
  readonly hoehe: number;
  readonly elemente: readonly Element[];
}

const z = (n: number): string => (Math.round(n * 1000) / 1000).toString();

/** Klammern und Rueckstrich sind in PDF-Zeichenketten zu schuetzen. */
function pdfText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function inhaltsstrom(elemente: readonly Element[]): string {
  const teile: string[] = [];
  for (const e of elemente) {
    if (e.art === 'rechteck') {
      teile.push(`${z(e.fuellung[0])} ${z(e.fuellung[1])} ${z(e.fuellung[2])} rg`);
      teile.push(`${z(e.x)} ${z(e.y)} ${z(e.breite)} ${z(e.hoehe)} re f`);
    } else if (e.art === 'linie') {
      teile.push(`${z(e.farbe[0])} ${z(e.farbe[1])} ${z(e.farbe[2])} RG`);
      teile.push(`${z(e.breite)} w`);
      teile.push(`${z(e.x1)} ${z(e.y1)} m ${z(e.x2)} ${z(e.y2)} l S`);
    } else {
      teile.push(`${z(e.farbe[0])} ${z(e.farbe[1])} ${z(e.farbe[2])} rg`);
      teile.push('BT');
      teile.push(`/F1 ${z(e.groesse)} Tf`);
      teile.push(`${z(e.x)} ${z(e.y)} Td`);
      teile.push(`(${pdfText(e.inhalt)}) Tj`);
      teile.push('ET');
    }
  }
  return teile.join('\n');
}

export function schreibePdf(seite: Seite): string {
  const strom = inhaltsstrom(seite.elemente);
  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${z(seite.breite)} ${z(seite.hoehe)}] `
      + '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(strom, 'latin1')} >>\nstream\n${strom}\nendstream`,
  ];

  let ausgabe = '%PDF-1.4\n';
  const versaetze: number[] = [];
  objekte.forEach((inhalt, i) => {
    versaetze.push(Buffer.byteLength(ausgabe, 'latin1'));
    ausgabe += `${i + 1} 0 obj\n${inhalt}\nendobj\n`;
  });
  const xrefVersatz = Buffer.byteLength(ausgabe, 'latin1');
  ausgabe += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const v of versaetze) ausgabe += `${String(v).padStart(10, '0')} 00000 n \n`;
  ausgabe += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\n`;
  ausgabe += `startxref\n${xrefVersatz}\n%%EOF\n`;
  return ausgabe;
}
