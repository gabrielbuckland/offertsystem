/**
 * Direkter Test von `SchluesselWertListe` (nicht ueber `ParametrisierungsDetail` oder
 * `DossierEditor`) — Task 19 vereinte zwei unabhaengig entstandene Interaktionsmuster
 * (Team A: Neu-Zeile mit Schluessel UND Wert zusammen; Team B: bestehender Wert direkt
 * editierbar) in dieser einen Komponente. Die Aufrufer-Tests sind dafuer zu grobkoernig
 * (`parametrisierung-detail.test.tsx` zaehlt nur Buttons/Markup, `DossierEditor` hat gar
 * keinen Test der Liste) — dieser Test pinnt das vereinte Verhalten direkt.
 *
 * `renderToStaticMarkup` haengt keine Handler an (kein jsdom im Repo): Klick-Interaktion
 * selbst ist hier nicht simulierbar. Die Struktur-Assertions unten weisen deshalb nach,
 * DASS beide Faehigkeiten vorhanden sind (zwei Eingabefelder in der Neu-Zeile, ein
 * editierbares statt eines nur-lesbaren Wertfelds je Zeile); die drei Entscheidungen —
 * Hinzufuegen, Entfernen, Wertaenderung — liegen als reine Funktionen daneben
 * (`schluessel-wert-logik.ts`, Muster `zellen-logik.test.ts`) und werden hier direkt
 * geprueft.
 *
 * Nicht abgedeckt und bewusst so: dass das JSX diese drei Funktionen tatsaechlich aufruft
 * — das setzte echte Ereignisse und damit jsdom voraus.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchluesselWertListe } from '../../../src/components/ui/schluessel-wert-liste.js';
import {
  naechsteEintraegeNachEntfernen,
  naechsteEintraegeNachHinzufuegen,
  naechsteEintraegeNachWertaenderung,
} from '../../../src/components/ui/schluessel-wert-logik.js';

function zeichne(eintraege: Readonly<Record<string, string>>) {
  return renderToStaticMarkup(
    <SchluesselWertListe eintraege={eintraege} aendere={() => undefined} />,
  );
}

/** Zerlegt eine `<input .../>`-Tag-Zeichenkette, die den gegebenen `value`-Wert traegt —
 *  so lassen sich Attribute (readonly/disabled) genau dieses einen Feldes pruefen, ohne
 *  auf das Vorkommen im gesamten Markup angewiesen zu sein. */
function inputMitWert(html: string, wert: string): string {
  const treffer = new RegExp(`<input[^>]*value="${wert}"[^>]*>`).exec(html);
  if (treffer === null) throw new Error(`kein <input value="${wert}"> im Markup gefunden`);
  return treffer[0];
}

describe('SchluesselWertListe', () => {
  it('nimmt in der Neu-Zeile Schluessel UND Wert entgegen (zwei Felder, ein Button)', () => {
    const html = zeichne({});
    expect(html).toContain('placeholder="Schlüssel"');
    expect(html).toContain('placeholder="Wert"');
    expect(html.match(/Eintrag hinzufügen/g)).toHaveLength(1);
  });

  it('macht den Wert einer bestehenden Zeile direkt editierbar, den Schluessel nicht', () => {
    const html = zeichne({ zustand: 'gut' });
    const schluesselfeld = inputMitWert(html, 'zustand');
    const wertfeld = inputMitWert(html, 'gut');
    // Exaktes Attribut pruefen, nicht blosse Teilzeichenkette: die Tailwind-Klassen
    // enthalten "disabled:cursor-not-allowed" etc. auf JEDEM Feld, auch dem editierbaren.
    expect(schluesselfeld).toContain('readOnly=""');
    expect(schluesselfeld).toContain('disabled=""');
    expect(wertfeld).not.toContain('readOnly=""');
    expect(wertfeld).not.toContain('disabled=""');
  });

  it('bietet je bestehendem Eintrag eine «entfernen»-Schaltflaeche', () => {
    const html = zeichne({ zustand: 'gut', qualitaet: 'hoch' });
    expect(html.match(/entfernen/g)).toHaveLength(2);
  });

  it('rendert leer ohne Zeilen aber weiterhin mit der Neu-Zeile', () => {
    const html = zeichne({});
    expect(html.match(/entfernen/g)).toBeNull();
    expect(html).toContain('Eintrag hinzufügen');
  });
});

