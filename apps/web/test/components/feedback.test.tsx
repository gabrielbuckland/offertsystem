import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hinweis } from '../../src/components/ui/hinweis.js';
import { StatusZeile } from '../../src/components/ui/status-zeile.js';
import { LeererZustand } from '../../src/components/ui/leerer-zustand.js';

describe('Hinweis', () => {
  it('traegt bei Fehlern immer role=alert, sonst role=status', () => {
    expect(renderToStaticMarkup(<Hinweis art="fehler">kaputt</Hinweis>))
      .toContain('role="alert"');
    expect(renderToStaticMarkup(<Hinweis art="info">nur so</Hinweis>))
      .toContain('role="status"');
  });
  it('unterscheidet die Varianten sichtbar', () => {
    const fehler = renderToStaticMarkup(<Hinweis art="fehler">x</Hinweis>);
    const erfolg = renderToStaticMarkup(<Hinweis art="erfolg">x</Hinweis>);
    expect(fehler).not.toEqual(erfolg);
    expect(fehler).toContain('text-destructive');
  });
});

describe('StatusZeile', () => {
  it('zeigt den Text und kennzeichnet den laufenden Vorgang', () => {
    const html = renderToStaticMarkup(<StatusZeile text="Speichert…" />);
    expect(html).toContain('Speichert…');
    expect(html).toContain('role="status"');
  });
});

describe('LeererZustand', () => {
  it('nennt Titel, Beschreibung und traegt die Aktion', () => {
    const html = renderToStaticMarkup(
      <LeererZustand titel="Noch kein Projekt" beschreibung="Legen Sie das erste an."
                     aktion={<button type="button">Neues Projekt</button>} />,
    );
    expect(html).toContain('Noch kein Projekt');
    expect(html).toContain('Neues Projekt');
  });
});
