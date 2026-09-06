// I-24: Dokumentwahl als Funktion der Artefaktform (nie halb).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErgebnisDarstellung } from '../../src/components/ErgebnisDarstellung.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

const DOKUMENT = {
  inhalt: {
    type: 'doc' as const,
    content: [{ type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: 'Kundentext' }] }],
  },
  vorlageVersion: '1',
};

describe('ErgebnisDarstellung', () => {
  it('zeigt bei neuem Artefakt das Kundendokument und den Rechenweg nur eingeklappt', () => {
    const html = renderToStaticMarkup(
      <ErgebnisDarstellung offerte={{ ...baueBeispielOfferte(), dokument: DOKUMENT }} />,
    );
    expect(html).toContain('Kundentext');
    expect(html).toContain('vermarktungsofferte');
    expect(html).toContain('Rechenweg');
    expect(html).toContain('<details');
  });

  it('zeigt Alt-Artefakte ohne Dokumentblock weiterhin als Rechenweg', () => {
    const html = renderToStaticMarkup(
      <ErgebnisDarstellung offerte={baueBeispielOfferte()} />,
    );
    expect(html).not.toContain('vermarktungsofferte');
    expect(html).toContain('Aufwandfaktor');
  });
});
