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
 * editierbares statt eines nur-lesbaren Wertfelds je Zeile); die Leerschluessel-Sperre
 * selbst wird als reine Funktion getestet (`schluessel-wert-logik.ts`, Muster
 * `zellen-logik.test.ts`).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchluesselWertListe } from '../../../src/components/ui/schluessel-wert-liste.js';
import { naechsteEintraegeNachHinzufuegen } from '../../../src/components/ui/schluessel-wert-logik.js';

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
