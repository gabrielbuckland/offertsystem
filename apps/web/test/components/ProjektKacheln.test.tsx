import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjektKacheln } from '../../src/components/ProjektKacheln.js';

const EINTRAG = {
  id: '3f1c0d54-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  adresse: 'Seestrasse 1, 8001 Zürich',
  geaendertAm: '2026-08-24T10:00:00.000Z',
  anzahlEinheiten: 6,
  fehlerhaft: false,
  datei: '3f1c0d54-1a2b-4c3d-8e9f-0a1b2c3d4e5f.json',
};

describe('ProjektKacheln', () => {
  it('zeigt die Kennung nirgends an — auch nicht in der Fehlerkachel eines '
    + 'gleichnamigen defekten Projekts', () => {
    const defekt = { ...EINTRAG, fehlerhaft: true, adresse: '—' };
    const html = renderToStaticMarkup(<ProjektKacheln eintraege={[EINTRAG, defekt]} />);
    const ohneHrefs = html.replace(/href="[^"]*"/g, '');
    expect(ohneHrefs).not.toContain(EINTRAG.id);
  });

  it('kennzeichnet ein schemawidriges Projekt, statt es teilweise darzustellen', () => {
    const html = renderToStaticMarkup(
      <ProjektKacheln eintraege={[{ ...EINTRAG, fehlerhaft: true, adresse: '—' }]} />);
    expect(html).toContain('nicht lesbar');
  });

  it('rendert im Leerfall den LeererZustand-Titel und die uebergebene Aktion', () => {
    const html = renderToStaticMarkup(
      <ProjektKacheln eintraege={[]} leerAktion={<button type="button">Neues Projekt</button>} />);
    expect(html).toContain('Noch kein Projekt angelegt');
    expect(html).toContain('Neues Projekt');
  });
});