describe('naechsteEintraegeNachHinzufuegen (Leerschluessel-Sperre)', () => {
  it('haengt einen neuen Schluessel mit seinem Wert an', () => {
    expect(naechsteEintraegeNachHinzufuegen({ a: '1' }, 'b', '2')).toEqual({ a: '1', b: '2' });
  });

  it('ueberschreibt einen bereits vorhandenen Schluessel (Upsert)', () => {
    expect(naechsteEintraegeNachHinzufuegen({ a: '1' }, 'a', '9')).toEqual({ a: '9' });
  });

  it('weist einen leeren Schluessel ab (keine Aenderung)', () => {
    expect(naechsteEintraegeNachHinzufuegen({ a: '1' }, '', 'x')).toBeUndefined();
  });

  it('trimmt den Schluessel und weist einen nur aus Leerzeichen bestehenden ab', () => {
    expect(naechsteEintraegeNachHinzufuegen({}, '   ', 'x')).toBeUndefined();
    expect(naechsteEintraegeNachHinzufuegen({}, '  b  ', '2')).toEqual({ b: '2' });
  });
});

describe('naechsteEintraegeNachEntfernen', () => {
  it('entfernt genau den benannten Schluessel und laesst die uebrigen stehen', () => {
    expect(naechsteEintraegeNachEntfernen({ a: '1', b: '2', c: '3' }, 'b'))
      .toEqual({ a: '1', c: '3' });
  });

  it('trimmt den Schluessel NICHT — er stammt aus dem Bestand, nicht aus einer Eingabe', () => {
    expect(naechsteEintraegeNachEntfernen({ ' a ': '1', a: '2' }, ' a '))
      .toEqual({ a: '2' });
  });

  it('laesst einen unbekannten Schluessel den Stand unveraendert', () => {
    expect(naechsteEintraegeNachEntfernen({ a: '1' }, 'weg')).toEqual({ a: '1' });
  });

  it('gibt eine Kopie zurueck, statt den uebergebenen Stand zu veraendern', () => {
    const vorher = { a: '1', b: '2' };
    const nachher = naechsteEintraegeNachEntfernen(vorher, 'a');
    expect(vorher).toEqual({ a: '1', b: '2' });
    expect(nachher).not.toBe(vorher);
  });
});

describe('naechsteEintraegeNachWertaenderung', () => {
  it('ersetzt den Wert eines bestehenden Schluessels', () => {
    expect(naechsteEintraegeNachWertaenderung({ a: '1', b: '2' }, 'a', '9'))
      .toEqual({ a: '9', b: '2' });
  });

  it('uebernimmt einen leeren Wert — zulaessiger Zwischenstand beim Tippen', () => {
    expect(naechsteEintraegeNachWertaenderung({ a: '1' }, 'a', '')).toEqual({ a: '' });
  });

  it('trimmt den Wert nicht, damit ein Leerzeichen eintippbar bleibt', () => {
    expect(naechsteEintraegeNachWertaenderung({ a: '1' }, 'a', 'sehr  gut '))
      .toEqual({ a: 'sehr  gut ' });
  });

  it('legt einen unbekannten Schluessel an (dieselbe Upsert-Semantik wie beim Hinzufuegen)',
    () => {
      expect(naechsteEintraegeNachWertaenderung({ a: '1' }, 'b', '2'))
        .toEqual({ a: '1', b: '2' });
    });

  it('gibt eine Kopie zurueck, statt den uebergebenen Stand zu veraendern', () => {
    const vorher = { a: '1' };
    const nachher = naechsteEintraegeNachWertaenderung(vorher, 'a', '9');
    expect(vorher).toEqual({ a: '1' });
    expect(nachher).not.toBe(vorher);
  });
});
