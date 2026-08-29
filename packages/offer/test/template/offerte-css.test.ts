import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(new URL('../../src/template/offerte.css', import.meta.url), 'utf8');

describe('offerte.css — ein Stylesheet, ein Renderpfad', () => {
  it('fuehrt Bildschirm- und Druckregeln in derselben Datei', () => {
    expect(CSS).toContain('@media print');
    expect(CSS).toContain('.offerte');
  });

  it('verhindert Umbrueche in Einheitszeilen und Herkunftsbloecken', () => {
    for (const regel of ['size: A4 portrait', 'break-inside: avoid', 'display: table-header-group']) {
      expect(CSS).toContain(regel);
    }
  });

  it('haelt eine Fusszeilenklasse bereit', () => {
    expect(CSS).toContain('.offerte__fusszeile');
  });
});
