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
 * (`schluessel-wert-logik.ts`) und werden in `schluessel-wert-logik.test.ts` geprueft.
 *
 * Nicht abgedeckt und bewusst so: dass das JSX diese drei Funktionen tatsaechlich aufruft
 * — das setzte echte Ereignisse und damit jsdom voraus.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchluesselWertListe } from '../../../src/components/ui/schluessel-wert-liste.js';

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
});
