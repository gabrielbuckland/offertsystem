import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjektKacheln } from '../../src/components/ProjektKacheln.js';

const EINTRAG = {
  id: '3f1c0d54-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  adresse: 'Seestrasse 1, 8001 Zürich',
  geaendertAm: '2026-08-24T10:00:00.000Z',
  anzahlEinheiten: 6,
  fehlerhaft: false,
  datei: '3f1c0d54.json',
};

describe('ProjektKacheln', () => {
  it('betitelt jede Kachel mit der Adresse und verlinkt das Projekt', () => {
    const html = renderToStaticMarkup(<ProjektKacheln eintraege={[EINTRAG]} />);
    expect(html).toContain('Seestrasse 1, 8001 Zürich');
    expect(html).toContain(`/projekte/${EINTRAG.id}`);
  });

  it('zeigt die Kennung nirgends an', () => {
    const html = renderToStaticMarkup(<ProjektKacheln eintraege={[EINTRAG]} />);
    const ohneHrefs = html.replace(/href="[^"]*"/g, '');
    expect(ohneHrefs).not.toContain(EINTRAG.id);
  });

  it('kennzeichnet ein schemawidriges Projekt, statt es teilweise darzustellen', () => {
    const html = renderToStaticMarkup(
      <ProjektKacheln eintraege={[{ ...EINTRAG, fehlerhaft: true, adresse: '—' }]} />);
    expect(html).toContain('nicht lesbar');
  });
});
