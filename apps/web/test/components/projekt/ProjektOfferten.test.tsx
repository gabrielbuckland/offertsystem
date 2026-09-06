import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatiereHonorarProzent, berechneHonorarProzent } from '@offert/offer';
import { ProjektOfferten } from '../../../src/components/projekt/ProjektOfferten.js';

function prozentText(betragRappen: number, verkaufssummeRappen: number): string {
  const anteil = berechneHonorarProzent(betragRappen, verkaufssummeRappen);
  if (anteil === null) throw new Error('unerwartet null im Testfixture');
  return formatiereHonorarProzent(anteil);
}

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
  it('listet eine erzeugte Offerte mit Datum, Href und Pruefsumme', () => {
    const html = renderToStaticMarkup(<ProjektOfferten eintraege={[EINTRAG]} />);
    expect(html).toMatch(/28\.08\.2026|2026-08-28/);
    expect(html).toContain(`href="/offerte/${EINTRAG.offertId}"`);
    expect(html).toContain(EINTRAG.konfigPruefsumme);
  });

  it('zeigt den gewaehlten Honorarbetrag als Prozentsatz statt der Range, wenn die '
    + 'Offerte einen gewaehlten Betrag fuehrt', () => {
    const html = renderToStaticMarkup(
      <ProjektOfferten eintraege={[{ ...EINTRAG, honorar: 23_000_000 }]} />,
    );
    expect(html).toContain(prozentText(23_000_000, EINTRAG.verkaufssumme));
    expect(html).not.toContain(prozentText(EINTRAG.honorarMin, EINTRAG.verkaufssumme));
  });

  it('faellt auf die Range als Prozentspanne zurueck, wenn ein Altartefakt keinen '
    + 'gewaehlten Betrag fuehrt', () => {
    const html = renderToStaticMarkup(<ProjektOfferten eintraege={[EINTRAG]} />);
    expect(html).toContain(prozentText(EINTRAG.honorarMin, EINTRAG.verkaufssumme));
    expect(html).toContain(prozentText(EINTRAG.honorarMax, EINTRAG.verkaufssumme));
  });

  it('zeigt einen Bindestrich statt eines Prozentsatzes, wenn der Listeneintrag keine '
    + 'Verkaufssumme fuehrt', () => {
    const { verkaufssumme: _entfernt, ...ohneVerkaufssumme } = EINTRAG;
    const html = renderToStaticMarkup(<ProjektOfferten eintraege={[ohneVerkaufssumme]} />);
    expect(html).toContain('–');
  });
});
