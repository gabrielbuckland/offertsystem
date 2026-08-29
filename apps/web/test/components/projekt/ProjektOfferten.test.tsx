/**
 * ABWEICHUNG VOM PLAN, bewusst: Der Brief zeigt `render`/`screen` aus
 * `@testing-library/react`. Das Paket ist in diesem Repo nicht installiert (kein
 * Eintrag in package.json/node_modules) und wird wegen `npm run check:deps` nicht
 * nachinstalliert. Stattdessen `renderToStaticMarkup`, Vorbild
 * `apps/web/test/components/shell.test.tsx`.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjektOfferten } from '../../../src/components/projekt/ProjektOfferten.js';

const EINTRAG = {
  offertId: 'abc12345-6789-def0-1234-56789abcdef0',
  projektId: 'p1',
  liegenschaft: 'Dorfstrasse 7, 6000 Luzern',
  erstelltAm: '2026-08-28T13:16:00.000Z',
  verkaufssumme: 1200000000,
  honorarMin: 20000000,
  honorarMax: 26000000,
  konfigPruefsumme: 'a'.repeat(64),
  fehlerhaft: false,
  datei: 'x.json',
};

describe('ProjektOfferten', () => {
  it('listet eine erzeugte Offerte mit Referenz, Datum, Honorarrange und Pruefsumme', () => {
    const html = renderToStaticMarkup(<ProjektOfferten eintraege={[EINTRAG]} />);
    expect(html).toContain('abc12345');
    expect(html).toMatch(/28\.08\.2026|2026-08-28/);
    expect(html).toContain(`href="/offerte/${EINTRAG.offertId}"`);
    expect(html).toContain(EINTRAG.konfigPruefsumme);
  });

  it('sagt im Leerfall, dass noch keine Offerte erzeugt wurde', () => {
    const html = renderToStaticMarkup(<ProjektOfferten eintraege={[]} />);
    expect(html).toMatch(/noch keine Offerte/i);
  });
});
