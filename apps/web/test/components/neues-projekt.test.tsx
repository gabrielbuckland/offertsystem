import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NeuesProjekt } from '../../src/components/NeuesProjekt.js';

// `useRouter()` wirft ohne einen App-Router-Baum ("invariant expected app router to be
// mounted") — anders als z. B. `usePathname()`, das ausserhalb einfach `null` liefert
// (vgl. NavPunkt.tsx). Das Repo fuehrt kein jsdom und keinen App-Router in Tests, darum
// wird der Hook selbst gemockt (gleiches Vorgehen wie in AnpassungsSpalten.test.tsx);
// `vi.mock` wird von Vitest an den Modulanfang gehoben, die Reihenfolge hier ist unerheblich.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {},
    prefetch: () => {},
  }),
}));

// Ein natives <dialog> laesst sich in `renderToStaticMarkup` nicht oeffnen (kein DOM),
// darum prueft dieser Test nur das statische Markup: Element, Felder und Beschriftung.
describe('NeuesProjekt', () => {
  it('beschriftet die Auslöser-Schaltfläche mit «Neues Projekt»', () => {
    const html = renderToStaticMarkup(<NeuesProjekt />);
    expect(html).toContain('Neues Projekt');
  });

  it('enthaelt ein natives dialog-Element mit den vier Adressfeldern', () => {
    const html = renderToStaticMarkup(<NeuesProjekt />);
    expect(html).toContain('<dialog');
    expect(html).toContain('id="neues-projekt-strasse"');
    expect(html).toContain('id="neues-projekt-hausnummer"');
    expect(html).toContain('id="neues-projekt-plz"');
    expect(html).toContain('id="neues-projekt-ort"');
  });

  it('bietet im Dialog Abbrechen- und Anlegen-Schaltflaechen', () => {
    const html = renderToStaticMarkup(<NeuesProjekt />);
    expect(html).toContain('Abbrechen');
    expect(html).toContain('Anlegen');
  });
});
